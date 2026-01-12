/**
 * @module @skillancer/billing-svc/jobs/card-expiration
 * BullMQ job for checking card expirations
 */

import { type Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '@skillancer/logger';

import { getConfig } from '../config/index.js';
import { getPaymentMethodService } from '../services/payment-method.service.js';
import { billingNotifications } from '../services/billing-notifications.js';

import type { RedisOptions } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface CardExpirationJobData {
  triggeredBy?: 'scheduled' | 'manual';
  forceCheck?: boolean;
}

export interface CardExpirationJobResult {
  expiringCount: number;
  expiredCount: number;
  notificationsQueued: number;
  processedAt: Date;
}

export interface ExpiringCard {
  id: string;
  userId: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  user: {
    email: string;
    firstName: string;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const QUEUE_NAME = 'card-expiration-check';
const JOB_NAME = 'check-expiring-cards';

// Run daily at 6 AM
const CRON_SCHEDULE = '0 6 * * *';

// =============================================================================
// JOB MANAGER
// =============================================================================

let cardExpirationQueue: Queue<CardExpirationJobData, CardExpirationJobResult> | null = null;
let cardExpirationWorker: Worker<CardExpirationJobData, CardExpirationJobResult> | null = null;
let redisConnection: Redis | null = null;

/**
 * Get or create Redis connection
 */
function getRedisConnection(): Redis {
  if (!redisConnection) {
    const cfg = getConfig();
    const options: RedisOptions = {
      host: cfg.redis.host,
      port: cfg.redis.port,
      maxRetriesPerRequest: null,
    };
    if (cfg.redis.password) {
      options.password = cfg.redis.password;
    }
    redisConnection = new Redis(options);
  }
  return redisConnection;
}

/**
 * Initialize card expiration job queue and worker
 */
export function initializeCardExpirationJob(): void {
  const connection = getRedisConnection();

  // Create queue
  cardExpirationQueue = new Queue<CardExpirationJobData, CardExpirationJobResult>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000, // 1 minute
      },
    },
  });

  // Create worker
  cardExpirationWorker = new Worker<CardExpirationJobData, CardExpirationJobResult>(
    QUEUE_NAME,
    processCardExpirationJob,
    {
      connection,
      concurrency: 1, // Only one at a time
      limiter: {
        max: 1,
        duration: 60000, // Max 1 job per minute
      },
    }
  );

  // Worker event handlers
  cardExpirationWorker.on(
    'completed',
    (job: Job<CardExpirationJobData, CardExpirationJobResult>) => {
      logger.info('Card expiration job completed', {
        jobId: job.id,
        result: job.returnvalue,
      });
    }
  );

  cardExpirationWorker.on(
    'failed',
    (job: Job<CardExpirationJobData, CardExpirationJobResult> | undefined, error: Error) => {
      logger.error('Card expiration job failed', {
        jobId: job?.id,
        error: error.message,
      });
    }
  );

  cardExpirationWorker.on('error', (error: Error) => {
    logger.error('Card expiration worker error', { error: error.message });
  });

  logger.info('Card expiration job initialized', { queue: QUEUE_NAME });
}

/**
 * Schedule the recurring card expiration check
 */
export async function scheduleCardExpirationJob(): Promise<void> {
  if (!cardExpirationQueue) {
    throw new Error('Card expiration queue not initialized');
  }

  // Remove any existing repeatable jobs first
  const repeatableJobs = await cardExpirationQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await cardExpirationQueue.removeRepeatableByKey(job.key);
  }

  // Add new scheduled job
  await cardExpirationQueue.add(
    JOB_NAME,
    { triggeredBy: 'scheduled' },
    {
      repeat: {
        pattern: CRON_SCHEDULE,
      },
    }
  );

  logger.info('Card expiration job scheduled', { schedule: CRON_SCHEDULE });
}

/**
 * Trigger a manual card expiration check
 */
export async function triggerCardExpirationCheck(
  forceCheck = false
): Promise<Job<CardExpirationJobData, CardExpirationJobResult>> {
  if (!cardExpirationQueue) {
    throw new Error('Card expiration queue not initialized');
  }

  const job = await cardExpirationQueue.add(
    `${JOB_NAME}-manual`,
    { triggeredBy: 'manual', forceCheck },
    {
      priority: 1, // High priority for manual triggers
    }
  );

  logger.info('Manual card expiration check triggered', { jobId: job.id });
  return job;
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  if (!cardExpirationQueue) {
    throw new Error('Card expiration queue not initialized');
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    cardExpirationQueue.getWaitingCount(),
    cardExpirationQueue.getActiveCount(),
    cardExpirationQueue.getCompletedCount(),
    cardExpirationQueue.getFailedCount(),
    cardExpirationQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Clean up resources
 */
export async function closeCardExpirationJob(): Promise<void> {
  if (cardExpirationWorker) {
    await cardExpirationWorker.close();
    cardExpirationWorker = null;
  }

  if (cardExpirationQueue) {
    await cardExpirationQueue.close();
    cardExpirationQueue = null;
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }

  logger.info('Card expiration job closed');
}

// =============================================================================
// JOB PROCESSOR
// =============================================================================

/**
 * Process the card expiration check job
 */
async function processCardExpirationJob(
  job: Job<CardExpirationJobData, CardExpirationJobResult>
): Promise<CardExpirationJobResult> {
  logger.info('Processing card expiration job', { jobId: job.id });

  const paymentMethodService = getPaymentMethodService();

  // Update progress
  await job.updateProgress(10);

  // Check for cards expiring within 30 days (returns count and updates statuses)
  const expiringCount = await paymentMethodService.checkExpiringCards();
  await job.updateProgress(50);

  // Mark expired cards is handled by checkExpiringCards
  const expiredCount = 0; // Counted within checkExpiringCards
  await job.updateProgress(100);

  const result: CardExpirationJobResult = {
    expiringCount,
    expiredCount,
    notificationsQueued: expiringCount, // Notifications sent during check
    processedAt: new Date(),
  };

  logger.info('Card expiration job completed', { jobId: job.id, result });

  return result;
}

// =============================================================================
// NOTIFICATION HELPERS
// =============================================================================

/**
 * Send expiration warning notification
 */
export async function sendExpirationWarningNotification(card: ExpiringCard): Promise<void> {
  const daysUntilExpiry = calculateDaysUntilExpiry(card.cardExpMonth, card.cardExpYear);

  await billingNotifications.notifyCardExpiring(
    {
      userId: card.userId,
      email: card.user.email,
    },
    {
      last4: card.cardLast4 || '****',
      expiryMonth: card.cardExpMonth || 0,
      expiryYear: card.cardExpYear || 0,
      daysUntilExpiry,
    }
  );

  logger.info('Card expiration warning sent', {
    userId: card.userId,
    cardLast4: card.cardLast4,
    daysUntilExpiry,
  });
}

/**
 * Send card expired notification
 */
export async function sendCardExpiredNotification(card: ExpiringCard): Promise<void> {
  // Use the payment failed notification with appropriate messaging
  await billingNotifications.notifyPaymentFailed(
    {
      userId: card.userId,
      email: card.user.email,
    },
    {
      amount: 'N/A',
      reason: `Your card ending in ${card.cardLast4 || '****'} has expired. Please update your payment method to continue using Skillancer.`,
    }
  );

  logger.info('Card expired notification sent', {
    userId: card.userId,
    cardLast4: card.cardLast4,
  });
}

/**
 * Calculate days until card expires
 */
function calculateDaysUntilExpiry(
  expMonth: number | null,
  expYear: number | null
): number {
  if (!expMonth || !expYear) {
    return 0;
  }

  const now = new Date();
  // Card expires at end of expiry month
  const expiryDate = new Date(expYear, expMonth, 0); // Last day of month
  const diffTime = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// =============================================================================
// EXPORTS
// =============================================================================

export { QUEUE_NAME, JOB_NAME, CRON_SCHEDULE };
