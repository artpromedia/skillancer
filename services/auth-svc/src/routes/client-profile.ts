/**
 * @module @skillancer/auth-svc/routes/client-profile
 * Client profile management routes
 */

import { authMiddleware } from '../middleware/auth.js';
import { profileRateLimitHook } from '../middleware/rate-limit.js';
import {
  createClientProfileSchema,
  updateClientProfileSchema,
  clientSearchSchema,
} from '../schemas/client-profile.js';
import { getClientProfileService } from '../services/client-profile.service.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

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
// ROUTE PLUGIN
// =============================================================================

export async function clientProfileRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();
  const clientService = getClientProfileService();

  // ===========================================================================
  // AUTHENTICATED ROUTES
  // ===========================================================================

  /**
   * GET /client/profile - Get current user's client profile
   */
  fastify.get(
    '/profile',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const profile = await clientService.getProfile(userId);

      if (!profile) {
        return reply.send({
          hasProfile: false,
          profile: null,
        });
      }

      return reply.send({
        hasProfile: true,
        profile,
      });
    }
  );

  /**
   * POST /client/profile - Create client profile
   */
  fastify.post(
    '/profile',
    {
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const parsed = createClientProfileSchema.parse(request.body);

      // Convert undefined to defaults for Prisma compatibility
      const data = {
        companyName: parsed.companyName ?? null,
        companySize: parsed.companySize ?? null,
        companyWebsite: parsed.companyWebsite ?? null,
        companyLogoUrl: parsed.companyLogoUrl ?? null,
        industry: parsed.industry ?? null,
        companyBio: parsed.companyBio ?? null,
        typicalBudgetMin: parsed.typicalBudgetMin ?? null,
        typicalBudgetMax: parsed.typicalBudgetMax ?? null,
        preferredCurrency: parsed.preferredCurrency ?? 'USD',
        typicalProjectTypes: parsed.typicalProjectTypes ?? [],
        hiringFrequency: parsed.hiringFrequency ?? null,
        teamSize: parsed.teamSize ?? null,
        hasHrDepartment: parsed.hasHrDepartment ?? false,
      };

      const profile = await clientService.createProfile(userId, data);

      return reply.status(201).send({
        success: true,
        message: 'Client profile created successfully',
        profile: {
          id: profile.id,
          companyName: profile.companyName,
          createdAt: profile.createdAt.toISOString(),
        },
      });
    }
  );

  /**
   * PUT /client/profile - Update client profile
   */
  fastify.put(
    '/profile',
    {
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const parsed = updateClientProfileSchema.parse(request.body);

      // Only include fields that are explicitly provided (not undefined)
      const data: Record<string, unknown> = {};

      if (parsed.companyName !== undefined) data.companyName = parsed.companyName;
      if (parsed.companySize !== undefined) data.companySize = parsed.companySize;
      if (parsed.companyWebsite !== undefined) data.companyWebsite = parsed.companyWebsite;
      if (parsed.companyLogoUrl !== undefined) data.companyLogoUrl = parsed.companyLogoUrl;
      if (parsed.industry !== undefined) data.industry = parsed.industry;
      if (parsed.companyBio !== undefined) data.companyBio = parsed.companyBio;
      if (parsed.typicalBudgetMin !== undefined) data.typicalBudgetMin = parsed.typicalBudgetMin;
      if (parsed.typicalBudgetMax !== undefined) data.typicalBudgetMax = parsed.typicalBudgetMax;
      if (parsed.preferredCurrency !== undefined) data.preferredCurrency = parsed.preferredCurrency;
      if (parsed.typicalProjectTypes !== undefined)
        data.typicalProjectTypes = parsed.typicalProjectTypes;
      if (parsed.hiringFrequency !== undefined) data.hiringFrequency = parsed.hiringFrequency;
      if (parsed.teamSize !== undefined) data.teamSize = parsed.teamSize;
      if (parsed.hasHrDepartment !== undefined) data.hasHrDepartment = parsed.hasHrDepartment;

      const profile = await clientService.updateProfile(userId, data);

      return reply.send({
        success: true,
        message: 'Client profile updated successfully',
        profile: {
          id: profile.id,
          companyName: profile.companyName,
          updatedAt: profile.updatedAt.toISOString(),
        },
      });
    }
  );

  // ===========================================================================
  // PUBLIC ROUTES
  // ===========================================================================

  /**
   * GET /client/search - Search clients
   */
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = clientSearchSchema.parse(request.query);

    // Build filters with only provided values
    const filters: Record<string, unknown> = {};

    if (parsed.companySize !== undefined) filters.companySize = parsed.companySize;
    if (parsed.industry !== undefined) filters.industry = parsed.industry;
    if (parsed.hiringFrequency !== undefined) filters.hiringFrequency = parsed.hiringFrequency;
    if (parsed.minBudget !== undefined) filters.minBudget = parsed.minBudget;
    if (parsed.maxBudget !== undefined) filters.maxBudget = parsed.maxBudget;
    if (parsed.country !== undefined) filters.country = parsed.country;
    if (parsed.isVerified !== undefined) filters.isVerified = parsed.isVerified;
    if (parsed.paymentVerified !== undefined) filters.paymentVerified = parsed.paymentVerified;
    if (parsed.query !== undefined) filters.query = parsed.query;
    if (parsed.page !== undefined) filters.page = parsed.page;
    if (parsed.limit !== undefined) filters.limit = parsed.limit;
    if (parsed.sortBy !== undefined) filters.sortBy = parsed.sortBy;

    const result = await clientService.search(filters);

    return reply.send(result);
  });

  /**
   * GET /client/:username - Get public client profile
   */
  fastify.get<{ Params: UsernameParams }>('/:username', async (request, reply: FastifyReply) => {
    const { username } = request.params;

    try {
      const profile = await clientService.getPublicProfile(username);

      // Increment view count asynchronously
      void clientService.incrementProfileViews(profile.username);

      return await reply.send({ profile });
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        return reply.status(404).send({
          error: 'Client profile not found',
          code: 'PROFILE_NOT_FOUND',
        });
      }
      throw error;
    }
  });
}

export default clientProfileRoutes;
