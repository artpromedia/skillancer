/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions */
/**
 * @module @skillancer/billing-svc/services/coupon
 * Coupon and promotion code management service
 */

import { prisma } from '@skillancer/database';

import { getStripeService } from './stripe.service.js';
import { BillingError } from '../errors/index.js';

import type { Coupon, CouponRedemption } from '@skillancer/database';

// =============================================================================
// TYPES
// =============================================================================

export interface CouponResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: 'PERCENT' | 'AMOUNT';
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: 'ONCE' | 'REPEATING' | 'FOREVER';
  durationMonths: number | null;
  maxRedemptions: number | null;
  currentRedemptions: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  isValid: boolean;
  validProductTypes: string[];
}

export interface CouponValidation {
  valid: boolean;
  coupon: CouponResponse | null;
  reason?: string;
}

export interface CreateCouponParams {
  code: string;
  name: string;
  description?: string;
  discountType: 'PERCENT' | 'AMOUNT';
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: 'ONCE' | 'REPEATING' | 'FOREVER';
  durationMonths?: number;
  maxRedemptions?: number;
  validProductTypes?: string[];
  minimumAmount?: number;
  validFrom?: Date;
  validUntil?: Date;
}

export interface ApplyCouponResult {
  discount: {
    type: 'PERCENT' | 'AMOUNT';
    value: number;
    currency?: string;
  };
  originalAmount: number;
  discountedAmount: number;
  savings: number;
}

// =============================================================================
// COUPON SERVICE
// =============================================================================

export class CouponService {
  private _stripeService: ReturnType<typeof getStripeService> | null = null;

  private get stripeService() {
    if (!this._stripeService) {
      this._stripeService = getStripeService();
    }
    return this._stripeService;
  }

  // ===========================================================================
  // CREATE COUPON
  // ===========================================================================

  /**
   * Create a new coupon
   */
  async createCoupon(params: CreateCouponParams): Promise<CouponResponse> {
    // Validate params
    if (params.discountType === 'PERCENT' && !params.percentOff) {
      throw new BillingError('percentOff required for PERCENT discount', 'INVALID_PARAMS', 400);
    }
    if (params.discountType === 'AMOUNT' && (!params.amountOff || !params.currency)) {
      throw new BillingError(
        'amountOff and currency required for AMOUNT discount',
        'INVALID_PARAMS',
        400
      );
    }
    if (params.duration === 'REPEATING' && !params.durationMonths) {
      throw new BillingError(
        'durationMonths required for REPEATING duration',
        'INVALID_PARAMS',
        400
      );
    }

    // Check if code already exists
    const existing = await prisma.coupon.findUnique({
      where: { code: params.code },
    });
    if (existing) {
      throw new BillingError('Coupon code already exists', 'COUPON_EXISTS', 409);
    }

    // Create in Stripe first
    const stripeCoupon = await this.stripeService.createCoupon({
      id: params.code.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name: params.name,
      percentOff: params.percentOff,
      amountOff: params.amountOff,
      currency: params.currency,
      duration: params.duration.toLowerCase() as 'forever' | 'once' | 'repeating',
      durationInMonths: params.durationMonths,
      maxRedemptions: params.maxRedemptions,
      metadata: {
        code: params.code,
        validProductTypes: params.validProductTypes?.join(',') ?? '',
      },
    });

    // Create local record
    const coupon = await prisma.coupon.create({
      data: {
        stripeCouponId: stripeCoupon.id,
        code: params.code,
        name: params.name,
        description: params.description ?? null,
        discountType: params.discountType,
        percentOff: params.percentOff ? Number(params.percentOff) : null,
        amountOff: params.amountOff ? Number(params.amountOff) : null,
        currency: params.currency ?? null,
        duration: params.duration,
        durationMonths: params.durationMonths ?? null,
        maxRedemptions: params.maxRedemptions ?? null,
        validProductTypes: params.validProductTypes ?? [],
        minimumAmount: params.minimumAmount ? Number(params.minimumAmount) : null,
        validFrom: params.validFrom ?? new Date(),
        validUntil: params.validUntil ?? null,
        isActive: true,
      },
    });

    return this.mapCouponResponse(coupon);
  }

  // ===========================================================================
  // GET COUPON
  // ===========================================================================

  /**
   * Get coupon by code
   */
  async getCouponByCode(code: string): Promise<CouponResponse | null> {
    const coupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon) {
      return null;
    }

    return this.mapCouponResponse(coupon);
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(id: string): Promise<CouponResponse> {
    const coupon = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new BillingError('Coupon not found', 'COUPON_NOT_FOUND', 404);
    }

    return this.mapCouponResponse(coupon);
  }

  /**
   * List all coupons
   */
  async listCoupons(options?: {
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ coupons: CouponResponse[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = options?.activeOnly ? { isActive: true } : {};

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coupon.count({ where }),
    ]);

    return {
      coupons: coupons.map((c) => this.mapCouponResponse(c)),
      total,
    };
  }

  // ===========================================================================
  // VALIDATE COUPON
  // ===========================================================================

  /**
   * Validate a coupon code
   */
  async validateCoupon(
    code: string,
    options?: {
      userId?: string;
      productType?: string;
      amount?: number;
    }
  ): Promise<CouponValidation> {
    const coupon = await prisma.coupon.findUnique({
      where: { code },
    });

    if (!coupon) {
      return {
        valid: false,
        coupon: null,
        reason: 'Coupon not found',
      };
    }

    // Check if active
    if (!coupon.isActive) {
      return {
        valid: false,
        coupon: this.mapCouponResponse(coupon),
        reason: 'Coupon is not active',
      };
    }

    // Check validity period
    const now = new Date();
    if (now < coupon.validFrom) {
      return {
        valid: false,
        coupon: this.mapCouponResponse(coupon),
        reason: 'Coupon is not yet valid',
      };
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      return {
        valid: false,
        coupon: this.mapCouponResponse(coupon),
        reason: 'Coupon has expired',
      };
    }

    // Check redemption limit
    if (coupon.maxRedemptions && coupon.currentRedemptions >= coupon.maxRedemptions) {
      return {
        valid: false,
        coupon: this.mapCouponResponse(coupon),
        reason: 'Coupon has reached maximum redemptions',
      };
    }

    // Check product type restriction
    if (options?.productType && coupon.validProductTypes.length > 0) {
      if (!coupon.validProductTypes.includes(options.productType)) {
        return {
          valid: false,
          coupon: this.mapCouponResponse(coupon),
          reason: `Coupon not valid for ${options.productType}`,
        };
      }
    }

    // Check minimum amount
    if (options?.amount && coupon.minimumAmount) {
      if (options.amount < Number(coupon.minimumAmount)) {
        return {
          valid: false,
          coupon: this.mapCouponResponse(coupon),
          reason: `Minimum order amount of ${coupon.minimumAmount} required`,
        };
      }
    }

    // Check user hasn't already used this coupon (for per-user limits)
    if (options?.userId) {
      const userRedemption = await prisma.couponRedemption.findFirst({
        where: {
          couponId: coupon.id,
          userId: options.userId,
        },
      });

      if (userRedemption) {
        return {
          valid: false,
          coupon: this.mapCouponResponse(coupon),
          reason: 'You have already used this coupon',
        };
      }
    }

    return {
      valid: true,
      coupon: this.mapCouponResponse(coupon),
    };
  }

  // ===========================================================================
  // APPLY COUPON
  // ===========================================================================

  /**
   * Calculate discount for an amount
   */
  calculateDiscount(coupon: CouponResponse, amount: number): ApplyCouponResult {
    let savings: number;

    if (coupon.discountType === 'PERCENT' && coupon.percentOff) {
      savings = Math.round(amount * (coupon.percentOff / 100));
    } else if (coupon.discountType === 'AMOUNT' && coupon.amountOff) {
      savings = Math.min(coupon.amountOff, amount);
    } else {
      savings = 0;
    }

    return {
      discount: {
        type: coupon.discountType,
        value:
          coupon.discountType === 'PERCENT' ? (coupon.percentOff ?? 0) : (coupon.amountOff ?? 0),
        currency: coupon.currency ?? undefined,
      },
      originalAmount: amount,
      discountedAmount: amount - savings,
      savings,
    };
  }

  /**
   * Record a coupon redemption
   */
  async recordRedemption(params: {
    couponId: string;
    userId: string;
    subscriptionId?: string;
    discountAmount: number;
    currency: string;
  }): Promise<CouponRedemption> {
    // Update coupon redemption count
    await prisma.coupon.update({
      where: { id: params.couponId },
      data: {
        currentRedemptions: { increment: 1 },
      },
    });

    // Create redemption record
    return prisma.couponRedemption.create({
      data: {
        couponId: params.couponId,
        userId: params.userId,
        subscriptionId: params.subscriptionId ?? null,
        discountAmount: params.discountAmount,
        currency: params.currency,
      },
    });
  }

  // ===========================================================================
  // MANAGE COUPONS
  // ===========================================================================

  /**
   * Deactivate a coupon
   */
  async deactivateCoupon(id: string): Promise<CouponResponse> {
    const coupon = await prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });

    // Also deactivate in Stripe
    try {
      await this.stripeService.deleteCoupon(coupon.stripeCouponId);
    } catch {
      // Coupon may already be deleted in Stripe
    }

    return this.mapCouponResponse(coupon);
  }

  /**
   * Update coupon details (limited fields)
   */
  async updateCoupon(
    id: string,
    updates: {
      name?: string;
      description?: string;
      validUntil?: Date | null;
      maxRedemptions?: number | null;
    }
  ): Promise<CouponResponse> {
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        name: updates.name,
        description: updates.description,
        validUntil: updates.validUntil,
        maxRedemptions: updates.maxRedemptions,
      },
    });

    return this.mapCouponResponse(coupon);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapCouponResponse(coupon: Coupon): CouponResponse {
    const now = new Date();
    const validUntil = coupon.validUntil as Date | null;
    const isExpired = validUntil ? now > validUntil : false;
    const maxRedemptions = coupon.maxRedemptions as number | null;
    const currentRedemptions = coupon.currentRedemptions as number;
    const isRedeemable = !maxRedemptions || currentRedemptions < maxRedemptions;
    const isActive = coupon.isActive as boolean;
    const validFrom = coupon.validFrom as Date;
    const isValid = isActive && !isExpired && isRedeemable && now >= validFrom;

    const id = coupon.id as string;
    const code = coupon.code as string;
    const name = coupon.name as string;
    const description = coupon.description as string | null;
    const discountType = coupon.discountType as string;
    const percentOff = coupon.percentOff;
    const amountOff = coupon.amountOff;
    const currency = coupon.currency as string | null;
    const duration = coupon.duration as string;
    const durationMonths = coupon.durationMonths as number | null;
    const validProductTypes = coupon.validProductTypes as string[];

    return {
      id,
      code,
      name,
      description,
      discountType,
      percentOff: percentOff ? Number(percentOff) : null,
      amountOff: amountOff ? Number(amountOff) : null,
      currency,
      duration,
      durationMonths,
      maxRedemptions,
      currentRedemptions,
      validFrom: validFrom.toISOString(),
      validUntil: validUntil?.toISOString() ?? null,
      isActive,
      isValid,
      validProductTypes,
    };
  }
}

// =============================================================================
// SERVICE SINGLETON
// =============================================================================

let couponServiceInstance: CouponService | null = null;

export function getCouponService(): CouponService {
  if (!couponServiceInstance) {
    couponServiceInstance = new CouponService();
  }
  return couponServiceInstance;
}

export function resetCouponService(): void {
  couponServiceInstance = null;
}
