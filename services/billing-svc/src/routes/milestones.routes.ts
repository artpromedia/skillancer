// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
/**
 * @module @skillancer/billing-svc/routes/milestones
 * Milestone management routes for marketplace contracts
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getErrorResponse } from '../errors/index.js';
import { getMilestoneService } from '../services/milestone.service.js';

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

// Submit milestone request
const SubmitMilestoneSchema = z.object({
  deliverables: z.string().min(1),
  deliverableUrls: z.array(z.string().url()).optional(),
});

// Request revision request
const RequestRevisionSchema = z.object({
  feedback: z.string().min(10),
});

// Fund milestone request
const FundMilestoneSchema = z.object({
  paymentMethodId: z.string().min(1),
});

// =============================================================================
// ROUTE PARAMS
// =============================================================================

interface MilestoneIdParams {
  Params: {
    milestoneId: string;
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

export const milestoneRoutes: FastifyPluginAsync = async (fastify) => {
  const milestoneService = getMilestoneService();

  // ===========================================================================
  // GET MILESTONE
  // ===========================================================================

  /**
   * GET /milestones/:milestoneId
   * Get milestone details
   */
  fastify.get<MilestoneIdParams>(
    '/:milestoneId',
    {
      schema: {
        description: 'Get milestone details',
        tags: ['Milestones'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['milestoneId'],
          properties: {
            milestoneId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Milestone details',
            type: 'object',
          },
          401: { description: 'Unauthorized' },
          404: { description: 'Milestone not found' },
        },
      },
    },
    async (request: FastifyRequest<MilestoneIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { milestoneId } = request.params;

        const milestone = await milestoneService.getMilestoneStatus(milestoneId, user.id);

        return await reply.send(milestone);
      } catch (error) {
        request.log.error(error, 'Error getting milestone');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET CONTRACT MILESTONES
  // ===========================================================================

  /**
   * GET /milestones/contract/:contractId
   * Get all milestones for a contract
   */
  fastify.get<ContractIdParams>(
    '/contract/:contractId',
    {
      schema: {
        description: 'Get all milestones for a contract',
        tags: ['Milestones'],
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
            description: 'Contract milestones',
            type: 'object',
            properties: {
              milestones: { type: 'array' },
            },
          },
          401: { description: 'Unauthorized' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (request: FastifyRequest<ContractIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { contractId } = request.params;

        const milestones = await milestoneService.getContractMilestones(contractId, user.id);

        return await reply.send({ milestones });
      } catch (error) {
        request.log.error(error, 'Error getting contract milestones');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // FUND MILESTONE
  // ===========================================================================

  /**
   * POST /milestones/:milestoneId/fund
   * Fund escrow for a milestone (client only)
   */
  fastify.post<MilestoneIdParams & { Body: z.infer<typeof FundMilestoneSchema> }>(
    '/:milestoneId/fund',
    {
      schema: {
        description: 'Fund escrow for a milestone',
        tags: ['Milestones'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['milestoneId'],
          properties: {
            milestoneId: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(FundMilestoneSchema),
        response: {
          200: {
            description: 'Milestone funded',
            type: 'object',
          },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only client can fund' },
          404: { description: 'Milestone not found' },
        },
      },
    },
    async (
      request: FastifyRequest<MilestoneIdParams & { Body: z.infer<typeof FundMilestoneSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { milestoneId } = request.params;
        const body = FundMilestoneSchema.parse(request.body);

        const result = await milestoneService.fundMilestone(
          milestoneId,
          body.paymentMethodId,
          user.id
        );

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error funding milestone');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // SUBMIT MILESTONE
  // ===========================================================================

  /**
   * POST /milestones/:milestoneId/submit
   * Submit milestone work (freelancer only)
   */
  fastify.post<MilestoneIdParams & { Body: z.infer<typeof SubmitMilestoneSchema> }>(
    '/:milestoneId/submit',
    {
      schema: {
        description: 'Submit milestone work for review',
        tags: ['Milestones'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['milestoneId'],
          properties: {
            milestoneId: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(SubmitMilestoneSchema),
        response: {
          200: {
            description: 'Milestone submitted',
            type: 'object',
          },
          400: { description: 'Invalid request or milestone not ready' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only freelancer can submit' },
          404: { description: 'Milestone not found' },
        },
      },
    },
    async (
      request: FastifyRequest<MilestoneIdParams & { Body: z.infer<typeof SubmitMilestoneSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { milestoneId } = request.params;
        const body = SubmitMilestoneSchema.parse(request.body);

        const result = await milestoneService.submitMilestone({
          milestoneId,
          freelancerUserId: user.id,
          deliverables: body.deliverables,
          deliverableUrls: body.deliverableUrls,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error submitting milestone');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // APPROVE MILESTONE
  // ===========================================================================

  /**
   * POST /milestones/:milestoneId/approve
   * Approve milestone work (client only)
   */
  fastify.post<MilestoneIdParams>(
    '/:milestoneId/approve',
    {
      schema: {
        description: 'Approve milestone work',
        tags: ['Milestones'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['milestoneId'],
          properties: {
            milestoneId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Milestone approved',
            type: 'object',
          },
          400: { description: 'Milestone not submitted' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only client can approve' },
          404: { description: 'Milestone not found' },
        },
      },
    },
    async (request: FastifyRequest<MilestoneIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { milestoneId } = request.params;

        const result = await milestoneService.approveMilestone({
          milestoneId,
          clientUserId: user.id,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error approving milestone');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // REQUEST REVISION
  // ===========================================================================

  /**
   * POST /milestones/:milestoneId/request-revision
   * Request revision on submitted milestone (client only)
   */
  fastify.post<MilestoneIdParams & { Body: z.infer<typeof RequestRevisionSchema> }>(
    '/:milestoneId/request-revision',
    {
      schema: {
        description: 'Request revision on submitted milestone',
        tags: ['Milestones'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['milestoneId'],
          properties: {
            milestoneId: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(RequestRevisionSchema),
        response: {
          200: {
            description: 'Revision requested',
            type: 'object',
          },
          400: { description: 'Milestone not submitted or revision limit reached' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only client can request revision' },
          404: { description: 'Milestone not found' },
        },
      },
    },
    async (
      request: FastifyRequest<MilestoneIdParams & { Body: z.infer<typeof RequestRevisionSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { milestoneId } = request.params;
        const body = RequestRevisionSchema.parse(request.body);

        const result = await milestoneService.requestRevision({
          milestoneId,
          clientUserId: user.id,
          feedback: body.feedback,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error requesting revision');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // RELEASE MILESTONE
  // ===========================================================================

  /**
   * POST /milestones/:milestoneId/release
   * Release funds for approved milestone (client only)
   */
  fastify.post<MilestoneIdParams>(
    '/:milestoneId/release',
    {
      schema: {
        description: 'Release funds for approved milestone',
        tags: ['Milestones'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['milestoneId'],
          properties: {
            milestoneId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Funds released',
            type: 'object',
          },
          400: { description: 'Milestone not approved' },
          401: { description: 'Unauthorized' },
          403: { description: 'Only client can release' },
          404: { description: 'Milestone not found' },
        },
      },
    },
    async (request: FastifyRequest<MilestoneIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { milestoneId } = request.params;

        const result = await milestoneService.releaseMilestone(milestoneId, user.id);

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error releasing milestone funds');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );
};

export default milestoneRoutes;
