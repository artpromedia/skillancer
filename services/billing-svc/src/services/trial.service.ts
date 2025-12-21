// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * @module @skillancer/billing-svc/services/trial
 * Trial management service for subscription billing
 */

import { prisma } from '@skillancer/database';

import { getStripeService } from './stripe.service.js';
import { getSubscriptionService } from './subscription.service.js';
import { TRIAL_CONFIG, getTrialDays, type ProductType } from '../config/plans.js';
import { BillingError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TrialEligibility {
  eligible: boolean;
  reason?: string;
  trialDays: number;
  previousTrial?: {
    productType: string;
    startedAt: string;
    endedAt?: string;
  };
}

export interface TrialStatus {
  subscriptionId: string;
  isTrialing: boolean;
  trialStart: string | null;
  trialEnd: string | null;
  daysRemaining: number;
  daysUsed: number;
  totalDays: number;
  willConvertToPaid: boolean;
  hasPaymentMethod: boolean;
}

export interface StartTrialParams {
  userId: string;
  product: ProductType;
  plan: string;
  paymentMethodId?: string;
  tenantId?: string;
}

export interface ExtendTrialParams {
  subscriptionId: string;
  additionalDays: number;
  reason?: string;
}

export interface ConvertTrialParams {
  subscriptionId: string;
  paymentMethodId: string;
}

export interface TrialReminder {
  subscriptionId: string;
  userId: string;
  email: string;
  productName: string;
  daysRemaining: number;
  trialEndsAt: string;
  hasPaymentMethod: boolean;
}

// =============================================================================
// TRIAL SERVICE
// =============================================================================

export class TrialService {
  private _stripeService: ReturnType<typeof getStripeService> | null = null;
  private _subscriptionService: ReturnType<typeof getSubscriptionService> | null = null;

  private get stripeService() {
    this._stripeService ??= getStripeService();
    return this._stripeService;
  }

  private get subscriptionService() {
    this._subscriptionService ??= getSubscriptionService();
    return this._subscriptionService;
  }

  // ===========================================================================
  // TRIAL ELIGIBILITY
  // ===========================================================================

  /**
   * Check if a user is eligible for a trial
   */
  async checkTrialEligibility(
    userId: string,
    product: ProductType,
    plan: string
  ): Promise<TrialEligibility> {
    // Check if product offers trials
    const eligibleProducts = TRIAL_CONFIG.trialEligibleProducts as readonly string[];
    if (!eligibleProducts.includes(product)) {
      return {
        eligible: false,
        reason: 'This product does not offer free trials',
        trialDays: 0,
      };
    }

    // Check if plan offers trials
    const eligiblePlans = TRIAL_CONFIG.trialEligiblePlans as readonly string[];
    if (!eligiblePlans.includes(plan)) {
      return {
        eligible: false,
        reason: 'This plan does not offer a free trial',
        trialDays: 0,
      };
    }

    // Check for previous trials on this product
    const previousTrials = await prisma.subscription.findMany({
      where: {
        userId,
        product,
        trialEndsAt: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (previousTrials.length > 0) {
      const previousTrial = previousTrials[0];
      return {
        eligible: false,
        reason: 'You have already used your free trial for this product',
        trialDays: 0,
        previousTrial: {
          productType: previousTrial.product,
          startedAt: previousTrial.createdAt.toISOString(),
          endedAt: previousTrial.trialEndsAt?.toISOString(),
        },
      };
    }

    // Check for active subscription
    const activeSubscription = await this.subscriptionService.getActiveSubscription(
      userId,
      product
    );
    if (activeSubscription) {
      return {
        eligible: false,
        reason: 'You already have an active subscription for this product',
        trialDays: 0,
      };
    }

    // Get trial days for this plan
    const trialDays = getTrialDays(product, plan);
    if (!trialDays || trialDays <= 0) {
      return {
        eligible: false,
        reason: 'This plan does not include a trial period',
        trialDays: 0,
      };
    }

    return {
      eligible: true,
      trialDays,
    };
  }

  // ===========================================================================
  // TRIAL MANAGEMENT
  // ===========================================================================

  /**
   * Start a trial subscription
   */
  async startTrial(params: StartTrialParams): Promise<{
    subscription: Awaited<ReturnType<typeof this.subscriptionService.createSubscription>>;
    trialEndsAt: string;
  }> {
    const { userId, product, plan, paymentMethodId, tenantId } = params;

    // Check eligibility
    const eligibility = await this.checkTrialEligibility(userId, product, plan);
    if (!eligibility.eligible) {
      throw new BillingError(
        eligibility.reason ?? 'Not eligible for trial',
        'TRIAL_NOT_ELIGIBLE',
        400
      );
    }

    // Create subscription with trial (don't skip trial)
    const subscription = await this.subscriptionService.createSubscription(userId, {
      product,
      plan,
      billingInterval: 'MONTHLY', // Default to monthly for trials
      paymentMethodId,
      tenantId,
      skipTrial: false,
    });

    const trialEndsAt =
      subscription.trialEndsAt ??
      new Date(Date.now() + eligibility.trialDays * 24 * 60 * 60 * 1000).toISOString();

    return {
      subscription,
      trialEndsAt,
    };
  }

  /**
   * Get trial status for a subscription
   */
  async getTrialStatus(subscriptionId: string, userId: string): Promise<TrialStatus> {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
      include: {
        user: {
          include: {
            paymentMethods: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
        },
      },
    });

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    const isTrialing = subscription.status === 'TRIALING';
    const hasPaymentMethod = (subscription.user.paymentMethods?.length ?? 0) > 0;

    if (!isTrialing || !subscription.trialEndsAt) {
      return {
        subscriptionId,
        isTrialing: false,
        trialStart: subscription.trialStart?.toISOString() ?? null,
        trialEnd: subscription.trialEndsAt?.toISOString() ?? null,
        daysRemaining: 0,
        daysUsed: 0,
        totalDays: 0,
        willConvertToPaid: false,
        hasPaymentMethod,
      };
    }

    const now = new Date();
    const trialStart = subscription.trialStart ?? subscription.createdAt;
    const trialEnd = subscription.trialEndsAt;

    const totalMs = trialEnd.getTime() - trialStart.getTime();
    const usedMs = now.getTime() - trialStart.getTime();
    const remainingMs = Math.max(0, trialEnd.getTime() - now.getTime());

    const totalDays = Math.ceil(totalMs / (24 * 60 * 60 * 1000));
    const daysUsed = Math.floor(usedMs / (24 * 60 * 60 * 1000));
    const daysRemaining = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

    return {
      subscriptionId,
      isTrialing: true,
      trialStart: trialStart.toISOString(),
      trialEnd: trialEnd.toISOString(),
      daysRemaining,
      daysUsed,
      totalDays,
      willConvertToPaid: hasPaymentMethod,
      hasPaymentMethod,
    };
  }

  /**
   * Extend a trial (admin function)
   */
  async extendTrial(params: ExtendTrialParams): Promise<TrialStatus> {
    const { subscriptionId, additionalDays, reason } = params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    if (subscription.status !== 'TRIALING') {
      throw new BillingError('Subscription is not in trial status', 'NOT_IN_TRIAL', 400);
    }

    if (!subscription.trialEndsAt) {
      throw new BillingError(
        'Subscription does not have a trial end date',
        'NO_TRIAL_END_DATE',
        400
      );
    }

    // Calculate new trial end
    const newTrialEnd = new Date(subscription.trialEndsAt);
    newTrialEnd.setDate(newTrialEnd.getDate() + additionalDays);

    // Update in Stripe
    await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
      trial_end: Math.floor(newTrialEnd.getTime() / 1000),
      metadata: {
        trial_extended: 'true',
        trial_extension_days: String(additionalDays),
        trial_extension_reason: reason ?? 'Manual extension',
      },
    });

    // Update local record
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        trialEndsAt: newTrialEnd,
        metadata: {
          ...(subscription.metadata as Record<string, unknown> | null),
          trialExtended: true,
          trialExtensionDays: additionalDays,
          trialExtensionReason: reason,
          trialExtendedAt: new Date().toISOString(),
        },
      },
    });

    return this.getTrialStatus(subscriptionId, subscription.userId);
  }

  /**
   * Convert trial to paid subscription
   */
  async convertTrialToPaid(params: ConvertTrialParams): Promise<{
    subscription: Awaited<ReturnType<typeof this.subscriptionService.getSubscription>>;
    convertedAt: string;
  }> {
    const { subscriptionId, paymentMethodId } = params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    if (subscription.status !== 'TRIALING') {
      throw new BillingError('Subscription is not in trial status', 'NOT_IN_TRIAL', 400);
    }

    // Set payment method and end trial immediately in Stripe
    await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
      default_payment_method: paymentMethodId,
      trial_end: 'now',
    });

    // Update local status
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        trialEndsAt: new Date(),
        metadata: {
          ...(subscription.metadata as Record<string, unknown> | null),
          trialConvertedAt: new Date().toISOString(),
          trialConvertedEarly: true,
        },
      },
    });

    const updatedSubscription = await this.subscriptionService.getSubscription(
      subscriptionId,
      subscription.userId
    );

    return {
      subscription: updatedSubscription,
      convertedAt: new Date().toISOString(),
    };
  }

  /**
   * End trial immediately (cancels if no payment method)
   */
  async endTrial(
    subscriptionId: string,
    userId: string
  ): Promise<{
    subscription: Awaited<ReturnType<typeof this.subscriptionService.getSubscription>>;
    outcome: 'converted' | 'canceled';
  }> {
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
      include: {
        user: {
          include: {
            paymentMethods: {
              where: { status: 'ACTIVE', isDefault: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    if (subscription.status !== 'TRIALING') {
      throw new BillingError('Subscription is not in trial status', 'NOT_IN_TRIAL', 400);
    }

    const defaultPaymentMethod = subscription.user.paymentMethods?.[0];

    if (defaultPaymentMethod) {
      // Convert to paid
      await this.stripeService.updateSubscription(subscription.stripeSubscriptionId, {
        trial_end: 'now',
      });

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'ACTIVE',
          trialEndsAt: new Date(),
        },
      });

      const updatedSubscription = await this.subscriptionService.getSubscription(
        subscriptionId,
        userId
      );

      return {
        subscription: updatedSubscription,
        outcome: 'converted',
      };
    } else {
      // Cancel subscription
      const canceledSubscription = await this.subscriptionService.cancelSubscription(
        subscriptionId,
        userId,
        false // Immediate cancellation
      );

      return {
        subscription: canceledSubscription,
        outcome: 'canceled',
      };
    }
  }

  // ===========================================================================
  // TRIAL REMINDERS
  // ===========================================================================

  /**
   * Get subscriptions with trials ending soon
   */
  async getTrialsEndingSoon(daysThreshold: number = 3): Promise<TrialReminder[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          lte: thresholdDate,
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            paymentMethods: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
          },
        },
      },
    });

    return subscriptions.map((sub) => {
      const daysRemaining = Math.ceil(
        (sub.trialEndsAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );

      return {
        subscriptionId: sub.id,
        userId: sub.userId,
        email: sub.user.email,
        productName: sub.product,
        daysRemaining: Math.max(0, daysRemaining),
        trialEndsAt: sub.trialEndsAt!.toISOString(),
        hasPaymentMethod: (sub.user.paymentMethods?.length ?? 0) > 0,
      };
    });
  }

  /**
   * Process expired trials
   * Called by a scheduled job
   */
  async processExpiredTrials(): Promise<{
    processed: number;
    converted: number;
    canceled: number;
    errors: Array<{ subscriptionId: string; error: string }>;
  }> {
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          lt: new Date(),
        },
      },
      include: {
        user: {
          include: {
            paymentMethods: {
              where: { status: 'ACTIVE', isDefault: true },
              take: 1,
            },
          },
        },
      },
    });

    const results = {
      processed: 0,
      converted: 0,
      canceled: 0,
      errors: [] as Array<{ subscriptionId: string; error: string }>,
    };

    for (const subscription of expiredTrials) {
      try {
        results.processed++;

        const hasPaymentMethod = (subscription.user.paymentMethods?.length ?? 0) > 0;

        if (hasPaymentMethod) {
          // Stripe will automatically convert - just update local status
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'ACTIVE' },
          });
          results.converted++;
        } else {
          // Cancel subscription
          await this.subscriptionService.cancelSubscription(
            subscription.id,
            subscription.userId,
            false
          );
          results.canceled++;
        }
      } catch (error) {
        results.errors.push({
          subscriptionId: subscription.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}

// =============================================================================
// SERVICE SINGLETON
// =============================================================================

let trialServiceInstance: TrialService | null = null;

export function getTrialService(): TrialService {
  trialServiceInstance ??= new TrialService();
  return trialServiceInstance;
}

export function resetTrialService(): void {
  trialServiceInstance = null;
}
