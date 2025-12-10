/**
 * @module @skillancer/billing-svc/routes/webhooks
 * Stripe webhook endpoint
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getStripeService } from '../services/stripe.service.js';
import { handleStripeWebhook } from '../handlers/stripe-webhook.handler.js';
import { StripeError } from '../errors/index.js';

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
    reply.status(400).send({
      success: false,
      error: 'Missing stripe-signature header',
    });
    return;
  }

  const stripeService = getStripeService();

  try {
    // Verify webhook signature and construct event
    const event = stripeService.constructWebhookEvent(request.rawBody, signature as string);

    // Handle the event
    const result = await handleStripeWebhook(event);

    reply.status(200).send({
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
      reply.status(400).send({
        success: false,
        error: 'Webhook signature verification failed',
        message: error.message,
      });
      return;
    }

    // Don't expose internal errors
    reply.status(500).send({
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
  // Register raw body content type parser for webhook
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    // Store raw body for signature verification
    (req as WebhookRequest).rawBody = body as Buffer;
    try {
      const json = JSON.parse(body.toString());
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Stripe webhook endpoint - no auth required (verified by signature)
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
