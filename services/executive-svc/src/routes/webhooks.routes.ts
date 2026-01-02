/**
 * Checkr Webhook Routes
 *
 * Webhook endpoints for Checkr background check integration.
 */

import type { FastifyInstance } from 'fastify';
import * as backgroundService from '../services/background-check.service.js';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Checkr webhook endpoint
  app.post(
    '/checkr',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Checkr webhook',
        description: 'Receives webhook events from Checkr for background check updates.',
      } as any,
      config: {
        rawBody: true, // Need raw body for signature verification
      },
    },
    async (request, reply) => {
      const signature = request.headers['x-checkr-signature'] as string;
      const rawBody = (request as any).rawBody as string;

      // Verify signature
      if (!backgroundService.verifyCheckrWebhookSignature(rawBody, signature || '')) {
        app.log.warn('Invalid Checkr webhook signature');
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const event = request.body as any;

      try {
        await backgroundService.handleCheckrWebhook(event);
        return { received: true };
      } catch (error) {
        app.log.error({ error, event: event.type }, 'Error processing Checkr webhook');
        // Return 200 to prevent Checkr from retrying
        return { received: true, error: 'Processing failed' };
      }
    }
  );
}
