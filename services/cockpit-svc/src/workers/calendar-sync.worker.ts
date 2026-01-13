/**
 * @module @skillancer/cockpit-svc/workers/calendar-sync
 * Calendar Sync Worker
 *
 * Background worker for synchronizing external calendars
 */

import { createLogger } from '@skillancer/logger';
import { Worker, Queue, type Job } from 'bullmq';

import { CalendarConnectionRepository } from '../repositories/calendar-connection.repository.js';

import type { CalendarService } from '../services/calendar.service.js';
import type { CalendarSyncJob, SyncResult } from '../types/calendar.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';

const logger = createLogger({ name: 'calendar-sync-worker' });

export interface CalendarSyncWorkerConfig {
  redisConnection: {
    host: string;
    port: number;
    password?: string;
  };
  queueName?: string;
  concurrency?: number;
}

export class CalendarSyncWorker {
  private readonly queue: Queue<CalendarSyncJob>;
  private readonly worker: Worker<CalendarSyncJob, SyncResult>;
  private readonly connectionRepo: CalendarConnectionRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly calendarService: CalendarService,
    private readonly config: CalendarSyncWorkerConfig
  ) {
    const queueName = config.queueName ?? 'calendar-sync';

    this.connectionRepo = new CalendarConnectionRepository(prisma);

    // Create queue
    this.queue = new Queue<CalendarSyncJob>(queueName, {
      connection: config.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    // Create worker
    this.worker = new Worker<CalendarSyncJob, SyncResult>(
      queueName,
      async (job) => this.processJob(job),
      {
        connection: config.redisConnection,
        concurrency: config.concurrency ?? 5,
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Setup worker event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job, result) => {
      logger.info(
        {
          jobId: job.id,
          connectionId: job.data.connectionId,
          created: result.eventsCreated,
          updated: result.eventsUpdated,
          deleted: result.eventsDeleted,
        },
        'Calendar sync completed'
      );
    });

    this.worker.on('failed', (job, error) => {
      logger.error(
        {
          jobId: job?.id,
          connectionId: job?.data.connectionId,
          error: error.message,
        },
        'Calendar sync failed'
      );
    });

    this.worker.on('error', (error) => {
      logger.error({ error: error.message }, 'Worker error');
    });
  }

  /**
   * Process a sync job
   */
  private async processJob(job: Job<CalendarSyncJob>): Promise<SyncResult> {
    const { connectionId, type } = job.data;

    logger.info(
      {
        jobId: job.id,
        connectionId,
        syncType: type,
      },
      'Processing calendar sync'
    );

    try {
      // If full sync requested, clear sync tokens first
      if (type === 'full') {
        // Would update calendar to clear syncToken
        logger.info('Full sync requested, clearing sync token');
      }

      const result = await this.calendarService.syncConnection(connectionId);

      return result;
    } catch (error) {
      logger.error(
        {
          jobId: job.id,
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Sync job processing error'
      );

      throw error;
    }
  }

  /**
   * Schedule a sync for a specific connection
   */
  async scheduleSync(
    connectionId: string,
    options: {
      type?: 'initial' | 'incremental' | 'full';
      delay?: number;
    } = {}
  ): Promise<string> {
    const job = await this.queue.add(
      'sync',
      {
        connectionId,
        type: options.type ?? 'incremental',
      },
      {
        delay: options.delay,
        jobId: `sync-${connectionId}`,
      }
    );

    logger.info(
      {
        jobId: job.id,
        connectionId,
        delay: options.delay,
      },
      'Scheduled calendar sync'
    );

    return job.id ?? '';
  }

  /**
   * Schedule periodic sync for all active connections
   */
  async schedulePeriodicSync(): Promise<void> {
    // Find all connections needing sync
    const connections = await this.connectionRepo.findNeedingSync();

    logger.info(`Scheduling sync for ${connections.length} connections`);

    for (const connection of connections) {
      await this.scheduleSync(connection.id, {
        delay: Math.random() * 60000, // Spread out over 1 minute
      });
    }
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    logger.info('Calendar sync worker started');

    // Schedule periodic sync every 15 minutes
    setInterval(async () => this.schedulePeriodicSync(), 15 * 60 * 1000);

    // Initial sync
    await this.schedulePeriodicSync();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    logger.info('Calendar sync worker stopped');
  }

  /**
   * Get queue for external access
   */
  getQueue(): Queue<CalendarSyncJob> {
    return this.queue;
  }
}

export default CalendarSyncWorker;
