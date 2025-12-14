/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all billing routes
 */

// Re-export all routes using export...from syntax
export { registerCouponRoutes } from './coupons.routes.js';
export { registerInvoiceRoutes } from './invoices.routes.js';
export { payoutAccountRoutes } from './payout-accounts.routes.js';
export { registerProductRoutes } from './products.routes.js';
export { registerSeatsRoutes } from './seats.routes.js';
export { transactionRoutes } from './transactions.routes.js';
export { registerTrialRoutes } from './trials.routes.js';
export { registerUsageRoutes } from './usage.routes.js';

// Internal imports for registerRoutes function
import { registerCouponRoutes } from './coupons.routes.js';
import { registerInvoiceRoutes } from './invoices.routes.js';
import { payoutAccountRoutes } from './payout-accounts.routes.js';
import { registerProductRoutes } from './products.routes.js';
import { registerSeatsRoutes } from './seats.routes.js';
import { transactionRoutes } from './transactions.routes.js';
import { registerTrialRoutes } from './trials.routes.js';
import { registerUsageRoutes } from './usage.routes.js';

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
