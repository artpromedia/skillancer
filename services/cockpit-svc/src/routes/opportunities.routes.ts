/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Opportunity Routes
 *
 * API endpoints for sales pipeline and opportunity management
 */

import { z } from 'zod';

import { CrmError, getStatusCode } from '../errors/crm.errors.js';
import { OpportunityService } from '../services/opportunity.service.js';

import type { PrismaClient, OpportunityStage } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// ============================================================================
// Validation Schemas
// ============================================================================

const CreateOpportunitySchema = z.object({
  clientId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  source: z.enum([
    'MARKET_PROJECT',
    'MARKET_SERVICE',
    'REFERRAL',
    'COLD_OUTREACH',
    'INBOUND_INQUIRY',
    'REPEAT_CLIENT',
    'PARTNERSHIP',
    'OTHER',
  ]),
  sourceDetails: z.string().max(500).optional(),
  externalUrl: z.string().url().optional().nullable(),
  estimatedValue: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  expectedCloseDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  stage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  tags: z.array(z.string()).optional(),
  serviceType: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

const UpdateOpportunitySchema = CreateOpportunitySchema.partial().extend({
  probability: z.number().min(0).max(100).optional(),
});

const UpdateStageSchema = z.object({
  stage: z.enum(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']),
  notes: z.string().max(1000).optional(),
});

const SearchOpportunitiesSchema = z.object({
  clientId: z.string().uuid().optional(),
  source: z.array(z.string()).optional(),
  stage: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(),
  minValue: z.string().transform(Number).optional(),
  maxValue: z.string().transform(Number).optional(),
  expectedCloseBefore: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  expectedCloseAfter: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  sortBy: z.enum(['created', 'expectedClose', 'value', 'probability']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
});

const GetStatsSchema = z.object({
  startDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
  endDate: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
});

// ============================================================================
// Route Dependencies
// ============================================================================

interface OpportunityRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

// ============================================================================
// Route Registration
// ============================================================================

export function registerOpportunityRoutes(
  fastify: FastifyInstance,
  deps: OpportunityRouteDeps
): void {
  const { prisma, redis, logger } = deps;

  // Initialize service
  const opportunityService = new OpportunityService(prisma, redis, logger);

  // Helper to get authenticated user
  const getUser = (request: any) => {
    if (!request.user) {
      throw new Error('Authentication required');
    }
    return request.user as { id: string; email: string; role: string };
  };

  // Error handler
  const handleError = (error: unknown, reply: any) => {
    if (error instanceof CrmError) {
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

  // POST /opportunities - Create a new opportunity
  fastify.post('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const body = CreateOpportunitySchema.parse(request.body);

      const opportunity = await opportunityService.createOpportunity({
        freelancerUserId: user.id,
        clientId: body.clientId,
        title: body.title,
        description: body.description,
        source: body.source as any,
        sourceDetails: body.sourceDetails,
        externalUrl: body.externalUrl ?? undefined,
        estimatedValue: body.estimatedValue,
        currency: body.currency,
        expectedCloseDate: body.expectedCloseDate,
        stage: body.stage as any,
        priority: body.priority as any,
        tags: body.tags,
        serviceType: body.serviceType,
        notes: body.notes,
      });

      logger.info({
        msg: 'Opportunity created',
        opportunityId: opportunity.id,
        freelancerId: user.id,
      });

      return await reply.status(201).send({
        success: true,
        data: opportunity,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /opportunities - Search opportunities
  fastify.get('/', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = SearchOpportunitiesSchema.parse(request.query);

      const result = await opportunityService.searchOpportunities({
        freelancerUserId: user.id,
        clientId: query.clientId,
        source: query.source as any,
        stage: query.stage as any,
        status: query.status as any,
        priority: query.priority as any,
        minValue: query.minValue,
        maxValue: query.maxValue,
        expectedCloseBefore: query.expectedCloseBefore,
        expectedCloseAfter: query.expectedCloseAfter,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: query.page,
        limit: query.limit,
      });

      return await reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /opportunities/pipeline - Get pipeline view
  fastify.get('/pipeline', async (request, reply) => {
    try {
      const user = getUser(request);

      const pipeline = await opportunityService.getPipeline(user.id);

      return await reply.send({
        success: true,
        data: pipeline,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /opportunities/stats - Get opportunity statistics
  fastify.get('/stats', async (request, reply) => {
    try {
      const user = getUser(request);
      const query = GetStatsSchema.parse(request.query);

      const period =
        query.startDate && query.endDate
          ? { start: query.startDate, end: query.endDate }
          : undefined;

      const stats = await opportunityService.getOpportunityStats(user.id, period);

      return await reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /opportunities/:id - Get opportunity by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      const opportunity = await opportunityService.getOpportunity(id, user.id);

      return await reply.send({
        success: true,
        data: opportunity,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // PATCH /opportunities/:id - Update opportunity
  fastify.patch('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateOpportunitySchema.parse(request.body);

      const opportunity = await opportunityService.updateOpportunity(id, user.id, {
        clientId: body.clientId,
        title: body.title,
        description: body.description,
        source: body.source as any,
        sourceDetails: body.sourceDetails,
        externalUrl: body.externalUrl ?? undefined,
        estimatedValue: body.estimatedValue,
        currency: body.currency,
        expectedCloseDate: body.expectedCloseDate,
        stage: body.stage as any,
        priority: body.priority as any,
        tags: body.tags,
        serviceType: body.serviceType,
        notes: body.notes,
        probability: body.probability,
      });

      logger.info({
        msg: 'Opportunity updated',
        opportunityId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: opportunity,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // POST /opportunities/:id/stage - Update opportunity stage
  fastify.post('/:id/stage', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = UpdateStageSchema.parse(request.body);

      const opportunity = await opportunityService.updateStage(
        id,
        user.id,
        body.stage as OpportunityStage,
        body.notes
      );

      logger.info({
        msg: 'Opportunity stage updated',
        opportunityId: id,
        newStage: body.stage,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        data: opportunity,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // GET /opportunities/:id/activities - Get opportunity activities
  fastify.get('/:id/activities', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const { page, limit } = z
        .object({
          page: z.string().transform(Number).optional(),
          limit: z.string().transform(Number).optional(),
        })
        .parse(request.query);

      const activities = await opportunityService.getOpportunityActivities(id, user.id, {
        page,
        limit,
      });

      return await reply.send({
        success: true,
        data: activities,
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // DELETE /opportunities/:id - Delete opportunity
  fastify.delete('/:id', async (request, reply) => {
    try {
      const user = getUser(request);
      const { id } = request.params as { id: string };

      await opportunityService.deleteOpportunity(id, user.id);

      logger.info({
        msg: 'Opportunity deleted',
        opportunityId: id,
        freelancerId: user.id,
      });

      return await reply.send({
        success: true,
        message: 'Opportunity deleted successfully',
      });
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
