// @skillancer/cockpit-svc
// Cockpit integrations and business logic service

import Fastify from 'fastify';
import { PrismaClient } from '@skillancer/database';
import { createLogger, type Logger } from '@skillancer/logger';
import { Redis } from 'ioredis';

import { registerRoutes } from './routes/index.js';
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
    // Register CRM routes under /api/cockpit prefix
    await server.register(
      async (instance) => {
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
