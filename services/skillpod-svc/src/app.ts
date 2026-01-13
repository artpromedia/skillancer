// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/app
 * Fastify application factory for SkillPod VDI service
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/consistent-type-imports */

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import websocket from '@fastify/websocket';
import { PrismaClient } from '@/types/prisma-shim.js';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { getConfig } from './config/index.js';
import { createContainmentMiddleware, createWatermarkMiddleware } from './middleware/index.js';
import {
  createLearningProfileRepository,
  createSkillGapRepository,
  createMarketActivitySignalRepository,
  createLearningRecommendationRepository,
  createLearningPathRepository,
  createMarketTrendRepository,
} from './repositories/recommendation/index.js';
import { createWatermarkRepository } from './repositories/watermark.repository.js';
import {
  containmentRoutes,
  securityPolicyRoutes,
  violationRoutes,
  transferOverrideRoutes,
  policyExceptionRoutes,
  killSwitchRoutes,
  recordingRoutes,
  watermarkRoutes,
  recommendationRoutes,
} from './routes/index.js';
import {
  createSecurityPolicyService,
  createViolationDetectionService,
  createDataContainmentService,
  createKasmWorkspacesService,
  createWebSocketEnforcementService,
  createScreenshotDetectionService,
  createKillSwitchService,
  createCdnService,
  createRecordingService,
  createSignalProcessorService,
  createRecommendationEngineService,
  createLearningPathGeneratorService,
} from './services/index.js';

import type { ScreenCaptureEvent } from './services/screenshot-detection.service.js';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface BuildAppOptions {
  redis: RedisType;
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

  await app.register(cors as any, {
    origin: true,
    credentials: true,
  });

  await app.register(helmet as any, {
    contentSecurityPolicy: false,
  });

  await app.register(sensible as any);

  await app.register(websocket as any);

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
  const kasmService = createKasmWorkspacesService();
  const wsService = createWebSocketEnforcementService(redis);
  const screenshotService = createScreenshotDetectionService(prisma, redis, kasmService, wsService);
  const cdnService = createCdnService();
  const killSwitchService = createKillSwitchService(
    prisma,
    redis,
    kasmService,
    wsService,
    cdnService
  );
  const recordingService = createRecordingService(prisma, redis, kasmService, {
    s3Bucket:
      config.service.environment === 'production'
        ? 'skillpod-recordings-prod'
        : 'skillpod-recordings-dev',
    s3Region: 'us-east-1',
    kmsKeyId: 'alias/skillpod-recordings',
    cloudfrontDomain:
      config.service.environment === 'production' ? 'd123.cloudfront.net' : undefined,
    ocrEnabled: true,
    ocrSampleIntervalSeconds: 30,
    elasticsearchEnabled: config.service.environment === 'production',
    elasticsearchUrl: 'http://localhost:9200',
    elasticsearchIndex: 'skillpod-recordings',
    defaultRetentionDays: 90,
    maxChunkSizeBytes: 50 * 1024 * 1024, // 50MB
    thumbnailGenerationEnabled: true,
  });

  // Create recommendation repositories
  const learningProfileRepo = createLearningProfileRepository(prisma, redis);
  const skillGapRepo = createSkillGapRepository(prisma, redis);
  const signalRepo = createMarketActivitySignalRepository(prisma, redis);
  const recommendationRepo = createLearningRecommendationRepository(prisma, redis);
  const learningPathRepo = createLearningPathRepository(prisma, redis);
  const marketTrendRepo = createMarketTrendRepository(prisma, redis);

  // Create recommendation services
  const signalProcessor = createSignalProcessorService({
    learningProfileRepo,
    skillGapRepo,
    signalRepo,
    marketTrendRepo,
    redis,
    logger: app.log as any,
  });

  const recommendationEngine = createRecommendationEngineService({
    learningProfileRepo,
    skillGapRepo,
    recommendationRepo,
    marketTrendRepo,
    redis,
    logger: app.log as any,
  });

  const learningPathGenerator = createLearningPathGeneratorService({
    learningProfileRepo,
    skillGapRepo,
    learningPathRepo,
    recommendationRepo,
    marketTrendRepo,
    redis,
    logger: app.log as any,
  });

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

      // Transfer override request routes
      transferOverrideRoutes(api, prisma, wsService);

      // Policy exception routes
      policyExceptionRoutes(api, prisma);

      // Kill switch routes
      api.register(killSwitchRoutes(killSwitchService));

      // Session recording routes
      api.register(recordingRoutes(recordingService));

      // Watermark routes
      const watermarkRepository = createWatermarkRepository(prisma);
      api.register(watermarkRoutes(watermarkRepository));

      // Learning recommendation routes
      recommendationRoutes(api, {
        learningProfileRepo,
        skillGapRepo,
        recommendationRepo,
        learningPathRepo,
        marketTrendRepo,
        recommendationEngine,
        learningPathGenerator,
        redis,
      });

      // Screenshot detection endpoint
      api.post('/screenshot-attempts', async (request) => {
        const body = request.body as {
          podId: string;
          sessionId: string;
          userId: string;
          captureType: string;
          detectionMethod: string;
          processInfo?: { name: string; pid: number };
          activeApplication?: string;
          activeWindow?: string;
        };

        const captureEvent: ScreenCaptureEvent = {
          podId: body.podId,
          sessionId: body.sessionId,
          userId: body.userId,
          captureType:
            body.captureType as import('./services/screenshot-detection.service.js').CaptureType,
          detectionMethod: body.detectionMethod,
        };
        if (body.processInfo) captureEvent.processInfo = body.processInfo;
        if (body.activeApplication) captureEvent.activeApplication = body.activeApplication;
        if (body.activeWindow) captureEvent.activeWindow = body.activeWindow;

        const result = await screenshotService.detectCaptureAttempt(captureEvent);

        return result;
      });

      // Screenshot stats endpoint
      api.get('/screenshot-stats', async (request) => {
        const query = request.query as {
          tenantId: string;
          startDate?: string;
          endDate?: string;
        };

        const startDate = query.startDate
          ? new Date(query.startDate)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = query.endDate ? new Date(query.endDate) : new Date();

        return screenshotService.getAttemptStats(query.tenantId, startDate, endDate);
      });
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

