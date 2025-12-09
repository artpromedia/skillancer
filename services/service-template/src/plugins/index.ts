/**
 * @module @skillancer/service-template/plugins
 * Fastify plugin registrations
 */

import { corsPlugin } from './cors.js';
import { helmetPlugin } from './helmet.js';
import { jwtPlugin } from './jwt.js';
import { rateLimitPlugin } from './rate-limit.js';
import { requestContextPlugin } from './request-context.js';
import { sensiblePlugin } from './sensible.js';
import { swaggerPlugin } from './swagger.js';
import { underPressurePlugin } from './under-pressure.js';

import type { FastifyInstance } from 'fastify';

export interface PluginOptions {
  cors?: boolean;
  helmet?: boolean;
  rateLimit?: boolean;
  jwt?: boolean;
  swagger?: boolean;
  underPressure?: boolean;
}

/**
 * Register all plugins based on options
 */
export async function registerPlugins(
  app: FastifyInstance,
  options: PluginOptions = {}
): Promise<void> {
  // Always register sensible (provides useful utilities)
  await app.register(sensiblePlugin);

  // Always register request context
  await app.register(requestContextPlugin);

  // Conditional plugins
  if (options.cors !== false) {
    await app.register(corsPlugin);
  }

  if (options.helmet !== false) {
    await app.register(helmetPlugin);
  }

  if (options.rateLimit !== false) {
    await app.register(rateLimitPlugin);
  }

  if (options.jwt) {
    await app.register(jwtPlugin);
  }

  if (options.swagger !== false) {
    await app.register(swaggerPlugin);
  }

  if (options.underPressure !== false) {
    await app.register(underPressurePlugin);
  }
}

// Re-export individual plugins for custom use
export {
  corsPlugin,
  helmetPlugin,
  sensiblePlugin,
  rateLimitPlugin,
  jwtPlugin,
  swaggerPlugin,
  underPressurePlugin,
  requestContextPlugin,
};
