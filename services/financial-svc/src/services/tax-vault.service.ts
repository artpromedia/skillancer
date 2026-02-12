import { TaxVaultWithdrawalReason } from '../types/financial.types.js';

import type {
  TaxVaultCreateInput,
  TaxVaultUpdateInput,
  TaxVaultDepositInput,
  TaxVaultWithdrawalInput,
  TaxVaultSummary,
} from '../types/financial.types.js';
import type { PrismaClient } from '@prisma/client';

export class TaxVaultService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create or get tax vault for user
   */
  async getOrCreateVault(input: TaxVaultCreateInput) {
    const existingVault = await this.prisma.taxVault.findUnique({
      where: { userId: input.userId },
    });

    if (existingVault) {
      return existingVault;
    }

    const vault = await this.prisma.taxVault.create({
      data: {
        userId: input.userId,
        balance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        savingsRate: input.targetPercentage || 25,
        autoSaveEnabled: input.autosaveEnabled ?? true,
      },
    });

    return vault;
  }

  /**
   * Get vault by user ID
   */
  async getVaultByUserId(userId: string) {
    const vault = await this.prisma.taxVault.findUnique({
      where: { userId },
      include: {
        deposits: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        withdrawals: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    return vault;
  }

  /**
   * Update vault settings
   */
  async updateVaultSettings(userId: string, input: TaxVaultUpdateInput) {
    const vault = await this.prisma.taxVault.update({
      where: { userId },
      data: {
        savingsRate: input.targetPercentage,
        autoSaveEnabled: input.autosaveEnabled,
      },
    });

    return vault;
  }

  /**
   * Deposit funds into tax vault
   */
  async deposit(input: TaxVaultDepositInput) {
    const vault = await this.prisma.taxVault.findUnique({
      where: { id: input.taxVaultId },
    });

    if (!vault) {
      throw new Error('Tax vault not found');
    }

    // Create deposit record
    const deposit = await this.prisma.taxVaultDeposit.create({
      data: {
        taxVaultId: input.taxVaultId,
        amount: input.amount,
        source: input.source,
        sourceTransactionId: input.sourceTransactionId,
        notes: input.notes,
      },
    });

    // Update vault balance
    await this.prisma.taxVault.update({
      where: { id: input.taxVaultId },
      data: {
        balance: { increment: input.amount },
        totalDeposits: { increment: input.amount },
        lastDepositAt: new Date(),
      },
    });

    return deposit;
  }

  /**
   * Withdraw funds from tax vault
   */
  async withdraw(input: TaxVaultWithdrawalInput) {
    const vault = await this.prisma.taxVault.findUnique({
      where: { id: input.taxVaultId },
    });

    if (!vault) {
      throw new Error('Tax vault not found');
    }

    if (Number(vault.balance) < input.amount) {
      throw new Error('Insufficient balance in tax vault');
    }

    // Create withdrawal record
    const withdrawal = await this.prisma.taxVaultWithdrawal.create({
      data: {
        taxVaultId: input.taxVaultId,
        amount: input.amount,
        reason: input.reason,
        taxYear: input.taxYear || new Date().getFullYear(),
        taxQuarter: input.taxQuarter,
        recipientAccountId: input.recipientAccountId,
        notes: input.notes,
        status: 'PENDING',
      },
    });

    // Update vault balance
    await this.prisma.taxVault.update({
      where: { id: input.taxVaultId },
      data: {
        balance: { decrement: input.amount },
        totalWithdrawals: { increment: input.amount },
        lastWithdrawalAt: new Date(),
      },
    });

    // Mark withdrawal as completed (in production, this would happen after transfer)
    await this.prisma.taxVaultWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });

    return withdrawal;
  }

  /**
   * Get vault summary with tax calculations
   */
  async getVaultSummary(userId: string): Promise<TaxVaultSummary> {
    const vault = await this.prisma.taxVault.findUnique({
      where: { userId },
    });

    if (!vault) {
      throw new Error('Tax vault not found');
    }

    // Calculate year-to-date earnings (from invoices/payments)
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    // This would integrate with actual payment records
    // For now, using deposits as a proxy
    const ytdDeposits = await this.prisma.taxVaultDeposit.aggregate({
      where: {
        taxVaultId: vault.id,
        createdAt: { gte: yearStart },
      },
      _sum: { amount: true },
    });

    // Calculate suggested savings based on estimated tax rate
    const savingsRate = vault.savingsRate || 25;
    const estimatedEarnings = Number(ytdDeposits._sum.amount || 0) / (savingsRate / 100);
    const suggestedSavings = estimatedEarnings * (savingsRate / 100);

    // Calculate next quarterly due date
    const now = new Date();
    const quarterlyDueDates = [
      new Date(now.getFullYear(), 3, 15), // Q1 - April 15
      new Date(now.getFullYear(), 5, 15), // Q2 - June 15
      new Date(now.getFullYear(), 8, 15), // Q3 - September 15
      new Date(now.getFullYear() + 1, 0, 15), // Q4 - January 15 next year
    ];

    const nextQuarterlyDue =
      quarterlyDueDates.find((date) => date > now) ?? quarterlyDueDates[0] ?? null;

    return {
      currentBalance: Number(vault.balance),
      totalDeposits: Number(vault.totalDeposits),
      totalWithdrawals: Number(vault.totalWithdrawals),
      targetPercentage: savingsRate,
      yearToDateEarnings: estimatedEarnings,
      suggestedSavings,
      nextQuarterlyDue,
    };
  }

  /**
   * Auto-save from payment (called when freelancer receives payment)
   */
  async autoSaveFromPayment(userId: string, paymentAmount: number, paymentId: string) {
    let vault = await this.prisma.taxVault.findUnique({
      where: { userId },
    });

    if (!vault) {
      // Create vault with default settings
      vault = await this.getOrCreateVault({ userId });
    }

    if (!vault.autoSaveEnabled) {
      return null;
    }

    const saveAmount = paymentAmount * (vault.savingsRate / 100);

    const deposit = await this.deposit({
      taxVaultId: vault.id,
      amount: saveAmount,
      source: 'AUTO_SAVE',
      sourceTransactionId: paymentId,
      notes: `Automatic tax savings from payment (${vault.savingsRate}%)`,
    });

    return deposit;
  }

  /**
   * Get deposit history
   */
  async getDeposits(taxVaultId: string, page = 1, limit = 20) {
    const [deposits, total] = await Promise.all([
      this.prisma.taxVaultDeposit.findMany({
        where: { taxVaultId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.taxVaultDeposit.count({ where: { taxVaultId } }),
    ]);

    return {
      deposits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawals(taxVaultId: string, page = 1, limit = 20) {
    const [withdrawals, total] = await Promise.all([
      this.prisma.taxVaultWithdrawal.findMany({
        where: { taxVaultId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.taxVaultWithdrawal.count({ where: { taxVaultId } }),
    ]);

    return {
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get annual tax report data
   */
  async getAnnualTaxReport(userId: string, year: number) {
    const vault = await this.prisma.taxVault.findUnique({
      where: { userId },
    });

    if (!vault) {
      throw new Error('Tax vault not found');
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const [deposits, withdrawals] = await Promise.all([
      this.prisma.taxVaultDeposit.findMany({
        where: {
          taxVaultId: vault.id,
          createdAt: { gte: yearStart, lte: yearEnd },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.taxVaultWithdrawal.findMany({
        where: {
          taxVaultId: vault.id,
          createdAt: { gte: yearStart, lte: yearEnd },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const totalDeposited = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);

    // Group withdrawals by quarter
    const quarterlyWithdrawals: [number, number, number, number] = [0, 0, 0, 0];
    for (const w of withdrawals) {
      if (w.taxQuarter && w.taxQuarter >= 1 && w.taxQuarter <= 4) {
        const idx = w.taxQuarter - 1;
        quarterlyWithdrawals[idx as 0 | 1 | 2 | 3] += Number(w.amount);
      }
    }

    return {
      year,
      totalDeposited,
      totalWithdrawn,
      netSaved: totalDeposited - totalWithdrawn,
      quarterlyWithdrawals: {
        q1: quarterlyWithdrawals[0],
        q2: quarterlyWithdrawals[1],
        q3: quarterlyWithdrawals[2],
        q4: quarterlyWithdrawals[3],
      },
      deposits: deposits.map((d) => ({
        date: d.createdAt,
        amount: Number(d.amount),
        source: d.source,
      })),
      withdrawals: withdrawals.map((w) => ({
        date: w.createdAt,
        amount: Number(w.amount),
        reason: w.reason,
        quarter: w.taxQuarter,
      })),
    };
  }
}
