/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Routes index - registers all market-svc routes
 */

import { registerAdminReviewRoutes } from './admin-reviews.routes.js';
import { registerReviewRoutes } from './reviews.routes.js';

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

  // Register admin review routes
  await fastify.register(
    (instance) => {
      registerAdminReviewRoutes(instance, deps);
    },
    { prefix: '/admin/reviews' }
  );
}

export { registerReviewRoutes, registerAdminReviewRoutes };
