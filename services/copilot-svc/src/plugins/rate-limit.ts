// @ts-nocheck
/**
 * @module @skillancer/copilot-svc/plugins/rate-limit
 * Rate limiting plugin for AI Copilot service
 *
 * Provides Redis-based distributed rate limiting with in-memory fallback
 * for development environments.
 */

import { RateLimiter } from '@skillancer/cache';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

import {
  createCopilotRateLimitHooks,
  CopilotRateLimitExceededError,
  type CopilotRateLimitHooks,
} from '../middleware/rate-limit.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// =============================================================================
// TYPE AUGMENTATION
// =============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Rate limit hooks for copilot endpoints
     */
    copilotRateLimit: CopilotRateLimitHooks;

    /**
     * Check rate limit without consuming (for status checks)
     */
    checkCopilotRateLimit: (
      request: FastifyRequest,
      endpoint: keyof CopilotRateLimitHooks
    ) => Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;
  }
}

// =============================================================================
// REDIS CLIENT FACTORY
// =============================================================================

/**
 * Create Redis client for distributed rate limiting
 *
 * Falls back gracefully if Redis is unavailable
 */
function createRedisClient(redisUrl: string | undefined): Redis | null {
  if (!redisUrl) {
    console.warn('[CopilotRateLimit] REDIS_URL not configured, using in-memory rate limiting');
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          // Stop retrying after 3 attempts
          console.warn('[CopilotRateLimit] Redis connection failed, falling back to in-memory');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
      // Connection timeout
      connectTimeout: 5000,
    });

    client.on('error', (err) => {
      console.warn('[CopilotRateLimit] Redis error:', err.message);
    });

    client.on('connect', () => {
      console.log('[CopilotRateLimit] Redis connected for distributed rate limiting');
    });

    return client;
  } catch (error) {
    console.warn('[CopilotRateLimit] Failed to create Redis client:', error);
    return null;
  }
}

/**
 * Create in-memory Redis-like store for development
 * Uses a simple Map with TTL support
 */
function createInMemoryStore(): Redis {
  const store = new Map<string, { value: string; expireAt?: number }>();

  // Create a mock Redis client that works with RateLimiter
  const mockRedis = {
    // Basic operations
    get: async (key: string): Promise<string | null> => {
      const item = store.get(key);
      if (!item) return null;
      if (item.expireAt && Date.now() > item.expireAt) {
        store.delete(key);
        return null;
      }
      return item.value;
    },

    set: async (key: string, value: string, ...args: any[]): Promise<'OK'> => {
      let expireAt: number | undefined;
      // Handle EX (seconds) or PX (milliseconds) options
      for (let i = 0; i < args.length; i += 2) {
        if (args[i] === 'EX' && args[i + 1]) {
          expireAt = Date.now() + args[i + 1] * 1000;
        } else if (args[i] === 'PX' && args[i + 1]) {
          expireAt = Date.now() + args[i + 1];
        }
      }
      store.set(key, { value, expireAt });
      return 'OK';
    },

    del: async (key: string): Promise<number> => {
      return store.delete(key) ? 1 : 0;
    },

    // Sorted set operations (used by sliding window algorithm)
    zadd: async (key: string, score: number, member: string): Promise<number> => {
      let zset = store.get(key)?.value;
      const data: Array<{ score: number; member: string }> = zset ? JSON.parse(zset) : [];
      data.push({ score, member });
      store.set(key, { value: JSON.stringify(data) });
      return 1;
    },

    zremrangebyscore: async (
      key: string,
      min: string | number,
      max: string | number
    ): Promise<number> => {
      let zset = store.get(key)?.value;
      if (!zset) return 0;
      const data: Array<{ score: number; member: string }> = JSON.parse(zset);
      const minNum = min === '-inf' ? -Infinity : Number(min);
      const maxNum = max === '+inf' ? Infinity : Number(max);
      const filtered = data.filter((item) => item.score < minNum || item.score > maxNum);
      store.set(key, { value: JSON.stringify(filtered) });
      return data.length - filtered.length;
    },

    zcard: async (key: string): Promise<number> => {
      let zset = store.get(key)?.value;
      if (!zset) return 0;
      const data: Array<{ score: number; member: string }> = JSON.parse(zset);
      return data.length;
    },

    pexpire: async (key: string, ms: number): Promise<number> => {
      const item = store.get(key);
      if (item) {
        item.expireAt = Date.now() + ms;
        return 1;
      }
      return 0;
    },

    // Eval for Lua scripts (simplified for rate limiter)
    eval: async (
      script: string,
      keyCount: number,
      key: string,
      ...args: string[]
    ): Promise<[number, number, number]> => {
      // Parse args from the rate limiter's Lua script
      const now = Number(args[0]);
      const windowStart = Number(args[1]);
      const windowMs = Number(args[2]);
      const maxRequests = Number(args[3]);
      const consume = args[4] === '1';

      // Get current sorted set
      let zset = store.get(key)?.value;
      let data: Array<{ score: number; member: string }> = zset ? JSON.parse(zset) : [];

      // Remove entries outside window
      data = data.filter((item) => item.score > windowStart);

      // Count current entries
      let current = data.length;

      // Check if allowed
      const allowed = current < maxRequests;

      // Add new entry if consuming and allowed
      if (consume && allowed) {
        const member = `${now}:${Math.random().toString(36).slice(2)}`;
        data.push({ score: now, member });
        current = data.length;
      }

      // Store updated data
      store.set(key, {
        value: JSON.stringify(data),
        expireAt: Date.now() + windowMs,
      });

      return [allowed ? 1 : 0, current, maxRequests - current];
    },
  } as unknown as Redis;

  return mockRedis;
}

// =============================================================================
// PLUGIN IMPLEMENTATION
// =============================================================================

async function rateLimitPluginImpl(app: FastifyInstance): Promise<void> {
  const redisUrl = process.env.REDIS_URL;

  // Try to connect to Redis, fall back to in-memory
  let redis: Redis;
  const redisClient = createRedisClient(redisUrl);

  if (redisClient) {
    try {
      await redisClient.connect();
      redis = redisClient;
      app.log.info('[CopilotRateLimit] Using Redis for distributed rate limiting');
    } catch (error) {
      app.log.warn('[CopilotRateLimit] Redis connection failed, using in-memory fallback');
      redis = createInMemoryStore();
    }
  } else {
    app.log.info('[CopilotRateLimit] Using in-memory rate limiting (development mode)');
    redis = createInMemoryStore();
  }

  // Create rate limiter instance
  const limiter = new RateLimiter(redis, 'copilot:ratelimit');

  // Create all rate limit hooks
  const hooks = createCopilotRateLimitHooks(limiter);

  // Decorate fastify with rate limit hooks
  app.decorate('copilotRateLimit', hooks);

  // Add helper to check rate limit without consuming
  app.decorate(
    'checkCopilotRateLimit',
    async (request: FastifyRequest, endpoint: keyof CopilotRateLimitHooks) => {
      const { CopilotRateLimitConfigs, getRateLimitKey, getUserTier, getAdjustedConfig } =
        await import('../middleware/rate-limit.js');

      const key = getRateLimitKey(request, endpoint);
      const tier = getUserTier(request);
      const config = getAdjustedConfig(CopilotRateLimitConfigs[endpoint], tier);

      const result = await limiter.check(key, config);

      return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetAt: result.resetAt,
      };
    }
  );

  // Global error handler for rate limit errors
  app.addHook('onError', async (request, reply, error) => {
    if (error instanceof CopilotRateLimitExceededError) {
      // Ensure proper response format
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: error.message,
        code: 'COPILOT_RATE_LIMIT_EXCEEDED',
        endpoint: error.endpoint,
        retryAfter: error.retryAfter,
      });
    }
  });

  // Cleanup on shutdown
  app.addHook('onClose', async () => {
    if (redisClient) {
      try {
        await redisClient.quit();
        app.log.info('[CopilotRateLimit] Redis connection closed');
      } catch (error) {
        app.log.warn('[CopilotRateLimit] Error closing Redis connection:', error);
      }
    }
  });
}

// =============================================================================
// EXPORT
// =============================================================================

export const rateLimitPlugin = fp(rateLimitPluginImpl, {
  name: 'copilot-rate-limit',
  dependencies: [],
});
