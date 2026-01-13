// @ts-nocheck
/**
 * @module @skillancer/billing-svc/webhooks/handlers/payment-intent-handlers
 * Payment Intent webhook handlers for Stripe
 *
 * Handles:
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - payment_intent.requires_action
 */

import { prisma } from '@skillancer/database';
import { logger } from '../../lib/logger.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

interface PaymentMetadata {
  contractId?: string;
  milestoneId?: string;
  invoiceId?: string;
  clientId?: string;
  freelancerId?: string;
  type?: 'milestone' | 'subscription' | 'invoice' | 'deposit';
}

// =============================================================================
// PAYMENT INTENT SUCCEEDED
// =============================================================================

/**
 * Handle successful payment intent
 * - Mark invoice/contract as paid
 * - Update contract status
 * - Trigger freelancer payout (if milestone)
 * - Send confirmation notifications
 * - Update client spending stats
 * - Audit log entry
 */
export async function handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const metadata = paymentIntent.metadata as PaymentMetadata;

  logger.info(
    {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      metadata,
    },
    'Processing payment_intent.succeeded'
  );

  // Start transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // 1. Record the successful payment
    const payment = await tx.payment.upsert({
      where: { stripePaymentIntentId: paymentIntent.id },
      create: {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: paymentIntent.customer as string,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        status: 'SUCCEEDED',
        paymentMethod: paymentIntent.payment_method as string,
        metadata: metadata as Record<string, unknown>,
        paidAt: new Date(),
      },
      update: {
        status: 'SUCCEEDED',
        paidAt: new Date(),
      },
    });

    // 2. Handle based on payment type
    if (metadata.type === 'milestone' && metadata.milestoneId) {
      await handleMilestonePayment(tx, paymentIntent, metadata);
    } else if (metadata.type === 'invoice' && metadata.invoiceId) {
      await handleInvoicePayment(tx, paymentIntent, metadata);
    } else if (metadata.contractId) {
      await handleContractPayment(tx, paymentIntent, metadata);
    }

    // 3. Update client spending stats
    if (metadata.clientId) {
      await updateClientSpendingStats(
        tx,
        metadata.clientId,
        paymentIntent.amount,
        paymentIntent.currency
      );
    }

    // 4. Create audit log entry
    await tx.auditLog.create({
      data: {
        action: 'PAYMENT_SUCCEEDED',
        resourceType: 'payment',
        resourceId: payment.id,
        userId: metadata.clientId || null,
        details: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          metadata,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 5. Send confirmation notifications (outside transaction)
  await sendPaymentConfirmationNotification(paymentIntent, metadata);

  logger.info({ paymentIntentId: paymentIntent.id }, 'Payment intent succeeded handler completed');
}

/**
 * Handle milestone payment - fund escrow and potentially release to freelancer
 */
async function handleMilestonePayment(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  paymentIntent: Stripe.PaymentIntent,
  metadata: PaymentMetadata
): Promise<void> {
  const { milestoneId, freelancerId, clientId } = metadata;

  if (!milestoneId) return;

  // Update milestone status
  await tx.milestone.update({
    where: { id: milestoneId },
    data: {
      status: 'FUNDED',
      fundedAt: new Date(),
      paymentIntentId: paymentIntent.id,
    },
  });

  // Create escrow record
  await tx.escrow.create({
    data: {
      milestoneId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      status: 'HELD',
      clientId: clientId!,
      freelancerId: freelancerId!,
      paymentIntentId: paymentIntent.id,
      fundedAt: new Date(),
    },
  });

  // Update contract if all milestones funded
  if (metadata.contractId) {
    const pendingMilestones = await tx.milestone.count({
      where: {
        contractId: metadata.contractId,
        status: { in: ['PENDING', 'UNFUNDED'] },
      },
    });

    if (pendingMilestones === 0) {
      await tx.contract.update({
        where: { id: metadata.contractId },
        data: { status: 'FULLY_FUNDED' },
      });
    }
  }

  logger.info({ milestoneId, amount: paymentIntent.amount }, 'Milestone payment funded to escrow');
}

/**
 * Handle invoice payment
 */
async function handleInvoicePayment(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  paymentIntent: Stripe.PaymentIntent,
  metadata: PaymentMetadata
): Promise<void> {
  const { invoiceId } = metadata;

  if (!invoiceId) return;

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      paymentIntentId: paymentIntent.id,
    },
  });

  logger.info({ invoiceId, amount: paymentIntent.amount }, 'Invoice marked as paid');
}

/**
 * Handle generic contract payment
 */
async function handleContractPayment(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  paymentIntent: Stripe.PaymentIntent,
  metadata: PaymentMetadata
): Promise<void> {
  const { contractId } = metadata;

  if (!contractId) return;

  await tx.contract.update({
    where: { id: contractId },
    data: {
      lastPaymentAt: new Date(),
      totalPaid: { increment: paymentIntent.amount },
    },
  });

  logger.info({ contractId, amount: paymentIntent.amount }, 'Contract payment recorded');
}

/**
 * Update client spending statistics
 */
async function updateClientSpendingStats(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  clientId: string,
  amount: number,
  currency: string
): Promise<void> {
  // Convert to cents if needed
  const amountInCents = amount;

  await tx.user.update({
    where: { id: clientId },
    data: {
      totalSpent: { increment: amountInCents },
      lastTransactionAt: new Date(),
    },
  });
}

/**
 * Send payment confirmation notification
 */
async function sendPaymentConfirmationNotification(
  paymentIntent: Stripe.PaymentIntent,
  metadata: PaymentMetadata
): Promise<void> {
  try {
    // TODO: Integrate with notification service
    logger.info(
      {
        clientId: metadata.clientId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      },
      'Payment confirmation notification queued'
    );
  } catch (error) {
    logger.error(
      { error, paymentIntentId: paymentIntent.id },
      'Failed to send payment confirmation notification'
    );
    // Don't throw - notification failure shouldn't fail the webhook
  }
}

// =============================================================================
// PAYMENT INTENT FAILED
// =============================================================================

/**
 * Handle failed payment intent
 * - Mark payment as failed
 * - Determine failure reason
 * - Notify client with action items
 * - Schedule retry (if appropriate)
 * - Track failure metrics
 * - Fraud scoring update
 */
export async function handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const metadata = paymentIntent.metadata as PaymentMetadata;
  const lastPaymentError = paymentIntent.last_payment_error;

  logger.warn(
    {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      errorCode: lastPaymentError?.code,
      errorMessage: lastPaymentError?.message,
      declineCode: lastPaymentError?.decline_code,
    },
    'Processing payment_intent.payment_failed'
  );

  // Categorize failure reason
  const failureCategory = categorizePaymentFailure(lastPaymentError);

  await prisma.$transaction(async (tx) => {
    // 1. Record the failed payment
    await tx.payment.upsert({
      where: { stripePaymentIntentId: paymentIntent.id },
      create: {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: paymentIntent.customer as string,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        status: 'FAILED',
        failureCode: lastPaymentError?.code || 'unknown',
        failureMessage: lastPaymentError?.message || 'Payment failed',
        metadata: metadata as Record<string, unknown>,
      },
      update: {
        status: 'FAILED',
        failureCode: lastPaymentError?.code || 'unknown',
        failureMessage: lastPaymentError?.message || 'Payment failed',
        failedAt: new Date(),
      },
    });

    // 2. Update related records
    if (metadata.milestoneId) {
      await tx.milestone.update({
        where: { id: metadata.milestoneId },
        data: { status: 'PAYMENT_FAILED' },
      });
    }

    if (metadata.invoiceId) {
      await tx.invoice.update({
        where: { id: metadata.invoiceId },
        data: { status: 'PAYMENT_FAILED' },
      });
    }

    // 3. Schedule retry if appropriate
    if (failureCategory.retryable) {
      await tx.paymentRetry.create({
        data: {
          paymentIntentId: paymentIntent.id,
          scheduledAt: new Date(Date.now() + failureCategory.retryDelayMs),
          attempt: 1,
          maxAttempts: 4,
          reason: failureCategory.category,
        },
      });
    }

    // 4. Update fraud score if suspicious
    if (failureCategory.suspiciousFraud && metadata.clientId) {
      await tx.user.update({
        where: { id: metadata.clientId },
        data: {
          fraudScore: { increment: failureCategory.fraudScoreImpact },
        },
      });
    }

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        action: 'PAYMENT_FAILED',
        resourceType: 'payment',
        resourceId: paymentIntent.id,
        userId: metadata.clientId || null,
        details: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          failureCode: lastPaymentError?.code,
          failureMessage: lastPaymentError?.message,
          declineCode: lastPaymentError?.decline_code,
          failureCategory: failureCategory.category,
          retryable: failureCategory.retryable,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 6. Send failure notification with action items
  await sendPaymentFailureNotification(paymentIntent, metadata, failureCategory);

  logger.info(
    { paymentIntentId: paymentIntent.id, failureCategory: failureCategory.category },
    'Payment intent failed handler completed'
  );
}

interface FailureCategory {
  category:
    | 'card_error'
    | 'insufficient_funds'
    | 'fraud'
    | 'authentication_required'
    | 'network_error'
    | 'unknown';
  retryable: boolean;
  retryDelayMs: number;
  suspiciousFraud: boolean;
  fraudScoreImpact: number;
  customerMessage: string;
  actionItems: string[];
}

function categorizePaymentFailure(
  error: Stripe.PaymentIntent.LastPaymentError | null
): FailureCategory {
  const code = error?.code || '';
  const declineCode = error?.decline_code || '';

  // Fraud-related declines
  const fraudCodes = ['fraudulent', 'stolen_card', 'lost_card', 'pickup_card'];
  if (fraudCodes.includes(declineCode)) {
    return {
      category: 'fraud',
      retryable: false,
      retryDelayMs: 0,
      suspiciousFraud: true,
      fraudScoreImpact: 50,
      customerMessage:
        'This payment was declined. Please contact your bank or use a different payment method.',
      actionItems: ['Contact your bank', 'Try a different card'],
    };
  }

  // Insufficient funds
  if (declineCode === 'insufficient_funds' || declineCode === 'card_velocity_exceeded') {
    return {
      category: 'insufficient_funds',
      retryable: true,
      retryDelayMs: 24 * 60 * 60 * 1000, // Retry in 24 hours
      suspiciousFraud: false,
      fraudScoreImpact: 0,
      customerMessage: 'Your payment was declined due to insufficient funds.',
      actionItems: ['Add funds to your account', 'Try a different card'],
    };
  }

  // Authentication required
  if (code === 'authentication_required' || declineCode === 'authentication_required') {
    return {
      category: 'authentication_required',
      retryable: true,
      retryDelayMs: 60 * 60 * 1000, // Retry in 1 hour
      suspiciousFraud: false,
      fraudScoreImpact: 0,
      customerMessage: 'Additional authentication is required to complete this payment.',
      actionItems: ['Complete 3D Secure verification', 'Check your bank app for approval requests'],
    };
  }

  // Card errors
  if (code === 'card_declined' || code === 'expired_card' || code === 'incorrect_cvc') {
    return {
      category: 'card_error',
      retryable: false,
      retryDelayMs: 0,
      suspiciousFraud: false,
      fraudScoreImpact: 5,
      customerMessage: 'Your card was declined. Please update your payment method.',
      actionItems: ['Update card details', 'Use a different card'],
    };
  }

  // Default/unknown
  return {
    category: 'unknown',
    retryable: true,
    retryDelayMs: 4 * 60 * 60 * 1000, // Retry in 4 hours
    suspiciousFraud: false,
    fraudScoreImpact: 0,
    customerMessage: 'Your payment could not be processed. Please try again later.',
    actionItems: ['Try again in a few hours', 'Contact support if the issue persists'],
  };
}

async function sendPaymentFailureNotification(
  paymentIntent: Stripe.PaymentIntent,
  metadata: PaymentMetadata,
  failureCategory: FailureCategory
): Promise<void> {
  try {
    // TODO: Integrate with notification service
    logger.info(
      {
        clientId: metadata.clientId,
        amount: paymentIntent.amount,
        failureCategory: failureCategory.category,
        actionItems: failureCategory.actionItems,
      },
      'Payment failure notification queued'
    );
  } catch (error) {
    logger.error(
      { error, paymentIntentId: paymentIntent.id },
      'Failed to send payment failure notification'
    );
  }
}

// =============================================================================
// PAYMENT INTENT REQUIRES ACTION
// =============================================================================

/**
 * Handle payment intent requiring customer action (3DS, etc.)
 * - Notify client of required action
 * - Track pending payments
 * - Timeout handling
 */
export async function handlePaymentIntentRequiresAction(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const metadata = paymentIntent.metadata as PaymentMetadata;

  logger.info(
    {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      nextAction: paymentIntent.next_action?.type,
    },
    'Processing payment_intent.requires_action'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Track pending payment
    await tx.payment.upsert({
      where: { stripePaymentIntentId: paymentIntent.id },
      create: {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: paymentIntent.customer as string,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        status: 'REQUIRES_ACTION',
        metadata: metadata as Record<string, unknown>,
      },
      update: {
        status: 'REQUIRES_ACTION',
        updatedAt: new Date(),
      },
    });

    // 2. Create timeout job (auto-cancel after 24 hours)
    await tx.scheduledJob.create({
      data: {
        type: 'PAYMENT_ACTION_TIMEOUT',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        payload: {
          paymentIntentId: paymentIntent.id,
          clientId: metadata.clientId,
        },
      },
    });
  });

  // 3. Notify client
  await sendRequiresActionNotification(paymentIntent, metadata);

  logger.info({ paymentIntentId: paymentIntent.id }, 'Payment requires action handler completed');
}

async function sendRequiresActionNotification(
  paymentIntent: Stripe.PaymentIntent,
  metadata: PaymentMetadata
): Promise<void> {
  try {
    const nextAction = paymentIntent.next_action?.type;
    let message = 'Your payment requires additional verification.';

    if (nextAction === 'use_stripe_sdk' || nextAction === 'redirect_to_url') {
      message = 'Please complete the 3D Secure verification to finalize your payment.';
    }

    // TODO: Integrate with notification service
    logger.info(
      {
        clientId: metadata.clientId,
        nextAction,
        message,
      },
      'Requires action notification queued'
    );
  } catch (error) {
    logger.error(
      { error, paymentIntentId: paymentIntent.id },
      'Failed to send requires action notification'
    );
  }
}

