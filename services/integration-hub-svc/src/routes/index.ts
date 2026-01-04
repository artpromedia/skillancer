import type { FastifyInstance } from 'fastify';
import { integrationRoutes } from './integrations.routes';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Register integration routes
  await fastify.register(integrationRoutes, { prefix: '/api/v1' });
}

export { integrationRoutes };
