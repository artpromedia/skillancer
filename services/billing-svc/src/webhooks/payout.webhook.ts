// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/webhooks/payout
 * Stripe Payout Webhook Handlers
 *
 * Handles webhook events for payout status updates from Stripe.
 */

import { createLogger } from '../lib/logger.js';

import { getGlobalPayoutService } from '../services/global-payout.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';

const logger = createLogger({ serviceName: 'payout-webhooks' });

// =============================================================================
// WEBHOOK EVENT TYPES
// =============================================================================

const PAYOUT_EVENTS = [
  'payout.created',
  'payout.updated',
  'payout.paid',
  'payout.failed',
  'payout.canceled',
  'transfer.created',
  'transfer.updated',
  'transfer.paid',
  'transfer.failed',
  'transfer.reversed',
] as const;

type PayoutEventType = (typeof PAYOUT_EVENTS)[number];

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

export async function payoutWebhookHandler(
  fastify: FastifyInstance,
  event: Stripe.Event
): Promise<void> {
  const eventType = event.type as PayoutEventType;

  if (!PAYOUT_EVENTS.includes(eventType)) {
    logger.debug('Ignoring non-payout event', { type: event.type });
    return;
  }

  logger.info('Processing payout webhook', {
    eventId: event.id,
    type: eventType,
  });

  const config = fastify.config ?? { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY };
  const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });

  try {
    await payoutService.handlePayoutEvent(event);
    logger.info('Payout webhook processed successfully', {
      eventId: event.id,
      type: eventType,
    });
  } catch (err) {
    logger.error('Failed to process payout webhook', {
      err,
      eventId: event.id,
      type: eventType,
    });
    throw err;
  }
}

// =============================================================================
// WEBHOOK ROUTES
// =============================================================================

export async function payoutWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /webhooks/stripe/payouts
   * Handle Stripe payout webhooks
   */
  fastify.post('/stripe/payouts', {
    config: {
      rawBody: true,
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const sig = request.headers['stripe-signature'];
      const config = fastify.config ?? {
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_PAYOUT_WEBHOOK_SECRET: process.env.STRIPE_PAYOUT_WEBHOOK_SECRET,
      };

      if (!sig || !config.STRIPE_PAYOUT_WEBHOOK_SECRET) {
        logger.warn('Missing webhook signature or secret');
        return reply.status(400).send({ error: 'Missing signature' });
      }

      try {
        // Import Stripe dynamically to avoid initialization issues
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

        // Verify webhook signature
        const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
        const event = stripe.webhooks.constructEvent(
          rawBody,
          sig as string,
          config.STRIPE_PAYOUT_WEBHOOK_SECRET
        );

        // Process the event
        await payoutWebhookHandler(fastify, event);

        return await reply.status(200).send({ received: true });
      } catch (err: any) {
        logger.error('Webhook verification failed', { err });
        return reply.status(400).send({
          error: 'Webhook verification failed',
          message: err.message,
        });
      }
    },
  });

  /**
   * POST /webhooks/stripe/connect
   * Handle Stripe Connect webhooks (account updates)
   */
  fastify.post('/stripe/connect', {
    config: {
      rawBody: true,
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const sig = request.headers['stripe-signature'];
      const config = fastify.config ?? {
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
      };

      if (!sig || !config.STRIPE_CONNECT_WEBHOOK_SECRET) {
        logger.warn('Missing webhook signature or secret');
        return reply.status(400).send({ error: 'Missing signature' });
      }

      try {
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

        const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
        const event = stripe.webhooks.constructEvent(
          rawBody,
          sig as string,
          config.STRIPE_CONNECT_WEBHOOK_SECRET
        );

        // Handle Connect account events
        await handleConnectEvent(event);

        return await reply.status(200).send({ received: true });
      } catch (err: any) {
        logger.error('Connect webhook verification failed', { err });
        return reply.status(400).send({
          error: 'Webhook verification failed',
          message: err.message,
        });
      }
    },
  });
}

// =============================================================================
// CONNECT EVENT HANDLERS
// =============================================================================

async function handleConnectEvent(event: Stripe.Event): Promise<void> {
  logger.info('Processing Connect webhook', {
    eventId: event.id,
    type: event.type,
  });

  switch (event.type) {
    case 'account.updated':
      await handleAccountUpdated(event.data.object);
      break;

    case 'account.application.deauthorized':
      await handleAccountDeauthorized(event.data.object as Stripe.Account);
      break;

    case 'capability.updated':
      await handleCapabilityUpdated(event.data.object);
      break;

    case 'person.updated':
      await handlePersonUpdated(event.data.object);
      break;

    default:
      logger.debug('Unhandled Connect event', { type: event.type });
  }
}

async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  logger.info('Connect account updated', {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  });

  // Update local account status
  // This would sync with PayoutAccountService
  // Implementation depends on having access to the account mapping
}

async function handleAccountDeauthorized(account: Stripe.Account): Promise<void> {
  logger.warn('Connect account deauthorized', {
    accountId: account.id,
  });

  // Mark local account as deauthorized
  // Notify user
}

async function handleCapabilityUpdated(capability: Stripe.Capability): Promise<void> {
  logger.info('Capability updated', {
    accountId: capability.account,
    capability: capability.id,
    status: capability.status,
  });

  // Update account capabilities
  // May affect what payout methods are available
}

async function handlePersonUpdated(person: Stripe.Person): Promise<void> {
  logger.info('Person updated', {
    personId: person.id,
    accountId: person.account,
  });

  // Verification updates for account representatives
}

export default payoutWebhookRoutes;
