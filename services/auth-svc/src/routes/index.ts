/**
 * @module @skillancer/auth-svc/routes
 * Route exports
 */

export * from './auth.js';
export * from './oauth.js';
export * from './health.js';
export * from './mfa.js';
export * from './profile.js';

// Named exports for route plugins
export { portfolioRoutes } from './portfolio.js';
export { workHistoryRoutes } from './work-history.js';
export { educationRoutes } from './education.js';
export { certificationRoutes } from './certification.js';
export { profileCompletionRoutes } from './profile-completion.js';

// Verification and webhooks are exported as default plugins
export { default as verificationRoutes } from './verification.js';
export { default as webhookRoutes } from './webhooks.js';
