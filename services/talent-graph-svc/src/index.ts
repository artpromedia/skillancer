import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { PrismaClient } from '@prisma/client';

import { healthRoutes } from './routes/health.routes';
import { relationshipRoutes } from './routes/relationship.routes';
import { introductionRoutes } from './routes/introduction.routes';
import { teamReunionRoutes } from './routes/team-reunion.routes';

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

  await fastify.register(cors as any, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  await fastify.register(helmet as any, {
    contentSecurityPolicy: false,
  });

  fastify.decorateRequest('prisma', null);
  fastify.addHook('onRequest', async (request) => {
    (request as any).prisma = prisma;
  });

  await fastify.register(healthRoutes);
  await fastify.register(relationshipRoutes, { prefix: '/api/v1/talent-graph' });
  await fastify.register(introductionRoutes, { prefix: '/api/v1/talent-graph' });
  await fastify.register(teamReunionRoutes, { prefix: '/api/v1/talent-graph' });

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

    const port = Number.parseInt(process.env.PORT || '3008', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    console.log(`Talent Graph Service running on http://${host}:${port}`);
    console.log(`Health check: http://${host}:${port}/health`);
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

export { buildApp };
