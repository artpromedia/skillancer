/**
 * @module @skillancer/api-gateway/plugins
 * Plugin registration
 */

import { authPlugin } from './auth.js';
import { corsPlugin } from './cors.js';
import { helmetPlugin } from './helmet.js';
import { proxyPlugin } from './proxy.js';
import { rateLimitPlugin } from './rate-limit.js';
import { requestLoggerPlugin } from './request-logger.js';
import { sensiblePlugin } from './sensible.js';
import { swaggerPlugin } from './swagger.js';

import type { FastifyInstance } from 'fastify';

export interface PluginOptions {
  cors?: boolean;
  helmet?: boolean;
  rateLimit?: boolean;
  auth?: boolean;
  swagger?: boolean;
  requestLogger?: boolean;
  proxy?: boolean;
}

/**
 * Register all plugins
 */
export async function registerPlugins(
  app: FastifyInstance,
  options: PluginOptions = {}
): Promise<void> {
  // Always register sensible (provides useful utilities)
  await app.register(sensiblePlugin);

  // Request logging (register early to catch all requests)
  if (options.requestLogger !== false) {
    await app.register(requestLoggerPlugin);
  }

  // Security plugins
  if (options.cors !== false) {
    await app.register(corsPlugin);
  }

  if (options.helmet !== false) {
    await app.register(helmetPlugin);
  }

  // Rate limiting
  if (options.rateLimit !== false) {
    await app.register(rateLimitPlugin);
  }

  // Authentication
  if (options.auth !== false) {
    await app.register(authPlugin);
  }

  // API documentation
  if (options.swagger !== false) {
    await app.register(swaggerPlugin);
  }

  // Service proxy (must be registered after auth)
  if (options.proxy !== false) {
    await app.register(proxyPlugin);
  }
}

// Re-export plugins
export {
  corsPlugin,
  helmetPlugin,
  sensiblePlugin,
  rateLimitPlugin,
  authPlugin,
  swaggerPlugin,
  requestLoggerPlugin,
  proxyPlugin,
};

// Re-export auth helpers
export { requireAuth, optionalAuth } from './auth.js';
