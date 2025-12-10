/**
 * @module @skillancer/billing-svc/config/plans
 * Subscription plan configuration
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PlanFeatures {
  hoursPerMonth: number | null; // null = unlimited
  tools: readonly string[];
  support: 'email' | 'priority' | 'dedicated';
  maxClients?: number; // For Cockpit plans
  integrations?: readonly string[];
}

export interface Plan {
  name: string;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  monthlyPrice: number; // cents
  annualPrice: number; // cents (10 months for 2 months free)
  features: PlanFeatures;
  custom?: boolean;
  trialDays?: number;
}

export interface EnterprisePlan {
  name: string;
  custom: true;
  features: PlanFeatures;
}

export type PlanConfig = Plan | EnterprisePlan;

export interface ProductPlans {
  [planName: string]: PlanConfig;
}

// =============================================================================
// SKILLPOD PLANS
// =============================================================================

export const SKILLPOD_PLANS = {
  starter: {
    name: 'SkillPod Starter',
    stripePriceIdMonthly: 'price_skillpod_starter_monthly',
    stripePriceIdAnnual: 'price_skillpod_starter_annual',
    monthlyPrice: 4900, // $49
    annualPrice: 49000, // $490 (10 months = 2 months free)
    trialDays: 14,
    features: {
      hoursPerMonth: 40 * 60, // 40 hours in minutes (2400 minutes)
      tools: ['basic'],
      support: 'email' as const,
    },
  },
  professional: {
    name: 'SkillPod Professional',
    stripePriceIdMonthly: 'price_skillpod_pro_monthly',
    stripePriceIdAnnual: 'price_skillpod_pro_annual',
    monthlyPrice: 14900, // $149
    annualPrice: 149000, // $1490 (10 months = 2 months free)
    trialDays: 14,
    features: {
      hoursPerMonth: 160 * 60, // 160 hours in minutes (9600 minutes)
      tools: ['all'],
      support: 'priority' as const,
    },
  },
  enterprise: {
    name: 'SkillPod Enterprise',
    custom: true as const,
    features: {
      hoursPerMonth: null, // unlimited
      tools: ['all', 'custom'],
      support: 'dedicated' as const,
    },
  },
} as const;

// =============================================================================
// COCKPIT PLANS
// =============================================================================

export const COCKPIT_PLANS = {
  basic: {
    name: 'Cockpit Basic',
    stripePriceIdMonthly: 'price_cockpit_basic_monthly',
    stripePriceIdAnnual: 'price_cockpit_basic_annual',
    monthlyPrice: 9900, // $99
    annualPrice: 99000, // $990 (10 months = 2 months free)
    trialDays: 14,
    features: {
      hoursPerMonth: null, // Not applicable for Cockpit
      tools: ['basic'],
      support: 'email' as const,
      maxClients: 5,
      integrations: ['basic'],
    },
  },
  professional: {
    name: 'Cockpit Professional',
    stripePriceIdMonthly: 'price_cockpit_pro_monthly',
    stripePriceIdAnnual: 'price_cockpit_pro_annual',
    monthlyPrice: 24900, // $249
    annualPrice: 249000, // $2490 (10 months = 2 months free)
    trialDays: 14,
    features: {
      hoursPerMonth: null,
      tools: ['all'],
      support: 'priority' as const,
      maxClients: 15,
      integrations: ['all'],
    },
  },
  enterprise: {
    name: 'Cockpit Enterprise',
    custom: true as const,
    features: {
      hoursPerMonth: null,
      tools: ['all', 'custom'],
      support: 'dedicated' as const,
      integrations: ['all', 'custom'],
    },
  },
} as const;

// =============================================================================
// ALL PLANS
// =============================================================================

export const PLANS = {
  skillpod: SKILLPOD_PLANS,
  cockpit: COCKPIT_PLANS,
} as const;

// =============================================================================
// OVERAGE RATES
// =============================================================================

export const OVERAGE_RATES = {
  skillpod: {
    pricePerMinute: 2, // $0.02 per minute = $1.20 per hour
    stripePriceId: 'price_skillpod_overage', // Metered price in Stripe
  },
} as const;

// =============================================================================
// TRIAL CONFIGURATION
// =============================================================================

export const TRIAL_CONFIG = {
  defaultTrialDays: 14,
  // Products that offer trials
  trialEligibleProducts: ['SKILLPOD', 'COCKPIT'] as const,
  // Plans that offer trials (enterprise usually doesn't)
  trialEligiblePlans: ['starter', 'professional', 'basic'] as const,
} as const;

// =============================================================================
// BILLING CONFIGURATION
// =============================================================================

export const BILLING_CONFIG = {
  // Payment retry schedule (days after initial failure)
  paymentRetryDays: [1, 3, 7] as const,

  // Grace period after subscription expires (days)
  gracePeriodDays: 3,

  // Days before expiration to send reminder
  expirationReminderDays: [7, 3, 1] as const,

  // Proration behavior
  prorationBehavior: {
    upgrade: 'create_prorations' as const, // Immediate proration
    downgrade: 'none' as const, // Takes effect at period end
  },

  // Invoice settings
  invoiceSettings: {
    daysUntilDue: 30,
    autoAdvance: true,
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export type ProductType = 'SKILLPOD' | 'COCKPIT';
export type SkillPodPlanName = keyof typeof SKILLPOD_PLANS;
export type CockpitPlanName = keyof typeof COCKPIT_PLANS;
export type PlanName = SkillPodPlanName | CockpitPlanName;
export type BillingIntervalType = 'MONTHLY' | 'ANNUAL';

/**
 * Get plan configuration by product and plan name
 */
export function getPlanConfig(product: ProductType, planName: string): PlanConfig | undefined {
  const productKey = product.toLowerCase() as 'skillpod' | 'cockpit';
  const plans = PLANS[productKey];
  return plans?.[planName as keyof typeof plans];
}

/**
 * Get the Stripe price ID for a plan
 */
export function getStripePriceId(
  product: ProductType,
  planName: string,
  interval: BillingIntervalType
): string | undefined {
  const plan = getPlanConfig(product, planName);
  if (!plan || 'custom' in plan) {
    return undefined;
  }
  return interval === 'MONTHLY' ? plan.stripePriceIdMonthly : plan.stripePriceIdAnnual;
}

/**
 * Get the price for a plan
 */
export function getPlanPrice(
  product: ProductType,
  planName: string,
  interval: BillingIntervalType
): number | undefined {
  const plan = getPlanConfig(product, planName);
  if (!plan || 'custom' in plan) {
    return undefined;
  }
  return interval === 'MONTHLY' ? plan.monthlyPrice : plan.annualPrice;
}

/**
 * Get usage limit for a plan (in minutes)
 */
export function getUsageLimit(product: ProductType, planName: string): number | null {
  const plan = getPlanConfig(product, planName);
  return plan?.features.hoursPerMonth ?? null;
}

/**
 * Check if a plan is an upgrade from another
 */
export function isUpgrade(product: ProductType, fromPlan: string, toPlan: string): boolean {
  const planOrder =
    product === 'SKILLPOD'
      ? ['starter', 'professional', 'enterprise']
      : ['basic', 'professional', 'enterprise'];

  const fromIndex = planOrder.indexOf(fromPlan);
  const toIndex = planOrder.indexOf(toPlan);

  return toIndex > fromIndex;
}

/**
 * Check if a plan is a downgrade from another
 */
export function isDowngrade(product: ProductType, fromPlan: string, toPlan: string): boolean {
  return isUpgrade(product, toPlan, fromPlan);
}

/**
 * Get trial days for a plan
 */
export function getTrialDays(product: ProductType, planName: string): number {
  const plan = getPlanConfig(product, planName);
  if (!plan || 'custom' in plan) {
    return 0;
  }
  return plan.trialDays ?? TRIAL_CONFIG.defaultTrialDays;
}

/**
 * Calculate overage cost
 */
export function calculateOverageCost(product: ProductType, overageMinutes: number): number {
  if (product !== 'SKILLPOD' || overageMinutes <= 0) {
    return 0;
  }
  return overageMinutes * OVERAGE_RATES.skillpod.pricePerMinute;
}

/**
 * Check if plan change should be immediate or scheduled
 */
export function getPlanChangeScheduling(
  product: ProductType,
  fromPlan: string,
  toPlan: string
): 'immediate' | 'end_of_period' {
  if (isUpgrade(product, fromPlan, toPlan)) {
    return 'immediate';
  }
  return 'end_of_period';
}

/**
 * Get all available plans for a product
 */
export function getAvailablePlans(product: ProductType): string[] {
  const productKey = product.toLowerCase() as 'skillpod' | 'cockpit';
  return Object.keys(PLANS[productKey]);
}

/**
 * Validate if a plan exists for a product
 */
export function isValidPlan(product: ProductType, planName: string): boolean {
  return getAvailablePlans(product).includes(planName);
}
