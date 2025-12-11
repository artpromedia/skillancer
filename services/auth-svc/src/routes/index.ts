/**
 * @module @skillancer/auth-svc/routes
 * Route exports
 */

export * from './auth.js';
export * from './oauth.js';
export * from './health.js';
export * from './mfa.js';
export * from './profile.js';

// Verification and webhooks are exported as default plugins
export { default as verificationRoutes } from './verification.js';
export { default as webhookRoutes } from './webhooks.js';
