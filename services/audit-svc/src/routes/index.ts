/**
 * @module @skillancer/audit-svc/routes
 * Route registration
 */

import { registerAnalyticsRoutes } from './analytics.routes.js';
import { registerAuditRoutes } from './audit.routes.js';
import { registerComplianceRoutes } from './compliance.routes.js';
import { registerExportRoutes } from './export.routes.js';
import { registerIntegrityRoutes } from './integrity.routes.js';

import type { FastifyInstance } from 'fastify';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Register all route modules with their prefixes
  await app.register(registerAuditRoutes, { prefix: '/audit' });
  await app.register(registerAnalyticsRoutes, { prefix: '/analytics' });
  await app.register(registerComplianceRoutes, { prefix: '/audit' });
  await app.register(registerExportRoutes, { prefix: '/export' });
  await app.register(registerIntegrityRoutes, { prefix: '/audit' });
}
