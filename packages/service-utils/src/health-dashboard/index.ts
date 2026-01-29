/**
 * @module @skillancer/service-utils/health-dashboard
 * Comprehensive health check dashboard for monitoring all services
 *
 * Features:
 * - Aggregated health status from all services
 * - Database connectivity check
 * - Redis connectivity check
 * - External service dependencies
 * - System metrics (memory, CPU)
 *
 * @example
 * ```typescript
 * import { healthDashboardPlugin } from '@skillancer/service-utils';
 *
 * app.register(healthDashboardPlugin, {
 *   services: ['auth-svc', 'billing-svc'],
 *   redis: redisClient,
 *   prisma: prismaClient,
 * });
 * ```
 */

import fp from 'fastify-plugin';
import os from 'os';

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  latency?: number;
  version?: string;
  lastCheck: Date;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemMetrics {
  uptime: number;
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  cpu: {
    count: number;
    loadAvg: number[];
    usage?: number;
  };
  nodejs: {
    version: string;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  };
}

export interface DependencyHealth {
  database: ServiceHealth;
  redis: ServiceHealth;
  external: ServiceHealth[];
}

export interface HealthDashboard {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  version: string;
  environment: string;
  services: ServiceHealth[];
  dependencies: DependencyHealth;
  system: SystemMetrics;
  checks: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export interface HealthDashboardConfig {
  /** Service name */
  serviceName: string;
  /** Service version */
  version: string;
  /** Environment name */
  environment: string;
  /** Redis client for connectivity check */
  redis?: any;
  /** Prisma client for database check */
  prisma?: any;
  /** Internal service URLs to check */
  services?: Array<{
    name: string;
    url: string;
    timeout?: number;
  }>;
  /** External service URLs to check */
  externalServices?: Array<{
    name: string;
    url: string;
    timeout?: number;
  }>;
  /** Dashboard route prefix */
  routePrefix?: string;
  /** Require authentication */
  requireAuth?: boolean;
  /** Custom checks */
  customChecks?: Array<{
    name: string;
    check: () => Promise<ServiceHealth>;
  }>;
}

// =============================================================================
// HEALTH CHECK UTILITIES
// =============================================================================

/**
 * Check database health
 */
async function checkDatabase(prisma: any): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      name: 'database',
      status: latency < 100 ? 'healthy' : 'degraded',
      latency,
      lastCheck: new Date(),
      message: latency < 100 ? 'Connected' : 'Slow response',
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency: Date.now() - start,
      lastCheck: new Date(),
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedis(redis: any): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    await redis.ping();
    const latency = Date.now() - start;

    return {
      name: 'redis',
      status: latency < 50 ? 'healthy' : 'degraded',
      latency,
      lastCheck: new Date(),
      message: latency < 50 ? 'Connected' : 'Slow response',
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'unhealthy',
      latency: Date.now() - start,
      lastCheck: new Date(),
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check external service health
 */
async function checkService(name: string, url: string, timeout = 5000): Promise<ServiceHealth> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${url}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - start;

    if (response.ok) {
      const data = await response.json().catch(() => ({}));

      return {
        name,
        status: 'healthy',
        latency,
        version: data.version,
        lastCheck: new Date(),
        message: 'Service responding',
        details: data,
      };
    }

    return {
      name,
      status: response.status < 500 ? 'degraded' : 'unhealthy',
      latency,
      lastCheck: new Date(),
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    return {
      name,
      status: 'unhealthy',
      latency: Date.now() - start,
      lastCheck: new Date(),
      message: error instanceof Error ? error.message : 'Request failed',
    };
  }
}

/**
 * Get system metrics
 */
function getSystemMetrics(): SystemMetrics {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  return {
    uptime: os.uptime(),
    memory: {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percentage: Math.round((usedMemory / totalMemory) * 100),
    },
    cpu: {
      count: os.cpus().length,
      loadAvg: os.loadavg(),
    },
    nodejs: {
      version: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    },
  };
}

/**
 * Calculate overall status from checks
 */
function calculateOverallStatus(services: ServiceHealth[]): 'healthy' | 'unhealthy' | 'degraded' {
  const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;

  if (unhealthyCount > 0) return 'unhealthy';
  if (degradedCount > 0) return 'degraded';
  return 'healthy';
}

// =============================================================================
// FASTIFY PLUGIN
// =============================================================================

const healthDashboardPluginImpl: FastifyPluginAsync<HealthDashboardConfig> = async (
  app: FastifyInstance,
  config: HealthDashboardConfig
): Promise<void> => {
  const routePrefix = config.routePrefix ?? '/health';

  // Simple health check (for load balancers)
  app.get(`${routePrefix}`, {
    schema: {
      description: 'Simple health check',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
    handler: async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  });

  // Liveness probe (for Kubernetes)
  app.get(`${routePrefix}/live`, {
    schema: {
      description: 'Liveness probe - is the service running?',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
    handler: async () => ({ status: 'alive' }),
  });

  // Readiness probe (for Kubernetes)
  app.get(`${routePrefix}/ready`, {
    schema: {
      description: 'Readiness probe - is the service ready to accept traffic?',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            checks: { type: 'object' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            checks: { type: 'object' },
          },
        },
      },
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      const checks: Record<string, boolean> = {};
      let ready = true;

      // Check database
      if (config.prisma) {
        try {
          await config.prisma.$queryRaw`SELECT 1`;
          checks.database = true;
        } catch {
          checks.database = false;
          ready = false;
        }
      }

      // Check Redis
      if (config.redis) {
        try {
          await config.redis.ping();
          checks.redis = true;
        } catch {
          checks.redis = false;
          ready = false;
        }
      }

      const response = {
        status: ready ? 'ready' : 'not-ready',
        checks,
      };

      return reply.status(ready ? 200 : 503).send(response);
    },
  });

  // Full dashboard
  app.get(`${routePrefix}/dashboard`, {
    schema: {
      description: 'Comprehensive health dashboard with all service statuses',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            version: { type: 'string' },
            environment: { type: 'string' },
            services: { type: 'array' },
            dependencies: { type: 'object' },
            system: { type: 'object' },
            checks: { type: 'object' },
          },
        },
      },
    },
    handler: async () => {
      const allServices: ServiceHealth[] = [];

      // Check database
      let databaseHealth: ServiceHealth = {
        name: 'database',
        status: 'unknown',
        lastCheck: new Date(),
      };
      if (config.prisma) {
        databaseHealth = await checkDatabase(config.prisma);
        allServices.push(databaseHealth);
      }

      // Check Redis
      let redisHealth: ServiceHealth = {
        name: 'redis',
        status: 'unknown',
        lastCheck: new Date(),
      };
      if (config.redis) {
        redisHealth = await checkRedis(config.redis);
        allServices.push(redisHealth);
      }

      // Check internal services
      const serviceChecks: ServiceHealth[] = [];
      if (config.services) {
        const checks = await Promise.all(
          config.services.map((s) => checkService(s.name, s.url, s.timeout))
        );
        serviceChecks.push(...checks);
        allServices.push(...checks);
      }

      // Check external services
      const externalChecks: ServiceHealth[] = [];
      if (config.externalServices) {
        const checks = await Promise.all(
          config.externalServices.map((s) => checkService(s.name, s.url, s.timeout))
        );
        externalChecks.push(...checks);
        allServices.push(...checks);
      }

      // Run custom checks
      if (config.customChecks) {
        const checks = await Promise.all(config.customChecks.map((c) => c.check()));
        allServices.push(...checks);
      }

      // Calculate totals
      const checks = {
        total: allServices.length,
        healthy: allServices.filter((s) => s.status === 'healthy').length,
        unhealthy: allServices.filter((s) => s.status === 'unhealthy').length,
        degraded: allServices.filter((s) => s.status === 'degraded').length,
      };

      const dashboard: HealthDashboard = {
        status: calculateOverallStatus(allServices),
        timestamp: new Date(),
        version: config.version,
        environment: config.environment,
        services: serviceChecks,
        dependencies: {
          database: databaseHealth,
          redis: redisHealth,
          external: externalChecks,
        },
        system: getSystemMetrics(),
        checks,
      };

      return dashboard;
    },
  });

  app.log.info(`[Health] Dashboard available at ${routePrefix}/dashboard`);
};

export const healthDashboardPlugin = fp(healthDashboardPluginImpl, {
  name: 'health-dashboard-plugin',
});

// =============================================================================
// STANDALONE FUNCTIONS
// =============================================================================

export { checkDatabase, checkRedis, checkService, getSystemMetrics, calculateOverallStatus };

export default {
  healthDashboardPlugin,
  checkDatabase,
  checkRedis,
  checkService,
  getSystemMetrics,
};
