/**
 * Executive Profile Routes
 *
 * API endpoints for executive profile management.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as profileService from '../services/executive-profile.service.js';
import * as linkedinService from '../services/linkedin-verification.service.js';

// Validation schemas
const createProfileSchema = z.object({
  executiveType: z.enum([
    'FRACTIONAL_CTO',
    'FRACTIONAL_CFO',
    'FRACTIONAL_CMO',
    'FRACTIONAL_CISO',
    'FRACTIONAL_COO',
    'FRACTIONAL_CHRO',
    'FRACTIONAL_CPO',
    'FRACTIONAL_CRO',
    'FRACTIONAL_CLO',
    'FRACTIONAL_CDO',
    'BOARD_ADVISOR',
    'INTERIM_EXECUTIVE',
  ]),
  headline: z.string().min(10).max(200),
  bio: z.string().min(100).max(3000).optional(),
  linkedinUrl: z.string().url().optional(),
  yearsExecutiveExp: z.number().min(3).max(50),
  industriesServed: z.array(z.string()).min(1).optional(),
  companySizesServed: z.array(z.string()).optional(),
  companyStagesServed: z
    .array(
      z.enum([
        'PRE_SEED',
        'SEED',
        'SERIES_A',
        'SERIES_B',
        'SERIES_C_PLUS',
        'GROWTH',
        'ENTERPRISE',
        'PUBLIC',
        'TURNAROUND',
      ])
    )
    .optional(),
  specializations: z.array(z.string()).optional(),
  hourlyRateMin: z.number().min(100).optional(),
  hourlyRateMax: z.number().min(100).optional(),
  monthlyRateMin: z.number().min(1000).optional(),
  monthlyRateMax: z.number().min(1000).optional(),
  hoursPerWeekMin: z.number().min(5).default(10),
  hoursPerWeekMax: z.number().min(5).max(60).default(40),
  availableStartDate: z.string().datetime().optional(),
  timezone: z.string().optional(),
  remoteOnly: z.boolean().default(false),
  willingToTravel: z.boolean().default(false),
  travelFrequency: z.string().optional(),
});

const updateProfileSchema = createProfileSchema.partial();

const addHistorySchema = z.object({
  title: z.string().min(2).max(100),
  company: z.string().min(2).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCurrent: z.boolean().default(false),
  isExecutiveRole: z.boolean().default(true),
  description: z.string().max(2000).optional(),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  companyStage: z
    .enum([
      'PRE_SEED',
      'SEED',
      'SERIES_A',
      'SERIES_B',
      'SERIES_C_PLUS',
      'GROWTH',
      'ENTERPRISE',
      'PUBLIC',
      'TURNAROUND',
    ])
    .optional(),
  keyAccomplishments: z.array(z.string()).optional(),
});

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  // Get current user's executive profile
  app.get(
    '/me',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Get my executive profile',
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const profile = await profileService.getExecutiveByUserId(userId);

      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      return profile;
    }
  );

  // Create executive profile (apply to become an executive)
  app.post(
    '/apply',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Apply to become an executive',
        body: { type: 'object' },
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const data = createProfileSchema.parse(request.body);

      // Check if user already has a profile
      const existing = await profileService.getExecutiveByUserId(userId);
      if (existing) {
        return reply.status(400).send({ error: 'You already have an executive profile' });
      }

      const profile = await profileService.createExecutiveProfile({
        userId,
        executiveType: data.executiveType as any,
        headline: data.headline,
        bio: data.bio,
        yearsExecutiveExp: data.yearsExecutiveExp,
        totalYearsExp: data.yearsExecutiveExp, // Default to same as executive exp
        industries: data.industriesServed,
        companySizes: data.companySizesServed,
        companyStages: data.companyStagesServed as any,
        specializations: data.specializations,
        hoursPerWeekMin: data.hoursPerWeekMin,
        hoursPerWeekMax: data.hoursPerWeekMax,
        monthlyRetainerMin: data.monthlyRateMin,
        monthlyRetainerMax: data.monthlyRateMax,
        hourlyRateMin: data.hourlyRateMin,
        hourlyRateMax: data.hourlyRateMax,
        timezone: data.timezone,
        linkedinUrl: data.linkedinUrl,
      } as unknown as Parameters<typeof profileService.createExecutiveProfile>[0]);

      return reply.status(201).send(profile);
    }
  );

  // Update executive profile
  app.patch(
    '/me',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Update my executive profile',
        body: { type: 'object' },
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const data = updateProfileSchema.parse(request.body);

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const updated = await profileService.updateExecutiveProfile(profile.id, data);

      return updated;
    }
  );

  // Get profile completeness
  app.get(
    '/me/completeness',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Get profile completeness breakdown',
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const completeness = await profileService.calculateProfileCompleteness(profile.id);

      return completeness;
    }
  );

  // Add employment history
  app.post(
    '/me/history',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Add employment history entry',
        body: { type: 'object' },
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const data = addHistorySchema.parse(request.body);

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const history = await profileService.addExecutiveHistory({
        executiveId: profile.id,
        title: data.title,
        company: data.company,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isCurrent: data.isCurrent,
        description: data.description,
        industry: data.industry,
        companySize: data.companySize,
        companyStage: data.companyStage as any,
        achievements: data.keyAccomplishments,
      });

      return reply.status(201).send(history);
    }
  );

  // Update employment history
  app.patch(
    '/me/history/:historyId',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Update employment history entry',
        params: { type: 'object' },
        body: { type: 'object' },
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { historyId } = request.params as { historyId: string };
      const data = addHistorySchema.partial().parse(request.body);

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const history = await profileService.updateExecutiveHistory(historyId, profile.id, {
        title: data.title,
        company: data.company,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isCurrent: data.isCurrent,
        description: data.description,
        industry: data.industry,
        companySize: data.companySize,
        companyStage: data.companyStage as any,
        achievements: data.keyAccomplishments,
      });

      return history;
    }
  );

  // Delete employment history
  app.delete(
    '/me/history/:historyId',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Delete employment history entry',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const { historyId } = request.params as { historyId: string };

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      await profileService.deleteExecutiveHistory(historyId, profile.id);

      return reply.status(204).send();
    }
  );

  // Initiate LinkedIn verification
  app.post(
    '/me/linkedin/connect',
    {
      onRequest: [app.requireAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Initiate LinkedIn OAuth for verification',
      } as any,
    },
    async (request, reply) => {
      const userId = request.user!.id;

      const profile = await profileService.getExecutiveByUserId(userId);
      if (!profile) {
        return reply.status(404).send({ error: 'Executive profile not found' });
      }

      const { authorizationUrl } = await linkedinService.initiateLinkedInVerification(profile.id);

      return { authorizationUrl };
    }
  );

  // LinkedIn OAuth callback
  app.get(
    '/linkedin/callback',
    {
      schema: {
        tags: ['Executive Profile'],
        summary: 'LinkedIn OAuth callback',
        querystring: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { code, state } = request.query as { code: string; state: string };

      // Decode state to get executive ID
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      const executiveId = stateData.executiveId;

      await linkedinService.completeLinkedInVerification(executiveId, code, state);

      // Redirect back to profile page
      return reply.redirect('/executive/profile?linkedin=connected');
    }
  );

  // Get public executive profile (for marketplace)
  app.get(
    '/:executiveId',
    {
      onRequest: [app.optionalAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Get executive profile (public)',
        params: { type: 'object' },
      },
    },
    async (request, reply) => {
      const { executiveId } = request.params as { executiveId: string };

      const profile = await profileService.getExecutiveProfile(executiveId);

      if (!profile) {
        return reply.status(404).send({ error: 'Executive not found' });
      }

      // Only show approved executives publicly
      if (profile.vettingStatus !== 'APPROVED' && !request.user?.isAdmin) {
        return reply.status(404).send({ error: 'Executive not found' });
      }

      // Filter sensitive fields for non-owners
      if (request.user?.id !== profile.userId && !request.user?.isAdmin) {
        const { linkedinAccessToken, linkedinTokenExpiry, ...publicProfile } = profile as any;
        return publicProfile;
      }

      return profile;
    }
  );

  // Search executives (marketplace)
  app.get(
    '/',
    {
      onRequest: [app.optionalAuth],
      schema: {
        tags: ['Executive Profile'],
        summary: 'Search executives',
        querystring: z.object({
          type: z.string().optional(),
          industries: z.string().optional(), // comma-separated
          minHourlyRate: z.coerce.number().optional(),
          maxHourlyRate: z.coerce.number().optional(),
          minHoursPerWeek: z.coerce.number().optional(),
          availability: z.enum(['immediate', 'one_week', 'two_weeks', 'one_month']).optional(),
          query: z.string().optional(),
          page: z.coerce.number().min(1).default(1),
          limit: z.coerce.number().min(1).max(50).default(20),
        }),
      },
    },
    async (request, reply) => {
      const params = request.query as any;

      const result = await profileService.searchExecutives({
        executiveType: params.type as any,
        industries: params.industries?.split(','),
        minHourlyRate: params.minHourlyRate,
        maxHourlyRate: params.maxHourlyRate,
        minHoursPerWeek: params.minHoursPerWeek,
        availableNow: params.availability === 'immediate',
        query: params.query,
        page: params.page,
        limit: params.limit,
      } as any);

      return result;
    }
  );

  // Get featured executives
  app.get(
    '/featured',
    {
      schema: {
        tags: ['Executive Profile'],
        summary: 'Get featured executives',
        querystring: z.object({
          limit: z.coerce.number().min(1).max(12).default(6),
        }),
      },
    },
    async (request, reply) => {
      const { limit } = request.query as { limit: number };

      const executives = await profileService.getFeaturedExecutives(undefined, limit);

      return executives;
    }
  );
}
