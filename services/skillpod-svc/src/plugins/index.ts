/**
 * @module @skillancer/skillpod-svc/plugins
 * Plugin exports for SkillPod service
 */

export {
  authPlugin,
  requireAuth,
  optionalAuth,
  requireAdmin,
  validateSessionOwnership,
  validateTenantAccess,
} from './auth.js';
export type { JwtPayload, AuthenticatedUser } from './auth.js';

export { rateLimitPlugin } from './rate-limit.js';
export type { RateLimitPluginOptions } from './rate-limit.js';
