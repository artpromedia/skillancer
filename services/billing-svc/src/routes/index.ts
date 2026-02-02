/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all billing routes
 */

// Re-export all routes using export...from syntax
export { registerCouponRoutes } from './coupons.routes.js';
export { registerInvoiceRoutes } from './invoices.routes.js';
export { payoutAccountRoutes } from './payout-accounts.routes.js';
export { payoutRoutes, exchangeRateRoutes } from './payouts.routes.js';
export { registerProductRoutes } from './products.routes.js';
export { registerSeatsRoutes } from './seats.routes.js';
export { transactionRoutes } from './transactions.routes.js';
export { registerTrialRoutes } from './trials.routes.js';
export { registerUsageRoutes } from './usage.routes.js';
export { escrowRoutes } from './escrow.routes.js';
export { milestoneRoutes } from './milestones.routes.js';
export { disputeRoutes } from './disputes.routes.js';
export { timeLogRoutes } from './time-logs.routes.js';
export { connectRoutes } from './connect.routes.js';
export { default as paymentMethodRoutes } from './payment-methods.routes.js';
export { chargeRoutes } from './charges.routes.js';

// Internal imports for registerRoutes function
import { connectRoutes } from './connect.routes.js';
import { registerCouponRoutes } from './coupons.routes.js';
import { disputeRoutes } from './disputes.routes.js';
import { escrowRoutes } from './escrow.routes.js';
import { registerInvoiceRoutes } from './invoices.routes.js';
import { milestoneRoutes } from './milestones.routes.js';
import { payoutAccountRoutes } from './payout-accounts.routes.js';
import { payoutRoutes, exchangeRateRoutes } from './payouts.routes.js';
import { registerProductRoutes } from './products.routes.js';
import { registerSeatsRoutes } from './seats.routes.js';
import { timeLogRoutes } from './time-logs.routes.js';
import { transactionRoutes } from './transactions.routes.js';
import { registerTrialRoutes } from './trials.routes.js';
import { registerUsageRoutes } from './usage.routes.js';
import paymentMethodRoutes from './payment-methods.routes.js';
import { chargeRoutes } from './charges.routes.js';

import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Register all route modules
  await registerProductRoutes(fastify);
  await registerInvoiceRoutes(fastify);
  await registerUsageRoutes(fastify);
  await registerSeatsRoutes(fastify);
  await registerTrialRoutes(fastify);
  await registerCouponRoutes(fastify);

  // Register payout and transaction routes under /api prefix
  await fastify.register(payoutAccountRoutes, { prefix: '/payout-accounts' });
  await fastify.register(payoutRoutes, { prefix: '/payouts' });
  await fastify.register(exchangeRateRoutes, { prefix: '/exchange-rates' });
  await fastify.register(transactionRoutes, { prefix: '/transactions' });

  // Register escrow/marketplace routes
  await fastify.register(escrowRoutes, { prefix: '/escrow' });
  await fastify.register(milestoneRoutes, { prefix: '/milestones' });
  await fastify.register(disputeRoutes, { prefix: '/disputes' });
  await fastify.register(timeLogRoutes, { prefix: '/time-logs' });

  // Register Connect onboarding routes
  await fastify.register(connectRoutes, { prefix: '/connect' });

  // Register payment methods routes
  await fastify.register(paymentMethodRoutes, { prefix: '/payment-methods' });

  // Register charges routes (payment processing)
  await fastify.register(chargeRoutes, { prefix: '/charges' });
}
