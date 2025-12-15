/**
 * @module @skillancer/audit-svc/routes/compliance
 * Compliance reporting and GDPR routes
 */

import {
  generateFullComplianceReport,
  generateDsarReport,
  anonymizeUserAuditData,
  getRetentionPolicySummary,
} from '../services/audit-compliance.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface ComplianceReportParams {
  tag: string;
}

interface ComplianceReportQuerystring {
  startDate: string;
  endDate: string;
  includeBreakdowns?: string;
  includeViolations?: string;
}

interface UserIdParams {
  userId: string;
}

interface DsarQuerystring {
  includeMetadata?: string;
}

export function registerComplianceRoutes(app: FastifyInstance): void {
  /**
   * Generate a full compliance report for a tag
   * GET /compliance/:tag/full-report
   */
  app.get<{
    Params: ComplianceReportParams;
    Querystring: ComplianceReportQuerystring;
  }>(
    '/compliance/:tag/full-report',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:compliance')],
      schema: {
        description: 'Generate a comprehensive compliance report for a specific tag',
        tags: ['Compliance'],
        params: {
          type: 'object',
          properties: {
            tag: {
              type: 'string',
              enum: ['GDPR', 'HIPAA', 'SOC2', 'PCI', 'PII'],
              description: 'Compliance tag',
            },
          },
          required: ['tag'],
        },
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            includeBreakdowns: { type: 'string', enum: ['true', 'false'], default: 'true' },
            includeViolations: { type: 'string', enum: ['true', 'false'], default: 'true' },
          },
          required: ['startDate', 'endDate'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              tag: { type: 'string' },
              period: {
                type: 'object',
                properties: {
                  start: { type: 'string', format: 'date-time' },
                  end: { type: 'string', format: 'date-time' },
                },
              },
              summary: {
                type: 'object',
                properties: {
                  totalEvents: { type: 'number' },
                  successfulEvents: { type: 'number' },
                  failedEvents: { type: 'number' },
                  uniqueActors: { type: 'number' },
                  uniqueResources: { type: 'number' },
                  complianceScore: { type: 'number' },
                },
              },
              eventsByCategory: { type: 'object', additionalProperties: { type: 'number' } },
              eventsByOutcome: { type: 'object', additionalProperties: { type: 'number' } },
              recommendations: { type: 'array', items: { type: 'string' } },
              generatedAt: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: ComplianceReportParams;
        Querystring: ComplianceReportQuerystring;
      }>,
      reply: FastifyReply
    ) => {
      const { tag } = request.params;
      const { startDate, endDate, includeBreakdowns, includeViolations } = request.query;

      if (!startDate || !endDate) {
        return reply.status(400).send({ error: 'startDate and endDate are required' });
      }

      const report = await generateFullComplianceReport(tag, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        includeBreakdowns: includeBreakdowns !== 'false',
        includeViolations: includeViolations !== 'false',
      });

      return reply.send({
        ...report,
        period: {
          start: report.period.start.toISOString(),
          end: report.period.end.toISOString(),
        },
        generatedAt: report.generatedAt.toISOString(),
        violations: report.violations?.map((v) => ({
          ...v,
          timestamp: v.timestamp.toISOString(),
        })),
      });
    }
  );

  /**
   * Get retention policy summary
   * GET /compliance/retention
   */
  app.get(
    '/compliance/retention',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:compliance')],
      schema: {
        description: 'Get a summary of audit logs by retention policy',
        tags: ['Compliance'],
        response: {
          200: {
            type: 'object',
            properties: {
              policies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    policy: { type: 'string' },
                    count: { type: 'number' },
                    oldestLog: { type: 'string', format: 'date-time', nullable: true },
                    newestLog: { type: 'string', format: 'date-time', nullable: true },
                  },
                },
              },
              totalLogs: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const summary = await getRetentionPolicySummary();

      return reply.send({
        policies: summary.policies.map((p) => ({
          policy: p.policy,
          count: p.count,
          oldestLog: p.oldestLog?.toISOString() ?? null,
          newestLog: p.newestLog?.toISOString() ?? null,
        })),
        totalLogs: summary.totalLogs,
      });
    }
  );

  /**
   * Generate GDPR Data Subject Access Request (DSAR) report
   * GET /compliance/gdpr/dsar/:userId
   */
  app.get<{
    Params: UserIdParams;
    Querystring: DsarQuerystring;
  }>(
    '/compliance/gdpr/dsar/:userId',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:gdpr')],
      schema: {
        description: 'Generate a GDPR DSAR report for a user',
        tags: ['Compliance', 'GDPR'],
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        },
        querystring: {
          type: 'object',
          properties: {
            includeMetadata: { type: 'string', enum: ['true', 'false'], default: 'false' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              totalLogs: { type: 'number' },
              dataCategories: { type: 'array', items: { type: 'string' } },
              logs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    timestamp: { type: 'string', format: 'date-time' },
                    eventType: { type: 'string' },
                    action: { type: 'string' },
                    resource: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        id: { type: 'string' },
                      },
                    },
                    ipAddress: { type: 'string', nullable: true },
                  },
                },
              },
              generatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: UserIdParams;
        Querystring: DsarQuerystring;
      }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const { includeMetadata } = request.query;

      const report = await generateDsarReport(userId, {
        includeMetadata: includeMetadata === 'true',
      });

      return reply.send({
        ...report,
        logs: report.logs.map((log) => ({
          ...log,
          timestamp: log.timestamp.toISOString(),
        })),
        generatedAt: report.generatedAt.toISOString(),
      });
    }
  );

  /**
   * Anonymize user audit data (GDPR right to erasure)
   * POST /compliance/gdpr/anonymize/:userId
   */
  app.post<{ Params: UserIdParams }>(
    '/compliance/gdpr/anonymize/:userId',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:gdpr:delete')],
      schema: {
        description:
          "Anonymize a user's audit data for GDPR right to erasure. This is irreversible.",
        tags: ['Compliance', 'GDPR'],
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              anonymizedCount: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: UserIdParams }>, reply: FastifyReply) => {
      const { userId } = request.params;

      const result = await anonymizeUserAuditData(userId);

      return reply.send({
        userId,
        anonymizedCount: result.anonymizedCount,
        message: `Successfully anonymized ${result.anonymizedCount} audit log entries`,
      });
    }
  );

  /**
   * Get available compliance tags
   * GET /compliance/tags
   */
  app.get(
    '/compliance/tags',
    {
      preHandler: [app.authenticate, app.requirePermission('audit:read')],
      schema: {
        description: 'Get list of available compliance tags',
        tags: ['Compliance'],
        response: {
          200: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    tag: { type: 'string' },
                    description: { type: 'string' },
                    retentionPolicy: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        tags: [
          {
            tag: 'GDPR',
            description:
              'General Data Protection Regulation - EU data protection and privacy regulation',
            retentionPolicy: 'PERMANENT',
          },
          {
            tag: 'HIPAA',
            description:
              'Health Insurance Portability and Accountability Act - US healthcare data regulation',
            retentionPolicy: 'EXTENDED',
          },
          {
            tag: 'SOC2',
            description:
              'Service Organization Control 2 - Security, availability, and confidentiality',
            retentionPolicy: 'EXTENDED',
          },
          {
            tag: 'PCI',
            description:
              'Payment Card Industry Data Security Standard - Payment card data protection',
            retentionPolicy: 'EXTENDED',
          },
          {
            tag: 'PII',
            description: 'Personally Identifiable Information - Personal data handling',
            retentionPolicy: 'STANDARD',
          },
        ],
      });
    }
  );
}
