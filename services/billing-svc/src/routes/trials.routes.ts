/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
/**
 * @module @skillancer/billing-svc/routes/trials
 * Free trial management routes
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getErrorResponse } from '../errors/index.js';
import { getTrialService } from '../services/trial.service.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

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

// Start trial request
const StartTrialSchema = z.object({
  productType: z.enum(['SKILLPOD', 'COCKPIT']),
  plan: z.string().min(1),
  tenantId: z.string().uuid().optional(),
  referralCode: z.string().optional(),
});

// Extend trial request (admin only)
const ExtendTrialSchema = z.object({
  additionalDays: z.number().int().positive().max(30),
  reason: z.string().min(1).max(500),
});

// Convert trial request
const ConvertTrialSchema = z.object({
  plan: z.string().min(1),
  billingInterval: z.enum(['MONTHLY', 'ANNUAL']),
  paymentMethodId: z.string().min(1),
});

// Check eligibility request
const EligibilityCheckSchema = z.object({
  productType: z.enum(['SKILLPOD', 'COCKPIT']),
});

// =============================================================================
// ROUTE PLUGIN
// =============================================================================

const trialRoutes: FastifyPluginAsync = async (fastify) => {
  const trialService = getTrialService();

  // ===========================================================================
  // TRIAL ELIGIBILITY
  // ===========================================================================

  /**
   * POST /trials/eligibility
   * Check if user is eligible for a free trial
   */
  fastify.post(
    '/eligibility',
    {
      schema: {
        description: 'Check if user is eligible for a free trial',
        tags: ['trials'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(EligibilityCheckSchema),
        response: {
          200: {
            type: 'object',
            properties: {
              eligible: { type: 'boolean' },
              reason: { type: 'string' },
              trialDays: { type: 'number' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const body = EligibilityCheckSchema.parse(request.body);

        const eligibility = await trialService.checkTrialEligibility(user.id, body.productType);

        return await reply.send(eligibility);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // START TRIAL
  // ===========================================================================

  /**
   * POST /trials
   * Start a new free trial
   */
  fastify.post(
    '/',
    {
      schema: {
        description: 'Start a new free trial',
        tags: ['trials'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(StartTrialSchema),
        response: {
          201: { type: 'object' },
          400: { type: 'object' },
          409: { type: 'object' },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const body = StartTrialSchema.parse(request.body);

        const subscription = await trialService.startTrial(user.id, body.productType, body.plan, {
          tenantId: body.tenantId,
          referralCode: body.referralCode,
        });

        return await reply.code(201).send({
          subscription,
          message: 'Trial started successfully',
          trialEndsAt: subscription.trialEnd?.toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // TRIAL STATUS
  // ===========================================================================

  /**
   * GET /trials/:subscriptionId
   * Get trial status for a subscription
   */
  fastify.get<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId',
    {
      schema: {
        description: 'Get trial status for a subscription',
        tags: ['trials'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              isInTrial: { type: 'boolean' },
              trialStart: { type: 'string', format: 'date-time' },
              trialEnd: { type: 'string', format: 'date-time' },
              daysRemaining: { type: 'number' },
              status: { type: 'string' },
              wasExtended: { type: 'boolean' },
            },
          },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        requireUser(request);

        const status = await trialService.getTrialStatus(request.params.subscriptionId);

        if (!status) {
          return await reply.code(404).send({
            error: 'NotFound',
            code: 'TRIAL_NOT_FOUND',
            message: 'No trial found for this subscription',
          });
        }

        return await reply.send(status);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // EXTEND TRIAL (Admin only)
  // ===========================================================================

  /**
   * POST /trials/:subscriptionId/extend
   * Extend a trial period (admin only)
   */
  fastify.post<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId/extend',
    {
      schema: {
        description: 'Extend a trial period (admin only)',
        tags: ['trials'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        body: zodToJsonSchema(ExtendTrialSchema),
        response: {
          200: { type: 'object' },
          400: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        // TODO: Add admin role check
        requireUser(request);
        const body = ExtendTrialSchema.parse(request.body);

        const subscription = await trialService.extendTrial(
          request.params.subscriptionId,
          body.additionalDays,
          body.reason
        );

        return await reply.send({
          subscription,
          message: `Trial extended by ${body.additionalDays} days`,
          newTrialEnd: subscription.trialEnd?.toISOString(),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // CONVERT TRIAL
  // ===========================================================================

  /**
   * POST /trials/:subscriptionId/convert
   * Convert trial to paid subscription
   */
  fastify.post<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId/convert',
    {
      schema: {
        description: 'Convert trial to paid subscription',
        tags: ['trials'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        body: zodToJsonSchema(ConvertTrialSchema),
        response: {
          200: { type: 'object' },
          400: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = requireUser(request);
        const body = ConvertTrialSchema.parse(request.body);

        const subscription = await trialService.convertTrialToPaid(
          request.params.subscriptionId,
          user.id,
          body.plan,
          body.billingInterval,
          body.paymentMethodId
        );

        return await reply.send({
          subscription,
          message: 'Trial converted to paid subscription successfully',
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'ValidationError',
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // CANCEL TRIAL
  // ===========================================================================

  /**
   * DELETE /trials/:subscriptionId
   * Cancel a trial
   */
  fastify.delete<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId',
    {
      schema: {
        description: 'Cancel a trial',
        tags: ['trials'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        response: {
          200: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = requireUser(request);

        const subscription = await trialService.cancelTrial(request.params.subscriptionId, user.id);

        return await reply.send({
          subscription,
          message: 'Trial canceled successfully',
        });
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );
};

export default trialRoutes;

export { trialRoutes };

export async function registerTrialRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(trialRoutes, { prefix: '/trials' });
}
