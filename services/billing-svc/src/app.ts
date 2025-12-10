/**
 * @module @skillancer/billing-svc/app
 * Billing service main application
 */

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

import { config } from './config/index.js';
import { initializeStripeService } from './services/stripe.service.js';
import { initializePaymentMethodService } from './services/payment-method.service.js';
import {
  initializeCardExpirationJob,
  scheduleCardExpirationJob,
  closeCardExpirationJob,
} from './jobs/card-expiration.job.js';
import paymentMethodRoutes from './routes/payment-methods.js';
import webhookRoutes from './routes/webhooks.js';
import {
  StripeError,
  PaymentMethodNotFoundError,
  PaymentMethodInUseError,
  InvalidPaymentMethodError,
  SetupIntentError,
  CustomerNotFoundError,
} from './errors/index.js';

// =============================================================================
// APP FACTORY
// =============================================================================

/**
 * Create and configure the Fastify application
 */
export async function createApp(): Promise<FastifyInstance> {
  // Build logger config to avoid exactOptionalPropertyTypes issues
  const loggerConfig =
    config.app.nodeEnv === 'development'
      ? {
          level: config.app.logLevel,
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : { level: config.app.logLevel };

  const app = Fastify({
    logger: loggerConfig,
    // Enable raw body for webhook signature verification
    bodyLimit: 1048576, // 1MB
  });

  // ==========================================================================
  // PLUGINS
  // ==========================================================================

  // CORS
  await app.register(fastifyCors, {
    origin: config.app.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Security headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Handled by API gateway
  });

  // Rate limiting
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise IP
      return (request as any).user?.id ?? request.ip;
    },
  });

  // Swagger documentation
  if (config.app.nodeEnv !== 'production') {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Skillancer Billing Service API',
          description: 'Payment method management and billing operations',
          version: '1.0.0',
        },
        servers: [{ url: `http://localhost:${config.app.port}`, description: 'Development' }],
        tags: [
          { name: 'Payment Methods', description: 'Payment method management' },
          { name: 'Webhooks', description: 'Stripe webhook handlers' },
          { name: 'Health', description: 'Service health checks' },
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
        security: [{ bearerAuth: [] }],
      },
    });

    await app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });
  }

  // Raw body plugin for webhook signature verification
  await app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    // Store raw body for webhook verification
    (req as any).rawBody = body;

    try {
      const json = JSON.parse(body.toString());
      done(null, json);
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  // ==========================================================================
  // SERVICES INITIALIZATION
  // ==========================================================================

  // Initialize Stripe service
  initializeStripeService();
  app.log.info('Stripe service initialized');

  // Initialize Payment Method service
  initializePaymentMethodService();
  app.log.info('Payment Method service initialized');

  // Initialize card expiration job
  initializeCardExpirationJob();
  await scheduleCardExpirationJob();
  app.log.info('Card expiration job scheduled');

  // ==========================================================================
  // ROUTES
  // ==========================================================================

  // Health check
  app.get('/health', async () => ({
    status: 'healthy',
    service: 'billing-svc',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // Readiness check
  app.get('/ready', async () => {
    // Check Stripe connectivity
    // Check database connectivity
    // Check Redis connectivity
    return {
      status: 'ready',
      service: 'billing-svc',
      timestamp: new Date().toISOString(),
    };
  });

  // API routes
  await app.register(paymentMethodRoutes, { prefix: '/payment-methods' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });

  // ==========================================================================
  // ERROR HANDLING
  // ==========================================================================

  app.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);

    // Handle known errors
    if (error instanceof PaymentMethodNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'PaymentMethodNotFound',
        message: error.message,
      });
    }

    if (error instanceof PaymentMethodInUseError) {
      return reply.status(409).send({
        success: false,
        error: 'PaymentMethodInUse',
        message: error.message,
      });
    }

    if (error instanceof InvalidPaymentMethodError) {
      return reply.status(400).send({
        success: false,
        error: 'InvalidPaymentMethod',
        message: error.message,
      });
    }

    if (error instanceof SetupIntentError) {
      return reply.status(400).send({
        success: false,
        error: 'SetupIntentFailed',
        message: error.message,
      });
    }

    if (error instanceof CustomerNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'CustomerNotFound',
        message: error.message,
      });
    }

    if (error instanceof StripeError) {
      return reply.status(502).send({
        success: false,
        error: 'StripeError',
        message: 'Payment provider error. Please try again later.',
      });
    }

    // Zod validation errors
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        success: false,
        error: 'ValidationError',
        message: 'Invalid request data',
        details: (error as any).issues,
      });
    }

    // Rate limit error
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: 'TooManyRequests',
        message: 'Rate limit exceeded. Please try again later.',
      });
    }

    // Generic error
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      success: false,
      error: 'InternalError',
      message: config.app.nodeEnv === 'production' ? 'An unexpected error occurred' : error.message,
    });
  });

  // ==========================================================================
  // GRACEFUL SHUTDOWN
  // ==========================================================================

  const shutdown = async () => {
    app.log.info('Shutting down billing service...');

    // Close card expiration job
    await closeCardExpirationJob();

    // Close Fastify
    await app.close();

    app.log.info('Billing service shut down complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return app;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const app = await createApp();

  try {
    await app.listen({
      port: config.app.port,
      host: '0.0.0.0',
    });

    app.log.info(`Billing service listening on port ${config.app.port}`);
    app.log.info(`Swagger docs available at http://localhost:${config.app.port}/docs`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Run if this is the main module
main().catch(console.error);
