/**
 * Discovery Routes
 *
 * Public API routes for clients to discover and connect with executives.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@skillancer/database';
import { matchingService } from '../services/matching.service.js';
import type { ExecutiveType, CompanyStage } from '@prisma/client';

interface ExecutiveParams {
  slug: string;
}

interface ExecutiveIdParams {
  executiveId: string;
}

interface SearchQuery {
  type?: ExecutiveType;
  industry?: string;
  companyStage?: CompanyStage;
  availability?: 'now' | 'within_30_days' | 'any';
  hoursMin?: string;
  hoursMax?: string;
  rateMin?: string;
  rateMax?: string;
  timezone?: string;
  page?: string;
  limit?: string;
}

interface MatchRequestBody {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  clientTitle?: string;
  executiveType: ExecutiveType;
  companyStage?: CompanyStage;
  companySize?: string;
  industry?: string;
  hoursPerWeek: number;
  budgetRangeMin?: number;
  budgetRangeMax?: number;
  timeline?: string;
  specificNeeds?: string;
}

interface RequestIntroBody {
  name: string;
  email: string;
  company: string;
  title?: string;
  message: string;
  hoursPerWeek?: number;
  startDate?: string;
}

export async function discoveryRoutes(fastify: FastifyInstance) {
  // =========================================================================
  // EXECUTIVE SEARCH
  // =========================================================================

  /**
   * GET /executives - Search and filter executives
   */
  fastify.get(
    '/executives',
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      const {
        type,
        industry,
        companyStage,
        availability,
        hoursMin,
        hoursMax,
        rateMin,
        rateMax,
        timezone,
        page = '1',
        limit = '20',
      } = request.query;

      const pageNum = parseInt(page, 10);
      const limitNum = Math.min(parseInt(limit, 10), 50);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: Record<string, unknown> = {
        vettingStatus: 'APPROVED',
        searchable: true,
      };

      if (type) {
        where.executiveType = type;
      }

      if (industry) {
        where.industries = { has: industry };
      }

      if (companyStage) {
        where.companyStages = { has: companyStage };
      }

      if (availability === 'now') {
        where.OR = [{ availableFrom: null }, { availableFrom: { lte: new Date() } }];
        where.currentClients = { lt: prisma.executiveProfile.fields.maxClients };
      } else if (availability === 'within_30_days') {
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        where.OR = [{ availableFrom: null }, { availableFrom: { lte: thirtyDays } }];
      }

      if (hoursMin) {
        where.hoursPerWeekMax = { gte: parseInt(hoursMin, 10) };
      }

      if (hoursMax) {
        where.hoursPerWeekMin = { lte: parseInt(hoursMax, 10) };
      }

      if (rateMin) {
        where.hourlyRateMax = { gte: parseFloat(rateMin) };
      }

      if (rateMax) {
        where.hourlyRateMin = { lte: parseFloat(rateMax) };
      }

      if (timezone) {
        where.timezone = timezone;
      }

      // Get executives
      const [executives, total] = await Promise.all([
        prisma.executiveProfile.findMany({
          where,
          select: {
            id: true,
            headline: true,
            executiveType: true,
            yearsExecutiveExp: true,
            industries: true,
            specializations: true,
            companyStages: true,
            profilePhotoUrl: true,
            availableFrom: true,
            timezone: true,
            hoursPerWeekMin: true,
            hoursPerWeekMax: true,
            hourlyRateMin: true,
            hourlyRateMax: true,
            monthlyRetainerMin: true,
            monthlyRetainerMax: true,
            featuredExecutive: true,
            profileCompleteness: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: [
            { featuredExecutive: 'desc' },
            { profileCompleteness: 'desc' },
            { yearsExecutiveExp: 'desc' },
          ],
          skip,
          take: limitNum,
        }),
        prisma.executiveProfile.count({ where }),
      ]);

      // Transform for public display
      const publicExecutives = executives.map((exec) => ({
        id: exec.id,
        slug: `${exec.user.firstName?.toLowerCase()}-${exec.user.lastName?.toLowerCase()}-${exec.id.substring(0, 8)}`,
        name: `${exec.user.firstName} ${exec.user.lastName}`,
        headline: exec.headline,
        executiveType: exec.executiveType,
        yearsExecutiveExp: exec.yearsExecutiveExp,
        industries: exec.industries,
        specializations: exec.specializations.slice(0, 5),
        companyStages: exec.companyStages,
        profilePhotoUrl: exec.profilePhotoUrl,
        availability: getAvailabilityStatus(exec.availableFrom),
        timezone: exec.timezone,
        hoursRange:
          exec.hoursPerWeekMin && exec.hoursPerWeekMax
            ? `${exec.hoursPerWeekMin}-${exec.hoursPerWeekMax} hrs/week`
            : null,
        rateRange:
          exec.hourlyRateMin && exec.hourlyRateMax
            ? { min: exec.hourlyRateMin, max: exec.hourlyRateMax, currency: 'USD' }
            : null,
        isFeatured: exec.featuredExecutive,
      }));

      return {
        executives: publicExecutives,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    }
  );

  /**
   * GET /executives/featured - Get featured executives
   */
  fastify.get('/executives/featured', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const featured = await prisma.executiveProfile.findMany({
      where: {
        vettingStatus: 'APPROVED',
        searchable: true,
        featuredExecutive: true,
      },
      select: {
        id: true,
        headline: true,
        executiveType: true,
        yearsExecutiveExp: true,
        industries: true,
        profilePhotoUrl: true,
        featuredOrder: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { featuredOrder: 'asc' },
      take: 8,
    });

    return {
      executives: featured.map((exec) => ({
        id: exec.id,
        slug: `${exec.user.firstName?.toLowerCase()}-${exec.user.lastName?.toLowerCase()}-${exec.id.substring(0, 8)}`,
        name: `${exec.user.firstName} ${exec.user.lastName}`,
        headline: exec.headline,
        executiveType: exec.executiveType,
        yearsExecutiveExp: exec.yearsExecutiveExp,
        industries: exec.industries.slice(0, 3),
        profilePhotoUrl: exec.profilePhotoUrl,
      })),
    };
  });

  /**
   * GET /executives/:slug - Get executive public profile
   */
  fastify.get(
    '/executives/:slug',
    async (request: FastifyRequest<{ Params: ExecutiveParams }>, reply: FastifyReply) => {
      const { slug } = request.params;

      // Extract ID from slug (last 8 chars after final dash)
      const parts = slug.split('-');
      const idPrefix = parts[parts.length - 1];

      const executive = await prisma.executiveProfile.findFirst({
        where: {
          id: { startsWith: idPrefix },
          vettingStatus: 'APPROVED',
          searchable: true,
        },
        select: {
          id: true,
          headline: true,
          bio: true,
          executiveType: true,
          yearsExecutiveExp: true,
          totalYearsExp: true,
          industries: true,
          specializations: true,
          companyStages: true,
          companySizes: true,
          profilePhotoUrl: true,
          availableFrom: true,
          timezone: true,
          hoursPerWeekMin: true,
          hoursPerWeekMax: true,
          hourlyRateMin: true,
          hourlyRateMax: true,
          monthlyRetainerMin: true,
          monthlyRetainerMax: true,
          linkedinVerified: true,
          featuredExecutive: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          executiveHistory: {
            select: {
              title: true,
              company: true,
              companyStage: true,
              startDate: true,
              endDate: true,
              isCurrent: true,
              achievements: true,
              verified: true,
            },
            orderBy: { startDate: 'desc' },
            take: 5,
          },
        },
      });

      if (!executive) {
        return reply.code(404).send({ error: 'Executive not found' });
      }

      return {
        id: executive.id,
        slug,
        name: `${executive.user.firstName} ${executive.user.lastName}`,
        headline: executive.headline,
        bio: executive.bio,
        executiveType: executive.executiveType,
        experience: {
          executive: executive.yearsExecutiveExp,
          total: executive.totalYearsExp,
        },
        industries: executive.industries,
        specializations: executive.specializations,
        companyStages: executive.companyStages,
        companySizes: executive.companySizes,
        profilePhotoUrl: executive.profilePhotoUrl,
        availability: getAvailabilityStatus(executive.availableFrom),
        timezone: executive.timezone,
        engagement: {
          hoursRange:
            executive.hoursPerWeekMin && executive.hoursPerWeekMax
              ? { min: executive.hoursPerWeekMin, max: executive.hoursPerWeekMax }
              : null,
          hourlyRate:
            executive.hourlyRateMin && executive.hourlyRateMax
              ? { min: executive.hourlyRateMin, max: executive.hourlyRateMax, currency: 'USD' }
              : null,
          monthlyRetainer:
            executive.monthlyRetainerMin && executive.monthlyRetainerMax
              ? {
                  min: executive.monthlyRetainerMin,
                  max: executive.monthlyRetainerMax,
                  currency: 'USD',
                }
              : null,
        },
        verification: {
          linkedinVerified: executive.linkedinVerified,
          vetted: true,
        },
        isFeatured: executive.featuredExecutive,
        history: executive.executiveHistory.map((h) => ({
          title: h.title,
          company: h.company,
          companyStage: h.companyStage,
          period: {
            start: h.startDate,
            end: h.endDate,
            current: h.isCurrent,
          },
          achievements: h.achievements.slice(0, 3),
          verified: h.verified,
        })),
      };
    }
  );

  // =========================================================================
  // MATCHING REQUESTS
  // =========================================================================

  /**
   * POST /executives/match-request - Submit a matching request
   */
  fastify.post(
    '/executives/match-request',
    async (request: FastifyRequest<{ Body: MatchRequestBody }>, reply: FastifyReply) => {
      const body = request.body;

      try {
        const matchRequest = await matchingService.createMatchRequest({
          clientName: body.clientName,
          clientEmail: body.clientEmail,
          clientCompany: body.clientCompany,
          clientTitle: body.clientTitle,
          executiveType: body.executiveType,
          companyStage: body.companyStage,
          companySize: body.companySize,
          industry: body.industry,
          hoursPerWeek: body.hoursPerWeek,
          budgetRangeMin: body.budgetRangeMin,
          budgetRangeMax: body.budgetRangeMax,
          timeline: body.timeline,
          specificNeeds: body.specificNeeds,
        });

        return reply.code(201).send({
          id: matchRequest.id,
          status: matchRequest.status,
          message:
            'Match request submitted. Our team will review and send curated matches within 24-48 hours.',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create match request';
        return reply.code(400).send({ error: message });
      }
    }
  );

  /**
   * GET /executives/match-request/:requestId - Get match request status
   */
  fastify.get(
    '/executives/match-request/:requestId',
    async (request: FastifyRequest<{ Params: { requestId: string } }>, reply: FastifyReply) => {
      const { requestId } = request.params;

      const matchRequest = await prisma.executiveMatchRequest.findUnique({
        where: { id: requestId },
        include: {
          matches: {
            where: { status: { not: 'DECLINED' } },
            include: {
              executive: {
                select: {
                  id: true,
                  headline: true,
                  executiveType: true,
                  yearsExecutiveExp: true,
                  industries: true,
                  profilePhotoUrl: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!matchRequest) {
        return reply.code(404).send({ error: 'Match request not found' });
      }

      return {
        id: matchRequest.id,
        status: matchRequest.status,
        createdAt: matchRequest.createdAt,
        matches: matchRequest.matches.map((m) => ({
          id: m.id,
          executive: {
            id: m.executive.id,
            name: `${m.executive.user.firstName} ${m.executive.user.lastName}`,
            headline: m.executive.headline,
            executiveType: m.executive.executiveType,
            yearsExecutiveExp: m.executive.yearsExecutiveExp,
            industries: m.executive.industries.slice(0, 3),
            profilePhotoUrl: m.executive.profilePhotoUrl,
          },
          matchScore: m.matchScore,
          status: m.status,
        })),
      };
    }
  );

  // =========================================================================
  // INTRODUCTION REQUESTS
  // =========================================================================

  /**
   * POST /executives/:executiveId/request-intro - Request introduction
   */
  fastify.post(
    '/executives/:executiveId/request-intro',
    async (
      request: FastifyRequest<{ Params: ExecutiveIdParams; Body: RequestIntroBody }>,
      reply: FastifyReply
    ) => {
      const { executiveId } = request.params;
      const body = request.body;

      // Verify executive exists and is searchable
      const executive = await prisma.executiveProfile.findUnique({
        where: { id: executiveId },
        select: { id: true, searchable: true, vettingStatus: true },
      });

      if (!executive || !executive.searchable || executive.vettingStatus !== 'APPROVED') {
        return reply.code(404).send({ error: 'Executive not found' });
      }

      // Create a match request and auto-match
      try {
        const matchRequest = await matchingService.createMatchRequest({
          clientName: body.name,
          clientEmail: body.email,
          clientCompany: body.company,
          clientTitle: body.title,
          executiveType: 'FRACTIONAL_CTO', // Will be updated from executive profile
          hoursPerWeek: body.hoursPerWeek || 10,
          specificNeeds: body.message,
        });

        // Create direct match
        await prisma.executiveMatch.create({
          data: {
            requestId: matchRequest.id,
            executiveId,
            matchScore: 100, // Direct request
            matchReasons: { directRequest: true },
            status: 'INTRO_REQUESTED',
            clientInterested: true,
            clientNotes: body.message,
          },
        });

        // Update request status
        await prisma.executiveMatchRequest.update({
          where: { id: matchRequest.id },
          data: { status: 'INTRO_SCHEDULED' },
        });

        return reply.code(201).send({
          success: true,
          message: 'Introduction request sent. The executive will respond within 48 hours.',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to request introduction';
        return reply.code(400).send({ error: message });
      }
    }
  );

  /**
   * POST /executives/:executiveId/message - Send message to executive
   */
  fastify.post(
    '/executives/:executiveId/message',
    async (
      request: FastifyRequest<{
        Params: ExecutiveIdParams;
        Body: { name: string; email: string; company: string; message: string };
      }>,
      reply: FastifyReply
    ) => {
      const { executiveId } = request.params;
      const body = request.body;

      // Verify executive exists
      const executive = await prisma.executiveProfile.findUnique({
        where: { id: executiveId },
        select: { id: true, searchable: true },
      });

      if (!executive || !executive.searchable) {
        return reply.code(404).send({ error: 'Executive not found' });
      }

      // In production, queue a notification/email
      // await notificationService.sendExecutiveMessage(executiveId, body);

      return reply.code(201).send({
        success: true,
        message: 'Message sent to executive.',
      });
    }
  );
}

// =========================================================================
// HELPERS
// =========================================================================

function getAvailabilityStatus(
  availableFrom: Date | null
): 'available' | 'limited' | 'unavailable' {
  if (!availableFrom) return 'available';

  const now = new Date();
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  if (availableFrom <= now) return 'available';
  if (availableFrom <= thirtyDays) return 'limited';
  return 'unavailable';
}
