// @ts-nocheck
/**
 * Stripe Webhooks Handler
 * Process financial events from Stripe (Treasury, Issuing, etc.)
 * Sprint M5: Freelancer Financial Services
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { Router, type Request, type Response, raw } from 'express';
import Stripe from 'stripe';

import { getTransactionProcessor } from '../cards/transaction-processor.js';
import { getFinancialNotificationsService } from '../notifications/financial-notifications';
import { getTaxVaultService } from '../tax/tax-vault-service.js';
import { getInstantPayoutService } from '../treasury/instant-payout.js';
import { getTreasuryService } from '../treasury/treasury-service.js';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const treasuryService = getTreasuryService();
const payoutService = getInstantPayoutService();
const transactionProcessor = getTransactionProcessor();
const taxVaultService = getTaxVaultService();
const notificationService = getFinancialNotificationsService();

// Webhook signing secrets
const TREASURY_WEBHOOK_SECRET = process.env.STRIPE_TREASURY_WEBHOOK_SECRET!;
const ISSUING_WEBHOOK_SECRET = process.env.STRIPE_ISSUING_WEBHOOK_SECRET!;

// ============================================================================
// TREASURY WEBHOOKS
// ============================================================================

/**
 * POST /webhooks/stripe/treasury
 * Handle Treasury-related events
 */
router.post('/treasury', raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, TREASURY_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.error('Treasury webhook signature verification failed', { error: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  logger.info('Treasury webhook received', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      // =====================================================================
      // FINANCIAL ACCOUNT EVENTS
      // =====================================================================
      case 'treasury.financial_account.features_status_updated': {
        const account = event.data.object as Stripe.Treasury.FinancialAccount;
        await handleFinancialAccountStatusUpdate(account);
        break;
      }

      // =====================================================================
      // INBOUND TRANSFER EVENTS (Money coming in)
      // =====================================================================
      case 'treasury.inbound_transfer.created': {
        const transfer = event.data.object as Stripe.Treasury.InboundTransfer;
        await handleInboundTransferCreated(transfer);
        break;
      }

      case 'treasury.inbound_transfer.succeeded': {
        const transfer = event.data.object as Stripe.Treasury.InboundTransfer;
        await handleInboundTransferSucceeded(transfer);
        break;
      }

      case 'treasury.inbound_transfer.failed': {
        const transfer = event.data.object as Stripe.Treasury.InboundTransfer;
        await handleInboundTransferFailed(transfer);
        break;
      }

      // =====================================================================
      // OUTBOUND TRANSFER EVENTS (Payouts)
      // =====================================================================
      case 'treasury.outbound_transfer.created': {
        const transfer = event.data.object as Stripe.Treasury.OutboundTransfer;
        await handleOutboundTransferCreated(transfer);
        break;
      }

      case 'treasury.outbound_transfer.posted': {
        const transfer = event.data.object as Stripe.Treasury.OutboundTransfer;
        await handleOutboundTransferPosted(transfer);
        break;
      }

      case 'treasury.outbound_transfer.failed': {
        const transfer = event.data.object as Stripe.Treasury.OutboundTransfer;
        await handleOutboundTransferFailed(transfer);
        break;
      }

      case 'treasury.outbound_transfer.canceled': {
        const transfer = event.data.object as Stripe.Treasury.OutboundTransfer;
        await handleOutboundTransferCanceled(transfer);
        break;
      }

      // =====================================================================
      // OUTBOUND PAYMENT EVENTS (Instant payouts)
      // =====================================================================
      case 'treasury.outbound_payment.posted': {
        const payment = event.data.object as Stripe.Treasury.OutboundPayment;
        await handleOutboundPaymentPosted(payment);
        break;
      }

      case 'treasury.outbound_payment.failed': {
        const payment = event.data.object as Stripe.Treasury.OutboundPayment;
        await handleOutboundPaymentFailed(payment);
        break;
      }

      case 'treasury.outbound_payment.canceled': {
        const payment = event.data.object as Stripe.Treasury.OutboundPayment;
        await handleOutboundPaymentCanceled(payment);
        break;
      }

      // =====================================================================
      // RECEIVED CREDIT EVENTS (ACH/Wire deposits)
      // =====================================================================
      case 'treasury.received_credit.created': {
        const credit = event.data.object as Stripe.Treasury.ReceivedCredit;
        await handleReceivedCredit(credit);
        break;
      }

      case 'treasury.received_credit.succeeded': {
        const credit = event.data.object as Stripe.Treasury.ReceivedCredit;
        await handleReceivedCreditSucceeded(credit);
        break;
      }

      // =====================================================================
      // RECEIVED DEBIT EVENTS
      // =====================================================================
      case 'treasury.received_debit.created': {
        const debit = event.data.object as Stripe.Treasury.ReceivedDebit;
        await handleReceivedDebit(debit);
        break;
      }

      default:
        logger.debug('Unhandled Treasury event type', { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing Treasury webhook', { type: event.type, error });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// ISSUING WEBHOOKS
// ============================================================================

/**
 * POST /webhooks/stripe/issuing
 * Handle Issuing (card) related events
 */
router.post('/issuing', raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, ISSUING_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.error('Issuing webhook signature verification failed', { error: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  logger.info('Issuing webhook received', { type: event.type, id: event.id });

  try {
    switch (event.type) {
      // =====================================================================
      // AUTHORIZATION EVENTS
      // =====================================================================
      case 'issuing_authorization.request': {
        // Real-time authorization decision
        const authorization = event.data.object as Stripe.Issuing.Authorization;
        const response = await handleAuthorizationRequest(authorization);
        res.json(response);
        return;
      }

      case 'issuing_authorization.created': {
        const authorization = event.data.object as Stripe.Issuing.Authorization;
        await handleAuthorizationCreated(authorization);
        break;
      }

      case 'issuing_authorization.updated': {
        const authorization = event.data.object as Stripe.Issuing.Authorization;
        await handleAuthorizationUpdated(authorization);
        break;
      }

      // =====================================================================
      // TRANSACTION EVENTS
      // =====================================================================
      case 'issuing_transaction.created': {
        const transaction = event.data.object as Stripe.Issuing.Transaction;
        await handleIssuingTransactionCreated(transaction);
        break;
      }

      case 'issuing_transaction.updated': {
        const transaction = event.data.object as Stripe.Issuing.Transaction;
        await handleIssuingTransactionUpdated(transaction);
        break;
      }

      // =====================================================================
      // CARD EVENTS
      // =====================================================================
      case 'issuing_card.created': {
        const card = event.data.object as Stripe.Issuing.Card;
        await handleCardCreated(card);
        break;
      }

      case 'issuing_card.updated': {
        const card = event.data.object as Stripe.Issuing.Card;
        await handleCardUpdated(card);
        break;
      }

      case 'issuing_card.shipped': {
        const card = event.data.object as Stripe.Issuing.Card;
        await handleCardShipped(card);
        break;
      }

      // =====================================================================
      // DISPUTE EVENTS
      // =====================================================================
      case 'issuing_dispute.created': {
        const dispute = event.data.object as Stripe.Issuing.Dispute;
        await handleDisputeCreated(dispute);
        break;
      }

      case 'issuing_dispute.updated': {
        const dispute = event.data.object as Stripe.Issuing.Dispute;
        await handleDisputeUpdated(dispute);
        break;
      }

      default:
        logger.debug('Unhandled Issuing event type', { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing Issuing webhook', { type: event.type, error });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// TREASURY EVENT HANDLERS
// ============================================================================

async function handleFinancialAccountStatusUpdate(
  account: Stripe.Treasury.FinancialAccount
): Promise<void> {
  await prisma.treasuryAccount.updateMany({
    where: { stripeFinancialAccountId: account.id },
    data: {
      status: account.status,
      features: account.features as any,
      updatedAt: new Date(),
    },
  });

  logger.info('Financial account status updated', {
    accountId: account.id,
    status: account.status,
  });
}

async function handleInboundTransferCreated(
  transfer: Stripe.Treasury.InboundTransfer
): Promise<void> {
  const account = await prisma.treasuryAccount.findFirst({
    where: { stripeFinancialAccountId: transfer.financial_account },
  });

  if (!account) return;

  await prisma.treasuryTransaction.create({
    data: {
      userId: account.userId,
      stripeTransactionId: transfer.id,
      type: 'inbound',
      amount: transfer.amount,
      currency: transfer.currency,
      status: 'pending',
      description: 'Incoming transfer',
    },
  });
}

async function handleInboundTransferSucceeded(
  transfer: Stripe.Treasury.InboundTransfer
): Promise<void> {
  const account = await prisma.treasuryAccount.findFirst({
    where: { stripeFinancialAccountId: transfer.financial_account },
  });

  if (!account) return;

  await prisma.treasuryTransaction.updateMany({
    where: { stripeTransactionId: transfer.id },
    data: { status: 'completed', completedAt: new Date() },
  });

  // Process auto-save for taxes
  const amountDollars = transfer.amount / 100;
  await taxVaultService.processAutoSave(
    account.userId,
    amountDollars,
    transfer.id,
    'Incoming transfer'
  );

  // Send notification
  await notificationService.notifyDeposit(account.userId, amountDollars);

  logger.info('Inbound transfer succeeded', {
    userId: account.userId,
    amount: amountDollars,
  });
}

async function handleInboundTransferFailed(
  transfer: Stripe.Treasury.InboundTransfer
): Promise<void> {
  await prisma.treasuryTransaction.updateMany({
    where: { stripeTransactionId: transfer.id },
    data: { status: 'failed' },
  });

  logger.warn('Inbound transfer failed', { transferId: transfer.id });
}

async function handleOutboundTransferCreated(
  transfer: Stripe.Treasury.OutboundTransfer
): Promise<void> {
  logger.info('Outbound transfer created', { transferId: transfer.id });
}

async function handleOutboundTransferPosted(
  transfer: Stripe.Treasury.OutboundTransfer
): Promise<void> {
  await payoutService.handlePayoutStatusUpdate(transfer.id, 'posted');
  logger.info('Outbound transfer posted', { transferId: transfer.id });
}

async function handleOutboundTransferFailed(
  transfer: Stripe.Treasury.OutboundTransfer
): Promise<void> {
  await payoutService.handlePayoutStatusUpdate(transfer.id, 'failed');

  const payout = await prisma.payout.findFirst({
    where: { stripePayoutId: transfer.id },
  });

  if (payout) {
    await notificationService.notifyPayoutFailed(
      payout.userId,
      payout.amount.toNumber(),
      'Transfer failed'
    );
  }

  logger.warn('Outbound transfer failed', { transferId: transfer.id });
}

async function handleOutboundTransferCanceled(
  transfer: Stripe.Treasury.OutboundTransfer
): Promise<void> {
  await payoutService.handlePayoutStatusUpdate(transfer.id, 'canceled');
  logger.info('Outbound transfer canceled', { transferId: transfer.id });
}

async function handleOutboundPaymentPosted(
  payment: Stripe.Treasury.OutboundPayment
): Promise<void> {
  await payoutService.handlePayoutStatusUpdate(payment.id, 'posted');

  const payout = await prisma.payout.findFirst({
    where: { stripePayoutId: payment.id },
  });

  if (payout) {
    await notificationService.notifyPayoutComplete(
      payout.userId,
      payout.netAmount.toNumber(),
      payout.destination
    );
  }

  logger.info('Outbound payment posted', { paymentId: payment.id });
}

async function handleOutboundPaymentFailed(
  payment: Stripe.Treasury.OutboundPayment
): Promise<void> {
  await payoutService.handlePayoutStatusUpdate(payment.id, 'failed');

  const payout = await prisma.payout.findFirst({
    where: { stripePayoutId: payment.id },
  });

  if (payout) {
    await notificationService.notifyPayoutFailed(
      payout.userId,
      payout.amount.toNumber(),
      'Payment failed'
    );
  }

  logger.warn('Outbound payment failed', { paymentId: payment.id });
}

async function handleOutboundPaymentCanceled(
  payment: Stripe.Treasury.OutboundPayment
): Promise<void> {
  await payoutService.handlePayoutStatusUpdate(payment.id, 'canceled');
  logger.info('Outbound payment canceled', { paymentId: payment.id });
}

async function handleReceivedCredit(credit: Stripe.Treasury.ReceivedCredit): Promise<void> {
  const account = await prisma.treasuryAccount.findFirst({
    where: { stripeFinancialAccountId: credit.financial_account },
  });

  if (!account) return;

  await prisma.treasuryTransaction.create({
    data: {
      userId: account.userId,
      stripeTransactionId: credit.id,
      type: 'inbound',
      amount: credit.amount,
      currency: credit.currency,
      status: 'pending',
      description: `Received credit via ${credit.network}`,
    },
  });

  logger.info('Received credit created', { creditId: credit.id });
}

async function handleReceivedCreditSucceeded(
  credit: Stripe.Treasury.ReceivedCredit
): Promise<void> {
  const account = await prisma.treasuryAccount.findFirst({
    where: { stripeFinancialAccountId: credit.financial_account },
  });

  if (!account) return;

  await prisma.treasuryTransaction.updateMany({
    where: { stripeTransactionId: credit.id },
    data: { status: 'completed', completedAt: new Date() },
  });

  // Process auto-save
  const amountDollars = credit.amount / 100;
  await taxVaultService.processAutoSave(
    account.userId,
    amountDollars,
    credit.id,
    `Credit via ${credit.network}`
  );

  await notificationService.notifyDeposit(account.userId, amountDollars);

  logger.info('Received credit succeeded', {
    userId: account.userId,
    amount: amountDollars,
  });
}

async function handleReceivedDebit(debit: Stripe.Treasury.ReceivedDebit): Promise<void> {
  logger.info('Received debit', { debitId: debit.id });
}

// ============================================================================
// ISSUING EVENT HANDLERS
// ============================================================================

async function handleAuthorizationRequest(
  authorization: Stripe.Issuing.Authorization
): Promise<{ approved: boolean; amount?: number }> {
  const card = await prisma.issuedCard.findFirst({
    where: { stripeCardId: authorization.card.id },
  });

  if (!card) {
    logger.warn('Authorization for unknown card', { cardId: authorization.card.id });
    return { approved: false };
  }

  const decision = await transactionProcessor.processAuthorization({
    stripeAuthorizationId: authorization.id,
    cardId: authorization.card.id,
    amount: authorization.pending_request?.amount || authorization.amount,
    currency: authorization.currency,
    merchant: {
      name: authorization.merchant_data.name || 'Unknown',
      category: authorization.merchant_data.category || 'Unknown',
      categoryCode: authorization.merchant_data.category_code || '0000',
      city: authorization.merchant_data.city || undefined,
      country: authorization.merchant_data.country || undefined,
    },
  });

  return { approved: decision.approved };
}

async function handleAuthorizationCreated(
  authorization: Stripe.Issuing.Authorization
): Promise<void> {
  logger.info('Authorization created', {
    authorizationId: authorization.id,
    approved: authorization.approved,
  });
}

async function handleAuthorizationUpdated(
  authorization: Stripe.Issuing.Authorization
): Promise<void> {
  if (authorization.status === 'reversed') {
    // Authorization was reversed (merchant voided)
    await prisma.cardTransaction.updateMany({
      where: { stripeAuthorizationId: authorization.id },
      data: { status: 'reversed' },
    });
  }
}

async function handleIssuingTransactionCreated(
  transaction: Stripe.Issuing.Transaction
): Promise<void> {
  await transactionProcessor.handleTransactionCaptured(transaction.id);
}

async function handleIssuingTransactionUpdated(
  transaction: Stripe.Issuing.Transaction
): Promise<void> {
  if (transaction.type === 'refund') {
    await transactionProcessor.handleRefund(
      transaction.id,
      (transaction.purchase_details as any)?.reference || ''
    );
  }
}

async function handleCardCreated(card: Stripe.Issuing.Card): Promise<void> {
  logger.info('Card created', { cardId: card.id, type: card.type });
}

async function handleCardUpdated(card: Stripe.Issuing.Card): Promise<void> {
  await prisma.issuedCard.updateMany({
    where: { stripeCardId: card.id },
    data: { status: card.status, updatedAt: new Date() },
  });
}

async function handleCardShipped(card: Stripe.Issuing.Card): Promise<void> {
  const dbCard = await prisma.issuedCard.findFirst({
    where: { stripeCardId: card.id },
  });

  if (dbCard) {
    await prisma.issuedCard.update({
      where: { id: dbCard.id },
      data: {
        shippingStatus: 'shipped',
        shippingCarrier: card.shipping?.carrier,
        shippingTrackingNumber: card.shipping?.tracking_number,
      },
    });

    await notificationService.notifyCardShipped(
      dbCard.userId,
      dbCard.id,
      card.shipping?.tracking_number
    );
  }

  logger.info('Card shipped', {
    cardId: card.id,
    tracking: card.shipping?.tracking_number,
  });
}

async function handleDisputeCreated(dispute: Stripe.Issuing.Dispute): Promise<void> {
  logger.info('Dispute created', { disputeId: dispute.id });
}

async function handleDisputeUpdated(dispute: Stripe.Issuing.Dispute): Promise<void> {
  logger.info('Dispute updated', { disputeId: dispute.id, status: dispute.status });
}

export default router;

