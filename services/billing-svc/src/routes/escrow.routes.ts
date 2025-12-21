// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
/**
 * @module @skillancer/billing-svc/routes/escrow
 * Escrow management routes for marketplace contracts
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getErrorResponse } from '../errors/index.js';
import { getEscrowService } from '../services/escrow.service.js';
import { getFeeCalculatorService } from '../services/fee-calculator.service.js';

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

// Fund escrow request
const FundEscrowSchema = z.object({
  contractId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  amount: z.number().positive(),
  paymentMethodId: z.string().min(1),
});

// Release escrow request
const ReleaseEscrowSchema = z.object({
  contractId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
});

// Refund escrow request
const RefundEscrowSchema = z.object({
  contractId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  reason: z.string().min(1),
});

// Preview fees request
const PreviewFeesSchema = z.object({
  amount: z.number().positive(),
  contractId: z.string().uuid().optional(),
  platformFeePercent: z.number().min(0).max(100).optional(),
  secureMode: z.boolean().optional(),
  secureModeFeePercent: z.number().min(0).max(100).optional(),
});

// =============================================================================
// ROUTE PARAMS
// =============================================================================

interface ContractIdParams {
  Params: {
    contractId: string;
  };
}

// =============================================================================
// ROUTES
// =============================================================================

export const escrowRoutes: FastifyPluginAsync = async (fastify) => {
  const escrowService = getEscrowService();
  const feeCalculator = getFeeCalculatorService();

  // ===========================================================================
  // FUND ESCROW
  // ===========================================================================

  /**
   * POST /escrow/fund
   * Fund escrow for a contract or milestone
   */
  fastify.post(
    '/fund',
    {
      schema: {
        description: 'Fund escrow for a contract or milestone',
        tags: ['Escrow'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(FundEscrowSchema),
        response: {
          200: {
            description: 'Escrow funded successfully',
            type: 'object',
            properties: {
              transaction: { type: 'object' },
              escrowBalance: { type: 'object' },
              clientSecret: { type: 'string' },
            },
          },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof FundEscrowSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const body = FundEscrowSchema.parse(request.body);

        const result = await escrowService.fundEscrow({
          contractId: body.contractId,
          milestoneId: body.milestoneId,
          amount: body.amount,
          paymentMethodId: body.paymentMethodId,
          clientUserId: user.id,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error funding escrow');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // RELEASE ESCROW
  // ===========================================================================

  /**
   * POST /escrow/release
   * Release escrow funds to freelancer
   */
  fastify.post(
    '/release',
    {
      schema: {
        description: 'Release escrow funds to freelancer',
        tags: ['Escrow'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(ReleaseEscrowSchema),
        response: {
          200: {
            description: 'Escrow released successfully',
            type: 'object',
            properties: {
              transaction: { type: 'object' },
              escrowBalance: { type: 'object' },
            },
          },
          400: { description: 'Invalid request or insufficient balance' },
          401: { description: 'Unauthorized' },
          404: { description: 'Contract not found' },
          409: { description: 'Escrow is frozen due to dispute' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof ReleaseEscrowSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const body = ReleaseEscrowSchema.parse(request.body);

        const result = await escrowService.releaseEscrow({
          contractId: body.contractId,
          milestoneId: body.milestoneId,
          amount: body.amount,
          clientUserId: user.id,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error releasing escrow');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // REFUND ESCROW
  // ===========================================================================

  /**
   * POST /escrow/refund
   * Refund escrow funds to client
   */
  fastify.post(
    '/refund',
    {
      schema: {
        description: 'Refund escrow funds to client',
        tags: ['Escrow'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(RefundEscrowSchema),
        response: {
          200: {
            description: 'Escrow refunded successfully',
            type: 'object',
            properties: {
              transaction: { type: 'object' },
              escrowBalance: { type: 'object' },
            },
          },
          400: { description: 'Invalid request or insufficient balance' },
          401: { description: 'Unauthorized' },
          404: { description: 'Contract not found' },
          409: { description: 'Escrow is frozen due to dispute' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof RefundEscrowSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const body = RefundEscrowSchema.parse(request.body);

        const result = await escrowService.refundEscrow({
          contractId: body.contractId,
          milestoneId: body.milestoneId,
          amount: body.amount,
          reason: body.reason,
          initiatedBy: user.id,
        });

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error refunding escrow');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET ESCROW SUMMARY
  // ===========================================================================

  /**
   * GET /escrow/:contractId
   * Get escrow summary for a contract
   */
  fastify.get<ContractIdParams>(
    '/:contractId',
    {
      schema: {
        description: 'Get escrow summary for a contract',
        tags: ['Escrow'],
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
            description: 'Escrow summary',
            type: 'object',
            properties: {
              contract: { type: 'object' },
              balance: { type: 'object' },
              milestones: { type: 'array' },
              recentTransactions: { type: 'array' },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden - not a party to this contract' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (request: FastifyRequest<ContractIdParams>, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const { contractId } = request.params;

        const summary = await escrowService.getEscrowSummary(contractId, user.id);

        return await reply.send(summary);
      } catch (error) {
        request.log.error(error, 'Error getting escrow summary');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // PREVIEW FEES
  // ===========================================================================

  /**
   * POST /escrow/preview-fees
   * Preview escrow fees for an amount
   */
  fastify.post(
    '/preview-fees',
    {
      schema: {
        description: 'Preview escrow fees for an amount',
        tags: ['Escrow'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(PreviewFeesSchema),
        response: {
          200: {
            description: 'Fee preview',
            type: 'object',
            properties: {
              grossAmount: { type: 'number' },
              platformFee: { type: 'number' },
              platformFeePercent: { type: 'number' },
              secureModeAmount: { type: 'number' },
              processingFee: { type: 'number' },
              netAmount: { type: 'number' },
              totalCharge: { type: 'number' },
              breakdown: { type: 'array' },
            },
          },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof PreviewFeesSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        requireUser(request);
        const body = PreviewFeesSchema.parse(request.body);

        // If contractId provided, get contract settings
        let platformFeePercent = body.platformFeePercent;
        let secureMode = body.secureMode;
        const secureModeFeePercent = body.secureModeFeePercent;

        if (body.contractId) {
          const summary = await escrowService.getEscrowSummary(body.contractId, '');
          // Use contract settings if available
          if (summary) {
            platformFeePercent = platformFeePercent ?? 10; // Default from contract
            secureMode = secureMode ?? false;
          }
        }

        const preview = feeCalculator.getFeesPreview({
          amount: body.amount,
          platformFeePercent,
          secureMode,
          secureModeFeePercent,
        });

        return await reply.send(preview);
      } catch (error) {
        request.log.error(error, 'Error previewing fees');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // GET TRANSACTIONS
  // ===========================================================================

  /**
   * GET /escrow/:contractId/transactions
   * Get escrow transactions for a contract
   */
  fastify.get<ContractIdParams & { Querystring: { limit?: string } }>(
    '/:contractId/transactions',
    {
      schema: {
        description: 'Get escrow transactions for a contract',
        tags: ['Escrow'],
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
            limit: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Escrow transactions',
            type: 'object',
            properties: {
              transactions: { type: 'array' },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Contract not found' },
        },
      },
    },
    async (
      request: FastifyRequest<ContractIdParams & { Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { contractId } = request.params;
        const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;

        // Verify access through summary
        await escrowService.getEscrowSummary(contractId, user.id);

        const transactions = await escrowService.getTransactions(contractId, limit);

        return await reply.send({ transactions });
      } catch (error) {
        request.log.error(error, 'Error getting transactions');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );
};

export default escrowRoutes;
