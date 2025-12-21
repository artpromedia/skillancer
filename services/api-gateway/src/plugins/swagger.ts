// @ts-nocheck - Fastify type compatibility issues
/**
 * @module @skillancer/api-gateway/plugins/swagger
 * OpenAPI documentation plugin
 */

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';
import { getServiceRoutes } from '../config/routes.js';

import type { FastifyInstance } from 'fastify';

async function swaggerPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  if (!config.features.swagger) {
    return;
  }

  const serviceRoutes = getServiceRoutes();

  // Generate tags from service routes
  const tags = serviceRoutes.map((route) => ({
    name: route.serviceName,
    description: route.description ?? `${route.serviceName} service endpoints`,
  }));

  // Add BFF tag
  tags.unshift({
    name: 'bff',
    description: 'Backend-for-Frontend aggregated endpoints',
  });

  // Add health tag
  tags.unshift({
    name: 'health',
    description: 'Health check endpoints',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Skillancer API Gateway',
        description: `
API Gateway for Skillancer platform.

## Overview
This gateway serves as the single entry point for all frontend applications, providing:
- **Authentication** - JWT-based authentication at the edge
- **Routing** - Request routing to downstream microservices
- **Aggregation** - BFF pattern endpoints for complex UI needs
- **Rate Limiting** - Protection against abuse
- **Circuit Breaking** - Resilience against failing services

## Authentication
Most endpoints require authentication via JWT Bearer token:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Services
${serviceRoutes.map((r) => `- **${r.prefix}** → ${r.serviceName} (${r.auth})`).join('\n')}
        `,
        version: config.service.version,
        contact: {
          name: 'Skillancer Team',
          email: 'api@skillancer.com',
        },
      },
      servers: [
        {
          url:
            config.env === 'production'
              ? 'https://api.skillancer.com'
              : `http://localhost:${config.server.port}`,
          description: config.env === 'production' ? 'Production' : 'Development',
        },
      ],
      tags,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT authentication token',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
  });
}

export const swaggerPlugin = fp(swaggerPluginImpl, {
  name: 'swagger-plugin',
});
