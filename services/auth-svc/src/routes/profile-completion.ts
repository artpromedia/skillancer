/**
 * @module @skillancer/auth-svc/routes/profile-completion
 * Profile completion scoring routes
 */

import { authMiddleware } from '../middleware/auth.js';
import { profileRateLimitHook } from '../middleware/rate-limit.js';
import { getProfileCompletionService } from '../services/profile-completion.service.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

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
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /profile-completion - Get profile completion score
 */
async function getProfileCompletionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const profileCompletionService = getProfileCompletionService();

  const result = await profileCompletionService.calculateCompletion(userId);

  void reply.send({
    success: true,
    completion: result,
  });
}

/**
 * POST /profile-completion/refresh - Refresh profile completion score
 */
async function refreshProfileCompletionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const profileCompletionService = getProfileCompletionService();

  // Invalidate cache first
  await profileCompletionService.invalidateCache(userId);

  // Recalculate
  const result = await profileCompletionService.calculateCompletion(userId);

  void reply.send({
    success: true,
    message: 'Profile completion score refreshed',
    completion: result,
  });
}

/**
 * GET /profile-completion/summary - Get profile completion summary
 */
async function getProfileCompletionSummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const profileCompletionService = getProfileCompletionService();

  const result = await profileCompletionService.calculateCompletion(userId);

  void reply.send({
    success: true,
    score: result.overallScore,
    percentage: result.overallPercentage,
    tier: result.tier,
    topSuggestions: result.suggestions.slice(0, 5),
  });
}

/**
 * GET /profile-completion/suggestions - Get profile completion suggestions
 */
async function getProfileCompletionSuggestionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const profileCompletionService = getProfileCompletionService();

  const result = await profileCompletionService.calculateCompletion(userId);

  void reply.send({
    success: true,
    suggestions: result.suggestions,
    currentTier: result.tier,
    currentPercentage: result.overallPercentage,
  });
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function profileCompletionRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', profileRateLimitHook);

  // Get full completion details
  fastify.get('/', getProfileCompletionHandler);

  // Refresh completion score (invalidate cache)
  fastify.post('/refresh', refreshProfileCompletionHandler);

  // Get summary only
  fastify.get('/summary', getProfileCompletionSummaryHandler);

  // Get suggestions only
  fastify.get('/suggestions', getProfileCompletionSuggestionsHandler);
}

export default profileCompletionRoutes;
