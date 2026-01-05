/**
 * @module @skillancer/auth-svc/routes/hipaa
 * HIPAA Compliance API routes
 */

import {
  HipaaTrainingType,
  PhiAccessType,
  PhiCategory,
  BreachIncidentType,
  BreachSeverity,
  BreachStatus,
  PhiFieldTypeEnum,
} from '@skillancer/database';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import {
  reportBreach,
  getBreachIncident,
  listBreachIncidents,
  updateBreachStatus,
  getBreachTimeline,
  notifyHhs,
  notifyAffectedIndividuals,
  addInvestigationFindings,
  getBreachStatistics,
} from '../services/breach-management.service.js';
import {
  enableHipaaCompliance,
  getComplianceStatus,
  updateComplianceSettings,
  checkPhiAccess,
  getPhiAccessLogs,
  requestBaa,
  completeBaaSigning,
  getTrainingRequirements,
  recordTrainingCompletion,
  startTraining,
  generateComplianceAssessment,
} from '../services/hipaa-compliance.service.js';
import {
  encryptPhi,
  decryptPhi,
  maskPhi,
  tokenizePhi,
  detokenizePhi,
} from '../services/phi-protection.service.js';

import type { FastifyInstance, FastifyRequest } from 'fastify';

// =============================================================================
// HELPERS
// =============================================================================

// Alias enum for runtime usage
const PhiFieldType = PhiFieldTypeEnum;

function getUserId(request: FastifyRequest): string {
  const user = request.user;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

function getTenantId(request: FastifyRequest): string {
  const user = request.user;
  if (!user?.tenantId) {
    throw new Error('Tenant context required');
  }
  return user.tenantId;
}

// =============================================================================
// TYPE HELPERS FOR REQUEST PARAMS/QUERY
// =============================================================================

interface TenantQuery {
  tenantId: string;
}

interface IncidentParams {
  incidentId: string;
}

interface PhiAccessLogQuery {
  tenantId: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  phiCategory?: string;
  page?: string;
  limit?: string;
}

interface BreachListQuery {
  tenantId: string;
  status?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
}

interface BreachStatsQuery {
  tenantId: string;
  startDate?: string;
  endDate?: string;
}

// =============================================================================
// SCHEMAS
// =============================================================================

const enableHipaaSchema = z.object({
  tenantId: z.string().uuid(),
  options: z
    .object({
      mfaRequired: z.boolean().optional(),
      sessionTimeout: z.number().min(5).max(60).optional(),
      ipWhitelist: z.array(z.string()).optional(),
      auditRetentionYears: z.number().min(6).max(10).optional(),
    })
    .optional(),
});

const updateSettingsSchema = z.object({
  mfaRequired: z.boolean().optional(),
  sessionTimeout: z.number().min(5).max(60).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  auditRetentionYears: z.number().min(6).max(10).optional(),
});

const checkPhiAccessSchema = z.object({
  accessType: z.nativeEnum(PhiAccessType),
  phiCategory: z.nativeEnum(PhiCategory),
  purpose: z.string().min(10).max(500),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

const requestBaaSchema = z.object({
  tenantId: z.string().uuid(),
  contactInfo: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    title: z.string().min(2).max(100),
    company: z.string().min(2).max(200),
    address: z.string().min(10).max(500),
  }),
});

const completeBaaSchema = z.object({
  tenantId: z.string().uuid(),
  documentUrl: z.string().url(),
  signedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

const completeTrainingSchema = z.object({
  trainingType: z.nativeEnum(HipaaTrainingType),
  trainingVersion: z.string().min(1).max(50),
  quizScore: z.number().min(0).max(100),
});

const startTrainingSchema = z.object({
  trainingType: z.nativeEnum(HipaaTrainingType),
  trainingVersion: z.string().min(1).max(50),
});

const reportBreachSchema = z.object({
  tenantId: z.string().uuid(),
  incidentType: z.nativeEnum(BreachIncidentType),
  severity: z.nativeEnum(BreachSeverity),
  description: z.string().min(50).max(10000),
  discoveredAt: z.string().datetime(),
  phiInvolved: z.boolean(),
  phiCategories: z.array(z.nativeEnum(PhiCategory)).optional(),
  affectedRecords: z.number().min(0).optional(),
  affectedUsers: z.number().min(0).optional(),
});

const updateBreachStatusSchema = z.object({
  status: z.nativeEnum(BreachStatus),
  notes: z.string().max(2000).optional(),
  rootCause: z.string().max(5000).optional(),
  remediation: z.string().max(5000).optional(),
  preventiveMeasures: z.string().max(5000).optional(),
});

const notifyAffectedSchema = z.object({
  notificationMethod: z.enum(['email', 'mail', 'both']),
});

const investigationFindingsSchema = z.object({
  rootCause: z.string().max(5000).optional(),
  remediation: z.string().max(5000).optional(),
  preventiveMeasures: z.string().max(5000).optional(),
});

const encryptPhiSchema = z.object({
  data: z.string(),
  context: z.record(z.string()).optional(),
});

const decryptPhiSchema = z.object({
  encryptedData: z.object({
    encryptedData: z.string(),
    encryptedKey: z.string(),
    iv: z.string(),
    authTag: z.string(),
    algorithm: z.string(),
    keyId: z.string(),
  }),
  context: z.record(z.string()).optional(),
});

const tokenizePhiSchema = z.object({
  value: z.string(),
  type: z.nativeEnum(PhiFieldType),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
});

const detokenizePhiSchema = z.object({
  token: z.string(),
});

const maskPhiSchema = z.object({
  value: z.string(),
  type: z.nativeEnum(PhiFieldType),
});

// =============================================================================
// ROUTE PLUGIN
// =============================================================================

export function hipaaRoutes(fastify: FastifyInstance): void {
  // Apply authentication to all routes
  fastify.addHook('preHandler', authMiddleware);

  // =========================================================================
  // COMPLIANCE MANAGEMENT
  // =========================================================================

  /**
   * Enable HIPAA compliance for a tenant
   */
  fastify.post(
    '/enable',
    {
      schema: {
        description: 'Enable HIPAA compliance for a tenant',
        tags: ['HIPAA'],
        body: enableHipaaSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              compliance: { type: 'object' },
              nextSteps: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      preHandler: [rateLimitMiddleware('mfa')],
    },
    async (request, reply) => {
      const body = enableHipaaSchema.parse(request.body);
      const adminUserId = getUserId(request);

      const compliance = await enableHipaaCompliance({
        tenantId: body.tenantId,
        adminUserId,
        options: body.options,
      });

      return reply.status(200).send({
        compliance: {
          id: compliance.id,
          hipaaEnabled: compliance.hipaaEnabled,
          complianceLevel: compliance.complianceLevel,
          baaStatus: compliance.baaStatus,
          mfaRequired: compliance.mfaRequired,
          sessionTimeout: compliance.sessionTimeout,
        },
        nextSteps: [
          'Complete HIPAA training for all users',
          'Request Business Associate Agreement',
          'Configure access controls',
        ],
      });
    }
  );

  /**
   * Get HIPAA compliance status
   */
  fastify.get(
    '/status',
    {
      schema: {
        description: 'Get HIPAA compliance status for a tenant',
        tags: ['HIPAA'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
          },
          required: ['tenantId'],
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.query as TenantQuery;

      const compliance = await getComplianceStatus(tenantId);

      if (!compliance) {
        return reply.status(404).send({
          error: 'HIPAA compliance not enabled for tenant',
        });
      }

      return reply.status(200).send({ compliance });
    }
  );

  /**
   * Update HIPAA compliance settings
   */
  fastify.patch(
    '/settings',
    {
      schema: {
        description: 'Update HIPAA compliance settings',
        tags: ['HIPAA'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
          },
          required: ['tenantId'],
        },
        body: updateSettingsSchema,
      },
    },
    async (request, reply) => {
      const { tenantId } = request.query as TenantQuery;
      const body = updateSettingsSchema.parse(request.body);

      const compliance = await updateComplianceSettings(tenantId, body);

      return reply.status(200).send({ compliance });
    }
  );

  /**
   * Generate compliance assessment
   */
  fastify.get(
    '/assessment',
    {
      schema: {
        description: 'Generate HIPAA compliance assessment',
        tags: ['HIPAA'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
          },
          required: ['tenantId'],
        },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.query as TenantQuery;

      const assessment = await generateComplianceAssessment(tenantId);

      return reply.status(200).send({ assessment });
    }
  );

  // =========================================================================
  // BAA MANAGEMENT
  // =========================================================================

  /**
   * Request Business Associate Agreement
   */
  fastify.post(
    '/baa/request',
    {
      schema: {
        description: 'Request a Business Associate Agreement',
        tags: ['HIPAA'],
        body: requestBaaSchema,
      },
      preHandler: [rateLimitMiddleware('mfa')],
    },
    async (request, reply) => {
      const body = requestBaaSchema.parse(request.body);
      const requestedBy = getUserId(request);

      await requestBaa({
        tenantId: body.tenantId,
        requestedBy,
        contactInfo: body.contactInfo,
      });

      return reply.status(200).send({
        requestId: crypto.randomUUID(),
        status: 'REQUESTED',
        message:
          'BAA request submitted. Our compliance team will contact you within 2 business days.',
      });
    }
  );

  /**
   * Complete BAA signing (admin operation)
   */
  fastify.post(
    '/baa/complete',
    {
      schema: {
        description: 'Complete BAA signing (admin only)',
        tags: ['HIPAA'],
        body: completeBaaSchema,
      },
    },
    async (request, reply) => {
      const body = completeBaaSchema.parse(request.body);
      const adminUserId = getUserId(request);

      // TODO: Add admin role check

      const compliance = await completeBaaSigning({
        tenantId: body.tenantId,
        documentUrl: body.documentUrl,
        signedAt: new Date(body.signedAt),
        expiresAt: new Date(body.expiresAt),
        adminUserId,
      });

      return reply.status(200).send({ compliance });
    }
  );

  // =========================================================================
  // PHI ACCESS
  // =========================================================================

  /**
   * Check PHI access
   */
  fastify.post(
    '/phi/check-access',
    {
      schema: {
        description: 'Check if user can access PHI',
        tags: ['HIPAA'],
        body: checkPhiAccessSchema,
      },
    },
    async (request, reply) => {
      const body = checkPhiAccessSchema.parse(request.body);
      const userId = getUserId(request);
      const tenantId = getTenantId(request);

      const result = await checkPhiAccess({
        userId,
        tenantId,
        accessType: body.accessType,
        phiCategory: body.phiCategory,
        purpose: body.purpose,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
      });

      return reply.status(result.allowed ? 200 : 403).send(result);
    }
  );

  /**
   * Get PHI access log
   */
  fastify.get(
    '/phi/access-log',
    {
      schema: {
        description: 'Get PHI access log',
        tags: ['HIPAA'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            userId: { type: 'string', format: 'uuid' },
            phiCategory: { type: 'string' },
            page: { type: 'string' },
            limit: { type: 'string' },
          },
          required: ['tenantId'],
        },
      },
    },
    async (request, reply) => {
      const { tenantId, startDate, endDate, userId, phiCategory, page, limit } =
        request.query as PhiAccessLogQuery;

      const result = await getPhiAccessLogs({
        tenantId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        userId,
        phiCategory,
        page: page ? Number.parseInt(page, 10) : undefined,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
      });

      const logs = result.logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userName: `${log.user.firstName} ${log.user.lastName}`,
        accessType: log.accessType,
        phiCategory: log.phiCategory,
        purpose: log.purpose,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        recordCount: log.recordCount,
        timestamp: log.timestamp,
        ipAddress: log.ipAddress,
        location: log.location,
      }));

      return reply.status(200).send({
        logs,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      });
    }
  );

  // =========================================================================
  // TRAINING
  // =========================================================================

  /**
   * Get training requirements
   */
  fastify.get(
    '/training/requirements',
    {
      schema: {
        tags: ['HIPAA'],
        response: {
          200: {
            type: 'object',
            properties: {
              required: { type: 'boolean' },
              trainings: { type: 'array' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const tenantId = getTenantId(request);

      const requirements = await getTrainingRequirements(userId, tenantId);

      return reply.status(200).send(requirements);
    }
  );

  /**
   * Start training
   */
  fastify.post(
    '/training/start',
    {
      schema: {
        description: 'Start a HIPAA training session',
        tags: ['HIPAA'],
        body: startTrainingSchema,
      },
    },
    async (request, reply) => {
      const body = startTrainingSchema.parse(request.body);
      const userId = getUserId(request);
      const tenantId = getTenantId(request);

      const training = await startTraining(
        userId,
        tenantId,
        body.trainingType,
        body.trainingVersion
      );

      return reply.status(200).send({ training });
    }
  );

  /**
   * Complete training
   */
  fastify.post(
    '/training/complete',
    {
      schema: {
        description: 'Record training completion',
        tags: ['HIPAA'],
        body: completeTrainingSchema,
      },
    },
    async (request, reply) => {
      const body = completeTrainingSchema.parse(request.body);
      const userId = getUserId(request);
      const tenantId = getTenantId(request);

      const training = await recordTrainingCompletion({
        userId,
        tenantId,
        trainingType: body.trainingType,
        trainingVersion: body.trainingVersion,
        quizScore: body.quizScore,
      });

      return reply.status(200).send({
        training: {
          id: training.id,
          type: training.trainingType,
          status: training.status,
          passed: training.passed,
          quizScore: training.quizScore,
          certificateUrl: training.certificateUrl,
          expiresAt: training.expiresAt,
        },
      });
    }
  );

  // =========================================================================
  // BREACH MANAGEMENT
  // =========================================================================

  /**
   * Report a breach
   */
  fastify.post(
    '/breaches',
    {
      schema: {
        description: 'Report a potential breach incident',
        tags: ['HIPAA'],
        body: reportBreachSchema,
      },
      preHandler: [rateLimitMiddleware('mfa')],
    },
    async (request, reply) => {
      const body = reportBreachSchema.parse(request.body);
      const reportedBy = getUserId(request);

      const incident = await reportBreach({
        tenantId: body.tenantId,
        reportedBy,
        incidentType: body.incidentType,
        severity: body.severity,
        description: body.description,
        discoveredAt: new Date(body.discoveredAt),
        phiInvolved: body.phiInvolved,
        phiCategories: body.phiCategories,
        affectedRecords: body.affectedRecords,
        affectedUsers: body.affectedUsers,
      });

      return reply.status(201).send({ incident });
    }
  );

  /**
   * List breach incidents
   */
  fastify.get(
    '/breaches',
    {
      schema: {
        description: 'List breach incidents',
        tags: ['HIPAA'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            status: { type: 'string' },
            severity: { type: 'string' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            page: { type: 'string' },
            limit: { type: 'string' },
          },
          required: ['tenantId'],
        },
      },
    },
    async (request, reply) => {
      const { tenantId, status, severity, startDate, endDate, page, limit } =
        request.query as BreachListQuery;

      const result = await listBreachIncidents({
        tenantId,
        status: status as BreachStatus | undefined,
        severity: severity as BreachSeverity | undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: page ? Number.parseInt(page, 10) : undefined,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
      });

      return reply.status(200).send(result);
    }
  );

  /**
   * Get breach incident details
   */
  fastify.get(
    '/breaches/:incidentId',
    {
      schema: {
        description: 'Get breach incident details',
        tags: ['HIPAA'],
        params: {
          type: 'object',
          properties: {
            incidentId: { type: 'string', format: 'uuid' },
          },
          required: ['incidentId'],
        },
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as IncidentParams;

      const incident = await getBreachIncident(incidentId);

      if (!incident) {
        return reply.status(404).send({ error: 'Breach incident not found' });
      }

      return reply.status(200).send({ incident });
    }
  );

  /**
   * Update breach status
   */
  fastify.patch(
    '/breaches/:incidentId/status',
    {
      schema: {
        description: 'Update breach incident status',
        tags: ['HIPAA'],
        params: {
          type: 'object',
          properties: {
            incidentId: { type: 'string', format: 'uuid' },
          },
          required: ['incidentId'],
        },
        body: updateBreachStatusSchema,
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as IncidentParams;
      const body = updateBreachStatusSchema.parse(request.body);
      const updatedBy = getUserId(request);

      const incident = await updateBreachStatus({
        incidentId,
        status: body.status,
        updatedBy,
        notes: body.notes,
        rootCause: body.rootCause,
        remediation: body.remediation,
        preventiveMeasures: body.preventiveMeasures,
      });

      return reply.status(200).send({ incident });
    }
  );

  /**
   * Get breach timeline
   */
  fastify.get(
    '/breaches/:incidentId/timeline',
    {
      schema: {
        description: 'Get breach incident timeline',
        tags: ['HIPAA'],
        params: {
          type: 'object',
          properties: {
            incidentId: { type: 'string', format: 'uuid' },
          },
          required: ['incidentId'],
        },
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as IncidentParams;

      const timeline = await getBreachTimeline(incidentId);

      return reply.status(200).send({ timeline });
    }
  );

  /**
   * Notify HHS
   */
  fastify.post(
    '/breaches/:incidentId/notify-hhs',
    {
      schema: {
        description: 'Notify HHS of breach',
        tags: ['HIPAA'],
        params: {
          type: 'object',
          properties: {
            incidentId: { type: 'string', format: 'uuid' },
          },
          required: ['incidentId'],
        },
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as IncidentParams;
      const notifiedBy = getUserId(request);

      await notifyHhs(incidentId, notifiedBy);

      return reply.status(200).send({
        success: true,
        message: 'HHS has been notified of the breach',
      });
    }
  );

  /**
   * Notify affected individuals
   */
  fastify.post(
    '/breaches/:incidentId/notify-affected',
    {
      schema: {
        description: 'Notify affected individuals',
        tags: ['HIPAA'],
        params: {
          type: 'object',
          properties: {
            incidentId: { type: 'string', format: 'uuid' },
          },
          required: ['incidentId'],
        },
        body: notifyAffectedSchema,
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as IncidentParams;
      const body = notifyAffectedSchema.parse(request.body);
      const notifiedBy = getUserId(request);

      await notifyAffectedIndividuals(incidentId, notifiedBy, body.notificationMethod);

      return reply.status(200).send({
        success: true,
        message: 'Affected individuals have been notified',
      });
    }
  );

  /**
   * Add investigation findings
   */
  fastify.post(
    '/breaches/:incidentId/findings',
    {
      schema: {
        description: 'Add investigation findings',
        tags: ['HIPAA'],
        params: {
          type: 'object',
          properties: {
            incidentId: { type: 'string', format: 'uuid' },
          },
          required: ['incidentId'],
        },
        body: investigationFindingsSchema,
      },
    },
    async (request, reply) => {
      const { incidentId } = request.params as IncidentParams;
      const body = investigationFindingsSchema.parse(request.body);
      const updatedBy = getUserId(request);

      const incident = await addInvestigationFindings(incidentId, body, updatedBy);

      return reply.status(200).send({ incident });
    }
  );

  /**
   * Get breach statistics
   */
  fastify.get(
    '/breaches/statistics',
    {
      schema: {
        description: 'Get breach statistics',
        tags: ['HIPAA'],
        querystring: {
          type: 'object',
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
          },
          required: ['tenantId'],
        },
      },
    },
    async (request, reply) => {
      const { tenantId, startDate, endDate } = request.query as BreachStatsQuery;

      const statistics = await getBreachStatistics(
        tenantId,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      return reply.status(200).send({ statistics });
    }
  );

  // =========================================================================
  // PHI PROTECTION
  // =========================================================================

  /**
   * Encrypt PHI data
   */
  fastify.post(
    '/phi/encrypt',
    {
      schema: {
        description: 'Encrypt PHI data',
        tags: ['HIPAA'],
        body: encryptPhiSchema,
      },
    },
    async (request, reply) => {
      const body = encryptPhiSchema.parse(request.body);
      const tenantId = getTenantId(request);

      const encrypted = await encryptPhi({
        data: body.data,
        tenantId,
        context: body.context,
      });

      return reply.status(200).send({ encrypted });
    }
  );

  /**
   * Decrypt PHI data
   */
  fastify.post(
    '/phi/decrypt',
    {
      schema: {
        description: 'Decrypt PHI data',
        tags: ['HIPAA'],
        body: decryptPhiSchema,
      },
    },
    async (request, reply) => {
      const body = decryptPhiSchema.parse(request.body);
      const tenantId = getTenantId(request);
      const userId = getUserId(request);

      // First check PHI access
      const accessCheck = await checkPhiAccess({
        userId,
        tenantId,
        accessType: PhiAccessType.VIEW,
        phiCategory: PhiCategory.OTHER,
        purpose: 'Data decryption request',
      });

      if (!accessCheck.allowed) {
        return reply.status(403).send(accessCheck);
      }

      const decrypted = await decryptPhi({
        encryptedData: body.encryptedData,
        tenantId,
        context: body.context,
      });

      return reply.status(200).send({
        data: decrypted.toString('utf8'),
      });
    }
  );

  /**
   * Tokenize PHI
   */
  fastify.post(
    '/phi/tokenize',
    {
      schema: {
        description: 'Tokenize PHI value',
        tags: ['HIPAA'],
        body: tokenizePhiSchema,
      },
    },
    async (request, reply) => {
      const body = tokenizePhiSchema.parse(request.body);
      const tenantId = getTenantId(request);

      const token = await tokenizePhi({
        value: body.value,
        type: body.type,
        tenantId,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
      });

      return reply.status(200).send({ token });
    }
  );

  /**
   * Detokenize PHI
   */
  fastify.post(
    '/phi/detokenize',
    {
      schema: {
        description: 'Detokenize PHI value',
        tags: ['HIPAA'],
        body: detokenizePhiSchema,
      },
    },
    async (request, reply) => {
      const body = detokenizePhiSchema.parse(request.body);
      const tenantId = getTenantId(request);
      const userId = getUserId(request);

      // First check PHI access
      const accessCheck = await checkPhiAccess({
        userId,
        tenantId,
        accessType: PhiAccessType.VIEW,
        phiCategory: PhiCategory.OTHER,
        purpose: 'Token detokenization request',
      });

      if (!accessCheck.allowed) {
        return reply.status(403).send(accessCheck);
      }

      const value = await detokenizePhi(body.token, tenantId);

      if (!value) {
        return reply.status(404).send({ error: 'Token not found' });
      }

      return reply.status(200).send({ value });
    }
  );

  /**
   * Mask PHI value
   */
  fastify.post(
    '/phi/mask',
    {
      schema: {
        description: 'Mask PHI value for display',
        tags: ['HIPAA'],
        body: maskPhiSchema,
      },
    },
    async (request, reply) => {
      const body = maskPhiSchema.parse(request.body);

      const masked = maskPhi(body.value, body.type);

      return reply.status(200).send({ masked });
    }
  );
}

export default hipaaRoutes;
