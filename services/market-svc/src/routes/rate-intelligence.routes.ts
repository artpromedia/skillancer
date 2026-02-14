/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/market-svc/routes/rate-intelligence
 * Rate Intelligence API Routes - Market rate analysis and recommendations
 */

import {
  RateIntelligenceError,
  RateIntelligenceService,
} from '../services/rate-intelligence.service.js';

import type { ExperienceLevel, PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifySchema } from 'fastify';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPE DECLARATIONS
// =============================================================================

interface FastifyWithDeps extends FastifyInstance {
  prisma: PrismaClient;
  redis: Redis;
  log: Logger;
  authenticate?: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
  };
}

// OpenAPI-compatible schema type that includes tags
type OpenAPISchema = FastifySchema & {
  tags?: string[];
  summary?: string;
  description?: string;
};

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

const marketRateQuerySchema = {
  type: 'object',
  properties: {
    skill: { type: 'string' },
    experienceLevel: { type: 'string', enum: ['ENTRY', 'INTERMEDIATE', 'EXPERT'] },
    region: { type: 'string', enum: ['US', 'EU', 'ASIA', 'OCEANIA', 'GLOBAL'] },
    complianceRequired: { type: 'string', description: 'Comma-separated compliance requirements' },
  },
  required: ['skill'],
};

const analyzeRateQuerySchema = {
  type: 'object',
  properties: {
    primarySkill: { type: 'string' },
  },
  required: ['primarySkill'],
};

const budgetRecommendationBodySchema = {
  type: 'object',
  properties: {
    skills: { type: 'array', items: { type: 'string' }, minItems: 1 },
    projectType: { type: 'string', enum: ['HOURLY', 'FIXED'] },
    experienceLevel: { type: 'string', enum: ['ENTRY', 'INTERMEDIATE', 'EXPERT'] },
    estimatedHours: { type: 'number', minimum: 1 },
    complianceRequired: { type: 'array', items: { type: 'string' } },
  },
  required: ['skills', 'projectType', 'experienceLevel'],
};

const compareBidBodySchema = {
  type: 'object',
  properties: {
    projectId: { type: 'string', format: 'uuid' },
    bidId: { type: 'string', format: 'uuid' },
  },
  required: ['projectId', 'bidId'],
};

const demandTrendsQuerySchema = {
  type: 'object',
  properties: {
    skill: { type: 'string' },
    skillCategory: { type: 'string' },
    period: { type: 'string', enum: ['30d', '90d', '1y'] },
  },
};

const rateHistoryQuerySchema = {
  type: 'object',
  properties: {
    skill: { type: 'string' },
    experienceLevel: { type: 'string', enum: ['ENTRY', 'INTERMEDIATE', 'EXPERT'] },
    region: { type: 'string' },
    period: { type: 'string', enum: ['6m', '1y', '2y'] },
  },
  required: ['skill'],
};

const recommendationRespondBodySchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['ACCEPT', 'REJECT'] },
    newRate: { type: 'number', minimum: 1 },
    reason: { type: 'string' },
  },
  required: ['action'],
};

const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
    message: { type: 'string' },
  },
};

const marketRateResponseSchema = {
  type: 'object',
  properties: {
    skill: { type: 'string' },
    experienceLevel: { type: 'string' },
    region: { type: 'string' },
    sampleSize: { type: 'number' },
    hourlyRate: {
      type: 'object',
      properties: {
        min: { type: 'number' },
        max: { type: 'number' },
        avg: { type: 'number' },
        median: { type: 'number' },
        percentile10: { type: 'number' },
        percentile25: { type: 'number' },
        percentile75: { type: 'number' },
        percentile90: { type: 'number' },
      },
    },
    fixedProjectRate: {
      type: 'object',
      nullable: true,
    },
    acceptanceRates: {
      type: 'object',
      properties: {
        belowMarket: { type: 'number' },
        atMarket: { type: 'number' },
        aboveMarket: { type: 'number' },
      },
    },
    trend: {
      type: 'object',
      properties: {
        changePercent30d: { type: 'number', nullable: true },
        changePercent90d: { type: 'number', nullable: true },
        direction: { type: 'string', enum: ['UP', 'DOWN', 'STABLE'] },
      },
    },
    compliancePremium: {
      type: 'object',
      nullable: true,
    },
    demandLevel: { type: 'string' },
    lastUpdated: { type: 'string', format: 'date-time' },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function handleRateError(error: unknown, reply: FastifyReply): FastifyReply {
  if (error instanceof RateIntelligenceError) {
    return reply.status(400).send({
      error: error.name,
      code: error.code,
      message: error.message,
    });
  }

  if (error instanceof Error) {
    return reply.status(500).send({
      error: 'InternalError',
      code: 'INTERNAL_ERROR',
      message: error.message,
    });
  }

  return reply.status(500).send({
    error: 'InternalError',
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  });
}

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

export function rateIntelligenceRoutes(fastify: FastifyInstance): void {
  const app = fastify as FastifyWithDeps;

  // Create service instance
  const rateIntelligenceService = new RateIntelligenceService(app.prisma, app.redis, app.log);

  // ==========================================================================
  // GET /rates/market - Get market rate for a skill
  // ==========================================================================
  app.get<{
    Querystring: {
      skill: string;
      experienceLevel?: ExperienceLevel;
      region?: string;
      complianceRequired?: string;
    };
  }>(
    '/rates/market',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Get market rate for a skill',
        description:
          'Returns market rate statistics for a specific skill, experience level, and region',
        querystring: marketRateQuerySchema,
        response: {
          200: marketRateResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      try {
        const { skill, experienceLevel, region, complianceRequired } = request.query;

        const result = await rateIntelligenceService.getMarketRate({
          skill,
          ...(experienceLevel !== undefined && { experienceLevel }),
          ...(region !== undefined && { region }),
          ...(complianceRequired !== undefined && {
            complianceRequired: complianceRequired.split(',').map((s) => s.trim()),
          }),
        });

        if (!result) {
          return await reply.status(404).send({
            error: 'NotFound',
            code: 'NO_MARKET_DATA',
            message: 'No market data available for the specified criteria',
          });
        }

        return await reply.send(result);
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );

  // ==========================================================================
  // GET /rates/analyze - Analyze freelancer's rate position
  // ==========================================================================
  app.get<{
    Querystring: { primarySkill: string };
  }>(
    '/rates/analyze',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Analyze freelancer rate position',
        description:
          "Returns analysis of the authenticated freelancer's rate position in the market",
        querystring: analyzeRateQuerySchema,
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      } as OpenAPISchema,
      ...(app.authenticate ? { preHandler: [app.authenticate as never] } : {}),
    },
    async (request, reply) => {
      try {
        const userId = (request as AuthenticatedRequest).user?.id;
        if (!userId) {
          return await reply.status(401).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        const { primarySkill } = request.query;

        const result = await rateIntelligenceService.analyzeFreelancerRate(userId, primarySkill);
        return await reply.send(result);
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );

  // ==========================================================================
  // POST /rates/budget-recommendation - Get budget recommendation for clients
  // ==========================================================================
  app.post<{
    Body: {
      skills: string[];
      projectType: 'HOURLY' | 'FIXED';
      experienceLevel: ExperienceLevel;
      estimatedHours?: number;
      complianceRequired?: string[];
    };
  }>(
    '/rates/budget-recommendation',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Get budget recommendation',
        description:
          'Returns budget recommendations for a project based on skills and requirements',
        body: budgetRecommendationBodySchema,
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      } as OpenAPISchema,
      ...(app.authenticate ? { preHandler: [app.authenticate as never] } : {}),
    },
    async (request, reply) => {
      try {
        const result = await rateIntelligenceService.getBudgetRecommendation(request.body);
        return await reply.send(result);
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );

  // ==========================================================================
  // POST /rates/compare-bid - Compare a bid against market rates
  // ==========================================================================
  app.post<{
    Body: {
      projectId: string;
      bidId: string;
    };
  }>(
    '/rates/compare-bid',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Compare bid to market rates',
        description: 'Compares a specific bid against market rates for the project skills',
        body: compareBidBodySchema,
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      } as OpenAPISchema,
      ...(app.authenticate ? { preHandler: [app.authenticate as never] } : {}),
    },
    async (request, reply) => {
      try {
        const { projectId, bidId } = request.body;

        const result = await rateIntelligenceService.compareBidToMarket(projectId, bidId);
        return await reply.send(result);
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );

  // ==========================================================================
  // GET /rates/demand-trends - Get skill demand trends
  // ==========================================================================
  app.get<{
    Querystring: {
      skill?: string;
      skillCategory?: string;
      period?: '30d' | '90d' | '1y';
    };
  }>(
    '/rates/demand-trends',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Get skill demand trends',
        description: 'Returns demand trends for skills including hot and declining skills',
        querystring: demandTrendsQuerySchema,
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      } as OpenAPISchema,
      ...(app.authenticate ? { preHandler: [app.authenticate as never] } : {}),
    },
    async (request, reply) => {
      try {
        const result = await rateIntelligenceService.getDemandTrends(request.query);
        return await reply.send(result);
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );

  // ==========================================================================
  // GET /rates/history - Get rate history for a skill
  // ==========================================================================
  app.get<{
    Querystring: {
      skill: string;
      experienceLevel?: ExperienceLevel;
      region?: string;
      period?: '6m' | '1y' | '2y';
    };
  }>(
    '/rates/history',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Get rate history',
        description: 'Returns historical rate data for a skill over a specified period',
        querystring: rateHistoryQuerySchema,
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      } as OpenAPISchema,
      ...(app.authenticate ? { preHandler: [app.authenticate as never] } : {}),
    },
    async (request, reply) => {
      try {
        const result = await rateIntelligenceService.getRateHistoryBySkill(
          request.query as {
            skill: string;
            experienceLevel?: ExperienceLevel;
            region?: string;
            period?: '6m' | '1y' | '2y';
          }
        );
        return await reply.send(result);
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );

  // ==========================================================================
  // GET /rates/recommendations - Get user's rate recommendations
  // ==========================================================================
  app.get(
    '/rates/recommendations',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Get rate recommendations',
        description: 'Returns pending rate recommendations for the authenticated freelancer',
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      } as OpenAPISchema,
      ...(app.authenticate ? { preHandler: [app.authenticate as never] } : {}),
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return await reply.status(401).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        const recommendations = await rateIntelligenceService.getPendingRecommendations(userId);
        return await reply.send({ recommendations });
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );

  // ==========================================================================
  // POST /rates/recommendations/:id/respond - Respond to a recommendation
  // ==========================================================================
  app.post<{
    Params: { id: string };
    Body: {
      action: 'ACCEPT' | 'REJECT';
      newRate?: number;
      reason?: string;
    };
  }>(
    '/rates/recommendations/:id/respond',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Respond to rate recommendation',
        description: 'Accept or reject a rate recommendation',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
          required: ['id'],
        },
        body: recommendationRespondBodySchema,
        response: {
          200: { type: 'object' },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      } as OpenAPISchema,
      ...(app.authenticate ? { preHandler: [app.authenticate as never] } : {}),
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return await reply.status(401).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        const { id } = request.params as { id: string };
        const { action, newRate, reason } = request.body as {
          action: 'ACCEPT' | 'REJECT';
          newRate?: number;
          reason?: string;
        };

        const updated = await rateIntelligenceService.respondToRecommendation(
          id,
          userId,
          action,
          newRate,
          reason
        );

        return await reply.send({
          success: true,
          recommendation: updated,
        });
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );

  // ==========================================================================
  // GET /rates/my-history - Get user's rate change history
  // ==========================================================================
  app.get(
    '/rates/my-history',
    {
      schema: {
        tags: ['Rate Intelligence'],
        summary: 'Get personal rate history',
        description: "Returns the authenticated freelancer's rate change history",
        response: {
          200: { type: 'object' },
          401: errorResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      } as OpenAPISchema,
      ...(app.authenticate ? { preHandler: [app.authenticate as never] } : {}),
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        const userId = request.user?.id;
        if (!userId) {
          return await reply.status(401).send({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
        }

        const history = await rateIntelligenceService.getUserRateHistory(userId, { limit: 20 });
        return await reply.send({ history });
      } catch (error) {
        return handleRateError(error, reply);
      }
    }
  );
}
