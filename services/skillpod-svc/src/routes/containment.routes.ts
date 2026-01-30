// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/routes/containment
 * Data containment API routes
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { z } from 'zod';

import { requireAuth } from '../plugins/auth.js';
import type { DataContainmentService } from '../services/data-containment.service.js';
import type { TransferDirection } from '../types/containment.types.js';
import type { FastifyInstance } from 'fastify';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const ClipboardCheckSchema = z.object({
  sessionId: z.string().uuid(),
  direction: z.enum(['inbound', 'outbound']),
  contentType: z.string(),
  contentLength: z.number().positive(),
  contentHash: z.string().optional(),
});

const FileTransferCheckSchema = z.object({
  sessionId: z.string().uuid(),
  direction: z.enum(['UPLOAD', 'DOWNLOAD']),
  fileName: z.string().min(1),
  fileType: z.string(),
  fileSize: z.number().positive(),
  fileHash: z.string().optional(),
});

const NetworkAccessCheckSchema = z.object({
  sessionId: z.string().uuid(),
  targetUrl: z.string().url(),
  protocol: z.string().default('https'),
});

const PeripheralAccessCheckSchema = z.object({
  sessionId: z.string().uuid(),
  deviceType: z.enum(['usb', 'webcam', 'microphone', 'printer']),
  deviceId: z.string().optional(),
  deviceClass: z.string().optional(),
});

const FileTransferRequestSchema = z.object({
  sessionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  direction: z.enum(['UPLOAD', 'DOWNLOAD']),
  purpose: z.string().min(1),
});

// =============================================================================
// ROUTE TYPES
// =============================================================================

interface SessionParams {
  sessionId: string;
}

interface RequestParams {
  requestId: string;
}

interface ApprovalBody {
  approvedBy: string;
}

interface RejectionBody {
  rejectedBy: string;
  reason: string;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export function containmentRoutes(
  app: FastifyInstance,
  containmentService: DataContainmentService
): void {
  // Get rate limit hooks from the registered plugin
  const { fileOperations } = app.skillpodRateLimit;

  // ===========================================================================
  // CLIPBOARD ACCESS CHECK
  // Rate limit: 100 requests/minute per user (file operations)
  // ===========================================================================

  app.post<{
    Body: z.infer<typeof ClipboardCheckSchema>;
  }>(
    '/containment/clipboard/check',
    {
      preHandler: [requireAuth, fileOperations],
      schema: {
        body: ClipboardCheckSchema,
      },
    },
    async (request) => {
      const result = await containmentService.checkClipboardAccess(request.body);
      return result;
    }
  );

  // ===========================================================================
  // FILE TRANSFER CHECK
  // Rate limit: 100 requests/minute per user (file operations)
  // ===========================================================================

  app.post<{
    Body: z.infer<typeof FileTransferCheckSchema>;
  }>(
    '/containment/file-transfer/check',
    {
      preHandler: [requireAuth, fileOperations],
      schema: {
        body: FileTransferCheckSchema,
      },
    },
    async (request) => {
      const result = await containmentService.checkFileTransfer({
        ...request.body,
        direction: request.body.direction as TransferDirection,
      });
      return result;
    }
  );

  // ===========================================================================
  // NETWORK ACCESS CHECK
  // Rate limit: 100 requests/minute per user (file operations)
  // ===========================================================================

  app.post<{
    Body: z.infer<typeof NetworkAccessCheckSchema>;
  }>(
    '/containment/network/check',
    {
      preHandler: [requireAuth, fileOperations],
      schema: {
        body: NetworkAccessCheckSchema,
      },
    },
    async (request) => {
      const result = await containmentService.checkNetworkAccess(request.body);
      return result;
    }
  );

  // ===========================================================================
  // PERIPHERAL ACCESS CHECK
  // ===========================================================================

  app.post<{
    Body: z.infer<typeof PeripheralAccessCheckSchema>;
  }>(
    '/containment/peripheral/check',
    {
      preHandler: [requireAuth],
      schema: {
        body: PeripheralAccessCheckSchema,
      },
    },
    async (request) => {
      const result = await containmentService.checkPeripheralAccess(request.body);
      return result;
    }
  );

  // ===========================================================================
  // PRINT ACCESS CHECK
  // ===========================================================================

  app.post<{ Params: SessionParams }>(
    '/containment/print/check/:sessionId',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          sessionId: z.string().uuid(),
        }),
      },
    },
    async (request) => {
      const { sessionId } = request.params;
      const result = await containmentService.checkPrintAccess(sessionId);
      return result;
    }
  );

  // ===========================================================================
  // SCREEN CAPTURE CHECK
  // ===========================================================================

  app.post<{ Params: SessionParams }>(
    '/containment/screen-capture/check/:sessionId',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          sessionId: z.string().uuid(),
        }),
      },
    },
    async (request) => {
      const { sessionId } = request.params;
      const result = await containmentService.checkScreenCapture(sessionId);
      return result;
    }
  );

  // ===========================================================================
  // FILE TRANSFER REQUESTS
  // ===========================================================================

  app.post<{
    Body: z.infer<typeof FileTransferRequestSchema>;
  }>(
    '/containment/file-transfer/request',
    {
      preHandler: [requireAuth],
      schema: {
        body: FileTransferRequestSchema,
      },
    },
    async (request, reply) => {
      const result = await containmentService.createFileTransferRequest({
        ...request.body,
        direction: request.body.direction as TransferDirection,
      });
      return reply.status(201).send(result);
    }
  );

  app.post<{ Params: RequestParams; Body: ApprovalBody }>(
    '/containment/file-transfer/:requestId/approve',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          requestId: z.string().uuid(),
        }),
        body: z.object({
          approvedBy: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { requestId } = request.params;
      const { approvedBy } = request.body;
      await containmentService.approveFileTransfer(requestId, approvedBy);
      return reply.status(204).send();
    }
  );

  app.post<{ Params: RequestParams; Body: RejectionBody }>(
    '/containment/file-transfer/:requestId/reject',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          requestId: z.string().uuid(),
        }),
        body: z.object({
          rejectedBy: z.string().uuid(),
          reason: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      const { requestId } = request.params;
      const { rejectedBy, reason } = request.body;
      await containmentService.rejectFileTransfer(requestId, rejectedBy, reason);
      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // SESSION CONTEXT
  // ===========================================================================

  app.get<{ Params: SessionParams }>(
    '/containment/session/:sessionId/context',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          sessionId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const context = await containmentService.getSessionContext(sessionId);

      if (!context) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      return { context };
    }
  );

  // ===========================================================================
  // WATERMARK CONFIGURATION
  // ===========================================================================

  app.get<{ Params: SessionParams }>(
    '/containment/session/:sessionId/watermark',
    {
      preHandler: [requireAuth],
      schema: {
        params: z.object({
          sessionId: z.string().uuid(),
        }),
      },
    },
    async (request) => {
      const { sessionId } = request.params;
      const watermark = await containmentService.generateWatermarkConfig(sessionId);
      return watermark;
    }
  );
}
