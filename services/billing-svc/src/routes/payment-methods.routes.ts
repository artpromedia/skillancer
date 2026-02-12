// @ts-nocheck
/**
 * @module @skillancer/billing-svc/routes/payment-methods.routes
 * Payment Methods Routes
 *
 * API endpoints for managing payment methods:
 * - List payment methods
 * - Add new payment method
 * - Update default payment method
 * - Remove payment method
 */

import { createAuditLog } from '@skillancer/audit-client';
import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import Stripe from 'stripe';
import { z } from 'zod';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const listPaymentMethodsSchema = {
  querystring: z.object({
    type: z.enum(['card', 'bank_account', 'all']).optional().default('all'),
  }),
};

const addPaymentMethodSchema = {
  body: z.object({
    paymentMethodId: z.string().min(1),
    setAsDefault: z.boolean().optional().default(false),
  }),
};

const updateDefaultPaymentMethodSchema = {
  params: z.object({
    paymentMethodId: z.string().min(1),
  }),
};

const removePaymentMethodSchema = {
  params: z.object({
    paymentMethodId: z.string().min(1),
  }),
};

const setupIntentSchema = {
  body: z.object({
    usage: z.enum(['off_session', 'on_session']).optional().default('off_session'),
  }),
};

// =============================================================================
// TYPES
// =============================================================================

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    stripeCustomerId?: string;
  };
}

interface PaymentMethodResponse {
  id: string;
  type: 'card' | 'bank_account';
  isDefault: boolean;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  bankAccount?: {
    bankName: string;
    last4: string;
    accountHolderType: string;
  };
  createdAt: Date;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

async function paymentMethodsRoutes(fastify: FastifyInstance): Promise<void> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-11-20.acacia',
  });

  /**
   * GET /payment-methods
   * List all payment methods for authenticated user
   */
  fastify.get(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ['Payment Methods'],
        summary: 'List payment methods',
        description: 'Get all payment methods for the authenticated user',
        querystring: listPaymentMethodsSchema.querystring,
        response: {
          200: {
            type: 'object',
            properties: {
              paymentMethods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    isDefault: { type: 'boolean' },
                    card: {
                      type: 'object',
                      properties: {
                        brand: { type: 'string' },
                        last4: { type: 'string' },
                        expMonth: { type: 'number' },
                        expYear: { type: 'number' },
                      },
                    },
                  },
                },
              },
              defaultPaymentMethodId: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { type } = listPaymentMethodsSchema.querystring.parse(request.query);

      // Get or create Stripe customer
      const stripeCustomerId = await ensureStripeCustomer(req.user.id, stripe);

      // Get customer to find default payment method
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      const defaultPaymentMethodId =
        (customer as Stripe.Customer).invoice_settings?.default_payment_method || null;

      // List payment methods
      const paymentMethods: PaymentMethodResponse[] = [];

      if (type === 'all' || type === 'card') {
        const cards = await stripe.paymentMethods.list({
          customer: stripeCustomerId,
          type: 'card',
        });

        for (const pm of cards.data) {
          paymentMethods.push({
            id: pm.id,
            type: 'card',
            isDefault: pm.id === defaultPaymentMethodId,
            card: {
              brand: pm.card!.brand,
              last4: pm.card!.last4,
              expMonth: pm.card!.exp_month,
              expYear: pm.card!.exp_year,
            },
            createdAt: new Date(pm.created * 1000),
          });
        }
      }

      if (type === 'all' || type === 'bank_account') {
        const bankAccounts = await stripe.paymentMethods.list({
          customer: stripeCustomerId,
          type: 'us_bank_account',
        });

        for (const pm of bankAccounts.data) {
          paymentMethods.push({
            id: pm.id,
            type: 'bank_account',
            isDefault: pm.id === defaultPaymentMethodId,
            bankAccount: {
              bankName: pm.us_bank_account!.bank_name || 'Unknown',
              last4: pm.us_bank_account!.last4 || '',
              accountHolderType: pm.us_bank_account!.account_holder_type || 'individual',
            },
            createdAt: new Date(pm.created * 1000),
          });
        }
      }

      return reply.send({
        paymentMethods,
        defaultPaymentMethodId,
      });
    }
  );

  /**
   * POST /payment-methods
   * Add a new payment method
   */
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ['Payment Methods'],
        summary: 'Add payment method',
        description: 'Attach a new payment method to the authenticated user',
        body: addPaymentMethodSchema.body,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { paymentMethodId, setAsDefault } = addPaymentMethodSchema.body.parse(request.body);

      const stripeCustomerId = await ensureStripeCustomer(req.user.id, stripe);

      // Attach payment method to customer
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Set as default if requested
      if (setAsDefault) {
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      // Audit log
      await createAuditLog({
        action: 'PAYMENT_METHOD_ADDED',
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        userId: req.user.id,
        metadata: {
          type: paymentMethod.type,
          last4: paymentMethod.card?.last4 || paymentMethod.us_bank_account?.last4,
          setAsDefault,
        },
      });

      logger.info(
        { userId: req.user.id, paymentMethodId, type: paymentMethod.type },
        'Payment method added'
      );

      return reply.status(201).send({
        id: paymentMethod.id,
        type: paymentMethod.type,
        isDefault: setAsDefault,
        card: paymentMethod.card
          ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year,
            }
          : undefined,
      });
    }
  );

  /**
   * PUT /payment-methods/:paymentMethodId/default
   * Set payment method as default
   */
  fastify.put(
    '/:paymentMethodId/default',
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ['Payment Methods'],
        summary: 'Set default payment method',
        description: 'Set a payment method as the default for the authenticated user',
        params: updateDefaultPaymentMethodSchema.params,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { paymentMethodId } = updateDefaultPaymentMethodSchema.params.parse(request.params);

      const stripeCustomerId = await ensureStripeCustomer(req.user.id, stripe);

      // Verify payment method belongs to customer
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== stripeCustomerId) {
        return reply.status(403).send({
          error: 'Payment method does not belong to this customer',
        });
      }

      // Update default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      await createAuditLog({
        action: 'PAYMENT_METHOD_DEFAULT_UPDATED',
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        userId: req.user.id,
        metadata: {
          previousDefault: null, // Could fetch this from before update
        },
      });

      return reply.send({
        success: true,
        defaultPaymentMethodId: paymentMethodId,
      });
    }
  );

  /**
   * DELETE /payment-methods/:paymentMethodId
   * Remove a payment method
   */
  fastify.delete(
    '/:paymentMethodId',
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ['Payment Methods'],
        summary: 'Remove payment method',
        description: 'Detach and remove a payment method from the authenticated user',
        params: removePaymentMethodSchema.params,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { paymentMethodId } = removePaymentMethodSchema.params.parse(request.params);

      const stripeCustomerId = await ensureStripeCustomer(req.user.id, stripe);

      // Verify payment method belongs to customer
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.customer !== stripeCustomerId) {
        return reply.status(403).send({
          error: 'Payment method does not belong to this customer',
        });
      }

      // Check if it's the default - prevent deletion
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (
        (customer as Stripe.Customer).invoice_settings?.default_payment_method === paymentMethodId
      ) {
        return reply.status(400).send({
          error: 'Cannot remove default payment method. Please set another as default first.',
        });
      }

      // Check for active subscriptions using this payment method
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active',
      });

      const usingThisMethod = subscriptions.data.some(
        (sub) => sub.default_payment_method === paymentMethodId
      );

      if (usingThisMethod) {
        return reply.status(400).send({
          error: 'Cannot remove payment method that is being used by an active subscription',
        });
      }

      // Detach payment method
      await stripe.paymentMethods.detach(paymentMethodId);

      await createAuditLog({
        action: 'PAYMENT_METHOD_REMOVED',
        resourceType: 'payment_method',
        resourceId: paymentMethodId,
        userId: req.user.id,
        metadata: {
          type: paymentMethod.type,
          last4: paymentMethod.card?.last4 || paymentMethod.us_bank_account?.last4,
        },
      });

      logger.info({ userId: req.user.id, paymentMethodId }, 'Payment method removed');

      return reply.status(204).send();
    }
  );

  /**
   * POST /payment-methods/setup-intent
   * Create a SetupIntent for securely collecting payment details
   */
  fastify.post(
    '/setup-intent',
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ['Payment Methods'],
        summary: 'Create setup intent',
        description: 'Create a SetupIntent for securely collecting payment method details',
        body: setupIntentSchema.body,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { usage } = setupIntentSchema.body.parse(request.body);

      const stripeCustomerId = await ensureStripeCustomer(req.user.id, stripe);

      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        usage,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId: req.user.id,
        },
      });

      return reply.send({
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      });
    }
  );

  /**
   * GET /payment-methods/:paymentMethodId
   * Get details of a specific payment method
   */
  fastify.get(
    '/:paymentMethodId',
    {
      preValidation: [fastify.authenticate],
      schema: {
        tags: ['Payment Methods'],
        summary: 'Get payment method',
        description: 'Get details of a specific payment method',
        params: z.object({
          paymentMethodId: z.string().min(1),
        }),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { paymentMethodId } = z.object({ paymentMethodId: z.string() }).parse(request.params);

      const stripeCustomerId = await ensureStripeCustomer(req.user.id, stripe);

      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      if (paymentMethod.customer !== stripeCustomerId) {
        return reply.status(403).send({
          error: 'Payment method does not belong to this customer',
        });
      }

      const customer = await stripe.customers.retrieve(stripeCustomerId);
      const isDefault =
        (customer as Stripe.Customer).invoice_settings?.default_payment_method === paymentMethodId;

      return reply.send({
        id: paymentMethod.id,
        type: paymentMethod.type,
        isDefault,
        card: paymentMethod.card
          ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year,
              funding: paymentMethod.card.funding,
              country: paymentMethod.card.country,
            }
          : undefined,
        bankAccount: paymentMethod.us_bank_account
          ? {
              bankName: paymentMethod.us_bank_account.bank_name,
              last4: paymentMethod.us_bank_account.last4,
              accountHolderType: paymentMethod.us_bank_account.account_holder_type,
              accountType: paymentMethod.us_bank_account.account_type,
            }
          : undefined,
        billingDetails: paymentMethod.billing_details,
        createdAt: new Date(paymentMethod.created * 1000),
      });
    }
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function ensureStripeCustomer(userId: string, stripe: Stripe): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    metadata: {
      userId: user.id,
    },
  });

  // Update user with Stripe customer ID
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export default paymentMethodsRoutes;
