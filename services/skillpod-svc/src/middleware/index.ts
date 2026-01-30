/**
 * @module @skillancer/skillpod-svc/middleware
 * Middleware index
 */

export {
  createContainmentMiddleware,
  createRouteContainmentMiddleware,
  createWatermarkMiddleware,
} from './containment.middleware.js';

export {
  createSkillpodRateLimitHook,
  createSkillpodRateLimitHooks,
  createCombinedRateLimitHook,
  SkillpodRateLimitExceededError,
  SkillpodRateLimitConfigs,
  TenantTierMultipliers,
  getRateLimitKey,
  getClientIp,
  getTenantTier,
  getAdjustedConfig,
  logRateLimitViolation,
} from './rate-limit.js';
export type { SkillpodRateLimitType, SkillpodRateLimitHooks } from './rate-limit.js';
