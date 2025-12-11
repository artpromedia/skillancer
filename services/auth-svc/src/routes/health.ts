/**
 * @module @skillancer/auth-svc/routes/health
 * Health check routes
 */

import { prisma } from '@skillancer/database';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /health - Basic health check
 */
function healthHandler(_request: FastifyRequest, reply: FastifyReply): void {
  void reply.status(200).send({
    status: 'ok',
    service: 'auth-svc',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /health/ready - Readiness check (checks dependencies)
 */
async function readyHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Check database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['database'] = {
      status: 'healthy',
      latencyMs: Date.now() - dbStart,
    };
  } catch (error) {
    checks['database'] = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Redis (via session service or cache)
  // Note: This would need the Redis client to be accessible
  // For now, we'll skip this check as it requires service initialization

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  void reply.status(allHealthy ? 200 : 503).send({
    status: allHealthy ? 'ready' : 'not_ready',
    service: 'auth-svc',
    timestamp: new Date().toISOString(),
    checks,
  });
}

/**
 * GET /health/live - Liveness check
 */
function liveHandler(_request: FastifyRequest, reply: FastifyReply): void {
  void reply.status(200).send({
    status: 'alive',
    service: 'auth-svc',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

/**
 * Register health check routes
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Basic health check',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    healthHandler
  );

  fastify.get(
    '/health/ready',
    {
      schema: {
        description: 'Readiness check (verifies all dependencies)',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              timestamp: { type: 'string' },
              checks: { type: 'object' },
            },
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              timestamp: { type: 'string' },
              checks: { type: 'object' },
            },
          },
        },
      },
    },
    readyHandler
  );

  fastify.get(
    '/health/live',
    {
      schema: {
        description: 'Liveness check',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              memoryUsage: { type: 'object' },
            },
          },
        },
      },
    },
    liveHandler
  );
}
