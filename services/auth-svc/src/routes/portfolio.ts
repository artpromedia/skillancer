// @ts-nocheck
/**
 * @module @skillancer/auth-svc/routes/portfolio
 * Portfolio management routes
 */

import { authMiddleware } from '../middleware/auth.js';
import { profileRateLimitHook } from '../middleware/rate-limit.js';
import {
  createPortfolioItemSchema,
  updatePortfolioItemSchema,
  reorderPortfolioItemsSchema,
  setVideoUrlSchema,
  portfolioListQuerySchema,
  portfolioItemIdParamSchema,
} from '../schemas/portfolio.js';
import { getPortfolioService } from '../services/portfolio.service.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface ItemIdParams {
  itemId: string;
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
 * POST /portfolio - Create portfolio item
 */
async function createPortfolioItemHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const data = createPortfolioItemSchema.parse(request.body);
  const portfolioService = getPortfolioService();

  const item = await portfolioService.createItem(userId, data);

  void reply.status(201).send({
    success: true,
    message: 'Portfolio item created successfully',
    item,
  });
}

/**
 * GET /portfolio - Get user's portfolio items
 */
async function getPortfolioHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const query = portfolioListQuerySchema.parse(request.query);
  const portfolioService = getPortfolioService();

  const result = await portfolioService.getUserPortfolio(userId, query);

  void reply.send({
    success: true,
    ...result,
  });
}

/**
 * GET /portfolio/:itemId - Get single portfolio item
 */
async function getPortfolioItemHandler(
  request: FastifyRequest<{ Params: ItemIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { itemId } = portfolioItemIdParamSchema.parse(request.params);
  const portfolioService = getPortfolioService();

  const item = await portfolioService.getItem(itemId, userId);

  void reply.send({
    success: true,
    item,
  });
}

/**
 * PUT /portfolio/:itemId - Update portfolio item
 */
async function updatePortfolioItemHandler(
  request: FastifyRequest<{ Params: ItemIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { itemId } = portfolioItemIdParamSchema.parse(request.params);
  const data = updatePortfolioItemSchema.parse(request.body);
  const portfolioService = getPortfolioService();

  const item = await portfolioService.updateItem(itemId, userId, data);

  void reply.send({
    success: true,
    message: 'Portfolio item updated successfully',
    item,
  });
}

/**
 * DELETE /portfolio/:itemId - Delete portfolio item
 */
async function deletePortfolioItemHandler(
  request: FastifyRequest<{ Params: ItemIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { itemId } = portfolioItemIdParamSchema.parse(request.params);
  const portfolioService = getPortfolioService();

  await portfolioService.deleteItem(itemId, userId);

  void reply.send({
    success: true,
    message: 'Portfolio item deleted successfully',
  });
}

/**
 * POST /portfolio/reorder - Reorder portfolio items
 */
async function reorderPortfolioItemsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { itemIds } = reorderPortfolioItemsSchema.parse(request.body);
  const portfolioService = getPortfolioService();

  await portfolioService.reorderItems(userId, itemIds);

  void reply.send({
    success: true,
    message: 'Portfolio items reordered successfully',
  });
}

/**
 * POST /portfolio/:itemId/image - Upload image to portfolio item
 */
async function uploadPortfolioImageHandler(
  request: FastifyRequest<{ Params: ItemIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { itemId } = portfolioItemIdParamSchema.parse(request.params);
  const portfolioService = getPortfolioService();

  const file = await request.file();
  if (!file) {
    void reply.status(400).send({
      success: false,
      error: 'No file uploaded',
      code: 'NO_FILE',
    });
    return;
  }

  const setAsThumbnail = (request.query as { setAsThumbnail?: string }).setAsThumbnail === 'true';
  const item = await portfolioService.uploadImage(itemId, userId, file, setAsThumbnail);

  void reply.send({
    success: true,
    message: 'Image uploaded successfully',
    item,
  });
}

/**
 * DELETE /portfolio/:itemId/image - Remove image from portfolio item
 */
async function removePortfolioImageHandler(
  request: FastifyRequest<{ Params: ItemIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { itemId } = portfolioItemIdParamSchema.parse(request.params);
  const { imageUrl } = request.body as { imageUrl: string };
  const portfolioService = getPortfolioService();

  if (!imageUrl) {
    void reply.status(400).send({
      success: false,
      error: 'Image URL required',
      code: 'MISSING_IMAGE_URL',
    });
    return;
  }

  const item = await portfolioService.removeImage(itemId, userId, imageUrl);

  void reply.send({
    success: true,
    message: 'Image removed successfully',
    item,
  });
}

/**
 * PUT /portfolio/:itemId/video - Set video URL for portfolio item
 */
async function setVideoUrlHandler(
  request: FastifyRequest<{ Params: ItemIdParams }>,
  reply: FastifyReply
): Promise<void> {
  const userId = getUserId(request);
  const { itemId } = portfolioItemIdParamSchema.parse(request.params);
  const { videoUrl } = setVideoUrlSchema.parse(request.body);
  const portfolioService = getPortfolioService();

  const item = await portfolioService.setVideoUrl(itemId, userId, videoUrl ?? null);

  void reply.send({
    success: true,
    message: videoUrl ? 'Video URL set successfully' : 'Video URL removed successfully',
    item,
  });
}

/**
 * GET /portfolio/public/:username - Get public portfolio for a user
 */
async function getPublicPortfolioHandler(
  request: FastifyRequest<{ Params: UsernameParams }>,
  reply: FastifyReply
): Promise<void> {
  const { username } = request.params;
  const query = portfolioListQuerySchema.parse(request.query);
  const portfolioService = getPortfolioService();

  const result = await portfolioService.getPublicPortfolio(username, query);

  void reply.send({
    success: true,
    ...result,
  });
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function portfolioRoutes(fastify: FastifyInstance): Promise<void> {
  // Authenticated routes
  await fastify.register(async (authenticatedRoutes) => {
    authenticatedRoutes.addHook('preHandler', authMiddleware);
    authenticatedRoutes.addHook('preHandler', profileRateLimitHook);

    // CRUD operations
    authenticatedRoutes.post('/', createPortfolioItemHandler);
    authenticatedRoutes.get('/', getPortfolioHandler);
    authenticatedRoutes.get('/:itemId', getPortfolioItemHandler);
    authenticatedRoutes.put('/:itemId', updatePortfolioItemHandler);
    authenticatedRoutes.delete('/:itemId', deletePortfolioItemHandler);

    // Reordering
    authenticatedRoutes.post('/reorder', reorderPortfolioItemsHandler);

    // Image management
    authenticatedRoutes.post('/:itemId/image', uploadPortfolioImageHandler);
    authenticatedRoutes.delete('/:itemId/image', removePortfolioImageHandler);

    // Video management
    authenticatedRoutes.put('/:itemId/video', setVideoUrlHandler);
  });

  // Public routes
  fastify.get('/public/:username', getPublicPortfolioHandler);
}

export default portfolioRoutes;
