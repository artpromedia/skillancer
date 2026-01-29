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
