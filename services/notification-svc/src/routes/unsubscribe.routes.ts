/**
 * Email Unsubscribe Routes
 * CAN-SPAM and GDPR compliant email preference management
 *
 * Works with actual Prisma schema:
 * - EmailUnsubscribe: userId, email, unsubscribeType, category, notificationType, source
 * - NotificationPreference: userId, notificationType, emailEnabled, pushEnabled, etc.
 */

import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const _prisma = _require('@prisma/client');
const { PrismaClient, UnsubscribeType } = _prisma;
import { z } from 'zod';

import { getConfig } from '../config/index.js';

import type { NotificationCategory } from '@prisma/client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const prisma = new PrismaClient();

// =============================================================================
// SCHEMAS
// =============================================================================

const UnsubscribeTokenSchema = z.object({
  token: z.string().min(32).max(128),
});

const UnsubscribeCategorySchema = z.object({
  token: z.string().min(32).max(128),
  category: z.enum(['MESSAGES', 'PROJECTS', 'CONTRACTS', 'PAYMENTS', 'SECURITY', 'SYSTEM', 'ALL']),
});

const UpdatePreferencesWithTokenSchema = z.object({
  token: z.string().min(32).max(128),
  preferences: z.object({
    messages: z.boolean().optional(),
    projects: z.boolean().optional(),
    contracts: z.boolean().optional(),
    payments: z.boolean().optional(),
    system: z.boolean().optional(),
  }),
});

// =============================================================================
// TOKEN STORAGE (In-Memory with TTL - for production use Redis)
// =============================================================================

interface TokenData {
  userId: string;
  email: string;
  expiresAt: Date;
}

const tokenStore = new Map<string, TokenData>();

// Clean expired tokens periodically
setInterval(
  () => {
    const now = new Date();
    for (const [token, data] of tokenStore.entries()) {
      if (data.expiresAt < now) {
        tokenStore.delete(token);
      }
    }
  },
  60 * 60 * 1000
); // Clean every hour

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a secure unsubscribe token
 */
function generateUnsubscribeToken(userId: string, email: string): string {
  const config = getConfig();
  const secret = String(config.jwtSecret ?? process.env.JWT_SECRET ?? 'default-secret');
  const data = `${userId}:${email}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Store and get unsubscribe token
 */
function storeUnsubscribeToken(token: string, userId: string, email: string): void {
  tokenStore.set(token, {
    userId,
    email,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });
}

/**
 * Verify and decode unsubscribe token
 */
function verifyUnsubscribeToken(token: string): { userId: string; email: string } | null {
  const data = tokenStore.get(token);
  if (!data) return null;
  if (data.expiresAt < new Date()) {
    tokenStore.delete(token);
    return null;
  }
  return { userId: data.userId, email: data.email };
}

/**
 * Create or refresh unsubscribe token for a user
 */
function createUnsubscribeToken(userId: string, email: string): string {
  const token = generateUnsubscribeToken(userId, email);
  storeUnsubscribeToken(token, userId, email);
  return token;
}

/**
 * Get email preferences for a user
 */
async function getEmailPreferences(userId: string): Promise<Record<string, boolean>> {
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId },
  });

  const defaultPrefs: Record<string, boolean> = {
    messages: true,
    projects: true,
    contracts: true,
    payments: true,
    security: true,
    system: true,
  };

  prefs.forEach((pref) => {
    const key = pref.notificationType.toLowerCase();
    if (key in defaultPrefs) {
      defaultPrefs[key] = pref.emailEnabled;
    }
  });

  return defaultPrefs;
}

/**
 * Update email preference for a notification type
 */
async function updateEmailPreference(
  userId: string,
  notificationType: string,
  emailEnabled: boolean
): Promise<void> {
  await prisma.notificationPreference.upsert({
    where: {
      userId_notificationType: {
        userId,
        notificationType: notificationType.toUpperCase(),
      },
    },
    create: {
      userId,
      notificationType: notificationType.toUpperCase(),
      emailEnabled,
      inAppEnabled: true,
      pushEnabled: true,
      smsEnabled: false,
    },
    update: {
      emailEnabled,
    },
  });
}

/**
 * Log unsubscribe action
 */
async function logUnsubscribe(
  userId: string,
  email: string,
  unsubscribeType: UnsubscribeType,
  category?: NotificationCategory,
  notificationType?: string,
  source: string = 'EMAIL_LINK'
): Promise<void> {
  await prisma.emailUnsubscribe.create({
    data: {
      userId,
      email,
      unsubscribeType,
      category,
      notificationType,
      source,
    },
  });
}

// =============================================================================
// ROUTES
// =============================================================================

export async function unsubscribeRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /unsubscribe - Render unsubscribe page (public, no auth required)
   * This is the link users click from emails
   */
  fastify.get('/unsubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.query as { token?: string };

      if (!token) {
        return await reply.status(400).send({
          error: 'Missing unsubscribe token',
          message: 'Please use the unsubscribe link from your email.',
        });
      }

      const user = verifyUnsubscribeToken(token);
      if (!user) {
        return await reply.status(400).send({
          error: 'Invalid or expired token',
          message: 'This unsubscribe link has expired. Please use a link from a more recent email.',
        });
      }

      // Get current preferences
      const preferences = await getEmailPreferences(user.userId);

      return await reply.send({
        success: true,
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
        preferences,
        unsubscribeUrl: `/api/notifications/unsubscribe/confirm?token=${token}`,
        preferencesUrl: `/api/notifications/unsubscribe/preferences?token=${token}`,
      });
    } catch (error: unknown) {
      fastify.log.error(error, 'Unsubscribe page error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /unsubscribe/confirm - Process one-click unsubscribe
   * RFC 8058 compliant one-click unsubscribe
   */
  fastify.post('/unsubscribe/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validation = UnsubscribeTokenSchema.safeParse(request.body);
      if (!validation.success) {
        return await reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { token } = validation.data;
      const user = verifyUnsubscribeToken(token);

      if (!user) {
        return await reply.status(400).send({
          error: 'Invalid or expired token',
          message: 'This unsubscribe link has expired.',
        });
      }

      // Disable emails for non-essential categories
      const categoriesToDisable = ['messages', 'projects', 'system'];
      for (const cat of categoriesToDisable) {
        await updateEmailPreference(user.userId, cat, false);
      }

      // Log the unsubscribe action
      await logUnsubscribe(
        user.userId,
        user.email,
        UnsubscribeType.CATEGORY,
        undefined,
        undefined,
        'EMAIL_LINK'
      );

      fastify.log.info({ userId: user.userId }, 'User unsubscribed via one-click');

      return await reply.send({
        success: true,
        message: 'You have been successfully unsubscribed from marketing emails.',
        note: 'You will still receive important account and security notifications.',
      });
    } catch (error: unknown) {
      fastify.log.error(error, 'Unsubscribe confirm error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /unsubscribe/category - Unsubscribe from specific category
   */
  fastify.post('/unsubscribe/category', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validation = UnsubscribeCategorySchema.safeParse(request.body);
      if (!validation.success) {
        return await reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { token, category } = validation.data;
      const user = verifyUnsubscribeToken(token);

      if (!user) {
        return await reply.status(400).send({
          error: 'Invalid or expired token',
        });
      }

      if (category === 'ALL') {
        // Unsubscribe from everything except security
        const allCategories = ['messages', 'projects', 'contracts', 'payments', 'system'];
        for (const cat of allCategories) {
          await updateEmailPreference(user.userId, cat, false);
        }
        await logUnsubscribe(
          user.userId,
          user.email,
          UnsubscribeType.ALL,
          undefined,
          undefined,
          'EMAIL_LINK'
        );
      } else if (category !== 'SECURITY') {
        // Security cannot be disabled
        await updateEmailPreference(user.userId, category.toLowerCase(), false);
        await logUnsubscribe(
          user.userId,
          user.email,
          UnsubscribeType.CATEGORY,
          category as NotificationCategory,
          undefined,
          'EMAIL_LINK'
        );
      }

      fastify.log.info({ userId: user.userId, category }, 'User unsubscribed from category');

      return await reply.send({
        success: true,
        message: `Successfully unsubscribed from ${category.toLowerCase()} emails.`,
        category,
      });
    } catch (error: unknown) {
      fastify.log.error(error, 'Unsubscribe category error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * PUT /unsubscribe/preferences - Update email preferences
   */
  fastify.put('/unsubscribe/preferences', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validation = UpdatePreferencesWithTokenSchema.safeParse(request.body);
      if (!validation.success) {
        return await reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { token, preferences } = validation.data;
      const user = verifyUnsubscribeToken(token);

      if (!user) {
        return await reply.status(400).send({
          error: 'Invalid or expired token',
        });
      }

      // Update each preference
      for (const [key, value] of Object.entries(preferences)) {
        if (value !== undefined && key !== 'security') {
          await updateEmailPreference(user.userId, key, value);
        }
      }

      // Security is always enabled
      await updateEmailPreference(user.userId, 'security', true);

      fastify.log.info({ userId: user.userId }, 'User updated email preferences');

      return await reply.send({
        success: true,
        message: 'Email preferences updated successfully.',
        preferences: {
          messages: preferences.messages ?? true,
          projects: preferences.projects ?? true,
          contracts: preferences.contracts ?? true,
          payments: preferences.payments ?? true,
          security: true, // Always enabled
          system: preferences.system ?? true,
        },
      });
    } catch (error: unknown) {
      fastify.log.error(error, 'Update preferences error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /unsubscribe/generate-token - Generate unsubscribe token for a user
   * Internal endpoint for email service
   */
  fastify.post(
    '/unsubscribe/generate-token',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Verify internal API key
        const apiKey = request.headers['x-internal-api-key'];
        const config = getConfig();
        if (apiKey !== config.internalApiKey) {
          return await reply.status(403).send({ error: 'Forbidden' });
        }

        const { userId, email } = request.body as { userId: string; email: string };
        if (!userId || !email) {
          return await reply.status(400).send({ error: 'userId and email are required' });
        }

        const token = createUnsubscribeToken(userId, email);
        const baseUrl = String(
          config.appBaseUrl ?? process.env.APP_BASE_URL ?? 'https://skillancer.com'
        );

        return await reply.send({
          success: true,
          token,
          unsubscribeUrl: `${baseUrl}/unsubscribe?token=${token}`,
          oneClickUrl: `${baseUrl}/api/notifications/unsubscribe/confirm`,
        });
      } catch (error: unknown) {
        fastify.log.error(error, 'Generate token error');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /unsubscribe/list-header - Get List-Unsubscribe header value
   * Internal endpoint for email service to add RFC-compliant headers
   */
  fastify.get('/unsubscribe/list-header', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const apiKey = request.headers['x-internal-api-key'];
      const config = getConfig();
      if (apiKey !== config.internalApiKey) {
        return await reply.status(403).send({ error: 'Forbidden' });
      }

      const { userId, email } = request.query as { userId: string; email: string };
      if (!userId || !email) {
        return await reply.status(400).send({ error: 'userId and email are required' });
      }

      const token = createUnsubscribeToken(userId, email);
      const baseUrl = String(
        config.appBaseUrl ?? process.env.APP_BASE_URL ?? 'https://skillancer.com'
      );

      // RFC 2369 List-Unsubscribe header
      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${token}`;
      const unsubscribeMailto = `mailto:unsubscribe@skillancer.com?subject=Unsubscribe&body=Token:${token}`;

      // RFC 8058 List-Unsubscribe-Post header for one-click unsubscribe
      const listUnsubscribePost = 'List-Unsubscribe=One-Click';

      return await reply.send({
        success: true,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>, <${unsubscribeMailto}>`,
          'List-Unsubscribe-Post': listUnsubscribePost,
        },
        token,
      });
    } catch (error: unknown) {
      fastify.log.error(error, 'List header error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
