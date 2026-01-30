// @ts-nocheck
/**
 * @module @skillancer/market-svc/middleware/rate-limit
 * Rate limiting middleware for marketplace endpoints
 *
 * Implements endpoint-specific rate limits to prevent abuse:
 * - Job posting: 10 req/hour per user (prevent spam listings)
 * - Proposal submission: 20 req/hour per user (prevent bid spam)
 * - Search queries: 60 req/min per user (can be expensive)
 * - Profile updates: 30 req/min per user (standard)
 * - Reviews: 5 req/hour per user (prevent review manipulation)
 * - Messaging: 100 req/min per user (allow fluid conversations)
 * - Service creation: 10 req/hour per user (prevent service spam)
 * - Payments: 20 req/min per user (financial operations)
 * - Global: 1000 req/min per user (fallback)
 */

import type { RateLimiter, RateLimitConfig, RateLimitResult } from '@skillancer/cache';
import type { FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

export type MarketRateLimitType =
  | 'jobPosting'
  | 'proposalSubmission'
  | 'searchQueries'
  | 'profileUpdates'
  | 'reviews'
  | 'messaging'
  | 'serviceCreation'
  | 'payments'
  | 'smartMatch'
  | 'global';

// =============================================================================
// RATE LIMIT CONFIGS
// =============================================================================

/**
 * Market-specific rate limit configurations
 *
 * These limits are designed to:
 * 1. Prevent spam listings and proposals
 * 2. Protect search infrastructure from abuse
 * 3. Prevent review manipulation
 * 4. Allow fluid messaging while preventing flood
 * 5. Ensure fair marketplace usage
 */
export const MarketRateLimitConfigs: Record<MarketRateLimitType, RateLimitConfig> = {
  /**
   * Job posting - Prevent spam listings
   * 10 requests per hour per user
   */
  jobPosting: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },

  /**
   * Proposal/bid submission - Prevent bid spam
   * 20 requests per hour per user
   */
  proposalSubmission: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
  },

  /**
   * Search queries - Can be expensive
   * 60 requests per minute per user
   */
  searchQueries: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },

  /**
   * Profile updates - Standard rate
   * 30 requests per minute per user
   */
  profileUpdates: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },

  /**
   * Reviews - Prevent review manipulation
   * 5 requests per hour per user
   */
  reviews: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  },

  /**
   * Messaging - Allow fluid conversations
   * 100 requests per minute per user
   */
  messaging: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },

  /**
   * Service creation - Prevent service spam
   * 10 requests per hour per user
   */
  serviceCreation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },

  /**
   * Payments - Financial operations
   * 20 requests per minute per user
   */
  payments: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },

  /**
   * SmartMatch - AI matching can be expensive
   * 30 requests per minute per user
   */
  smartMatch: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },

  /**
   * Global fallback - All other endpoints
   * 1000 requests per minute per user
   */
  global: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
  },
};

// =============================================================================
// USER TIER MULTIPLIERS
// =============================================================================

/**
 * User tier multipliers for rate limits
 * Premium and verified users get higher limits
 */
export const UserTierMultipliers: Record<string, number> = {
  // Basic tiers
  FREE: 1,
  STARTER: 1.5,
  PROFESSIONAL: 2,
  ENTERPRISE: 5,

  // Verification bonuses (applied on top of tier)
  VERIFIED: 1.2,
  TOP_RATED: 1.5,
};

/**
 * Account age multipliers for spam prevention
 * Newer accounts have stricter limits
 */
export const AccountAgeMultipliers: Record<string, number> = {
  NEW: 0.5, // Less than 7 days
  RECENT: 0.75, // 7-30 days
  ESTABLISHED: 1, // 30+ days
  VETERAN: 1.25, // 1+ year
};

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Rate limit exceeded error for marketplace endpoints
 */
export class MarketRateLimitExceededError extends Error {
  statusCode = 429;
  retryAfter?: number;
  endpoint: MarketRateLimitType;
  userId?: string;

  constructor(endpoint: MarketRateLimitType, retryAfter?: number, userId?: string) {
    const message = `Rate limit exceeded for ${endpoint}. Please try again later.`;
    super(message);
    this.name = 'MarketRateLimitExceededError';
    this.retryAfter = retryAfter;
    this.endpoint = endpoint;
    this.userId = userId;
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      error: 'Too Many Requests',
      message: this.message,
      code: 'MARKET_RATE_LIMIT_EXCEEDED',
      endpoint: this.endpoint,
      retryAfter: this.retryAfter,
    };
  }
}

// =============================================================================
// RATE LIMIT HELPERS
// =============================================================================

/**
 * Get client IP from request (for unauthenticated rate limiting)
 */
export function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0];
    return first ? first.trim() : request.ip;
  }

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }

  return request.ip;
}

/**
 * Get rate limit key based on user ID and endpoint
 */
export function getRateLimitKey(request: FastifyRequest, endpoint: MarketRateLimitType): string {
  const user = (request as any).user;

  if (user?.id) {
    return `market:${endpoint}:user:${user.id}`;
  }

  return `market:${endpoint}:ip:${getClientIp(request)}`;
}

/**
 * Get user's subscription tier for rate limit multiplier
 * TODO(Sprint-10): Connect to billing service for real tier data
 */
export function getUserTier(_request: FastifyRequest): string {
  // For now, return PROFESSIONAL tier as default
  // In production, this would query the user's subscription status
  return 'PROFESSIONAL';
}

/**
 * Get user's verification status for rate limit bonus
 */
export function getUserVerificationStatus(_request: FastifyRequest): string | null {
  // For now, return null (no verification bonus)
  // In production, this would check if user is verified or top-rated
  return null;
}

/**
 * Get account age category for spam prevention
 * TODO(Sprint-10): Implement actual account age checking
 */
export function getAccountAgeCategory(_request: FastifyRequest): string {
  // For now, return ESTABLISHED as default
  // In production, this would check user.createdAt
  return 'ESTABLISHED';
}

/**
 * Get adjusted rate limit config based on user tier, verification, and account age
 */
export function getAdjustedConfig(
  baseConfig: RateLimitConfig,
  tier: string,
  verificationStatus: string | null,
  accountAge: string
): RateLimitConfig {
  let multiplier = UserTierMultipliers[tier] || 1;

  // Apply verification bonus
  if (verificationStatus && UserTierMultipliers[verificationStatus]) {
    multiplier *= UserTierMultipliers[verificationStatus];
  }

  // Apply account age multiplier
  const ageMultiplier = AccountAgeMultipliers[accountAge] || 1;
  multiplier *= ageMultiplier;

  return {
    windowMs: baseConfig.windowMs,
    maxRequests: Math.floor(baseConfig.maxRequests * multiplier),
  };
}

// =============================================================================
// SECURITY LOGGING
// =============================================================================

/**
 * Log rate limit violation for security monitoring
 * This should be picked up by the security monitoring system
 */
export function logRateLimitViolation(
  request: FastifyRequest,
  endpoint: MarketRateLimitType,
  result: RateLimitResult
): void {
  const user = (request as any).user;
  const ip = getClientIp(request);

  const logEntry = {
    level: 'warn',
    event: 'RATE_LIMIT_VIOLATION',
    service: 'market-svc',
    endpoint,
    userId: user?.id,
    ip,
    url: request.url,
    method: request.method,
    userAgent: request.headers['user-agent'],
    current: result.current,
    limit: result.remaining + result.current,
    resetAt: result.resetAt.toISOString(),
    retryAfter: result.retryAfter,
    timestamp: new Date().toISOString(),
  };

  // Log to request logger (will be picked up by monitoring)
  request.log.warn(logEntry, `Rate limit exceeded for ${endpoint}`);
}

// =============================================================================
// RATE LIMIT HOOK FACTORY
// =============================================================================

/**
 * Create a preHandler hook for rate limiting marketplace endpoints
 *
 * @param type - The type of endpoint being rate limited
 * @param limiter - The RateLimiter instance
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * // In route registration
 * fastify.post('/jobs', {
 *   preHandler: [requireAuth, createMarketRateLimitHook('jobPosting', limiter)],
 * }, handler);
 * ```
 */
export function createMarketRateLimitHook(type: MarketRateLimitType, limiter: RateLimiter) {
  const baseConfig = MarketRateLimitConfigs[type];

  return async function marketRateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const key = getRateLimitKey(request, type);
    const tier = getUserTier(request);
    const verificationStatus = getUserVerificationStatus(request);
    const accountAge = getAccountAgeCategory(request);
    const config = getAdjustedConfig(baseConfig, tier, verificationStatus, accountAge);

    const result = await limiter.consume(key, config);

    // Always set rate limit headers for visibility
    void reply.header('X-RateLimit-Limit', config.maxRequests);
    void reply.header('X-RateLimit-Remaining', result.remaining);
    void reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));
    void reply.header('X-RateLimit-Endpoint', type);

    if (!result.allowed) {
      void reply.header('Retry-After', result.retryAfter);

      // Log violation for security monitoring
      logRateLimitViolation(request, type, result);

      const user = (request as any).user;
      throw new MarketRateLimitExceededError(type, result.retryAfter, user?.id);
    }
  };
}

// =============================================================================
// PRE-BUILT HOOKS (Lazily initialized in plugin)
// =============================================================================

/**
 * Hook factory for all marketplace endpoints
 * These are created when the rate limit plugin is registered
 */
export interface MarketRateLimitHooks {
  jobPosting: ReturnType<typeof createMarketRateLimitHook>;
  proposalSubmission: ReturnType<typeof createMarketRateLimitHook>;
  searchQueries: ReturnType<typeof createMarketRateLimitHook>;
  profileUpdates: ReturnType<typeof createMarketRateLimitHook>;
  reviews: ReturnType<typeof createMarketRateLimitHook>;
  messaging: ReturnType<typeof createMarketRateLimitHook>;
  serviceCreation: ReturnType<typeof createMarketRateLimitHook>;
  payments: ReturnType<typeof createMarketRateLimitHook>;
  smartMatch: ReturnType<typeof createMarketRateLimitHook>;
  global: ReturnType<typeof createMarketRateLimitHook>;
}

/**
 * Create all rate limit hooks for marketplace endpoints
 */
export function createMarketRateLimitHooks(limiter: RateLimiter): MarketRateLimitHooks {
  return {
    jobPosting: createMarketRateLimitHook('jobPosting', limiter),
    proposalSubmission: createMarketRateLimitHook('proposalSubmission', limiter),
    searchQueries: createMarketRateLimitHook('searchQueries', limiter),
    profileUpdates: createMarketRateLimitHook('profileUpdates', limiter),
    reviews: createMarketRateLimitHook('reviews', limiter),
    messaging: createMarketRateLimitHook('messaging', limiter),
    serviceCreation: createMarketRateLimitHook('serviceCreation', limiter),
    payments: createMarketRateLimitHook('payments', limiter),
    smartMatch: createMarketRateLimitHook('smartMatch', limiter),
    global: createMarketRateLimitHook('global', limiter),
  };
}

// =============================================================================
// COMBINED RATE LIMITER
// =============================================================================

/**
 * Create a combined rate limiter that checks both per-endpoint and global limits
 * This ensures that even if endpoint limits are high, global limits are respected
 */
export function createCombinedRateLimitHook(
  endpointType: MarketRateLimitType,
  limiter: RateLimiter
) {
  const endpointHook = createMarketRateLimitHook(endpointType, limiter);
  const globalHook = createMarketRateLimitHook('global', limiter);

  return async function combinedRateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Check global limit first
    await globalHook(request, reply);
    // Then check endpoint-specific limit
    await endpointHook(request, reply);
  };
}
