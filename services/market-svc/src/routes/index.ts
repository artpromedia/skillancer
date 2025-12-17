/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all market-svc routes
 */

import { registerAdminReviewRoutes } from './admin-reviews.routes.js';
import { registerEnhancedReviewRoutes } from './enhanced-reviews.routes.js';
import { rateIntelligenceRoutes } from './rate-intelligence.routes.js';
import { registerReviewRoutes } from './reviews.routes.js';
import { registerServiceOrderRoutes } from './service-orders.routes.js';
import { registerServiceRoutes } from './services.routes.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

export interface RouteDependencies {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

export async function registerRoutes(
  fastify: FastifyInstance,
  deps: RouteDependencies
): Promise<void> {
  // Register review routes
  await fastify.register(
    (instance) => {
      registerReviewRoutes(instance, deps);
    },
    { prefix: '/reviews' }
  );

  // Register enhanced review routes (with fraud detection)
  await fastify.register(
    (instance) => {
      registerEnhancedReviewRoutes(instance, deps);
    },
    { prefix: '/v2/reviews' }
  );

  // Register admin review routes
  await fastify.register(
    (instance) => {
      registerAdminReviewRoutes(instance, deps);
    },
    { prefix: '/admin/reviews' }
  );

  // Register service catalog routes
  await fastify.register(
    (instance) => {
      registerServiceRoutes(instance, deps);
    },
    { prefix: '/services' }
  );

  // Register service orders routes
  await fastify.register(
    (instance) => {
      registerServiceOrderRoutes(instance, deps);
    },
    { prefix: '/service-orders' }
  );

  // Register rate intelligence routes
  await fastify.register(
    (instance) => {
      rateIntelligenceRoutes(instance);
    },
    { prefix: '/market' }
  );
}

// Re-export route registration functions
export { registerReviewRoutes } from './reviews.routes.js';
export { registerAdminReviewRoutes } from './admin-reviews.routes.js';
export { registerEnhancedReviewRoutes } from './enhanced-reviews.routes.js';
export { registerServiceRoutes } from './services.routes.js';
export { registerServiceOrderRoutes } from './service-orders.routes.js';
export { rateIntelligenceRoutes } from './rate-intelligence.routes.js';
