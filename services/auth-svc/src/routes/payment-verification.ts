// @ts-nocheck
/**
 * @module @skillancer/auth-svc/routes/payment-verification
 * Payment Verification Routes
 *
 * Endpoints for:
 * - Creating SetupIntent for payment method verification
 * - Confirming payment method verification
 * - Getting payment verification status
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { prisma } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const logger = createLogger({ serviceName: 'payment-verification' });

// =============================================================================
// SCHEMAS
// =============================================================================

const createSetupIntentSchema = z.object({
  paymentMethodType: z.enum(['card', 'bank_account']).default('card'),
});

const confirmPaymentVerificationSchema = z.object({
  setupIntentId: z.string().min(1),
  paymentMethodId: z.string().min(1),
});

// =============================================================================
// MOCK STRIPE FUNCTIONS (replace with actual Stripe SDK in production)
// =============================================================================

async function createStripeCustomer(userId: string, email: string): Promise<string> {
  // In production, use Stripe SDK
  return `cus_mock_${userId.slice(0, 8)}`;
}

async function createStripeSetupIntent(
  customerId: string,
  paymentMethodType: string
): Promise<{ id: string; clientSecret: string; status: string }> {
  // In production, use Stripe SDK
  return {
    id: `seti_mock_${Date.now()}`,
    clientSecret: `seti_mock_${Date.now()}_secret_mock`,
    status: 'requires_payment_method',
  };
}

async function retrieveSetupIntent(
  setupIntentId: string
): Promise<{ id: string; status: string; paymentMethod: string | null }> {
  // In production, use Stripe SDK
  return {
    id: setupIntentId,
    status: 'succeeded',
    paymentMethod: `pm_mock_${Date.now()}`,
  };
}

async function getPaymentMethodDetails(paymentMethodId: string): Promise<{
  type: string;
  card?: { brand: string; last4: string; expMonth: number; expYear: number };
  usBankAccount?: { bankName: string; last4: string; accountType: string };
}> {
  // In production, use Stripe SDK
  return {
    type: 'card',
    card: {
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2025,
    },
  };
}

// =============================================================================
// ROUTES
// =============================================================================

const paymentVerificationRoutes: FastifyPluginAsync = async (fastify) => {
  // ===========================================================================
  // GET PAYMENT VERIFICATION STATUS
  // ===========================================================================

  /**
   * GET /payment-verification/status
   * Get current user's payment verification status
   */
  fastify.get(
    '/status',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          paymentVerified: true,
          paymentVerifiedAt: true,
          stripeCustomerId: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Get saved payment methods count
      const paymentMethodsCount = await prisma.paymentMethod.count({
        where: { userId, status: 'ACTIVE' },
      });

      return reply.send({
        isVerified: user.paymentVerified ?? false,
        verifiedAt: user.paymentVerifiedAt?.toISOString() ?? null,
        hasStripeCustomer: Boolean(user.stripeCustomerId),
        paymentMethodsCount,
        benefits: getPaymentVerificationBenefits(user.paymentVerified ?? false),
      });
    }
  );

  // ===========================================================================
  // CREATE SETUP INTENT
  // ===========================================================================

  /**
   * POST /payment-verification/setup-intent
   * Create a SetupIntent for adding a payment method
   */
  fastify.post(
    '/setup-intent',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = createSetupIntentSchema.parse(request.body ?? {});

      // Get or create Stripe customer
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          stripeCustomerId: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      let stripeCustomerId = user.stripeCustomerId;

      if (!stripeCustomerId) {
        stripeCustomerId = await createStripeCustomer(userId, user.email);

        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId },
        });
      }

      // Create SetupIntent
      const setupIntent = await createStripeSetupIntent(
        stripeCustomerId,
        body.paymentMethodType === 'bank_account' ? 'us_bank_account' : 'card'
      );

      // Store pending verification
      await prisma.paymentVerificationAttempt.create({
        data: {
          userId,
          setupIntentId: setupIntent.id,
          paymentMethodType: body.paymentMethodType,
          status: 'PENDING',
          createdAt: new Date(),
        },
      });

      logger.info({ userId, setupIntentId: setupIntent.id }, 'SetupIntent created');

      return reply.status(201).send({
        setupIntentId: setupIntent.id,
        clientSecret: setupIntent.clientSecret,
        paymentMethodType: body.paymentMethodType,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock',
      });
    }
  );

  // ===========================================================================
  // CONFIRM PAYMENT VERIFICATION
  // ===========================================================================

  /**
   * POST /payment-verification/confirm
   * Confirm payment method verification after successful SetupIntent
   */
  fastify.post(
    '/confirm',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const body = confirmPaymentVerificationSchema.parse(request.body);

      // Verify SetupIntent
      const setupIntent = await retrieveSetupIntent(body.setupIntentId);

      if (setupIntent.status !== 'succeeded') {
        return reply.status(400).send({
          error: 'SETUP_NOT_COMPLETE',
          message: 'Payment method setup is not complete',
          status: setupIntent.status,
        });
      }

      // Get payment method details
      const paymentMethod = await getPaymentMethodDetails(body.paymentMethodId);

      // Update verification attempt
      await prisma.paymentVerificationAttempt.updateMany({
        where: {
          userId,
          setupIntentId: body.setupIntentId,
          status: 'PENDING',
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          paymentMethodId: body.paymentMethodId,
        },
      });

      // Update user payment verification status
      await prisma.user.update({
        where: { id: userId },
        data: {
          paymentVerified: true,
          paymentVerifiedAt: new Date(),
        },
      });

      // Store payment method
      await prisma.paymentMethod.create({
        data: {
          userId,
          stripePaymentMethodId: body.paymentMethodId,
          type: paymentMethod.type.toUpperCase(),
          brand: paymentMethod.card?.brand ?? paymentMethod.usBankAccount?.bankName ?? null,
          last4: paymentMethod.card?.last4 ?? paymentMethod.usBankAccount?.last4 ?? null,
          expiryMonth: paymentMethod.card?.expMonth ?? null,
          expiryYear: paymentMethod.card?.expYear ?? null,
          isDefault: true,
          status: 'ACTIVE',
        },
      });

      logger.info(
        { userId, paymentMethodId: body.paymentMethodId },
        'Payment verification complete'
      );

      return reply.send({
        success: true,
        message: 'Payment method verified successfully',
        paymentMethod: {
          type: paymentMethod.type,
          brand: paymentMethod.card?.brand ?? paymentMethod.usBankAccount?.bankName,
          last4: paymentMethod.card?.last4 ?? paymentMethod.usBankAccount?.last4,
        },
        verifiedAt: new Date().toISOString(),
        benefits: getPaymentVerificationBenefits(true),
      });
    }
  );

  // ===========================================================================
  // GET VERIFIED PAYMENT METHODS
  // ===========================================================================

  /**
   * GET /payment-verification/methods
   * Get user's verified payment methods
   */
  fastify.get(
    '/methods',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      const paymentMethods = await prisma.paymentMethod.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          type: true,
          brand: true,
          last4: true,
          expiryMonth: true,
          expiryYear: true,
          isDefault: true,
          createdAt: true,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      return reply.send({
        paymentMethods: paymentMethods.map((pm) => ({
          id: pm.id,
          type: pm.type.toLowerCase(),
          brand: pm.brand,
          last4: pm.last4,
          expiryMonth: pm.expiryMonth,
          expiryYear: pm.expiryYear,
          isDefault: pm.isDefault,
          addedAt: pm.createdAt.toISOString(),
        })),
      });
    }
  );

  // ===========================================================================
  // REMOVE PAYMENT METHOD
  // ===========================================================================

  /**
   * DELETE /payment-verification/methods/:methodId
   * Remove a verified payment method
   */
  fastify.delete(
    '/methods/:methodId',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const { methodId } = request.params as { methodId: string };

      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: methodId,
          userId,
        },
      });

      if (!paymentMethod) {
        return reply.status(404).send({ error: 'Payment method not found' });
      }

      // Soft delete
      await prisma.paymentMethod.update({
        where: { id: methodId },
        data: { status: 'REMOVED' },
      });

      // Check if user still has active payment methods
      const remainingMethods = await prisma.paymentMethod.count({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      // If no payment methods remain, revoke payment verification
      if (remainingMethods === 0) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            paymentVerified: false,
            paymentVerifiedAt: null,
          },
        });
      }

      logger.info({ userId, methodId }, 'Payment method removed');

      return reply.send({
        success: true,
        message: 'Payment method removed',
        remainingMethods,
        paymentVerified: remainingMethods > 0,
      });
    }
  );
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getPaymentVerificationBenefits(isVerified: boolean): {
  label: string;
  available: boolean;
}[] {
  const benefits = [
    { label: 'Faster milestone payments', available: isVerified },
    { label: 'Higher withdrawal limits', available: isVerified },
    { label: 'Premium job applications', available: isVerified },
    { label: 'Trusted freelancer badge', available: isVerified },
    { label: 'Priority support', available: isVerified },
    { label: 'Instant refund processing', available: isVerified },
  ];

  return benefits;
}

export default paymentVerificationRoutes;
