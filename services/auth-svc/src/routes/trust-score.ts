/**
 * @module @skillancer/auth-svc/routes/trust-score
 * Trust Score Routes
 *
 * Endpoints for:
 * - Getting trust scores
 * - Getting score explanations
 * - Checking thresholds
 * - Admin threshold management
 */

import {
  prisma,
  type TrustTier,
  type ThresholdContextType,
  type VerificationLevel,
} from '@skillancer/database';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  getTrustScoreService,
  initializeTrustScoreService,
} from '../services/trust-score.service.js';
import {
  getTrustThresholdService,
  initializeTrustThresholdService,
} from '../services/trust-threshold.service.js';

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

// =============================================================================
// HELPERS
// =============================================================================

function getUserId(request: FastifyRequest): string {
  if (!request.user?.id) {
    throw new Error('User not authenticated');
  }
  return request.user.id;
}

// =============================================================================
// SCHEMAS
// =============================================================================

const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

const checkThresholdQuerySchema = z.object({
  contextType: z.enum(['JOB', 'TENANT', 'POD_TEMPLATE', 'GLOBAL']),
  contextId: z.string().optional(),
});

const checkMultipleThresholdsBodySchema = z.object({
  contexts: z
    .array(
      z.object({
        contextType: z.enum(['JOB', 'TENANT', 'POD_TEMPLATE', 'GLOBAL']),
        contextId: z.string().optional(),
      })
    )
    .min(1)
    .max(10),
});

const setThresholdBodySchema = z.object({
  contextType: z.enum(['JOB', 'TENANT', 'POD_TEMPLATE', 'GLOBAL']),
  minimumScore: z.number().min(0).max(100),
  contextId: z.string().optional(),
  minimumTier: z.enum(['EMERGING', 'ESTABLISHED', 'TRUSTED', 'HIGHLY_TRUSTED', 'ELITE']).optional(),
  requireVerification: z.boolean().optional(),
  minimumVerificationLevel: z.enum(['NONE', 'BASIC', 'STANDARD', 'ENHANCED', 'PREMIUM']).optional(),
});

const triggerRecalculationBodySchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(100),
  trigger: z.string().max(100).default('admin.manual'),
});

// =============================================================================
// ROUTES FACTORY
// =============================================================================

export function createTrustScoreRoutes(redis: Redis): FastifyPluginAsync {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (fastify) => {
    // Initialize services
    initializeTrustScoreService(prisma, redis);
    initializeTrustThresholdService(prisma, redis);

    const trustScoreService = getTrustScoreService();
    const thresholdService = getTrustThresholdService();

    // =========================================================================
    // PUBLIC/USER ENDPOINTS
    // =========================================================================

    /**
     * GET /trust-score/me
     * Get the current user's trust score
     */
    fastify.get(
      '/me',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const userId = getUserId(request);
        const response = await trustScoreService.getTrustScore(userId, {
          includeFactors: true,
        });

        return reply.send({
          success: true,
          data: {
            overallScore: response.score.overallScore,
            tier: response.score.tier,
            trend: response.score.trend,
            scoreChangeAmount: response.score.scoreChangeAmount,
            components: response.score.components,
            calculatedAt: response.score.calculatedAt,
            cached: response.cached,
          },
        });
      }
    );

    /**
     * GET /trust-score/me/explanation
     * Get detailed explanation of the current user's trust score
     */
    fastify.get(
      '/me/explanation',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const userId = getUserId(request);
        const explanation = await trustScoreService.getTrustScoreExplanation(userId);

        return reply.send({
          success: true,
          data: explanation,
        });
      }
    );

    /**
     * GET /trust-score/me/history
     * Get the current user's trust score history
     */
    fastify.get(
      '/me/history',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const userId = getUserId(request);
        const history = await trustScoreService.getTrustScoreHistory(userId, 30);

        return reply.send({
          success: true,
          data: history,
        });
      }
    );

    /**
     * GET /trust-score/me/badges
     * Get the current user's earned trust badges
     */
    fastify.get(
      '/me/badges',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const userId = getUserId(request);
        const badges = await trustScoreService.getEarnedBadges(userId);

        return reply.send({
          success: true,
          data: badges,
        });
      }
    );

    /**
     * GET /trust-score/me/threshold-check
     * Check if the current user meets a specific threshold
     */
    fastify.get(
      '/me/threshold-check',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const userId = getUserId(request);
        const query = checkThresholdQuerySchema.parse(request.query);

        const result = await thresholdService.checkThreshold(
          userId,
          query.contextType,
          query.contextId
        );

        return reply.send({
          success: true,
          data: result,
        });
      }
    );

    /**
     * POST /trust-score/me/threshold-check-multiple
     * Check multiple thresholds at once for the current user
     */
    fastify.post(
      '/me/threshold-check-multiple',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const userId = getUserId(request);
        const body = checkMultipleThresholdsBodySchema.parse(request.body);

        const contexts = body.contexts.map((c) => {
          const ctx: { contextType: ThresholdContextType; contextId?: string } = {
            contextType: c.contextType as ThresholdContextType,
          };
          if (c.contextId !== undefined) {
            ctx.contextId = c.contextId;
          }
          return ctx;
        });
        const results = await thresholdService.checkMultipleThresholds(userId, contexts);

        // Convert Map to object for JSON serialization
        const resultsObject: Record<string, unknown> = {};
        results.forEach((value, key) => {
          resultsObject[key] = value;
        });

        return reply.send({
          success: true,
          data: resultsObject,
        });
      }
    );

    /**
     * POST /trust-score/me/recalculate
     * Request recalculation of the current user's trust score
     */
    fastify.post(
      '/me/recalculate',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const userId = getUserId(request);
        const score = await trustScoreService.recalculateTrustScore(userId, 'user.requested', {
          includeFactors: true,
        });

        return reply.send({
          success: true,
          data: {
            overallScore: score.overallScore,
            tier: score.tier,
            trend: score.trend,
            scoreChangeAmount: score.scoreChangeAmount,
            calculatedAt: score.calculatedAt,
          },
        });
      }
    );

    // =========================================================================
    // USER LOOKUP ENDPOINTS (for viewing other users' public scores)
    // =========================================================================

    /**
     * GET /trust-score/user/:userId
     * Get a user's public trust score (limited info)
     */
    fastify.get(
      '/user/:userId',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const params = userIdParamsSchema.parse(request.params);
        const response = await trustScoreService.getTrustScore(params.userId);

        // Return limited public information
        return reply.send({
          success: true,
          data: {
            userId: params.userId,
            overallScore: response.score.overallScore,
            tier: response.score.tier,
            trend: response.score.trend,
          },
        });
      }
    );

    /**
     * GET /trust-score/user/:userId/badges
     * Get a user's public trust badges
     */
    fastify.get(
      '/user/:userId/badges',
      {
        preHandler: [authMiddleware],
      },
      async (request, reply) => {
        const params = userIdParamsSchema.parse(request.params);
        const badges = await trustScoreService.getEarnedBadges(params.userId);

        return reply.send({
          success: true,
          data: badges,
        });
      }
    );

    // =========================================================================
    // ADMIN ENDPOINTS
    // =========================================================================

    /**
     * GET /trust-score/admin/user/:userId
     * Get full trust score details for any user (admin only)
     */
    fastify.get(
      '/admin/user/:userId',
      {
        preHandler: [authMiddleware, requireRole(['ADMIN', 'SUPER_ADMIN'])],
      },
      async (request, reply) => {
        const params = userIdParamsSchema.parse(request.params);
        const response = await trustScoreService.getTrustScore(params.userId, {
          includeFactors: true,
        });

        return reply.send({
          success: true,
          data: response,
        });
      }
    );

    /**
     * GET /trust-score/admin/user/:userId/history
     * Get full trust score history for any user (admin only)
     */
    fastify.get(
      '/admin/user/:userId/history',
      {
        preHandler: [authMiddleware, requireRole(['ADMIN', 'SUPER_ADMIN'])],
      },
      async (request, reply) => {
        const params = userIdParamsSchema.parse(request.params);
        const history = await trustScoreService.getTrustScoreHistory(params.userId, 100);

        return reply.send({
          success: true,
          data: history,
        });
      }
    );

    /**
     * POST /trust-score/admin/recalculate
     * Trigger recalculation for multiple users (admin only)
     */
    fastify.post(
      '/admin/recalculate',
      {
        preHandler: [authMiddleware, requireRole(['ADMIN', 'SUPER_ADMIN'])],
      },
      async (request, reply) => {
        const body = triggerRecalculationBodySchema.parse(request.body);
        const results: Array<{ userId: string; success: boolean; score?: number; error?: string }> =
          [];

        for (const userId of body.userIds) {
          try {
            const score = await trustScoreService.recalculateTrustScore(userId, body.trigger);
            results.push({
              userId,
              success: true,
              score: score.overallScore,
            });
          } catch (error) {
            results.push({
              userId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        const successCount = results.filter((r) => r.success).length;

        return reply.send({
          success: true,
          data: {
            total: body.userIds.length,
            succeeded: successCount,
            failed: body.userIds.length - successCount,
            results,
          },
        });
      }
    );

    /**
     * GET /trust-score/admin/thresholds
     * Get all threshold configurations (admin only)
     */
    fastify.get(
      '/admin/thresholds',
      {
        preHandler: [authMiddleware, requireRole(['ADMIN', 'SUPER_ADMIN'])],
      },
      async (_request, reply) => {
        const thresholds = await thresholdService.getAllThresholds();

        return reply.send({
          success: true,
          data: thresholds,
        });
      }
    );

    /**
     * PUT /trust-score/admin/thresholds
     * Set or update a threshold configuration (admin only)
     */
    fastify.put(
      '/admin/thresholds',
      {
        preHandler: [authMiddleware, requireRole(['ADMIN', 'SUPER_ADMIN'])],
      },
      async (request, reply) => {
        const body = setThresholdBodySchema.parse(request.body);
        const userId = getUserId(request);

        const options: {
          contextId?: string;
          minimumTier?: TrustTier;
          requireVerification?: boolean;
          minimumVerificationLevel?: VerificationLevel;
        } = {};

        if (body.contextId !== undefined) options.contextId = body.contextId;
        if (body.minimumTier !== undefined) options.minimumTier = body.minimumTier as TrustTier;
        if (body.requireVerification !== undefined)
          options.requireVerification = body.requireVerification;
        if (body.minimumVerificationLevel !== undefined) {
          options.minimumVerificationLevel = body.minimumVerificationLevel as VerificationLevel;
        }

        await thresholdService.setThreshold(body.contextType, body.minimumScore, userId, options);

        return reply.send({
          success: true,
          message: 'Threshold configuration updated',
        });
      }
    );

    /**
     * DELETE /trust-score/admin/thresholds
     * Delete a threshold configuration (admin only)
     */
    fastify.delete(
      '/admin/thresholds',
      {
        preHandler: [authMiddleware, requireRole(['ADMIN', 'SUPER_ADMIN'])],
      },
      async (request, reply) => {
        const query = checkThresholdQuerySchema.parse(request.query);

        await thresholdService.deleteThreshold(query.contextType, query.contextId);

        return reply.send({
          success: true,
          message: 'Threshold configuration deleted',
        });
      }
    );

    /**
     * POST /trust-score/admin/invalidate-cache/:userId
     * Invalidate trust score cache for a user (admin only)
     */
    fastify.post(
      '/admin/invalidate-cache/:userId',
      {
        preHandler: [authMiddleware, requireRole(['ADMIN', 'SUPER_ADMIN'])],
      },
      async (request, reply) => {
        const params = userIdParamsSchema.parse(request.params);

        await trustScoreService.invalidateCache(params.userId);

        return reply.send({
          success: true,
          message: 'Trust score cache invalidated',
        });
      }
    );
  };
}
