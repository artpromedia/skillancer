// @ts-nocheck - Known type issues pending refactor
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/billing-svc/services/proration
 * Proration calculation service for plan changes
 */

import { getStripeService } from './stripe.service.js';
import { getStripePriceId, type ProductType, type BillingIntervalType } from '../config/plans.js';
import { BillingError } from '../errors/index.js';
import { getSubscriptionRepository } from '../repositories/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ProrationPreview {
  currentPlan: {
    name: string;
    amount: number;
    interval: string;
  };
  newPlan: {
    name: string;
    amount: number;
    interval: string;
  };
  proration: {
    amount: number; // Positive = charge, negative = credit
    description: string;
    immediateCharge: boolean;
    creditAmount: number;
    debitAmount: number;
  };
  nextInvoice: {
    amount: number;
    date: string;
    lineItems: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
  };
  effectiveDate: string;
}

export interface ProrationCalculation {
  proratedAmount: number;
  creditAmount: number;
  chargeAmount: number;
  daysRemaining: number;
  totalDays: number;
  effectiveDate: Date;
}

export type ProrationBehavior = 'create_prorations' | 'none' | 'always_invoice';

export interface SeatChangePreview extends ProrationPreview {
  seats: {
    current: number;
    new: number;
    change: number;
  };
  perSeatPrice: number;
}

// =============================================================================
// PRORATION SERVICE
// =============================================================================

export class ProrationService {
  private _stripeService: ReturnType<typeof getStripeService> | null = null;
  private readonly subscriptionRepository = getSubscriptionRepository();

  private get stripeService() {
    this._stripeService ??= getStripeService();
    return this._stripeService;
  }

  // ===========================================================================
  // PREVIEW PRORATION USING STRIPE
  // ===========================================================================

  /**
   * Preview plan change proration using Stripe's upcoming invoice API
   * This gives an accurate preview of what the customer will be charged
   */
  async previewPlanChange(
    subscriptionId: string,
    newPlan: string,
    options?: { newBillingInterval?: BillingIntervalType }
  ): Promise<ProrationPreview> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    const product = subscription.product as ProductType;
    const billingInterval =
      options?.newBillingInterval ?? (subscription.billingInterval as BillingIntervalType);

    // Get the new Stripe price ID
    const newStripePriceId = getStripePriceId(product, newPlan, billingInterval);
    if (!newStripePriceId) {
      throw new BillingError('Invalid plan', 'INVALID_PLAN', 400);
    }

    // Get current Stripe subscription
    const stripeSubscription = await this.stripeService.getSubscription(
      subscription.stripeSubscriptionId
    );
    const currentItemId = stripeSubscription.items.data[0]?.id;

    if (!currentItemId) {
      throw new BillingError('Subscription has no items', 'NO_SUBSCRIPTION_ITEMS', 500);
    }

    // Use Stripe's upcoming invoice preview
    const upcomingInvoice = await this.stripeService.previewUpcomingInvoice(
      subscription.stripeCustomerId,
      subscription.stripeSubscriptionId,
      [
        {
          id: currentItemId,
          price: newStripePriceId,
        },
      ]
    );

    // Calculate proration details
    let creditAmount = 0;
    let debitAmount = 0;
    const lineItems: Array<{ description: string; amount: number; quantity: number }> = [];

    for (const line of upcomingInvoice.lines.data) {
      if (line.proration) {
        if (line.amount < 0) {
          creditAmount += Math.abs(line.amount);
        } else {
          debitAmount += line.amount;
        }
      }

      lineItems.push({
        description: line.description ?? 'Subscription',
        amount: line.amount,
        quantity: line.quantity ?? 1,
      });
    }

    const prorationAmount = debitAmount - creditAmount;
    const isUpgrade = prorationAmount > 0;

    return {
      currentPlan: {
        name: subscription.plan,
        amount: subscription.unitAmount ?? 0,
        interval: subscription.billingInterval,
      },
      newPlan: {
        name: newPlan,
        amount: stripeSubscription.items.data[0]?.price.unit_amount ?? 0,
        interval: billingInterval,
      },
      proration: {
        amount: prorationAmount,
        description: isUpgrade
          ? `Prorated charge for upgrading to ${newPlan}`
          : `Credit for downgrading to ${newPlan}`,
        immediateCharge: isUpgrade,
        creditAmount,
        debitAmount,
      },
      nextInvoice: {
        amount: upcomingInvoice.total,
        date: new Date(upcomingInvoice.period_end * 1000).toISOString(),
        lineItems,
      },
      effectiveDate: isUpgrade
        ? new Date().toISOString()
        : subscription.currentPeriodEnd.toISOString(),
    };
  }

  /**
   * Preview seat/quantity change proration
   */
  async previewSeatChange(subscriptionId: string, newQuantity: number): Promise<SeatChangePreview> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    // Get current Stripe subscription
    const stripeSubscription = await this.stripeService.getSubscription(
      subscription.stripeSubscriptionId
    );
    const currentItem = stripeSubscription.items.data[0];

    if (!currentItem) {
      throw new BillingError('Subscription has no items', 'NO_SUBSCRIPTION_ITEMS', 500);
    }

    const currentQuantity = currentItem.quantity ?? 1;
    const quantityChange = newQuantity - currentQuantity;

    // Use Stripe's upcoming invoice preview with quantity change
    const upcomingInvoice = await this.stripeService.previewUpcomingInvoice(
      subscription.stripeCustomerId,
      subscription.stripeSubscriptionId,
      [
        {
          id: currentItem.id,
          quantity: newQuantity,
        },
      ]
    );

    // Calculate proration details
    let creditAmount = 0;
    let debitAmount = 0;
    const lineItems: Array<{ description: string; amount: number; quantity: number }> = [];

    for (const line of upcomingInvoice.lines.data) {
      if (line.proration) {
        if (line.amount < 0) {
          creditAmount += Math.abs(line.amount);
        } else {
          debitAmount += line.amount;
        }
      }

      lineItems.push({
        description: line.description ?? 'Subscription',
        amount: line.amount,
        quantity: line.quantity ?? 1,
      });
    }

    const prorationAmount = debitAmount - creditAmount;
    const isAddingSeats = quantityChange > 0;
    const perSeatPrice = currentItem.price.unit_amount ?? 0;

    return {
      currentPlan: {
        name: subscription.plan,
        amount: (subscription.unitAmount ?? 0) * currentQuantity,
        interval: subscription.billingInterval,
      },
      newPlan: {
        name: subscription.plan,
        amount: perSeatPrice * newQuantity,
        interval: subscription.billingInterval,
      },
      proration: {
        amount: prorationAmount,
        description: isAddingSeats
          ? `Adding ${quantityChange} seat(s)`
          : `Removing ${Math.abs(quantityChange)} seat(s)`,
        immediateCharge: isAddingSeats,
        creditAmount,
        debitAmount,
      },
      nextInvoice: {
        amount: upcomingInvoice.total,
        date: new Date(upcomingInvoice.period_end * 1000).toISOString(),
        lineItems,
      },
      effectiveDate: new Date().toISOString(),
      seats: {
        current: currentQuantity,
        new: newQuantity,
        change: quantityChange,
      },
      perSeatPrice,
    };
  }

  /**
   * Preview billing interval change (monthly <-> annual)
   */
  async previewIntervalChange(
    subscriptionId: string,
    newInterval: BillingIntervalType
  ): Promise<ProrationPreview> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    if (subscription.billingInterval === newInterval) {
      throw new BillingError('Same billing interval', 'SAME_INTERVAL', 400);
    }

    return this.previewPlanChange(subscriptionId, subscription.plan, {
      newBillingInterval: newInterval,
    });
  }

  // ===========================================================================
  // CALCULATE PRORATION
  // ===========================================================================

  /**
   * Calculate proration for a period
   */
  calculateProration(
    currentAmount: number,
    newAmount: number,
    periodStart: Date,
    periodEnd: Date,
    changeDate: Date = new Date()
  ): ProrationCalculation {
    const totalDays = this.daysBetween(periodStart, periodEnd);
    const daysRemaining = this.daysBetween(changeDate, periodEnd);

    // Calculate daily rate
    const currentDailyRate = currentAmount / totalDays;
    const newDailyRate = newAmount / totalDays;

    // Credit for unused portion of current plan
    const creditAmount = Math.round(currentDailyRate * daysRemaining);

    // Charge for remaining portion on new plan
    const chargeAmount = Math.round(newDailyRate * daysRemaining);

    // Net proration (positive = charge, negative = credit)
    const proratedAmount = chargeAmount - creditAmount;

    return {
      proratedAmount,
      creditAmount,
      chargeAmount,
      daysRemaining,
      totalDays,
      effectiveDate: changeDate,
    };
  }

  // ===========================================================================
  // DETERMINE PRORATION BEHAVIOR
  // ===========================================================================

  /**
   * Determine proration behavior based on plan change type
   */
  determineProrationBehavior(
    currentAmount: number,
    newAmount: number,
    options?: { immediate?: boolean }
  ): ProrationBehavior {
    const isUpgrade = newAmount > currentAmount;
    const isDowngrade = newAmount < currentAmount;

    if (isUpgrade) {
      // Upgrades: Create prorations (immediate charge)
      return options?.immediate ? 'always_invoice' : 'create_prorations';
    } else if (isDowngrade) {
      // Downgrades: No proration (takes effect at period end)
      return 'none';
    }

    // Same price (quantity change): Create prorations
    return 'create_prorations';
  }

  /**
   * Check if change is an upgrade
   *
   * NOTE: Full implementation requires Price model
   */
  isUpgrade(_currentPriceId: string, _newPriceId: string): boolean {
    console.warn('[Proration Service] Price comparison requires schema migration');
    return false;
  }

  /**
   * Check if change is a downgrade
   *
   * NOTE: Full implementation requires Price model
   */
  isDowngrade(_currentPriceId: string, _newPriceId: string): boolean {
    console.warn('[Proration Service] Price comparison requires schema migration');
    return false;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Calculate days between two dates
   */
  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((end.getTime() - start.getTime()) / msPerDay);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let serviceInstance: ProrationService | null = null;

export function getProrationService(): ProrationService {
  serviceInstance ??= new ProrationService();
  return serviceInstance;
}

export function initializeProrationService(): void {
  serviceInstance = new ProrationService();
}
