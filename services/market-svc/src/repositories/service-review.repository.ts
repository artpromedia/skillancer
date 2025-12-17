/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/service-review
 * Service Review data access layer
 */

import type { CreateReviewInput, ReviewStats } from '../types/service-catalog.types.js';
import type { PrismaClient, Prisma } from '@skillancer/database';

/**
 * Service Review Repository
 *
 * Handles database operations for service reviews.
 * Uses Prisma client for all database interactions.
 */
export class ServiceReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ===========================================================================
  // REVIEW CRUD OPERATIONS
  // ===========================================================================

  /**
   * Create a review
   */
  async create(orderId: string, serviceId: string, reviewerId: string, input: CreateReviewInput) {
    return this.prisma.serviceReview.create({
      data: {
        orderId,
        serviceId,
        reviewerId,
        overallRating: input.overallRating,
        communicationRating: input.communicationRating ?? null,
        qualityRating: input.qualityRating ?? null,
        deliveryRating: input.deliveryRating ?? null,
        valueRating: input.valueRating ?? null,
        title: input.title ?? null,
        content: input.content ?? null,
        isPublic: true,
        isVerifiedPurchase: true,
        helpfulCount: 0,
      },
      include: this.getReviewIncludes(),
    });
  }

  /**
   * Find a review by ID
   */
  async findById(id: string) {
    return this.prisma.serviceReview.findUnique({
      where: { id },
      include: this.getReviewIncludes(),
    });
  }

  /**
   * Find a review by order ID
   */
  async findByOrderId(orderId: string) {
    return this.prisma.serviceReview.findUnique({
      where: { orderId },
      include: this.getReviewIncludes(),
    });
  }

  /**
   * Check if a review exists for an order
   */
  async existsForOrder(orderId: string): Promise<boolean> {
    const review = await this.prisma.serviceReview.findUnique({
      where: { orderId },
      select: { id: true },
    });
    return !!review;
  }

  /**
   * Find reviews by service ID
   */
  async findByServiceId(
    serviceId: string,
    options?: {
      minRating?: number;
      sortBy?: 'newest' | 'highest' | 'lowest' | 'helpful';
      page?: number;
      limit?: number;
    }
  ) {
    const { minRating, sortBy = 'newest', page = 1, limit = 20 } = options || {};

    const where: Prisma.ServiceReviewWhereInput = {
      serviceId,
      isPublic: true,
      ...(minRating && { overallRating: { gte: minRating } }),
    };

    const orderBy = this.getReviewOrderBy(sortBy);

    const [reviews, total] = await Promise.all([
      this.prisma.serviceReview.findMany({
        where,
        include: this.getReviewIncludes(),
        orderBy,
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.serviceReview.count({ where }),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  /**
   * Find reviews by reviewer ID
   */
  async findByReviewerId(reviewerId: string, options?: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = options || {};

    const where: Prisma.ServiceReviewWhereInput = { reviewerId };

    const [reviews, total] = await Promise.all([
      this.prisma.serviceReview.findMany({
        where,
        include: {
          ...this.getReviewIncludes(),
          service: {
            select: {
              id: true,
              title: true,
              slug: true,
              thumbnailUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.serviceReview.count({ where }),
    ]);

    return {
      reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  }

  /**
   * Update a review
   */
  async update(id: string, input: Partial<CreateReviewInput>) {
    return this.prisma.serviceReview.update({
      where: { id },
      data: {
        ...(input.overallRating !== undefined && { overallRating: input.overallRating }),
        ...(input.communicationRating !== undefined && {
          communicationRating: input.communicationRating,
        }),
        ...(input.qualityRating !== undefined && { qualityRating: input.qualityRating }),
        ...(input.deliveryRating !== undefined && { deliveryRating: input.deliveryRating }),
        ...(input.valueRating !== undefined && { valueRating: input.valueRating }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.content !== undefined && { content: input.content }),
      },
      include: this.getReviewIncludes(),
    });
  }

  /**
   * Add seller response to a review
   */
  async addSellerResponse(id: string, response: string) {
    return this.prisma.serviceReview.update({
      where: { id },
      data: {
        sellerResponse: response,
        sellerRespondedAt: new Date(),
      },
      include: this.getReviewIncludes(),
    });
  }

  /**
   * Increment helpful count
   */
  async incrementHelpfulCount(id: string) {
    return this.prisma.serviceReview.update({
      where: { id },
      data: { helpfulCount: { increment: 1 } },
    });
  }

  /**
   * Delete a review (soft delete by making it non-public)
   */
  async delete(id: string) {
    return this.prisma.serviceReview.update({
      where: { id },
      data: { isPublic: false },
    });
  }

  // ===========================================================================
  // STATS OPERATIONS
  // ===========================================================================

  /**
   * Get review stats for a service
   */
  async getServiceStats(serviceId: string): Promise<ReviewStats> {
    const reviews = await this.prisma.serviceReview.findMany({
      where: { serviceId, isPublic: true },
      select: {
        overallRating: true,
        communicationRating: true,
        qualityRating: true,
        deliveryRating: true,
        valueRating: true,
      },
    });

    if (reviews.length === 0) {
      return {
        avgRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        avgCommunication: 0,
        avgQuality: 0,
        avgDelivery: 0,
        avgValue: 0,
      };
    }

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    let totalCommunication = 0;
    let communicationCount = 0;
    let totalQuality = 0;
    let qualityCount = 0;
    let totalDelivery = 0;
    let deliveryCount = 0;
    let totalValue = 0;
    let valueCount = 0;

    for (const review of reviews) {
      totalRating += review.overallRating;
      const rating = Math.round(review.overallRating) as 1 | 2 | 3 | 4 | 5;
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating]++;
      }

      if (review.communicationRating) {
        totalCommunication += review.communicationRating;
        communicationCount++;
      }
      if (review.qualityRating) {
        totalQuality += review.qualityRating;
        qualityCount++;
      }
      if (review.deliveryRating) {
        totalDelivery += review.deliveryRating;
        deliveryCount++;
      }
      if (review.valueRating) {
        totalValue += review.valueRating;
        valueCount++;
      }
    }

    return {
      avgRating: totalRating / reviews.length,
      totalReviews: reviews.length,
      ratingDistribution,
      avgCommunication: communicationCount > 0 ? totalCommunication / communicationCount : 0,
      avgQuality: qualityCount > 0 ? totalQuality / qualityCount : 0,
      avgDelivery: deliveryCount > 0 ? totalDelivery / deliveryCount : 0,
      avgValue: valueCount > 0 ? totalValue / valueCount : 0,
    };
  }

  /**
   * Get review stats for a seller (across all their services)
   */
  async getSellerStats(sellerId: string): Promise<ReviewStats> {
    // First get all services by this seller
    const services = await this.prisma.service.findMany({
      where: { freelancerId: sellerId },
      select: { id: true },
    });

    const serviceIds = services.map((s) => s.id);

    if (serviceIds.length === 0) {
      return {
        avgRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        avgCommunication: 0,
        avgQuality: 0,
        avgDelivery: 0,
        avgValue: 0,
      };
    }

    const reviews = await this.prisma.serviceReview.findMany({
      where: { serviceId: { in: serviceIds }, isPublic: true },
      select: {
        overallRating: true,
        communicationRating: true,
        qualityRating: true,
        deliveryRating: true,
        valueRating: true,
      },
    });

    if (reviews.length === 0) {
      return {
        avgRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        avgCommunication: 0,
        avgQuality: 0,
        avgDelivery: 0,
        avgValue: 0,
      };
    }

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    let totalCommunication = 0;
    let communicationCount = 0;
    let totalQuality = 0;
    let qualityCount = 0;
    let totalDelivery = 0;
    let deliveryCount = 0;
    let totalValue = 0;
    let valueCount = 0;

    for (const review of reviews) {
      totalRating += review.overallRating;
      const rating = Math.round(review.overallRating) as 1 | 2 | 3 | 4 | 5;
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating]++;
      }

      if (review.communicationRating) {
        totalCommunication += review.communicationRating;
        communicationCount++;
      }
      if (review.qualityRating) {
        totalQuality += review.qualityRating;
        qualityCount++;
      }
      if (review.deliveryRating) {
        totalDelivery += review.deliveryRating;
        deliveryCount++;
      }
      if (review.valueRating) {
        totalValue += review.valueRating;
        valueCount++;
      }
    }

    return {
      avgRating: totalRating / reviews.length,
      totalReviews: reviews.length,
      ratingDistribution,
      avgCommunication: communicationCount > 0 ? totalCommunication / communicationCount : 0,
      avgQuality: qualityCount > 0 ? totalQuality / qualityCount : 0,
      avgDelivery: deliveryCount > 0 ? totalDelivery / deliveryCount : 0,
      avgValue: valueCount > 0 ? totalValue / valueCount : 0,
    };
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private getReviewIncludes() {
    return {
      reviewer: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          completedAt: true,
        },
      },
    };
  }

  private getReviewOrderBy(
    sortBy: 'newest' | 'highest' | 'lowest' | 'helpful'
  ): Prisma.ServiceReviewOrderByWithRelationInput {
    switch (sortBy) {
      case 'highest':
        return { overallRating: 'desc' };
      case 'lowest':
        return { overallRating: 'asc' };
      case 'helpful':
        return { helpfulCount: 'desc' };
      case 'newest':
      default:
        return { createdAt: 'desc' };
    }
  }
}
