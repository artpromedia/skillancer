/**
 * @module @skillancer/notification-svc
 * Push notifications and email service for Skillancer platform
 *
 * Features:
 * - Email notifications via SendGrid
 * - Push notifications via Firebase Cloud Messaging
 * - Multi-channel notification delivery
 * - User notification preferences
 * - Device token management
 * - Delivery tracking via webhooks
 * - Notification history and statistics
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { PrismaClient } from '@prisma/client';

import { validateConfig, getConfig } from './config/index.js';
import { healthRoutes } from './routes/health.routes.js';
import { notificationRoutes } from './routes/notification.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';

const prisma = new PrismaClient();

async function buildApp() {
  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.warn('Configuration validation warning:', error);
    // Continue with defaults in development
  }

  const config = getConfig();

  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.nodeEnv === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            }
          : undefined,
    },
    trustProxy: true,
  });

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Decorate request with prisma client
  fastify.decorateRequest('prisma', null);
  fastify.addHook('onRequest', async (request) => {
    (request as any).prisma = prisma;
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(notificationRoutes, { prefix: '/api/v1/notifications' });
  await fastify.register(webhookRoutes, { prefix: '/webhooks' });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: error.message,
        details: error.validation,
      });
    }

    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Internal Server Error' : error.message;

    return reply.status(statusCode).send({
      error: message,
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();
    const config = getConfig();

    await app.listen({ port: config.port, host: config.host });

    console.log(`Notification Service running on http://${config.host}:${config.port}`);
    console.log(`Health check: http://${config.host}:${config.port}/health`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

prisma
  .$connect()
  .then(() => {
    console.log('Connected to database');
    return start();
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });

// Exports
export { buildApp };
export * from './config/index.js';
export * from './services/index.js';
export * from './routes/index.js';
export * from './types/notification.types.js';
