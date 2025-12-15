/**
 * @module @skillancer/audit-svc/routes/integrity
 * Audit log integrity verification routes
 */

import { verifyIntegrity } from '../services/audit-log.service.js';
import { verifyIntegrityChain, getStorageStats } from '../services/audit-maintenance.service.js';
import { getAuditLogById, searchAuditLogs } from '../services/audit-query.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface VerifyChainBody {
  startDate: string;
  endDate: string;
}

interface BatchVerifyBody {
  ids: string[];
}

interface IdParams {
  id: string;
}

export function registerIntegrityRoutes(app: FastifyInstance): void {
  /**
   * Verify the integrity of a single audit log entry
   * GET /integrity/:id
   */
  app.get<{ Params: IdParams }>(
    '/integrity/:id',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:admin')],
      schema: {
        description: 'Verify the integrity of a single audit log entry',
        tags: ['Integrity'],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Audit log ID' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              integrityValid: { type: 'boolean' },
              integrityHash: { type: 'string' },
              previousHash: { type: 'string', nullable: true },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
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
        previousHash: log.previousHash ?? null,
        timestamp: log.timestamp.toISOString(),
      });
    }
  );

  /**
   * Verify the integrity hash chain for a date range
   * POST /integrity/chain/verify
   */
  app.post<{ Body: VerifyChainBody }>(
    '/integrity/chain/verify',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:admin')],
      schema: {
        description: 'Verify the integrity hash chain for a date range',
        tags: ['Integrity'],
        body: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
          required: ['startDate', 'endDate'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              totalChecked: { type: 'number' },
              brokenChains: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    error: { type: 'string' },
                  },
                },
              },
              verificationTime: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: VerifyChainBody }>, reply: FastifyReply) => {
      const { startDate, endDate } = request.body;
      const startTime = Date.now();

      const result = await verifyIntegrityChain(new Date(startDate), new Date(endDate));

      return reply.send({
        valid: result.valid,
        totalChecked: result.totalChecked,
        brokenChains: result.brokenChains.map((bc) => ({
          ...bc,
          timestamp: bc.timestamp.toISOString(),
        })),
        verificationTime: Date.now() - startTime,
      });
    }
  );

  /**
   * Batch verify multiple audit log entries
   * POST /integrity/batch/verify
   */
  app.post<{ Body: BatchVerifyBody }>(
    '/integrity/batch/verify',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:admin')],
      schema: {
        description: 'Batch verify multiple audit log entries',
        tags: ['Integrity'],
        body: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 1000,
            },
          },
          required: ['ids'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              totalRequested: { type: 'number' },
              totalVerified: { type: 'number' },
              totalValid: { type: 'number' },
              totalInvalid: { type: 'number' },
              totalMissing: { type: 'number' },
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    status: { type: 'string', enum: ['valid', 'invalid', 'missing'] },
                    error: { type: 'string', nullable: true },
                  },
                },
              },
              verificationTime: { type: 'number' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: BatchVerifyBody }>, reply: FastifyReply) => {
      const { ids } = request.body;

      if (!ids || ids.length === 0) {
        return reply.status(400).send({ error: 'No IDs provided' });
      }

      if (ids.length > 1000) {
        return reply.status(400).send({ error: 'Maximum 1000 IDs per batch' });
      }

      const startTime = Date.now();
      const results: Array<{
        id: string;
        status: 'valid' | 'invalid' | 'missing';
        error?: string;
      }> = [];
      let totalValid = 0;
      let totalInvalid = 0;
      let totalMissing = 0;

      // Process in batches of 100 for better performance
      const batchSize = 100;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchPromises = batchIds.map(async (id) => {
          try {
            const log = await getAuditLogById(id);
            if (!log) {
              totalMissing++;
              return { id, status: 'missing' as const, error: 'Log not found' };
            }

            const isValid = verifyIntegrity(log);
            if (isValid) {
              totalValid++;
              return { id, status: 'valid' as const };
            } else {
              totalInvalid++;
              return { id, status: 'invalid' as const, error: 'Hash verification failed' };
            }
          } catch (err) {
            totalInvalid++;
            return { id, status: 'invalid' as const, error: (err as Error).message };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return reply.send({
        totalRequested: ids.length,
        totalVerified: totalValid + totalInvalid,
        totalValid,
        totalInvalid,
        totalMissing,
        results,
        verificationTime: Date.now() - startTime,
      });
    }
  );

  /**
   * Get storage statistics
   * GET /integrity/stats
   */
  app.get(
    '/integrity/stats',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:admin')],
      schema: {
        description: 'Get audit log storage statistics',
        tags: ['Integrity'],
        response: {
          200: {
            type: 'object',
            properties: {
              totalLogs: { type: 'number' },
              logsByPolicy: {
                type: 'object',
                additionalProperties: { type: 'number' },
              },
              oldestLog: { type: 'string', format: 'date-time', nullable: true },
              newestLog: { type: 'string', format: 'date-time', nullable: true },
              estimatedSizeMB: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const stats = await getStorageStats();

      return reply.send({
        totalLogs: stats.totalLogs,
        logsByPolicy: stats.logsByPolicy,
        oldestLog: stats.oldestLog?.toISOString() ?? null,
        newestLog: stats.newestLog?.toISOString() ?? null,
        estimatedSizeMB: stats.estimatedSizeMB,
      });
    }
  );

  /**
   * Run integrity report for a specific resource
   * GET /integrity/resource/:resourceType/:resourceId
   */
  app.get<{
    Params: { resourceType: string; resourceId: string };
    Querystring: { limit?: string };
  }>(
    '/integrity/resource/:resourceType/:resourceId',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:admin')],
      schema: {
        description: 'Get integrity status for all logs related to a specific resource',
        tags: ['Integrity'],
        params: {
          type: 'object',
          properties: {
            resourceType: { type: 'string' },
            resourceId: { type: 'string' },
          },
          required: ['resourceType', 'resourceId'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', default: '100' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              resourceType: { type: 'string' },
              resourceId: { type: 'string' },
              totalLogs: { type: 'number' },
              validLogs: { type: 'number' },
              invalidLogs: { type: 'number' },
              integrityPercentage: { type: 'number' },
              issues: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { resourceType: string; resourceId: string };
        Querystring: { limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { resourceType, resourceId } = request.params;
      const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : 100;

      const searchResult = await searchAuditLogs({
        resourceType,
        resourceId,
        pageSize: limit,
        sortField: 'timestamp',
        sortOrder: 'desc',
      });

      const issues: Array<{ id: string; timestamp: string; error: string }> = [];
      let validCount = 0;

      for (const log of searchResult.data) {
        const isValid = verifyIntegrity(log);
        if (isValid) {
          validCount++;
        } else {
          issues.push({
            id: log.id,
            timestamp: log.timestamp.toISOString(),
            error: 'Hash verification failed',
          });
        }
      }

      return reply.send({
        resourceType,
        resourceId,
        totalLogs: searchResult.data.length,
        validLogs: validCount,
        invalidLogs: issues.length,
        integrityPercentage:
          searchResult.data.length > 0 ? (validCount / searchResult.data.length) * 100 : 100,
        issues,
      });
    }
  );
}
