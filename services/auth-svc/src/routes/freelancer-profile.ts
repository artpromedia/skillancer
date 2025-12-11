/**
 * @module @skillancer/auth-svc/routes/freelancer-profile
 * Freelancer profile management routes
 */

import { authMiddleware } from '../middleware/auth.js';
import { profileRateLimitHook } from '../middleware/rate-limit.js';
import {
  createFreelancerProfileSchema,
  updateFreelancerProfileSchema,
  updateAvailabilitySchema,
  freelancerSearchSchema,
} from '../schemas/freelancer-profile.js';
import { getFreelancerProfileService } from '../services/freelancer-profile.service.js';

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

export async function freelancerProfileRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();
  const freelancerService = getFreelancerProfileService();

  // ===========================================================================
  // AUTHENTICATED ROUTES
  // ===========================================================================

  /**
   * GET /freelancer/profile - Get current user's freelancer profile
   */
  fastify.get(
    '/profile',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const profile = await freelancerService.getProfile(userId);

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
   * POST /freelancer/profile - Create freelancer profile
   */
  fastify.post(
    '/profile',
    {
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const parsed = createFreelancerProfileSchema.parse(request.body);

      // Convert undefined to defaults for Prisma compatibility
      const data = {
        headline: parsed.headline ?? null,
        specializations: parsed.specializations ?? [],
        availability: parsed.availability ?? ('AVAILABLE' as const),
        hoursPerWeek: parsed.hoursPerWeek ?? null,
        availableFrom: parsed.availableFrom ?? null,
        hourlyRateMin: parsed.hourlyRateMin ?? null,
        hourlyRateMax: parsed.hourlyRateMax ?? null,
        preferredCurrency: parsed.preferredCurrency ?? 'USD',
        preferredJobTypes: parsed.preferredJobTypes ?? [],
        preferredDurations: parsed.preferredDurations ?? [],
        preferredProjectMin: parsed.preferredProjectMin ?? null,
        preferredProjectMax: parsed.preferredProjectMax ?? null,
        remoteOnly: parsed.remoteOnly ?? false,
        willingToTravel: parsed.willingToTravel ?? false,
        travelRadius: parsed.travelRadius ?? null,
        industries: parsed.industries ?? [],
        allowDirectContact: parsed.allowDirectContact ?? true,
        responseTime: parsed.responseTime ?? null,
      };

      const profile = await freelancerService.createProfile(userId, data);

      return reply.status(201).send({
        success: true,
        message: 'Freelancer profile created successfully',
        profile: {
          id: profile.id,
          headline: profile.headline,
          createdAt: profile.createdAt.toISOString(),
        },
      });
    }
  );

  /**
   * PUT /freelancer/profile - Update freelancer profile
   */
  fastify.put(
    '/profile',
    {
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const parsed = updateFreelancerProfileSchema.parse(request.body);

      // Only include fields that are explicitly provided (not undefined)
      const data: Record<string, unknown> = {};

      if (parsed.headline !== undefined) data.headline = parsed.headline;
      if (parsed.specializations !== undefined) data.specializations = parsed.specializations;
      if (parsed.availability !== undefined) data.availability = parsed.availability;
      if (parsed.hoursPerWeek !== undefined) data.hoursPerWeek = parsed.hoursPerWeek;
      if (parsed.availableFrom !== undefined) data.availableFrom = parsed.availableFrom;
      if (parsed.hourlyRateMin !== undefined) data.hourlyRateMin = parsed.hourlyRateMin;
      if (parsed.hourlyRateMax !== undefined) data.hourlyRateMax = parsed.hourlyRateMax;
      if (parsed.preferredCurrency !== undefined) data.preferredCurrency = parsed.preferredCurrency;
      if (parsed.preferredJobTypes !== undefined) data.preferredJobTypes = parsed.preferredJobTypes;
      if (parsed.preferredDurations !== undefined)
        data.preferredDurations = parsed.preferredDurations;
      if (parsed.preferredProjectMin !== undefined)
        data.preferredProjectMin = parsed.preferredProjectMin;
      if (parsed.preferredProjectMax !== undefined)
        data.preferredProjectMax = parsed.preferredProjectMax;
      if (parsed.remoteOnly !== undefined) data.remoteOnly = parsed.remoteOnly;
      if (parsed.willingToTravel !== undefined) data.willingToTravel = parsed.willingToTravel;
      if (parsed.travelRadius !== undefined) data.travelRadius = parsed.travelRadius;
      if (parsed.industries !== undefined) data.industries = parsed.industries;
      if (parsed.allowDirectContact !== undefined)
        data.allowDirectContact = parsed.allowDirectContact;
      if (parsed.responseTime !== undefined) data.responseTime = parsed.responseTime;

      const profile = await freelancerService.updateProfile(userId, data);

      return reply.send({
        success: true,
        message: 'Freelancer profile updated successfully',
        profile: {
          id: profile.id,
          headline: profile.headline,
          updatedAt: profile.updatedAt.toISOString(),
        },
      });
    }
  );

  /**
   * PUT /freelancer/profile/availability - Update availability
   */
  fastify.put(
    '/profile/availability',
    {
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = getUserId(request);
      const parsed = updateAvailabilitySchema.parse(request.body);

      const profile = await freelancerService.updateAvailability(
        userId,
        parsed.availability,
        parsed.availableFrom ?? null
      );

      return reply.send({
        success: true,
        message: 'Availability updated successfully',
        availability: profile.availability,
        availableFrom: profile.availableFrom?.toISOString() ?? null,
      });
    }
  );

  // ===========================================================================
  // PUBLIC ROUTES
  // ===========================================================================

  /**
   * GET /freelancer/search - Search freelancers
   */
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = freelancerSearchSchema.parse(request.query);

    // Build filters with only provided values
    const filters: Record<string, unknown> = {};

    if (parsed.skills !== undefined) filters.skills = parsed.skills;
    if (parsed.specializations !== undefined) filters.specializations = parsed.specializations;
    if (parsed.industries !== undefined) filters.industries = parsed.industries;
    if (parsed.availability !== undefined) filters.availability = parsed.availability;
    if (parsed.minRate !== undefined) filters.minRate = parsed.minRate;
    if (parsed.maxRate !== undefined) filters.maxRate = parsed.maxRate;
    if (parsed.country !== undefined) filters.country = parsed.country;
    if (parsed.remoteOnly !== undefined) filters.remoteOnly = parsed.remoteOnly;
    if (parsed.minRating !== undefined) filters.minRating = parsed.minRating;
    if (parsed.query !== undefined) filters.query = parsed.query;
    if (parsed.page !== undefined) filters.page = parsed.page;
    if (parsed.limit !== undefined) filters.limit = parsed.limit;
    if (parsed.sortBy !== undefined) filters.sortBy = parsed.sortBy;

    const result = await freelancerService.search(filters);

    return reply.send(result);
  });

  /**
   * GET /freelancer/:username - Get public freelancer profile
   */
  fastify.get<{ Params: UsernameParams }>('/:username', async (request, reply: FastifyReply) => {
    const { username } = request.params;

    try {
      const profile = await freelancerService.getPublicProfile(username);

      // Increment view count asynchronously
      void freelancerService.incrementProfileViews(profile.username);

      return await reply.send({ profile });
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        return reply.status(404).send({
          error: 'Freelancer profile not found',
          code: 'PROFILE_NOT_FOUND',
        });
      }
      throw error;
    }
  });
}

export default freelancerProfileRoutes;
