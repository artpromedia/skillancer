// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/routes/payouts
 * Global Payout API Routes
 *
 * REST API endpoints for multi-currency payouts, balance management,
 * and payout scheduling.
 */

import { z } from 'zod';

import { getExchangeRateService } from '../services/exchange-rate.service.js';
import { getGlobalPayoutService } from '../services/global-payout.service.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const RequestPayoutSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  targetCurrency: z.string().length(3).optional(),
  method: z.enum(['BANK_TRANSFER', 'DEBIT_CARD', 'PAYPAL', 'WISE', 'LOCAL_BANK']).optional(),
  description: z.string().max(255).optional(),
});

const InstantPayoutSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  destination: z.enum(['debit_card', 'instant_bank']).optional(),
});

const PreviewPayoutSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  targetCurrency: z.string().length(3).optional(),
  method: z.enum(['BANK_TRANSFER', 'DEBIT_CARD', 'PAYPAL', 'WISE', 'LOCAL_BANK']).optional(),
  instant: z.boolean().optional(),
});

const UpdateScheduleSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'MANUAL']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  minimumAmount: z.number().positive(),
  currency: z.string().length(3),
  autoPayoutEnabled: z.boolean(),
});

const ConversionPreviewSchema = z.object({
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
  amount: z.number().positive(),
});

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export async function payoutRoutes(fastify: FastifyInstance): Promise<void> {
  const config = fastify.config ?? { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY };

  // ===========================================================================
  // BALANCE ROUTES
  // ===========================================================================

  /**
   * GET /payouts/balance
   * Get user's payout balance summary
   */
  fastify.get('/balance', {
    preHandler: [fastify.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const balance = await payoutService.getBalance(userId);

        return await reply.send({
          success: true,
          data: balance,
        });
      } catch (err) {
        request.log.error(err, 'Failed to get balance');
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve balance',
        });
      }
    },
  });

  // ===========================================================================
  // PAYOUT ROUTES
  // ===========================================================================

  /**
   * POST /payouts
   * Request a standard payout
   */
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof RequestPayoutSchema> }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parseResult = RequestPayoutSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const payout = await payoutService.requestPayout({
          userId,
          ...parseResult.data,
        });

        return await reply.status(201).send({
          success: true,
          data: payout,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to request payout');
        return reply.status(400).send({
          success: false,
          error: err.message ?? 'Failed to process payout request',
        });
      }
    },
  });

  /**
   * POST /payouts/instant
   * Request an instant payout
   */
  fastify.post('/instant', {
    preHandler: [fastify.authenticate],
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof InstantPayoutSchema> }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parseResult = InstantPayoutSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const payout = await payoutService.requestInstantPayout({
          userId,
          ...parseResult.data,
        });

        return await reply.status(201).send({
          success: true,
          data: payout,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to request instant payout');
        return reply.status(400).send({
          success: false,
          error: err.message ?? 'Failed to process instant payout',
        });
      }
    },
  });

  /**
   * POST /payouts/preview
   * Preview payout with fee breakdown
   */
  fastify.post('/preview', {
    preHandler: [fastify.authenticate],
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof PreviewPayoutSchema> }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parseResult = PreviewPayoutSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const preview = await payoutService.previewPayout({
          userId,
          ...parseResult.data,
        });

        return await reply.send({
          success: true,
          data: preview,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to preview payout');
        return reply.status(400).send({
          success: false,
          error: err.message ?? 'Failed to generate payout preview',
        });
      }
    },
  });

  /**
   * GET /payouts
   * Get user's payout history
   */
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    handler: async (
      request: FastifyRequest<{
        Querystring: {
          status?: string;
          limit?: string;
          offset?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { status, limit, offset } = request.query;

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const result = await payoutService.getPayoutHistory(userId, {
          status: status as any,
          limit: limit ? parseInt(limit, 10) : undefined,
          offset: offset ? parseInt(offset, 10) : undefined,
        });

        return await reply.send({
          success: true,
          data: result,
        });
      } catch (err) {
        request.log.error(err, 'Failed to get payout history');
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve payout history',
        });
      }
    },
  });

  /**
   * GET /payouts/:id
   * Get specific payout details
   */
  fastify.get('/:id', {
    preHandler: [fastify.authenticate],
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const payout = await payoutService.getPayout(request.params.id);

        if (!payout) {
          return await reply.status(404).send({
            success: false,
            error: 'Payout not found',
          });
        }

        return await reply.send({
          success: true,
          data: payout,
        });
      } catch (err) {
        request.log.error(err, 'Failed to get payout');
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve payout',
        });
      }
    },
  });

  /**
   * DELETE /payouts/:id
   * Cancel a pending payout
   */
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
    handler: async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const payout = await payoutService.cancelPayout(request.params.id, userId);

        return await reply.send({
          success: true,
          data: payout,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to cancel payout');
        return reply.status(400).send({
          success: false,
          error: err.message ?? 'Failed to cancel payout',
        });
      }
    },
  });

  // ===========================================================================
  // SCHEDULE ROUTES
  // ===========================================================================

  /**
   * GET /payouts/schedule
   * Get user's payout schedule
   */
  fastify.get('/schedule', {
    preHandler: [fastify.authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const schedule = await payoutService.getSchedule(userId);

        return await reply.send({
          success: true,
          data: schedule,
        });
      } catch (err) {
        request.log.error(err, 'Failed to get schedule');
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve payout schedule',
        });
      }
    },
  });

  /**
   * PUT /payouts/schedule
   * Create or update payout schedule
   */
  fastify.put('/schedule', {
    preHandler: [fastify.authenticate],
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof UpdateScheduleSchema> }>,
      reply: FastifyReply
    ) => {
      const userId = request.user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parseResult = UpdateScheduleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      try {
        const payoutService = getGlobalPayoutService({ stripeSecretKey: config.STRIPE_SECRET_KEY });
        const schedule = await payoutService.updateSchedule(userId, parseResult.data);

        return await reply.send({
          success: true,
          data: schedule,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to update schedule');
        return reply.status(400).send({
          success: false,
          error: err.message ?? 'Failed to update payout schedule',
        });
      }
    },
  });
}

// =============================================================================
// EXCHANGE RATE ROUTES
// =============================================================================

export async function exchangeRateRoutes(fastify: FastifyInstance): Promise<void> {
  const exchangeService = getExchangeRateService();

  /**
   * GET /exchange-rates/currencies
   * Get list of supported currencies
   */
  fastify.get('/currencies', {
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const currencies = exchangeService.getSupportedCurrencies();
        return await reply.send({
          success: true,
          data: currencies,
        });
      } catch (err) {
        request.log.error(err, 'Failed to get currencies');
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve currencies',
        });
      }
    },
  });

  /**
   * GET /exchange-rates
   * Get all exchange rates from USD
   */
  fastify.get('/', {
    handler: async (
      request: FastifyRequest<{ Querystring: { base?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const base = request.query.base ?? 'USD';
        const rates = await exchangeService.getAllRates(base);

        return await reply.send({
          success: true,
          data: {
            baseCurrency: base,
            rates,
            lastUpdated: new Date(),
          },
        });
      } catch (err) {
        request.log.error(err, 'Failed to get exchange rates');
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve exchange rates',
        });
      }
    },
  });

  /**
   * GET /exchange-rates/:from/:to
   * Get exchange rate between two currencies
   */
  fastify.get('/:from/:to', {
    handler: async (
      request: FastifyRequest<{ Params: { from: string; to: string } }>,
      reply: FastifyReply
    ) => {
      const { from, to } = request.params;

      try {
        const rate = await exchangeService.getRate(from.toUpperCase(), to.toUpperCase());

        return await reply.send({
          success: true,
          data: {
            fromCurrency: from.toUpperCase(),
            toCurrency: to.toUpperCase(),
            ...rate,
          },
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to get exchange rate');
        return reply.status(400).send({
          success: false,
          error: err.message ?? 'Failed to retrieve exchange rate',
        });
      }
    },
  });

  /**
   * POST /exchange-rates/convert
   * Convert amount between currencies
   */
  fastify.post('/convert', {
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof ConversionPreviewSchema> }>,
      reply: FastifyReply
    ) => {
      const parseResult = ConversionPreviewSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      try {
        const { fromCurrency, toCurrency, amount } = parseResult.data;
        const result = await exchangeService.convert({
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
          amount,
        });

        return await reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to convert currency');
        return reply.status(400).send({
          success: false,
          error: err.message ?? 'Failed to convert currency',
        });
      }
    },
  });

  /**
   * POST /exchange-rates/preview
   * Preview conversion with fee breakdown
   */
  fastify.post('/preview', {
    handler: async (
      request: FastifyRequest<{ Body: z.infer<typeof ConversionPreviewSchema> }>,
      reply: FastifyReply
    ) => {
      const parseResult = ConversionPreviewSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: parseResult.error.flatten(),
        });
      }

      try {
        const { fromCurrency, toCurrency, amount } = parseResult.data;
        const preview = await exchangeService.previewConversion(
          fromCurrency.toUpperCase(),
          toCurrency.toUpperCase(),
          amount
        );

        return await reply.send({
          success: true,
          data: preview,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to preview conversion');
        return reply.status(400).send({
          success: false,
          error: err.message ?? 'Failed to preview conversion',
        });
      }
    },
  });
}

export default payoutRoutes;
