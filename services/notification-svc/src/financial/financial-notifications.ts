/**
 * Financial Notifications Service
 * Handles email, push, and in-app notifications for financial events
 * Sprint M5: Freelancer Financial Services
 */

import { createLogger } from '@skillancer/logger';
import { EmailService } from '../services/email.service.js';
import { PushService } from '../services/push.service.js';
import { SmsService } from '../services/sms.service.js';
import type { EmailType } from '../types/notification.types.js';

const baseLogger = createLogger({ name: 'FinancialNotifications' });

// Initialize notification services
const emailService = new EmailService();
const pushService = new PushService();
const smsService = new SmsService();

// Wrapper to allow (message, object) pattern
const logger = {
  info: (msg: string, obj?: Record<string, unknown>) =>
    obj ? baseLogger.info(obj, msg) : baseLogger.info(msg),
  warn: (msg: string, obj?: Record<string, unknown>) =>
    obj ? baseLogger.warn(obj, msg) : baseLogger.warn(msg),
  error: (msg: string, obj?: Record<string, unknown>) =>
    obj ? baseLogger.error(obj, msg) : baseLogger.error(msg),
  debug: (msg: string, obj?: Record<string, unknown>) =>
    obj ? baseLogger.debug(obj, msg) : baseLogger.debug(msg),
};

// ============================================================================
// TYPES
// ============================================================================

export type FinancialNotificationType =
  // Payout notifications
  | 'payout_initiated'
  | 'payout_completed'
  | 'payout_failed'
  // Card notifications
  | 'card_issued'
  | 'card_activated'
  | 'card_frozen'
  | 'card_unfrozen'
  | 'card_transaction'
  | 'card_declined'
  | 'spending_limit_warning'
  | 'spending_limit_reached'
  // Tax notifications
  | 'tax_auto_save'
  | 'quarterly_reminder'
  | 'quarterly_payment_due'
  | 'quarterly_payment_overdue'
  | 'quarterly_payment_recorded'
  // Balance notifications
  | 'low_balance_warning'
  | 'large_deposit_received'
  | 'unusual_activity';

export interface NotificationChannel {
  email: boolean;
  push: boolean;
  inApp: boolean;
  sms: boolean;
}

export interface NotificationPreferences {
  userId: string;
  payouts: NotificationChannel;
  cards: NotificationChannel;
  taxes: NotificationChannel;
  security: NotificationChannel;
  marketing: NotificationChannel;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "08:00"
  timezone: string;
}

export interface FinancialNotification {
  id: string;
  userId: string;
  type: FinancialNotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channels: (keyof NotificationChannel)[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
}

interface PayoutNotificationData {
  payoutId: string;
  amount: number;
  fee: number;
  netAmount: number;
  destination: string;
  destinationLast4: string;
  speed: 'instant' | 'standard';
  status: string;
  failureReason?: string;
}

interface CardNotificationData {
  cardId: string;
  cardLast4: string;
  cardType: 'virtual' | 'physical';
  transactionId?: string;
  merchantName?: string;
  amount?: number;
  declineReason?: string;
  limitType?: string;
  currentUsage?: number;
  limit?: number;
}

interface TaxNotificationData {
  vaultId: string;
  amount?: number;
  quarter?: number;
  year?: number;
  dueDate?: string;
  daysUntilDue?: number;
  estimatedAmount?: number;
  savingsRate?: number;
}

interface BalanceNotificationData {
  balance: number;
  threshold?: number;
  depositAmount?: number;
  depositSource?: string;
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

// Helper function for safe type casting
function castData<T>(data: Record<string, unknown>): T {
  return data as unknown as T;
}

const notificationTemplates: Record<
  FinancialNotificationType,
  {
    title: (data: Record<string, unknown>) => string;
    body: (data: Record<string, unknown>) => string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    category: 'payouts' | 'cards' | 'taxes' | 'security';
  }
> = {
  // Payout notifications
  payout_initiated: {
    title: () => 'Payout Initiated',
    body: (data: Record<string, unknown>) => {
      const d = castData<PayoutNotificationData>(data);
      return `Your ${d.speed} payout of $${d.netAmount.toFixed(2)} to ••••${d.destinationLast4} is processing.`;
    },
    priority: 'normal',
    category: 'payouts',
  },
  payout_completed: {
    title: () => 'Payout Complete!',
    body: (data: Record<string, unknown>) => {
      const d = castData<PayoutNotificationData>(data);
      return `$${d.netAmount.toFixed(2)} has been sent to ••••${d.destinationLast4}.`;
    },
    priority: 'normal',
    category: 'payouts',
  },
  payout_failed: {
    title: () => 'Payout Failed',
    body: (data: Record<string, unknown>) => {
      const d = castData<PayoutNotificationData>(data);
      return `Your payout of $${d.amount.toFixed(2)} could not be processed. ${d.failureReason || 'Please try again.'}`;
    },
    priority: 'high',
    category: 'payouts',
  },

  // Card notifications
  card_issued: {
    title: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return `${d.cardType === 'virtual' ? 'Virtual' : 'Physical'} Card Issued`;
    },
    body: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return d.cardType === 'virtual'
        ? 'Your new virtual card is ready to use.'
        : 'Your physical card has been ordered and will arrive in 7-10 business days.';
    },
    priority: 'normal',
    category: 'cards',
  },
  card_activated: {
    title: () => 'Card Activated',
    body: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return `Your card ending in ${d.cardLast4} is now active and ready to use.`;
    },
    priority: 'normal',
    category: 'cards',
  },
  card_frozen: {
    title: () => 'Card Frozen',
    body: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return `Your card ending in ${d.cardLast4} has been frozen. Transactions will be declined until unfrozen.`;
    },
    priority: 'high',
    category: 'security',
  },
  card_unfrozen: {
    title: () => 'Card Unfrozen',
    body: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return `Your card ending in ${d.cardLast4} is now active again.`;
    },
    priority: 'normal',
    category: 'cards',
  },
  card_transaction: {
    title: () => 'Card Purchase',
    body: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return `$${d.amount?.toFixed(2)} at ${d.merchantName} (••••${d.cardLast4})`;
    },
    priority: 'low',
    category: 'cards',
  },
  card_declined: {
    title: () => 'Card Declined',
    body: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return `A $${d.amount?.toFixed(2)} transaction at ${d.merchantName} was declined. ${d.declineReason || ''}`;
    },
    priority: 'high',
    category: 'security',
  },
  spending_limit_warning: {
    title: () => 'Spending Limit Warning',
    body: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return `You've used $${d.currentUsage?.toFixed(2)} of your $${d.limit?.toFixed(2)} ${d.limitType} limit.`;
    },
    priority: 'normal',
    category: 'cards',
  },
  spending_limit_reached: {
    title: () => 'Spending Limit Reached',
    body: (data: Record<string, unknown>) => {
      const d = castData<CardNotificationData>(data);
      return `You've reached your ${d.limitType} spending limit of $${d.limit?.toFixed(2)}. Transactions may be declined.`;
    },
    priority: 'high',
    category: 'cards',
  },

  // Tax notifications
  tax_auto_save: {
    title: () => 'Tax Auto-Save',
    body: (data: Record<string, unknown>) => {
      const d = castData<TaxNotificationData>(data);
      return `$${d.amount?.toFixed(2)} (${d.savingsRate}%) has been saved to your Tax Vault.`;
    },
    priority: 'low',
    category: 'taxes',
  },
  quarterly_reminder: {
    title: () => 'Quarterly Tax Reminder',
    body: (data: Record<string, unknown>) => {
      const d = castData<TaxNotificationData>(data);
      return `Q${d.quarter} estimated tax payment (~$${d.estimatedAmount?.toFixed(0)}) is due in ${d.daysUntilDue} days.`;
    },
    priority: 'normal',
    category: 'taxes',
  },
  quarterly_payment_due: {
    title: () => 'Tax Payment Due Soon',
    body: (data: Record<string, unknown>) => {
      const d = castData<TaxNotificationData>(data);
      return `Your Q${d.quarter} ${d.year} estimated tax payment of ~$${d.estimatedAmount?.toFixed(0)} is due on ${d.dueDate}.`;
    },
    priority: 'high',
    category: 'taxes',
  },
  quarterly_payment_overdue: {
    title: () => '⚠️ Tax Payment Overdue',
    body: (data: Record<string, unknown>) => {
      const d = castData<TaxNotificationData>(data);
      return `Your Q${d.quarter} ${d.year} estimated tax payment is overdue. Pay now to avoid IRS penalties.`;
    },
    priority: 'urgent',
    category: 'taxes',
  },
  quarterly_payment_recorded: {
    title: () => 'Tax Payment Recorded',
    body: (data: Record<string, unknown>) => {
      const d = castData<TaxNotificationData>(data);
      return `Your Q${d.quarter} ${d.year} payment of $${d.amount?.toFixed(2)} has been recorded.`;
    },
    priority: 'normal',
    category: 'taxes',
  },

  // Balance notifications
  low_balance_warning: {
    title: () => 'Low Balance Alert',
    body: (data: Record<string, unknown>) => {
      const d = castData<BalanceNotificationData>(data);
      return `Your available balance is $${d.balance.toFixed(2)}, below your $${d.threshold?.toFixed(2)} threshold.`;
    },
    priority: 'high',
    category: 'security',
  },
  large_deposit_received: {
    title: () => 'Deposit Received',
    body: (data: Record<string, unknown>) => {
      const d = castData<BalanceNotificationData>(data);
      return `$${d.depositAmount?.toFixed(2)} from ${d.depositSource} has been added to your account.`;
    },
    priority: 'normal',
    category: 'payouts',
  },
  unusual_activity: {
    title: () => '⚠️ Unusual Activity Detected',
    body: () =>
      'We noticed unusual activity on your account. Please review your recent transactions.',
    priority: 'urgent',
    category: 'security',
  },
};

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

const emailTemplates: Record<FinancialNotificationType, string> = {
  payout_initiated: 'payout-initiated',
  payout_completed: 'payout-completed',
  payout_failed: 'payout-failed',
  card_issued: 'card-issued',
  card_activated: 'card-activated',
  card_frozen: 'card-frozen',
  card_unfrozen: 'card-unfrozen',
  card_transaction: 'card-transaction',
  card_declined: 'card-declined',
  spending_limit_warning: 'spending-limit-warning',
  spending_limit_reached: 'spending-limit-reached',
  tax_auto_save: 'tax-auto-save',
  quarterly_reminder: 'quarterly-reminder',
  quarterly_payment_due: 'quarterly-payment-due',
  quarterly_payment_overdue: 'quarterly-payment-overdue',
  quarterly_payment_recorded: 'quarterly-payment-recorded',
  low_balance_warning: 'low-balance-warning',
  large_deposit_received: 'large-deposit-received',
  unusual_activity: 'unusual-activity',
};

// ============================================================================
// SERVICE
// ============================================================================

class FinancialNotificationsService {
  private logger = {
    info: (msg: string, obj?: Record<string, unknown>) =>
      obj ? baseLogger.info(obj, msg) : baseLogger.info(msg),
    warn: (msg: string, obj?: Record<string, unknown>) =>
      obj ? baseLogger.warn(obj, msg) : baseLogger.warn(msg),
    error: (msg: string, obj?: Record<string, unknown>) =>
      obj ? baseLogger.error(obj, msg) : baseLogger.error(msg),
    debug: (msg: string, obj?: Record<string, unknown>) =>
      obj ? baseLogger.debug(obj, msg) : baseLogger.debug(msg),
  };

  constructor() {
    // Logger initialized inline
  }

  // ---------------------------------------------------------------------------
  // NOTIFICATION CREATION
  // ---------------------------------------------------------------------------

  async sendNotification(
    userId: string,
    type: FinancialNotificationType,
    data: Record<string, unknown>
  ): Promise<FinancialNotification> {
    const template = notificationTemplates[type];
    const preferences = await this.getPreferences(userId);

    const notification: FinancialNotification = {
      id: this.generateId(),
      userId,
      type,
      title: template.title(data),
      body: template.body(data),
      data,
      channels: this.determineChannels(preferences, template.category, template.priority),
      priority: template.priority,
      read: false,
      createdAt: new Date(),
    };

    // Check quiet hours (except for urgent notifications)
    if (template.priority !== 'urgent' && this.isQuietHours(preferences)) {
      this.logger.info('Notification queued due to quiet hours', {
        notificationId: notification.id,
      });
      await this.queueForLater(notification, preferences);
      return notification;
    }

    // Send via each channel
    await this.dispatchNotification(notification, preferences);

    // Store in database
    await this.storeNotification(notification);

    return notification;
  }

  // ---------------------------------------------------------------------------
  // CHANNEL DISPATCH
  // ---------------------------------------------------------------------------

  private async dispatchNotification(
    notification: FinancialNotification,
    preferences: NotificationPreferences
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    if (notification.channels.includes('email')) {
      promises.push(this.sendEmail(notification));
    }

    if (notification.channels.includes('push')) {
      promises.push(this.sendPush(notification));
    }

    if (notification.channels.includes('inApp')) {
      promises.push(this.sendInApp(notification));
    }

    if (notification.channels.includes('sms') && notification.priority === 'urgent') {
      promises.push(this.sendSms(notification));
    }

    await Promise.allSettled(promises);

    notification.sentAt = new Date();
    this.logger.info('Notification dispatched', {
      notificationId: notification.id,
      channels: notification.channels,
    });
  }

  private async sendEmail(notification: FinancialNotification): Promise<void> {
    const templateId = emailTemplates[notification.type];

    this.logger.info('Sending email notification', {
      userId: notification.userId,
      templateId,
    });

    try {
      // Get user email from user service (placeholder - in production, fetch from user service)
      const userEmail = await this.getUserEmail(notification.userId);
      if (!userEmail) {
        this.logger.warn('Cannot send email - user email not found', {
          userId: notification.userId,
        });
        return;
      }

      // Send via email service
      const result = await emailService.sendTemplatedEmail(
        userEmail,
        this.mapNotificationTypeToEmailType(notification.type),
        {
          title: notification.title,
          body: notification.body,
          userName: 'User', // Would be fetched from user service
          ...notification.data,
        },
        {
          userId: notification.userId,
          subject: notification.title,
        }
      );

      if (!result.success) {
        this.logger.error('Email notification failed', {
          userId: notification.userId,
          error: result.error,
        });
      } else {
        this.logger.info('Email notification sent successfully', {
          userId: notification.userId,
          messageId: result.messageId,
        });
      }
    } catch (error) {
      this.logger.error('Email notification error', {
        userId: notification.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private mapNotificationTypeToEmailType(type: FinancialNotificationType): EmailType {
    // Map financial notification types to email template types
    const typeMap: Record<FinancialNotificationType, EmailType> = {
      payout_initiated: 'PAYMENT_SENT',
      payout_completed: 'PAYMENT_SENT',
      payout_failed: 'SECURITY_ALERT',
      card_issued: 'WELCOME',
      card_activated: 'WELCOME',
      card_frozen: 'SECURITY_ALERT',
      card_unfrozen: 'WELCOME',
      card_transaction: 'PAYMENT_RECEIVED',
      card_declined: 'SECURITY_ALERT',
      spending_limit_warning: 'SECURITY_ALERT',
      spending_limit_reached: 'SECURITY_ALERT',
      tax_auto_save: 'PAYMENT_RECEIVED',
      quarterly_reminder: 'INVOICE_CREATED',
      quarterly_payment_due: 'INVOICE_CREATED',
      quarterly_payment_overdue: 'SECURITY_ALERT',
      quarterly_payment_recorded: 'PAYMENT_RECEIVED',
      low_balance_warning: 'SECURITY_ALERT',
      large_deposit_received: 'PAYMENT_RECEIVED',
      unusual_activity: 'SECURITY_ALERT',
    };
    return typeMap[type] || 'SECURITY_ALERT';
  }

  private async getUserEmail(userId: string): Promise<string | null> {
    // Placeholder - in production, fetch from user service or database
    // This would typically call the user service API or query the database
    this.logger.debug('Fetching user email', { userId });
    // Return null for now - implement actual user lookup
    return null;
  }

  private async sendPush(notification: FinancialNotification): Promise<void> {
    this.logger.info('Sending push notification', {
      userId: notification.userId,
      type: notification.type,
    });

    try {
      // Get user device tokens
      const deviceTokens = await this.getUserDeviceTokens(notification.userId);
      if (!deviceTokens.length) {
        this.logger.warn('Cannot send push - no device tokens found', {
          userId: notification.userId,
        });
        return;
      }

      // Map priority
      const priorityMap: Record<string, 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'> = {
        low: 'LOW',
        normal: 'NORMAL',
        high: 'HIGH',
        urgent: 'URGENT',
      };

      // Send via push service
      const result = await pushService.sendToDevices({
        userId: notification.userId,
        channels: ['PUSH'],
        pushType: 'SYSTEM_ALERT',
        title: notification.title,
        body: notification.body,
        data: this.stringifyData(notification.data),
        deviceTokens,
        priority: priorityMap[notification.priority] || 'NORMAL',
      });

      if (!result.success) {
        this.logger.error('Push notification failed', {
          userId: notification.userId,
          failureCount: result.failureCount,
          errors: result.errors,
        });
      } else {
        this.logger.info('Push notification sent successfully', {
          userId: notification.userId,
          successCount: result.successCount,
          messageIds: result.messageIds,
        });
      }
    } catch (error) {
      this.logger.error('Push notification error', {
        userId: notification.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async getUserDeviceTokens(userId: string): Promise<string[]> {
    // Placeholder - in production, fetch from database
    // This would typically query the device_tokens table
    this.logger.debug('Fetching user device tokens', { userId });
    return [];
  }

  private stringifyData(data: Record<string, unknown>): Record<string, string> {
    // Convert all values to strings for FCM data payload
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }

  private async sendInApp(notification: FinancialNotification): Promise<void> {
    this.logger.info('Creating in-app notification', {
      userId: notification.userId,
      type: notification.type,
    });

    // In-app notifications are stored and fetched by the client
    // Already handled by storeNotification
  }

  private async sendSms(notification: FinancialNotification): Promise<void> {
    this.logger.info('Sending SMS notification', {
      userId: notification.userId,
      type: notification.type,
    });

    try {
      // Get user phone number
      const phoneNumber = await this.getUserPhoneNumber(notification.userId);
      if (!phoneNumber) {
        this.logger.warn('Cannot send SMS - user phone number not found', {
          userId: notification.userId,
        });
        return;
      }

      // Send via SMS service
      const result = await smsService.sendSMS({
        userId: notification.userId,
        to: phoneNumber,
        body: notification.body,
        metadata: {
          notificationType: notification.type,
          notificationId: notification.id,
        },
      });

      if (!result.success) {
        this.logger.error('SMS notification failed', {
          userId: notification.userId,
          error: result.error,
        });
      } else {
        this.logger.info('SMS notification sent successfully', {
          userId: notification.userId,
          messageId: result.messageId,
          status: result.status,
        });
      }
    } catch (error) {
      this.logger.error('SMS notification error', {
        userId: notification.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async getUserPhoneNumber(userId: string): Promise<string | null> {
    // Placeholder - in production, fetch from user service or database
    // This would typically call the user service API or query the database
    this.logger.debug('Fetching user phone number', { userId });
    // Return null for now - implement actual user lookup
    return null;
  }

  // ---------------------------------------------------------------------------
  // PREFERENCES
  // ---------------------------------------------------------------------------

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    // TODO: Fetch from database
    // For now, return defaults
    return {
      userId,
      payouts: { email: true, push: true, inApp: true, sms: false },
      cards: { email: true, push: true, inApp: true, sms: false },
      taxes: { email: true, push: true, inApp: true, sms: false },
      security: { email: true, push: true, inApp: true, sms: true },
      marketing: { email: false, push: false, inApp: false, sms: false },
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      timezone: 'America/New_York',
    };
  }

  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...updates };

    // TODO: Save to database
    this.logger.info('Notification preferences updated', { userId });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // IN-APP NOTIFICATIONS
  // ---------------------------------------------------------------------------

  async getInAppNotifications(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; offset?: number } = {}
  ): Promise<{ notifications: FinancialNotification[]; unreadCount: number }> {
    const { unreadOnly = false, limit = 50, offset = 0 } = options;

    // TODO: Fetch from database
    this.logger.info('Fetching in-app notifications', { userId, unreadOnly, limit });

    return {
      notifications: [],
      unreadCount: 0,
    };
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    // TODO: Update in database
    this.logger.info('Marking notifications as read', { userId, count: notificationIds.length });
  }

  async markAllAsRead(userId: string): Promise<void> {
    // TODO: Update all unread in database
    this.logger.info('Marking all notifications as read', { userId });
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private determineChannels(
    preferences: NotificationPreferences,
    category: 'payouts' | 'cards' | 'taxes' | 'security',
    priority: 'low' | 'normal' | 'high' | 'urgent'
  ): (keyof NotificationChannel)[] {
    const channelPrefs = preferences[category];
    const channels: (keyof NotificationChannel)[] = [];

    // Always include in-app
    if (channelPrefs.inApp) channels.push('inApp');

    // Include based on priority and preferences
    if (priority !== 'low' && channelPrefs.push) channels.push('push');
    if (priority === 'high' || priority === 'urgent') {
      if (channelPrefs.email) channels.push('email');
    }
    if (priority === 'urgent' && channelPrefs.sms) {
      channels.push('sms');
    }

    return channels;
  }

  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursEnabled) return false;

    const now = new Date();
    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes < endMinutes) {
      // Same day (e.g., 08:00 - 22:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight (e.g., 22:00 - 08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  private async queueForLater(
    notification: FinancialNotification,
    preferences: NotificationPreferences
  ): Promise<void> {
    // TODO: Add to delayed queue (Redis, SQS, etc.)
    this.logger.info('Notification queued for after quiet hours', {
      notificationId: notification.id,
      quietHoursEnd: preferences.quietHoursEnd,
    });
  }

  private async storeNotification(notification: FinancialNotification): Promise<void> {
    // TODO: Save to database
    this.logger.info('Notification stored', { notificationId: notification.id });
  }

  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let financialNotificationsService: FinancialNotificationsService | null = null;

export function getFinancialNotificationsService(): FinancialNotificationsService {
  if (!financialNotificationsService) {
    financialNotificationsService = new FinancialNotificationsService();
  }
  return financialNotificationsService;
}

export { FinancialNotificationsService };
