/**
 * @module @skillancer/audit-svc/routes/export
 * Export and GDPR routes
 */

import {
  createExport,
  processExport,
  getExport,
  listExports,
} from '../services/audit-export.service.js';
import { processGDPRDeletion, generateGDPRDataExport } from '../services/data-redaction.service.js';
import { ExportFormat } from '../types/index.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface CreateExportBody {
  filters: Record<string, unknown>;
  format: ExportFormat;
  includeFields?: string[];
}

interface ExportIdParams {
  id: string;
}

interface ListExportsQuerystring {
  page?: string;
  pageSize?: string;
}

interface GDPRDeleteBody {
  subjectId: string;
  reason: string;
}

interface GDPRExportParams {
  subjectId: string;
}

export function registerExportRoutes(app: FastifyInstance): void {
  app.post<{ Body: CreateExportBody }>(
    '/',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:export')],
    },
    async (request: FastifyRequest<{ Body: CreateExportBody }>, reply: FastifyReply) => {
      const { filters, format, includeFields } = request.body;

      if (!filters || !format) {
        return reply.status(400).send({
          error: 'filters and format are required',
        });
      }

      if (!Object.values(ExportFormat).includes(format)) {
        return reply.status(400).send({
          error: `Invalid format. Must be one of: ${Object.values(ExportFormat).join(', ')}`,
        });
      }

      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const exportRecord = await createExport({
        requestedBy: userId,
        filters,
        format,
        includeFields,
      });

      setImmediate(() => {
        processExport(exportRecord.id).catch((err) => {
          console.error(`[EXPORT] Failed to process export ${exportRecord.id}:`, err);
        });
      });

      return reply.status(202).send(exportRecord);
    }
  );

  app.get<{ Params: ExportIdParams }>(
    '/:id',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:export')],
    },
    async (request: FastifyRequest<{ Params: ExportIdParams }>, reply: FastifyReply) => {
      const exportRecord = await getExport(request.params.id);
      if (!exportRecord) {
        return reply.status(404).send({ error: 'Export not found' });
      }

      if (exportRecord.requestedBy !== request.user?.id) {
        const hasAdminPermission = request.user?.permissions?.includes('audit:admin');
        if (!hasAdminPermission) {
          return reply.status(403).send({ error: 'Access denied' });
        }
      }

      return reply.send(exportRecord);
    }
  );

  app.get<{ Querystring: ListExportsQuerystring }>(
    '/',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:export')],
    },
    async (
      request: FastifyRequest<{ Querystring: ListExportsQuerystring }>,
      reply: FastifyReply
    ) => {
      const { page, pageSize } = request.query;

      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const result = await listExports(userId, {
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      });

      return reply.send(result);
    }
  );

  app.post<{ Body: GDPRDeleteBody }>(
    '/gdpr/delete',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:gdpr')],
    },
    async (request: FastifyRequest<{ Body: GDPRDeleteBody }>, reply: FastifyReply) => {
      const { subjectId, reason } = request.body;

      if (!subjectId || !reason) {
        return reply.status(400).send({
          error: 'subjectId and reason are required',
        });
      }

      const result = await processGDPRDeletion(subjectId, reason);
      return reply.send(result);
    }
  );

  app.get<{ Params: GDPRExportParams }>(
    '/gdpr/export/:subjectId',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:gdpr')],
    },
    async (request: FastifyRequest<{ Params: GDPRExportParams }>, reply: FastifyReply) => {
      const { subjectId } = request.params;

      const result = await generateGDPRDataExport(subjectId);
      return reply.send(result);
    }
  );
}
