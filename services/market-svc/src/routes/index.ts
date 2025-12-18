/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all market-svc routes
 */

import { registerAdminReviewRoutes } from './admin-reviews.routes.js';
import { registerEnhancedReviewRoutes } from './enhanced-reviews.routes.js';
import { registerEscrowRoutes } from './escrow.routes.js';
import { registerInvoiceRoutes } from './invoices.routes.js';
import { registerPayoutRoutes } from './payouts.routes.js';
import { rateIntelligenceRoutes } from './rate-intelligence.routes.js';
import { registerReviewRoutes } from './reviews.routes.js';
import { registerServiceOrderRoutes } from './service-orders.routes.js';
import { registerServiceRoutes } from './services.routes.js';
import { registerStripeWebhookRoutes } from './stripe-webhooks.routes.js';

// Contract routes and services - TODO: Uncomment when implemented
// import { contractRoutes } from './contract.routes.js';
// import { contractSubRoutes } from './contract-sub.routes.js';
// import { ContractService } from '../services/contract.service.js';
// import { ContractLifecycleService } from '../services/contract-lifecycle.service.js';
// import { ContractActivityService } from '../services/contract-activity.service.js';
// import { ContractDocumentService } from '../services/contract-document.service.js';
// import { ContractSignatureService } from '../services/contract-signature.service.js';
// import { ContractMilestoneService } from '../services/contract-milestone.service.js';
// import { ContractTimeEntryService } from '../services/contract-time-entry.service.js';
// import { ContractAmendmentService } from '../services/contract-amendment.service.js';

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

  // TODO: Register contract management routes when implemented
  // const activityService = new ContractActivityService(deps.prisma, deps.logger);
  // const signatureService = new ContractSignatureService(deps.prisma, deps.logger, activityService);
  // const documentService = new ContractDocumentService(deps.prisma, deps.logger);
  // const contractService = new ContractService(
  //   deps.prisma,
  //   deps.logger,
  //   activityService,
  //   signatureService
  // );
  // const lifecycleService = new ContractLifecycleService(deps.prisma, deps.logger, activityService);
  // const milestoneService = new ContractMilestoneService(deps.prisma, deps.logger, activityService);
  // const timeEntryService = new ContractTimeEntryService(deps.prisma, deps.logger, activityService);
  // const amendmentService = new ContractAmendmentService(deps.prisma, deps.logger, activityService);

  // await fastify.register(
  //   async (instance) => {
  //     await contractRoutes(instance, {
  //       contractService,
  //       lifecycleService,
  //       documentService,
  //       signatureService,
  //       activityService,
  //     });
  //     await contractSubRoutes(instance, {
  //       milestoneService,
  //       timeEntryService,
  //       amendmentService,
  //       signatureService,
  //       lifecycleService,
  //     });
  //   },
  //   { prefix: '/contracts' }
  // );
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
// TODO: Export contract routes when implemented
// export { contractRoutes } from './contract.routes.js';
// export { contractSubRoutes } from './contract-sub.routes.js';
