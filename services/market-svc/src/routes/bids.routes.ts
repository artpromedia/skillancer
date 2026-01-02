// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Bid Routes
 *
 * Public API endpoints for bid management
 */

import { z } from 'zod';

import { BiddingError, getStatusCode } from '../errors/bidding.errors.js';
import { signalBidSubmitted, signalBidOutcome } from '../hooks/learning-signals.hook.js';
import { BidService } from '../services/bid.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const ProposedMilestoneSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  amount: z.number().positive(),
  deliveryDays: z.number().positive(),
});

const AttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
});

const SubmitBidSchema = z.object({
  jobId: z.string().uuid(),
  coverLetter: z.string().min(50).max(5000),
  proposedRate: z.number().positive(),
  rateType: z.enum(['FIXED', 'HOURLY']),
  deliveryDays: z.number().positive().int().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  proposedMilestones: z.array(ProposedMilestoneSchema).optional(),
});

const UpdateBidSchema = z.object({
  coverLetter: z.string().min(50).max(5000).optional(),
  proposedRate: z.number().positive().optional(),
  rateType: z.enum(['FIXED', 'HOURLY']).optional(),
  deliveryDays: z.number().positive().int().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  proposedMilestones: z.array(ProposedMilestoneSchema).optional(),
});

const ShortlistBidSchema = z.object({
  notes: z.string().max(1000).optional(),
});

const RejectBidSchema = z.object({
  reason: z.string().max(500).optional(),
  notifyFreelancer: z.boolean().optional(),
});

const RequestInterviewSchema = z.object({
  message: z.string().max(1000).optional(),
  proposedTimes: z.array(z.string().datetime()).optional(),
});

const ScheduleInterviewSchema = z.object({
  scheduledAt: z
    .string()
    .datetime()
    .transform((s) => new Date(s)),
  meetingUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

const AcceptBidSchema = z.object({
  message: z.string().max(1000).optional(),
});

const BidListQuerySchema = z.object({
  status: z.string().optional(),
  sortBy: z.enum(['newest', 'quality_score', 'rate_low', 'rate_high', 'delivery_days']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

const CompareBidsSchema = z.object({
  bidIds: z.array(z.string().uuid()).min(2).max(10),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface BidRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerBidRoutes(fastify: FastifyInstance, deps: BidRouteDeps): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const bidService = new BidService(prisma, redis, logger);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof BiddingError) {
      return reply.status(getStatusCode(error.code)).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    throw error;
  };

  // POST /bids - Submit a new bid
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = SubmitBidSchema.parse(request.body);

      const bid = await bidService.submitBid(user.id, body);

      // Signal bid submitted for learning recommendations (fire and forget)
      const bidWithJob = bid as any;
      if (bidWithJob.job) {
        void signalBidSubmitted(
          { id: user.id, skills: [] }, // User skills would ideally be fetched
          bidWithJob.job,
          {
            proposedRate: body.proposedRate,
            coverLetter: body.coverLetter,
            attachments: body.attachments,
          }
        );
      }

      logger.info({
        msg: 'Bid submitted',
        bidId: bid.id,
        projectId: body.jobId,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        bid,
        message: 'Bid submitted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /bids/my - Get current user's bids (freelancer)
  fastify.get('/my', async (request, reply) => {
    try {
      const user = getUser(request);
      const { status, page, limit } = request.query as {
        status?: string;
        page?: string;
        limit?: string;
      };

      const result = await bidService.getFreelancerBids(user.id, {
        status: status as any,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /bids/project/:projectId - Get bids for a project (client)
  fastify.get<{ Params: { projectId: string } }>('/project/:projectId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { projectId } = request.params;
      const query = BidListQuerySchema.parse(request.query);

      const result = await bidService.getProjectBids(projectId, user.id, {
        status: query.status as any,
        sortBy: query.sortBy,
        page: query.page,
        limit: query.limit,
      });

      return await reply.send({
        success: true,
        ...result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /bids/:bidId - Get a specific bid
  fastify.get<{ Params: { bidId: string } }>('/:bidId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { bidId } = request.params;

      const bid = await bidService.getBid(bidId, user.id);

      return await reply.send({
        success: true,
        bid,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /bids/:bidId - Update a bid
  fastify.patch<{ Params: { bidId: string } }>('/:bidId', async (request, reply) => {
    try {
      const user = getUser(request);
      const { bidId } = request.params;
      const body = UpdateBidSchema.parse(request.body);

      const bid = await bidService.updateBid(bidId, user.id, body);

      logger.info({
        msg: 'Bid updated',
        bidId,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        bid,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /bids/:bidId/withdraw - Withdraw a bid
  fastify.post<{ Params: { bidId: string } }>('/:bidId/withdraw', async (request, reply) => {
    try {
      const user = getUser(request);
      const { bidId } = request.params;

      await bidService.withdrawBid(bidId, user.id);

      logger.info({
        msg: 'Bid withdrawn',
        bidId,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Bid withdrawn successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /bids/:bidId/shortlist - Shortlist a bid (client)
  fastify.post<{ Params: { bidId: string } }>('/:bidId/shortlist', async (request, reply) => {
    try {
      const user = getUser(request);
      const { bidId } = request.params;
      const body = ShortlistBidSchema.parse(request.body || {});

      await bidService.shortlistBid({ bidId, ...body }, user.id);

      logger.info({
        msg: 'Bid shortlisted',
        bidId,
        clientId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Bid shortlisted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /bids/:bidId/reject - Reject a bid (client)
  fastify.post<{ Params: { bidId: string } }>('/:bidId/reject', async (request, reply) => {
    try {
      const user = getUser(request);
      const { bidId } = request.params;
      const body = RejectBidSchema.parse(request.body || {});

      // Get bid details before rejecting for signaling
      const bidBefore = await bidService.getBid(bidId, user.id);

      await bidService.rejectBid({ bidId, ...body }, user.id);

      // Signal bid rejection for learning recommendations
      void signalBidOutcome(bidBefore.freelancerId, bidBefore.jobId, 'REJECTED', {
        rejectionReason: body.reason,
      });

      logger.info({
        msg: 'Bid rejected',
        bidId,
        clientId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Bid rejected',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /bids/:bidId/interview/request - Request interview (client)
  fastify.post<{ Params: { bidId: string } }>(
    '/:bidId/interview/request',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { bidId } = request.params;
        const body = RequestInterviewSchema.parse(request.body || {});

        await bidService.requestInterview({ bidId, ...body }, user.id);

        logger.info({
          msg: 'Interview requested',
          bidId,
          clientId: user.id,
        });

        return await reply.send({
          success: true,
          message: 'Interview request sent to freelancer',
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /bids/:bidId/interview/schedule - Schedule interview (client)
  fastify.post<{ Params: { bidId: string } }>(
    '/:bidId/interview/schedule',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { bidId } = request.params;
        const body = ScheduleInterviewSchema.parse(request.body);

        await bidService.scheduleInterview({ bidId, ...body }, user.id);

        logger.info({
          msg: 'Interview scheduled',
          bidId,
          clientId: user.id,
          scheduledAt: body.scheduledAt,
        });

        return await reply.send({
          success: true,
          message: 'Interview scheduled',
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // POST /bids/:bidId/accept - Accept a bid (client)
  fastify.post<{ Params: { bidId: string } }>('/:bidId/accept', async (request, reply) => {
    try {
      const user = getUser(request);
      const { bidId } = request.params;
      const body = AcceptBidSchema.parse(request.body || {});

      const bid = await bidService.acceptBid({ bidId, ...body }, user.id);

      // Signal bid acceptance for learning recommendations
      void signalBidOutcome(bid.freelancerId, bid.jobId, 'HIRED');

      logger.info({
        msg: 'Bid accepted',
        bidId,
        clientId: user.id,
        projectId: bid.jobId,
        freelancerId: bid.freelancerId,
      });

      return await reply.send({
        success: true,
        bid,
        message: 'Bid accepted - you can now create a contract with this freelancer',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /bids/compare - Compare multiple bids (client)
  fastify.post('/compare', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CompareBidsSchema.parse(request.body);

      const comparison = await bidService.compareBids(body.bidIds, user.id);

      return await reply.send({
        success: true,
        comparison,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /bids/project/:projectId/stats - Get bid statistics for a project
  fastify.get<{ Params: { projectId: string } }>(
    '/project/:projectId/stats',
    async (request, reply) => {
      try {
        const user = getUser(request);
        const { projectId } = request.params;

        const stats = await bidService.getProjectBidStats(projectId, user.id);

        return await reply.send({
          success: true,
          stats,
        });
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );
}

