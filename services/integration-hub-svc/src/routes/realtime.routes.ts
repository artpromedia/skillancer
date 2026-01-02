/**
 * @module @skillancer/integration-hub-svc/routes/realtime
 * Real-time Routes - WebSocket config and REST fallback
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const subscribeSchema = z.object({
  channels: z.array(z.string()),
});

export async function realtimeRoutes(fastify: FastifyInstance) {
  /**
   * Get WebSocket configuration
   */
  fastify.get('/realtime/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    const wsUrl = process.env.WEBSOCKET_URL || 'ws://localhost:3002';

    return reply.send({
      success: true,
      config: {
        url: wsUrl,
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      },
      channels: {
        workspace: 'workspace:{workspaceId}',
        widget: 'widget:{workspaceId}:{widgetId}',
        integration: 'integration:{integrationId}',
      },
    });
  });

  /**
   * REST fallback for subscription (polling)
   */
  fastify.post('/realtime/subscribe', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = subscribeSchema.parse(request.body);

    // For REST fallback, return current state
    const channelData: Record<string, { lastUpdate: string }> = {};

    for (const channel of body.channels) {
      channelData[channel] = {
        lastUpdate: new Date().toISOString(),
      };
    }

    return reply.send({
      success: true,
      subscribed: body.channels,
      data: channelData,
      note: 'Use WebSocket for real-time updates',
    });
  });

  /**
   * Poll for updates (REST fallback)
   */
  fastify.get(
    '/realtime/poll/:workspaceId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as { workspaceId: string };
      const { since } = request.query as { since?: string };

      const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000);

      // Would fetch updates since timestamp from event store
      const updates: unknown[] = [];

      return reply.send({
        success: true,
        workspaceId,
        since: sinceDate.toISOString(),
        updates,
        nextPoll: new Date(Date.now() + 5000).toISOString(),
      });
    }
  );

  /**
   * Connection health check
   */
  fastify.get('/realtime/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      websocket: {
        available: true,
        connections: 0, // Would get from WebSocket server
      },
      timestamp: new Date().toISOString(),
    });
  });
}

export default realtimeRoutes;
