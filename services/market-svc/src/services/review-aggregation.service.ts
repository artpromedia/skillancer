/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/market-svc/services/review-aggregation
 * Rating aggregation calculations and caching
 */

import type { FreelancerAggregation, ClientAggregation } from '../types/review.types.js';
import type { PrismaClient, Review, ReviewType as PrismaReviewType } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// REVIEW AGGREGATION SERVICE
// =============================================================================

export class ReviewAggregationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  /**
   * Update all rating aggregations for a user
   */
  async updateRatingAggregations(userId: string): Promise<void> {
    // Get all revealed reviews for this user
    const reviewsAsFreelancer = await this.prisma.review.findMany({
      where: {
        revieweeId: userId,
        reviewType: 'CLIENT_TO_FREELANCER' as PrismaReviewType,
        status: 'REVEALED',
      },
    });

    const reviewsAsClient = await this.prisma.review.findMany({
      where: {
        revieweeId: userId,
        reviewType: 'FREELANCER_TO_CLIENT' as PrismaReviewType,
        status: 'REVEALED',
      },
    });

    // Calculate freelancer aggregations
    const freelancerAgg = this.calculateFreelancerAggregation(reviewsAsFreelancer);

    // Calculate client aggregations
    const clientAgg = this.calculateClientAggregation(reviewsAsClient);

    // Upsert aggregation record
    await this.prisma.userRatingAggregation.upsert({
      where: { userId },
      create: {
        userId,
        freelancerTotalReviews: freelancerAgg.totalReviews,
        freelancerAverageRating: freelancerAgg.averageRating,
        freelancerRatingBreakdown: freelancerAgg.ratingBreakdown,
        freelancerQualityAvg: freelancerAgg.qualityAvg,
        freelancerCommunicationAvg: freelancerAgg.communicationAvg,
        freelancerExpertiseAvg: freelancerAgg.expertiseAvg,
        freelancerProfessionalismAvg: freelancerAgg.professionalismAvg,
        freelancerRepeatRate: freelancerAgg.repeatRate,

        clientTotalReviews: clientAgg.totalReviews,
        clientAverageRating: clientAgg.averageRating,
        clientRatingBreakdown: clientAgg.ratingBreakdown,
        clientClarityAvg: clientAgg.clarityAvg,
        clientResponsivenessAvg: clientAgg.responsivenessAvg,
        clientPaymentAvg: clientAgg.paymentAvg,
        clientProfessionalismAvg: clientAgg.professionalismAvg,
        clientRepeatRate: clientAgg.repeatRate,

        lastCalculatedAt: new Date(),
      },
      update: {
        freelancerTotalReviews: freelancerAgg.totalReviews,
        freelancerAverageRating: freelancerAgg.averageRating,
        freelancerRatingBreakdown: freelancerAgg.ratingBreakdown,
        freelancerQualityAvg: freelancerAgg.qualityAvg,
        freelancerCommunicationAvg: freelancerAgg.communicationAvg,
        freelancerExpertiseAvg: freelancerAgg.expertiseAvg,
        freelancerProfessionalismAvg: freelancerAgg.professionalismAvg,
        freelancerRepeatRate: freelancerAgg.repeatRate,

        clientTotalReviews: clientAgg.totalReviews,
        clientAverageRating: clientAgg.averageRating,
        clientRatingBreakdown: clientAgg.ratingBreakdown,
        clientClarityAvg: clientAgg.clarityAvg,
        clientResponsivenessAvg: clientAgg.responsivenessAvg,
        clientPaymentAvg: clientAgg.paymentAvg,
        clientProfessionalismAvg: clientAgg.professionalismAvg,
        clientRepeatRate: clientAgg.repeatRate,

        lastCalculatedAt: new Date(),
      },
    });

    this.logger.info({
      msg: 'Rating aggregations updated',
      userId,
      freelancerReviews: freelancerAgg.totalReviews,
      clientReviews: clientAgg.totalReviews,
    });

    // Cache the result
    const cacheKey = `user:${userId}:rating_aggregation`;
    await this.redis.setex(
      cacheKey,
      3600, // 1 hour TTL
      JSON.stringify({ freelancer: freelancerAgg, client: clientAgg })
    );
  }

  /**
   * Calculate freelancer-specific aggregations
   */
  private calculateFreelancerAggregation(reviews: Review[]): FreelancerAggregation {
    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingBreakdown: {},
        qualityAvg: null,
        communicationAvg: null,
        expertiseAvg: null,
        professionalismAvg: null,
        repeatRate: null,
      };
    }

    const base = this.calculateBaseAggregation(reviews);

    // Calculate category averages
    const qualityValues = this.extractCategoryValues(reviews, 'quality');
    const communicationValues = this.extractCategoryValues(reviews, 'communication');
    const expertiseValues = this.extractCategoryValues(reviews, 'expertise');
    const professionalismValues = this.extractCategoryValues(reviews, 'professionalism');

    // Calculate repeat rate
    const wouldHireAgainValues = reviews
      .map((r) => (r.categoryRatings as Record<string, unknown>)?.wouldHireAgain)
      .filter((v): v is boolean => typeof v === 'boolean');

    const repeatRate =
      wouldHireAgainValues.length > 0
        ? Math.round(
            (wouldHireAgainValues.filter((v) => v).length / wouldHireAgainValues.length) * 10000
          ) / 100
        : null;

    return {
      totalReviews: base.totalReviews,
      averageRating: base.averageRating,
      ratingBreakdown: base.ratingBreakdown,
      qualityAvg: this.calculateAverage(qualityValues),
      communicationAvg: this.calculateAverage(communicationValues),
      expertiseAvg: this.calculateAverage(expertiseValues),
      professionalismAvg: this.calculateAverage(professionalismValues),
      repeatRate,
    };
  }

  /**
   * Calculate client-specific aggregations
   */
  private calculateClientAggregation(reviews: Review[]): ClientAggregation {
    if (reviews.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        ratingBreakdown: {},
        clarityAvg: null,
        responsivenessAvg: null,
        paymentAvg: null,
        professionalismAvg: null,
        repeatRate: null,
      };
    }

    const base = this.calculateBaseAggregation(reviews);

    // Calculate category averages
    const clarityValues = this.extractCategoryValues(reviews, 'clarity');
    const responsivenessValues = this.extractCategoryValues(reviews, 'responsiveness');
    const paymentValues = this.extractCategoryValues(reviews, 'payment');
    const professionalismValues = this.extractCategoryValues(reviews, 'professionalism');

    // Calculate repeat rate
    const wouldWorkAgainValues = reviews
      .map((r) => (r.categoryRatings as Record<string, unknown>)?.wouldWorkAgain)
      .filter((v): v is boolean => typeof v === 'boolean');

    const repeatRate =
      wouldWorkAgainValues.length > 0
        ? Math.round(
            (wouldWorkAgainValues.filter((v) => v).length / wouldWorkAgainValues.length) * 10000
          ) / 100
        : null;

    return {
      totalReviews: base.totalReviews,
      averageRating: base.averageRating,
      ratingBreakdown: base.ratingBreakdown,
      clarityAvg: this.calculateAverage(clarityValues),
      responsivenessAvg: this.calculateAverage(responsivenessValues),
      paymentAvg: this.calculateAverage(paymentValues),
      professionalismAvg: this.calculateAverage(professionalismValues),
      repeatRate,
    };
  }

  /**
   * Calculate base aggregation metrics
   */
  private calculateBaseAggregation(reviews: Review[]): {
    totalReviews: number;
    averageRating: number;
    ratingBreakdown: Record<string, number>;
  } {
    const totalRating = reviews.reduce((sum, r) => sum + r.overallRating, 0);
    const averageRating = Math.round((totalRating / reviews.length) * 100) / 100;

    const ratingBreakdown: Record<string, number> = {
      '5': 0,
      '4': 0,
      '3': 0,
      '2': 0,
      '1': 0,
    };

    for (const review of reviews) {
      const key = review.overallRating.toString();
      if (key in ratingBreakdown) {
        ratingBreakdown[key] = (ratingBreakdown[key] ?? 0) + 1;
      }
    }

    return {
      totalReviews: reviews.length,
      averageRating,
      ratingBreakdown,
    };
  }

  /**
   * Extract category values from reviews
   */
  private extractCategoryValues(reviews: Review[], category: string): number[] {
    return reviews
      .map((r) => (r.categoryRatings as Record<string, number>)?.[category])
      .filter((v): v is number => typeof v === 'number');
  }

  /**
   * Calculate average from values
   */
  private calculateAverage(values: number[]): number | null {
    if (values.length === 0) {
      return null;
    }
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }

  /**
   * Get aggregation for a user (with caching)
   */
  async getAggregation(userId: string): Promise<{
    freelancer: FreelancerAggregation;
    client: ClientAggregation;
  } | null> {
    // Try cache first
    const cacheKey = `user:${userId}:rating_aggregation`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as {
        freelancer: FreelancerAggregation;
        client: ClientAggregation;
      };
    }

    // Fetch from database
    const agg = await this.prisma.userRatingAggregation.findUnique({
      where: { userId },
    });

    if (!agg) {
      return null;
    }

    const result = {
      freelancer: {
        totalReviews: agg.freelancerTotalReviews,
        averageRating: Number(agg.freelancerAverageRating),
        ratingBreakdown: agg.freelancerRatingBreakdown as Record<string, number>,
        qualityAvg: agg.freelancerQualityAvg ? Number(agg.freelancerQualityAvg) : null,
        communicationAvg: agg.freelancerCommunicationAvg
          ? Number(agg.freelancerCommunicationAvg)
          : null,
        expertiseAvg: agg.freelancerExpertiseAvg ? Number(agg.freelancerExpertiseAvg) : null,
        professionalismAvg: agg.freelancerProfessionalismAvg
          ? Number(agg.freelancerProfessionalismAvg)
          : null,
        repeatRate: agg.freelancerRepeatRate ? Number(agg.freelancerRepeatRate) : null,
      },
      client: {
        totalReviews: agg.clientTotalReviews,
        averageRating: Number(agg.clientAverageRating),
        ratingBreakdown: agg.clientRatingBreakdown as Record<string, number>,
        clarityAvg: agg.clientClarityAvg ? Number(agg.clientClarityAvg) : null,
        responsivenessAvg: agg.clientResponsivenessAvg ? Number(agg.clientResponsivenessAvg) : null,
        paymentAvg: agg.clientPaymentAvg ? Number(agg.clientPaymentAvg) : null,
        professionalismAvg: agg.clientProfessionalismAvg
          ? Number(agg.clientProfessionalismAvg)
          : null,
        repeatRate: agg.clientRepeatRate ? Number(agg.clientRepeatRate) : null,
      },
    };

    // Cache result
    await this.redis.setex(cacheKey, 3600, JSON.stringify(result));

    return result;
  }

  /**
   * Batch update aggregations for multiple users
   */
  async batchUpdateAggregations(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      try {
        await this.updateRatingAggregations(userId);
      } catch (error) {
        this.logger.error({ msg: 'Failed to update aggregation', userId, error });
      }
    }
  }

  /**
   * Invalidate cache for a user
   */
  async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `user:${userId}:rating_aggregation`;
    await this.redis.del(cacheKey);
  }

  /**
   * Get or calculate aggregation for a user
   * If no aggregation exists, calculates and stores it
   */
  async getOrCalculateAggregation(userId: string): Promise<{
    freelancer: FreelancerAggregation;
    client: ClientAggregation;
  } | null> {
    const existing = await this.getAggregation(userId);
    if (existing) {
      return existing;
    }

    // Calculate and store if not exists
    await this.updateRatingAggregations(userId);
    return this.getAggregation(userId);
  }
}
