// @ts-nocheck
/**
 * @module @skillancer/market-svc/routes/enhanced-reviews
 * Enhanced Review Routes with Fraud Detection
 *
 * V2 API endpoints for the enhanced review system:
 * - Review submission with fraud detection
 * - Reputation stats
 * - Fraud detection admin endpoints
 */

import { z } from 'zod';

import { ReviewError } from '../errors/review.errors.js';
import { EnhancedReviewService } from '../services/enhanced-review.service.js';

import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const GetReviewsQuerySchema = z.object({
  type: z.enum(['received', 'given']).default('received'),
  minRating: z.coerce.number().min(1).max(5).optional(),
  maxRating: z.coerce.number().min(1).max(5).optional(),
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
});

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
  privateFeedback: z.string().max(2000).optional(),
  isPrivate: z.boolean().default(false),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface EnhancedReviewRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerEnhancedReviewRoutes(
  fastify: FastifyInstance,
  deps: EnhancedReviewRouteDeps
): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const reviewService = new EnhancedReviewService(prisma, redis, logger);
  const reputationService = reviewService.getReputationService();

  // Helper to get user - using type assertion for Fastify request
  const getUser = (request: FastifyRequest) => {
    const user = (request as unknown as { user?: { id: string; email: string; role: string } })
      .user;
    if (!user) {
      throw new Error('Authentication required');
    }
    return user;
  };

  // Helper to get request metadata
  const getRequestMetadata = (request: FastifyRequest) => ({
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    deviceFingerprint: request.headers['x-device-fingerprint'] as string | undefined,
  });

  // ==========================================================================
  // REVIEW SUBMISSION WITH FRAUD DETECTION
  // ==========================================================================

  // POST /v2/reviews - Submit review with fraud detection
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const body = SubmitReviewSchema.parse(request.body);
    const metadata = getRequestMetadata(request);

    try {
      const result = await reviewService.submitReview({
        contractId: body.contractId,
        reviewerId: user.id,
        rating: body.rating,
        content: body.content,
        categoryRatings: body.categoryRatings,
        privateFeedback: body.privateFeedback,
        isPrivate: body.isPrivate,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceFingerprint: metadata.deviceFingerprint,
      });

      logger.info({
        msg: 'Enhanced review submitted',
        reviewId: result.review.id,
        contractId: body.contractId,
        reviewerId: user.id,
        fraudChecks: result.fraudCheck.checks.length,
        requiresModeration: result.fraudCheck.requiresModeration,
      });

      let message = 'Review submitted - will be revealed when counterparty submits theirs';
      if (result.review.status === 'REVEALED') {
        message = 'Review submitted and revealed';
      } else if (result.review.status === 'HIDDEN') {
        message = 'Review submitted and is pending moderation';
      }

      return await reply.status(201).send({
        success: true,
        review: result.review,
        weightedRating: result.weightedRating,
        message,
      });
    } catch (error) {
      if (error instanceof ReviewError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
      }
      throw error;
    }
  });

  // ==========================================================================
  // REVIEW MANAGEMENT
  // ==========================================================================

  // GET /v2/reviews/:reviewId - Get a specific review
  fastify.get<{ Params: { reviewId: string } }>(
    '/:reviewId',
    async (request: FastifyRequest<{ Params: { reviewId: string } }>, reply: FastifyReply) => {
      const { reviewId } = request.params;

      try {
        const review = await reviewService.getReview(reviewId);
        return await reply.send({
          success: true,
          review,
        });
      } catch (error) {
        if (error instanceof ReviewError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  // GET /v2/reviews/user/:userId - Get reviews for a user with stats
  fastify.get<{
    Params: { userId: string };
    Querystring: Record<string, string>;
  }>(
    '/user/:userId',
    async (
      request: FastifyRequest<{ Params: { userId: string }; Querystring: Record<string, string> }>,
      reply: FastifyReply
    ) => {
      const { userId } = request.params;
      const query = GetReviewsQuerySchema.parse(request.query);

      const result = await reviewService.getReviewsForUser(userId, {
        type: query.type,
        minRating: query.minRating,
        maxRating: query.maxRating,
        limit: query.limit,
        offset: query.offset,
      });

      return reply.send({
        success: true,
        ...result,
      });
    }
  );

  // ==========================================================================
  // REPUTATION ENDPOINTS
  // ==========================================================================

  // GET /v2/reviews/reputation/:userId - Get full reputation summary
  fastify.get<{ Params: { userId: string } }>(
    '/reputation/:userId',
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      const { userId } = request.params;

      const summary = await reputationService.getReputationSummary(userId);

      return reply.send({
        success: true,
        reputation: summary,
      });
    }
  );

  // GET /v2/reviews/reputation/:userId/:role - Get role-specific reputation
  fastify.get<{ Params: { userId: string; role: string } }>(
    '/reputation/:userId/:role',
    async (
      request: FastifyRequest<{ Params: { userId: string; role: string } }>,
      reply: FastifyReply
    ) => {
      const { userId, role } = request.params;

      if (role !== 'freelancer' && role !== 'client') {
        return reply.status(400).send({
          success: false,
          error: 'INVALID_ROLE',
          message: 'Role must be "freelancer" or "client"',
        });
      }

      const stats = await reputationService.getStats(
        userId,
        role.toUpperCase() as 'FREELANCER' | 'CLIENT'
      );

      return reply.send({
        success: true,
        stats,
      });
    }
  );

  // GET /v2/reviews/top-rated - Get top rated users
  fastify.get<{
    Querystring: { role?: string; limit?: string; minReviews?: string };
  }>(
    '/top-rated',
    async (
      request: FastifyRequest<{
        Querystring: { role?: string; limit?: string; minReviews?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { role = 'freelancer', limit = '10', minReviews = '5' } = request.query;

      if (role !== 'freelancer' && role !== 'client') {
        return reply.status(400).send({
          success: false,
          error: 'INVALID_ROLE',
          message: 'Role must be "freelancer" or "client"',
        });
      }

      const topRated = await reputationService.getTopRated(
        role.toUpperCase() as 'FREELANCER' | 'CLIENT',
        {
          limit: Number.parseInt(limit, 10),
          minReviews: Number.parseInt(minReviews, 10),
        }
      );

      return reply.send({
        success: true,
        topRated,
      });
    }
  );

  // ==========================================================================
  // INVITATIONS
  // ==========================================================================

  // GET /v2/reviews/invitations - Get pending invitations
  fastify.get('/invitations', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const invitations = await reviewService.getPendingInvitations(user.id);

    return reply.send({
      success: true,
      invitations,
    });
  });

  // ==========================================================================
  // ADMIN: REPUTATION MANAGEMENT
  // ==========================================================================

  // POST /v2/reviews/admin/recalculate-reputation/:userId - Recalculate user reputation
  fastify.post<{ Params: { userId: string }; Querystring: { role?: string } }>(
    '/admin/recalculate-reputation/:userId',
    async (
      request: FastifyRequest<{ Params: { userId: string }; Querystring: { role?: string } }>,
      reply: FastifyReply
    ) => {
      const user = getUser(request);

      // Check admin role
      if (user.role !== 'ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }

      const { userId } = request.params;
      const { role = 'both' } = request.query;

      if (role === 'freelancer' || role === 'both') {
        await reputationService.recalculateStats(userId, 'FREELANCER');
      }
      if (role === 'client' || role === 'both') {
        await reputationService.recalculateStats(userId, 'CLIENT');
      }

      return reply.send({
        success: true,
        message: `Reputation recalculated for ${role === 'both' ? 'both roles' : role}`,
      });
    }
  );
}
