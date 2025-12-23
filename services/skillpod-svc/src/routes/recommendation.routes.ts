/**
 * @module @skillancer/skillpod-svc/routes/recommendation
 * Learning recommendation and skill gap API routes
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import { z } from 'zod';

import { createMarketActivityQueue } from '../workers/market-activity.worker.js';

import type {
  LearningProfileRepository,
  SkillGapRepository,
  LearningRecommendationRepository,
  LearningPathRepository,
  MarketTrendRepository,
} from '../repositories/recommendation/index.js';
import type {
  RecommendationEngineService,
  LearningPathGeneratorService,
} from '../services/recommendation/index.js';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const UserIdParam = z.object({
  userId: z.string().uuid(),
});

const PathIdParam = z.object({
  pathId: z.string().uuid(),
});

const RecommendationIdParam = z.object({
  recommendationId: z.string().uuid(),
});

const PaginationQuery = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
});

const RecommendationsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(50).default(10).optional(),
  status: z.enum(['PENDING', 'VIEWED', 'STARTED', 'COMPLETED', 'DISMISSED', 'EXPIRED']).optional(),
  type: z
    .enum([
      'COURSE',
      'SKILL_PATH',
      'PRACTICE_PROJECT',
      'CERTIFICATION',
      'MENTORSHIP',
      'WORKSHOP',
      'ARTICLE',
      'VIDEO',
      'PODCAST',
      'BOOK',
    ])
    .optional(),
  contentType: z
    .enum([
      'VIDEO',
      'ARTICLE',
      'COURSE',
      'TUTORIAL',
      'PROJECT',
      'QUIZ',
      'ASSESSMENT',
      'WORKSHOP',
      'MENTORING',
      'CERTIFICATION',
    ])
    .optional(),
  minScore: z.coerce.number().min(0).max(1).optional(),
});

const SkillGapsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['IDENTIFIED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DEFERRED']).optional(),
  type: z.enum(['MISSING', 'OUTDATED', 'INSUFFICIENT_LEVEL', 'MARKET_DEMAND']).optional(),
});

const LearningPathsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(50).default(10).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED']).optional(),
  type: z
    .enum(['SKILL_BASED', 'CAREER_GOAL', 'MARKET_DRIVEN', 'CERTIFICATION', 'CUSTOM'])
    .optional(),
});

const MarketTrendsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  direction: z.enum(['RISING', 'STABLE', 'DECLINING']).optional(),
  period: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  minDemandScore: z.coerce.number().min(0).max(100).optional(),
});

const GenerateRecommendationsBody = z.object({
  forceRefresh: z.boolean().default(false).optional(),
  includeMLScores: z.boolean().default(true).optional(),
  maxRecommendations: z.number().min(1).max(50).default(10).optional(),
});

const GenerateLearningPathBody = z.object({
  type: z.enum(['SKILL_BASED', 'CAREER_GOAL', 'MARKET_DRIVEN', 'CERTIFICATION', 'CUSTOM']),
  targetSkillIds: z.array(z.string().uuid()).optional(),
  careerGoal: z.string().optional(),
  targetDate: z.string().datetime().optional(),
  options: z
    .object({
      includePracticeProjects: z.boolean().default(true).optional(),
      preferredContentTypes: z.array(z.string()).optional(),
      maxHoursPerWeek: z.number().min(1).max(80).optional(),
    })
    .optional(),
});

const UpdateRecommendationStatusBody = z.object({
  status: z.enum(['PENDING', 'VIEWED', 'STARTED', 'COMPLETED', 'DISMISSED', 'EXPIRED']),
  feedback: z
    .object({
      rating: z.number().min(1).max(5).optional(),
      comment: z.string().max(1000).optional(),
      useful: z.boolean().optional(),
    })
    .optional(),
});

const UpdateLearningPathBody = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED']).optional(),
  progress: z.number().min(0).max(100).optional(),
});

const UpdateLearningProfileBody = z.object({
  careerGoals: z.array(z.string()).optional(),
  preferredLearningStyle: z.enum(['visual', 'reading', 'hands-on', 'video', 'mixed']).optional(),
  weeklyLearningHours: z.number().min(1).max(80).optional(),
  preferredContentTypes: z.array(z.string()).optional(),
});

// =============================================================================
// ROUTE TYPES
// =============================================================================

interface UserParams {
  userId: string;
}

interface PathParams {
  pathId: string;
}

interface RecommendationParams {
  recommendationId: string;
}

// =============================================================================
// ROUTE DEPENDENCIES
// =============================================================================

export interface RecommendationRoutesDeps {
  learningProfileRepo: LearningProfileRepository;
  skillGapRepo: SkillGapRepository;
  recommendationRepo: LearningRecommendationRepository;
  learningPathRepo: LearningPathRepository;
  marketTrendRepo: MarketTrendRepository;
  recommendationEngine: RecommendationEngineService;
  learningPathGenerator: LearningPathGeneratorService;
  redis: Redis;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

export function recommendationRoutes(app: FastifyInstance, deps: RecommendationRoutesDeps): void {
  const {
    learningProfileRepo,
    skillGapRepo,
    recommendationRepo,
    learningPathRepo,
    marketTrendRepo,
    recommendationEngine,
    learningPathGenerator,
    redis,
  } = deps;

  // ===========================================================================
  // LEARNING PROFILE ENDPOINTS
  // ===========================================================================

  /**
   * GET /users/:userId/learning-profile
   * Get user's learning profile
   */
  app.get<{ Params: UserParams }>(
    '/users/:userId/learning-profile',
    {
      schema: {
        params: UserIdParam,
      },
    },
    async (request, reply) => {
      const { userId } = request.params;

      const profile = await learningProfileRepo.findByUserId(userId);

      if (!profile) {
        return reply.status(404).send({ error: 'Learning profile not found' });
      }

      return { profile };
    }
  );

  /**
   * PUT /users/:userId/learning-profile
   * Update user's learning profile
   */
  app.put<{
    Params: UserParams;
    Body: z.infer<typeof UpdateLearningProfileBody>;
  }>(
    '/users/:userId/learning-profile',
    {
      schema: {
        params: UserIdParam,
        body: UpdateLearningProfileBody,
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const updates = request.body;

      const profile = await learningProfileRepo.findByUserId(userId);

      if (!profile) {
        // Create new profile
        const newProfile = await learningProfileRepo.create({
          userId,
          careerGoals: updates.careerGoals ?? [],
          preferredLearningStyle: updates.preferredLearningStyle ?? 'mixed',
          weeklyLearningHours: updates.weeklyLearningHours ?? 10,
          preferredContentTypes: updates.preferredContentTypes ?? [],
        });

        return reply.status(201).send({ profile: newProfile });
      }

      const updatedProfile = await learningProfileRepo.update(profile.id, updates);
      return { profile: updatedProfile };
    }
  );

  // ===========================================================================
  // RECOMMENDATIONS ENDPOINTS
  // ===========================================================================

  /**
   * GET /users/:userId/recommendations
   * Get personalized learning recommendations for a user
   */
  app.get<{
    Params: UserParams;
    Querystring: z.infer<typeof RecommendationsQuerySchema>;
  }>(
    '/users/:userId/recommendations',
    {
      schema: {
        params: UserIdParam,
        querystring: RecommendationsQuerySchema,
      },
    },
    async (request) => {
      const { userId } = request.params;
      const { page = 1, limit = 10, status, type, contentType, minScore } = request.query;

      const result = await recommendationRepo.findByUserId(userId, {
        page,
        limit,
        status,
        type,
        contentType,
        minScore,
      });

      return {
        recommendations: result.items,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    }
  );

  /**
   * POST /users/:userId/recommendations/generate
   * Trigger generation of new recommendations
   */
  app.post<{
    Params: UserParams;
    Body: z.infer<typeof GenerateRecommendationsBody>;
  }>(
    '/users/:userId/recommendations/generate',
    {
      schema: {
        params: UserIdParam,
        body: GenerateRecommendationsBody,
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { forceRefresh, includeMLScores, maxRecommendations } = request.body;

      // Get tenant ID from user context (would normally come from auth)
      const tenantId = (request as unknown as { tenantId?: string }).tenantId ?? 'default';

      // Queue the recommendation generation
      const queue = createMarketActivityQueue(redis);

      const job = await queue.add(
        'generate-recommendations-request',
        {
          type: 'generate_recommendations' as const,
          data: {
            userId,
            tenantId,
            triggerSource: 'user_request' as const,
            options: {
              forceRefresh,
              includeMLScores,
              maxRecommendations,
            },
          },
        },
        {
          priority: 1, // High priority for user requests
        }
      );

      await queue.close();

      return reply.status(202).send({
        message: 'Recommendation generation queued',
        jobId: job.id,
      });
    }
  );

  /**
   * PATCH /users/:userId/recommendations/:recommendationId
   * Update recommendation status (viewed, started, completed, dismissed)
   */
  app.patch<{
    Params: UserParams & RecommendationParams;
    Body: z.infer<typeof UpdateRecommendationStatusBody>;
  }>(
    '/users/:userId/recommendations/:recommendationId',
    {
      schema: {
        params: UserIdParam.merge(RecommendationIdParam),
        body: UpdateRecommendationStatusBody,
      },
    },
    async (request, reply) => {
      const { userId, recommendationId } = request.params;
      const { status, feedback } = request.body;

      const recommendation = await recommendationRepo.findById(recommendationId);

      if (!recommendation) {
        return reply.status(404).send({ error: 'Recommendation not found' });
      }

      if (recommendation.userId !== userId) {
        return reply.status(403).send({ error: 'Not authorized to update this recommendation' });
      }

      const updated = await recommendationRepo.update(recommendationId, {
        status,
        ...(feedback && { userFeedback: feedback }),
        ...(status === 'VIEWED' && !recommendation.viewedAt && { viewedAt: new Date() }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      });

      return { recommendation: updated };
    }
  );

  // ===========================================================================
  // SKILL GAPS ENDPOINTS
  // ===========================================================================

  /**
   * GET /users/:userId/skill-gaps
   * Get user's identified skill gaps
   */
  app.get<{
    Params: UserParams;
    Querystring: z.infer<typeof SkillGapsQuerySchema>;
  }>(
    '/users/:userId/skill-gaps',
    {
      schema: {
        params: UserIdParam,
        querystring: SkillGapsQuerySchema,
      },
    },
    async (request) => {
      const { userId } = request.params;
      const { page = 1, limit = 20, priority, status, type } = request.query;

      const result = await skillGapRepo.findByUserId(userId, {
        page,
        limit,
        priority,
        status,
        type,
      });

      return {
        skillGaps: result.items,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    }
  );

  /**
   * GET /users/:userId/skill-gaps/summary
   * Get summary of user's skill gaps
   */
  app.get<{ Params: UserParams }>(
    '/users/:userId/skill-gaps/summary',
    {
      schema: {
        params: UserIdParam,
      },
    },
    async (request) => {
      const { userId } = request.params;

      const [critical, high, medium, low] = await Promise.all([
        skillGapRepo.countByPriority(userId, 'CRITICAL'),
        skillGapRepo.countByPriority(userId, 'HIGH'),
        skillGapRepo.countByPriority(userId, 'MEDIUM'),
        skillGapRepo.countByPriority(userId, 'LOW'),
      ]);

      const topGaps = await skillGapRepo.findByUserId(userId, {
        page: 1,
        limit: 5,
        priority: 'CRITICAL',
        status: 'IDENTIFIED',
      });

      return {
        summary: {
          total: critical + high + medium + low,
          byPriority: { critical, high, medium, low },
          topGaps: topGaps.items,
        },
      };
    }
  );

  // ===========================================================================
  // LEARNING PATHS ENDPOINTS
  // ===========================================================================

  /**
   * GET /users/:userId/learning-paths
   * Get user's learning paths
   */
  app.get<{
    Params: UserParams;
    Querystring: z.infer<typeof LearningPathsQuerySchema>;
  }>(
    '/users/:userId/learning-paths',
    {
      schema: {
        params: UserIdParam,
        querystring: LearningPathsQuerySchema,
      },
    },
    async (request) => {
      const { userId } = request.params;
      const { page = 1, limit = 10, status, type } = request.query;

      const result = await learningPathRepo.findByUserId(userId, {
        page,
        limit,
        status,
        type,
      });

      return {
        learningPaths: result.items,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    }
  );

  /**
   * GET /users/:userId/learning-paths/:pathId
   * Get specific learning path details
   */
  app.get<{ Params: UserParams & PathParams }>(
    '/users/:userId/learning-paths/:pathId',
    {
      schema: {
        params: UserIdParam.merge(PathIdParam),
      },
    },
    async (request, reply) => {
      const { userId, pathId } = request.params;

      const path = await learningPathRepo.findById(pathId);

      if (!path) {
        return reply.status(404).send({ error: 'Learning path not found' });
      }

      if (path.userId !== userId) {
        return reply.status(403).send({ error: 'Not authorized to view this learning path' });
      }

      return { learningPath: path };
    }
  );

  /**
   * POST /users/:userId/learning-paths
   * Generate a new learning path
   */
  app.post<{
    Params: UserParams;
    Body: z.infer<typeof GenerateLearningPathBody>;
  }>(
    '/users/:userId/learning-paths',
    {
      schema: {
        params: UserIdParam,
        body: GenerateLearningPathBody,
      },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { type, targetSkillIds, careerGoal, targetDate, options } = request.body;

      // Get tenant ID from user context
      const tenantId = (request as unknown as { tenantId?: string }).tenantId ?? 'default';

      const path = await learningPathGenerator.generatePath({
        userId,
        tenantId,
        type,
        targetSkillIds,
        careerGoal,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        options,
      });

      return reply.status(201).send({ learningPath: path });
    }
  );

  /**
   * PATCH /users/:userId/learning-paths/:pathId
   * Update learning path status or progress
   */
  app.patch<{
    Params: UserParams & PathParams;
    Body: z.infer<typeof UpdateLearningPathBody>;
  }>(
    '/users/:userId/learning-paths/:pathId',
    {
      schema: {
        params: UserIdParam.merge(PathIdParam),
        body: UpdateLearningPathBody,
      },
    },
    async (request, reply) => {
      const { userId, pathId } = request.params;
      const updates = request.body;

      const path = await learningPathRepo.findById(pathId);

      if (!path) {
        return reply.status(404).send({ error: 'Learning path not found' });
      }

      if (path.userId !== userId) {
        return reply.status(403).send({ error: 'Not authorized to update this learning path' });
      }

      const updated = await learningPathRepo.update(pathId, {
        ...(updates.status && { status: updates.status }),
        ...(updates.progress !== undefined && { progress: updates.progress }),
        ...(updates.status === 'COMPLETED' && { completedAt: new Date() }),
      });

      return { learningPath: updated };
    }
  );

  /**
   * DELETE /users/:userId/learning-paths/:pathId
   * Delete (abandon) a learning path
   */
  app.delete<{ Params: UserParams & PathParams }>(
    '/users/:userId/learning-paths/:pathId',
    {
      schema: {
        params: UserIdParam.merge(PathIdParam),
      },
    },
    async (request, reply) => {
      const { userId, pathId } = request.params;

      const path = await learningPathRepo.findById(pathId);

      if (!path) {
        return reply.status(404).send({ error: 'Learning path not found' });
      }

      if (path.userId !== userId) {
        return reply.status(403).send({ error: 'Not authorized to delete this learning path' });
      }

      // Soft delete by marking as abandoned
      await learningPathRepo.update(pathId, { status: 'ABANDONED' });

      return reply.status(204).send();
    }
  );

  // ===========================================================================
  // MARKET TRENDS ENDPOINTS
  // ===========================================================================

  /**
   * GET /market-trends
   * Get current market trends for skills
   */
  app.get<{
    Querystring: z.infer<typeof MarketTrendsQuerySchema>;
  }>(
    '/market-trends',
    {
      schema: {
        querystring: MarketTrendsQuerySchema,
      },
    },
    async (request) => {
      const { page = 1, limit = 20, direction, period, minDemandScore } = request.query;

      const result = await marketTrendRepo.findAll({
        page,
        limit,
        direction,
        period,
        minDemandScore,
      });

      return {
        trends: result.items,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      };
    }
  );

  /**
   * GET /market-trends/top
   * Get top trending skills
   */
  app.get<{
    Querystring: z.infer<typeof PaginationQuery>;
  }>(
    '/market-trends/top',
    {
      schema: {
        querystring: PaginationQuery,
      },
    },
    async (request) => {
      const { limit = 10 } = request.query;

      const trends = await marketTrendRepo.findTopTrending(limit);

      return { trends };
    }
  );

  /**
   * GET /market-trends/skills/:skillId
   * Get trend data for a specific skill
   */
  app.get<{
    Params: { skillId: string };
    Querystring: { period?: string };
  }>(
    '/market-trends/skills/:skillId',
    {
      schema: {
        params: z.object({ skillId: z.string().uuid() }),
        querystring: z.object({
          period: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { skillId } = request.params;
      const { period } = request.query;

      const trend = await marketTrendRepo.findBySkillId(skillId, period);

      if (!trend) {
        return reply.status(404).send({ error: 'No trend data found for this skill' });
      }

      return { trend };
    }
  );
}
