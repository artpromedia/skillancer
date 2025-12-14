/**
 * @module @skillancer/billing-svc/services/product
 * Product and Price catalog management service
 *
 * NOTE: This service returns data from static config (plans.ts).
 * For database-backed product catalog, run schema migration.
 */

import { getPlanConfig, getAvailablePlans, type ProductType } from '../config/plans.js';
import { BillingError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export type PricingModel = 'FLAT' | 'PER_SEAT' | 'TIERED' | 'USAGE_BASED';
export type BillingInterval = 'MONTHLY' | 'ANNUAL';

export interface ProductResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: ProductType;
  pricingModel: PricingModel;
  features: string[];
  limits: Record<string, unknown>;
  isActive: boolean;
  prices: PriceResponse[];
}

export interface PriceResponse {
  id: string;
  name: string;
  description: string | null;
  tier: string;
  unitAmount: number;
  currency: string;
  interval: BillingInterval;
  intervalCount: number;
  isPerSeat: boolean;
  includedSeats: number | null;
  maxSeats: number | null;
  seatPrice: number | null;
  isMetered: boolean;
  meteringUnit: string | null;
  trialDays: number | null;
  features: string[];
  limits: Record<string, unknown>;
  isPopular: boolean;
  isRecommended: boolean;
}

export interface FeatureComparisonRow {
  name: string;
  description?: string;
  tiers: Record<string, boolean | string | number>;
}

export interface ProductCompareTable {
  features: FeatureComparisonRow[];
  tierOrder: string[];
}

export interface CreateProductInput {
  name: string;
  slug: string;
  description?: string;
  type: ProductType;
  pricingModel: PricingModel;
  features?: string[];
  limits?: Record<string, unknown>;
}

export interface CreatePriceInput {
  productId: string;
  name: string;
  description?: string;
  tier: string;
  unitAmount: number;
  currency?: string;
  interval: BillingInterval;
  intervalCount?: number;
  isPerSeat?: boolean;
  includedSeats?: number;
  maxSeats?: number;
  seatPrice?: number;
  isMetered?: boolean;
  meteringUnit?: string;
  trialDays?: number;
  features?: string[];
  limits?: Record<string, unknown>;
  sortOrder?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
}

// =============================================================================
// FEATURE DEFINITIONS
// =============================================================================

const SKILLPOD_FEATURES: FeatureComparisonRow[] = [
  {
    name: 'VDI Sessions',
    tiers: { starter: '40 hrs/mo', professional: '160 hrs/mo', enterprise: 'Unlimited' },
  },
  {
    name: 'Development Tools',
    tiers: { starter: 'Basic', professional: 'All', enterprise: 'All + Custom' },
  },
  { name: 'Storage', tiers: { starter: '10 GB', professional: '50 GB', enterprise: 'Unlimited' } },
  {
    name: 'Concurrent Sessions',
    tiers: { starter: '1', professional: '3', enterprise: 'Unlimited' },
  },
  { name: 'Priority Support', tiers: { starter: false, professional: true, enterprise: true } },
  { name: 'Dedicated Support', tiers: { starter: false, professional: false, enterprise: true } },
  { name: 'Custom Integrations', tiers: { starter: false, professional: false, enterprise: true } },
  { name: 'SSO/SAML', tiers: { starter: false, professional: false, enterprise: true } },
  { name: 'API Access', tiers: { starter: false, professional: true, enterprise: true } },
  { name: 'Audit Logs', tiers: { starter: false, professional: true, enterprise: true } },
];

const COCKPIT_FEATURES: FeatureComparisonRow[] = [
  { name: 'Client Slots', tiers: { basic: '5', professional: '15', enterprise: 'Unlimited' } },
  {
    name: 'Dashboard Views',
    tiers: { basic: 'Basic', professional: 'Advanced', enterprise: 'Custom' },
  },
  {
    name: 'Integrations',
    tiers: { basic: 'Basic', professional: 'All', enterprise: 'All + Custom' },
  },
  { name: 'Team Members', tiers: { basic: '1', professional: '5', enterprise: 'Unlimited' } },
  { name: 'Priority Support', tiers: { basic: false, professional: true, enterprise: true } },
  {
    name: 'Dedicated Success Manager',
    tiers: { basic: false, professional: false, enterprise: true },
  },
  { name: 'White Labeling', tiers: { basic: false, professional: false, enterprise: true } },
  { name: 'API Access', tiers: { basic: false, professional: true, enterprise: true } },
  { name: 'Advanced Analytics', tiers: { basic: false, professional: true, enterprise: true } },
  { name: 'Custom Reports', tiers: { basic: false, professional: false, enterprise: true } },
];

// Product metadata
const PRODUCT_INFO: Record<ProductType, { name: string; slug: string; description: string }> = {
  SKILLPOD: {
    name: 'SkillPod',
    slug: 'skillpod',
    description: 'Cloud development environments with usage-based billing',
  },
  COCKPIT: {
    name: 'Cockpit',
    slug: 'cockpit',
    description: 'Freelancer business management dashboard',
  },
};

// =============================================================================
// PRODUCT SERVICE (using static config)
// =============================================================================

export class ProductService {
  // ===========================================================================
  // LIST PRODUCTS
  // ===========================================================================

  /**
   * Get all products with prices
   */
  listProducts(filters?: { type?: ProductType }): ProductResponse[] {
    const products: ProductResponse[] = [];
    const productTypes: ProductType[] = filters?.type ? [filters.type] : ['SKILLPOD', 'COCKPIT'];

    for (const productType of productTypes) {
      products.push(this.buildProductResponse(productType));
    }

    return products;
  }

  /**
   * Get product by slug with prices and comparison table
   */
  getProductBySlug(slug: string): {
    product: ProductResponse;
    compareTable: ProductCompareTable;
  } {
    const productType = this.getProductTypeFromSlug(slug);

    if (!productType) {
      throw new BillingError('Product not found', 'PRODUCT_NOT_FOUND', 404);
    }

    const product = this.buildProductResponse(productType);
    const compareTable = this.buildCompareTable(productType);

    return { product, compareTable };
  }

  /**
   * Get product by ID
   */
  getProductById(id: string): ProductResponse {
    // ID could be the product type
    const productType = id.toUpperCase() as ProductType;

    if (!['SKILLPOD', 'COCKPIT'].includes(productType)) {
      throw new BillingError('Product not found', 'PRODUCT_NOT_FOUND', 404);
    }

    return this.buildProductResponse(productType);
  }

  // ===========================================================================
  // PRICE OPERATIONS
  // ===========================================================================

  /**
   * Get price by ID
   */
  getPriceById(id: string): PriceResponse {
    // Try to parse the id as product:plan:interval
    const parts = id.split(':');
    const productKey = parts[0];
    const planKey = parts[1];
    const intervalStr = parts[2];

    if (!productKey || !planKey) {
      throw new BillingError('Price not found', 'PRICE_NOT_FOUND', 404);
    }

    const productType = productKey.toUpperCase() as ProductType;
    const interval = (intervalStr?.toUpperCase() || 'MONTHLY') as BillingInterval;

    const planConfig = getPlanConfig(productType, planKey);
    if (!planConfig) {
      throw new BillingError('Price not found', 'PRICE_NOT_FOUND', 404);
    }

    return this.buildPriceResponse(productType, planKey, planConfig, interval);
  }

  /**
   * Get prices for a product
   */
  getPricesForProduct(productId: string, interval?: BillingInterval): PriceResponse[] {
    const productType = productId.toUpperCase() as ProductType;
    const plans = getAvailablePlans(productType);
    const prices: PriceResponse[] = [];

    for (const planKey of plans) {
      const planConfig = getPlanConfig(productType, planKey);
      if (!planConfig) continue;

      if (interval) {
        prices.push(this.buildPriceResponse(productType, planKey, planConfig, interval));
      } else {
        // Return both monthly and annual
        prices.push(
          this.buildPriceResponse(productType, planKey, planConfig, 'MONTHLY'),
          this.buildPriceResponse(productType, planKey, planConfig, 'ANNUAL')
        );
      }
    }

    return prices;
  }

  /**
   * Get comparison prices for a product type
   */
  getComparisonPrices(
    productType: ProductType,
    interval: BillingInterval = 'MONTHLY'
  ): PriceResponse[] {
    return this.getPricesForProduct(productType, interval);
  }

  // ===========================================================================
  // ADMIN: CREATE PRODUCT/PRICE (STUB - requires schema)
  // ===========================================================================

  /**
   * Create a new product (admin only)
   * NOTE: Requires schema migration
   */
  createProduct(_input: CreateProductInput): ProductResponse {
    throw new BillingError('Product creation requires schema migration', 'NOT_IMPLEMENTED', 501);
  }

  /**
   * Create a new price (admin only)
   * NOTE: Requires schema migration
   */
  createPrice(_input: CreatePriceInput): PriceResponse {
    throw new BillingError('Price creation requires schema migration', 'NOT_IMPLEMENTED', 501);
  }

  // ===========================================================================
  // STRIPE SYNC (STUB)
  // ===========================================================================

  /**
   * Sync products from Stripe
   * NOTE: Requires schema migration
   */
  syncFromStripe(): { created: number; updated: number; errors: number } {
    console.warn('[Product Service] Stripe sync requires schema migration');
    return { created: 0, updated: 0, errors: 0 };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private getProductTypeFromSlug(slug: string): ProductType | null {
    const normalizedSlug = slug.toLowerCase();
    if (normalizedSlug === 'skillpod') return 'SKILLPOD';
    if (normalizedSlug === 'cockpit') return 'COCKPIT';
    return null;
  }

  private buildProductResponse(productType: ProductType): ProductResponse {
    const info = PRODUCT_INFO[productType];
    const prices = this.getAllPricesForProduct(productType);
    const planKeys = getAvailablePlans(productType);
    const firstPlanConfig = getPlanConfig(productType, planKeys[0] ?? '');
    const features = firstPlanConfig?.features.tools ?? [];

    return {
      id: productType,
      name: info.name,
      slug: info.slug,
      description: info.description,
      type: productType,
      pricingModel: productType === 'COCKPIT' ? 'PER_SEAT' : 'USAGE_BASED',
      features: features as string[],
      limits: {},
      isActive: true,
      prices,
    };
  }

  private getAllPricesForProduct(productType: ProductType): PriceResponse[] {
    const planKeys = getAvailablePlans(productType);
    const prices: PriceResponse[] = [];

    for (const planKey of planKeys) {
      const planConfig = getPlanConfig(productType, planKey);
      if (!planConfig) continue;

      prices.push(
        this.buildPriceResponse(productType, planKey, planConfig, 'MONTHLY'),
        this.buildPriceResponse(productType, planKey, planConfig, 'ANNUAL')
      );
    }

    return prices;
  }

  private buildPriceResponse(
    productType: ProductType,
    planKey: string,
    planConfig: ReturnType<typeof getPlanConfig>,
    interval: BillingInterval
  ): PriceResponse {
    if (!planConfig) {
      throw new BillingError('Plan not found', 'PLAN_NOT_FOUND', 404);
    }

    // Handle enterprise (custom) plans
    const isCustom = 'custom' in planConfig && planConfig.custom === true;
    let unitAmount = 0;
    if (!isCustom) {
      if (interval === 'ANNUAL') {
        unitAmount = (planConfig as { annualPrice: number }).annualPrice;
      } else {
        unitAmount = (planConfig as { monthlyPrice: number }).monthlyPrice;
      }
    }

    const trialDays = isCustom ? null : ((planConfig as { trialDays?: number }).trialDays ?? 14);
    const features = planConfig.features.tools;

    return {
      id: `${productType.toLowerCase()}:${planKey}:${interval.toLowerCase()}`,
      name: planConfig.name,
      description: null,
      tier: planKey,
      unitAmount,
      currency: 'usd',
      interval,
      intervalCount: interval === 'ANNUAL' ? 12 : 1,
      isPerSeat: productType === 'COCKPIT',
      includedSeats: productType === 'COCKPIT' ? 1 : null,
      maxSeats: null,
      seatPrice: null,
      isMetered: productType === 'SKILLPOD',
      meteringUnit: productType === 'SKILLPOD' ? 'minutes' : null,
      trialDays,
      features: features as string[],
      limits: planConfig.features.hoursPerMonth
        ? { minutes: planConfig.features.hoursPerMonth }
        : {},
      isPopular: planKey === 'professional',
      isRecommended: planKey === 'professional',
    };
  }

  private buildCompareTable(productType: ProductType): ProductCompareTable {
    const features = productType === 'SKILLPOD' ? SKILLPOD_FEATURES : COCKPIT_FEATURES;
    const tierOrder =
      productType === 'SKILLPOD'
        ? ['starter', 'professional', 'enterprise']
        : ['basic', 'professional', 'enterprise'];

    return { features, tierOrder };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let serviceInstance: ProductService | null = null;

export function getProductService(): ProductService {
  serviceInstance ??= new ProductService();
  return serviceInstance;
}

export function initializeProductService(): void {
  serviceInstance = new ProductService();
}
