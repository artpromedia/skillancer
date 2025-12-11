/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all billing routes
 */

import { registerInvoiceRoutes } from './invoices.routes';
import { registerProductRoutes } from './products.routes';
import { registerSeatsRoutes } from './seats.routes';
import { registerUsageRoutes } from './usage.routes';

import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Register all route modules
  await registerProductRoutes(fastify);
  await registerInvoiceRoutes(fastify);
  await registerUsageRoutes(fastify);
  await registerSeatsRoutes(fastify);
}

export { registerProductRoutes, registerInvoiceRoutes, registerUsageRoutes, registerSeatsRoutes };
