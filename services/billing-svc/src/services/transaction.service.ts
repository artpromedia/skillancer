// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/services/transaction
 * Payment transaction service
 */

import { prisma } from '@skillancer/database';

import { logger } from '../lib/logger.js';
import { getStripeService } from './stripe.service.js';
import {
  TransactionNotFoundError,
  TransactionAlreadyProcessedError,
  TransactionFailedError,
  PaymentMethodNotFoundError,
} from '../errors/index.js';

import type {
  TransactionResponse,
  TransactionFilters,
  TransactionListResponse,
  TransactionStatus,
  TransactionType,
  CreatePaymentParams,
  PaymentResult,
  CapturePaymentParams,
  RefundPaymentParams,
  RefundResult,
} from '../types/index.js';
import type { PaymentTransaction, PaymentMethod } from '@skillancer/database';
import type Stripe from 'stripe';

// =============================================================================
// TRANSACTION SERVICE
// =============================================================================

export class TransactionService {
  private readonly stripeService = getStripeService();

  // ===========================================================================
  // PAYMENT PROCESSING
  // ===========================================================================

  /**
   * Process a payment
   */
  async createPayment(userId: string, params: CreatePaymentParams): Promise<PaymentResult> {
    // Get the Stripe customer ID for the user
    const stripeCustomer = await prisma.stripeCustomer.findUnique({
      where: { userId },
    });

    if (!stripeCustomer) {
      throw new Error('User does not have a Stripe customer account');
    }

    // Verify the payment method belongs to the user
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        userId,
        stripePaymentMethodId: params.paymentMethodId,
        status: 'ACTIVE',
      },
    });

    if (!paymentMethod) {
      throw new PaymentMethodNotFoundError(params.paymentMethodId);
    }

    const currency = params.currency ?? 'USD';

    // Create local transaction record first (pending state)
    const transaction = await prisma.paymentTransaction.create({
      data: {
        userId,
        paymentMethodId: paymentMethod.id,
        type: 'PAYMENT',
        status: 'PENDING',
        amount: params.amount,
        currency,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        description: params.description,
        metadata: params.metadata,
      },
    });

    try {
      // Create payment intent in Stripe
      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: params.amount,
        currency,
        customerId: stripeCustomer.stripeCustomerId,
        paymentMethodId: params.paymentMethodId,
        description: params.description,
        captureMethod: params.captureMethod ?? 'automatic',
        confirm: true,
        metadata: {
          skillancer_user_id: userId,
          skillancer_transaction_id: transaction.id,
          reference_type: params.referenceType ?? '',
          reference_id: params.referenceId ?? '',
        },
      });

      // Determine status based on payment intent
      const status = this.mapPaymentIntentStatus(paymentIntent.status);

      // Update transaction with Stripe info
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          stripePaymentIntentId: paymentIntent.id,
          stripeChargeId:
            typeof paymentIntent.latest_charge === 'string'
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge?.id,
          status,
          processedAt: status === 'SUCCEEDED' ? new Date() : undefined,
        },
      });

      return {
        transactionId: transaction.id,
        stripePaymentIntentId: paymentIntent.id,
        status,
        amount: params.amount,
        currency,
        clientSecret:
          status === 'REQUIRES_ACTION' ? (paymentIntent.client_secret ?? undefined) : undefined,
      };
    } catch (error) {
      // Handle Stripe errors
      const failureCode = (error as { code?: string }).code ?? 'unknown';
      const failureMessage = error instanceof Error ? error.message : 'Payment failed';

      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          failureCode,
          failureMessage,
        },
      });

      throw new TransactionFailedError(transaction.id, failureCode, failureMessage);
    }
  }

  /**
   * Capture a held payment (for manual capture / escrow)
   */
  async capturePayment(
    userId: string,
    transactionId: string,
    params?: CapturePaymentParams
  ): Promise<TransactionResponse> {
    const transaction = await this.getTransactionForUser(userId, transactionId);

    if (!transaction.stripePaymentIntentId) {
      throw new TransactionNotFoundError(transactionId);
    }

    if (transaction.status !== 'PROCESSING') {
      throw new TransactionAlreadyProcessedError(transactionId);
    }

    try {
      // Capture the payment intent in Stripe
      await this.stripeService.capturePaymentIntent(
        transaction.stripePaymentIntentId,
        params?.amount
      );

      const capturedAmount = params?.amount ?? Number(transaction.amount);

      const updated = await prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'SUCCEEDED',
          amount: capturedAmount,
          processedAt: new Date(),
        },
        include: { paymentMethod: true },
      });

      return this.formatTransaction(updated);
    } catch (error) {
      const failureCode = (error as { code?: string }).code ?? 'capture_failed';
      const failureMessage = error instanceof Error ? error.message : 'Capture failed';

      await prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          failureCode,
          failureMessage,
        },
      });

      throw new TransactionFailedError(transactionId, failureCode, failureMessage);
    }
  }

  /**
   * Cancel a held payment
   */
  async cancelPayment(userId: string, transactionId: string): Promise<TransactionResponse> {
    const transaction = await this.getTransactionForUser(userId, transactionId);

    if (!transaction.stripePaymentIntentId) {
      throw new TransactionNotFoundError(transactionId);
    }

    if (!['PENDING', 'PROCESSING'].includes(transaction.status)) {
      throw new TransactionAlreadyProcessedError(transactionId);
    }

    await this.stripeService.cancelPaymentIntent(transaction.stripePaymentIntentId);

    const updated = await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { status: 'CANCELLED' },
      include: { paymentMethod: true },
    });

    return this.formatTransaction(updated);
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    userId: string,
    transactionId: string,
    params?: RefundPaymentParams
  ): Promise<RefundResult> {
    const transaction = await this.getTransactionForUser(userId, transactionId);

    if (!transaction.stripePaymentIntentId) {
      throw new TransactionNotFoundError(transactionId);
    }

    if (transaction.status !== 'SUCCEEDED') {
      throw new Error('Can only refund succeeded transactions');
    }

    const refund = await this.stripeService.createRefund({
      paymentIntentId: transaction.stripePaymentIntentId,
      amount: params?.amount,
      reason: params?.reason,
      metadata: {
        skillancer_original_transaction_id: transactionId,
      },
    });

    const refundAmount = params?.amount ?? Number(transaction.amount);
    const isPartial = params?.amount !== undefined && params.amount < Number(transaction.amount);

    // Create refund transaction record
    const refundTransaction = await prisma.paymentTransaction.create({
      data: {
        userId,
        paymentMethodId: transaction.paymentMethodId,
        type: 'REFUND',
        status: 'SUCCEEDED',
        amount: refundAmount,
        currency: transaction.currency,
        referenceType: 'refund',
        referenceId: transactionId,
        description: `Refund for transaction ${transactionId}`,
        processedAt: new Date(),
        metadata: {
          originalTransactionId: transactionId,
          stripeRefundId: refund.id,
        },
      },
    });

    // Update original transaction status
    await prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: {
        status: isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
      },
    });

    return {
      refundId: refundTransaction.id,
      transactionId,
      status: 'SUCCEEDED' as TransactionStatus,
      refundedAmount: refundAmount,
    };
  }

  // ===========================================================================
  // TRANSACTION QUERIES
  // ===========================================================================

  /**
   * Get transactions for a user
   */
  async getTransactions(
    userId: string,
    filters?: TransactionFilters
  ): Promise<TransactionListResponse> {
    const where: Record<string, unknown> = { userId };

    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.referenceType) {
      where.referenceType = filters.referenceType;
    }
    if (filters?.referenceId) {
      where.referenceId = filters.referenceId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        (where.createdAt as Record<string, Date>).gte = filters.startDate;
      }
      if (filters.endDate) {
        (where.createdAt as Record<string, Date>).lte = filters.endDate;
      }
    }

    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        include: { paymentMethod: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.paymentTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => this.formatTransaction(t)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a specific transaction
   */
  async getTransaction(userId: string, transactionId: string): Promise<TransactionResponse> {
    const transaction = await this.getTransactionForUser(userId, transactionId);
    return this.formatTransaction(transaction);
  }

  /**
   * Get transaction by Stripe payment intent ID
   */
  async getTransactionByPaymentIntentId(
    stripePaymentIntentId: string
  ): Promise<TransactionResponse | null> {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { stripePaymentIntentId },
      include: { paymentMethod: true },
    });

    if (!transaction) {
      return null;
    }

    return this.formatTransaction(transaction);
  }

  // ===========================================================================
  // WEBHOOK HANDLERS
  // ===========================================================================

  /**
   * Handle payment intent succeeded webhook
   */
  async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!transaction) {
      logger.info(
        { paymentIntentId: paymentIntent.id },
        'No transaction found for payment intent, may be external'
      );
      return;
    }

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'SUCCEEDED',
        stripeChargeId:
          typeof paymentIntent.latest_charge === 'string'
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id,
        processedAt: new Date(),
      },
    });

    logger.info(
      { paymentIntentId: paymentIntent.id, transactionId: transaction.id },
      'Payment intent succeeded'
    );
  }

  /**
   * Handle payment intent failed webhook
   */
  async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!transaction) {
      return;
    }

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'FAILED',
        failureCode: paymentIntent.last_payment_error?.code ?? 'payment_failed',
        failureMessage: paymentIntent.last_payment_error?.message ?? 'Payment failed',
      },
    });

    logger.info(
      { paymentIntentId: paymentIntent.id, transactionId: transaction.id },
      'Payment intent failed'
    );
  }

  /**
   * Handle charge refunded webhook
   */
  async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    // Find transaction by charge ID or payment intent
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [
          { stripeChargeId: charge.id },
          {
            stripePaymentIntentId:
              typeof charge.payment_intent === 'string'
                ? charge.payment_intent
                : charge.payment_intent?.id,
          },
        ],
      },
    });

    if (!transaction) {
      return;
    }

    const isFullRefund = charge.amount_refunded === charge.amount;

    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    });

    logger.info(
      { chargeId: charge.id, transactionId: transaction.id, isFullRefund },
      'Charge refunded'
    );
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private async getTransactionForUser(
    userId: string,
    transactionId: string
  ): Promise<PaymentTransaction & { paymentMethod: PaymentMethod | null }> {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
      include: { paymentMethod: true },
    });

    if (!transaction) {
      throw new TransactionNotFoundError(transactionId);
    }

    return transaction;
  }

  private mapPaymentIntentStatus(status: Stripe.PaymentIntent.Status): TransactionStatus {
    switch (status) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'processing':
        return 'PROCESSING';
      case 'requires_action':
      case 'requires_confirmation':
      case 'requires_payment_method':
        return 'REQUIRES_ACTION';
      case 'canceled':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  private formatTransaction(
    transaction: PaymentTransaction & { paymentMethod?: PaymentMethod | null }
  ): TransactionResponse {
    const paymentMethod = transaction.paymentMethod;

    return {
      id: transaction.id,
      type: transaction.type as TransactionType,
      status: transaction.status as TransactionStatus,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      platformFee: transaction.platformFee ? Number(transaction.platformFee) : undefined,
      stripeFee: transaction.stripeFee ? Number(transaction.stripeFee) : undefined,
      netAmount: transaction.netAmount ? Number(transaction.netAmount) : undefined,
      description: transaction.description ?? undefined,
      referenceType: transaction.referenceType ?? undefined,
      referenceId: transaction.referenceId ?? undefined,
      paymentMethod: paymentMethod
        ? {
            id: paymentMethod.id,
            type: paymentMethod.type,
            cardBrand: paymentMethod.cardBrand ?? undefined,
            cardLast4: paymentMethod.cardLast4 ?? undefined,
            bankName: paymentMethod.bankName ?? undefined,
            bankLast4: paymentMethod.bankLast4 ?? undefined,
          }
        : undefined,
      failureCode: transaction.failureCode ?? undefined,
      failureMessage: transaction.failureMessage ?? undefined,
      processedAt: transaction.processedAt?.toISOString(),
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}

// =============================================================================
// SERVICE SINGLETON
// =============================================================================

let transactionServiceInstance: TransactionService | null = null;

export function getTransactionService(): TransactionService {
  if (!transactionServiceInstance) {
    transactionServiceInstance = new TransactionService();
  }
  return transactionServiceInstance;
}

export function resetTransactionService(): void {
  transactionServiceInstance = null;
}

export function initializeTransactionService(): TransactionService {
  return getTransactionService();
}
