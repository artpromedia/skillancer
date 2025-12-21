/**
 * @module @skillancer/market-svc/repositories/email-unsubscribe
 * Repository for email unsubscribe management
 */

import type { UnsubscribeParams } from '../types/notification.types.js';
import type {
  EmailUnsubscribe,
  NotificationCategory,
  UnsubscribeType,
  PrismaClient,
  Prisma,
} from '@skillancer/database';

export interface EmailUnsubscribeRepository {
  create(data: UnsubscribeParams): Promise<EmailUnsubscribe>;
  findByEmail(email: string): Promise<EmailUnsubscribe[]>;
  findByUser(userId: string): Promise<EmailUnsubscribe[]>;
  isUnsubscribed(
    email: string,
    category?: NotificationCategory,
    notificationType?: string
  ): Promise<boolean>;
  delete(id: string): Promise<void>;
  resubscribe(
    email: string,
    type: UnsubscribeType,
    category?: NotificationCategory,
    notificationType?: string
  ): Promise<void>;
}

export function createEmailUnsubscribeRepository(prisma: PrismaClient): EmailUnsubscribeRepository {
  return {
    async create(data: UnsubscribeParams): Promise<EmailUnsubscribe> {
      const createInput: Prisma.EmailUnsubscribeCreateInput = {
        email: data.email,
        unsubscribeType: data.type,
        source: data.source,
      };

      if (data.userId) {
        createInput.user = { connect: { id: data.userId } };
      }
      if (data.category) createInput.category = data.category;
      if (data.notificationType) createInput.notificationType = data.notificationType;

      return prisma.emailUnsubscribe.create({
        data: createInput,
      });
    },

    async findByEmail(email: string): Promise<EmailUnsubscribe[]> {
      return prisma.emailUnsubscribe.findMany({
        where: { email },
      });
    },

    async findByUser(userId: string): Promise<EmailUnsubscribe[]> {
      return prisma.emailUnsubscribe.findMany({
        where: { userId },
      });
    },

    async isUnsubscribed(
      email: string,
      category?: NotificationCategory,
      notificationType?: string
    ): Promise<boolean> {
      // Check for global unsubscribe
      const globalUnsub = await prisma.emailUnsubscribe.findFirst({
        where: {
          email,
          unsubscribeType: 'ALL',
        },
      });

      if (globalUnsub) return true;

      // Check for category unsubscribe
      if (category) {
        const categoryUnsub = await prisma.emailUnsubscribe.findFirst({
          where: {
            email,
            unsubscribeType: 'CATEGORY',
            category,
          },
        });

        if (categoryUnsub) return true;
      }

      // Check for type-specific unsubscribe
      if (notificationType) {
        const typeUnsub = await prisma.emailUnsubscribe.findFirst({
          where: {
            email,
            unsubscribeType: 'TYPE',
            notificationType,
          },
        });

        if (typeUnsub) return true;
      }

      return false;
    },

    async delete(id: string): Promise<void> {
      await prisma.emailUnsubscribe.delete({
        where: { id },
      });
    },

    async resubscribe(
      email: string,
      type: UnsubscribeType,
      category?: NotificationCategory,
      notificationType?: string
    ): Promise<void> {
      const where: Prisma.EmailUnsubscribeWhereInput = {
        email,
        unsubscribeType: type,
      };

      if (category) where.category = category;
      if (notificationType) where.notificationType = notificationType;

      await prisma.emailUnsubscribe.deleteMany({ where });
    },
  };
}
