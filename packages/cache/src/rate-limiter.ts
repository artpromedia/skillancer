/**
 * @module @skillancer/cache/rate-limiter
 * Redis-based rate limiting with sliding window algorithm
 */

import type Redis from 'ioredis';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed in the window */
  maxRequests: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** When the rate limit resets */
  resetAt: Date;
  /** Total requests made in current window */
  current: number;
  /** Retry after (seconds) - only set if not allowed */
  retryAfter?: number;
}

export interface RateLimitInfo {
  /** Rate limit config */
  limit: number;
  /** Remaining requests */
  remaining: number;
  /** Reset time */
  resetAt: Date;
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Common rate limit configurations
 */
export const RateLimitPresets = {
  /** Standard API rate limit: 100 requests per minute */
  api: { windowMs: 60 * 1000, maxRequests: 100 },

  /** Authentication rate limit: 5 attempts per 15 minutes */
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },

  /** Password reset: 3 attempts per hour */
  passwordReset: { windowMs: 60 * 60 * 1000, maxRequests: 3 },

  /** Email sending: 10 per hour */
  email: { windowMs: 60 * 60 * 1000, maxRequests: 10 },

  /** File upload: 20 per minute */
  upload: { windowMs: 60 * 1000, maxRequests: 20 },

  /** Search: 30 per minute */
  search: { windowMs: 60 * 1000, maxRequests: 30 },

  /** Strict: 10 per minute */
  strict: { windowMs: 60 * 1000, maxRequests: 10 },

  /** Lenient: 1000 per minute */
  lenient: { windowMs: 60 * 1000, maxRequests: 1000 },
} as const;

// ============================================================================
// RATE LIMITER
// ============================================================================

/**
 * Redis-based rate limiter using sliding window algorithm
 *
 * Features:
 * - Sliding window rate limiting (more accurate than fixed windows)
 * - Multiple rate limit configs
 * - Check without consuming
 * - Manual reset
 * - Rate limit info headers
 *
 * @example
 * ```typescript
 * import { RateLimiter, RateLimitPresets } from '@skillancer/cache';
 * import { getRedisClient } from '@skillancer/cache';
 *
 * const limiter = new RateLimiter(getRedisClient());
 *
 * // Check and consume
 * const result = await limiter.consume('api:user:123', RateLimitPresets.api);
 * if (!result.allowed) {
 *   throw new TooManyRequestsError(result.retryAfter);
 * }
 *
 * // Just check without consuming
 * const info = await limiter.check('api:user:123', RateLimitPresets.api);
 * ```
 */
export class RateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string = 'ratelimit'
  ) {}

  /**
   * Check rate limit without consuming a request
   *
   * @param key - Rate limit key (e.g., 'api:user:123')
   * @param config - Rate limit configuration
   * @returns Rate limit result
   */
  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    return this.executeRateLimit(key, config, false);
  }

  /**
   * Check rate limit and consume a request
   *
   * @param key - Rate limit key (e.g., 'api:user:123')
   * @param config - Rate limit configuration
   * @returns Rate limit result
   */
  async consume(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    return this.executeRateLimit(key, config, true);
  }

  /**
   * Reset rate limit for a key
   *
   * @param key - Rate limit key
   */
  async reset(key: string): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.redis.del(fullKey);
  }

  /**
   * Get rate limit info for a key
   *
   * @param key - Rate limit key
   * @param config - Rate limit configuration
   * @returns Rate limit info
   */
  async getInfo(key: string, config: RateLimitConfig): Promise<RateLimitInfo> {
    const result = await this.check(key, config);
    return {
      limit: config.maxRequests,
      remaining: result.remaining,
      resetAt: result.resetAt,
    };
  }

  /**
   * Get rate limit headers for HTTP response
   *
   * @param key - Rate limit key
   * @param config - Rate limit configuration
   * @returns Headers object
   */
  async getHeaders(
    key: string,
    config: RateLimitConfig
  ): Promise<Record<string, string>> {
    const info = await this.getInfo(key, config);
    return {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(Math.max(0, info.remaining)),
      'X-RateLimit-Reset': String(Math.ceil(info.resetAt.getTime() / 1000)),
    };
  }

  /**
   * Execute rate limit check/consume using sliding window algorithm
   *
   * Uses a sorted set where:
   * - Members are unique request IDs (timestamps with random suffix)
   * - Scores are timestamps
   * - We remove old entries outside the window
   * - We count remaining entries
   */
  private async executeRateLimit(
    key: string,
    config: RateLimitConfig,
    consume: boolean
  ): Promise<RateLimitResult> {
    const fullKey = this.buildKey(key);
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const resetAt = new Date(now + config.windowMs);

    // Use Lua script for atomicity
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowStart = tonumber(ARGV[2])
      local windowMs = tonumber(ARGV[3])
      local maxRequests = tonumber(ARGV[4])
      local consume = ARGV[5] == '1'
      
      -- Remove old entries outside the window
      redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
      
      -- Count current entries
      local current = redis.call('ZCARD', key)
      
      -- Check if allowed
      local allowed = current < maxRequests
      
      -- Add new entry if consuming and allowed
      if consume and allowed then
        local member = now .. ':' .. math.random(1000000)
        redis.call('ZADD', key, now, member)
        current = current + 1
      end
      
      -- Set expiration
      redis.call('PEXPIRE', key, windowMs)
      
      return {allowed and 1 or 0, current, maxRequests - current}
    `;

    const result = (await this.redis.eval(
      script,
      1,
      fullKey,
      String(now),
      String(windowStart),
      String(config.windowMs),
      String(config.maxRequests),
      consume ? '1' : '0'
    )) as [number, number, number];

    const allowed = result[0] === 1;
    const current = result[1];
    const remaining = Math.max(0, result[2]);

    const rateLimitResult: RateLimitResult = {
      allowed,
      remaining,
      resetAt,
      current,
    };

    if (!allowed) {
      rateLimitResult.retryAfter = Math.ceil(config.windowMs / 1000);
    }

    return rateLimitResult;
  }

  /**
   * Build rate limit key
   */
  private buildKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
}

// ============================================================================
// RATE LIMIT MIDDLEWARE HELPERS
// ============================================================================

/**
 * Create a rate limit key for an IP address
 */
export function rateLimitKeyByIp(prefix: string, ip: string): string {
  return `${prefix}:ip:${ip}`;
}

/**
 * Create a rate limit key for a user
 */
export function rateLimitKeyByUser(prefix: string, userId: string): string {
  return `${prefix}:user:${userId}`;
}

/**
 * Create a rate limit key for a user and endpoint
 */
export function rateLimitKeyByUserEndpoint(
  prefix: string,
  userId: string,
  endpoint: string
): string {
  return `${prefix}:user:${userId}:${endpoint}`;
}

/**
 * Create a rate limit key for an API key
 */
export function rateLimitKeyByApiKey(prefix: string, apiKey: string): string {
  return `${prefix}:apikey:${apiKey}`;
}
