import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';

import { cardRoutes } from './routes/card.routes';
import { financingRoutes } from './routes/financing.routes';
import { healthRoutes } from './routes/health.routes';
import { taxVaultRoutes } from './routes/tax-vault.routes';

const prisma = new PrismaClient();

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV === 'development'
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

  // Add request context
  fastify.decorateRequest('prisma', null);
  fastify.addHook('onRequest', async (request) => {
    (request as any).prisma = prisma;
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(cardRoutes, { prefix: '/api/v1/financial' });
  await fastify.register(financingRoutes, { prefix: '/api/v1/financial' });
  await fastify.register(taxVaultRoutes, { prefix: '/api/v1/financial' });

  // Global error handler
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
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
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

    const port = Number.parseInt(process.env.PORT || '3007', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    app.log.info(`Financial Service running on http://${host}:${port}`);
    app.log.info(`Health check: http://${host}:${port}/health`);
  } catch (error) {
    process.stderr.write(`Failed to start server: ${error}\n`);
    process.exit(1);
  }
}

// Connect to database and start server
prisma
  .$connect()
  .then(() => {
    process.stdout.write('[financial-svc] Connected to database\n');
    return start();
  })
  .catch((error) => {
    process.stderr.write(`[financial-svc] Failed to connect to database: ${error}\n`);
    process.exit(1);
  });

export { buildApp };
