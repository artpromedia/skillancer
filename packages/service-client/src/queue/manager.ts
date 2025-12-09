/**
 * @module @skillancer/service-client/queue
 * BullMQ Queue Manager for async messaging between services
 */

import {
  Queue,
  Worker,
  type Job as BullJob,
  QueueEvents,
  type JobsOptions,
  type WorkerOptions,
  type ConnectionOptions,
} from 'bullmq';

import { logger } from '../logger.js';
import { getContext } from '../request-context.js';

/**
 * Redis connection configuration
 */
const getConnection = (): ConnectionOptions => ({
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  password: process.env['REDIS_PASSWORD'],
  db: parseInt(process.env['REDIS_QUEUE_DB'] || '1', 10),
});

/**
 * Queue name constants
 */
export const QueueNames = {
  // Job and bidding related
  JOB_PROCESSING: 'job-processing',
  BID_NOTIFICATIONS: 'bid-notifications',
  CONTRACT_LIFECYCLE: 'contract-lifecycle',

  // SkillPod related
  POD_PROVISIONING: 'pod-provisioning',
  POD_CLEANUP: 'pod-cleanup',
  SESSION_MANAGEMENT: 'session-management',

  // Billing related
  PAYMENT_PROCESSING: 'payment-processing',
  ESCROW_MANAGEMENT: 'escrow-management',
  INVOICE_GENERATION: 'invoice-generation',
  PAYOUT_PROCESSING: 'payout-processing',

  // Notifications
  EMAIL_QUEUE: 'email-queue',
  PUSH_QUEUE: 'push-queue',
  SMS_QUEUE: 'sms-queue',

  // Analytics and reporting
  ANALYTICS_EVENTS: 'analytics-events',
  REPORT_GENERATION: 'report-generation',

  // User lifecycle
  USER_ONBOARDING: 'user-onboarding',
  PROFILE_VERIFICATION: 'profile-verification',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

/**
 * Job data envelope with tracing context
 */
export interface JobEnvelope<T = unknown> {
  data: T;
  traceId?: string | undefined;
  spanId?: string | undefined;
  userId?: string | undefined;
  timestamp: number;
}

/**
 * Job processor function type
 */
export type JobProcessor<T = unknown, R = void> = (job: BullJob<JobEnvelope<T>>) => Promise<R>;

/**
 * Queue Manager for creating and managing BullMQ queues
 */
export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private connection: ConnectionOptions;

  constructor(connection?: ConnectionOptions) {
    this.connection = connection ?? getConnection();
  }

  /**
   * Get or create a queue by name
   */
  getQueue<T = unknown>(name: QueueName | string): Queue<JobEnvelope<T>> {
    let queue = this.queues.get(name);

    if (!queue) {
      queue = new Queue<JobEnvelope<T>>(name, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 60 * 60, // 24 hours
          },
          removeOnFail: {
            count: 5000,
            age: 7 * 24 * 60 * 60, // 7 days
          },
        },
      });

      this.queues.set(name, queue);
      logger.info({ queue: name }, 'Queue created');
    }

    return queue as Queue<JobEnvelope<T>>;
  }

  /**
   * Add a job to a queue with automatic context propagation
   */
  async addJob<T = unknown>(
    queueName: QueueName | string,
    jobName: string,
    data: T,
    options?: JobsOptions
  ): Promise<BullJob<JobEnvelope<T>>> {
    const queue = this.getQueue<T>(queueName);
    const context = getContext();

    const envelope: JobEnvelope<T> = {
      data,
      timestamp: Date.now(),
    };
    if (context?.traceId !== undefined) envelope.traceId = context.traceId;
    if (context?.spanId !== undefined) envelope.spanId = context.spanId;
    if (context?.userId !== undefined) envelope.userId = context.userId;

    const job = await queue.add(jobName, envelope, options);

    logger.info(
      {
        queue: queueName,
        jobName,
        jobId: job.id,
        traceId: envelope.traceId,
      },
      'Job added to queue'
    );

    return job;
  }

  /**
   * Add multiple jobs to a queue in bulk
   */
  async addBulk<T = unknown>(
    queueName: QueueName | string,
    jobs: Array<{ name: string; data: T; options?: JobsOptions }>
  ): Promise<BullJob<JobEnvelope<T>>[]> {
    const queue = this.getQueue<T>(queueName);
    const context = getContext();

    const bulkJobs = jobs.map(({ name, data, options }) => {
      const envelope: JobEnvelope<T> = {
        data,
        timestamp: Date.now(),
      };
      if (context?.traceId !== undefined) envelope.traceId = context.traceId;
      if (context?.spanId !== undefined) envelope.spanId = context.spanId;
      if (context?.userId !== undefined) envelope.userId = context.userId;
      return {
        name,
        data: envelope,
        opts: options,
      };
    });

    const addedJobs = await queue.addBulk(bulkJobs);

    logger.info(
      {
        queue: queueName,
        count: addedJobs.length,
        traceId: context?.traceId,
      },
      'Bulk jobs added to queue'
    );

    return addedJobs;
  }

  /**
   * Create a worker for processing jobs from a queue
   */
  createWorker<T = unknown, R = void>(
    queueName: QueueName | string,
    processor: JobProcessor<T, R>,
    options?: Partial<WorkerOptions>
  ): Worker<JobEnvelope<T>, R> {
    const existingWorker = this.workers.get(queueName);
    if (existingWorker) {
      logger.warn({ queue: queueName }, 'Worker already exists for queue');
      return existingWorker as Worker<JobEnvelope<T>, R>;
    }

    const worker = new Worker<JobEnvelope<T>, R>(
      queueName,
      async (job: BullJob<JobEnvelope<T>>) => {
        const startTime = Date.now();

        logger.info(
          {
            queue: queueName,
            jobName: job.name,
            jobId: job.id,
            traceId: job.data.traceId,
            attempt: job.attemptsMade + 1,
          },
          'Processing job'
        );

        try {
          const result = await processor(job);

          logger.info(
            {
              queue: queueName,
              jobName: job.name,
              jobId: job.id,
              traceId: job.data.traceId,
              duration: Date.now() - startTime,
            },
            'Job completed'
          );

          return result;
        } catch (error) {
          logger.error(
            {
              queue: queueName,
              jobName: job.name,
              jobId: job.id,
              traceId: job.data.traceId,
              error: error instanceof Error ? error.message : String(error),
              duration: Date.now() - startTime,
            },
            'Job failed'
          );

          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency: 5,
        ...options,
      }
    );

    // Set up worker event handlers
    worker.on('completed', (job: BullJob<JobEnvelope<T>>) => {
      logger.debug({ queue: queueName, jobId: job.id }, 'Worker completed job');
    });

    worker.on('failed', (job: BullJob<JobEnvelope<T>> | undefined, error: Error) => {
      logger.error(
        {
          queue: queueName,
          jobId: job?.id,
          error: error.message,
        },
        'Worker job failed'
      );
    });

    worker.on('error', (error: Error) => {
      logger.error({ queue: queueName, error: error.message }, 'Worker error');
    });

    this.workers.set(queueName, worker);
    logger.info({ queue: queueName }, 'Worker created');

    return worker;
  }

  /**
   * Get queue events for monitoring
   */
  getQueueEvents(queueName: QueueName | string): QueueEvents {
    let events = this.queueEvents.get(queueName);

    if (!events) {
      events = new QueueEvents(queueName, {
        connection: this.connection,
      });

      this.queueEvents.set(queueName, events);
    }

    return events;
  }

  /**
   * Schedule a job to run at a specific time
   */
  async scheduleJob<T = unknown>(
    queueName: QueueName | string,
    jobName: string,
    data: T,
    runAt: Date,
    options?: JobsOptions
  ): Promise<BullJob<JobEnvelope<T>>> {
    const delay = Math.max(0, runAt.getTime() - Date.now());

    return this.addJob(queueName, jobName, data, {
      ...options,
      delay,
    });
  }

  /**
   * Schedule a recurring job
   */
  async scheduleRecurringJob<T = unknown>(
    queueName: QueueName | string,
    jobName: string,
    data: T,
    cron: string,
    options?: JobsOptions
  ): Promise<BullJob<JobEnvelope<T>>> {
    return this.addJob(queueName, jobName, data, {
      ...options,
      repeat: {
        pattern: cron,
      },
    });
  }

  /**
   * Get job by ID
   */
  async getJob<T = unknown>(
    queueName: QueueName | string,
    jobId: string
  ): Promise<BullJob<JobEnvelope<T>> | undefined> {
    const queue = this.getQueue<T>(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName | string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused().then((p: boolean) => (p ? 1 : 0)),
    ]);

    return { waiting, active, completed, failed, delayed, paused };
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName | string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    logger.info({ queue: queueName }, 'Queue paused');
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: QueueName | string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    logger.info({ queue: queueName }, 'Queue resumed');
  }

  /**
   * Clean completed/failed jobs from a queue
   */
  async cleanQueue(
    queueName: QueueName | string,
    grace: number = 24 * 60 * 60 * 1000, // 24 hours
    status: 'completed' | 'failed' | 'delayed' | 'paused' | 'wait' = 'completed'
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    const removed = await queue.clean(grace, 1000, status);
    logger.info({ queue: queueName, removed: removed.length, status }, 'Queue cleaned');
    return removed;
  }

  /**
   * Drain all jobs from a queue
   */
  async drainQueue(queueName: QueueName | string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
    logger.info({ queue: queueName }, 'Queue drained');
  }

  /**
   * Gracefully close all queues and workers
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    // Close workers first
    for (const [name, worker] of this.workers) {
      logger.info({ queue: name }, 'Closing worker');
      closePromises.push(worker.close());
    }

    // Close queue events
    for (const [name, events] of this.queueEvents) {
      logger.info({ queue: name }, 'Closing queue events');
      closePromises.push(events.close());
    }

    // Close queues
    for (const [name, queue] of this.queues) {
      logger.info({ queue: name }, 'Closing queue');
      closePromises.push(queue.close());
    }

    await Promise.all(closePromises);

    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();

    logger.info('All queues and workers closed');
  }
}

/**
 * Singleton queue manager instance
 */
export const queueManager = new QueueManager();

export { Job as BullJob, Queue, Worker, QueueEvents } from 'bullmq';
