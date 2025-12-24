/**
 * @module @skillancer/admin/services/ops
 * Queue management service for BullMQ
 */

import { Queue, type Job, QueueEvents } from 'bullmq';

import type { Redis } from 'ioredis';

export interface QueueInfo {
  name: string;
  status: 'active' | 'paused';
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  latestJob?: JobInfo;
  oldestWaiting?: Date;
  throughput: {
    processed: number;
    failed: number;
    period: string;
  };
}

export interface JobInfo {
  id: string;
  name: string;
  data: unknown;
  opts: unknown;
  progress: number;
  attemptsMade: number;
  processedOn?: Date;
  finishedOn?: Date;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: unknown;
  timestamp: Date;
  delay: number;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export class QueueManagementService {
  private queues: Map<string, Queue> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor(
    private redis: Redis,
    private logger: Logger
  ) {
    this.initializeQueues();
  }

  private initializeQueues(): void {
    const queueNames = [
      'email',
      'notifications',
      'video-processing',
      'export',
      'search-indexing',
      'analytics',
      'cleanup',
    ];

    for (const name of queueNames) {
      const queue = new Queue(name, {
        connection: this.redis.duplicate(),
      });
      this.queues.set(name, queue);

      const events = new QueueEvents(name, {
        connection: this.redis.duplicate(),
      });
      this.queueEvents.set(name, events);
    }
  }

  async getAllQueues(): Promise<QueueInfo[]> {
    const queues: QueueInfo[] = [];

    for (const [name, _queue] of this.queues) {
      const info = await this.getQueueInfo(name);
      queues.push(info);
    }

    return queues;
  }

  async getQueueInfo(queueName: string): Promise<QueueInfo> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed, paused, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getPausedCount(),
      queue.isPaused(),
    ]);

    const waitingJobs = await queue.getWaiting(0, 0);
    const latestCompleted = await queue.getCompleted(0, 0);

    return {
      name: queueName,
      status: isPaused ? 'paused' : 'active',
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
      },
      latestJob: latestCompleted[0] ? this.formatJob(latestCompleted[0]) : undefined,
      oldestWaiting: waitingJobs[0] ? new Date(waitingJobs[0].timestamp) : undefined,
      throughput: {
        processed: completed,
        failed,
        period: 'all-time',
      },
    };
  }

  async getJobs(
    queueName: string,
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' = 'waiting',
    page: number = 1,
    limit: number = 20
  ): Promise<{ jobs: JobInfo[]; total: number }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const start = (page - 1) * limit;
    const end = start + limit - 1;

    let jobs: Job[];
    let total: number;

    switch (state) {
      case 'waiting':
        jobs = await queue.getWaiting(start, end);
        total = await queue.getWaitingCount();
        break;
      case 'active':
        jobs = await queue.getActive(start, end);
        total = await queue.getActiveCount();
        break;
      case 'completed':
        jobs = await queue.getCompleted(start, end);
        total = await queue.getCompletedCount();
        break;
      case 'failed':
        jobs = await queue.getFailed(start, end);
        total = await queue.getFailedCount();
        break;
      case 'delayed':
        jobs = await queue.getDelayed(start, end);
        total = await queue.getDelayedCount();
        break;
      default:
        jobs = [];
        total = 0;
    }

    return {
      jobs: jobs.map((job) => this.formatJob(job)),
      total,
    };
  }

  async getJob(queueName: string, jobId: string): Promise<JobInfo | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    return job ? this.formatJob(job) : null;
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.retry();
    this.logger.info('Job retried', { queueName, jobId });
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    await job.remove();
    this.logger.info('Job removed', { queueName, jobId });
  }

  async retryAllFailed(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const failedJobs = await queue.getFailed();
    let retried = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retried++;
      } catch (error) {
        this.logger.error('Failed to retry job', { jobId: job.id, error });
      }
    }

    this.logger.info('Retried all failed jobs', { queueName, count: retried });
    return retried;
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    this.logger.warn('Queue paused', { queueName });
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    this.logger.info('Queue resumed', { queueName });
  }

  async cleanQueue(
    queueName: string,
    state: 'completed' | 'failed' | 'delayed' | 'wait' = 'completed',
    olderThanMs: number = 24 * 60 * 60 * 1000
  ): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleaned = await queue.clean(olderThanMs, 1000, state);
    this.logger.info('Queue cleaned', { queueName, state, count: cleaned.length });
    return cleaned.length;
  }

  async drainQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.drain();
    this.logger.warn('Queue drained', { queueName });
  }

  private formatJob(job: Job): JobInfo {
    return {
      id: job.id!,
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress as number,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnvalue: job.returnvalue,
      timestamp: new Date(job.timestamp),
      delay: job.delay,
    };
  }

  async close(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    for (const events of this.queueEvents.values()) {
      await events.close();
    }
  }
}
