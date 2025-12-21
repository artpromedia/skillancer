/**
 * @module @skillancer/market-svc/repositories/notification-preference
 * Repository for user notification preferences
 */

import type { QuietHoursSettings, PreferenceUpdate } from '../types/notification.types.js';
import type {
  NotificationPreference,
  NotificationCategory,
  EmailFrequency,
  PrismaClient,
  Prisma,
} from '@skillancer/database';

export interface NotificationPreferenceRepository {
  findByUser(userId: string): Promise<NotificationPreference[]>;
  findByUserAndType(
    userId: string,
    notificationType: string
  ): Promise<NotificationPreference | null>;
  upsert(data: UpsertPreferenceData): Promise<NotificationPreference>;
  updateByType(
    userId: string,
    notificationType: string,
    data: Partial<PreferenceUpdate>
  ): Promise<NotificationPreference>;
  updateQuietHours(userId: string, settings: QuietHoursSettings): Promise<void>;
  disableAllEmail(userId: string): Promise<void>;
  disableEmailByCategory(userId: string, category: NotificationCategory): Promise<void>;
  delete(userId: string, notificationType: string): Promise<void>;
}

export interface UpsertPreferenceData {
  userId: string;
  notificationType: string;
  inAppEnabled?: boolean | undefined;
  emailEnabled?: boolean | undefined;
  pushEnabled?: boolean | undefined;
  smsEnabled?: boolean | undefined;
  emailFrequency?: EmailFrequency | undefined;
  quietHoursEnabled?: boolean | undefined;
  quietHoursStart?: string | undefined;
  quietHoursEnd?: string | undefined;
  quietHoursTimezone?: string | undefined;
}

export function createNotificationPreferenceRepository(
  prisma: PrismaClient
): NotificationPreferenceRepository {
  return {
    async findByUser(userId: string): Promise<NotificationPreference[]> {
      return prisma.notificationPreference.findMany({
        where: { userId },
      });
    },

    async findByUserAndType(
      userId: string,
      notificationType: string
    ): Promise<NotificationPreference | null> {
      return prisma.notificationPreference.findUnique({
        where: {
          userId_notificationType: {
            userId,
            notificationType,
          },
        },
      });
    },

    async upsert(data: UpsertPreferenceData): Promise<NotificationPreference> {
      const updateData: Prisma.NotificationPreferenceUpdateInput = {};
      const createData: Prisma.NotificationPreferenceCreateInput = {
        user: { connect: { id: data.userId } },
        notificationType: data.notificationType,
      };

      // Build update data
      if (data.inAppEnabled !== undefined) {
        updateData.inAppEnabled = data.inAppEnabled;
        createData.inAppEnabled = data.inAppEnabled;
      }
      if (data.emailEnabled !== undefined) {
        updateData.emailEnabled = data.emailEnabled;
        createData.emailEnabled = data.emailEnabled;
      }
      if (data.pushEnabled !== undefined) {
        updateData.pushEnabled = data.pushEnabled;
        createData.pushEnabled = data.pushEnabled;
      }
      if (data.smsEnabled !== undefined) {
        updateData.smsEnabled = data.smsEnabled;
        createData.smsEnabled = data.smsEnabled;
      }
      if (data.emailFrequency !== undefined) {
        updateData.emailFrequency = data.emailFrequency;
        createData.emailFrequency = data.emailFrequency;
      }
      if (data.quietHoursEnabled !== undefined) {
        updateData.quietHoursEnabled = data.quietHoursEnabled;
        createData.quietHoursEnabled = data.quietHoursEnabled;
      }
      if (data.quietHoursStart !== undefined) {
        updateData.quietHoursStart = data.quietHoursStart;
        createData.quietHoursStart = data.quietHoursStart;
      }
      if (data.quietHoursEnd !== undefined) {
        updateData.quietHoursEnd = data.quietHoursEnd;
        createData.quietHoursEnd = data.quietHoursEnd;
      }
      if (data.quietHoursTimezone !== undefined) {
        updateData.quietHoursTimezone = data.quietHoursTimezone;
        createData.quietHoursTimezone = data.quietHoursTimezone;
      }

      return prisma.notificationPreference.upsert({
        where: {
          userId_notificationType: {
            userId: data.userId,
            notificationType: data.notificationType,
          },
        },
        update: updateData,
        create: createData,
      });
    },

    async updateByType(
      userId: string,
      notificationType: string,
      data: Partial<PreferenceUpdate>
    ): Promise<NotificationPreference> {
      const updateData: Prisma.NotificationPreferenceUpdateInput = {};

      if (data.inAppEnabled !== undefined) updateData.inAppEnabled = data.inAppEnabled;
      if (data.emailEnabled !== undefined) updateData.emailEnabled = data.emailEnabled;
      if (data.pushEnabled !== undefined) updateData.pushEnabled = data.pushEnabled;
      if (data.smsEnabled !== undefined) updateData.smsEnabled = data.smsEnabled;
      if (data.emailFrequency !== undefined) updateData.emailFrequency = data.emailFrequency;

      return prisma.notificationPreference.update({
        where: {
          userId_notificationType: {
            userId,
            notificationType,
          },
        },
        data: updateData,
      });
    },

    async updateQuietHours(userId: string, settings: QuietHoursSettings): Promise<void> {
      // Update all preferences for this user with quiet hours settings
      await prisma.notificationPreference.updateMany({
        where: { userId },
        data: {
          quietHoursEnabled: settings.enabled,
          quietHoursStart: settings.startTime ?? null,
          quietHoursEnd: settings.endTime ?? null,
          quietHoursTimezone: settings.timezone ?? null,
        },
      });
    },

    async disableAllEmail(userId: string): Promise<void> {
      await prisma.notificationPreference.updateMany({
        where: { userId },
        data: {
          emailEnabled: false,
          emailFrequency: 'NEVER',
        },
      });
    },

    async disableEmailByCategory(userId: string, category: NotificationCategory): Promise<void> {
      // Get all notification types for this category from templates
      const templates = await prisma.notificationTemplate.findMany({
        where: { category },
        select: { type: true },
      });

      const notificationTypes = templates.map((t) => t.type);

      if (notificationTypes.length > 0) {
        await prisma.notificationPreference.updateMany({
          where: {
            userId,
            notificationType: { in: notificationTypes },
          },
          data: {
            emailEnabled: false,
          },
        });
      }
    },

    async delete(userId: string, notificationType: string): Promise<void> {
      await prisma.notificationPreference.delete({
        where: {
          userId_notificationType: {
            userId,
            notificationType,
          },
        },
      });
    },
  };
}
