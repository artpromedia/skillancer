/**
 * Email Logging Service
 *
 * Handles email event tracking, webhook processing, and logging
 */

import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const _prisma = _require('@prisma/client');
const { PrismaClient, UnsubscribeType, Prisma } = _prisma;
import { logger } from '@skillancer/logger';

// Initialize Prisma client
const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export type EmailEventType =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'dropped'
  | 'deferred'
  | 'spam_report'
  | 'unsubscribe'
  | 'group_unsubscribe'
  | 'group_resubscribe';

export interface EmailLogEntry {
  id: string;
  emailId: string;
  messageId?: string;
  event: EmailEventType;
  timestamp: Date;
  recipient: string;
  subject?: string;
  template?: string;
  metadata?: {
    userId?: string;
    tenantId?: string;
    correlationId?: string;
    source?: string;
  };
  eventData?: {
    url?: string;
    userAgent?: string;
    ip?: string;
    reason?: string;
    bounceType?: string;
    smtpId?: string;
  };
}

export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  'smtp-id'?: string;
  event: string;
  category?: string[];
  sg_event_id: string;
  sg_message_id?: string;
  reason?: string;
  status?: string;
  response?: string;
  attempt?: string;
  useragent?: string;
  ip?: string;
  url?: string;
  asm_group_id?: number;
  // Custom args
  emailId?: string;
  userId?: string;
  tenantId?: string;
  jobId?: string;
}

export interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  dropped: number;
  spamReports: number;
  unsubscribes: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

// ============================================================================
// In-Memory Storage (Replace with database in production)
// ============================================================================

// In production, this would be stored in a database like PostgreSQL or ClickHouse
const emailLogs: Map<string, EmailLogEntry[]> = new Map();
const emailStats: Map<string, { event: EmailEventType; count: number }[]> = new Map();

// Suppression list storage
interface SuppressionEntry {
  email: string;
  reason: 'bounce' | 'spam' | 'unsubscribe' | 'manual';
  addedAt: Date;
  bounceType?: string;
}
const suppressionList: Map<string, SuppressionEntry> = new Map();

// ============================================================================
// Email Logging Service
// ============================================================================

export class EmailLoggingService {
  private readonly webhookKey: string;

  constructor(webhookKey?: string) {
    this.webhookKey = webhookKey || process.env.SENDGRID_WEBHOOK_KEY || '';
  }

  // --------------------------------------------------------------------------
  // Logging
  // --------------------------------------------------------------------------

  /**
   * Log an email event
   */
  async logEvent(entry: Omit<EmailLogEntry, 'id'>): Promise<EmailLogEntry> {
    const log: EmailLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
    };

    // Get or create log array for this email
    const logs = emailLogs.get(log.emailId) || [];
    logs.push(log);
    emailLogs.set(log.emailId, logs);

    // Update stats
    this.updateStats(log);

    logger.info(
      {
        emailId: log.emailId,
        event: log.event,
        recipient: log.recipient,
        messageId: log.messageId,
      },
      'Email event logged'
    );

    return log;
  }

  /**
   * Log email queued
   */
  async logQueued(
    emailId: string,
    recipient: string,
    subject: string,
    metadata?: EmailLogEntry['metadata']
  ): Promise<EmailLogEntry> {
    return this.logEvent({
      emailId,
      event: 'queued',
      timestamp: new Date(),
      recipient,
      subject,
      metadata,
    });
  }

  /**
   * Log email sent
   */
  async logSent(
    emailId: string,
    messageId: string,
    recipient: string,
    subject: string,
    metadata?: EmailLogEntry['metadata']
  ): Promise<EmailLogEntry> {
    return this.logEvent({
      emailId,
      messageId,
      event: 'sent',
      timestamp: new Date(),
      recipient,
      subject,
      metadata,
    });
  }

  /**
   * Get logs for an email
   */
  async getEmailLogs(emailId: string): Promise<EmailLogEntry[]> {
    return emailLogs.get(emailId) || [];
  }

  /**
   * Get logs by message ID
   */
  async getLogsByMessageId(messageId: string): Promise<EmailLogEntry[]> {
    const results: EmailLogEntry[] = [];
    for (const logs of emailLogs.values()) {
      for (const log of logs) {
        if (log.messageId === messageId) {
          results.push(log);
        }
      }
    }
    return results;
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit = 100): Promise<EmailLogEntry[]> {
    const allLogs: EmailLogEntry[] = [];
    for (const logs of emailLogs.values()) {
      allLogs.push(...logs);
    }

    const sorted = [...allLogs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return sorted.slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  /**
   * Update stats for an email event
   */
  private updateStats(log: EmailLogEntry): void {
    const dateKey = log.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    const stats = emailStats.get(dateKey) || [];

    const existingStat = stats.find((s) => s.event === log.event);
    if (existingStat) {
      existingStat.count++;
    } else {
      stats.push({ event: log.event, count: 1 });
    }

    emailStats.set(dateKey, stats);
  }

  /**
   * Get email statistics for a date range
   */
  async getStats(startDate: Date, endDate: Date): Promise<EmailStats> {
    const stats: EmailStats = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      dropped: 0,
      spamReports: 0,
      unsubscribes: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
    };

    const start = startDate.getTime();
    const end = endDate.getTime();

    for (const [dateKey, dayStats] of emailStats.entries()) {
      const date = new Date(dateKey).getTime();
      if (date >= start && date <= end) {
        for (const stat of dayStats) {
          switch (stat.event) {
            case 'sent':
              stats.sent += stat.count;
              break;
            case 'delivered':
              stats.delivered += stat.count;
              break;
            case 'opened':
              stats.opened += stat.count;
              break;
            case 'clicked':
              stats.clicked += stat.count;
              break;
            case 'bounced':
              stats.bounced += stat.count;
              break;
            case 'dropped':
              stats.dropped += stat.count;
              break;
            case 'spam_report':
              stats.spamReports += stat.count;
              break;
            case 'unsubscribe':
            case 'group_unsubscribe':
              stats.unsubscribes += stat.count;
              break;
          }
        }
      }
    }

    // Calculate rates
    if (stats.delivered > 0) {
      stats.openRate = (stats.opened / stats.delivered) * 100;
      stats.clickRate = (stats.clicked / stats.delivered) * 100;
    }
    if (stats.sent > 0) {
      stats.bounceRate = (stats.bounced / stats.sent) * 100;
    }

    return stats;
  }

  /**
   * Get stats for today
   */
  async getTodayStats(): Promise<EmailStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getStats(today, tomorrow);
  }

  // --------------------------------------------------------------------------
  // Webhook Processing
  // --------------------------------------------------------------------------

  /**
   * Verify SendGrid webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    if (!this.webhookKey) {
      logger.warn({}, 'SendGrid webhook key not configured');
      return false;
    }

    const timestampPayload = timestamp + payload;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookKey)
      .update(timestampPayload)
      .digest('base64');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Process SendGrid webhook events
   */
  async processWebhook(events: SendGridWebhookEvent[]): Promise<EmailLogEntry[]> {
    const logs: EmailLogEntry[] = [];

    for (const event of events) {
      try {
        const log = await this.processWebhookEvent(event);
        if (log) {
          logs.push(log);
        }
      } catch (error) {
        logger.error(
          {
            event: event.event,
            sgEventId: event.sg_event_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to process webhook event'
        );
      }
    }

    logger.info(
      {
        total: events.length,
        logged: logs.length,
      },
      'Webhook events processed'
    );

    return logs;
  }

  /**
   * Process a single webhook event
   */
  private async processWebhookEvent(event: SendGridWebhookEvent): Promise<EmailLogEntry | null> {
    const eventType = this.mapSendGridEvent(event.event);
    if (!eventType) {
      logger.debug({ event: event.event }, 'Ignoring unknown event type');
      return null;
    }

    const emailId = event.emailId || event.sg_message_id || crypto.randomUUID();

    const log = await this.logEvent({
      emailId,
      messageId: event.sg_message_id,
      event: eventType,
      timestamp: new Date(event.timestamp * 1000),
      recipient: event.email,
      metadata: {
        userId: event.userId,
        tenantId: event.tenantId,
      },
      eventData: {
        url: event.url,
        userAgent: event.useragent,
        ip: event.ip,
        reason: event.reason,
        bounceType: event.status,
        smtpId: event['smtp-id'],
      },
    });

    // Handle specific events
    switch (eventType) {
      case 'bounced':
        await this.handleBounce(event);
        break;
      case 'spam_report':
        await this.handleSpamReport(event);
        break;
      case 'unsubscribe':
      case 'group_unsubscribe':
        await this.handleUnsubscribe(event);
        break;
    }

    return log;
  }

  /**
   * Map SendGrid event to our event type
   */
  private mapSendGridEvent(sgEvent: string): EmailEventType | null {
    const eventMap: Record<string, EmailEventType> = {
      processed: 'sent',
      delivered: 'delivered',
      open: 'opened',
      click: 'clicked',
      bounce: 'bounced',
      dropped: 'dropped',
      deferred: 'deferred',
      spamreport: 'spam_report',
      unsubscribe: 'unsubscribe',
      group_unsubscribe: 'group_unsubscribe',
      group_resubscribe: 'group_resubscribe',
    };

    return eventMap[sgEvent] || null;
  }

  /**
   * Handle bounce event (add to suppression list, notify, etc.)
   */
  private async handleBounce(event: SendGridWebhookEvent): Promise<void> {
    logger.warn(
      {
        email: event.email,
        reason: event.reason,
        status: event.status,
        messageId: event.sg_message_id,
      },
      'Email bounced'
    );

    // Add to suppression list
    await this.addToSuppressionList(event.email, 'bounce');

    // Log bounce event to database for the user
    if (event.userId) {
      await this.recordEmailEvent(event.userId, event.email, 'bounce', {
        reason: event.reason,
        status: event.status,
        messageId: event.sg_message_id,
      });
    }
  }

  /**
   * Handle spam report (add to suppression list, investigate, etc.)
   */
  private async handleSpamReport(event: SendGridWebhookEvent): Promise<void> {
    logger.warn(
      {
        email: event.email,
        messageId: event.sg_message_id,
      },
      'Email reported as spam'
    );

    // Add to suppression list immediately
    await this.addToSuppressionList(event.email, 'spam');

    // Log spam report event
    if (event.userId) {
      await this.recordEmailEvent(event.userId, event.email, 'spam_report', {
        messageId: event.sg_message_id,
      });
    }

    // Track spam rate for monitoring
    this.incrementSpamCounter();
  }

  /**
   * Increment spam counter for rate monitoring
   */
  private incrementSpamCounter(): void {
    const today = new Date().toISOString().split('T')[0];
    const key = `spam:${today}`;
    const current = emailStats.get(key) || [];
    const spamEntry = current.find((e) => e.event === 'spam_report');
    if (spamEntry) {
      spamEntry.count++;
    } else {
      current.push({ event: 'spam_report', count: 1 });
    }
    emailStats.set(key, current);
  }

  /**
   * Handle unsubscribe event
   */
  private async handleUnsubscribe(event: SendGridWebhookEvent): Promise<void> {
    logger.info(
      {
        email: event.email,
        groupId: event.asm_group_id,
        messageId: event.sg_message_id,
      },
      'User unsubscribed'
    );

    // Update user preferences in database
    if (event.userId) {
      try {
        // Record the unsubscribe in EmailUnsubscribe table
        await prisma.emailUnsubscribe.create({
          data: {
            userId: event.userId,
            email: event.email,
            unsubscribeType: UnsubscribeType.ALL,
            source: 'SENDGRID_WEBHOOK',
          },
        });

        // Disable email notifications for the user
        await prisma.notificationPreference.updateMany({
          where: { userId: event.userId },
          data: { emailEnabled: false },
        });
      } catch (error) {
        logger.error({ error, email: event.email }, 'Failed to update unsubscribe preferences');
      }
    }

    // Add to local suppression list
    await this.addToSuppressionList(event.email, 'unsubscribe');
  }

  /**
   * Record email event to database for a user
   */
  private async recordEmailEvent(
    userId: string,
    email: string,
    eventType: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Create notification record for email event tracking
      await prisma.notification.create({
        data: {
          userId,
          type: `EMAIL_${eventType.toUpperCase()}`,
          category: 'SYSTEM',
          priority: 'LOW',
          title: `Email ${eventType}`,
          body: `Email event: ${eventType} for ${email}`,
          channels: ['IN_APP'],
          data: (metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
        },
      });
    } catch (error) {
      logger.error({ error, userId, eventType }, 'Failed to record email event');
    }
  }

  // --------------------------------------------------------------------------
  // Suppression List Management
  // --------------------------------------------------------------------------

  /**
   * Check if an email is suppressed
   */
  async isEmailSuppressed(email: string): Promise<boolean> {
    // Check in-memory cache first
    if (suppressionList.has(email.toLowerCase())) {
      return true;
    }

    // Check database for unsubscribe records
    try {
      const unsubscribe = await prisma.emailUnsubscribe.findFirst({
        where: {
          email: email.toLowerCase(),
          unsubscribeType: UnsubscribeType.ALL,
        },
      });
      return unsubscribe !== null;
    } catch (error) {
      logger.error({ error, email }, 'Failed to check suppression status');
      return false;
    }
  }

  /**
   * Add email to suppression list
   */
  async addToSuppressionList(
    email: string,
    reason: 'bounce' | 'spam' | 'unsubscribe' | 'manual'
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    // Add to in-memory cache
    suppressionList.set(normalizedEmail, {
      email: normalizedEmail,
      reason,
      addedAt: new Date(),
    });

    logger.info({ email: normalizedEmail, reason }, 'Email added to suppression list');
  }

  /**
   * Remove email from suppression list
   */
  async removeFromSuppressionList(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    // Remove from in-memory cache
    suppressionList.delete(normalizedEmail);

    // Remove from database
    try {
      await prisma.emailUnsubscribe.deleteMany({
        where: { email: normalizedEmail },
      });
    } catch (error) {
      logger.error({ error, email: normalizedEmail }, 'Failed to remove from suppression list');
    }

    logger.info({ email: normalizedEmail }, 'Email removed from suppression list');
  }

  // --------------------------------------------------------------------------
  // Reporting
  // --------------------------------------------------------------------------

  /**
   * Aggregate bounce reasons from logs
   */
  private aggregateBounceReasons(): Array<{ reason: string; count: number }> {
    const bounceReasons = new Map<string, number>();
    for (const logs of emailLogs.values()) {
      for (const log of logs) {
        if (log.event === 'bounced' && log.eventData?.reason) {
          const count = bounceReasons.get(log.eventData.reason) || 0;
          bounceReasons.set(log.eventData.reason, count + 1);
        }
      }
    }
    return Array.from(bounceReasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Generate hourly breakdown of sent/delivered emails
   */
  private generateHourlyBreakdown(): Array<{ hour: number; sent: number; delivered: number }> {
    const hourlyData = new Map<number, { sent: number; delivered: number }>();
    for (let hour = 0; hour < 24; hour++) {
      hourlyData.set(hour, { sent: 0, delivered: 0 });
    }
    for (const logs of emailLogs.values()) {
      for (const log of logs) {
        const hour = log.timestamp.getHours();
        const data = hourlyData.get(hour);
        if (data) {
          if (log.event === 'sent') data.sent++;
          if (log.event === 'delivered') data.delivered++;
        }
      }
    }
    return Array.from(hourlyData.entries()).map(([hour, data]) => ({
      hour,
      ...data,
    }));
  }

  /**
   * Generate email delivery report
   */
  async generateReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    stats: EmailStats;
    topBounceReasons: Array<{ reason: string; count: number }>;
    hourlyBreakdown: Array<{ hour: number; sent: number; delivered: number }>;
  }> {
    const stats = await this.getStats(startDate, endDate);
    const topBounceReasons = this.aggregateBounceReasons();
    const hourlyBreakdown = this.generateHourlyBreakdown();

    return {
      stats,
      topBounceReasons,
      hourlyBreakdown,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let emailLoggingInstance: EmailLoggingService | null = null;

export function getEmailLoggingService(): EmailLoggingService {
  if (!emailLoggingInstance) {
    emailLoggingInstance = new EmailLoggingService();
  }
  return emailLoggingInstance;
}
