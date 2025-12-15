/**
 * @module @skillancer/market-svc/services/enhanced-review
 * Enhanced Review Service with Fraud Detection Integration
 *
 * Extends the base ReviewService with:
 * - Fraud detection checks before submission
 * - Automatic flagging and moderation
 * - Reputation stats updates
 */

import { FraudDetectionService, type FraudCheckResult } from './fraud-detection.service.js';
import { ReputationService } from './reputation.service.js';
import {
  FREELANCER_RATING_DIMENSIONS,
  CLIENT_RATING_DIMENSIONS,
  calculateWeightedAverage,
} from '../config/rating-dimensions.js';
import { ReviewError, ReviewErrorCode } from '../errors/review.errors.js';

import type { FreelancerCategoryRatings, ClientCategoryRatings } from '../types/review.types.js';
import type { PrismaClient, Review, ReviewStatus, Prisma } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Review window duration in days
const REVIEW_WINDOW_DAYS = 14;

// =============================================================================
// TYPES
// =============================================================================

export interface SubmitReviewParams {
  contractId: string;
  reviewerId: string;
  rating: number;
  content?: string | undefined;
  categoryRatings: FreelancerCategoryRatings | ClientCategoryRatings;
  privateFeedback?: string | undefined;
  isPrivate?: boolean | undefined;

  // Metadata for fraud detection
  ipAddress?: string | undefined;
  deviceFingerprint?: string | undefined;
  userAgent?: string | undefined;
}

export interface RespondToReviewParams {
  reviewId: string;
  responderId: string;
  content: string;
}

export interface VoteHelpfulParams {
  reviewId: string;
  voterId: string;
  isHelpful: boolean;
}

export interface ReportReviewParams {
  reviewId: string;
  reporterId: string;
  reason: 'INAPPROPRIATE_CONTENT' | 'FALSE_INFORMATION' | 'HARASSMENT' | 'SPAM' | 'OTHER';
  details?: string;
}

export interface GetUserReviewsOptions {
  type?: 'received' | 'given' | undefined;
  minRating?: number | undefined;
  maxRating?: number | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ReviewSubmissionResult {
  review: Review;
  fraudCheck: FraudCheckResult;
  weightedRating: number;
}

// =============================================================================
// ENHANCED REVIEW SERVICE
// =============================================================================

export class EnhancedReviewService {
  private readonly fraudDetection: FraudDetectionService;
  private readonly reputation: ReputationService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.fraudDetection = new FraudDetectionService(prisma, redis, logger);
    this.reputation = new ReputationService(prisma, redis, logger);
  }

  // =========================================================================
  // PRIVATE HELPERS FOR SUBMIT REVIEW
  // =========================================================================

  /**
   * Validate contract exists and reviewer is a party
   */
  private async validateContractAndReviewer(
    contractId: string,
    reviewerId: string
  ): Promise<{
    contract: {
      id: string;
      clientId: string;
      freelancerId: string;
      completedAt: Date | null;
      endDate: Date | null;
    };
    isClient: boolean;
    isFreelancer: boolean;
    revieweeId: string;
    reviewType: 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT';
  }> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new ReviewError(ReviewErrorCode.CONTRACT_NOT_FOUND, 'Contract not found');
    }

    const isClient = contract.clientId === reviewerId;
    const isFreelancer = contract.freelancerId === reviewerId;

    if (!isClient && !isFreelancer) {
      throw new ReviewError(
        ReviewErrorCode.NOT_CONTRACT_PARTY,
        'You are not a party to this contract'
      );
    }

    const reviewType = isClient
      ? ('CLIENT_TO_FREELANCER' as const)
      : ('FREELANCER_TO_CLIENT' as const);
    const revieweeId = isClient ? contract.freelancerId : contract.clientId;

    return { contract, isClient, isFreelancer, revieweeId, reviewType };
  }

  /**
   * Check if review already exists or window expired
   */
  private async checkReviewEligibility(
    contractId: string,
    reviewerId: string,
    contract: { completedAt: Date | null; endDate: Date | null }
  ): Promise<void> {
    const existingReview = await this.prisma.review.findFirst({
      where: { contractId, reviewerId },
    });

    if (existingReview) {
      throw new ReviewError(
        ReviewErrorCode.REVIEW_ALREADY_SUBMITTED,
        'You have already submitted a review for this contract'
      );
    }

    const reviewDeadline = new Date(contract.completedAt || contract.endDate || Date.now());
    reviewDeadline.setDate(reviewDeadline.getDate() + REVIEW_WINDOW_DAYS);

    if (new Date() > reviewDeadline) {
      throw new ReviewError(
        ReviewErrorCode.REVIEW_WINDOW_EXPIRED,
        'The review window for this contract has expired'
      );
    }
  }

  /**
   * Determine review status based on fraud check and counterparty
   */
  private determineReviewStatus(
    fraudCheck: FraudCheckResult,
    hasCounterpartyReview: boolean
  ): ReviewStatus {
    if (fraudCheck.requiresModeration) {
      return 'HIDDEN';
    }
    return hasCounterpartyReview ? 'REVEALED' : 'PENDING';
  }

  /**
   * Submit a review with fraud detection
   */
  async submitReview(params: SubmitReviewParams): Promise<ReviewSubmissionResult> {
    const {
      contractId,
      reviewerId,
      rating,
      content,
      categoryRatings,
      privateFeedback,
      isPrivate,
      ipAddress,
      deviceFingerprint,
      userAgent,
    } = params;

    // Validate contract and reviewer
    const { contract, isClient, revieweeId, reviewType } = await this.validateContractAndReviewer(
      contractId,
      reviewerId
    );

    // Check eligibility (existing review, window expiry)
    await this.checkReviewEligibility(contractId, reviewerId, contract);

    // Validate category ratings
    this.validateCategoryRatings(categoryRatings, reviewType);

    // Calculate weighted rating
    const dimensions = isClient ? FREELANCER_RATING_DIMENSIONS : CLIENT_RATING_DIMENSIONS;
    const ratingsRecord = categoryRatings as unknown as Record<string, number>;
    const weightedRating = calculateWeightedAverage(ratingsRecord, dimensions);

    // Run fraud detection
    const fraudCheck = await this.fraudDetection.checkReview({
      reviewerId,
      revieweeId,
      contractId,
      rating,
      feedback: content,
      ipAddress,
      deviceFingerprint,
      userAgent,
    });

    // If blocked by fraud detection, reject the review
    if (fraudCheck.blocked) {
      this.logger.warn({
        msg: 'Review blocked by fraud detection',
        reviewerId,
        revieweeId,
        contractId,
        reason: fraudCheck.reason,
        checks: fraudCheck.checks,
      });

      throw new ReviewError(
        ReviewErrorCode.REVIEW_BLOCKED,
        fraudCheck.reason || 'Review could not be submitted due to suspicious activity'
      );
    }

    // Check if counterparty has already submitted their review
    const counterpartyReview = await this.prisma.review.findFirst({
      where: {
        contractId,
        reviewerId: revieweeId,
      },
    });

    // Determine initial status using helper
    const status = this.determineReviewStatus(fraudCheck, !!counterpartyReview);
    const revealedAt = status === 'REVEALED' ? new Date() : null;

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        contractId,
        reviewerId,
        revieweeId,
        reviewType,
        overallRating: rating,
        categoryRatings: structuredClone(categoryRatings) as unknown as Prisma.InputJsonValue,
        content: content ?? null,
        privateFeedback: privateFeedback ?? null,
        isPublic: !(isPrivate ?? false),
        status,
        revealedAt,
        moderationReason: fraudCheck.requiresModeration ? (fraudCheck.reason ?? null) : null,
      },
    });

    // If counterparty review exists and not in moderation, reveal it too
    if (counterpartyReview?.status === 'PENDING' && !fraudCheck.requiresModeration) {
      await this.prisma.review.update({
        where: { id: counterpartyReview.id },
        data: {
          status: 'REVEALED',
          revealedAt: new Date(),
        },
      });

      // Update reputation for counterparty
      const counterpartyRole = reviewType === 'CLIENT_TO_FREELANCER' ? 'CLIENT' : 'FREELANCER';
      await this.reputation.recalculateStats(reviewerId, counterpartyRole);
    }

    // Update reputation if review is revealed
    if (status === 'REVEALED') {
      const revieweeRole = reviewType === 'CLIENT_TO_FREELANCER' ? 'FREELANCER' : 'CLIENT';
      await this.reputation.recalculateStats(revieweeId, revieweeRole);
    }

    // Update review invitation status if exists
    await this.prisma.reviewInvitation.updateMany({
      where: {
        contractId,
        userId: reviewerId,
        status: 'PENDING',
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    this.logger.info({
      msg: 'Review submitted',
      reviewId: review.id,
      contractId,
      reviewType,
      status,
      weightedRating,
      fraudChecks: fraudCheck.checks.map((c) => c.type),
    });

    return {
      review,
      fraudCheck,
      weightedRating,
    };
  }

  /**
   * Get a specific review
   */
  async getReview(reviewId: string): Promise<Review> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        reviewer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        response: true,
        contract: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!review) {
      throw new ReviewError(ReviewErrorCode.REVIEW_NOT_FOUND, 'Review not found');
    }

    return review;
  }

  /**
   * Get reviews for a user
   */
  async getReviewsForUser(
    userId: string,
    options: GetUserReviewsOptions = {}
  ): Promise<{
    reviews: Review[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    stats: {
      averageRating: number;
      totalReviews: number;
      ratingDistribution: Record<number, number>;
    };
  }> {
    const { type = 'received', minRating, maxRating, limit = 10, offset = 0 } = options;

    const where: Prisma.ReviewWhereInput = {
      ...(type === 'received' ? { revieweeId: userId } : { reviewerId: userId }),
      status: 'REVEALED',
      ...(minRating === undefined ? {} : { overallRating: { gte: minRating } }),
      ...(maxRating === undefined ? {} : { overallRating: { lte: maxRating } }),
    };

    const [reviews, total, allReviews] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          reviewee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          contract: {
            select: {
              id: true,
              title: true,
            },
          },
          response: true,
        },
      }),
      this.prisma.review.count({ where }),
      // Get all for stats calculation
      this.prisma.review.findMany({
        where: {
          ...(type === 'received' ? { revieweeId: userId } : { reviewerId: userId }),
          status: 'REVEALED',
        },
        select: { overallRating: true },
      }),
    ]);

    // Calculate stats
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of allReviews) {
      sum += r.overallRating;
      const rating = r.overallRating;
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating] = (ratingDistribution[rating] ?? 0) + 1;
      }
    }

    return {
      reviews,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + reviews.length < total,
      },
      stats: {
        averageRating:
          allReviews.length > 0 ? Math.round((sum / allReviews.length) * 100) / 100 : 0,
        totalReviews: allReviews.length,
        ratingDistribution,
      },
    };
  }

  /**
   * Respond to a review
   */
  async respondToReview(params: RespondToReviewParams) {
    const { reviewId, responderId, content } = params;

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new ReviewError(ReviewErrorCode.REVIEW_NOT_FOUND, 'Review not found');
    }

    // Only the reviewee can respond
    if (review.revieweeId !== responderId) {
      throw new ReviewError(
        ReviewErrorCode.UNAUTHORIZED,
        'Only the reviewee can respond to a review'
      );
    }

    // Check if already responded
    if (review.responseId) {
      throw new ReviewError(
        ReviewErrorCode.RESPONSE_ALREADY_EXISTS,
        'A response has already been submitted for this review'
      );
    }

    // Create response first
    const response = await this.prisma.reviewResponse.create({
      data: {
        content,
      },
    });

    // Update review with response reference
    await this.prisma.review.update({
      where: { id: reviewId },
      data: { responseId: response.id },
    });

    this.logger.info({
      msg: 'Review response submitted',
      reviewId,
      responseId: response.id,
    });

    return response;
  }

  /**
   * Vote on review helpfulness
   */
  async voteHelpful(params: VoteHelpfulParams) {
    const { reviewId, voterId, isHelpful } = params;

    // Verify review exists
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new ReviewError(ReviewErrorCode.REVIEW_NOT_FOUND, 'Review not found');
    }

    // Upsert the vote
    const vote = await this.prisma.reviewHelpfulVote.upsert({
      where: {
        reviewId_userId: {
          reviewId,
          userId: voterId,
        },
      },
      create: {
        reviewId,
        userId: voterId,
        isHelpful,
      },
      update: {
        isHelpful,
      },
    });

    // Update review counts
    const counts = await this.prisma.reviewHelpfulVote.groupBy({
      by: ['isHelpful'],
      where: { reviewId },
      _count: true,
    });

    const helpfulCount = counts.find((c) => c.isHelpful)?._count ?? 0;
    const notHelpfulCount = counts.find((c) => !c.isHelpful)?._count ?? 0;

    await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        helpfulCount,
        notHelpfulCount,
      },
    });

    return vote;
  }

  /**
   * Report a review
   */
  async reportReview(params: ReportReviewParams) {
    const { reviewId, reporterId, reason, details } = params;

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new ReviewError(ReviewErrorCode.REVIEW_NOT_FOUND, 'Review not found');
    }

    // Check for existing report from this user
    const existingReport = await this.prisma.reviewReport.findFirst({
      where: {
        reviewId,
        reporterId,
        status: 'PENDING',
      },
    });

    if (existingReport) {
      throw new ReviewError(
        ReviewErrorCode.REPORT_ALREADY_EXISTS,
        'You have already reported this review'
      );
    }

    const report = await this.prisma.reviewReport.create({
      data: {
        reviewId,
        reporterId,
        reason,
        description: details ?? null,
      },
    });

    this.logger.info({
      msg: 'Review reported',
      reviewId,
      reportId: report.id,
      reason,
    });

    return report;
  }

  /**
   * Get pending review invitations for a user
   */
  async getPendingInvitations(userId: string): Promise<
    Array<{
      id: string;
      contractId: string;
      contractTitle: string;
      reviewType: string;
      dueAt: Date;
      reminderCount: number;
    }>
  > {
    const invitations = await this.prisma.reviewInvitation.findMany({
      where: {
        userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        contract: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      contractId: inv.contractId,
      contractTitle: inv.contract?.title ?? 'Unknown',
      reviewType: inv.reviewType,
      dueAt: inv.expiresAt,
      reminderCount: inv.reminderCount,
    }));
  }

  /**
   * Validate category ratings based on review type
   */
  private validateCategoryRatings(
    ratings: FreelancerCategoryRatings | ClientCategoryRatings,
    reviewType: string
  ): void {
    const validateRange = (value: number, field: string) => {
      if (value < 1 || value > 5) {
        throw new ReviewError(ReviewErrorCode.INVALID_RATING, `${field} must be between 1 and 5`);
      }
    };

    if (reviewType === 'CLIENT_TO_FREELANCER') {
      const r = ratings as FreelancerCategoryRatings;
      validateRange(r.communication, 'Communication');
      validateRange(r.quality, 'Quality');
      validateRange(r.expertise, 'Expertise');
      validateRange(r.professionalism, 'Professionalism');
      validateRange(r.deadline, 'Deadline');
    } else {
      const r = ratings as ClientCategoryRatings;
      validateRange(r.communication, 'Communication');
      validateRange(r.requirements, 'Requirements');
      validateRange(r.paymentPromptness, 'Payment promptness');
      validateRange(r.professionalism, 'Professionalism');
    }
  }

  /**
   * Get reputation service for direct access
   */
  getReputationService(): ReputationService {
    return this.reputation;
  }

  /**
   * Get fraud detection service for direct access
   */
  getFraudDetectionService(): FraudDetectionService {
    return this.fraudDetection;
  }
}
