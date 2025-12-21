/**
 * @module @skillancer/market-svc/services/notification
 * Main notification service for multi-channel delivery
 */

import type { EmailService } from './email.service.js';
import type { PushService } from './push.service.js';
import type { SmsService } from './sms.service.js';
import type { EmailUnsubscribeRepository } from '../repositories/email-unsubscribe.repository.js';
import type { NotificationDigestRepository } from '../repositories/notification-digest.repository.js';
import type { NotificationPreferenceRepository } from '../repositories/notification-preference.repository.js';
import type { NotificationTemplateRepository } from '../repositories/notification-template.repository.js';
import type {
  NotificationRepository,
  CreateNotificationData,
  UpdateNotificationData,
} from '../repositories/notification.repository.js';
import type {
  SendNotificationParams,
  NotificationChannel,
  RenderedContent,
  NotificationPreferences,
  NotificationListOptions,
  NotificationResponse,
  UnreadCountResponse,
  UserPreferenceResponse,
  PreferenceUpdate,
  QuietHoursSettings,
  UnsubscribeParams,
  NotificationError,
} from '../types/notification.types.js';
import type {
  PrismaClient,
  Notification,
  NotificationTemplate,
  NotificationCategory,
  User,
  EmailFrequency,
} from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

/**
 * Determine which channels to use based on template and preferences
 */
function determineChannels(
  template: NotificationTemplate,
  preferences: NotificationPreferences
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];

  if (preferences.inAppEnabled && template.inAppTitle) {
    channels.push('IN_APP');
  }
  if (preferences.emailEnabled && template.emailSubject) {
    channels.push('EMAIL');
  }
  if (preferences.pushEnabled && template.pushTitle) {
    channels.push('PUSH');
  }
  if (preferences.smsEnabled && template.smsTemplate) {
    channels.push('SMS');
  }

  return channels;
}

/**
 * Render template with data substitution
 */
function renderTemplate(
  template: NotificationTemplate,
  data: Record<string, unknown>
): RenderedContent {
  const render = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.replaceAll(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = data[key];
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      // At this point value is a primitive (string, number, boolean, bigint, symbol)
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return value.toString();
      }
      return '';
    });
  };

  return {
    inAppTitle: render(template.inAppTitle),
    inAppBody: render(template.inAppBody),
    emailSubject: render(template.emailSubject),
    emailHtml: render(template.emailHtmlTemplate),
    emailText: render(template.emailTextTemplate),
    pushTitle: render(template.pushTitle),
    pushBody: render(template.pushBody),
    smsMessage: render(template.smsTemplate),
    ...(data.actionUrl !== undefined && { actionUrl: data.actionUrl as string }),
    ...(data.actionLabel !== undefined && { actionLabel: data.actionLabel as string }),
  };
}

/**
 * Generate group key from template and data
 */
function generateGroupKey(
  template: NotificationTemplate,
  data?: Record<string, unknown>
): string | null {
  if (!template.isGroupable || !template.groupKeyTemplate || !data) {
    return null;
  }

  return template.groupKeyTemplate.replaceAll(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    // At this point value is a primitive (string, number, boolean, bigint, symbol)
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return value.toString();
    }
    return '';
  });
}

/**
 * Map database notification to API response format
 */
function mapToResponse(notification: Notification): NotificationResponse {
  return {
    id: notification.id,
    type: notification.type,
    category: notification.category,
    priority: notification.priority,
    title: notification.title,
    body: notification.body,
    iconUrl: notification.iconUrl,
    imageUrl: notification.imageUrl,
    actionUrl: notification.actionUrl,
    actionLabel: notification.actionLabel,
    data: notification.data as Record<string, unknown> | null,
    groupKey: notification.groupKey,
    groupCount: notification.groupCount,
    isRead: notification.isRead,
    readAt: notification.readAt,
    isDismissed: notification.isDismissed,
    createdAt: notification.createdAt,
  };
}

/**
 * Check if currently in quiet hours based on user preferences
 */
function isQuietHours(preferences: NotificationPreferences): boolean {
  const quietStart = preferences.quietHoursStart;
  const quietEnd = preferences.quietHoursEnd;

  if (!preferences.quietHoursEnabled || !quietStart || !quietEnd) {
    return false;
  }

  const now = new Date();
  const timezone = preferences.quietHoursTimezone || 'UTC';

  // Convert current time to user's timezone
  const userTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(now);

  const currentMinutes = timeToMinutes(userTime);
  const startMinutes = timeToMinutes(quietStart);
  const endMinutes = timeToMinutes(quietEnd);

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// =============================================================================
// SERVICE INTERFACES
// =============================================================================

export interface NotificationService {
  send(params: SendNotificationParams): Promise<Notification | null>;
  sendBulk(userIds: string[], params: Omit<SendNotificationParams, 'userId'>): Promise<number>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  markAllAsRead(userId: string, category?: NotificationCategory): Promise<number>;
  dismiss(notificationId: string, userId: string): Promise<void>;
  getNotifications(
    userId: string,
    options: NotificationListOptions
  ): Promise<{
    notifications: NotificationResponse[];
    total: number;
    unreadCount: number;
  }>;
  getUnreadCount(userId: string): Promise<UnreadCountResponse>;
  getPreferences(userId: string): Promise<UserPreferenceResponse[]>;
  updatePreferences(userId: string, preferences: PreferenceUpdate[]): Promise<void>;
  setQuietHours(userId: string, settings: QuietHoursSettings): Promise<void>;
  unsubscribe(params: UnsubscribeParams): Promise<void>;
  emitToUser(userId: string, event: string, data: unknown): Promise<void>;
}

/**
 * Build create notification data object
 */
function buildCreateData(
  params: SendNotificationParams,
  template: NotificationTemplate,
  content: RenderedContent,
  effectiveChannels: NotificationChannel[],
  groupKey: string | null,
  isGrouped: boolean
): CreateNotificationData {
  const createData: CreateNotificationData = {
    userId: params.userId,
    type: params.type,
    category: template.category,
    priority: params.priority || template.defaultPriority,
    title: content.inAppTitle,
    body: content.inAppBody,
    channels: effectiveChannels,
  };

  if (isGrouped) {
    createData.groupCount = 1;
    if (groupKey !== null) createData.groupKey = groupKey;
  } else {
    if (params.data?.iconUrl !== undefined) createData.iconUrl = params.data.iconUrl as string;
    if (params.data?.imageUrl !== undefined) createData.imageUrl = params.data.imageUrl as string;
  }

  if (content.actionUrl !== undefined) createData.actionUrl = content.actionUrl;
  if (content.actionLabel !== undefined) createData.actionLabel = content.actionLabel;
  if (params.data !== undefined) createData.data = params.data;
  if (params.expiresAt !== undefined) createData.expiresAt = params.expiresAt;

  return createData;
}

/**
 * Get effective channels after quiet hours check
 */
function getEffectiveChannelsAfterQuietHours(
  channels: NotificationChannel[],
  preferences: NotificationPreferences
): NotificationChannel[] {
  const inQuietHours = isQuietHours(preferences);
  return inQuietHours ? channels.filter((c) => c === 'IN_APP') : channels;
}

export interface NotificationServiceDependencies {
  prisma: PrismaClient;
  logger: Logger;
  notificationRepository: NotificationRepository;
  preferenceRepository: NotificationPreferenceRepository;
  templateRepository: NotificationTemplateRepository;
  digestRepository: NotificationDigestRepository;
  unsubscribeRepository: EmailUnsubscribeRepository;
  emailService: EmailService;
  pushService: PushService;
  smsService: SmsService;
  websocketEmitter?: (userId: string, event: string, data: unknown) => Promise<void>;
}

export function createNotificationService(
  deps: NotificationServiceDependencies
): NotificationService {
  const {
    prisma,
    logger,
    notificationRepository,
    preferenceRepository,
    templateRepository,
    digestRepository,
    unsubscribeRepository,
    emailService,
    pushService,
    smsService,
    websocketEmitter,
  } = deps;

  // Helper: Get user by ID
  async function getUser(userId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  // Helper: Get effective preferences for a notification type
  async function getEffectivePreferences(
    userId: string,
    notificationType: string
  ): Promise<NotificationPreferences> {
    const pref = await preferenceRepository.findByUserAndType(userId, notificationType);

    const result: NotificationPreferences = {
      inAppEnabled: pref?.inAppEnabled ?? true,
      emailEnabled: pref?.emailEnabled ?? true,
      pushEnabled: pref?.pushEnabled ?? true,
      smsEnabled: pref?.smsEnabled ?? false,
      emailFrequency: pref?.emailFrequency ?? 'IMMEDIATE',
      quietHoursEnabled: pref?.quietHoursEnabled ?? false,
    };

    if (pref?.quietHoursStart !== undefined) result.quietHoursStart = pref.quietHoursStart;
    if (pref?.quietHoursEnd !== undefined) result.quietHoursEnd = pref.quietHoursEnd;
    if (pref?.quietHoursTimezone !== undefined) result.quietHoursTimezone = pref.quietHoursTimezone;

    return result;
  }

  // Helper: Check if email is unsubscribed
  async function isUnsubscribed(
    email: string,
    category: NotificationCategory,
    notificationType: string
  ): Promise<boolean> {
    return unsubscribeRepository.isUnsubscribed(email, category, notificationType);
  }

  // Helper: Queue notification for digest
  async function queueForDigest(
    notification: Notification,
    frequency: 'HOURLY' | 'DAILY' | 'WEEKLY'
  ): Promise<void> {
    const now = new Date();
    let scheduledFor: Date;

    switch (frequency) {
      case 'HOURLY':
        scheduledFor = new Date(now.getTime() + 60 * 60 * 1000);
        scheduledFor.setMinutes(0, 0, 0);
        break;
      case 'DAILY':
        scheduledFor = new Date(now);
        scheduledFor.setDate(scheduledFor.getDate() + 1);
        scheduledFor.setHours(9, 0, 0, 0); // 9 AM
        break;
      case 'WEEKLY':
        scheduledFor = new Date(now);
        scheduledFor.setDate(scheduledFor.getDate() + (7 - scheduledFor.getDay())); // Next Sunday
        scheduledFor.setHours(9, 0, 0, 0);
        break;
    }

    await digestRepository.addToDigest({
      userId: notification.userId,
      notificationId: notification.id,
      digestType: frequency,
      scheduledFor,
    });
  }

  // Deliver to in-app channel
  async function deliverInApp(notification: Notification): Promise<void> {
    if (websocketEmitter) {
      await websocketEmitter(notification.userId, 'notification:new', {
        notification: mapToResponse(notification),
      });
    }
  }

  // Deliver to email channel
  async function deliverEmail(
    notification: Notification,
    template: NotificationTemplate,
    content: RenderedContent
  ): Promise<void> {
    const user = await getUser(notification.userId);
    if (!user?.email) return;

    // Check unsubscribe
    const unsubscribed = await isUnsubscribed(user.email, template.category, notification.type);
    if (unsubscribed) return;

    await emailService.send({
      to: user.email,
      subject: content.emailSubject,
      html: content.emailHtml,
      text: content.emailText,
      category: template.category,
      notificationType: notification.type,
      metadata: {
        notificationId: notification.id,
        userId: notification.userId,
      },
    });
  }

  // Deliver to push channel
  async function deliverPush(
    notification: Notification,
    _template: NotificationTemplate,
    content: RenderedContent
  ): Promise<void> {
    await pushService.send({
      userId: notification.userId,
      title: content.pushTitle || content.inAppTitle,
      body: content.pushBody || content.inAppBody,
      data: {
        notificationId: notification.id,
        type: notification.type,
        actionUrl: content.actionUrl,
        ...(notification.data as Record<string, unknown> | undefined),
      },
      priority: notification.priority === 'URGENT' ? 'high' : 'normal',
    });
  }

  // Deliver to SMS channel
  async function deliverSms(
    notification: Notification,
    _template: NotificationTemplate,
    content: RenderedContent
  ): Promise<void> {
    // User phone is stored in UserMfa, not UserProfile
    const mfa = await prisma.userMfa.findUnique({
      where: { userId: notification.userId },
      select: { phoneNumber: true, phoneVerified: true },
    });

    // Only send SMS if phone is verified
    const phoneNumber = mfa?.phoneVerified ? mfa.phoneNumber : null;
    if (!phoneNumber) return;

    await smsService.send({
      to: phoneNumber,
      message: content.smsMessage,
      metadata: {
        notificationId: notification.id,
      },
    });
  }

  // Deliver to all channels
  async function deliverToChannels(
    notification: Notification,
    template: NotificationTemplate,
    content: RenderedContent,
    channels: NotificationChannel[],
    preferences: NotificationPreferences
  ): Promise<void> {
    const deliveryStatus: Record<string, string> = {};

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'IN_APP':
            await deliverInApp(notification);
            deliveryStatus['IN_APP'] = 'DELIVERED';
            break;

          case 'EMAIL':
            if (preferences.emailFrequency === 'IMMEDIATE') {
              await deliverEmail(notification, template, content);
              deliveryStatus['EMAIL'] = 'DELIVERED';
            } else if (preferences.emailFrequency !== 'NEVER') {
              await queueForDigest(notification, preferences.emailFrequency);
              deliveryStatus['EMAIL'] = 'QUEUED_FOR_DIGEST';
            }
            break;

          case 'PUSH':
            await deliverPush(notification, template, content);
            deliveryStatus['PUSH'] = 'DELIVERED';
            break;

          case 'SMS':
            await deliverSms(notification, template, content);
            deliveryStatus['SMS'] = 'DELIVERED';
            break;
        }
      } catch (error) {
        logger.error({
          msg: `Failed to deliver notification via ${channel}`,
          notificationId: notification.id,
          channel,
          error,
        });
        deliveryStatus[channel] = 'FAILED';
      }
    }

    // Update delivery status
    await notificationRepository.update(notification.id, { deliveryStatus });
  }

  // Helper: Create or update grouped notification (needs repository access)
  async function handleGroupedNotification(
    params: SendNotificationParams,
    template: NotificationTemplate,
    content: RenderedContent,
    effectiveChannels: NotificationChannel[],
    groupKey: string
  ): Promise<Notification> {
    const existing = await notificationRepository.findByGroupKey(params.userId, groupKey);

    if (existing && !existing.isRead) {
      const updateData: UpdateNotificationData = {
        title: content.inAppTitle,
        body: content.inAppBody,
        groupCount: existing.groupCount + 1,
      };
      if (params.data !== undefined) updateData.data = params.data;
      return notificationRepository.update(existing.id, updateData);
    }

    const createData = buildCreateData(
      params,
      template,
      content,
      effectiveChannels,
      groupKey,
      true
    );
    return notificationRepository.create(createData);
  }

  return {
    async send(params: SendNotificationParams): Promise<Notification | null> {
      // Get template
      const template = await templateRepository.findByType(params.type);
      if (!template?.isActive) {
        logger.warn({ msg: 'No active template found', type: params.type });
        return null;
      }

      // Get user preferences
      const preferences = await getEffectivePreferences(params.userId, params.type);

      // Determine channels
      const channels = params.channels || determineChannels(template, preferences);
      if (channels.length === 0) {
        logger.debug({ msg: 'No channels enabled', type: params.type, userId: params.userId });
        return null;
      }

      // Check quiet hours
      const effectiveChannels = getEffectiveChannelsAfterQuietHours(channels, preferences);
      if (effectiveChannels.length === 0) {
        logger.debug({ msg: 'Blocked by quiet hours', type: params.type, userId: params.userId });
        return null;
      }

      // Render content
      const content = renderTemplate(template, params.data || {});
      const groupKey = params.groupKey || generateGroupKey(template, params.data);

      // Create notification
      let notification: Notification;
      if (groupKey && template.isGroupable) {
        notification = await handleGroupedNotification(
          params,
          template,
          content,
          effectiveChannels,
          groupKey
        );
      } else {
        const createData = buildCreateData(
          params,
          template,
          content,
          effectiveChannels,
          groupKey,
          false
        );
        notification = await notificationRepository.create(createData);
      }

      // Deliver to channels (async, don't block)
      deliverToChannels(notification, template, content, effectiveChannels, preferences).catch(
        (error: unknown) => {
          logger.error({
            msg: 'Error delivering notification to channels',
            notificationId: notification.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      );

      return notification;
    },

    async sendBulk(
      userIds: string[],
      params: Omit<SendNotificationParams, 'userId'>
    ): Promise<number> {
      let sent = 0;

      for (const userId of userIds) {
        try {
          const result = await this.send({ ...params, userId });
          if (result) sent++;
        } catch (error) {
          logger.error({
            msg: 'Error sending bulk notification',
            userId,
            type: params.type,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return sent;
    },

    async markAsRead(notificationId: string, userId: string): Promise<void> {
      const notification = await notificationRepository.findById(notificationId);
      if (notification?.userId !== userId) {
        const error = new Error('NOTIFICATION_NOT_FOUND') as NotificationError;
        error.code = 'NOTIFICATION_NOT_FOUND';
        throw error;
      }

      await notificationRepository.markAsRead(notificationId);

      // Emit read event
      if (websocketEmitter) {
        await websocketEmitter(userId, 'notification:read', { notificationId });
      }
    },

    async markAllAsRead(userId: string, category?: NotificationCategory): Promise<number> {
      const count = await notificationRepository.markAllAsRead(userId, category);

      if (websocketEmitter) {
        await websocketEmitter(userId, 'notifications:allRead', { category, count });
      }

      return count;
    },

    async dismiss(notificationId: string, userId: string): Promise<void> {
      const notification = await notificationRepository.findById(notificationId);
      if (notification?.userId !== userId) {
        const error = new Error('NOTIFICATION_NOT_FOUND') as NotificationError;
        error.code = 'NOTIFICATION_NOT_FOUND';
        throw error;
      }

      await notificationRepository.dismiss(notificationId);
    },

    async getNotifications(
      userId: string,
      options: NotificationListOptions
    ): Promise<{ notifications: NotificationResponse[]; total: number; unreadCount: number }> {
      const [result, unreadCount] = await Promise.all([
        notificationRepository.findByUser(userId, options),
        notificationRepository.getUnreadCount(userId),
      ]);

      return {
        notifications: result.notifications.map(mapToResponse),
        total: result.total,
        unreadCount,
      };
    },

    async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
      const [total, byCategory] = await Promise.all([
        notificationRepository.getUnreadCount(userId),
        notificationRepository.getUnreadCountByCategory(userId),
      ]);

      return { total, byCategory };
    },

    async getPreferences(userId: string): Promise<UserPreferenceResponse[]> {
      const [userPrefs, templates] = await Promise.all([
        preferenceRepository.findByUser(userId),
        templateRepository.findAll({ isActive: true }),
      ]);

      // Merge user preferences with template defaults
      return templates.map((template) => {
        const userPref = userPrefs.find((p) => p.notificationType === template.type);
        return {
          notificationType: template.type,
          category: template.category,
          name: template.name,
          description: template.description,
          inAppEnabled: userPref?.inAppEnabled ?? true,
          emailEnabled: userPref?.emailEnabled ?? template.defaultChannels.includes('EMAIL'),
          pushEnabled: userPref?.pushEnabled ?? template.defaultChannels.includes('PUSH'),
          smsEnabled: userPref?.smsEnabled ?? false,
          emailFrequency: userPref?.emailFrequency ?? 'IMMEDIATE',
        };
      });
    },

    async updatePreferences(userId: string, preferences: PreferenceUpdate[]): Promise<void> {
      for (const pref of preferences) {
        const upsertData: {
          userId: string;
          notificationType: string;
          inAppEnabled?: boolean;
          emailEnabled?: boolean;
          pushEnabled?: boolean;
          smsEnabled?: boolean;
          emailFrequency?: EmailFrequency;
        } = {
          userId,
          notificationType: pref.notificationType,
        };

        if (pref.inAppEnabled !== undefined) upsertData.inAppEnabled = pref.inAppEnabled;
        if (pref.emailEnabled !== undefined) upsertData.emailEnabled = pref.emailEnabled;
        if (pref.pushEnabled !== undefined) upsertData.pushEnabled = pref.pushEnabled;
        if (pref.smsEnabled !== undefined) upsertData.smsEnabled = pref.smsEnabled;
        if (pref.emailFrequency !== undefined) upsertData.emailFrequency = pref.emailFrequency;

        await preferenceRepository.upsert(upsertData);
      }
    },

    async setQuietHours(userId: string, settings: QuietHoursSettings): Promise<void> {
      await preferenceRepository.updateQuietHours(userId, settings);
    },

    async unsubscribe(params: UnsubscribeParams): Promise<void> {
      await unsubscribeRepository.create(params);

      // Update preferences if user ID provided
      if (params.userId) {
        if (params.type === 'ALL') {
          await preferenceRepository.disableAllEmail(params.userId);
        } else if (params.type === 'CATEGORY' && params.category) {
          await preferenceRepository.disableEmailByCategory(params.userId, params.category);
        } else if (params.type === 'TYPE' && params.notificationType) {
          await preferenceRepository.updateByType(params.userId, params.notificationType, {
            emailEnabled: false,
          });
        }
      }
    },

    async emitToUser(userId: string, event: string, data: unknown): Promise<void> {
      if (websocketEmitter) {
        await websocketEmitter(userId, event, data);
      }
    },
  };
}
