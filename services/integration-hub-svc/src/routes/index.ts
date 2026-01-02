import { FastifyInstance } from 'fastify';
import { integrationRoutes } from './integrations.routes';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check
  fastify.get('/health', async () => ({ status: 'ok', service: 'integration-hub-svc' }));

  // Register integration routes
  await fastify.register(integrationRoutes, { prefix: '/api/v1' });
}

export { integrationRoutes };
