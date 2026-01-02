// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/routes/sessions
 * Session management and transfer monitoring routes
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { z } from 'zod';

import type {
  DLPService,
  TransferAction,
  TransferType,
  TransferRequest,
} from '../services/dlp.service.js';
import type {
  ScreenshotDetectionService,
  ScreenCaptureEvent,
} from '../services/screenshot-detection.service.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const SessionIdParam = z.object({
  sessionId: z.string().uuid(),
});

const TransferQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  action: z.enum(['ALLOWED', 'BLOCKED', 'LOGGED', 'QUARANTINED', 'OVERRIDE_APPROVED']).optional(),
  transferType: z
    .enum([
      'CLIPBOARD_TEXT',
      'CLIPBOARD_IMAGE',
      'CLIPBOARD_FILE',
      'FILE_DOWNLOAD',
      'FILE_UPLOAD',
      'USB_TRANSFER',
      'PRINT',
      'SCREEN_SHARE',
    ])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const TransferRequestSchema = z.object({
  transferType: z.enum([
    'CLIPBOARD_TEXT',
    'CLIPBOARD_IMAGE',
    'CLIPBOARD_FILE',
    'FILE_DOWNLOAD',
    'FILE_UPLOAD',
    'USB_TRANSFER',
    'PRINT',
    'SCREEN_SHARE',
  ]),
  direction: z.enum(['UPLOAD', 'DOWNLOAD']),
  contentType: z.string().optional(),
  contentSize: z.number().positive().optional(),
  fileName: z.string().optional(),
  sourceApplication: z.string().optional(),
  targetApplication: z.string().optional(),
});

const ScreenCaptureEventSchema = z.object({
  captureType: z.enum([
    'SCREENSHOT',
    'SCREEN_RECORDING',
    'REMOTE_DESKTOP',
    'PRINT_SCREEN_KEY',
    'SNIPPING_TOOL',
    'THIRD_PARTY_APP',
    'BROWSER_EXTENSION',
    'OS_NATIVE',
  ]),
  detectionMethod: z.string(),
  processInfo: z
    .object({
      name: z.string(),
      pid: z.number(),
    })
    .optional(),
  activeApplication: z.string().optional(),
  activeWindow: z.string().optional(),
});

const ScreenCaptureQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  blocked: z.coerce.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// =============================================================================
// ROUTE TYPES
// =============================================================================

interface SessionParams {
  sessionId: string;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export function sessionRoutes(
  app: FastifyInstance,
  dlpService: DLPService,
  screenshotService: ScreenshotDetectionService,
  prisma: PrismaClient
): void {
  // ===========================================================================
  // GET SESSION DETAILS
  // ===========================================================================

  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId',
    {
      schema: {
        params: SessionIdParam,
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          securityPolicy: true,
        },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      // Get counts
      const [transferCount, violationCount, captureAttemptCount] = await Promise.all([
        prisma.dataTransferAttempt.count({ where: { sessionId } }),
        prisma.securityViolation.count({ where: { sessionId } }),
        prisma.screenCaptureAttempt.count({ where: { sessionId } }),
      ]);

      return {
        session: {
          id: session.id,
          status: session.status,
          type: session.type,
          user: session.user,
          policy: session.securityPolicy
            ? {
                id: session.securityPolicy.id,
                name: session.securityPolicy.name,
              }
            : null,
          startedAt: session.startedAt?.toISOString(),
          endedAt: session.endedAt?.toISOString(),
          createdAt: session.createdAt.toISOString(),
          stats: {
            transferCount,
            violationCount,
            captureAttemptCount,
          },
        },
      };
    }
  );

  // ===========================================================================
  // GET TRANSFER ATTEMPTS
  // ===========================================================================

  app.get<{
    Params: SessionParams;
    Querystring: z.infer<typeof TransferQuerySchema>;
  }>(
    '/sessions/:sessionId/transfers',
    {
      schema: {
        params: SessionIdParam,
        querystring: TransferQuerySchema,
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const {
        page = 1,
        limit = 20,
        action,
        transferType,
        startDate: _startDate,
        endDate: _endDate,
      } = request.query;

      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      const options: {
        page?: number;
        limit?: number;
        action?: TransferAction;
        transferType?: TransferType;
      } = {
        page,
        limit,
      };
      if (action) options.action = action as TransferAction;
      if (transferType) options.transferType = transferType as TransferType;

      const result = await dlpService.getTransferAttempts(sessionId, options);

      return {
        transfers: result.attempts.map((attempt) => ({
          id: attempt.id,
          transferType: attempt.transferType,
          direction: attempt.direction,
          action: attempt.action,
          reason: attempt.reason,
          contentType: attempt.contentType,
          contentSize: attempt.contentSize,
          fileName: attempt.fileName,
          createdAt: attempt.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    }
  );

  // ===========================================================================
  // EVALUATE TRANSFER (Real-time check)
  // ===========================================================================

  app.post<{
    Params: SessionParams;
    Body: z.infer<typeof TransferRequestSchema>;
  }>(
    '/sessions/:sessionId/transfers/evaluate',
    {
      schema: {
        params: SessionIdParam,
        body: TransferRequestSchema,
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const body = request.body;

      // Get session
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      // Get user and IP from request
      const userId = (request as unknown as { user?: { id: string } }).user?.id ?? session.userId;
      const ipAddress = request.ip;

      const transferRequest: TransferRequest = {
        podId: sessionId,
        sessionId,
        userId,
        tenantId: session.tenantId!,
        transferType: body.transferType,
        direction: body.direction,
        ipAddress,
      };
      if (body.contentSize !== undefined) transferRequest.contentSize = body.contentSize;
      if (body.contentType) transferRequest.contentType = body.contentType;
      if (body.fileName) transferRequest.fileName = body.fileName;
      if (body.sourceApplication) transferRequest.sourceApplication = body.sourceApplication;
      if (body.targetApplication) transferRequest.targetApplication = body.targetApplication;

      const result = await dlpService.evaluateTransfer(transferRequest);

      return {
        allowed: result.allowed,
        action: result.action,
        reason: result.reason,
        requiresApproval: result.requiresApproval,
        attemptId: result.attemptId,
      };
    }
  );

  // ===========================================================================
  // GET TRANSFER ATTEMPT DETAILS
  // ===========================================================================

  app.get<{
    Params: { sessionId: string; attemptId: string };
  }>(
    '/sessions/:sessionId/transfers/:attemptId',
    {
      schema: {
        params: z.object({
          sessionId: z.string().uuid(),
          attemptId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { sessionId, attemptId } = request.params;

      const attempt = await prisma.dataTransferAttempt.findFirst({
        where: {
          id: attemptId,
          sessionId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          policy: {
            select: {
              id: true,
              name: true,
            },
          },
          overrideRequest: true,
        },
      });

      if (!attempt) {
        return reply.status(404).send({ error: 'Transfer attempt not found' });
      }

      return {
        attempt: {
          id: attempt.id,
          transferType: attempt.transferType,
          direction: attempt.direction,
          action: attempt.action,
          reason: attempt.reason,
          contentType: attempt.contentType,
          contentSize: attempt.contentSize,
          contentHash: attempt.contentHash,
          fileName: attempt.fileName,
          sourceApplication: attempt.sourceApplication,
          targetApplication: attempt.targetApplication,
          ipAddress: attempt.ipAddress,
          user: attempt.user,
          policy: attempt.policy,
          overrideRequest: attempt.overrideRequest
            ? {
                id: attempt.overrideRequest.id,
                status: attempt.overrideRequest.status,
                reason: attempt.overrideRequest.reason,
              }
            : null,
          createdAt: attempt.createdAt.toISOString(),
        },
      };
    }
  );

  // ===========================================================================
  // GET SCREEN CAPTURE ATTEMPTS
  // ===========================================================================

  app.get<{
    Params: SessionParams;
    Querystring: z.infer<typeof ScreenCaptureQuerySchema>;
  }>(
    '/sessions/:sessionId/screen-captures',
    {
      schema: {
        params: SessionIdParam,
        querystring: ScreenCaptureQuerySchema,
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { page = 1, limit = 20, blocked, startDate, endDate } = request.query;
      const skip = (page - 1) * limit;

      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      const where: Record<string, unknown> = { sessionId };
      if (blocked !== undefined) where.blocked = blocked;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
        if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
      }

      const [attempts, total] = await Promise.all([
        prisma.screenCaptureAttempt.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.screenCaptureAttempt.count({ where }),
      ]);

      return {
        captures: attempts.map((attempt) => ({
          id: attempt.id,
          captureType: attempt.captureType,
          detectionMethod: attempt.detectionMethod,
          blocked: attempt.blocked,
          activeApplication: attempt.activeApplication,
          activeWindow: attempt.activeWindow,
          processName: attempt.processName,
          processId: attempt.processId,
          createdAt: attempt.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // ===========================================================================
  // REPORT SCREEN CAPTURE ATTEMPT
  // ===========================================================================

  app.post<{
    Params: SessionParams;
    Body: z.infer<typeof ScreenCaptureEventSchema>;
  }>(
    '/sessions/:sessionId/screen-captures',
    {
      schema: {
        params: SessionIdParam,
        body: ScreenCaptureEventSchema,
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const body = request.body;

      // Get session
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      const captureEvent: ScreenCaptureEvent = {
        podId: sessionId,
        sessionId,
        userId: session.userId,
        captureType: body.captureType,
        detectionMethod: body.detectionMethod,
      };
      if (body.processInfo) captureEvent.processInfo = body.processInfo;
      if (body.activeApplication) captureEvent.activeApplication = body.activeApplication;
      if (body.activeWindow) captureEvent.activeWindow = body.activeWindow;

      const result = await screenshotService.detectCaptureAttempt(captureEvent);

      return {
        blocked: result.blocked,
        attemptId: result.attemptId,
        notificationSent: result.notificationSent,
        securityAlertSent: result.securityAlertSent,
      };
    }
  );

  // ===========================================================================
  // GET SESSION SECURITY SUMMARY
  // ===========================================================================

  app.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/security-summary',
    {
      schema: {
        params: SessionIdParam,
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          securityPolicy: true,
        },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      // Get aggregated stats
      const [transferStats, violationStats, captureStats] = await Promise.all([
        // Transfer stats
        prisma.dataTransferAttempt.groupBy({
          by: ['action'],
          where: { sessionId },
          _count: { id: true },
        }),
        // Violation stats
        prisma.securityViolation.groupBy({
          by: ['violationType', 'severity'],
          where: { sessionId },
          _count: { id: true },
        }),
        // Screen capture stats
        prisma.screenCaptureAttempt.groupBy({
          by: ['captureType', 'blocked'],
          where: { sessionId },
          _count: { id: true },
        }),
      ]);

      // Recent events
      const recentEvents = await prisma.containmentAuditLog.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        sessionId,
        policy: session.securityPolicy
          ? {
              id: session.securityPolicy.id,
              name: session.securityPolicy.name,
            }
          : null,
        transfers: {
          byAction: transferStats.reduce(
            (acc, stat) => {
              acc[stat.action] = stat._count.id;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
        violations: {
          byType: violationStats.reduce(
            (acc, stat) => {
              const key = `${stat.violationType}:${stat.severity}`;
              acc[key] = stat._count.id;
              return acc;
            },
            {} as Record<string, number>
          ),
          total: violationStats.reduce((sum, stat) => sum + stat._count.id, 0),
        },
        screenCaptures: {
          blocked: captureStats.filter((s) => s.blocked).reduce((sum, s) => sum + s._count.id, 0),
          detected: captureStats.reduce((sum, s) => sum + s._count.id, 0),
        },
        recentEvents: recentEvents.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          eventCategory: event.eventCategory,
          description: event.description,
          allowed: event.allowed,
          createdAt: event.createdAt.toISOString(),
        })),
      };
    }
  );

  // ===========================================================================
  // GET SESSION AUDIT LOG
  // ===========================================================================

  app.get<{
    Params: SessionParams;
    Querystring: {
      page?: number;
      limit?: number;
      eventType?: string;
      eventCategory?: string;
    };
  }>(
    '/sessions/:sessionId/audit-log',
    {
      schema: {
        params: SessionIdParam,
        querystring: z.object({
          page: z.coerce.number().min(1).default(1).optional(),
          limit: z.coerce.number().min(1).max(100).default(50).optional(),
          eventType: z.string().optional(),
          eventCategory: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { page = 1, limit = 50, eventType, eventCategory } = request.query;
      const skip = (page - 1) * limit;

      // Verify session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      const where: Record<string, unknown> = { sessionId };
      if (eventType) where.eventType = eventType;
      if (eventCategory) where.eventCategory = eventCategory;

      const [logs, total] = await Promise.all([
        prisma.containmentAuditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.containmentAuditLog.count({ where }),
      ]);

      return {
        logs: logs.map((log) => ({
          id: log.id,
          eventType: log.eventType,
          eventCategory: log.eventCategory,
          description: log.description,
          details: log.details,
          sourceIp: log.sourceIp,
          targetResource: log.targetResource,
          allowed: log.allowed,
          blockedReason: log.blockedReason,
          createdAt: log.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );
}

