// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
/**
 * @module @skillancer/billing-svc/routes/time-logs
 * Time tracking routes for hourly contracts
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getErrorResponse } from '../errors/index.js';
import { getTimeLogService } from '../services/time-log.service.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface UserPayload {
  id: string;
  email: string;
  sessionId: string;
  tenantId?: string;
}

// Helper to get user from request (throws if not authenticated)
function requireUser(request: FastifyRequest): UserPayload {
  const user = request.user as UserPayload | undefined;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

// =============================================================================
// SCHEMAS
// =============================================================================

// Create time log request
const CreateTimeLogSchema = z.object({
  contractId: z.string().uuid(),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  duration: z.number().positive().optional(),
  hourlyRate: z.number().positive(),
  skillpodSessionId: z.string().uuid().optional(),
  isVerified: z.boolean().optional(),
});

// Update time log request
const UpdateTimeLogSchema = z.object({
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  duration: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
});

// Reject time log request
const RejectTimeLogSchema = z.object({
  reason: z.string().min(10),
});

// Bulk approve request
const BulkApproveSchema = z.object({
  timeLogIds: z.array(z.string().uuid()).min(1),
});

// =============================================================================
// ROUTE PARAMS
// =============================================================================

interface TimeLogIdParams {
  Params: {
    timeLogId: string;
  };
}

interface ContractIdParams {
  Params: {
    contractId: string;
  };
}

// =============================================================================
// ROUTES
// =============================================================================

export const timeLogRoutes: FastifyPluginAsync = async (fastify) => {
  const timeLogService = getTimeLogService();

  // ===========================================================================
  // CREATE TIME LOG
  // ===========================================================================

  /**
   * POST /time-logs
   * Create a new time log entry (freelancer only)
   */
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new time log entry',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(CreateTimeLogSchema),
        response: {
          201: {
            description: 'Time log created',
            type: 'object',
          },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only freelancer can log time' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateTimeLogSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const body = CreateTimeLogSchema.parse(request.body);

        const result = await timeLogService.createTimeLog(
          {
            contractId: body.contractId,
            description: body.description,
            startTime: new Date(body.startTime),
            endTime: body.endTime ? new Date(body.endTime) : undefined,
            duration: body.duration,
            hourlyRate: body.hourlyRate,
            skillpodSessionId: body.skillpodSessionId,
            isVerified: body.isVerified,
          },
          user.id
        );

        return await reply.status(201).send(result);
      } catch (error) {
        request.log.error(error, 'Error creating time log');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET TIME LOG
  // ===========================================================================

  /**
   * GET /time-logs/:timeLogId
   * Get time log details
   */
  fastify.get<TimeLogIdParams>(
    '/:timeLogId',
    {
      schema: {
        description: 'Get time log details',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['timeLogId'],
          properties: {
            timeLogId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Time log details',
            type: 'object',
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Not authorized' },
          404: { description: 'Time log not found' },
        },
      },
    },
    async (request: FastifyRequest<TimeLogIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { timeLogId } = request.params;

        const timeLog = await timeLogService.getTimeLog(timeLogId, user.id);

        return await reply.send(timeLog);
      } catch (error) {
        request.log.error(error, 'Error getting time log');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET CONTRACT TIME LOGS
  // ===========================================================================

  /**
   * GET /time-logs/contract/:contractId
   * Get all time logs for a contract
   */
  fastify.get<ContractIdParams & { Querystring: { status?: string } }>(
    '/contract/:contractId',
    {
      schema: {
        description: 'Get all time logs for a contract',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['contractId'],
          properties: {
            contractId: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Contract time logs',
            type: 'object',
            properties: {
              timeLogs: { type: 'array' },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Not authorized' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (
      request: FastifyRequest<ContractIdParams & { Querystring: { status?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { contractId } = request.params;
        const { status } = request.query;

        const timeLogs = await timeLogService.getTimeLogsByContract(contractId, user.id, status);

        return await reply.send({ timeLogs });
      } catch (error) {
        request.log.error(error, 'Error getting contract time logs');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET TIME LOG SUMMARY
  // ===========================================================================

  /**
   * GET /time-logs/contract/:contractId/summary
   * Get time log summary for a contract
   */
  fastify.get<ContractIdParams>(
    '/contract/:contractId/summary',
    {
      schema: {
        description: 'Get time log summary for a contract',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['contractId'],
          properties: {
            contractId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Time log summary',
            type: 'object',
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Not authorized' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (request: FastifyRequest<ContractIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { contractId } = request.params;

        const summary = await timeLogService.getTimeLogSummary(contractId, user.id);

        return await reply.send(summary);
      } catch (error) {
        request.log.error(error, 'Error getting time log summary');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET PENDING LOGS FOR REVIEW
  // ===========================================================================

  /**
   * GET /time-logs/contract/:contractId/pending
   * Get pending time logs for client review
   */
  fastify.get<ContractIdParams>(
    '/contract/:contractId/pending',
    {
      schema: {
        description: 'Get pending time logs for review',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['contractId'],
          properties: {
            contractId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Pending time logs',
            type: 'object',
            properties: {
              timeLogs: { type: 'array' },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Only client can view pending' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (request: FastifyRequest<ContractIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { contractId } = request.params;

        const timeLogs = await timeLogService.getPendingForReview(contractId, user.id);

        return await reply.send({ timeLogs });
      } catch (error) {
        request.log.error(error, 'Error getting pending time logs');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // UPDATE TIME LOG
  // ===========================================================================

  /**
   * PATCH /time-logs/:timeLogId
   * Update a pending time log (freelancer only)
   */
  fastify.patch<TimeLogIdParams & { Body: z.infer<typeof UpdateTimeLogSchema> }>(
    '/:timeLogId',
    {
      schema: {
        description: 'Update a pending time log',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['timeLogId'],
          properties: {
            timeLogId: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(UpdateTimeLogSchema),
        response: {
          200: {
            description: 'Time log updated',
            type: 'object',
          },
          400: { description: 'Can only update pending logs' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only freelancer can update' },
          404: { description: 'Time log not found' },
        },
      },
    },
    async (
      request: FastifyRequest<TimeLogIdParams & { Body: z.infer<typeof UpdateTimeLogSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { timeLogId } = request.params;
        const body = UpdateTimeLogSchema.parse(request.body);

        const result = await timeLogService.updateTimeLog(timeLogId, user.id, {
          description: body.description,
          startTime: body.startTime ? new Date(body.startTime) : undefined,
          endTime: body.endTime ? new Date(body.endTime) : undefined,
          duration: body.duration,
          hourlyRate: body.hourlyRate,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error updating time log');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // DELETE TIME LOG
  // ===========================================================================

  /**
   * DELETE /time-logs/:timeLogId
   * Delete a pending time log (freelancer only)
   */
  fastify.delete<TimeLogIdParams>(
    '/:timeLogId',
    {
      schema: {
        description: 'Delete a pending time log',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['timeLogId'],
          properties: {
            timeLogId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { description: 'Time log deleted' },
          400: { description: 'Can only delete pending logs' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only freelancer can delete' },
          404: { description: 'Time log not found' },
        },
      },
    },
    async (request: FastifyRequest<TimeLogIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { timeLogId } = request.params;

        await timeLogService.deleteTimeLog(timeLogId, user.id);

        return await reply.status(204).send();
      } catch (error) {
        request.log.error(error, 'Error deleting time log');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // APPROVE TIME LOG
  // ===========================================================================

  /**
   * POST /time-logs/:timeLogId/approve
   * Approve a time log (client only)
   */
  fastify.post<TimeLogIdParams>(
    '/:timeLogId/approve',
    {
      schema: {
        description: 'Approve a time log',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['timeLogId'],
          properties: {
            timeLogId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Time log approved',
            type: 'object',
          },
          400: { description: 'Time log not pending' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only client can approve' },
          404: { description: 'Time log not found' },
        },
      },
    },
    async (request: FastifyRequest<TimeLogIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { timeLogId } = request.params;

        const result = await timeLogService.approveTimeLog({
          timeLogId,
          clientUserId: user.id,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error approving time log');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // REJECT TIME LOG
  // ===========================================================================

  /**
   * POST /time-logs/:timeLogId/reject
   * Reject a time log (client only)
   */
  fastify.post<TimeLogIdParams & { Body: z.infer<typeof RejectTimeLogSchema> }>(
    '/:timeLogId/reject',
    {
      schema: {
        description: 'Reject a time log',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['timeLogId'],
          properties: {
            timeLogId: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(RejectTimeLogSchema),
        response: {
          200: {
            description: 'Time log rejected',
            type: 'object',
          },
          400: { description: 'Time log not pending' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only client can reject' },
          404: { description: 'Time log not found' },
        },
      },
    },
    async (
      request: FastifyRequest<TimeLogIdParams & { Body: z.infer<typeof RejectTimeLogSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { timeLogId } = request.params;
        const body = RejectTimeLogSchema.parse(request.body);

        const result = await timeLogService.rejectTimeLog({
          timeLogId,
          clientUserId: user.id,
          reason: body.reason,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error rejecting time log');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // BULK APPROVE TIME LOGS
  // ===========================================================================

  /**
   * POST /time-logs/bulk-approve
   * Approve multiple time logs (client only)
   */
  fastify.post<{ Body: z.infer<typeof BulkApproveSchema> }>(
    '/bulk-approve',
    {
      schema: {
        description: 'Approve multiple time logs',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(BulkApproveSchema),
        response: {
          200: {
            description: 'Bulk approval results',
            type: 'object',
            properties: {
              results: { type: 'array' },
            },
          },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof BulkApproveSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const body = BulkApproveSchema.parse(request.body);

        const results = await timeLogService.bulkApproveTimeLogs(body.timeLogIds, user.id);

        return await reply.send({ results });
      } catch (error) {
        request.log.error(error, 'Error bulk approving time logs');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // BILL APPROVED TIME
  // ===========================================================================

  /**
   * POST /time-logs/contract/:contractId/bill
   * Bill approved time for a contract (client)
   */
  fastify.post<ContractIdParams>(
    '/contract/:contractId/bill',
    {
      schema: {
        description: 'Bill approved time logs',
        tags: ['Time Logs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['contractId'],
          properties: {
            contractId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Billing preview',
            type: 'object',
          },
          400: { description: 'No approved time logs' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only client can bill' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (request: FastifyRequest<ContractIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { contractId } = request.params;

        const billing = await timeLogService.billApprovedTime(contractId, user.id);

        return await reply.send(billing);
      } catch (error) {
        request.log.error(error, 'Error billing time logs');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );
};

export default timeLogRoutes;
