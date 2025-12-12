/**
 * @module @skillancer/audit-svc/routes/analytics
 * Analytics and dashboard routes
 */

import {
  getDashboardStats,
  getAnalytics,
  detectAnomalies,
} from '../services/audit-analytics.service.js';
import { getStorageStats, verifyIntegrityChain } from '../services/audit-maintenance.service.js';

import type { AuditSearchFilters, AuditCategory } from '../types/index.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface DashboardQuerystring {
  startDate?: string;
  endDate?: string;
  eventCategories?: string;
}

interface MetricsQuerystring {
  metricType: string;
  startDate: string;
  endDate: string;
}

interface IntegrityQuerystring {
  startDate: string;
  endDate: string;
}

interface AnomalyBody {
  actorId: string;
  eventType: string;
  count: number;
}

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: DashboardQuerystring }>(
    '/dashboard',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:read')],
    },
    async (request: FastifyRequest<{ Querystring: DashboardQuerystring }>, reply: FastifyReply) => {
      const { startDate, endDate, eventCategories } = request.query;

      const filters: AuditSearchFilters = {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        eventCategories: eventCategories?.split(',') as AuditCategory[] | undefined,
      };

      const stats = await getDashboardStats(filters);
      return reply.send(stats);
    }
  );

  app.get<{ Querystring: MetricsQuerystring }>(
    '/metrics',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:read')],
    },
    async (request: FastifyRequest<{ Querystring: MetricsQuerystring }>, reply: FastifyReply) => {
      const { metricType, startDate, endDate } = request.query;

      if (!metricType || !startDate || !endDate) {
        return reply.status(400).send({
          error: 'metricType, startDate, and endDate are required',
        });
      }

      const analytics = await getAnalytics(metricType, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      return reply.send({ metricType, data: analytics });
    }
  );

  app.get(
    '/storage',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:admin')],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const stats = await getStorageStats();
      return reply.send(stats);
    }
  );

  app.get<{ Querystring: IntegrityQuerystring }>(
    '/integrity',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:admin')],
    },
    async (request: FastifyRequest<{ Querystring: IntegrityQuerystring }>, reply: FastifyReply) => {
      const { startDate, endDate } = request.query;

      if (!startDate || !endDate) {
        return reply.status(400).send({
          error: 'startDate and endDate are required',
        });
      }

      const result = await verifyIntegrityChain(new Date(startDate), new Date(endDate));

      return reply.send(result);
    }
  );

  app.post<{ Body: AnomalyBody }>(
    '/anomaly/check',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:read')],
    },
    async (request: FastifyRequest<{ Body: AnomalyBody }>, reply: FastifyReply) => {
      const { actorId, eventType, count } = request.body;

      if (!actorId || !eventType || count === undefined) {
        return reply.status(400).send({
          error: 'actorId, eventType, and count are required',
        });
      }

      const result = await detectAnomalies(actorId, eventType, count);
      return reply.send(result);
    }
  );
}
