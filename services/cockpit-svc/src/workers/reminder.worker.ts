/**
 * @module @skillancer/cockpit-svc/workers/reminder
 * Reminder Worker - Handles reminder status updates and notifications
 */

import { ReminderService } from '../services/reminder.service.js';

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 5 minutes
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export interface ReminderNotification {
  reminderId: string;
  freelancerUserId: string;
  clientId: string;
  title: string;
  dueAt: Date;
  isOverdue: boolean;
}

export class ReminderWorker {
  private readonly reminderService: ReminderService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
    private readonly onNotification?: (notification: ReminderNotification) => Promise<void>
  ) {
    this.reminderService = new ReminderService(prisma, redis, logger);
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Reminder worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting reminder worker');

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
      this.logger.info('Reminder worker stopped');
    }
  }

  /**
   * Run a single processing cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Reminder worker already processing, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Reminder worker starting processing cycle');

      // 1. Wake up snoozed reminders that are now due
      const wokenUp = await this.wakeUpSnoozedReminders();

      // 2. Mark overdue reminders
      const markedOverdue = await this.markOverdueReminders();

      // 3. Find and send notifications for due reminders
      await this.processNotifications();

      const duration = Date.now() - startTime;
      this.logger.debug(
        { wokenUp, markedOverdue, durationMs: duration },
        'Reminder worker completed cycle'
      );
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Reminder worker failed'
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Wake up snoozed reminders that are now due
   */
  private async wakeUpSnoozedReminders(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.clientReminder.updateMany({
      where: {
        status: 'SNOOZED',
        snoozedUntil: { lte: now },
      },
      data: {
        status: 'PENDING',
        snoozedUntil: null,
      },
    });

    if (result.count > 0) {
      this.logger.info({ count: result.count }, 'Woke up snoozed reminders');
    }

    return result.count;
  }

  /**
   * Mark overdue reminders
   * Note: ReminderStatus doesn't have OVERDUE, so we just count them
   * The isOverdue flag in notifications is determined by comparing dueAt to now
   */
  private async markOverdueReminders(): Promise<number> {
    const now = new Date();

    // Count overdue reminders for logging purposes
    const overdueCount = await this.prisma.clientReminder.count({
      where: {
        status: 'PENDING',
        dueAt: { lt: now },
        notificationSent: false,
      },
    });

    if (overdueCount > 0) {
      this.logger.info({ count: overdueCount }, 'Found overdue reminders awaiting notification');
    }

    return overdueCount;
  }

  /**
   * Process and send notifications for due reminders
   */
  private async processNotifications(): Promise<void> {
    if (!this.onNotification) {
      return;
    }

    // Get reminders due in the next 15 minutes that haven't been notified
    const fifteenMinutesFromNow = new Date();
    fifteenMinutesFromNow.setMinutes(fifteenMinutesFromNow.getMinutes() + 15);

    const dueReminders = await this.prisma.clientReminder.findMany({
      where: {
        status: 'PENDING',
        dueAt: {
          lte: fifteenMinutesFromNow,
        },
        notificationSent: false,
      },
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      take: 100,
    });

    for (const reminder of dueReminders) {
      try {
        const notification: ReminderNotification = {
          reminderId: reminder.id,
          freelancerUserId: reminder.freelancerUserId,
          clientId: reminder.clientId,
          title: reminder.title,
          dueAt: reminder.dueAt,
          isOverdue: reminder.dueAt < new Date(),
        };

        await this.onNotification(notification);

        // Mark as notified
        await this.prisma.clientReminder.update({
          where: { id: reminder.id },
          data: { notificationSent: true },
        });

        this.logger.debug(
          { reminderId: reminder.id, freelancerUserId: reminder.freelancerUserId },
          'Sent reminder notification'
        );
      } catch (error) {
        this.logger.error(
          {
            reminderId: reminder.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to send reminder notification'
        );
      }
    }
  }

  /**
   * Get count of pending notifications
   */
  async getPendingNotificationCount(): Promise<number> {
    const fifteenMinutesFromNow = new Date();
    fifteenMinutesFromNow.setMinutes(fifteenMinutesFromNow.getMinutes() + 15);

    return this.prisma.clientReminder.count({
      where: {
        status: 'PENDING',
        dueAt: {
          lte: fifteenMinutesFromNow,
        },
        notificationSent: false,
      },
    });
  }
}
