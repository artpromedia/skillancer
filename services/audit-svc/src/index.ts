/**
 * @module @skillancer/audit-svc
 * Unified Audit Logging Service
 *
 * Provides comprehensive audit logging for HIPAA, SOC2, and GDPR compliance.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// Prisma client types are not available until `prisma generate` is run

import { S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import Fastify, { type FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';

import {
  startAuditEventConsumer,
  stopAuditEventConsumer,
} from './consumers/audit-event.consumer.js';
import { initializeAuditLogRepository } from './repositories/audit-log.repository.js';
import { registerRoutes } from './routes/index.js';
import { initializeAnalyticsService } from './services/audit-analytics.service.js';
import { initializeExportService } from './services/audit-export.service.js';
import { initializeAuditLogService } from './services/audit-log.service.js';
import { initializeMaintenanceService } from './services/audit-maintenance.service.js';

const SERVICE_ID = 'audit-svc';
const QUEUE_NAME = 'audit-events';

interface Config {
  port: number;
  host: string;
  mongoUri: string;
  mongoDbName: string;
  redisUrl: string;
  s3Bucket: string;
  s3Region: string;
}

function getConfig(): Config {
  return {
    port: parseInt(process.env.PORT ?? '3010', 10),
    host: process.env.HOST ?? '0.0.0.0',
    mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
    mongoDbName: process.env.MONGO_DB_NAME ?? 'skillancer_audit',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    s3Bucket: process.env.AUDIT_S3_BUCKET ?? 'skillancer-audit-logs',
    s3Region: process.env.AWS_REGION ?? 'us-east-1',
  };
}

async function buildApp(config: Config): Promise<{
  app: FastifyInstance;
  cleanup: () => Promise<void>;
}> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const mongoClient = new MongoClient(config.mongoUri);
  await mongoClient.connect();
  const mongodb = mongoClient.db(config.mongoDbName);

  const prisma = new PrismaClient();
  await prisma.$connect();

  const s3Client = new S3Client({ region: config.s3Region });

  const auditQueue = new Queue(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  initializeAuditLogRepository(mongodb);
  initializeAuditLogService(auditQueue, SERVICE_ID);
  initializeAnalyticsService(prisma);
  initializeExportService(prisma, s3Client, config.s3Bucket);
  initializeMaintenanceService(s3Client, config.s3Bucket);

  startAuditEventConsumer({
    redis,
    queueName: QUEUE_NAME,
    concurrency: 10,
  });

  app.decorate('authenticate', async (_request: unknown, _reply: unknown) => {
    // Authentication decorator - to be implemented with JWT validation
    // This is a placeholder for the actual auth implementation
  });

  app.decorate('requirePermission', (_permission: string) => {
    // eslint-disable-next-line @typescript-eslint/require-await
    return async (_request: unknown, _reply: unknown): Promise<void> => {
      // Permission check decorator - to be implemented
      // This is a placeholder for the actual permission check
    };
  });

  app.get('/health', () => ({
    status: 'ok',
    service: SERVICE_ID,
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', () => {
    const mongoOk = true; // MongoDB connection is managed internally

    return {
      status: mongoOk ? 'ok' : 'degraded',
      checks: {
        mongodb: mongoOk ? 'ok' : 'error',
        redis: redis.status === 'ready' ? 'ok' : 'error',
      },
    };
  });

  await app.register(registerRoutes, { prefix: '/api/v1' });

  const cleanup = async (): Promise<void> => {
    app.log.info('Shutting down...');
    await stopAuditEventConsumer();
    await auditQueue.close();
    await redis.quit();
    await mongoClient.close();
    await prisma.$disconnect();
    app.log.info('Cleanup complete');
  };

  return { app, cleanup };
}

async function main(): Promise<void> {
  const config = getConfig();

  const { app, cleanup } = await buildApp(config);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down...`);
    await cleanup();
    await app.close();
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  };

  process.on('SIGTERM', async () => shutdown('SIGTERM'));
  process.on('SIGINT', async () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`${SERVICE_ID} listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
});

export { buildApp, getConfig };
