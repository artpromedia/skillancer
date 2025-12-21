// @ts-nocheck - Fastify type compatibility issues
/**
 * Swagger plugin for API documentation
 */

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance } from 'fastify';

async function swaggerPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  await app.register(swagger, {
    openapi: {
      info: {
        title: `${config.service.name} API`,
        description: `API documentation for ${config.service.name}`,
        version: config.service.version,
      },
      servers: [
        {
          url: `http://localhost:${config.server.port}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'API', description: 'API endpoints' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  });
}

export const swaggerPlugin = fp(swaggerPluginImpl, {
  name: 'swagger-plugin',
}) as any;
