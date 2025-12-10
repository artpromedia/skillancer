/**
 * @module @skillancer/billing-svc/jobs/card-expiration
 * BullMQ job for checking card expirations
 */

import { Job, Queue, Worker } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { Redis } from 'ioredis';

import { getConfig } from '../config/index.js';
import { getPaymentMethodService } from '../services/payment-method.service.js';

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
      console.log(`[CardExpirationJob] Job ${job.id} completed:`, job.returnvalue);
    }
  );

  cardExpirationWorker.on(
    'failed',
    (job: Job<CardExpirationJobData, CardExpirationJobResult> | undefined, error: Error) => {
      console.error(`[CardExpirationJob] Job ${job?.id} failed:`, error.message);
    }
  );

  cardExpirationWorker.on('error', (error: Error) => {
    console.error('[CardExpirationJob] Worker error:', error.message);
  });

  console.log(`[CardExpirationJob] Initialized queue and worker`);
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

  console.log(`[CardExpirationJob] Scheduled at: ${CRON_SCHEDULE}`);
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

  console.log(`[CardExpirationJob] Manual check triggered, job ID: ${job.id}`);
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

  console.log('[CardExpirationJob] Closed queue and worker');
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
  console.log(`[CardExpirationJob] Processing job ${job.id}...`);

  const paymentMethodService = getPaymentMethodService();

  // Update progress
  await job.updateProgress(10);

  // Check for cards expiring within 30 days (returns count and updates statuses)
  const expiringCount = await paymentMethodService.checkExpiringCards();
  await job.updateProgress(50);

  // Mark expired cards is handled by checkExpiringCards
  const expiredCount = 0; // TODO: Add separate method if needed
  await job.updateProgress(100);

  const result: CardExpirationJobResult = {
    expiringCount,
    expiredCount,
    notificationsQueued: expiringCount, // Notifications sent during check
    processedAt: new Date(),
  };

  console.log(`[CardExpirationJob] Completed:`, result);

  return result;
}

// =============================================================================
// NOTIFICATION PLACEHOLDERS
// =============================================================================

/**
 * Send expiration warning email
 * TODO: Integrate with actual notification service
 */
function _sendExpirationWarningEmail(card: {
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
}): void {
  // TODO: Integrate with notification/email service
  console.log(`[CardExpirationJob] Sending expiration warning:`, {
    userId: card.userId,
    email: card.user.email,
    cardLast4: card.cardLast4,
    cardBrand: card.cardBrand,
    expiresAt: `${card.cardExpMonth}/${card.cardExpYear}`,
  });

  // Placeholder for email service call
  // await emailService.send({
  //   to: card.user.email,
  //   template: 'card-expiring-soon',
  //   data: {
  //     firstName: card.user.firstName,
  //     cardBrand: card.cardBrand,
  //     cardLast4: card.cardLast4,
  //     expiryDate: `${card.cardExpMonth}/${card.cardExpYear}`,
  //     updateUrl: `${config.app.frontendUrl}/settings/payment-methods`,
  //   },
  // });
}

/**
 * Send card expired email
 */
function _sendCardExpiredEmail(card: {
  id: string;
  userId: string;
  cardBrand: string | null;
  cardLast4: string | null;
  user: {
    email: string;
    firstName: string;
  };
}): void {
  // TODO: Integrate with notification/email service
  console.log(`[CardExpirationJob] Sending card expired notification:`, {
    userId: card.userId,
    email: card.user.email,
    cardLast4: card.cardLast4,
    cardBrand: card.cardBrand,
  });

  // Placeholder for email service call
  // await emailService.send({
  //   to: card.user.email,
  //   template: 'card-expired',
  //   data: {
  //     firstName: card.user.firstName,
  //     cardBrand: card.cardBrand,
  //     cardLast4: card.cardLast4,
  //     updateUrl: `${config.app.frontendUrl}/settings/payment-methods`,
  //   },
  // });
}

// =============================================================================
// EXPORTS
// =============================================================================

export { QUEUE_NAME, JOB_NAME, CRON_SCHEDULE };
