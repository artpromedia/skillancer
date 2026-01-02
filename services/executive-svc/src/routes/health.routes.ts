/**
 * Health Check Routes
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@skillancer/database';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Basic health check
  app.get('/', async () => {
    return {
      status: 'ok',
      service: 'executive-svc',
      timestamp: new Date().toISOString(),
    };
  });

  // Detailed health check
  app.get('/ready', async () => {
    const checks: Record<string, { status: string; latency?: number }> = {};

    // Database check
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'ok',
        latency: Date.now() - dbStart,
      };
    } catch {
      checks.database = { status: 'error' };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

    return {
      status: allHealthy ? 'ok' : 'degraded',
      service: 'executive-svc',
      timestamp: new Date().toISOString(),
      checks,
    };
  });
}
