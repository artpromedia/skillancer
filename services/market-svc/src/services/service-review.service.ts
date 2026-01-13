/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Service Review Service
 *
 * Core service for managing service reviews:
 * - Create and manage reviews
 * - Handle seller responses
 * - Calculate review statistics
 */

import { ServiceCatalogError, ServiceCatalogErrorCode } from '../errors/service-catalog.errors.js';
import { ServiceOrderRepository } from '../repositories/service-order.repository.js';
import { ServiceReviewRepository } from '../repositories/service-review.repository.js';
import { ServiceRepository } from '../repositories/service.repository.js';

import type {
  CreateReviewInput,
  AddSellerResponseInput,
  ReviewStats,
} from '../types/service-catalog.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Cache TTLs
const REVIEW_STATS_CACHE_TTL = 300; // 5 minutes

export class ServiceReviewService {
  private readonly reviewRepository: ServiceReviewRepository;
  private readonly orderRepository: ServiceOrderRepository;
  private readonly serviceRepository: ServiceRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.reviewRepository = new ServiceReviewRepository(prisma);
    this.orderRepository = new ServiceOrderRepository(prisma);
    this.serviceRepository = new ServiceRepository(prisma);
  }

  // ===========================================================================
  // REVIEW CRUD
  // ===========================================================================

  /**
   * Create a review for a completed order
   */
  async createReview(orderId: string, userId: string, input: CreateReviewInput) {
    // Get the order
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.ORDER_NOT_FOUND);
    }

    // Only buyer can review
    if (order.buyerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_ORDER_BUYER);
    }

    // Order must be completed
    if (order.status !== 'COMPLETED') {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.CANNOT_REVIEW_INCOMPLETE_ORDER);
    }

    // Check if review already exists
    const existingReview = await this.reviewRepository.existsForOrder(orderId);
    if (existingReview) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.REVIEW_ALREADY_EXISTS);
    }

    // Validate ratings
    this.validateRatings(input);

    // Create review
    const review = await this.reviewRepository.create(orderId, order.serviceId, userId, input);

    // Update service rating
    await this.serviceRepository.updateStatsAfterOrder(order.serviceId, input.overallRating);

    // Invalidate cache
    await this.invalidateReviewCache(order.serviceId);

    this.logger.info({
      msg: 'Service review created',
      reviewId: review.id,
      orderId,
      serviceId: order.serviceId,
      rating: input.overallRating,
      reviewerId: userId,
    });

    // FUTURE: Notify seller

    return review;
  }

  /**
   * Get a review by ID
   */
  async getReview(reviewId: string) {
    const review = await this.reviewRepository.findById(reviewId);

    if (!review) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.REVIEW_NOT_FOUND);
    }

    return review;
  }

  /**
   * Get reviews for a service
   */
  async getServiceReviews(
    serviceId: string,
    options?: {
      minRating?: number;
      sortBy?: 'newest' | 'highest' | 'lowest' | 'helpful';
      page?: number;
      limit?: number;
    }
  ) {
    return this.reviewRepository.findByServiceId(serviceId, options);
  }

  /**
   * Get reviews by a user
   */
  async getUserReviews(userId: string, options?: { page?: number; limit?: number }) {
    return this.reviewRepository.findByReviewerId(userId, options);
  }

  /**
   * Update a review (by the reviewer)
   */
  async updateReview(reviewId: string, userId: string, input: Partial<CreateReviewInput>) {
    const review = await this.reviewRepository.findById(reviewId);

    if (!review) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.REVIEW_NOT_FOUND);
    }

    if (review.reviewerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_REVIEW_OWNER);
    }

    // Validate ratings if provided
    if (input.overallRating !== undefined) {
      this.validateRatings(input as CreateReviewInput);
    }

    const updatedReview = await this.reviewRepository.update(reviewId, input);

    // If rating changed, recalculate service stats
    if (input.overallRating !== undefined && input.overallRating !== review.overallRating) {
      // This is a simplification - in production, we'd need proper recalculation
      await this.invalidateReviewCache(review.serviceId);
    }

    this.logger.info({
      msg: 'Service review updated',
      reviewId,
      reviewerId: userId,
    });

    return updatedReview;
  }

  /**
   * Delete a review (by the reviewer)
   */
  async deleteReview(reviewId: string, userId: string) {
    const review = await this.reviewRepository.findById(reviewId);

    if (!review) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.REVIEW_NOT_FOUND);
    }

    if (review.reviewerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_REVIEW_OWNER);
    }

    await this.reviewRepository.delete(reviewId);

    // Invalidate cache
    await this.invalidateReviewCache(review.serviceId);

    this.logger.info({
      msg: 'Service review deleted',
      reviewId,
      reviewerId: userId,
    });
  }

  // ===========================================================================
  // SELLER RESPONSE
  // ===========================================================================

  /**
   * Add a seller response to a review
   */
  async addSellerResponse(reviewId: string, userId: string, input: AddSellerResponseInput) {
    const review = await this.reviewRepository.findById(reviewId);

    if (!review) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.REVIEW_NOT_FOUND);
    }

    // Get the service to verify ownership
    const service = await this.serviceRepository.findById(review.serviceId);

    if (!service || service.freelancerId !== userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.NOT_SERVICE_OWNER);
    }

    // Cannot respond to own review (shouldn't happen, but just in case)
    if (review.reviewerId === userId) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.CANNOT_RESPOND_TO_OWN_REVIEW);
    }

    // Check if already responded
    if (review.sellerResponse) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.SELLER_RESPONSE_ALREADY_EXISTS);
    }

    const updatedReview = await this.reviewRepository.addSellerResponse(reviewId, input.response);

    this.logger.info({
      msg: 'Seller response added to review',
      reviewId,
      sellerId: userId,
    });

    // FUTURE: Notify reviewer

    return updatedReview;
  }

  // ===========================================================================
  // HELPFULNESS
  // ===========================================================================

  /**
   * Mark a review as helpful
   */
  async markAsHelpful(reviewId: string, userId: string) {
    const review = await this.reviewRepository.findById(reviewId);

    if (!review) {
      throw new ServiceCatalogError(ServiceCatalogErrorCode.REVIEW_NOT_FOUND);
    }

    // Cannot mark own review as helpful
    if (review.reviewerId === userId) {
      return review;
    }

    // Check if user already marked this review as helpful
    const helpfulKey = `review:helpful:${reviewId}:${userId}`;
    const alreadyMarked = await this.redis.exists(helpfulKey);

    if (alreadyMarked) {
      return review;
    }

    // Mark as helpful and record user vote
    await Promise.all([
      this.reviewRepository.incrementHelpfulCount(reviewId),
      this.redis.set(helpfulKey, '1'), // Permanent record
    ]);

    this.logger.info({
      msg: 'Review marked as helpful',
      reviewId,
      userId,
    });

    return this.reviewRepository.findById(reviewId);
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get review statistics for a service
   */
  async getServiceStats(serviceId: string): Promise<ReviewStats> {
    // Try cache first
    const cacheKey = `review:stats:service:${serviceId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const stats = await this.reviewRepository.getServiceStats(serviceId);

    // Cache the result
    await this.redis.setex(cacheKey, REVIEW_STATS_CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  /**
   * Get review statistics for a seller
   */
  async getSellerStats(sellerId: string): Promise<ReviewStats> {
    // Try cache first
    const cacheKey = `review:stats:seller:${sellerId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const stats = await this.reviewRepository.getSellerStats(sellerId);

    // Cache the result
    await this.redis.setex(cacheKey, REVIEW_STATS_CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Validate review ratings
   */
  private validateRatings(input: CreateReviewInput) {
    const validateRating = (value: number | undefined, field: string) => {
      if (value !== undefined && (value < 1 || value > 5)) {
        throw new ServiceCatalogError(
          ServiceCatalogErrorCode.REVIEW_NOT_FOUND,
          `${field} must be between 1 and 5`
        );
      }
    };

    validateRating(input.overallRating, 'Overall rating');
    validateRating(input.communicationRating, 'Communication rating');
    validateRating(input.qualityRating, 'Quality rating');
    validateRating(input.deliveryRating, 'Delivery rating');
    validateRating(input.valueRating, 'Value rating');

    if (!input.overallRating || input.overallRating < 1 || input.overallRating > 5) {
      throw new ServiceCatalogError(
        ServiceCatalogErrorCode.REVIEW_NOT_FOUND,
        'Overall rating is required and must be between 1 and 5'
      );
    }
  }

  /**
   * Invalidate review-related cache
   */
  private async invalidateReviewCache(serviceId: string) {
    await this.redis.del(`review:stats:service:${serviceId}`);

    // Get the service to find the seller
    const service = await this.serviceRepository.findById(serviceId);
    if (service) {
      await this.redis.del(`review:stats:seller:${service.freelancerId}`);
    }
  }
}
