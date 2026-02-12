/**
 * @module @skillancer/intelligence-svc/plugins/rate-limit
 * Rate limiting plugin for Intelligence service
 *
 * Provides Redis-based distributed rate limiting with in-memory fallback
 * for development environments. Integrates with API key authentication.
 */

import { RateLimiter } from '@skillancer/cache';
import fp from 'fastify-plugin';

import {
  createIntelligenceRateLimitHooks,
  IntelligenceRateLimitExceededError,
  type IntelligenceRateLimitHooks,
} from '../middleware/rate-limit.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPE AUGMENTATION
// =============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Rate limit hooks for intelligence endpoints
     */
    intelligenceRateLimit: IntelligenceRateLimitHooks;

    /**
     * Check rate limit without consuming (for status checks)
     */
    checkIntelligenceRateLimit: (
      request: FastifyRequest,
      endpoint: keyof IntelligenceRateLimitHooks
    ) => Promise<{ allowed: boolean; remaining: number; resetAt: Date }>;

    /**
     * Get rate limit info for an identifier across all endpoints
     */
    getIntelligenceRateLimitStatus: (
      identifier: string,
      identifierType: 'apiKey' | 'user' | 'ip'
    ) => Promise<Record<keyof IntelligenceRateLimitHooks, { remaining: number; resetAt: Date }>>;
  }
}

// =============================================================================
// PLUGIN OPTIONS
// =============================================================================

export interface RateLimitPluginOptions {
  /**
   * Redis client instance (optional - will use in-memory if not provided)
   */
  redis?: RedisType;
}

// =============================================================================
// IN-MEMORY STORE (Development Fallback)
// =============================================================================

/**
 * Create in-memory Redis-like store for development
 */
function createInMemoryStore(): RedisType {
  const store = new Map<string, { value: string; expireAt?: number }>();

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, item] of store.entries()) {
      if (item.expireAt && now > item.expireAt) {
        store.delete(key);
      }
    }
  }, 60000); // Cleanup every minute

  const mockRedis = {
    get: async (key: string): Promise<string | null> => {
      const item = store.get(key);
      if (!item) return null;
      if (item.expireAt && Date.now() > item.expireAt) {
        store.delete(key);
        return null;
      }
      return item.value;
    },

    set: async (key: string, value: string, ...args: unknown[]): Promise<'OK'> => {
      let expireAt: number | undefined;
      for (let i = 0; i < args.length; i += 2) {
        if (args[i] === 'EX' && typeof args[i + 1] === 'number') {
          expireAt = Date.now() + (args[i + 1] as number) * 1000;
        } else if (args[i] === 'PX' && typeof args[i + 1] === 'number') {
          expireAt = Date.now() + (args[i + 1] as number);
        }
      }
      store.set(key, { value, expireAt });
      return 'OK';
    },

    del: async (key: string): Promise<number> => {
      return store.delete(key) ? 1 : 0;
    },

    zadd: async (key: string, score: number, member: string): Promise<number> => {
      const zset = store.get(key)?.value;
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
      const zset = store.get(key)?.value;
      if (!zset) return 0;
      const data: Array<{ score: number; member: string }> = JSON.parse(zset);
      const minNum = min === '-inf' ? -Infinity : Number(min);
      const maxNum = max === '+inf' ? Infinity : Number(max);
      const filtered = data.filter((item) => item.score < minNum || item.score > maxNum);
      store.set(key, { value: JSON.stringify(filtered) });
      return data.length - filtered.length;
    },

    zcard: async (key: string): Promise<number> => {
      const zset = store.get(key)?.value;
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

    eval: async (
      _script: string,
      _keyCount: number,
      key: string,
      ...args: string[]
    ): Promise<[number, number, number]> => {
      const now = Number(args[0]);
      const windowStart = Number(args[1]);
      const windowMs = Number(args[2]);
      const maxRequests = Number(args[3]);
      const consume = args[4] === '1';

      const zset = store.get(key)?.value;
      let data: Array<{ score: number; member: string }> = zset ? JSON.parse(zset) : [];

      // Remove entries outside window
      data = data.filter((item) => item.score > windowStart);

      let current = data.length;
      const allowed = current < maxRequests;

      if (consume && allowed) {
        const member = `${now}:${Math.random().toString(36).slice(2)}`;
        data.push({ score: now, member });
        current = data.length;
      }

      store.set(key, {
        value: JSON.stringify(data),
        expireAt: Date.now() + windowMs,
      });

      return [allowed ? 1 : 0, current, maxRequests - current];
    },
  } as unknown as RedisType;

  return mockRedis;
}

// =============================================================================
// PLUGIN IMPLEMENTATION
// =============================================================================

async function rateLimitPluginImpl(
  app: FastifyInstance,
  options: RateLimitPluginOptions
): Promise<void> {
  // Use provided Redis or create in-memory fallback
  let redis: RedisType;

  if (options.redis) {
    redis = options.redis;
    app.log.info('[IntelligenceRateLimit] Using Redis for distributed rate limiting');
  } else {
    app.log.info('[IntelligenceRateLimit] Using in-memory rate limiting (development mode)');
    redis = createInMemoryStore();
  }

  // Create rate limiter instance with intelligence-specific prefix
  const limiter = new RateLimiter(redis, 'intelligence:ratelimit');

  // Create all rate limit hooks
  const hooks = createIntelligenceRateLimitHooks(limiter);

  // Decorate fastify with rate limit hooks
  app.decorate('intelligenceRateLimit', hooks);

  // Add helper to check rate limit without consuming
  app.decorate(
    'checkIntelligenceRateLimit',
    async (request: FastifyRequest, endpoint: keyof IntelligenceRateLimitHooks) => {
      const {
        IntelligenceRateLimitConfigs,
        getRateLimitIdentifier,
        getRateLimitKey,
        getAdjustedConfig,
      } = await import('../middleware/rate-limit.js');

      const { identifier, type: identifierType, tier } = getRateLimitIdentifier(request);
      const key = getRateLimitKey(identifier, identifierType, endpoint);
      const config = getAdjustedConfig(
        IntelligenceRateLimitConfigs[endpoint],
        tier,
        identifierType
      );

      const result = await limiter.check(key, config);

      return {
        allowed: result.allowed,
        remaining: result.remaining,
        resetAt: result.resetAt,
      };
    }
  );

  // Add helper to get rate limit status across all endpoints
  app.decorate(
    'getIntelligenceRateLimitStatus',
    async (identifier: string, identifierType: 'apiKey' | 'user' | 'ip') => {
      const { IntelligenceRateLimitConfigs, ApiKeyTierMultipliers, UserTierMultipliers } =
        await import('../middleware/rate-limit.js');

      // Default tier based on identifier type
      const tier = identifierType === 'apiKey' ? 'STARTER' : 'PROFESSIONAL';
      const multipliers = identifierType === 'apiKey' ? ApiKeyTierMultipliers : UserTierMultipliers;
      const multiplier = multipliers[tier] || 1;

      const status: Record<string, { remaining: number; resetAt: Date }> = {};

      for (const [endpoint, baseConfig] of Object.entries(IntelligenceRateLimitConfigs)) {
        const key = `intelligence:${endpoint}:${identifierType}:${identifier}`;
        const config = {
          windowMs: baseConfig.windowMs,
          maxRequests: Math.floor(baseConfig.maxRequests * multiplier),
        };

        const result = await limiter.check(key, config);
        status[endpoint] = {
          remaining: result.remaining,
          resetAt: result.resetAt,
        };
      }

      return status as Record<
        keyof IntelligenceRateLimitHooks,
        { remaining: number; resetAt: Date }
      >;
    }
  );

  // Global error handler for rate limit errors
  app.addHook('onError', async (_request, reply, error) => {
    if (error instanceof IntelligenceRateLimitExceededError) {
      return reply.status(429).send(error.toJSON());
    }
    // Return undefined to continue to the next error handler
    return undefined;
  });

  // Add rate limit status endpoint for debugging/monitoring
  app.get('/rate-limit-status', async (request, reply) => {
    // Check for API key context first
    const apiKeyContext = (request as any).apiKeyContext;
    if (apiKeyContext?.keyId) {
      const status = await app.getIntelligenceRateLimitStatus(apiKeyContext.keyId, 'apiKey');
      return {
        keyId: `${apiKeyContext.keyId.substring(0, 8)}...`,
        plan: apiKeyContext.plan,
        limits: status,
        timestamp: new Date().toISOString(),
      };
    }

    // Check for authenticated user
    const user = (request as any).user;
    if (user?.id) {
      const status = await app.getIntelligenceRateLimitStatus(user.id, 'user');
      return {
        userId: user.id,
        limits: status,
        timestamp: new Date().toISOString(),
      };
    }

    return reply.status(401).send({ error: 'Authentication required' });
  });
}

// =============================================================================
// EXPORT
// =============================================================================

export const rateLimitPlugin = fp(rateLimitPluginImpl as any, {
  name: 'intelligence-rate-limit',
  dependencies: [],
});
