/**
 * Email Queue Service
 *
 * Handles asynchronous email sending via Bull queue with Redis
 */

import { logger } from '@skillancer/logger';
import { Queue, Worker, type Job, QueueEvents, type JobsOptions } from 'bullmq';

import {
  getSendGridProvider,
  type EmailRecipient,
  type SendGridAttachment,
} from '../providers/sendgrid.js';
import {
  generateEmail,
  hasTemplate,
  type EMAIL_TEMPLATE_GENERATORS,
  type EmailTemplateType,
} from '../templates/index.js';

// ============================================================================
// Types
// ============================================================================

export interface EmailJobData {
  /** Unique identifier for tracking */
  id: string;
  /** Email recipient(s) */
  to: string | string[];
  /** Email subject (optional if using template) */
  subject?: string;
  /** Pre-rendered HTML content */
  html?: string;
  /** Plain text content */
  text?: string;
  /** Template type to use */
  template?: EmailTemplateType;
  /** Template data (if using template) */
  templateData?: Record<string, unknown>;
  /** CC recipients */
  cc?: string | string[];
  /** BCC recipients */
  bcc?: string | string[];
  /** Reply-to address */
  replyTo?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Attachments */
  attachments?: Array<{
    content: string;
    filename: string;
    type?: string;
    disposition?: 'attachment' | 'inline';
    contentId?: string;
  }>;
  /** Categories for analytics */
  categories?: string[];
  /** Custom tracking arguments */
  customArgs?: Record<string, string>;
  /** Scheduled send time (ISO string) */
  sendAt?: string;
  /** Metadata for logging */
  metadata?: {
    userId?: string;
    tenantId?: string;
    correlationId?: string;
    source?: string;
  };
}

export interface EmailJobResult {
  success: boolean;
  messageId?: string;
  timestamp: string;
  attempts: number;
  error?: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export type EmailJobPriority = 'critical' | 'high' | 'normal' | 'low';

// ============================================================================
// Configuration
// ============================================================================

const QUEUE_NAME = 'email-queue';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // 5 seconds initial delay
  },
  removeOnComplete: {
    count: 1000, // Keep last 1000 completed jobs
    age: 24 * 60 * 60, // Remove after 24 hours
  },
  removeOnFail: {
    count: 5000, // Keep last 5000 failed jobs
    age: 7 * 24 * 60 * 60, // Remove after 7 days
  },
};

const PRIORITY_MAP: Record<EmailJobPriority, number> = {
  critical: 1,
  high: 2,
  normal: 3,
  low: 4,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert string email to EmailRecipient object
 */
function toRecipient(email: string | EmailRecipient): EmailRecipient {
  return typeof email === 'string' ? { email } : email;
}

/**
 * Convert string or array of strings to EmailRecipient array
 */
function toRecipients(
  emails: string | string[] | EmailRecipient | EmailRecipient[] | undefined
): EmailRecipient[] | undefined {
  if (!emails) return undefined;
  if (Array.isArray(emails)) {
    return emails.map((e) => (typeof e === 'string' ? { email: e } : e));
  }
  return [typeof emails === 'string' ? { email: emails } : emails];
}

/**
 * Convert job attachments to SendGrid attachment format
 */
function toSendGridAttachments(
  attachments: EmailJobData['attachments']
): SendGridAttachment[] | undefined {
  if (!attachments) return undefined;
  return attachments.map((a) => ({
    filename: a.filename,
    content: a.content,
    type: a.type || 'application/octet-stream',
    disposition: a.disposition,
    contentId: a.contentId,
  }));
}

// ============================================================================
// Email Queue Class
// ============================================================================

export class EmailQueueService {
  private readonly queue: Queue<EmailJobData, EmailJobResult>;
  private worker: Worker<EmailJobData, EmailJobResult> | null = null;
  private queueEvents: QueueEvents | null = null;
  private isInitialized = false;
  private readonly redisConnection: { host: string; port: number; password?: string };

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(url);

    this.redisConnection = {
      host: parsed.hostname,
      port: Number.parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
    };

    this.queue = new Queue<EmailJobData, EmailJobResult>(QUEUE_NAME, {
      connection: this.redisConnection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });

    logger.info({ queueName: QUEUE_NAME }, 'Email queue created');
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Initialize the queue worker for processing jobs
   */
  async initialize(concurrency = 5): Promise<void> {
    if (this.isInitialized) {
      logger.warn({}, 'Email queue already initialized');
      return;
    }

    // Create worker
    this.worker = new Worker<EmailJobData, EmailJobResult>(
      QUEUE_NAME,
      async (job) => this.processJob(job),
      {
        connection: this.redisConnection,
        concurrency,
        limiter: {
          max: 100, // Max 100 jobs per minute (SendGrid rate limit consideration)
          duration: 60000,
        },
      }
    );

    // Create queue events for monitoring
    this.queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: this.redisConnection,
    });

    // Set up event handlers
    this.setupEventHandlers();

    this.isInitialized = true;
    logger.info({ concurrency }, 'Email queue worker initialized');
  }

  /**
   * Set up event handlers for monitoring
   */
  private setupEventHandlers(): void {
    if (!this.worker || !this.queueEvents) return;

    this.worker.on('completed', (job, result) => {
      logger.info(
        {
          jobId: job.id,
          emailId: job.data.id,
          messageId: result.messageId,
          attempts: result.attempts,
        },
        'Email job completed'
      );
    });

    this.worker.on('failed', (job, error) => {
      logger.error(
        {
          jobId: job?.id,
          emailId: job?.data.id,
          error: error.message,
          attempts: job?.attemptsMade,
        },
        'Email job failed'
      );
    });

    this.worker.on('error', (error) => {
      logger.error({ error: error.message }, 'Email queue worker error');
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn({ jobId }, 'Email job stalled');
    });
  }

  // --------------------------------------------------------------------------
  // Job Processing
  // --------------------------------------------------------------------------

  /**
   * Process an email job
   */
  private async processJob(job: Job<EmailJobData, EmailJobResult>): Promise<EmailJobResult> {
    const { data } = job;
    const startTime = Date.now();

    logger.info(
      {
        jobId: job.id,
        emailId: data.id,
        to: Array.isArray(data.to) ? data.to.length : 1,
        template: data.template,
        attempt: job.attemptsMade + 1,
      },
      'Processing email job'
    );

    try {
      // Generate content from template if needed
      let html = data.html;
      let text = data.text;
      let subject = data.subject;

      if (data.template && data.templateData) {
        if (!hasTemplate(data.template)) {
          throw new Error(`Unknown email template: ${data.template}`);
        }

        const templateKey = data.template as keyof typeof EMAIL_TEMPLATE_GENERATORS;
        const generated = generateEmail(templateKey, data.templateData);
        html = generated.html;
        text = generated.text;
        subject = subject || generated.subject;
      }

      if (!html && !text) {
        throw new Error('Email must have either HTML or text content');
      }

      if (!subject) {
        throw new Error('Email must have a subject');
      }

      // Convert recipients and attachments to SendGrid format
      const toRecipientList = toRecipients(data.to);
      const toField = toRecipientList.length === 1 ? toRecipientList[0] : toRecipientList;

      // Send via SendGrid
      const sendgrid = getSendGridProvider();
      const result = await sendgrid.send({
        to: toField,
        subject,
        html: html || '',
        text,
        cc: toRecipients(data.cc),
        bcc: toRecipients(data.bcc),
        replyTo: data.replyTo ? toRecipient(data.replyTo) : undefined,
        headers: data.headers,
        attachments: toSendGridAttachments(data.attachments),
        categories: data.categories,
        customArgs: {
          ...data.customArgs,
          emailId: data.id,
          jobId: job.id || '',
        },
        sendAt: data.sendAt ? Math.floor(new Date(data.sendAt).getTime() / 1000) : undefined,
      });

      const duration = Date.now() - startTime;

      logger.info(
        {
          jobId: job.id,
          emailId: data.id,
          messageId: result.messageId,
          duration,
          metadata: data.metadata,
        },
        'Email sent successfully'
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
        attempts: job.attemptsMade + 1,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const duration = Date.now() - startTime;

      logger.error(
        {
          jobId: job.id,
          emailId: data.id,
          error: errorMessage,
          duration,
          attempt: job.attemptsMade + 1,
          metadata: data.metadata,
        },
        'Email send failed'
      );

      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Queue Operations
  // --------------------------------------------------------------------------

  /**
   * Add an email to the queue
   */
  async enqueue(
    data: EmailJobData,
    options?: {
      priority?: EmailJobPriority;
      delay?: number;
      jobId?: string;
    }
  ): Promise<string> {
    const jobOptions: JobsOptions = {
      ...DEFAULT_JOB_OPTIONS,
      priority: options?.priority ? PRIORITY_MAP[options.priority] : PRIORITY_MAP.normal,
      delay: options?.delay,
      jobId: options?.jobId || data.id,
    };

    const job = await this.queue.add(data.id, data, jobOptions);

    logger.debug(
      {
        jobId: job.id,
        emailId: data.id,
        priority: options?.priority || 'normal',
        delay: options?.delay,
      },
      'Email enqueued'
    );

    return job.id || data.id;
  }

  /**
   * Add multiple emails to the queue (bulk)
   */
  async enqueueBulk(
    items: Array<{
      data: EmailJobData;
      options?: { priority?: EmailJobPriority; delay?: number };
    }>
  ): Promise<string[]> {
    const jobs = items.map((item) => ({
      name: item.data.id,
      data: item.data,
      opts: {
        ...DEFAULT_JOB_OPTIONS,
        priority: item.options?.priority
          ? PRIORITY_MAP[item.options.priority]
          : PRIORITY_MAP.normal,
        delay: item.options?.delay,
        jobId: item.data.id,
      },
    }));

    const results = await this.queue.addBulk(jobs);

    logger.info({ count: results.length }, 'Bulk emails enqueued');

    return results.map((job) => job.id || job.name);
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job<EmailJobData, EmailJobResult> | undefined> {
    return this.queue.getJob(jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(
    jobId: string
  ): Promise<{ state: string; progress: number; result?: EmailJobResult } | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const result = job.returnvalue;

    return {
      state,
      progress: job.progress as number,
      result,
    };
  }

  /**
   * Cancel a pending job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === 'active') {
      logger.warn({ jobId }, 'Cannot cancel active job');
      return false;
    }

    await job.remove();
    logger.info({ jobId }, 'Job cancelled');
    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state !== 'failed') {
      logger.warn({ jobId, state }, 'Can only retry failed jobs');
      return false;
    }

    await job.retry();
    logger.info({ jobId }, 'Job queued for retry');
    return true;
  }

  // --------------------------------------------------------------------------
  // Queue Stats
  // --------------------------------------------------------------------------

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.isPaused(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(start = 0, end = 100): Promise<Job<EmailJobData, EmailJobResult>[]> {
    return this.queue.getFailed(start, end);
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(start = 0, end = 100): Promise<Job<EmailJobData, EmailJobResult>[]> {
    return this.queue.getCompleted(start, end);
  }

  // --------------------------------------------------------------------------
  // Queue Management
  // --------------------------------------------------------------------------

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    logger.info({}, 'Email queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    logger.info({}, 'Email queue resumed');
  }

  /**
   * Drain the queue (remove all waiting jobs)
   */
  async drain(): Promise<void> {
    await this.queue.drain();
    logger.info({}, 'Email queue drained');
  }

  /**
   * Clean old jobs
   */
  async clean(
    grace: number = 24 * 60 * 60 * 1000,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    const removed = await this.queue.clean(grace, 1000, status);
    logger.info({ status, removed: removed.length }, 'Queue cleaned');
    return removed;
  }

  /**
   * Close the queue and worker
   */
  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    if (this.queueEvents) {
      await this.queueEvents.close();
      this.queueEvents = null;
    }

    await this.queue.close();
    this.isInitialized = false;

    logger.info({}, 'Email queue closed');
  }

  /**
   * Check if queue is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; details: QueueStats }> {
    try {
      const stats = await this.getStats();
      const healthy = stats.active < 100 && stats.waiting < 10000;

      return { healthy, details: stats };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Email queue health check failed'
      );

      return {
        healthy: false,
        details: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
        },
      };
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailQueueInstance: EmailQueueService | null = null;

export function getEmailQueueService(redisUrl?: string): EmailQueueService {
  if (!emailQueueInstance) {
    emailQueueInstance = new EmailQueueService(redisUrl);
  }
  return emailQueueInstance;
}

export async function initializeEmailQueue(options?: {
  redisUrl?: string;
  concurrency?: number;
}): Promise<EmailQueueService> {
  const service = getEmailQueueService(options?.redisUrl);
  await service.initialize(options?.concurrency);
  return service;
}

export async function closeEmailQueue(): Promise<void> {
  if (emailQueueInstance) {
    await emailQueueInstance.close();
    emailQueueInstance = null;
  }
}
