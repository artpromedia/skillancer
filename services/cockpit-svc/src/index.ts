// @skillancer/cockpit-svc
// Cockpit integrations and business logic service

import { PrismaClient } from '@skillancer/database';
import { createLogger, type Logger } from '@skillancer/logger';
import Fastify from 'fastify';
import { Redis } from 'ioredis';

import { registerRoutes } from './routes/index.js';
import { authPlugin, rawBodyPlugin } from './plugins/index.js';
import { HealthScoreWorker, ReminderWorker, MarketSyncWorker } from './workers/index.js';

// Initialize logger
const logger: Logger = createLogger({
  name: 'cockpit-svc',
  level: process.env.LOG_LEVEL || 'info',
});

// Initialize Prisma
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (err) => {
  logger.error({ error: err.message }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

// Initialize workers
const healthScoreWorker = new HealthScoreWorker(prisma, redis, logger);
const reminderWorker = new ReminderWorker(
  prisma,
  redis,
  logger,
  undefined,
  async (notification) => {
    // TODO: Integrate with notification-svc to send actual notifications
    logger.info(
      {
        reminderId: notification.reminderId,
        freelancerUserId: notification.freelancerUserId,
        title: notification.title,
        isOverdue: notification.isOverdue,
      },
      'Reminder notification'
    );
  }
);
const marketSyncWorker = new MarketSyncWorker(prisma, redis, logger);

const server = Fastify({
  logger: true,
});

// Health check
server.get('/health', () => {
  return { status: 'ok', service: 'cockpit-svc' };
});

// Ready check
server.get('/ready', async () => {
  const checks = {
    database: false,
    redis: false,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    // Database not ready
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch {
    // Redis not ready
  }

  const allReady = Object.values(checks).every(Boolean);

  return {
    status: allReady ? 'ready' : 'not_ready',
    checks,
  };
});

const start = async () => {
  try {
    // Register raw body plugin for webhook signature verification
    // Must be registered before routes to override content type parser
    await server.register(rawBodyPlugin, {
      routes: ['/webhooks/'],
    });
    logger.info('Raw body plugin registered for webhook routes');

    // Register authentication plugin globally
    await server.register(authPlugin, { logger });
    logger.info('Authentication plugin registered');

    // Register CRM routes under /api/cockpit prefix (protected by auth)
    await server.register(
      async (instance) => {
        // Add global authentication hook for all routes in this scope
        instance.addHook('preHandler', async (request, reply) => {
          // Skip auth for health/ready endpoints (already defined outside this scope)
          // and for public booking routes
          if (request.url.includes('/public/')) {
            return;
          }
          // Skip auth for webhook routes - they use signature verification instead
          if (request.url.includes('/webhooks/')) {
            return;
          }
          await instance.authenticate(request, reply);
        });

        await registerRoutes(instance, { prisma, redis, logger });
      },
      { prefix: '/api/cockpit' }
    );

    await server.listen({ port: 4005, host: '0.0.0.0' });
    logger.info('Cockpit service started on port 4005');

    // Start background workers
    if (process.env.ENABLE_WORKERS !== 'false') {
      healthScoreWorker.start();
      reminderWorker.start();
      marketSyncWorker.start();
      logger.info('Background workers started');
    }
  } catch (err) {
    logger.error({ error: err }, 'Failed to start server');
    throw err;
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down...');

  // Stop workers
  healthScoreWorker.stop();
  reminderWorker.stop();
  marketSyncWorker.stop();

  await server.close();
  await prisma.$disconnect();
  redis.disconnect();

  logger.info('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

void start();

export { server, prisma, redis, logger };
