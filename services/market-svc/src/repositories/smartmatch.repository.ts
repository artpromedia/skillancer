/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/**
 * @module @skillancer/market-svc/repositories/smartmatch
 * SmartMatch data access layer for intelligent matching system
 */

import type {
  MatchingEventType,
  MatchingOutcome,
  MatchingEventInput,
  MatchingEventOutcomeInput,
  UpdateWorkPatternInput,
  CreateSkillRelationshipInput,
  CreateEndorsementInput,
  SkillRelationType,
  ExperienceLevel,
} from '../types/smartmatch.types.js';
import { Prisma, type PrismaClient } from '@skillancer/database';

// ============================================================================
// Types for repository operations
// ============================================================================

export interface ListMatchingEventsParams {
  clientUserId?: string;
  freelancerUserId?: string;
  projectId?: string;
  eventType?: MatchingEventType;
  outcome?: MatchingOutcome;
  limit?: number;
  offset?: number;
}

export interface ListSkillRelationshipsParams {
  skill?: string;
  relationshipType?: SkillRelationType;
  limit?: number;
  offset?: number;
}

export interface ListEndorsementsParams {
  userId?: string;
  skill?: string;
  endorsedByUserId?: string;
  limit?: number;
  offset?: number;
}

export interface RateIntelligenceParams {
  skillCategory: string;
  primarySkill?: string;
  experienceLevel?: ExperienceLevel;
  region?: string;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * SmartMatch Repository
 *
 * Handles all database operations for SmartMatch entities:
 * - FreelancerWorkPattern (availability, scheduling)
 * - MatchingEvent (tracking for ML)
 * - RateIntelligence (market rates)
 * - SkillRelationship (related skills)
 * - FreelancerSkillEndorsement (endorsements)
 */
export class SmartMatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ===========================================================================
  // WORK PATTERN OPERATIONS
  // ===========================================================================

  /**
   * Get work pattern for a freelancer
   */
  async getWorkPattern(userId: string) {
    return this.prisma.freelancerWorkPattern.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Create or update work pattern for a freelancer
   */
  async upsertWorkPattern(userId: string, data: UpdateWorkPatternInput) {
    return this.prisma.freelancerWorkPattern.upsert({
      where: { userId },
      update: {
        ...(data.weeklyHoursAvailable !== undefined && {
          weeklyHoursAvailable: data.weeklyHoursAvailable,
        }),
        ...(data.preferredHoursPerWeek !== undefined && {
          preferredHoursPerWeek: data.preferredHoursPerWeek,
        }),
        ...(data.workingDays && { workingDays: data.workingDays }),
        ...(data.workingHoursStart !== undefined && {
          workingHoursStart: data.workingHoursStart,
        }),
        ...(data.workingHoursEnd !== undefined && {
          workingHoursEnd: data.workingHoursEnd,
        }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.preferredProjectDuration && {
          preferredProjectDuration: data.preferredProjectDuration,
        }),
        ...(data.preferredBudgetMin !== undefined && {
          preferredBudgetMin: data.preferredBudgetMin,
        }),
        ...(data.preferredBudgetMax !== undefined && {
          preferredBudgetMax: data.preferredBudgetMax,
        }),
        ...(data.preferredLocationType && {
          preferredLocationType: data.preferredLocationType,
        }),
        ...(data.maxConcurrentProjects !== undefined && {
          maxConcurrentProjects: data.maxConcurrentProjects,
        }),
        ...(data.unavailablePeriods && {
          unavailablePeriods: data.unavailablePeriods as unknown as Prisma.InputJsonValue,
        }),
      },
      create: {
        userId,
        weeklyHoursAvailable: data.weeklyHoursAvailable ?? null,
        preferredHoursPerWeek: data.preferredHoursPerWeek ?? null,
        workingDays: data.workingDays ?? [],
        workingHoursStart: data.workingHoursStart ?? null,
        workingHoursEnd: data.workingHoursEnd ?? null,
        timezone: data.timezone ?? null,
        preferredProjectDuration: data.preferredProjectDuration ?? [],
        preferredBudgetMin: data.preferredBudgetMin ?? null,
        preferredBudgetMax: data.preferredBudgetMax ?? null,
        preferredLocationType: data.preferredLocationType ?? [],
        maxConcurrentProjects: data.maxConcurrentProjects ?? 3,
        unavailablePeriods:
          (data.unavailablePeriods as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Update last activity timestamp
   */
  async updateLastActive(userId: string) {
    return this.prisma.freelancerWorkPattern.upsert({
      where: { userId },
      update: { lastActiveAt: new Date() },
      create: {
        userId,
        lastActiveAt: new Date(),
        workingDays: [],
        preferredProjectDuration: [],
        preferredLocationType: [],
      },
    });
  }

  /**
   * Update last bid timestamp
   */
  async updateLastBid(userId: string) {
    return this.prisma.freelancerWorkPattern.upsert({
      where: { userId },
      update: { lastBidAt: new Date() },
      create: {
        userId,
        lastBidAt: new Date(),
        workingDays: [],
        preferredProjectDuration: [],
        preferredLocationType: [],
      },
    });
  }

  /**
   * Update active projects count
   */
  async updateActiveProjectsCount(userId: string, count: number) {
    return this.prisma.freelancerWorkPattern.update({
      where: { userId },
      data: { currentActiveProjects: count },
    });
  }

  /**
   * Increment active projects count
   */
  async incrementActiveProjects(userId: string) {
    return this.prisma.freelancerWorkPattern.update({
      where: { userId },
      data: { currentActiveProjects: { increment: 1 } },
    });
  }

  /**
   * Decrement active projects count
   */
  async decrementActiveProjects(userId: string) {
    return this.prisma.freelancerWorkPattern.update({
      where: { userId },
      data: {
        currentActiveProjects: { decrement: 1 },
        lastProjectCompletedAt: new Date(),
      },
    });
  }

  /**
   * Update response time metrics
   */
  async updateResponseMetrics(
    userId: string,
    avgResponseTimeMinutes: number,
    avgFirstBidTimeHours: number
  ) {
    return this.prisma.freelancerWorkPattern.update({
      where: { userId },
      data: {
        avgResponseTimeMinutes,
        avgFirstBidTimeHours,
      },
    });
  }

  // ===========================================================================
  // MATCHING EVENT OPERATIONS
  // ===========================================================================

  /**
   * Create a matching event
   */
  async createMatchingEvent(data: MatchingEventInput) {
    return this.prisma.matchingEvent.create({
      data: {
        eventType: data.eventType,
        projectId: data.projectId ?? null,
        serviceId: data.serviceId ?? null,
        clientUserId: data.clientUserId,
        freelancerUserId: data.freelancerUserId,
        matchScore: data.matchScore ?? null,
        matchRank: data.matchRank ?? null,
        matchFactors: data.matchFactors
          ? (data.matchFactors as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        searchCriteria: data.searchCriteria
          ? (data.searchCriteria as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  /**
   * Update matching event with outcome
   */
  async updateMatchingEventOutcome(eventId: string, data: MatchingEventOutcomeInput) {
    return this.prisma.matchingEvent.update({
      where: { id: eventId },
      data: {
        outcome: data.outcome,
        outcomeAt: new Date(),
        wasHired: data.wasHired ?? null,
        projectSuccessful: data.projectSuccessful ?? null,
        clientSatisfactionScore: data.clientSatisfactionScore ?? null,
      },
    });
  }

  /**
   * Get matching event by ID
   */
  async getMatchingEvent(eventId: string) {
    return this.prisma.matchingEvent.findUnique({
      where: { id: eventId },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        freelancer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * List matching events
   */
  async listMatchingEvents(params: ListMatchingEventsParams) {
    const {
      clientUserId,
      freelancerUserId,
      projectId,
      eventType,
      outcome,
      limit = 50,
      offset = 0,
    } = params;

    const where: Prisma.MatchingEventWhereInput = {
      ...(clientUserId && { clientUserId }),
      ...(freelancerUserId && { freelancerUserId }),
      ...(projectId && { projectId }),
      ...(eventType && { eventType }),
      ...(outcome && { outcome }),
    };

    const [items, total] = await Promise.all([
      this.prisma.matchingEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.matchingEvent.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get learning data for ML model
   */
  async getMatchingLearningData(params: { limit?: number; withOutcome?: boolean }) {
    const { limit = 1000, withOutcome = true } = params;

    return this.prisma.matchingEvent.findMany({
      where: withOutcome
        ? {
            outcome: { not: null },
            wasHired: { not: null },
          }
        : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        matchScore: true,
        matchFactors: true,
        outcome: true,
        wasHired: true,
        projectSuccessful: true,
        clientSatisfactionScore: true,
        searchCriteria: true,
      },
    });
  }

  // ===========================================================================
  // RATE INTELLIGENCE OPERATIONS
  // ===========================================================================

  /**
   * Get market rate for a skill
   */
  async getMarketRate(params: RateIntelligenceParams) {
    const { skillCategory, primarySkill, experienceLevel, region } = params;

    // Filter out 'ANY' experience level - it's a filter flag, not a database value
    const prismaExpLevel =
      experienceLevel && experienceLevel !== 'ANY' ? experienceLevel : undefined;

    return this.prisma.rateIntelligence.findFirst({
      where: {
        skillCategory,
        ...(primarySkill && { primarySkill }),
        ...(prismaExpLevel && {
          experienceLevel: prismaExpLevel as 'ENTRY' | 'INTERMEDIATE' | 'EXPERT',
        }),
        ...(region && { region }),
        periodEnd: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Within last 30 days
      },
      orderBy: { periodEnd: 'desc' },
    });
  }

  /**
   * Create or update rate intelligence
   * Note: experienceLevel must be a valid Prisma enum value (ENTRY, INTERMEDIATE, EXPERT)
   */
  async upsertRateIntelligence(data: {
    skillCategory: string;
    primarySkill?: string | null;
    experienceLevel: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
    region?: string | null;
    sampleSize: number;
    avgHourlyRate: number;
    medianHourlyRate: number;
    minHourlyRate: number;
    maxHourlyRate: number;
    percentile25: number;
    percentile75: number;
    percentile90: number;
    avgFixedProjectRate?: number | null;
    rateChangePct30d?: number | null;
    rateChangePct90d?: number | null;
    periodStart: Date;
    periodEnd: Date;
  }) {
    return this.prisma.rateIntelligence.upsert({
      where: {
        skillCategory_primarySkill_experienceLevel_region_periodStart: {
          skillCategory: data.skillCategory,
          primarySkill: data.primarySkill ?? '',
          experienceLevel: data.experienceLevel,
          region: data.region ?? '',
          periodStart: data.periodStart,
        },
      },
      update: {
        sampleSize: data.sampleSize,
        avgHourlyRate: data.avgHourlyRate,
        medianHourlyRate: data.medianHourlyRate,
        minHourlyRate: data.minHourlyRate,
        maxHourlyRate: data.maxHourlyRate,
        percentile25: data.percentile25,
        percentile75: data.percentile75,
        percentile90: data.percentile90,
        avgFixedProjectRate: data.avgFixedProjectRate ?? null,
        rateChangePct30d: data.rateChangePct30d ?? null,
        rateChangePct90d: data.rateChangePct90d ?? null,
        periodEnd: data.periodEnd,
      },
      create: {
        skillCategory: data.skillCategory,
        primarySkill: data.primarySkill ?? null,
        experienceLevel: data.experienceLevel,
        region: data.region ?? null,
        sampleSize: data.sampleSize,
        avgHourlyRate: data.avgHourlyRate,
        medianHourlyRate: data.medianHourlyRate,
        minHourlyRate: data.minHourlyRate,
        maxHourlyRate: data.maxHourlyRate,
        percentile25: data.percentile25,
        percentile75: data.percentile75,
        percentile90: data.percentile90,
        avgFixedProjectRate: data.avgFixedProjectRate ?? null,
        rateChangePct30d: data.rateChangePct30d ?? null,
        rateChangePct90d: data.rateChangePct90d ?? null,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      },
    });
  }

  /**
   * Get rate trends
   */
  async getRateTrends(skillCategory: string, periods: number = 12) {
    return this.prisma.rateIntelligence.findMany({
      where: { skillCategory },
      orderBy: { periodEnd: 'desc' },
      take: periods,
      select: {
        periodStart: true,
        periodEnd: true,
        avgHourlyRate: true,
        medianHourlyRate: true,
        sampleSize: true,
      },
    });
  }

  // ===========================================================================
  // SKILL RELATIONSHIP OPERATIONS
  // ===========================================================================

  /**
   * Create skill relationship
   */
  async createSkillRelationship(data: CreateSkillRelationshipInput) {
    return this.prisma.skillRelationship.create({
      data: {
        skill1: data.skill1.toLowerCase(),
        skill2: data.skill2.toLowerCase(),
        relationshipType: data.relationshipType,
        strength: data.strength,
        bidirectional: data.bidirectional ?? true,
        source: data.source ?? 'MANUAL',
      },
    });
  }

  /**
   * Get relationships for a skill
   */
  async getSkillRelationships(skill: string) {
    const normalizedSkill = skill.toLowerCase();

    return this.prisma.skillRelationship.findMany({
      where: {
        OR: [{ skill1: normalizedSkill }, { skill2: normalizedSkill, bidirectional: true }],
      },
      orderBy: { strength: 'desc' },
    });
  }

  /**
   * Find related skills (returns the related skill names with strength)
   */
  async findRelatedSkills(skill: string) {
    const normalizedSkill = skill.toLowerCase();
    const relationships = await this.getSkillRelationships(normalizedSkill);

    return relationships.map((rel) => ({
      skill: rel.skill1.toLowerCase() === normalizedSkill ? rel.skill2 : rel.skill1,
      strength: Number(rel.strength),
      relationshipType: rel.relationshipType,
    }));
  }

  /**
   * Bulk create skill relationships
   */
  async bulkCreateSkillRelationships(data: CreateSkillRelationshipInput[]) {
    return this.prisma.skillRelationship.createMany({
      data: data.map((r) => ({
        skill1: r.skill1.toLowerCase(),
        skill2: r.skill2.toLowerCase(),
        relationshipType: r.relationshipType,
        strength: r.strength,
        bidirectional: r.bidirectional ?? true,
        source: r.source ?? 'MANUAL',
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Update skill relationship strength
   */
  async updateSkillRelationshipStrength(id: string, strength: number) {
    return this.prisma.skillRelationship.update({
      where: { id },
      data: { strength },
    });
  }

  // ===========================================================================
  // ENDORSEMENT OPERATIONS
  // ===========================================================================

  /**
   * Create skill endorsement
   */
  async createEndorsement(endorserUserId: string, data: CreateEndorsementInput) {
    return this.prisma.freelancerSkillEndorsement.create({
      data: {
        userId: data.userId,
        skill: data.skill.toLowerCase(),
        endorsedByUserId: endorserUserId,
        endorsementType: data.endorsementType,
        projectId: data.projectId ?? null,
        comment: data.comment ?? null,
      },
    });
  }

  /**
   * Get endorsements for a user's skill
   */
  async getSkillEndorsements(userId: string, skill?: string) {
    return this.prisma.freelancerSkillEndorsement.findMany({
      where: {
        userId,
        ...(skill && { skill: skill.toLowerCase() }),
      },
      include: {
        endorsedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get endorsement count by skill for a user
   */
  async getEndorsementCounts(userId: string) {
    const result = await this.prisma.freelancerSkillEndorsement.groupBy({
      by: ['skill'],
      where: { userId },
      _count: { skill: true },
    });

    return result.map((r) => ({
      skill: r.skill,
      count: r._count.skill,
    }));
  }

  /**
   * Check if endorsement exists
   */
  async endorsementExists(userId: string, skill: string, endorserUserId: string) {
    const count = await this.prisma.freelancerSkillEndorsement.count({
      where: {
        userId,
        skill: skill.toLowerCase(),
        endorsedByUserId: endorserUserId,
      },
    });
    return count > 0;
  }

  /**
   * Delete endorsement
   */
  async deleteEndorsement(endorsementId: string, endorserUserId: string) {
    return this.prisma.freelancerSkillEndorsement.deleteMany({
      where: {
        id: endorsementId,
        endorsedByUserId: endorserUserId,
      },
    });
  }

  // ===========================================================================
  // FREELANCER PROFILE OPERATIONS (for matching)
  // ===========================================================================

  /**
   * Get freelancer profile with skills and endorsements
   */
  async getFreelancerProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        skills: {
          include: {
            skill: true,
          },
        },
        trustScore: true,
        ratingAggregation: true,
        skillEndorsementsReceived: {
          include: {
            endorsedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        contractsAsFreelancer: {
          select: {
            id: true,
            status: true,
            completedAt: true,
          },
        },
        contractsAsFreelancerV2: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            clientUserId: true,
          },
        },
      },
    });
  }

  /**
   * Get freelancers for matching (batch query)
   */
  async getFreelancersForMatching(params: {
    skills?: string[];
    excludeUserIds?: string[];
    limit?: number;
    offset?: number;
  }) {
    const { skills, excludeUserIds, limit = 100, offset = 0 } = params;

    const where: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      ...(excludeUserIds &&
        excludeUserIds.length > 0 && {
          id: { notIn: excludeUserIds },
        }),
      ...(skills &&
        skills.length > 0 && {
          skills: {
            some: {
              skill: {
                name: {
                  in: skills.map((s) => s.toLowerCase()),
                  mode: 'insensitive',
                },
              },
            },
          },
        }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        include: {
          profile: true,
          skills: {
            include: {
              skill: true,
            },
          },
          trustScore: true,
          ratingAggregation: true,
          workPattern: true,
          freelancerCompliances: {
            where: {
              verificationStatus: 'VERIFIED',
              OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
            },
          },
          securityClearances: {
            where: {
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
            },
          },
          skillEndorsementsReceived: true,
          contractsAsFreelancerV2: {
            where: {
              status: 'COMPLETED',
            },
            select: {
              id: true,
              status: true,
              completedAt: true,
              clientUserId: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }
}
