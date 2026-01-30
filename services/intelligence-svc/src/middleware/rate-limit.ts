/**
 * @module @skillancer/intelligence-svc/middleware/rate-limit
 * Rate limiting middleware for ML/recommendation endpoints
 *
 * Implements endpoint-specific rate limits to prevent abuse of expensive ML operations:
 * - ML predictions: 100 req/min per user (standard ML operations)
 * - Recommendations: 60 req/min per user (recommendation engine)
 * - Talent matching: 30 req/min per user (expensive matching algorithms)
 * - Batch operations: 10 req/hour per user (very expensive bulk processing)
 * - Risk analysis: 50 req/min per user (analytics operations)
 * - Global: 500 req/min per user (fallback)
 */

import type { RateLimiter, RateLimitConfig, RateLimitResult } from '@skillancer/cache';
import type { FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

export type IntelligenceRateLimitType =
  | 'mlPredictions'
  | 'recommendations'
  | 'talentMatching'
  | 'batchOperations'
  | 'riskAnalysis'
  | 'outcomeRecording'
  | 'global';

// =============================================================================
// RATE LIMIT CONFIGS
// =============================================================================

/**
 * Intelligence-specific rate limit configurations
 *
 * These limits are designed to:
 * 1. Protect expensive ML inference operations
 * 2. Prevent abuse of recommendation engines
 * 3. Ensure fair access to talent matching
 * 4. Limit batch operations that consume significant resources
 */
export const IntelligenceRateLimitConfigs: Record<IntelligenceRateLimitType, RateLimitConfig> = {
  /**
   * ML predictions - Standard ML inference
   * 100 requests per minute per user/API key
   */
  mlPredictions: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },

  /**
   * Recommendations - Recommendation engine
   * 60 requests per minute per user/API key
   */
  recommendations: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },

  /**
   * Talent matching - Expensive matching algorithms
   * 30 requests per minute per user/API key
   */
  talentMatching: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },

  /**
   * Batch operations - Bulk processing
   * 10 requests per hour per user/API key (very expensive)
   */
  batchOperations: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },

  /**
   * Risk analysis - Analytics and risk assessment
   * 50 requests per minute per user/API key
   */
  riskAnalysis: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
  },

  /**
   * Outcome recording - Recording ML outcomes
   * 200 requests per minute per user/API key
   */
  outcomeRecording: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
  },

  /**
   * Global fallback - All other endpoints
   * 500 requests per minute per user/API key
   */
  global: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 500,
  },
};

// =============================================================================
// API KEY TIER MULTIPLIERS
// =============================================================================

/**
 * API key tier multipliers for rate limits
 * Different tiers get different limits based on subscription
 */
export const ApiKeyTierMultipliers: Record<string, number> = {
  STARTER: 1,
  PROFESSIONAL: 2,
  ENTERPRISE: 5,
};

/**
 * User tier multipliers for internal calls (non-API key)
 */
export const UserTierMultipliers: Record<string, number> = {
  FREE: 0.5,
  STARTER: 1,
  PROFESSIONAL: 1.5,
  ENTERPRISE: 3,
};

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Rate limit exceeded error for intelligence endpoints
 */
export class IntelligenceRateLimitExceededError extends Error {
  statusCode = 429;
  retryAfter?: number;
  endpoint: IntelligenceRateLimitType;
  identifier?: string;
  identifierType?: 'apiKey' | 'user' | 'ip';

  constructor(
    endpoint: IntelligenceRateLimitType,
    retryAfter?: number,
    identifier?: string,
    identifierType?: 'apiKey' | 'user' | 'ip'
  ) {
    const message = `Rate limit exceeded for ${endpoint}. Please try again later.`;
    super(message);
    this.name = 'IntelligenceRateLimitExceededError';
    this.retryAfter = retryAfter;
    this.endpoint = endpoint;
    this.identifier = identifier;
    this.identifierType = identifierType;
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      error: 'Too Many Requests',
      message: this.message,
      code: 'INTELLIGENCE_RATE_LIMIT_EXCEEDED',
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
 * Get rate limit identifier - prioritizes API key, then user ID, then IP
 */
export function getRateLimitIdentifier(request: FastifyRequest): {
  identifier: string;
  type: 'apiKey' | 'user' | 'ip';
  tier: string;
} {
  // Check for API key context (from API key authentication)
  const apiKeyContext = (request as any).apiKeyContext;
  if (apiKeyContext?.keyId) {
    return {
      identifier: apiKeyContext.keyId,
      type: 'apiKey',
      tier: apiKeyContext.plan || 'STARTER',
    };
  }

  // Check for authenticated user (internal calls)
  const user = (request as any).user;
  if (user?.id) {
    return {
      identifier: user.id,
      type: 'user',
      tier: user.tier || 'PROFESSIONAL', // Default to PROFESSIONAL for internal users
    };
  }

  // Fall back to IP address
  return {
    identifier: getClientIp(request),
    type: 'ip',
    tier: 'STARTER', // Strictest limits for unauthenticated requests
  };
}

/**
 * Get rate limit key based on identifier and endpoint
 */
export function getRateLimitKey(
  identifier: string,
  identifierType: 'apiKey' | 'user' | 'ip',
  endpoint: IntelligenceRateLimitType
): string {
  return `intelligence:${endpoint}:${identifierType}:${identifier}`;
}

/**
 * Get adjusted rate limit config based on tier
 */
export function getAdjustedConfig(
  baseConfig: RateLimitConfig,
  tier: string,
  identifierType: 'apiKey' | 'user' | 'ip'
): RateLimitConfig {
  // Use appropriate multiplier based on identifier type
  const multipliers = identifierType === 'apiKey' ? ApiKeyTierMultipliers : UserTierMultipliers;
  const multiplier = multipliers[tier] || 1;

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
 */
export function logRateLimitViolation(
  request: FastifyRequest,
  endpoint: IntelligenceRateLimitType,
  result: RateLimitResult,
  identifier: string,
  identifierType: 'apiKey' | 'user' | 'ip'
): void {
  const logEntry = {
    level: 'warn',
    event: 'RATE_LIMIT_VIOLATION',
    service: 'intelligence-svc',
    endpoint,
    identifierType,
    identifier: identifierType === 'apiKey' ? `${identifier.substring(0, 8)}...` : identifier,
    ip: getClientIp(request),
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
 * Create a preHandler hook for rate limiting intelligence endpoints
 *
 * @param type - The type of endpoint being rate limited
 * @param limiter - The RateLimiter instance
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * // In route registration
 * fastify.post('/predictions', {
 *   preHandler: [fastify.authenticate, createIntelligenceRateLimitHook('mlPredictions', limiter)],
 * }, handler);
 * ```
 */
export function createIntelligenceRateLimitHook(
  type: IntelligenceRateLimitType,
  limiter: RateLimiter
) {
  const baseConfig = IntelligenceRateLimitConfigs[type];

  return async function intelligenceRateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { identifier, type: identifierType, tier } = getRateLimitIdentifier(request);
    const key = getRateLimitKey(identifier, identifierType, type);
    const config = getAdjustedConfig(baseConfig, tier, identifierType);

    const result = await limiter.consume(key, config);

    // Always set rate limit headers for visibility
    void reply.header('X-RateLimit-Limit', config.maxRequests);
    void reply.header('X-RateLimit-Remaining', result.remaining);
    void reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));
    void reply.header('X-RateLimit-Endpoint', type);
    void reply.header('X-RateLimit-Identifier-Type', identifierType);

    if (!result.allowed) {
      void reply.header('Retry-After', result.retryAfter);

      // Log violation for security monitoring
      logRateLimitViolation(request, type, result, identifier, identifierType);

      throw new IntelligenceRateLimitExceededError(
        type,
        result.retryAfter,
        identifier,
        identifierType
      );
    }
  };
}

// =============================================================================
// PRE-BUILT HOOKS (Lazily initialized in plugin)
// =============================================================================

/**
 * Hook factory for all intelligence endpoints
 * These are created when the rate limit plugin is registered
 */
export interface IntelligenceRateLimitHooks {
  mlPredictions: ReturnType<typeof createIntelligenceRateLimitHook>;
  recommendations: ReturnType<typeof createIntelligenceRateLimitHook>;
  talentMatching: ReturnType<typeof createIntelligenceRateLimitHook>;
  batchOperations: ReturnType<typeof createIntelligenceRateLimitHook>;
  riskAnalysis: ReturnType<typeof createIntelligenceRateLimitHook>;
  outcomeRecording: ReturnType<typeof createIntelligenceRateLimitHook>;
  global: ReturnType<typeof createIntelligenceRateLimitHook>;
}

/**
 * Create all rate limit hooks for intelligence endpoints
 */
export function createIntelligenceRateLimitHooks(limiter: RateLimiter): IntelligenceRateLimitHooks {
  return {
    mlPredictions: createIntelligenceRateLimitHook('mlPredictions', limiter),
    recommendations: createIntelligenceRateLimitHook('recommendations', limiter),
    talentMatching: createIntelligenceRateLimitHook('talentMatching', limiter),
    batchOperations: createIntelligenceRateLimitHook('batchOperations', limiter),
    riskAnalysis: createIntelligenceRateLimitHook('riskAnalysis', limiter),
    outcomeRecording: createIntelligenceRateLimitHook('outcomeRecording', limiter),
    global: createIntelligenceRateLimitHook('global', limiter),
  };
}

// =============================================================================
// COMBINED RATE LIMITER
// =============================================================================

/**
 * Create a combined rate limiter that checks both per-endpoint and global limits
 */
export function createCombinedRateLimitHook(
  endpointType: IntelligenceRateLimitType,
  limiter: RateLimiter
) {
  const endpointHook = createIntelligenceRateLimitHook(endpointType, limiter);
  const globalHook = createIntelligenceRateLimitHook('global', limiter);

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
