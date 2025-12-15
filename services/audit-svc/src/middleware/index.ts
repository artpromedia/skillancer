/**
 * @module @skillancer/audit-svc/middleware
 * Middleware exports
 */

export {
  createAuditMiddleware,
  createAuditResponseHook,
  registerAuditPlugin,
  registerAuditRoute,
  registerAuditRoutes,
  withAudit,
  type AuditRouteConfig,
} from './audit.middleware.js';
