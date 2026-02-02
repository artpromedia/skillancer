/**
 * Push Notification Service
 *
 * Handles sending push notifications to users through Firebase Cloud Messaging.
 * Supports single device, multi-device, and topic-based notifications.
 * Integrates with notification preferences and handles invalid tokens.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { PrismaClient } from '@prisma/client';
import { logger } from '@skillancer/logger';

import { getConfig } from '../config/index.js';
import {
  sendToDevice,
  sendToUser,
  sendToTopic,
  createDeepLink,
  isFirebaseConfigured,
  type PushNotificationPayload,
  type FirebaseSendResult,
} from '../providers/firebase.js';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface PushNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  priority?: 'high' | 'normal';
  ttl?: number;
  collapseKey?: string;
}

export interface BroadcastNotificationInput {
  topic: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

export type NotificationType =
  | 'MESSAGE'
  | 'PROPOSAL'
  | 'CONTRACT'
  | 'PAYMENT'
  | 'SYSTEM'
  | 'MARKETING'
  | 'SECURITY'
  | 'REMINDER';

export interface PushSendResult {
  success: boolean;
  userId: string;
  notificationId?: string;
  deliveredCount: number;
  failedCount: number;
  error?: string;
}

// ============================================================================
// Push Notification Service
// ============================================================================

class PushNotificationServiceImpl {
  private readonly config = getConfig();

  /**
   * Check if push notifications are enabled
   */
  isEnabled(): boolean {
    return isFirebaseConfigured();
  }

  /**
   * Send push notification to a user (all their devices)
   */
  async sendToUser(input: PushNotificationInput): Promise<PushSendResult> {
    const { userId, title, body, type, data, imageUrl, clickAction, priority, ttl, collapseKey } =
      input;

    // Check if Firebase is configured
    if (!this.isEnabled()) {
      logger.warn('Push notifications disabled - Firebase not configured');
      return {
        success: false,
        userId,
        deliveredCount: 0,
        failedCount: 0,
        error: 'Push notifications not configured',
      };
    }

    // Check user's notification preferences
    const canSend = await this.checkPushPreference(userId, type);
    if (!canSend) {
      logger.info({ userId, type }, 'Push notification skipped - user preference disabled');
      return {
        success: true,
        userId,
        deliveredCount: 0,
        failedCount: 0,
        error: 'User has disabled push notifications for this type',
      };
    }

    // Check quiet hours
    const inQuietHours = await this.isInQuietHours(userId);
    if (inQuietHours && type !== 'SECURITY') {
      logger.info({ userId, type }, 'Push notification skipped - quiet hours');
      return {
        success: true,
        userId,
        deliveredCount: 0,
        failedCount: 0,
        error: 'User is in quiet hours',
      };
    }

    // Get user's active device tokens
    const devices = await prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { id: true, token: true, platform: true },
    });

    if (devices.length === 0) {
      logger.info({ userId }, 'No registered devices for push notification');
      return {
        success: false,
        userId,
        deliveredCount: 0,
        failedCount: 0,
        error: 'No registered devices',
      };
    }

    const tokens = devices.map((d) => d.token);

    // Create notification payload
    const notification: PushNotificationPayload = {
      title,
      body,
      imageUrl,
      clickAction: clickAction || createDeepLink('/notifications'),
      data: {
        ...data,
        type,
        timestamp: new Date().toISOString(),
      },
    };

    // Send to all user devices
    const result = await sendToUser({
      userId,
      tokens,
      notification,
      android: {
        priority: priority || 'high',
        ttl,
        collapseKey,
        channelId: this.getAndroidChannel(type),
      },
      apns: {
        sound: 'default',
        category: type,
      },
      webpush: {
        icon: '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png',
        requireInteraction: type === 'MESSAGE' || type === 'PAYMENT',
      },
    });

    // Handle invalid tokens
    if (result.invalidTokens.length > 0) {
      await this.deactivateInvalidTokens(result.invalidTokens);
    }

    // Create notification record
    const notificationRecord = await this.createNotificationRecord(userId, title, body, type, data);

    logger.info(
      {
        userId,
        type,
        deliveredCount: result.successCount,
        failedCount: result.failureCount,
      },
      'Push notification sent'
    );

    return {
      success: result.successCount > 0,
      userId,
      notificationId: notificationRecord?.id,
      deliveredCount: result.successCount,
      failedCount: result.failureCount,
    };
  }

  /**
   * Send push notification to a single device
   */
  async sendToDevice(
    token: string,
    input: Omit<PushNotificationInput, 'userId'>
  ): Promise<FirebaseSendResult> {
    const { title, body, type, data, imageUrl, clickAction, priority, ttl, collapseKey } = input;

    if (!this.isEnabled()) {
      return { success: false, error: 'Push notifications not configured' };
    }

    const notification: PushNotificationPayload = {
      title,
      body,
      imageUrl,
      clickAction: clickAction || createDeepLink('/notifications'),
      data: {
        ...data,
        type,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await sendToDevice({
      token,
      notification,
      android: {
        priority: priority || 'high',
        ttl,
        collapseKey,
        channelId: this.getAndroidChannel(type),
      },
      apns: {
        sound: 'default',
      },
      webpush: {
        icon: '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png',
      },
    });

    // Handle invalid token
    if (result.failedTokens && result.failedTokens.length > 0) {
      await this.deactivateInvalidTokens(result.failedTokens);
    }

    return result;
  }

  /**
   * Send broadcast notification to a topic
   */
  async sendToTopic(input: BroadcastNotificationInput): Promise<FirebaseSendResult> {
    const { topic, title, body, data, imageUrl, clickAction } = input;

    if (!this.isEnabled()) {
      return { success: false, error: 'Push notifications not configured' };
    }

    const notification: PushNotificationPayload = {
      title,
      body,
      imageUrl,
      clickAction: clickAction || createDeepLink('/notifications'),
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await sendToTopic({
      topic,
      notification,
      android: {
        priority: 'normal',
      },
      webpush: {
        icon: '/icons/notification-icon.png',
      },
    });

    logger.info({ topic, success: result.success }, 'Topic notification sent');

    return result;
  }

  /**
   * Send push notification for new message
   */
  async sendNewMessageNotification(
    recipientId: string,
    senderName: string,
    messagePreview: string,
    conversationId: string
  ): Promise<PushSendResult> {
    return this.sendToUser({
      userId: recipientId,
      title: `New message from ${senderName}`,
      body: messagePreview.length > 100 ? messagePreview.slice(0, 97) + '...' : messagePreview,
      type: 'MESSAGE',
      data: {
        conversationId,
        senderName,
      },
      clickAction: createDeepLink(`/messages/${conversationId}`),
      priority: 'high',
      collapseKey: `message_${conversationId}`,
    });
  }

  /**
   * Send push notification for proposal update
   */
  async sendProposalNotification(
    recipientId: string,
    proposalId: string,
    jobTitle: string,
    action: 'submitted' | 'accepted' | 'rejected' | 'withdrawn'
  ): Promise<PushSendResult> {
    const titles: Record<string, string> = {
      submitted: 'New Proposal Received',
      accepted: 'Your Proposal Was Accepted! 🎉',
      rejected: 'Proposal Update',
      withdrawn: 'Proposal Withdrawn',
    };

    const bodies: Record<string, string> = {
      submitted: `A freelancer submitted a proposal for "${jobTitle}"`,
      accepted: `Congratulations! Your proposal for "${jobTitle}" was accepted`,
      rejected: `Your proposal for "${jobTitle}" was not selected`,
      withdrawn: `A proposal for "${jobTitle}" was withdrawn`,
    };

    return this.sendToUser({
      userId: recipientId,
      title: titles[action],
      body: bodies[action],
      type: 'PROPOSAL',
      data: {
        proposalId,
        jobTitle,
        action,
      },
      clickAction: createDeepLink(`/proposals/${proposalId}`),
      priority: action === 'accepted' ? 'high' : 'normal',
    });
  }

  /**
   * Send push notification for payment event
   */
  async sendPaymentNotification(
    recipientId: string,
    amount: number,
    currency: string,
    action: 'received' | 'sent' | 'released' | 'refunded',
    transactionId?: string
  ): Promise<PushSendResult> {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);

    const titles: Record<string, string> = {
      received: 'Payment Received! 💰',
      sent: 'Payment Sent',
      released: 'Milestone Payment Released',
      refunded: 'Payment Refunded',
    };

    const bodies: Record<string, string> = {
      received: `You received ${formattedAmount}`,
      sent: `You sent ${formattedAmount}`,
      released: `${formattedAmount} has been released for your completed milestone`,
      refunded: `${formattedAmount} has been refunded`,
    };

    return this.sendToUser({
      userId: recipientId,
      title: titles[action],
      body: bodies[action],
      type: 'PAYMENT',
      data: {
        amount: amount.toString(),
        currency,
        action,
        transactionId: transactionId || '',
      },
      clickAction: createDeepLink('/payments'),
      priority: 'high',
    });
  }

  /**
   * Send push notification for contract event
   */
  async sendContractNotification(
    recipientId: string,
    contractId: string,
    jobTitle: string,
    action: 'created' | 'started' | 'milestone_completed' | 'completed' | 'cancelled'
  ): Promise<PushSendResult> {
    const titles: Record<string, string> = {
      created: 'New Contract Created',
      started: 'Contract Started',
      milestone_completed: 'Milestone Completed',
      completed: 'Contract Completed! 🎉',
      cancelled: 'Contract Cancelled',
    };

    const bodies: Record<string, string> = {
      created: `A new contract for "${jobTitle}" has been created`,
      started: `Work has started on "${jobTitle}"`,
      milestone_completed: `A milestone for "${jobTitle}" has been completed`,
      completed: `The contract for "${jobTitle}" has been completed`,
      cancelled: `The contract for "${jobTitle}" has been cancelled`,
    };

    return this.sendToUser({
      userId: recipientId,
      title: titles[action],
      body: bodies[action],
      type: 'CONTRACT',
      data: {
        contractId,
        jobTitle,
        action,
      },
      clickAction: createDeepLink(`/contracts/${contractId}`),
      priority: action === 'completed' ? 'high' : 'normal',
    });
  }

  /**
   * Send security alert notification
   */
  async sendSecurityAlert(
    userId: string,
    alertType: 'login' | 'password_changed' | 'new_device' | 'suspicious_activity',
    details?: string
  ): Promise<PushSendResult> {
    const titles: Record<string, string> = {
      login: 'New Login Detected',
      password_changed: 'Password Changed',
      new_device: 'New Device Registered',
      suspicious_activity: '⚠️ Security Alert',
    };

    const bodies: Record<string, string> = {
      login: details || 'A new login was detected on your account',
      password_changed: 'Your password was recently changed',
      new_device: details || 'A new device was registered for notifications',
      suspicious_activity: details || 'We detected suspicious activity on your account',
    };

    return this.sendToUser({
      userId,
      title: titles[alertType],
      body: bodies[alertType],
      type: 'SECURITY',
      data: {
        alertType,
        details: details || '',
      },
      clickAction: createDeepLink('/settings/security'),
      priority: 'high',
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if user has push notifications enabled for type
   */
  private async checkPushPreference(userId: string, type: NotificationType): Promise<boolean> {
    // Security notifications are always sent
    if (type === 'SECURITY') {
      return true;
    }

    const preference = await prisma.notificationPreference.findFirst({
      where: { userId, notificationType: type },
    });

    // Default to enabled if no preference exists
    return preference?.pushEnabled ?? true;
  }

  /**
   * Check if user is in quiet hours
   */
  private async isInQuietHours(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) return false;

    // Check for quiet hours preference
    const preference = await prisma.notificationPreference.findFirst({
      where: { userId, notificationType: 'SYSTEM' },
    });

    if (!preference) return false;

    // Check quiet hours settings from preference data
    // This would normally check quietHoursStart and quietHoursEnd
    // For now, return false as quiet hours aren't stored in this schema
    return false;
  }

  /**
   * Deactivate invalid tokens
   */
  private async deactivateInvalidTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;

    const result = await prisma.deviceToken.updateMany({
      where: { token: { in: tokens } },
      data: { isActive: false },
    });

    logger.info({ count: result.count }, 'Deactivated invalid FCM tokens');
  }

  /**
   * Create notification record in database
   */
  private async createNotificationRecord(
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, string>
  ) {
    try {
      return await prisma.notification.create({
        data: {
          userId,
          type: type as string,
          title,
          body,
          data: data || {},
          channel: 'PUSH',
          status: 'DELIVERED',
        },
      });
    } catch (error) {
      logger.error({ error, userId, type }, 'Failed to create notification record');
      return null;
    }
  }

  /**
   * Get Android notification channel based on type
   */
  private getAndroidChannel(type: NotificationType): string {
    const channels: Record<NotificationType, string> = {
      MESSAGE: 'messages',
      PROPOSAL: 'proposals',
      CONTRACT: 'contracts',
      PAYMENT: 'payments',
      SYSTEM: 'system',
      MARKETING: 'marketing',
      SECURITY: 'security',
      REMINDER: 'reminders',
    };

    return channels[type] || 'default';
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const PushNotificationService = new PushNotificationServiceImpl();
export default PushNotificationService;
