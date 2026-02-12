// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/retry-manager
 * Intelligent Payment Retry Manager
 *
 * Features:
 * - Smart retry scheduling based on failure type
 * - Exponential backoff with jitter
 * - Day/time optimization (avoid weekends, nights)
 * - Payment method rotation
 * - Maximum retry limits
 * - Customer notification integration
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { addHours, addDays, setHours, isWeekend, isBefore, addMinutes } from 'date-fns';

import { getPaymentOrchestrator, PaymentState } from './payment-orchestrator.js';
import { getStripe } from './stripe.service.js';
import { billingNotifications } from './billing-notifications.js';

// =============================================================================
// TYPES
// =============================================================================

export type FailureCategory =
  | 'card_declined_generic'
  | 'insufficient_funds'
  | 'card_expired'
  | 'incorrect_cvc'
  | 'processing_error'
  | 'network_error'
  | 'fraud_suspected'
  | 'authentication_required'
  | 'card_not_supported'
  | 'currency_not_supported'
  | 'rate_limit'
  | 'unknown';

export interface RetryStrategy {
  category: FailureCategory;
  shouldRetry: boolean;
  maxAttempts: number;
  intervals: number[]; // Hours between retries
  optimizeForPayday: boolean;
  requiresCardUpdate: boolean;
  notifyCustomer: boolean;
  notifyAdmin: boolean;
}

export interface RetrySchedule {
  paymentId: string;
  attempt: number;
  scheduledFor: Date;
  strategy: RetryStrategy;
  failureCode: string;
}

export interface RetryResult {
  success: boolean;
  attempt: number;
  nextRetryAt?: Date;
  finalFailure: boolean;
  reason: string;
}

// =============================================================================
// RETRY STRATEGIES
// =============================================================================

const RETRY_STRATEGIES: Record<FailureCategory, RetryStrategy> = {
  insufficient_funds: {
    category: 'insufficient_funds',
    shouldRetry: true,
    maxAttempts: 4,
    intervals: [24, 72, 120, 168], // 1 day, 3 days, 5 days, 7 days
    optimizeForPayday: true,
    requiresCardUpdate: false,
    notifyCustomer: true,
    notifyAdmin: false,
  },
  card_declined_generic: {
    category: 'card_declined_generic',
    shouldRetry: true,
    maxAttempts: 3,
    intervals: [1, 24, 72],
    optimizeForPayday: false,
    requiresCardUpdate: false,
    notifyCustomer: true,
    notifyAdmin: false,
  },
  processing_error: {
    category: 'processing_error',
    shouldRetry: true,
    maxAttempts: 5,
    intervals: [0.5, 1, 4, 24, 48], // 30 min, 1h, 4h, 1d, 2d
    optimizeForPayday: false,
    requiresCardUpdate: false,
    notifyCustomer: false,
    notifyAdmin: true,
  },
  network_error: {
    category: 'network_error',
    shouldRetry: true,
    maxAttempts: 5,
    intervals: [0.25, 0.5, 1, 2, 4], // 15min, 30min, 1h, 2h, 4h
    optimizeForPayday: false,
    requiresCardUpdate: false,
    notifyCustomer: false,
    notifyAdmin: true,
  },
  rate_limit: {
    category: 'rate_limit',
    shouldRetry: true,
    maxAttempts: 3,
    intervals: [1, 2, 4],
    optimizeForPayday: false,
    requiresCardUpdate: false,
    notifyCustomer: false,
    notifyAdmin: true,
  },
  authentication_required: {
    category: 'authentication_required',
    shouldRetry: false, // Requires user action
    maxAttempts: 0,
    intervals: [],
    optimizeForPayday: false,
    requiresCardUpdate: false,
    notifyCustomer: true,
    notifyAdmin: false,
  },
  card_expired: {
    category: 'card_expired',
    shouldRetry: false, // Requires card update
    maxAttempts: 0,
    intervals: [],
    optimizeForPayday: false,
    requiresCardUpdate: true,
    notifyCustomer: true,
    notifyAdmin: false,
  },
  incorrect_cvc: {
    category: 'incorrect_cvc',
    shouldRetry: false, // Requires user correction
    maxAttempts: 0,
    intervals: [],
    optimizeForPayday: false,
    requiresCardUpdate: true,
    notifyCustomer: true,
    notifyAdmin: false,
  },
  fraud_suspected: {
    category: 'fraud_suspected',
    shouldRetry: false, // NEVER retry fraud
    maxAttempts: 0,
    intervals: [],
    optimizeForPayday: false,
    requiresCardUpdate: false,
    notifyCustomer: false,
    notifyAdmin: true,
  },
  card_not_supported: {
    category: 'card_not_supported',
    shouldRetry: false,
    maxAttempts: 0,
    intervals: [],
    optimizeForPayday: false,
    requiresCardUpdate: true,
    notifyCustomer: true,
    notifyAdmin: false,
  },
  currency_not_supported: {
    category: 'currency_not_supported',
    shouldRetry: false,
    maxAttempts: 0,
    intervals: [],
    optimizeForPayday: false,
    requiresCardUpdate: false,
    notifyCustomer: true,
    notifyAdmin: true,
  },
  unknown: {
    category: 'unknown',
    shouldRetry: true,
    maxAttempts: 2,
    intervals: [24, 72],
    optimizeForPayday: false,
    requiresCardUpdate: false,
    notifyCustomer: true,
    notifyAdmin: true,
  },
};

// =============================================================================
// RETRY MANAGER CLASS
// =============================================================================

export class RetryManager {
  private stripe = getStripe();
  private orchestrator = getPaymentOrchestrator();

  /**
   * Schedule a retry for a failed payment
   */
  async scheduleRetry(paymentId: string, failureCode: string): Promise<RetrySchedule | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        retryAttempts: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!payment) {
      logger.warn({ paymentId }, 'Cannot schedule retry - payment not found');
      return null;
    }

    const category = this.categorizeFailure(failureCode);
    const strategy = RETRY_STRATEGIES[category];

    if (!strategy.shouldRetry) {
      logger.info(
        {
          paymentId,
          failureCode,
          category,
          reason: 'Strategy does not allow retry',
        },
        'Retry not scheduled'
      );

      await this.handleNonRetryableFailure(payment, strategy);
      return null;
    }

    const currentAttempt = payment.retryAttempts[0]?.attemptNumber || 0;
    const nextAttempt = currentAttempt + 1;

    if (nextAttempt > strategy.maxAttempts) {
      logger.info(
        {
          paymentId,
          currentAttempt,
          maxAttempts: strategy.maxAttempts,
        },
        'Max retry attempts reached'
      );

      await this.markPaymentAbandoned(paymentId, 'max_retries_exceeded');
      return null;
    }

    const scheduledFor = this.calculateNextRetryTime(nextAttempt, strategy);

    // Create retry attempt record
    await prisma.paymentRetryAttempt.create({
      data: {
        paymentId,
        attemptNumber: nextAttempt,
        scheduledFor,
        failureCode,
        failureCategory: category,
        status: 'SCHEDULED',
      },
    });

    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'RETRYING',
        nextRetryAt: scheduledFor,
        retryCount: nextAttempt,
      },
    });

    const schedule: RetrySchedule = {
      paymentId,
      attempt: nextAttempt,
      scheduledFor,
      strategy,
      failureCode,
    };

    logger.info(
      {
        paymentId,
        attempt: nextAttempt,
        scheduledFor,
        category,
      },
      'Retry scheduled'
    );

    // Send notification if needed
    if (strategy.notifyCustomer) {
      await this.notifyCustomerOfRetry(payment, schedule);
    }

    return schedule;
  }

  /**
   * Execute a scheduled retry
   */
  async executeRetry(paymentId: string): Promise<RetryResult> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        retryAttempts: {
          where: { status: 'SCHEDULED' },
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!payment) {
      return {
        success: false,
        attempt: 0,
        finalFailure: true,
        reason: 'Payment not found',
      };
    }

    const retryAttempt = payment.retryAttempts[0];
    if (!retryAttempt) {
      return {
        success: false,
        attempt: 0,
        finalFailure: false,
        reason: 'No scheduled retry found',
      };
    }

    logger.info(
      {
        paymentId,
        attempt: retryAttempt.attemptNumber,
        stripePaymentIntentId: payment.stripePaymentIntentId,
      },
      'Executing payment retry'
    );

    // Mark attempt as in progress
    await prisma.paymentRetryAttempt.update({
      where: { id: retryAttempt.id },
      data: { status: 'IN_PROGRESS', executedAt: new Date() },
    });

    try {
      // Try to confirm the payment again
      if (!payment.stripePaymentIntentId) {
        throw new Error('No Stripe PaymentIntent ID');
      }

      // Check if we should try a different payment method
      const alternativePaymentMethod = await this.findAlternativePaymentMethod(
        payment.stripeCustomerId
      );

      const confirmParams: Record<string, unknown> = {};
      if (alternativePaymentMethod) {
        confirmParams.payment_method = alternativePaymentMethod;
        logger.info(
          {
            paymentId,
            alternativePaymentMethod,
          },
          'Trying alternative payment method'
        );
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        payment.stripePaymentIntentId,
        confirmParams
      );

      const isSuccess = paymentIntent.status === 'succeeded';

      // Update retry attempt
      await prisma.paymentRetryAttempt.update({
        where: { id: retryAttempt.id },
        data: {
          status: isSuccess ? 'SUCCEEDED' : 'FAILED',
          responseCode: isSuccess ? 'succeeded' : paymentIntent.status,
        },
      });

      if (isSuccess) {
        // Update payment to succeeded
        await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: 'SUCCEEDED',
            paidAt: new Date(),
            nextRetryAt: null,
          },
        });

        logger.info({ paymentId, attempt: retryAttempt.attemptNumber }, 'Retry succeeded');

        return {
          success: true,
          attempt: retryAttempt.attemptNumber,
          finalFailure: false,
          reason: 'Payment succeeded on retry',
        };
      }

      // Retry failed - schedule next attempt
      const nextSchedule = await this.scheduleRetry(
        paymentId,
        paymentIntent.last_payment_error?.code || 'unknown'
      );

      return {
        success: false,
        attempt: retryAttempt.attemptNumber,
        nextRetryAt: nextSchedule?.scheduledFor,
        finalFailure: !nextSchedule,
        reason: paymentIntent.last_payment_error?.message || 'Payment failed',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.paymentRetryAttempt.update({
        where: { id: retryAttempt.id },
        data: {
          status: 'FAILED',
          responseCode: 'error',
          responseMessage: errorMessage,
        },
      });

      logger.error({ paymentId, error: errorMessage }, 'Retry execution failed');

      // Try to schedule another retry
      const nextSchedule = await this.scheduleRetry(paymentId, 'processing_error');

      return {
        success: false,
        attempt: retryAttempt.attemptNumber,
        nextRetryAt: nextSchedule?.scheduledFor,
        finalFailure: !nextSchedule,
        reason: errorMessage,
      };
    }
  }

  /**
   * Get pending retries that should be executed
   */
  async getPendingRetries(limit = 100): Promise<Array<{ paymentId: string; attemptId: string }>> {
    const pendingAttempts = await prisma.paymentRetryAttempt.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: {
          lte: new Date(),
        },
      },
      orderBy: { scheduledFor: 'asc' },
      take: limit,
      select: {
        id: true,
        paymentId: true,
      },
    });

    return pendingAttempts.map((a) => ({
      paymentId: a.paymentId,
      attemptId: a.id,
    }));
  }

  /**
   * Cancel all pending retries for a payment
   */
  async cancelPendingRetries(paymentId: string, reason: string): Promise<void> {
    await prisma.paymentRetryAttempt.updateMany({
      where: {
        paymentId,
        status: 'SCHEDULED',
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        nextRetryAt: null,
      },
    });

    logger.info({ paymentId, reason }, 'Pending retries cancelled');
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private categorizeFailure(failureCode: string): FailureCategory {
    const codeMapping: Record<string, FailureCategory> = {
      // Insufficient funds
      insufficient_funds: 'insufficient_funds',
      generic_decline: 'card_declined_generic',

      // Card issues
      card_declined: 'card_declined_generic',
      expired_card: 'card_expired',
      incorrect_cvc: 'incorrect_cvc',
      invalid_cvc: 'incorrect_cvc',
      processing_error: 'processing_error',
      card_not_supported: 'card_not_supported',
      currency_not_supported: 'currency_not_supported',

      // Authentication
      authentication_required: 'authentication_required',
      three_d_secure_required: 'authentication_required',

      // Fraud
      fraudulent: 'fraud_suspected',
      stolen_card: 'fraud_suspected',
      lost_card: 'fraud_suspected',

      // Network/rate
      rate_limit: 'rate_limit',
      api_connection_error: 'network_error',
    };

    return codeMapping[failureCode] || 'unknown';
  }

  private calculateNextRetryTime(attempt: number, strategy: RetryStrategy): Date {
    const intervalIndex = Math.min(attempt - 1, strategy.intervals.length - 1);
    const baseInterval = strategy.intervals[intervalIndex];

    // Add jitter (±10%)
    const jitter = baseInterval * 0.1 * (Math.random() * 2 - 1);
    const hours = baseInterval + jitter;

    let nextRetry = addHours(new Date(), hours);

    // Optimize for payday if applicable
    if (strategy.optimizeForPayday) {
      nextRetry = this.optimizeForPayday(nextRetry);
    }

    // Avoid weekends for larger amounts (more likely to need human intervention)
    if (isWeekend(nextRetry)) {
      nextRetry = this.moveToWeekday(nextRetry);
    }

    // Optimize for business hours (9 AM - 6 PM)
    nextRetry = this.optimizeForBusinessHours(nextRetry);

    return nextRetry;
  }

  private optimizeForPayday(date: Date): Date {
    // Common paydays: 1st, 15th, and last day of month
    const dayOfMonth = date.getDate();

    // If we're close to a common payday, push to after that payday
    if (dayOfMonth >= 28 || dayOfMonth <= 3) {
      // Near month end/start - wait until 3rd
      const target = new Date(date);
      if (dayOfMonth >= 28) {
        target.setMonth(target.getMonth() + 1);
      }
      target.setDate(3);
      if (isBefore(date, target)) {
        return target;
      }
    } else if (dayOfMonth >= 12 && dayOfMonth <= 17) {
      // Near mid-month payday - wait until 17th
      const target = new Date(date);
      target.setDate(17);
      if (isBefore(date, target)) {
        return target;
      }
    }

    return date;
  }

  private moveToWeekday(date: Date): Date {
    const day = date.getDay();
    if (day === 0) {
      // Sunday - move to Monday
      return addDays(date, 1);
    } else if (day === 6) {
      // Saturday - move to Monday
      return addDays(date, 2);
    }
    return date;
  }

  private optimizeForBusinessHours(date: Date): Date {
    const hour = date.getHours();

    // If outside 9 AM - 6 PM, move to 10 AM
    if (hour < 9 || hour >= 18) {
      const result = setHours(date, 10);
      if (hour >= 18) {
        return addDays(result, 1);
      }
      return result;
    }

    return date;
  }

  private async findAlternativePaymentMethod(stripeCustomerId: string): Promise<string | null> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });

      // Find a different card that hasn't been tried recently
      const recentAttempts = await prisma.paymentRetryAttempt.findMany({
        where: {
          payment: { stripeCustomerId },
          status: 'FAILED',
          executedAt: {
            gte: addDays(new Date(), -7),
          },
        },
        select: { paymentMethodUsed: true },
      });

      const recentlyUsedMethods = new Set(
        recentAttempts.map((a) => a.paymentMethodUsed).filter(Boolean)
      );

      for (const pm of paymentMethods.data) {
        if (!recentlyUsedMethods.has(pm.id)) {
          return pm.id;
        }
      }

      return null;
    } catch (error) {
      logger.error({ stripeCustomerId, error }, 'Failed to find alternative payment method');
      return null;
    }
  }

  private async handleNonRetryableFailure(
    payment: Record<string, unknown>,
    strategy: RetryStrategy
  ): Promise<void> {
    // Mark payment as abandoned
    await this.markPaymentAbandoned(payment.id as string, `non_retryable_${strategy.category}`);

    // Trigger appropriate notifications
    if (strategy.notifyCustomer) {
      await this.notifyCustomerOfFailure(
        payment as { id: string; stripeCustomerId: string; amount: number; currency: string },
        strategy
      );
    }

    if (strategy.notifyAdmin) {
      await this.notifyAdminOfFailure(payment, strategy);
    }

    // If card update required, send card update request
    if (strategy.requiresCardUpdate) {
      await this.requestCardUpdate(payment.stripeCustomerId as string);
    }
  }

  private async markPaymentAbandoned(paymentId: string, reason: string): Promise<void> {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'ABANDONED',
        abandonedAt: new Date(),
        abandonedReason: reason,
        nextRetryAt: null,
      },
    });

    logger.info({ paymentId, reason }, 'Payment marked as abandoned');
  }

  private async notifyCustomerOfRetry(
    payment: Record<string, unknown>,
    schedule: RetrySchedule
  ): Promise<void> {
    logger.info(
      {
        paymentId: payment.id,
        customerId: payment.stripeCustomerId,
        nextRetryAt: schedule.scheduledFor,
      },
      'Notifying customer of retry schedule'
    );

    // Get user from payment
    const userId = payment.userId as string | undefined;
    if (!userId) {
      logger.warn({ paymentId: payment.id }, 'Cannot notify - no userId on payment');
      return;
    }

    const amount = payment.amount as number;
    const currency = payment.currency as string;
    const formattedAmount = `${(amount / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}`;

    await billingNotifications.notifyPaymentFailed(
      { userId },
      {
        amount: formattedAmount,
        reason: `Payment failed. We'll automatically retry on ${schedule.scheduledFor.toLocaleDateString()}. You can update your payment method to resolve this sooner.`,
      }
    );
  }

  private async notifyCustomerOfFailure(
    payment: {
      id: string;
      stripeCustomerId: string;
      amount: number;
      currency: string;
      userId?: string;
    },
    strategy: RetryStrategy
  ): Promise<void> {
    logger.info(
      {
        paymentId: payment.id,
        customerId: payment.stripeCustomerId,
        category: strategy.category,
      },
      'Notifying customer of final payment failure'
    );

    const userId = payment.userId;
    if (!userId) {
      logger.warn({ paymentId: payment.id }, 'Cannot notify - no userId on payment');
      return;
    }

    const formattedAmount = `${(payment.amount / 100).toFixed(2)} ${payment.currency?.toUpperCase() || 'USD'}`;
    const reasonMessages: Record<FailureCategory, string> = {
      insufficient_funds: 'Your payment method has insufficient funds.',
      card_declined_generic: 'Your card was declined by your bank.',
      card_expired: 'Your card has expired.',
      incorrect_cvc: 'The security code (CVC) was incorrect.',
      processing_error: 'There was a processing error. Please try again.',
      network_error: 'A network error occurred. Please try again.',
      fraud_suspected: 'The payment was flagged for security reasons.',
      authentication_required: 'Additional authentication is required.',
      card_not_supported: 'This card type is not supported.',
      currency_not_supported: 'This currency is not supported.',
      rate_limit: 'Too many payment attempts. Please try again later.',
      unknown: 'An unexpected error occurred.',
    };

    await billingNotifications.notifyPaymentFailed(
      { userId },
      {
        amount: formattedAmount,
        reason: `${reasonMessages[strategy.category]} Please update your payment method to continue.`,
      }
    );
  }

  private async notifyAdminOfFailure(
    payment: Record<string, unknown>,
    strategy: RetryStrategy
  ): Promise<void> {
    logger.warn(
      {
        paymentId: payment.id,
        customerId: payment.stripeCustomerId,
        category: strategy.category,
      },
      'Admin notification: Payment failure requiring attention'
    );

    // Alert ops team for non-retryable failures that require attention
    const severity = strategy.category === 'fraud_suspected' ? 'critical' : 'medium';
    await billingNotifications.alertOpsTeam({
      severity: severity as 'low' | 'medium' | 'high' | 'critical',
      title: `Payment Failure: ${strategy.category}`,
      message: `Payment ${payment.id} failed with non-retryable error.`,
      context: {
        paymentId: payment.id,
        stripeCustomerId: payment.stripeCustomerId,
        category: strategy.category,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
  }

  private async requestCardUpdate(stripeCustomerId: string): Promise<void> {
    logger.info({ stripeCustomerId }, 'Requesting card update from customer');

    // Look up user by Stripe customer ID to send notification
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { stripeCustomerId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (paymentMethod?.user) {
      await billingNotifications.notifyPaymentFailed(
        {
          userId: paymentMethod.user.id,
          email: paymentMethod.user.email,
        },
        {
          amount: 'N/A',
          reason:
            'Your payment method needs to be updated. Please add a new card to continue using Skillancer.',
        }
      );
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let retryManager: RetryManager | null = null;

export function getRetryManager(): RetryManager {
  if (!retryManager) {
    retryManager = new RetryManager();
  }
  return retryManager;
}

// =============================================================================
// BACKGROUND JOB: Process Pending Retries
// =============================================================================

export async function processScheduledRetries(): Promise<void> {
  const manager = getRetryManager();
  const pending = await manager.getPendingRetries(50);

  logger.info({ count: pending.length }, 'Processing scheduled retries');

  for (const { paymentId } of pending) {
    try {
      await manager.executeRetry(paymentId);

      // Small delay between retries to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      logger.error({ paymentId, error }, 'Error processing retry');
    }
  }
}
