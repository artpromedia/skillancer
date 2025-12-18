/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable n/no-extraneous-import */
/**
 * Stripe Webhook Routes
 *
 * Handles incoming Stripe webhook events for payments, payouts, and Connect accounts
 */

import { EscrowService } from '../services/escrow.service.js';
import { InvoiceService } from '../services/invoice.service.js';
import { PayoutService } from '../services/payout.service.js';
import { getStripeService } from '../services/stripe.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';

// ============================================================================
// Route Dependencies
// ============================================================================

interface WebhookRouteDeps {
  prisma: PrismaClient;
  logger: Logger;
  stripeWebhookSecret: string;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerStripeWebhookRoutes(
  fastify: FastifyInstance,
  deps: WebhookRouteDeps
): void {
  const { prisma, logger } = deps;

  // Initialize services
  const stripeService = getStripeService();
  const escrowService = new EscrowService(prisma);
  const invoiceService = new InvoiceService(prisma);
  const payoutService = new PayoutService(prisma);

  // ==========================================================================
  // MAIN WEBHOOK ENDPOINT
  // ==========================================================================

  // Configure Fastify to receive raw body for webhook signature verification
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  fastify.post('/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'];

    if (!sig || typeof sig !== 'string') {
      logger.warn({ msg: 'Stripe webhook missing signature' });
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripeService.constructWebhookEvent(request.body as Buffer, sig);
    } catch (err) {
      logger.error({
        msg: 'Stripe webhook signature verification failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return reply.status(400).send({ error: 'Webhook signature verification failed' });
    }

    logger.info({
      msg: 'Stripe webhook received',
      eventType: event.type,
      eventId: event.id,
    });

    try {
      // Handle different event types
      switch (event.type) {
        // ====================================================================
        // PAYMENT INTENT EVENTS (Escrow & Invoice)
        // ====================================================================
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object;
          await handlePaymentIntentSucceeded(paymentIntent);
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object;
          await handlePaymentIntentFailed(paymentIntent);
          break;
        }

        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object;
          await handlePaymentIntentCanceled(paymentIntent);
          break;
        }

        // ====================================================================
        // CHARGE EVENTS (Refunds)
        // ====================================================================
        case 'charge.refunded': {
          const charge = event.data.object;
          await handleChargeRefunded(charge);
          break;
        }

        // ====================================================================
        // TRANSFER EVENTS (Payouts to Connect accounts)
        // ====================================================================
        case 'transfer.created': {
          const transfer = event.data.object;
          await handleTransferCreated(transfer);
          break;
        }

        // Note: transfer.paid and transfer.failed are not valid Stripe events
        // Transfer status changes are handled via the related payout events

        // ====================================================================
        // PAYOUT EVENTS (Connect account to bank)
        // ====================================================================
        case 'payout.created': {
          const payout = event.data.object;
          await handlePayoutCreated(payout);
          break;
        }

        case 'payout.paid': {
          const payout = event.data.object;
          await handlePayoutPaid(payout);
          break;
        }

        case 'payout.failed': {
          const payout = event.data.object;
          await handlePayoutFailed(payout);
          break;
        }

        // ====================================================================
        // CONNECT ACCOUNT EVENTS
        // ====================================================================
        case 'account.updated': {
          const account = event.data.object;
          await handleAccountUpdated(account);
          break;
        }

        case 'account.application.deauthorized': {
          const application = event.data.object;
          await handleAccountDeauthorized(application, event);
          break;
        }

        // ====================================================================
        // DISPUTE EVENTS
        // ====================================================================
        case 'charge.dispute.created': {
          const dispute = event.data.object;
          await handleDisputeCreated(dispute);
          break;
        }

        case 'charge.dispute.closed': {
          const dispute = event.data.object;
          await handleDisputeClosed(dispute);
          break;
        }

        default:
          logger.debug({
            msg: 'Unhandled Stripe webhook event type',
            eventType: event.type,
          });
      }

      // Return 200 to acknowledge receipt
      return await reply.status(200).send({ received: true });
    } catch (error) {
      logger.error({
        msg: 'Error processing Stripe webhook',
        eventType: event.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Still return 200 to prevent retries for application errors
      // Stripe will retry on 4xx/5xx responses
      return reply.status(200).send({ received: true, error: 'Processing error logged' });
    }
  });

  // ==========================================================================
  // HANDLER FUNCTIONS
  // ==========================================================================

  async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info({
      msg: 'Payment intent succeeded',
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    });

    // Check if this is an escrow payment
    if (paymentIntent.metadata?.type === 'escrow') {
      await escrowService.handlePaymentIntentSucceeded(paymentIntent.id);
    }

    // Check if this is an invoice payment
    if (paymentIntent.metadata?.type === 'invoice') {
      const invoiceId = paymentIntent.metadata.invoiceId;
      if (invoiceId) {
        await invoiceService.handleInvoicePaid(invoiceId);
      }
    }
  }

  async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.warn({
      msg: 'Payment intent failed',
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message,
    });

    // Check if this is an escrow payment
    if (paymentIntent.metadata?.type === 'escrow') {
      await escrowService.handlePaymentIntentFailed(paymentIntent.id);
    }

    // Check if this is an invoice payment
    if (paymentIntent.metadata?.type === 'invoice') {
      const invoiceId = paymentIntent.metadata.invoiceId;
      if (invoiceId) {
        // Mark invoice payment as failed
        await prisma.contractInvoice.update({
          where: { id: invoiceId },
          data: {
            notes: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
          },
        });
      }
    }
  }

  async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    logger.info({
      msg: 'Payment intent canceled',
      paymentIntentId: paymentIntent.id,
    });

    // Handle escrow cancellation
    if (paymentIntent.metadata?.type === 'escrow') {
      const transactionId = paymentIntent.metadata.transactionId;
      if (transactionId) {
        await prisma.escrowTransactionV2.update({
          where: { id: transactionId },
          data: { status: 'CANCELLED' },
        });
      }
    }
  }

  async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    logger.info({
      msg: 'Charge refunded',
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded,
    });

    // Refund handling is typically done in the escrow service refundEscrow method
    // This webhook confirms the refund was processed by Stripe
  }

  async function handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
    logger.info({
      msg: 'Transfer created',
      transferId: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination,
    });
  }

  // Note: handleTransferPaid and handleTransferFailed removed
  // Transfer status changes are handled via the payout.paid and payout.failed events

  async function handlePayoutCreated(payout: Stripe.Payout): Promise<void> {
    logger.info({
      msg: 'Payout created',
      payoutId: payout.id,
      amount: payout.amount,
      arrivalDate: payout.arrival_date,
    });
  }

  async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    logger.info({
      msg: 'Payout paid',
      payoutId: payout.id,
      amount: payout.amount,
    });

    await payoutService.handlePayoutPaid(payout.id);
  }

  async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
    logger.error({
      msg: 'Payout failed',
      payoutId: payout.id,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message,
    });

    await payoutService.handlePayoutFailed(payout.id, payout.failure_message ?? 'Unknown failure');
  }

  async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
    logger.info({
      msg: 'Connect account updated',
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });

    await payoutService.handleAccountUpdated(account.id);
  }

  async function handleAccountDeauthorized(
    application: Stripe.Application,
    event: Stripe.Event
  ): Promise<void> {
    const accountId = (event.account as string) || '';

    logger.warn({
      msg: 'Connect account deauthorized',
      applicationId: application.id,
      accountId,
    });

    // Mark the payout account as disabled
    if (accountId) {
      await prisma.payoutAccount.updateMany({
        where: { stripeConnectAccountId: accountId },
        data: {
          status: 'DISABLED',
          payoutsEnabled: false,
          chargesEnabled: false,
        },
      });
    }
  }

  async function handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    logger.warn({
      msg: 'Charge dispute created',
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      reason: dispute.reason,
    });

    // Find the related escrow transaction and freeze funds
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
    if (chargeId) {
      const transaction = await prisma.escrowTransactionV2.findFirst({
        where: {
          stripePaymentIntentId: {
            // Payment intent is usually linked to the charge
            not: null,
          },
          status: 'COMPLETED',
        },
        include: { escrowAccount: true },
      });

      if (transaction) {
        logger.info({
          msg: 'Freezing escrow due to dispute',
          transactionId: transaction.id,
          disputeId: dispute.id,
        });

        // Create a hold transaction
        await prisma.escrowTransactionV2.create({
          data: {
            escrowAccountId: transaction.escrowAccountId,
            contractId: transaction.contractId,
            transactionType: 'HOLD',
            amount: transaction.amount,
            status: 'COMPLETED',
            metadata: {
              stripeDisputeId: dispute.id,
              reason: dispute.reason,
              originalTransactionId: transaction.id,
            },
          },
        });

        // Update account balances
        await prisma.escrowAccountV2.update({
          where: { id: transaction.escrowAccountId },
          data: {
            balance: { decrement: transaction.amount },
            disputedBalance: { increment: transaction.amount },
          },
        });
      }
    }
  }

  async function handleDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
    logger.info({
      msg: 'Charge dispute closed',
      disputeId: dispute.id,
      status: dispute.status,
    });

    // Handle based on dispute outcome
    // Status can be: 'won', 'lost', 'warning_closed', etc.
    if (dispute.status === 'lost') {
      // Funds were taken from the merchant
      logger.warn({
        msg: 'Dispute lost - funds forfeited',
        disputeId: dispute.id,
        amount: dispute.amount,
      });
    } else if (dispute.status === 'won') {
      // Funds returned to merchant - unfreeze escrow
      logger.info({
        msg: 'Dispute won - unfreezing funds',
        disputeId: dispute.id,
      });

      // Find and unfreeze the held transaction
      const holdTransaction = await prisma.escrowTransactionV2.findFirst({
        where: {
          transactionType: 'HOLD',
          status: 'COMPLETED',
          metadata: {
            path: ['stripeDisputeId'],
            equals: dispute.id,
          },
        },
        include: { escrowAccount: true },
      });

      if (holdTransaction) {
        // Create release transaction
        await prisma.escrowTransactionV2.create({
          data: {
            escrowAccountId: holdTransaction.escrowAccountId,
            contractId: holdTransaction.contractId,
            transactionType: 'RELEASE',
            amount: holdTransaction.amount,
            status: 'COMPLETED',
            metadata: {
              stripeDisputeId: dispute.id,
              reason: 'Dispute won - funds unfrozen',
              originalHoldTransactionId: holdTransaction.id,
            },
          },
        });

        // Update account balances
        await prisma.escrowAccountV2.update({
          where: { id: holdTransaction.escrowAccountId },
          data: {
            disputedBalance: { decrement: holdTransaction.amount },
            balance: { increment: holdTransaction.amount },
          },
        });
      }
    }
  }
}
