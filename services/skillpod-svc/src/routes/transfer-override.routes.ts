/**
 * @module @skillancer/skillpod-svc/routes/transfer-override
 * Transfer override request and approval routes
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { z } from 'zod';

import type { WebSocketEnforcementService } from '../services/websocket-enforcement.service.js';
import type { PrismaClient } from '@/types/prisma-shim.js';
import type { FastifyInstance } from 'fastify';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateOverrideRequestSchema = z.object({
  attemptId: z.string().uuid().optional(),
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
  direction: z.enum(['INBOUND', 'OUTBOUND', 'INTERNAL']),
  fileName: z.string().optional(),
  contentSize: z.number().optional(),
  reason: z.string().min(10).max(1000),
});

const ApproveOverrideSchema = z.object({
  approvalNotes: z.string().max(500).optional(),
});

const RejectOverrideSchema = z.object({
  rejectionReason: z.string().min(10).max(500),
});

const ListOverridesQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']).optional(),
  requestedBy: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// =============================================================================
// ROUTE TYPES
// =============================================================================

interface RequestParams {
  requestId: string;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export function transferOverrideRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  wsService: WebSocketEnforcementService
): void {
  // ===========================================================================
  // CREATE OVERRIDE REQUEST
  // ===========================================================================

  app.post<{
    Body: z.infer<typeof CreateOverrideRequestSchema>;
  }>(
    '/override-requests',
    {
      schema: {
        body: CreateOverrideRequestSchema,
      },
    },
    async (request, reply) => {
      const { attemptId, transferType, direction, fileName, contentSize, reason } = request.body;

      // Get user from auth (placeholder - implement based on your auth system)
      const userId = (request.headers['x-user-id'] as string) ?? 'unknown';
      const tenantId = (request.headers['x-tenant-id'] as string) ?? 'unknown';

      // If attemptId provided, verify it exists and was blocked
      if (attemptId) {
        const attempt = await prisma.dataTransferAttempt.findUnique({
          where: { id: attemptId },
        });

        if (!attempt) {
          return reply.status(404).send({
            error: 'Attempt not found',
            message: 'The specified transfer attempt does not exist',
          });
        }

        if (attempt.action !== 'BLOCKED' && attempt.action !== 'QUARANTINED') {
          return reply.status(400).send({
            error: 'Invalid attempt',
            message: 'Only blocked or quarantined transfers can request override',
          });
        }
      }

      // Create override request with 24-hour expiration
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const overrideRequest = await prisma.transferOverrideRequest.create({
        data: {
          tenantId,
          attemptId,
          requestedBy: userId,
          reason,
          transferType,
          direction,
          fileName,
          contentSize,
          status: 'PENDING',
          expiresAt,
        },
      });

      // Notify approvers via WebSocket
      await wsService.broadcastToTenant(tenantId, {
        type: 'OVERRIDE_REQUEST_CREATED',
        data: {
          requestId: overrideRequest.id,
          requestedBy: userId,
          transferType,
          reason,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        requestId: overrideRequest.id,
        status: 'PENDING',
        expiresAt: expiresAt.toISOString(),
        message: 'Override request submitted for approval',
      };
    }
  );

  // ===========================================================================
  // GET OVERRIDE REQUEST
  // ===========================================================================

  app.get<{ Params: RequestParams }>(
    '/override-requests/:requestId',
    {
      schema: {
        params: z.object({
          requestId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { requestId } = request.params;

      const overrideRequest = await prisma.transferOverrideRequest.findUnique({
        where: { id: requestId },
        include: {
          attempts: true,
        },
      });

      if (!overrideRequest) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Override request not found',
        });
      }

      return {
        request: {
          id: overrideRequest.id,
          requestedBy: overrideRequest.requestedBy,
          transferType: overrideRequest.transferType,
          direction: overrideRequest.direction,
          fileName: overrideRequest.fileName,
          contentSize: overrideRequest.contentSize,
          reason: overrideRequest.reason,
          status: overrideRequest.status,
          approvedBy: overrideRequest.approvedBy,
          approvalNotes: overrideRequest.approvalNotes,
          processedAt: overrideRequest.processedAt?.toISOString(),
          expiresAt: overrideRequest.expiresAt.toISOString(),
          createdAt: overrideRequest.createdAt.toISOString(),
        },
      };
    }
  );

  // ===========================================================================
  // LIST OVERRIDE REQUESTS
  // ===========================================================================

  app.get<{
    Querystring: z.infer<typeof ListOverridesQuerySchema>;
  }>(
    '/override-requests',
    {
      schema: {
        querystring: ListOverridesQuerySchema,
      },
    },
    async (request) => {
      const { status, requestedBy, startDate, endDate, page, limit } = request.query;
      const tenantId = (request.headers['x-tenant-id'] as string) ?? 'unknown';

      const where: Record<string, unknown> = { tenantId };

      if (status) {
        where.status = status;
      }
      if (requestedBy) {
        where.requestedBy = requestedBy;
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
        }
        if (endDate) {
          (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
        }
      }

      const [requests, total] = await Promise.all([
        prisma.transferOverrideRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.transferOverrideRequest.count({ where }),
      ]);

      return {
        requests: requests.map((r) => ({
          id: r.id,
          requestedBy: r.requestedBy,
          transferType: r.transferType,
          direction: r.direction,
          fileName: r.fileName,
          reason: r.reason,
          status: r.status,
          expiresAt: r.expiresAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // ===========================================================================
  // APPROVE OVERRIDE REQUEST
  // ===========================================================================

  app.post<{
    Params: RequestParams;
    Body: z.infer<typeof ApproveOverrideSchema>;
  }>(
    '/override-requests/:requestId/approve',
    {
      schema: {
        params: z.object({
          requestId: z.string().uuid(),
        }),
        body: ApproveOverrideSchema,
      },
    },
    async (request, reply) => {
      const { requestId } = request.params;
      const { approvalNotes } = request.body;
      const approvedBy = (request.headers['x-user-id'] as string) ?? 'unknown';

      const overrideRequest = await prisma.transferOverrideRequest.findUnique({
        where: { id: requestId },
      });

      if (!overrideRequest) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Override request not found',
        });
      }

      if (overrideRequest.status !== 'PENDING') {
        return reply.status(400).send({
          error: 'Invalid status',
          message: `Cannot approve request with status: ${overrideRequest.status}`,
        });
      }

      if (new Date() > overrideRequest.expiresAt) {
        await prisma.transferOverrideRequest.update({
          where: { id: requestId },
          data: { status: 'EXPIRED' },
        });
        return reply.status(400).send({
          error: 'Expired',
          message: 'This override request has expired',
        });
      }

      // Update the request
      await prisma.transferOverrideRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvalNotes,
          processedAt: new Date(),
        },
      });

      // If linked to a transfer attempt, update it
      if (overrideRequest.attemptId) {
        await prisma.dataTransferAttempt.update({
          where: { id: overrideRequest.attemptId },
          data: {
            overrideApproved: true,
            overrideBy: approvedBy,
            overrideReason: overrideRequest.reason,
            overrideRequestId: requestId,
          },
        });
      }

      // Notify requester
      await wsService.broadcastToTenant(overrideRequest.tenantId, {
        type: 'OVERRIDE_REQUEST_APPROVED',
        data: {
          requestId,
          requestedBy: overrideRequest.requestedBy,
          approvedBy,
          transferType: overrideRequest.transferType,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: 'Override request approved',
        requestId,
      };
    }
  );

  // ===========================================================================
  // REJECT OVERRIDE REQUEST
  // ===========================================================================

  app.post<{
    Params: RequestParams;
    Body: z.infer<typeof RejectOverrideSchema>;
  }>(
    '/override-requests/:requestId/reject',
    {
      schema: {
        params: z.object({
          requestId: z.string().uuid(),
        }),
        body: RejectOverrideSchema,
      },
    },
    async (request, reply) => {
      const { requestId } = request.params;
      const { rejectionReason } = request.body;
      const rejectedBy = (request.headers['x-user-id'] as string) ?? 'unknown';

      const overrideRequest = await prisma.transferOverrideRequest.findUnique({
        where: { id: requestId },
      });

      if (!overrideRequest) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Override request not found',
        });
      }

      if (overrideRequest.status !== 'PENDING') {
        return reply.status(400).send({
          error: 'Invalid status',
          message: `Cannot reject request with status: ${overrideRequest.status}`,
        });
      }

      // Update the request
      await prisma.transferOverrideRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          approvedBy: rejectedBy, // Store who rejected
          approvalNotes: rejectionReason,
          processedAt: new Date(),
        },
      });

      // Notify requester
      await wsService.broadcastToTenant(overrideRequest.tenantId, {
        type: 'OVERRIDE_REQUEST_REJECTED',
        data: {
          requestId,
          requestedBy: overrideRequest.requestedBy,
          rejectedBy,
          reason: rejectionReason,
          transferType: overrideRequest.transferType,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: 'Override request rejected',
        requestId,
      };
    }
  );

  // ===========================================================================
  // CANCEL OVERRIDE REQUEST
  // ===========================================================================

  app.post<{ Params: RequestParams }>(
    '/override-requests/:requestId/cancel',
    {
      schema: {
        params: z.object({
          requestId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { requestId } = request.params;
      const userId = (request.headers['x-user-id'] as string) ?? 'unknown';

      const overrideRequest = await prisma.transferOverrideRequest.findUnique({
        where: { id: requestId },
      });

      if (!overrideRequest) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Override request not found',
        });
      }

      if (overrideRequest.requestedBy !== userId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only cancel your own requests',
        });
      }

      if (overrideRequest.status !== 'PENDING') {
        return reply.status(400).send({
          error: 'Invalid status',
          message: `Cannot cancel request with status: ${overrideRequest.status}`,
        });
      }

      await prisma.transferOverrideRequest.update({
        where: { id: requestId },
        data: {
          status: 'CANCELLED',
          processedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Override request cancelled',
        requestId,
      };
    }
  );

  // ===========================================================================
  // GET PENDING COUNT (for admin dashboard)
  // ===========================================================================

  app.get('/override-requests/pending-count', async (request) => {
    const tenantId = (request.headers['x-tenant-id'] as string) ?? 'unknown';

    const count = await prisma.transferOverrideRequest.count({
      where: {
        tenantId,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    return { pendingCount: count };
  });
}
