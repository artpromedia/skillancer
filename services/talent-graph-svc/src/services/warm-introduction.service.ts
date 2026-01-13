import { PrismaClient } from '@prisma/client';
import type {
  WarmIntroductionRequestInput,
  WarmIntroductionResponseInput,
  IntroductionStatus,
  IntroductionPath,
  IntroductionPathStep,
} from '../types/talent-graph.types.js';

export class WarmIntroductionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Request a warm introduction
   */
  async requestIntroduction(input: WarmIntroductionRequestInput) {
    // Verify the introducer has a relationship with both parties
    const [requesterRel, targetRel] = await Promise.all([
      this.prisma.workRelationship.findFirst({
        where: {
          OR: [
            { userId: input.introducerId, relatedUserId: input.requesterId },
            { userId: input.requesterId, relatedUserId: input.introducerId },
          ],
        },
      }),
      this.prisma.workRelationship.findFirst({
        where: {
          OR: [
            { userId: input.introducerId, relatedUserId: input.targetUserId },
            { userId: input.targetUserId, relatedUserId: input.introducerId },
          ],
        },
      }),
    ]);

    if (!requesterRel) {
      throw new Error('You must have a connection with the introducer');
    }

    if (!targetRel) {
      throw new Error('Introducer does not have a connection with the target');
    }

    // Check for existing pending introduction
    const existing = await this.prisma.warmIntroduction.findFirst({
      where: {
        requesterId: input.requesterId,
        targetUserId: input.targetUserId,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });

    if (existing) {
      throw new Error('An introduction request already exists');
    }

    const introduction = await this.prisma.warmIntroduction.create({
      data: {
        requesterId: input.requesterId,
        targetUserId: input.targetUserId,
        introducerId: input.introducerId,
        purpose: input.purpose,
        message: input.message,
        context: input.context,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        introducer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return introduction;
  }

  /**
   * Get introduction by ID
   */
  async getIntroductionById(id: string) {
    const introduction = await this.prisma.warmIntroduction.findUnique({
      where: { id },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        introducer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return introduction;
  }

  /**
   * Respond to introduction request (introducer)
   */
  async respondAsIntroducer(input: WarmIntroductionResponseInput, introducerId: string) {
    const introduction = await this.prisma.warmIntroduction.findUnique({
      where: { id: input.introductionId },
    });

    if (!introduction) {
      throw new Error('Introduction not found');
    }

    if (introduction.introducerId !== introducerId) {
      throw new Error('Not authorized to respond to this introduction');
    }

    if (introduction.status !== 'PENDING') {
      throw new Error('Introduction is no longer pending');
    }

    const updated = await this.prisma.warmIntroduction.update({
      where: { id: input.introductionId },
      data: {
        status: input.accepted ? 'ACCEPTED' : 'DECLINED',
        introducerResponse: input.message,
        introducerRespondedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Respond to introduction (target)
   */
  async respondAsTarget(input: WarmIntroductionResponseInput, targetId: string) {
    const introduction = await this.prisma.warmIntroduction.findUnique({
      where: { id: input.introductionId },
    });

    if (!introduction) {
      throw new Error('Introduction not found');
    }

    if (introduction.targetUserId !== targetId) {
      throw new Error('Not authorized to respond to this introduction');
    }

    if (introduction.status !== 'ACCEPTED') {
      throw new Error('Introduction has not been accepted by introducer');
    }

    const updated = await this.prisma.warmIntroduction.update({
      where: { id: input.introductionId },
      data: {
        status: input.accepted ? 'COMPLETED' : 'DECLINED',
        targetResponse: input.message,
        targetRespondedAt: new Date(),
        completedAt: input.accepted ? new Date() : undefined,
      },
    });

    // If accepted, create a work relationship between requester and target
    if (input.accepted) {
      await this.prisma.workRelationship.create({
        data: {
          userId: introduction.requesterId,
          relatedUserId: introduction.targetUserId,
          relationshipType: 'COLLABORATOR',
          company: 'Skillancer Introduction',
          startDate: new Date(),
          strength: 'WEAK',
          verified: true,
          verifiedAt: new Date(),
          notes: `Connected via warm introduction from ${introduction.introducerId}`,
        },
      });
    }

    return updated;
  }

  /**
   * Get pending introductions for a user (as introducer)
   */
  async getPendingAsIntroducer(introducerId: string) {
    const introductions = await this.prisma.warmIntroduction.findMany({
      where: {
        introducerId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        target: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return introductions;
  }

  /**
   * Get pending introductions for a user (as target)
   */
  async getPendingAsTarget(targetId: string) {
    const introductions = await this.prisma.warmIntroduction.findMany({
      where: {
        targetUserId: targetId,
        status: 'ACCEPTED',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        introducer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return introductions;
  }

  /**
   * Get introduction history for a user
   */
  async getIntroductionHistory(
    userId: string,
    role?: 'requester' | 'target' | 'introducer',
    page = 1,
    limit = 20
  ) {
    const where: any = {};

    if (role === 'requester') {
      where.requesterId = userId;
    } else if (role === 'target') {
      where.targetUserId = userId;
    } else if (role === 'introducer') {
      where.introducerId = userId;
    } else {
      where.OR = [{ requesterId: userId }, { targetUserId: userId }, { introducerId: userId }];
    }

    const [introductions, total] = await Promise.all([
      this.prisma.warmIntroduction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          target: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          introducer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.warmIntroduction.count({ where }),
    ]);

    return {
      introductions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find introduction paths to a target user
   */
  async findIntroductionPaths(userId: string, targetUserId: string): Promise<IntroductionPath> {
    // Get direct connections for user
    const directConnections = await this.prisma.workRelationship.findMany({
      where: { OR: [{ userId }, { relatedUserId: userId }] },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        relatedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const paths: IntroductionPathStep[][] = [];

    // Check 1st degree - direct connection to target
    for (const rel of directConnections) {
      const connectedId = rel.userId === userId ? rel.relatedUserId : rel.userId;
      const connectedUser = rel.userId === userId ? rel.relatedUser : rel.user;

      if (connectedId === targetUserId) {
        paths.push([
          {
            userId: connectedId,
            name: `${connectedUser.firstName} ${connectedUser.lastName}`,
            relationshipType: rel.relationshipType as any,
            company: rel.company,
          },
        ]);
      }
    }

    // Check 2nd degree connections
    type ConnectionRecord = { userId: string; relatedUserId: string; relationshipType: string; company?: string | null };
    const firstDegreeIds = (directConnections as ConnectionRecord[]).map((rel) =>
      rel.userId === userId ? rel.relatedUserId : rel.userId
    );

    const secondDegree = await this.prisma.workRelationship.findMany({
      where: {
        OR: [
          { userId: { in: firstDegreeIds }, relatedUserId: targetUserId },
          { relatedUserId: { in: firstDegreeIds }, userId: targetUserId },
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        relatedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    for (const rel of secondDegree) {
      const introducerId = rel.userId === targetUserId ? rel.relatedUserId : rel.userId;
      const introducer = rel.userId === targetUserId ? rel.relatedUser : rel.user;

      // Find the connection between user and introducer
      const userToIntroducer = (directConnections as ConnectionRecord[]).find(
        (dc) =>
          (dc.userId === userId && dc.relatedUserId === introducerId) ||
          (dc.relatedUserId === userId && dc.userId === introducerId)
      );

      if (userToIntroducer) {
        paths.push([
          {
            userId: introducerId,
            name: `${introducer.firstName} ${introducer.lastName}`,
            relationshipType: userToIntroducer.relationshipType as any,
            company: userToIntroducer.company || '',
          },
          {
            userId: targetUserId,
            name:
              rel.userId === targetUserId
                ? `${rel.user.firstName} ${rel.user.lastName}`
                : `${rel.relatedUser.firstName} ${rel.relatedUser.lastName}`,
            relationshipType: rel.relationshipType as any,
            company: rel.company || '',
          },
        ]);
      }
    }

    return {
      targetUserId,
      paths: paths.slice(0, 5), // Limit to 5 paths
      shortestPathLength: paths.length > 0 ? Math.min(...paths.map((p) => p.length)) : -1,
    };
  }

  /**
   * Cancel introduction request
   */
  async cancelIntroduction(id: string, requesterId: string) {
    const introduction = await this.prisma.warmIntroduction.findUnique({
      where: { id },
    });

    if (!introduction) {
      throw new Error('Introduction not found');
    }

    if (introduction.requesterId !== requesterId) {
      throw new Error('Not authorized to cancel this introduction');
    }

    if (!['PENDING', 'ACCEPTED'].includes(introduction.status)) {
      throw new Error('Introduction cannot be cancelled');
    }

    await this.prisma.warmIntroduction.delete({ where: { id } });

    return { success: true };
  }

  /**
   * Expire old introductions
   */
  async expireOldIntroductions() {
    const result = await this.prisma.warmIntroduction.updateMany({
      where: {
        status: { in: ['PENDING', 'ACCEPTED'] },
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return { expired: result.count };
  }
}
