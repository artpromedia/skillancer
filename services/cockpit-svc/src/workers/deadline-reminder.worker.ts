/**
 * @module @skillancer/cockpit-svc/workers/deadline-reminder
 * Deadline Reminder Worker - Sends notifications for upcoming project/task deadlines
 */

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Default interval: 1 hour
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

// Cache key for last run timestamp
const LAST_RUN_KEY = 'cockpit:deadline-reminder:last-run';

// Notification periods (in hours before deadline)
const NOTIFICATION_PERIODS = [24, 48, 168]; // 1 day, 2 days, 1 week

export interface DeadlineNotification {
  type: 'project' | 'task' | 'milestone';
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  freelancerUserId: string;
  deadline: Date;
  hoursRemaining: number;
  isOverdue: boolean;
}

export class DeadlineReminderWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
    private readonly onNotification?: (notification: DeadlineNotification) => Promise<void>
  ) {}

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Deadline reminder worker already running');
      return;
    }

    this.logger.info({ intervalMs: this.intervalMs }, 'Starting deadline reminder worker');

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
      this.logger.info('Deadline reminder worker stopped');
    }
  }

  /**
   * Run a single processing cycle
   */
  async run(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Deadline reminder worker already processing, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.debug('Deadline reminder worker starting processing cycle');

      const lastRun = await this.getLastRunTime();
      const now = new Date();

      // Process project deadlines
      const projectNotifications = await this.processProjectDeadlines(now, lastRun);

      // Process task deadlines
      const taskNotifications = await this.processTaskDeadlines(now, lastRun);

      // Process milestone deadlines
      const milestoneNotifications = await this.processMilestoneDeadlines(now, lastRun);

      // Mark overdue items
      await this.markOverdueItems(now);

      // Update last run time
      await this.setLastRunTime(now);

      const duration = Date.now() - startTime;
      this.logger.debug(
        {
          projectNotifications,
          taskNotifications,
          milestoneNotifications,
          durationMs: duration,
        },
        'Deadline reminder worker completed cycle'
      );
    } catch (error) {
      this.logger.error({ error }, 'Deadline reminder worker error');
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process project deadline notifications
   */
  private async processProjectDeadlines(now: Date, lastRun: Date | null): Promise<number> {
    let count = 0;

    for (const hours of NOTIFICATION_PERIODS) {
      const notifyAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const checkFrom = lastRun
        ? new Date(lastRun.getTime() + hours * 60 * 60 * 1000)
        : new Date(now.getTime() + (hours - 1) * 60 * 60 * 1000);

      const projects = await this.prisma.cockpitProject.findMany({
        where: {
          status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
          dueDate: {
            gte: checkFrom,
            lte: notifyAt,
          },
        },
        select: {
          id: true,
          name: true,
          dueDate: true,
          freelancerUserId: true,
        },
      });

      for (const project of projects) {
        if (!project.dueDate) continue;

        const hoursRemaining = Math.round(
          (project.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        await this.sendNotification({
          type: 'project',
          id: project.id,
          name: project.name,
          projectId: project.id,
          projectName: project.name,
          freelancerUserId: project.freelancerUserId,
          deadline: project.dueDate,
          hoursRemaining,
          isOverdue: hoursRemaining < 0,
        });

        count++;
      }
    }

    return count;
  }

  /**
   * Process task deadline notifications
   */
  private async processTaskDeadlines(now: Date, lastRun: Date | null): Promise<number> {
    let count = 0;

    for (const hours of NOTIFICATION_PERIODS) {
      const notifyAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const checkFrom = lastRun
        ? new Date(lastRun.getTime() + hours * 60 * 60 * 1000)
        : new Date(now.getTime() + (hours - 1) * 60 * 60 * 1000);

      const tasks = await this.prisma.projectTask.findMany({
        where: {
          status: { in: ['TODO', 'IN_PROGRESS'] },
          dueDate: {
            gte: checkFrom,
            lte: notifyAt,
          },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              freelancerUserId: true,
            },
          },
        },
      });

      for (const task of tasks) {
        if (!task.dueDate) continue;

        const hoursRemaining = Math.round(
          (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        await this.sendNotification({
          type: 'task',
          id: task.id,
          name: task.title,
          projectId: task.project.id,
          projectName: task.project.name,
          freelancerUserId: task.project.freelancerUserId,
          deadline: task.dueDate,
          hoursRemaining,
          isOverdue: hoursRemaining < 0,
        });

        count++;
      }
    }

    return count;
  }

  /**
   * Process milestone deadline notifications
   */
  private async processMilestoneDeadlines(now: Date, lastRun: Date | null): Promise<number> {
    let count = 0;

    for (const hours of NOTIFICATION_PERIODS) {
      const notifyAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const checkFrom = lastRun
        ? new Date(lastRun.getTime() + hours * 60 * 60 * 1000)
        : new Date(now.getTime() + (hours - 1) * 60 * 60 * 1000);

      const milestones = await this.prisma.projectMilestone.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: {
            gte: checkFrom,
            lte: notifyAt,
          },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              freelancerUserId: true,
            },
          },
        },
      });

      for (const milestone of milestones) {
        if (!milestone.dueDate) continue;

        const hoursRemaining = Math.round(
          (milestone.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        await this.sendNotification({
          type: 'milestone',
          id: milestone.id,
          name: milestone.title,
          projectId: milestone.project.id,
          projectName: milestone.project.name,
          freelancerUserId: milestone.project.freelancerUserId,
          deadline: milestone.dueDate,
          hoursRemaining,
          isOverdue: hoursRemaining < 0,
        });

        count++;
      }
    }

    return count;
  }

  /**
   * Mark overdue items
   */
  private async markOverdueItems(now: Date): Promise<void> {
    // Mark overdue tasks
    await this.prisma.projectTask.updateMany({
      where: {
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueDate: { lt: now },
      },
      data: {
        // Tasks don't have an isOverdue field, but we could add labels or track via status
      },
    });

    // Note: Projects and milestones don't have isOverdue fields in current schema
    // This could be handled through activity logging or a separate overdue tracking table
  }

  /**
   * Send notification
   */
  private async sendNotification(notification: DeadlineNotification): Promise<void> {
    // Check if we already sent this notification (dedup)
    const dedupKey = `cockpit:deadline-notified:${notification.type}:${notification.id}:${notification.hoursRemaining}`;
    const alreadySent = await this.redis.get(dedupKey);
    if (alreadySent) {
      return;
    }

    // Mark as sent (expires in 7 days)
    await this.redis.setex(dedupKey, 7 * 24 * 60 * 60, '1');

    // Log the notification
    this.logger.info(
      {
        type: notification.type,
        id: notification.id,
        name: notification.name,
        hoursRemaining: notification.hoursRemaining,
      },
      'Deadline notification triggered'
    );

    // Call the notification handler if provided
    if (this.onNotification) {
      try {
        await this.onNotification(notification);
      } catch (error) {
        this.logger.error({ error, notification }, 'Failed to send deadline notification');
      }
    }
  }

  /**
   * Get last run time from Redis
   */
  private async getLastRunTime(): Promise<Date | null> {
    const timestamp = await this.redis.get(LAST_RUN_KEY);
    return timestamp ? new Date(Number.parseInt(timestamp, 10)) : null;
  }

  /**
   * Set last run time in Redis
   */
  private async setLastRunTime(time: Date): Promise<void> {
    await this.redis.set(LAST_RUN_KEY, time.getTime().toString());
  }
}
