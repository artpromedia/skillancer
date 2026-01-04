/**
 * Intelligence API Service
 * Sprint M10: Talent Intelligence API
 *
 * B2B API for freelance market intelligence
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createLogger } from '@skillancer/logger';

import { apiKeyAuth } from './middleware/api-key-auth';
import { usageMetering } from './middleware/usage-metering';
import { ratesRoutes } from './routes/rates.routes';
import { availabilityRoutes } from './routes/availability.routes';
import { demandRoutes } from './routes/demand.routes';
import { workforceRoutes } from './routes/workforce.routes';

const logger = createLogger({ service: 'intelligence-api' });

// ============================================================================
// App Configuration
// ============================================================================

export interface AppConfig {
  port: number;
  host: string;
  environment: 'development' | 'staging' | 'production';
  apiVersion: string;
}

const defaultConfig: AppConfig = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  environment: (process.env.NODE_ENV as AppConfig['environment']) || 'development',
  apiVersion: 'v1',
};

// ============================================================================
// Create Application
// ============================================================================

export async function createApp(config: Partial<AppConfig> = {}): Promise<FastifyInstance> {
  const appConfig = { ...defaultConfig, ...config };

  const app = Fastify({
    logger: {
      level: appConfig.environment === 'production' ? 'info' : 'debug',
      transport:
        appConfig.environment !== 'production'
          ? {
              target: 'pino-pretty',
              options: { colorize: true },
            }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // ========================================
  // Security Plugins
  // ========================================

  await app.register(helmet, {
    contentSecurityPolicy: false, // API doesn't serve HTML
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    credentials: true,
  });

  // Global rate limiting (per IP)
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
    errorResponseBuilder: (request, context) => ({
      error: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Limit: ${context.max} per ${context.after}`,
      retryAfter: context.after,
    }),
  });

  // ========================================
  // OpenAPI Documentation
  // ========================================

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Skillancer Talent Intelligence API',
        description: `
          Access real freelance market data including rate benchmarks, talent availability,
          skill demand signals, and workforce planning tools.
          
          ## Authentication
          All endpoints require an API key passed via the \`X-API-Key\` header.
          
          ## Rate Limiting
          Rate limits depend on your plan tier. Check the \`X-RateLimit-*\` response headers.
          
          ## Data Freshness
          - Rate benchmarks: Updated daily
          - Availability: Updated hourly
          - Demand signals: Updated daily
        `,
        version: '1.0.0',
        contact: {
          name: 'Skillancer API Support',
          email: 'api-support@skillancer.com',
          url: 'https://skillancer.com/api-portal',
        },
        license: {
          name: 'Commercial',
          url: 'https://skillancer.com/api-terms',
        },
      },
      servers: [
        { url: 'https://api.skillancer.com', description: 'Production' },
        { url: 'https://api-staging.skillancer.com', description: 'Staging' },
        { url: 'http://localhost:4000', description: 'Local Development' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'X-API-Key',
            in: 'header',
            description: 'API key for authentication',
          },
        },
      },
      security: [{ apiKey: [] }],
      tags: [
        { name: 'Rates', description: 'Rate benchmarking endpoints' },
        { name: 'Availability', description: 'Talent availability endpoints' },
        { name: 'Demand', description: 'Skill demand signal endpoints' },
        { name: 'Workforce', description: 'Workforce planning endpoints' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // ========================================
  // Custom Middleware
  // ========================================

  // API key authentication (for /v1 routes)
  app.addHook('preHandler', async (request, reply) => {
    // Skip auth for health check, docs, and root
    const publicPaths = ['/', '/health', '/docs', '/docs/'];
    if (publicPaths.some((p) => request.url.startsWith(p))) {
      return;
    }

    await apiKeyAuth(request, reply);
  });

  // Usage metering (after auth)
  app.addHook('onResponse', async (request, reply) => {
    if (request.url.startsWith('/v1')) {
      await usageMetering(request, reply);
    }
  });

  // ========================================
  // Health Check
  // ========================================

  app.get('/health', async (request, reply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: appConfig.apiVersion,
      environment: appConfig.environment,
    };
  });

  // Root endpoint
  app.get('/', async (request, reply) => {
    return {
      name: 'Skillancer Talent Intelligence API',
      version: appConfig.apiVersion,
      documentation: '/docs',
      status: '/health',
    };
  });

  // ========================================
  // API Routes (v1)
  // ========================================

  await app.register(ratesRoutes, { prefix: '/v1/rates' });
  await app.register(availabilityRoutes, { prefix: '/v1/availability' });
  await app.register(demandRoutes, { prefix: '/v1/demand' });
  await app.register(workforceRoutes, { prefix: '/v1/workforce' });

  // ========================================
  // Error Handling
  // ========================================

  app.setErrorHandler((error, request, reply) => {
    logger.error('Request error', {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      requestId: request.id,
    });

    // Handle known error types
    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        error: error.code || 'ERROR',
        message: error.message,
        statusCode: error.statusCode,
      });
    }

    // Handle validation errors
    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: error.validation,
        statusCode: 400,
      });
    }

    // Generic error
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message:
        appConfig.environment === 'production' ? 'An unexpected error occurred' : error.message,
      statusCode: 500,
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
    });
  });

  return app;
}

// ============================================================================
// Start Server
// ============================================================================

export async function startServer(config: Partial<AppConfig> = {}): Promise<void> {
  const appConfig = { ...defaultConfig, ...config };

  try {
    const app = await createApp(appConfig);

    await app.listen({
      port: appConfig.port,
      host: appConfig.host,
    });

    logger.info('Intelligence API started', {
      port: appConfig.port,
      environment: appConfig.environment,
      version: appConfig.apiVersion,
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start if run directly
if (require.main === module) {
  startServer();
}
