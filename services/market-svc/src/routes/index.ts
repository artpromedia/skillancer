/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all market-svc routes
 */

import { registerAdminReviewRoutes } from './admin-reviews.routes.js';
import { registerConversationRoutes } from './conversations.routes.js';
import { registerEnhancedReviewRoutes } from './enhanced-reviews.routes.js';
import { registerEscrowRoutes } from './escrow.routes.js';
import { registerInvoiceRoutes } from './invoices.routes.js';
import { registerMessageRoutes } from './messages.routes.js';
import { registerNotificationRoutes } from './notifications.routes.js';
import { registerPayoutRoutes } from './payouts.routes.js';
import { registerPresenceRoutes } from './presence.routes.js';
import { rateIntelligenceRoutes } from './rate-intelligence.routes.js';
import { registerReviewRoutes } from './reviews.routes.js';
import { registerServiceOrderRoutes } from './service-orders.routes.js';
import { registerServiceRoutes } from './services.routes.js';
import { registerStripeWebhookRoutes } from './stripe-webhooks.routes.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

export interface RouteDependencies {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
  stripeWebhookSecret?: string;
}

export async function registerRoutes(
  fastify: FastifyInstance,
  deps: RouteDependencies
): Promise<void> {
  // Register review routes
  await fastify.register(
    (instance) => {
      registerReviewRoutes(instance, deps);
    },
    { prefix: '/reviews' }
  );

  // Register enhanced review routes (with fraud detection)
  await fastify.register(
    (instance) => {
      registerEnhancedReviewRoutes(instance, deps);
    },
    { prefix: '/v2/reviews' }
  );

  // Register admin review routes
  await fastify.register(
    (instance) => {
      registerAdminReviewRoutes(instance, deps);
    },
    { prefix: '/admin/reviews' }
  );

  // Register service catalog routes
  await fastify.register(
    (instance) => {
      registerServiceRoutes(instance, deps);
    },
    { prefix: '/services' }
  );

  // Register service orders routes
  await fastify.register(
    (instance) => {
      registerServiceOrderRoutes(instance, deps);
    },
    { prefix: '/service-orders' }
  );

  // Register rate intelligence routes
  await fastify.register(
    (instance) => {
      rateIntelligenceRoutes(instance);
    },
    { prefix: '/market' }
  );

  // Register escrow routes
  await fastify.register(
    (instance) => {
      registerEscrowRoutes(instance, deps);
    },
    { prefix: '/escrow' }
  );

  // Register invoice routes
  await fastify.register(
    (instance) => {
      registerInvoiceRoutes(instance, deps);
    },
    { prefix: '/invoices' }
  );

  // Register payout routes
  await fastify.register(
    (instance) => {
      registerPayoutRoutes(instance, deps);
    },
    { prefix: '/payouts' }
  );

  // Register Stripe webhook routes
  if (deps.stripeWebhookSecret) {
    await fastify.register(
      (instance) => {
        registerStripeWebhookRoutes(instance, {
          prisma: deps.prisma,
          logger: deps.logger,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          stripeWebhookSecret: deps.stripeWebhookSecret!,
        });
      },
      { prefix: '/webhooks' }
    );
  }

  // Register conversation routes (messaging system)
  await fastify.register(
    (instance) => {
      registerConversationRoutes(instance, deps);
    },
    { prefix: '/conversations' }
  );

  // Register message routes (messaging system)
  await fastify.register(
    (instance) => {
      registerMessageRoutes(instance, deps);
    },
    { prefix: '/conversations' }
  );

  // Register presence routes (messaging system)
  await fastify.register(
    (instance) => {
      registerPresenceRoutes(instance, deps);
    },
    { prefix: '/presence' }
  );

  // Register notification routes
  await fastify.register(
    (instance) => {
      registerNotificationRoutes(instance, deps);
    },
    { prefix: '/api' }
  );

  // FUTURE: Register contract management routes when service implementations are complete
}

// Re-export route registration functions
export { registerReviewRoutes } from './reviews.routes.js';
export { registerAdminReviewRoutes } from './admin-reviews.routes.js';
export { registerEnhancedReviewRoutes } from './enhanced-reviews.routes.js';
export { registerServiceRoutes } from './services.routes.js';
export { registerServiceOrderRoutes } from './service-orders.routes.js';
export { rateIntelligenceRoutes } from './rate-intelligence.routes.js';
export { registerEscrowRoutes } from './escrow.routes.js';
export { registerInvoiceRoutes } from './invoices.routes.js';
export { registerPayoutRoutes } from './payouts.routes.js';
export { registerStripeWebhookRoutes } from './stripe-webhooks.routes.js';
export { registerConversationRoutes } from './conversations.routes.js';
export { registerMessageRoutes } from './messages.routes.js';
export { registerPresenceRoutes } from './presence.routes.js';
export { registerNotificationRoutes } from './notifications.routes.js';
// FUTURE: Export contract routes when implemented
// export { contractRoutes } from './contract.routes.js';
// export { contractSubRoutes } from './contract-sub.routes.js';
