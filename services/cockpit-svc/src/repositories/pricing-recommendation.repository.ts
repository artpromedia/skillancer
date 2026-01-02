// @ts-nocheck
/**
 * Pricing Recommendation Repository
 *
 * Repository for managing pricing recommendations.
 */

import {
  type PrismaClient,
  Prisma,
  type PricingRecommendation,
  type RecommendationStatus,
  type PricingRecommendationType,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import type { RecommendationCreateInput } from '@skillancer/types/cockpit';

export interface RecommendationFilters {
  status?: RecommendationStatus[];
  skillId?: string;
  types?: PricingRecommendationType[];
  validAfter?: Date;
  validBefore?: Date;
}

export class PricingRecommendationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new recommendation
   */
  async create(data: RecommendationCreateInput): Promise<PricingRecommendation> {
    try {
      return await this.prisma.pricingRecommendation.create({
        data: {
          userId: data.userId,
          recommendationType: data.recommendationType,
          scope: data.scope,
          skillId: data.skillId,
          skillName: data.skillName,
          projectType: data.projectType,
          currentRate: data.currentRate ? new Prisma.Decimal(data.currentRate) : null,
          recommendedRate: new Prisma.Decimal(data.recommendedRate),
          rateChange: new Prisma.Decimal(data.rateChange),
          rateChangePercent: new Prisma.Decimal(data.rateChangePercent),
          projectedMonthlyImpact: data.projectedMonthlyImpact
            ? new Prisma.Decimal(data.projectedMonthlyImpact)
            : null,
          projectedYearlyImpact: data.projectedYearlyImpact
            ? new Prisma.Decimal(data.projectedYearlyImpact)
            : null,
          confidenceScore: new Prisma.Decimal(data.confidenceScore),
          reasoning: data.reasoning,
          marketPosition: data.marketPosition,
          competitorAnalysis: data.competitorAnalysis,
          status: data.status || 'PENDING',
          validFrom: data.validFrom,
          validUntil: data.validUntil,
        },
      });
    } catch (error) {
      logger.error('Failed to create pricing recommendation', { error, data });
      throw error;
    }
  }

  /**
   * Find recommendation by ID
   */
  async findById(id: string): Promise<PricingRecommendation | null> {
    try {
      return await this.prisma.pricingRecommendation.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to find recommendation by id', { error, id });
      throw error;
    }
  }

  /**
   * Find recommendations for a user with filters
   */
  async findByUser(
    userId: string,
    filters?: RecommendationFilters
  ): Promise<PricingRecommendation[]> {
    try {
      const where: Prisma.PricingRecommendationWhereInput = { userId };

      if (filters?.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }
      if (filters?.skillId) {
        where.skillId = filters.skillId;
      }
      if (filters?.types && filters.types.length > 0) {
        where.recommendationType = { in: filters.types };
      }
      if (filters?.validAfter) {
        where.validUntil = { gte: filters.validAfter };
      }
      if (filters?.validBefore) {
        where.validUntil = { ...((where.validUntil as object) || {}), lte: filters.validBefore };
      }

      return await this.prisma.pricingRecommendation.findMany({
        where,
        orderBy: [{ confidenceScore: 'desc' }, { projectedYearlyImpact: 'desc' }],
      });
    } catch (error) {
      logger.error('Failed to find recommendations for user', { error, userId, filters });
      throw error;
    }
  }

  /**
   * Find active (pending/viewed, not expired) recommendations
   */
  async findActive(userId: string, limit: number = 10): Promise<PricingRecommendation[]> {
    try {
      return await this.prisma.pricingRecommendation.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'VIEWED'] },
          validUntil: { gte: new Date() },
        },
        orderBy: [{ confidenceScore: 'desc' }, { projectedYearlyImpact: 'desc' }],
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to find active recommendations', { error, userId });
      throw error;
    }
  }

  /**
   * Update a recommendation
   */
  async update(
    id: string,
    data: Partial<{
      status: RecommendationStatus;
      viewedAt: Date;
      appliedAt: Date;
      dismissedAt: Date;
      dismissReason: string;
    }>
  ): Promise<PricingRecommendation> {
    try {
      return await this.prisma.pricingRecommendation.update({
        where: { id },
        data,
      });
    } catch (error) {
      logger.error('Failed to update recommendation', { error, id, data });
      throw error;
    }
  }

  /**
   * Mark recommendation as viewed
   */
  async markViewed(id: string): Promise<PricingRecommendation> {
    try {
      return await this.prisma.pricingRecommendation.update({
        where: { id },
        data: {
          status: 'VIEWED',
          viewedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to mark recommendation as viewed', { error, id });
      throw error;
    }
  }

  /**
   * Mark recommendation as applied
   */
  async markApplied(id: string): Promise<PricingRecommendation> {
    try {
      return await this.prisma.pricingRecommendation.update({
        where: { id },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to mark recommendation as applied', { error, id });
      throw error;
    }
  }

  /**
   * Mark recommendation as dismissed
   */
  async markDismissed(id: string, reason?: string): Promise<PricingRecommendation> {
    try {
      return await this.prisma.pricingRecommendation.update({
        where: { id },
        data: {
          status: 'DISMISSED',
          dismissedAt: new Date(),
          dismissReason: reason,
        },
      });
    } catch (error) {
      logger.error('Failed to mark recommendation as dismissed', { error, id });
      throw error;
    }
  }

  /**
   * Expire old recommendations
   */
  async expireOld(): Promise<number> {
    try {
      const result = await this.prisma.pricingRecommendation.updateMany({
        where: {
          status: { in: ['PENDING', 'VIEWED'] },
          validUntil: { lt: new Date() },
        },
        data: {
          status: 'EXPIRED',
        },
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to expire old recommendations', { error });
      throw error;
    }
  }

  /**
   * Get recommendation statistics for a user
   */
  async getStats(userId: string): Promise<{
    total: number;
    pending: number;
    applied: number;
    dismissed: number;
    expired: number;
    avgImpact: number | null;
  }> {
    try {
      const [counts, avgImpact] = await Promise.all([
        this.prisma.pricingRecommendation.groupBy({
          by: ['status'],
          where: { userId },
          _count: { id: true },
        }),
        this.prisma.pricingRecommendation.aggregate({
          where: {
            userId,
            status: 'APPLIED',
          },
          _avg: { projectedYearlyImpact: true },
        }),
      ]);

      const statusCounts = counts.reduce(
        (acc, item) => {
          acc[item.status.toLowerCase() as keyof typeof acc] = item._count.id;
          return acc;
        },
        { pending: 0, viewed: 0, applied: 0, dismissed: 0, expired: 0 }
      );

      return {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        pending: statusCounts.pending + statusCounts.viewed,
        applied: statusCounts.applied,
        dismissed: statusCounts.dismissed,
        expired: statusCounts.expired,
        avgImpact: avgImpact._avg.projectedYearlyImpact?.toNumber() ?? null,
      };
    } catch (error) {
      logger.error('Failed to get recommendation stats', { error, userId });
      throw error;
    }
  }

  /**
   * Delete a recommendation
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.pricingRecommendation.delete({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to delete recommendation', { error, id });
      throw error;
    }
  }

  /**
   * Delete old recommendations (for cleanup)
   */
  async deleteOld(olderThan: Date): Promise<number> {
    try {
      const result = await this.prisma.pricingRecommendation.deleteMany({
        where: {
          createdAt: { lt: olderThan },
          status: { in: ['APPLIED', 'DISMISSED', 'EXPIRED'] },
        },
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete old recommendations', { error, olderThan });
      throw error;
    }
  }
}

