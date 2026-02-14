/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// @skillancer/market-svc
// Marketplace business logic service with Review & Rating System

import { PrismaClient } from '@skillancer/database';
import Fastify from 'fastify';
import { Redis } from 'ioredis';

import { ReviewJobs } from './jobs/index.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { registerRoutes } from './routes/index.js';
import { createLearningSignalService } from './services/learning-signals.service.js';

// Initialize dependencies
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Create logger wrapper for Fastify logger
const createLogger = (fastifyLogger: ReturnType<typeof Fastify>['log']) => ({
  info: (message: string, meta?: Record<string, unknown>) => {
    fastifyLogger.info(meta, message);
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    fastifyLogger.warn(meta, message);
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    fastifyLogger.error(meta, message);
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    fastifyLogger.debug(meta, message);
  },
});

const server = Fastify({
  logger: true,
  pluginTimeout: 120_000, // 120s - default 10s is too short for 15+ sub-plugin registrations
});

// Health check endpoint
server.get('/health', () => {
  return { status: 'ok', service: 'market-svc' };
});

// Readiness check - verify database and cache connections
server.get('/ready', async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return { status: 'ready' };
  } catch {
    throw new Error('Service not ready');
  }
});

const start = async () => {
  try {
    // Connect to database
    await prisma.$connect();
    server.log.info('Connected to database');

    // Register rate limiting plugin (must be before routes)
    await server.register(rateLimitPlugin, { redis });

    // Create logger instance
    const logger = createLogger(server.log);

    // Register routes with dependencies
    await registerRoutes(server, {
      prisma,
      redis,
      logger: logger as never, // Type coercion for Logger interface
    });

    // Start background jobs
    const reviewJobs = new ReviewJobs(prisma, redis, logger as never);

    // Initialize learning signal service for recommendation integration
    const learningSignalService = createLearningSignalService(prisma, redis, logger as never);
    server.log.info(
      `Learning signal service initialized (ready: ${learningSignalService.isReady()})`
    );

    // Run scheduled jobs periodically (every 15 minutes)
    const jobInterval = setInterval(
      () => {
        void reviewJobs.runScheduledJobs();
      },
      15 * 60 * 1000
    );

    // Graceful shutdown
    const shutdown = async () => {
      server.log.info('Shutting down...');
      clearInterval(jobInterval);
      await prisma.$disconnect();
      await redis.quit();
      // eslint-disable-next-line n/no-process-exit
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Start server
    const port = Number(process.env.PORT) || 3002;
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Market service started on port ${port}`);
  } catch (err) {
    server.log.error(err);
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  }
};

void start();

export { server };
