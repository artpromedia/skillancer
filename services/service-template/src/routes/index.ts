/**
 * @module @skillancer/service-template/routes
 * Route registration
 */

import { exampleRoutes } from './example.js';
import { healthRoutes } from './health.js';

import type { FastifyInstance } from 'fastify';

/**
 * Register all routes
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check routes
  await app.register(healthRoutes);

  // Example API routes (can be removed in real services)
  await app.register(exampleRoutes, { prefix: '/api' });
}

export { healthRoutes, exampleRoutes };
