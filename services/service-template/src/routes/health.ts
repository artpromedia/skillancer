/**
 * Health check routes
 */

import { getConfig } from '../config/index.js';

import type { FastifyInstance } from 'fastify';

export function healthRoutes(
  app: FastifyInstance,
  _opts: Record<string, never>,
  done: (err?: Error) => void
): void {
  const config = getConfig();

  // Basic health check
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Basic health check',
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

  // Readiness probe (for Kubernetes)
  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description: 'Checks if the service is ready to accept traffic',
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
    () => {
      // Add custom health checks here (database, redis, etc.)
      const checks: Record<string, { status: string; latency?: number }> = {};

      // Example: Database check
      // const dbStart = Date.now();
      // try {
      //   await db.query('SELECT 1');
      //   checks.database = { status: 'healthy', latency: Date.now() - dbStart };
      // } catch {
      //   checks.database = { status: 'unhealthy' };
      // }

      const allHealthy = Object.values(checks).every((check) => check.status === 'healthy');

      return {
        ready: allHealthy || Object.keys(checks).length === 0,
        checks,
      };
    }
  );

  // Liveness probe (for Kubernetes)
  app.get(
    '/health/live',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Checks if the service is alive',
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

  done();
}
