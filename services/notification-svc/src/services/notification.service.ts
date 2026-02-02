/**
 * Main Notification Service
 * Orchestrates email, push, and in-app notifications
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { EmailService } from './email.service.js';
import { PushService } from './push.service.js';
import type {
  NotificationChannel,
  NotificationStatus,
  EmailNotificationInput,
  PushNotificationInput,
  NotificationResult,
  NotificationPreferences,
  DeviceToken,
  NotificationStats,
  EmailType,
} from '../types/notification.types.js';

export class NotificationService {
  private readonly emailService: EmailService;
  private readonly pushService: PushService;

  constructor(private readonly prisma: PrismaClient) {
    this.emailService = new EmailService();
    this.pushService = new PushService();
  }

  /**
   * Send email notification
   */
  async sendEmail(input: EmailNotificationInput): Promise<NotificationResult> {
    // Check user preferences
    const preferences = await this.getUserPreferences(input.userId);
    if (preferences && !preferences.email.enabled) {
      return {
        id: '',
        status: 'FAILED',
        channel: 'EMAIL',
        errorMessage: 'User has disabled email notifications',
      };
    }

    // Send email
    const result = await this.emailService.sendEmail(input);

    // Log notification
    const log = await this.logNotification({
      userId: input.userId,
      tenantId: input.tenantId,
      channel: 'EMAIL',
      type: input.emailType,
      status: result.success ? 'SENT' : 'FAILED',
      recipient: input.to,
      subject: input.subject,
      externalId: result.messageId,
      errorMessage: result.error,
      metadata: input.metadata,
    });

    return {
      id: log.id,
      status: result.success ? 'SENT' : 'FAILED',
      channel: 'EMAIL',
      sentAt: result.success ? new Date() : undefined,
      errorMessage: result.error,
      externalId: result.messageId,
    };
  }

  /**
   * Check if push notifications are disabled by user preferences
   */
  private isPushDisabledByPreferences(
    preferences: NotificationPreferences | null
  ): NotificationResult | null {
    if (preferences && !preferences.push.enabled) {
      return {
        id: '',
        status: 'FAILED',
        channel: 'PUSH',
        errorMessage: 'User has disabled push notifications',
      };
    }
    return null;
  }

  /**
   * Check if notification should be deferred due to quiet hours
   */
  private shouldDeferForQuietHours(
    preferences: NotificationPreferences | null,
    priority?: string
  ): NotificationResult | null {
    if (preferences?.quietHours.enabled && this.isQuietHours(preferences.quietHours)) {
      if (priority !== 'URGENT') {
        return {
          id: '',
          status: 'PENDING',
          channel: 'PUSH',
          errorMessage: 'Notification scheduled after quiet hours',
        };
      }
    }
    return null;
  }

  /**
   * Resolve device tokens for push notification
   */
  private async resolveDeviceTokens(
    providedTokens: string[] | undefined,
    userId?: string
  ): Promise<string[] | undefined> {
    if (providedTokens?.length) {
      return providedTokens;
    }
    if (userId) {
      return await this.getUserDeviceTokens(userId);
    }
    return undefined;
  }

  /**
   * Send push notification via appropriate method
   */
  private async sendPushViaProvider(
    input: PushNotificationInput,
    tokens: string[] | undefined
  ): Promise<{ success: boolean; messageIds?: string[]; errors?: Array<{ error: string }> }> {
    if (input.topic) {
      return await this.pushService.sendToTopic(input.topic, input.title, input.body, input.data);
    }
    if (input.condition) {
      return await this.pushService.sendToCondition(
        input.condition,
        input.title,
        input.body,
        input.data
      );
    }
    return await this.pushService.sendToDevices({ ...input, deviceTokens: tokens });
  }

  /**
   * Send push notification
   */
  async sendPush(input: PushNotificationInput): Promise<NotificationResult> {
    const preferences = await this.getUserPreferences(input.userId);

    // Check if push disabled
    const disabledResult = this.isPushDisabledByPreferences(preferences);
    if (disabledResult) return disabledResult;

    // Check quiet hours
    const deferredResult = this.shouldDeferForQuietHours(preferences, input.priority);
    if (deferredResult) return deferredResult;

    // Resolve device tokens
    const tokens = await this.resolveDeviceTokens(input.deviceTokens, input.userId);

    if (!tokens?.length && !input.topic && !input.condition) {
      return {
        id: '',
        status: 'FAILED',
        channel: 'PUSH',
        errorMessage: 'No device tokens available',
      };
    }

    // Send push notification
    const result = await this.sendPushViaProvider(input, tokens);

    // Log notification
    const log = await this.logNotification({
      userId: input.userId,
      tenantId: input.tenantId,
      channel: 'PUSH',
      type: input.pushType,
      status: result.success ? 'SENT' : 'FAILED',
      recipient: tokens?.join(',') || input.topic || input.condition || '',
      content: JSON.stringify({ title: input.title, body: input.body }),
      externalId: result.messageIds?.[0],
      errorMessage: result.errors?.[0]?.error,
      metadata: input.metadata,
    });

    return {
      id: log.id,
      status: result.success ? 'SENT' : 'FAILED',
      channel: 'PUSH',
      sentAt: result.success ? new Date() : undefined,
      errorMessage: result.errors?.[0]?.error,
      externalId: result.messageIds?.[0],
    };
  }

  /**
   * Send templated notification by type
   */
  async sendTemplatedEmail(
    userId: string,
    to: string,
    emailType: EmailType,
    templateData: Record<string, unknown>,
    options?: { tenantId?: string; subject?: string }
  ): Promise<NotificationResult> {
    const result = await this.emailService.sendTemplatedEmail(to, emailType, templateData, {
      userId,
      subject: options?.subject,
    });

    const log = await this.logNotification({
      userId,
      tenantId: options?.tenantId,
      channel: 'EMAIL',
      type: emailType,
      status: result.success ? 'SENT' : 'FAILED',
      recipient: to,
      subject: options?.subject,
      externalId: result.messageId,
      errorMessage: result.error,
    });

    return {
      id: log.id,
      status: result.success ? 'SENT' : 'FAILED',
      channel: 'EMAIL',
      sentAt: result.success ? new Date() : undefined,
      errorMessage: result.error,
      externalId: result.messageId,
    };
  }

  /**
   * Send notification through multiple channels
   */
  async sendMultiChannel(
    userId: string,
    channels: NotificationChannel[],
    content: {
      email?: Omit<EmailNotificationInput, 'userId' | 'channels'>;
      push?: Omit<PushNotificationInput, 'userId' | 'channels'>;
    }
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    if (channels.includes('EMAIL') && content.email) {
      const emailResult = await this.sendEmail({
        ...content.email,
        userId,
        channels: ['EMAIL'],
      });
      results.push(emailResult);
    }

    if (channels.includes('PUSH') && content.push) {
      const pushResult = await this.sendPush({
        ...content.push,
        userId,
        channels: ['PUSH'],
      });
      results.push(pushResult);
    }

    return results;
  }

  /**
   * Register device token for push notifications
   * Note: DeviceToken model not available in current schema - storing in memory/cache for now
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
    deviceId: string
  ): Promise<DeviceToken> {
    // Validate token
    const isValid = await this.pushService.validateToken(token);

    // FUTURE: Implement proper device token storage when DeviceToken model is added to Prisma
    // For now, return a mock response
    const deviceToken: DeviceToken = {
      userId,
      token,
      platform,
      deviceId,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      isActive: isValid,
    };

    console.warn('DeviceToken storage not implemented - token registration simulated');
    return deviceToken;
  }

  /**
   * Deactivate device token
   */
  async deactivateDeviceToken(userId: string, deviceId: string): Promise<void> {
    // FUTURE: Implement when DeviceToken model is available
    console.warn('DeviceToken deactivation not implemented');
  }

  /**
   * Get user's device tokens
   */
  async getUserDeviceTokens(userId: string): Promise<string[]> {
    // FUTURE: Implement when DeviceToken model is available
    console.warn('DeviceToken retrieval not implemented');
    return [];
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      // NotificationPreference has userId + notificationType compound key
      // Find the first preference for this user
      const prefs = await this.prisma.notificationPreference.findFirst({
        where: { userId },
      });

      if (!prefs) return null;

      // Map from actual schema to expected interface
      return {
        userId: prefs.userId,
        email: {
          enabled: prefs.emailEnabled,
          marketing: prefs.emailEnabled,
          contractUpdates: prefs.emailEnabled,
          messages: prefs.emailEnabled,
          payments: prefs.emailEnabled,
          weeklyDigest: prefs.emailFrequency !== 'NEVER',
          securityAlerts: prefs.emailEnabled,
        },
        push: {
          enabled: prefs.pushEnabled,
          messages: prefs.pushEnabled,
          contractUpdates: prefs.pushEnabled,
          payments: prefs.pushEnabled,
          reminders: prefs.pushEnabled,
        },
        sms: {
          enabled: prefs.smsEnabled,
          securityAlerts: prefs.smsEnabled,
          payments: prefs.smsEnabled,
        },
        quietHours: {
          enabled: prefs.quietHoursEnabled,
          startTime: prefs.quietHoursStart || '22:00',
          endTime: prefs.quietHoursEnd || '08:00',
          timezone: prefs.quietHoursTimezone || 'UTC',
        },
      };
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const defaultNotificationType = 'GENERAL';

    // Map from interface to actual schema fields
    const data: any = {};

    if (preferences.email) {
      data.emailEnabled = preferences.email.enabled ?? true;
      if (preferences.email.weeklyDigest === false) {
        data.emailFrequency = 'NEVER';
      }
    }
    if (preferences.push) {
      data.pushEnabled = preferences.push.enabled ?? true;
    }
    if (preferences.sms) {
      data.smsEnabled = preferences.sms.enabled ?? false;
    }
    if (preferences.quietHours) {
      data.quietHoursEnabled = preferences.quietHours.enabled ?? false;
      data.quietHoursStart = preferences.quietHours.startTime;
      data.quietHoursEnd = preferences.quietHours.endTime;
      data.quietHoursTimezone = preferences.quietHours.timezone;
    }

    const upserted = await this.prisma.notificationPreference.upsert({
      where: {
        userId_notificationType: {
          userId,
          notificationType: defaultNotificationType,
        },
      },
      create: {
        userId,
        notificationType: defaultNotificationType,
        emailEnabled: data.emailEnabled ?? true,
        pushEnabled: data.pushEnabled ?? true,
        smsEnabled: data.smsEnabled ?? false,
        inAppEnabled: true,
        emailFrequency: data.emailFrequency ?? 'IMMEDIATE',
        quietHoursEnabled: data.quietHoursEnabled ?? false,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
        quietHoursTimezone: data.quietHoursTimezone,
      },
      update: data,
    });

    // Return in expected format
    return {
      userId: upserted.userId,
      email: {
        enabled: upserted.emailEnabled,
        marketing: upserted.emailEnabled,
        contractUpdates: upserted.emailEnabled,
        messages: upserted.emailEnabled,
        payments: upserted.emailEnabled,
        weeklyDigest: upserted.emailFrequency !== 'NEVER',
        securityAlerts: upserted.emailEnabled,
      },
      push: {
        enabled: upserted.pushEnabled,
        messages: upserted.pushEnabled,
        contractUpdates: upserted.pushEnabled,
        payments: upserted.pushEnabled,
        reminders: upserted.pushEnabled,
      },
      sms: {
        enabled: upserted.smsEnabled,
        securityAlerts: upserted.smsEnabled,
        payments: upserted.smsEnabled,
      },
      quietHours: {
        enabled: upserted.quietHoursEnabled,
        startTime: upserted.quietHoursStart || '22:00',
        endTime: upserted.quietHoursEnd || '08:00',
        timezone: upserted.quietHoursTimezone || 'UTC',
      },
    };
  }

  /**
   * Get notification history for user
   * Uses Notification model instead of NotificationLog
   */
  async getNotificationHistory(
    userId: string,
    options?: {
      channel?: NotificationChannel;
      status?: NotificationStatus;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { userId };
    if (options?.channel) {
      where.channels = { has: options.channel };
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return notifications;
  }

  /**
   * Get notification statistics
   * Uses Notification model instead of NotificationLog
   */
  async getNotificationStats(
    userId?: string,
    tenantId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationStats> {
    const where: any = {};
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const notifications = await this.prisma.notification.findMany({ where });

    const stats: NotificationStats = {
      totalSent: notifications.length,
      totalDelivered: notifications.filter((n) => n.isRead).length,
      totalFailed: 0,
      totalOpened: notifications.filter((n) => n.readAt).length,
      totalClicked: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      byChannel: {
        EMAIL: { sent: 0, delivered: 0, failed: 0 },
        PUSH: { sent: 0, delivered: 0, failed: 0 },
        SMS: { sent: 0, delivered: 0, failed: 0 },
        IN_APP: { sent: 0, delivered: 0, failed: 0 },
      },
      byType: {},
    };

    notifications.forEach((notification) => {
      // Count by channel
      const channels = notification.channels || [];
      channels.forEach((channel: string) => {
        if (stats.byChannel[channel as NotificationChannel]) {
          stats.byChannel[channel as NotificationChannel].sent++;
          stats.byChannel[channel as NotificationChannel].delivered++;
        }
      });

      // Count by type
      if (!stats.byType[notification.type]) {
        stats.byType[notification.type] = { sent: 0, delivered: 0, failed: 0 };
      }
      stats.byType[notification.type].sent++;
      stats.byType[notification.type].delivered++;
    });

    if (stats.totalSent > 0) {
      stats.deliveryRate = stats.totalDelivered / stats.totalSent;
      stats.openRate = stats.totalOpened / stats.totalSent;
    }

    return stats;
  }

  /**
   * Handle webhook delivery events
   */
  async handleDeliveryWebhook(
    provider: 'SENDGRID' | 'FIREBASE',
    eventType: string,
    messageId: string,
    timestamp: Date,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Find notification by external reference in data
    const notification = await this.prisma.notification.findFirst({
      where: {
        data: {
          path: ['externalId'],
          equals: messageId,
        },
      },
    });

    if (!notification) {
      console.warn(`Notification not found for messageId: ${messageId}`);
      return;
    }

    const updateData: any = {};
    const deliveryStatus = (notification.deliveryStatus as any) || {};

    switch (eventType) {
      case 'delivered':
        deliveryStatus[provider] = 'DELIVERED';
        updateData.deliveryStatus = deliveryStatus;
        break;
      case 'opened':
        updateData.isRead = true;
        updateData.readAt = timestamp;
        break;
      case 'clicked':
        // Track in data payload
        break;
      case 'bounced':
      case 'failed':
        deliveryStatus[provider] = 'FAILED';
        updateData.deliveryStatus = deliveryStatus;
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: updateData,
      });
    }
  }

  // Private helper methods

  private async logNotification(data: {
    userId: string;
    tenantId?: string;
    channel: NotificationChannel;
    type: string;
    status: NotificationStatus;
    recipient: string;
    subject?: string;
    content?: string;
    externalId?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }) {
    // Create a notification record instead of notification log
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        category: 'SYSTEM',
        priority: 'NORMAL',
        title: data.subject || data.type,
        body: data.content || '',
        channels: [data.channel],
        deliveryStatus: {
          [data.channel]: data.status,
          externalId: data.externalId,
          errorMessage: data.errorMessage,
        },
        data: (data.metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
  }

  private isQuietHours(quietHours: NotificationPreferences['quietHours']): boolean {
    // Simple implementation - would need proper timezone handling in production
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const { startTime, endTime } = quietHours;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Spans midnight
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  private mapDeviceToken(token: any): DeviceToken {
    return {
      userId: token.userId,
      token: token.token,
      platform: token.platform,
      deviceId: token.deviceId,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
      isActive: token.isActive,
    };
  }
}
