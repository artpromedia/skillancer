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
