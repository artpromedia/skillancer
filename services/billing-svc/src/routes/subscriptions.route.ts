/**
 * @module @skillancer/billing-svc/routes/subscriptions
 * Subscription management routes
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  SKILLPOD_PLANS,
  COCKPIT_PLANS,
  type ProductType,
  type BillingIntervalType,
} from '../config/plans.js';
import { getErrorResponse } from '../errors/index.js';
import {
  getSubscriptionService,
  type CreateSubscriptionOptions,
} from '../services/subscription.service.js';

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

// Product and billing enums
const ProductEnum = z.enum(['SKILLPOD', 'COCKPIT']);
const BillingIntervalEnum = z.enum(['MONTHLY', 'ANNUAL']);

// Create subscription request
const CreateSubscriptionSchema = z.object({
  product: ProductEnum,
  plan: z.string().min(1),
  billingInterval: BillingIntervalEnum,
  paymentMethodId: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  skipTrial: z.boolean().optional(),
});

// Cancel subscription request
const CancelSubscriptionSchema = z.object({
  atPeriodEnd: z.boolean().default(true),
});

// Upgrade/downgrade subscription request
const ChangePlanSchema = z.object({
  plan: z.string().min(1),
});

// Change billing interval request
const ChangeBillingIntervalSchema = z.object({
  billingInterval: BillingIntervalEnum,
});

// Record usage request
const RecordUsageSchema = z.object({
  minutes: z.number().int().positive(),
  sessionId: z.string().optional(),
  podId: z.string().optional(),
  description: z.string().optional(),
});

// Query params for list operations
const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// =============================================================================
// ROUTE PLUGIN
// =============================================================================

const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  const subscriptionService = getSubscriptionService();

  // ===========================================================================
  // PLANS ENDPOINT (Public)
  // ===========================================================================

  /**
   * GET /subscriptions/plans
   * Get available subscription plans
   */
  fastify.get(
    '/plans',
    {
      schema: {
        description: 'Get available subscription plans',
        tags: ['subscriptions'],
        response: {
          200: {
            type: 'object',
            properties: {
              skillpod: {
                type: 'array',
                items: { type: 'object' },
              },
              cockpit: {
                type: 'array',
                items: { type: 'object' },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const skillpodPlans = Object.entries(SKILLPOD_PLANS).map(([key, plan]) => ({
        id: key,
        name: plan.name,
        features: plan.features,
        usageLimit: plan.features.hoursPerMonth,
        pricing:
          'custom' in plan
            ? null
            : {
                monthly: plan.monthlyPrice,
                annual: plan.annualPrice,
                annualSavings: Math.round(plan.monthlyPrice * 12 - plan.annualPrice),
              },
        trialDays: 'trialDays' in plan ? plan.trialDays : 0,
        isEnterprise: 'custom' in plan,
      }));

      const cockpitPlans = Object.entries(COCKPIT_PLANS).map(([key, plan]) => ({
        id: key,
        name: plan.name,
        features: plan.features,
        pricing:
          'custom' in plan
            ? null
            : {
                monthly: plan.monthlyPrice,
                annual: plan.annualPrice,
                annualSavings: Math.round(plan.monthlyPrice * 12 - plan.annualPrice),
              },
        trialDays: 'trialDays' in plan ? plan.trialDays : 0,
        isEnterprise: 'custom' in plan,
      }));

      return reply.send({
        skillpod: skillpodPlans,
        cockpit: cockpitPlans,
      });
    }
  );

  // ===========================================================================
  // SUBSCRIPTION CRUD
  // ===========================================================================

  /**
   * GET /subscriptions
   * List all subscriptions for the authenticated user
   */
  fastify.get(
    '/',
    {
      schema: {
        description: 'List all subscriptions for the authenticated user',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              subscriptions: {
                type: 'array',
                items: { type: 'object' },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = requireUser(request);
        const subscriptions = await subscriptionService.getSubscriptions(user.id);
        return await reply.send({ subscriptions });
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * GET /subscriptions/:subscriptionId
   * Get a specific subscription
   */
  fastify.get<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId',
    {
      schema: {
        description: 'Get a specific subscription',
        tags: ['subscriptions'],
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
        const subscription = await subscriptionService.getSubscription(
          request.params.subscriptionId,
          user.id
        );
        return await reply.send(subscription);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * POST /subscriptions
   * Create a new subscription
   */
  fastify.post(
    '/',
    {
      schema: {
        description: 'Create a new subscription',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(CreateSubscriptionSchema),
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
        const body = CreateSubscriptionSchema.parse(request.body);

        const options: CreateSubscriptionOptions = {
          product: body.product.toLowerCase() as ProductType,
          plan: body.plan,
          billingInterval: body.billingInterval.toLowerCase() as BillingIntervalType,
        };

        // Only add optional fields if they have values
        if (body.paymentMethodId) {
          options.paymentMethodId = body.paymentMethodId;
        }
        if (body.tenantId) {
          options.tenantId = body.tenantId;
        } else if (user.tenantId) {
          options.tenantId = user.tenantId;
        }
        if (body.skipTrial !== undefined) {
          options.skipTrial = body.skipTrial;
        }

        const subscription = await subscriptionService.createSubscription(user.id, options);

        return await reply.code(201).send(subscription);
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

  /**
   * DELETE /subscriptions/:subscriptionId
   * Cancel a subscription
   */
  fastify.delete<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId',
    {
      schema: {
        description: 'Cancel a subscription',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        body: zodToJsonSchema(CancelSubscriptionSchema),
        response: {
          200: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = requireUser(request);
        const rawBody = request.body ?? {};
        const body = CancelSubscriptionSchema.parse(rawBody);

        const subscription = await subscriptionService.cancelSubscription(
          request.params.subscriptionId,
          user.id,
          body.atPeriodEnd
        );

        return await reply.send(subscription);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * POST /subscriptions/:subscriptionId/reactivate
   * Reactivate a canceled subscription
   */
  fastify.post<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId/reactivate',
    {
      schema: {
        description: 'Reactivate a canceled subscription',
        tags: ['subscriptions'],
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
          400: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = requireUser(request);
        const subscription = await subscriptionService.reactivateSubscription(
          request.params.subscriptionId,
          user.id
        );

        return await reply.send(subscription);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // PLAN CHANGES
  // ===========================================================================

  /**
   * POST /subscriptions/:subscriptionId/upgrade
   * Upgrade subscription to a higher plan
   */
  fastify.post<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId/upgrade',
    {
      schema: {
        description: 'Upgrade subscription to a higher plan (immediate, prorated)',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        body: zodToJsonSchema(ChangePlanSchema),
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
        const body = ChangePlanSchema.parse(request.body);

        const result = await subscriptionService.upgradeSubscription(
          request.params.subscriptionId,
          user.id,
          body.plan
        );

        return await reply.send({
          subscription: result.subscription,
          effectiveDate: result.effectiveDate.toISOString(),
          isImmediate: result.isImmediate,
          prorationAmount: result.prorationAmount,
        });
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * POST /subscriptions/:subscriptionId/downgrade
   * Downgrade subscription to a lower plan
   */
  fastify.post<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId/downgrade',
    {
      schema: {
        description: 'Downgrade subscription to a lower plan (at period end)',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        body: zodToJsonSchema(ChangePlanSchema),
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
        const body = ChangePlanSchema.parse(request.body);

        const result = await subscriptionService.downgradeSubscription(
          request.params.subscriptionId,
          user.id,
          body.plan
        );

        return await reply.send({
          subscription: result.subscription,
          effectiveDate: result.effectiveDate.toISOString(),
          isImmediate: result.isImmediate,
          message: `Plan will change to "${body.plan}" at the end of the current billing period`,
        });
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * POST /subscriptions/:subscriptionId/billing-interval
   * Change billing interval (monthly <-> annual)
   */
  fastify.post<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId/billing-interval',
    {
      schema: {
        description: 'Change billing interval between monthly and annual',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        body: zodToJsonSchema(ChangeBillingIntervalSchema),
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
        const body = ChangeBillingIntervalSchema.parse(request.body);

        const subscription = await subscriptionService.changeBillingInterval(
          request.params.subscriptionId,
          user.id,
          body.billingInterval.toLowerCase() as BillingIntervalType
        );

        return await reply.send(subscription);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // USAGE TRACKING
  // ===========================================================================

  /**
   * GET /subscriptions/:subscriptionId/usage
   * Get usage summary for a subscription
   */
  fastify.get<{
    Params: { subscriptionId: string };
    Querystring: { periodStart?: string };
  }>(
    '/:subscriptionId/usage',
    {
      schema: {
        description: 'Get usage summary for a subscription',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        querystring: {
          type: 'object',
          properties: {
            periodStart: { type: 'string', format: 'date-time' },
          },
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
        // Verify ownership
        await subscriptionService.getSubscription(request.params.subscriptionId, user.id);

        const periodStart = request.query.periodStart
          ? new Date(request.query.periodStart)
          : undefined;

        const usage = await subscriptionService.getUsage(
          request.params.subscriptionId,
          periodStart
        );

        return await reply.send(usage);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * POST /subscriptions/:subscriptionId/usage
   * Record usage for a subscription (internal use / service-to-service)
   */
  fastify.post<{
    Params: { subscriptionId: string };
  }>(
    '/:subscriptionId/usage',
    {
      schema: {
        description: 'Record usage for a subscription',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        body: zodToJsonSchema(RecordUsageSchema),
        response: {
          204: { type: 'null' },
          400: { type: 'object' },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = RecordUsageSchema.parse(request.body);

        const usageOptions: { sessionId?: string; podId?: string; description?: string } = {};
        if (body.sessionId) usageOptions.sessionId = body.sessionId;
        if (body.podId) usageOptions.podId = body.podId;
        if (body.description) usageOptions.description = body.description;

        await subscriptionService.recordUsage(
          request.params.subscriptionId,
          body.minutes,
          usageOptions
        );

        return await reply.code(204).send();
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  // ===========================================================================
  // INVOICES
  // ===========================================================================

  /**
   * GET /subscriptions/:subscriptionId/invoices
   * List invoices for a subscription
   */
  fastify.get<{
    Params: { subscriptionId: string };
    Querystring: z.infer<typeof PaginationSchema>;
  }>(
    '/:subscriptionId/invoices',
    {
      schema: {
        description: 'List invoices for a subscription',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', format: 'uuid' },
          },
          required: ['subscriptionId'],
        },
        querystring: zodToJsonSchema(PaginationSchema),
        response: {
          200: {
            type: 'object',
            properties: {
              invoices: { type: 'array', items: { type: 'object' } },
            },
          },
          404: { type: 'object' },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = requireUser(request);
        // Verify ownership
        await subscriptionService.getSubscription(request.params.subscriptionId, user.id);

        const invoices = await subscriptionService.getInvoices(request.params.subscriptionId);

        return await reply.send({ invoices });
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * GET /subscriptions/invoices/:invoiceId
   * Get a specific invoice
   */
  fastify.get<{
    Params: { invoiceId: string };
  }>(
    '/invoices/:invoiceId',
    {
      schema: {
        description: 'Get a specific invoice',
        tags: ['subscriptions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            invoiceId: { type: 'string', format: 'uuid' },
          },
          required: ['invoiceId'],
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
        const invoice = await subscriptionService.getInvoice(request.params.invoiceId);

        // Verify ownership via subscription
        await subscriptionService.getSubscription(invoice.subscriptionId, user.id);

        return await reply.send(invoice);
      } catch (error) {
        const { statusCode, body } = getErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );
};

export default subscriptionRoutes;
