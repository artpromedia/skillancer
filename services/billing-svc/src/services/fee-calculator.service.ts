/**
 * @module @skillancer/billing-svc/services/fee-calculator
 * Fee calculation service for escrow transactions
 */

import type {
  FeeCalculation,
  FeePreview,
  DisputeSplitCalculation,
  HourlyBillingCalculation,
} from '../types/escrow.types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Stripe processing fee percentage */
const STRIPE_PROCESSING_FEE_PERCENT = 2.9;

/** Stripe fixed processing fee in dollars */
const STRIPE_PROCESSING_FEE_FIXED = 0.3;

/** Default platform fee percentage */
const DEFAULT_PLATFORM_FEE_PERCENT = 10;

/** Default secure mode fee percentage */
const DEFAULT_SECURE_MODE_FEE_PERCENT = 5;

// =============================================================================
// FEE CALCULATOR SERVICE
// =============================================================================

export class FeeCalculatorService {
  /**
   * Round to 2 decimal places for currency
   */
  private roundCurrency(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Calculate fees for escrow funding
   * This calculates what the client will be charged
   */
  calculateEscrowFees(params: {
    amount: number;
    platformFeePercent?: number;
    secureMode?: boolean;
    secureModeFeePercent?: number;
  }): FeeCalculation {
    const {
      amount,
      platformFeePercent = DEFAULT_PLATFORM_FEE_PERCENT,
      secureMode = false,
      secureModeFeePercent = DEFAULT_SECURE_MODE_FEE_PERCENT,
    } = params;

    // Platform fee (charged to client, goes to platform)
    const platformFee = this.roundCurrency(amount * (platformFeePercent / 100));

    // Secure mode fee (additional fee for SkillPod integration)
    const secureModeAmount =
      secureMode && secureModeFeePercent
        ? this.roundCurrency(amount * (secureModeFeePercent / 100))
        : 0;

    // Calculate total before processing fee
    const totalBeforeProcessing = amount + platformFee + secureModeAmount;

    // Stripe processing fee (charged to client)
    const processingFee = this.roundCurrency(
      totalBeforeProcessing * (STRIPE_PROCESSING_FEE_PERCENT / 100) + STRIPE_PROCESSING_FEE_FIXED
    );

    // Total charge to client
    const totalCharge = this.roundCurrency(totalBeforeProcessing + processingFee);

    // Net amount that will be held in escrow (milestone amount)
    const netAmount = amount;

    return {
      grossAmount: amount,
      platformFee,
      platformFeePercent,
      secureModeAmount,
      processingFee,
      netAmount,
      totalCharge,
    };
  }

  /**
   * Calculate fees for releasing funds to freelancer
   * Platform fee is deducted from the release amount
   */
  calculateReleaseFees(params: {
    amount: number;
    platformFeePercent?: number;
    secureMode?: boolean;
    secureModeFeePercent?: number;
  }): FeeCalculation {
    const {
      amount,
      platformFeePercent = DEFAULT_PLATFORM_FEE_PERCENT,
      secureMode = false,
      secureModeFeePercent = DEFAULT_SECURE_MODE_FEE_PERCENT,
    } = params;

    // Platform fee deducted from release
    const platformFee = this.roundCurrency(amount * (platformFeePercent / 100));

    // Secure mode fee deducted from release
    const secureModeAmount =
      secureMode && secureModeFeePercent
        ? this.roundCurrency(amount * (secureModeFeePercent / 100))
        : 0;

    // No additional processing fee on release (already paid on funding)
    const processingFee = 0;

    // Net amount to freelancer
    const netAmount = this.roundCurrency(amount - platformFee - secureModeAmount);

    return {
      grossAmount: amount,
      platformFee,
      platformFeePercent,
      secureModeAmount,
      processingFee,
      netAmount,
      totalCharge: amount,
    };
  }

  /**
   * Get a detailed fee preview with breakdown
   */
  getFeesPreview(params: {
    amount: number;
    platformFeePercent?: number;
    secureMode?: boolean;
    secureModeFeePercent?: number;
  }): FeePreview {
    const fees = this.calculateEscrowFees(params);

    const breakdown = [
      {
        label: 'Contract Amount',
        amount: fees.grossAmount,
        description: 'Amount to be held in escrow',
      },
      {
        label: `Platform Fee (${fees.platformFeePercent}%)`,
        amount: fees.platformFee,
        description: 'Skillancer service fee',
      },
    ];

    if (fees.secureModeAmount > 0) {
      breakdown.push({
        label: `Secure Mode Fee (${params.secureModeFeePercent ?? DEFAULT_SECURE_MODE_FEE_PERCENT}%)`,
        amount: fees.secureModeAmount,
        description: 'SkillPod verified work environment',
      });
    }

    breakdown.push(
      {
        label: 'Payment Processing',
        amount: fees.processingFee,
        description: 'Credit card processing fee',
      },
      {
        label: 'Total Charge',
        amount: fees.totalCharge,
        description: 'Total amount charged to your card',
      }
    );

    return {
      ...fees,
      breakdown,
    };
  }

  /**
   * Calculate split for dispute resolution
   */
  calculateDisputeSplit(params: {
    totalAmount: number;
    clientPercent: number;
    platformFeePercent?: number;
  }): DisputeSplitCalculation {
    const {
      totalAmount,
      clientPercent,
      platformFeePercent = DEFAULT_PLATFORM_FEE_PERCENT,
    } = params;

    // Client refund (no fees on refund)
    const clientRefund = this.roundCurrency(totalAmount * (clientPercent / 100));

    // Freelancer gross (remaining after client refund)
    const freelancerGross = totalAmount - clientRefund;

    // Platform fee only on freelancer portion
    const platformFee = this.roundCurrency(freelancerGross * (platformFeePercent / 100));

    // Freelancer net payout
    const freelancerPayout = this.roundCurrency(freelancerGross - platformFee);

    return {
      clientRefund,
      freelancerPayout,
      platformFee,
    };
  }

  /**
   * Calculate custom split amounts for dispute resolution
   */
  calculateCustomSplit(params: {
    totalAmount: number;
    clientRefundAmount: number;
    platformFeePercent?: number;
  }): DisputeSplitCalculation {
    const {
      totalAmount,
      clientRefundAmount,
      platformFeePercent = DEFAULT_PLATFORM_FEE_PERCENT,
    } = params;

    // Validate amounts
    if (clientRefundAmount > totalAmount) {
      throw new Error('Client refund amount cannot exceed total amount');
    }

    if (clientRefundAmount < 0) {
      throw new Error('Client refund amount cannot be negative');
    }

    // Freelancer gross (remaining after client refund)
    const freelancerGross = this.roundCurrency(totalAmount - clientRefundAmount);

    // Platform fee only on freelancer portion
    const platformFee = this.roundCurrency(freelancerGross * (platformFeePercent / 100));

    // Freelancer net payout
    const freelancerPayout = this.roundCurrency(freelancerGross - platformFee);

    return {
      clientRefund: clientRefundAmount,
      freelancerPayout,
      platformFee,
    };
  }

  /**
   * Calculate hourly billing amount
   */
  calculateHourlyBilling(params: {
    hours: number;
    hourlyRate: number;
    platformFeePercent?: number;
  }): HourlyBillingCalculation {
    const { hours, hourlyRate, platformFeePercent = DEFAULT_PLATFORM_FEE_PERCENT } = params;

    const grossAmount = this.roundCurrency(hours * hourlyRate);
    const platformFee = this.roundCurrency(grossAmount * (platformFeePercent / 100));
    const netAmount = this.roundCurrency(grossAmount - platformFee);

    return { grossAmount, platformFee, netAmount };
  }

  /**
   * Calculate time log billing from minutes
   */
  calculateTimeLogBilling(params: {
    durationMinutes: number;
    hourlyRate: number;
    platformFeePercent?: number;
  }): HourlyBillingCalculation {
    const hours = params.durationMinutes / 60;
    return this.calculateHourlyBilling({
      hours,
      hourlyRate: params.hourlyRate,
      ...(params.platformFeePercent !== undefined && {
        platformFeePercent: params.platformFeePercent,
      }),
    });
  }

  /**
   * Calculate the amount needed to fund escrow to cover a specific net release
   * (Reverse calculation)
   */
  calculateRequiredFunding(params: {
    desiredNetAmount: number;
    platformFeePercent?: number;
    secureMode?: boolean;
    secureModeFeePercent?: number;
  }): FeeCalculation {
    const {
      desiredNetAmount,
      platformFeePercent = DEFAULT_PLATFORM_FEE_PERCENT,
      secureMode = false,
      secureModeFeePercent = DEFAULT_SECURE_MODE_FEE_PERCENT,
    } = params;

    // Calculate gross amount needed for desired net
    // netAmount = grossAmount - platformFee - secureModeAmount
    // netAmount = grossAmount * (1 - platformFeePercent/100 - secureModeFeePercent/100)
    const totalFeePercent =
      platformFeePercent + (secureMode && secureModeFeePercent ? secureModeFeePercent : 0);
    const grossAmount = this.roundCurrency(desiredNetAmount / (1 - totalFeePercent / 100));

    // Now calculate full fees with this gross amount
    return this.calculateEscrowFees({
      amount: grossAmount,
      platformFeePercent,
      secureMode,
      secureModeFeePercent,
    });
  }

  /**
   * Validate that a refund amount is valid
   */
  validateRefundAmount(params: {
    requestedAmount: number;
    availableBalance: number;
    frozenAmount: number;
  }): { valid: boolean; maxRefundable: number; error?: string } {
    const { requestedAmount, availableBalance, frozenAmount } = params;
    const maxRefundable = this.roundCurrency(availableBalance - frozenAmount);

    if (requestedAmount <= 0) {
      return { valid: false, maxRefundable, error: 'Refund amount must be positive' };
    }

    if (requestedAmount > maxRefundable) {
      return {
        valid: false,
        maxRefundable,
        error: `Insufficient available balance. Maximum refundable: ${maxRefundable}`,
      };
    }

    return { valid: true, maxRefundable };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let feeCalculatorInstance: FeeCalculatorService | null = null;

export function getFeeCalculatorService(): FeeCalculatorService {
  feeCalculatorInstance ??= new FeeCalculatorService();
  return feeCalculatorInstance;
}

export function resetFeeCalculatorService(): void {
  feeCalculatorInstance = null;
}
