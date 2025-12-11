/**
 * @module @skillancer/auth-svc/routes/work-history
 * Work history management routes
 */

import { authMiddleware } from '../middleware/auth.js';
import { profileRateLimitHook } from '../middleware/rate-limit.js';
import {
  createWorkHistorySchema,
  updateWorkHistorySchema,
  workHistoryListQuerySchema,
  workHistoryIdParamSchema,
} from '../schemas/work-history.js';
import { getWorkHistoryService } from '../services/work-history.service.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface EntryIdParams {
  entryId: string;
}

interface UsernameParams {
  username: string;
}

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
 * POST /work-history - Create work history entry
 */
async function createWorkHistoryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const data = createWorkHistorySchema.parse(request.body);
  const workHistoryService = getWorkHistoryService();

  const entry = await workHistoryService.create(userId, data);

  void reply.status(201).send({
    success: true,
    message: 'Work history entry created successfully',
    entry,
  });
}

/**
 * GET /work-history - Get user's work history
 */
async function getWorkHistoryHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const query = workHistoryListQuerySchema.parse(request.query);
  const workHistoryService = getWorkHistoryService();

  const result = await workHistoryService.getUserWorkHistory(userId, query);

  void reply.send({
    success: true,
    ...result,
  });
}

/**
 * GET /work-history/with-duration - Get work history with calculated duration
 */
async function getWorkHistoryWithDurationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const workHistoryService = getWorkHistoryService();

  const entries = await workHistoryService.getWorkHistoryWithDuration(userId);
  const totalExperience = await workHistoryService.calculateTotalExperience(userId);

  void reply.send({
    success: true,
    data: entries,
    totalExperienceMonths: totalExperience,
    totalExperienceYears: Math.round((totalExperience / 12) * 10) / 10,
  });
}

/**
 * GET /work-history/:entryId - Get single work history entry
 */
async function getWorkHistoryEntryHandler(
  request: FastifyRequest<{ Params: EntryIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { entryId } = workHistoryIdParamSchema.parse(request.params);
  const workHistoryService = getWorkHistoryService();

  const entry = await workHistoryService.getById(entryId, userId);

  void reply.send({
    success: true,
    entry,
  });
}

/**
 * PUT /work-history/:entryId - Update work history entry
 */
async function updateWorkHistoryHandler(
  request: FastifyRequest<{ Params: EntryIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { entryId } = workHistoryIdParamSchema.parse(request.params);
  const data = updateWorkHistorySchema.parse(request.body);
  const workHistoryService = getWorkHistoryService();

  const entry = await workHistoryService.update(entryId, userId, data);

  void reply.send({
    success: true,
    message: 'Work history entry updated successfully',
    entry,
  });
}

/**
 * DELETE /work-history/:entryId - Delete work history entry
 */
async function deleteWorkHistoryHandler(
  request: FastifyRequest<{ Params: EntryIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { entryId } = workHistoryIdParamSchema.parse(request.params);
  const workHistoryService = getWorkHistoryService();

  await workHistoryService.delete(entryId, userId);

  void reply.send({
    success: true,
    message: 'Work history entry deleted successfully',
  });
}

/**
 * GET /work-history/public/:username - Get public work history for a user
 */
async function getPublicWorkHistoryHandler(
  request: FastifyRequest<{ Params: UsernameParams }>,
  reply: FastifyReply
): Promise<void> {
  const { username } = request.params;
  const query = workHistoryListQuerySchema.parse(request.query);
  const workHistoryService = getWorkHistoryService();

  const result = await workHistoryService.getPublicWorkHistory(username, query);

  void reply.send({
    success: true,
    ...result,
  });
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function workHistoryRoutes(fastify: FastifyInstance): Promise<void> {
  // Authenticated routes
  await fastify.register((authenticatedRoutes) => {
    authenticatedRoutes.addHook('preHandler', authMiddleware);
    authenticatedRoutes.addHook('preHandler', profileRateLimitHook);

    // CRUD operations
    authenticatedRoutes.post('/', createWorkHistoryHandler);
    authenticatedRoutes.get('/', getWorkHistoryHandler);
    authenticatedRoutes.get('/with-duration', getWorkHistoryWithDurationHandler);
    authenticatedRoutes.get('/:entryId', getWorkHistoryEntryHandler);
    authenticatedRoutes.put('/:entryId', updateWorkHistoryHandler);
    authenticatedRoutes.delete('/:entryId', deleteWorkHistoryHandler);
  });

  // Public routes
  fastify.get('/public/:username', getPublicWorkHistoryHandler);
}

export default workHistoryRoutes;
