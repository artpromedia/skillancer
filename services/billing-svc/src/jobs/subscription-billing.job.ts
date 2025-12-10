/**
 * @module @skillancer/billing-svc/jobs/subscription-billing
 * Subscription billing background jobs
 */

import { prisma } from '@skillancer/database';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';

import { getConfig } from '../config/index.js';
import { BILLING_CONFIG, calculateOverageCost } from '../config/plans.js';
import { getStripeService } from '../services/stripe.service.js';
import { getSubscriptionService } from '../services/subscription.service.js';

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
      console.log(`[Billing Job] Processing ${job.name}:`, job.id);

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
          console.log(`[Billing Job] Unknown job type: ${job.name}`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  // Worker error handling
  billingWorker.on('completed', (job) => {
    console.log(`[Billing Job] Completed ${job.name}:`, job.id);
  });

  billingWorker.on('failed', (job, error) => {
    console.error(`[Billing Job] Failed ${job?.name}:`, job?.id, error);
  });

  console.log('[Billing Jobs] Queue and worker initialized');
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

  console.log('[Billing Jobs] Queue and worker closed');
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
    console.log(`[Billing Job] No more retries for subscription ${subscriptionId}`);
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

  console.log(
    `[Billing Job] Scheduled payment retry ${attemptNumber} for ${invoiceId} in ${retryDays} days`
  );
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

  console.log(
    `[Billing Job] Scheduled usage aggregation for ${subscriptionId} at ${scheduledTime.toISOString()}`
  );
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

  console.log(`[Billing Job] Scheduled trial ending reminder for ${subscriptionId}`);
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

  console.log('[Billing Jobs] Daily billing jobs scheduled');
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

  console.log(`[Billing Jobs] Found ${trialsEndingSoon.length} trials ending soon`);
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
      sendSubscriptionExpiringNotification(
        subscription.userId,
        subscription.id,
        subscription.cancelAt
      );
    }
  }

  console.log(`[Billing Jobs] Found ${expiringSoon.length} subscriptions expiring soon`);
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

  console.log(`[Payment Retry] Processing retry ${attemptNumber} for invoice ${invoiceId}`);

  try {
    // Get the invoice from Stripe
    const invoice = await stripeService.getInvoice(invoiceId);

    // If already paid, we're done
    if (invoice.status === 'paid') {
      console.log(`[Payment Retry] Invoice ${invoiceId} already paid`);
      return;
    }

    // If voided or uncollectible, don't retry
    if (invoice.status === 'void' || invoice.status === 'uncollectible') {
      console.log(`[Payment Retry] Invoice ${invoiceId} is ${invoice.status}, skipping retry`);
      return;
    }

    // Attempt to pay the invoice
    await stripeService.payInvoice(invoiceId);
    console.log(`[Payment Retry] Successfully paid invoice ${invoiceId}`);
  } catch (error) {
    console.error(`[Payment Retry] Failed to pay invoice ${invoiceId}:`, error);

    // Schedule next retry if available
    const nextAttempt = attemptNumber + 1;
    if (nextAttempt <= BILLING_CONFIG.paymentRetryDays.length) {
      await schedulePaymentRetry(subscriptionId, invoiceId, nextAttempt);
    } else {
      // All retries exhausted - subscription will be canceled by Stripe
      console.log(`[Payment Retry] All retries exhausted for invoice ${invoiceId}`);
      sendPaymentRetriesExhaustedNotification(subscriptionId, invoiceId);
    }
  }
}

/**
 * Process usage aggregation job
 */
async function processUsageAggregation(data: UsageAggregationJobData): Promise<void> {
  const { subscriptionId, periodStart, periodEnd: _periodEnd } = data;
  const subscriptionService = getSubscriptionService();

  console.log(`[Usage Aggregation] Processing for subscription ${subscriptionId}`);

  try {
    // Get usage summary
    const usage = await subscriptionService.getUsage(subscriptionId, new Date(periodStart));

    // Get subscription to check for overage
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      console.log(`[Usage Aggregation] Subscription ${subscriptionId} not found`);
      return;
    }

    // Check for overage
    if (usage.overageMinutes > 0) {
      console.log(
        `[Usage Aggregation] Subscription ${subscriptionId} has ${usage.overageMinutes} overage minutes`
      );

      // Calculate overage cost
      const overageCost = calculateOverageCost(
        subscription.product as ProductType,
        usage.overageMinutes
      );

      if (overageCost > 0) {
        // Create usage record for billing
        // The actual overage charge will be handled by Stripe's metered billing
        console.log(`[Usage Aggregation] Overage cost: $${(overageCost / 100).toFixed(2)}`);

        // Send overage notification
        sendOverageNotification(
          subscription.userId,
          subscriptionId,
          usage.overageMinutes,
          overageCost
        );
      }
    }

    console.log(`[Usage Aggregation] Completed for subscription ${subscriptionId}`);
  } catch (error) {
    console.error(`[Usage Aggregation] Failed for subscription ${subscriptionId}:`, error);
    throw error; // Will trigger retry
  }
}

/**
 * Process trial ending notification
 */
async function processTrialEnding(data: TrialEndingJobData): Promise<void> {
  const { subscriptionId, userId, trialEndsAt } = data;

  console.log(`[Trial Ending] Processing for subscription ${subscriptionId}`);

  // Check if subscription still in trial
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { user: { select: { email: true, firstName: true } } },
  });

  if (!subscription || subscription.status !== 'TRIALING') {
    console.log(`[Trial Ending] Subscription ${subscriptionId} no longer in trial`);
    return;
  }

  // Check if they have a payment method
  const hasPaymentMethod =
    (await prisma.paymentMethod.count({
      where: { userId, status: 'ACTIVE' },
    })) > 0;

  sendTrialEndingSoonNotification(
    subscription.user.email,
    subscription.user.firstName,
    subscription.plan,
    new Date(trialEndsAt),
    hasPaymentMethod
  );

  console.log(`[Trial Ending] Notification sent for subscription ${subscriptionId}`);
}

/**
 * Process subscription expiring notification
 */
function processSubscriptionExpiring(data: SubscriptionExpiringJobData): void {
  const { subscriptionId, userId, expiresAt } = data;

  console.log(`[Subscription Expiring] Processing for subscription ${subscriptionId}`);

  sendSubscriptionExpiringNotification(userId, subscriptionId, new Date(expiresAt));
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

function sendPaymentRetriesExhaustedNotification(subscriptionId: string, invoiceId: string): void {
  console.log(`[NOTIFICATION] Payment retries exhausted:`, {
    subscriptionId,
    invoiceId,
  });
  // TODO: Integrate with notification service
}

function sendOverageNotification(
  userId: string,
  subscriptionId: string,
  overageMinutes: number,
  overageCost: number
): void {
  console.log(`[NOTIFICATION] Usage overage for user ${userId}:`, {
    subscriptionId,
    overageMinutes,
    overageCost: `$${(overageCost / 100).toFixed(2)}`,
  });
  // TODO: Integrate with notification service
}

function sendTrialEndingSoonNotification(
  email: string,
  firstName: string,
  plan: string,
  trialEndsAt: Date,
  hasPaymentMethod: boolean
): void {
  console.log(`[NOTIFICATION] Trial ending soon for ${email}:`, {
    firstName,
    plan,
    trialEndsAt: trialEndsAt.toISOString(),
    hasPaymentMethod,
  });
  // TODO: Integrate with notification service
}

function sendSubscriptionExpiringNotification(
  userId: string,
  subscriptionId: string,
  expiresAt: Date
): void {
  console.log(`[NOTIFICATION] Subscription expiring for user ${userId}:`, {
    subscriptionId,
    expiresAt: expiresAt.toISOString(),
  });
  // TODO: Integrate with notification service
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
