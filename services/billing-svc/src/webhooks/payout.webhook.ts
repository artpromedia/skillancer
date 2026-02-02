// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/webhooks/payout
 * Stripe Payout Webhook Handlers
 *
 * Handles webhook events for payout status updates from Stripe.
 */

import { prisma } from '@skillancer/database';

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

  // Find the payout account by Stripe Connect account ID
  const payoutAccount = await prisma.payoutAccount.findFirst({
    where: { stripeConnectAccountId: account.id },
  });

  if (!payoutAccount) {
    logger.warn('Received account.updated for unknown account', { accountId: account.id });
    return;
  }

  // Determine status
  let status: 'PENDING' | 'ONBOARDING' | 'ACTIVE' | 'RESTRICTED' | 'DISABLED' = 'PENDING';

  if (account.requirements?.disabled_reason) {
    status = 'DISABLED';
  } else if (account.payouts_enabled && account.charges_enabled) {
    status = 'ACTIVE';
  } else if ((account.requirements?.past_due?.length || 0) > 0) {
    status = 'RESTRICTED';
  } else if (account.details_submitted) {
    status = 'RESTRICTED';
  } else if ((account.requirements?.currently_due?.length || 0) > 0) {
    status = 'ONBOARDING';
  }

  // Extract external account info
  const externalAccount = account.external_accounts?.data?.[0];
  let externalAccountType: string | null = null;
  let externalAccountLast4: string | null = null;
  let externalAccountBank: string | null = null;

  if (externalAccount?.object === 'bank_account') {
    const bankAccount = externalAccount as Stripe.BankAccount;
    externalAccountType = 'bank_account';
    externalAccountLast4 = bankAccount.last4;
    externalAccountBank = bankAccount.bank_name || null;
  } else if (externalAccount?.object === 'card') {
    const card = externalAccount as Stripe.Card;
    externalAccountType = 'card';
    externalAccountLast4 = card.last4;
    externalAccountBank = card.brand || null;
  }

  // Update the local record
  await prisma.payoutAccount.update({
    where: { id: payoutAccount.id },
    data: {
      status,
      detailsSubmitted: account.details_submitted || false,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      currentlyDue: account.requirements?.currently_due || [],
      eventuallyDue: account.requirements?.eventually_due || [],
      pastDue: account.requirements?.past_due || [],
      externalAccountType,
      externalAccountLast4,
      externalAccountBank,
      updatedAt: new Date(),
    },
  });

  logger.info('Updated payout account status', {
    userId: payoutAccount.userId,
    accountId: account.id,
    status,
    payoutsEnabled: account.payouts_enabled,
  });
}

async function handleAccountDeauthorized(account: Stripe.Account): Promise<void> {
  logger.warn('Connect account deauthorized', {
    accountId: account.id,
  });

  // Find and disable the payout account
  const payoutAccount = await prisma.payoutAccount.findFirst({
    where: { stripeConnectAccountId: account.id },
  });

  if (!payoutAccount) {
    logger.warn('Received deauthorized for unknown account', { accountId: account.id });
    return;
  }

  // Mark as disabled
  await prisma.payoutAccount.update({
    where: { id: payoutAccount.id },
    data: {
      status: 'DISABLED',
      payoutsEnabled: false,
      chargesEnabled: false,
      updatedAt: new Date(),
    },
  });

  logger.info('Disabled deauthorized payout account', {
    userId: payoutAccount.userId,
    accountId: account.id,
  });

  // TODO: Send notification to user about account disconnection
}

async function handleCapabilityUpdated(capability: Stripe.Capability): Promise<void> {
  const accountId =
    typeof capability.account === 'string' ? capability.account : capability.account.id;

  logger.info('Capability updated', {
    accountId,
    capability: capability.id,
    status: capability.status,
  });

  // Find the payout account
  const payoutAccount = await prisma.payoutAccount.findFirst({
    where: { stripeConnectAccountId: accountId },
  });

  if (!payoutAccount) {
    logger.debug('Capability updated for unknown account', { accountId });
    return;
  }

  // If transfers or card_payments capability changed, may need to refresh full account
  // For now, log the important capabilities
  if (capability.id === 'transfers' || capability.id === 'card_payments') {
    logger.info('Important capability status change', {
      userId: payoutAccount.userId,
      capability: capability.id,
      status: capability.status,
      requirements: capability.requirements,
    });

    // If capability is now inactive, may need to update account status
    if (capability.status === 'inactive' && payoutAccount.status === 'ACTIVE') {
      await prisma.payoutAccount.update({
        where: { id: payoutAccount.id },
        data: {
          status: 'RESTRICTED',
          updatedAt: new Date(),
        },
      });
    }
  }
}

async function handlePersonUpdated(person: Stripe.Person): Promise<void> {
  const accountId = typeof person.account === 'string' ? person.account : person.account;

  logger.info('Person updated', {
    personId: person.id,
    accountId,
    verification: person.verification?.status,
  });

  // Find the payout account
  const payoutAccount = await prisma.payoutAccount.findFirst({
    where: { stripeConnectAccountId: accountId },
  });

  if (!payoutAccount) {
    logger.debug('Person updated for unknown account', { accountId });
    return;
  }

  // Log verification status changes - account.updated will handle status sync
  if (person.verification?.status === 'verified') {
    logger.info('Person verification completed', {
      userId: payoutAccount.userId,
      personId: person.id,
    });
  } else if (
    person.verification?.status === 'unverified' &&
    person.requirements?.currently_due?.length
  ) {
    logger.warn('Person requires additional verification', {
      userId: payoutAccount.userId,
      personId: person.id,
      currentlyDue: person.requirements.currently_due,
    });
  }
}

export default payoutWebhookRoutes;
