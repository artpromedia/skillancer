/**
 * @module @skillancer/skillpod-svc/routes/policy-exceptions
 * Policy exception management routes
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { z } from 'zod';

import type { PrismaClient } from '@/types/prisma-shim.js';
import type { FastifyInstance } from 'fastify';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const CreateExceptionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  scope: z.enum([
    'USER',
    'GROUP',
    'FILE_TYPE',
    'DOMAIN',
    'APPLICATION',
    'TIME_WINDOW',
    'IP_ADDRESS',
  ]),
  scopeValue: z.string().optional(),
  exceptionType: z.enum([
    'CLIPBOARD',
    'FILE_TRANSFER',
    'USB',
    'PRINT',
    'SCREEN_CAPTURE',
    'NETWORK',
  ]),
  allowedTransferTypes: z
    .array(
      z.enum([
        'CLIPBOARD_TEXT',
        'CLIPBOARD_IMAGE',
        'CLIPBOARD_FILE',
        'FILE_DOWNLOAD',
        'FILE_UPLOAD',
        'USB_TRANSFER',
        'PRINT',
        'SCREEN_SHARE',
      ])
    )
    .optional()
    .default([]),
  allowedDirections: z
    .array(z.enum(['INBOUND', 'OUTBOUND', 'INTERNAL']))
    .optional()
    .default([]),
  maxFileSize: z.number().int().positive().optional(),
  allowedFileTypes: z.array(z.string()).optional().default([]),
  allowedDomains: z.array(z.string()).optional().default([]),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  requiresApproval: z.boolean().default(false),
  approvalWorkflow: z.string().optional(),
  reason: z.string().min(10).max(1000),
});

const UpdateExceptionSchema = CreateExceptionSchema.partial().omit({ reason: true });

const ListExceptionsQuerySchema = z.object({
  scope: z
    .enum(['USER', 'GROUP', 'FILE_TYPE', 'DOMAIN', 'APPLICATION', 'TIME_WINDOW', 'IP_ADDRESS'])
    .optional(),
  exceptionType: z
    .enum(['CLIPBOARD', 'FILE_TRANSFER', 'USB', 'PRINT', 'SCREEN_CAPTURE', 'NETWORK'])
    .optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// =============================================================================
// ROUTE TYPES
// =============================================================================

interface PolicyParams {
  policyId: string;
}

interface ExceptionParams extends PolicyParams {
  exceptionId: string;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export function policyExceptionRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  // ===========================================================================
  // CREATE EXCEPTION
  // ===========================================================================

  app.post<{
    Params: PolicyParams;
    Body: z.infer<typeof CreateExceptionSchema>;
  }>(
    '/policies/:policyId/exceptions',
    {
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
        }),
        body: CreateExceptionSchema,
      },
    },
    async (request, reply) => {
      const { policyId } = request.params;
      const userId = (request.headers['x-user-id'] as string) ?? 'unknown';

      // Verify policy exists
      const policy = await prisma.podSecurityPolicy.findUnique({
        where: { id: policyId },
      });

      if (!policy) {
        return reply.status(404).send({
          error: 'Policy not found',
          message: 'The specified security policy does not exist',
        });
      }

      const {
        name,
        description,
        scope,
        scopeValue,
        exceptionType,
        allowedTransferTypes,
        allowedDirections,
        maxFileSize,
        allowedFileTypes,
        allowedDomains,
        validFrom,
        validUntil,
        requiresApproval,
        approvalWorkflow,
        reason,
      } = request.body;

      // Check for duplicate name within policy
      const existing = await prisma.policyException.findFirst({
        where: { policyId, name },
      });

      if (existing) {
        return reply.status(409).send({
          error: 'Duplicate name',
          message: 'An exception with this name already exists for this policy',
        });
      }

      const exception = await prisma.policyException.create({
        data: {
          policyId,
          name,
          description,
          scope,
          scopeValue,
          exceptionType,
          allowedTransferTypes,
          allowedDirections,
          maxFileSize,
          allowedFileTypes,
          allowedDomains,
          validFrom: validFrom ? new Date(validFrom) : null,
          validUntil: validUntil ? new Date(validUntil) : null,
          requiresApproval,
          approvalWorkflow,
          reason,
          createdBy: userId,
          isActive: true,
        },
      });

      return {
        exception: {
          id: exception.id,
          name: exception.name,
          scope: exception.scope,
          exceptionType: exception.exceptionType,
          isActive: exception.isActive,
          createdAt: exception.createdAt.toISOString(),
        },
        message: 'Exception created successfully',
      };
    }
  );

  // ===========================================================================
  // GET EXCEPTION
  // ===========================================================================

  app.get<{ Params: ExceptionParams }>(
    '/policies/:policyId/exceptions/:exceptionId',
    {
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
          exceptionId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { policyId, exceptionId } = request.params;

      const exception = await prisma.policyException.findFirst({
        where: { id: exceptionId, policyId },
      });

      if (!exception) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Exception not found',
        });
      }

      return {
        exception: {
          id: exception.id,
          name: exception.name,
          description: exception.description,
          scope: exception.scope,
          scopeValue: exception.scopeValue,
          exceptionType: exception.exceptionType,
          allowedTransferTypes: exception.allowedTransferTypes,
          allowedDirections: exception.allowedDirections,
          maxFileSize: exception.maxFileSize,
          allowedFileTypes: exception.allowedFileTypes,
          allowedDomains: exception.allowedDomains,
          validFrom: exception.validFrom?.toISOString(),
          validUntil: exception.validUntil?.toISOString(),
          requiresApproval: exception.requiresApproval,
          approvalWorkflow: exception.approvalWorkflow,
          reason: exception.reason,
          isActive: exception.isActive,
          createdBy: exception.createdBy,
          approvedBy: exception.approvedBy,
          createdAt: exception.createdAt.toISOString(),
          updatedAt: exception.updatedAt.toISOString(),
        },
      };
    }
  );

  // ===========================================================================
  // LIST EXCEPTIONS
  // ===========================================================================

  app.get<{
    Params: PolicyParams;
    Querystring: z.infer<typeof ListExceptionsQuerySchema>;
  }>(
    '/policies/:policyId/exceptions',
    {
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
        }),
        querystring: ListExceptionsQuerySchema,
      },
    },
    async (request, reply) => {
      const { policyId } = request.params;
      const { scope, exceptionType, isActive, page, limit } = request.query;

      // Verify policy exists
      const policy = await prisma.podSecurityPolicy.findUnique({
        where: { id: policyId },
      });

      if (!policy) {
        return reply.status(404).send({
          error: 'Policy not found',
          message: 'The specified security policy does not exist',
        });
      }

      const where: Record<string, unknown> = { policyId };

      if (scope) {
        where.scope = scope;
      }
      if (exceptionType) {
        where.exceptionType = exceptionType;
      }
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [exceptions, total] = await Promise.all([
        prisma.policyException.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.policyException.count({ where }),
      ]);

      return {
        exceptions: exceptions.map((e) => ({
          id: e.id,
          name: e.name,
          scope: e.scope,
          scopeValue: e.scopeValue,
          exceptionType: e.exceptionType,
          isActive: e.isActive,
          validFrom: e.validFrom?.toISOString(),
          validUntil: e.validUntil?.toISOString(),
          createdAt: e.createdAt.toISOString(),
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
  // UPDATE EXCEPTION
  // ===========================================================================

  app.patch<{
    Params: ExceptionParams;
    Body: z.infer<typeof UpdateExceptionSchema>;
  }>(
    '/policies/:policyId/exceptions/:exceptionId',
    {
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
          exceptionId: z.string().uuid(),
        }),
        body: UpdateExceptionSchema,
      },
    },
    async (request, reply) => {
      const { policyId, exceptionId } = request.params;

      const exception = await prisma.policyException.findFirst({
        where: { id: exceptionId, policyId },
      });

      if (!exception) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Exception not found',
        });
      }

      const updateData: Record<string, unknown> = {};

      // Only include provided fields
      const fields = [
        'name',
        'description',
        'scope',
        'scopeValue',
        'exceptionType',
        'allowedTransferTypes',
        'allowedDirections',
        'maxFileSize',
        'allowedFileTypes',
        'allowedDomains',
        'requiresApproval',
        'approvalWorkflow',
      ] as const;

      for (const field of fields) {
        if (request.body[field] !== undefined) {
          updateData[field] = request.body[field];
        }
      }

      if (request.body.validFrom !== undefined) {
        updateData.validFrom = request.body.validFrom ? new Date(request.body.validFrom) : null;
      }
      if (request.body.validUntil !== undefined) {
        updateData.validUntil = request.body.validUntil ? new Date(request.body.validUntil) : null;
      }

      const updated = await prisma.policyException.update({
        where: { id: exceptionId },
        data: updateData,
      });

      return {
        exception: {
          id: updated.id,
          name: updated.name,
          scope: updated.scope,
          exceptionType: updated.exceptionType,
          isActive: updated.isActive,
          updatedAt: updated.updatedAt.toISOString(),
        },
        message: 'Exception updated successfully',
      };
    }
  );

  // ===========================================================================
  // DELETE EXCEPTION
  // ===========================================================================

  app.delete<{ Params: ExceptionParams }>(
    '/policies/:policyId/exceptions/:exceptionId',
    {
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
          exceptionId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { policyId, exceptionId } = request.params;

      const exception = await prisma.policyException.findFirst({
        where: { id: exceptionId, policyId },
      });

      if (!exception) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Exception not found',
        });
      }

      await prisma.policyException.delete({
        where: { id: exceptionId },
      });

      return {
        success: true,
        message: 'Exception deleted successfully',
      };
    }
  );

  // ===========================================================================
  // ACTIVATE/DEACTIVATE EXCEPTION
  // ===========================================================================

  app.post<{ Params: ExceptionParams }>(
    '/policies/:policyId/exceptions/:exceptionId/activate',
    {
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
          exceptionId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { policyId, exceptionId } = request.params;

      const exception = await prisma.policyException.findFirst({
        where: { id: exceptionId, policyId },
      });

      if (!exception) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Exception not found',
        });
      }

      await prisma.policyException.update({
        where: { id: exceptionId },
        data: { isActive: true },
      });

      return {
        success: true,
        message: 'Exception activated',
      };
    }
  );

  app.post<{ Params: ExceptionParams }>(
    '/policies/:policyId/exceptions/:exceptionId/deactivate',
    {
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
          exceptionId: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { policyId, exceptionId } = request.params;

      const exception = await prisma.policyException.findFirst({
        where: { id: exceptionId, policyId },
      });

      if (!exception) {
        return reply.status(404).send({
          error: 'Not found',
          message: 'Exception not found',
        });
      }

      await prisma.policyException.update({
        where: { id: exceptionId },
        data: { isActive: false },
      });

      return {
        success: true,
        message: 'Exception deactivated',
      };
    }
  );

  // ===========================================================================
  // CHECK IF EXCEPTION APPLIES
  // ===========================================================================

  app.post<{
    Params: PolicyParams;
    Body: {
      userId?: string;
      groupId?: string;
      fileType?: string;
      domain?: string;
      application?: string;
      ipAddress?: string;
      transferType: string;
      direction: string;
    };
  }>(
    '/policies/:policyId/exceptions/check',
    {
      schema: {
        params: z.object({
          policyId: z.string().uuid(),
        }),
        body: z.object({
          userId: z.string().uuid().optional(),
          groupId: z.string().uuid().optional(),
          fileType: z.string().optional(),
          domain: z.string().optional(),
          application: z.string().optional(),
          ipAddress: z.string().optional(),
          transferType: z.string(),
          direction: z.enum(['INBOUND', 'OUTBOUND', 'INTERNAL']),
        }),
      },
    },
    async (request, reply) => {
      const { policyId } = request.params;
      const { userId, groupId, fileType, domain, application, ipAddress, transferType, direction } =
        request.body;

      // Get all active exceptions for this policy
      const exceptions = await prisma.policyException.findMany({
        where: {
          policyId,
          isActive: true,
        },
      });

      const now = new Date();
      const matchingExceptions = [];

      for (const exception of exceptions) {
        // Check time validity
        if (exception.validFrom && now < exception.validFrom) continue;
        if (exception.validUntil && now > exception.validUntil) continue;

        // Check scope match
        let scopeMatch = false;
        switch (exception.scope) {
          case 'USER':
            scopeMatch = userId === exception.scopeValue;
            break;
          case 'GROUP':
            scopeMatch = groupId === exception.scopeValue;
            break;
          case 'FILE_TYPE':
            scopeMatch = fileType === exception.scopeValue;
            break;
          case 'DOMAIN':
            scopeMatch = domain?.includes(exception.scopeValue ?? '') ?? false;
            break;
          case 'APPLICATION':
            scopeMatch = application === exception.scopeValue;
            break;
          case 'IP_ADDRESS':
            scopeMatch = ipAddress === exception.scopeValue;
            break;
          case 'TIME_WINDOW':
            // Time window is already checked above
            scopeMatch = true;
            break;
        }

        if (!scopeMatch) continue;

        // Check transfer type and direction
        const typeMatch =
          exception.allowedTransferTypes.length === 0 ||
          exception.allowedTransferTypes.includes(transferType as never);
        const directionMatch =
          exception.allowedDirections.length === 0 ||
          exception.allowedDirections.includes(direction as never);

        if (typeMatch && directionMatch) {
          matchingExceptions.push({
            id: exception.id,
            name: exception.name,
            exceptionType: exception.exceptionType,
            requiresApproval: exception.requiresApproval,
            maxFileSize: exception.maxFileSize,
            allowedFileTypes: exception.allowedFileTypes,
          });
        }
      }

      return {
        applies: matchingExceptions.length > 0,
        exceptions: matchingExceptions,
      };
    }
  );
}
