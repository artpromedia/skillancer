/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Escrow Routes
 *
 * API endpoints for escrow management on ContractV2
 */

import { z } from 'zod';

import { EscrowService, EscrowError } from '../services/escrow.service.js';

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// Validation Schemas
// ============================================================================

const ContractIdParam = z.object({
  contractId: z.string().uuid(),
});

const FundEscrowSchema = z.object({
  amount: z.number().positive(),
  milestoneId: z.string().uuid().optional(),
  paymentMethodId: z.string().min(1),
  idempotencyKey: z.string().uuid().optional(),
});

const ReleaseEscrowSchema = z.object({
  milestoneId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

const RefundEscrowSchema = z.object({
  milestoneId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  reason: z.string().min(10).max(500),
});

const FreezeEscrowSchema = z.object({
  disputeId: z.string().uuid(),
  amount: z.number().positive().optional(),
});

const UnfreezeEscrowSchema = z.object({
  disputeId: z.string().uuid(),
  amount: z.number().positive().optional(),
});

const ResolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  resolution: z.enum([
    'FULL_REFUND_TO_CLIENT',
    'PARTIAL_REFUND',
    'FULL_PAYMENT_TO_FREELANCER',
    'SPLIT_PAYMENT',
    'MUTUAL_CANCELLATION',
    'NO_ACTION',
  ]),
  clientRefundAmount: z.number().min(0).optional(),
  freelancerPayoutAmount: z.number().min(0).optional(),
  resolutionNotes: z.string().max(2000).optional(),
});

const GetFeesPreviewSchema = z.object({
  amount: z.string().transform(Number),
});

const TransactionListQuerySchema = z.object({
  limit: z.string().transform(Number).default('20'),
  offset: z.string().transform(Number).default('0'),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface EscrowRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerEscrowRoutes(fastify: FastifyInstance, deps: EscrowRouteDeps): void {
  const { prisma, logger } = deps;

  // Initialize service
  const escrowService = new EscrowService(prisma);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof EscrowError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  };

  // ==========================================================================
  // ESCROW ACCOUNT
  // ==========================================================================

  // GET /escrow/:contractId - Get escrow summary for a contract
  fastify.get<{ Params: { contractId: string } }>('/:contractId', async (request, reply) => {
    try {
      const { contractId } = ContractIdParam.parse(request.params);
      getUser(request); // Verify authenticated

      const summary = await escrowService.getEscrowSummary(contractId);

      if (!summary) {
        return await reply.status(404).send({
          success: false,
          error: {
            code: 'ESCROW_NOT_FOUND',
            message: 'Escrow account not found for this contract',
          },
        });
      }

      return await reply.send({
        success: true,
        data: summary,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /escrow/:contractId/fees - Get fee preview for funding
  fastify.get<{ Params: { contractId: string }; Querystring: { amount: string } }>(
    '/:contractId/fees',
    async (request, reply) => {
      try {
        const { contractId } = ContractIdParam.parse(request.params);
        const { amount } = GetFeesPreviewSchema.parse(request.query);
        getUser(request);

        const preview = await escrowService.getFeesPreview(contractId, amount);

        return await reply.send({
          success: true,
          data: preview,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // GET /escrow/:contractId/transactions - Get transaction history
  fastify.get<{
    Params: { contractId: string };
    Querystring: { limit?: string; offset?: string };
  }>('/:contractId/transactions', async (request, reply) => {
    try {
      const { contractId } = ContractIdParam.parse(request.params);
      const { limit, offset } = TransactionListQuerySchema.parse(request.query);
      getUser(request);

      const transactions = await escrowService.getTransactions(contractId, { limit, offset });

      return await reply.send({
        success: true,
        data: transactions,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /escrow/:contractId/stats - Get escrow statistics
  fastify.get<{ Params: { contractId: string } }>('/:contractId/stats', async (request, reply) => {
    try {
      const { contractId } = ContractIdParam.parse(request.params);
      getUser(request);

      const stats = await escrowService.getEscrowStats(contractId);

      return await reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // FUND ESCROW
  // ==========================================================================

  // POST /escrow/:contractId/fund - Fund escrow
  fastify.post<{ Params: { contractId: string } }>('/:contractId/fund', async (request, reply) => {
    try {
      const { contractId } = ContractIdParam.parse(request.params);
      const user = getUser(request);
      const body = FundEscrowSchema.parse(request.body);

      const result = await escrowService.fundEscrow({
        contractId,
        clientUserId: user.id,
        amount: body.amount,
        milestoneId: body.milestoneId,
        paymentMethodId: body.paymentMethodId,
        idempotencyKey: body.idempotencyKey,
      });

      logger.info({
        msg: 'Escrow funded',
        contractId,
        transactionId: result.transaction.id,
        amount: body.amount,
        userId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // RELEASE ESCROW
  // ==========================================================================

  // POST /escrow/:contractId/release - Release escrow to freelancer
  fastify.post<{ Params: { contractId: string } }>(
    '/:contractId/release',
    async (request, reply) => {
      try {
        const { contractId } = ContractIdParam.parse(request.params);
        const user = getUser(request);
        const body = ReleaseEscrowSchema.parse(request.body);

        const result = await escrowService.releaseEscrow({
          contractId,
          clientUserId: user.id,
          milestoneId: body.milestoneId,
          amount: body.amount,
          notes: body.notes,
        });

        logger.info({
          msg: 'Escrow released',
          contractId,
          transactionId: result.transaction.id,
          amount: result.transaction.amount,
          userId: user.id,
        });

        return await reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // ==========================================================================
  // REFUND ESCROW
  // ==========================================================================

  // POST /escrow/:contractId/refund - Refund escrow to client
  fastify.post<{ Params: { contractId: string } }>(
    '/:contractId/refund',
    async (request, reply) => {
      try {
        const { contractId } = ContractIdParam.parse(request.params);
        const user = getUser(request);
        const body = RefundEscrowSchema.parse(request.body);

        const result = await escrowService.refundEscrow({
          contractId,
          initiatedBy: user.id,
          milestoneId: body.milestoneId,
          amount: body.amount,
          reason: body.reason,
        });

        logger.info({
          msg: 'Escrow refunded',
          contractId,
          transactionId: result.transaction.id,
          amount: result.transaction.amount,
          userId: user.id,
        });

        return await reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // ==========================================================================
  // DISPUTE HANDLING
  // ==========================================================================

  // POST /escrow/:contractId/freeze - Freeze escrow for dispute
  fastify.post<{ Params: { contractId: string } }>(
    '/:contractId/freeze',
    async (request, reply) => {
      try {
        const { contractId } = ContractIdParam.parse(request.params);
        getUser(request);
        const body = FreezeEscrowSchema.parse(request.body);

        const result = await escrowService.freezeEscrow({
          contractId,
          disputeId: body.disputeId,
          amount: body.amount,
        });

        logger.info({
          msg: 'Escrow frozen',
          contractId,
          disputeId: body.disputeId,
        });

        return await reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /escrow/:contractId/unfreeze - Unfreeze escrow
  fastify.post<{ Params: { contractId: string } }>(
    '/:contractId/unfreeze',
    async (request, reply) => {
      try {
        const { contractId } = ContractIdParam.parse(request.params);
        getUser(request);
        const body = UnfreezeEscrowSchema.parse(request.body);

        const result = await escrowService.unfreezeEscrow({
          contractId,
          disputeId: body.disputeId,
          amount: body.amount,
        });

        logger.info({
          msg: 'Escrow unfrozen',
          contractId,
          disputeId: body.disputeId,
        });

        return await reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /escrow/:contractId/resolve-dispute - Resolve dispute with fund distribution
  fastify.post<{ Params: { contractId: string } }>(
    '/:contractId/resolve-dispute',
    async (request, reply) => {
      try {
        const { contractId } = ContractIdParam.parse(request.params);
        const user = getUser(request);
        const body = ResolveDisputeSchema.parse(request.body);

        const result = await escrowService.resolveDispute({
          disputeId: body.disputeId,
          resolution: body.resolution,
          clientRefundAmount: body.clientRefundAmount,
          freelancerPayoutAmount: body.freelancerPayoutAmount,
          resolvedBy: user.id,
          resolutionNotes: body.resolutionNotes,
        });

        logger.info({
          msg: 'Dispute resolved',
          contractId,
          disputeId: body.disputeId,
          resolution: body.resolution,
          resolvedBy: user.id,
        });

        return await reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}
