// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/market-svc/routes/notifications
 * REST API routes for notification management
 */

import { createEmailUnsubscribeRepository } from '../repositories/email-unsubscribe.repository.js';
import { createNotificationDigestRepository } from '../repositories/notification-digest.repository.js';
import { createNotificationPreferenceRepository } from '../repositories/notification-preference.repository.js';
import { createNotificationTemplateRepository } from '../repositories/notification-template.repository.js';
import { createNotificationRepository } from '../repositories/notification.repository.js';
import { createEmailService } from '../services/email.service.js';
import { createNotificationService } from '../services/notification.service.js';
import { createPushService } from '../services/push.service.js';
import { createSmsService } from '../services/sms.service.js';

import type { PreferenceUpdate, QuietHoursSettings } from '../types/notification.types.js';
import type { NotificationCategory, UnsubscribeType, PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifySchema } from 'fastify';

// Type alias for OpenAPI-compatible schemas
type OpenAPISchema = FastifySchema & {
  tags?: string[];
  summary?: string;
  description?: string;
};

// Authenticated request type
interface AuthenticatedRequest extends FastifyRequest {
  user?: { id: string; email: string };
}

export interface NotificationRoutesDeps {
  prisma: PrismaClient;
  logger: Logger;
}

interface NotificationParams {
  id: string;
}

interface ListNotificationsQuery {
  category?: NotificationCategory;
  isRead?: boolean;
  page?: number;
  limit?: number;
}

interface MarkAllReadBody {
  category?: NotificationCategory;
}

interface UpdatePreferencesBody {
  preferences: PreferenceUpdate[];
}

interface SetQuietHoursBody {
  enabled: boolean;
  startTime?: string;
  endTime?: string;
  timezone?: string;
}

interface UnsubscribeBody {
  token: string;
  type: UnsubscribeType;
  category?: NotificationCategory;
  notificationType?: string;
}

interface RegisterPushTokenBody {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

export function registerNotificationRoutes(
  fastify: FastifyInstance,
  deps: NotificationRoutesDeps
): void {
  const { prisma, logger } = deps;

  // Create repositories
  const notificationRepository = createNotificationRepository(prisma);
  const preferenceRepository = createNotificationPreferenceRepository(prisma);
  const templateRepository = createNotificationTemplateRepository(prisma);
  const digestRepository = createNotificationDigestRepository(prisma);
  const unsubscribeRepository = createEmailUnsubscribeRepository(prisma);

  // Create services
  const emailService = createEmailService({
    logger,
    config: {
      provider: (process.env.EMAIL_PROVIDER as 'sendgrid' | 'ses') || 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.EMAIL_FROM || 'noreply@skillancer.com',
      fromName: process.env.EMAIL_FROM_NAME || 'Skillancer',
      replyToEmail: process.env.EMAIL_REPLY_TO,
    },
  });

  const pushService = createPushService({
    prisma,
    logger,
    config: {
      provider: 'fcm',
      serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      projectId: process.env.FIREBASE_PROJECT_ID,
    },
  });

  const smsService = createSmsService({
    logger,
    config: {
      provider: 'twilio',
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
  });

  const notificationService = createNotificationService({
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
  });

  // ============================================================================
  // List Notifications
  // ============================================================================
  fastify.get<{
    Querystring: ListNotificationsQuery;
  }>(
    '/notifications',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Get user notifications',
        description: 'Retrieve paginated list of notifications for the authenticated user',
        querystring: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: [
                'MESSAGES',
                'PROJECTS',
                'CONTRACTS',
                'PAYMENTS',
                'ACCOUNT',
                'MARKETING',
                'SYSTEM',
              ],
            },
            isRead: { type: 'boolean' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              notifications: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    category: { type: 'string' },
                    priority: { type: 'string' },
                    title: { type: 'string' },
                    body: { type: 'string' },
                    iconUrl: { type: 'string', nullable: true },
                    imageUrl: { type: 'string', nullable: true },
                    actionUrl: { type: 'string', nullable: true },
                    actionLabel: { type: 'string', nullable: true },
                    data: { type: 'object', nullable: true },
                    groupKey: { type: 'string', nullable: true },
                    groupCount: { type: 'integer' },
                    isRead: { type: 'boolean' },
                    readAt: { type: 'string', format: 'date-time', nullable: true },
                    isDismissed: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              total: { type: 'integer' },
              unreadCount: { type: 'integer' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { category, isRead, page, limit } = request.query as ListNotificationsQuery;

      const result = await notificationService.getNotifications(userId, {
        category,
        isRead,
        page: page ?? 1,
        limit: limit ?? 20,
      });

      return reply.send(result);
    }
  );

  // ============================================================================
  // Get Unread Count
  // ============================================================================
  fastify.get(
    '/notifications/unread-count',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Get unread notification count',
        description: 'Get total and per-category unread notification counts',
        response: {
          200: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              byCategory: {
                type: 'object',
                additionalProperties: { type: 'integer' },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const result = await notificationService.getUnreadCount(userId);
      return reply.send(result);
    }
  );

  // ============================================================================
  // Mark as Read
  // ============================================================================
  fastify.post<{
    Params: NotificationParams;
  }>(
    '/notifications/:id/read',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Mark notification as read',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as NotificationParams;

      try {
        await notificationService.markAsRead(id, userId);
        return await reply.send({ success: true });
      } catch (error: any) {
        if (error.message === 'NOTIFICATION_NOT_FOUND') {
          return reply.status(404).send({ error: 'Notification not found' });
        }
        throw error;
      }
    }
  );

  // ============================================================================
  // Mark All as Read
  // ============================================================================
  fastify.post<{
    Body: MarkAllReadBody;
  }>(
    '/notifications/read-all',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Mark all notifications as read',
        body: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: [
                'MESSAGES',
                'PROJECTS',
                'CONTRACTS',
                'PAYMENTS',
                'ACCOUNT',
                'MARKETING',
                'SYSTEM',
              ],
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              count: { type: 'integer' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { category } = request.body as MarkAllReadBody;
      const count = await notificationService.markAllAsRead(userId, category);

      return reply.send({ success: true, count });
    }
  );

  // ============================================================================
  // Dismiss Notification
  // ============================================================================
  fastify.post<{
    Params: NotificationParams;
  }>(
    '/notifications/:id/dismiss',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Dismiss notification',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as NotificationParams;

      try {
        await notificationService.dismiss(id, userId);
        return await reply.send({ success: true });
      } catch (error: any) {
        if (error.message === 'NOTIFICATION_NOT_FOUND') {
          return reply.status(404).send({ error: 'Notification not found' });
        }
        throw error;
      }
    }
  );

  // ============================================================================
  // Get Preferences
  // ============================================================================
  fastify.get(
    '/notifications/preferences',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Get notification preferences',
        description: 'Get user notification preferences for all notification types',
        response: {
          200: {
            type: 'object',
            properties: {
              preferences: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    notificationType: { type: 'string' },
                    category: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string', nullable: true },
                    inAppEnabled: { type: 'boolean' },
                    emailEnabled: { type: 'boolean' },
                    pushEnabled: { type: 'boolean' },
                    smsEnabled: { type: 'boolean' },
                    emailFrequency: { type: 'string' },
                  },
                },
              },
              quietHours: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  startTime: { type: 'string', nullable: true },
                  endTime: { type: 'string', nullable: true },
                  timezone: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const preferences = await notificationService.getPreferences(userId);

      // Get quiet hours from first preference (they're all the same per user)
      const userPrefs = await preferenceRepository.findByUser(userId);
      const firstPref = userPrefs[0];

      return reply.send({
        preferences,
        quietHours: {
          enabled: firstPref?.quietHoursEnabled ?? false,
          startTime: firstPref?.quietHoursStart ?? null,
          endTime: firstPref?.quietHoursEnd ?? null,
          timezone: firstPref?.quietHoursTimezone ?? null,
        },
      });
    }
  );

  // ============================================================================
  // Update Preferences
  // ============================================================================
  fastify.put<{
    Body: UpdatePreferencesBody;
  }>(
    '/notifications/preferences',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Update notification preferences',
        body: {
          type: 'object',
          required: ['preferences'],
          properties: {
            preferences: {
              type: 'array',
              items: {
                type: 'object',
                required: ['notificationType'],
                properties: {
                  notificationType: { type: 'string' },
                  inAppEnabled: { type: 'boolean' },
                  emailEnabled: { type: 'boolean' },
                  pushEnabled: { type: 'boolean' },
                  smsEnabled: { type: 'boolean' },
                  emailFrequency: {
                    type: 'string',
                    enum: ['IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY', 'NEVER'],
                  },
                },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { preferences } = request.body as UpdatePreferencesBody;
      await notificationService.updatePreferences(userId, preferences);

      return reply.send({ success: true });
    }
  );

  // ============================================================================
  // Set Quiet Hours
  // ============================================================================
  fastify.put<{
    Body: SetQuietHoursBody;
  }>(
    '/notifications/quiet-hours',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Set quiet hours',
        description: 'Configure quiet hours when non-urgent notifications are not sent',
        body: {
          type: 'object',
          required: ['enabled'],
          properties: {
            enabled: { type: 'boolean' },
            startTime: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' },
            endTime: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' },
            timezone: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const body = request.body as SetQuietHoursBody;
      const settings: QuietHoursSettings = {
        enabled: body.enabled,
        startTime: body.startTime,
        endTime: body.endTime,
        timezone: body.timezone,
      };

      await notificationService.setQuietHours(userId, settings);

      return reply.send({ success: true });
    }
  );

  // ============================================================================
  // Unsubscribe
  // ============================================================================
  fastify.post<{
    Body: UnsubscribeBody;
  }>(
    '/notifications/unsubscribe',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Unsubscribe from notifications',
        description: 'Unsubscribe from email notifications (globally, by category, or by type)',
        body: {
          type: 'object',
          required: ['token', 'type'],
          properties: {
            token: { type: 'string' },
            type: { type: 'string', enum: ['ALL', 'CATEGORY', 'TYPE'] },
            category: {
              type: 'string',
              enum: [
                'MESSAGES',
                'PROJECTS',
                'CONTRACTS',
                'PAYMENTS',
                'ACCOUNT',
                'MARKETING',
                'SYSTEM',
              ],
            },
            notificationType: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token, type, category, notificationType } = request.body as UnsubscribeBody;

      try {
        // Decode and verify the token
        const decoded = await (
          fastify as FastifyInstance & {
            jwt: { verify: (token: string) => Promise<{ email: string; userId?: string }> };
          }
        ).jwt.verify(token);

        await notificationService.unsubscribe({
          email: decoded.email,
          userId: decoded.userId,
          type,
          category,
          notificationType,
          source: 'EMAIL_LINK',
        });

        return await reply.send({ success: true });
      } catch (error) {
        logger.error({ msg: 'Invalid unsubscribe token', error });
        return reply.status(400).send({ error: 'Invalid or expired token' });
      }
    }
  );

  // ============================================================================
  // Register Push Token
  // ============================================================================
  fastify.post<{
    Body: RegisterPushTokenBody;
  }>(
    '/notifications/push-token',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Register push notification token',
        description: 'Register a device push notification token for the user',
        body: {
          type: 'object',
          required: ['token', 'platform'],
          properties: {
            token: { type: 'string' },
            platform: { type: 'string', enum: ['ios', 'android', 'web'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { token, platform } = request.body as RegisterPushTokenBody;
      await pushService.registerToken(userId, token, platform);

      return reply.send({ success: true });
    }
  );

  // ============================================================================
  // Remove Push Token
  // ============================================================================
  fastify.delete<{
    Body: { token: string };
  }>(
    '/notifications/push-token',
    {
      schema: {
        tags: ['Notifications'],
        summary: 'Remove push notification token',
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { token } = request.body as { token: string };
      await pushService.removeToken(userId, token);

      return reply.send({ success: true });
    }
  );

  logger.info({ msg: 'Notification routes registered' });
}

