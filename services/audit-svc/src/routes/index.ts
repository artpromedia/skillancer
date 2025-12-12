/**
 * @module @skillancer/audit-svc/routes
 * Route registration
 */

import { registerAnalyticsRoutes } from './analytics.routes.js';
import { registerAuditRoutes } from './audit.routes.js';
import { registerExportRoutes } from './export.routes.js';

import type { FastifyInstance } from 'fastify';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(registerAuditRoutes, { prefix: '/audit' });
  await app.register(registerAnalyticsRoutes, { prefix: '/analytics' });
  await app.register(registerExportRoutes, { prefix: '/export' });
}
