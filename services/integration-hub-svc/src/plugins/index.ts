// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/plugins
 * Fastify plugin registration
 */

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Extend FastifyInstance with authenticate
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface PluginOptions {
  cors?: boolean;
  helmet?: boolean;
  rateLimit?: boolean;
  jwt?: boolean;
  swagger?: boolean;
}

export async function registerPlugins(app: FastifyInstance, options: PluginOptions): Promise<void> {
  // Sensible (adds useful utilities)
  await app.register(sensible);

  // Register authenticate decorator (stub for development)
  // TODO: Replace with proper JWT authentication
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    // Stub: In production, this should verify JWT tokens
    // For now, allow all requests through
  });

  // CORS
  if (options.cors) {
    await app.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
  }

  // Helmet (security headers)
  if (options.helmet) {
    await app.register(helmet, {
      contentSecurityPolicy: false, // Disable for API
    });
  }

  // Rate limiting
  if (options.rateLimit) {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      // Different limits for OAuth callbacks (prevent brute force)
      keyGenerator: (request) => {
        if (request.url.includes('/oauth/callback')) {
          return `oauth:${request.ip}`;
        }
        return request.ip;
      },
    });
  }

  // Swagger documentation
  if (options.swagger) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Integration Hub API',
          description: 'API for managing third-party integrations',
          version: '1.0.0',
        },
        servers: [
          {
            url: 'http://localhost:3006',
            description: 'Development server',
          },
        ],
        tags: [
          { name: 'Discovery', description: 'Integration discovery' },
          { name: 'Connection', description: 'OAuth and connection management' },
          { name: 'Status', description: 'Integration status and health' },
          { name: 'Data', description: 'Widget data and sync' },
          { name: 'Webhooks', description: 'Webhook handling' },
        ],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }
}
