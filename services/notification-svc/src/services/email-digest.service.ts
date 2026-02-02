/**
 * Email Digest Service
 *
 * Handles daily and weekly digest emails by aggregating unread notifications
 * and sending a single consolidated email to users.
 *
 * Features:
 * - Daily digest job (cron)
 * - Weekly digest job (cron)
 * - Aggregate unread notifications by category
 * - Track last digest sent timestamp
 * - User preference for digest time
 */

import { getEmailLoggingService } from './email-logging.service.js';
import { EmailService } from './email.service.js';
import { getConfig } from '../config/index.js';

import type { EmailNotificationInput } from '../types/notification.types.js';
import type { PrismaClient, Notification } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface DigestConfig {
  digestType: 'daily' | 'weekly';
  timezone?: string;
  preferredTime?: string; // HH:mm format
}

export interface DigestNotification {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  createdAt: Date;
  data?: Record<string, unknown>;
}

export interface DigestSummary {
  userId: string;
  email: string;
  firstName: string;
  digestType: 'daily' | 'weekly';
  period: {
    start: Date;
    end: Date;
  };
  notifications: DigestNotification[];
  categoryCounts: Record<string, number>;
  totalCount: number;
}

export interface DigestResult {
  success: boolean;
  userId: string;
  email: string;
  notificationCount: number;
  error?: string;
}

export interface DigestJobResult {
  digestType: 'daily' | 'weekly';
  startTime: Date;
  endTime: Date;
  usersProcessed: number;
  emailsSent: number;
  failures: number;
  results: DigestResult[];
}

// ============================================================================
// Digest Service
// ============================================================================

export class EmailDigestService {
  private readonly prisma: PrismaClient;
  private readonly emailService: EmailService;
  private readonly config: ReturnType<typeof getConfig>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.emailService = new EmailService();
    this.config = getConfig();
  }

  /**
   * Run the daily digest job
   * Should be called by a cron job at the configured time (e.g., 9 AM)
   */
  async runDailyDigest(): Promise<DigestJobResult> {
    const startTime = new Date();
    console.log(`[DigestService] Starting daily digest job at ${startTime.toISOString()}`);

    const results: DigestResult[] = [];
    let emailsSent = 0;
    let failures = 0;

    try {
      // Get users who have digest enabled and it's their preferred time
      const users = await this.getUsersForDigest('daily');
      console.log(`[DigestService] Found ${users.length} users for daily digest`);

      for (const user of users) {
        try {
          const result = await this.sendDigestToUser(user.id, user.email, user.firstName, 'daily');
          results.push(result);
          if (result.success) {
            emailsSent++;
          } else {
            failures++;
          }
        } catch (error) {
          failures++;
          results.push({
            success: false,
            userId: user.id,
            email: user.email,
            notificationCount: 0,
            error: String(error),
          });
        }
      }
    } catch (error) {
      console.error(`[DigestService] Fatal error in daily digest:`, error);
    }

    const endTime = new Date();
    const jobResult: DigestJobResult = {
      digestType: 'daily',
      startTime,
      endTime,
      usersProcessed: results.length,
      emailsSent,
      failures,
      results,
    };

    console.log(
      `[DigestService] Daily digest completed: ${emailsSent} sent, ${failures} failed, took ${endTime.getTime() - startTime.getTime()}ms`
    );

    return jobResult;
  }

  /**
   * Run the weekly digest job
   * Should be called by a cron job once per week (e.g., Monday 9 AM)
   */
  async runWeeklyDigest(): Promise<DigestJobResult> {
    const startTime = new Date();
    console.log(`[DigestService] Starting weekly digest job at ${startTime.toISOString()}`);

    const results: DigestResult[] = [];
    let emailsSent = 0;
    let failures = 0;

    try {
      const users = await this.getUsersForDigest('weekly');
      console.log(`[DigestService] Found ${users.length} users for weekly digest`);

      for (const user of users) {
        try {
          const result = await this.sendDigestToUser(user.id, user.email, user.firstName, 'weekly');
          results.push(result);
          if (result.success) {
            emailsSent++;
          } else {
            failures++;
          }
        } catch (error) {
          failures++;
          results.push({
            success: false,
            userId: user.id,
            email: user.email,
            notificationCount: 0,
            error: String(error),
          });
        }
      }
    } catch (error) {
      console.error(`[DigestService] Fatal error in weekly digest:`, error);
    }

    const endTime = new Date();
    const jobResult: DigestJobResult = {
      digestType: 'weekly',
      startTime,
      endTime,
      usersProcessed: results.length,
      emailsSent,
      failures,
      results,
    };

    console.log(`[DigestService] Weekly digest completed: ${emailsSent} sent, ${failures} failed`);

    return jobResult;
  }

  /**
   * Send digest to a specific user
   */
  async sendDigestToUser(
    userId: string,
    email: string,
    firstName: string,
    digestType: 'daily' | 'weekly'
  ): Promise<DigestResult> {
    try {
      // Get the period for this digest
      const period = this.getDigestPeriod(digestType, userId);

      // Check when last digest was sent
      const lastDigest = await this.getLastDigestSent(userId, digestType);
      if (lastDigest && lastDigest > period.start) {
        console.log(`[DigestService] Digest already sent to ${userId} for this period`);
        return {
          success: true,
          userId,
          email,
          notificationCount: 0,
          error: 'Digest already sent for this period',
        };
      }

      // Get unread notifications for the period
      const notifications = await this.getUnreadNotifications(userId, period.start, period.end);

      if (notifications.length === 0) {
        console.log(`[DigestService] No notifications for ${userId}`);
        // Update last digest timestamp even if no notifications
        await this.updateLastDigestSent(userId, digestType);
        return {
          success: true,
          userId,
          email,
          notificationCount: 0,
        };
      }

      // Build digest summary
      const summary = this.buildDigestSummary(
        userId,
        email,
        firstName,
        digestType,
        period,
        notifications
      );

      // Send the digest email
      await this.sendDigestEmail(summary);

      // Update last digest timestamp
      await this.updateLastDigestSent(userId, digestType);

      // Mark notifications as included in digest
      await this.markNotificationsDigested(notifications.map((n) => n.id));

      return {
        success: true,
        userId,
        email,
        notificationCount: notifications.length,
      };
    } catch (error) {
      console.error(`[DigestService] Error sending digest to ${userId}:`, error);
      return {
        success: false,
        userId,
        email,
        notificationCount: 0,
        error: String(error),
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get users who should receive a digest at this time
   */
  private async getUsersForDigest(
    digestType: 'daily' | 'weekly'
  ): Promise<Array<{ id: string; email: string; firstName: string }>> {
    try {
      // Get users with digest preference enabled
      // FUTURE: Filter by preferred delivery time
      const preferences = await this.prisma.notificationPreference.findMany({
        where: {
          notificationType: digestType === 'daily' ? 'DAILY_DIGEST' : 'WEEKLY_DIGEST',
          emailEnabled: true,
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
      });

      if (preferences.length === 0) {
        return [];
      }

      // Get user details
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: preferences.map((p) => p.userId) },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
        },
      });

      return users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName || 'User',
      }));
    } catch (error) {
      console.error(`[DigestService] Error getting users for digest:`, error);
      return [];
    }
  }

  /**
   * Get the time period for a digest
   */
  private getDigestPeriod(
    digestType: 'daily' | 'weekly',
    _userId: string
  ): { start: Date; end: Date } {
    const now = new Date();
    const end = now;

    let start: Date;
    if (digestType === 'daily') {
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    } else {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    }

    return { start, end };
  }

  /**
   * Get last digest sent timestamp for a user
   */
  private async getLastDigestSent(
    userId: string,
    digestType: 'daily' | 'weekly'
  ): Promise<Date | null> {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: {
          userId,
          type: digestType === 'daily' ? 'DAILY_DIGEST' : 'WEEKLY_DIGEST',
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      return notification?.createdAt || null;
    } catch (error) {
      console.error(`[DigestService] Error getting last digest:`, error);
      return null;
    }
  }

  /**
   * Update last digest sent timestamp
   */
  private async updateLastDigestSent(
    userId: string,
    digestType: 'daily' | 'weekly'
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type: digestType === 'daily' ? 'DAILY_DIGEST' : 'WEEKLY_DIGEST',
          category: 'SYSTEM',
          priority: 'LOW',
          title: `${digestType === 'daily' ? 'Daily' : 'Weekly'} Digest Sent`,
          body: `Digest email sent at ${new Date().toISOString()}`,
          channels: ['EMAIL'],
          deliveryStatus: { email: 'SENT' },
          data: {},
        },
      });
    } catch (error) {
      console.error(`[DigestService] Error updating last digest:`, error);
    }
  }

  /**
   * Get unread notifications for a user within a time period
   */
  private async getUnreadNotifications(
    userId: string,
    start: Date,
    end: Date
  ): Promise<Notification[]> {
    try {
      return await this.prisma.notification.findMany({
        where: {
          userId,
          createdAt: {
            gte: start,
            lte: end,
          },
          readAt: null,
          // Exclude digest notifications themselves
          type: {
            notIn: ['DAILY_DIGEST', 'WEEKLY_DIGEST'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit to prevent huge emails
      });
    } catch (error) {
      console.error(`[DigestService] Error getting notifications:`, error);
      return [];
    }
  }

  /**
   * Build a digest summary from notifications
   */
  private buildDigestSummary(
    userId: string,
    email: string,
    firstName: string,
    digestType: 'daily' | 'weekly',
    period: { start: Date; end: Date },
    notifications: Notification[]
  ): DigestSummary {
    const categoryCounts: Record<string, number> = {};

    const digestNotifications: DigestNotification[] = notifications.map((n) => {
      // Count by category
      const category = n.category || 'OTHER';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;

      return {
        id: n.id,
        type: n.type,
        category,
        title: n.title,
        body: n.body || '',
        createdAt: n.createdAt,
        data: n.data as Record<string, unknown> | undefined,
      };
    });

    return {
      userId,
      email,
      firstName,
      digestType,
      period,
      notifications: digestNotifications,
      categoryCounts,
      totalCount: notifications.length,
    };
  }

  /**
   * Send the digest email
   */
  private async sendDigestEmail(summary: DigestSummary): Promise<void> {
    const loggingService = getEmailLoggingService();
    const periodLabel =
      summary.digestType === 'daily'
        ? 'today'
        : `the past week (${summary.period.start.toLocaleDateString()} - ${summary.period.end.toLocaleDateString()})`;

    // Group notifications by category for the email
    const groupedByCategory = this.groupNotificationsByCategory(summary.notifications);

    // Build email content
    const emailInput: EmailNotificationInput = {
      userId: summary.userId,
      emailType: summary.digestType === 'daily' ? 'WEEKLY_DIGEST' : 'WEEKLY_DIGEST', // Using WEEKLY_DIGEST type for both
      to: summary.email,
      subject: `${summary.digestType === 'daily' ? 'Daily' : 'Weekly'} Update: ${summary.totalCount} notification${summary.totalCount !== 1 ? 's' : ''} from Skillancer`,
      channels: ['EMAIL'],
      priority: 'LOW',
      templateData: {
        firstName: summary.firstName,
        digestType: summary.digestType,
        periodLabel,
        totalCount: summary.totalCount,
        categoryCounts: summary.categoryCounts,
        groupedNotifications: groupedByCategory,
        dashboardLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard`,
        preferencesLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/settings/notifications`,
      },
    };

    const result = await this.emailService.sendEmail(emailInput);

    if (!result.success) {
      loggingService.logEvent({
        emailId: `digest-${summary.digestType}-${summary.userId}`,
        event: 'dropped',
        recipient: summary.email,
        timestamp: new Date(),
      });
      throw new Error(`Failed to send digest email: ${result.error}`);
    }

    console.log(`[DigestService] Digest email sent to ${summary.email}`);
  }

  /**
   * Group notifications by category
   */
  private groupNotificationsByCategory(
    notifications: DigestNotification[]
  ): Record<string, DigestNotification[]> {
    const grouped: Record<string, DigestNotification[]> = {};

    for (const notification of notifications) {
      const category = notification.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(notification);
    }

    return grouped;
  }

  /**
   * Mark notifications as included in a digest
   */
  private async markNotificationsDigested(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;

    try {
      await this.prisma.notification.updateMany({
        where: { id: { in: notificationIds } },
        data: {
          data: {
            digestedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error(`[DigestService] Error marking notifications as digested:`, error);
    }
  }
}

// ============================================================================
// Factory and Cron Setup
// ============================================================================

let digestService: EmailDigestService | null = null;

export function getEmailDigestService(prisma?: PrismaClient): EmailDigestService {
  if (!digestService && prisma) {
    digestService = new EmailDigestService(prisma);
  }
  if (!digestService) {
    throw new Error('EmailDigestService not initialized. Call with PrismaClient first.');
  }
  return digestService;
}

export function initializeEmailDigestService(prisma: PrismaClient): EmailDigestService {
  digestService = new EmailDigestService(prisma);
  return digestService;
}

/**
 * Setup cron jobs for digest emails
 * Call this from the main application startup
 */
export function setupDigestCronJobs(prisma: PrismaClient): void {
  const service = initializeEmailDigestService(prisma);

  // Note: In production, use a proper job scheduler like node-cron, bull, or agenda
  // This is a simple setInterval implementation for demonstration

  // Daily digest - run at 9 AM every day
  const dailyInterval = 24 * 60 * 60 * 1000; // 24 hours
  const runDailyDigest = () => {
    const now = new Date();
    // Only run between 8-10 AM (to handle timezone variations)
    if (now.getHours() >= 8 && now.getHours() <= 10) {
      void service.runDailyDigest();
    }
  };

  // Weekly digest - run on Monday at 9 AM
  const weeklyInterval = 7 * 24 * 60 * 60 * 1000; // 7 days
  const runWeeklyDigest = () => {
    const now = new Date();
    // Only run on Monday between 8-10 AM
    if (now.getDay() === 1 && now.getHours() >= 8 && now.getHours() <= 10) {
      void service.runWeeklyDigest();
    }
  };

  // Check every hour if we should run digests
  setInterval(runDailyDigest, 60 * 60 * 1000);
  setInterval(runWeeklyDigest, 60 * 60 * 1000);

  console.log('[DigestService] Cron jobs scheduled for daily and weekly digests');
}
