// @ts-nocheck
/**
 * Guild Treasury Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Handles guild treasury management and transactions
 */

import { db } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export const WithdrawFromTreasurySchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(3).max(500),
  recipientId: z.string().uuid().optional(),
  category: z
    .enum(['OPERATIONAL', 'MEMBER_BONUS', 'MARKETING', 'EQUIPMENT', 'OTHER'])
    .default('OPERATIONAL'),
});

export const DepositToTreasurySchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(3).max(500),
  source: z.enum(['PROJECT_FEE', 'MANUAL_DEPOSIT', 'REFUND', 'OTHER']).default('PROJECT_FEE'),
});

export type WithdrawFromTreasuryInput = z.infer<typeof WithdrawFromTreasurySchema>;
export type DepositToTreasuryInput = z.infer<typeof DepositToTreasurySchema>;

export interface TreasuryInfo {
  guildId: string;
  balance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  lastUpdated: Date;
}

export interface TransactionInfo {
  id: string;
  guildId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'MEMBER_PAYOUT' | 'PLATFORM_FEE' | 'REFUND';
  amount: number;
  description: string | null;
  memberId: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
  completedAt: Date | null;
}

// =============================================================================
// SERVICE
// =============================================================================

export class GuildTreasuryService {
  private log = logger.child({ service: 'GuildTreasuryService' });

  /**
   * Get treasury info
   */
  async getTreasury(guildId: string): Promise<TreasuryInfo> {
    let treasury = await db.guildTreasury.findUnique({
      where: { guildId },
    });

    if (!treasury) {
      // Create treasury if not exists
      treasury = await db.guildTreasury.create({
        data: {
          guildId,
          balance: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
        },
      });
    }

    return {
      guildId: treasury.guildId,
      balance: Number(treasury.balance),
      totalDeposits: Number(treasury.totalDeposits),
      totalWithdrawals: Number(treasury.totalWithdrawals),
      lastUpdated: treasury.updatedAt,
    };
  }

  /**
   * Deposit to treasury
   */
  async deposit(
    guildId: string,
    userId: string,
    input: DepositToTreasuryInput
  ): Promise<TransactionInfo> {
    const validated = DepositToTreasurySchema.parse(input);

    await this.requireFinancePermission(guildId, userId);

    const transaction = await db.$transaction(async (tx) => {
      // Update treasury
      await tx.guildTreasury.upsert({
        where: { guildId },
        create: {
          guildId,
          balance: validated.amount,
          totalDeposits: validated.amount,
          totalWithdrawals: 0,
        },
        update: {
          balance: { increment: validated.amount },
          totalDeposits: { increment: validated.amount },
        },
      });

      // Create transaction record
      return tx.guildTransaction.create({
        data: {
          guildId,
          type: 'DEPOSIT',
          amount: validated.amount,
          description: validated.description,
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: { source: validated.source, createdBy: userId },
        },
      });
    });

    this.log.info(
      { guildId, amount: validated.amount, transactionId: transaction.id },
      'Treasury deposit completed'
    );

    return this.formatTransaction(transaction);
  }

  /**
   * Withdraw from treasury
   */
  async withdraw(
    guildId: string,
    userId: string,
    input: WithdrawFromTreasuryInput
  ): Promise<TransactionInfo> {
    const validated = WithdrawFromTreasurySchema.parse(input);

    await this.requireFinancePermission(guildId, userId);

    // Check balance
    const treasury = await this.getTreasury(guildId);
    if (treasury.balance < validated.amount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Insufficient treasury balance',
      });
    }

    const transaction = await db.$transaction(async (tx) => {
      // Update treasury
      await tx.guildTreasury.update({
        where: { guildId },
        data: {
          balance: { decrement: validated.amount },
          totalWithdrawals: { increment: validated.amount },
        },
      });

      // Create transaction record
      return tx.guildTransaction.create({
        data: {
          guildId,
          type: 'WITHDRAWAL',
          amount: validated.amount,
          description: validated.description,
          memberId: validated.recipientId,
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: { category: validated.category, approvedBy: userId },
        },
      });
    });

    this.log.info(
      { guildId, amount: validated.amount, transactionId: transaction.id },
      'Treasury withdrawal completed'
    );

    return this.formatTransaction(transaction);
  }

  /**
   * List transactions
   */
  async listTransactions(
    guildId: string,
    options: {
      type?: ('DEPOSIT' | 'WITHDRAWAL' | 'MEMBER_PAYOUT' | 'PLATFORM_FEE' | 'REFUND')[];
      status?: ('PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED')[];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ transactions: TransactionInfo[]; total: number }> {
    const where: Record<string, unknown> = { guildId };

    if (options.type?.length) {
      where.type = { in: options.type };
    }
    if (options.status?.length) {
      where.status = { in: options.status };
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        (where.createdAt as Record<string, Date>).gte = options.startDate;
      }
      if (options.endDate) {
        (where.createdAt as Record<string, Date>).lte = options.endDate;
      }
    }

    const [transactions, total] = await Promise.all([
      db.guildTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      db.guildTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => this.formatTransaction(t)),
      total,
    };
  }

  /**
   * Get treasury summary
   */
  async getTreasurySummary(
    guildId: string,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{
    balance: number;
    periodIncome: number;
    periodExpenses: number;
    netChange: number;
    transactionCount: number;
    topCategories: { category: string; amount: number }[];
  }> {
    const treasury = await this.getTreasury(guildId);

    // Calculate period start
    const now = new Date();
    let periodStart: Date;
    switch (period) {
      case 'week':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        periodStart = new Date(now.getFullYear(), 0, 1);
        break;
    }

    // Get period transactions
    const transactions = await db.guildTransaction.findMany({
      where: {
        guildId,
        createdAt: { gte: periodStart },
        status: 'COMPLETED',
      },
    });

    let periodIncome = 0;
    let periodExpenses = 0;
    const categoryTotals = new Map<string, number>();

    for (const tx of transactions) {
      const amount = Number(tx.amount);

      if (['DEPOSIT', 'REFUND'].includes(tx.type)) {
        periodIncome += amount;
      } else {
        periodExpenses += amount;

        const metadata = tx.metadata as Record<string, string> | null;
        const category = metadata?.category ?? tx.type;
        categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + amount);
      }
    }

    const topCategories = Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      balance: treasury.balance,
      periodIncome,
      periodExpenses,
      netChange: periodIncome - periodExpenses,
      transactionCount: transactions.length,
      topCategories,
    };
  }

  /**
   * Transfer between members
   */
  async transferToMember(
    guildId: string,
    senderId: string,
    recipientId: string,
    amount: number,
    description: string
  ): Promise<TransactionInfo> {
    await this.requireFinancePermission(guildId, senderId);

    // Verify recipient is guild member
    const recipient = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: recipientId } },
    });

    if (!recipient || recipient.status !== 'ACTIVE') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Recipient must be an active guild member',
      });
    }

    // Check balance
    const treasury = await this.getTreasury(guildId);
    if (treasury.balance < amount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Insufficient treasury balance',
      });
    }

    const transaction = await db.$transaction(async (tx) => {
      // Deduct from treasury
      await tx.guildTreasury.update({
        where: { guildId },
        data: {
          balance: { decrement: amount },
          totalWithdrawals: { increment: amount },
        },
      });

      // Update member earnings
      await tx.guildMember.update({
        where: { guildId_userId: { guildId, userId: recipientId } },
        data: { totalEarned: { increment: amount } },
      });

      // Create transaction
      return tx.guildTransaction.create({
        data: {
          guildId,
          type: 'MEMBER_PAYOUT',
          amount,
          description,
          memberId: recipientId,
          status: 'COMPLETED',
          completedAt: new Date(),
          metadata: { approvedBy: senderId, type: 'manual_transfer' },
        },
      });
    });

    this.log.info({ guildId, recipientId, amount }, 'Treasury transfer to member completed');

    return this.formatTransaction(transaction);
  }

  /**
   * Format transaction helper
   */
  private formatTransaction(tx: {
    id: string;
    guildId: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'MEMBER_PAYOUT' | 'PLATFORM_FEE' | 'REFUND';
    amount: unknown;
    description: string | null;
    memberId: string | null;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    createdAt: Date;
    completedAt: Date | null;
  }): TransactionInfo {
    return {
      id: tx.id,
      guildId: tx.guildId,
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      memberId: tx.memberId,
      status: tx.status,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt,
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

export const guildTreasuryService = new GuildTreasuryService();
