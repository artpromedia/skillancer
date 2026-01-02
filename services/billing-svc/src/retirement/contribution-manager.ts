// @ts-nocheck
/**
 * Retirement Contribution Manager
 * Automated contribution processing and scheduling
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '@skillancer/logger';

import { getRetirementService, type Contribution } from './retirement-service.js';

const logger = createLogger({ serviceName: 'contribution-manager' });

// ============================================================================
// TYPES
// ============================================================================

export interface ContributionTrigger {
  type: 'payment_received' | 'monthly_schedule' | 'manual';
  userId: string;
  amount?: number;
  sourceId?: string;
}

export interface BatchContributionResult {
  processed: number;
  successful: number;
  failed: number;
  totalAmount: number;
  errors: { userId: string; error: string }[];
}

export interface ContributionSchedule {
  userId: string;
  frequency: 'per_payment' | 'weekly' | 'biweekly' | 'monthly';
  dayOfMonth?: number;
  nextScheduled?: Date;
  lastExecuted?: Date;
}

// ============================================================================
// CONTRIBUTION MANAGER
// ============================================================================

class ContributionManager {
  private retirementService = getRetirementService();

  // --------------------------------------------------------------------------
  // TRIGGER HANDLING
  // --------------------------------------------------------------------------

  async handlePaymentReceived(
    userId: string,
    paymentAmount: number,
    paymentId: string
  ): Promise<Contribution | null> {
    logger.info('Handling payment for auto-contribution', { userId, paymentAmount });

    try {
      const contribution = await this.retirementService.processAutoContribution(
        userId,
        paymentAmount,
        paymentId
      );

      if (contribution) {
        await this.notifyContributionMade(userId, contribution);
      }

      return contribution;
    } catch (error) {
      logger.error('Auto-contribution failed', { userId, error });
      return null;
    }
  }

  async processMonthlyBatch(): Promise<BatchContributionResult> {
    logger.info('Processing monthly contribution batch');

    const usersWithMonthly = await this.getUsersWithMonthlyContributions();
    const result: BatchContributionResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      totalAmount: 0,
      errors: [],
    };

    for (const userId of usersWithMonthly) {
      result.processed++;

      try {
        const contribution = await this.processMonthlyContribution(userId);
        if (contribution) {
          result.successful++;
          result.totalAmount += contribution.amount;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    metrics.gauge('retirement.batch.processed', result.processed);
    metrics.gauge('retirement.batch.successful', result.successful);
    metrics.histogram('retirement.batch.amount', result.totalAmount);

    return result;
  }

  private async processMonthlyContribution(userId: string): Promise<Contribution | null> {
    const settings = await this.retirementService.getContributionSettings(userId);
    if (!settings?.enabled || settings.timing !== 'monthly') {
      return null;
    }

    // Calculate monthly amount based on YTD income
    const monthlyAmount = await this.calculateMonthlyAmount(userId, settings.percentage);

    if (monthlyAmount <= 0) {
      return null;
    }

    // Check limits
    const limits = await this.retirementService.getContributionLimits(userId);
    const actualAmount = Math.min(monthlyAmount, limits.remainingRoom);

    if (actualAmount <= 0) {
      logger.info('User at contribution limit', { userId });
      await this.notifyLimitReached(userId);
      return null;
    }

    return this.retirementService.makeContribution(userId, actualAmount, 'auto');
  }

  // --------------------------------------------------------------------------
  // CONTRIBUTION CALCULATION
  // --------------------------------------------------------------------------

  async calculateContributionAmount(
    userId: string,
    percentage: number,
    netSeIncome: number
  ): Promise<number> {
    return Math.round(netSeIncome * (percentage / 100) * 100) / 100;
  }

  private async calculateMonthlyAmount(userId: string, percentage: number): Promise<number> {
    // Get this month's earnings
    const monthlyEarnings = await this.getMonthlyEarnings(userId);
    return Math.round(monthlyEarnings * (percentage / 100) * 100) / 100;
  }

  async suggestContributionPercentage(userId: string): Promise<{
    suggested: number;
    reason: string;
    projectedAnnual: number;
    taxSavings: number;
  }> {
    // Get user's income and spending patterns
    const ytdIncome = await this.getYtdIncome(userId);
    const limits = await this.retirementService.getContributionLimits(userId);

    // Project annual income
    const monthsElapsed = new Date().getMonth() + 1;
    const projectedAnnual = (ytdIncome / monthsElapsed) * 12;

    // Calculate percentage to max out contribution
    const maxPercentage = (limits.maxContribution / projectedAnnual) * 100;

    // Suggest a reasonable percentage
    let suggested: number;
    let reason: string;

    if (maxPercentage <= 10) {
      suggested = Math.round(maxPercentage);
      reason = 'This would maximize your contribution limit';
    } else if (maxPercentage <= 15) {
      suggested = 10;
      reason = 'A solid starting point for retirement savings';
    } else {
      suggested = 15;
      reason = 'Aggressive savings while maintaining cash flow';
    }

    const projectedContribution = projectedAnnual * (suggested / 100);
    const taxSavings = Math.round(projectedContribution * 0.3);

    return {
      suggested,
      reason,
      projectedAnnual: Math.round(projectedContribution),
      taxSavings,
    };
  }

  // --------------------------------------------------------------------------
  // LIMIT PROTECTION
  // --------------------------------------------------------------------------

  async checkAndAdjustForLimits(
    userId: string,
    requestedAmount: number
  ): Promise<{
    adjustedAmount: number;
    atLimit: boolean;
    message?: string;
  }> {
    const limits = await this.retirementService.getContributionLimits(userId);

    if (limits.remainingRoom <= 0) {
      return {
        adjustedAmount: 0,
        atLimit: true,
        message: `You've reached your ${limits.taxYear} contribution limit of $${limits.maxContribution.toLocaleString()}`,
      };
    }

    if (requestedAmount > limits.remainingRoom) {
      return {
        adjustedAmount: limits.remainingRoom,
        atLimit: true,
        message: `Adjusted to remaining limit of $${limits.remainingRoom.toLocaleString()}`,
      };
    }

    return {
      adjustedAmount: requestedAmount,
      atLimit: false,
    };
  }

  async getYearEndProjection(userId: string): Promise<{
    currentContributions: number;
    projectedContributions: number;
    remainingRoom: number;
    onTrackToMax: boolean;
    suggestedAdjustment?: string;
  }> {
    const limits = await this.retirementService.getContributionLimits(userId);
    const settings = await this.retirementService.getContributionSettings(userId);

    const monthsRemaining = 12 - (new Date().getMonth() + 1);
    const avgMonthlyContribution = limits.currentContributions / (new Date().getMonth() + 1);
    const projectedContributions =
      limits.currentContributions + avgMonthlyContribution * monthsRemaining;

    const onTrackToMax = projectedContributions >= limits.maxContribution * 0.9;

    let suggestedAdjustment: string | undefined;
    if (!onTrackToMax && settings?.enabled) {
      const neededMonthly = limits.remainingRoom / monthsRemaining;
      const currentMonthlyIncome = await this.getMonthlyEarnings(userId);
      const neededPercentage = (neededMonthly / currentMonthlyIncome) * 100;

      if (neededPercentage <= 25) {
        suggestedAdjustment = `Increase to ${Math.ceil(neededPercentage)}% to maximize contributions`;
      }
    }

    return {
      currentContributions: limits.currentContributions,
      projectedContributions: Math.round(projectedContributions),
      remainingRoom: limits.remainingRoom,
      onTrackToMax,
      suggestedAdjustment,
    };
  }

  // --------------------------------------------------------------------------
  // PRIOR YEAR CATCH-UP
  // --------------------------------------------------------------------------

  async checkPriorYearContribution(userId: string): Promise<{
    eligible: boolean;
    deadline: Date;
    remainingRoom: number;
    accountType: string;
  } | null> {
    const today = new Date();
    const taxYear = today.getFullYear() - 1;

    // Prior year contributions allowed until April 15 (or extension)
    const deadline = new Date(today.getFullYear(), 3, 15); // April 15

    if (today > deadline) {
      return null;
    }

    // Check if user has room in prior year
    const { total: priorYearContributions } = await this.retirementService.getContributions(
      userId,
      taxYear
    );

    const account = await this.retirementService.getUserAccount(userId);
    const maxContribution = 69000; // Simplified - would calculate based on account type
    const remainingRoom = maxContribution - priorYearContributions;

    if (remainingRoom <= 0) {
      return null;
    }

    return {
      eligible: true,
      deadline,
      remainingRoom,
      accountType: account?.accountType || 'sep_ira',
    };
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------

  private async notifyContributionMade(userId: string, contribution: Contribution): Promise<void> {
    logger.info('Notifying user of contribution', { userId, amount: contribution.amount });
    // In production, send push/email notification
  }

  private async notifyLimitReached(userId: string): Promise<void> {
    logger.info('Notifying user of limit reached', { userId });
    // In production, send notification
  }

  // --------------------------------------------------------------------------
  // DATA ACCESS
  // --------------------------------------------------------------------------

  private async getUsersWithMonthlyContributions(): Promise<string[]> {
    // In production, query database for users with monthly timing enabled
    return [];
  }

  private async getMonthlyEarnings(userId: string): Promise<number> {
    // In production, sum this month's payments
    return 8000;
  }

  private async getYtdIncome(userId: string): Promise<number> {
    // In production, sum YTD payments
    return 65000;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let contributionManager: ContributionManager | null = null;

export function getContributionManager(): ContributionManager {
  if (!contributionManager) {
    contributionManager = new ContributionManager();
  }
  return contributionManager;
}

