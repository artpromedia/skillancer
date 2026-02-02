/**
 * Notification Routes with Zod Validation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../services/notification.service.js';
import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import {
  SendEmailSchema,
  SendPushSchema,
  SendTemplatedEmailSchema,
  SendMultiChannelSchema,
  RegisterDeviceSchema,
  UpdatePreferencesSchema,
  GetHistoryQuerySchema,
  GetStatsQuerySchema,
} from '../schemas/notification.schemas.js';

const prisma = new PrismaClient();
const notificationService = new NotificationService(prisma);

// Validation error handler
function handleValidationError(error: ZodError, reply: FastifyReply) {
  const errors = error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
  return reply.status(400).send({
    error: 'Validation Error',
    details: errors,
  });
}

export async function notificationRoutes(fastify: FastifyInstance) {
  // Send email notification
  fastify.post('/email', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const validation = SendEmailSchema.safeParse(request.body);
      if (!validation.success) {
        return handleValidationError(validation.error, reply);
      }

      const input = validation.data;
      const result = await notificationService.sendEmail({
        ...input,
        userId,
        channels: ['EMAIL'],
        emailType: input.emailType || 'TRANSACTIONAL',
      } as any);

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

      const validation = SendPushSchema.safeParse(request.body);
      if (!validation.success) {
        return handleValidationError(validation.error, reply);
      }

      const input = validation.data;
      const result = await notificationService.sendPush({
        ...input,
        userId,
        channels: ['PUSH'],
        pushType: input.pushType || 'GENERAL',
      } as any);

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

      const validation = SendTemplatedEmailSchema.safeParse(request.body);
      if (!validation.success) {
        return handleValidationError(validation.error, reply);
      }

      const { to, emailType, templateData, subject } = validation.data;
      const result = await notificationService.sendTemplatedEmail(
        userId,
        to,
        emailType,
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

      const validation = SendMultiChannelSchema.safeParse(request.body);
      if (!validation.success) {
        return handleValidationError(validation.error, reply);
      }

      const { channels, email, push } = validation.data;
      const results = await notificationService.sendMultiChannel(userId, channels, {
        email: email as any,
        push: push as any,
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

      const validation = RegisterDeviceSchema.safeParse(request.body);
      if (!validation.success) {
        return handleValidationError(validation.error, reply);
      }

      const { token, platform, deviceId } = validation.data;
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
      if (!deviceId || deviceId.length > 100) {
        return reply.status(400).send({ error: 'Invalid device ID' });
      }

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

      const validation = UpdatePreferencesSchema.safeParse(request.body);
      if (!validation.success) {
        return handleValidationError(validation.error, reply);
      }

      const updated = await notificationService.updateUserPreferences(
        userId,
        validation.data as any
      );
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

      const validation = GetHistoryQuerySchema.safeParse(request.query);
      if (!validation.success) {
        return handleValidationError(validation.error, reply);
      }

      const { channel, status, limit, offset } = validation.data;
      const history = await notificationService.getNotificationHistory(userId, {
        channel,
        status,
        limit,
        offset,
      });

      return reply.send(history);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get notification stats
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      if (!user?.id) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const validation = GetStatsQuerySchema.safeParse(request.query);
      if (!validation.success) {
        return handleValidationError(validation.error, reply);
      }

      const { userId, tenantId, startDate, endDate } = validation.data;
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
