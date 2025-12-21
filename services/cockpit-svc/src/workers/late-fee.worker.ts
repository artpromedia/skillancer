/**
 * @module @skillancer/cockpit-svc/workers/late-fee
 * Late Fee Worker - Applies late fees to overdue invoices
 */

import {
  InvoiceRepository,
  InvoiceActivityRepository,
  InvoiceSettingsRepository,
} from '../repositories/index.js';

import type { PrismaClient, Invoice } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 1 hour
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

// Lock key for distributed processing
const LOCK_KEY = 'late-fee-worker:lock';
const LOCK_TTL_SECONDS = 300; // 5 minutes

export interface LateFeeNotification {
  invoiceId: string;
  invoiceNumber: string;
  userId: string;
  clientName: string;
  lateFeeAmount: number;
  newTotal: number;
}

export class LateFeeWorker {
  private readonly invoiceRepo: InvoiceRepository;
  private readonly activityRepo: InvoiceActivityRepository;
  private readonly settingsRepo: InvoiceSettingsRepository;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
    private readonly onLateFee?: (notification: LateFeeNotification) => Promise<void>
  ) {
    this.invoiceRepo = new InvoiceRepository(prisma);
    this.activityRepo = new InvoiceActivityRepository(prisma);
    this.settingsRepo = new InvoiceSettingsRepository(prisma);
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Late fee worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting late fee worker');

    // Run immediately on start
    void this.run();

    // Schedule periodic runs (run at midnight)
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
      this.logger.info('Late fee worker stopped');
    }
  }

  /**
   * Run a single processing cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Late fee worker already processing, skipping');
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
      this.logger.debug('Processing late fees');

      // Get user-specific grace days by getting all unique users with overdue invoices
      const defaultGraceDays = 0;
      const invoices = await this.invoiceRepo.findOverdueForLateFees(defaultGraceDays);

      let applied = 0;
      let errors = 0;

      for (const invoice of invoices) {
        try {
          // Check user-specific grace period
          const settings = await this.settingsRepo.findByUserId(invoice.freelancerUserId);
          const graceDays = settings?.lateFeeGraceDays ?? 0;

          const dueDate = new Date(invoice.dueDate);
          const gracePeriodDate = new Date();
          gracePeriodDate.setDate(gracePeriodDate.getDate() - graceDays);

          // Skip if still within grace period
          if (dueDate > gracePeriodDate) {
            continue;
          }

          // Skip if late fee already applied today
          if (invoice.lateFeeAppliedAt) {
            const appliedDate = new Date(invoice.lateFeeAppliedAt);
            const today = new Date();
            if (
              appliedDate.getDate() === today.getDate() &&
              appliedDate.getMonth() === today.getMonth() &&
              appliedDate.getFullYear() === today.getFullYear()
            ) {
              continue;
            }
          }

          await this.applyLateFee(invoice);
          applied++;
        } catch (error) {
          errors++;
          this.logger.error({ invoiceId: invoice.id, error }, 'Failed to apply late fee');
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        { processed: invoices.length, applied, errors, durationMs: duration },
        'Late fee processing complete'
      );
    } catch (error) {
      this.logger.error({ error }, 'Late fee worker failed');
    } finally {
      this.isRunning = false;
      await this.releaseLock();
    }
  }

  /**
   * Apply late fee to a single invoice
   */
  private async applyLateFee(invoice: Invoice): Promise<void> {
    if (!invoice.lateFeeEnabled || !invoice.lateFeeType || !invoice.lateFeeValue) {
      return;
    }

    // Calculate late fee
    let lateFeeAmount: number;

    if (invoice.lateFeeType === 'PERCENTAGE') {
      lateFeeAmount = Number(invoice.amountDue) * (Number(invoice.lateFeeValue) / 100);
    } else {
      lateFeeAmount = Number(invoice.lateFeeValue);
    }

    // Round to 2 decimal places
    lateFeeAmount = Math.round(lateFeeAmount * 100) / 100;

    if (lateFeeAmount <= 0) {
      return;
    }

    // Apply late fee
    const updatedInvoice = await this.invoiceRepo.applyLateFee(invoice.id, lateFeeAmount);

    // Log activity
    await this.activityRepo.logLateFeeApplied(invoice.id, lateFeeAmount);

    // Send notification
    if (this.onLateFee) {
      // Get client info
      const invoiceWithClient = await this.invoiceRepo.findByIdWithDetails(invoice.id);

      await this.onLateFee({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        userId: invoice.freelancerUserId,
        clientName: (invoiceWithClient as any)?.client?.name ?? 'Client',
        lateFeeAmount,
        newTotal: Number(updatedInvoice.total),
      });
    }

    this.logger.info(
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        lateFeeAmount,
        newTotal: Number(updatedInvoice.total),
      },
      'Late fee applied'
    );
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
