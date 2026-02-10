/**
 * @module @skillancer/auth-svc/routes/education
 * Education management routes
 */

import { authMiddleware } from '../middleware/auth.js';
import { profileRateLimitHook } from '../middleware/rate-limit.js';
import {
  createEducationSchema,
  updateEducationSchema,
  educationListQuerySchema,
  educationIdParamSchema,
} from '../schemas/education.js';
import { getEducationService } from '../services/education.service.js';

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
 * POST /education - Create education entry
 */
async function createEducationHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const data = createEducationSchema.parse(request.body);
  const educationService = getEducationService();

  const entry = await educationService.create(userId, data);

  void reply.status(201).send({
    success: true,
    message: 'Education entry created successfully',
    entry,
  });
}

/**
 * GET /education - Get user's education history
 */
async function getEducationHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const query = educationListQuerySchema.parse(request.query);
  const educationService = getEducationService();

  const result = await educationService.getUserEducation(userId, query);

  void reply.send({
    success: true,
    ...result,
  });
}

/**
 * GET /education/:entryId - Get single education entry
 */
async function getEducationEntryHandler(
  request: FastifyRequest<{ Params: EntryIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { entryId } = educationIdParamSchema.parse(request.params);
  const educationService = getEducationService();

  const entry = await educationService.getById(entryId, userId);

  void reply.send({
    success: true,
    entry,
  });
}

/**
 * PUT /education/:entryId - Update education entry
 */
async function updateEducationHandler(
  request: FastifyRequest<{ Params: EntryIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { entryId } = educationIdParamSchema.parse(request.params);
  const data = updateEducationSchema.parse(request.body);
  const educationService = getEducationService();

  const entry = await educationService.update(entryId, userId, data);

  void reply.send({
    success: true,
    message: 'Education entry updated successfully',
    entry,
  });
}

/**
 * DELETE /education/:entryId - Delete education entry
 */
async function deleteEducationHandler(
  request: FastifyRequest<{ Params: EntryIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { entryId } = educationIdParamSchema.parse(request.params);
  const educationService = getEducationService();

  await educationService.delete(entryId, userId);

  void reply.send({
    success: true,
    message: 'Education entry deleted successfully',
  });
}

/**
 * GET /education/public/:username - Get public education for a user
 */
async function getPublicEducationHandler(
  request: FastifyRequest<{ Params: UsernameParams }>,
  reply: FastifyReply
): Promise<void> {
  const { username } = request.params;
  const query = educationListQuerySchema.parse(request.query);
  const educationService = getEducationService();

  const result = await educationService.getPublicEducation(username, query);

  void reply.send({
    success: true,
    ...result,
  });
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function educationRoutes(fastify: FastifyInstance): Promise<void> {
  // Authenticated routes
  await fastify.register(async (authenticatedRoutes) => {
    authenticatedRoutes.addHook('preHandler', authMiddleware);
    authenticatedRoutes.addHook('preHandler', profileRateLimitHook);

    // CRUD operations
    authenticatedRoutes.post('/', createEducationHandler);
    authenticatedRoutes.get('/', getEducationHandler);
    authenticatedRoutes.get('/:entryId', getEducationEntryHandler);
    authenticatedRoutes.put('/:entryId', updateEducationHandler);
    authenticatedRoutes.delete('/:entryId', deleteEducationHandler);
  });

  // Public routes
  fastify.get('/public/:username', getPublicEducationHandler);
}

export default educationRoutes;
