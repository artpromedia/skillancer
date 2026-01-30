// @ts-nocheck
/**
 * @module @skillancer/copilot-svc/middleware/rate-limit
 * Rate limiting middleware for AI Copilot endpoints
 *
 * Implements endpoint-specific rate limits to prevent abuse of expensive AI operations:
 * - AI generation (proposals): 10 req/min per user
 * - Code completion: 30 req/min per user
 * - Chat/assist: 20 req/min per user
 * - Analysis (market insights): 5 req/min per user
 */

import { RateLimiter, type RateLimitConfig, type RateLimitResult } from '@skillancer/cache';

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '../plugins/auth.js';

// =============================================================================
// TYPES
// =============================================================================

export type CopilotRateLimitType =
  | 'aiGeneration'
  | 'codeCompletion'
  | 'chatAssist'
  | 'analysis'
  | 'profileOptimize'
  | 'rateSuggest';

// =============================================================================
// RATE LIMIT CONFIGS
// =============================================================================

/**
 * Copilot-specific rate limit configurations
 *
 * These limits are designed to:
 * 1. Protect expensive AI model calls
 * 2. Ensure fair usage across users
 * 3. Support tiered limits for different subscription levels
 */
export const CopilotRateLimitConfigs: Record<CopilotRateLimitType, RateLimitConfig> = {
  /**
   * AI generation (proposals, drafts) - Most expensive operations
   * 10 requests per minute per user
   */
  aiGeneration: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },

  /**
   * Code completion - High frequency but lighter operations
   * 30 requests per minute per user
   */
  codeCompletion: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },

  /**
   * Chat/message assist - Moderate operations
   * 20 requests per minute per user
   */
  chatAssist: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },

  /**
   * Analysis (market insights) - Heavy computation
   * 5 requests per minute per user
   */
  analysis: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },

  /**
   * Profile optimization - AI-powered profile analysis
   * 10 requests per minute per user
   */
  profileOptimize: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },

  /**
   * Rate suggestion - Quick AI analysis
   * 15 requests per minute per user
   */
  rateSuggest: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 15,
  },
};

/**
 * Tier-based rate limit multipliers
 * Free users get base limits, Pro gets 2x, Enterprise gets 5x
 */
export const TierMultipliers: Record<string, number> = {
  FREE: 1,
  PRO: 2,
  ENTERPRISE: 5,
};

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Rate limit exceeded error for AI endpoints
 */
export class CopilotRateLimitExceededError extends Error {
  statusCode = 429;
  retryAfter?: number;
  endpoint: CopilotRateLimitType;

  constructor(endpoint: CopilotRateLimitType, retryAfter?: number) {
    const message = `Rate limit exceeded for ${endpoint}. Please try again later.`;
    super(message);
    this.name = 'CopilotRateLimitExceededError';
    this.retryAfter = retryAfter;
    this.endpoint = endpoint;
  }
}

// =============================================================================
// RATE LIMIT HELPERS
// =============================================================================

/**
 * Get client IP from request
 */
export function getClientIp(request: FastifyRequest): string {
  // Check forwarded headers first (for proxies/load balancers)
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
 * Get rate limit key based on user ID (preferred) or IP (fallback)
 */
export function getRateLimitKey(request: FastifyRequest, endpoint: CopilotRateLimitType): string {
  const user = request.user as AuthenticatedUser | undefined;

  if (user?.userId) {
    return `copilot:${endpoint}:user:${user.userId}`;
  }

  // Fallback to IP for unauthenticated endpoints (like market insights)
  return `copilot:${endpoint}:ip:${getClientIp(request)}`;
}

/**
 * Get user's subscription tier for rate limit multiplier
 * TODO(Sprint-10): Connect to billing service for real tier data
 */
export function getUserTier(_request: FastifyRequest): string {
  // For now, return FREE tier
  // In production, this would query the user's subscription status
  return 'FREE';
}

/**
 * Get adjusted rate limit config based on user tier
 */
export function getAdjustedConfig(baseConfig: RateLimitConfig, tier: string): RateLimitConfig {
  const multiplier = TierMultipliers[tier] || 1;
  return {
    windowMs: baseConfig.windowMs,
    maxRequests: baseConfig.maxRequests * multiplier,
  };
}

// =============================================================================
// RATE LIMIT HOOK FACTORY
// =============================================================================

/**
 * Create a preHandler hook for rate limiting copilot endpoints
 *
 * @param type - The type of endpoint being rate limited
 * @param limiter - The RateLimiter instance
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * // In route registration
 * fastify.post('/proposals/draft', {
 *   preHandler: [requireAuth, createCopilotRateLimitHook('aiGeneration', limiter)],
 * }, handler);
 * ```
 */
export function createCopilotRateLimitHook(type: CopilotRateLimitType, limiter: RateLimiter) {
  const baseConfig = CopilotRateLimitConfigs[type];

  return async function copilotRateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const key = getRateLimitKey(request, type);
    const tier = getUserTier(request);
    const config = getAdjustedConfig(baseConfig, tier);

    const result = await limiter.consume(key, config);

    // Always set rate limit headers for visibility
    void reply.header('X-RateLimit-Limit', config.maxRequests);
    void reply.header('X-RateLimit-Remaining', result.remaining);
    void reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));
    void reply.header('X-RateLimit-Endpoint', type);

    if (!result.allowed) {
      void reply.header('Retry-After', result.retryAfter);
      throw new CopilotRateLimitExceededError(type, result.retryAfter);
    }
  };
}

// =============================================================================
// PRE-BUILT HOOKS (Lazily initialized in plugin)
// =============================================================================

/**
 * Hook factory for all copilot endpoints
 * These are created when the rate limit plugin is registered
 */
export interface CopilotRateLimitHooks {
  aiGeneration: ReturnType<typeof createCopilotRateLimitHook>;
  codeCompletion: ReturnType<typeof createCopilotRateLimitHook>;
  chatAssist: ReturnType<typeof createCopilotRateLimitHook>;
  analysis: ReturnType<typeof createCopilotRateLimitHook>;
  profileOptimize: ReturnType<typeof createCopilotRateLimitHook>;
  rateSuggest: ReturnType<typeof createCopilotRateLimitHook>;
}

/**
 * Create all rate limit hooks for copilot endpoints
 */
export function createCopilotRateLimitHooks(limiter: RateLimiter): CopilotRateLimitHooks {
  return {
    aiGeneration: createCopilotRateLimitHook('aiGeneration', limiter),
    codeCompletion: createCopilotRateLimitHook('codeCompletion', limiter),
    chatAssist: createCopilotRateLimitHook('chatAssist', limiter),
    analysis: createCopilotRateLimitHook('analysis', limiter),
    profileOptimize: createCopilotRateLimitHook('profileOptimize', limiter),
    rateSuggest: createCopilotRateLimitHook('rateSuggest', limiter),
  };
}
