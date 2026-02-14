/**
 * @module @skillancer/copilot-svc/routes/copilot
 * AI Copilot routes with proper input validation and authentication
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CopilotService } from '../services/copilot.service';
import { PrismaClient } from '@prisma/client';
import { requireAuth, optionalAuth } from '../plugins/auth.js';
import type { AuthenticatedUser } from '../plugins/auth.js';
import {
  GenerateProposalDraftSchema,
  UpdateProposalDraftSchema,
  GetProposalDraftsQuerySchema,
  SuggestRateSchema,
  AssistMessageSchema,
  OptimizeProfileSchema,
  GetMarketInsightsSchema,
  GetHistoryQuerySchema,
} from '../schemas/copilot.schemas';

const prisma = new PrismaClient();
const copilotService = new CopilotService(prisma);

// Reusable error response schema for Fastify serialization
const ErrorResponseSchema = {
  type: 'object' as const,
  properties: {
    error: { type: 'string' as const },
    message: { type: 'string' as const },
  },
};

// =============================================================================
// TYPES
// =============================================================================

// Helper to get authenticated user from request (guaranteed after requireAuth)
function getAuthenticatedUser(request: FastifyRequest): AuthenticatedUser {
  const user = (request as any).user;
  if (!user?.userId) {
    // This should never happen if requireAuth preHandler ran
    throw new Error('User not authenticated');
  }
  return user;
}

// =============================================================================
// PARAM SCHEMAS
// =============================================================================

const DraftIdParamsSchema = z.object({
  draftId: z.string().uuid(),
});

// =============================================================================
// ROUTES
// =============================================================================

export async function copilotRoutes(fastify: FastifyInstance) {
  // Get rate limit hooks from the registered plugin
  const { aiGeneration, chatAssist, analysis, profileOptimize, rateSuggest } =
    fastify.copilotRateLimit;

  // ===========================================================================
  // PROPOSAL DRAFT - CREATE
  // ===========================================================================

  /**
   * POST /proposals/draft
   * Generate a new proposal draft using AI
   * Rate limit: 10 req/min per user (aiGeneration)
   */
  fastify.post(
    '/proposals/draft',
    {
      preHandler: [requireAuth, aiGeneration],
      schema: {
        description: 'Generate a new proposal draft using AI',
        tags: ['Proposals'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(GenerateProposalDraftSchema),
        response: {
          201: {
            description: 'Proposal draft generated successfully',
            type: 'object',
            properties: {
              draftId: { type: 'string' },
              content: { type: 'string' },
              coverLetter: { type: 'string' },
              keyPoints: { type: 'array', items: { type: 'string' } },
              suggestedRate: { type: 'number' },
              rateJustification: { type: 'string' },
              estimatedWinRate: { type: 'number' },
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof GenerateProposalDraftSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = getAuthenticatedUser(request);
        const input = GenerateProposalDraftSchema.parse(request.body);

        const result = await copilotService.generateProposalDraft({
          userId: user.userId,
          ...input,
        } as any);

        return reply.status(201).send(result);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        request.log.error(error, 'Error generating proposal draft');
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ===========================================================================
  // PROPOSAL DRAFT - GET
  // ===========================================================================

  /**
   * GET /proposals/draft/:draftId
   * Get a specific proposal draft
   */
  fastify.get(
    '/proposals/draft/:draftId',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Get a specific proposal draft',
        tags: ['Proposals'],
        security: [{ bearerAuth: [] }],
        params: zodToJsonSchema(DraftIdParamsSchema),
        response: {
          200: {
            description: 'Proposal draft found',
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          404: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{ Params: z.infer<typeof DraftIdParamsSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const params = DraftIdParamsSchema.parse(request.params);
        const draft = await copilotService.getProposalDraft(params.draftId);

        if (!draft) {
          return reply.status(404).send({ error: 'Draft not found' });
        }

        return reply.send(draft);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid draft ID format' });
        }
        request.log.error(error, 'Error fetching proposal draft');
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // ===========================================================================
  // PROPOSAL DRAFT - UPDATE
  // ===========================================================================

  /**
   * PATCH /proposals/draft/:draftId
   * Update a proposal draft
   */
  fastify.patch(
    '/proposals/draft/:draftId',
    {
      preHandler: [requireAuth],
      schema: {
        description: 'Update a proposal draft',
        tags: ['Proposals'],
        security: [{ bearerAuth: [] }],
        params: zodToJsonSchema(DraftIdParamsSchema),
        body: zodToJsonSchema(UpdateProposalDraftSchema),
        response: {
          200: {
            description: 'Draft updated successfully',
            type: 'object',
          },
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof DraftIdParamsSchema>;
        Body: z.infer<typeof UpdateProposalDraftSchema>;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const params = DraftIdParamsSchema.parse(request.params);
        const body = UpdateProposalDraftSchema.parse(request.body);

        const draft = await copilotService.updateProposalDraft(params.draftId, body.content);

        return reply.send(draft);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        request.log.error(error, 'Error updating proposal draft');
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ===========================================================================
  // PROPOSAL DRAFTS - LIST
  // ===========================================================================

  /**
   * GET /proposals/drafts
   * Get user's proposal drafts
   */
  fastify.get(
    '/proposals/drafts',
    {
      preHandler: [requireAuth],
      schema: {
        description: "Get user's proposal drafts",
        tags: ['Proposals'],
        security: [{ bearerAuth: [] }],
        querystring: zodToJsonSchema(GetProposalDraftsQuerySchema),
        response: {
          200: {
            description: 'List of proposal drafts',
            type: 'array',
          },
          401: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof GetProposalDraftsQuerySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = getAuthenticatedUser(request);
        const query = GetProposalDraftsQuerySchema.parse(request.query);

        const drafts = await copilotService.getUserProposalDrafts(user.userId, query.status);

        return reply.send(drafts);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid query parameters' });
        }
        request.log.error(error, 'Error listing proposal drafts');
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  // ===========================================================================
  // RATE SUGGESTION
  // ===========================================================================

  /**
   * POST /rates/suggest
   * Get rate suggestions based on skills and experience
   * Rate limit: 15 req/min per user (rateSuggest)
   */
  fastify.post(
    '/rates/suggest',
    {
      preHandler: [requireAuth, rateSuggest],
      schema: {
        description: 'Get rate suggestions based on skills and experience',
        tags: ['Rates'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(SuggestRateSchema),
        response: {
          200: {
            description: 'Rate suggestion generated',
            type: 'object',
            properties: {
              suggestedHourlyRate: { type: 'object' },
              suggestedProjectRate: { type: 'object' },
              marketPosition: { type: 'string' },
              competitorRange: { type: 'object' },
              factors: { type: 'array' },
              recommendations: { type: 'array' },
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof SuggestRateSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = getAuthenticatedUser(request);
        const input = SuggestRateSchema.parse(request.body);

        const result = await copilotService.suggestRate({
          userId: user.userId,
          ...input,
        } as any);

        return reply.send(result);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        request.log.error(error, 'Error generating rate suggestion');
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ===========================================================================
  // MESSAGE ASSIST
  // ===========================================================================

  /**
   * POST /messages/assist
   * Get AI assistance for composing messages
   * Rate limit: 20 req/min per user (chatAssist)
   */
  fastify.post(
    '/messages/assist',
    {
      preHandler: [requireAuth, chatAssist],
      schema: {
        description: 'Get AI assistance for composing messages',
        tags: ['Messages'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(AssistMessageSchema),
        response: {
          200: {
            description: 'Message assistance generated',
            type: 'object',
            properties: {
              suggestedMessage: { type: 'string' },
              alternativeVersions: { type: 'array' },
              toneAnalysis: { type: 'object' },
              keyPointsCovered: { type: 'array' },
              missingPoints: { type: 'array' },
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof AssistMessageSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = getAuthenticatedUser(request);
        const input = AssistMessageSchema.parse(request.body);

        const result = await copilotService.assistMessage({
          userId: user.userId,
          ...input,
        } as any);

        return reply.send(result);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        request.log.error(error, 'Error generating message assistance');
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ===========================================================================
  // PROFILE OPTIMIZATION
  // ===========================================================================

  /**
   * POST /profile/optimize
   * Get AI suggestions for profile optimization
   * Rate limit: 10 req/min per user (profileOptimize)
   */
  fastify.post(
    '/profile/optimize',
    {
      preHandler: [requireAuth, profileOptimize],
      schema: {
        description: 'Get AI suggestions for profile optimization',
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        body: zodToJsonSchema(OptimizeProfileSchema),
        response: {
          200: {
            description: 'Profile optimization suggestions generated',
            type: 'object',
            properties: {
              optimizedHeadline: { type: 'string' },
              optimizedSummary: { type: 'string' },
              skillsToHighlight: { type: 'array' },
              skillsToAdd: { type: 'array' },
              keywordSuggestions: { type: 'array' },
              completenessScore: { type: 'number' },
              improvements: { type: 'array' },
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof OptimizeProfileSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = getAuthenticatedUser(request);
        const input = OptimizeProfileSchema.parse(request.body);

        const result = await copilotService.optimizeProfile({
          userId: user.userId,
          ...input,
        } as any);

        return reply.send(result);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        request.log.error(error, 'Error generating profile optimization');
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ===========================================================================
  // MARKET INSIGHTS
  // ===========================================================================

  /**
   * POST /market/insights
   * Get market insights for skills and industries
   * This endpoint works with or without authentication
   * Rate limit: 5 req/min per user/IP (analysis - most expensive)
   */
  fastify.post(
    '/market/insights',
    {
      preHandler: [optionalAuth, analysis],
      schema: {
        description: 'Get market insights for skills and industries',
        tags: ['Market'],
        body: zodToJsonSchema(GetMarketInsightsSchema),
        response: {
          200: {
            description: 'Market insights generated',
            type: 'object',
            properties: {
              demandLevel: { type: 'string' },
              demandTrend: { type: 'string' },
              averageRate: { type: 'object' },
              competitionLevel: { type: 'string' },
              topCompetitors: { type: 'number' },
              skillGaps: { type: 'array' },
              emergingSkills: { type: 'array' },
              marketTips: { type: 'array' },
            },
          },
          400: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{ Body: z.infer<typeof GetMarketInsightsSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const input = GetMarketInsightsSchema.parse(request.body);

        const result = await copilotService.getMarketInsights(input as any);

        return reply.send(result);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        request.log.error(error, 'Error generating market insights');
        return reply.status(400).send({ error: error.message });
      }
    }
  );

  // ===========================================================================
  // INTERACTION HISTORY
  // ===========================================================================

  /**
   * GET /history
   * Get user's copilot interaction history
   */
  fastify.get(
    '/history',
    {
      preHandler: [requireAuth],
      schema: {
        description: "Get user's copilot interaction history",
        tags: ['History'],
        security: [{ bearerAuth: [] }],
        querystring: zodToJsonSchema(GetHistoryQuerySchema),
        response: {
          200: {
            description: 'Interaction history',
            type: 'array',
          },
          401: ErrorResponseSchema,
        },
      } as any,
    },
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof GetHistoryQuerySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const user = getAuthenticatedUser(request);
        const query = GetHistoryQuerySchema.parse(request.query);

        const history = await copilotService.getInteractionHistory(
          user.userId,
          query.type as any,
          query.limit
        );

        return reply.send(history);
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Invalid query parameters' });
        }
        request.log.error(error, 'Error fetching interaction history');
        return reply.status(500).send({ error: error.message });
      }
    }
  );
}
