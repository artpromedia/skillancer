/**
 * Platform Fee Service
 *
 * Manages platform fees on engagements facilitated through the marketplace.
 * Fee structure decreases over time to reward long-term relationships.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import type { Decimal } from '@prisma/client/runtime/library';

// Platform Fee Structure
// - First 3 months: 15%
// - Months 4-12: 10%
// - After 12 months: 5%
// - Direct/referred clients: 0% (executive pays subscription only)

export const PLATFORM_FEE_TIERS = {
  MONTHS_1_3: { minMonth: 1, maxMonth: 3, percentage: 15 },
  MONTHS_4_12: { minMonth: 4, maxMonth: 12, percentage: 10 },
  MONTHS_13_PLUS: { minMonth: 13, maxMonth: Infinity, percentage: 5 },
  DIRECT: { percentage: 0 }, // Direct clients, no marketplace fee
} as const;

interface CalculateFeeParams {
  engagementId: string;
  grossAmount: number;
  billingMonth: number;
  periodStart: Date;
  periodEnd: Date;
}

interface FeeSummary {
  totalGross: number;
  totalFees: number;
  totalNet: number;
  feesByMonth: Array<{
    month: number;
    grossAmount: number;
    feePercentage: number;
    feeAmount: number;
    netAmount: number;
  }>;
}

export class PlatformFeeService {
  private readonly logger = logger.child({ service: 'PlatformFeeService' });

  /**
   * Get the fee percentage based on engagement month
   */
  getFeePercentage(month: number, isDirectClient = false): number {
    if (isDirectClient) {
      return PLATFORM_FEE_TIERS.DIRECT.percentage;
    }

    if (
      month >= PLATFORM_FEE_TIERS.MONTHS_1_3.minMonth &&
      month <= PLATFORM_FEE_TIERS.MONTHS_1_3.maxMonth
    ) {
      return PLATFORM_FEE_TIERS.MONTHS_1_3.percentage;
    }

    if (
      month >= PLATFORM_FEE_TIERS.MONTHS_4_12.minMonth &&
      month <= PLATFORM_FEE_TIERS.MONTHS_4_12.maxMonth
    ) {
      return PLATFORM_FEE_TIERS.MONTHS_4_12.percentage;
    }

    return PLATFORM_FEE_TIERS.MONTHS_13_PLUS.percentage;
  }

  /**
   * Calculate platform fee for a billing period
   */
  calculatePlatformFee(
    grossAmount: number,
    billingMonth: number,
    isDirectClient = false
  ): {
    feePercentage: number;
    feeAmount: number;
    netAmount: number;
  } {
    const feePercentage = this.getFeePercentage(billingMonth, isDirectClient);
    const feeAmount = Math.round(((grossAmount * feePercentage) / 100) * 100) / 100;
    const netAmount = grossAmount - feeAmount;

    return {
      feePercentage,
      feeAmount,
      netAmount,
    };
  }

  /**
   * Record a platform fee for an engagement billing period
   */
  async recordPlatformFee(params: CalculateFeeParams) {
    const { engagementId, grossAmount, billingMonth, periodStart, periodEnd } = params;

    this.logger.info({ engagementId, grossAmount, billingMonth }, 'Recording platform fee');

    // Check if engagement is direct/referred
    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    // Determine if this is a marketplace-facilitated engagement
    // For now, assume all engagements go through marketplace
    const isDirectClient = false; // Would check engagement.source or similar

    const { feePercentage, feeAmount, netAmount } = this.calculatePlatformFee(
      grossAmount,
      billingMonth,
      isDirectClient
    );

    const feeRecord = await prisma.platformFeeRecord.create({
      data: {
        engagementId,
        billingMonth,
        periodStart,
        periodEnd,
        grossAmount,
        feePercentage,
        feeAmount,
        netAmount,
        status: 'PENDING',
      },
    });

    this.logger.info({ feeId: feeRecord.id, feeAmount, feePercentage }, 'Platform fee recorded');

    return feeRecord;
  }

  /**
   * Deduct platform fee from a payment
   */
  async deductPlatformFee(paymentId: string, feeRecordId: string) {
    this.logger.info({ paymentId, feeRecordId }, 'Deducting platform fee');

    const feeRecord = await prisma.platformFeeRecord.findUnique({
      where: { id: feeRecordId },
    });

    if (!feeRecord) {
      throw new Error('Fee record not found');
    }

    // In production, this would:
    // 1. Use Stripe Connect to split the payment
    // 2. Keep feeAmount on platform account
    // 3. Transfer netAmount to executive's connected account

    const updated = await prisma.platformFeeRecord.update({
      where: { id: feeRecordId },
      data: {
        status: 'PROCESSING',
        stripePaymentId: paymentId,
      },
    });

    // Simulate successful processing
    await prisma.platformFeeRecord.update({
      where: { id: feeRecordId },
      data: {
        status: 'COMPLETED',
        paidAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get fee summary for an executive over a period
   */
  async getFeeSummary(
    executiveId: string,
    period?: { start: Date; end: Date }
  ): Promise<FeeSummary> {
    const where: {
      engagement: { executiveId: string };
      periodStart?: { gte: Date };
      periodEnd?: { lte: Date };
    } = {
      engagement: { executiveId },
    };

    if (period) {
      where.periodStart = { gte: period.start };
      where.periodEnd = { lte: period.end };
    }

    const feeRecords = await prisma.platformFeeRecord.findMany({
      where,
      orderBy: { billingMonth: 'asc' },
    });

    const totalGross = feeRecords.reduce((sum, r) => sum + (r.grossAmount as unknown as number), 0);
    const totalFees = feeRecords.reduce((sum, r) => sum + (r.feeAmount as unknown as number), 0);
    const totalNet = feeRecords.reduce((sum, r) => sum + (r.netAmount as unknown as number), 0);

    const feesByMonth = feeRecords.map((r) => ({
      month: r.billingMonth,
      grossAmount: r.grossAmount as unknown as number,
      feePercentage: r.feePercentage as unknown as number,
      feeAmount: r.feeAmount as unknown as number,
      netAmount: r.netAmount as unknown as number,
    }));

    return {
      totalGross,
      totalFees,
      totalNet,
      feesByMonth,
    };
  }

  /**
   * Get pending fees for processing
   */
  async getPendingFees(limit = 100) {
    return prisma.platformFeeRecord.findMany({
      where: { status: 'PENDING' },
      take: limit,
      include: {
        engagement: {
          select: {
            id: true,
            title: true,
            executiveId: true,
            clientTenantId: true,
          },
        },
      },
    });
  }

  /**
   * Get fee breakdown for an engagement
   */
  async getEngagementFees(engagementId: string) {
    const feeRecords = await prisma.platformFeeRecord.findMany({
      where: { engagementId },
      orderBy: { billingMonth: 'asc' },
    });

    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: engagementId },
      select: { startDate: true, title: true },
    });

    return {
      engagement,
      currentMonth: feeRecords.length + 1,
      nextFeePercentage: this.getFeePercentage(feeRecords.length + 1),
      feeRecords,
      totals: {
        gross: feeRecords.reduce((sum, r) => sum + (r.grossAmount as unknown as number), 0),
        fees: feeRecords.reduce((sum, r) => sum + (r.feeAmount as unknown as number), 0),
        net: feeRecords.reduce((sum, r) => sum + (r.netAmount as unknown as number), 0),
      },
    };
  }

  /**
   * Estimate fees for a potential engagement
   */
  estimateFees(
    monthlyRate: number,
    durationMonths: number
  ): {
    months: Array<{ month: number; gross: number; fee: number; net: number; percentage: number }>;
    totals: { gross: number; fees: number; net: number; avgPercentage: number };
  } {
    const months = [];
    let totalGross = 0;
    let totalFees = 0;
    let totalNet = 0;

    for (let month = 1; month <= durationMonths; month++) {
      const { feePercentage, feeAmount, netAmount } = this.calculatePlatformFee(monthlyRate, month);

      months.push({
        month,
        gross: monthlyRate,
        fee: feeAmount,
        net: netAmount,
        percentage: feePercentage,
      });

      totalGross += monthlyRate;
      totalFees += feeAmount;
      totalNet += netAmount;
    }

    return {
      months,
      totals: {
        gross: totalGross,
        fees: totalFees,
        net: totalNet,
        avgPercentage: Math.round((totalFees / totalGross) * 100 * 10) / 10,
      },
    };
  }
}

export const platformFeeService = new PlatformFeeService();
