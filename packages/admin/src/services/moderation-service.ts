/**
 * @module @skillancer/admin/services
 * Content moderation service
 */

import type { AdminService, Logger } from './admin-service.js';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export interface ModerationQueueItem {
  id: string;
  type: 'course' | 'job' | 'profile' | 'review' | 'message' | 'proposal';
  contentId: string;
  contentTitle: string;
  contentPreview: string;
  userId: string;
  userEmail: string;
  reportedBy?: string;
  reportReason?: string;
  autoFlagged: boolean;
  flagReasons: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'escalated';
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationDecision {
  action: 'approve' | 'reject' | 'request_changes' | 'escalate' | 'ban_user';
  reason: string;
  internalNotes?: string;
  requestedChanges?: string;
  notifyUser?: boolean;
}

export interface ContentFilter {
  id: string;
  name: string;
  type: 'keyword' | 'regex' | 'ml_model';
  pattern: string;
  action: 'flag' | 'block' | 'review';
  severity: 'low' | 'medium' | 'high';
  isActive: boolean;
  matchCount: number;
  createdAt: Date;
}

export interface ModerationStats {
  pending: number;
  inReview: number;
  resolvedToday: number;
  avgResolutionTime: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  byModerator: { moderatorId: string; name: string; resolved: number }[];
}

export class ModerationService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger,
    private adminService: AdminService,
    private moderationQueue: Queue
  ) {}

  // ==================== Moderation Queue ====================

  async getModerationQueue(
    filters: {
      type?: string;
      status?: string;
      priority?: string;
      assignedTo?: string;
      page?: number;
      limit?: number;
    },
    adminUserId: string
  ): Promise<{ items: ModerationQueueItem[]; total: number }> {
    await this.adminService.requirePermission(adminUserId, 'content:read');

    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;

    const [items, total] = await Promise.all([
      (this.prisma as any).moderationQueue.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        skip: ((filters.page || 1) - 1) * (filters.limit || 20),
        take: filters.limit || 20,
      }),
      (this.prisma as any).moderationQueue.count({ where }),
    ]);

    return { items: items as ModerationQueueItem[], total };
  }

  async getModerationItem(
    itemId: string,
    adminUserId: string
  ): Promise<{ item: ModerationQueueItem; content: unknown; history: unknown[] }> {
    await this.adminService.requirePermission(adminUserId, 'content:read');

    const item = await (this.prisma as any).moderationQueue.findUnique({
      where: { id: itemId },
    });

    if (!item) throw new Error('Moderation item not found');

    const content = await this.getContentById(item.type, item.contentId);

    const history = await (this.prisma as any).moderationHistory.findMany({
      where: { moderationQueueId: itemId },
      orderBy: { createdAt: 'desc' },
      include: {
        moderator: { select: { name: true } },
      },
    });

    if (item.status === 'pending') {
      await (this.prisma as any).moderationQueue.update({
        where: { id: itemId },
        data: {
          status: 'in_review',
          assignedTo: adminUserId,
          updatedAt: new Date(),
        },
      });
    }

    return {
      item: item as ModerationQueueItem,
      content,
      history,
    };
  }

  async makeDecision(
    itemId: string,
    decision: ModerationDecision,
    adminUserId: string
  ): Promise<void> {
    await this.adminService.requirePermission(adminUserId, 'content:moderate');

    const item = await (this.prisma as any).moderationQueue.findUnique({
      where: { id: itemId },
    });

    if (!item) throw new Error('Moderation item not found');

    switch (decision.action) {
      case 'approve':
        await this.approveContent(item, adminUserId);
        break;
      case 'reject':
        await this.rejectContent(item, decision.reason, adminUserId);
        break;
      case 'request_changes':
        await this.requestChanges(item, decision.requestedChanges!, adminUserId);
        break;
      case 'escalate':
        await this.escalateContent(item, decision.reason, adminUserId);
        break;
      case 'ban_user':
        await this.banUserFromModeration(item, decision.reason, adminUserId);
        break;
    }

    await (this.prisma as any).moderationQueue.update({
      where: { id: itemId },
      data: {
        status:
          decision.action === 'escalate'
            ? 'escalated'
            : decision.action === 'request_changes'
              ? 'pending'
              : decision.action === 'approve'
                ? 'approved'
                : 'rejected',
        updatedAt: new Date(),
      },
    });

    await (this.prisma as any).moderationHistory.create({
      data: {
        moderationQueueId: itemId,
        moderatorId: adminUserId,
        action: decision.action,
        reason: decision.reason,
        internalNotes: decision.internalNotes,
      },
    });

    if (decision.notifyUser) {
      await this.sendModerationNotification(item, decision);
    }

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'moderate',
      resource: { type: item.type, id: item.contentId, name: item.contentTitle },
      details: {
        metadata: { decision: decision.action, reason: decision.reason },
      },
    });
  }

  private async approveContent(item: ModerationQueueItem, adminUserId: string): Promise<void> {
    const updateData = { status: 'published', moderatedAt: new Date(), moderatedBy: adminUserId };

    switch (item.type) {
      case 'course':
        await (this.prisma as any).course.update({
          where: { id: item.contentId },
          data: updateData,
        });
        break;
      case 'job':
        await (this.prisma as any).job.update({ where: { id: item.contentId }, data: updateData });
        break;
      case 'profile':
        await (this.prisma as any).profile.update({
          where: { id: item.contentId },
          data: { ...updateData, status: 'approved' },
        });
        break;
      case 'review':
        await (this.prisma as any).review.update({
          where: { id: item.contentId },
          data: { isVisible: true, moderatedAt: new Date() },
        });
        break;
    }
  }

  private async rejectContent(
    item: ModerationQueueItem,
    reason: string,
    adminUserId: string
  ): Promise<void> {
    const updateData = {
      status: 'rejected',
      rejectionReason: reason,
      moderatedAt: new Date(),
      moderatedBy: adminUserId,
    };

    switch (item.type) {
      case 'course':
        await (this.prisma as any).course.update({
          where: { id: item.contentId },
          data: updateData,
        });
        break;
      case 'job':
        await (this.prisma as any).job.update({ where: { id: item.contentId }, data: updateData });
        break;
      case 'profile':
        await (this.prisma as any).profile.update({
          where: { id: item.contentId },
          data: updateData,
        });
        break;
      case 'review':
        await (this.prisma as any).review.update({
          where: { id: item.contentId },
          data: { isVisible: false, moderatedAt: new Date() },
        });
        break;
    }
  }

  private async requestChanges(
    item: ModerationQueueItem,
    changes: string,
    adminUserId: string
  ): Promise<void> {
    await (this.prisma as any).moderationChangeRequest.create({
      data: {
        contentType: item.type,
        contentId: item.contentId,
        userId: item.userId,
        requestedChanges: changes,
        requestedBy: adminUserId,
      },
    });
  }

  private async escalateContent(
    item: ModerationQueueItem,
    reason: string,
    adminUserId: string
  ): Promise<void> {
    this.logger.warn('Content escalated', { itemId: item.id, reason, escalatedBy: adminUserId });
  }

  private async banUserFromModeration(
    item: ModerationQueueItem,
    reason: string,
    _adminUserId: string
  ): Promise<void> {
    await (this.prisma as any).user.update({
      where: { id: item.userId },
      data: {
        status: 'banned',
        banReason: reason,
        bannedAt: new Date(),
      },
    });
  }

  private async getContentById(type: string, contentId: string): Promise<unknown> {
    switch (type) {
      case 'course':
        return (this.prisma as any).course.findUnique({
          where: { id: contentId },
          include: { author: true },
        });
      case 'job':
        return (this.prisma as any).job.findUnique({
          where: { id: contentId },
          include: { client: true },
        });
      case 'profile':
        return (this.prisma as any).profile.findUnique({
          where: { id: contentId },
          include: { user: true },
        });
      case 'review':
        return (this.prisma as any).review.findUnique({
          where: { id: contentId },
          include: { reviewer: true },
        });
      default:
        return null;
    }
  }

  private async sendModerationNotification(
    item: ModerationQueueItem,
    decision: ModerationDecision
  ): Promise<void> {
    this.logger.info('Sending moderation notification', {
      userId: item.userId,
      action: decision.action,
    });
  }

  // ==================== Content Filters ====================

  async getContentFilters(): Promise<ContentFilter[]> {
    return (this.prisma as any).contentFilter.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createContentFilter(
    data: Omit<ContentFilter, 'id' | 'matchCount' | 'createdAt'>,
    adminUserId: string
  ): Promise<ContentFilter> {
    await this.adminService.requirePermission(adminUserId, 'content:moderate');

    const filter = await (this.prisma as any).contentFilter.create({
      data: {
        ...data,
        matchCount: 0,
      },
    });

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'create',
      resource: { type: 'setting', id: filter.id, name: filter.name },
    });

    return filter;
  }

  async updateContentFilter(
    filterId: string,
    data: Partial<ContentFilter>,
    adminUserId: string
  ): Promise<ContentFilter> {
    await this.adminService.requirePermission(adminUserId, 'content:moderate');

    const filter = await (this.prisma as any).contentFilter.update({
      where: { id: filterId },
      data,
    });

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'update',
      resource: { type: 'setting', id: filterId, name: filter.name },
    });

    return filter;
  }

  async deleteContentFilter(filterId: string, adminUserId: string): Promise<void> {
    await this.adminService.requirePermission(adminUserId, 'content:moderate');

    const filter = await (this.prisma as any).contentFilter.delete({
      where: { id: filterId },
    });

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'delete',
      resource: { type: 'setting', id: filterId, name: filter.name },
    });
  }

  // ==================== Moderation Stats ====================

  async getModerationStats(adminUserId: string): Promise<ModerationStats> {
    await this.adminService.requirePermission(adminUserId, 'content:read');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pending, inReview, resolvedToday, byType, byPriority, byModerator] = await Promise.all([
      (this.prisma as any).moderationQueue.count({ where: { status: 'pending' } }),
      (this.prisma as any).moderationQueue.count({ where: { status: 'in_review' } }),
      (this.prisma as any).moderationQueue.count({
        where: {
          status: { in: ['approved', 'rejected'] },
          updatedAt: { gte: today },
        },
      }),
      (this.prisma as any).moderationQueue.groupBy({
        by: ['type'],
        where: { status: 'pending' },
        _count: true,
      }),
      (this.prisma as any).moderationQueue.groupBy({
        by: ['priority'],
        where: { status: 'pending' },
        _count: true,
      }),
      (this.prisma as any).moderationHistory.groupBy({
        by: ['moderatorId'],
        where: { createdAt: { gte: today } },
        _count: true,
      }),
    ]);

    return {
      pending,
      inReview,
      resolvedToday,
      avgResolutionTime: 0, // Would calculate from history
      byType: Object.fromEntries(byType.map((t: any) => [t.type, t._count])),
      byPriority: Object.fromEntries(byPriority.map((p: any) => [p.priority, p._count])),
      byModerator: byModerator.map((m: any) => ({
        moderatorId: m.moderatorId,
        name: 'Unknown', // Would join with admin users
        resolved: m._count,
      })),
    };
  }

  // ==================== Auto-moderation ====================

  async scanContent(content: string): Promise<{ flagged: boolean; reasons: string[] }> {
    const filters = await (this.prisma as any).contentFilter.findMany({
      where: { isActive: true },
    });

    const reasons: string[] = [];

    for (const filter of filters) {
      let matched = false;

      if (filter.type === 'keyword') {
        matched = content.toLowerCase().includes(filter.pattern.toLowerCase());
      } else if (filter.type === 'regex') {
        try {
          const regex = new RegExp(filter.pattern, 'i');
          matched = regex.test(content);
        } catch {
          this.logger.error('Invalid regex pattern', { filterId: filter.id });
        }
      }

      if (matched) {
        reasons.push(filter.name);

        await (this.prisma as any).contentFilter.update({
          where: { id: filter.id },
          data: { matchCount: { increment: 1 } },
        });
      }
    }

    return { flagged: reasons.length > 0, reasons };
  }

  async queueForModeration(
    type: ModerationQueueItem['type'],
    contentId: string,
    contentTitle: string,
    contentPreview: string,
    userId: string,
    userEmail: string,
    options?: {
      reportedBy?: string;
      reportReason?: string;
      autoFlagged?: boolean;
      flagReasons?: string[];
      priority?: ModerationQueueItem['priority'];
    }
  ): Promise<ModerationQueueItem> {
    const item = await (this.prisma as any).moderationQueue.create({
      data: {
        type,
        contentId,
        contentTitle,
        contentPreview,
        userId,
        userEmail,
        reportedBy: options?.reportedBy,
        reportReason: options?.reportReason,
        autoFlagged: options?.autoFlagged || false,
        flagReasons: options?.flagReasons || [],
        priority: options?.priority || 'medium',
        status: 'pending',
      },
    });

    return item as ModerationQueueItem;
  }
}
