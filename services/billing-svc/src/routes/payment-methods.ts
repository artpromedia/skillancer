/**
 * @module @skillancer/billing-svc/routes/payment-methods
 * Payment method management API routes
 */

import { z } from 'zod';

import { PaymentMethodNotFoundError, PaymentMethodInUseError } from '../errors/index.js';
import {
  getPaymentMethodService,
  type PaymentMethodResponse,
  type PaymentMethodFilters,
} from '../services/payment-method.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

// Request schemas
const getPaymentMethodsSchema = z.object({
  type: z.enum(['CARD', 'ACH_DEBIT', 'SEPA_DEBIT', 'WIRE']).optional(),
  status: z
    .enum([
      'ACTIVE',
      'EXPIRING_SOON',
      'EXPIRED',
      'VERIFICATION_PENDING',
      'VERIFICATION_FAILED',
      'REMOVED',
    ])
    .optional(),
  includeRemoved: z.coerce.boolean().default(false),
});

const createSetupIntentSchema = z.object({
  paymentMethodType: z.enum(['card', 'us_bank_account', 'sepa_debit']),
  metadata: z.record(z.string()).optional(),
});

const attachPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  setAsDefault: z.boolean().default(false),
});

const _setDefaultPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

const _removePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

// Response schemas (for documentation)
const _paymentMethodResponseSchema = z.object({
  id: z.string(),
  type: z.enum(['CARD', 'ACH_DEBIT', 'SEPA_DEBIT', 'WIRE']),
  isDefault: z.boolean(),
  status: z.string(),
  card: z
    .object({
      brand: z.string().nullable(),
      last4: z.string().nullable(),
      expMonth: z.number().nullable(),
      expYear: z.number().nullable(),
      funding: z.string().nullable(),
    })
    .nullable(),
  bankAccount: z
    .object({
      bankName: z.string().nullable(),
      last4: z.string().nullable(),
      accountType: z.string().nullable(),
      country: z.string().nullable(),
    })
    .nullable(),
  billingDetails: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    country: z.string().nullable(),
    postalCode: z.string().nullable(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// =============================================================================
// TYPES
// =============================================================================

// Augment Fastify's request interface
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      sessionId: string;
    };
  }
}

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
 * GET /payment-methods
 * List all payment methods for the authenticated user
 */
async function getPaymentMethods(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const query = getPaymentMethodsSchema.parse(request.query);
  const service = getPaymentMethodService();

  const filters: PaymentMethodFilters = {};
  if (query.type) filters.type = query.type;
  // Cast to satisfy exactOptionalPropertyTypes
  if (query.status) {
    filters.status = query.status as PaymentMethodFilters['status'];
  }
  if (query.includeRemoved) filters.includeRemoved = query.includeRemoved;

  const paymentMethods = await service.getPaymentMethods(request.user.id, filters);

  return reply.send({
    success: true,
    data: {
      paymentMethods: paymentMethods.map(formatPaymentMethod),
      total: paymentMethods.length,
    },
  });
}

/**
 * GET /payment-methods/:id
 * Get a specific payment method
 */
async function getPaymentMethod(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const service = getPaymentMethodService();

  const paymentMethod = await service.getPaymentMethod(request.user.id, id);

  if (!paymentMethod) {
    throw new PaymentMethodNotFoundError(id);
  }

  return reply.send({
    success: true,
    data: formatPaymentMethod(paymentMethod),
  });
}

/**
 * POST /payment-methods/setup-intent
 * Create a Stripe SetupIntent for collecting payment details
 */
async function createSetupIntent(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const body = createSetupIntentSchema.parse(request.body);
  const service = getPaymentMethodService();

  const setupIntent = await service.createSetupIntent(request.user.id, body.paymentMethodType);

  return reply.status(201).send({
    success: true,
    data: {
      clientSecret: setupIntent.clientSecret,
      setupIntentId: setupIntent.setupIntentId,
      customerId: setupIntent.customerId,
    },
  });
}

/**
 * POST /payment-methods
 * Attach a payment method to the user (after SetupIntent completes)
 */
async function attachPaymentMethod(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const body = attachPaymentMethodSchema.parse(request.body);
  const service = getPaymentMethodService();

  const paymentMethod = await service.addPaymentMethod(
    request.user.id,
    body.paymentMethodId,
    body.setAsDefault
  );

  return reply.status(201).send({
    success: true,
    message: 'Payment method added successfully',
    data: formatPaymentMethod(paymentMethod),
  });
}

/**
 * PUT /payment-methods/:id/default
 * Set a payment method as the default
 */
async function setDefaultPaymentMethod(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const service = getPaymentMethodService();

  const paymentMethod = await service.setDefaultPaymentMethod(request.user.id, id);

  return reply.send({
    success: true,
    message: 'Default payment method updated',
    data: formatPaymentMethod(paymentMethod),
  });
}

/**
 * DELETE /payment-methods/:id
 * Remove a payment method
 */
async function removePaymentMethod(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params as { id: string };
  const service = getPaymentMethodService();

  // Check if payment method can be removed
  const canRemove = await service.canRemovePaymentMethod(request.user.id, id);

  if (!canRemove.allowed) {
    throw new PaymentMethodInUseError(id, canRemove.reason ?? 'Cannot remove this payment method');
  }

  await service.removePaymentMethod(request.user.id, id);

  return reply.send({
    success: true,
    message: 'Payment method removed successfully',
  });
}

/**
 * POST /payment-methods/sync
 * Sync payment methods from Stripe (admin/support endpoint)
 */
async function syncPaymentMethods(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const service = getPaymentMethodService();

  const result = await service.syncPaymentMethods(request.user.id);

  return reply.send({
    success: true,
    message: 'Payment methods synchronized',
    data: {
      synced: result.synced,
      added: result.added,
      updated: result.updated,
      removed: result.removed,
    },
  });
}

/**
 * GET /payment-methods/default
 * Get the default payment method
 */
async function getDefaultPaymentMethod(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const service = getPaymentMethodService();

  const paymentMethod = await service.getDefaultPaymentMethod(request.user.id);

  if (!paymentMethod) {
    return reply.send({
      success: true,
      data: null,
      message: 'No default payment method set',
    });
  }

  return reply.send({
    success: true,
    data: formatPaymentMethod(paymentMethod),
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format payment method for API response
 * Simply passes through the PaymentMethodResponse from service
 * with any additional formatting needed for the API
 */
function formatPaymentMethod(pm: PaymentMethodResponse): {
  id: string;
  type: string;
  isDefault: boolean;
  status: string;
  card: {
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    funding: string | null;
  } | null;
  bankAccount: {
    bankName: string | null;
    last4: string | null;
    accountType: string | null;
  } | null;
  sepa: {
    country: string | null;
    bankCode: string | null;
    last4: string | null;
  } | null;
  billingDetails: {
    name: string | null;
    email: string | null;
    country: string | null;
    postalCode: string | null;
  } | null;
  createdAt: string;
} {
  return {
    id: pm.id,
    type: pm.type,
    isDefault: pm.isDefault,
    status: pm.status,
    card: pm.card
      ? {
          brand: pm.card.brand ?? null,
          last4: pm.card.last4 ?? null,
          expMonth: pm.card.expMonth ?? null,
          expYear: pm.card.expYear ?? null,
          funding: pm.card.funding ?? null,
        }
      : null,
    bankAccount: pm.bank
      ? {
          bankName: pm.bank.name ?? null,
          last4: pm.bank.last4 ?? null,
          accountType: pm.bank.accountType ?? null,
        }
      : null,
    sepa: pm.sepa
      ? {
          country: pm.sepa.country ?? null,
          bankCode: pm.sepa.bankCode ?? null,
          last4: pm.sepa.last4 ?? null,
        }
      : null,
    billingDetails: pm.billingDetails
      ? {
          name: pm.billingDetails.name ?? null,
          email: pm.billingDetails.email ?? null,
          country: pm.billingDetails.country ?? null,
          postalCode: pm.billingDetails.postalCode ?? null,
        }
      : null,
    createdAt: pm.createdAt,
  };
}

// =============================================================================
// PLUGIN REGISTRATION
// =============================================================================

/**
 * Register payment method routes
 */
export async function paymentMethodRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();
  // All routes require authentication
  fastify.addHook('preHandler', async (request, reply) => {
    // This should be handled by your auth middleware
    // For now, we expect request.user to be set by auth plugin
    if (!request.user) {
      void reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
  });

  // GET /payment-methods - List all payment methods
  fastify.get('/', {
    schema: {
      tags: ['Payment Methods'],
      summary: 'List payment methods',
      description: 'Get all payment methods for the authenticated user',
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['CARD', 'ACH_DEBIT', 'SEPA_DEBIT', 'WIRE'] },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'FAILED', 'REMOVED'],
          },
          includeRemoved: { type: 'boolean', default: false },
        },
      },
    },
    handler: getPaymentMethods as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  // GET /payment-methods/default - Get default payment method
  fastify.get('/default', {
    schema: {
      tags: ['Payment Methods'],
      summary: 'Get default payment method',
      description: 'Get the default payment method for the authenticated user',
    },
    handler: getDefaultPaymentMethod as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  // GET /payment-methods/:id - Get specific payment method
  fastify.get('/:id', {
    schema: {
      tags: ['Payment Methods'],
      summary: 'Get payment method',
      description: 'Get a specific payment method by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    handler: getPaymentMethod as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  // POST /payment-methods/setup-intent - Create setup intent
  fastify.post('/setup-intent', {
    schema: {
      tags: ['Payment Methods'],
      summary: 'Create setup intent',
      description: 'Create a Stripe SetupIntent for securely collecting payment details',
      body: {
        type: 'object',
        required: ['paymentMethodType'],
        properties: {
          paymentMethodType: { type: 'string', enum: ['card', 'us_bank_account', 'sepa_debit'] },
          metadata: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
    },
    handler: createSetupIntent as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  // POST /payment-methods - Attach payment method
  fastify.post('/', {
    schema: {
      tags: ['Payment Methods'],
      summary: 'Attach payment method',
      description: 'Attach a payment method to the user after SetupIntent completes',
      body: {
        type: 'object',
        required: ['paymentMethodId'],
        properties: {
          paymentMethodId: { type: 'string' },
          setAsDefault: { type: 'boolean', default: false },
        },
      },
    },
    handler: attachPaymentMethod as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  // PUT /payment-methods/:id/default - Set as default
  fastify.put('/:id/default', {
    schema: {
      tags: ['Payment Methods'],
      summary: 'Set default payment method',
      description: 'Set a payment method as the default for the user',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    handler: setDefaultPaymentMethod as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  // DELETE /payment-methods/:id - Remove payment method
  fastify.delete('/:id', {
    schema: {
      tags: ['Payment Methods'],
      summary: 'Remove payment method',
      description: 'Remove a payment method from the user account',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    handler: removePaymentMethod as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  // POST /payment-methods/sync - Sync from Stripe
  fastify.post('/sync', {
    schema: {
      tags: ['Payment Methods'],
      summary: 'Sync payment methods',
      description: 'Synchronize payment methods from Stripe (for recovery/support)',
    },
    handler: syncPaymentMethods as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });
}

export default paymentMethodRoutes;
