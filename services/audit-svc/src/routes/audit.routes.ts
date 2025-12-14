/**
 * @module @skillancer/audit-svc/routes/audit
 * Audit log CRUD routes
 */

import { queueAuditLog, verifyIntegrity } from '../services/audit-log.service.js';
import {
  searchAuditLogs,
  getAuditLogById,
  getUserActivityTimeline,
  getResourceAuditTrail,
  getComplianceReport,
} from '../services/audit-query.service.js';

import type {
  AuditLogParams,
  AuditSearchFilters,
  AuditCategory,
  ActorType,
  OutcomeStatus,
} from '../types/index.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface SearchQuerystring {
  page?: string;
  pageSize?: string;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  eventCategories?: string;
  actorId?: string;
  actorType?: string;
  resourceType?: string;
  resourceId?: string;
  outcomeStatus?: string;
  complianceTags?: string;
  searchText?: string;
  sortField?: string;
  sortOrder?: string;
}

interface IdParams {
  id: string;
}

interface UserIdParams {
  userId: string;
}

interface ResourceParams {
  resourceType: string;
  resourceId: string;
}

interface ComplianceParams {
  tag: string;
}

interface ComplianceQuerystring {
  startDate: string;
  endDate: string;
}

export function registerAuditRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: SearchQuerystring }>(
    '/logs',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:read')],
    },
    async (request: FastifyRequest<{ Querystring: SearchQuerystring }>, reply: FastifyReply) => {
      const query = request.query;

      const filters: AuditSearchFilters = {
        page: query.page ? Number.parseInt(query.page, 10) : undefined,
        pageSize: query.pageSize ? Number.parseInt(query.pageSize, 10) : undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        eventType: query.eventType,
        eventCategories: query.eventCategories?.split(',') as AuditCategory[] | undefined,
        actorId: query.actorId,
        actorType: query.actorType as ActorType | undefined,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        outcomeStatus: query.outcomeStatus as OutcomeStatus | undefined,
        complianceTags: query.complianceTags?.split(','),
        searchText: query.searchText,
        sortField: query.sortField,
        sortOrder: query.sortOrder as 'asc' | 'desc' | undefined,
      };

      const result = await searchAuditLogs(filters);
      return reply.send(result);
    }
  );

  app.get<{ Params: IdParams }>(
    '/logs/:id',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:read')],
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const log = await getAuditLogById(request.params.id);
      if (!log) {
        return reply.status(404).send({ error: 'Audit log not found' });
      }
      return reply.send(log);
    }
  );

  app.get<{ Params: IdParams }>(
    '/logs/:id/verify',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:admin')],
    },
    async (request: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
      const log = await getAuditLogById(request.params.id);
      if (!log) {
        return reply.status(404).send({ error: 'Audit log not found' });
      }

      const isValid = verifyIntegrity(log);
      return reply.send({
        id: log.id,
        integrityValid: isValid,
        integrityHash: log.integrityHash,
        previousHash: log.previousHash,
      });
    }
  );

  app.post<{ Body: AuditLogParams }>(
    '/logs',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:write')],
    },
    async (request: FastifyRequest<{ Body: AuditLogParams }>, reply: FastifyReply) => {
      const jobId = await queueAuditLog(request.body);
      return reply.status(202).send({ jobId, message: 'Audit log queued' });
    }
  );

  app.get<{
    Params: UserIdParams;
    Querystring: { startDate?: string; endDate?: string; limit?: string };
  }>(
    '/users/:userId/timeline',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:read')],
    },
    async (
      request: FastifyRequest<{
        Params: UserIdParams;
        Querystring: { startDate?: string; endDate?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const { startDate, endDate, limit } = request.query;

      const timeline = await getUserActivityTimeline(userId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
      });

      return reply.send(timeline);
    }
  );

  app.get<{
    Params: ResourceParams;
    Querystring: { startDate?: string; endDate?: string; limit?: string };
  }>(
    '/resources/:resourceType/:resourceId/trail',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:read')],
    },
    async (
      request: FastifyRequest<{
        Params: ResourceParams;
        Querystring: { startDate?: string; endDate?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { resourceType, resourceId } = request.params;
      const { startDate, endDate, limit } = request.query;

      const trail = await getResourceAuditTrail(resourceType, resourceId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
      });

      return reply.send(trail);
    }
  );

  app.get<{ Params: ComplianceParams; Querystring: ComplianceQuerystring }>(
    '/compliance/:tag/report',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:compliance')],
    },
    async (
      request: FastifyRequest<{
        Params: ComplianceParams;
        Querystring: ComplianceQuerystring;
      }>,
      reply: FastifyReply
    ) => {
      const { tag } = request.params;
      const { startDate, endDate } = request.query;

      if (!startDate || !endDate) {
        return reply.status(400).send({ error: 'startDate and endDate are required' });
      }

      const report = await getComplianceReport(tag, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      return reply.send(report);
    }
  );
}
