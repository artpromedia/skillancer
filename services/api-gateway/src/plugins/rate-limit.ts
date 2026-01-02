// @ts-nocheck - Fastify type compatibility issues
/**
 * @module @skillancer/api-gateway/plugins/rate-limit
 * Rate limiting configuration with Redis support for distributed consistency
 */

import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';
import Redis from 'ioredis';

import { getConfig } from '../config/index.js';

import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Create Redis client for distributed rate limiting
 */
function createRedisClient(config: { host: string; port: number; password?: string }): Redis {
  const client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) {
        // Stop retrying after 3 attempts, fall back to in-memory
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on('error', (err) => {
    console.warn('[RateLimit] Redis connection error, falling back to in-memory:', err.message);
  });

  return client;
}

async function rateLimitPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  // Create Redis client if configured
  let redisClient: Redis | undefined;
  if (config.redis) {
    try {
      redisClient = createRedisClient(config.redis);
      await redisClient.connect();
      console.log('[RateLimit] Redis connected for distributed rate limiting');
    } catch (error) {
      console.warn('[RateLimit] Redis connection failed, using in-memory rate limiting:', error);
      redisClient = undefined;
    }
  }

  await app.register(rateLimit, {
    global: true,
    max: config.rateLimit.global.max,
    timeWindow: config.rateLimit.global.timeWindow,
    // Use Redis for distributed rate limiting in production
    redis: redisClient,
    keyGenerator: (request: FastifyRequest) => {
      // Use user ID if authenticated, otherwise use IP
      const user = request.user as { userId?: string } | undefined;
      if (user?.userId) {
        return `user:${user.userId}`;
      }
      // Fallback to IP-based rate limiting
      const forwarded = request.headers['x-forwarded-for'];
      const ip =
        typeof forwarded === 'string'
          ? (forwarded.split(',')[0]?.trim() ?? request.ip)
          : request.ip;
      return `ip:${ip}`;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
}

export const rateLimitPlugin = fp(rateLimitPluginImpl, {
  name: 'rate-limit-plugin',
});
