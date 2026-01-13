/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Review Invitation Service
 *
 * Handles the review invitation workflow:
 * - Creating invitations when contracts complete
 * - Sending reminder notifications
 * - Managing invitation lifecycle and expiration
 */

import type { PrismaClient, ReviewInvitation, ReviewType } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

export interface CreateInvitationParams {
  contractId: string;
  userId: string;
  reviewType: ReviewType;
  expiresAt?: Date;
}

export interface InvitationWithDetails extends ReviewInvitation {
  contract: {
    id: string;
    title: string;
    client: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
    freelancer: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

export interface PendingInvitation {
  id: string;
  contractId: string;
  reviewType: ReviewType;
  expiresAt: Date;
  contract: {
    id: string;
    title: string;
    otherParty: {
      id: string;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

// Default review window in days
const DEFAULT_REVIEW_WINDOW_DAYS = 14;
// Reminder schedule (days before expiry)
const REMINDER_SCHEDULE = [7, 3, 1];

export class ReviewInvitationService {
  private readonly INVITATION_CACHE_PREFIX = 'review:invitation:';

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  /**
   * Create review invitations for a completed contract
   * Creates invitations for both parties
   */
  async createInvitationsForContract(contractId: string): Promise<ReviewInvitation[]> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_REVIEW_WINDOW_DAYS);

    // Create invitations for both parties
    const invitations = await Promise.all([
      // Client reviews freelancer
      this.createInvitation({
        contractId,
        userId: contract.clientId,
        reviewType: 'CLIENT_TO_FREELANCER',
        expiresAt,
      }),
      // Freelancer reviews client
      this.createInvitation({
        contractId,
        userId: contract.freelancerId,
        reviewType: 'FREELANCER_TO_CLIENT',
        expiresAt,
      }),
    ]);

    this.logger.info({
      msg: 'Review invitations created',
      contractId,
      invitationIds: invitations.map((i) => i.id),
    });

    return invitations;
  }

  /**
   * Create a single invitation
   */
  async createInvitation(params: CreateInvitationParams): Promise<ReviewInvitation> {
    const { contractId, userId, reviewType, expiresAt } = params;

    // Check for existing invitation
    const existing = await this.prisma.reviewInvitation.findFirst({
      where: {
        contractId,
        userId,
        reviewType,
      },
    });

    if (existing) {
      return existing;
    }

    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + DEFAULT_REVIEW_WINDOW_DAYS);

    const invitation = await this.prisma.reviewInvitation.create({
      data: {
        contractId,
        userId,
        reviewType,
        expiresAt: expiresAt || defaultExpiry,
      },
    });

    // Cache the invitation
    await this.redis.setex(
      `${this.INVITATION_CACHE_PREFIX}${invitation.id}`,
      60 * 60 * 24, // 24 hours
      JSON.stringify(invitation)
    );

    return invitation;
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userId: string): Promise<PendingInvitation[]> {
    const invitations = await this.prisma.reviewInvitation.findMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        contract: {
          select: {
            id: true,
            title: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            freelancer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      contractId: inv.contractId,
      reviewType: inv.reviewType,
      expiresAt: inv.expiresAt,
      contract: {
        id: inv.contract.id,
        title: inv.contract.title,
        otherParty:
          inv.reviewType === 'CLIENT_TO_FREELANCER' ? inv.contract.freelancer : inv.contract.client,
      },
    }));
  }

  /**
   * Mark invitation as completed
   */
  async markCompleted(
    contractId: string,
    reviewType: ReviewType
  ): Promise<ReviewInvitation | null> {
    const invitation = await this.prisma.reviewInvitation.findFirst({
      where: {
        contractId,
        reviewType,
        status: 'PENDING',
      },
    });

    if (!invitation) {
      this.logger.warn({
        msg: 'Invitation not found for completion',
        contractId,
        reviewType,
      });
      return null;
    }

    const updated = await this.prisma.reviewInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.redis.del(`${this.INVITATION_CACHE_PREFIX}${invitation.id}`);

    return updated;
  }

  /**
   * Process expired invitations
   */
  async processExpiredInvitations(): Promise<number> {
    const result = await this.prisma.reviewInvitation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      this.logger.info({
        msg: 'Expired review invitations',
        count: result.count,
      });
    }

    return result.count;
  }

  /**
   * Get invitations needing reminders
   */
  async getInvitationsNeedingReminders(): Promise<ReviewInvitation[]> {
    const now = new Date();
    const invitations: ReviewInvitation[] = [];

    for (const daysBeforeExpiry of REMINDER_SCHEDULE) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);

      // Find invitations expiring on this target date
      const matching = await this.prisma.reviewInvitation.findMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            gte: new Date(targetDate.setHours(0, 0, 0, 0)),
            lt: new Date(targetDate.setHours(23, 59, 59, 999)),
          },
          OR: [
            { lastReminderAt: null },
            {
              lastReminderAt: {
                lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // At least 24h since last reminder
              },
            },
          ],
        },
      });

      invitations.push(...matching);
    }

    return invitations;
  }

  /**
   * Send reminder for an invitation
   */
  async sendReminder(invitationId: string): Promise<void> {
    const invitation = await this.prisma.reviewInvitation.findUnique({
      where: { id: invitationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
        contract: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      return;
    }

    // FUTURE: Send actual notification via notification service
    // For now, just update reminder tracking
    await this.prisma.reviewInvitation.update({
      where: { id: invitationId },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
      },
    });

    this.logger.info({
      msg: 'Review reminder sent',
      invitationId,
      userId: invitation.userId,
      contractId: invitation.contractId,
      reminderCount: invitation.reminderCount + 1,
    });
  }

  /**
   * Get all invitations (admin)
   */
  async getAllInvitations(options: { page?: number; limit?: number } = {}): Promise<{
    invitations: InvitationWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [invitations, total] = await Promise.all([
      this.prisma.reviewInvitation.findMany({
        include: {
          contract: {
            select: {
              id: true,
              title: true,
              client: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              freelancer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.reviewInvitation.count(),
    ]);

    return {
      invitations: invitations as InvitationWithDetails[],
      total,
      page,
      limit,
    };
  }

  /**
   * Get invitation statistics
   */
  async getStatistics(): Promise<{
    pending: number;
    completed: number;
    expired: number;
    completionRate: number;
  }> {
    const [pending, completed, expired, total] = await Promise.all([
      this.prisma.reviewInvitation.count({ where: { status: 'PENDING' } }),
      this.prisma.reviewInvitation.count({ where: { status: 'COMPLETED' } }),
      this.prisma.reviewInvitation.count({ where: { status: 'EXPIRED' } }),
      this.prisma.reviewInvitation.count(),
    ]);

    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      pending,
      completed,
      expired,
      completionRate: Math.round(completionRate * 100) / 100,
    };
  }
}
