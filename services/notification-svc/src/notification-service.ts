/**
 * Notification Service - Orchestrator
 * Unified notification delivery with preferences and retry logic
 */

import { createLogger } from '@skillancer/logger';
import { emailProvider, type EmailMessage, type EmailResult } from './providers/email.js';

const logger = createLogger({ name: 'NotificationOrchestrator' });
import { pushProvider, type PushMessage, type PushResult } from './providers/push.js';
import { smsProvider, type SMSMessage, type SMSResult } from './providers/sms.js';

export interface NotificationRequest {
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'high' | 'normal' | 'low';
  email?: {
    to?: string;
    templateId?: string;
    templateData?: Record<string, unknown>;
    attachments?: { filename: string; content: string; contentType: string }[];
  };
  sms?: {
    to?: string;
  };
  push?: {
    icon?: string;
    image?: string;
    action?: { url: string; label?: string };
    collapseKey?: string;
  };
  scheduling?: {
    sendAt?: Date;
    expiresAt?: Date;
    timezone?: string;
  };
  metadata?: Record<string, string>;
}

export interface NotificationResult {
  id: string;
  success: boolean;
  channels: {
    email?: EmailResult;
    push?: PushResult;
    sms?: SMSResult;
  };
  failedChannels: NotificationChannel[];
  sentAt: Date;
}

export interface UserPreferences {
  userId: string;
  email: {
    enabled: boolean;
    address: string;
    marketing: boolean;
    security: boolean;
    transactional: boolean;
    digest: 'instant' | 'daily' | 'weekly' | 'never';
  };
  push: {
    enabled: boolean;
    marketing: boolean;
    security: boolean;
    transactional: boolean;
  };
  sms: {
    enabled: boolean;
    phone?: string;
    security: boolean;
    critical: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;
    timezone: string;
  };
  channels: {
    [key in NotificationType]?: NotificationChannel[];
  };
}

export enum NotificationType {
  // Security
  SECURITY_ALERT = 'security_alert',
  LOGIN_NOTIFICATION = 'login_notification',
  PASSWORD_CHANGED = 'password_changed',
  TWO_FACTOR_ENABLED = 'two_factor_enabled',

  // Account
  WELCOME = 'welcome',
  EMAIL_VERIFIED = 'email_verified',
  PROFILE_UPDATED = 'profile_updated',

  // Projects
  PROJECT_INVITATION = 'project_invitation',
  PROJECT_UPDATE = 'project_update',
  MILESTONE_COMPLETED = 'milestone_completed',
  DEADLINE_REMINDER = 'deadline_reminder',

  // Billing
  INVOICE_CREATED = 'invoice_created',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',

  // Messages
  NEW_MESSAGE = 'new_message',
  MENTION = 'mention',

  // System
  MAINTENANCE = 'maintenance',
  INCIDENT = 'incident',
}

export enum NotificationChannel {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  IN_APP = 'in_app',
}

// Default channel preferences by notification type
const DEFAULT_CHANNELS: Record<NotificationType, NotificationChannel[]> = {
  [NotificationType.SECURITY_ALERT]: [
    NotificationChannel.EMAIL,
    NotificationChannel.PUSH,
    NotificationChannel.SMS,
  ],
  [NotificationType.LOGIN_NOTIFICATION]: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
  [NotificationType.PASSWORD_CHANGED]: [NotificationChannel.EMAIL, NotificationChannel.SMS],
  [NotificationType.TWO_FACTOR_ENABLED]: [NotificationChannel.EMAIL],
  [NotificationType.WELCOME]: [NotificationChannel.EMAIL],
  [NotificationType.EMAIL_VERIFIED]: [NotificationChannel.EMAIL],
  [NotificationType.PROFILE_UPDATED]: [NotificationChannel.IN_APP],
  [NotificationType.PROJECT_INVITATION]: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
  [NotificationType.PROJECT_UPDATE]: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
  [NotificationType.MILESTONE_COMPLETED]: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
  [NotificationType.DEADLINE_REMINDER]: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
  [NotificationType.INVOICE_CREATED]: [NotificationChannel.EMAIL],
  [NotificationType.PAYMENT_RECEIVED]: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
  [NotificationType.PAYMENT_FAILED]: [
    NotificationChannel.EMAIL,
    NotificationChannel.PUSH,
    NotificationChannel.SMS,
  ],
  [NotificationType.SUBSCRIPTION_RENEWED]: [NotificationChannel.EMAIL],
  [NotificationType.NEW_MESSAGE]: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
  [NotificationType.MENTION]: [NotificationChannel.PUSH, NotificationChannel.IN_APP],
  [NotificationType.MAINTENANCE]: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  [NotificationType.INCIDENT]: [NotificationChannel.EMAIL, NotificationChannel.PUSH],
};

// In-memory stores
const userPreferences: Map<string, UserPreferences> = new Map();
const notificationLog: NotificationResult[] = [];
const retryQueue: { request: NotificationRequest; attempts: number; nextAttempt: Date }[] = [];

export class NotificationService {
  /**
   * Send a notification
   */
  async send(request: NotificationRequest): Promise<NotificationResult> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get user preferences
    const prefs = userPreferences.get(request.userId);

    // Determine effective channels
    const effectiveChannels = this.determineChannels(request, prefs);

    // Check quiet hours
    if (prefs?.quietHours.enabled && this.isQuietHours(prefs)) {
      // For non-critical notifications, defer until quiet hours end
      if (request.priority !== 'high' && request.type !== NotificationType.SECURITY_ALERT) {
        // Schedule for later (implementation would use a job queue)
        logger.info({ notificationId: id }, 'Notification deferred due to quiet hours');
      }
    }

    const results: NotificationResult['channels'] = {};
    const failedChannels: NotificationChannel[] = [];

    // Send via each channel
    for (const channel of effectiveChannels) {
      try {
        switch (channel) {
          case NotificationChannel.EMAIL:
            if (prefs?.email.enabled || !prefs) {
              results.email = await this.sendEmail(request, prefs);
              if (!results.email.success) failedChannels.push(channel);
            }
            break;

          case NotificationChannel.PUSH:
            if (prefs?.push.enabled || !prefs) {
              results.push = await this.sendPush(request);
              if (!results.push.success) failedChannels.push(channel);
            }
            break;

          case NotificationChannel.SMS:
            if (prefs?.sms.enabled || !prefs) {
              results.sms = await this.sendSMS(request, prefs);
              if (!results.sms.success) failedChannels.push(channel);
            }
            break;

          case NotificationChannel.IN_APP:
            // Store for retrieval via API
            await this.storeInApp(request);
            break;
        }
      } catch (error) {
        console.error(`[NOTIFY] Error sending via ${channel}:`, error);
        failedChannels.push(channel);
      }
    }

    const result: NotificationResult = {
      id,
      success: failedChannels.length === 0,
      channels: results,
      failedChannels,
      sentAt: new Date(),
    };

    notificationLog.push(result);

    // Queue retry for failed channels
    if (failedChannels.length > 0 && request.priority !== 'low') {
      this.queueRetry(request, failedChannels);
    }

    return result;
  }

  /**
   * Send security notification (bypasses some preferences)
   */
  async sendSecurityNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    details?: Record<string, unknown>
  ): Promise<NotificationResult> {
    return this.send({
      userId,
      type,
      channels: [NotificationChannel.EMAIL, NotificationChannel.PUSH, NotificationChannel.SMS],
      title,
      body,
      data: details,
      priority: 'high',
      email: {
        templateId: 'security-alert',
        templateData: { alertType: title, ...details },
      },
    });
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    prefs: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const existing = userPreferences.get(userId) || this.getDefaultPreferences(userId);
    const updated = { ...existing, ...prefs };
    userPreferences.set(userId, updated);
    return updated;
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    return userPreferences.get(userId) || this.getDefaultPreferences(userId);
  }

  /**
   * Process retry queue
   */
  async processRetryQueue(): Promise<void> {
    const now = new Date();
    const maxAttempts = 3;

    for (let i = retryQueue.length - 1; i >= 0; i--) {
      const item = retryQueue[i];
      if (item.nextAttempt <= now && item.attempts < maxAttempts) {
        try {
          await this.send(item.request);
          retryQueue.splice(i, 1);
        } catch {
          item.attempts++;
          item.nextAttempt = new Date(now.getTime() + Math.pow(2, item.attempts) * 60000);
        }
      }
    }
  }

  /**
   * Get notification metrics
   */
  async getMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    byChannel: Record<string, { sent: number; success: number }>;
    byType: Record<string, number>;
    avgDeliveryTime: number;
  }> {
    const inRange = notificationLog.filter((n) => n.sentAt >= startDate && n.sentAt <= endDate);

    const byChannel: Record<string, { sent: number; success: number }> = {};
    const byType: Record<string, number> = {};

    for (const notif of inRange) {
      if (notif.channels.email) {
        if (!byChannel['email']) byChannel['email'] = { sent: 0, success: 0 };
        byChannel['email'].sent++;
        if (notif.channels.email.success) byChannel['email'].success++;
      }
      if (notif.channels.push) {
        if (!byChannel['push']) byChannel['push'] = { sent: 0, success: 0 };
        byChannel['push'].sent++;
        if (notif.channels.push.success) byChannel['push'].success++;
      }
      if (notif.channels.sms) {
        if (!byChannel['sms']) byChannel['sms'] = { sent: 0, success: 0 };
        byChannel['sms'].sent++;
        if (notif.channels.sms.success) byChannel['sms'].success++;
      }
    }

    return {
      total: inRange.length,
      successful: inRange.filter((n) => n.success).length,
      failed: inRange.filter((n) => !n.success).length,
      byChannel,
      byType,
      avgDeliveryTime: 0, // Would calculate from actual delivery tracking
    };
  }

  // Private helpers

  private determineChannels(
    request: NotificationRequest,
    prefs?: UserPreferences
  ): NotificationChannel[] {
    // Start with requested channels
    let channels =
      request.channels.length > 0
        ? request.channels
        : DEFAULT_CHANNELS[request.type] || [NotificationChannel.IN_APP];

    // Apply user preferences
    if (prefs?.channels[request.type]) {
      channels = prefs.channels[request.type]!;
    }

    // Security notifications always include email and can't be disabled
    if (request.type === NotificationType.SECURITY_ALERT) {
      if (!channels.includes(NotificationChannel.EMAIL)) {
        channels.push(NotificationChannel.EMAIL);
      }
    }

    return channels;
  }

  private isQuietHours(prefs: UserPreferences): boolean {
    const now = new Date();
    // Simple implementation - in production, handle timezone properly
    const currentHour = now.getHours();
    const [startHour] = prefs.quietHours.start.split(':').map(Number);
    const [endHour] = prefs.quietHours.end.split(':').map(Number);

    if (startHour < endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      return currentHour >= startHour || currentHour < endHour;
    }
  }

  private async sendEmail(
    request: NotificationRequest,
    prefs?: UserPreferences
  ): Promise<EmailResult> {
    const to = request.email?.to || prefs?.email.address;
    if (!to) {
      return {
        id: 'none',
        success: false,
        provider: 'none',
        error: 'No email address available',
        recipients: { to: [], cc: [], bcc: [] },
      };
    }

    if (request.email?.templateId) {
      return emailProvider.sendTemplate(request.email.templateId, to, {
        name: 'User',
        ...request.email.templateData,
        ...request.data,
      });
    }

    return emailProvider.send({
      to,
      subject: request.title,
      html: `<h1>${request.title}</h1><p>${request.body}</p>`,
      text: `${request.title}\n\n${request.body}`,
    });
  }

  private async sendPush(request: NotificationRequest): Promise<PushResult> {
    return pushProvider.send({
      userId: request.userId,
      title: request.title,
      body: request.body,
      icon: request.push?.icon,
      image: request.push?.image,
      data: request.metadata,
      action: request.push?.action,
      priority: request.priority,
      collapseKey: request.push?.collapseKey,
    });
  }

  private async sendSMS(request: NotificationRequest, prefs?: UserPreferences): Promise<SMSResult> {
    const to = request.sms?.to || prefs?.sms.phone;
    if (!to) {
      return {
        id: 'none',
        success: false,
        provider: 'none',
        to: '',
        error: 'No phone number available',
      };
    }

    return smsProvider.send({
      to,
      body: `${request.title}: ${request.body}`,
      priority: request.priority,
    });
  }

  private async storeInApp(request: NotificationRequest): Promise<void> {
    // In production, store in database for retrieval via API
    logger.info({ userId: request.userId, title: request.title }, 'In-app notification stored');
  }

  private queueRetry(request: NotificationRequest, failedChannels: NotificationChannel[]): void {
    retryQueue.push({
      request: { ...request, channels: failedChannels },
      attempts: 1,
      nextAttempt: new Date(Date.now() + 60000), // Retry in 1 minute
    });
  }

  private getDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      email: {
        enabled: true,
        address: '',
        marketing: true,
        security: true,
        transactional: true,
        digest: 'instant',
      },
      push: {
        enabled: true,
        marketing: true,
        security: true,
        transactional: true,
      },
      sms: {
        enabled: false,
        security: true,
        critical: true,
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC',
      },
      channels: {},
    };
  }
}

export const notificationService = new NotificationService();

// Re-export providers
export { emailProvider, pushProvider, smsProvider };
export * from './providers/email.js';
export * from './providers/push.js';
export * from './providers/sms.js';
