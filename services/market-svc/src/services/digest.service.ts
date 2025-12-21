/**
 * @module @skillancer/market-svc/services/digest
 * Service for processing and sending notification digests
 */

import type { EmailService } from './email.service.js';
import type { NotificationDigestRepository } from '../repositories/notification-digest.repository.js';
import type { NotificationRepository } from '../repositories/notification.repository.js';
import type { DigestSummary } from '../types/notification.types.js';
import type { PrismaClient, Notification, NotificationCategory } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export interface DigestService {
  processPendingDigests(): Promise<{ processed: number; sent: number; failed: number }>;
  generateDigestSummary(notificationIds: string[]): Promise<DigestSummary>;
  cleanupOldDigests(retentionDays?: number): Promise<number>;
}

export interface DigestServiceDependencies {
  prisma: PrismaClient;
  logger: Logger;
  digestRepository: NotificationDigestRepository;
  notificationRepository: NotificationRepository;
  emailService: EmailService;
}

// Helper: Get period label from digest type
function getPeriodLabel(digestType: string): string {
  if (digestType === 'HOURLY') return 'hour';
  if (digestType === 'DAILY') return 'day';
  return 'week';
}

// Helper: Get period label capitalized
function getPeriodLabelCapitalized(digestType: string): string {
  if (digestType === 'HOURLY') return 'Hourly';
  if (digestType === 'DAILY') return 'Daily';
  return 'Weekly';
}

// Helper: Format category name
function formatCategory(category: string): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

// Helper: Format time for display
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

// Helper: Escape HTML characters
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Generate HTML for digest email
function generateDigestHtml(
  userName: string,
  digestType: string,
  summary: DigestSummary,
  notifications: Notification[]
): string {
  const periodLabel = getPeriodLabel(digestType);

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skillancer Notification Digest</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #fff; border: 1px solid #e0e0e0; border-top: none; padding: 30px; border-radius: 0 0 12px 12px; }
    .notification { border-left: 4px solid #667eea; padding: 15px; margin: 15px 0; background: #f8f9fa; border-radius: 0 8px 8px 0; }
    .notification-title { font-weight: 600; margin-bottom: 5px; }
    .notification-body { color: #666; font-size: 14px; }
    .notification-time { color: #999; font-size: 12px; margin-top: 5px; }
    .category-header { font-size: 16px; font-weight: 600; color: #667eea; margin: 25px 0 15px; padding-bottom: 8px; border-bottom: 2px solid #e0e0e0; }
    .summary { background: #f0f4ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; }
    .summary-item { display: inline-block; margin-right: 20px; }
    .summary-count { font-size: 24px; font-weight: bold; color: #667eea; }
    .summary-label { font-size: 12px; color: #666; }
    .cta-button { display: inline-block; background: #667eea; color: white !important; padding: 12px 30px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
    .unsubscribe { color: #999; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">Your ${periodLabel}ly digest</h1>
    <p style="margin: 10px 0 0; opacity: 0.9;">Hi ${userName}, here's what you missed</p>
  </div>
  <div class="content">
    <div class="summary">
      <div class="summary-item">
        <div class="summary-count">${summary.totalCount}</div>
        <div class="summary-label">Total Notifications</div>
      </div>`;

  // Add category counts
  for (const [category, count] of Object.entries(summary.byCategory)) {
    if (count > 0) {
      html += `
      <div class="summary-item">
        <div class="summary-count">${count}</div>
        <div class="summary-label">${formatCategory(category)}</div>
      </div>`;
    }
  }

  html += `
    </div>`;

  // Group notifications by category
  const byCategory = new Map<string, Notification[]>();
  for (const notification of notifications) {
    const cat = notification.category;
    const existing = byCategory.get(cat);
    if (existing) {
      existing.push(notification);
    } else {
      byCategory.set(cat, [notification]);
    }
  }

  // Render notifications by category
  for (const [category, categoryNotifications] of byCategory) {
    html += `
    <div class="category-header">${formatCategory(category)}</div>`;

    for (const notification of categoryNotifications.slice(0, 5)) {
      html += `
    <div class="notification">
      <div class="notification-title">${escapeHtml(notification.title)}</div>
      <div class="notification-body">${escapeHtml(notification.body)}</div>
      <div class="notification-time">${formatTime(notification.createdAt)}</div>
    </div>`;
    }

    if (categoryNotifications.length > 5) {
      html += `
    <p style="color: #666; font-style: italic;">...and ${categoryNotifications.length - 5} more</p>`;
    }
  }

  html += `
    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.APP_URL || 'https://skillancer.com'}/notifications" class="cta-button">View All Notifications</a>
    </div>
  </div>
  <div class="footer">
    <p>You're receiving this digest because you subscribed to ${periodLabel}ly email notifications.</p>
    <p><a href="${process.env.APP_URL || 'https://skillancer.com'}/settings/notifications" class="unsubscribe">Manage your notification preferences</a></p>
    <p>&copy; ${new Date().getFullYear()} Skillancer. All rights reserved.</p>
  </div>
</body>
</html>`;

  return html;
}

// Generate plain text for digest email
function generateDigestText(
  userName: string,
  digestType: string,
  summary: DigestSummary,
  notifications: Notification[]
): string {
  const periodLabel = getPeriodLabel(digestType);

  let text = `Your ${periodLabel}ly digest\n\nHi ${userName}, here's what you missed:\n\n`;
  text += `Total notifications: ${summary.totalCount}\n\n`;

  // Group by category
  const byCategory = new Map<string, Notification[]>();
  for (const notification of notifications) {
    const cat = notification.category;
    const existing = byCategory.get(cat);
    if (existing) {
      existing.push(notification);
    } else {
      byCategory.set(cat, [notification]);
    }
  }

  for (const [category, categoryNotifications] of byCategory) {
    text += `--- ${formatCategory(category)} ---\n\n`;

    for (const notification of categoryNotifications.slice(0, 5)) {
      text += `• ${notification.title}\n  ${notification.body}\n  ${formatTime(notification.createdAt)}\n\n`;
    }

    if (categoryNotifications.length > 5) {
      text += `...and ${categoryNotifications.length - 5} more\n\n`;
    }
  }

  text += `\nView all notifications: ${process.env.APP_URL || 'https://skillancer.com'}/notifications\n`;
  text += `\nManage preferences: ${process.env.APP_URL || 'https://skillancer.com'}/settings/notifications\n`;

  return text;
}

export function createDigestService(deps: DigestServiceDependencies): DigestService {
  const { prisma, logger, digestRepository, emailService } = deps;

  return {
    async processPendingDigests(): Promise<{ processed: number; sent: number; failed: number }> {
      const now = new Date();
      const pendingDigests = await digestRepository.findPending(now);

      logger.info({
        msg: 'Processing pending digests',
        count: pendingDigests.length,
      });

      let processed = 0;
      let sent = 0;
      let failed = 0;

      for (const digest of pendingDigests) {
        processed++;

        try {
          // Mark as processing
          await digestRepository.updateStatus(digest.id, 'PROCESSING');

          // Get user info
          const user = await prisma.user.findUnique({
            where: { id: digest.userId },
            select: { id: true, email: true, firstName: true, lastName: true },
          });

          if (!user?.email) {
            logger.warn({
              msg: 'User not found or no email for digest',
              digestId: digest.id,
              userId: digest.userId,
            });
            await digestRepository.updateStatus(digest.id, 'FAILED');
            failed++;
            continue;
          }

          // Get notifications for this digest
          const notifications = await prisma.notification.findMany({
            where: {
              id: { in: digest.notificationIds },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (notifications.length === 0) {
            logger.info({
              msg: 'No notifications found for digest, skipping',
              digestId: digest.id,
            });
            await digestRepository.updateStatus(digest.id, 'SENT');
            sent++;
            continue;
          }

          // Generate summary
          const summary = await this.generateDigestSummary(digest.notificationIds);

          // Generate email content
          const userName = user.firstName || 'there';
          const html = generateDigestHtml(userName, digest.digestType, summary, notifications);
          const text = generateDigestText(userName, digest.digestType, summary, notifications);

          const periodLabel = getPeriodLabelCapitalized(digest.digestType);

          // Send email
          const result = await emailService.send({
            to: user.email,
            subject: `Your ${periodLabel} Skillancer Digest - ${summary.totalCount} notifications`,
            html,
            text,
            category: 'SYSTEM',
            notificationType: `${digest.digestType}_DIGEST`,
            metadata: {
              digestId: digest.id,
              userId: user.id,
              notificationCount: summary.totalCount,
            },
          });

          // Mark as sent
          await digestRepository.markAsSent(digest.id, result.messageId);
          sent++;

          logger.info({
            msg: 'Digest email sent',
            digestId: digest.id,
            userId: user.id,
            notificationCount: summary.totalCount,
          });
        } catch (error) {
          logger.error({
            msg: 'Failed to process digest',
            digestId: digest.id,
            error,
          });
          await digestRepository.updateStatus(digest.id, 'FAILED');
          failed++;
        }
      }

      return { processed, sent, failed };
    },

    async generateDigestSummary(notificationIds: string[]): Promise<DigestSummary> {
      const notifications = await prisma.notification.findMany({
        where: {
          id: { in: notificationIds },
        },
        select: {
          id: true,
          type: true,
          category: true,
          title: true,
          body: true,
        },
      });

      // Count by category
      const byCategory: Record<NotificationCategory, number> = {
        MESSAGES: 0,
        PROJECTS: 0,
        CONTRACTS: 0,
        PAYMENTS: 0,
        ACCOUNT: 0,
        MARKETING: 0,
        SYSTEM: 0,
      };

      const typeCount = new Map<
        string,
        { type: string; title: string; body: string; count: number }
      >();

      for (const notification of notifications) {
        byCategory[notification.category]++;

        const existing = typeCount.get(notification.type);
        if (existing) {
          existing.count++;
        } else {
          typeCount.set(notification.type, {
            type: notification.type,
            title: notification.title,
            body: notification.body,
            count: 1,
          });
        }
      }

      // Get top highlights (most frequent types)
      const highlights = Array.from(typeCount.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalCount: notifications.length,
        byCategory,
        highlights,
      };
    },

    async cleanupOldDigests(retentionDays = 30): Promise<number> {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deleted = await digestRepository.deleteOld(cutoffDate);

      logger.info({
        msg: 'Cleaned up old digests',
        deletedCount: deleted,
        retentionDays,
      });

      return deleted;
    },
  };
}
