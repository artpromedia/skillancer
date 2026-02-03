/**
 * @module @skillancer/billing-svc/routes/charges.routes
 * Payment Charges Routes
 *
 * API endpoints for processing payments:
 * - Create payment charge with 3D Secure support
 * - Confirm payment requiring authentication
 * - Get payment status
 * - Refund payment
 */

import { createAuditLog } from '@skillancer/audit-client';
import { prisma } from '@skillancer/database';
import Stripe from 'stripe';
import { z } from 'zod';

import { logger } from '../lib/logger.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// SCHEMAS
// =============================================================================

const createChargeSchema = {
  body: z.object({
    amount: z.number().positive().min(0.5),
    currency: z.string().length(3).default('usd'),
    paymentMethodId: z.string().min(1),
    description: z.string().optional(),
    metadata: z.record(z.string()).optional(),
    // For contract/escrow payments
    contractId: z.string().optional(),
    milestoneId: z.string().optional(),
    // Transfer to Connect account
    transferDestination: z.string().optional(),
    applicationFeePercent: z.number().min(0).max(100).optional(),
    // Options
    captureMethod: z.enum(['automatic', 'manual']).optional().default('automatic'),
    setupFutureUsage: z.enum(['off_session', 'on_session']).optional(),
    idempotencyKey: z.string().optional(),
  }),
};

const confirmPaymentSchema = {
  params: z.object({
    paymentIntentId: z.string().min(1),
  }),
  body: z.object({
    paymentMethodId: z.string().optional(),
    returnUrl: z.string().url().optional(),
  }),
};

const getPaymentStatusSchema = {
  params: z.object({
    paymentIntentId: z.string().min(1),
  }),
};

const capturePaymentSchema = {
  params: z.object({
    paymentIntentId: z.string().min(1),
  }),
  body: z.object({
    amountToCapture: z.number().positive().optional(),
  }),
};

const refundPaymentSchema = {
  params: z.object({
    paymentIntentId: z.string().min(1),
  }),
  body: z.object({
    amount: z.number().positive().optional(),
    reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  }),
};

// =============================================================================
// TYPES
// =============================================================================

interface AuthenticatedUser {
  id: string;
  email: string;
  stripeCustomerId?: string;
}

interface ChargeResult {
  paymentIntentId: string;
  status: Stripe.PaymentIntent.Status;
  amount: number;
  currency: string;
  requiresAction: boolean;
  clientSecret?: string;
  nextAction?: {
    type: string;
    redirectToUrl?: string;
  };
  chargeId?: string;
  receiptUrl?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? '10');
const STRIPE_PROCESSING_FEE_PERCENT = 2.9;
const STRIPE_PROCESSING_FEE_FIXED = 0.3;

// =============================================================================
// ROUTES
// =============================================================================

export async function chargeRoutes(fastify: FastifyInstance): Promise<void> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
    typescript: true,
  });

  // ---------------------------------------------------------------------------
  // POST /charges - Create a payment charge
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: z.infer<typeof createChargeSchema.body>;
  }>(
    '/',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const body = createChargeSchema.body.parse(request.body);

      logger.info({ userId: user.id, amount: body.amount }, '[Charges] Creating payment charge');

      try {
        // Ensure user has a Stripe customer
        const stripeCustomerId = await ensureStripeCustomer(user.id, stripe);

        // Verify payment method belongs to customer
        const paymentMethod = await stripe.paymentMethods.retrieve(body.paymentMethodId);
        if (paymentMethod.customer !== stripeCustomerId) {
          return await reply.status(403).send({
            error: 'Payment method does not belong to this customer',
            code: 'INVALID_PAYMENT_METHOD',
          });
        }

        // Calculate fees
        const fees = calculateFees(body.amount, body.applicationFeePercent);

        // Build payment intent parameters
        const intentParams: Stripe.PaymentIntentCreateParams = {
          amount: Math.round(fees.totalCharge * 100), // Convert to cents
          currency: body.currency.toLowerCase(),
          customer: stripeCustomerId,
          payment_method: body.paymentMethodId,
          confirm: true,
          capture_method: body.captureMethod,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
          },
          return_url: `${process.env.APP_URL ?? 'http://localhost:3000'}/payments/complete`,
          description: body.description,
          metadata: {
            user_id: user.id,
            contract_id: body.contractId ?? '',
            milestone_id: body.milestoneId ?? '',
            gross_amount: body.amount.toString(),
            platform_fee: fees.platformFee.toString(),
            processing_fee: fees.processingFee.toString(),
            ...(body.metadata ?? {}),
          },
        };

        // Add transfer destination for Connect payments
        if (body.transferDestination) {
          intentParams.transfer_data = {
            destination: body.transferDestination,
          };
          // Calculate application fee (platform takes a percentage)
          const applicationFeeAmount = Math.round(fees.platformFee * 100);
          intentParams.application_fee_amount = applicationFeeAmount;
        }

        // Add setup_future_usage if specified
        if (body.setupFutureUsage) {
          intentParams.setup_future_usage = body.setupFutureUsage;
        }

        // Create request options
        const requestOptions: Stripe.RequestOptions = {};
        if (body.idempotencyKey) {
          requestOptions.idempotencyKey = body.idempotencyKey;
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create(intentParams, requestOptions);

        // Log the transaction
        await createAuditLog({
          userId: user.id,
          action: 'PAYMENT_CHARGE_CREATED',
          resourceType: 'payment',
          resourceId: paymentIntent.id,
          details: {
            amount: body.amount,
            totalCharge: fees.totalCharge,
            currency: body.currency,
            status: paymentIntent.status,
            contractId: body.contractId,
            milestoneId: body.milestoneId,
          },
        });

        // Build response
        const result = buildChargeResult(paymentIntent);

        logger.info(
          { paymentIntentId: paymentIntent.id, status: paymentIntent.status },
          '[Charges] Payment charge created'
        );

        // Return appropriate status based on payment state
        const statusCode = paymentIntent.status === 'succeeded' ? 200 : 202;
        return await reply.status(statusCode).send(result);
      } catch (error) {
        logger.error({ error, userId: user.id }, '[Charges] Failed to create charge');

        if (error instanceof Stripe.errors.StripeCardError) {
          return reply.status(402).send({
            error: error.message,
            code: error.code,
            declineCode: error.decline_code,
          });
        }

        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
          return reply.status(400).send({
            error: error.message,
            code: error.code,
          });
        }

        throw error;
      }
    }
  );

  // ---------------------------------------------------------------------------
  // POST /charges/:paymentIntentId/confirm - Confirm payment requiring action
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: z.infer<typeof confirmPaymentSchema.params>;
    Body: z.infer<typeof confirmPaymentSchema.body>;
  }>(
    '/:paymentIntentId/confirm',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const { paymentIntentId } = confirmPaymentSchema.params.parse(request.params);
      const body = confirmPaymentSchema.body.parse(request.body);

      logger.info({ userId: user.id, paymentIntentId }, '[Charges] Confirming payment');

      try {
        // Retrieve payment intent to verify ownership
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Verify this belongs to the user's customer
        const stripeCustomerId = await getStripeCustomerId(user.id);
        if (paymentIntent.customer !== stripeCustomerId) {
          return await reply.status(403).send({
            error: 'Payment intent does not belong to this customer',
            code: 'UNAUTHORIZED',
          });
        }

        // Confirm the payment intent
        const confirmParams: Stripe.PaymentIntentConfirmParams = {};
        if (body.paymentMethodId) {
          confirmParams.payment_method = body.paymentMethodId;
        }
        if (body.returnUrl) {
          confirmParams.return_url = body.returnUrl;
        }

        const confirmedIntent = await stripe.paymentIntents.confirm(paymentIntentId, confirmParams);

        // Log the confirmation
        await createAuditLog({
          userId: user.id,
          action: 'PAYMENT_CONFIRMED',
          resourceType: 'payment',
          resourceId: paymentIntentId,
          details: {
            status: confirmedIntent.status,
            amount: confirmedIntent.amount / 100,
          },
        });

        const result = buildChargeResult(confirmedIntent);

        logger.info(
          { paymentIntentId, status: confirmedIntent.status },
          '[Charges] Payment confirmed'
        );

        return await reply.send(result);
      } catch (error) {
        logger.error({ error, paymentIntentId }, '[Charges] Failed to confirm payment');

        if (error instanceof Stripe.errors.StripeCardError) {
          return reply.status(402).send({
            error: error.message,
            code: error.code,
            declineCode: error.decline_code,
          });
        }

        throw error;
      }
    }
  );

  // ---------------------------------------------------------------------------
  // GET /charges/:paymentIntentId - Get payment status
  // ---------------------------------------------------------------------------
  fastify.get<{
    Params: z.infer<typeof getPaymentStatusSchema.params>;
  }>(
    '/:paymentIntentId',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const { paymentIntentId } = getPaymentStatusSchema.params.parse(request.params);

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['latest_charge'],
        });

        // Verify this belongs to the user's customer
        const stripeCustomerId = await getStripeCustomerId(user.id);
        if (paymentIntent.customer !== stripeCustomerId) {
          return await reply.status(403).send({
            error: 'Payment intent does not belong to this customer',
            code: 'UNAUTHORIZED',
          });
        }

        const result = buildChargeResult(paymentIntent);

        return await reply.send(result);
      } catch (error) {
        logger.error({ error, paymentIntentId }, '[Charges] Failed to get payment status');

        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
          return reply.status(404).send({
            error: 'Payment not found',
            code: 'NOT_FOUND',
          });
        }

        throw error;
      }
    }
  );

  // ---------------------------------------------------------------------------
  // POST /charges/:paymentIntentId/capture - Capture authorized payment
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: z.infer<typeof capturePaymentSchema.params>;
    Body: z.infer<typeof capturePaymentSchema.body>;
  }>(
    '/:paymentIntentId/capture',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const { paymentIntentId } = capturePaymentSchema.params.parse(request.params);
      const body = capturePaymentSchema.body.parse(request.body);

      logger.info({ userId: user.id, paymentIntentId }, '[Charges] Capturing payment');

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Verify this belongs to the user's customer
        const stripeCustomerId = await getStripeCustomerId(user.id);
        if (paymentIntent.customer !== stripeCustomerId) {
          return await reply.status(403).send({
            error: 'Payment intent does not belong to this customer',
            code: 'UNAUTHORIZED',
          });
        }

        // Check if payment can be captured
        if (paymentIntent.status !== 'requires_capture') {
          return await reply.status(400).send({
            error: `Payment cannot be captured. Current status: ${paymentIntent.status}`,
            code: 'INVALID_STATUS',
          });
        }

        // Capture the payment
        const captureParams: Stripe.PaymentIntentCaptureParams = {};
        if (body.amountToCapture) {
          captureParams.amount_to_capture = Math.round(body.amountToCapture * 100);
        }

        const capturedIntent = await stripe.paymentIntents.capture(paymentIntentId, captureParams);

        // Log the capture
        await createAuditLog({
          userId: user.id,
          action: 'PAYMENT_CAPTURED',
          resourceType: 'payment',
          resourceId: paymentIntentId,
          details: {
            amount: capturedIntent.amount_received / 100,
            status: capturedIntent.status,
          },
        });

        const result = buildChargeResult(capturedIntent);

        logger.info(
          { paymentIntentId, status: capturedIntent.status },
          '[Charges] Payment captured'
        );

        return await reply.send(result);
      } catch (error) {
        logger.error({ error, paymentIntentId }, '[Charges] Failed to capture payment');
        throw error;
      }
    }
  );

  // ---------------------------------------------------------------------------
  // POST /charges/:paymentIntentId/refund - Refund payment
  // ---------------------------------------------------------------------------
  fastify.post<{
    Params: z.infer<typeof refundPaymentSchema.params>;
    Body: z.infer<typeof refundPaymentSchema.body>;
  }>(
    '/:paymentIntentId/refund',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const { paymentIntentId } = refundPaymentSchema.params.parse(request.params);
      const body = refundPaymentSchema.body.parse(request.body);

      logger.info({ userId: user.id, paymentIntentId }, '[Charges] Refunding payment');

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // Verify this belongs to the user's customer
        const stripeCustomerId = await getStripeCustomerId(user.id);
        if (paymentIntent.customer !== stripeCustomerId) {
          return await reply.status(403).send({
            error: 'Payment intent does not belong to this customer',
            code: 'UNAUTHORIZED',
          });
        }

        // Create refund
        const refundParams: Stripe.RefundCreateParams = {
          payment_intent: paymentIntentId,
        };
        if (body.amount) {
          refundParams.amount = Math.round(body.amount * 100);
        }
        if (body.reason) {
          refundParams.reason = body.reason;
        }

        const refund = await stripe.refunds.create(refundParams);

        // Log the refund
        await createAuditLog({
          userId: user.id,
          action: 'PAYMENT_REFUNDED',
          resourceType: 'payment',
          resourceId: paymentIntentId,
          details: {
            refundId: refund.id,
            amount: refund.amount / 100,
            status: refund.status,
            reason: body.reason,
          },
        });

        logger.info(
          { paymentIntentId, refundId: refund.id, status: refund.status },
          '[Charges] Payment refunded'
        );

        return await reply.send({
          refundId: refund.id,
          status: refund.status,
          amount: refund.amount / 100,
          currency: refund.currency,
        });
      } catch (error) {
        logger.error({ error, paymentIntentId }, '[Charges] Failed to refund payment');

        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
          return reply.status(400).send({
            error: error.message,
            code: error.code,
          });
        }

        throw error;
      }
    }
  );

  // ---------------------------------------------------------------------------
  // POST /charges/fee-preview - Preview fees for an amount
  // ---------------------------------------------------------------------------
  fastify.post<{
    Body: { amount: number; applicationFeePercent?: number };
  }>(
    '/fee-preview',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = z
        .object({
          amount: z.number().positive(),
          applicationFeePercent: z.number().min(0).max(100).optional(),
        })
        .parse(request.body);

      const fees = calculateFees(body.amount, body.applicationFeePercent);

      return reply.send({
        grossAmount: body.amount,
        platformFee: fees.platformFee,
        platformFeePercent: fees.platformFeePercent,
        processingFee: fees.processingFee,
        totalCharge: fees.totalCharge,
        breakdown: [
          { label: 'Amount', amount: body.amount, description: 'Base amount' },
          {
            label: `Platform Fee (${fees.platformFeePercent}%)`,
            amount: fees.platformFee,
            description: 'Skillancer service fee',
          },
          {
            label: 'Processing Fee',
            amount: fees.processingFee,
            description: 'Card processing fee',
          },
          { label: 'Total', amount: fees.totalCharge, description: 'Total amount to be charged' },
        ],
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

async function getStripeCustomerId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  return user?.stripeCustomerId ?? null;
}

function calculateFees(
  amount: number,
  applicationFeePercent?: number
): {
  platformFee: number;
  platformFeePercent: number;
  processingFee: number;
  totalCharge: number;
} {
  const platformFeePercent = applicationFeePercent ?? PLATFORM_FEE_PERCENT;
  const platformFee = roundCurrency(amount * (platformFeePercent / 100));

  const subtotal = amount + platformFee;
  const processingFee = roundCurrency(
    subtotal * (STRIPE_PROCESSING_FEE_PERCENT / 100) + STRIPE_PROCESSING_FEE_FIXED
  );

  const totalCharge = roundCurrency(subtotal + processingFee);

  return {
    platformFee,
    platformFeePercent,
    processingFee,
    totalCharge,
  };
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function buildChargeResult(paymentIntent: Stripe.PaymentIntent): ChargeResult {
  const requiresAction =
    paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_confirmation';

  const result: ChargeResult = {
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    requiresAction,
  };

  // Include client secret if action is required
  if (requiresAction && paymentIntent.client_secret) {
    result.clientSecret = paymentIntent.client_secret;
  }

  // Include next action details if available
  if (paymentIntent.next_action) {
    result.nextAction = {
      type: paymentIntent.next_action.type,
    };
    if (paymentIntent.next_action.redirect_to_url?.url) {
      result.nextAction.redirectToUrl = paymentIntent.next_action.redirect_to_url.url;
    }
  }

  // Include charge details if available
  const latestCharge = paymentIntent.latest_charge;
  if (latestCharge && typeof latestCharge === 'object') {
    result.chargeId = latestCharge.id;
    if (latestCharge.receipt_url) {
      result.receiptUrl = latestCharge.receipt_url;
    }
  }

  return result;
}
