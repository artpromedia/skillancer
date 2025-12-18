/* eslint-disable n/no-extraneous-import */
/**
 * @module @skillancer/market-svc/services/stripe
 * Stripe API integration for escrow and payment operations
 */

import { prisma } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';
import Stripe from 'stripe';

const logger = createLogger({ serviceName: 'market-stripe-service' });

// =============================================================================
// CONFIGURATION
// =============================================================================

interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  platformFeePercent: number;
  processingFeePercent: number;
  processingFeeFixed: number;
}

const getConfig = (): StripeConfig => ({
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT ?? '10'),
  processingFeePercent: parseFloat(process.env.PROCESSING_FEE_PERCENT ?? '2.9'),
  processingFeeFixed: parseFloat(process.env.PROCESSING_FEE_FIXED ?? '0.30'),
});

// =============================================================================
// TYPES
// =============================================================================

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId?: string;
  captureMethod?: 'automatic' | 'manual';
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string | undefined;
}

export interface CapturePaymentParams {
  paymentIntentId: string;
  amountToCapture?: number;
}

export interface CreateTransferParams {
  amount: number;
  currency: string;
  destinationAccountId: string;
  transferGroup?: string;
  description?: string;
  metadata?: Record<string, string>;
  sourceTransaction?: string;
}

export interface CreateRefundParams {
  paymentIntentId?: string;
  chargeId?: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface CreateConnectAccountParams {
  userId: string;
  email: string;
  type: 'express' | 'standard' | 'custom';
  country?: string;
  businessType?: 'individual' | 'company';
}

export interface CreateAccountLinkParams {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  type: 'account_onboarding' | 'account_update';
}

// =============================================================================
// STRIPE SERVICE CLASS
// =============================================================================

export class StripeService {
  private readonly stripe: Stripe;
  private readonly config: StripeConfig;

  constructor() {
    this.config = getConfig();
    this.stripe = new Stripe(this.config.secretKey, {
      apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    });
  }

  // ===========================================================================
  // CUSTOMER MANAGEMENT
  // ===========================================================================

  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string): Promise<{ stripeCustomerId: string }> {
    // Check if user already has a Stripe customer
    const existingCustomer = await prisma.stripeCustomer.findUnique({
      where: { userId },
    });

    if (existingCustomer) {
      return { stripeCustomerId: existingCustomer.stripeCustomerId };
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, displayName: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Create new Stripe customer
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.displayName ?? `${user.firstName} ${user.lastName}`,
      metadata: {
        userId,
        source: 'skillancer-market',
      },
    });

    // Store mapping in database
    await prisma.stripeCustomer.create({
      data: {
        userId,
        stripeCustomerId: customer.id,
      },
    });

    logger.info({ userId, customerId: customer.id }, 'Created Stripe customer');

    return { stripeCustomerId: customer.id };
  }

  /**
   * Get Stripe customer ID for a user
   */
  async getStripeCustomerId(userId: string): Promise<string | null> {
    const customer = await prisma.stripeCustomer.findUnique({
      where: { userId },
    });
    return customer?.stripeCustomerId ?? null;
  }

  // ===========================================================================
  // PAYMENT INTENTS (for Escrow Funding)
  // ===========================================================================

  /**
   * Create a PaymentIntent for escrow funding
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<Stripe.PaymentIntent> {
    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      capture_method: params.captureMethod ?? 'manual', // Hold funds by default
      ...(params.description && { description: params.description }),
      ...(params.metadata && { metadata: params.metadata }),
    };

    if (params.paymentMethodId) {
      intentParams.payment_method = params.paymentMethodId;
      intentParams.confirm = true;
    }

    const requestOptions: Stripe.RequestOptions = {};
    if (params.idempotencyKey) {
      requestOptions.idempotencyKey = params.idempotencyKey;
    }

    const paymentIntent = await this.stripe.paymentIntents.create(intentParams, requestOptions);

    logger.info(
      {
        paymentIntentId: paymentIntent.id,
        amount: params.amount,
        status: paymentIntent.status,
      },
      'Created payment intent'
    );

    return paymentIntent;
  }

  /**
   * Capture a previously authorized PaymentIntent
   */
  async capturePaymentIntent(params: CapturePaymentParams): Promise<Stripe.PaymentIntent> {
    const captureParams: Stripe.PaymentIntentCaptureParams = {};

    if (params.amountToCapture) {
      captureParams.amount_to_capture = Math.round(params.amountToCapture * 100);
    }

    const paymentIntent = await this.stripe.paymentIntents.capture(
      params.paymentIntentId,
      captureParams
    );

    logger.info(
      {
        paymentIntentId: paymentIntent.id,
        capturedAmount: paymentIntent.amount_received,
      },
      'Captured payment intent'
    );

    return paymentIntent;
  }

  /**
   * Cancel a PaymentIntent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);

    logger.info({ paymentIntentId }, 'Cancelled payment intent');

    return paymentIntent;
  }

  /**
   * Retrieve a PaymentIntent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  // ===========================================================================
  // TRANSFERS (for Freelancer Payouts via Connect)
  // ===========================================================================

  /**
   * Create a transfer to a Connected Account
   */
  async createTransfer(params: CreateTransferParams): Promise<Stripe.Transfer> {
    const transfer = await this.stripe.transfers.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      destination: params.destinationAccountId,
      ...(params.transferGroup && { transfer_group: params.transferGroup }),
      ...(params.description && { description: params.description }),
      ...(params.metadata && { metadata: params.metadata }),
      ...(params.sourceTransaction && { source_transaction: params.sourceTransaction }),
    });

    logger.info(
      {
        transferId: transfer.id,
        amount: params.amount,
        destination: params.destinationAccountId,
      },
      'Created transfer to Connected Account'
    );

    return transfer;
  }

  /**
   * Retrieve a transfer
   */
  async getTransfer(transferId: string): Promise<Stripe.Transfer> {
    return this.stripe.transfers.retrieve(transferId);
  }

  // ===========================================================================
  // REFUNDS
  // ===========================================================================

  /**
   * Create a refund
   */
  async createRefund(params: CreateRefundParams): Promise<Stripe.Refund> {
    const refundParams: Stripe.RefundCreateParams = {
      ...(params.reason && { reason: params.reason }),
      ...(params.metadata && { metadata: params.metadata }),
    };

    if (params.paymentIntentId) {
      refundParams.payment_intent = params.paymentIntentId;
    } else if (params.chargeId) {
      refundParams.charge = params.chargeId;
    }

    if (params.amount) {
      refundParams.amount = Math.round(params.amount * 100);
    }

    const refund = await this.stripe.refunds.create(refundParams);

    logger.info(
      {
        refundId: refund.id,
        amount: params.amount,
        status: refund.status,
      },
      'Created refund'
    );

    return refund;
  }

  // ===========================================================================
  // STRIPE CONNECT (for Freelancer Payout Accounts)
  // ===========================================================================

  /**
   * Create a Stripe Connect account
   */
  async createConnectAccount(params: CreateConnectAccountParams): Promise<Stripe.Account> {
    const account = await this.stripe.accounts.create({
      type: params.type,
      email: params.email,
      country: params.country ?? 'US',
      business_type: params.businessType ?? 'individual',
      metadata: {
        userId: params.userId,
        source: 'skillancer-market',
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    logger.info(
      {
        accountId: account.id,
        userId: params.userId,
        type: params.type,
      },
      'Created Stripe Connect account'
    );

    return account;
  }

  /**
   * Create an account link for onboarding
   */
  async createAccountLink(params: CreateAccountLinkParams): Promise<Stripe.AccountLink> {
    const accountLink = await this.stripe.accountLinks.create({
      account: params.accountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: params.type,
    });

    return accountLink;
  }

  /**
   * Retrieve a Connect account
   */
  async getConnectAccount(accountId: string): Promise<Stripe.Account> {
    return this.stripe.accounts.retrieve(accountId);
  }

  /**
   * Create a login link for Express dashboard
   */
  async createLoginLink(accountId: string): Promise<Stripe.LoginLink> {
    return this.stripe.accounts.createLoginLink(accountId);
  }

  /**
   * Update a Connect account
   */
  async updateConnectAccount(
    accountId: string,
    updates: Stripe.AccountUpdateParams
  ): Promise<Stripe.Account> {
    return this.stripe.accounts.update(accountId, updates);
  }

  // ===========================================================================
  // PAYOUTS (from Connect Account to Bank)
  // ===========================================================================

  /**
   * Create a payout from a Connected Account to their bank
   */
  async createPayout(
    accountId: string,
    amount: number,
    currency: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Payout> {
    const payout = await this.stripe.payouts.create(
      {
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        ...(metadata && { metadata }),
      },
      {
        stripeAccount: accountId,
      }
    );

    logger.info(
      {
        payoutId: payout.id,
        accountId,
        amount,
      },
      'Created payout to bank account'
    );

    return payout;
  }

  // ===========================================================================
  // BALANCE
  // ===========================================================================

  /**
   * Get balance for a Connect account
   */
  async getConnectAccountBalance(accountId: string): Promise<Stripe.Balance> {
    return this.stripe.balance.retrieve({
      stripeAccount: accountId,
    });
  }

  // ===========================================================================
  // FEE CALCULATION
  // ===========================================================================

  /**
   * Calculate platform and processing fees
   */
  calculateFees(amount: number): {
    grossAmount: number;
    platformFee: number;
    processingFee: number;
    netAmount: number;
    totalCharge: number;
  } {
    const platformFee = amount * (this.config.platformFeePercent / 100);
    const processingFee =
      amount * (this.config.processingFeePercent / 100) + this.config.processingFeeFixed;

    const netAmount = amount - platformFee;
    const totalCharge = amount + processingFee;

    return {
      grossAmount: amount,
      platformFee: Math.round(platformFee * 100) / 100,
      processingFee: Math.round(processingFee * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      totalCharge: Math.round(totalCharge * 100) / 100,
    };
  }

  // ===========================================================================
  // WEBHOOKS
  // ===========================================================================

  /**
   * Verify and construct webhook event
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.config.webhookSecret);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let stripeServiceInstance: StripeService | null = null;

export function getStripeService(): StripeService {
  if (!stripeServiceInstance) {
    stripeServiceInstance = new StripeService();
  }
  return stripeServiceInstance;
}

export function resetStripeService(): void {
  stripeServiceInstance = null;
}
