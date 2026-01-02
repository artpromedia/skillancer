/**
 * Notification Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../services/notification.service.js';
import { PrismaClient } from '@prisma/client';
import {
  EmailNotificationInput,
  PushNotificationInput,
  NotificationChannel,
} from '../types/notification.types.js';

const prisma = new PrismaClient();
const notificationService = new NotificationService(prisma);

export async function notificationRoutes(fastify: FastifyInstance) {
  // Send email notification
  fastify.post('/email', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as EmailNotificationInput;
      const result = await notificationService.sendEmail({ ...input, userId });

      return reply.status(result.status === 'SENT' ? 200 : 400).send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Send push notification
  fastify.post('/push', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const input = request.body as PushNotificationInput;
      const result = await notificationService.sendPush({ ...input, userId });

      return reply.status(result.status === 'SENT' ? 200 : 400).send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Send templated email
  fastify.post('/email/template', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { to, emailType, templateData, subject } = request.body as {
        to: string;
        emailType: string;
        templateData: Record<string, unknown>;
        subject?: string;
      };

      const result = await notificationService.sendTemplatedEmail(
        userId,
        to,
        emailType as any,
        templateData,
        { subject }
      );

      return reply.status(result.status === 'SENT' ? 200 : 400).send(result);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Send multi-channel notification
  fastify.post('/multi-channel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { channels, email, push } = request.body as {
        channels: NotificationChannel[];
        email?: Omit<EmailNotificationInput, 'userId' | 'channels'>;
        push?: Omit<PushNotificationInput, 'userId' | 'channels'>;
      };

      const results = await notificationService.sendMultiChannel(userId, channels, {
        email,
        push,
      });

      return reply.send({ results });
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Register device token
  fastify.post('/devices', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { token, platform, deviceId } = request.body as {
        token: string;
        platform: 'IOS' | 'ANDROID' | 'WEB';
        deviceId: string;
      };

      const device = await notificationService.registerDeviceToken(
        userId,
        token,
        platform,
        deviceId
      );

      return reply.status(201).send(device);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Deactivate device token
  fastify.delete('/devices/:deviceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { deviceId } = request.params as { deviceId: string };
      await notificationService.deactivateDeviceToken(userId, deviceId);

      return reply.status(204).send();
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get user preferences
  fastify.get('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const preferences = await notificationService.getUserPreferences(userId);

      if (!preferences) {
        return reply.status(404).send({ error: 'Preferences not found' });
      }

      return reply.send(preferences);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update user preferences
  fastify.put('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const preferences = request.body as any;
      const updated = await notificationService.updateUserPreferences(userId, preferences);

      return reply.send(updated);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get notification history
  fastify.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { channel, status, limit, offset } = request.query as {
        channel?: NotificationChannel;
        status?: string;
        limit?: string;
        offset?: string;
      };

      const history = await notificationService.getNotificationHistory(userId, {
        channel,
        status: status as any,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      return reply.send(history);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get notification stats (admin only)
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.id) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Check if user is admin - simplified check
      const { userId, tenantId, startDate, endDate } = request.query as {
        userId?: string;
        tenantId?: string;
        startDate?: string;
        endDate?: string;
      };

      const stats = await notificationService.getNotificationStats(
        userId || user.id,
        tenantId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      return reply.send(stats);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
