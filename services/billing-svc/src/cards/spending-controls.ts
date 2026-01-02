// @ts-nocheck
/**
 * Spending Controls Service
 * Smart spending limits, merchant blocks, and intelligent controls
 * Sprint M5: Freelancer Financial Services
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface SpendingControl {
  id: string;
  userId: string;
  cardId?: string; // null = applies to all cards
  type: SpendingControlType;
  config: SpendingControlConfig;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type SpendingControlType =
  | 'transaction_limit'
  | 'daily_limit'
  | 'weekly_limit'
  | 'monthly_limit'
  | 'category_limit'
  | 'category_block'
  | 'merchant_block'
  | 'time_restriction'
  | 'location_restriction'
  | 'smart_limit';

export type SpendingControlConfig =
  | TransactionLimitConfig
  | PeriodLimitConfig
  | CategoryLimitConfig
  | CategoryBlockConfig
  | MerchantBlockConfig
  | TimeRestrictionConfig
  | LocationRestrictionConfig
  | SmartLimitConfig;

export interface TransactionLimitConfig {
  maxAmount: number;
}

export interface PeriodLimitConfig {
  maxAmount: number;
  period: 'daily' | 'weekly' | 'monthly';
}

export interface CategoryLimitConfig {
  categoryCode: string;
  categoryName: string;
  maxAmount: number;
  period: 'daily' | 'weekly' | 'monthly';
}

export interface CategoryBlockConfig {
  categoryCodes: string[];
  categoryNames: string[];
  reason?: string;
}

export interface MerchantBlockConfig {
  merchantIds?: string[];
  merchantNames?: string[];
  reason?: string;
}

export interface TimeRestrictionConfig {
  allowedDays: number[]; // 0-6, Sunday = 0
  allowedHours: { start: number; end: number }; // 24-hour format
  timezone: string;
}

export interface LocationRestrictionConfig {
  allowedCountries: string[];
  blockedCountries?: string[];
}

export interface SmartLimitConfig {
  type: 'budget_aware' | 'income_percentage' | 'savings_first';
  parameters: Record<string, any>;
}

export interface SpendingAlert {
  id: string;
  userId: string;
  type: SpendingAlertType;
  threshold: number;
  currentAmount: number;
  message: string;
  createdAt: Date;
  acknowledged: boolean;
}

export type SpendingAlertType =
  | 'approaching_limit'
  | 'limit_exceeded'
  | 'unusual_spending'
  | 'blocked_attempt';

// ============================================================================
// PRESET SPENDING PROFILES
// ============================================================================

export const SPENDING_PROFILES = {
  conservative: {
    name: 'Conservative',
    description: 'Tight spending limits, good for budgeting',
    controls: [
      { type: 'transaction_limit', config: { maxAmount: 500 } },
      { type: 'daily_limit', config: { maxAmount: 1000, period: 'daily' } },
      { type: 'weekly_limit', config: { maxAmount: 3000, period: 'weekly' } },
      { type: 'monthly_limit', config: { maxAmount: 8000, period: 'monthly' } },
    ],
  },
  balanced: {
    name: 'Balanced',
    description: 'Moderate limits for everyday use',
    controls: [
      { type: 'transaction_limit', config: { maxAmount: 2000 } },
      { type: 'daily_limit', config: { maxAmount: 5000, period: 'daily' } },
      { type: 'weekly_limit', config: { maxAmount: 15000, period: 'weekly' } },
      { type: 'monthly_limit', config: { maxAmount: 40000, period: 'monthly' } },
    ],
  },
  flexible: {
    name: 'Flexible',
    description: 'Higher limits for established freelancers',
    controls: [
      { type: 'transaction_limit', config: { maxAmount: 5000 } },
      { type: 'daily_limit', config: { maxAmount: 10000, period: 'daily' } },
      { type: 'weekly_limit', config: { maxAmount: 25000, period: 'weekly' } },
      { type: 'monthly_limit', config: { maxAmount: 50000, period: 'monthly' } },
    ],
  },
  business_only: {
    name: 'Business Only',
    description: 'Blocks personal spending categories',
    controls: [
      {
        type: 'category_block',
        config: {
          categoryCodes: ['5813', '5921', '7995', '5993'],
          categoryNames: ['Bars/Taverns', 'Liquor Stores', 'Gambling', 'Tobacco'],
          reason: 'Business card - personal expenses blocked',
        },
      },
      { type: 'transaction_limit', config: { maxAmount: 5000 } },
    ],
  },
} as const;

// ============================================================================
// SPENDING CONTROLS SERVICE
// ============================================================================

export class SpendingControlsService {
  // ==========================================================================
  // CONTROL MANAGEMENT
  // ==========================================================================

  /**
   * Create a spending control
   */
  async createControl(
    userId: string,
    type: SpendingControlType,
    config: SpendingControlConfig,
    cardId?: string
  ): Promise<SpendingControl> {
    // Validate config matches type
    this.validateConfig(type, config);

    const control = await prisma.spendingControl.create({
      data: {
        userId,
        cardId,
        type,
        config: config as any,
        enabled: true,
      },
    });

    logger.info('Spending control created', { userId, type, cardId });

    return this.mapControl(control);
  }

  /**
   * Update a spending control
   */
  async updateControl(
    userId: string,
    controlId: string,
    updates: { config?: SpendingControlConfig; enabled?: boolean }
  ): Promise<SpendingControl> {
    const control = await prisma.spendingControl.findFirst({
      where: { id: controlId, userId },
    });

    if (!control) {
      throw new Error('Spending control not found');
    }

    if (updates.config) {
      this.validateConfig(control.type as SpendingControlType, updates.config);
    }

    const updated = await prisma.spendingControl.update({
      where: { id: controlId },
      data: {
        config: updates.config as any,
        enabled: updates.enabled,
        updatedAt: new Date(),
      },
    });

    logger.info('Spending control updated', { userId, controlId });

    return this.mapControl(updated);
  }

  /**
   * Delete a spending control
   */
  async deleteControl(userId: string, controlId: string): Promise<void> {
    await prisma.spendingControl.deleteMany({
      where: { id: controlId, userId },
    });

    logger.info('Spending control deleted', { userId, controlId });
  }

  /**
   * Get all controls for user
   */
  async getControls(userId: string, cardId?: string): Promise<SpendingControl[]> {
    const controls = await prisma.spendingControl.findMany({
      where: {
        userId,
        ...(cardId ? { OR: [{ cardId }, { cardId: null }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return controls.map((c) => this.mapControl(c));
  }

  /**
   * Apply a spending profile
   */
  async applyProfile(
    userId: string,
    profileName: keyof typeof SPENDING_PROFILES,
    cardId?: string
  ): Promise<SpendingControl[]> {
    const profile = SPENDING_PROFILES[profileName];

    // Remove existing limit controls
    await prisma.spendingControl.deleteMany({
      where: {
        userId,
        cardId,
        type: { in: ['transaction_limit', 'daily_limit', 'weekly_limit', 'monthly_limit'] },
      },
    });

    // Create new controls from profile
    const controls: SpendingControl[] = [];
    for (const control of profile.controls) {
      const created = await this.createControl(
        userId,
        control.type as SpendingControlType,
        control.config as SpendingControlConfig,
        cardId
      );
      controls.push(created);
    }

    logger.info('Spending profile applied', { userId, profileName, cardId });

    return controls;
  }

  // ==========================================================================
  // AUTHORIZATION CHECKS
  // ==========================================================================

  /**
   * Check if transaction is allowed by spending controls
   */
  async checkTransaction(
    userId: string,
    cardId: string,
    transaction: {
      amount: number;
      merchantCategoryCode: string;
      merchantName: string;
      merchantCountry: string;
    }
  ): Promise<{ allowed: boolean; reason?: string; control?: SpendingControl }> {
    const controls = await this.getControls(userId, cardId);

    for (const control of controls) {
      if (!control.enabled) continue;

      const result = await this.evaluateControl(control, userId, cardId, transaction);
      if (!result.allowed) {
        // Log blocked attempt
        await this.createAlert(userId, 'blocked_attempt', {
          control,
          transaction,
        });

        return {
          allowed: false,
          reason: result.reason,
          control,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Evaluate a single control
   */
  private async evaluateControl(
    control: SpendingControl,
    userId: string,
    cardId: string,
    transaction: {
      amount: number;
      merchantCategoryCode: string;
      merchantName: string;
      merchantCountry: string;
    }
  ): Promise<{ allowed: boolean; reason?: string }> {
    switch (control.type) {
      case 'transaction_limit':
        return this.checkTransactionLimit(
          control.config as TransactionLimitConfig,
          transaction.amount
        );

      case 'daily_limit':
      case 'weekly_limit':
      case 'monthly_limit':
        return this.checkPeriodLimit(
          control.config as PeriodLimitConfig,
          userId,
          cardId,
          transaction.amount
        );

      case 'category_limit':
        return this.checkCategoryLimit(
          control.config as CategoryLimitConfig,
          userId,
          cardId,
          transaction
        );

      case 'category_block':
        return this.checkCategoryBlock(
          control.config as CategoryBlockConfig,
          transaction.merchantCategoryCode
        );

      case 'merchant_block':
        return this.checkMerchantBlock(
          control.config as MerchantBlockConfig,
          transaction.merchantName
        );

      case 'time_restriction':
        return this.checkTimeRestriction(control.config as TimeRestrictionConfig);

      case 'location_restriction':
        return this.checkLocationRestriction(
          control.config as LocationRestrictionConfig,
          transaction.merchantCountry
        );

      case 'smart_limit':
        return this.checkSmartLimit(control.config as SmartLimitConfig, userId, transaction.amount);

      default:
        return { allowed: true };
    }
  }

  private checkTransactionLimit(
    config: TransactionLimitConfig,
    amount: number
  ): { allowed: boolean; reason?: string } {
    if (amount > config.maxAmount * 100) {
      return {
        allowed: false,
        reason: `Transaction exceeds limit of $${config.maxAmount}`,
      };
    }
    return { allowed: true };
  }

  private async checkPeriodLimit(
    config: PeriodLimitConfig,
    userId: string,
    cardId: string,
    amount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const startDate = this.getPeriodStartDate(config.period);

    const spent = await prisma.cardTransaction.aggregate({
      where: {
        userId,
        cardId,
        status: { in: ['authorized', 'captured'] },
        type: 'purchase',
        createdAt: { gte: startDate },
      },
      _sum: { amount: true },
    });

    const totalSpent = (spent._sum.amount || 0) + amount;
    if (totalSpent > config.maxAmount * 100) {
      return {
        allowed: false,
        reason: `${config.period.charAt(0).toUpperCase() + config.period.slice(1)} spending limit of $${config.maxAmount} exceeded`,
      };
    }
    return { allowed: true };
  }

  private async checkCategoryLimit(
    config: CategoryLimitConfig,
    userId: string,
    cardId: string,
    transaction: { amount: number; merchantCategoryCode: string }
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (transaction.merchantCategoryCode !== config.categoryCode) {
      return { allowed: true };
    }

    const startDate = this.getPeriodStartDate(config.period);

    const spent = await prisma.cardTransaction.aggregate({
      where: {
        userId,
        cardId,
        merchantCategoryCode: config.categoryCode,
        status: { in: ['authorized', 'captured'] },
        createdAt: { gte: startDate },
      },
      _sum: { amount: true },
    });

    const totalSpent = (spent._sum.amount || 0) + transaction.amount;
    if (totalSpent > config.maxAmount * 100) {
      return {
        allowed: false,
        reason: `${config.categoryName} spending limit of $${config.maxAmount}/${config.period} exceeded`,
      };
    }
    return { allowed: true };
  }

  private checkCategoryBlock(
    config: CategoryBlockConfig,
    merchantCategoryCode: string
  ): { allowed: boolean; reason?: string } {
    if (config.categoryCodes.includes(merchantCategoryCode)) {
      return {
        allowed: false,
        reason: config.reason || 'Merchant category is blocked',
      };
    }
    return { allowed: true };
  }

  private checkMerchantBlock(
    config: MerchantBlockConfig,
    merchantName: string
  ): { allowed: boolean; reason?: string } {
    const blocked = config.merchantNames?.some((name) =>
      merchantName.toLowerCase().includes(name.toLowerCase())
    );

    if (blocked) {
      return {
        allowed: false,
        reason: config.reason || 'Merchant is blocked',
      };
    }
    return { allowed: true };
  }

  private checkTimeRestriction(config: TimeRestrictionConfig): {
    allowed: boolean;
    reason?: string;
  } {
    const now = new Date();
    // Apply timezone offset
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));

    const currentDay = localTime.getDay();
    const currentHour = localTime.getHours();

    if (!config.allowedDays.includes(currentDay)) {
      return {
        allowed: false,
        reason: 'Transactions not allowed on this day',
      };
    }

    if (currentHour < config.allowedHours.start || currentHour >= config.allowedHours.end) {
      return {
        allowed: false,
        reason: `Transactions only allowed between ${config.allowedHours.start}:00-${config.allowedHours.end}:00`,
      };
    }

    return { allowed: true };
  }

  private checkLocationRestriction(
    config: LocationRestrictionConfig,
    merchantCountry: string
  ): { allowed: boolean; reason?: string } {
    if (config.blockedCountries?.includes(merchantCountry)) {
      return {
        allowed: false,
        reason: `Transactions in ${merchantCountry} are blocked`,
      };
    }

    if (config.allowedCountries.length > 0 && !config.allowedCountries.includes(merchantCountry)) {
      return {
        allowed: false,
        reason: `Transactions only allowed in: ${config.allowedCountries.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  private async checkSmartLimit(
    config: SmartLimitConfig,
    userId: string,
    amount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    switch (config.type) {
      case 'budget_aware':
        // Check against user's budget
        const budget = await prisma.userBudget.findUnique({ where: { userId } });
        if (budget && amount > budget.remainingAmount.toNumber() * 100) {
          return {
            allowed: false,
            reason: 'Transaction exceeds remaining budget',
          };
        }
        break;

      case 'income_percentage':
        // Limit spending to percentage of income
        const percentage = config.parameters.maxPercentage || 50;
        const income = await this.getMonthlyIncome(userId);
        const maxSpend = income * (percentage / 100);
        const monthlySpent = await this.getMonthlySpending(userId);
        if (monthlySpent + amount > maxSpend * 100) {
          return {
            allowed: false,
            reason: `Spending limited to ${percentage}% of monthly income`,
          };
        }
        break;

      case 'savings_first':
        // Ensure savings goal is met before allowing spending
        const savingsGoal = config.parameters.minimumSavings || 20;
        const totalIncome = await this.getMonthlyIncome(userId);
        const saved = await this.getMonthlySavings(userId);
        const requiredSavings = totalIncome * (savingsGoal / 100);
        if (saved < requiredSavings) {
          return {
            allowed: false,
            reason: `Save ${savingsGoal}% of income before additional spending`,
          };
        }
        break;
    }

    return { allowed: true };
  }

  // ==========================================================================
  // ALERTS
  // ==========================================================================

  /**
   * Check and create spending alerts
   */
  async checkSpendingAlerts(userId: string): Promise<SpendingAlert[]> {
    const alerts: SpendingAlert[] = [];
    const controls = await this.getControls(userId);

    for (const control of controls) {
      if (!control.enabled) continue;

      if (['daily_limit', 'weekly_limit', 'monthly_limit'].includes(control.type)) {
        const config = control.config as PeriodLimitConfig;
        const startDate = this.getPeriodStartDate(config.period);

        const spent = await prisma.cardTransaction.aggregate({
          where: {
            userId,
            status: { in: ['authorized', 'captured'] },
            type: 'purchase',
            createdAt: { gte: startDate },
          },
          _sum: { amount: true },
        });

        const spentAmount = (spent._sum.amount || 0) / 100;
        const percentage = (spentAmount / config.maxAmount) * 100;

        // Alert at 80% and 100%
        if (percentage >= 80 && percentage < 100) {
          const alert = await this.createAlert(userId, 'approaching_limit', {
            threshold: config.maxAmount,
            currentAmount: spentAmount,
            period: config.period,
            percentage,
          });
          if (alert) alerts.push(alert);
        } else if (percentage >= 100) {
          const alert = await this.createAlert(userId, 'limit_exceeded', {
            threshold: config.maxAmount,
            currentAmount: spentAmount,
            period: config.period,
            percentage,
          });
          if (alert) alerts.push(alert);
        }
      }
    }

    return alerts;
  }

  private async createAlert(
    userId: string,
    type: SpendingAlertType,
    data: any
  ): Promise<SpendingAlert | null> {
    // Check if similar alert already exists today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await prisma.spendingAlert.findFirst({
      where: { userId, type, createdAt: { gte: today } },
    });

    if (existing) return null;

    const message = this.getAlertMessage(type, data);

    const alert = await prisma.spendingAlert.create({
      data: {
        userId,
        type,
        threshold: data.threshold,
        currentAmount: data.currentAmount,
        message,
        acknowledged: false,
      },
    });

    logger.info('Spending alert created', { userId, type });

    return {
      id: alert.id,
      userId,
      type,
      threshold: data.threshold || 0,
      currentAmount: data.currentAmount || 0,
      message,
      createdAt: alert.createdAt,
      acknowledged: false,
    };
  }

  private getAlertMessage(type: SpendingAlertType, data: any): string {
    switch (type) {
      case 'approaching_limit':
        return `You've spent $${data.currentAmount.toFixed(2)} of your $${data.threshold} ${data.period} limit (${data.percentage.toFixed(0)}%)`;
      case 'limit_exceeded':
        return `You've exceeded your ${data.period} spending limit of $${data.threshold}`;
      case 'unusual_spending':
        return `Unusual spending pattern detected: ${data.description}`;
      case 'blocked_attempt':
        return `Transaction blocked: ${data.transaction.merchantName} - ${data.control.type}`;
      default:
        return 'Spending alert';
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(userId: string, alertId: string): Promise<void> {
    await prisma.spendingAlert.updateMany({
      where: { id: alertId, userId },
      data: { acknowledged: true },
    });
  }

  /**
   * Get unacknowledged alerts
   */
  async getUnacknowledgedAlerts(userId: string): Promise<SpendingAlert[]> {
    const alerts = await prisma.spendingAlert.findMany({
      where: { userId, acknowledged: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return alerts.map((a) => ({
      id: a.id,
      userId: a.userId,
      type: a.type as SpendingAlertType,
      threshold: a.threshold?.toNumber() || 0,
      currentAmount: a.currentAmount?.toNumber() || 0,
      message: a.message,
      createdAt: a.createdAt,
      acknowledged: a.acknowledged,
    }));
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private validateConfig(type: SpendingControlType, config: SpendingControlConfig): void {
    // Add validation logic based on type
    if (type === 'transaction_limit' && !(config as TransactionLimitConfig).maxAmount) {
      throw new Error('Transaction limit requires maxAmount');
    }
    // Add more validations as needed
  }

  private getPeriodStartDate(period: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    switch (period) {
      case 'daily':
        now.setHours(0, 0, 0, 0);
        return now;
      case 'weekly':
        const day = now.getDay();
        now.setDate(now.getDate() - day);
        now.setHours(0, 0, 0, 0);
        return now;
      case 'monthly':
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        return now;
    }
  }

  private async getMonthlyIncome(userId: string): Promise<number> {
    const monthStart = this.getPeriodStartDate('monthly');
    const income = await prisma.treasuryTransaction.aggregate({
      where: {
        userId,
        type: 'inbound',
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    });
    return (income._sum.amount?.toNumber() || 0) / 100;
  }

  private async getMonthlySpending(userId: string): Promise<number> {
    const monthStart = this.getPeriodStartDate('monthly');
    const spending = await prisma.cardTransaction.aggregate({
      where: {
        userId,
        type: 'purchase',
        status: { in: ['authorized', 'captured'] },
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
    });
    return spending._sum.amount || 0;
  }

  private async getMonthlySavings(userId: string): Promise<number> {
    const taxVault = await prisma.taxVault.findUnique({ where: { userId } });
    return taxVault?.balance.toNumber() || 0;
  }

  private mapControl(c: any): SpendingControl {
    return {
      id: c.id,
      userId: c.userId,
      cardId: c.cardId,
      type: c.type,
      config: c.config as SpendingControlConfig,
      enabled: c.enabled,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}

// Singleton instance
let spendingControlsInstance: SpendingControlsService | null = null;

export function getSpendingControlsService(): SpendingControlsService {
  if (!spendingControlsInstance) {
    spendingControlsInstance = new SpendingControlsService();
  }
  return spendingControlsInstance;
}

