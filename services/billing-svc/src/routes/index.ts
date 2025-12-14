/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all billing routes
 */

import { registerCouponRoutes } from './coupons.routes.js';
import { registerInvoiceRoutes } from './invoices.routes.js';
import { payoutAccountRoutes } from './payout-accounts.routes.js';
import { registerProductRoutes } from './products.routes.js';
import { registerSeatsRoutes } from './seats.routes.js';
import { transactionRoutes } from './transactions.routes.js';
import { registerTrialRoutes } from './trials.routes.js';
import { registerUsageRoutes } from './usage.routes.js';

import type { FastifyInstance } from 'fastify';

// Re-export all routes
export {
  registerCouponRoutes,
  registerInvoiceRoutes,
  payoutAccountRoutes,
  registerProductRoutes,
  registerSeatsRoutes,
  transactionRoutes,
  registerTrialRoutes,
  registerUsageRoutes,
};

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
  await fastify.register(transactionRoutes, { prefix: '/transactions' });
}
