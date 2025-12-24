/**
 * @module @skillancer/api-gateway/routes
 * Route registration for the API Gateway
 */

import { dashboardRoutes, marketOverviewRoutes } from './bff/index.js';
import { healthRoutes } from './health.js';
import { observabilityRoutes } from './observability.js';

import type { FastifyInstance } from 'fastify';

/**
 * Register all API Gateway routes
 *
 * Note: Proxy routes are registered by the proxy plugin, not here.
 * This module registers health check and BFF aggregation routes.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check routes (no auth required)
  await app.register(healthRoutes);

  // Observability routes (SLO, metrics, dashboards)
  await app.register(observabilityRoutes);

  // BFF routes (require authentication)
  await app.register(dashboardRoutes, { prefix: '/bff' });
  await app.register(marketOverviewRoutes, { prefix: '/bff' });
}
