/**
 * Financial Notifications Service
 * Handles email, push, and in-app notifications for financial events
 * Sprint M5: Freelancer Financial Services
 */

import { createLogger } from '@skillancer/logger';
import { prisma } from '@skillancer/database';
import { emailProvider } from '../providers/email.js';
import { pushProvider } from '../providers/push.js';
import { smsProvider } from '../providers/sms.js';
import { queueManager, QueueNames, JobNames } from '@skillancer/service-client';

const baseLogger = createLogger({ name: 'FinancialNotifications' });

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

    // Get user email from database
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, firstName: true },
    });

    if (!user?.email) {
      this.logger.warn('User email not found for notification', { userId: notification.userId });
      return;
    }

    // Send via email provider
    await emailProvider.sendTemplate(templateId, user.email, {
      name: user.firstName || 'User',
      title: notification.title,
      body: notification.body,
      ...notification.data,
    });

    this.logger.info('Email notification sent', { userId: notification.userId, templateId });
  }

  private async sendPush(notification: FinancialNotification): Promise<void> {
    this.logger.info('Sending push notification', {
      userId: notification.userId,
      type: notification.type,
    });

    // Send via push provider
    const pushPriority = notification.priority === 'urgent' ? 'high' : notification.priority === 'high' ? 'high' : 'normal';
    await pushProvider.send({
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      data: Object.fromEntries(
        Object.entries(notification.data).map(([k, v]) => [k, String(v)])
      ),
      priority: pushPriority,
    });

    this.logger.info('Push notification sent', { userId: notification.userId, type: notification.type });
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

    // Get user phone from database
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { phone: true },
    });

    if (!user?.phone) {
      this.logger.warn('User phone not found for SMS notification', { userId: notification.userId });
      return;
    }

    // Send via SMS provider
    await smsProvider.send({
      to: user.phone,
      body: notification.body,
      priority: notification.priority === 'urgent' ? 'high' : 'normal',
    });

    this.logger.info('SMS notification sent', { userId: notification.userId, type: notification.type });
  }

  // ---------------------------------------------------------------------------
  // PREFERENCES
  // ---------------------------------------------------------------------------

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    // Fetch from database
    const dbPrefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // Return database preferences or defaults
    if (dbPrefs) {
      return {
        userId,
        payouts: (dbPrefs.payouts as NotificationChannel) || { email: true, push: true, inApp: true, sms: false },
        cards: (dbPrefs.cards as NotificationChannel) || { email: true, push: true, inApp: true, sms: false },
        taxes: (dbPrefs.taxes as NotificationChannel) || { email: true, push: true, inApp: true, sms: false },
        security: (dbPrefs.security as NotificationChannel) || { email: true, push: true, inApp: true, sms: true },
        marketing: (dbPrefs.marketing as NotificationChannel) || { email: false, push: false, inApp: false, sms: false },
        quietHoursEnabled: dbPrefs.quietHoursEnabled ?? true,
        quietHoursStart: dbPrefs.quietHoursStart || '22:00',
        quietHoursEnd: dbPrefs.quietHoursEnd || '08:00',
        timezone: dbPrefs.timezone || 'America/New_York',
      };
    }

    // Return defaults if no preferences found
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

    // Save to database
    await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        payouts: updated.payouts as object,
        cards: updated.cards as object,
        taxes: updated.taxes as object,
        security: updated.security as object,
        marketing: updated.marketing as object,
        quietHoursEnabled: updated.quietHoursEnabled,
        quietHoursStart: updated.quietHoursStart,
        quietHoursEnd: updated.quietHoursEnd,
        timezone: updated.timezone,
      },
      update: {
        payouts: updated.payouts as object,
        cards: updated.cards as object,
        taxes: updated.taxes as object,
        security: updated.security as object,
        marketing: updated.marketing as object,
        quietHoursEnabled: updated.quietHoursEnabled,
        quietHoursStart: updated.quietHoursStart,
        quietHoursEnd: updated.quietHoursEnd,
        timezone: updated.timezone,
      },
    });

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

    this.logger.info('Fetching in-app notifications', { userId, unreadOnly, limit });

    // Fetch from database
    const whereClause = {
      userId,
      ...(unreadOnly ? { read: false } : {}),
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type as FinancialNotificationType,
        title: n.title,
        body: n.body,
        data: (n.data as Record<string, unknown>) || {},
        channels: (n.channels as (keyof NotificationChannel)[]) || [],
        priority: (n.priority as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
        read: n.read,
        createdAt: n.createdAt,
        sentAt: n.sentAt || undefined,
        readAt: n.readAt || undefined,
      })),
      unreadCount,
    };
  }

  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    // Update in database
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    this.logger.info('Marking notifications as read', { userId, count: notificationIds.length });
  }

  async markAllAsRead(userId: string): Promise<void> {
    // Update all unread in database
    await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

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
    // Calculate delay until quiet hours end
    const now = new Date();
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);
    const quietHoursEnd = new Date(now);
    quietHoursEnd.setHours(endHour, endMin, 0, 0);

    // If quiet hours end is before now, add a day
    if (quietHoursEnd <= now) {
      quietHoursEnd.setDate(quietHoursEnd.getDate() + 1);
    }

    const delayMs = quietHoursEnd.getTime() - now.getTime();

    // Add to delayed queue using BullMQ
    try {
      await queueManager.addJob(
        QueueNames.NOTIFICATIONS,
        JobNames.SEND_NOTIFICATION,
        {
          notification,
          preferences,
        },
        { delay: delayMs }
      );

      this.logger.info('Notification queued for after quiet hours', {
        notificationId: notification.id,
        quietHoursEnd: preferences.quietHoursEnd,
        delayMs,
      });
    } catch (error) {
      // Fallback: store with scheduled flag if queue fails
      await this.storeNotification({ ...notification, data: { ...notification.data, scheduledFor: quietHoursEnd.toISOString() } });
      this.logger.warn('Queue unavailable, notification stored with schedule', { notificationId: notification.id, error });
    }
  }

  private async storeNotification(notification: FinancialNotification): Promise<void> {
    // Save to database
    await prisma.notification.create({
      data: {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data as object,
        channels: notification.channels,
        priority: notification.priority,
        read: notification.read,
        createdAt: notification.createdAt,
        sentAt: notification.sentAt,
      },
    });

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
