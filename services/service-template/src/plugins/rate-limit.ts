/**
 * Rate limit plugin
 */

import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance } from 'fastify';

async function rateLimitPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
  });
}

export const rateLimitPlugin = fp(rateLimitPluginImpl, {
  name: 'rate-limit-plugin',
});
