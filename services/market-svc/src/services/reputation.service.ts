/**
 * @module @skillancer/market-svc/services/reputation
 * User Reputation Statistics Service
 *
 * Manages reputation statistics including:
 * - Aggregate rating calculations
 * - Trend analysis
 * - Cross-product trust score integration
 */

import {
  FREELANCER_RATING_DIMENSIONS,
  CLIENT_RATING_DIMENSIONS,
} from '../config/rating-dimensions.js';

import type { PrismaClient, ReviewType as PrismaReviewType, Prisma } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

/** Rating value (1-5 stars) */
export type RatingValue = 1 | 2 | 3 | 4 | 5;

/** Trend direction */
export type TrendDirection = 'UP' | 'DOWN' | 'STABLE';

export interface ReputationStats {
  userId: string;
  role: 'FREELANCER' | 'CLIENT';

  // Overall stats
  overallAverage: number;
  totalReviews: number;

  // Rating distribution
  ratingDistribution: Record<RatingValue, number>;

  // Category averages
  categoryAverages: Record<string, number>;

  // Recommendation rate
  recommendationRate: number | null;

  // Trend
  last30DaysAverage: number | null;
  last30DaysCount: number;
  trend: TrendDirection;

  // Response metrics (for freelancers)
  responseRate: number | null;
  avgResponseTimeHours: number | null;

  // Completion metrics
  completionRate: number | null;
  onTimeRate: number | null;

  // Timestamps
  lastCalculatedAt: Date;
  lastReviewAt: Date | null;
}

export interface ReputationSummary {
  freelancer: ReputationStats | null;
  client: ReputationStats | null;
  crossProductScore: number | null;
}

// =============================================================================
// REPUTATION SERVICE
// =============================================================================

export class ReputationService {
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  // =========================================================================
  // PRIVATE HELPERS FOR STATS CALCULATION
  // =========================================================================

  /**
   * Calculate rating distribution from reviews
   */
  private calculateRatingDistribution(
    reviews: Array<{ overallRating: number }>
  ): Record<RatingValue, number> {
    const distribution: Record<RatingValue, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const review of reviews) {
      const rating = review.overallRating as RatingValue;
      if (rating >= 1 && rating <= 5) {
        distribution[rating]++;
      }
    }
    return distribution;
  }

  /**
   * Calculate category averages from reviews
   */
  private calculateCategoryAverages(
    reviews: Array<{ categoryRatings: unknown }>,
    dimensions: Record<string, { weight: number }>
  ): Record<string, number> {
    const categoryAverages: Record<string, number> = {};

    for (const key of Object.keys(dimensions)) {
      const values = reviews
        .map((r) => {
          const ratings = r.categoryRatings as Record<string, number>;
          return ratings?.[key];
        })
        .filter((v): v is number => v !== undefined && v !== null);

      if (values.length > 0) {
        categoryAverages[key] =
          Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
      }
    }

    return categoryAverages;
  }

  /**
   * Calculate recommendation rate from reviews
   */
  private calculateRecommendationRate(
    reviews: Array<{ categoryRatings: unknown }>,
    role: 'FREELANCER' | 'CLIENT'
  ): number | null {
    const recommendKey = role === 'FREELANCER' ? 'wouldHireAgain' : 'wouldWorkAgain';
    const recommendations = reviews
      .map((r) => (r.categoryRatings as Record<string, boolean>)?.[recommendKey])
      .filter((v): v is boolean => typeof v === 'boolean');

    if (recommendations.length === 0) {
      return null;
    }

    return (
      Math.round((recommendations.filter(Boolean).length / recommendations.length) * 10000) / 100
    );
  }

  /**
   * Calculate trend from recent vs older reviews
   */
  private calculateTrend(
    reviews: Array<{ overallRating: number; createdAt: Date }>,
    thirtyDaysAgo: Date
  ): { trend: TrendDirection; last30DaysAverage: number | null; last30DaysCount: number } {
    const recentReviews = reviews.filter((r) => r.createdAt >= thirtyDaysAgo);
    const last30DaysCount = recentReviews.length;

    if (recentReviews.length === 0) {
      return { trend: 'STABLE', last30DaysAverage: null, last30DaysCount: 0 };
    }

    const last30DaysAverage =
      Math.round(
        (recentReviews.reduce((sum, r) => sum + r.overallRating, 0) / recentReviews.length) * 100
      ) / 100;

    let trend: TrendDirection = 'STABLE';
    const olderReviews = reviews.filter((r) => r.createdAt < thirtyDaysAgo);

    if (olderReviews.length > 0) {
      const olderAverage =
        olderReviews.reduce((sum, r) => sum + r.overallRating, 0) / olderReviews.length;
      if (last30DaysAverage > olderAverage + 0.2) {
        trend = 'UP';
      } else if (last30DaysAverage < olderAverage - 0.2) {
        trend = 'DOWN';
      }
    }

    return { trend, last30DaysAverage, last30DaysCount };
  }

  /**
   * Get complete reputation summary for a user
   */
  async getReputationSummary(userId: string): Promise<ReputationSummary> {
    // Try cache first
    const cacheKey = `reputation:summary:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ReputationSummary;
    }

    const [freelancerStats, clientStats, trustScore] = await Promise.all([
      this.getStats(userId, 'FREELANCER'),
      this.getStats(userId, 'CLIENT'),
      this.getCrossProductScore(userId),
    ]);

    const summary: ReputationSummary = {
      freelancer: freelancerStats,
      client: clientStats,
      crossProductScore: trustScore,
    };

    // Cache the result
    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(summary));

    return summary;
  }

  /**
   * Get reputation stats for a specific role
   */
  async getStats(userId: string, role: 'FREELANCER' | 'CLIENT'): Promise<ReputationStats | null> {
    const reviewType: PrismaReviewType =
      role === 'FREELANCER' ? 'CLIENT_TO_FREELANCER' : 'FREELANCER_TO_CLIENT';

    // Get all revealed reviews for this user in this role
    const reviews = await this.prisma.review.findMany({
      where: {
        revieweeId: userId,
        reviewType,
        status: 'REVEALED',
      },
      select: {
        id: true,
        overallRating: true,
        categoryRatings: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (reviews.length === 0) {
      return null;
    }

    // Calculate metrics using helpers
    const overallAverage =
      Math.round((reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length) * 100) /
      100;

    const ratingDistribution = this.calculateRatingDistribution(reviews);

    const dimensions =
      role === 'FREELANCER' ? FREELANCER_RATING_DIMENSIONS : CLIENT_RATING_DIMENSIONS;
    const categoryAverages = this.calculateCategoryAverages(reviews, dimensions);

    const recommendationRate = this.calculateRecommendationRate(reviews, role);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trendData = this.calculateTrend(reviews, thirtyDaysAgo);

    // Get completion metrics from contracts
    const completionMetrics = await this.getCompletionMetrics(userId, role);

    return {
      userId,
      role,
      overallAverage,
      totalReviews: reviews.length,
      ratingDistribution,
      categoryAverages,
      recommendationRate,
      last30DaysAverage: trendData.last30DaysAverage,
      last30DaysCount: trendData.last30DaysCount,
      trend: trendData.trend,
      responseRate: completionMetrics.responseRate,
      avgResponseTimeHours: completionMetrics.avgResponseTime,
      completionRate: completionMetrics.completionRate,
      onTimeRate: completionMetrics.onTimeRate,
      lastCalculatedAt: new Date(),
      lastReviewAt: reviews[0]?.createdAt ?? null,
    };
  }

  /**
   * Recalculate and persist reputation stats
   */
  async recalculateStats(userId: string, role: 'FREELANCER' | 'CLIENT'): Promise<void> {
    const stats = await this.getStats(userId, role);

    if (!stats) {
      this.logger.debug({ msg: 'No reviews to calculate stats', userId, role });
      return;
    }

    // Build update data
    const updateData = this.buildAggregationUpdateData(stats, role);

    // Check if record exists
    const existing = await this.prisma.userRatingAggregation.findUnique({
      where: { userId },
    });

    if (existing) {
      await this.prisma.userRatingAggregation.update({
        where: { userId },
        data: updateData,
      });
    } else {
      await this.prisma.userRatingAggregation.create({
        data: {
          userId,
          ...this.buildAggregationCreateData(stats, role),
        },
      });
    }

    // Invalidate cache
    await this.redis.del(`reputation:summary:${userId}`);

    // Update trust score
    await this.updateTrustScore(userId);

    this.logger.info({
      msg: 'Reputation stats recalculated',
      userId,
      role,
      overallAverage: stats.overallAverage,
      totalReviews: stats.totalReviews,
    });
  }

  /**
   * Build create data for aggregation table
   */
  private buildAggregationCreateData(
    stats: ReputationStats,
    role: 'FREELANCER' | 'CLIENT'
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      lastCalculatedAt: new Date(),
    };

    if (role === 'FREELANCER') {
      data.freelancerTotalReviews = stats.totalReviews;
      data.freelancerAverageRating = stats.overallAverage;
      data.freelancerRatingBreakdown = stats.ratingDistribution;
      data.freelancerQualityAvg = stats.categoryAverages.quality ?? null;
      data.freelancerCommunicationAvg = stats.categoryAverages.communication ?? null;
      data.freelancerExpertiseAvg = stats.categoryAverages.expertise ?? null;
      data.freelancerProfessionalismAvg = stats.categoryAverages.professionalism ?? null;
      data.freelancerRepeatRate = stats.recommendationRate;
    } else {
      data.clientTotalReviews = stats.totalReviews;
      data.clientAverageRating = stats.overallAverage;
      data.clientRatingBreakdown = stats.ratingDistribution;
      data.clientClarityAvg = stats.categoryAverages.clarity ?? null;
      data.clientResponsivenessAvg = stats.categoryAverages.communication ?? null;
      data.clientPaymentAvg = stats.categoryAverages.payment ?? null;
      data.clientProfessionalismAvg = stats.categoryAverages.professionalism ?? null;
      data.clientRepeatRate = stats.recommendationRate;
    }

    return data;
  }

  /**
   * Get cross-product trust score
   */
  private async getCrossProductScore(userId: string): Promise<number | null> {
    const trustScore = await this.prisma.trustScore.findUnique({
      where: { userId },
      select: { overallScore: true },
    });

    return trustScore?.overallScore ?? null;
  }

  /**
   * Update the cross-product trust score based on review stats
   */
  private async updateTrustScore(userId: string): Promise<void> {
    // Get or create trust score
    const existing = await this.prisma.trustScore.findUnique({
      where: { userId },
    });

    // Get aggregation for review score calculation
    const aggregation = await this.prisma.userRatingAggregation.findUnique({
      where: { userId },
    });

    if (!aggregation) return;

    // Calculate review score component (0-100)
    const freelancerScore =
      aggregation.freelancerTotalReviews > 0
        ? Number(aggregation.freelancerAverageRating) * 20 // 5.0 -> 100
        : 50;
    const clientScore =
      aggregation.clientTotalReviews > 0 ? Number(aggregation.clientAverageRating) * 20 : 50;

    // Weight by number of reviews
    const totalReviews = aggregation.freelancerTotalReviews + aggregation.clientTotalReviews;
    const reviewScore =
      totalReviews > 0
        ? Math.round(
            (freelancerScore * aggregation.freelancerTotalReviews +
              clientScore * aggregation.clientTotalReviews) /
              totalReviews
          )
        : 50;

    if (existing) {
      await this.prisma.trustScore.update({
        where: { userId },
        data: {
          reviewScore,
          lastCalculatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.trustScore.create({
        data: {
          userId,
          reviewScore,
          overallScore: reviewScore, // Initial score based on reviews
        },
      });
    }
  }

  /**
   * Get completion metrics from contracts
   */
  private async getCompletionMetrics(
    userId: string,
    role: 'FREELANCER' | 'CLIENT'
  ): Promise<{
    responseRate: number | null;
    avgResponseTime: number | null;
    completionRate: number | null;
    onTimeRate: number | null;
  }> {
    const whereClause = role === 'FREELANCER' ? { freelancerId: userId } : { clientId: userId };

    const contracts = await this.prisma.contract.findMany({
      where: whereClause,
      select: {
        status: true,
        completedAt: true,
        endDate: true,
        createdAt: true,
      },
    });

    if (contracts.length === 0) {
      return {
        responseRate: null,
        avgResponseTime: null,
        completionRate: null,
        onTimeRate: null,
      };
    }

    // Completion rate
    const completedContracts = contracts.filter((c) => c.status === 'COMPLETED');
    const completionRate = Math.round((completedContracts.length / contracts.length) * 10000) / 100;

    // On-time rate (completed before or on end date)
    const onTimeContracts = completedContracts.filter((c) => {
      if (!c.completedAt || !c.endDate) return false;
      return c.completedAt <= c.endDate;
    });

    const onTimeRate =
      completedContracts.length > 0
        ? Math.round((onTimeContracts.length / completedContracts.length) * 10000) / 100
        : null;

    return {
      responseRate: null, // Would need message/response tracking
      avgResponseTime: null, // Would need message timestamps
      completionRate,
      onTimeRate,
    };
  }

  /**
   * Build update data for aggregation table
   */
  private buildAggregationUpdateData(
    stats: ReputationStats,
    role: 'FREELANCER' | 'CLIENT'
  ): Prisma.UserRatingAggregationUpdateInput {
    const prefix = role === 'FREELANCER' ? 'freelancer' : 'client';

    const data: Record<string, unknown> = {
      [`${prefix}TotalReviews`]: stats.totalReviews,
      [`${prefix}AverageRating`]: stats.overallAverage,
      [`${prefix}RatingBreakdown`]: stats.ratingDistribution,
      lastCalculatedAt: new Date(),
    };

    // Add category averages
    if (role === 'FREELANCER') {
      data.freelancerQualityAvg = stats.categoryAverages.quality ?? null;
      data.freelancerCommunicationAvg = stats.categoryAverages.communication ?? null;
      data.freelancerExpertiseAvg = stats.categoryAverages.expertise ?? null;
      data.freelancerProfessionalismAvg = stats.categoryAverages.professionalism ?? null;
      data.freelancerRepeatRate = stats.recommendationRate;
    } else {
      data.clientClarityAvg = stats.categoryAverages.clarity ?? null;
      data.clientResponsivenessAvg = stats.categoryAverages.communication ?? null;
      data.clientPaymentAvg = stats.categoryAverages.payment ?? null;
      data.clientProfessionalismAvg = stats.categoryAverages.professionalism ?? null;
      data.clientRepeatRate = stats.recommendationRate;
    }

    return data;
  }

  /**
   * Get top-rated users for a role
   */
  async getTopRated(
    role: 'FREELANCER' | 'CLIENT',
    options: { limit?: number; minReviews?: number } = {}
  ): Promise<
    Array<{
      userId: string;
      averageRating: number;
      totalReviews: number;
    }>
  > {
    const { limit = 10, minReviews = 5 } = options;

    if (role === 'FREELANCER') {
      const results = await this.prisma.userRatingAggregation.findMany({
        where: {
          freelancerTotalReviews: { gte: minReviews },
        },
        orderBy: {
          freelancerAverageRating: 'desc',
        },
        take: limit,
        select: {
          userId: true,
          freelancerAverageRating: true,
          freelancerTotalReviews: true,
        },
      });

      return results.map((r) => ({
        userId: r.userId,
        averageRating: Number(r.freelancerAverageRating),
        totalReviews: r.freelancerTotalReviews,
      }));
    } else {
      const results = await this.prisma.userRatingAggregation.findMany({
        where: {
          clientTotalReviews: { gte: minReviews },
        },
        orderBy: {
          clientAverageRating: 'desc',
        },
        take: limit,
        select: {
          userId: true,
          clientAverageRating: true,
          clientTotalReviews: true,
        },
      });

      return results.map((r) => ({
        userId: r.userId,
        averageRating: Number(r.clientAverageRating),
        totalReviews: r.clientTotalReviews,
      }));
    }
  }
}
