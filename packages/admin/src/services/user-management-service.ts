/**
 * @module @skillancer/admin/services
 * User management service - user search, actions, bulk operations
 */

import type { AdminService, Logger } from './admin-service.js';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export interface UserSearchFilters {
  query?: string;
  accountType?: 'freelancer' | 'client' | 'both';
  status?: 'active' | 'suspended' | 'banned' | 'pending';
  emailVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  country?: string;
  hasSubscription?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'lastActiveAt' | 'email' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface UserDetails {
  user: unknown;
  profile: unknown;
  stats: UserStats;
  recentActivity: UserActivity[];
  subscriptions: unknown[];
  tickets: unknown[];
  flags: UserFlag[];
  notes: AdminNote[];
}

export interface UserStats {
  totalEarnings?: number;
  totalSpent?: number;
  contractsCompleted?: number;
  avgRating?: number;
  coursesCompleted?: number;
  proposalsSent?: number;
  jobsPosted?: number;
  disputesCount?: number;
  ticketsCount?: number;
  lastActiveAt?: Date;
}

export interface UserActivity {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UserFlag {
  id: string;
  type: 'warning' | 'review' | 'fraud' | 'spam' | 'tos_violation';
  reason: string;
  createdAt: Date;
  createdBy: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface AdminNote {
  id: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
}

export interface BanDetails {
  reason: string;
  duration?: 'permanent' | '7_days' | '30_days' | '90_days';
  internalNotes?: string;
  notifyUser?: boolean;
}

export class UserManagementService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger,
    private adminService: AdminService,
    private exportQueue: Queue
  ) {}

  // ==================== User Search & Listing ====================

  async searchUsers(
    filters: UserSearchFilters,
    adminUserId: string
  ): Promise<{ users: unknown[]; total: number; page: number; totalPages: number }> {
    await this.adminService.requirePermission(adminUserId, 'users:read');

    const where: Record<string, unknown> = {};
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);

    if (filters.query) {
      where.OR = [
        { email: { contains: filters.query, mode: 'insensitive' } },
        { profile: { name: { contains: filters.query, mode: 'insensitive' } } },
        { id: filters.query },
      ];
    }

    if (filters.accountType) where.accountType = filters.accountType;
    if (filters.status) where.status = filters.status;
    if (filters.emailVerified !== undefined) where.emailVerified = filters.emailVerified;
    if (filters.country) where.profile = { country: filters.country };
    if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
    if (filters.createdBefore) {
      where.createdAt = { ...((where.createdAt as object) || {}), lte: filters.createdBefore };
    }

    const [users, total] = await Promise.all([
      (this.prisma as any).user.findMany({
        where,
        include: {
          profile: true,
          _count: {
            select: {
              contracts: true,
              supportTickets: true,
            },
          },
        },
        orderBy: { [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).user.count({ where }),
    ]);

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'view',
      resource: { type: 'user', id: 'search', name: `Search: ${filters.query || 'all'}` },
      details: { metadata: { filters, resultCount: users.length } },
    });

    return {
      users: users.map((u: unknown) => this.sanitizeUser(u)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserDetails(userId: string, adminUserId: string): Promise<UserDetails> {
    await this.adminService.requirePermission(adminUserId, 'users:read');

    const [user, stats, recentActivity, subscriptions, tickets, flags, notes] = await Promise.all([
      (this.prisma as any).user.findUnique({
        where: { id: userId },
        include: {
          profile: true,
          freelancerProfile: true,
          clientProfile: true,
        },
      }),
      this.getUserStats(userId),
      this.getUserRecentActivity(userId),
      this.getUserSubscriptions(userId),
      this.getUserTickets(userId),
      this.getUserFlags(userId),
      this.getAdminNotes(userId),
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'view',
      resource: { type: 'user', id: userId, name: user.email },
    });

    return {
      user: this.sanitizeUser(user),
      profile: user.profile,
      stats,
      recentActivity,
      subscriptions,
      tickets,
      flags,
      notes,
    };
  }

  private async getUserStats(userId: string): Promise<UserStats> {
    const [earnings, spent, contracts, rating, courses, proposals, jobs, disputes, tickets] =
      await Promise.all([
        (this.prisma as any).payment.aggregate({
          where: { freelancerId: userId, status: 'completed' },
          _sum: { amount: true },
        }),
        (this.prisma as any).payment.aggregate({
          where: { clientId: userId, status: 'completed' },
          _sum: { amount: true },
        }),
        (this.prisma as any).contract.count({
          where: { OR: [{ freelancerId: userId }, { clientId: userId }], status: 'completed' },
        }),
        (this.prisma as any).review.aggregate({
          where: { revieweeId: userId },
          _avg: { rating: true },
        }),
        (this.prisma as any).courseEnrollment.count({
          where: { userId, status: 'completed' },
        }),
        (this.prisma as any).proposal.count({ where: { freelancerId: userId } }),
        (this.prisma as any).job.count({ where: { clientId: userId } }),
        (this.prisma as any).dispute.count({
          where: { OR: [{ freelancerId: userId }, { clientId: userId }] },
        }),
        (this.prisma as any).supportTicket.count({ where: { userId } }),
      ]);

    const lastActivity = await (this.prisma as any).userActivity.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    });

    return {
      totalEarnings: earnings._sum?.amount || 0,
      totalSpent: spent._sum?.amount || 0,
      contractsCompleted: contracts,
      avgRating: rating._avg?.rating || 0,
      coursesCompleted: courses,
      proposalsSent: proposals,
      jobsPosted: jobs,
      disputesCount: disputes,
      ticketsCount: tickets,
      lastActiveAt: lastActivity?.timestamp,
    };
  }

  private async getUserRecentActivity(userId: string): Promise<UserActivity[]> {
    const activities = await (this.prisma as any).userActivity.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return activities.map((a: any) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      timestamp: a.timestamp,
      metadata: a.metadata as Record<string, unknown>,
    }));
  }

  private async getUserSubscriptions(userId: string): Promise<unknown[]> {
    return (this.prisma as any).subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getUserTickets(userId: string): Promise<unknown[]> {
    return (this.prisma as any).supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  private async getUserFlags(userId: string): Promise<UserFlag[]> {
    return (this.prisma as any).userFlag.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<UserFlag[]>;
  }

  private async getAdminNotes(userId: string): Promise<AdminNote[]> {
    const notes = await (this.prisma as any).adminNote.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByAdmin: {
          select: { name: true },
        },
      },
    });

    return notes.map((n: any) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt,
      createdBy: n.createdBy,
      createdByName: n.createdByAdmin?.name || 'Unknown',
    }));
  }

  // ==================== User Actions ====================

  async updateUser(
    userId: string,
    data: {
      email?: string;
      status?: string;
      emailVerified?: boolean;
    },
    adminUserId: string,
    reason?: string
  ): Promise<unknown> {
    await this.adminService.requirePermission(adminUserId, 'users:write');

    const existing = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!existing) throw new Error('User not found');

    const updated = await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'update',
      resource: { type: 'user', id: userId, name: existing.email },
      details: {
        before: { email: existing.email, status: existing.status },
        after: data,
        reason,
      },
    });

    return this.sanitizeUser(updated);
  }

  async banUser(userId: string, banDetails: BanDetails, adminUserId: string): Promise<void> {
    await this.adminService.requirePermission(adminUserId, 'users:ban');

    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    let banExpiresAt: Date | null = null;
    if (banDetails.duration && banDetails.duration !== 'permanent') {
      const daysMap = { '7_days': 7, '30_days': 30, '90_days': 90 };
      banExpiresAt = new Date();
      banExpiresAt.setDate(banExpiresAt.getDate() + daysMap[banDetails.duration]);
    }

    await (this.prisma as any).$transaction([
      (this.prisma as any).user.update({
        where: { id: userId },
        data: {
          status: 'banned',
          bannedAt: new Date(),
          banReason: banDetails.reason,
          banExpiresAt,
        },
      }),
      (this.prisma as any).userFlag.create({
        data: {
          userId,
          type: 'tos_violation',
          reason: banDetails.reason,
          createdBy: adminUserId,
        },
      }),
    ]);

    await this.invalidateUserSessions(userId);
    await this.handleBanSideEffects(userId);

    if (banDetails.notifyUser) {
      await this.sendBanNotification(user.email, banDetails.reason, banExpiresAt);
    }

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'ban',
      resource: { type: 'user', id: userId, name: user.email },
      details: {
        reason: banDetails.reason,
        metadata: {
          duration: banDetails.duration,
          expiresAt: banExpiresAt,
          internalNotes: banDetails.internalNotes,
        },
      },
    });
  }

  async unbanUser(userId: string, reason: string, adminUserId: string): Promise<void> {
    await this.adminService.requirePermission(adminUserId, 'users:ban');

    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.status !== 'banned') throw new Error('User is not banned');

    await (this.prisma as any).user.update({
      where: { id: userId },
      data: {
        status: 'active',
        bannedAt: null,
        banReason: null,
        banExpiresAt: null,
      },
    });

    await this.sendUnbanNotification(user.email);

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'unban',
      resource: { type: 'user', id: userId, name: user.email },
      details: { reason },
    });
  }

  async verifyUser(
    userId: string,
    adminUserId: string,
    verificationType: 'email' | 'identity' | 'skills'
  ): Promise<void> {
    await this.adminService.requirePermission(adminUserId, 'users:verify');

    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const updateData: Record<string, unknown> = {};
    if (verificationType === 'email') {
      updateData.emailVerified = true;
      updateData.emailVerifiedAt = new Date();
    } else if (verificationType === 'identity') {
      updateData.identityVerified = true;
      updateData.identityVerifiedAt = new Date();
    }

    await (this.prisma as any).user.update({
      where: { id: userId },
      data: updateData,
    });

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'verify',
      resource: { type: 'user', id: userId, name: user.email },
      details: { metadata: { verificationType } },
    });
  }

  async impersonateUser(
    userId: string,
    adminUserId: string
  ): Promise<{ token: string; expiresAt: Date }> {
    await this.adminService.requirePermission(adminUserId, 'users:impersonate');

    const user = await (this.prisma as any).user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const token = await this.generateImpersonationToken(userId, adminUserId);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.redis.setex(
      `impersonation:${token}`,
      3600,
      JSON.stringify({
        userId,
        adminUserId,
        startedAt: new Date(),
      })
    );

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'impersonate',
      resource: { type: 'user', id: userId, name: user.email },
    });

    return { token, expiresAt };
  }

  async addAdminNote(userId: string, content: string, adminUserId: string): Promise<AdminNote> {
    await this.adminService.requirePermission(adminUserId, 'users:read');

    const adminUser = await this.adminService.getAdminUser(adminUserId);

    const note = await (this.prisma as any).adminNote.create({
      data: {
        targetUserId: userId,
        content,
        createdBy: adminUserId,
      },
    });

    return {
      id: note.id,
      content: note.content,
      createdAt: note.createdAt,
      createdBy: adminUserId,
      createdByName: adminUser?.name || 'Unknown',
    };
  }

  async addUserFlag(
    userId: string,
    flag: { type: UserFlag['type']; reason: string },
    adminUserId: string
  ): Promise<UserFlag> {
    await this.adminService.requirePermission(adminUserId, 'users:write');

    const created = await (this.prisma as any).userFlag.create({
      data: {
        userId,
        type: flag.type,
        reason: flag.reason,
        createdBy: adminUserId,
      },
    });

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'update',
      resource: { type: 'user', id: userId },
      details: { metadata: { flagType: flag.type, reason: flag.reason } },
    });

    return created as UserFlag;
  }

  async resolveUserFlag(flagId: string, adminUserId: string): Promise<void> {
    await this.adminService.requirePermission(adminUserId, 'users:write');

    const flag = await (this.prisma as any).userFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new Error('Flag not found');

    await (this.prisma as any).userFlag.update({
      where: { id: flagId },
      data: {
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
      },
    });
  }

  // ==================== Bulk Operations ====================

  async exportUsers(
    filters: UserSearchFilters,
    format: 'csv' | 'json',
    adminUserId: string
  ): Promise<{ jobId: string }> {
    await this.adminService.requirePermission(adminUserId, 'users:export');

    const jobId = `export-${Date.now()}`;

    await this.exportQueue.add('user-export', {
      jobId,
      filters,
      format,
      requestedBy: adminUserId,
    });

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'export',
      resource: { type: 'user', id: jobId, name: 'Bulk Export' },
      details: { metadata: { filters, format } },
    });

    return { jobId };
  }

  async bulkUpdateUsers(
    userIds: string[],
    action: 'verify_email' | 'suspend' | 'activate',
    adminUserId: string,
    reason: string
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    await this.adminService.requirePermission(adminUserId, 'users:write');

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        switch (action) {
          case 'verify_email':
            await this.verifyUser(userId, adminUserId, 'email');
            break;
          case 'suspend':
            await this.updateUser(userId, { status: 'suspended' }, adminUserId, reason);
            break;
          case 'activate':
            await this.updateUser(userId, { status: 'active' }, adminUserId, reason);
            break;
        }
        success++;
      } catch (error) {
        failed++;
        errors.push(`${userId}: ${(error as Error).message}`);
      }
    }

    await this.adminService.logAuditEvent({
      adminUserId,
      action: 'update',
      resource: { type: 'user', id: 'bulk', name: 'Bulk Update' },
      details: {
        metadata: { action, userCount: userIds.length, success, failed },
        reason,
      },
    });

    return { success, failed, errors };
  }

  // ==================== Helper Methods ====================

  private sanitizeUser(user: unknown): unknown {
    const u = user as Record<string, unknown>;
    const { passwordHash: _passwordHash, ...sanitized } = u;
    return sanitized;
  }

  private async invalidateUserSessions(userId: string): Promise<void> {
    const pattern = `session:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async handleBanSideEffects(userId: string): Promise<void> {
    await (this.prisma as any).proposal.updateMany({
      where: { freelancerId: userId, status: 'pending' },
      data: { status: 'withdrawn' },
    });

    await (this.prisma as any).job.updateMany({
      where: { clientId: userId, status: 'open' },
      data: { status: 'suspended' },
    });
  }

  private async sendBanNotification(
    email: string,
    reason: string,
    expiresAt: Date | null
  ): Promise<void> {
    this.logger.info('Sending ban notification', { email, reason, expiresAt });
  }

  private async sendUnbanNotification(email: string): Promise<void> {
    this.logger.info('Sending unban notification', { email });
  }

  private async generateImpersonationToken(_userId: string, _adminUserId: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}
