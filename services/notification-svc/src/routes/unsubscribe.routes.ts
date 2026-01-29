/**
 * Email Unsubscribe Routes
 * CAN-SPAM and GDPR compliant email preference management
 */

import crypto from 'crypto';

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { getConfig } from '../config/index.js';

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
  category: z.enum([
    'MARKETING',
    'TRANSACTIONAL',
    'DIGEST',
    'PROPOSALS',
    'MESSAGES',
    'CONTRACTS',
    'PAYMENTS',
    'SECURITY',
    'ALL',
  ]),
});

const UpdatePreferencesWithTokenSchema = z.object({
  token: z.string().min(32).max(128),
  preferences: z.object({
    marketing: z.boolean().optional(),
    transactional: z.boolean().optional(),
    digest: z.boolean().optional(),
    proposals: z.boolean().optional(),
    messages: z.boolean().optional(),
    contracts: z.boolean().optional(),
    payments: z.boolean().optional(),
    security: z.boolean().optional(),
  }),
});

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a secure unsubscribe token
 */
function generateUnsubscribeToken(userId: string, email: string): string {
  const config = getConfig();
  const secret = config.jwtSecret || process.env.JWT_SECRET || 'default-secret';
  const data = `${userId}:${email}:${Date.now()}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify and decode unsubscribe token
 */
async function verifyUnsubscribeToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  try {
    // Look up the token in the database
    const unsubscribeRecord = await prisma.emailUnsubscribe.findFirst({
      where: {
        token,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (unsubscribeRecord?.user) {
      return {
        userId: unsubscribeRecord.user.id,
        email: unsubscribeRecord.user.email,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create or update unsubscribe token for a user
 */
async function createUnsubscribeToken(userId: string, email: string): Promise<string> {
  const token = generateUnsubscribeToken(userId, email);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.emailUnsubscribe.upsert({
    where: {
      userId_category: {
        userId,
        category: 'TOKEN',
      },
    },
    create: {
      userId,
      category: 'TOKEN',
      token,
      expiresAt,
    },
    update: {
      token,
      expiresAt,
    },
  });

  return token;
}

// =============================================================================
// ROUTES
// =============================================================================

export async function unsubscribeRoutes(fastify: FastifyInstance) {
  /**
   * GET /unsubscribe - Render unsubscribe page (public, no auth required)
   * This is the link users click from emails
   */
  fastify.get('/unsubscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.query as { token?: string };

      if (!token) {
        return reply.status(400).send({
          error: 'Missing unsubscribe token',
          message: 'Please use the unsubscribe link from your email.',
        });
      }

      const user = await verifyUnsubscribeToken(token);
      if (!user) {
        return reply.status(400).send({
          error: 'Invalid or expired token',
          message: 'This unsubscribe link has expired. Please use a link from a more recent email.',
        });
      }

      // Get current preferences
      const preferences = await prisma.notificationPreference.findUnique({
        where: { userId: user.userId },
      });

      return reply.send({
        success: true,
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
        preferences: {
          marketing: preferences?.marketingEmails ?? true,
          transactional: preferences?.transactionalEmails ?? true,
          digest: preferences?.digestEmails ?? true,
          proposals: preferences?.proposalEmails ?? true,
          messages: preferences?.messageEmails ?? true,
          contracts: preferences?.contractEmails ?? true,
          payments: preferences?.paymentEmails ?? true,
          security: preferences?.securityEmails ?? true,
        },
        unsubscribeUrl: `/api/notifications/unsubscribe/confirm?token=${token}`,
        preferencesUrl: `/api/notifications/unsubscribe/preferences?token=${token}`,
      });
    } catch (error: any) {
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
        return reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { token } = validation.data;
      const user = await verifyUnsubscribeToken(token);

      if (!user) {
        return reply.status(400).send({
          error: 'Invalid or expired token',
          message: 'This unsubscribe link has expired.',
        });
      }

      // Unsubscribe from all non-essential emails
      await prisma.notificationPreference.upsert({
        where: { userId: user.userId },
        create: {
          userId: user.userId,
          marketingEmails: false,
          digestEmails: false,
          proposalEmails: false,
          // Keep essential notifications enabled
          transactionalEmails: true,
          securityEmails: true,
          paymentEmails: true,
          contractEmails: true,
          messageEmails: true,
        },
        update: {
          marketingEmails: false,
          digestEmails: false,
          proposalEmails: false,
        },
      });

      // Log the unsubscribe action
      await prisma.emailUnsubscribe.create({
        data: {
          userId: user.userId,
          category: 'MARKETING',
          reason: 'ONE_CLICK_UNSUBSCRIBE',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || undefined,
        },
      });

      fastify.log.info({ userId: user.userId }, 'User unsubscribed via one-click');

      return reply.send({
        success: true,
        message: 'You have been successfully unsubscribed from marketing emails.',
        note: 'You will still receive important account and security notifications.',
      });
    } catch (error: any) {
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
        return reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { token, category } = validation.data;
      const user = await verifyUnsubscribeToken(token);

      if (!user) {
        return reply.status(400).send({
          error: 'Invalid or expired token',
        });
      }

      // Build update based on category
      const updateData: Record<string, boolean> = {};

      if (category === 'ALL') {
        // Unsubscribe from everything except security
        updateData.marketingEmails = false;
        updateData.transactionalEmails = false;
        updateData.digestEmails = false;
        updateData.proposalEmails = false;
        updateData.messageEmails = false;
        updateData.contractEmails = false;
        updateData.paymentEmails = false;
        // Security emails cannot be disabled
      } else {
        const categoryMap: Record<string, string> = {
          MARKETING: 'marketingEmails',
          TRANSACTIONAL: 'transactionalEmails',
          DIGEST: 'digestEmails',
          PROPOSALS: 'proposalEmails',
          MESSAGES: 'messageEmails',
          CONTRACTS: 'contractEmails',
          PAYMENTS: 'paymentEmails',
          SECURITY: 'securityEmails', // Will be ignored in update
        };

        const field = categoryMap[category];
        if (field && field !== 'securityEmails') {
          updateData[field] = false;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.notificationPreference.upsert({
          where: { userId: user.userId },
          create: {
            userId: user.userId,
            ...updateData,
            securityEmails: true, // Always keep security enabled
          },
          update: updateData,
        });
      }

      // Log the unsubscribe
      await prisma.emailUnsubscribe.create({
        data: {
          userId: user.userId,
          category,
          reason: 'CATEGORY_UNSUBSCRIBE',
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] || undefined,
        },
      });

      fastify.log.info({ userId: user.userId, category }, 'User unsubscribed from category');

      return reply.send({
        success: true,
        message: `Successfully unsubscribed from ${category.toLowerCase()} emails.`,
        category,
      });
    } catch (error: any) {
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
        return reply.status(400).send({
          error: 'Validation error',
          details: validation.error.errors,
        });
      }

      const { token, preferences } = validation.data;
      const user = await verifyUnsubscribeToken(token);

      if (!user) {
        return reply.status(400).send({
          error: 'Invalid or expired token',
        });
      }

      // Map preferences to database fields
      const updateData: Record<string, boolean> = {};
      if (preferences.marketing !== undefined) updateData.marketingEmails = preferences.marketing;
      if (preferences.transactional !== undefined)
        updateData.transactionalEmails = preferences.transactional;
      if (preferences.digest !== undefined) updateData.digestEmails = preferences.digest;
      if (preferences.proposals !== undefined) updateData.proposalEmails = preferences.proposals;
      if (preferences.messages !== undefined) updateData.messageEmails = preferences.messages;
      if (preferences.contracts !== undefined) updateData.contractEmails = preferences.contracts;
      if (preferences.payments !== undefined) updateData.paymentEmails = preferences.payments;
      // Security emails cannot be disabled via this endpoint
      updateData.securityEmails = true;

      await prisma.notificationPreference.upsert({
        where: { userId: user.userId },
        create: {
          userId: user.userId,
          marketingEmails: preferences.marketing ?? true,
          transactionalEmails: preferences.transactional ?? true,
          digestEmails: preferences.digest ?? true,
          proposalEmails: preferences.proposals ?? true,
          messageEmails: preferences.messages ?? true,
          contractEmails: preferences.contracts ?? true,
          paymentEmails: preferences.payments ?? true,
          securityEmails: true,
        },
        update: updateData,
      });

      fastify.log.info({ userId: user.userId }, 'User updated email preferences');

      return reply.send({
        success: true,
        message: 'Email preferences updated successfully.',
        preferences: {
          marketing: preferences.marketing ?? true,
          transactional: preferences.transactional ?? true,
          digest: preferences.digest ?? true,
          proposals: preferences.proposals ?? true,
          messages: preferences.messages ?? true,
          contracts: preferences.contracts ?? true,
          payments: preferences.payments ?? true,
          security: true, // Always enabled
        },
      });
    } catch (error: any) {
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
          return reply.status(403).send({ error: 'Forbidden' });
        }

        const { userId, email } = request.body as { userId: string; email: string };
        if (!userId || !email) {
          return reply.status(400).send({ error: 'userId and email are required' });
        }

        const token = await createUnsubscribeToken(userId, email);
        const baseUrl = config.appBaseUrl || process.env.APP_BASE_URL || 'https://skillancer.com';

        return reply.send({
          success: true,
          token,
          unsubscribeUrl: `${baseUrl}/unsubscribe?token=${token}`,
          oneClickUrl: `${baseUrl}/api/notifications/unsubscribe/confirm`,
        });
      } catch (error: any) {
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
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const { userId, email } = request.query as { userId: string; email: string };
      if (!userId || !email) {
        return reply.status(400).send({ error: 'userId and email are required' });
      }

      const token = await createUnsubscribeToken(userId, email);
      const baseUrl = config.appBaseUrl || process.env.APP_BASE_URL || 'https://skillancer.com';

      // RFC 2369 List-Unsubscribe header
      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${token}`;
      const unsubscribeMailto = `mailto:unsubscribe@skillancer.com?subject=Unsubscribe&body=Token:${token}`;

      // RFC 8058 List-Unsubscribe-Post header for one-click unsubscribe
      const listUnsubscribePost = 'List-Unsubscribe=One-Click';

      return reply.send({
        success: true,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>, <${unsubscribeMailto}>`,
          'List-Unsubscribe-Post': listUnsubscribePost,
        },
        token,
      });
    } catch (error: any) {
      fastify.log.error(error, 'List header error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
