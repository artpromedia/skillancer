/**
 * @module @skillancer/market-svc/repositories/notification
 * Repository for notification CRUD operations
 */

import type { NotificationListOptions } from '../types/notification.types.js';
import type {
  Notification,
  NotificationCategory,
  NotificationPriority,
  PrismaClient,
} from '../types/prisma-shim.js';
import { Prisma } from '../types/prisma-shim.js';

export interface CreateNotificationData {
  userId: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  iconUrl?: string | undefined;
  imageUrl?: string | undefined;
  actionUrl?: string | undefined;
  actionLabel?: string | undefined;
  data?: Record<string, unknown> | undefined;
  groupKey?: string | undefined;
  groupCount?: number | undefined;
  channels: string[];
  expiresAt?: Date | undefined;
}

export interface UpdateNotificationData {
  title?: string | undefined;
  body?: string | undefined;
  data?: Record<string, unknown> | undefined;
  groupCount?: number | undefined;
  isRead?: boolean | undefined;
  readAt?: Date | undefined;
  isDismissed?: boolean | undefined;
  dismissedAt?: Date | undefined;
  deliveryStatus?: Record<string, string> | undefined;
}

export interface NotificationRepository {
  create(data: CreateNotificationData): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByUser(
    userId: string,
    options: NotificationListOptions
  ): Promise<{ notifications: Notification[]; total: number }>;
  findByGroupKey(userId: string, groupKey: string): Promise<Notification | null>;
  update(id: string, data: UpdateNotificationData): Promise<Notification>;
  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(userId: string, category?: NotificationCategory): Promise<number>;
  dismiss(id: string): Promise<Notification>;
  getUnreadCount(userId: string): Promise<number>;
  getUnreadCountByCategory(userId: string): Promise<Record<string, number>>;
  deleteExpired(): Promise<number>;
  deleteByUser(userId: string): Promise<number>;
}

export function createNotificationRepository(prisma: PrismaClient): NotificationRepository {
  return {
    async create(data: CreateNotificationData): Promise<Notification> {
      const createInput: Prisma.NotificationCreateInput = {
        user: { connect: { id: data.userId } },
        type: data.type,
        category: data.category,
        priority: data.priority,
        title: data.title,
        body: data.body,
        channels: data.channels,
      };

      if (data.iconUrl) createInput.iconUrl = data.iconUrl;
      if (data.imageUrl) createInput.imageUrl = data.imageUrl;
      if (data.actionUrl) createInput.actionUrl = data.actionUrl;
      if (data.actionLabel) createInput.actionLabel = data.actionLabel;
      if (data.data) createInput.data = data.data as unknown as Prisma.InputJsonValue;
      if (data.groupKey) createInput.groupKey = data.groupKey;
      if (data.groupCount !== undefined) createInput.groupCount = data.groupCount;
      if (data.expiresAt) createInput.expiresAt = data.expiresAt;

      return prisma.notification.create({
        data: createInput,
      });
    },

    async findById(id: string): Promise<Notification | null> {
      return prisma.notification.findUnique({
        where: { id },
      });
    },

    async findByUser(
      userId: string,
      options: NotificationListOptions
    ): Promise<{ notifications: Notification[]; total: number }> {
      const { category, isRead, page = 1, limit = 20 } = options;

      const where: Prisma.NotificationWhereInput = {
        userId,
        isDismissed: false,
      };

      if (category) where.category = category;
      if (isRead !== undefined) where.isRead = isRead;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      return { notifications, total };
    },

    async findByGroupKey(userId: string, groupKey: string): Promise<Notification | null> {
      return prisma.notification.findFirst({
        where: {
          userId,
          groupKey,
          isDismissed: false,
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    async update(id: string, data: UpdateNotificationData): Promise<Notification> {
      const updateData: Prisma.NotificationUpdateInput = {};

      if (data.title !== undefined) updateData.title = data.title;
      if (data.body !== undefined) updateData.body = data.body;
      if (data.data !== undefined) updateData.data = data.data as unknown as Prisma.InputJsonValue;
      if (data.groupCount !== undefined) updateData.groupCount = data.groupCount;
      if (data.isRead !== undefined) updateData.isRead = data.isRead;
      if (data.readAt !== undefined) updateData.readAt = data.readAt;
      if (data.isDismissed !== undefined) updateData.isDismissed = data.isDismissed;
      if (data.dismissedAt !== undefined) updateData.dismissedAt = data.dismissedAt;
      if (data.deliveryStatus !== undefined) {
        updateData.deliveryStatus = data.deliveryStatus as unknown as Prisma.InputJsonValue;
      }

      return prisma.notification.update({
        where: { id },
        data: updateData,
      });
    },

    async markAsRead(id: string): Promise<Notification> {
      return prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    },

    async markAllAsRead(userId: string, category?: NotificationCategory): Promise<number> {
      const where: Prisma.NotificationWhereInput = {
        userId,
        isRead: false,
      };

      if (category) where.category = category;

      const result = await prisma.notification.updateMany({
        where,
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return result.count;
    },

    async dismiss(id: string): Promise<Notification> {
      return prisma.notification.update({
        where: { id },
        data: {
          isDismissed: true,
          dismissedAt: new Date(),
        },
      });
    },

    async getUnreadCount(userId: string): Promise<number> {
      return prisma.notification.count({
        where: {
          userId,
          isRead: false,
          isDismissed: false,
        },
      });
    },

    async getUnreadCountByCategory(userId: string): Promise<Record<string, number>> {
      const results = await prisma.notification.groupBy({
        by: ['category'],
        where: {
          userId,
          isRead: false,
          isDismissed: false,
        },
        _count: { id: true },
      });

      return results.reduce(
        (acc, item) => {
          acc[item.category] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      );
    },

    async deleteExpired(): Promise<number> {
      const result = await prisma.notification.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      return result.count;
    },

    async deleteByUser(userId: string): Promise<number> {
      const result = await prisma.notification.deleteMany({
        where: { userId },
      });

      return result.count;
    },
  };
}
