/**
 * @module @skillancer/billing-svc/services/stripe
 * Stripe API integration service
 */

import Stripe from 'stripe';
import { prisma } from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { StripeError, StripeWebhookError, StripeCustomerNotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateCustomerData {
  email: string;
  name?: string | undefined;
  metadata?: Record<string, string> | undefined;
}

export interface SetupIntentOptions {
  paymentMethodTypes?: string[];
  metadata?: Record<string, string> | undefined;
}

// =============================================================================
// STRIPE SERVICE
// =============================================================================

/**
 * Service for Stripe API operations
 *
 * Handles:
 * - Customer management
 * - Setup intents for payment method collection
 * - Payment method attachment/detachment
 * - Webhook signature verification
 */
export class StripeService {
  private readonly stripe: Stripe;
  private readonly config = getConfig();

  constructor() {
    this.stripe = new Stripe(this.config.stripe.secretKey, {
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
  async getOrCreateCustomer(
    userId: string,
    email: string,
    name?: string
  ): Promise<Stripe.Customer> {
    // Check if user already has a Stripe customer
    const existingCustomer = await prisma.stripeCustomer.findUnique({
      where: { userId },
    });

    if (existingCustomer) {
      return this.getCustomer(existingCustomer.stripeCustomerId);
    }

    // Create new Stripe customer
    const customer = await this.createCustomer({
      email,
      name: name ?? undefined,
      metadata: {
        userId,
        source: 'skillancer',
      },
    });

    // Store mapping in database
    await prisma.stripeCustomer.create({
      data: {
        userId,
        stripeCustomerId: customer.id,
      },
    });

    return customer;
  }

  /**
   * Create a new Stripe customer
   */
  async createCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    try {
      const params: Stripe.CustomerCreateParams = {
        email: data.email,
      };
      if (data.name) params.name = data.name;
      if (data.metadata) params.metadata = data.metadata;
      return await this.stripe.customers.create(params);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Get a Stripe customer by ID
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);

      if (customer.deleted) {
        throw new StripeCustomerNotFoundError(customerId);
      }

      return customer as Stripe.Customer;
    } catch (error) {
      if ((error as Stripe.StripeRawError)?.code === 'resource_missing') {
        throw new StripeCustomerNotFoundError(customerId);
      }
      throw this.handleStripeError(error);
    }
  }

  /**
   * Update a Stripe customer
   */
  async updateCustomer(
    customerId: string,
    data: Stripe.CustomerUpdateParams
  ): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.update(customerId, data);
    } catch (error) {
      throw this.handleStripeError(error);
    }
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

  /**
   * Get user ID by Stripe customer ID
   */
  async getUserIdByStripeCustomerId(stripeCustomerId: string): Promise<string | null> {
    const customer = await prisma.stripeCustomer.findUnique({
      where: { stripeCustomerId },
    });
    return customer?.userId ?? null;
  }

  // ===========================================================================
  // SETUP INTENTS
  // ===========================================================================

  /**
   * Create a SetupIntent for collecting payment method details
   */
  async createSetupIntent(
    customerId: string,
    options?: SetupIntentOptions
  ): Promise<Stripe.SetupIntent> {
    try {
      const params: Stripe.SetupIntentCreateParams = {
        customer: customerId,
        payment_method_types: options?.paymentMethodTypes ?? ['card'],
        usage: 'off_session',
      };
      if (options?.metadata) params.metadata = options.metadata;
      return await this.stripe.setupIntents.create(params);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Create a SetupIntent for ACH bank account
   */
  async createAchSetupIntent(
    customerId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.SetupIntent> {
    try {
      const params: Stripe.SetupIntentCreateParams = {
        customer: customerId,
        payment_method_types: ['us_bank_account'],
        payment_method_options: {
          us_bank_account: {
            financial_connections: {
              permissions: ['payment_method', 'balances'],
            },
            verification_method: 'automatic',
          },
        },
        usage: 'off_session',
      };
      if (metadata) params.metadata = metadata;
      return await this.stripe.setupIntents.create(params);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Create a SetupIntent for SEPA debit
   */
  async createSepaSetupIntent(
    customerId: string,
    mandateData: {
      ipAddress: string;
      userAgent: string;
    },
    metadata?: Record<string, string>
  ): Promise<Stripe.SetupIntent> {
    try {
      const params: Stripe.SetupIntentCreateParams = {
        customer: customerId,
        payment_method_types: ['sepa_debit'],
        mandate_data: {
          customer_acceptance: {
            type: 'online',
            online: {
              ip_address: mandateData.ipAddress,
              user_agent: mandateData.userAgent,
            },
          },
        },
        usage: 'off_session',
      };
      if (metadata) params.metadata = metadata;
      return await this.stripe.setupIntents.create(params);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Retrieve a SetupIntent
   */
  async getSetupIntent(setupIntentId: string): Promise<Stripe.SetupIntent> {
    try {
      return await this.stripe.setupIntents.retrieve(setupIntentId);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Confirm a SetupIntent
   */
  async confirmSetupIntent(
    setupIntentId: string,
    paymentMethodId: string
  ): Promise<Stripe.SetupIntent> {
    try {
      return await this.stripe.setupIntents.confirm(setupIntentId, {
        payment_method: paymentMethodId,
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  // ===========================================================================
  // PAYMENT METHOD MANAGEMENT
  // ===========================================================================

  /**
   * Attach a payment method to a customer
   */
  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      return await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Detach a payment method from a customer
   */
  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      return await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Get a payment method by ID
   */
  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      return await this.stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(
    customerId: string,
    type?: Stripe.PaymentMethodListParams.Type
  ): Promise<Stripe.PaymentMethod[]> {
    try {
      const methods: Stripe.PaymentMethod[] = [];

      // If no specific type, fetch all supported types
      const types: Stripe.PaymentMethodListParams.Type[] = type
        ? [type]
        : ['card', 'us_bank_account', 'sepa_debit'];

      for (const paymentType of types) {
        const response = await this.stripe.paymentMethods.list({
          customer: customerId,
          type: paymentType,
          limit: 100,
        });
        methods.push(...response.data);
      }

      return methods;
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Set the default payment method for a customer
   */
  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Get the default payment method for a customer
   */
  async getDefaultPaymentMethod(customerId: string): Promise<string | null> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        return null;
      }
      const defaultMethod = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
      return typeof defaultMethod === 'string' ? defaultMethod : (defaultMethod?.id ?? null);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  // ===========================================================================
  // SUBSCRIPTIONS
  // ===========================================================================

  /**
   * Create a subscription
   */
  async createSubscription(params: Stripe.SubscriptionCreateParams): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.create(params);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Get a subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method', 'latest_invoice'],
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams
  ): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.update(subscriptionId, params);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd = true
  ): Promise<Stripe.Subscription> {
    try {
      if (atPeriodEnd) {
        return await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }
      return await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Reactivate a canceled subscription (remove cancellation)
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Schedule a subscription update for a future date
   */
  async scheduleSubscriptionUpdate(
    subscriptionId: string,
    effectiveDate: Date,
    phases: Array<{ price: string; quantity?: number }>
  ): Promise<Stripe.SubscriptionSchedule> {
    try {
      // First check if there's an existing schedule
      const subscription = await this.getSubscription(subscriptionId);
      const startTimestamp = Math.floor(effectiveDate.getTime() / 1000);

      if (subscription.schedule) {
        // Update existing schedule
        const scheduleId =
          typeof subscription.schedule === 'string'
            ? subscription.schedule
            : subscription.schedule.id;
        return await this.stripe.subscriptionSchedules.update(scheduleId, {
          phases: [
            {
              items: phases,
              end_date: startTimestamp + 86400 * 365, // 1 year duration
            },
          ],
        });
      }

      // Create a new schedule from the subscription
      return await this.stripe.subscriptionSchedules.create({
        from_subscription: subscriptionId,
        start_date: startTimestamp,
        end_behavior: 'release',
        phases: [
          {
            items: phases,
            iterations: 12, // 12 billing cycles
          },
        ],
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  // ===========================================================================
  // USAGE / METERED BILLING
  // ===========================================================================

  /**
   * Report usage for metered billing
   */
  async reportUsage(
    subscriptionId: string,
    quantity: number,
    timestamp?: Date
  ): Promise<Stripe.UsageRecord | null> {
    try {
      // Get the subscription to find the metered subscription item
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const meteredItem = subscription.items.data.find(
        (item) => item.price.recurring?.usage_type === 'metered'
      );

      if (!meteredItem) {
        // No metered item found, usage tracking not applicable
        return null;
      }

      return await this.stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
        quantity,
        ...(timestamp
          ? { timestamp: Math.floor(timestamp.getTime() / 1000) }
          : { timestamp: 'now' }),
        action: 'increment',
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  // ===========================================================================
  // INVOICES
  // ===========================================================================

  /**
   * Get an invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.retrieve(invoiceId, {
        expand: ['charge', 'payment_intent'],
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * List invoices for a customer
   */
  async listInvoices(
    customerId: string,
    options?: {
      subscriptionId?: string;
      limit?: number;
      startingAfter?: string;
    }
  ): Promise<Stripe.Invoice[]> {
    try {
      const params: Stripe.InvoiceListParams = {
        customer: customerId,
        limit: options?.limit ?? 10,
      };

      if (options?.subscriptionId) {
        params.subscription = options.subscriptionId;
      }
      if (options?.startingAfter) {
        params.starting_after = options.startingAfter;
      }

      const response = await this.stripe.invoices.list(params);
      return response.data;
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Pay an invoice manually
   */
  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.pay(invoiceId);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Void an invoice
   */
  async voidInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.voidInvoice(invoiceId);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  // ===========================================================================
  // WEBHOOKS
  // ===========================================================================

  /**
   * Construct and verify a webhook event
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.stripe.webhookSecret
      );
    } catch (error) {
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new StripeWebhookError('Invalid webhook signature', {
          signatureError: error.message,
        });
      }
      throw new StripeWebhookError('Failed to construct webhook event');
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Handle Stripe API errors
   */
  private handleStripeError(error: unknown): never {
    if (error instanceof Stripe.errors.StripeError) {
      throw new StripeError(error.message, error.code, {
        type: error.type,
        param: error.param,
        requestId: error.requestId,
      });
    }
    throw error;
  }

  /**
   * Get the underlying Stripe instance (for advanced operations)
   */
  getStripeInstance(): Stripe {
    return this.stripe;
  }
}

// =============================================================================
// SERVICE SINGLETON
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

/**
 * Initialize the Stripe service (for explicit initialization)
 */
export function initializeStripeService(): StripeService {
  return getStripeService();
}
