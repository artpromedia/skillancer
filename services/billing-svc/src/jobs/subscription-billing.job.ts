/**
 * @module @skillancer/billing-svc/jobs/subscription-billing
 * Subscription billing background jobs
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';

import { getConfig } from '../config/index.js';
import { BILLING_CONFIG, calculateOverageCost } from '../config/plans.js';
import { getStripeService } from '../services/stripe.service.js';
import { getSubscriptionService } from '../services/subscription.service.js';
import { billingNotifications } from '../services/billing-notifications.js';

import type { ProductType } from '../config/plans.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const config = getConfig();
const QUEUE_NAME = 'billing-jobs';

// Job names
export const JOB_NAMES = {
  PAYMENT_RETRY: 'subscription:payment-retry',
  USAGE_AGGREGATION: 'subscription:usage-aggregation',
  TRIAL_ENDING: 'subscription:trial-ending',
  SUBSCRIPTION_EXPIRING: 'subscription:expiring',
  INVOICE_GENERATION: 'subscription:invoice-generation',
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface PaymentRetryJobData {
  subscriptionId: string;
  invoiceId: string;
  attemptNumber: number;
}

interface UsageAggregationJobData {
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
}

interface TrialEndingJobData {
  subscriptionId: string;
  trialEndsAt: string;
  userId: string;
}

interface SubscriptionExpiringJobData {
  subscriptionId: string;
  expiresAt: string;
  userId: string;
}

// =============================================================================
// QUEUE SETUP
// =============================================================================

let billingQueue: Queue | null = null;
let billingWorker: Worker | null = null;
let redisConnection: Redis | null = null;

/**
 * Initialize the billing jobs queue and worker
 */
export function initializeBillingJobs(): void {
  if (billingQueue) return;

  // Create Redis connection
  const redisOptions: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: null;
  } = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
  };
  if (config.redis.password) {
    redisOptions.password = config.redis.password;
  }
  redisConnection = new Redis(redisOptions);

  // Create queue
  billingQueue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  // Create worker
  billingWorker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      logger.info({ jobName: job.name, jobId: job.id }, 'Processing billing job');

      switch (job.name) {
        case JOB_NAMES.PAYMENT_RETRY:
          return processPaymentRetry(job.data as PaymentRetryJobData);

        case JOB_NAMES.USAGE_AGGREGATION:
          return processUsageAggregation(job.data as UsageAggregationJobData);

        case JOB_NAMES.TRIAL_ENDING:
          return processTrialEnding(job.data as TrialEndingJobData);

        case JOB_NAMES.SUBSCRIPTION_EXPIRING:
          return processSubscriptionExpiring(job.data as SubscriptionExpiringJobData);

        default:
          logger.warn({ jobName: job.name }, 'Unknown billing job type');
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  // Worker error handling
  billingWorker.on('completed', (job) => {
    logger.info({ jobName: job.name, jobId: job.id }, 'Billing job completed');
  });

  billingWorker.on('failed', (job, error) => {
    logger.error({ jobName: job?.name, jobId: job?.id, error: error.message }, 'Billing job failed');
  });

  logger.info({ queue: QUEUE_NAME }, 'Billing jobs queue and worker initialized');
}

/**
 * Close billing jobs queue and worker
 */
export async function closeBillingJobs(): Promise<void> {
  if (billingWorker) {
    await billingWorker.close();
    billingWorker = null;
  }

  if (billingQueue) {
    await billingQueue.close();
    billingQueue = null;
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }

  logger.info('Billing jobs queue and worker closed');
}

// =============================================================================
// JOB SCHEDULING
// =============================================================================

/**
 * Schedule a payment retry job
 */
export async function schedulePaymentRetry(
  subscriptionId: string,
  invoiceId: string,
  attemptNumber: number
): Promise<void> {
  if (!billingQueue) {
    throw new Error('Billing queue not initialized');
  }

  // Get delay based on retry schedule
  const retryDays = BILLING_CONFIG.paymentRetryDays[attemptNumber - 1];
  if (!retryDays) {
    logger.info({ subscriptionId }, 'No more retries for subscription');
    return;
  }

  const delayMs = retryDays * 24 * 60 * 60 * 1000;

  await billingQueue.add(
    JOB_NAMES.PAYMENT_RETRY,
    {
      subscriptionId,
      invoiceId,
      attemptNumber,
    } satisfies PaymentRetryJobData,
    {
      delay: delayMs,
      jobId: `payment-retry-${invoiceId}-${attemptNumber}`,
    }
  );

  logger.info({ subscriptionId, invoiceId, attemptNumber, retryInDays: retryDays }, 'Scheduled payment retry');
}

/**
 * Schedule usage aggregation at end of billing period
 */
export async function scheduleUsageAggregation(
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  if (!billingQueue) {
    throw new Error('Billing queue not initialized');
  }

  // Schedule for a few hours after period end to ensure all usage is recorded
  const scheduledTime = new Date(periodEnd.getTime() + 4 * 60 * 60 * 1000);
  const delay = Math.max(0, scheduledTime.getTime() - Date.now());

  await billingQueue.add(
    JOB_NAMES.USAGE_AGGREGATION,
    {
      subscriptionId,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    } satisfies UsageAggregationJobData,
    {
      delay,
      jobId: `usage-agg-${subscriptionId}-${periodEnd.toISOString()}`,
    }
  );

  logger.info({ subscriptionId, scheduledTime: scheduledTime.toISOString() }, 'Scheduled usage aggregation');
}

/**
 * Schedule trial ending reminder
 */
export async function scheduleTrialEndingReminder(
  subscriptionId: string,
  userId: string,
  trialEndsAt: Date
): Promise<void> {
  if (!billingQueue) {
    throw new Error('Billing queue not initialized');
  }

  // Send reminder 3 days before trial ends
  const reminderTime = new Date(trialEndsAt.getTime() - 3 * 24 * 60 * 60 * 1000);
  const delay = Math.max(0, reminderTime.getTime() - Date.now());

  await billingQueue.add(
    JOB_NAMES.TRIAL_ENDING,
    {
      subscriptionId,
      userId,
      trialEndsAt: trialEndsAt.toISOString(),
    } satisfies TrialEndingJobData,
    {
      delay,
      jobId: `trial-ending-${subscriptionId}`,
    }
  );

  logger.info({ subscriptionId }, 'Scheduled trial ending reminder');
}

// =============================================================================
// RECURRING JOB SCHEDULES
// =============================================================================

/**
 * Schedule daily billing maintenance jobs
 */
export async function scheduleDailyBillingJobs(): Promise<void> {
  if (!billingQueue) {
    throw new Error('Billing queue not initialized');
  }

  // Check for subscriptions with trials ending soon
  await checkTrialsEndingSoon();

  // Check for expiring subscriptions
  await checkExpiringSoonSubscriptions();

  logger.info('Daily billing jobs scheduled');
}

/**
 * Check and notify about trials ending soon
 */
async function checkTrialsEndingSoon(): Promise<void> {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const trialsEndingSoon = await prisma.subscription.findMany({
    where: {
      status: 'TRIALING',
      trialEndsAt: {
        lte: threeDaysFromNow,
        gte: new Date(),
      },
    },
    select: {
      id: true,
      userId: true,
      trialEndsAt: true,
    },
  });

  for (const subscription of trialsEndingSoon) {
    if (subscription.trialEndsAt) {
      await scheduleTrialEndingReminder(
        subscription.id,
        subscription.userId,
        subscription.trialEndsAt
      );
    }
  }

  logger.info({ count: trialsEndingSoon.length }, 'Found trials ending soon');
}

/**
 * Check for subscriptions expiring soon (after cancellation)
 */
async function checkExpiringSoonSubscriptions(): Promise<void> {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const expiringSoon = await prisma.subscription.findMany({
    where: {
      cancelAt: {
        lte: threeDaysFromNow,
        gte: new Date(),
      },
      endedAt: null,
    },
    select: {
      id: true,
      userId: true,
      cancelAt: true,
    },
  });

  for (const subscription of expiringSoon) {
    if (subscription.cancelAt) {
      await sendSubscriptionExpiringNotification(
        subscription.userId,
        subscription.id,
        subscription.cancelAt
      );
    }
  }

  logger.info({ count: expiringSoon.length }, 'Found subscriptions expiring soon');
}

// =============================================================================
// JOB PROCESSORS
// =============================================================================

/**
 * Process payment retry job
 */
async function processPaymentRetry(data: PaymentRetryJobData): Promise<void> {
  const { subscriptionId, invoiceId, attemptNumber } = data;
  const stripeService = getStripeService();

  logger.info({ invoiceId, attemptNumber }, 'Processing payment retry');

  try {
    // Get the invoice from Stripe
    const invoice = await stripeService.getInvoice(invoiceId);

    // If already paid, we're done
    if (invoice.status === 'paid') {
      logger.info({ invoiceId }, 'Invoice already paid');
      return;
    }

    // If voided or uncollectible, don't retry
    if (invoice.status === 'void' || invoice.status === 'uncollectible') {
      logger.info({ invoiceId, status: invoice.status }, 'Invoice voided/uncollectible, skipping retry');
      return;
    }

    // Attempt to pay the invoice
    await stripeService.payInvoice(invoiceId);
    logger.info({ invoiceId }, 'Successfully paid invoice');
  } catch (error) {
    logger.error({ invoiceId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to pay invoice');

    // Schedule next retry if available
    const nextAttempt = attemptNumber + 1;
    if (nextAttempt <= BILLING_CONFIG.paymentRetryDays.length) {
      await schedulePaymentRetry(subscriptionId, invoiceId, nextAttempt);
    } else {
      // All retries exhausted - subscription will be canceled by Stripe
      logger.info({ invoiceId }, 'All retries exhausted for invoice');
      await sendPaymentRetriesExhaustedNotification(subscriptionId, invoiceId);
    }
  }
}

/**
 * Process usage aggregation job
 */
async function processUsageAggregation(data: UsageAggregationJobData): Promise<void> {
  const { subscriptionId, periodStart, periodEnd: _periodEnd } = data;
  const subscriptionService = getSubscriptionService();

  logger.info({ subscriptionId }, 'Processing usage aggregation');

  try {
    // Get usage summary
    const usage = await subscriptionService.getUsage(subscriptionId, new Date(periodStart));

    // Get subscription to check for overage
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      logger.info({ subscriptionId }, 'Subscription not found');
      return;
    }

    // Check for overage
    if (usage.overageMinutes > 0) {
      logger.info({ subscriptionId, overageMinutes: usage.overageMinutes }, 'Subscription has overage minutes');

      // Calculate overage cost
      const overageCost = calculateOverageCost(
        subscription.product as ProductType,
        usage.overageMinutes
      );

      if (overageCost > 0) {
        // Create usage record for billing
        // The actual overage charge will be handled by Stripe's metered billing
        logger.info({ subscriptionId, overageCost: `$${(overageCost / 100).toFixed(2)}` }, 'Overage cost calculated');

        // Send overage notification
        await sendOverageNotification(
          subscription.userId,
          subscriptionId,
          usage.overageMinutes,
          overageCost
        );
      }
    }

    logger.info({ subscriptionId }, 'Usage aggregation completed');
  } catch (error) {
    logger.error({ subscriptionId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed usage aggregation');
    throw error; // Will trigger retry
  }
}

/**
 * Process trial ending notification
 */
async function processTrialEnding(data: TrialEndingJobData): Promise<void> {
  const { subscriptionId, userId, trialEndsAt } = data;

  logger.info({ subscriptionId }, 'Processing trial ending');

  // Check if subscription still in trial
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: { select: { email: true, firstName: true } } },
  });

  if (!subscription || subscription.status !== 'TRIALING') {
    logger.info({ subscriptionId }, 'Subscription no longer in trial');
    return;
  }

  // Check if they have a payment method
  const hasPaymentMethod =
    (await prisma.paymentMethod.count({
      where: { userId, status: 'ACTIVE' },
    })) > 0;

  await sendTrialEndingSoonNotification(
    subscription.user.email,
    subscription.user.firstName,
    subscription.plan,
    new Date(trialEndsAt),
    hasPaymentMethod
  );

  logger.info({ subscriptionId }, 'Trial ending notification sent');
}

/**
 * Process subscription expiring notification
 */
function processSubscriptionExpiring(data: SubscriptionExpiringJobData): void {
  const { subscriptionId, userId, expiresAt } = data;

  logger.info({ subscriptionId }, 'Processing subscription expiring');

  sendSubscriptionExpiringNotification(userId, subscriptionId, new Date(expiresAt));
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

async function sendPaymentRetriesExhaustedNotification(
  subscriptionId: string,
  invoiceId: string
): Promise<void> {
  logger.info({ subscriptionId, invoiceId }, 'Sending payment retries exhausted notification');

  // Get subscription details
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { userId: true },
  });

  if (subscription) {
    await billingNotifications.notifyPaymentFailed(
      { userId: subscription.userId },
      {
        amount: 'subscription',
        reason:
          'All payment attempts have failed. Your subscription will be suspended. Please update your payment method.',
      }
    );

    // Alert ops team
    await billingNotifications.alertOpsTeam({
      severity: 'high',
      title: 'Payment Retries Exhausted',
      message: `Subscription ${subscriptionId} - all payment retries exhausted`,
      context: { subscriptionId, invoiceId },
    });
  }
}

async function sendOverageNotification(
  userId: string,
  subscriptionId: string,
  overageMinutes: number,
  overageCost: number
): Promise<void> {
  logger.info({ userId, subscriptionId, overageMinutes, overageCost: `$${(overageCost / 100).toFixed(2)}` }, 'Sending overage notification');

  await billingNotifications.notifyPaymentReceived(
    { userId },
    {
      amount: `$${(overageCost / 100).toFixed(2)}`,
      description: `Usage overage charge for ${overageMinutes} additional minutes`,
    }
  );
}

async function sendTrialEndingSoonNotification(
  email: string,
  firstName: string,
  plan: string,
  trialEndsAt: Date,
  hasPaymentMethod: boolean
): Promise<void> {
  logger.info({ email, plan, trialEndsAt: trialEndsAt.toISOString(), hasPaymentMethod }, 'Sending trial ending soon notification');

  // Get user ID from email
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });

  if (user) {
    const message = hasPaymentMethod
      ? `Your ${plan} trial ends on ${trialEndsAt.toLocaleDateString()}. Your subscription will automatically continue.`
      : `Your ${plan} trial ends on ${trialEndsAt.toLocaleDateString()}. Please add a payment method to continue using the service.`;

    await billingNotifications.notifyPaymentFailed(
      { userId: user.id, email },
      {
        amount: plan,
        reason: message,
      }
    );
  }
}

async function sendSubscriptionExpiringNotification(
  userId: string,
  subscriptionId: string,
  expiresAt: Date
): Promise<void> {
  logger.info({ userId, subscriptionId, expiresAt: expiresAt.toISOString() }, 'Sending subscription expiring notification');

  await billingNotifications.notifyPaymentFailed(
    { userId },
    {
      amount: 'subscription',
      reason: `Your subscription will expire on ${expiresAt.toLocaleDateString()}. Reactivate to keep your access.`,
    }
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export function getBillingQueue(): Queue {
  if (!billingQueue) {
    throw new Error('Billing queue not initialized');
  }
  return billingQueue;
}
