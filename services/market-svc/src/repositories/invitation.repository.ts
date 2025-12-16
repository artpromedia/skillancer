/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/invitation
 * Project Invitation data access layer
 */

import type { InvitationStatus, InvitationListOptions } from '../types/bidding.types.js';
import type { PrismaClient, Prisma } from '@skillancer/database';

/**
 * Invitation Repository
 *
 * Handles database operations for project invitations.
 */
export class InvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new invitation
   */
  async create(data: {
    jobId: string;
    inviterId: string;
    inviteeId: string;
    message?: string;
    expiresAt: Date;
  }) {
    return this.prisma.projectInvitation.create({
      data: {
        jobId: data.jobId,
        inviterId: data.inviterId,
        inviteeId: data.inviteeId,
        message: data.message ?? null,
        expiresAt: data.expiresAt,
        status: 'PENDING',
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            slug: true,
            budgetMin: true,
            budgetMax: true,
            currency: true,
          },
        },
      },
    });
  }

  /**
   * Find an invitation by ID
   */
  async findById(id: string) {
    return this.prisma.projectInvitation.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            budgetMin: true,
            budgetMax: true,
            currency: true,
            budgetType: true,
            duration: true,
            experienceLevel: true,
            isRemote: true,
            status: true,
            client: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                ratingAggregation: {
                  select: {
                    clientAverageRating: true,
                    clientTotalReviews: true,
                  },
                },
              },
            },
            skills: {
              include: {
                skill: true,
              },
            },
          },
        },
        inviter: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        invitee: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            profile: {
              select: {
                title: true,
                hourlyRate: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find an invitation by job and invitee
   */
  async findByJobAndInvitee(jobId: string, inviteeId: string) {
    return this.prisma.projectInvitation.findUnique({
      where: {
        jobId_inviteeId: {
          jobId,
          inviteeId,
        },
      },
    });
  }

  /**
   * Find invitations sent by a user (client)
   */
  async findSentByUser(inviterId: string, options: InvitationListOptions = {}) {
    const { status, page = 1, limit = 20 } = options;

    const where: Prisma.ProjectInvitationWhereInput = {
      inviterId,
    };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const offset = (page - 1) * limit;

    const [invitations, total] = await Promise.all([
      this.prisma.projectInvitation.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.projectInvitation.count({ where }),
    ]);

    return {
      invitations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find invitations received by a user (freelancer)
   */
  async findReceivedByUser(inviteeId: string, options: InvitationListOptions = {}) {
    const { status, page = 1, limit = 20 } = options;

    const where: Prisma.ProjectInvitationWhereInput = {
      inviteeId,
    };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const offset = (page - 1) * limit;

    const [invitations, total] = await Promise.all([
      this.prisma.projectInvitation.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              slug: true,
              budgetMin: true,
              budgetMax: true,
              currency: true,
              client: {
                select: {
                  id: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.projectInvitation.count({ where }),
    ]);

    return {
      invitations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find invitations for a project
   */
  async findByProjectId(jobId: string, options: InvitationListOptions = {}) {
    const { status, page = 1, limit = 20 } = options;

    const where: Prisma.ProjectInvitationWhereInput = {
      jobId,
    };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const offset = (page - 1) * limit;

    const [invitations, total] = await Promise.all([
      this.prisma.projectInvitation.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.projectInvitation.count({ where }),
    ]);

    return {
      invitations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update an invitation
   */
  async update(id: string, data: Partial<Prisma.ProjectInvitationUpdateInput>) {
    return this.prisma.projectInvitation.update({
      where: { id },
      data,
    });
  }

  /**
   * Update invitation status
   */
  async updateStatus(
    id: string,
    status: InvitationStatus,
    additionalData?: Partial<Prisma.ProjectInvitationUpdateInput>
  ) {
    const data: Prisma.ProjectInvitationUpdateInput = {
      status,
      ...additionalData,
    };

    if (status === 'VIEWED' && !additionalData?.viewedAt) {
      data.viewedAt = new Date();
    }

    if (['ACCEPTED', 'DECLINED'].includes(status) && !additionalData?.respondedAt) {
      data.respondedAt = new Date();
    }

    return this.prisma.projectInvitation.update({
      where: { id },
      data,
    });
  }

  /**
   * Mark invitation as viewed
   */
  async markAsViewed(id: string) {
    return this.updateStatus(id, 'VIEWED');
  }

  /**
   * Accept an invitation
   */
  async accept(id: string, responseMessage?: string) {
    return this.updateStatus(id, 'ACCEPTED', {
      responseMessage: responseMessage ?? null,
    });
  }

  /**
   * Decline an invitation
   */
  async decline(id: string, responseMessage?: string) {
    return this.updateStatus(id, 'DECLINED', {
      responseMessage: responseMessage ?? null,
    });
  }

  /**
   * Check if invitation exists
   */
  async exists(jobId: string, inviteeId: string): Promise<boolean> {
    const invitation = await this.prisma.projectInvitation.findUnique({
      where: {
        jobId_inviteeId: {
          jobId,
          inviteeId,
        },
      },
      select: { id: true },
    });

    return invitation !== null;
  }

  /**
   * Count pending invitations for a project
   */
  async countPendingByProject(jobId: string): Promise<number> {
    return this.prisma.projectInvitation.count({
      where: {
        jobId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Count pending invitations received by a user
   */
  async countPendingByUser(inviteeId: string): Promise<number> {
    return this.prisma.projectInvitation.count({
      where: {
        inviteeId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Expire old invitations
   */
  async expireOldInvitations(): Promise<number> {
    const result = await this.prisma.projectInvitation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return result.count;
  }
}
