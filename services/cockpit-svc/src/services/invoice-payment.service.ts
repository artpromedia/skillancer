/**
 * @module @skillancer/cockpit-svc/services/invoice-payment
 * Invoice Payment Service - Payment processing operations
 */

import {
  InvoiceError,
  InvoiceErrorCode,
  invoiceErrors,
  paymentErrors,
  stripeErrors,
  paypalErrors,
} from '../errors/invoice.errors.js';
import {
  InvoiceRepository,
  InvoicePaymentRepository,
  InvoiceSettingsRepository,
  InvoiceActivityRepository,
} from '../repositories/index.js';

import type { ProcessOnlinePaymentParams, OnlinePaymentResult } from '../types/invoice.types.js';
import type { PrismaClient, Invoice, InvoicePayment } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class InvoicePaymentService {
  private readonly invoiceRepository: InvoiceRepository;
  private readonly paymentRepository: InvoicePaymentRepository;
  private readonly settingsRepository: InvoiceSettingsRepository;
  private readonly activityRepository: InvoiceActivityRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.invoiceRepository = new InvoiceRepository(prisma);
    this.paymentRepository = new InvoicePaymentRepository(prisma);
    this.settingsRepository = new InvoiceSettingsRepository(prisma);
    this.activityRepository = new InvoiceActivityRepository(prisma);
  }

  /**
   * Initialize online payment (Stripe or PayPal)
   */
  async initializePayment(
    viewToken: string,
    params: ProcessOnlinePaymentParams
  ): Promise<OnlinePaymentResult> {
    const invoice = await this.invoiceRepository.findByViewToken(viewToken);

    if (!invoice) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_VIEW_TOKEN);
    }

    if (invoice.status === 'VOIDED') {
      throw invoiceErrors.voided(invoice.id);
    }

    if (invoice.status === 'PAID') {
      throw invoiceErrors.alreadyPaid(invoice.id);
    }

    const amount = params.amount ?? Number(invoice.amountDue);

    if (amount <= 0) {
      throw new InvoiceError(InvoiceErrorCode.INVALID_PAYMENT_AMOUNT);
    }

    if (amount > Number(invoice.amountDue)) {
      throw paymentErrors.exceedsAmountDue(Number(invoice.amountDue), amount);
    }

    if (params.paymentMethod === 'stripe') {
      return this.initializeStripePayment(invoice, amount);
    } else if (params.paymentMethod === 'paypal') {
      return this.initializePayPalPayment(invoice, amount);
    }

    throw new InvoiceError(InvoiceErrorCode.PAYMENT_PROCESSING_FAILED);
  }

  /**
   * Initialize Stripe payment intent
   */
  private async initializeStripePayment(
    invoice: Invoice,
    amount: number
  ): Promise<OnlinePaymentResult> {
    const settings = await this.settingsRepository.findByUserId(invoice.freelancerUserId);

    if (!settings?.stripeAccountId) {
      throw stripeErrors.notConfigured();
    }

    try {
      // TODO: Integrate with actual Stripe SDK
      // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      // const paymentIntent = await stripe.paymentIntents.create({
      //   amount: Math.round(amount * 100), // Convert to cents
      //   currency: invoice.currency.toLowerCase(),
      //   transfer_data: {
      //     destination: settings.stripeAccountId,
      //   },
      //   metadata: {
      //     invoiceId: invoice.id,
      //     invoiceNumber: invoice.invoiceNumber,
      //   },
      // });

      // For now, create a placeholder payment intent ID
      const paymentIntentId = `pi_placeholder_${Date.now()}`;

      // Save payment intent to invoice
      await this.invoiceRepository.setStripePaymentIntent(invoice.id, paymentIntentId);

      // Create pending payment record
      await this.paymentRepository.createPending(invoice.id, amount, 'STRIPE', paymentIntentId);

      this.logger.info(
        { invoiceId: invoice.id, amount, paymentIntentId },
        'Stripe payment initialized'
      );

      return {
        clientSecret: `${paymentIntentId}_secret`, // Placeholder
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ invoiceId: invoice.id, error: message }, 'Stripe payment failed');
      throw stripeErrors.paymentFailed(message);
    }
  }

  /**
   * Initialize PayPal order
   */
  private async initializePayPalPayment(
    invoice: Invoice,
    amount: number
  ): Promise<OnlinePaymentResult> {
    const settings = await this.settingsRepository.findByUserId(invoice.freelancerUserId);

    if (!settings?.paypalEmail) {
      throw paypalErrors.notConfigured();
    }

    try {
      // TODO: Integrate with actual PayPal SDK
      // const paypal = require('@paypal/checkout-server-sdk');
      // const request = new paypal.orders.OrdersCreateRequest();
      // request.prefer('return=representation');
      // request.requestBody({
      //   intent: 'CAPTURE',
      //   purchase_units: [{
      //     amount: {
      //       currency_code: invoice.currency,
      //       value: amount.toFixed(2),
      //     },
      //     description: `Invoice ${invoice.invoiceNumber}`,
      //     payee: {
      //       email_address: settings.paypalEmail,
      //     },
      //   }],
      // });
      // const order = await paypalClient.execute(request);

      // For now, create a placeholder order ID
      const orderId = `pp_order_${Date.now()}`;

      // Save order ID to invoice
      await this.invoiceRepository.setPayPalOrder(invoice.id, orderId);

      // Create pending payment record
      await this.paymentRepository.createPending(invoice.id, amount, 'PAYPAL', orderId);

      this.logger.info({ invoiceId: invoice.id, amount, orderId }, 'PayPal payment initialized');

      return {
        approvalUrl: `https://www.paypal.com/checkoutnow?token=${orderId}`, // Placeholder
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ invoiceId: invoice.id, error: message }, 'PayPal payment failed');
      throw paypalErrors.paymentFailed(message);
    }
  }

  /**
   * Handle Stripe webhook for payment success
   */
  async handleStripeWebhook(
    paymentIntentId: string,
    status: 'succeeded' | 'failed'
  ): Promise<void> {
    const payment = await this.paymentRepository.findByStripePaymentIntent(paymentIntentId);

    if (!payment) {
      this.logger.warn({ paymentIntentId }, 'Stripe webhook: payment not found');
      return;
    }

    if (status === 'succeeded') {
      // Mark payment as completed
      await this.paymentRepository.updateStatus(payment.id, 'COMPLETED');

      // Update invoice amounts
      const invoice = await this.invoiceRepository.findById(payment.invoiceId);
      if (invoice) {
        const totalPaid = await this.paymentRepository.getTotalPaid(payment.invoiceId);
        const amountDue = Number(invoice.total) - totalPaid;

        await this.invoiceRepository.updatePaymentAmounts(payment.invoiceId, totalPaid, amountDue);

        // Log activity
        await this.activityRepository.logPaymentReceived(
          payment.invoiceId,
          Number(payment.amount),
          'Stripe',
          true
        );

        this.logger.info(
          { invoiceId: payment.invoiceId, amount: payment.amount },
          'Stripe payment completed'
        );
      }
    } else {
      await this.paymentRepository.updateStatus(payment.id, 'FAILED');
      this.logger.warn({ invoiceId: payment.invoiceId }, 'Stripe payment failed');
    }
  }

  /**
   * Handle PayPal webhook for payment capture
   */
  async handlePayPalWebhook(orderId: string, status: 'COMPLETED' | 'DECLINED'): Promise<void> {
    const payment = await this.paymentRepository.findByPayPalTransaction(orderId);

    if (!payment) {
      this.logger.warn({ orderId }, 'PayPal webhook: payment not found');
      return;
    }

    if (status === 'COMPLETED') {
      // Mark payment as completed
      await this.paymentRepository.updateStatus(payment.id, 'COMPLETED');

      // Update invoice amounts
      const invoice = await this.invoiceRepository.findById(payment.invoiceId);
      if (invoice) {
        const totalPaid = await this.paymentRepository.getTotalPaid(payment.invoiceId);
        const amountDue = Number(invoice.total) - totalPaid;

        await this.invoiceRepository.updatePaymentAmounts(payment.invoiceId, totalPaid, amountDue);

        // Log activity
        await this.activityRepository.logPaymentReceived(
          payment.invoiceId,
          Number(payment.amount),
          'PayPal',
          true
        );

        this.logger.info(
          { invoiceId: payment.invoiceId, amount: payment.amount },
          'PayPal payment completed'
        );
      }
    } else {
      await this.paymentRepository.updateStatus(payment.id, 'FAILED');
      this.logger.warn({ invoiceId: payment.invoiceId }, 'PayPal payment failed');
    }
  }

  /**
   * Get payments for an invoice
   */
  async getInvoicePayments(invoiceId: string, userId: string): Promise<InvoicePayment[]> {
    const invoice = await this.invoiceRepository.findById(invoiceId);

    if (!invoice || invoice.freelancerUserId !== userId) {
      throw invoiceErrors.notFound(invoiceId);
    }

    return this.paymentRepository.findByInvoiceId(invoiceId);
  }
}
