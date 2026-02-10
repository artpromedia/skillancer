/**
 * Notification Preferences Routes
 *
 * Comprehensive user notification preferences management.
 * Handles email, push, and in-app notification settings.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const prisma = new PrismaClient();

// ============================================================================
// Schemas
// ============================================================================

const NotificationChannelSchema = z.object({
  id: z.enum(['email', 'push', 'in_app']),
  enabled: z.boolean(),
});

const NotificationCategorySchema = z.object({
  id: z.string(),
  channels: z.object({
    email: z.boolean(),
    push: z.boolean(),
    in_app: z.boolean(),
  }),
  frequency: z.enum(['instant', 'daily', 'weekly', 'never']),
});

const QuietHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  allowUrgent: z.boolean(),
  days: z.array(z.string()),
});

const UpdatePreferencesSchema = z.object({
  channels: z.array(NotificationChannelSchema).optional(),
  categories: z.array(NotificationCategorySchema).optional(),
  quietHours: QuietHoursSchema.optional(),
  digestEnabled: z.boolean().optional(),
  digestTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  globalUnsubscribe: z.boolean().optional(),
});

// ============================================================================
// Category Configuration
// ============================================================================

const NOTIFICATION_CATEGORIES = [
  { id: 'security', type: 'SECURITY', canDisable: false },
  { id: 'payments', type: 'PAYMENTS', canDisable: false },
  { id: 'contracts', type: 'CONTRACTS', canDisable: true },
  { id: 'proposals', type: 'PROPOSALS', canDisable: true },
  { id: 'messages', type: 'MESSAGES', canDisable: true },
  { id: 'jobs', type: 'JOBS', canDisable: true },
  { id: 'marketing', type: 'MARKETING', canDisable: true },
  { id: 'newsletter', type: 'NEWSLETTER', canDisable: true },
  { id: 'system', type: 'SYSTEM', canDisable: true },
];

// ============================================================================
// Routes
// ============================================================================

export async function preferencesRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /preferences - Get user notification preferences
   */
  fastify.get('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as { user?: { id: string } }).user?.id;
      if (!userId) {
        return await reply.status(401).send({ error: 'Unauthorized' });
      }

      const preferences = await getUserPreferences(userId);
      return await reply.send(preferences);
    } catch (error: unknown) {
      fastify.log.error(error, 'Error getting preferences');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /preferences - Update user notification preferences
   */
  fastify.put('/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as { user?: { id: string } }).user?.id;
      if (!userId) {
        return await reply.status(401).send({ error: 'Unauthorized' });
      }

      const validation = UpdatePreferencesSchema.safeParse(request.body);
      if (!validation.success) {
        return await reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const updated = await updateUserPreferences(userId, validation.data);
      return await reply.send(updated);
    } catch (error: unknown) {
      fastify.log.error(error, 'Error updating preferences');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /preferences/digest/enable - Enable digest emails
   */
  fastify.post(
    '/preferences/digest/enable',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as { user?: { id: string } }).user?.id;
        if (!userId) {
          return await reply.status(401).send({ error: 'Unauthorized' });
        }

        await prisma.notificationPreference.upsert({
          where: {
            userId_notificationType: {
              userId,
              notificationType: 'DAILY_DIGEST',
            },
          },
          create: {
            userId,
            notificationType: 'DAILY_DIGEST',
            emailEnabled: true,
            inAppEnabled: false,
            pushEnabled: false,
            smsEnabled: false,
          },
          update: {
            emailEnabled: true,
          },
        });

        return await reply.send({ success: true, digestEnabled: true });
      } catch (error: unknown) {
        fastify.log.error(error, 'Error enabling digest');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /preferences/digest/disable - Disable digest emails
   */
  fastify.post(
    '/preferences/digest/disable',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as { user?: { id: string } }).user?.id;
        if (!userId) {
          return await reply.status(401).send({ error: 'Unauthorized' });
        }

        await prisma.notificationPreference.updateMany({
          where: {
            userId,
            notificationType: { in: ['DAILY_DIGEST', 'WEEKLY_DIGEST'] },
          },
          data: {
            emailEnabled: false,
          },
        });

        return await reply.send({ success: true, digestEnabled: false });
      } catch (error: unknown) {
        fastify.log.error(error, 'Error disabling digest');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /preferences/category/:categoryId/disable - Disable a category
   */
  fastify.post(
    '/preferences/category/:categoryId/disable',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as { user?: { id: string } }).user?.id;
        if (!userId) {
          return await reply.status(401).send({ error: 'Unauthorized' });
        }

        const { categoryId } = request.params as { categoryId: string };
        const category = NOTIFICATION_CATEGORIES.find((c) => c.id === categoryId);

        if (!category) {
          return await reply.status(404).send({ error: 'Category not found' });
        }

        if (!category.canDisable) {
          return await reply.status(400).send({
            error: 'Cannot disable this category',
            message: 'This notification category is required and cannot be disabled.',
          });
        }

        await prisma.notificationPreference.upsert({
          where: {
            userId_notificationType: {
              userId,
              notificationType: category.type,
            },
          },
          create: {
            userId,
            notificationType: category.type,
            emailEnabled: false,
            inAppEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
          },
          update: {
            emailEnabled: false,
          },
        });

        return await reply.send({ success: true, categoryId, disabled: true });
      } catch (error: unknown) {
        fastify.log.error(error, 'Error disabling category');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /preferences/global-unsubscribe - Unsubscribe from all optional emails
   */
  fastify.post(
    '/preferences/global-unsubscribe',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as { user?: { id: string } }).user?.id;
        if (!userId) {
          return await reply.status(401).send({ error: 'Unauthorized' });
        }

        // Disable all disableable categories
        const disableableCategories = NOTIFICATION_CATEGORIES.filter((c) => c.canDisable);

        for (const category of disableableCategories) {
          await prisma.notificationPreference.upsert({
            where: {
              userId_notificationType: {
                userId,
                notificationType: category.type,
              },
            },
            create: {
              userId,
              notificationType: category.type,
              emailEnabled: false,
              inAppEnabled: true,
              pushEnabled: false,
              smsEnabled: false,
            },
            update: {
              emailEnabled: false,
            },
          });
        }

        fastify.log.info({ userId }, 'User globally unsubscribed from optional emails');

        return await reply.send({
          success: true,
          message: 'Successfully unsubscribed from all optional emails',
          note: 'You will still receive essential security and transactional emails.',
        });
      } catch (error: unknown) {
        fastify.log.error(error, 'Error global unsubscribe');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /preferences/resubscribe - Re-enable all email notifications
   */
  fastify.post('/preferences/resubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as { user?: { id: string } }).user?.id;
      if (!userId) {
        return await reply.status(401).send({ error: 'Unauthorized' });
      }

      // Enable all categories
      for (const category of NOTIFICATION_CATEGORIES) {
        await prisma.notificationPreference.upsert({
          where: {
            userId_notificationType: {
              userId,
              notificationType: category.type,
            },
          },
          create: {
            userId,
            notificationType: category.type,
            emailEnabled: true,
            inAppEnabled: true,
            pushEnabled: true,
            smsEnabled: false,
          },
          update: {
            emailEnabled: true,
          },
        });
      }

      fastify.log.info({ userId }, 'User resubscribed to all emails');

      return await reply.send({
        success: true,
        message: 'Successfully re-enabled all email notifications',
      });
    } catch (error: unknown) {
      fastify.log.error(error, 'Error resubscribe');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getUserPreferences(userId: string): Promise<Record<string, unknown>> {
  const dbPreferences = await prisma.notificationPreference.findMany({
    where: { userId },
  });

  // Build preferences object
  const channels = [
    { id: 'email', enabled: true, label: 'Email', description: 'Receive notifications via email' },
    {
      id: 'push',
      enabled: true,
      label: 'Push',
      description: 'Browser and mobile push notifications',
    },
    {
      id: 'in_app',
      enabled: true,
      label: 'In-App',
      description: 'Notifications within Skillancer',
    },
  ];

  const categories = NOTIFICATION_CATEGORIES.map((cat) => {
    const pref = dbPreferences.find((p) => p.notificationType === cat.type);
    return {
      id: cat.id,
      type: cat.type,
      canDisable: cat.canDisable,
      channels: {
        email: pref?.emailEnabled ?? true,
        push: pref?.pushEnabled ?? true,
        in_app: pref?.inAppEnabled ?? true,
      },
      frequency: 'instant', // Default
    };
  });

  // Check digest preferences
  const dailyDigest = dbPreferences.find((p) => p.notificationType === 'DAILY_DIGEST');
  const digestEnabled = dailyDigest?.emailEnabled ?? false;

  // Check if globally unsubscribed
  const disableableCategories = categories.filter((c) => c.canDisable);
  const allDisabled = disableableCategories.every((c) => !c.channels.email);

  return {
    channels,
    categories,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
      timezone: 'America/New_York',
      allowUrgent: true,
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    digestEnabled,
    digestTime: '09:00',
    globalUnsubscribe: allDisabled,
  };
}

async function updateUserPreferences(
  userId: string,
  data: z.infer<typeof UpdatePreferencesSchema>
): Promise<Record<string, unknown>> {
  // Update category preferences
  if (data.categories) {
    for (const category of data.categories) {
      const catConfig = NOTIFICATION_CATEGORIES.find((c) => c.id === category.id);
      if (!catConfig) continue;

      // Don't allow disabling non-disableable categories
      const emailEnabled = !catConfig.canDisable ? true : category.channels.email;

      await prisma.notificationPreference.upsert({
        where: {
          userId_notificationType: {
            userId,
            notificationType: catConfig.type,
          },
        },
        create: {
          userId,
          notificationType: catConfig.type,
          emailEnabled,
          inAppEnabled: category.channels.in_app,
          pushEnabled: category.channels.push,
          smsEnabled: false,
        },
        update: {
          emailEnabled,
          inAppEnabled: category.channels.in_app,
          pushEnabled: category.channels.push,
        },
      });
    }
  }

  // Update digest preference
  if (data.digestEnabled !== undefined) {
    await prisma.notificationPreference.upsert({
      where: {
        userId_notificationType: {
          userId,
          notificationType: 'DAILY_DIGEST',
        },
      },
      create: {
        userId,
        notificationType: 'DAILY_DIGEST',
        emailEnabled: data.digestEnabled,
        inAppEnabled: false,
        pushEnabled: false,
        smsEnabled: false,
      },
      update: {
        emailEnabled: data.digestEnabled,
      },
    });
  }

  // Handle global unsubscribe
  if (data.globalUnsubscribe === true) {
    const disableableCategories = NOTIFICATION_CATEGORIES.filter((c) => c.canDisable);
    for (const category of disableableCategories) {
      await prisma.notificationPreference.upsert({
        where: {
          userId_notificationType: {
            userId,
            notificationType: category.type,
          },
        },
        create: {
          userId,
          notificationType: category.type,
          emailEnabled: false,
          inAppEnabled: true,
          pushEnabled: false,
          smsEnabled: false,
        },
        update: {
          emailEnabled: false,
        },
      });
    }
  } else if (data.globalUnsubscribe === false) {
    // Re-enable all
    for (const category of NOTIFICATION_CATEGORIES) {
      await prisma.notificationPreference.upsert({
        where: {
          userId_notificationType: {
            userId,
            notificationType: category.type,
          },
        },
        create: {
          userId,
          notificationType: category.type,
          emailEnabled: true,
          inAppEnabled: true,
          pushEnabled: true,
          smsEnabled: false,
        },
        update: {
          emailEnabled: true,
        },
      });
    }
  }

  // Return updated preferences
  return getUserPreferences(userId);
}
