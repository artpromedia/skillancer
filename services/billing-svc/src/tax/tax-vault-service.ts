// @ts-nocheck
/**
 * Tax Vault Service
 * Automatic tax savings from freelancer earnings
 * Sprint M5: Freelancer Financial Services
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TaxVault {
  id: string;
  userId: string;
  balance: number;
  savingsRate: number;
  autoSaveEnabled: boolean;
  targetQuarterly: number;
  settings: TaxVaultSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxVaultSettings {
  autoAdjust: boolean;
  minimumSavePercentage: number;
  maximumSavePercentage: number;
  roundUp: boolean; // Round deposits to nearest $10
  notifyOnDeposit: boolean;
  notifyOnQuarterlyReminder: boolean;
}

export interface TaxVaultTransaction {
  id: string;
  userId: string;
  type: TaxVaultTransactionType;
  amount: number;
  sourceId?: string; // Reference to original earning
  sourceName?: string;
  balanceAfter: number;
  createdAt: Date;
}

export type TaxVaultTransactionType =
  | 'auto_save' // Automatic % of earnings
  | 'manual_deposit' // User-initiated deposit
  | 'quarterly_payment' // Payment for estimated taxes
  | 'withdrawal' // User withdrawal
  | 'adjustment'; // Manual adjustment

export interface TaxVaultSummary {
  currentBalance: number;
  savingsRate: number;
  totalSavedThisYear: number;
  totalWithdrawnThisYear: number;
  nextQuarterlyDue: Date;
  estimatedQuarterlyTax: number;
  projectedShortfall: number; // If current savings won't cover estimated taxes
}

export interface SavingsRecommendation {
  recommendedRate: number;
  currentRate: number;
  reason: string;
  annualIncome: number;
  estimatedAnnualTax: number;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_SETTINGS: TaxVaultSettings = {
  autoAdjust: true,
  minimumSavePercentage: 15,
  maximumSavePercentage: 40,
  roundUp: false,
  notifyOnDeposit: true,
  notifyOnQuarterlyReminder: true,
};

const DEFAULT_SAVINGS_RATE = 25; // 25% is a safe default for US freelancers

// ============================================================================
// QUARTERLY TAX DATES (US)
// ============================================================================

const QUARTERLY_TAX_DATES = [
  { quarter: 1, month: 3, day: 15 }, // April 15
  { quarter: 2, month: 5, day: 15 }, // June 15
  { quarter: 3, month: 8, day: 15 }, // September 15
  { quarter: 4, month: 0, day: 15 }, // January 15 (next year)
];

// ============================================================================
// TAX VAULT SERVICE
// ============================================================================

export class TaxVaultService {
  // ==========================================================================
  // VAULT MANAGEMENT
  // ==========================================================================

  /**
   * Get or create tax vault for user
   */
  async getOrCreateVault(userId: string): Promise<TaxVault> {
    let vault = await prisma.taxVault.findUnique({ where: { userId } });

    if (!vault) {
      vault = await prisma.taxVault.create({
        data: {
          userId,
          balance: 0,
          savingsRate: DEFAULT_SAVINGS_RATE,
          autoSaveEnabled: true,
          targetQuarterly: 0,
          settings: DEFAULT_SETTINGS,
        },
      });

      logger.info('Tax vault created', { userId });
    }

    return this.mapVault(vault);
  }

  /**
   * Get vault summary
   */
  async getVaultSummary(userId: string): Promise<TaxVaultSummary> {
    const vault = await this.getOrCreateVault(userId);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    // Get yearly totals
    const yearlyTotals = await prisma.taxVaultTransaction.groupBy({
      by: ['type'],
      where: {
        userId,
        createdAt: { gte: yearStart },
      },
      _sum: { amount: true },
    });

    let totalSaved = 0;
    let totalWithdrawn = 0;

    for (const t of yearlyTotals) {
      if (['auto_save', 'manual_deposit'].includes(t.type)) {
        totalSaved += t._sum.amount?.toNumber() || 0;
      } else if (['quarterly_payment', 'withdrawal'].includes(t.type)) {
        totalWithdrawn += t._sum.amount?.toNumber() || 0;
      }
    }

    // Calculate next quarterly due date
    const nextQuarterly = this.getNextQuarterlyDueDate();

    // Estimate quarterly tax based on income
    const quarterlyIncome = await this.getQuarterlyIncome(userId);
    const estimatedTax = quarterlyIncome * (vault.savingsRate / 100);

    const projectedShortfall = Math.max(0, estimatedTax - vault.balance);

    return {
      currentBalance: vault.balance,
      savingsRate: vault.savingsRate,
      totalSavedThisYear: totalSaved,
      totalWithdrawnThisYear: totalWithdrawn,
      nextQuarterlyDue: nextQuarterly,
      estimatedQuarterlyTax: estimatedTax,
      projectedShortfall,
    };
  }

  /**
   * Update vault settings
   */
  async updateSettings(
    userId: string,
    updates: Partial<TaxVaultSettings & { savingsRate?: number; autoSaveEnabled?: boolean }>
  ): Promise<TaxVault> {
    const vault = await this.getOrCreateVault(userId);

    const { savingsRate, autoSaveEnabled, ...settingsUpdates } = updates;
    const newSettings = { ...vault.settings, ...settingsUpdates };

    // Validate savings rate
    if (savingsRate !== undefined) {
      if (savingsRate < newSettings.minimumSavePercentage) {
        throw new Error(`Savings rate cannot be less than ${newSettings.minimumSavePercentage}%`);
      }
      if (savingsRate > newSettings.maximumSavePercentage) {
        throw new Error(`Savings rate cannot exceed ${newSettings.maximumSavePercentage}%`);
      }
    }

    const updated = await prisma.taxVault.update({
      where: { userId },
      data: {
        savingsRate: savingsRate ?? vault.savingsRate,
        autoSaveEnabled: autoSaveEnabled ?? vault.autoSaveEnabled,
        settings: newSettings,
        updatedAt: new Date(),
      },
    });

    logger.info('Tax vault settings updated', { userId, savingsRate, autoSaveEnabled });

    return this.mapVault(updated);
  }

  // ==========================================================================
  // DEPOSITS & WITHDRAWALS
  // ==========================================================================

  /**
   * Process automatic tax savings from an earning
   */
  async processAutoSave(
    userId: string,
    earningAmount: number,
    sourceId: string,
    sourceName: string
  ): Promise<TaxVaultTransaction | null> {
    const vault = await this.getOrCreateVault(userId);

    if (!vault.autoSaveEnabled) {
      return null;
    }

    let saveAmount = earningAmount * (vault.savingsRate / 100);

    // Apply round-up if enabled
    if (vault.settings.roundUp) {
      saveAmount = Math.ceil(saveAmount / 10) * 10;
    }

    const transaction = await this.deposit(
      userId,
      saveAmount,
      'auto_save',
      sourceId,
      `Auto-save from: ${sourceName}`
    );

    logger.info('Auto-save processed', { userId, earningAmount, saveAmount, sourceId });

    return transaction;
  }

  /**
   * Manual deposit to vault
   */
  async manualDeposit(userId: string, amount: number, note?: string): Promise<TaxVaultTransaction> {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }

    return this.deposit(userId, amount, 'manual_deposit', undefined, note);
  }

  /**
   * Withdraw from vault
   */
  async withdraw(userId: string, amount: number, reason: string): Promise<TaxVaultTransaction> {
    const vault = await this.getOrCreateVault(userId);

    if (amount <= 0) {
      throw new Error('Withdrawal amount must be positive');
    }

    if (amount > vault.balance) {
      throw new Error('Insufficient vault balance');
    }

    const newBalance = vault.balance - amount;

    await prisma.taxVault.update({
      where: { userId },
      data: { balance: newBalance, updatedAt: new Date() },
    });

    const transaction = await prisma.taxVaultTransaction.create({
      data: {
        userId,
        type: 'withdrawal',
        amount: -amount, // Negative for withdrawals
        sourceName: reason,
        balanceAfter: newBalance,
      },
    });

    logger.info('Tax vault withdrawal', { userId, amount, reason, newBalance });

    return this.mapTransaction(transaction);
  }

  /**
   * Record quarterly tax payment
   */
  async recordQuarterlyPayment(
    userId: string,
    amount: number,
    quarter: number,
    year: number
  ): Promise<TaxVaultTransaction> {
    const vault = await this.getOrCreateVault(userId);

    if (amount > vault.balance) {
      throw new Error('Insufficient vault balance for quarterly payment');
    }

    const newBalance = vault.balance - amount;

    await prisma.taxVault.update({
      where: { userId },
      data: { balance: newBalance, updatedAt: new Date() },
    });

    const transaction = await prisma.taxVaultTransaction.create({
      data: {
        userId,
        type: 'quarterly_payment',
        amount: -amount,
        sourceName: `Q${quarter} ${year} Estimated Tax Payment`,
        balanceAfter: newBalance,
      },
    });

    // Record the payment
    await prisma.quarterlyTaxPayment.create({
      data: {
        userId,
        quarter,
        year,
        amount,
        paidAt: new Date(),
      },
    });

    logger.info('Quarterly tax payment recorded', { userId, amount, quarter, year });

    return this.mapTransaction(transaction);
  }

  private async deposit(
    userId: string,
    amount: number,
    type: TaxVaultTransactionType,
    sourceId?: string,
    sourceName?: string
  ): Promise<TaxVaultTransaction> {
    const vault = await this.getOrCreateVault(userId);
    const newBalance = vault.balance + amount;

    await prisma.taxVault.update({
      where: { userId },
      data: { balance: newBalance, updatedAt: new Date() },
    });

    const transaction = await prisma.taxVaultTransaction.create({
      data: {
        userId,
        type,
        amount,
        sourceId,
        sourceName,
        balanceAfter: newBalance,
      },
    });

    return this.mapTransaction(transaction);
  }

  // ==========================================================================
  // TRANSACTION HISTORY
  // ==========================================================================

  /**
   * Get vault transactions
   */
  async getTransactions(
    userId: string,
    options: {
      type?: TaxVaultTransactionType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ transactions: TaxVaultTransaction[]; total: number }> {
    const where: any = { userId };

    if (options.type) where.type = options.type;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.taxVaultTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      prisma.taxVaultTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => this.mapTransaction(t)),
      total,
    };
  }

  // ==========================================================================
  // RECOMMENDATIONS
  // ==========================================================================

  /**
   * Get savings rate recommendation based on income
   */
  async getSavingsRecommendation(userId: string): Promise<SavingsRecommendation> {
    const vault = await this.getOrCreateVault(userId);

    // Calculate annual income from the past 12 months
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const annualIncome = await this.getIncomeInPeriod(userId, yearAgo, new Date());

    // Estimate tax based on income brackets (simplified US federal + SE tax)
    const estimatedAnnualTax = this.estimateAnnualTax(annualIncome);
    const recommendedRate = annualIncome > 0 ? (estimatedAnnualTax / annualIncome) * 100 : 25;

    // Round to nearest 5%
    const roundedRate = Math.ceil(recommendedRate / 5) * 5;

    let reason = '';
    if (roundedRate > vault.savingsRate) {
      reason = `Based on your income of $${annualIncome.toFixed(2)}, you may want to increase your savings rate to cover estimated taxes.`;
    } else if (roundedRate < vault.savingsRate) {
      reason = `Your current savings rate may be higher than needed. You could lower it and have more cash available.`;
    } else {
      reason = `Your current savings rate aligns well with your estimated tax obligations.`;
    }

    return {
      recommendedRate: roundedRate,
      currentRate: vault.savingsRate,
      reason,
      annualIncome,
      estimatedAnnualTax,
    };
  }

  private estimateAnnualTax(income: number): number {
    if (income <= 0) return 0;

    // Self-employment tax (15.3% on 92.35% of income)
    const seIncome = income * 0.9235;
    const seTax = seIncome * 0.153;

    // Simplified federal tax estimate (progressive brackets)
    const brackets = [
      { limit: 11000, rate: 0.1 },
      { limit: 44725, rate: 0.12 },
      { limit: 95375, rate: 0.22 },
      { limit: 182100, rate: 0.24 },
      { limit: 231250, rate: 0.32 },
      { limit: 578125, rate: 0.35 },
      { limit: Infinity, rate: 0.37 },
    ];

    let federalTax = 0;
    let remainingIncome = income - seTax / 2; // SE tax deduction
    let previousLimit = 0;

    for (const bracket of brackets) {
      if (remainingIncome <= 0) break;
      const taxableInBracket = Math.min(remainingIncome, bracket.limit - previousLimit);
      federalTax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
      previousLimit = bracket.limit;
    }

    return seTax + federalTax;
  }

  // ==========================================================================
  // QUARTERLY REMINDERS
  // ==========================================================================

  /**
   * Get next quarterly due date
   */
  getNextQuarterlyDueDate(): Date {
    const now = new Date();
    const currentYear = now.getFullYear();

    for (const q of QUARTERLY_TAX_DATES) {
      const dueDate = new Date(q.quarter === 4 ? currentYear + 1 : currentYear, q.month, q.day);
      if (dueDate > now) {
        return dueDate;
      }
    }

    // If we're past all dates this year, return Q1 next year
    return new Date(currentYear + 1, 3, 15);
  }

  /**
   * Get current quarter info
   */
  getCurrentQuarter(): { quarter: number; year: number; daysRemaining: number } {
    const now = new Date();
    const nextDue = this.getNextQuarterlyDueDate();
    const daysRemaining = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Determine which quarter we're in
    const month = now.getMonth();
    let quarter: number;
    if (month < 3) quarter = 1;
    else if (month < 6) quarter = 2;
    else if (month < 9) quarter = 3;
    else quarter = 4;

    return { quarter, year: now.getFullYear(), daysRemaining };
  }

  /**
   * Get users needing quarterly reminder
   */
  async getUsersNeedingReminder(daysBeforeDue: number = 14): Promise<string[]> {
    const nextDue = this.getNextQuarterlyDueDate();
    const reminderDate = new Date(nextDue);
    reminderDate.setDate(reminderDate.getDate() - daysBeforeDue);

    const now = new Date();
    if (now < reminderDate || now > nextDue) {
      return [];
    }

    // Get users with tax vaults who haven't been reminded
    const vaults = await prisma.taxVault.findMany({
      where: {
        autoSaveEnabled: true,
        settings: {
          path: ['notifyOnQuarterlyReminder'],
          equals: true,
        },
      },
      select: { userId: true },
    });

    // Filter out users who have already made this quarter's payment
    const { quarter, year } = this.getCurrentQuarter();
    const usersNeedingReminder: string[] = [];

    for (const vault of vaults) {
      const payment = await prisma.quarterlyTaxPayment.findFirst({
        where: { userId: vault.userId, quarter, year },
      });

      if (!payment) {
        usersNeedingReminder.push(vault.userId);
      }
    }

    return usersNeedingReminder;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async getQuarterlyIncome(userId: string): Promise<number> {
    const quarterStart = new Date();
    quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
    quarterStart.setHours(0, 0, 0, 0);

    return this.getIncomeInPeriod(userId, quarterStart, new Date());
  }

  private async getIncomeInPeriod(userId: string, start: Date, end: Date): Promise<number> {
    const income = await prisma.treasuryTransaction.aggregate({
      where: {
        userId,
        type: 'inbound',
        createdAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    return (income._sum.amount?.toNumber() || 0) / 100;
  }

  private mapVault(v: any): TaxVault {
    return {
      id: v.id,
      userId: v.userId,
      balance: v.balance?.toNumber?.() ?? v.balance,
      savingsRate: v.savingsRate,
      autoSaveEnabled: v.autoSaveEnabled,
      targetQuarterly: v.targetQuarterly?.toNumber?.() ?? v.targetQuarterly ?? 0,
      settings: v.settings as TaxVaultSettings,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  private mapTransaction(t: any): TaxVaultTransaction {
    return {
      id: t.id,
      userId: t.userId,
      type: t.type,
      amount: t.amount?.toNumber?.() ?? t.amount,
      sourceId: t.sourceId,
      sourceName: t.sourceName,
      balanceAfter: t.balanceAfter?.toNumber?.() ?? t.balanceAfter,
      createdAt: t.createdAt,
    };
  }
}

// Singleton instance
let taxVaultInstance: TaxVaultService | null = null;

export function getTaxVaultService(): TaxVaultService {
  if (!taxVaultInstance) {
    taxVaultInstance = new TaxVaultService();
  }
  return taxVaultInstance;
}
