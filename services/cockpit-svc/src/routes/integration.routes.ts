/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @module @skillancer/cockpit-svc/routes/integrations
 * Integration API Routes - REST endpoints for integration platform
 */

import { z } from 'zod';

import { IntegrationPlatformService } from '../services/integrations/integration-platform.service.js';

import type { EncryptionService } from '../services/encryption.service.js';
import type { SyncOptions } from '../types/integration.types.js';
import type { IntegrationProvider } from '../types/prisma-shim.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';

// =====================
// Request Schemas
// =====================

const IntegrationProviderSchema = z.string();

const SyncFrequencySchema = z.enum([
  'REALTIME',
  'EVERY_5_MIN',
  'EVERY_15_MIN',
  'HOURLY',
  'EVERY_6_HOURS',
  'DAILY',
  'WEEKLY',
  'MANUAL',
]);

const initiateOAuthSchema = z.object({
  provider: IntegrationProviderSchema,
  redirectUri: z.string().url(),
});

const completeOAuthSchema = z.object({
  state: z.string().min(1),
  code: z.string().min(1),
});

const connectApiKeySchema = z.object({
  provider: IntegrationProviderSchema,
  name: z.string().min(1).max(100),
  apiKey: z.string().min(1),
  apiSecret: z.string().optional(),
  description: z.string().max(500).optional(),
});

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  syncEnabled: z.boolean().optional(),
  syncFrequency: SyncFrequencySchema.optional(),
  syncOptions: z.record(z.unknown()).optional(),
});

const triggerSyncSchema = z.object({
  fullSync: z.boolean().optional(),
  entityTypes: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

const pauseIntegrationSchema = z.object({
  reason: z.string().max(500).optional(),
});

const webhookSchema = z.object({
  eventType: z.string().min(1),
  payload: z.record(z.unknown()),
});

// =====================
// Route Dependencies
// =====================

export interface IntegrationRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
  encryption: EncryptionService;
}

// =====================
// Route Registration
// =====================

export async function registerIntegrationRoutes(
  app: FastifyInstance,
  deps: IntegrationRouteDeps
): Promise<void> {
  const { prisma, logger, encryption } = deps;
  const service = new IntegrationPlatformService(prisma, logger, encryption);

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    logger.error({ error }, 'Integration route error');
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
      }
      if (error.message.includes('Unauthorized')) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: error.message },
        });
      }
    }
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  };

  // =====================
  // List & Discovery Routes
  // =====================

  /**
   * GET /integrations/available
   * List all available integrations with user's connection status
   */
  app.get('/integrations/available', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { category, search } = request.query as {
        category?: string;
        search?: string;
      };

      let integrations;
      if (category) {
        integrations = await service.getIntegrationsByCategory(userId, category);
      } else if (search) {
        integrations = await service.searchIntegrations(userId, search);
      } else {
        integrations = await service.getAvailableIntegrations(userId);
      }

      return await reply.send({
        success: true,
        data: integrations,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * GET /integrations
   * List user's connected integrations
   */
  app.get('/integrations', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const integrations = await service.getUserIntegrations(userId);

      return await reply.send({
        success: true,
        data: integrations,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * GET /integrations/:id
   * Get integration details
   */
  app.get('/integrations/:id', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { id } = request.params as { id: string };
      const details = await service.getIntegrationDetails(id, userId);

      return await reply.send({
        success: true,
        data: details,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // =====================
  // OAuth Connection Routes
  // =====================

  /**
   * POST /integrations/oauth/initiate
   * Start OAuth connection flow
   */
  app.post('/integrations/oauth/initiate', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const body = initiateOAuthSchema.parse(request.body);
      const result = await service.initiateOAuthConnection(
        userId,
        body.provider as IntegrationProvider,
        body.redirectUri
      );

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * POST /integrations/oauth/callback
   * Complete OAuth connection flow
   */
  app.post('/integrations/oauth/callback', async (request, reply) => {
    try {
      const body = completeOAuthSchema.parse(request.body);
      const result = await service.completeOAuthConnection(body.state, body.code);

      return await reply.send({
        success: true,
        data: {
          integration: result.integration,
          accountInfo: result.accountInfo,
        },
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * GET /integrations/oauth/callback
   * OAuth callback handler (for redirect-based flows)
   */
  app.get('/integrations/oauth/callback', async (request, reply) => {
    try {
      const { state, code, error, error_description } = request.query as {
        state?: string;
        code?: string;
        error?: string;
        error_description?: string;
      };

      if (error) {
        return await reply.status(400).send({
          success: false,
          error: {
            code: 'OAUTH_ERROR',
            message: error_description ?? error,
          },
        });
      }

      if (!state || !code) {
        return await reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing state or code parameter',
          },
        });
      }

      const result = await service.completeOAuthConnection(state, code);

      // For redirect flows, redirect to a success page
      return await reply.redirect(`/integrations/connect/success?id=${result.integration.id}`);
    } catch (error) {
      return reply.redirect('/integrations/connect/error');
    }
  });

  // =====================
  // API Key Connection Route
  // =====================

  /**
   * POST /integrations/connect/api-key
   * Connect with API key
   */
  app.post('/integrations/connect/api-key', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const body = connectApiKeySchema.parse(request.body);
      const result = await service.connectWithApiKey({
        userId,
        provider: body.provider as IntegrationProvider,
        name: body.name,
        apiKey: body.apiKey,
        apiSecret: body.apiSecret,
        description: body.description,
      });

      return await reply.status(201).send({
        success: true,
        data: {
          integration: result.integration,
          accountInfo: result.accountInfo,
        },
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // =====================
  // Integration Management Routes
  // =====================

  /**
   * PATCH /integrations/:id/settings
   * Update integration settings
   */
  app.patch('/integrations/:id/settings', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { id } = request.params as { id: string };
      const body = updateSettingsSchema.parse(request.body);
      const integration = await service.updateIntegrationSettings(id, userId, body);

      return await reply.send({
        success: true,
        data: integration,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * POST /integrations/:id/disconnect
   * Disconnect an integration
   */
  app.post('/integrations/:id/disconnect', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { id } = request.params as { id: string };
      await service.disconnectIntegration(id, userId);

      return await reply.send({
        success: true,
        message: 'Integration disconnected',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * POST /integrations/:id/pause
   * Pause an integration
   */
  app.post('/integrations/:id/pause', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { id } = request.params as { id: string };
      const body = pauseIntegrationSchema.parse(request.body);
      const integration = await service.pauseIntegration(id, userId, body.reason);

      return await reply.send({
        success: true,
        data: integration,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  /**
   * POST /integrations/:id/resume
   * Resume an integration
   */
  app.post('/integrations/:id/resume', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { id } = request.params as { id: string };
      const integration = await service.resumeIntegration(id, userId);

      return await reply.send({
        success: true,
        data: integration,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // =====================
  // Sync Routes
  // =====================

  /**
   * POST /integrations/:id/sync
   * Trigger a manual sync
   */
  app.post('/integrations/:id/sync', async (request, reply) => {
    try {
      const userId = (request as any).userId as string;
      if (!userId) {
        return await reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User ID required' },
        });
      }

      const { id } = request.params as { id: string };
      const body = triggerSyncSchema.parse(request.body ?? {});
      const result = await service.triggerSync(id, userId, body as SyncOptions);

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // =====================
  // Webhook Routes
  // =====================

  /**
   * POST /integrations/webhooks/:provider
   * Handle incoming webhooks from providers
   */
  app.post('/integrations/webhooks/:provider', async (request, reply) => {
    try {
      const { provider } = request.params as { provider: string };
      const signature =
        (request.headers['x-webhook-signature'] as string) ??
        (request.headers['stripe-signature'] as string) ??
        (request.headers['x-hub-signature-256'] as string);

      const parsed = webhookSchema.safeParse(request.body);
      if (!parsed.success) {
        return await reply.status(400).send({
          success: false,
          error: { code: 'INVALID_PAYLOAD', message: 'Invalid webhook payload' },
        });
      }

      await service.handleWebhook(
        provider.toUpperCase() as any,
        parsed.data.eventType,
        parsed.data.payload,
        request.headers as Record<string, string>,
        signature
      );

      return await reply.send({ success: true });
    } catch (error) {
      // Always return 200 for webhooks to prevent retries
      logger.error({ error }, 'Webhook processing error');
      return reply.send({ success: false });
    }
  });

  // =====================
  // Platform Stats Route
  // =====================

  /**
   * GET /integrations/stats
   * Get platform stats (admin only)
   */
  app.get('/integrations/stats', async (request, reply) => {
    try {
      const stats = await service.getPlatformStats();
      return await reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
