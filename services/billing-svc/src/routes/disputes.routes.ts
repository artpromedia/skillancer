// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
/**
 * @module @skillancer/billing-svc/routes/disputes
 * Dispute management routes for marketplace contracts
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getErrorResponse } from '../errors/index.js';
import { getDisputeService } from '../services/dispute.service.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface UserPayload {
  id: string;
  email: string;
  sessionId: string;
  tenantId?: string;
  roles?: string[];
}

// Helper to get user from request (throws if not authenticated)
function requireUser(request: FastifyRequest): UserPayload {
  const user = request.user as UserPayload | undefined;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

// Helper to check if user has admin role
function isAdmin(user: UserPayload): boolean {
  return user.roles?.includes('ADMIN') ?? false;
}

// =============================================================================
// SCHEMAS
// =============================================================================

// Dispute reason enum
const DisputeReasonEnum = z.enum([
  'QUALITY_ISSUES',
  'MISSED_DEADLINE',
  'SCOPE_DISAGREEMENT',
  'COMMUNICATION_ISSUES',
  'NON_DELIVERY',
  'PAYMENT_ISSUE',
  'WORK_NOT_AS_DESCRIBED',
  'OTHER',
]);

// Dispute resolution enum
const DisputeResolutionEnum = z.enum([
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'FULL_RELEASE',
  'PARTIAL_RELEASE',
  'SPLIT',
  'CANCELLED',
]);

// Create dispute request
const CreateDisputeSchema = z.object({
  contractId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  reason: DisputeReasonEnum,
  description: z.string().min(20),
  evidenceUrls: z.array(z.string().url()).optional(),
  disputedAmount: z.number().positive(),
});

// Respond to dispute request
const RespondToDisputeSchema = z.object({
  message: z.string().min(10),
  attachmentUrls: z.array(z.string().url()).optional(),
  proposedResolution: z
    .object({
      type: DisputeResolutionEnum,
      clientAmount: z.number().min(0).optional(),
      freelancerAmount: z.number().min(0).optional(),
    })
    .optional(),
});

// Escalate dispute request
const EscalateDisputeSchema = z.object({
  reason: z.string().min(10),
});

// Resolve dispute request (admin only)
const ResolveDisputeSchema = z.object({
  resolution: DisputeResolutionEnum,
  clientRefundAmount: z.number().min(0).optional(),
  freelancerPayoutAmount: z.number().min(0).optional(),
  resolutionNotes: z.string().min(10),
});

// =============================================================================
// ROUTE PARAMS
// =============================================================================

interface DisputeIdParams {
  Params: {
    disputeId: string;
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

export const disputeRoutes: FastifyPluginAsync = async (fastify) => {
  const disputeService = getDisputeService();

  // ===========================================================================
  // CREATE DISPUTE
  // ===========================================================================

  /**
   * POST /disputes
   * Create a new dispute for a contract or milestone
   */
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new dispute',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(CreateDisputeSchema),
        response: {
          201: {
            description: 'Dispute created',
            type: 'object',
          },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
          403: { description: 'Not a party to this contract' },
          404: { description: 'Contract not found' },
          409: { description: 'Active dispute already exists' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateDisputeSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const body = CreateDisputeSchema.parse(request.body);

        const result = await disputeService.raiseDispute({
          contractId: body.contractId,
          milestoneId: body.milestoneId,
          raisedBy: user.id,
          reason: body.reason,
          description: body.description,
          evidenceUrls: body.evidenceUrls,
          disputedAmount: body.disputedAmount,
        });

        return await reply.status(201).send(result);
      } catch (error) {
        request.log.error(error, 'Error creating dispute');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET DISPUTE
  // ===========================================================================

  /**
   * GET /disputes/:disputeId
   * Get dispute details
   */
  fastify.get<DisputeIdParams>(
    '/:disputeId',
    {
      schema: {
        description: 'Get dispute details',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['disputeId'],
          properties: {
            disputeId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Dispute details',
            type: 'object',
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Not authorized' },
          404: { description: 'Dispute not found' },
        },
      },
    },
    async (request: FastifyRequest<DisputeIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { disputeId } = request.params;

        const dispute = await disputeService.getDisputeById(disputeId, user.id);

        return await reply.send(dispute);
      } catch (error) {
        request.log.error(error, 'Error getting dispute');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET CONTRACT DISPUTES
  // ===========================================================================

  /**
   * GET /disputes/contract/:contractId
   * Get all disputes for a contract
   */
  fastify.get<ContractIdParams>(
    '/contract/:contractId',
    {
      schema: {
        description: 'Get all disputes for a contract',
        tags: ['Disputes'],
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
            description: 'Contract disputes',
            type: 'object',
            properties: {
              disputes: { type: 'array' },
            },
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

        const disputes = await disputeService.getContractDisputes(contractId, user.id);

        return await reply.send({ disputes });
      } catch (error) {
        request.log.error(error, 'Error getting contract disputes');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // MY DISPUTES
  // ===========================================================================

  /**
   * GET /disputes/my
   * Get current user's disputes
   */
  fastify.get<{ Querystring: { status?: string } }>(
    '/my',
    {
      schema: {
        description: "Get current user's disputes",
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'User disputes',
            type: 'object',
            properties: {
              disputes: { type: 'array' },
            },
          },
          401: { description: 'Unauthorized' },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { status } = request.query;

        const disputes = await disputeService.getUserDisputes(user.id, status);

        return await reply.send({ disputes });
      } catch (error) {
        request.log.error(error, 'Error getting user disputes');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // RESPOND TO DISPUTE
  // ===========================================================================

  /**
   * POST /disputes/:disputeId/respond
   * Respond to a dispute
   */
  fastify.post<DisputeIdParams & { Body: z.infer<typeof RespondToDisputeSchema> }>(
    '/:disputeId/respond',
    {
      schema: {
        description: 'Respond to a dispute',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['disputeId'],
          properties: {
            disputeId: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(RespondToDisputeSchema),
        response: {
          200: {
            description: 'Response added',
            type: 'object',
          },
          400: { description: 'Invalid request or dispute closed' },
          401: { description: 'Unauthorized' },
          403: { description: 'Not authorized' },
          404: { description: 'Dispute not found' },
        },
      },
    },
    async (
      request: FastifyRequest<DisputeIdParams & { Body: z.infer<typeof RespondToDisputeSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { disputeId } = request.params;
        const body = RespondToDisputeSchema.parse(request.body);

        const result = await disputeService.respondToDispute({
          disputeId,
          responderId: user.id,
          message: body.message,
          attachmentUrls: body.attachmentUrls,
          proposedResolution: body.proposedResolution,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error responding to dispute');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // ESCALATE DISPUTE
  // ===========================================================================

  /**
   * POST /disputes/:disputeId/escalate
   * Escalate a dispute to mediation
   */
  fastify.post<DisputeIdParams & { Body: z.infer<typeof EscalateDisputeSchema> }>(
    '/:disputeId/escalate',
    {
      schema: {
        description: 'Escalate a dispute to mediation',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['disputeId'],
          properties: {
            disputeId: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(EscalateDisputeSchema),
        response: {
          200: {
            description: 'Dispute escalated',
            type: 'object',
          },
          400: { description: 'Cannot escalate yet (48h minimum)' },
          401: { description: 'Unauthorized' },
          403: { description: 'Not authorized' },
          404: { description: 'Dispute not found' },
        },
      },
    },
    async (
      request: FastifyRequest<DisputeIdParams & { Body: z.infer<typeof EscalateDisputeSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { disputeId } = request.params;
        const body = EscalateDisputeSchema.parse(request.body);

        const result = await disputeService.escalateDispute({
          disputeId,
          userId: user.id,
          reason: body.reason,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error escalating dispute');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // RESOLVE DISPUTE (ADMIN ONLY)
  // ===========================================================================

  /**
   * POST /disputes/:disputeId/resolve
   * Resolve a dispute (admin only)
   */
  fastify.post<DisputeIdParams & { Body: z.infer<typeof ResolveDisputeSchema> }>(
    '/:disputeId/resolve',
    {
      schema: {
        description: 'Resolve a dispute (admin only)',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['disputeId'],
          properties: {
            disputeId: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(ResolveDisputeSchema),
        response: {
          200: {
            description: 'Dispute resolved',
            type: 'object',
          },
          400: { description: 'Invalid resolution' },
          401: { description: 'Unauthorized' },
          403: { description: 'Admin only' },
          404: { description: 'Dispute not found' },
        },
      },
    },
    async (
      request: FastifyRequest<DisputeIdParams & { Body: z.infer<typeof ResolveDisputeSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { disputeId } = request.params;
        const body = ResolveDisputeSchema.parse(request.body);

        // Check admin role
        if (!isAdmin(user)) {
          return await reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'Only admins can resolve disputes',
          });
        }

        const result = await disputeService.resolveDispute({
          disputeId,
          resolution: body.resolution,
          clientRefundAmount: body.clientRefundAmount,
          freelancerPayoutAmount: body.freelancerPayoutAmount,
          resolvedBy: user.id,
          resolutionNotes: body.resolutionNotes,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error resolving dispute');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );
};

export default disputeRoutes;
