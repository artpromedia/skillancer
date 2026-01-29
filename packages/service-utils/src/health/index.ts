/**
 * @module @skillancer/service-utils/health
 * Standardized health check routes for Kubernetes-native microservices
 *
 * Provides three endpoint types:
 * - /health - Basic health check
 * - /health/ready - Readiness probe (checks dependencies)
 * - /health/live - Liveness probe (checks process health)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';

// ==================== Types ====================

export interface HealthCheckConfig {
  /** Service name for identification */
  serviceName: string;
  /** Service version */
  version: string;
  /** Optional Redis client for cache health check */
  redis?: Redis;
  /** Optional database health check function */
  checkDatabase?: () => Promise<HealthCheckResult>;
  /** Optional custom health checks */
  customChecks?: Record<string, () => Promise<HealthCheckResult>>;
  /** Timeout for individual checks in ms (default: 5000) */
  checkTimeout?: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
}

export interface ReadinessResponse {
  ready: boolean;
  checks: Record<string, HealthCheckResult>;
  timestamp: string;
}

export interface LivenessResponse {
  alive: boolean;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  timestamp: string;
}

// ==================== Health Check Utilities ====================

/**
 * Run a health check with timeout
 */
async function runCheckWithTimeout(
  name: string,
  check: () => Promise<HealthCheckResult>,
  timeout: number
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const result = await Promise.race([
      check(),
      new Promise<HealthCheckResult>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), timeout)
      ),
    ]);

    return {
      ...result,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(redis: Redis): Promise<HealthCheckResult> {
  try {
    const start = Date.now();
    await redis.ping();
    return {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

// ==================== Route Schemas ====================

const healthSchema = {
  tags: ['Health'],
  summary: 'Basic health check',
  description: 'Returns basic service health status',
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
        service: { type: 'string' },
        version: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Uptime in seconds' },
      },
      required: ['status', 'service', 'version', 'timestamp', 'uptime'],
    },
  },
};

const readinessSchema = {
  tags: ['Health'],
  summary: 'Readiness probe',
  description: 'Checks if the service is ready to accept traffic (Kubernetes readiness probe)',
  response: {
    200: {
      type: 'object',
      properties: {
        ready: { type: 'boolean' },
        checks: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
              latency: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['ready', 'checks', 'timestamp'],
    },
    503: {
      type: 'object',
      properties: {
        ready: { type: 'boolean' },
        checks: { type: 'object' },
        timestamp: { type: 'string' },
      },
    },
  },
};

const livenessSchema = {
  tags: ['Health'],
  summary: 'Liveness probe',
  description: 'Checks if the service process is alive (Kubernetes liveness probe)',
  response: {
    200: {
      type: 'object',
      properties: {
        alive: { type: 'boolean' },
        uptime: { type: 'number' },
        memory: {
          type: 'object',
          properties: {
            heapUsed: { type: 'number' },
            heapTotal: { type: 'number' },
            external: { type: 'number' },
            rss: { type: 'number' },
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['alive', 'uptime', 'memory', 'timestamp'],
    },
  },
};

// ==================== Plugin Registration ====================

/**
 * Register standardized health check routes
 *
 * @example
 * ```ts
 * import { registerHealthRoutes } from '@skillancer/service-utils/health';
 *
 * await registerHealthRoutes(app, {
 *   serviceName: 'auth-svc',
 *   version: '1.0.0',
 *   redis: redisClient,
 *   checkDatabase: async () => {
 *     await prisma.$queryRaw`SELECT 1`;
 *     return { status: 'healthy' };
 *   },
 * });
 * ```
 */
export async function registerHealthRoutes(
  app: FastifyInstance,
  config: HealthCheckConfig
): Promise<void> {
  const {
    serviceName,
    version,
    redis,
    checkDatabase,
    customChecks = {},
    checkTimeout = 5000,
  } = config;

  // Basic health check
  app.get(
    '/health',
    { schema: healthSchema },
    async (_request: FastifyRequest, _reply: FastifyReply): Promise<HealthResponse> => {
      return {
        status: 'ok',
        service: serviceName,
        version,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    }
  );

  // Readiness probe
  app.get(
    '/health/ready',
    { schema: readinessSchema },
    async (_request: FastifyRequest, reply: FastifyReply): Promise<ReadinessResponse> => {
      const checks: Record<string, HealthCheckResult> = {};

      // Database check
      if (checkDatabase) {
        checks.database = await runCheckWithTimeout('database', checkDatabase, checkTimeout);
      }

      // Redis check
      if (redis) {
        checks.redis = await runCheckWithTimeout('redis', () => checkRedis(redis), checkTimeout);
      }

      // Custom checks
      for (const [name, check] of Object.entries(customChecks)) {
        checks[name] = await runCheckWithTimeout(name, check, checkTimeout);
      }

      const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
      const anyUnhealthy = Object.values(checks).some((c) => c.status === 'unhealthy');

      const response: ReadinessResponse = {
        ready: allHealthy || Object.keys(checks).length === 0,
        checks,
        timestamp: new Date().toISOString(),
      };

      if (anyUnhealthy) {
        reply.status(503);
      }

      return response;
    }
  );

  // Liveness probe
  app.get(
    '/health/live',
    { schema: livenessSchema },
    async (_request: FastifyRequest, _reply: FastifyReply): Promise<LivenessResponse> => {
      const memory = process.memoryUsage();

      return {
        alive: true,
        uptime: process.uptime(),
        memory: {
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
          rss: memory.rss,
        },
        timestamp: new Date().toISOString(),
      };
    }
  );
}

/**
 * Fastify plugin wrapper for health routes
 */
export function healthRoutesPlugin(config: HealthCheckConfig) {
  return async function (app: FastifyInstance): Promise<void> {
    await registerHealthRoutes(app, config);
  };
}

export default registerHealthRoutes;
