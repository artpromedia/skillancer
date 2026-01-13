// @ts-nocheck
/**
 * Guild Revenue Split Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Handles revenue distribution among guild members
 */

import { db } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export const CreateRevenueSplitSchema = z.object({
  guildProjectId: z.string().uuid(),
  totalAmount: z.number().positive(),
  splits: z.array(
    z.object({
      memberId: z.string().uuid(),
      percentage: z.number().min(0).max(100),
      fixedAmount: z.number().min(0).optional(),
      role: z.string().optional(),
    })
  ),
  platformFeePercent: z.number().min(0).max(30).default(10),
  guildFeePercent: z.number().min(0).max(50).default(5),
});

export const UpdateRevenueSplitSchema = z.object({
  splits: z
    .array(
      z.object({
        memberId: z.string().uuid(),
        percentage: z.number().min(0).max(100),
        fixedAmount: z.number().min(0).optional(),
      })
    )
    .optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'DISPUTED']).optional(),
});

export type CreateRevenueSplitInput = z.infer<typeof CreateRevenueSplitSchema>;
export type UpdateRevenueSplitInput = z.infer<typeof UpdateRevenueSplitSchema>;

export interface RevenueSplitInfo {
  id: string;
  guildId: string;
  guildProjectId: string;
  totalAmount: number;
  platformFee: number;
  guildFee: number;
  distributableAmount: number;
  status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'DISPUTED';
  splits: {
    memberId: string;
    memberName: string;
    percentage: number;
    amount: number;
    status: string;
  }[];
  createdAt: Date;
  processedAt: Date | null;
}

// =============================================================================
// SERVICE
// =============================================================================

export class RevenueSplitService {
  private log = logger.child({ service: 'RevenueSplitService' });

  /**
   * Create a revenue split configuration
   */
  async createRevenueSplit(
    guildId: string,
    creatorId: string,
    input: CreateRevenueSplitInput
  ): Promise<RevenueSplitInfo> {
    const validated = CreateRevenueSplitSchema.parse(input);

    // Verify creator has finance permission
    await this.requireFinancePermission(guildId, creatorId);

    // Verify project belongs to guild
    const project = await db.guildProject.findUnique({
      where: { id: validated.guildProjectId },
    });

    if (!project || project.guildId !== guildId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Guild project not found',
      });
    }

    // Validate splits total 100%
    const totalPercentage = validated.splits.reduce((sum, s) => sum + s.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Split percentages must total 100%',
      });
    }

    // Verify all members exist
    const memberIds = validated.splits.map((s) => s.memberId);
    const members = await db.guildMember.findMany({
      where: { guildId, userId: { in: memberIds } },
      include: {
        user: { select: { displayName: true, firstName: true, lastName: true } },
      },
    });

    if (members.length !== memberIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All split recipients must be guild members',
      });
    }

    // Calculate amounts
    const platformFee = validated.totalAmount * (validated.platformFeePercent / 100);
    const guildFee = validated.totalAmount * (validated.guildFeePercent / 100);
    const distributableAmount = validated.totalAmount - platformFee - guildFee;

    // Create revenue split record
    const revenueSplit = await db.$transaction(async (tx) => {
      const split = await tx.guildRevenueSplit.create({
        data: {
          guildId,
          guildProjectId: validated.guildProjectId,
          totalAmount: validated.totalAmount,
          platformFee,
          guildFee,
          distributableAmount,
          status: 'PENDING',
          splits: validated.splits.map((s) => {
            const member = members.find((m) => m.userId === s.memberId)!;
            return {
              memberId: s.memberId,
              memberName:
                member.user.displayName || `${member.user.firstName} ${member.user.lastName}`,
              percentage: s.percentage,
              amount: s.fixedAmount ?? (distributableAmount * s.percentage) / 100,
              role: s.role,
              status: 'PENDING',
            };
          }),
          createdById: creatorId,
        },
      });

      // Add guild fee to treasury
      await tx.guildTreasury.upsert({
        where: { guildId },
        create: {
          guildId,
          balance: guildFee,
          totalDeposits: guildFee,
          totalWithdrawals: 0,
        },
        update: {
          balance: { increment: guildFee },
          totalDeposits: { increment: guildFee },
        },
      });

      return split;
    });

    this.log.info(
      { guildId, projectId: validated.guildProjectId, splitId: revenueSplit.id },
      'Revenue split created'
    );

    return this.formatSplitInfo(revenueSplit);
  }

  /**
   * Get revenue split by ID
   */
  async getRevenueSplit(splitId: string): Promise<RevenueSplitInfo> {
    const split = await db.guildRevenueSplit.findUnique({
      where: { id: splitId },
    });

    if (!split) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Revenue split not found',
      });
    }

    return this.formatSplitInfo(split);
  }

  /**
   * List revenue splits for a guild
   */
  async listGuildRevenueSplits(
    guildId: string,
    options: {
      status?: ('PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'DISPUTED')[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ splits: RevenueSplitInfo[]; total: number }> {
    const where: Record<string, unknown> = { guildId };

    if (options.status?.length) {
      where.status = { in: options.status };
    }

    const [splits, total] = await Promise.all([
      db.guildRevenueSplit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 20,
        skip: options.offset ?? 0,
      }),
      db.guildRevenueSplit.count({ where }),
    ]);

    return {
      splits: splits.map((s) => this.formatSplitInfo(s)),
      total,
    };
  }

  /**
   * Approve revenue split
   */
  async approveRevenueSplit(splitId: string, approverId: string): Promise<RevenueSplitInfo> {
    const split = await db.guildRevenueSplit.findUnique({
      where: { id: splitId },
    });

    if (!split) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Revenue split not found',
      });
    }

    await this.requireFinancePermission(split.guildId, approverId);

    if (split.status !== 'PENDING') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only pending splits can be approved',
      });
    }

    const updated = await db.guildRevenueSplit.update({
      where: { id: splitId },
      data: { status: 'APPROVED', approvedById: approverId, approvedAt: new Date() },
    });

    this.log.info({ splitId, approverId }, 'Revenue split approved');

    return this.formatSplitInfo(updated);
  }

  /**
   * Process revenue split (distribute funds)
   */
  async processRevenueSplit(splitId: string): Promise<RevenueSplitInfo> {
    const split = await db.guildRevenueSplit.findUnique({
      where: { id: splitId },
    });

    if (!split) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Revenue split not found',
      });
    }

    if (split.status !== 'APPROVED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only approved splits can be processed',
      });
    }

    const splits = split.splits as { memberId: string; amount: number; status: string }[];

    // Process each member's payout
    const updated = await db.$transaction(async (tx) => {
      // Update split status
      await tx.guildRevenueSplit.update({
        where: { id: splitId },
        data: { status: 'PROCESSING' },
      });

      // Create transactions for each member
      for (const memberSplit of splits) {
        await tx.guildTransaction.create({
          data: {
            guildId: split.guildId,
            type: 'MEMBER_PAYOUT',
            amount: memberSplit.amount,
            description: `Project payout`,
            memberId: memberSplit.memberId,
            revenueSplitId: splitId,
            status: 'PENDING',
          },
        });

        // Update member earnings
        await tx.guildMember.update({
          where: { guildId_userId: { guildId: split.guildId, userId: memberSplit.memberId } },
          data: { totalEarned: { increment: memberSplit.amount } },
        });
      }

      // Mark as completed
      return tx.guildRevenueSplit.update({
        where: { id: splitId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          splits: splits.map((s) => ({ ...s, status: 'COMPLETED' })),
        },
      });
    });

    this.log.info({ splitId }, 'Revenue split processed');

    return this.formatSplitInfo(updated);
  }

  /**
   * Dispute revenue split
   */
  async disputeRevenueSplit(splitId: string, disputerId: string, reason: string): Promise<void> {
    const split = await db.guildRevenueSplit.findUnique({
      where: { id: splitId },
    });

    if (!split) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Revenue split not found',
      });
    }

    // Verify disputer is involved in split
    const splits = split.splits as { memberId: string }[];
    const isInvolved = splits.some((s) => s.memberId === disputerId);

    if (!isInvolved) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only split recipients can dispute',
      });
    }

    if (!['PENDING', 'APPROVED'].includes(split.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot dispute split in current status',
      });
    }

    await db.guildRevenueSplit.update({
      where: { id: splitId },
      data: {
        status: 'DISPUTED',
        metadata: { disputeReason: reason, disputedBy: disputerId },
      },
    });

    this.log.warn({ splitId, disputerId, reason }, 'Revenue split disputed');
  }

  /**
   * Get member earnings summary
   */
  async getMemberEarnings(
    guildId: string,
    memberId: string
  ): Promise<{
    totalEarned: number;
    pendingPayouts: number;
    completedPayouts: number;
    recentPayouts: { amount: number; date: Date; projectName: string }[];
  }> {
    const member = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: memberId } },
    });

    if (!member) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Member not found',
      });
    }

    // Get pending payouts
    const pendingSplits = await db.guildRevenueSplit.findMany({
      where: {
        guildId,
        status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] },
      },
    });

    let pendingPayouts = 0;
    for (const split of pendingSplits) {
      const splits = split.splits as { memberId: string; amount: number }[];
      const memberPortion = splits.find((s) => s.memberId === memberId);
      if (memberPortion) {
        pendingPayouts += memberPortion.amount;
      }
    }

    // Get recent completed payouts
    const transactions = await db.guildTransaction.findMany({
      where: {
        guildId,
        memberId,
        type: 'MEMBER_PAYOUT',
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const completedPayouts = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      totalEarned: Number(member.totalEarned),
      pendingPayouts,
      completedPayouts,
      recentPayouts: transactions.map((t) => ({
        amount: Number(t.amount),
        date: t.createdAt,
        projectName: t.description ?? 'Project payout',
      })),
    };
  }

  /**
   * Format split info helper
   */
  private formatSplitInfo(split: {
    id: string;
    guildId: string;
    guildProjectId: string;
    totalAmount: unknown;
    platformFee: unknown;
    guildFee: unknown;
    distributableAmount: unknown;
    status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'DISPUTED';
    splits: unknown;
    createdAt: Date;
    processedAt: Date | null;
  }): RevenueSplitInfo {
    const splits = split.splits as {
      memberId: string;
      memberName: string;
      percentage: number;
      amount: number;
      status: string;
    }[];

    return {
      id: split.id,
      guildId: split.guildId,
      guildProjectId: split.guildProjectId,
      totalAmount: Number(split.totalAmount),
      platformFee: Number(split.platformFee),
      guildFee: Number(split.guildFee),
      distributableAmount: Number(split.distributableAmount),
      status: split.status,
      splits,
      createdAt: split.createdAt,
      processedAt: split.processedAt,
    };
  }

  /**
   * Check finance permission
   */
  private async requireFinancePermission(guildId: string, userId: string): Promise<void> {
    const membership = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not an active member of this guild',
      });
    }

    const permissions = membership.permissions as Record<string, boolean>;
    if (!permissions.canManageFinances && membership.role !== 'LEADER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to manage finances',
      });
    }
  }
}

export const revenueSplitService = new RevenueSplitService();

