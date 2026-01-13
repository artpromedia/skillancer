// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/payout-scheduler
 * Freelancer Payout Scheduling Service
 *
 * Features:
 * - Configurable payout schedules (daily, weekly, biweekly, monthly)
 * - Minimum payout thresholds
 * - Payout batching for efficiency
 * - Failed payout retry logic
 * - Balance aggregation
 * - Payout notifications
 * - Manual payout requests
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { startOfDay, endOfDay, addDays, subDays, getDay, getDate } from 'date-fns';

import { getStripe } from './stripe.service.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export type PayoutSchedule = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MANUAL';

export interface PayoutConfig {
  schedule: PayoutSchedule;
  minimumAmount: number; // In cents
  preferredDayOfWeek?: number; // 0=Sunday, 6=Saturday (for weekly)
  preferredDayOfMonth?: number; // 1-28 (for monthly)
  currency: string;
}

export interface PayoutRequest {
  freelancerId: string;
  amount?: number; // Optional: if not provided, payout entire balance
  description?: string;
  priority?: 'STANDARD' | 'INSTANT';
}

export interface PayoutResult {
  success: boolean;
  payoutId?: string;
  stripePayoutId?: string;
  amount: number;
  fee: number;
  netAmount: number;
  arrivalDate?: Date;
  error?: string;
}

export interface FreelancerBalance {
  available: number;
  pending: number;
  inEscrow: number;
  total: number;
  currency: string;
  nextPayoutDate?: Date;
  payoutSchedule: PayoutSchedule;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_MINIMUM_PAYOUT = 2500; // $25.00
const INSTANT_PAYOUT_FEE_PERCENT = 1.5;
const MAX_INSTANT_PAYOUT_FEE = 1500; // $15.00 cap

// =============================================================================
// PAYOUT SCHEDULER CLASS
// =============================================================================

export class PayoutScheduler {
  private stripe: Stripe;

  constructor() {
    this.stripe = getStripe();
  }

  /**
   * Process scheduled payouts for eligible freelancers
   */
  async processScheduledPayouts(): Promise<{ processed: number; failed: number; skipped: number }> {
    const today = new Date();
    const dayOfWeek = getDay(today);
    const dayOfMonth = getDate(today);

    logger.info({ dayOfWeek, dayOfMonth }, 'Processing scheduled payouts');

    const stats = { processed: 0, failed: 0, skipped: 0 };

    try {
      // Get freelancers eligible for payout today
      const eligibleFreelancers = await this.getEligibleFreelancers(dayOfWeek, dayOfMonth);

      logger.info({ count: eligibleFreelancers.length }, 'Found eligible freelancers for payout');

      for (const freelancer of eligibleFreelancers) {
        try {
          const result = await this.processFreelancerPayout(freelancer);

          if (result.success) {
            stats.processed++;
          } else if (result.error?.includes('minimum')) {
            stats.skipped++;
          } else {
            stats.failed++;
          }

          // Small delay between payouts
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          logger.error({ freelancerId: freelancer.id, error }, 'Failed to process payout');
          stats.failed++;
        }
      }

      logger.info(stats, 'Scheduled payouts completed');
      return stats;
    } catch (error) {
      logger.error({ error }, 'Failed to process scheduled payouts');
      throw error;
    }
  }

  /**
   * Request a manual payout
   */
  async requestPayout(request: PayoutRequest): Promise<PayoutResult> {
    logger.info(
      {
        freelancerId: request.freelancerId,
        amount: request.amount,
        priority: request.priority,
      },
      'Processing manual payout request'
    );

    const freelancer = await prisma.user.findUnique({
      where: { id: request.freelancerId },
      include: {
        stripeConnectedAccount: true,
        payoutConfig: true,
      },
    });

    if (!freelancer) {
      return { success: false, amount: 0, fee: 0, netAmount: 0, error: 'Freelancer not found' };
    }

    const connectedAccount = freelancer.stripeConnectedAccount;
    if (!connectedAccount || connectedAccount.status !== 'ACTIVE') {
      return {
        success: false,
        amount: 0,
        fee: 0,
        netAmount: 0,
        error: 'No active Stripe connected account',
      };
    }

    // Get available balance
    const balance = await this.getFreelancerBalance(request.freelancerId);
    const payoutAmount = request.amount || balance.available;

    if (payoutAmount <= 0) {
      return {
        success: false,
        amount: 0,
        fee: 0,
        netAmount: 0,
        error: 'No available balance to payout',
      };
    }

    const minimumPayout = freelancer.payoutConfig?.minimumAmount || DEFAULT_MINIMUM_PAYOUT;
    if (payoutAmount < minimumPayout) {
      return {
        success: false,
        amount: payoutAmount,
        fee: 0,
        netAmount: 0,
        error: `Amount ${payoutAmount / 100} is below minimum payout of ${minimumPayout / 100}`,
      };
    }

    // Calculate fees for instant payout
    let fee = 0;
    if (request.priority === 'INSTANT') {
      fee = Math.min(
        Math.round(payoutAmount * (INSTANT_PAYOUT_FEE_PERCENT / 100)),
        MAX_INSTANT_PAYOUT_FEE
      );
    }

    const netAmount = payoutAmount - fee;

    try {
      // Create Stripe payout
      const stripePayout = await this.stripe.payouts.create(
        {
          amount: netAmount,
          currency: balance.currency.toLowerCase(),
          method: request.priority === 'INSTANT' ? 'instant' : 'standard',
          description: request.description || 'Skillancer earnings payout',
          metadata: {
            freelancerId: request.freelancerId,
            type: 'earnings_payout',
            priority: request.priority || 'STANDARD',
          },
        },
        {
          stripeAccount: connectedAccount.stripeAccountId,
        }
      );

      // Record payout in database
      const payout = await prisma.payout.create({
        data: {
          userId: request.freelancerId,
          stripeAccountId: connectedAccount.stripeAccountId,
          stripePayoutId: stripePayout.id,
          amount: payoutAmount,
          fee,
          netAmount,
          currency: balance.currency,
          status: 'PENDING',
          method: request.priority === 'INSTANT' ? 'INSTANT' : 'STANDARD',
          description: request.description || null,
          expectedArrivalAt: new Date(stripePayout.arrival_date * 1000),
        },
      });

      // Update freelancer's last payout date
      await prisma.payoutConfig.update({
        where: { userId: request.freelancerId },
        data: { lastPayoutAt: new Date() },
      });

      logger.info(
        {
          payoutId: payout.id,
          stripePayoutId: stripePayout.id,
          amount: payoutAmount,
          netAmount,
          arrivalDate: stripePayout.arrival_date,
        },
        'Payout created successfully'
      );

      return {
        success: true,
        payoutId: payout.id,
        stripePayoutId: stripePayout.id,
        amount: payoutAmount,
        fee,
        netAmount,
        arrivalDate: new Date(stripePayout.arrival_date * 1000),
      };
    } catch (error) {
      const stripeError = error as Stripe.StripeError;
      const errorMessage = stripeError?.message || 'Unknown error';

      logger.error(
        {
          freelancerId: request.freelancerId,
          error: errorMessage,
          code: stripeError?.code,
        },
        'Payout creation failed'
      );

      // Record failed payout attempt
      await prisma.payoutAttempt.create({
        data: {
          userId: request.freelancerId,
          amount: payoutAmount,
          currency: balance.currency,
          status: 'FAILED',
          errorCode: stripeError?.code || 'unknown',
          errorMessage,
        },
      });

      return {
        success: false,
        amount: payoutAmount,
        fee: 0,
        netAmount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Get freelancer's balance
   */
  async getFreelancerBalance(freelancerId: string): Promise<FreelancerBalance> {
    const connectedAccount = await prisma.stripeConnectedAccount.findFirst({
      where: { userId: freelancerId, status: 'ACTIVE' },
    });

    if (!connectedAccount) {
      return {
        available: 0,
        pending: 0,
        inEscrow: 0,
        total: 0,
        currency: 'USD',
        payoutSchedule: 'MANUAL',
      };
    }

    try {
      // Get Stripe balance for connected account
      const stripeBalance = await this.stripe.balance.retrieve({
        stripeAccount: connectedAccount.stripeAccountId,
      });

      // Get escrow balance from database
      const escrowBalance = await prisma.escrowMilestone.aggregate({
        where: {
          escrow: {
            freelancerId,
            status: { in: ['FUNDED', 'PARTIALLY_RELEASED'] },
          },
          status: { in: ['PENDING', 'ACTIVE', 'WORK_SUBMITTED'] },
        },
        _sum: { amount: true },
      });

      // Get payout config
      const payoutConfig = await prisma.payoutConfig.findUnique({
        where: { userId: freelancerId },
      });

      const available = stripeBalance.available[0]?.amount || 0;
      const pending = stripeBalance.pending[0]?.amount || 0;
      const inEscrow = escrowBalance._sum.amount || 0;

      // Calculate next payout date
      const nextPayoutDate = this.calculateNextPayoutDate(
        payoutConfig?.schedule as PayoutSchedule,
        payoutConfig?.preferredDayOfWeek || undefined,
        payoutConfig?.preferredDayOfMonth || undefined
      );

      return {
        available,
        pending,
        inEscrow,
        total: available + pending + inEscrow,
        currency: stripeBalance.available[0]?.currency?.toUpperCase() || 'USD',
        nextPayoutDate,
        payoutSchedule: (payoutConfig?.schedule as PayoutSchedule) || 'WEEKLY',
      };
    } catch (error) {
      logger.error({ freelancerId, error }, 'Failed to get freelancer balance');
      throw error;
    }
  }

  /**
   * Update freelancer payout configuration
   */
  async updatePayoutConfig(freelancerId: string, config: Partial<PayoutConfig>): Promise<void> {
    await prisma.payoutConfig.upsert({
      where: { userId: freelancerId },
      update: {
        schedule: config.schedule,
        minimumAmount: config.minimumAmount,
        preferredDayOfWeek: config.preferredDayOfWeek,
        preferredDayOfMonth: config.preferredDayOfMonth,
        updatedAt: new Date(),
      },
      create: {
        userId: freelancerId,
        schedule: config.schedule || 'WEEKLY',
        minimumAmount: config.minimumAmount || DEFAULT_MINIMUM_PAYOUT,
        preferredDayOfWeek: config.preferredDayOfWeek,
        preferredDayOfMonth: config.preferredDayOfMonth,
      },
    });

    logger.info({ freelancerId, config }, 'Payout config updated');
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(freelancerId: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: { userId: freelancerId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payout.count({
        where: { userId: freelancerId },
      }),
    ]);

    return {
      payouts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retry failed payouts
   */
  async retryFailedPayouts(): Promise<void> {
    logger.info('Retrying failed payouts');

    // Find payouts that failed within the last 7 days and haven't exceeded retry limit
    const failedPayouts = await prisma.payout.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: 3 },
        createdAt: { gte: subDays(new Date(), 7) },
      },
      include: {
        user: {
          include: {
            stripeConnectedAccount: true,
          },
        },
      },
    });

    logger.info({ count: failedPayouts.length }, 'Found failed payouts to retry');

    for (const payout of failedPayouts) {
      try {
        const result = await this.requestPayout({
          freelancerId: payout.userId,
          amount: payout.amount,
          description: `Retry: ${payout.description || 'Earnings payout'}`,
        });

        if (result.success) {
          // Mark original payout as superseded
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: 'SUPERSEDED',
              supersededBy: result.payoutId,
            },
          });

          logger.info(
            { originalPayoutId: payout.id, newPayoutId: result.payoutId },
            'Payout retry succeeded'
          );
        } else {
          // Increment retry count
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              retryCount: payout.retryCount + 1,
              lastRetryAt: new Date(),
              lastRetryError: result.error,
            },
          });

          logger.warn({ payoutId: payout.id, error: result.error }, 'Payout retry failed');
        }
      } catch (error) {
        logger.error({ payoutId: payout.id, error }, 'Error retrying payout');
      }

      // Delay between retries
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async getEligibleFreelancers(dayOfWeek: number, dayOfMonth: number) {
    // Get freelancers based on their payout schedule
    return prisma.user.findMany({
      where: {
        role: 'FREELANCER',
        stripeConnectedAccount: {
          status: 'ACTIVE',
        },
        payoutConfig: {
          OR: [
            { schedule: 'DAILY' },
            { schedule: 'WEEKLY', preferredDayOfWeek: dayOfWeek },
            // Biweekly: 1st and 15th of the month
            { schedule: 'BIWEEKLY', preferredDayOfMonth: { in: [1, 15] } },
            { schedule: 'MONTHLY', preferredDayOfMonth: dayOfMonth },
          ],
        },
      },
      include: {
        stripeConnectedAccount: true,
        payoutConfig: true,
      },
    });
  }

  private async processFreelancerPayout(
    freelancer: Awaited<ReturnType<typeof prisma.user.findUnique>> & {
      stripeConnectedAccount: { stripeAccountId: string } | null;
      payoutConfig: { minimumAmount: number | null } | null;
    }
  ): Promise<PayoutResult> {
    if (!freelancer) {
      return { success: false, amount: 0, fee: 0, netAmount: 0, error: 'Freelancer not found' };
    }

    return this.requestPayout({
      freelancerId: freelancer.id,
      priority: 'STANDARD',
    });
  }

  private calculateNextPayoutDate(
    schedule?: PayoutSchedule,
    preferredDayOfWeek?: number,
    preferredDayOfMonth?: number
  ): Date | undefined {
    if (!schedule || schedule === 'MANUAL') {
      return undefined;
    }

    const today = new Date();
    const currentDayOfWeek = getDay(today);
    const currentDayOfMonth = getDate(today);

    switch (schedule) {
      case 'DAILY':
        return addDays(today, 1);

      case 'WEEKLY': {
        const targetDay = preferredDayOfWeek ?? 5; // Default to Friday
        let daysUntilPayout = targetDay - currentDayOfWeek;
        if (daysUntilPayout <= 0) daysUntilPayout += 7;
        return addDays(today, daysUntilPayout);
      }

      case 'BIWEEKLY': {
        if (currentDayOfMonth < 15) {
          const target = new Date(today);
          target.setDate(15);
          return target;
        }
        const target = new Date(today);
        target.setMonth(target.getMonth() + 1);
        target.setDate(1);
        return target;
      }

      case 'MONTHLY': {
        const targetDay = preferredDayOfMonth ?? 1;
        const target = new Date(today);
        if (currentDayOfMonth >= targetDay) {
          target.setMonth(target.getMonth() + 1);
        }
        target.setDate(Math.min(targetDay, 28)); // Avoid invalid dates
        return target;
      }

      default:
        return undefined;
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let payoutScheduler: PayoutScheduler | null = null;

export function getPayoutScheduler(): PayoutScheduler {
  if (!payoutScheduler) {
    payoutScheduler = new PayoutScheduler();
  }
  return payoutScheduler;
}

// =============================================================================
// CRON JOBS
// =============================================================================

/**
 * Process daily scheduled payouts (run at 6 AM UTC)
 */
export async function runScheduledPayouts(): Promise<void> {
  const scheduler = getPayoutScheduler();
  await scheduler.processScheduledPayouts();
}

/**
 * Retry failed payouts (run at 12 PM UTC)
 */
export async function runPayoutRetries(): Promise<void> {
  const scheduler = getPayoutScheduler();
  await scheduler.retryFailedPayouts();
}

