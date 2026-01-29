/**
 * @module @skillancer/copilot-svc/plugins
 * Plugin exports for Copilot service
 */

export { authPlugin, requireAuth, optionalAuth } from './auth.js';
export type { JwtPayload, AuthenticatedUser } from './auth.js';
