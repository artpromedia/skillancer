// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/routes/payout-accounts
 * Payout account management API routes (Stripe Connect)
 */

import { z } from 'zod';

import {
  PayoutAccountNotFoundError,
  PayoutAccountNotActiveError,
  PayoutAccountExistsError,
} from '../errors/index.js';
import { getPayoutAccountService } from '../services/payout.service.js';
import { PAYOUT_COUNTRIES } from '../types/index.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const createPayoutAccountSchema = z.object({
  country: z.string().length(2, 'Country must be a 2-letter ISO code'),
  businessType: z.enum(['individual', 'company']).optional(),
});

const createPayoutSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).optional(),
  description: z.string().max(500).optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
});

const getPayoutsQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_TRANSIT', 'PAID', 'FAILED', 'CANCELED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
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
 * GET /payout-accounts
 * Get the user's payout account
 */
async function getPayoutAccount(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const service = getPayoutAccountService();
  const account = await service.getPayoutAccount(request.user.id);

  if (!account) {
    return reply.send({
      success: true,
      data: {
        payoutAccount: null,
        hasPayoutAccount: false,
      },
    });
  }

  return reply.send({
    success: true,
    data: {
      payoutAccount: account,
      hasPayoutAccount: true,
    },
  });
}

/**
 * POST /payout-accounts/setup
 * Create a new payout account (Stripe Connect)
 */
async function setupPayoutAccount(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const body = createPayoutAccountSchema.parse(request.body);
  const service = getPayoutAccountService();

  // Validate country is supported
  if (!PAYOUT_COUNTRIES.includes(body.country as (typeof PAYOUT_COUNTRIES)[number])) {
    return reply.status(400).send({
      success: false,
      error: 'UnsupportedCountry',
      message: `Payouts are not supported in ${body.country}`,
    });
  }

  try {
    const result = await service.createPayoutAccount(request.user.id, request.user.email, {
      country: body.country,
      businessType: body.businessType,
    });

    return await reply.status(201).send({
      success: true,
      data: {
        payoutAccount: result.account,
        onboardingUrl: result.onboardingUrl,
      },
    });
  } catch (error) {
    if (error instanceof PayoutAccountExistsError) {
      return reply.status(409).send({
        success: false,
        error: 'PayoutAccountExists',
        message:
          'You already have a payout account. Use the onboarding endpoint to continue setup.',
      });
    }
    throw error;
  }
}

/**
 * GET /payout-accounts/status
 * Get payout account status (synced from Stripe)
 */
async function getPayoutAccountStatus(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const service = getPayoutAccountService();

  try {
    const account = await service.syncPayoutAccountStatus(request.user.id);

    return await reply.send({
      success: true,
      data: {
        status: account.status,
        payoutsEnabled: account.payoutsEnabled,
        chargesEnabled: account.chargesEnabled,
        requirements: account.requirements,
        defaultCurrency: account.defaultCurrency,
      },
    });
  } catch (error) {
    if (error instanceof PayoutAccountNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'PayoutAccountNotFound',
        message: 'You do not have a payout account. Create one first.',
      });
    }
    throw error;
  }
}

/**
 * POST /payout-accounts/onboarding
 * Get/refresh onboarding link
 */
async function getOnboardingLink(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const service = getPayoutAccountService();

  try {
    const result = await service.getOnboardingLink(request.user.id);

    return await reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof PayoutAccountNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'PayoutAccountNotFound',
        message: 'You do not have a payout account. Create one first.',
      });
    }
    throw error;
  }
}

/**
 * POST /payout-accounts/dashboard
 * Get Express dashboard link
 */
async function getDashboardLink(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const service = getPayoutAccountService();

  try {
    const result = await service.getDashboardLink(request.user.id);

    return await reply.send({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof PayoutAccountNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'PayoutAccountNotFound',
        message: 'You do not have a payout account.',
      });
    }
    if (error instanceof PayoutAccountNotActiveError) {
      return reply.status(400).send({
        success: false,
        error: 'PayoutAccountNotActive',
        message: 'Complete onboarding first to access the dashboard.',
      });
    }
    throw error;
  }
}

/**
 * POST /payout-accounts/payouts
 * Create a payout (transfer to Connect account)
 */
async function createPayout(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const body = createPayoutSchema.parse(request.body);
  const service = getPayoutAccountService();

  try {
    const payout = await service.createPayout(request.user.id, body);

    return await reply.status(201).send({
      success: true,
      data: { payout },
    });
  } catch (error) {
    if (error instanceof PayoutAccountNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'PayoutAccountNotFound',
        message: 'You do not have a payout account.',
      });
    }
    if (error instanceof PayoutAccountNotActiveError) {
      return reply.status(400).send({
        success: false,
        error: 'PayoutAccountNotActive',
        message: 'Your payout account is not active. Complete onboarding first.',
      });
    }
    throw error;
  }
}

/**
 * GET /payout-accounts/payouts
 * List payouts
 */
async function getPayouts(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const query = getPayoutsQuerySchema.parse(request.query);
  const service = getPayoutAccountService();

  const result = await service.getPayouts(request.user.id, {
    status: query.status,
    limit: query.limit,
    offset: query.offset,
  });

  return reply.send({
    success: true,
    data: {
      payouts: result.payouts,
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    },
  });
}

/**
 * GET /payout-accounts/payouts/:id
 * Get a specific payout
 */
async function getPayout(request: AuthenticatedRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const service = getPayoutAccountService();

  try {
    const payout = await service.getPayout(request.user.id, id);

    return await reply.send({
      success: true,
      data: { payout },
    });
  } catch (error) {
    if (error instanceof PayoutAccountNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: 'PayoutAccountNotFound',
        message: 'Payout account not found.',
      });
    }
    if (error instanceof Error && error.message === 'Payout not found') {
      return reply.status(404).send({
        success: false,
        error: 'PayoutNotFound',
        message: 'Payout not found.',
      });
    }
    throw error;
  }
}

/**
 * GET /payout-accounts/supported-countries
 * Get list of supported payout countries
 */
async function getSupportedCountries(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  return reply.send({
    success: true,
    data: {
      countries: PAYOUT_COUNTRIES,
    },
  });
}

// =============================================================================
// PLUGIN REGISTRATION
// =============================================================================

export async function payoutAccountRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();

  // Public endpoint - no auth needed
  fastify.get('/supported-countries', {
    schema: {
      tags: ['Payout Accounts'],
      summary: 'Get supported payout countries',
      description: 'Returns a list of countries where payouts are supported',
    },
    handler: getSupportedCountries,
  });

  // Protected routes - require authentication
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Payout Accounts'],
      summary: 'Get payout account',
      description: "Get the current user's payout account",
      security: [{ bearerAuth: [] }],
    },
    handler: getPayoutAccount as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.post('/setup', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Payout Accounts'],
      summary: 'Setup payout account',
      description: 'Create a new Stripe Connect account for receiving payouts',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['country'],
        properties: {
          country: { type: 'string', minLength: 2, maxLength: 2 },
          businessType: { type: 'string', enum: ['individual', 'company'] },
        },
      },
    },
    handler: setupPayoutAccount as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.get('/status', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Payout Accounts'],
      summary: 'Get payout account status',
      description: 'Get the current status of the payout account (synced from Stripe)',
      security: [{ bearerAuth: [] }],
    },
    handler: getPayoutAccountStatus as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.post('/onboarding', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Payout Accounts'],
      summary: 'Get onboarding link',
      description: 'Get a link to complete or refresh Stripe Connect onboarding',
      security: [{ bearerAuth: [] }],
    },
    handler: getOnboardingLink as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.post('/dashboard', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Payout Accounts'],
      summary: 'Get dashboard link',
      description: 'Get a link to the Stripe Express dashboard',
      security: [{ bearerAuth: [] }],
    },
    handler: getDashboardLink as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.post('/payouts', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Payout Accounts'],
      summary: 'Create payout',
      description: 'Create a new payout (transfer to Connect account)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: { type: 'number', minimum: 0.01 },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          description: { type: 'string', maxLength: 500 },
          referenceType: { type: 'string', maxLength: 50 },
          referenceId: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: createPayout as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.get('/payouts', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Payout Accounts'],
      summary: 'List payouts',
      description: 'Get a list of payouts for the current user',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'IN_TRANSIT', 'PAID', 'FAILED', 'CANCELED'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
    handler: getPayouts as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });

  fastify.get('/payouts/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Payout Accounts'],
      summary: 'Get payout',
      description: 'Get details of a specific payout',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: getPayout as unknown as (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>,
  });
}
