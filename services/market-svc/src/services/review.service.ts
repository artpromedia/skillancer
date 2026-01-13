/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Review Service
 *
 * Core service for managing reviews:
 * - Submit reviews with bilateral reveal system
 * - Respond to reviews
 * - Vote on helpfulness
 * - Report reviews
 */

import { ReviewError, ReviewErrorCode } from '../errors/review.errors.js';

import type { FreelancerCategoryRatings, ClientCategoryRatings } from '../types/review.types.js';
import type { PrismaClient, Review, ReviewStatus, Prisma } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Review window duration in days
const REVIEW_WINDOW_DAYS = 14;

export interface SubmitReviewParams {
  contractId: string;
  reviewerId: string;
  rating: number;
  content?: string;
  categoryRatings: FreelancerCategoryRatings | ClientCategoryRatings;
  isPrivate?: boolean;
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
  type?: 'received' | 'given';
  limit?: number;
  offset?: number;
}

export class ReviewService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  /**
   * Submit a review for a completed contract
   */
  async submitReview(params: SubmitReviewParams): Promise<Review> {
    const { contractId, reviewerId, rating, content, categoryRatings, isPrivate } = params;

    // Get contract to determine review type
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new ReviewError(ReviewErrorCode.CONTRACT_NOT_FOUND, 'Contract not found');
    }

    // Verify reviewer is party to the contract
    const isClient = contract.clientId === reviewerId;
    const isFreelancer = contract.freelancerId === reviewerId;

    if (!isClient && !isFreelancer) {
      throw new ReviewError(
        ReviewErrorCode.NOT_CONTRACT_PARTY,
        'You are not a party to this contract'
      );
    }

    // Determine review type based on reviewer role
    const reviewType = isClient ? 'CLIENT_TO_FREELANCER' : 'FREELANCER_TO_CLIENT';
    const revieweeId = isClient ? contract.freelancerId : contract.clientId;

    // Check if review already exists
    const existingReview = await this.prisma.review.findFirst({
      where: {
        contractId,
        reviewerId,
      },
    });

    if (existingReview) {
      throw new ReviewError(
        ReviewErrorCode.REVIEW_ALREADY_SUBMITTED,
        'You have already submitted a review for this contract'
      );
    }

    // Check review window
    const reviewDeadline = new Date(contract.completedAt || contract.endDate || Date.now());
    reviewDeadline.setDate(reviewDeadline.getDate() + REVIEW_WINDOW_DAYS);

    if (new Date() > reviewDeadline) {
      throw new ReviewError(
        ReviewErrorCode.REVIEW_WINDOW_EXPIRED,
        'The review window for this contract has expired'
      );
    }

    // Validate category ratings
    this.validateCategoryRatings(categoryRatings, reviewType);

    // Check if counterparty has already submitted their review
    const counterpartyReview = await this.prisma.review.findFirst({
      where: {
        contractId,
        reviewerId: revieweeId,
      },
    });

    // Determine initial status - reveal both if counterparty has submitted
    const status: ReviewStatus = counterpartyReview ? 'REVEALED' : 'PENDING';
    const revealedAt = counterpartyReview ? new Date() : null;

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        contractId,
        reviewerId,
        revieweeId,
        reviewType: reviewType as 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT',
        overallRating: rating,
        categoryRatings: JSON.parse(JSON.stringify(categoryRatings)) as Prisma.InputJsonValue,
        content: content ?? null,
        isPublic: !(isPrivate ?? false),
        status,
        revealedAt,
      },
    });

    // If counterparty review exists, reveal it too
    if (counterpartyReview && counterpartyReview.status === 'PENDING') {
      await this.prisma.review.update({
        where: { id: counterpartyReview.id },
        data: {
          status: 'REVEALED',
          revealedAt: new Date(),
        },
      });
    }

    this.logger.info({
      msg: 'Review submitted',
      reviewId: review.id,
      contractId,
      reviewType,
      revealed: status === 'REVEALED',
    });

    return review;
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
  }> {
    const { type = 'received', limit = 10, offset = 0 } = options;

    const where =
      type === 'received'
        ? { revieweeId: userId, status: 'REVEALED' as ReviewStatus }
        : { reviewerId: userId, status: 'REVEALED' as ReviewStatus };

    const [reviews, total] = await Promise.all([
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
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + reviews.length < total,
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

    // Upsert the vote - unique constraint is on reviewId + userId
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
        reason: reason as
          | 'INAPPROPRIATE_CONTENT'
          | 'FALSE_INFORMATION'
          | 'HARASSMENT'
          | 'SPAM'
          | 'OTHER',
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
}
