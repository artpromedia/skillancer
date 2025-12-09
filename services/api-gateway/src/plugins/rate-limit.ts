/**
 * @module @skillancer/api-gateway/plugins/rate-limit
 * Rate limiting configuration
 */

import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance, FastifyRequest } from 'fastify';


async function rateLimitPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  await app.register(rateLimit, {
    global: true,
    max: config.rateLimit.global.max,
    timeWindow: config.rateLimit.global.timeWindow,
    // Use Redis if available, otherwise in-memory
    // redis: config.redis ? new Redis(config.redis) : undefined,
    keyGenerator: (request: FastifyRequest) => {
      // Use user ID if authenticated, otherwise use IP
      const user = request.user as { userId?: string } | undefined;
      if (user?.userId) {
        return `user:${user.userId}`;
      }
      // Fallback to IP-based rate limiting
      const forwarded = request.headers['x-forwarded-for'];
      const ip = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() ?? request.ip : request.ip;
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
