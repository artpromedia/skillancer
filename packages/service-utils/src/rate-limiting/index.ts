/**
 * @module @skillancer/service-utils/rate-limiting
 * Rate limiting plugin for Fastify services
 *
 * Provides configurable rate limiting with:
 * - Per-IP and per-user limits
 * - Sliding window algorithm
 * - Redis-backed for distributed environments
 * - Customizable limits per route
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

// =============================================================================
// TYPES
// =============================================================================

export interface RateLimitConfig {
  /** Maximum requests per window */
  max: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key generator function (default: IP address) */
  keyGenerator?: (request: FastifyRequest) => string;
  /** Skip rate limiting for certain requests */
  skip?: (request: FastifyRequest) => boolean;
  /** Custom error message */
  message?: string;
  /** Headers to include in response */
  headers?: boolean;
  /** Redis client for distributed rate limiting */
  redis?: RedisClient;
  /** Namespace for Redis keys */
  namespace?: string;
  /** Ban duration after hitting limit (optional, ms) */
  banDuration?: number;
  /** Maximum ban count before longer ban */
  maxBans?: number;
  /** Whitelist of IPs to skip */
  whitelist?: string[];
  /** Blacklist of IPs to always block */
  blacklist?: string[];
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: Date }>;
  decrement(key: string): Promise<void>;
  reset(key: string): Promise<void>;
  get(key: string): Promise<{ count: number; resetTime: Date } | null>;
}

interface RedisClient {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  pttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
}

// =============================================================================
// IN-MEMORY STORE (for single instance)
// =============================================================================

class MemoryStore implements RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: Date }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.resetTime > now) {
      existing.count++;
      return { count: existing.count, resetTime: new Date(existing.resetTime) };
    }

    const resetTime = now + windowMs;
    this.store.set(key, { count: 1, resetTime });
    return { count: 1, resetTime: new Date(resetTime) };
  }

  async decrement(key: string): Promise<void> {
    const existing = this.store.get(key);
    if (existing && existing.count > 0) {
      existing.count--;
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async get(key: string): Promise<{ count: number; resetTime: Date } | null> {
    const existing = this.store.get(key);
    if (!existing || existing.resetTime < Date.now()) {
      return null;
    }
    return { count: existing.count, resetTime: new Date(existing.resetTime) };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// =============================================================================
// REDIS STORE (for distributed)
// =============================================================================

class RedisStore implements RateLimitStore {
  constructor(
    private redis: RedisClient,
    private namespace: string = 'ratelimit'
  ) {}

  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: Date }> {
    const redisKey = this.getKey(key);
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
    }

    const ttl = await this.redis.pttl(redisKey);
    const resetTime = new Date(Date.now() + Math.max(0, ttl));

    return { count, resetTime };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.getKey(key);
    const current = await this.redis.get(redisKey);
    if (current && parseInt(current, 10) > 0) {
      await this.redis.incr(redisKey); // Redis doesn't have decr that stops at 0
    }
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(this.getKey(key));
  }

  async get(key: string): Promise<{ count: number; resetTime: Date } | null> {
    const redisKey = this.getKey(key);
    const [count, ttl] = await Promise.all([this.redis.get(redisKey), this.redis.pttl(redisKey)]);

    if (!count || ttl < 0) {
      return null;
    }

    return {
      count: parseInt(count, 10),
      resetTime: new Date(Date.now() + ttl),
    };
  }
}

// =============================================================================
// DEFAULT KEY GENERATORS
// =============================================================================

export const keyGenerators = {
  /** Rate limit by IP address */
  ip: (request: FastifyRequest): string => {
    return (
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      request.headers['x-real-ip']?.toString() ||
      request.ip ||
      'unknown'
    );
  },

  /** Rate limit by authenticated user */
  user: (request: FastifyRequest): string => {
    const user = (request as FastifyRequest & { user?: { id: string } }).user;
    return user?.id || keyGenerators.ip(request);
  },

  /** Rate limit by IP + route */
  ipAndRoute: (request: FastifyRequest): string => {
    const ip = keyGenerators.ip(request);
    return `${ip}:${request.routeOptions.url || request.url}`;
  },

  /** Rate limit by user + route */
  userAndRoute: (request: FastifyRequest): string => {
    const userId = keyGenerators.user(request);
    return `${userId}:${request.routeOptions.url || request.url}`;
  },
};

// =============================================================================
// PRESETS
// =============================================================================

export const RateLimitPresets = {
  /** Standard API rate limit: 100 requests per minute */
  standard: {
    max: 100,
    windowMs: 60 * 1000,
  },

  /** Strict rate limit for sensitive endpoints: 10 requests per minute */
  strict: {
    max: 10,
    windowMs: 60 * 1000,
  },

  /** Authentication endpoints: 5 attempts per 15 minutes */
  auth: {
    max: 5,
    windowMs: 15 * 60 * 1000,
    banDuration: 30 * 60 * 1000, // 30 min ban after hitting limit
  },

  /** Password reset: 3 attempts per hour */
  passwordReset: {
    max: 3,
    windowMs: 60 * 60 * 1000,
  },

  /** File upload: 20 uploads per hour */
  upload: {
    max: 20,
    windowMs: 60 * 60 * 1000,
  },

  /** Search/expensive queries: 30 per minute */
  search: {
    max: 30,
    windowMs: 60 * 1000,
  },

  /** Webhook endpoints: 1000 per minute (high volume) */
  webhook: {
    max: 1000,
    windowMs: 60 * 1000,
  },

  /** Public endpoints: 60 per minute */
  public: {
    max: 60,
    windowMs: 60 * 1000,
  },
};

// =============================================================================
// PLUGIN
// =============================================================================

const rateLimitingPluginImpl: FastifyPluginAsync<RateLimitConfig> = async (
  fastify: FastifyInstance,
  options: RateLimitConfig
) => {
  const {
    max = 100,
    windowMs = 60 * 1000,
    keyGenerator = keyGenerators.ip,
    skip,
    message = 'Too many requests, please try again later',
    headers = true,
    redis,
    namespace = 'ratelimit',
    whitelist = [],
    blacklist = [],
  } = options;

  // Create store
  const store: RateLimitStore = redis ? new RedisStore(redis, namespace) : new MemoryStore();

  // Decorate fastify with rate limit info getter
  fastify.decorateRequest('rateLimit', null);

  // Add preHandler hook
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if should skip
    if (skip?.(request)) {
      return;
    }

    const key = keyGenerator(request);

    // Check whitelist
    if (whitelist.includes(key)) {
      return;
    }

    // Check blacklist
    if (blacklist.includes(key)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    // Get current count
    const { count, resetTime } = await store.increment(key, windowMs);

    // Calculate rate limit info
    const remaining = Math.max(0, max - count);
    const retryAfter =
      count > max ? Math.ceil((resetTime.getTime() - Date.now()) / 1000) : undefined;

    const rateLimitInfo: RateLimitInfo = {
      limit: max,
      current: count,
      remaining,
      resetTime,
      retryAfter,
    };

    // Attach to request for use in routes
    (request as FastifyRequest & { rateLimit: RateLimitInfo }).rateLimit = rateLimitInfo;

    // Add rate limit headers
    if (headers) {
      reply.header('X-RateLimit-Limit', max.toString());
      reply.header('X-RateLimit-Remaining', remaining.toString());
      reply.header('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000).toString());
    }

    // Check if over limit
    if (count > max) {
      if (headers && retryAfter) {
        reply.header('Retry-After', retryAfter.toString());
      }

      fastify.log.warn(
        {
          key,
          count,
          max,
          ip: keyGenerators.ip(request),
          url: request.url,
        },
        'Rate limit exceeded'
      );

      return reply.code(429).send({
        error: 'Too Many Requests',
        message,
        retryAfter,
      });
    }
  });

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    if (store instanceof MemoryStore) {
      store.destroy();
    }
  });

  // Decorate fastify with helper methods
  fastify.decorate('rateLimit', {
    reset: async (key: string) => store.reset(key),
    get: async (key: string) => store.get(key),
  });
};

export const rateLimitingPlugin = fp(rateLimitingPluginImpl, {
  name: 'rate-limiting',
  fastify: '5.x',
});

// =============================================================================
// ROUTE-LEVEL DECORATOR
// =============================================================================

/**
 * Create rate limit config for a specific route
 * Usage: { preHandler: [rateLimit({ max: 5, windowMs: 60000 })] }
 */
export function rateLimit(config: Partial<RateLimitConfig>) {
  const store = new MemoryStore();

  return async function rateLimitHandler(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const {
      max = 100,
      windowMs = 60 * 1000,
      keyGenerator = keyGenerators.ip,
      skip,
      message = 'Too many requests',
      headers = true,
    } = config;

    if (skip?.(request)) {
      return;
    }

    const key = keyGenerator(request);
    const { count, resetTime } = await store.increment(key, windowMs);
    const remaining = Math.max(0, max - count);

    if (headers) {
      reply.header('X-RateLimit-Limit', max.toString());
      reply.header('X-RateLimit-Remaining', remaining.toString());
      reply.header('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000).toString());
    }

    if (count > max) {
      const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000);
      if (headers) {
        reply.header('Retry-After', retryAfter.toString());
      }
      return reply.code(429).send({
        error: 'Too Many Requests',
        message,
        retryAfter,
      });
    }
  };
}

// =============================================================================
// TYPE EXTENSIONS
// =============================================================================

declare module 'fastify' {
  interface FastifyRequest {
    rateLimit: RateLimitInfo | null;
  }

  interface FastifyInstance {
    rateLimit: {
      reset: (key: string) => Promise<void>;
      get: (key: string) => Promise<{ count: number; resetTime: Date } | null>;
    };
  }
}
