/**
 * @module @skillancer/cockpit-svc/workers/recurring-transaction
 * Recurring Transaction Worker - Processes recurring transactions and creates new transactions
 */

import {
  RecurringTransactionRepository,
  FinancialTransactionRepository,
} from '../repositories/index.js';

import type { RecurringTransaction } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 1 hour
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

// Lock key for distributed processing
const LOCK_KEY = 'recurring-transaction-worker:lock';
const LOCK_TTL_SECONDS = 300; // 5 minutes

export interface RecurringTransactionNotification {
  recurringId: string;
  userId: string;
  description: string;
  amount: number;
  dueDate: Date;
  isUpcoming: boolean; // true = reminder, false = created
}

export class RecurringTransactionWorker {
  private readonly recurringRepo: RecurringTransactionRepository;
  private readonly transactionRepo: FinancialTransactionRepository;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
    private readonly onNotification?: (
      notification: RecurringTransactionNotification
    ) => Promise<void>
  ) {
    this.recurringRepo = new RecurringTransactionRepository(prisma);
    this.transactionRepo = new FinancialTransactionRepository(prisma);
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Recurring transaction worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting recurring transaction worker');

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
      this.logger.info('Recurring transaction worker stopped');
    }
  }

  /**
   * Run a single processing cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Recurring transaction worker already processing, skipping');
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
      this.logger.debug('Recurring transaction worker starting processing cycle');

      // 1. Process due recurring transactions
      const created = await this.processDueTransactions();

      // 2. Send reminders for upcoming transactions
      const reminders = await this.sendUpcomingReminders();

      // 3. Deactivate expired recurring transactions
      const deactivated = await this.deactivateExpired();

      const duration = Date.now() - startTime;
      this.logger.info(
        { created, reminders, deactivated, durationMs: duration },
        'Recurring transaction worker completed cycle'
      );
    } catch (error) {
      this.logger.error(
        { error, durationMs: Date.now() - startTime },
        'Recurring transaction worker cycle failed'
      );
    } finally {
      this.isRunning = false;
      await this.releaseLock();
    }
  }

  /**
   * Process due recurring transactions and create actual transactions
   */
  private async processDueTransactions(): Promise<number> {
    const dueRecurring = await this.recurringRepo.findDueForProcessing();
    let created = 0;

    for (const recurring of dueRecurring) {
      if (!recurring.autoCreate) {
        continue;
      }

      try {
        // Create the transaction
        const transaction = await this.transactionRepo.create({
          userId: recurring.userId,
          accountId: recurring.accountId ?? undefined,
          transactionType: recurring.type as 'INCOME' | 'EXPENSE',
          amount: Number(recurring.amount),
          transactionDate: recurring.nextOccurrence!,
          description: recurring.description ?? 'Recurring transaction',
          vendor: recurring.vendor ?? undefined,
          isTaxDeductible: recurring.isDeductible,
        });

        // Update the recurring transaction using markProcessed which handles both
        // lastOccurrence and nextOccurrence updates
        await this.recurringRepo.markProcessed(recurring.id);

        created++;

        // Send notification
        if (this.onNotification) {
          await this.onNotification({
            recurringId: recurring.id,
            userId: recurring.userId,
            description: recurring.description ?? 'Recurring transaction',
            amount: Number(recurring.amount),
            dueDate: recurring.nextOccurrence!,
            isUpcoming: false,
          });
        }

        this.logger.debug(
          {
            recurringId: recurring.id,
            transactionId: transaction.id,
            amount: recurring.amount,
          },
          'Created transaction from recurring'
        );
      } catch (error) {
        this.logger.error(
          { error, recurringId: recurring.id },
          'Failed to create transaction from recurring'
        );
      }
    }

    return created;
  }

  /**
   * Send reminders for upcoming recurring transactions
   * Sends reminders 3 days before occurrence for all active recurring transactions
   */
  private async sendUpcomingReminders(): Promise<number> {
    // Find all active recurring transactions with upcoming occurrences
    const now = new Date();
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 3); // 3 days ahead

    // Get transactions due in exactly 3 days
    const upcoming = await this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        nextOccurrence: {
          gte: now,
          lte: reminderDate,
        },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });

    let reminders = 0;

    for (const recurring of upcoming) {
      const nextOccurrence = recurring.nextOccurrence!;
      const daysUntil = Math.ceil(
        (nextOccurrence.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Only send reminder at 3 days before
      if (daysUntil !== 3) {
        continue;
      }

      // Check if reminder already sent (using Redis)
      const reminderKey = `recurring-reminder:${recurring.id}:${nextOccurrence.toISOString().split('T')[0]}`;
      const alreadySent = await this.redis.get(reminderKey);

      if (alreadySent) {
        continue;
      }

      try {
        if (this.onNotification) {
          await this.onNotification({
            recurringId: recurring.id,
            userId: recurring.userId,
            description: recurring.description ?? 'Recurring transaction',
            amount: Number(recurring.amount),
            dueDate: nextOccurrence,
            isUpcoming: true,
          });
        }

        // Mark reminder as sent (expires after 30 days)
        await this.redis.setex(reminderKey, 30 * 24 * 60 * 60, '1');
        reminders++;

        this.logger.debug(
          { recurringId: recurring.id, daysUntil },
          'Sent upcoming transaction reminder'
        );
      } catch (error) {
        this.logger.error({ error, recurringId: recurring.id }, 'Failed to send reminder');
      }
    }

    return reminders;
  }

  /**
   * Deactivate recurring transactions that have expired
   */
  private async deactivateExpired(): Promise<number> {
    const now = new Date();
    let deactivated = 0;

    // Find active recurring transactions with end dates in the past
    const expired = await this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        endDate: { lt: now },
      },
    });

    for (const recurring of expired) {
      try {
        await this.recurringRepo.update(recurring.id, { isActive: false });
        deactivated++;

        this.logger.debug(
          { recurringId: recurring.id, endDate: recurring.endDate },
          'Deactivated expired recurring transaction'
        );
      } catch (error) {
        this.logger.error(
          { error, recurringId: recurring.id },
          'Failed to deactivate recurring transaction'
        );
      }
    }

    return deactivated;
  }

  /**
   * Calculate the next occurrence date based on frequency
   */
  private calculateNextOccurrence(recurring: RecurringTransaction): Date | null {
    const current = recurring.nextOccurrence ?? recurring.startDate;
    const next = new Date(current);

    switch (recurring.frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;

      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;

      case 'BIWEEKLY':
        next.setDate(next.getDate() + 14);
        break;

      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        // Handle day of month preference
        if (recurring.dayOfMonth) {
          const targetDay = Math.min(
            recurring.dayOfMonth,
            this.getDaysInMonth(next.getFullYear(), next.getMonth())
          );
          next.setDate(targetDay);
        }
        break;

      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;

      case 'YEARLY':
        next.setFullYear(next.getFullYear() + 1);
        break;

      default:
        return null;
    }

    // Check if past end date
    if (recurring.endDate && next > recurring.endDate) {
      return null;
    }

    return next;
  }

  /**
   * Get the number of days in a month
   */
  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  /**
   * Acquire a distributed lock
   */
  private async acquireLock(): Promise<boolean> {
    const result = await this.redis.set(
      LOCK_KEY,
      Date.now().toString(),
      'EX',
      LOCK_TTL_SECONDS,
      'NX'
    );
    return result === 'OK';
  }

  /**
   * Release the distributed lock
   */
  private async releaseLock(): Promise<void> {
    await this.redis.del(LOCK_KEY);
  }
}
