/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Admin Review Routes
 *
 * Admin/moderator endpoints for the review system
 */

import { z } from 'zod';

import { ReviewInvitationService } from '../services/review-invitation.service.js';
import { ReviewModerationService } from '../services/review-moderation.service.js';

import type { PrismaClient, ReportStatus } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const ModerateReviewSchema = z.object({
  action: z.enum(['approve', 'hide', 'delete']),
  reason: z.string().max(500).optional(),
});

const ResolveReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  resolution: z.string().max(500).optional(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface AdminReviewRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerAdminReviewRoutes(
  fastify: FastifyInstance,
  deps: AdminReviewRouteDeps
): void {
  const { prisma, redis, logger } = deps;

  // Initialize services
  const moderationService = new ReviewModerationService(prisma, redis, logger);
  const invitationService = new ReviewInvitationService(prisma, redis, logger);

  // Helper to get admin user
  const getAdmin = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    const user = request.user as { id: string; email: string; role: string };
    if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      throw new Error('Admin access required');
    }
    return user;
  };

  // GET /admin/reviews/queue - Get moderation queue
  fastify.get<{ Querystring: { page?: string; limit?: string } }>(
    '/queue',
    async (request, reply) => {
      getAdmin(request);
      const { page: pageStr, limit: limitStr } = request.query;
      const page = pageStr ? Number.parseInt(pageStr, 10) : 1;
      const limit = limitStr ? Number.parseInt(limitStr, 10) : 20;

      const queue = await moderationService.getModerationQueue({ page, limit });

      return reply.send({
        success: true,
        queue,
      });
    }
  );

  // GET /admin/reviews/:reviewId - Get review with reports
  fastify.get<{ Params: { reviewId: string } }>('/:reviewId', async (request, reply) => {
    getAdmin(request);
    const { reviewId } = request.params;

    const data = await moderationService.getReviewWithReports(reviewId);

    return reply.send({
      success: true,
      data,
    });
  });

  // POST /admin/reviews/:reviewId/moderate - Moderate a review
  fastify.post<{ Params: { reviewId: string } }>('/:reviewId/moderate', async (request, reply) => {
    const admin = getAdmin(request);
    const { reviewId } = request.params;
    const body = ModerateReviewSchema.parse(request.body);

    const review = await moderationService.moderateReview({
      reviewId,
      moderatorId: admin.id,
      action: body.action,
      reason: body.reason ?? 'No reason provided',
    });

    logger.info({
      msg: 'Review moderated',
      reviewId,
      action: body.action,
      moderatorId: admin.id,
    });

    return reply.send({
      success: true,
      review,
    });
  });

  // GET /admin/reviews/reports - Get pending reports
  fastify.get<{ Querystring: { page?: string; limit?: string } }>(
    '/reports',
    async (request, reply) => {
      getAdmin(request);
      const { page: pageStr, limit: limitStr } = request.query;
      const page = pageStr ? Number.parseInt(pageStr, 10) : 1;
      const limit = limitStr ? Number.parseInt(limitStr, 10) : 20;

      const result = await moderationService.getPendingReports({ page, limit });

      return reply.send({
        success: true,
        ...result,
      });
    }
  );

  // POST /admin/reviews/reports/:reportId/resolve - Resolve a report
  fastify.post<{ Params: { reportId: string } }>(
    '/reports/:reportId/resolve',
    async (request, reply) => {
      const admin = getAdmin(request);
      const { reportId } = request.params;
      const body = ResolveReportSchema.parse(request.body);

      const report = await moderationService.resolveReport({
        reportId,
        moderatorId: admin.id,
        status: body.status as ReportStatus,
        resolution: body.resolution ?? 'Resolved by moderator',
      });

      logger.info({
        msg: 'Report resolved',
        reportId,
        status: body.status,
        moderatorId: admin.id,
      });

      return reply.send({
        success: true,
        report,
      });
    }
  );

  // GET /admin/reviews/invitations - Get all invitations
  fastify.get<{ Querystring: { page?: string; limit?: string } }>(
    '/invitations',
    async (request, reply) => {
      getAdmin(request);
      const { page: pageStr, limit: limitStr } = request.query;
      const page = pageStr ? Number.parseInt(pageStr, 10) : 1;
      const limit = limitStr ? Number.parseInt(limitStr, 10) : 20;

      const result = await invitationService.getAllInvitations({ page, limit });

      return reply.send({
        success: true,
        ...result,
      });
    }
  );

  // GET /admin/reviews/stats - Get system statistics
  fastify.get('/stats', async (request, reply) => {
    getAdmin(request);

    const [stats, invitationStats] = await Promise.all([
      moderationService.getSystemStats(),
      invitationService.getStatistics(),
    ]);

    return reply.send({
      success: true,
      stats,
      invitationStats,
    });
  });
}
