/**
 * @module @skillancer/api-gateway/routes/health
 * Health check routes
 */

import { getConfig } from '../config/index.js';
import { getServiceRoutes } from '../config/routes.js';
import { getAllCircuitBreakerStats } from '../utils/circuit-breaker.js';

import type { FastifyInstance } from 'fastify';

interface ServiceHealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  error?: string;
}

export function healthRoutes(
  app: FastifyInstance,
  _opts: Record<string, never>,
  done: (err?: Error) => void
): void {
  const config = getConfig();

  /**
   * Basic health check - is the gateway running?
   */
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Basic health check',
        description: 'Returns OK if the gateway is running',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              version: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    () => ({
      status: 'ok',
      service: config.service.name,
      version: config.service.version,
      timestamp: new Date().toISOString(),
    })
  );

  /**
   * Readiness probe - is the gateway ready to handle traffic?
   */
  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['health'],
        summary: 'Readiness probe',
        description: 'Checks if the gateway is ready to handle requests',
        response: {
          200: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              services: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    latency: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const serviceRoutes = getServiceRoutes();
      const checks: Record<string, ServiceHealthCheck> = {};

      // Check each downstream service
      const checkPromises = serviceRoutes.map(async (route) => {
        const startTime = Date.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`${route.upstream}/health`, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const latency = Date.now() - startTime;

          if (response.ok) {
            checks[route.serviceName] = {
              name: route.serviceName,
              status: 'healthy',
              latency,
            };
          } else {
            checks[route.serviceName] = {
              name: route.serviceName,
              status: 'degraded',
              latency,
              error: `HTTP ${response.status}`,
            };
          }
        } catch (error) {
          checks[route.serviceName] = {
            name: route.serviceName,
            status: 'unhealthy',
            latency: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      await Promise.allSettled(checkPromises);

      const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
      const anyHealthy = Object.values(checks).some((c) => c.status === 'healthy');

      return {
        ready: anyHealthy,
        status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
        services: checks,
        timestamp: new Date().toISOString(),
      };
    }
  );

  /**
   * Liveness probe - is the gateway process alive?
   */
  app.get(
    '/health/live',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness probe',
        description: 'Checks if the gateway process is alive',
        response: {
          200: {
            type: 'object',
            properties: {
              alive: { type: 'boolean' },
              uptime: { type: 'number' },
            },
          },
        },
      },
    },
    () => ({
      alive: true,
      uptime: process.uptime(),
    })
  );

  /**
   * System-wide health dashboard
   * Aggregates health from all services with detailed metrics
   */
  app.get(
    '/health/dashboard',
    {
      schema: {
        tags: ['health'],
        summary: 'System health dashboard',
        description: 'Returns comprehensive health status of all services including moat features',
        response: {
          200: {
            type: 'object',
            properties: {
              overall: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              memory: { type: 'object' },
              coreServices: { type: 'object' },
              moatServices: { type: 'object' },
              infrastructure: { type: 'object' },
            },
          },
        },
      },
    },
    async () => {
      const serviceRoutes = getServiceRoutes();

      // Categorize services
      const coreServiceNames = ['auth', 'market', 'skillpod', 'cockpit', 'billing', 'notification'];
      const moatServiceNames = [
        'executive',
        'financial',
        'talent-graph',
        'intelligence',
        'copilot',
      ];

      const checkService = async (route: (typeof serviceRoutes)[0]) => {
        const startTime = Date.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`${route.upstream}/health`, {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const latency = Date.now() - startTime;

          let details = {};
          try {
            details = await response.json();
          } catch {
            // Ignore JSON parse errors
          }

          return {
            name: route.serviceName,
            status: response.ok ? 'healthy' : 'degraded',
            latency,
            url: route.upstream,
            details,
          };
        } catch (error) {
          return {
            name: route.serviceName,
            status: 'unhealthy',
            latency: Date.now() - startTime,
            url: route.upstream,
            error: error instanceof Error ? error.message : 'Connection failed',
          };
        }
      };

      // Check all services in parallel
      const results = await Promise.all(serviceRoutes.map(checkService));

      // Organize by category
      const coreServices: Record<string, any> = {};
      const moatServices: Record<string, any> = {};

      results.forEach((result) => {
        if (coreServiceNames.includes(result.name)) {
          coreServices[result.name] = result;
        } else if (moatServiceNames.includes(result.name)) {
          moatServices[result.name] = result;
        }
      });

      // Calculate overall status
      const allResults = Object.values({ ...coreServices, ...moatServices });
      const healthyCount = allResults.filter((r) => r.status === 'healthy').length;
      const totalCount = allResults.length;
      const healthPercentage = (healthyCount / totalCount) * 100;

      let overall: 'healthy' | 'degraded' | 'critical' | 'down';
      if (healthPercentage === 100) {
        overall = 'healthy';
      } else if (healthPercentage >= 80) {
        overall = 'degraded';
      } else if (healthPercentage >= 50) {
        overall = 'critical';
      } else {
        overall = 'down';
      }

      // Memory usage
      const memUsage = process.memoryUsage();

      return {
        overall,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: config.service.version,
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          unit: 'MB',
        },
        summary: {
          total: totalCount,
          healthy: healthyCount,
          unhealthy: totalCount - healthyCount,
          healthPercentage: Math.round(healthPercentage),
        },
        coreServices,
        moatServices,
        circuitBreakers: getAllCircuitBreakerStats(),
      };
    }
  );

  /**
   * Circuit breaker status
   */
  app.get(
    '/health/circuits',
    {
      schema: {
        tags: ['health'],
        summary: 'Circuit breaker status',
        description: 'Returns the status of all circuit breakers',
        response: {
          200: {
            type: 'object',
            properties: {
              circuits: {
                type: 'object',
                additionalProperties: {
                  type: 'object',
                  properties: {
                    state: { type: 'string' },
                    failures: { type: 'number' },
                    successes: { type: 'number' },
                    errorPercentage: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    () => ({
      circuits: getAllCircuitBreakerStats(),
      timestamp: new Date().toISOString(),
    })
  );

  done();
}
