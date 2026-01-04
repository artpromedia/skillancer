/**
 * @module @skillancer/integration-hub-svc/routes/batch
 * Batch API Routes - Fetch multiple widgets/integrations in single request
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { connectorRegistry } from '../connectors/registry.js';
import { smartCache } from '../cache/smart-cache.service.js';

// Validation schemas
const batchWidgetsSchema = z.object({
  widgets: z.array(
    z.object({
      integrationId: z.string(),
      connectorSlug: z.string(),
      widgetId: z.string(),
      params: z.record(z.unknown()).optional(),
    })
  ),
});

const batchStatusSchema = z.object({
  integrationIds: z.array(z.string()),
});

export async function batchRoutes(fastify: FastifyInstance) {
  /**
   * Batch fetch widget data
   */
  fastify.post(
    '/workspaces/:workspaceId/widgets/batch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = batchWidgetsSchema.parse(request.body);

      const results: Record<string, { data?: unknown; error?: string }> = {};

      await Promise.all(
        body.widgets.map(async (widget) => {
          const key = `${widget.integrationId}:${widget.widgetId}`;
          try {
            // Check cache first
            const cacheKey = `widget:${widget.integrationId}:${widget.widgetId}`;
            const cached = await smartCache.get(cacheKey);

            if (cached) {
              results[key] = { data: cached };
              return;
            }

            // Fetch from connector
            const connector = connectorRegistry.get(widget.connectorSlug);
            if (!connector) {
              results[key] = { error: 'Connector not found' };
              return;
            }

            // Would need to fetch tokens from DB
            // For now, return placeholder
            results[key] = { error: 'Not implemented - needs token fetch' };
          } catch (error) {
            results[key] = {
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      return reply.send({
        success: true,
        workspaceId,
        widgets: results,
      });
    }
  );

  /**
   * Batch fetch integration status
   */
  fastify.post(
    '/workspaces/:workspaceId/integrations/batch-status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const body = batchStatusSchema.parse(request.body);

      const results: Record<string, { status: string; lastSync?: string; error?: string }> = {};

      for (const integrationId of body.integrationIds) {
        // Would fetch from DB
        results[integrationId] = {
          status: 'connected',
          lastSync: new Date().toISOString(),
        };
      }

      return reply.send({
        success: true,
        workspaceId,
        integrations: results,
      });
    }
  );

  /**
   * Prefetch workspace data
   */
  fastify.post(
    '/workspaces/:workspaceId/prefetch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as { workspaceId: string };

      // Trigger background prefetch
      // In production, this would queue a job

      return reply.send({
        success: true,
        message: 'Prefetch initiated',
        workspaceId,
      });
    }
  );
}

export default batchRoutes;
