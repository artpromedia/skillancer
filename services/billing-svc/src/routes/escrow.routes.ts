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
import { getEscrowManager } from '../services/escrow-manager.js';
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

// Freeze escrow request
const FreezeEscrowSchema = z.object({
  disputeId: z.string().uuid(),
  reason: z.string().min(1).optional(),
});

// Admin resolve dispute request
const AdminResolveDisputeSchema = z.object({
  resolution: z.enum(['full_release', 'full_refund', 'split']),
  freelancerAmount: z.number().min(0).optional(),
  clientRefundAmount: z.number().min(0).optional(),
  reason: z.string().min(1),
});

// =============================================================================
// ROUTE PARAMS
// =============================================================================

interface ContractIdParams {
  Params: {
    contractId: string;
  };
}

interface EscrowIdParams {
  Params: {
    id: string;
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
        const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;

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

  // ===========================================================================
  // GET ESCROW STATUS BY ID
  // ===========================================================================

  /**
   * GET /escrow/:id/status
   * Get escrow status using EscrowManager
   */
  fastify.get<EscrowIdParams>(
    '/:id/status',
    {
      schema: {
        description: 'Get escrow status by escrow ID',
        tags: ['Escrow'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            description: 'Escrow status',
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              totalAmount: { type: 'number' },
              fundedAmount: { type: 'number' },
              releasedAmount: { type: 'number' },
              availableBalance: { type: 'number' },
              platformFee: { type: 'number' },
              currency: { type: 'string' },
              milestones: { type: 'array' },
              releases: { type: 'array' },
              fundedAt: { type: 'string', nullable: true },
              lastReleaseAt: { type: 'string', nullable: true },
            },
          },
          401: { description: 'Unauthorized' },
          404: { description: 'Escrow not found' },
        },
      },
    },
    async (request: FastifyRequest<EscrowIdParams>, reply: FastifyReply) => {
      try {
        requireUser(request);
        const { id } = request.params;

        const escrowManager = getEscrowManager();
        const status = await escrowManager.getEscrowStatus(id);

        if (!status) {
          return reply.status(404).send({
            error: 'NotFound',
            code: 'ESCROW_NOT_FOUND',
            message: `Escrow ${id} not found`,
          });
        }

        return await reply.send(status);
      } catch (error) {
        request.log.error(error, 'Error getting escrow status');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // RELEASE ESCROW BY ID
  // ===========================================================================

  /**
   * POST /escrow/:id/release
   * Release escrow funds to freelancer (client approval)
   */
  fastify.post<EscrowIdParams>(
    '/:id/release',
    {
      schema: {
        description: 'Release escrow funds to freelancer by escrow ID',
        tags: ['Escrow'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            milestoneId: { type: 'string', format: 'uuid' },
            amount: { type: 'number', minimum: 0 },
            notes: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Escrow released successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              transferId: { type: 'string' },
              amountReleased: { type: 'number' },
              remainingBalance: { type: 'number' },
            },
          },
          400: { description: 'Invalid request or insufficient balance' },
          401: { description: 'Unauthorized' },
          404: { description: 'Escrow not found' },
          409: { description: 'Escrow is under dispute' },
        },
      },
    },
    async (
      request: FastifyRequest<
        EscrowIdParams & {
          Body: { milestoneId?: string; amount?: number; notes?: string };
        }
      >,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { id } = request.params;
        const body = request.body as { milestoneId?: string; amount?: number; notes?: string };

        const escrowManager = getEscrowManager();
        const result = await escrowManager.releaseFunds({
          escrowId: id,
          milestoneId: body.milestoneId,
          amount: body.amount,
          approvedBy: user.id,
          approvalType: 'CLIENT',
          notes: body.notes,
        });

        if (!result.success) {
          const statusCode = result.error?.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            error: 'ReleaseFailed',
            code: 'ESCROW_RELEASE_FAILED',
            message: result.error,
          });
        }

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error releasing escrow by ID');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // REFUND ESCROW BY ID
  // ===========================================================================

  /**
   * POST /escrow/:id/refund
   * Refund escrow funds to client
   */
  fastify.post<EscrowIdParams>(
    '/:id/refund',
    {
      schema: {
        description: 'Refund escrow funds to client by escrow ID',
        tags: ['Escrow'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 1 },
          },
        },
        response: {
          200: {
            description: 'Escrow refunded successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          400: { description: 'Invalid request or cannot refund' },
          401: { description: 'Unauthorized' },
          404: { description: 'Escrow not found' },
        },
      },
    },
    async (
      request: FastifyRequest<EscrowIdParams & { Body: { reason: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { id } = request.params;
        const { reason } = request.body as { reason: string };

        const escrowManager = getEscrowManager();
        const result = await escrowManager.refundToClient(id, reason, user.id);

        if (!result.success) {
          const statusCode = result.error?.includes('not found') ? 404 : 400;
          return reply.status(statusCode).send({
            error: 'RefundFailed',
            code: 'ESCROW_REFUND_FAILED',
            message: result.error,
          });
        }

        return await reply.send(result);
      } catch (error) {
        request.log.error(error, 'Error refunding escrow by ID');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // FREEZE ESCROW FOR DISPUTE
  // ===========================================================================

  /**
   * POST /escrow/:id/freeze
   * Freeze escrow funds for dispute investigation
   */
  fastify.post<EscrowIdParams>(
    '/:id/freeze',
    {
      schema: {
        description: 'Freeze escrow for dispute investigation',
        tags: ['Escrow'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(FreezeEscrowSchema),
        response: {
          200: {
            description: 'Escrow frozen successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
          404: { description: 'Escrow not found' },
          409: { description: 'Escrow already frozen or in invalid state' },
        },
      },
    },
    async (
      request: FastifyRequest<EscrowIdParams & { Body: z.infer<typeof FreezeEscrowSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        requireUser(request);
        const { id } = request.params;
        const body = FreezeEscrowSchema.parse(request.body);

        const escrowManager = getEscrowManager();
        await escrowManager.markDisputed(id, body.disputeId);

        return await reply.send({
          success: true,
          message: `Escrow ${id} frozen for dispute ${body.disputeId}`,
        });
      } catch (error) {
        request.log.error(error, 'Error freezing escrow');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // ADMIN RESOLVE DISPUTE
  // ===========================================================================

  /**
   * POST /admin/escrow/:id/resolve
   * Admin resolve a disputed escrow (full release, full refund, or split)
   */
  fastify.post<EscrowIdParams>(
    '/admin/:id/resolve',
    {
      schema: {
        description: 'Admin resolve disputed escrow',
        tags: ['Escrow', 'Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: zodToJsonSchema(AdminResolveDisputeSchema),
        response: {
          200: {
            description: 'Dispute resolved successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              resolution: { type: 'string' },
              freelancerAmount: { type: 'number' },
              clientRefundAmount: { type: 'number' },
              message: { type: 'string' },
            },
          },
          400: { description: 'Invalid request or escrow not in disputed state' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden - admin only' },
          404: { description: 'Escrow not found' },
        },
      },
    },
    async (
      request: FastifyRequest<EscrowIdParams & { Body: z.infer<typeof AdminResolveDisputeSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = requireUser(request);
        const { id } = request.params;
        const body = AdminResolveDisputeSchema.parse(request.body);

        const escrowManager = getEscrowManager();

        // Get current escrow status to verify it's disputed
        const escrowStatus = await escrowManager.getEscrowStatus(id);
        if (!escrowStatus) {
          return reply.status(404).send({
            error: 'NotFound',
            code: 'ESCROW_NOT_FOUND',
            message: `Escrow ${id} not found`,
          });
        }

        if (escrowStatus.status !== 'DISPUTED') {
          return reply.status(400).send({
            error: 'InvalidState',
            code: 'ESCROW_NOT_DISPUTED',
            message: `Escrow is in ${escrowStatus.status} state, not DISPUTED`,
          });
        }

        let freelancerAmount = 0;
        let clientRefundAmount = 0;

        switch (body.resolution) {
          case 'full_release': {
            // Release all remaining funds to freelancer
            const releaseResult = await escrowManager.releaseFunds({
              escrowId: id,
              amount: escrowStatus.availableBalance,
              approvedBy: user.id,
              approvalType: 'ADMIN',
              notes: `Admin dispute resolution: ${body.reason}`,
            });
            freelancerAmount = releaseResult.amountReleased;
            break;
          }

          case 'full_refund': {
            // Refund all remaining funds to client
            const refundResult = await escrowManager.refundToClient(
              id,
              `Admin dispute resolution: ${body.reason}`,
              user.id
            );
            if (!refundResult.success) {
              return reply.status(400).send({
                error: 'RefundFailed',
                code: 'DISPUTE_REFUND_FAILED',
                message: refundResult.error,
              });
            }
            clientRefundAmount = escrowStatus.availableBalance;
            break;
          }

          case 'split': {
            // Split between freelancer and client
            if (body.freelancerAmount === undefined || body.clientRefundAmount === undefined) {
              return reply.status(400).send({
                error: 'InvalidRequest',
                code: 'SPLIT_AMOUNTS_REQUIRED',
                message:
                  'freelancerAmount and clientRefundAmount are required for split resolution',
              });
            }

            const totalSplit = body.freelancerAmount + body.clientRefundAmount;
            if (totalSplit > escrowStatus.availableBalance) {
              return reply.status(400).send({
                error: 'InvalidRequest',
                code: 'SPLIT_EXCEEDS_BALANCE',
                message: `Split total (${totalSplit}) exceeds available balance (${escrowStatus.availableBalance})`,
              });
            }

            // Release to freelancer
            if (body.freelancerAmount > 0) {
              const releaseResult = await escrowManager.releaseFunds({
                escrowId: id,
                amount: body.freelancerAmount,
                approvedBy: user.id,
                approvalType: 'ADMIN',
                notes: `Admin dispute split resolution: ${body.reason}`,
              });
              freelancerAmount = releaseResult.amountReleased;
            }

            // Refund to client
            if (body.clientRefundAmount > 0) {
              await escrowManager.refundToClient(
                id,
                `Admin dispute split resolution: ${body.reason}`,
                user.id
              );
              clientRefundAmount = body.clientRefundAmount;
            }
            break;
          }
        }

        return await reply.send({
          success: true,
          resolution: body.resolution,
          freelancerAmount,
          clientRefundAmount,
          message: `Dispute resolved via ${body.resolution}`,
        });
      } catch (error) {
        request.log.error(error, 'Error resolving dispute');
        const { statusCode, body } = getErrorResponse(error);
        return reply.status(statusCode).send(body);
      }
    }
  );
};

export default escrowRoutes;
