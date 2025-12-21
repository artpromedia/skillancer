/**
 * @module @skillancer/cockpit-svc/workers/recurring-invoice
 * Recurring Invoice Worker - Processes recurring invoices and generates new invoices
 */

import { RecurringInvoiceService } from '../services/recurring-invoice.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 1 hour
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

// Lock key for distributed processing
const LOCK_KEY = 'recurring-invoice-worker:lock';
const LOCK_TTL_SECONDS = 300; // 5 minutes

export class RecurringInvoiceWorker {
  private readonly recurringService: RecurringInvoiceService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS
  ) {
    this.recurringService = new RecurringInvoiceService(prisma, logger);
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Recurring invoice worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting recurring invoice worker');

    // Run immediately on start
    void this.run();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      void this.run();
    }, this.intervalMs);
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Recurring invoice worker stopped');
    }
  }

  /**
   * Run a single processing cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Recurring invoice worker already processing, skipping');
      return;
    }

    // Try to acquire distributed lock
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.debug('Could not acquire lock, another instance is processing');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Processing recurring invoices');

      const result = await this.recurringService.processDueRecurringInvoices();

      const duration = Date.now() - startTime;
      this.logger.info(
        {
          created: result.created,
          errors: result.errors.length,
          durationMs: duration,
        },
        'Recurring invoice processing complete'
      );

      // Log errors if any
      if (result.errors.length > 0) {
        for (const error of result.errors) {
          this.logger.warn({ error }, 'Recurring invoice error');
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Recurring invoice worker failed');
    } finally {
      this.isRunning = false;
      await this.releaseLock();
    }
  }

  /**
   * Acquire distributed lock
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const result = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error({ error }, 'Failed to acquire lock');
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(): Promise<void> {
    try {
      await this.redis.del(LOCK_KEY);
    } catch (error) {
      this.logger.error({ error }, 'Failed to release lock');
    }
  }
}
