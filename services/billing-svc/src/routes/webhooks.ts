/**
 * @module @skillancer/billing-svc/routes/webhooks
 * Stripe webhook endpoint
 */

import { StripeError } from '../errors/index.js';
import { handleStripeWebhook } from '../handlers/stripe-webhook.handler.js';
import { getStripeService } from '../services/stripe.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface WebhookRequest extends FastifyRequest {
  rawBody: Buffer;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /webhooks/stripe
 * Stripe webhook endpoint
 */
async function stripeWebhook(request: WebhookRequest, reply: FastifyReply): Promise<void> {
  const signature = request.headers['stripe-signature'];

  if (!signature) {
    return reply.status(400).send({
      success: false,
      error: 'Missing stripe-signature header',
    });
  }

  const stripeService = getStripeService();

  try {
    // Verify webhook signature and construct event
    const event = stripeService.constructWebhookEvent(request.rawBody, signature as string);

    // Handle the event
    const result = await handleStripeWebhook(event);

    return await reply.status(200).send({
      success: true,
      received: true,
      eventId: event.id,
      eventType: event.type,
      handled: result.handled,
      message: result.message,
    });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);

    if (error instanceof StripeError) {
      return reply.status(400).send({
        success: false,
        error: 'Webhook signature verification failed',
        message: error.message,
      });
    }

    // Don't expose internal errors
    return reply.status(500).send({
      success: false,
      error: 'Webhook processing failed',
    });
  }
}

// =============================================================================
// PLUGIN REGISTRATION
// =============================================================================

/**
 * Register webhook routes
 */
export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();
  // Stripe webhook endpoint - no auth required (verified by signature)
  // Raw body handling is done in app.ts via addContentTypeParser
  fastify.post('/stripe', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Stripe webhook',
      description: 'Endpoint for receiving Stripe webhook events',
      headers: {
        type: 'object',
        required: ['stripe-signature'],
        properties: {
          'stripe-signature': { type: 'string' },
        },
      },
    },
    handler: stripeWebhook as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });
}

export default webhookRoutes;
