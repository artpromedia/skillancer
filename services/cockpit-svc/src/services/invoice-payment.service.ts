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
import {
  StripeProvider,
  PayPalProvider,
  createStripeProvider,
  createPayPalProvider,
} from './providers/index.js';

import type { ProcessOnlinePaymentParams, OnlinePaymentResult } from '../types/invoice.types.js';
import type { Invoice, InvoicePayment } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class InvoicePaymentService {
  private readonly invoiceRepository: InvoiceRepository;
  private readonly paymentRepository: InvoicePaymentRepository;
  private readonly settingsRepository: InvoiceSettingsRepository;
  private readonly activityRepository: InvoiceActivityRepository;
  private readonly stripeProvider: StripeProvider | null;
  private readonly paypalProvider: PayPalProvider | null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.invoiceRepository = new InvoiceRepository(prisma);
    this.paymentRepository = new InvoicePaymentRepository(prisma);
    this.settingsRepository = new InvoiceSettingsRepository(prisma);
    this.activityRepository = new InvoiceActivityRepository(prisma);
    this.stripeProvider = createStripeProvider(logger);
    this.paypalProvider = createPayPalProvider(logger);
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
    if (!this.stripeProvider) {
      throw stripeErrors.notConfigured();
    }

    const settings = await this.settingsRepository.findByUserId(invoice.freelancerUserId);

    if (!settings?.stripeAccountId) {
      throw stripeErrors.notConfigured();
    }

    try {
      // Create payment intent using Stripe provider
      const paymentIntent = await this.stripeProvider.createPaymentIntent({
        amount,
        currency: invoice.currency,
        destinationAccountId: settings.stripeAccountId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerEmail: invoice.clientEmail || undefined,
        description: `Invoice ${invoice.invoiceNumber}`,
      });

      // Save payment intent to invoice
      await this.invoiceRepository.setStripePaymentIntent(invoice.id, paymentIntent.id);

      // Create pending payment record
      await this.paymentRepository.createPending(invoice.id, amount, 'STRIPE', paymentIntent.id);

      this.logger.info(
        { invoiceId: invoice.id, amount, paymentIntentId: paymentIntent.id },
        'Stripe payment initialized'
      );

      return {
        clientSecret: paymentIntent.clientSecret,
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
    if (!this.paypalProvider) {
      throw paypalErrors.notConfigured();
    }

    const settings = await this.settingsRepository.findByUserId(invoice.freelancerUserId);

    if (!settings?.paypalEmail) {
      throw paypalErrors.notConfigured();
    }

    const baseUrl = process.env.APP_URL || 'https://skillancer.com';

    try {
      // Create order using PayPal provider
      const order = await this.paypalProvider.createOrder({
        amount,
        currency: invoice.currency,
        payeeEmail: settings.paypalEmail,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber}`,
        returnUrl: `${baseUrl}/invoices/${invoice.viewToken}/payment/success`,
        cancelUrl: `${baseUrl}/invoices/${invoice.viewToken}/payment/cancel`,
      });

      // Save order ID to invoice
      await this.invoiceRepository.setPayPalOrder(invoice.id, order.id);

      // Create pending payment record
      await this.paymentRepository.createPending(invoice.id, amount, 'PAYPAL', order.id);

      this.logger.info(
        { invoiceId: invoice.id, amount, orderId: order.id },
        'PayPal payment initialized'
      );

      return {
        approvalUrl: order.approvalUrl,
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

  /**
   * Verify and process Stripe webhook with signature validation
   */
  async processStripeWebhook(payload: string | Buffer, signature: string): Promise<void> {
    if (!this.stripeProvider) {
      throw stripeErrors.notConfigured();
    }

    // Verify signature and parse event
    const event = this.stripeProvider.verifyWebhookSignature(payload, signature);

    this.logger.info({ eventType: event.type }, 'Processing Stripe webhook');

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handleStripeWebhook(event.data.object.id, 'succeeded');
        break;
      case 'payment_intent.payment_failed':
        await this.handleStripeWebhook(event.data.object.id, 'failed');
        break;
      default:
        this.logger.debug({ eventType: event.type }, 'Unhandled Stripe webhook event');
    }
  }

  /**
   * Verify and process PayPal webhook with signature validation
   */
  async processPayPalWebhook(
    headers: Record<string, string>,
    body: string
  ): Promise<void> {
    if (!this.paypalProvider) {
      throw paypalErrors.notConfigured();
    }

    // Verify signature
    const isValid = await this.paypalProvider.verifyWebhookSignature(headers, body);

    if (!isValid) {
      throw new InvoiceError(InvoiceErrorCode.PAYMENT_PROCESSING_FAILED, 'Invalid webhook signature');
    }

    // Parse event
    const event = this.paypalProvider.parseWebhookEvent(body);

    this.logger.info({ eventType: event.eventType }, 'Processing PayPal webhook');

    switch (event.eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
        // Capture the order when approved
        if (event.resource.id) {
          const capture = await this.paypalProvider.captureOrder(event.resource.id);
          if (capture.status === 'COMPLETED') {
            await this.handlePayPalWebhook(event.resource.id, 'COMPLETED');
          }
        }
        break;
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePayPalWebhook(event.resource.id, 'COMPLETED');
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await this.handlePayPalWebhook(event.resource.id, 'DECLINED');
        break;
      default:
        this.logger.debug({ eventType: event.eventType }, 'Unhandled PayPal webhook event');
    }
  }

  /**
   * Create Stripe connected account for freelancer
   */
  async createStripeAccount(
    email: string,
    country: string,
    userId: string
  ): Promise<{ accountId: string; onboardingUrl: string }> {
    if (!this.stripeProvider) {
      throw stripeErrors.notConfigured();
    }

    const baseUrl = process.env.APP_URL || 'https://skillancer.com';
    const accountId = await this.stripeProvider.createConnectedAccount(email, country, { userId });
    const onboardingUrl = await this.stripeProvider.createAccountLink(
      accountId,
      `${baseUrl}/settings/payments/refresh`,
      `${baseUrl}/settings/payments/complete`
    );

    // Save account ID to settings
    await this.settingsRepository.updateStripeAccount(userId, accountId);

    return { accountId, onboardingUrl };
  }

  /**
   * Check if Stripe account is fully onboarded
   */
  async isStripeAccountReady(accountId: string): Promise<boolean> {
    if (!this.stripeProvider) {
      return false;
    }
    return this.stripeProvider.isAccountOnboarded(accountId);
  }
}
