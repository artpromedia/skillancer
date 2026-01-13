// @ts-nocheck
/**
 * @module @skillancer/market-svc/repositories/notification-digest
 * Repository for notification digest management
 */

import type { CreateDigestParams, DigestSummary } from '../types/notification.types.js';
import type {
  NotificationDigest,
  DigestType,
  DigestStatus,
  PrismaClient,
  Prisma,
} from '../types/prisma-shim.js';

export interface NotificationDigestRepository {
  create(data: CreateDigestParams): Promise<NotificationDigest>;
  findById(id: string): Promise<NotificationDigest | null>;
  findPending(scheduledBefore?: Date): Promise<NotificationDigest[]>;
  findByUser(
    userId: string,
    options?: { status?: DigestStatus; limit?: number }
  ): Promise<NotificationDigest[]>;
  addToDigest(params: AddToDigestParams): Promise<NotificationDigest>;
  updateStatus(id: string, status: DigestStatus, emailId?: string): Promise<NotificationDigest>;
  markAsSent(id: string, emailId: string): Promise<NotificationDigest>;
  deleteOld(olderThan: Date): Promise<number>;
}

export interface AddToDigestParams {
  userId: string;
  notificationId: string;
  digestType: DigestType;
  scheduledFor: Date;
}

export function createNotificationDigestRepository(
  prisma: PrismaClient
): NotificationDigestRepository {
  return {
    async create(data: CreateDigestParams): Promise<NotificationDigest> {
      return prisma.notificationDigest.create({
        data: {
          user: { connect: { id: data.userId } },
          digestType: data.digestType,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          notificationIds: data.notificationIds,
          summary: data.summary as unknown as Prisma.InputJsonValue,
          scheduledFor: data.scheduledFor,
        },
      });
    },

    async findById(id: string): Promise<NotificationDigest | null> {
      return prisma.notificationDigest.findUnique({
        where: { id },
      });
    },

    async findPending(scheduledBefore?: Date): Promise<NotificationDigest[]> {
      const where: Prisma.NotificationDigestWhereInput = {
        status: 'PENDING',
      };

      if (scheduledBefore) {
        where.scheduledFor = { lte: scheduledBefore };
      }

      return prisma.notificationDigest.findMany({
        where,
        orderBy: { scheduledFor: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    },

    async findByUser(
      userId: string,
      options: { status?: DigestStatus; limit?: number } = {}
    ): Promise<NotificationDigest[]> {
      const where: Prisma.NotificationDigestWhereInput = { userId };

      if (options.status) where.status = options.status;

      return prisma.notificationDigest.findMany({
        where,
        orderBy: { scheduledFor: 'desc' },
        ...(options.limit !== undefined && { take: options.limit }),
      });
    },

    async addToDigest(params: AddToDigestParams): Promise<NotificationDigest> {
      const { userId, notificationId, digestType, scheduledFor } = params;

      // Find existing pending digest for this user and type
      const existing = await prisma.notificationDigest.findFirst({
        where: {
          userId,
          digestType,
          status: 'PENDING',
          scheduledFor,
        },
      });

      if (existing) {
        // Add notification to existing digest
        return prisma.notificationDigest.update({
          where: { id: existing.id },
          data: {
            notificationIds: { push: notificationId },
          },
        });
      }

      // Create new digest
      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;

      switch (digestType) {
        case 'HOURLY':
          periodStart = new Date(now);
          periodStart.setMinutes(0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setHours(periodEnd.getHours() + 1);
          break;
        case 'DAILY':
          periodStart = new Date(now);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 1);
          break;
        case 'WEEKLY':
          periodStart = new Date(now);
          periodStart.setDate(periodStart.getDate() - periodStart.getDay());
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 7);
          break;
      }

      const summary: DigestSummary = {
        totalCount: 1,
        byCategory: {} as Record<string, number>,
        highlights: [],
      };

      return prisma.notificationDigest.create({
        data: {
          user: { connect: { id: userId } },
          digestType,
          periodStart,
          periodEnd,
          notificationIds: [notificationId],
          summary: summary as unknown as Prisma.InputJsonValue,
          scheduledFor,
        },
      });
    },

    async updateStatus(
      id: string,
      status: DigestStatus,
      emailId?: string
    ): Promise<NotificationDigest> {
      const data: Prisma.NotificationDigestUpdateInput = { status };

      if (emailId) data.emailId = emailId;
      if (status === 'SENT') data.sentAt = new Date();

      return prisma.notificationDigest.update({
        where: { id },
        data,
      });
    },

    async markAsSent(id: string, emailId: string): Promise<NotificationDigest> {
      return prisma.notificationDigest.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          emailId,
        },
      });
    },

    async deleteOld(olderThan: Date): Promise<number> {
      const result = await prisma.notificationDigest.deleteMany({
        where: {
          createdAt: { lt: olderThan },
          status: { in: ['SENT', 'FAILED'] },
        },
      });

      return result.count;
    },
  };
}

