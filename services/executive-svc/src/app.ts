/**
 * Executive Service Application
 *
 * This microservice handles all executive-specific functionality:
 * - Executive profile management
 * - Vetting pipeline orchestration
 * - Reference check workflows
 * - Background check integration (Checkr)
 * - LinkedIn verification
 * - Executive-client matching
 *
 * Dependencies:
 * - auth-svc: User authentication
 * - notification-svc: Email/push notifications
 * - billing-svc: Subscription management
 *
 * External Integrations:
 * - Checkr: Background checks
 * - LinkedIn API: Profile verification
 * - Calendly: Interview scheduling
 */

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { getConfig } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { authPlugin } from './plugins/auth.js';
import {
  healthRoutes,
  profileRoutes,
  vettingRoutes,
  referencePublicRoutes,
  adminVettingRoutes,
  webhookRoutes,
} from './routes/index.js';

export interface AppOptions extends FastifyServerOptions {
  testing?: boolean;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.nodeEnv === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    ...options,
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Register core plugins
  await app.register(sensible as any);
  await app.register(helmet as any, {
    contentSecurityPolicy: config.nodeEnv === 'production',
  });
  await app.register(cors as any, {
    origin: config.corsOrigins,
    credentials: true,
  });
  await app.register(cookie as any, {
    secret: config.cookieSecret,
  });
  await app.register(formbody as any);
  await app.register(rateLimit as any, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger documentation
  await app.register(swagger as any, {
    openapi: {
      info: {
        title: 'Executive Service API',
        description: 'API for managing executive profiles, vetting, and references',
        version: '1.0.0',
      },
      servers: [{ url: config.apiBaseUrl, description: 'API Server' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi as any, {
    routePrefix: '/docs',
  });

  // Auth plugin (validates JWT tokens)
  await app.register(authPlugin as any);

  // Register routes
  await app.register(healthRoutes as any, { prefix: '/health' });
  await app.register(profileRoutes as any, { prefix: '/executives' });
  await app.register(vettingRoutes as any, { prefix: '/vetting' });
  await app.register(referencePublicRoutes as any, { prefix: '/references' });
  await app.register(adminVettingRoutes as any, { prefix: '/admin/vetting' });
  await app.register(webhookRoutes as any, { prefix: '/webhooks' });

  return app;
}

export { getConfig } from './config/index.js';
