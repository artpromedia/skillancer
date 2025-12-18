/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Payout Routes
 *
 * API endpoints for payout account and transfer management
 */

import { z } from 'zod';

import { PayoutService, PayoutError } from '../services/payout.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// Validation Schemas
// ============================================================================

const PayoutIdParam = z.object({
  id: z.string().uuid(),
});

const CreateConnectAccountSchema = z.object({
  accountType: z.enum(['express', 'standard']).default('express'),
  country: z.string().length(2).default('US'),
  refreshUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

const CreateTransferSchema = z.object({
  contractId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  amount: z.number().positive(),
  description: z.string().max(255).optional(),
  metadata: z.record(z.string()).optional(),
});

const CreatePayoutSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default('usd'),
  method: z.enum(['standard', 'instant']).default('standard'),
  description: z.string().max(255).optional(),
});

const PayoutListQuerySchema = z.object({
  limit: z.string().transform(Number).default('20'),
  offset: z.string().transform(Number).default('0'),
  status: z.enum(['PENDING', 'IN_TRANSIT', 'PAID', 'FAILED', 'CANCELLED']).optional(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface PayoutRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerPayoutRoutes(fastify: FastifyInstance, deps: PayoutRouteDeps): void {
  const { prisma, logger } = deps;

  // Initialize service
  const payoutService = new PayoutService(prisma);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: FastifyReply) => {
    if (error instanceof PayoutError) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
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
  // CONNECT ACCOUNT MANAGEMENT
  // ==========================================================================

  // GET /payouts/account - Get payout account for authenticated user
  fastify.get('/account', async (request, reply) => {
    try {
      const user = getUser(request);

      const account = await payoutService.getPayoutAccount(user.id);

      if (!account) {
        return await reply.status(404).send({
          success: false,
          error: {
            code: 'PAYOUT_ACCOUNT_NOT_FOUND',
            message: 'Payout account not found. Please create one first.',
          },
        });
      }

      return await reply.send({
        success: true,
        data: account,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /payouts/account - Create Connect account for authenticated user
  fastify.post('/account', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateConnectAccountSchema.parse(request.body);

      // Get user email from request
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true },
      });

      if (!userRecord) {
        return await reply.status(404).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      const result = await payoutService.createConnectAccount(user.id, userRecord.email, {
        accountType: body.accountType,
        country: body.country,
        ...(body.refreshUrl && { refreshUrl: body.refreshUrl }),
        ...(body.returnUrl && { returnUrl: body.returnUrl }),
      });

      logger.info({
        msg: 'Connect account created',
        userId: user.id,
        accountId: result.payoutAccount.stripeConnectAccountId,
        accountType: body.accountType,
      });

      return await reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /payouts/account/onboarding - Get new onboarding link
  fastify.get('/account/onboarding', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = z
        .object({
          refreshUrl: z.string().url().optional(),
          returnUrl: z.string().url().optional(),
        })
        .parse(request.query);

      const result = await payoutService.getOnboardingLink(user.id, {
        ...(query.refreshUrl && { refreshUrl: query.refreshUrl }),
        ...(query.returnUrl && { returnUrl: query.returnUrl }),
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /payouts/account/dashboard - Get Express dashboard link
  fastify.get('/account/dashboard', async (request, reply) => {
    try {
      const user = getUser(request);

      const result = await payoutService.getExpressDashboardLink(user.id);

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /payouts/account/sync - Sync account status from Stripe
  fastify.post('/account/sync', async (request, reply) => {
    try {
      const user = getUser(request);

      const account = await payoutService.syncAccountStatus(user.id);

      logger.info({
        msg: 'Payout account synced',
        userId: user.id,
        status: account.status,
        payoutsEnabled: account.payoutsEnabled,
      });

      return await reply.send({
        success: true,
        data: account,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // TRANSFERS (Platform to Connect Account)
  // ==========================================================================

  // POST /payouts/transfer - Transfer funds to freelancer's Connect account
  fastify.post('/transfer', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateTransferSchema.parse(request.body);

      // Verify user is admin or system
      if (user.role !== 'ADMIN' && user.role !== 'SYSTEM') {
        return await reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only admins can initiate transfers',
          },
        });
      }

      // For now, require either contractId or invoiceId to identify the freelancer
      if (!body.contractId && !body.invoiceId) {
        return await reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either contractId or invoiceId is required',
          },
        });
      }

      // Get freelancer from contract or invoice
      let freelancerUserId: string;
      if (body.contractId) {
        const contract = await prisma.contractV2.findUnique({
          where: { id: body.contractId },
          select: { freelancerUserId: true },
        });
        if (!contract) {
          return await reply.status(404).send({
            success: false,
            error: {
              code: 'CONTRACT_NOT_FOUND',
              message: 'Contract not found',
            },
          });
        }
        freelancerUserId = contract.freelancerUserId;
      } else if (body.invoiceId) {
        const invoice = await prisma.contractInvoice.findFirst({
          where: { id: body.invoiceId },
          select: { freelancerUserId: true },
        });
        if (!invoice || !invoice.freelancerUserId) {
          return await reply.status(404).send({
            success: false,
            error: {
              code: 'INVOICE_NOT_FOUND',
              message: 'Invoice not found or missing freelancer',
            },
          });
        }
        freelancerUserId = invoice.freelancerUserId;
      } else {
        return await reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either contractId or invoiceId is required',
          },
        });
      }

      const result = await payoutService.createTransfer(freelancerUserId, {
        amount: body.amount,
        ...(body.contractId && { contractId: body.contractId }),
        ...(body.invoiceId && { invoiceId: body.invoiceId }),
        ...(body.description && { description: body.description }),
        ...(body.metadata && { metadata: body.metadata }),
      });

      logger.info({
        msg: 'Transfer created',
        payoutId: result.id,
        freelancerUserId,
        amount: body.amount,
        initiatedBy: user.id,
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
  // PAYOUTS (Connect Account to Bank)
  // ==========================================================================

  // POST /payouts/instant - Create instant payout to bank account
  fastify.post('/instant', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreatePayoutSchema.parse(request.body);

      const result = await payoutService.createInstantPayout(user.id, body.amount, body.currency);

      logger.info({
        msg: 'Instant payout created',
        payoutId: result.stripePayoutId,
        userId: user.id,
        amount: body.amount,
        method: body.method,
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // ==========================================================================
  // PAYOUT HISTORY
  // ==========================================================================

  // GET /payouts - List payouts for authenticated user
  fastify.get<{
    Querystring: { limit?: string; offset?: string; status?: string };
  }>('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const { limit, offset, status } = PayoutListQuerySchema.parse(request.query);

      const payouts = await payoutService.listPayouts(user.id, {
        limit,
        offset,
        status: status as any,
      });

      return await reply.send({
        success: true,
        data: payouts,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /payouts/:id - Get payout by ID
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const { id } = PayoutIdParam.parse(request.params);
      getUser(request);

      const payout = await prisma.payout.findUnique({
        where: { id },
        include: {
          payoutAccount: {
            select: {
              id: true,
              status: true,
              stripeConnectAccountId: true,
            },
          },
        },
      });

      if (!payout) {
        return await reply.status(404).send({
          success: false,
          error: {
            code: 'PAYOUT_NOT_FOUND',
            message: 'Payout not found',
          },
        });
      }

      return await reply.send({
        success: true,
        data: payout,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /payouts/stats - Get payout statistics for authenticated user
  fastify.get('/stats', async (request, reply) => {
    try {
      const user = getUser(request);

      const stats = await payoutService.getPayoutStats(user.id);

      return await reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
