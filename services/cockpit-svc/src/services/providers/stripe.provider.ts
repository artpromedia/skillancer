/**
 * @module @skillancer/cockpit-svc/services/providers/stripe
 * Stripe payment provider implementation
 */

import Stripe from 'stripe';

import type { Logger } from '@skillancer/logger';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  apiVersion?: string;
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  destinationAccountId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerEmail?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: {
      id: string;
      status: string;
      metadata?: Record<string, string>;
    };
  };
}

export class StripeProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    config: StripeConfig,
    private readonly logger: Logger
  ) {
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    });
    this.webhookSecret = config.webhookSecret;
    this.logger.info('[Stripe] Provider initialized');
  }

  /**
   * Create a payment intent for invoice payment
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const {
      amount,
      currency,
      destinationAccountId,
      invoiceId,
      invoiceNumber,
      customerEmail,
      description,
      metadata = {},
    } = params;

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        transfer_data: {
          destination: destinationAccountId,
        },
        description: description || `Invoice ${invoiceNumber}`,
        receipt_email: customerEmail,
        metadata: {
          invoiceId,
          invoiceNumber,
          ...metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.info(
        { paymentIntentId: paymentIntent.id, invoiceId, amount },
        'Stripe payment intent created'
      );

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        status: paymentIntent.status,
      };
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      this.logger.error(
        { invoiceId, error: stripeError.message, code: stripeError.code },
        'Stripe payment intent creation failed'
      );
      throw new Error(`Stripe error: ${stripeError.message}`);
    }
  }

  /**
   * Retrieve a payment intent by ID
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      this.logger.error(
        { paymentIntentId, error: stripeError.message },
        'Failed to retrieve payment intent'
      );
      throw new Error(`Stripe error: ${stripeError.message}`);
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
      this.logger.info({ paymentIntentId }, 'Stripe payment intent cancelled');
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      this.logger.error(
        { paymentIntentId, error: stripeError.message },
        'Failed to cancel payment intent'
      );
      throw new Error(`Stripe error: ${stripeError.message}`);
    }
  }

  /**
   * Create a refund for a payment intent
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  ): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason,
      });

      this.logger.info(
        { refundId: refund.id, paymentIntentId, amount },
        'Stripe refund created'
      );

      return refund;
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      this.logger.error(
        { paymentIntentId, error: stripeError.message },
        'Stripe refund creation failed'
      );
      throw new Error(`Stripe error: ${stripeError.message}`);
    }
  }

  /**
   * Verify and parse webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): WebhookEvent {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );

      this.logger.debug({ eventType: event.type, eventId: event.id }, 'Stripe webhook verified');

      return event as unknown as WebhookEvent;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error: message }, 'Stripe webhook signature verification failed');
      throw new Error(`Webhook signature verification failed: ${message}`);
    }
  }

  /**
   * Create a connected account for a freelancer
   */
  async createConnectedAccount(
    email: string,
    country: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        country,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata,
      });

      this.logger.info({ accountId: account.id, email }, 'Stripe connected account created');

      return account.id;
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      this.logger.error(
        { email, error: stripeError.message },
        'Stripe connected account creation failed'
      );
      throw new Error(`Stripe error: ${stripeError.message}`);
    }
  }

  /**
   * Create an account link for onboarding
   */
  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string
  ): Promise<string> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      this.logger.error(
        { accountId, error: stripeError.message },
        'Stripe account link creation failed'
      );
      throw new Error(`Stripe error: ${stripeError.message}`);
    }
  }

  /**
   * Check if a connected account is fully onboarded
   */
  async isAccountOnboarded(accountId: string): Promise<boolean> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return account.charges_enabled && account.payouts_enabled;
    } catch (error) {
      const stripeError = error as Stripe.errors.StripeError;
      this.logger.error(
        { accountId, error: stripeError.message },
        'Failed to check account status'
      );
      return false;
    }
  }
}

/**
 * Create Stripe provider instance from environment
 */
export function createStripeProvider(logger: Logger): StripeProvider | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    logger.warn('[Stripe] Missing configuration, provider not initialized');
    return null;
  }

  return new StripeProvider({ secretKey, webhookSecret }, logger);
}
