/**
 * @module @skillancer/cockpit-svc/workers/invoice-reminder
 * Invoice Reminder Worker - Sends invoice reminders and overdue notifications
 */

import {
  InvoiceRepository,
  InvoiceActivityRepository,
  InvoiceSettingsRepository,
} from '../repositories/index.js';

import type { Invoice } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 30 minutes
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

// Lock key for distributed processing
const LOCK_KEY = 'invoice-reminder-worker:lock';
const LOCK_TTL_SECONDS = 300; // 5 minutes

export interface InvoiceReminderNotification {
  invoiceId: string;
  invoiceNumber: string;
  userId: string;
  clientEmail: string;
  clientName: string;
  amount: number;
  dueDate: Date;
  isOverdue: boolean;
  daysUntilDue: number;
  daysOverdue: number;
  viewUrl: string;
}

export class InvoiceReminderWorker {
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
    private readonly onReminder?: (notification: InvoiceReminderNotification) => Promise<void>
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
      this.logger.warn('Invoice reminder worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting invoice reminder worker');

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
      this.logger.info('Invoice reminder worker stopped');
    }
  }

  /**
   * Run a single processing cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Invoice reminder worker already processing, skipping');
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
      this.logger.debug('Processing invoice reminders');

      const invoices = await this.invoiceRepo.findForReminders();

      let sent = 0;
      let errors = 0;

      for (const invoice of invoices) {
        try {
          await this.processReminder(invoice as Invoice & { client: any; template: any });
          sent++;
        } catch (error) {
          errors++;
          this.logger.error({ invoiceId: invoice.id, error }, 'Failed to process invoice reminder');
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info(
        { processed: invoices.length, sent, errors, durationMs: duration },
        'Invoice reminder processing complete'
      );
    } catch (error) {
      this.logger.error({ error }, 'Invoice reminder worker failed');
    } finally {
      this.isRunning = false;
      await this.releaseLock();
    }
  }

  /**
   * Process a single invoice reminder
   */
  private async processReminder(
    invoice: Invoice & { client: { email?: string; name: string }; template: any }
  ): Promise<void> {
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isOverdue = diffDays < 0;
    const daysUntilDue = Math.max(0, diffDays);
    const daysOverdue = Math.max(0, -diffDays);

    // Build notification
    const notification: InvoiceReminderNotification = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      userId: invoice.freelancerUserId,
      clientEmail: invoice.client?.email ?? '',
      clientName: invoice.client?.name ?? 'Client',
      amount: Number(invoice.amountDue),
      dueDate,
      isOverdue,
      daysUntilDue,
      daysOverdue,
      viewUrl: `${process.env.APP_URL ?? 'https://app.skillancer.com'}/invoices/view/${invoice.viewToken}`,
    };

    // Send notification
    if (this.onReminder && notification.clientEmail) {
      await this.onReminder(notification);
    }

    // Log activity
    await this.activityRepo.logReminderSent(invoice.id, invoice.remindersSent + 1);

    // Record reminder sent
    await this.invoiceRepo.recordReminderSent(invoice.id);

    // Schedule next reminder
    await this.scheduleNextReminder(invoice);

    this.logger.info(
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        isOverdue,
        daysUntilDue,
        daysOverdue,
      },
      'Invoice reminder sent'
    );
  }

  /**
   * Schedule the next reminder for an invoice
   */
  private async scheduleNextReminder(invoice: Invoice): Promise<void> {
    const settings = await this.settingsRepo.getReminderSettings(invoice.freelancerUserId);

    if (!settings.autoReminders) {
      await this.invoiceRepo.setNextReminder(invoice.id, null);
      return;
    }

    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const isOverdue = dueDate < now;

    if (isOverdue) {
      // For overdue invoices, send weekly reminders
      const nextReminder = new Date(now);
      nextReminder.setDate(nextReminder.getDate() + 7);
      await this.invoiceRepo.setNextReminder(invoice.id, nextReminder);
    } else {
      // Find next reminder day before due date
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const nextReminderDay = settings.reminderDays
        .filter((d) => d < daysUntilDue)
        .sort((a, b) => b - a)[0];

      if (nextReminderDay !== undefined) {
        const nextReminder = new Date(dueDate);
        nextReminder.setDate(nextReminder.getDate() - nextReminderDay);
        await this.invoiceRepo.setNextReminder(invoice.id, nextReminder);
      } else {
        // No more reminders before due, schedule overdue reminder
        const nextReminder = new Date(dueDate);
        nextReminder.setDate(nextReminder.getDate() + 1);
        await this.invoiceRepo.setNextReminder(invoice.id, nextReminder);
      }
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
