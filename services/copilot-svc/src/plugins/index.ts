/**
 * @module @skillancer/copilot-svc/plugins
 * Plugin exports for Copilot service
 */

export { authPlugin, requireAuth, optionalAuth } from './auth.js';
export type { JwtPayload, AuthenticatedUser } from './auth.js';

export { rateLimitPlugin } from './rate-limit.js';
export type { CopilotRateLimitHooks } from '../middleware/rate-limit.js';
