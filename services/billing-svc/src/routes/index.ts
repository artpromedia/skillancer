/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all billing routes
 */

import { registerCouponRoutes } from './coupons.routes';
import { registerInvoiceRoutes } from './invoices.routes';
import { payoutAccountRoutes } from './payout-accounts.routes.js';
import { registerProductRoutes } from './products.routes';
import { registerSeatsRoutes } from './seats.routes';
import { transactionRoutes } from './transactions.routes.js';
import { registerTrialRoutes } from './trials.routes';
import { registerUsageRoutes } from './usage.routes';

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
  await fastify.register(transactionRoutes, { prefix: '/transactions' });
}

export { registerProductRoutes, registerInvoiceRoutes, registerUsageRoutes, registerSeatsRoutes };
export { registerTrialRoutes, registerCouponRoutes };
export { payoutAccountRoutes, transactionRoutes };
