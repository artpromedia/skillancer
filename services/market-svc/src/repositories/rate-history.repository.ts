/**
 * @module @skillancer/market-svc/repositories/rate-history
 * Freelancer Rate History repository
 */

import type {
  PrismaClient,
  RateChangeReason,
  FreelancerRateHistory,
} from '../types/prisma-shim.js';

export interface RateHistoryCreate {
  userId: string;
  previousHourlyRate: number | null;
  newHourlyRate: number;
  changeReason: RateChangeReason;
  marketPosition?: string | null | undefined;
  percentileAtChange?: number | null | undefined;
  changedAt: Date;
}

export class RateHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a rate history entry
   */
  async create(data: RateHistoryCreate): Promise<FreelancerRateHistory> {
    return this.prisma.freelancerRateHistory.create({
      data: {
        userId: data.userId,
        previousHourlyRate: data.previousHourlyRate,
        newHourlyRate: data.newHourlyRate,
        changeReason: data.changeReason,
        changedAt: data.changedAt,
        ...(data.marketPosition !== undefined && { marketPosition: data.marketPosition }),
        ...(data.percentileAtChange !== undefined && {
          percentileAtChange: data.percentileAtChange,
        }),
      },
    });
  }

  /**
   * Find rate history for a user
   */
  async findByUser(userId: string, options?: { limit?: number }): Promise<FreelancerRateHistory[]> {
    return this.prisma.freelancerRateHistory.findMany({
      where: {
        userId,
      },
      orderBy: {
        changedAt: 'desc',
      },
      take: options?.limit ?? 20,
    });
  }

  /**
   * Get the latest rate change for a user
   */
  async findLatestByUser(userId: string): Promise<FreelancerRateHistory | null> {
    return this.prisma.freelancerRateHistory.findFirst({
      where: {
        userId,
      },
      orderBy: {
        changedAt: 'desc',
      },
    });
  }

  /**
   * Update win rate impact after a rate change
   */
  async updateWinRateImpact(
    id: string,
    data: {
      bidsAfterChange: number;
      winRateAfterChange: number;
    }
  ): Promise<FreelancerRateHistory> {
    return this.prisma.freelancerRateHistory.update({
      where: { id },
      data: {
        bidsAfterChange: data.bidsAfterChange,
        winRateAfterChange: data.winRateAfterChange,
      },
    });
  }

  /**
   * Get rate changes in a time period
   */
  async findInPeriod(params: {
    userId?: string;
    startDate: Date;
    endDate: Date;
    limit?: number;
  }): Promise<FreelancerRateHistory[]> {
    const where: { userId?: string; changedAt: { gte: Date; lte: Date } } = {
      changedAt: {
        gte: params.startDate,
        lte: params.endDate,
      },
    };

    if (params.userId !== undefined) {
      where.userId = params.userId;
    }

    return this.prisma.freelancerRateHistory.findMany({
      where,
      orderBy: {
        changedAt: 'desc',
      },
      take: params.limit ?? 100,
    });
  }

  /**
   * Get rate changes by reason
   */
  async getByReason(
    reason: RateChangeReason,
    options?: { limit?: number }
  ): Promise<FreelancerRateHistory[]> {
    return this.prisma.freelancerRateHistory.findMany({
      where: {
        changeReason: reason,
      },
      orderBy: {
        changedAt: 'desc',
      },
      take: options?.limit ?? 50,
    });
  }

  /**
   * Get average rate change impact
   */
  async getAverageImpact(userId?: string) {
    const whereClause = {
      ...(userId ? { userId } : {}),
      winRateAfterChange: { not: null },
      winRateBeforeChange: { not: null },
    };

    const results = await this.prisma.freelancerRateHistory.findMany({
      where: whereClause,
      select: {
        winRateBeforeChange: true,
        winRateAfterChange: true,
        previousHourlyRate: true,
        newHourlyRate: true,
      },
    });

    if (results.length === 0) {
      return null;
    }

    let totalWinRateChange = 0;
    let totalRateChange = 0;

    for (const r of results) {
      if (r.winRateAfterChange && r.winRateBeforeChange) {
        totalWinRateChange += Number(r.winRateAfterChange) - Number(r.winRateBeforeChange);
      }
      if (r.previousHourlyRate && r.newHourlyRate) {
        totalRateChange += Number(r.newHourlyRate) - Number(r.previousHourlyRate);
      }
    }

    return {
      avgWinRateChange: totalWinRateChange / results.length,
      avgRateChange: totalRateChange / results.length,
      sampleSize: results.length,
    };
  }
}
