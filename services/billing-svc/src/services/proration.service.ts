/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
/**
 * @module @skillancer/billing-svc/services/proration
 * Proration calculation service for plan changes
 *
 * NOTE: This service requires the Price model with relations to be added to the schema.
 * Run the schema migration before using this service in production.
 */

import { getStripeService } from './stripe.service.js';
import { BillingError } from '../errors/index.js';
import { getSubscriptionRepository } from '../repositories/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface ProrationPreview {
  currentPlan: {
    name: string;
    amount: number;
  };
  newPlan: {
    name: string;
    amount: number;
  };
  proration: {
    amount: number; // Positive = charge, negative = credit
    description: string;
    immediateCharge: boolean;
  };
  nextInvoice: {
    amount: number;
    date: string;
  };
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

// =============================================================================
// PRORATION SERVICE (STUB)
// =============================================================================

export class ProrationService {
  private _stripeService: ReturnType<typeof getStripeService> | null = null;
  private subscriptionRepository = getSubscriptionRepository();

  private get stripeService() {
    if (!this._stripeService) {
      this._stripeService = getStripeService();
    }
    return this._stripeService;
  }

  // ===========================================================================
  // PREVIEW PRORATION (STUB)
  // ===========================================================================

  /**
   * Preview plan change proration
   *
   * NOTE: Full implementation requires Price model with relations
   */
  async previewPlanChange(
    subscriptionId: string,
    _newPriceId: string,
    _newQuantity?: number
  ): Promise<ProrationPreview> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    console.warn('[Proration Service] Full proration preview requires schema migration');
    console.warn('[Proration Service] Using stub implementation');

    // Return stub preview - in production, this would use Stripe's API
    // to calculate actual proration based on Price relations
    return {
      currentPlan: {
        name: subscription.plan,
        amount: subscription.unitAmount ?? 0,
      },
      newPlan: {
        name: 'New Plan',
        amount: 0, // Would come from Price lookup
      },
      proration: {
        amount: 0,
        description: 'Proration calculation requires schema migration',
        immediateCharge: false,
      },
      nextInvoice: {
        amount: 0,
        date: subscription.currentPeriodEnd.toISOString(),
      },
    };
  }

  /**
   * Preview seat change proration
   *
   * NOTE: Full implementation requires Price model with isPerSeat field
   */
  async previewSeatChange(subscriptionId: string, _newQuantity: number): Promise<ProrationPreview> {
    const subscription = await this.subscriptionRepository.findById(subscriptionId);

    if (!subscription) {
      throw new BillingError('Subscription not found', 'SUBSCRIPTION_NOT_FOUND', 404);
    }

    console.warn('[Proration Service] Full seat change preview requires schema migration');

    return {
      currentPlan: {
        name: subscription.plan,
        amount: subscription.unitAmount ?? 0,
      },
      newPlan: {
        name: subscription.plan,
        amount: subscription.unitAmount ?? 0,
      },
      proration: {
        amount: 0,
        description: 'Seat change calculation requires schema migration',
        immediateCharge: false,
      },
      nextInvoice: {
        amount: subscription.unitAmount ?? 0,
        date: subscription.currentPeriodEnd.toISOString(),
      },
    };
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
  if (!serviceInstance) {
    serviceInstance = new ProrationService();
  }
  return serviceInstance;
}

export function initializeProrationService(): void {
  serviceInstance = new ProrationService();
}
