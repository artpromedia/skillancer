// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/payment-orchestrator
 * Payment Orchestration Service
 *
 * Features:
 * - Payment state machine
 * - Idempotency key generation and tracking
 * - Duplicate payment prevention
 * - Payment timeout handling
 * - Multi-currency handling
 * - Comprehensive error handling
 */

import { randomUUID } from 'crypto';

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

import { getStripe } from './stripe.service.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export type PaymentState =
  | 'PENDING'
  | 'PROCESSING'
  | 'REQUIRES_ACTION'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'RETRYING'
  | 'ABANDONED';

export interface PaymentRequest {
  amount: number; // In cents
  currency: string;
  customerId: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
  captureMethod?: 'automatic' | 'manual';
  confirmImmediately?: boolean;
  returnUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  stripePaymentIntentId: string;
  status: PaymentState;
  clientSecret?: string;
  requiresAction: boolean;
  actionUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number; // Partial refund amount in cents
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  stripeRefundId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  error?: string;
}

// =============================================================================
// PAYMENT STATE MACHINE
// =============================================================================

const VALID_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  PENDING: ['PROCESSING', 'CANCELED', 'ABANDONED'],
  PROCESSING: ['SUCCEEDED', 'FAILED', 'REQUIRES_ACTION', 'CANCELED'],
  REQUIRES_ACTION: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'ABANDONED'],
  SUCCEEDED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  FAILED: ['RETRYING', 'ABANDONED'],
  CANCELED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ['REFUNDED'],
  RETRYING: ['PROCESSING', 'ABANDONED'],
  ABANDONED: [],
};

function canTransition(from: PaymentState, to: PaymentState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

// =============================================================================
// PAYMENT ORCHESTRATOR CLASS
// =============================================================================

export class PaymentOrchestrator {
  private stripe: Stripe;

  constructor() {
    this.stripe = getStripe();
  }

  /**
   * Create and optionally confirm a payment
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    const idempotencyKey = request.idempotencyKey || this.generateIdempotencyKey();

    logger.info(
      {
        amount: request.amount,
        currency: request.currency,
        customerId: request.customerId,
        idempotencyKey,
      },
      'Creating payment'
    );

    try {
      // 1. Check for duplicate payment (idempotency)
      const existingPayment = await this.findExistingPayment(idempotencyKey);
      if (existingPayment) {
        logger.info(
          { paymentId: existingPayment.id, idempotencyKey },
          'Returning existing payment (idempotency hit)'
        );
        return this.mapPaymentToResult(existingPayment);
      }

      // 2. Validate payment request
      this.validatePaymentRequest(request);

      // 3. Create payment record in PENDING state
      const payment = await prisma.payment.create({
        data: {
          idempotencyKey,
          amount: request.amount,
          currency: request.currency.toUpperCase(),
          status: 'PENDING',
          stripeCustomerId: request.customerId,
          paymentMethod: request.paymentMethodId || null,
          metadata: request.metadata as Record<string, unknown>,
          description: request.description || null,
        },
      });

      // 4. Transition to PROCESSING
      await this.transitionState(payment.id, 'PENDING', 'PROCESSING');

      // 5. Create Stripe PaymentIntent
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        customer: request.customerId,
        payment_method: request.paymentMethodId,
        description: request.description,
        metadata: {
          ...request.metadata,
          paymentId: payment.id,
          idempotencyKey,
        },
        capture_method: request.captureMethod || 'automatic',
        confirm: request.confirmImmediately !== false && !!request.paymentMethodId,
        return_url: request.returnUrl,
      };

      // Add automatic payment methods if not specifying a payment method
      if (!request.paymentMethodId) {
        paymentIntentParams.automatic_payment_methods = {
          enabled: true,
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams, {
        idempotencyKey,
      });

      // 6. Update payment record with Stripe ID
      const newStatus = this.mapStripeStatus(paymentIntent.status);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          stripePaymentIntentId: paymentIntent.id,
          status: newStatus,
          ...(newStatus === 'SUCCEEDED' ? { paidAt: new Date() } : {}),
        },
      });

      // 7. Handle different outcomes
      const result: PaymentResult = {
        success: newStatus === 'SUCCEEDED',
        paymentId: payment.id,
        stripePaymentIntentId: paymentIntent.id,
        status: newStatus,
        clientSecret: paymentIntent.client_secret || undefined,
        requiresAction: paymentIntent.status === 'requires_action',
        actionUrl: paymentIntent.next_action?.redirect_to_url?.url,
      };

      if (paymentIntent.status === 'requires_payment_method') {
        result.error = 'Payment method required';
        result.errorCode = 'payment_method_required';
      }

      logger.info(
        {
          paymentId: payment.id,
          stripePaymentIntentId: paymentIntent.id,
          status: newStatus,
        },
        'Payment created'
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stripeError = error as Stripe.StripeError;

      logger.error(
        {
          error: errorMessage,
          code: stripeError?.code,
          idempotencyKey,
        },
        'Payment creation failed'
      );

      // Try to mark as failed if we have a payment ID
      try {
        const payment = await prisma.payment.findFirst({
          where: { idempotencyKey },
        });
        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              failureCode: stripeError?.code || 'unknown',
              failureMessage: errorMessage,
              failedAt: new Date(),
            },
          });
        }
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        paymentId: '',
        stripePaymentIntentId: '',
        status: 'FAILED',
        requiresAction: false,
        error: errorMessage,
        errorCode: stripeError?.code,
      };
    }
  }

  /**
   * Confirm a payment that requires action
   */
  async confirmPayment(paymentId: string, paymentMethodId?: string): Promise<PaymentResult> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new PaymentNotFoundError(paymentId);
    }

    if (!payment.stripePaymentIntentId) {
      throw new PaymentError('Payment has no associated PaymentIntent');
    }

    logger.info(
      { paymentId, stripePaymentIntentId: payment.stripePaymentIntentId },
      'Confirming payment'
    );

    try {
      const confirmParams: Stripe.PaymentIntentConfirmParams = {};
      if (paymentMethodId) {
        confirmParams.payment_method = paymentMethodId;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        payment.stripePaymentIntentId,
        confirmParams
      );

      const newStatus = this.mapStripeStatus(paymentIntent.status);
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: newStatus,
          paymentMethod: paymentMethodId || payment.paymentMethod,
          ...(newStatus === 'SUCCEEDED' ? { paidAt: new Date() } : {}),
        },
      });

      return {
        success: newStatus === 'SUCCEEDED',
        paymentId,
        stripePaymentIntentId: paymentIntent.id,
        status: newStatus,
        requiresAction: paymentIntent.status === 'requires_action',
        actionUrl: paymentIntent.next_action?.redirect_to_url?.url,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          failureMessage: errorMessage,
          failedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(paymentId: string, reason?: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new PaymentNotFoundError(paymentId);
    }

    if (!canTransition(payment.status as PaymentState, 'CANCELED')) {
      throw new InvalidStateTransitionError(payment.status, 'CANCELED');
    }

    logger.info({ paymentId, reason }, 'Canceling payment');

    if (payment.stripePaymentIntentId) {
      await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId, {
        cancellation_reason: reason as Stripe.PaymentIntentCancelParams.CancellationReason,
      });
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancellationReason: reason,
      },
    });
  }

  /**
   * Refund a payment (full or partial)
   */
  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    const idempotencyKey = request.idempotencyKey || this.generateIdempotencyKey();

    const payment = await prisma.payment.findUnique({
      where: { id: request.paymentId },
    });

    if (!payment) {
      throw new PaymentNotFoundError(request.paymentId);
    }

    if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new PaymentError(`Cannot refund payment in ${payment.status} status`);
    }

    if (!payment.stripePaymentIntentId) {
      throw new PaymentError('Payment has no associated PaymentIntent');
    }

    const refundAmount = request.amount || payment.amount;
    const isPartialRefund = refundAmount < payment.amount;

    logger.info(
      {
        paymentId: request.paymentId,
        amount: refundAmount,
        isPartialRefund,
      },
      'Processing refund'
    );

    try {
      // Create Stripe refund
      const stripeRefund = await this.stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId,
          amount: refundAmount,
          reason: request.reason,
          metadata: request.metadata,
        },
        { idempotencyKey }
      );

      // Create refund record
      const refund = await prisma.refund.create({
        data: {
          stripeRefundId: stripeRefund.id,
          paymentId: payment.id,
          amount: refundAmount,
          currency: payment.currency,
          status: stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
          reason: request.reason || null,
          metadata: request.metadata as Record<string, unknown>,
        },
      });

      // Update payment status
      const totalRefunded = await prisma.refund.aggregate({
        where: { paymentId: payment.id, status: 'SUCCEEDED' },
        _sum: { amount: true },
      });

      const newStatus =
        totalRefunded._sum.amount === payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          refundedAmount: totalRefunded._sum.amount || refundAmount,
        },
      });

      logger.info(
        {
          refundId: refund.id,
          stripeRefundId: stripeRefund.id,
          amount: refundAmount,
          newPaymentStatus: newStatus,
        },
        'Refund processed'
      );

      return {
        success: true,
        refundId: refund.id,
        stripeRefundId: stripeRefund.id,
        amount: refundAmount,
        status: stripeRefund.status as RefundResult['status'],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage, paymentId: request.paymentId }, 'Refund failed');

      return {
        success: false,
        refundId: '',
        stripeRefundId: '',
        amount: refundAmount,
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentId: string
  ): Promise<{ status: PaymentState; details: Record<string, unknown> }> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        refunds: true,
      },
    });

    if (!payment) {
      throw new PaymentNotFoundError(paymentId);
    }

    return {
      status: payment.status as PaymentState,
      details: {
        amount: payment.amount,
        currency: payment.currency,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        paidAt: payment.paidAt,
        failureCode: payment.failureCode,
        failureMessage: payment.failureMessage,
        refunds: payment.refunds,
        refundedAmount: payment.refundedAmount,
      },
    };
  }

  /**
   * Handle payment timeout
   */
  async handlePaymentTimeout(paymentId: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return;
    }

    const timeoutableStates: PaymentState[] = ['PENDING', 'PROCESSING', 'REQUIRES_ACTION'];
    if (!timeoutableStates.includes(payment.status as PaymentState)) {
      return;
    }

    logger.info({ paymentId, currentStatus: payment.status }, 'Payment timeout - abandoning');

    // Cancel in Stripe if possible
    if (payment.stripePaymentIntentId) {
      try {
        await this.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
      } catch {
        // Ignore - may already be in terminal state
      }
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'ABANDONED',
        abandonedAt: new Date(),
        abandonedReason: 'timeout',
      },
    });
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private generateIdempotencyKey(): string {
    return `pay_${randomUUID()}`;
  }

  private async findExistingPayment(idempotencyKey: string) {
    return prisma.payment.findFirst({
      where: { idempotencyKey },
    });
  }

  private validatePaymentRequest(request: PaymentRequest): void {
    if (request.amount <= 0) {
      throw new PaymentValidationError('Amount must be positive');
    }

    if (request.amount > 99999999) {
      throw new PaymentValidationError('Amount exceeds maximum allowed');
    }

    if (!request.customerId) {
      throw new PaymentValidationError('Customer ID is required');
    }

    const supportedCurrencies = ['usd', 'eur', 'gbp', 'cad', 'aud'];
    if (!supportedCurrencies.includes(request.currency.toLowerCase())) {
      throw new PaymentValidationError(`Currency ${request.currency} is not supported`);
    }
  }

  private async transitionState(
    paymentId: string,
    from: PaymentState,
    to: PaymentState
  ): Promise<void> {
    if (!canTransition(from, to)) {
      throw new InvalidStateTransitionError(from, to);
    }

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: to },
    });

    // Log state transition for audit
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_STATE_TRANSITION',
        resourceType: 'payment',
        resourceId: paymentId,
        details: { from, to },
        ipAddress: 'system',
      },
    });
  }

  private mapStripeStatus(stripeStatus: Stripe.PaymentIntent.Status): PaymentState {
    const statusMap: Record<Stripe.PaymentIntent.Status, PaymentState> = {
      requires_payment_method: 'PENDING',
      requires_confirmation: 'PENDING',
      requires_action: 'REQUIRES_ACTION',
      processing: 'PROCESSING',
      requires_capture: 'PROCESSING',
      canceled: 'CANCELED',
      succeeded: 'SUCCEEDED',
    };

    return statusMap[stripeStatus] || 'PENDING';
  }

  private mapPaymentToResult(
    payment: Awaited<ReturnType<typeof prisma.payment.findUnique>>
  ): PaymentResult {
    return {
      success: payment!.status === 'SUCCEEDED',
      paymentId: payment!.id,
      stripePaymentIntentId: payment!.stripePaymentIntentId || '',
      status: payment!.status as PaymentState,
      requiresAction: payment!.status === 'REQUIRES_ACTION',
    };
  }
}

// =============================================================================
// ERRORS
// =============================================================================

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class PaymentNotFoundError extends PaymentError {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} not found`);
    this.name = 'PaymentNotFoundError';
  }
}

export class PaymentValidationError extends PaymentError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

export class InvalidStateTransitionError extends PaymentError {
  constructor(from: string, to: string) {
    super(`Invalid state transition from ${from} to ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let orchestrator: PaymentOrchestrator | null = null;

export function getPaymentOrchestrator(): PaymentOrchestrator {
  if (!orchestrator) {
    orchestrator = new PaymentOrchestrator();
  }
  return orchestrator;
}

export function initializePaymentOrchestrator(): PaymentOrchestrator {
  orchestrator = new PaymentOrchestrator();
  return orchestrator;
}

