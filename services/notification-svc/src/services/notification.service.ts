/**
 * Main Notification Service
 * Orchestrates email, push, and in-app notifications
 */

import { PrismaClient } from '@prisma/client';
import { EmailService } from './email.service.js';
import { PushService } from './push.service.js';
import {
  NotificationChannel,
  NotificationStatus,
  EmailNotificationInput,
  PushNotificationInput,
  NotificationResult,
  NotificationPreferences,
  DeviceToken,
  NotificationStats,
  EmailType,
  PushType,
} from '../types/notification.types.js';
import { getConfig } from '../config/index.js';

export class NotificationService {
  private emailService: EmailService;
  private pushService: PushService;

  constructor(private prisma: PrismaClient) {
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
   * Send push notification
   */
  async sendPush(input: PushNotificationInput): Promise<NotificationResult> {
    // Check user preferences
    const preferences = await this.getUserPreferences(input.userId);
    if (preferences && !preferences.push.enabled) {
      return {
        id: '',
        status: 'FAILED',
        channel: 'PUSH',
        errorMessage: 'User has disabled push notifications',
      };
    }

    // Check quiet hours
    if (preferences?.quietHours.enabled && this.isQuietHours(preferences.quietHours)) {
      // Schedule for later or skip based on priority
      if (input.priority !== 'URGENT') {
        return {
          id: '',
          status: 'PENDING',
          channel: 'PUSH',
          errorMessage: 'Notification scheduled after quiet hours',
        };
      }
    }

    // Get device tokens if not provided
    let tokens = input.deviceTokens;
    if (!tokens?.length && input.userId) {
      tokens = await this.getUserDeviceTokens(input.userId);
    }

    if (!tokens?.length && !input.topic && !input.condition) {
      return {
        id: '',
        status: 'FAILED',
        channel: 'PUSH',
        errorMessage: 'No device tokens available',
      };
    }

    // Send push notification
    let result;
    if (input.topic) {
      result = await this.pushService.sendToTopic(
        input.topic,
        input.title,
        input.body,
        input.data
      );
    } else if (input.condition) {
      result = await this.pushService.sendToCondition(
        input.condition,
        input.title,
        input.body,
        input.data
      );
    } else {
      result = await this.pushService.sendToDevices({ ...input, deviceTokens: tokens });
    }

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
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'IOS' | 'ANDROID' | 'WEB',
    deviceId: string
  ): Promise<DeviceToken> {
    // Validate token
    const isValid = await this.pushService.validateToken(token);

    const existingToken = await this.prisma.deviceToken.findFirst({
      where: { userId, deviceId },
    });

    if (existingToken) {
      const updated = await this.prisma.deviceToken.update({
        where: { id: existingToken.id },
        data: {
          token,
          platform,
          isActive: isValid,
          lastUsedAt: new Date(),
        },
      });
      return this.mapDeviceToken(updated);
    }

    const created = await this.prisma.deviceToken.create({
      data: {
        userId,
        token,
        platform,
        deviceId,
        isActive: isValid,
        lastUsedAt: new Date(),
      },
    });

    return this.mapDeviceToken(created);
  }

  /**
   * Deactivate device token
   */
  async deactivateDeviceToken(userId: string, deviceId: string): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      where: { userId, deviceId },
      data: { isActive: false },
    });
  }

  /**
   * Get user's device tokens
   */
  async getUserDeviceTokens(userId: string): Promise<string[]> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });
    return tokens.map((t) => t.token);
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) return null;

    return {
      userId: prefs.userId,
      email: prefs.emailPreferences as NotificationPreferences['email'],
      push: prefs.pushPreferences as NotificationPreferences['push'],
      sms: prefs.smsPreferences as NotificationPreferences['sms'],
      quietHours: prefs.quietHours as NotificationPreferences['quietHours'],
    };
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    const data = {
      emailPreferences: preferences.email || existing?.emailPreferences || {
        enabled: true,
        marketing: false,
        contractUpdates: true,
        messages: true,
        payments: true,
        weeklyDigest: true,
        securityAlerts: true,
      },
      pushPreferences: preferences.push || existing?.pushPreferences || {
        enabled: true,
        messages: true,
        contractUpdates: true,
        payments: true,
        reminders: true,
      },
      smsPreferences: preferences.sms || existing?.smsPreferences || {
        enabled: false,
        securityAlerts: true,
        payments: false,
      },
      quietHours: preferences.quietHours || existing?.quietHours || {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
      },
    };

    const upserted = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return {
      userId: upserted.userId,
      email: upserted.emailPreferences as NotificationPreferences['email'],
      push: upserted.pushPreferences as NotificationPreferences['push'],
      sms: upserted.smsPreferences as NotificationPreferences['sms'],
      quietHours: upserted.quietHours as NotificationPreferences['quietHours'],
    };
  }

  /**
   * Get notification history for user
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
    if (options?.channel) where.channel = options.channel;
    if (options?.status) where.status = options.status;

    const logs = await this.prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return logs;
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(
    userId?: string,
    tenantId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationStats> {
    const where: any = {};
    if (userId) where.userId = userId;
    if (tenantId) where.tenantId = tenantId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const logs = await this.prisma.notificationLog.findMany({ where });

    const stats: NotificationStats = {
      totalSent: logs.filter((l) => l.status === 'SENT').length,
      totalDelivered: logs.filter((l) => l.status === 'DELIVERED').length,
      totalFailed: logs.filter((l) => l.status === 'FAILED').length,
      totalOpened: logs.filter((l) => l.openedAt).length,
      totalClicked: logs.filter((l) => l.clickedAt).length,
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

    logs.forEach((log) => {
      const channel = log.channel as NotificationChannel;
      if (stats.byChannel[channel]) {
        if (log.status === 'SENT') stats.byChannel[channel].sent++;
        if (log.status === 'DELIVERED') stats.byChannel[channel].delivered++;
        if (log.status === 'FAILED') stats.byChannel[channel].failed++;
      }

      if (!stats.byType[log.type]) {
        stats.byType[log.type] = { sent: 0, delivered: 0, failed: 0 };
      }
      if (log.status === 'SENT') stats.byType[log.type].sent++;
      if (log.status === 'DELIVERED') stats.byType[log.type].delivered++;
      if (log.status === 'FAILED') stats.byType[log.type].failed++;
    });

    const totalSentAndDelivered = stats.totalSent + stats.totalDelivered;
    if (totalSentAndDelivered > 0) {
      stats.deliveryRate = stats.totalDelivered / totalSentAndDelivered;
      stats.openRate = stats.totalOpened / totalSentAndDelivered;
      stats.clickRate = stats.totalClicked / totalSentAndDelivered;
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
    const log = await this.prisma.notificationLog.findFirst({
      where: { externalId: messageId },
    });

    if (!log) {
      console.warn(`Notification log not found for messageId: ${messageId}`);
      return;
    }

    const updateData: any = {};

    switch (eventType) {
      case 'delivered':
        updateData.status = 'DELIVERED';
        updateData.deliveredAt = timestamp;
        break;
      case 'opened':
        updateData.openedAt = timestamp;
        break;
      case 'clicked':
        updateData.clickedAt = timestamp;
        break;
      case 'bounced':
      case 'failed':
        updateData.status = 'FAILED';
        updateData.errorMessage = JSON.stringify(metadata);
        break;
    }

    await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: updateData,
    });
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
    return this.prisma.notificationLog.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        channel: data.channel,
        type: data.type,
        status: data.status,
        recipient: data.recipient,
        subject: data.subject,
        content: data.content,
        externalId: data.externalId,
        errorMessage: data.errorMessage,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
        sentAt: data.status === 'SENT' ? new Date() : undefined,
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
