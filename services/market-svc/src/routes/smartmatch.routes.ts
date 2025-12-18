/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/market-svc/routes/smartmatch
 * SmartMatch API Routes - Intelligent matching endpoints
 */

import { SmartMatchError } from '../errors/smartmatch.errors.js';
import { SmartMatchService, normalizeWeights } from '../services/smartmatch/index.js';

import type {
  MatchingCriteria,
  SmartMatchWeights,
  MatchingEventType,
  MatchingOutcome,
} from '../types/smartmatch.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifySchema } from 'fastify';

// =============================================================================
// TYPE DECLARATIONS FOR FASTIFY
// =============================================================================

interface FastifyWithPrisma extends FastifyInstance {
  prisma: PrismaClient;
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
};

// =============================================================================
// REQUEST/RESPONSE SCHEMAS
// =============================================================================

const matchingCriteriaSchema = {
  type: 'object',
  properties: {
    projectId: { type: 'string' },
    skills: { type: 'array', items: { type: 'string' } },
    experienceLevel: { type: 'string', enum: ['ENTRY', 'INTERMEDIATE', 'EXPERT'] },
    budgetMin: { type: 'number' },
    budgetMax: { type: 'number' },
    startDate: { type: 'string', format: 'date-time' },
    durationType: { type: 'string', enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'PROJECT'] },
    hoursPerWeek: { type: 'number' },
    timezone: { type: 'string' },
    requiredCompliance: { type: 'array', items: { type: 'string' } },
    preferredCompliance: { type: 'array', items: { type: 'string' } },
    requiredClearance: {
      type: 'string',
      enum: ['NONE', 'BASIC', 'STANDARD', 'ENHANCED', 'TOP_SECRET'],
    },
    minTrustScore: { type: 'number' },
    excludeUserIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['skills'],
};

const weightsSchema = {
  type: 'object',
  properties: {
    compliance: { type: 'number', minimum: 0, maximum: 1 },
    skills: { type: 'number', minimum: 0, maximum: 1 },
    experience: { type: 'number', minimum: 0, maximum: 1 },
    trust: { type: 'number', minimum: 0, maximum: 1 },
    rate: { type: 'number', minimum: 0, maximum: 1 },
    availability: { type: 'number', minimum: 0, maximum: 1 },
    successHistory: { type: 'number', minimum: 0, maximum: 1 },
    responsiveness: { type: 'number', minimum: 0, maximum: 1 },
  },
};

// =============================================================================
// ROUTE DEFINITIONS
// =============================================================================

export function smartMatchRoutes(fastify: FastifyInstance): void {
  const typedFastify = fastify as FastifyWithPrisma;
  const service = new SmartMatchService(typedFastify.prisma);

  // ===========================================================================
  // MATCHING ENDPOINTS
  // ===========================================================================

  /**
   * Calculate match score for a specific freelancer
   */
  fastify.post<{
    Body: {
      freelancerUserId: string;
      criteria: MatchingCriteria;
      weights?: Partial<SmartMatchWeights>;
    };
  }>(
    '/score',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Calculate match score for a freelancer',
        body: {
          type: 'object',
          properties: {
            freelancerUserId: { type: 'string' },
            criteria: matchingCriteriaSchema,
            weights: weightsSchema,
          },
          required: ['freelancerUserId', 'criteria'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const { freelancerUserId, criteria, weights } = request.body;

      const score = await service.calculateMatchScore(
        freelancerUserId,
        criteria,
        weights ? { weights: normalizeWeights(weights) } : undefined
      );

      return reply.send({
        success: true,
        data: score,
      });
    }
  );

  /**
   * Find matching freelancers for criteria
   */
  fastify.post<{
    Body: {
      criteria: MatchingCriteria;
      weights?: Partial<SmartMatchWeights>;
    };
    Querystring: {
      page?: number;
      limit?: number;
      sortBy?: 'score' | 'rate' | 'rating' | 'trust';
    };
  }>(
    '/find',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Find matching freelancers',
        body: {
          type: 'object',
          properties: {
            criteria: matchingCriteriaSchema,
            weights: weightsSchema,
          },
          required: ['criteria'],
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortBy: { type: 'string', enum: ['score', 'rate', 'rating', 'trust'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  matches: { type: 'array' },
                  total: { type: 'integer' },
                  searchId: { type: 'string' },
                },
              },
            },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = (request as AuthenticatedRequest).user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { criteria, weights } = request.body;
      const { page, limit, sortBy } = request.query;

      const result = await service.findMatches(userId, criteria, {
        ...(weights && { weights: normalizeWeights(weights) }),
        ...(page && { page }),
        ...(limit && { limit }),
        ...(sortBy && { sortBy: sortBy as 'score' | 'rate' | 'trust' }),
      });

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  // ===========================================================================
  // MATCHING EVENTS
  // ===========================================================================

  /**
   * Record a matching event (profile view, shortlist, etc.)
   */
  fastify.post<{
    Body: {
      eventType: MatchingEventType;
      freelancerUserId: string;
      projectId?: string;
      serviceId?: string;
      matchScore?: number;
    };
  }>(
    '/events',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Record a matching event',
        body: {
          type: 'object',
          properties: {
            eventType: {
              type: 'string',
              enum: [
                'SEARCH_RESULT',
                'PROFILE_VIEW',
                'SHORTLISTED',
                'PROPOSAL_SENT',
                'PROPOSAL_RECEIVED',
                'HIRED',
                'PROJECT_COMPLETED',
                'REPEAT_HIRE',
                'REJECTED',
              ],
            },
            freelancerUserId: { type: 'string' },
            projectId: { type: 'string' },
            serviceId: { type: 'string' },
            matchScore: { type: 'number' },
          },
          required: ['eventType', 'freelancerUserId'],
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = (request as AuthenticatedRequest).user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { eventType, freelancerUserId, projectId, serviceId, matchScore } = request.body;

      await service.recordMatchingEvent(eventType, userId, freelancerUserId, {
        ...(projectId && { projectId }),
        ...(serviceId && { serviceId }),
        ...(matchScore !== undefined && { matchScore }),
      });

      return reply.status(201).send({ success: true });
    }
  );

  /**
   * Update matching outcome (after hiring decision)
   */
  fastify.patch<{
    Params: { eventId: string };
    Body: {
      outcome: MatchingOutcome;
      wasHired?: boolean;
      projectSuccessful?: boolean;
      clientSatisfactionScore?: number;
    };
  }>(
    '/events/:eventId/outcome',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Update matching outcome',
        params: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
          },
          required: ['eventId'],
        },
        body: {
          type: 'object',
          properties: {
            outcome: {
              type: 'string',
              enum: [
                'HIRED',
                'NOT_HIRED',
                'PROJECT_SUCCESS',
                'PROJECT_CANCELLED',
                'CLIENT_SATISFIED',
                'CLIENT_UNSATISFIED',
                'REPEAT_CLIENT',
              ],
            },
            wasHired: { type: 'boolean' },
            projectSuccessful: { type: 'boolean' },
            clientSatisfactionScore: { type: 'number', minimum: 1, maximum: 5 },
          },
          required: ['outcome'],
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const { eventId } = request.params;
      const { outcome, wasHired, projectSuccessful, clientSatisfactionScore } = request.body;

      await service.updateMatchingOutcome(eventId, outcome, {
        ...(wasHired !== undefined && { wasHired }),
        ...(projectSuccessful !== undefined && { projectSuccessful }),
        ...(clientSatisfactionScore !== undefined && { clientSatisfactionScore }),
      });

      return reply.send({ success: true });
    }
  );

  // ===========================================================================
  // WORK PATTERN ENDPOINTS
  // ===========================================================================

  /**
   * Get work pattern for current user or specific user
   */
  fastify.get<{
    Params: { userId?: string };
  }>(
    '/work-pattern/:userId?',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Get work pattern',
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = request.params.userId || (request as AuthenticatedRequest).user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const workPattern = await service.getWorkPattern(userId);

      return reply.send({
        success: true,
        data: workPattern,
      });
    }
  );

  /**
   * Update work pattern for current user
   */
  fastify.put<{
    Body: {
      weeklyHoursAvailable?: number;
      preferredHoursPerWeek?: number;
      workingDays?: string[];
      workingHoursStart?: string;
      workingHoursEnd?: string;
      timezone?: string;
      preferredProjectDuration?: string[];
      preferredBudgetMin?: number;
      preferredBudgetMax?: number;
      preferredLocationType?: string[];
      maxConcurrentProjects?: number;
    };
  }>(
    '/work-pattern',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Update work pattern',
        body: {
          type: 'object',
          properties: {
            weeklyHoursAvailable: { type: 'number', minimum: 0, maximum: 168 },
            preferredHoursPerWeek: { type: 'number', minimum: 0, maximum: 168 },
            workingDays: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
              },
            },
            workingHoursStart: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' },
            workingHoursEnd: { type: 'string', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' },
            timezone: { type: 'string' },
            preferredProjectDuration: { type: 'array', items: { type: 'string' } },
            preferredBudgetMin: { type: 'number', minimum: 0 },
            preferredBudgetMax: { type: 'number', minimum: 0 },
            preferredLocationType: {
              type: 'array',
              items: { type: 'string', enum: ['REMOTE', 'ONSITE', 'HYBRID'] },
            },
            maxConcurrentProjects: { type: 'number', minimum: 1, maximum: 20 },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const userId = (request as AuthenticatedRequest).user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const workPattern = await service.updateWorkPattern(userId, request.body);

      return reply.send({
        success: true,
        data: workPattern,
      });
    }
  );

  /**
   * Track activity (heartbeat)
   */
  fastify.post(
    '/activity',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Track user activity',
      } as OpenAPISchema,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthenticatedRequest).user?.id;
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      await service.trackActivity(userId);

      return reply.send({ success: true });
    }
  );

  // ===========================================================================
  // SKILL ENDORSEMENT ENDPOINTS
  // ===========================================================================

  /**
   * Endorse a freelancer's skill
   */
  fastify.post<{
    Params: { userId: string };
    Body: {
      skill: string;
      endorsementType: 'WORKED_WITH' | 'VERIFIED_SKILL' | 'RECOMMENDATION';
      projectId?: string;
      comment?: string;
    };
  }>(
    '/endorsements/:userId',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Endorse a freelancer skill',
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        },
        body: {
          type: 'object',
          properties: {
            skill: { type: 'string' },
            endorsementType: {
              type: 'string',
              enum: ['WORKED_WITH', 'VERIFIED_SKILL', 'RECOMMENDATION'],
            },
            projectId: { type: 'string' },
            comment: { type: 'string', maxLength: 500 },
          },
          required: ['skill', 'endorsementType'],
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const endorserUserId = (request as AuthenticatedRequest).user?.id;
      if (!endorserUserId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      const { userId } = request.params;
      const { skill, endorsementType, projectId, comment } = request.body;

      const endorsement = await service.endorseSkill(endorserUserId, userId, skill, {
        endorsementType,
        ...(projectId && { projectId }),
        ...(comment && { comment }),
      });

      return reply.status(201).send({
        success: true,
        data: endorsement,
      });
    }
  );

  /**
   * Get endorsements for a user
   */
  fastify.get<{
    Params: { userId: string };
    Querystring: { skill?: string };
  }>(
    '/endorsements/:userId',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Get endorsements for a user',
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
          },
          required: ['userId'],
        },
        querystring: {
          type: 'object',
          properties: {
            skill: { type: 'string' },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { skill } = request.query;

      const endorsements = await service.getEndorsements(userId, skill);

      return reply.send({
        success: true,
        data: endorsements,
      });
    }
  );

  // ===========================================================================
  // RATE INTELLIGENCE ENDPOINTS
  // ===========================================================================

  /**
   * Get market rate for a skill
   */
  fastify.get<{
    Querystring: {
      skillCategory: string;
      primarySkill?: string;
      experienceLevel?: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
      region?: string;
    };
  }>(
    '/rates',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Get market rate for a skill',
        querystring: {
          type: 'object',
          properties: {
            skillCategory: { type: 'string' },
            primarySkill: { type: 'string' },
            experienceLevel: { type: 'string', enum: ['ENTRY', 'INTERMEDIATE', 'EXPERT'] },
            region: { type: 'string' },
          },
          required: ['skillCategory'],
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const { skillCategory, primarySkill, experienceLevel, region } = request.query;

      const rate = await service.getMarketRate(
        skillCategory,
        primarySkill,
        experienceLevel,
        region
      );

      return reply.send({
        success: true,
        data: rate,
      });
    }
  );

  /**
   * Get rate trends
   */
  fastify.get<{
    Params: { skillCategory: string };
    Querystring: { periods?: number };
  }>(
    '/rates/:skillCategory/trends',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Get rate trends for a skill category',
        params: {
          type: 'object',
          properties: {
            skillCategory: { type: 'string' },
          },
          required: ['skillCategory'],
        },
        querystring: {
          type: 'object',
          properties: {
            periods: { type: 'integer', minimum: 1, maximum: 24, default: 6 },
          },
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const { skillCategory } = request.params;
      const { periods } = request.query;

      const trends = await service.getRateTrends(skillCategory, periods);

      return reply.send({
        success: true,
        data: trends,
      });
    }
  );

  // ===========================================================================
  // SKILL RELATIONSHIP ENDPOINTS
  // ===========================================================================

  /**
   * Get related skills
   */
  fastify.get<{
    Params: { skill: string };
  }>(
    '/skills/:skill/related',
    {
      schema: {
        tags: ['smartmatch'],
        summary: 'Get related skills',
        params: {
          type: 'object',
          properties: {
            skill: { type: 'string' },
          },
          required: ['skill'],
        },
      } as OpenAPISchema,
    },
    async (request, reply) => {
      const { skill } = request.params;

      const relatedSkills = await service.getRelatedSkills(skill);

      return reply.send({
        success: true,
        data: relatedSkills,
      });
    }
  );

  // ===========================================================================
  // ERROR HANDLER
  // ===========================================================================

  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof SmartMatchError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    fastify.log.error(error);
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
}

export default smartMatchRoutes;
