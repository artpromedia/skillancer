// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/routes/transactions
 * Payment transaction API routes
 */

import { z } from 'zod';

import {
  TransactionNotFoundError,
  TransactionAlreadyProcessedError,
  TransactionFailedError,
  PaymentMethodNotFoundError,
} from '../errors/index.js';
import { getTransactionService } from '../services/transaction.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const createPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).optional(),
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  description: z.string().max(500).optional(),
  referenceType: z.enum(['subscription', 'contract', 'escrow', 'service']).optional(),
  referenceId: z.string().uuid().optional(),
  captureMethod: z.enum(['automatic', 'manual']).optional(),
  metadata: z.record(z.string()).optional(),
});

const capturePaymentSchema = z.object({
  amount: z.number().positive().optional(),
});

const refundPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.enum(['requested_by_customer', 'duplicate', 'fraudulent']).optional(),
});

const getTransactionsQuerySchema = z.object({
  type: z
    .enum(['PAYMENT', 'REFUND', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'SUBSCRIPTION', 'PAYOUT'])
    .optional(),
  status: z
    .enum([
      'PENDING',
      'PROCESSING',
      'REQUIRES_ACTION',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
      'REFUNDED',
      'PARTIALLY_REFUNDED',
    ])
    .optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// =============================================================================
// TYPES
// =============================================================================

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    sessionId: string;
  };
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /transactions/payments
 * Create a new payment
 */
async function createPayment(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const body = createPaymentSchema.parse(request.body);
  const service = getTransactionService();

  try {
    const result = await service.createPayment(request.user.id, body);

    // If requires action (3D Secure), return client secret
    if (result.status === 'REQUIRES_ACTION') {
      return await reply.status(202).send({
        success: true,
        data: {
          transactionId: result.transactionId,
          status: result.status,
          requiresAction: true,
          clientSecret: result.clientSecret,
        },
      });
    }

    return await reply.status(201).send({
      success: true,
      data: {
        transactionId: result.transactionId,
        stripePaymentIntentId: result.stripePaymentIntentId,
        status: result.status,
        amount: result.amount,
        currency: result.currency,
      },
    });
  } catch (error) {
    if (error instanceof PaymentMethodNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'PaymentMethodNotFound',
        message: 'Payment method not found or not active.',
      });
    }
    if (error instanceof TransactionFailedError) {
      return reply.status(402).send({
        success: false,
        error: 'PaymentFailed',
        code: error.failureCode,
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * POST /transactions/:id/capture
 * Capture a held payment
 */
async function capturePayment(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = capturePaymentSchema.parse(request.body);
  const service = getTransactionService();

  try {
    const transaction = await service.capturePayment(request.user.id, id, body);

    return await reply.send({
      success: true,
      data: { transaction },
    });
  } catch (error) {
    if (error instanceof TransactionNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'TransactionNotFound',
        message: 'Transaction not found.',
      });
    }
    if (error instanceof TransactionAlreadyProcessedError) {
      return reply.status(409).send({
        success: false,
        error: 'TransactionAlreadyProcessed',
        message: 'This transaction has already been processed.',
      });
    }
    if (error instanceof TransactionFailedError) {
      return reply.status(402).send({
        success: false,
        error: 'CaptureFailed',
        code: error.failureCode,
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * POST /transactions/:id/cancel
 * Cancel a held payment
 */
async function cancelPayment(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const service = getTransactionService();

  try {
    const transaction = await service.cancelPayment(request.user.id, id);

    return await reply.send({
      success: true,
      data: { transaction },
    });
  } catch (error) {
    if (error instanceof TransactionNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'TransactionNotFound',
        message: 'Transaction not found.',
      });
    }
    if (error instanceof TransactionAlreadyProcessedError) {
      return reply.status(409).send({
        success: false,
        error: 'TransactionAlreadyProcessed',
        message: 'This transaction cannot be cancelled.',
      });
    }
    throw error;
  }
}

/**
 * POST /transactions/:id/refund
 * Refund a payment
 */
async function refundPayment(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = refundPaymentSchema.parse(request.body);
  const service = getTransactionService();

  try {
    const result = await service.refundPayment(request.user.id, id, body);

    return await reply.send({
      success: true,
      data: {
        refundId: result.refundId,
        transactionId: result.transactionId,
        status: result.status,
        refundedAmount: result.refundedAmount,
      },
    });
  } catch (error) {
    if (error instanceof TransactionNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'TransactionNotFound',
        message: 'Transaction not found.',
      });
    }
    if (error instanceof Error && error.message === 'Can only refund succeeded transactions') {
      return reply.status(400).send({
        success: false,
        error: 'InvalidTransactionState',
        message: 'Can only refund succeeded transactions.',
      });
    }
    throw error;
  }
}

/**
 * GET /transactions
 * List transactions
 */
async function getTransactions(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const query = getTransactionsQuerySchema.parse(request.query);
  const service = getTransactionService();

  const result = await service.getTransactions(request.user.id, {
    type: query.type,
    status: query.status,
    referenceType: query.referenceType,
    referenceId: query.referenceId,
    startDate: query.startDate,
    endDate: query.endDate,
    page: query.page,
    limit: query.limit,
  });

  return reply.send({
    success: true,
    data: result,
  });
}

/**
 * GET /transactions/:id
 * Get transaction details
 */
async function getTransaction(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const service = getTransactionService();

  try {
    const transaction = await service.getTransaction(request.user.id, id);

    return await reply.send({
      success: true,
      data: { transaction },
    });
  } catch (error) {
    if (error instanceof TransactionNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'TransactionNotFound',
        message: 'Transaction not found.',
      });
    }
    throw error;
  }
}

// =============================================================================
// PLUGIN REGISTRATION
// =============================================================================

export async function transactionRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();

  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post('/payments', {
    schema: {
      tags: ['Transactions'],
      summary: 'Create payment',
      description: 'Process a payment using a saved payment method',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['amount', 'paymentMethodId'],
        properties: {
          amount: { type: 'number', minimum: 0.01 },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          paymentMethodId: { type: 'string' },
          description: { type: 'string', maxLength: 500 },
          referenceType: {
            type: 'string',
            enum: ['subscription', 'contract', 'escrow', 'service'],
          },
          referenceId: { type: 'string', format: 'uuid' },
          captureMethod: { type: 'string', enum: ['automatic', 'manual'] },
          metadata: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
    },
    handler: createPayment as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.post('/:id/capture', {
    schema: {
      tags: ['Transactions'],
      summary: 'Capture payment',
      description: 'Capture a held payment (for manual capture/escrow)',
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
          amount: { type: 'number', minimum: 0.01 },
        },
      },
    },
    handler: capturePayment as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.post('/:id/cancel', {
    schema: {
      tags: ['Transactions'],
      summary: 'Cancel payment',
      description: 'Cancel a pending or held payment',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: cancelPayment as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.post('/:id/refund', {
    schema: {
      tags: ['Transactions'],
      summary: 'Refund payment',
      description: 'Refund a successful payment (full or partial)',
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
          amount: { type: 'number', minimum: 0.01 },
          reason: { type: 'string', enum: ['requested_by_customer', 'duplicate', 'fraudulent'] },
        },
      },
    },
    handler: refundPayment as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.get('/', {
    schema: {
      tags: ['Transactions'],
      summary: 'List transactions',
      description: 'Get a list of transactions for the current user',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['PAYMENT', 'REFUND', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'SUBSCRIPTION', 'PAYOUT'],
          },
          status: {
            type: 'string',
            enum: [
              'PENDING',
              'PROCESSING',
              'REQUIRES_ACTION',
              'SUCCEEDED',
              'FAILED',
              'CANCELLED',
              'REFUNDED',
              'PARTIALLY_REFUNDED',
            ],
          },
          referenceType: { type: 'string' },
          referenceId: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: getTransactions as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Transactions'],
      summary: 'Get transaction',
      description: 'Get details of a specific transaction',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: getTransaction as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });
}
