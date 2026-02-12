/**
 * @module @skillancer/market-svc/repositories/rate-recommendation
 * Rate Recommendation repository
 */

import type { RecommendationReason } from '../types/rate-intelligence.types.js';
import type {
  PrismaClient,
  RecommendationStatus,
  RecommendationType,
} from '../types/prisma-shim.js';

export interface RateRecommendationCreate {
  userId: string;
  recommendationType: RecommendationType;
  currentRate: number;
  currentPercentile: number;
  recommendedRateMin: number;
  recommendedRateMax: number;
  recommendedPercentile: number;
  reasons: RecommendationReason[];
  projectedWinRateChange: number | null;
  projectedEarningsChange: number | null;
  validUntil: Date;
}

export class RateRecommendationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new rate recommendation
   */
  async create(data: RateRecommendationCreate) {
    return this.prisma.rateRecommendation.create({
      data: {
        userId: data.userId,
        recommendationType: data.recommendationType,
        currentRate: data.currentRate,
        currentPercentile: data.currentPercentile,
        recommendedRateMin: data.recommendedRateMin,
        recommendedRateMax: data.recommendedRateMax,
        recommendedPercentile: data.recommendedPercentile,
        reasons: data.reasons as unknown as object,
        projectedWinRateChange: data.projectedWinRateChange,
        projectedEarningsChange: data.projectedEarningsChange,
        validUntil: data.validUntil,
        status: 'PENDING',
      },
    });
  }

  /**
   * Find recommendation by ID
   */
  async findById(id: string) {
    return this.prisma.rateRecommendation.findUnique({
      where: { id },
    });
  }

  /**
   * Find recommendations for a user
   */
  async findByUser(
    userId: string,
    options?: {
      status?: RecommendationStatus;
      limit?: number;
    }
  ) {
    const where: { userId: string; status?: RecommendationStatus; validUntil: { gte: Date } } = {
      userId,
      validUntil: {
        gte: new Date(),
      },
    };

    if (options?.status !== undefined) {
      where.status = options.status;
    }

    return this.prisma.rateRecommendation.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit ?? 10,
    });
  }

  /**
   * Find pending recommendations for a user
   */
  async findPendingByUser(userId: string) {
    return this.prisma.rateRecommendation.findMany({
      where: {
        userId,
        status: 'PENDING',
        validUntil: {
          gte: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Mark recommendation as viewed
   */
  async markViewed(id: string) {
    return this.prisma.rateRecommendation.update({
      where: { id },
      data: {
        status: 'VIEWED',
        viewedAt: new Date(),
      },
    });
  }

  /**
   * Update recommendation status with action
   */
  async updateStatus(
    id: string,
    data: {
      status: RecommendationStatus;
      actionTaken?: string;
    }
  ) {
    const updateData: {
      status: RecommendationStatus;
      actionTakenAt: Date;
      actionTaken?: string;
    } = {
      status: data.status,
      actionTakenAt: new Date(),
    };

    if (data.actionTaken !== undefined) {
      updateData.actionTaken = data.actionTaken;
    }

    return this.prisma.rateRecommendation.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Expire old recommendations
   */
  async expireOld() {
    return this.prisma.rateRecommendation.updateMany({
      where: {
        status: {
          in: ['PENDING', 'VIEWED'],
        },
        validUntil: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });
  }

  /**
   * Get recommendation acceptance statistics
   */
  async getAcceptanceStats(userId?: string) {
    const whereClause = userId ? { userId } : {};

    const [total, accepted, rejected] = await Promise.all([
      this.prisma.rateRecommendation.count({
        where: {
          ...whereClause,
          status: {
            in: ['ACCEPTED', 'REJECTED'],
          },
        },
      }),
      this.prisma.rateRecommendation.count({
        where: {
          ...whereClause,
          status: 'ACCEPTED',
        },
      }),
      this.prisma.rateRecommendation.count({
        where: {
          ...whereClause,
          status: 'REJECTED',
        },
      }),
    ]);

    return {
      total,
      accepted,
      rejected,
      acceptanceRate: total > 0 ? accepted / total : 0,
    };
  }
}
