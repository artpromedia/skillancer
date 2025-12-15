/**
 * @module @skillancer/skillpod-svc/app
 * Fastify application factory for SkillPod VDI service
 */

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import { getConfig } from './config/index.js';
import { createContainmentMiddleware, createWatermarkMiddleware } from './middleware/index.js';
import { containmentRoutes, securityPolicyRoutes, violationRoutes } from './routes/index.js';
import {
  createSecurityPolicyService,
  createViolationDetectionService,
  createDataContainmentService,
} from './services/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface BuildAppOptions {
  redis: Redis;
  prisma: PrismaClient;
  logger?: FastifyServerOptions['logger'];
}

// =============================================================================
// APPLICATION FACTORY
// =============================================================================

/**
 * Build the Fastify application with all plugins and routes
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const config = getConfig();
  const { redis, prisma } = options;

  // Create Fastify instance
  const app = Fastify({
    logger: options.logger ?? {
      level: config.logging.level,
      transport: config.logging.pretty
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  // ===========================================================================
  // PLUGINS
  // ===========================================================================

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(sensible);

  // ===========================================================================
  // SERVICES
  // ===========================================================================

  // Create services
  const policyService = createSecurityPolicyService(prisma);
  const violationService = createViolationDetectionService(prisma, redis);
  const containmentService = createDataContainmentService(
    prisma,
    redis,
    policyService,
    violationService
  );

  // ===========================================================================
  // MIDDLEWARE
  // ===========================================================================

  // Create and register containment middleware
  const containmentMiddleware = createContainmentMiddleware(containmentService, {
    enforceMode: config.service.environment === 'production',
    excludeRoutes: ['/health', '/ready', '/metrics', '/api/v1/policies'],
    sessionIdHeader: 'x-skillpod-session-id',
    onViolation: async (request, violation) => {
      app.log.warn({
        msg: 'Containment violation',
        violation,
        url: request.url,
        method: request.method,
      });
    },
  });

  containmentMiddleware.register(app);

  // Register watermark middleware for responses
  const watermarkMiddleware = createWatermarkMiddleware(containmentService);
  app.addHook('onSend', watermarkMiddleware);

  // ===========================================================================
  // HEALTH CHECK
  // ===========================================================================

  app.get('/health', async () => {
    return { status: 'ok', service: 'skillpod-svc' };
  });

  app.get('/ready', async (_, reply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;

      // Check Redis connection
      await redis.ping();

      return { status: 'ready' };
    } catch (error) {
      return reply.status(503).send({
        status: 'not ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ===========================================================================
  // API ROUTES
  // ===========================================================================

  // Register routes under /api/v1 prefix
  app.register(
    async (api) => {
      // Security policy management routes
      securityPolicyRoutes(api, policyService);

      // Containment check routes
      containmentRoutes(api, containmentService);

      // Violation management routes
      violationRoutes(api, violationService);
    },
    { prefix: '/api/v1' }
  );

  // ===========================================================================
  // ERROR HANDLER
  // ===========================================================================

  app.setErrorHandler((error, request, reply) => {
    app.log.error({
      err: error,
      url: request.url,
      method: request.method,
    });

    // Handle Zod validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation error',
        details: error.validation,
      });
    }

    // Handle known errors
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
      });
    }

    // Handle unknown errors
    return reply.status(500).send({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}

// =============================================================================
// EXPORTS
// =============================================================================

export { getConfig } from './config/index.js';
export * from './services/index.js';
export * from './middleware/index.js';
export * from './routes/index.js';
export * from './types/index.js';
