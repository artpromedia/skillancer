import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'healthy',
      service: 'talent-graph-svc',
      timestamp: new Date().toISOString(),
    });
  });

  fastify.get('/health/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
      };
    } catch (error: any) {
      checks.database = {
        status: 'unhealthy',
        latency: Date.now() - dbStart,
        error: error.message,
      };
    }

    const overallStatus = Object.values(checks).every((c) => c.status === 'healthy')
      ? 'healthy'
      : 'degraded';

    return reply.send({
      status: overallStatus,
      service: 'talent-graph-svc',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    });
  });

  fastify.get('/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ ready: true });
    } catch (error: any) {
      return reply.status(503).send({ ready: false, error: error.message });
    }
  });

  fastify.get('/live', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ alive: true });
  });
}
