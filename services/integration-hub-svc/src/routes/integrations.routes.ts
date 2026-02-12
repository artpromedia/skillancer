// @ts-nocheck
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { integrationService } from '../services/integration.service';
import { oauthService } from '../services/oauth.service';
import { webhookService } from '../services/webhook.service';

// Validation schemas
const connectIntegrationSchema = z.object({
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
});

const updateConfigSchema = z.object({
  config: z.record(z.unknown()),
});

const updateWidgetsSchema = z.object({
  enabledWidgets: z.array(z.string()),
});

const widgetParamsSchema = z.object({
  params: z.record(z.unknown()).optional(),
});

export async function integrationRoutes(fastify: FastifyInstance): Promise<void> {
  // ============================================
  // DISCOVERY ROUTES
  // ============================================

  // List available integrations
  fastify.get('/integrations', async (request: FastifyRequest, reply: FastifyReply) => {
    const { category, executiveType } = request.query as {
      category?: string;
      executiveType?: string;
    };

    const integrations = await integrationService.getAvailableIntegrations({
      category,
      executiveType,
    });

    return reply.send({ integrations });
  });

  // Get integration details
  fastify.get('/integrations/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };

    const integration = await integrationService.getIntegrationDetails(slug);
    if (!integration) {
      return reply.status(404).send({ error: 'Integration not found' });
    }

    return reply.send({ integration });
  });

  // ============================================
  // CONNECTION ROUTES
  // ============================================

  // Initiate OAuth connection
  fastify.post(
    '/workspaces/:workspaceId/integrations/:slug/connect',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, slug } = request.params as { workspaceId: string; slug: string };
      const body = connectIntegrationSchema.parse(request.body || {});
      const userId = request.user.id;

      const result = await oauthService.initiateOAuth({
        connectorId: slug,
        workspaceId,
        userId,
        redirectUri: body.redirectUri,
        scopes: body.scopes,
      });

      return reply.send({ authorizationUrl: result.authorizationUrl });
    }
  );

  // OAuth callback handler
  fastify.get('/oauth/callback/:slug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const { code, state, error, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    if (error) {
      return reply.redirect(
        `/integrations/callback?error=${encodeURIComponent(error_description || error)}`
      );
    }

    if (!code || !state) {
      return reply.redirect('/integrations/callback?error=missing_parameters');
    }

    try {
      const result = await oauthService.handleCallback({
        connectorId: slug,
        code,
        state,
      });

      if (result.success) {
        return reply.redirect(
          `/integrations/callback?success=true&integration=${slug}&workspaceId=${result.workspaceId}`
        );
      } else {
        return reply.redirect(
          `/integrations/callback?error=${encodeURIComponent(result.error || 'unknown')}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.redirect(`/integrations/callback?error=${encodeURIComponent(message)}`);
    }
  });

  // Disconnect integration
  fastify.post(
    '/workspaces/:workspaceId/integrations/:integrationId/disconnect',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, integrationId } = request.params as {
        workspaceId: string;
        integrationId: string;
      };
      const userId = request.user.id;

      await integrationService.disconnectIntegration({
        integrationId,
        workspaceId,
        userId,
      });

      return reply.send({ success: true });
    }
  );

  // Reconnect expired integration
  fastify.post(
    '/workspaces/:workspaceId/integrations/:integrationId/reconnect',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, integrationId } = request.params as {
        workspaceId: string;
        integrationId: string;
      };
      const body = connectIntegrationSchema.parse(request.body || {});
      const userId = request.user.id;

      const result = await oauthService.initiateReconnect({
        integrationId,
        workspaceId,
        userId,
        redirectUri: body.redirectUri,
      });

      return reply.send({ authorizationUrl: result.authorizationUrl });
    }
  );

  // ============================================
  // STATUS ROUTES
  // ============================================

  // List workspace integrations
  fastify.get(
    '/workspaces/:workspaceId/integrations',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const userId = request.user.id;

      const integrations = await integrationService.getWorkspaceIntegrations({
        workspaceId,
        userId,
      });

      return reply.send({ integrations });
    }
  );

  // Get integration status
  fastify.get(
    '/workspaces/:workspaceId/integrations/:integrationId',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, integrationId } = request.params as {
        workspaceId: string;
        integrationId: string;
      };
      const userId = request.user.id;

      const integration = await integrationService.getIntegrationStatus({
        integrationId,
        workspaceId,
        userId,
      });

      if (!integration) {
        return reply.status(404).send({ error: 'Integration not found' });
      }

      return reply.send({ integration });
    }
  );

  // Test integration connection
  fastify.post(
    '/workspaces/:workspaceId/integrations/:integrationId/test',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, integrationId } = request.params as {
        workspaceId: string;
        integrationId: string;
      };
      const userId = request.user.id;

      const result = await integrationService.testIntegration({
        integrationId,
        workspaceId,
        userId,
      });

      return reply.send(result);
    }
  );

  // ============================================
  // DATA ROUTES
  // ============================================

  // Get widget data
  fastify.get(
    '/workspaces/:workspaceId/integrations/:integrationId/widgets/:widgetId/data',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, integrationId, widgetId } = request.params as {
        workspaceId: string;
        integrationId: string;
        widgetId: string;
      };
      const userId = request.user.id;
      const params = request.query as Record<string, unknown>;

      const data = await integrationService.getWidgetData({
        integrationId,
        workspaceId,
        userId,
        widgetId,
        params,
      });

      return reply.send({ data });
    }
  );

  // Trigger manual sync
  fastify.post(
    '/workspaces/:workspaceId/integrations/:integrationId/sync',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, integrationId } = request.params as {
        workspaceId: string;
        integrationId: string;
      };
      const userId = request.user.id;

      const result = await integrationService.syncIntegration({
        integrationId,
        workspaceId,
        userId,
      });

      return reply.send(result);
    }
  );

  // ============================================
  // CONFIGURATION ROUTES
  // ============================================

  // Update integration config
  fastify.put(
    '/workspaces/:workspaceId/integrations/:integrationId/config',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, integrationId } = request.params as {
        workspaceId: string;
        integrationId: string;
      };
      const body = updateConfigSchema.parse(request.body);
      const userId = request.user.id;

      const integration = await integrationService.updateConfig({
        integrationId,
        workspaceId,
        userId,
        config: body.config,
      });

      return reply.send({ integration });
    }
  );

  // Update enabled widgets
  fastify.put(
    '/workspaces/:workspaceId/integrations/:integrationId/widgets',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, integrationId } = request.params as {
        workspaceId: string;
        integrationId: string;
      };
      const body = updateWidgetsSchema.parse(request.body);
      const userId = request.user.id;

      const integration = await integrationService.updateEnabledWidgets({
        integrationId,
        workspaceId,
        userId,
        enabledWidgets: body.enabledWidgets,
      });

      return reply.send({ integration });
    }
  );

  // ============================================
  // WEBHOOK ROUTES
  // ============================================

  // Receive webhooks from providers
  fastify.post('/webhooks/:connectorSlug', async (request: FastifyRequest, reply: FastifyReply) => {
    const { connectorSlug } = request.params as { connectorSlug: string };
    const signature =
      (request.headers['x-hub-signature-256'] as string) ||
      (request.headers['x-signature'] as string) ||
      '';

    try {
      const result = await webhookService.handleIncomingWebhook({
        connectorId: connectorSlug,
        payload: request.body,
        headers: request.headers as Record<string, string>,
        signature,
      });

      if (result.success) {
        return reply.send({ ok: true });
      } else {
        return reply.status(400).send({ error: result.error });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      return reply.status(500).send({ error: message });
    }
  });

}

// Extend FastifyInstance with authenticate
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

export default integrationRoutes;
