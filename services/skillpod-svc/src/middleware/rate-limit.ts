// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/middleware/rate-limit
 * Rate limiting middleware for VDI and session management endpoints
 *
 * Implements endpoint-specific rate limits to prevent abuse of expensive VDI operations:
 * - VDI creation: 5 req/hour per user (expensive container spawning)
 * - VDI operations: 30 req/min per user (pause, resume, terminate, restart)
 * - Session recording access: 20 req/min per user
 * - File operations: 100 req/min per user (clipboard, file transfer)
 * - Terminal commands: 200 req/min per user (WebSocket messages)
 * - Global: 1000 req/min per user (fallback)
 */

import { RateLimiter, type RateLimitConfig, type RateLimitResult } from '@skillancer/cache';

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '../plugins/auth.js';

// =============================================================================
// TYPES
// =============================================================================

export type SkillpodRateLimitType =
  | 'vdiCreation'
  | 'vdiOperations'
  | 'sessionRecording'
  | 'fileOperations'
  | 'terminalCommands'
  | 'policyManagement'
  | 'global';

// =============================================================================
// RATE LIMIT CONFIGS
// =============================================================================

/**
 * Skillpod-specific rate limit configurations
 *
 * These limits are designed to:
 * 1. Prevent spawning too many containers (expensive)
 * 2. Protect session recording storage and bandwidth
 * 3. Ensure fair usage of VDI resources
 * 4. Prevent DoS via terminal command flooding
 */
export const SkillpodRateLimitConfigs: Record<SkillpodRateLimitType, RateLimitConfig> = {
  /**
   * VDI creation - Most expensive operation (container spawning)
   * 5 requests per hour per user
   */
  vdiCreation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  },

  /**
   * VDI operations - Pod lifecycle management
   * 30 requests per minute per user
   */
  vdiOperations: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },

  /**
   * Session recording access - Bandwidth-intensive
   * 20 requests per minute per user
   */
  sessionRecording: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },

  /**
   * File operations - Clipboard, file transfer, etc.
   * 100 requests per minute per user
   */
  fileOperations: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },

  /**
   * Terminal commands - High frequency but monitored
   * 200 requests per minute per user
   */
  terminalCommands: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
  },

  /**
   * Policy management - Admin operations
   * 50 requests per minute per user
   */
  policyManagement: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
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

/**
 * Tenant tier multipliers for rate limits
 * Enterprise tenants get higher limits
 */
export const TenantTierMultipliers: Record<string, number> = {
  FREE: 1,
  STARTER: 1.5,
  PROFESSIONAL: 2,
  ENTERPRISE: 5,
};

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Rate limit exceeded error for VDI endpoints
 */
export class SkillpodRateLimitExceededError extends Error {
  statusCode = 429;
  retryAfter?: number;
  endpoint: SkillpodRateLimitType;
  userId?: string;
  tenantId?: string;

  constructor(
    endpoint: SkillpodRateLimitType,
    retryAfter?: number,
    userId?: string,
    tenantId?: string
  ) {
    const message = `Rate limit exceeded for ${endpoint}. Please try again later.`;
    super(message);
    this.name = 'SkillpodRateLimitExceededError';
    this.retryAfter = retryAfter;
    this.endpoint = endpoint;
    this.userId = userId;
    this.tenantId = tenantId;
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      error: 'Too Many Requests',
      message: this.message,
      code: 'SKILLPOD_RATE_LIMIT_EXCEEDED',
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
 * For VDI creation, also includes resource type to prevent abuse
 */
export function getRateLimitKey(
  request: FastifyRequest,
  endpoint: SkillpodRateLimitType,
  resourceType?: string
): string {
  const user = request.user as AuthenticatedUser | undefined;

  const baseKey = user?.userId
    ? `skillpod:${endpoint}:user:${user.userId}`
    : `skillpod:${endpoint}:ip:${getClientIp(request)}`;

  // For VDI operations, include resource type to prevent abuse across different resource types
  if (resourceType && (endpoint === 'vdiCreation' || endpoint === 'vdiOperations')) {
    return `${baseKey}:resource:${resourceType}`;
  }

  return baseKey;
}

/**
 * Get tenant's subscription tier for rate limit multiplier
 * TODO(Sprint-10): Connect to billing service for real tier data
 */
export function getTenantTier(_request: FastifyRequest): string {
  // For now, return PROFESSIONAL tier as default
  // In production, this would query the tenant's subscription status
  return 'PROFESSIONAL';
}

/**
 * Get adjusted rate limit config based on tenant tier
 */
export function getAdjustedConfig(
  baseConfig: RateLimitConfig,
  tier: string
): RateLimitConfig {
  const multiplier = TenantTierMultipliers[tier] || 1;
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
  endpoint: SkillpodRateLimitType,
  result: RateLimitResult,
  resourceType?: string
): void {
  const user = request.user as AuthenticatedUser | undefined;
  const ip = getClientIp(request);

  const logEntry = {
    level: 'warn',
    event: 'RATE_LIMIT_VIOLATION',
    service: 'skillpod-svc',
    endpoint,
    resourceType,
    userId: user?.userId,
    tenantId: user?.tenantId,
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
 * Create a preHandler hook for rate limiting skillpod endpoints
 *
 * @param type - The type of endpoint being rate limited
 * @param limiter - The RateLimiter instance
 * @param resourceType - Optional resource type for VDI-specific rate limiting
 * @returns Fastify preHandler hook
 *
 * @example
 * ```typescript
 * // In route registration
 * fastify.post('/pods', {
 *   preHandler: [requireAuth, createSkillpodRateLimitHook('vdiCreation', limiter)],
 * }, handler);
 * ```
 */
export function createSkillpodRateLimitHook(
  type: SkillpodRateLimitType,
  limiter: RateLimiter,
  resourceType?: string
) {
  const baseConfig = SkillpodRateLimitConfigs[type];

  return async function skillpodRateLimitHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const key = getRateLimitKey(request, type, resourceType);
    const tier = getTenantTier(request);
    const config = getAdjustedConfig(baseConfig, tier);

    const result = await limiter.consume(key, config);

    // Always set rate limit headers for visibility
    void reply.header('X-RateLimit-Limit', config.maxRequests);
    void reply.header('X-RateLimit-Remaining', result.remaining);
    void reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));
    void reply.header('X-RateLimit-Endpoint', type);
    if (resourceType) {
      void reply.header('X-RateLimit-Resource', resourceType);
    }

    if (!result.allowed) {
      void reply.header('Retry-After', result.retryAfter);

      // Log violation for security monitoring
      logRateLimitViolation(request, type, result, resourceType);

      const user = request.user as AuthenticatedUser | undefined;
      throw new SkillpodRateLimitExceededError(
        type,
        result.retryAfter,
        user?.userId,
        user?.tenantId
      );
    }
  };
}

// =============================================================================
// PRE-BUILT HOOKS (Lazily initialized in plugin)
// =============================================================================

/**
 * Hook factory for all skillpod endpoints
 * These are created when the rate limit plugin is registered
 */
export interface SkillpodRateLimitHooks {
  vdiCreation: ReturnType<typeof createSkillpodRateLimitHook>;
  vdiOperations: ReturnType<typeof createSkillpodRateLimitHook>;
  sessionRecording: ReturnType<typeof createSkillpodRateLimitHook>;
  fileOperations: ReturnType<typeof createSkillpodRateLimitHook>;
  terminalCommands: ReturnType<typeof createSkillpodRateLimitHook>;
  policyManagement: ReturnType<typeof createSkillpodRateLimitHook>;
  global: ReturnType<typeof createSkillpodRateLimitHook>;
}

/**
 * Create all rate limit hooks for skillpod endpoints
 */
export function createSkillpodRateLimitHooks(limiter: RateLimiter): SkillpodRateLimitHooks {
  return {
    vdiCreation: createSkillpodRateLimitHook('vdiCreation', limiter),
    vdiOperations: createSkillpodRateLimitHook('vdiOperations', limiter),
    sessionRecording: createSkillpodRateLimitHook('sessionRecording', limiter),
    fileOperations: createSkillpodRateLimitHook('fileOperations', limiter),
    terminalCommands: createSkillpodRateLimitHook('terminalCommands', limiter),
    policyManagement: createSkillpodRateLimitHook('policyManagement', limiter),
    global: createSkillpodRateLimitHook('global', limiter),
  };
}

// =============================================================================
// COMBINED VDI RATE LIMITER
// =============================================================================

/**
 * Create a combined rate limiter that checks both per-endpoint and global limits
 * This ensures that even if endpoint limits are high, global limits are respected
 */
export function createCombinedRateLimitHook(
  endpointType: SkillpodRateLimitType,
  limiter: RateLimiter,
  resourceType?: string
) {
  const endpointHook = createSkillpodRateLimitHook(endpointType, limiter, resourceType);
  const globalHook = createSkillpodRateLimitHook('global', limiter);

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
