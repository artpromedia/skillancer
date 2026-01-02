/**
 * Health Check Routes for Notification Service
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { PushService } from '../services/push.service.js';

const prisma = new PrismaClient();
const pushService = new PushService();

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic health check
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'healthy',
      service: 'notification-svc',
      timestamp: new Date().toISOString(),
    });
  });

  // Detailed health check
  fastify.get('/health/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // Database check
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

    // SendGrid check (basic - just config availability)
    checks.sendgrid = {
      status: process.env.SENDGRID_API_KEY ? 'configured' : 'not_configured',
    };

    // Firebase check
    checks.firebase = {
      status: pushService.isConfigured() ? 'configured' : 'not_configured',
    };

    const overallStatus = Object.values(checks).every(
      (c) => c.status === 'healthy' || c.status === 'configured'
    )
      ? 'healthy'
      : 'degraded';

    return reply.send({
      status: overallStatus,
      service: 'notification-svc',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    });
  });

  // Readiness check
  fastify.get('/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({ ready: true });
    } catch (error: any) {
      return reply.status(503).send({ ready: false, error: error.message });
    }
  });

  // Liveness check
  fastify.get('/live', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ alive: true });
  });
}
