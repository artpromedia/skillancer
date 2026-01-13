// @ts-nocheck
/**
 * Balance Manager Service
 * Manages available, pending, reserved, and tax vault balances
 * Sprint M5: Freelancer Financial Services
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { getTreasuryService } from './treasury-service.js';

// ============================================================================
// TYPES
// ============================================================================

export interface BalanceBreakdown {
  available: number;
  pending: number;
  reserved: number;
  taxVault: number;
  total: number;
  currency: string;
}

export interface BalanceOperation {
  id: string;
  type: BalanceOperationType;
  amount: number;
  fromBalance: BalanceType;
  toBalance: BalanceType;
  description: string;
  createdAt: Date;
}

export type BalanceType = 'available' | 'pending' | 'reserved' | 'taxVault';

export type BalanceOperationType =
  | 'escrow_hold'
  | 'escrow_release'
  | 'tax_reserve'
  | 'tax_release'
  | 'deposit'
  | 'withdrawal';

export interface BalanceAlert {
  id: string;
  type: BalanceAlertType;
  message: string;
  amount?: number;
  threshold?: number;
  createdAt: Date;
  readAt?: Date;
}

export type BalanceAlertType =
  | 'low_balance'
  | 'large_deposit'
  | 'unusual_activity'
  | 'pending_cleared';

export interface BalanceHistory {
  date: Date;
  available: number;
  pending: number;
  reserved: number;
  taxVault: number;
  total: number;
}

// ============================================================================
// ALERT THRESHOLDS
// ============================================================================

const ALERT_THRESHOLDS = {
  lowBalance: 100, // Alert when available < $100
  largeDeposit: 5000, // Alert for deposits > $5,000
  unusualActivity: {
    dailyTransactionCount: 20,
    dailyAmount: 10000,
  },
};

// ============================================================================
// BALANCE MANAGER SERVICE
// ============================================================================

export class BalanceManager {
  private treasuryService = getTreasuryService();

  // ==========================================================================
  // BALANCE QUERIES
  // ==========================================================================

  /**
   * Get current balance breakdown
   */
  async getBalances(userId: string): Promise<BalanceBreakdown | null> {
    // Get real-time balance from Treasury service
    const balance = await this.treasuryService.getBalance(userId);

    if (!balance) {
      return null;
    }

    return {
      available: balance.available,
      pending: balance.pending,
      reserved: balance.reserved,
      taxVault: balance.taxVault,
      total: balance.available + balance.pending + balance.reserved + balance.taxVault,
      currency: balance.currency,
    };
  }

  /**
   * Get available balance for payout
   */
  async getAvailableForPayout(userId: string): Promise<number> {
    const balance = await this.getBalances(userId);
    if (!balance) return 0;

    // Only the available balance can be paid out
    return Math.max(0, balance.available);
  }

  /**
   * Get balance history over time
   */
  async getBalanceHistory(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      granularity?: 'day' | 'week' | 'month';
    } = {}
  ): Promise<BalanceHistory[]> {
    const endDate = options.endDate || new Date();
    const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const granularity = options.granularity || 'day';

    const snapshots = await prisma.balanceSnapshot.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by granularity
    const history: BalanceHistory[] = [];
    const grouped = new Map<string, BalanceHistory[]>();

    for (const snapshot of snapshots) {
      const key = this.getDateKey(snapshot.createdAt, granularity);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push({
        date: snapshot.createdAt,
        available: snapshot.available.toNumber(),
        pending: snapshot.pending.toNumber(),
        reserved: snapshot.reserved.toNumber(),
        taxVault: snapshot.taxVault.toNumber(),
        total: snapshot.total.toNumber(),
      });
    }

    // Take the last snapshot of each period
    for (const [, snapshots] of grouped) {
      history.push(snapshots[snapshots.length - 1]);
    }

    return history;
  }

  private getDateKey(date: Date, granularity: 'day' | 'week' | 'month'): string {
    const d = new Date(date);
    switch (granularity) {
      case 'day':
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      case 'week':
        const week = Math.floor(d.getDate() / 7);
        return `${d.getFullYear()}-${d.getMonth()}-W${week}`;
      case 'month':
        return `${d.getFullYear()}-${d.getMonth()}`;
    }
  }

  // ==========================================================================
  // BALANCE OPERATIONS
  // ==========================================================================

  /**
   * Hold funds in escrow (e.g., for pending contract payment)
   */
  async holdInEscrow(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string
  ): Promise<BalanceOperation> {
    const balance = await this.getBalances(userId);
    if (!balance || balance.available < amount) {
      throw new Error('Insufficient available balance');
    }

    const operation = await prisma.balanceOperation.create({
      data: {
        userId,
        type: 'escrow_hold',
        amount,
        fromBalance: 'available',
        toBalance: 'reserved',
        description,
        referenceId,
      },
    });

    // Update tax vault balance
    await this.updateReservedBalance(userId, amount);

    logger.info('Funds held in escrow', { userId, amount, operationId: operation.id });

    return {
      id: operation.id,
      type: 'escrow_hold',
      amount,
      fromBalance: 'available',
      toBalance: 'reserved',
      description,
      createdAt: operation.createdAt,
    };
  }

  /**
   * Release funds from escrow
   */
  async releaseFromEscrow(
    userId: string,
    amount: number,
    description: string,
    referenceId?: string
  ): Promise<BalanceOperation> {
    const reserved = await this.getReservedBalance(userId);
    if (reserved < amount) {
      throw new Error('Insufficient reserved balance');
    }

    const operation = await prisma.balanceOperation.create({
      data: {
        userId,
        type: 'escrow_release',
        amount,
        fromBalance: 'reserved',
        toBalance: 'available',
        description,
        referenceId,
      },
    });

    // Update reserved balance
    await this.updateReservedBalance(userId, -amount);

    logger.info('Funds released from escrow', { userId, amount, operationId: operation.id });

    return {
      id: operation.id,
      type: 'escrow_release',
      amount,
      fromBalance: 'reserved',
      toBalance: 'available',
      description,
      createdAt: operation.createdAt,
    };
  }

  /**
   * Reserve funds for taxes
   */
  async reserveForTaxes(
    userId: string,
    amount: number,
    description: string
  ): Promise<BalanceOperation> {
    const balance = await this.getBalances(userId);
    if (!balance || balance.available < amount) {
      throw new Error('Insufficient available balance for tax reservation');
    }

    const operation = await prisma.balanceOperation.create({
      data: {
        userId,
        type: 'tax_reserve',
        amount,
        fromBalance: 'available',
        toBalance: 'taxVault',
        description,
      },
    });

    // Update tax vault
    await this.updateTaxVaultBalance(userId, amount);

    logger.info('Funds reserved for taxes', { userId, amount, operationId: operation.id });

    return {
      id: operation.id,
      type: 'tax_reserve',
      amount,
      fromBalance: 'available',
      toBalance: 'taxVault',
      description,
      createdAt: operation.createdAt,
    };
  }

  /**
   * Release funds from tax vault
   */
  async releaseFromTaxVault(
    userId: string,
    amount: number,
    reason: string
  ): Promise<BalanceOperation> {
    const taxVault = await prisma.taxVault.findUnique({ where: { userId } });
    if (!taxVault || taxVault.balance.toNumber() < amount) {
      throw new Error('Insufficient tax vault balance');
    }

    const operation = await prisma.balanceOperation.create({
      data: {
        userId,
        type: 'tax_release',
        amount,
        fromBalance: 'taxVault',
        toBalance: 'available',
        description: reason,
      },
    });

    // Update tax vault
    await this.updateTaxVaultBalance(userId, -amount);

    logger.info('Funds released from tax vault', { userId, amount, reason });

    return {
      id: operation.id,
      type: 'tax_release',
      amount,
      fromBalance: 'taxVault',
      toBalance: 'available',
      description: reason,
      createdAt: operation.createdAt,
    };
  }

  // ==========================================================================
  // BALANCE UPDATES
  // ==========================================================================

  private async updateReservedBalance(userId: string, delta: number): Promise<void> {
    await prisma.treasuryAccount.update({
      where: { userId },
      data: {
        balancesData: {
          // This would properly update the reserved field in the JSON
          // In production, use Prisma's JSON update syntax
        },
      },
    });
  }

  private async updateTaxVaultBalance(userId: string, delta: number): Promise<void> {
    await prisma.taxVault.upsert({
      where: { userId },
      create: {
        userId,
        balance: Math.max(0, delta),
        savingsRate: 25,
      },
      update: {
        balance: { increment: delta },
      },
    });
  }

  private async getReservedBalance(userId: string): Promise<number> {
    const account = await prisma.treasuryAccount.findUnique({
      where: { userId },
    });
    return (account?.balancesData as any)?.reserved || 0;
  }

  // ==========================================================================
  // ALERTS
  // ==========================================================================

  /**
   * Check and create balance alerts
   */
  async checkAlerts(userId: string): Promise<BalanceAlert[]> {
    const alerts: BalanceAlert[] = [];
    const balance = await this.getBalances(userId);

    if (!balance) return alerts;

    // Low balance alert
    if (balance.available < ALERT_THRESHOLDS.lowBalance) {
      const existing = await prisma.balanceAlert.findFirst({
        where: {
          userId,
          type: 'low_balance',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          readAt: null,
        },
      });

      if (!existing) {
        const alert = await prisma.balanceAlert.create({
          data: {
            userId,
            type: 'low_balance',
            message: `Your available balance is low: $${balance.available.toFixed(2)}`,
            amount: balance.available,
            threshold: ALERT_THRESHOLDS.lowBalance,
          },
        });

        alerts.push({
          id: alert.id,
          type: 'low_balance',
          message: alert.message,
          amount: balance.available,
          threshold: ALERT_THRESHOLDS.lowBalance,
          createdAt: alert.createdAt,
        });
      }
    }

    return alerts;
  }

  /**
   * Create large deposit alert
   */
  async createLargeDepositAlert(userId: string, amount: number): Promise<BalanceAlert> {
    const alert = await prisma.balanceAlert.create({
      data: {
        userId,
        type: 'large_deposit',
        message: `You received a deposit of $${amount.toFixed(2)}`,
        amount,
      },
    });

    return {
      id: alert.id,
      type: 'large_deposit',
      message: alert.message,
      amount,
      createdAt: alert.createdAt,
    };
  }

  /**
   * Check for unusual activity
   */
  async checkUnusualActivity(userId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyStats = await prisma.treasuryTransaction.aggregate({
      where: {
        userId,
        createdAt: { gte: today },
      },
      _count: true,
      _sum: { amount: true },
    });

    const isUnusual =
      dailyStats._count > ALERT_THRESHOLDS.unusualActivity.dailyTransactionCount ||
      (dailyStats._sum.amount?.toNumber() || 0) > ALERT_THRESHOLDS.unusualActivity.dailyAmount;

    if (isUnusual) {
      await prisma.balanceAlert.create({
        data: {
          userId,
          type: 'unusual_activity',
          message: 'Unusual account activity detected. Please review your recent transactions.',
        },
      });

      logger.warn('Unusual activity detected', {
        userId,
        transactionCount: dailyStats._count,
        totalAmount: dailyStats._sum.amount?.toNumber(),
      });
    }

    return isUnusual;
  }

  /**
   * Get unread alerts
   */
  async getUnreadAlerts(userId: string): Promise<BalanceAlert[]> {
    const alerts = await prisma.balanceAlert.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return alerts.map((a) => ({
      id: a.id,
      type: a.type as BalanceAlertType,
      message: a.message,
      amount: a.amount?.toNumber(),
      threshold: a.threshold?.toNumber(),
      createdAt: a.createdAt,
    }));
  }

  /**
   * Mark alerts as read
   */
  async markAlertsRead(userId: string, alertIds: string[]): Promise<void> {
    await prisma.balanceAlert.updateMany({
      where: { id: { in: alertIds }, userId },
      data: { readAt: new Date() },
    });
  }

  // ==========================================================================
  // SNAPSHOTS
  // ==========================================================================

  /**
   * Take a balance snapshot (for history tracking)
   */
  async takeSnapshot(userId: string): Promise<void> {
    const balance = await this.getBalances(userId);
    if (!balance) return;

    await prisma.balanceSnapshot.create({
      data: {
        userId,
        available: balance.available,
        pending: balance.pending,
        reserved: balance.reserved,
        taxVault: balance.taxVault,
        total: balance.total,
      },
    });
  }

  /**
   * Take daily snapshots for all active accounts
   */
  async takeDailySnapshots(): Promise<number> {
    const accounts = await prisma.treasuryAccount.findMany({
      where: { status: 'active' },
      select: { userId: true },
    });

    let count = 0;
    for (const { userId } of accounts) {
      try {
        await this.takeSnapshot(userId);
        count++;
      } catch (error) {
        logger.error('Failed to take snapshot', { userId, error });
      }
    }

    logger.info('Daily balance snapshots completed', { count });
    return count;
  }
}

// Singleton instance
let balanceManagerInstance: BalanceManager | null = null;

export function getBalanceManager(): BalanceManager {
  if (!balanceManagerInstance) {
    balanceManagerInstance = new BalanceManager();
  }
  return balanceManagerInstance;
}

