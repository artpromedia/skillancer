// @ts-nocheck
/**
 * @module @skillancer/billing-svc/routes/webhooks.routes
 * Stripe Webhook Routes
 *
 * Handles incoming Stripe webhooks with:
 * - Signature verification
 * - Event routing
 * - Error handling
 */

import { logger } from '../lib/logger.js';

import { getWebhookProcessor } from '../webhooks/webhook-processor.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

async function webhooksRoutes(fastify: FastifyInstance): Promise<void> {
  const processor = getWebhookProcessor();

  /**
   * POST /webhooks/stripe
   * Main Stripe webhook endpoint
   */
  fastify.post(
    '/stripe',
    {
      config: {
        rawBody: true, // Needed for signature verification
      },
      schema: {
        tags: ['Webhooks'],
        summary: 'Stripe webhook',
        description: 'Receives and processes Stripe webhook events',
        hide: true, // Hide from public API docs
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'];

      if (!signature || typeof signature !== 'string') {
        logger.warn('Missing Stripe signature header');
        return reply.status(400).send({
          error: 'Missing signature',
        });
      }

      // Get raw body for signature verification
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;

      if (!rawBody) {
        logger.warn('Missing raw body for webhook');
        return reply.status(400).send({
          error: 'Missing body',
        });
      }

      try {
        await processor.processWebhook(rawBody.toString(), signature);
        return await reply.status(200).send({ received: true });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Signature verification failures
        if (errorMessage.includes('signature')) {
          logger.error({ error }, 'Webhook signature verification failed');
          return reply.status(400).send({
            error: 'Invalid signature',
          });
        }

        // Other processing errors - still return 200 to prevent retries
        // for errors we can't fix by retrying
        logger.error({ error }, 'Webhook processing error');
        return reply.status(200).send({
          received: true,
          warning: 'Processing error logged',
        });
      }
    }
  );

  /**
   * POST /webhooks/stripe-connect
   * Stripe Connect webhook endpoint for connected account events
   */
  fastify.post(
    '/stripe-connect',
    {
      config: {
        rawBody: true,
      },
      schema: {
        tags: ['Webhooks'],
        summary: 'Stripe Connect webhook',
        description: 'Receives and processes Stripe Connect webhook events',
        hide: true,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'];

      if (!signature || typeof signature !== 'string') {
        logger.warn('Missing Stripe signature header for Connect webhook');
        return reply.status(400).send({
          error: 'Missing signature',
        });
      }

      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;

      if (!rawBody) {
        return reply.status(400).send({
          error: 'Missing body',
        });
      }

      try {
        // Process with Connect webhook secret
        await processor.processWebhook(
          rawBody.toString(),
          signature,
          process.env.STRIPE_CONNECT_WEBHOOK_SECRET
        );
        return await reply.status(200).send({ received: true });
      } catch (error) {
        logger.error({ error }, 'Connect webhook processing error');
        return reply.status(200).send({
          received: true,
          warning: 'Processing error logged',
        });
      }
    }
  );

  /**
   * GET /webhooks/health
   * Webhook health check endpoint
   */
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Webhook health check',
        description: 'Check webhook processing health',
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      // Check recent webhook processing stats
      const stats = await processor.getProcessingStats();

      const isHealthy =
        stats.failureRate < 0.1 && // Less than 10% failure rate
        stats.queueDepth < 100; // Less than 100 events queued

      return reply.status(isHealthy ? 200 : 503).send({
        healthy: isHealthy,
        stats: {
          processedLast24h: stats.processedLast24h,
          failedLast24h: stats.failedLast24h,
          failureRate: stats.failureRate,
          queueDepth: stats.queueDepth,
          averageProcessingTimeMs: stats.averageProcessingTimeMs,
        },
      });
    }
  );
}

export default webhooksRoutes;

