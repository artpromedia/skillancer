/**
 * @module @skillancer/skillpod-svc/routes/violations
 * Security violations API routes
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { z } from 'zod';

import type { ViolationDetectionService } from '../services/violation-detection.service.js';
import type { ViolationType } from '../types/containment.types.js';
import type { FastifyInstance } from 'fastify';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const ViolationTypeEnum = z.enum([
  'CLIPBOARD_COPY_ATTEMPT',
  'CLIPBOARD_PASTE_BLOCKED',
  'FILE_DOWNLOAD_BLOCKED',
  'FILE_UPLOAD_BLOCKED',
  'SCREEN_CAPTURE_ATTEMPT',
  'USB_DEVICE_BLOCKED',
  'NETWORK_ACCESS_BLOCKED',
  'PRINT_BLOCKED',
  'SESSION_TIMEOUT',
  'IDLE_TIMEOUT',
  'UNAUTHORIZED_PERIPHERAL',
  'POLICY_BYPASS_ATTEMPT',
  'SUSPICIOUS_ACTIVITY',
]);

const ViolationSeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const CreateViolationSchema = z.object({
  sessionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  violationType: ViolationTypeEnum,
  severity: ViolationSeverityEnum.optional(),
  description: z.string(),
  details: z.record(z.unknown()).optional(),
  sourceIp: z.string().optional(),
  userAgent: z.string().optional(),
});

const ListViolationsQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  violationType: ViolationTypeEnum.optional(),
  severity: ViolationSeverityEnum.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  reviewed: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : 50)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : 0)),
});

const ReviewViolationSchema = z.object({
  reviewedBy: z.string().uuid(),
  notes: z.string().optional(),
});

// =============================================================================
// ROUTE TYPES
// =============================================================================

interface ViolationParams {
  violationId: string;
}

interface TenantQuery {
  tenantId: string;
  days?: string;
}

interface SessionParams {
  sessionId: string;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export function violationRoutes(
  app: FastifyInstance,
  violationService: ViolationDetectionService
): void {
  // ===========================================================================
  // RECORD VIOLATION
  // ===========================================================================

  app.post<{
    Body: z.infer<typeof CreateViolationSchema>;
  }>(
    '/violations',
    {
      schema: {
        body: CreateViolationSchema,
      },
    },
    async (request, reply) => {
      const violation = await violationService.recordViolation({
        ...request.body,
        violationType: request.body.violationType as ViolationType,
        severity: request.body.severity,
      });
      return reply.status(201).send({ violation });
    }
  );

  // ===========================================================================
  // GET VIOLATION
  // ===========================================================================

  app.get<{ Params: ViolationParams }>(
    '/violations/:violationId',
    {
      schema: {
        params: z.object({
          violationId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { violationId } = request.params;
      const violation = await violationService.getViolation(violationId);

      if (!violation) {
        return reply.status(404).send({ error: 'Violation not found' });
      }

      return { violation };
    }
  );

  // ===========================================================================
  // LIST VIOLATIONS
  // ===========================================================================

  app.get<{
    Querystring: z.infer<typeof ListViolationsQuerySchema>;
  }>(
    '/violations',
    {
      schema: {
        querystring: ListViolationsQuerySchema,
      },
    },
    async (request) => {
      const {
        sessionId,
        tenantId,
        violationType,
        severity,
        startDate,
        endDate,
        reviewed,
        limit,
        offset,
      } = request.query;

      const result = await violationService.listViolations({
        sessionId,
        tenantId,
        violationType,
        severity,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        reviewed,
        limit,
        offset,
      });

      return result;
    }
  );

  // ===========================================================================
  // REVIEW VIOLATION
  // ===========================================================================

  app.post<{
    Params: ViolationParams;
    Body: z.infer<typeof ReviewViolationSchema>;
  }>(
    '/violations/:violationId/review',
    {
      schema: {
        params: z.object({
          violationId: z.string().uuid(),
        }),
        body: ReviewViolationSchema,
      },
    },
    async (request, reply) => {
      const { violationId } = request.params;
      const { reviewedBy, notes } = request.body;

      try {
        const violation = await violationService.reviewViolation(violationId, reviewedBy, notes);
        return { violation };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({ error: 'Violation not found' });
        }
        throw error;
      }
    }
  );

  // ===========================================================================
  // GET VIOLATION SUMMARY
  // ===========================================================================

  app.get<{ Querystring: TenantQuery }>(
    '/violations/summary',
    {
      schema: {
        querystring: z.object({
          tenantId: z.string().uuid(),
          days: z
            .string()
            .optional()
            .transform((v) => (v ? Number.parseInt(v, 10) : 7)),
        }),
      },
    },
    async (request) => {
      const { tenantId, days } = request.query;
      const summary = await violationService.getViolationSummary(
        tenantId,
        typeof days === 'number' ? days : 7
      );
      return { summary };
    }
  );

  // ===========================================================================
  // GET SESSION VIOLATION COUNT
  // ===========================================================================

  app.get<{ Params: SessionParams }>(
    '/violations/session/:sessionId/count',
    {
      schema: {
        params: z.object({
          sessionId: z.string().uuid(),
        }),
      },
    },
    async (request) => {
      const { sessionId } = request.params;
      const count = await violationService.getSessionViolationCount(sessionId);
      return { count };
    }
  );

  // ===========================================================================
  // CHECK THRESHOLDS
  // ===========================================================================

  app.get<{ Params: SessionParams }>(
    '/violations/session/:sessionId/threshold-check',
    {
      schema: {
        params: z.object({
          sessionId: z.string().uuid(),
        }),
      },
    },
    async (request) => {
      const { sessionId } = request.params;
      const action = await violationService.checkThresholds(sessionId);
      return {
        thresholdExceeded: action !== null,
        recommendedAction: action,
      };
    }
  );
}
