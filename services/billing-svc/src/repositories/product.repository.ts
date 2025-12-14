/**
 * @module @skillancer/billing-svc/repositories/product
 * Product and Price data access layer
 *
 * NOTE: This repository requires the Product and Price models to be added to the schema.
 * Run the schema migration before using this repository in production.
 * See docs/database/migrations.md for instructions.
 */

import type { Prisma } from '@skillancer/database';

// =============================================================================
// TYPES
// =============================================================================

export type ProductType = 'SKILLPOD' | 'COCKPIT' | 'MARKET_PREMIUM';
export type PricingModel = 'FLAT_RATE' | 'PER_SEAT' | 'USAGE_BASED' | 'TIERED';
export type BillingInterval = 'MONTHLY' | 'ANNUAL' | 'MONTH' | 'YEAR';

export interface ProductRecord {
  id: string;
  stripeProductId: string;
  name: string;
  slug: string;
  description: string | null;
  type: ProductType;
  pricingModel: PricingModel;
  features: Prisma.JsonValue;
  limits: Prisma.JsonValue;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  prices?: PriceRecord[];
}

export interface PriceRecord {
  id: string;
  productId: string;
  stripePriceId: string;
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
  features: Prisma.JsonValue;
  limits: Prisma.JsonValue;
  sortOrder: number;
  isPopular: boolean;
  isRecommended: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: ProductRecord;
}

export interface CreateProductData {
  stripeProductId: string;
  name: string;
  slug: string;
  description?: string;
  type: ProductType;
  pricingModel: PricingModel;
  features?: Prisma.InputJsonValue;
  limits?: Prisma.InputJsonValue;
  isActive?: boolean;
}

export interface UpdateProductData {
  name?: string;
  description?: string;
  features?: Prisma.InputJsonValue;
  limits?: Prisma.InputJsonValue;
  isActive?: boolean;
}

export interface CreatePriceData {
  productId: string;
  stripePriceId: string;
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
  features?: Prisma.InputJsonValue;
  limits?: Prisma.InputJsonValue;
  sortOrder?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
  isActive?: boolean;
}

export interface UpdatePriceData {
  name?: string;
  description?: string;
  features?: Prisma.InputJsonValue;
  limits?: Prisma.InputJsonValue;
  sortOrder?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
  isActive?: boolean;
}

export interface ProductFilters {
  type?: ProductType;
  isActive?: boolean;
}

export interface PriceFilters {
  productId?: string;
  tier?: string;
  interval?: BillingInterval;
  isActive?: boolean;
  isPerSeat?: boolean;
  isMetered?: boolean;
}

// =============================================================================
// STUB ERROR
// =============================================================================

const SCHEMA_ERROR = new Error(
  'Product/Price tables not available. Run database migration first. ' +
    'See docs/database/migrations.md for instructions.'
);

// =============================================================================
// PRODUCT REPOSITORY (Stub)
// =============================================================================

export class ProductRepository {
  create(_data: CreateProductData): ProductRecord {
    throw SCHEMA_ERROR;
  }

  findById(_id: string): ProductRecord | null {
    throw SCHEMA_ERROR;
  }

  findBySlug(_slug: string): ProductRecord | null {
    throw SCHEMA_ERROR;
  }

  findByStripeId(_stripeProductId: string): ProductRecord | null {
    throw SCHEMA_ERROR;
  }

  findAll(_filters?: ProductFilters): ProductRecord[] {
    throw SCHEMA_ERROR;
  }

  update(_id: string, _data: UpdateProductData): ProductRecord {
    throw SCHEMA_ERROR;
  }

  deactivate(_id: string): ProductRecord {
    throw SCHEMA_ERROR;
  }
}

// =============================================================================
// PRICE REPOSITORY (Stub)
// =============================================================================

export class PriceRepository {
  create(_data: CreatePriceData): PriceRecord {
    throw SCHEMA_ERROR;
  }

  findById(_id: string): PriceRecord | null {
    throw SCHEMA_ERROR;
  }

  findByStripeId(_stripePriceId: string): PriceRecord | null {
    throw SCHEMA_ERROR;
  }

  findByProductId(_productId: string, _filters?: PriceFilters): PriceRecord[] {
    throw SCHEMA_ERROR;
  }

  findAll(_filters?: PriceFilters): PriceRecord[] {
    throw SCHEMA_ERROR;
  }

  update(_id: string, _data: UpdatePriceData): PriceRecord {
    throw SCHEMA_ERROR;
  }

  deactivate(_id: string): PriceRecord {
    throw SCHEMA_ERROR;
  }

  getComparisonPrices(_productType: ProductType, _interval?: BillingInterval): PriceRecord[] {
    throw SCHEMA_ERROR;
  }
}

// =============================================================================
// SINGLETON INSTANCES
// =============================================================================

let productRepositoryInstance: ProductRepository | null = null;
let priceRepositoryInstance: PriceRepository | null = null;

export function getProductRepository(): ProductRepository {
  productRepositoryInstance ??= new ProductRepository();
  return productRepositoryInstance;
}

export function getPriceRepository(): PriceRepository {
  priceRepositoryInstance ??= new PriceRepository();
  return priceRepositoryInstance;
}

export function initializeProductRepositories(): void {
  productRepositoryInstance = new ProductRepository();
  priceRepositoryInstance = new PriceRepository();
}
