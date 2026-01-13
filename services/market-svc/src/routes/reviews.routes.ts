/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Review Routes
 *
 * Public API endpoints for the review system
 */

import { z } from 'zod';

import { ReviewAggregationService } from '../services/review-aggregation.service.js';
import { ReviewInvitationService } from '../services/review-invitation.service.js';
import { ReviewService } from '../services/review.service.js';

import type { FreelancerCategoryRatings, ClientCategoryRatings } from '../types/review.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const FreelancerCategoryRatingsSchema = z.object({
  quality: z.number().min(1).max(5),
  communication: z.number().min(1).max(5),
  expertise: z.number().min(1).max(5),
  professionalism: z.number().min(1).max(5),
  deadline: z.number().min(1).max(5),
  wouldHireAgain: z.boolean().optional(),
});

const ClientCategoryRatingsSchema = z.object({
  clarity: z.number().min(1).max(5).optional(),
  responsiveness: z.number().min(1).max(5).optional(),
  payment: z.number().min(1).max(5).optional(),
  professionalism: z.number().min(1).max(5),
  communication: z.number().min(1).max(5),
  requirements: z.number().min(1).max(5),
  paymentPromptness: z.number().min(1).max(5),
  wouldWorkAgain: z.boolean().optional(),
});

const SubmitReviewSchema = z.object({
  contractId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  content: z.string().min(10).max(2000).optional(),
  categoryRatings: z.union([FreelancerCategoryRatingsSchema, ClientCategoryRatingsSchema]),
  isPrivate: z.boolean().default(false),
});

const RespondToReviewSchema = z.object({
  content: z.string().min(10).max(2000),
});

const VoteHelpfulSchema = z.object({
  isHelpful: z.boolean(),
});

const ReportReviewSchema = z.object({
  reason: z.enum(['INAPPROPRIATE_CONTENT', 'FALSE_INFORMATION', 'HARASSMENT', 'SPAM', 'OTHER']),
  details: z.string().max(1000).optional(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface ReviewRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerReviewRoutes(fastify: FastifyInstance, deps: ReviewRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize services
  const reviewService = new ReviewService(prisma, redis, logger);
  const aggregationService = new ReviewAggregationService(prisma, redis, logger);
  const invitationService = new ReviewInvitationService(prisma, redis, logger);

  // Helper to get user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // POST /reviews - Submit a review
  fastify.post('/', async (request, reply) => {
    const user = getUser(request);
    const body = SubmitReviewSchema.parse(request.body);

    const review = await reviewService.submitReview({
      contractId: body.contractId,
      reviewerId: user.id,
      rating: body.rating,
      categoryRatings: body.categoryRatings as FreelancerCategoryRatings | ClientCategoryRatings,
      isPrivate: body.isPrivate,
      ...(body.content !== undefined ? { content: body.content } : {}),
    });

    logger.info({
      msg: 'Review submitted',
      reviewId: review.id,
      contractId: body.contractId,
      reviewerId: user.id,
    });

    return reply.status(201).send({
      success: true,
      review,
      message:
        review.status === 'REVEALED'
          ? 'Review submitted and revealed'
          : 'Review submitted - will be revealed when counterparty submits theirs',
    });
  });

  // GET /reviews/:reviewId - Get a specific review
  fastify.get<{ Params: { reviewId: string } }>('/:reviewId', async (request, reply) => {
    const { reviewId } = request.params;
    const review = await reviewService.getReview(reviewId);

    return reply.send({
      success: true,
      review,
    });
  });

  // GET /reviews/user/:userId - Get reviews for a user
  fastify.get<{
    Params: { userId: string };
    Querystring: { type?: string; limit?: string; offset?: string };
  }>('/user/:userId', async (request, reply) => {
    const { userId } = request.params;
    const { type, limit, offset } = request.query;

    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? Number.parseInt(offset, 10) : undefined;

    const result = await reviewService.getReviewsForUser(userId, {
      type: type === 'given' ? 'given' : 'received',
      ...(parsedLimit !== undefined ? { limit: parsedLimit } : {}),
      ...(parsedOffset !== undefined ? { offset: parsedOffset } : {}),
    });

    return reply.send({
      success: true,
      ...result,
    });
  });

  // GET /reviews/user/:userId/aggregation - Get rating aggregation
  fastify.get<{ Params: { userId: string } }>(
    '/user/:userId/aggregation',
    async (request, reply) => {
      const { userId } = request.params;
      const aggregation = await aggregationService.getOrCalculateAggregation(userId);

      return reply.send({
        success: true,
        aggregation,
      });
    }
  );

  // POST /reviews/:reviewId/respond - Respond to a review
  fastify.post<{ Params: { reviewId: string } }>('/:reviewId/respond', async (request, reply) => {
    const user = getUser(request);
    const { reviewId } = request.params;
    const body = RespondToReviewSchema.parse(request.body);

    const response = await reviewService.respondToReview({
      reviewId,
      responderId: user.id,
      content: body.content,
    });

    return reply.status(201).send({
      success: true,
      response,
    });
  });

  // POST /reviews/:reviewId/vote - Vote on helpfulness
  fastify.post<{ Params: { reviewId: string } }>('/:reviewId/vote', async (request, reply) => {
    const user = getUser(request);
    const { reviewId } = request.params;
    const body = VoteHelpfulSchema.parse(request.body);

    const vote = await reviewService.voteHelpful({
      reviewId,
      voterId: user.id,
      isHelpful: body.isHelpful,
    });

    return reply.send({
      success: true,
      vote,
    });
  });

  // POST /reviews/:reviewId/report - Report a review
  fastify.post<{ Params: { reviewId: string } }>('/:reviewId/report', async (request, reply) => {
    const user = getUser(request);
    const { reviewId } = request.params;
    const body = ReportReviewSchema.parse(request.body);

    const report = await reviewService.reportReview({
      reviewId,
      reporterId: user.id,
      reason: body.reason,
      ...(body.details !== undefined ? { details: body.details } : {}),
    });

    return reply.status(201).send({
      success: true,
      report,
      message: 'Report submitted successfully',
    });
  });

  // GET /reviews/invitations - Get pending invitations
  fastify.get('/invitations', async (request, reply) => {
    const user = getUser(request);
    const invitations = await invitationService.getPendingInvitations(user.id);

    return reply.send({
      success: true,
      invitations,
    });
  });

  // GET /reviews/feed - Get recent reviews feed
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/feed',
    async (request, reply) => {
      const { limit: limitStr, offset: offsetStr } = request.query;
      const limit = limitStr ? Number.parseInt(limitStr, 10) : 20;
      const offset = offsetStr ? Number.parseInt(offsetStr, 10) : 0;

      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where: {
            status: 'REVEALED',
            isPublic: true,
          },
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
          },
        }),
        prisma.review.count({
          where: {
            status: 'REVEALED',
            isPublic: true,
          },
        }),
      ]);

      return reply.send({
        success: true,
        reviews,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + reviews.length < total,
        },
      });
    }
  );
}
