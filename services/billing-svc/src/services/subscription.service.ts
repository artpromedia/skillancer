/**
 * @module @skillancer/billing-svc/services/subscription
 * Subscription management service
 */

import { prisma } from '@skillancer/database';

import { getStripeService } from './stripe.service.js';
import { getConfig } from '../config/index.js';
import {
  getStripePriceId,
  getUsageLimit,
  isUpgrade,
  isDowngrade,
  getTrialDays,
  isValidPlan,
  calculateOverageCost,
  type ProductType,
  type BillingIntervalType,
} from '../config/plans.js';
import {
  SubscriptionNotFoundError,
  InvalidPlanError,
  SubscriptionAlreadyExistsError,
  SubscriptionCanceledError,
  InvalidPlanChangeError,
  PaymentMethodRequiredError,
} from '../errors/index.js';

import type { Prisma } from '@skillancer/database';
import type Stripe from 'stripe';

// Import Prisma types - these will be available after running prisma generate
// For now we define placeholder types to allow compilation
type Subscription = {
  id: string;
  userId: string;
  tenantId: string | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  stripeProductId: string | null;
  product: string;
  plan: string;
  billingInterval: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  pendingPlan: string | null;
  pendingPriceId: string | null;
  pendingChangeAt: Date | null;
  usageThisPeriod: number;
  usageLimit: number | null;
  unitAmount: number | null;
  currency: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

type SubscriptionInvoice = {
  id: string;
  subscriptionId: string;
  stripeInvoiceId: string;
  number: string | null;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  pdfUrl: string | null;
  hostedInvoiceUrl: string | null;
  lineItems: unknown;
  attemptCount: number;
  nextPaymentAttempt: Date | null;
  paidAt: Date | null;
  voidedAt: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// UsageRecord type for reference (not directly used but part of the API)
type _UsageRecord = {
  id: string;
  subscriptionId: string;
  quantity: number;
  action: string;
  timestamp: Date;
  sessionId: string | null;
  podId: string | null;
  description: string | null;
  createdAt: Date;
};

type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'PAUSED';
type SubscriptionProduct = 'SKILLPOD' | 'COCKPIT';
type BillingInterval = 'MONTHLY' | 'ANNUAL';

// =============================================================================
// TYPES
// =============================================================================

export interface SubscriptionResponse {
  id: string;
  userId: string;
  tenantId: string | null;
  product: SubscriptionProduct;
  plan: string;
  billingInterval: BillingInterval;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  canceledAt: string | null;
  endedAt: string | null;
  pendingPlan: string | null;
  pendingChangeAt: string | null;
  usageThisPeriod: number;
  usageLimit: number | null;
  unitAmount: number | null;
  currency: string;
  createdAt: string;
}

export interface UsageSummary {
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  usageMinutes: number;
  usageLimit: number | null;
  usagePercentage: number | null;
  overageMinutes: number;
  overageCost: number;
  records: UsageRecordResponse[];
}

export interface UsageRecordResponse {
  id: string;
  quantity: number;
  action: string;
  timestamp: string;
  sessionId: string | null;
  podId: string | null;
  description: string | null;
}

export interface CreateSubscriptionOptions {
  product: ProductType;
  plan: string;
  billingInterval: BillingIntervalType;
  paymentMethodId?: string;
  tenantId?: string;
  skipTrial?: boolean;
  metadata?: Record<string, string>;
}

export interface PlanChangeResult {
  subscription: Subscription;
  effectiveDate: Date;
  prorationAmount?: number;
  isImmediate: boolean;
}

// =============================================================================
// SUBSCRIPTION SERVICE CLASS
// =============================================================================

export class SubscriptionService {
  private _stripeService: ReturnType<typeof getStripeService> | null = null;
  private readonly config = getConfig();

  private get stripeService() {
    this._stripeService ??= getStripeService();
    return this._stripeService;
  }

  // ===========================================================================
  // RETRIEVE SUBSCRIPTIONS
  // ===========================================================================

  /**
   * Get all subscriptions for a user
   */
  async getSubscriptions(userId: string): Promise<SubscriptionResponse[]> {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((sub) => this.mapToResponse(sub as unknown as Subscription));
  }

  /**
   * Get a specific subscription by ID
   */
  async getSubscription(subscriptionId: string, userId?: string): Promise<SubscriptionResponse> {
    const where: { id: string; userId?: string } = { id: subscriptionId };
    if (userId) {
      where.userId = userId;
    }

    const subscription = await prisma.subscription.findFirst({ where });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    return this.mapToResponse(subscription);
  }

  /**
   * Get subscription by Stripe subscription ID
   */
  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
  }

  /**
   * Get active subscription for a user and product
   */
  async getActiveSubscription(userId: string, product: ProductType): Promise<Subscription | null> {
    return prisma.subscription.findFirst({
      where: {
        userId,
        product,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      },
    });
  }

  // ===========================================================================
  // CREATE SUBSCRIPTION
  // ===========================================================================

  /**
   * Create a new subscription
   */
  async createSubscription(
    userId: string,
    options: CreateSubscriptionOptions
  ): Promise<SubscriptionResponse> {
    const { product, plan, billingInterval, paymentMethodId, tenantId, skipTrial, metadata } =
      options;

    // Validate plan exists
    if (!isValidPlan(product, plan)) {
      throw new InvalidPlanError(product, plan);
    }

    // Check for existing active subscription for this product
    const existingSubscription = await this.getActiveSubscription(userId, product);
    if (existingSubscription) {
      throw new SubscriptionAlreadyExistsError(product);
    }

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const stripeCustomer = await this.stripeService.getOrCreateCustomer(
      userId,
      user.email,
      `${user.firstName} ${user.lastName}`
    );

    // Get the Stripe price ID
    const stripePriceId = getStripePriceId(product, plan, billingInterval);
    if (!stripePriceId) {
      throw new InvalidPlanError(product, plan);
    }

    // Get plan config for trial days
    const trialDays = skipTrial ? 0 : getTrialDays(product, plan);

    // Determine if we need a payment method
    if (!paymentMethodId && trialDays === 0) {
      // Check if customer has a default payment method
      const paymentMethods = await prisma.paymentMethod.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { isDefault: 'desc' },
        take: 1,
      });

      if (paymentMethods.length === 0) {
        throw new PaymentMethodRequiredError();
      }
    }

    // Create Stripe subscription
    const stripeSubscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: stripeCustomer.id,
      items: [{ price: stripePriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId,
        product,
        plan,
        ...metadata,
      },
    };

    // Add trial if applicable
    if (trialDays > 0) {
      stripeSubscriptionParams.trial_period_days = trialDays;
    }

    // Set payment method if provided
    if (paymentMethodId) {
      stripeSubscriptionParams.default_payment_method = paymentMethodId;
    }

    const stripeSubscription =
      await this.stripeService.createSubscription(stripeSubscriptionParams);

    // Get usage limit for SkillPod plans
    const usageLimit = getUsageLimit(product, plan);

    // Create local subscription record
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        tenantId: tenantId ?? null,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
        stripePriceId,
        stripeProductId:
          typeof stripeSubscription.items.data[0]?.price.product === 'string'
            ? stripeSubscription.items.data[0].price.product
            : null,
        product,
        plan,
        billingInterval,
        status: this.mapStripeStatus(stripeSubscription.status),
        trialEndsAt: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        usageLimit,
        unitAmount: stripeSubscription.items.data[0]?.price.unit_amount ?? null,
        currency: stripeSubscription.currency,
        metadata: metadata ?? {},
      },
    });

    return this.mapToResponse(subscription);
  }

  // ===========================================================================
  // CANCEL SUBSCRIPTION
  // ===========================================================================

  /**
   * Cancel a subscription
   * @param atPeriodEnd If true, cancel at the end of the billing period (default)
   */
  async cancelSubscription(
    subscriptionId: string,
    userId: string,
    atPeriodEnd = true
  ): Promise<SubscriptionResponse> {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    if (subscription.status === 'CANCELED') {
      throw new SubscriptionCanceledError(subscriptionId);
    }

    // Cancel in Stripe
    const stripeSubscription = await this.stripeService.cancelSubscription(
      subscription.stripeSubscriptionId,
      atPeriodEnd
    );

    // Update local record
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAt: atPeriodEnd ? new Date(stripeSubscription.current_period_end * 1000) : new Date(),
        canceledAt: new Date(),
        status: atPeriodEnd ? subscription.status : 'CANCELED',
        ...(atPeriodEnd ? {} : { endedAt: new Date() }),
      },
    });

    return this.mapToResponse(updatedSubscription);
  }

  /**
   * Reactivate a canceled subscription (before it ends)
   */
  async reactivateSubscription(
    subscriptionId: string,
    userId: string
  ): Promise<SubscriptionResponse> {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    // Can only reactivate if canceled but not ended
    if (!subscription.cancelAt || subscription.endedAt) {
      throw new InvalidPlanChangeError('Subscription cannot be reactivated');
    }

    // Reactivate in Stripe
    await this.stripeService.reactivateSubscription(subscription.stripeSubscriptionId);

    // Update local record
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAt: null,
        canceledAt: null,
        status: 'ACTIVE',
      },
    });

    return this.mapToResponse(updatedSubscription);
  }

  // ===========================================================================
  // PLAN CHANGES
  // ===========================================================================

  /**
   * Upgrade a subscription to a higher plan
   */
  async upgradeSubscription(
    subscriptionId: string,
    userId: string,
    newPlan: string
  ): Promise<PlanChangeResult> {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    if (subscription.status === 'CANCELED' || subscription.endedAt) {
      throw new SubscriptionCanceledError(subscriptionId);
    }

    const product = subscription.product as ProductType;

    // Validate this is actually an upgrade
    if (!isUpgrade(product, subscription.plan, newPlan)) {
      throw new InvalidPlanChangeError(`${newPlan} is not an upgrade from ${subscription.plan}`);
    }

    // Get new price ID
    const newPriceId = getStripePriceId(
      product,
      newPlan,
      subscription.billingInterval as BillingIntervalType
    );
    if (!newPriceId) {
      throw new InvalidPlanError(product, newPlan);
    }

    // Upgrade in Stripe with immediate proration
    const currentStripeSub = await this.stripeService.getSubscription(
      subscription.stripeSubscriptionId
    );
    const currentItemId = currentStripeSub.items.data[0]?.id;
    if (!currentItemId) {
      throw new Error('Subscription has no items');
    }

    const stripeSubscription = await this.stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: currentItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          plan: newPlan,
          previousPlan: subscription.plan,
          changeType: 'upgrade',
        },
      }
    );

    // Get new usage limit
    const usageLimit = getUsageLimit(product, newPlan);

    // Update local record
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        plan: newPlan,
        stripePriceId: newPriceId,
        usageLimit,
        pendingPlan: null,
        pendingPriceId: null,
        pendingChangeAt: null,
        unitAmount: stripeSubscription.items.data[0]?.price.unit_amount ?? null,
      },
    });

    return {
      subscription: updatedSubscription,
      effectiveDate: new Date(),
      isImmediate: true,
    };
  }

  /**
   * Downgrade a subscription to a lower plan (takes effect at period end)
   */
  async downgradeSubscription(
    subscriptionId: string,
    userId: string,
    newPlan: string
  ): Promise<PlanChangeResult> {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    if (subscription.status === 'CANCELED' || subscription.endedAt) {
      throw new SubscriptionCanceledError(subscriptionId);
    }

    const product = subscription.product as ProductType;

    // Validate this is actually a downgrade
    if (!isDowngrade(product, subscription.plan, newPlan)) {
      throw new InvalidPlanChangeError(`${newPlan} is not a downgrade from ${subscription.plan}`);
    }

    // Get new price ID
    const newPriceId = getStripePriceId(
      product,
      newPlan,
      subscription.billingInterval as BillingIntervalType
    );
    if (!newPriceId) {
      throw new InvalidPlanError(product, newPlan);
    }

    // Schedule downgrade in Stripe for end of period
    const currentStripeSub = await this.stripeService.getSubscription(
      subscription.stripeSubscriptionId
    );
    const currentItemId = currentStripeSub.items.data[0]?.id;
    if (!currentItemId) {
      throw new Error('Subscription has no items');
    }

    await this.stripeService.scheduleSubscriptionUpdate(
      subscription.stripeSubscriptionId,
      subscription.currentPeriodEnd,
      [
        {
          price: newPriceId,
        },
      ]
    );

    // Update local record with pending change
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        pendingPlan: newPlan,
        pendingPriceId: newPriceId,
        pendingChangeAt: subscription.currentPeriodEnd,
      },
    });

    return {
      subscription: updatedSubscription,
      effectiveDate: subscription.currentPeriodEnd,
      isImmediate: false,
    };
  }

  /**
   * Change billing interval (monthly <-> annual)
   */
  async changeBillingInterval(
    subscriptionId: string,
    userId: string,
    newInterval: BillingIntervalType
  ): Promise<SubscriptionResponse> {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    if (subscription.billingInterval === newInterval) {
      return this.mapToResponse(subscription);
    }

    const product = subscription.product as ProductType;
    const newPriceId = getStripePriceId(product, subscription.plan, newInterval);
    if (!newPriceId) {
      throw new InvalidPlanError(product, subscription.plan);
    }

    // Update in Stripe
    const currentStripeSub = await this.stripeService.getSubscription(
      subscription.stripeSubscriptionId
    );
    const currentItemId = currentStripeSub.items.data[0]?.id;
    if (!currentItemId) {
      throw new Error('Subscription has no items');
    }

    const stripeSubscription = await this.stripeService.updateSubscription(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: currentItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      }
    );

    // Update local record
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        billingInterval: newInterval,
        stripePriceId: newPriceId,
        unitAmount: stripeSubscription.items.data[0]?.price.unit_amount ?? null,
      },
    });

    return this.mapToResponse(updatedSubscription);
  }

  // ===========================================================================
  // USAGE TRACKING
  // ===========================================================================

  /**
   * Record usage for a subscription
   */
  async recordUsage(
    subscriptionId: string,
    minutes: number,
    metadata?: {
      sessionId?: string;
      podId?: string;
      description?: string;
    }
  ): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    if (subscription.product !== 'SKILLPOD') {
      return; // Only SkillPod has usage tracking
    }

    // Check usage limit
    if (subscription.usageLimit) {
      const newUsage = subscription.usageThisPeriod + minutes;
      // We allow going over, but log it and potentially charge overage
      if (newUsage > subscription.usageLimit) {
        console.log(
          `[Usage] Subscription ${subscriptionId} exceeding limit: ${newUsage}/${subscription.usageLimit}`
        );
      }
    }

    // Report usage to Stripe for metered billing (if applicable)
    // This is for overage charging
    if (subscription.stripeSubscriptionId) {
      try {
        await this.stripeService.reportUsage(subscription.stripeSubscriptionId, minutes);
      } catch (error) {
        console.error('[Usage] Failed to report to Stripe:', error);
        // Continue even if Stripe reporting fails
      }
    }

    // Create usage record and update subscription
    await prisma.$transaction([
      prisma.usageRecord.create({
        data: {
          subscriptionId,
          quantity: minutes,
          action: 'INCREMENT',
          timestamp: new Date(),
          sessionId: metadata?.sessionId ?? null,
          podId: metadata?.podId ?? null,
          description: metadata?.description ?? null,
        },
      }),
      prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          usageThisPeriod: { increment: minutes },
        },
      }),
    ]);
  }

  /**
   * Get usage summary for a subscription
   */
  async getUsage(subscriptionId: string, periodStart?: Date): Promise<UsageSummary> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }

    const start = periodStart ?? subscription.currentPeriodStart;
    const end = subscription.currentPeriodEnd;

    // Get usage records for the period
    const records = await prisma.usageRecord.findMany({
      where: {
        subscriptionId,
        timestamp: {
          gte: start,
          lt: end,
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    const totalMinutes = records.reduce((sum, r) => sum + r.quantity, 0);
    const usageLimit = subscription.usageLimit;
    const overageMinutes = usageLimit ? Math.max(0, totalMinutes - usageLimit) : 0;
    const overageCost = calculateOverageCost(subscription.product as ProductType, overageMinutes);

    return {
      subscriptionId,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      usageMinutes: totalMinutes,
      usageLimit,
      usagePercentage: usageLimit ? (totalMinutes / usageLimit) * 100 : null,
      overageMinutes,
      overageCost,
      records: records.map((r) => ({
        id: r.id,
        quantity: r.quantity,
        action: r.action,
        timestamp: r.timestamp.toISOString(),
        sessionId: r.sessionId,
        podId: r.podId,
        description: r.description,
      })),
    };
  }

  /**
   * Reset usage at the start of a new billing period
   */
  async resetPeriodUsage(subscriptionId: string): Promise<void> {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { usageThisPeriod: 0 },
    });
  }

  // ===========================================================================
  // INVOICES
  // ===========================================================================

  /**
   * Get invoices for a subscription
   */
  async getInvoices(subscriptionId: string): Promise<SubscriptionInvoice[]> {
    return prisma.subscriptionInvoice.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific invoice
   */
  async getInvoice(invoiceId: string): Promise<SubscriptionInvoice> {
    const invoice = await prisma.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    return invoice;
  }

  /**
   * Sync invoice from Stripe webhook
   */
  async syncInvoice(stripeInvoice: Stripe.Invoice): Promise<SubscriptionInvoice | null> {
    if (!stripeInvoice.subscription || typeof stripeInvoice.subscription !== 'string') {
      return null;
    }

    const subscription = await this.getSubscriptionByStripeId(stripeInvoice.subscription);
    if (!subscription) {
      console.log(`[Invoice] No local subscription for Stripe sub ${stripeInvoice.subscription}`);
      return null;
    }

    const invoiceData = {
      subscriptionId: subscription.id,
      stripeInvoiceId: stripeInvoice.id,
      number: stripeInvoice.number ?? null,
      amountDue: stripeInvoice.amount_due,
      amountPaid: stripeInvoice.amount_paid,
      amountRemaining: stripeInvoice.amount_remaining,
      subtotal: stripeInvoice.subtotal,
      tax: stripeInvoice.tax ?? 0,
      total: stripeInvoice.total,
      currency: stripeInvoice.currency,
      status: this.mapInvoiceStatus(stripeInvoice.status),
      periodStart: new Date(stripeInvoice.period_start * 1000),
      periodEnd: new Date(stripeInvoice.period_end * 1000),
      pdfUrl: stripeInvoice.invoice_pdf ?? null,
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? null,
      lineItems:
        stripeInvoice.lines?.data?.map((line) => ({
          description: line.description,
          amount: line.amount,
          quantity: line.quantity,
          priceId: line.price?.id,
        })) ?? [],
      attemptCount: stripeInvoice.attempt_count,
      nextPaymentAttempt: stripeInvoice.next_payment_attempt
        ? new Date(stripeInvoice.next_payment_attempt * 1000)
        : null,
      paidAt:
        stripeInvoice.status === 'paid' && stripeInvoice.status_transitions?.paid_at
          ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
          : null,
      voidedAt:
        stripeInvoice.status === 'void' && stripeInvoice.status_transitions?.voided_at
          ? new Date(stripeInvoice.status_transitions.voided_at * 1000)
          : null,
      dueDate: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
    };

    return prisma.subscriptionInvoice.upsert({
      where: { stripeInvoiceId: stripeInvoice.id },
      create: invoiceData,
      update: invoiceData,
    });
  }

  // ===========================================================================
  // WEBHOOK SYNC
  // ===========================================================================

  /**
   * Sync subscription status from Stripe webhook
   */
  async syncSubscriptionStatus(
    stripeSubscription: Stripe.Subscription
  ): Promise<Subscription | null> {
    const subscription = await this.getSubscriptionByStripeId(stripeSubscription.id);
    if (!subscription) {
      return null;
    }

    return prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: this.mapStripeStatus(stripeSubscription.status),
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAt: stripeSubscription.cancel_at
          ? new Date(stripeSubscription.cancel_at * 1000)
          : null,
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        endedAt: stripeSubscription.ended_at ? new Date(stripeSubscription.ended_at * 1000) : null,
        trialEndsAt: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
      },
    });
  }

  /**
   * Handle subscription renewal (new period started)
   */
  async handlePeriodRenewal(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await this.getSubscriptionByStripeId(stripeSubscription.id);
    if (!subscription) {
      return;
    }

    // Apply any pending plan changes
    if (subscription.pendingPlan && subscription.pendingPriceId) {
      const usageLimit = getUsageLimit(
        subscription.product as ProductType,
        subscription.pendingPlan
      );

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          plan: subscription.pendingPlan,
          stripePriceId: subscription.pendingPriceId,
          usageLimit,
          pendingPlan: null,
          pendingPriceId: null,
          pendingChangeAt: null,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          usageThisPeriod: 0, // Reset usage for new period
        },
      });
    } else {
      // Just reset usage for new period
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          usageThisPeriod: 0,
        },
      });
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapToResponse(subscription: Subscription): SubscriptionResponse {
    return {
      id: subscription.id,
      userId: subscription.userId,
      tenantId: subscription.tenantId,
      product: subscription.product as SubscriptionProduct,
      plan: subscription.plan,
      billingInterval: subscription.billingInterval as BillingInterval,
      status: subscription.status as SubscriptionStatus,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAt: subscription.cancelAt?.toISOString() ?? null,
      canceledAt: subscription.canceledAt?.toISOString() ?? null,
      endedAt: subscription.endedAt?.toISOString() ?? null,
      pendingPlan: subscription.pendingPlan,
      pendingChangeAt: subscription.pendingChangeAt?.toISOString() ?? null,
      usageThisPeriod: subscription.usageThisPeriod,
      usageLimit: subscription.usageLimit,
      unitAmount: subscription.unitAmount,
      currency: subscription.currency,
      createdAt: subscription.createdAt.toISOString(),
    };
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    const statusMap: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
      trialing: 'TRIALING',
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      unpaid: 'UNPAID',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'INCOMPLETE_EXPIRED',
      paused: 'PAUSED',
    };
    return statusMap[status] ?? 'INCOMPLETE';
  }

  private mapInvoiceStatus(
    status: Stripe.Invoice.Status | null
  ): 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE' {
    if (!status) return 'DRAFT';
    const statusMap: Record<string, 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE'> = {
      draft: 'DRAFT',
      open: 'OPEN',
      paid: 'PAID',
      void: 'VOID',
      uncollectible: 'UNCOLLECTIBLE',
    };
    return statusMap[status] ?? 'DRAFT';
  }
}

// =============================================================================
// SERVICE SINGLETON
// =============================================================================

let subscriptionServiceInstance: SubscriptionService | null = null;

export function getSubscriptionService(): SubscriptionService {
  subscriptionServiceInstance ??= new SubscriptionService();
  return subscriptionServiceInstance;
}

export function resetSubscriptionService(): void {
  subscriptionServiceInstance = null;
}

export function initializeSubscriptionService(): SubscriptionService {
  return getSubscriptionService();
}
