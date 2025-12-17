/**
 * @module @skillancer/market-svc/repositories/rate-data
 * Rate Data Point repository for collecting rate intelligence data
 */

import type {
  RateDataPointCreate,
  RateDataPointUpdate,
  UniqueSegment,
  UserBidStats,
} from '../types/rate-intelligence.types.js';
import type { PrismaClient, Prisma, RateSourceType, ExperienceLevel } from '@skillancer/database';

export class RateDataRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new rate data point
   */
  async create(data: RateDataPointCreate) {
    return this.prisma.rateDataPoint.create({
      data: {
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        primarySkill: data.primarySkill,
        secondarySkills: data.secondarySkills,
        skillCategory: data.skillCategory,
        rateType: data.rateType,
        hourlyRate: data.hourlyRate ?? null,
        fixedRate: data.fixedRate ?? null,
        projectDurationDays: data.projectDurationDays ?? null,
        effectiveHourlyRate: data.effectiveHourlyRate ?? null,
        experienceLevel: data.experienceLevel,
        freelancerUserId: data.freelancerUserId,
        clientUserId: data.clientUserId,
        freelancerCountry: data.freelancerCountry ?? null,
        freelancerRegion: data.freelancerRegion ?? null,
        clientCountry: data.clientCountry ?? null,
        wasAccepted: data.wasAccepted,
        projectCompleted: data.projectCompleted ?? null,
        clientRating: data.clientRating ?? null,
        complianceRequired: data.complianceRequired,
        hasCompliancePremium: data.hasCompliancePremium,
        occurredAt: data.occurredAt,
      },
    });
  }

  /**
   * Find a rate data point by source
   */
  async findBySource(sourceType: RateSourceType, sourceId: string) {
    return this.prisma.rateDataPoint.findFirst({
      where: {
        sourceType,
        sourceId,
      },
    });
  }

  /**
   * Update a rate data point
   */
  async update(id: string, data: RateDataPointUpdate) {
    return this.prisma.rateDataPoint.update({
      where: { id },
      data,
    });
  }

  /**
   * Find many rate data points with filters
   */
  async findMany(params: {
    where: Prisma.RateDataPointWhereInput;
    orderBy?: Prisma.RateDataPointOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }) {
    return this.prisma.rateDataPoint.findMany({
      where: params.where,
      orderBy: params.orderBy ?? { occurredAt: 'desc' },
      ...(params.take !== undefined && { take: params.take }),
      ...(params.skip !== undefined && { skip: params.skip }),
    });
  }

  /**
   * Get unique segments for aggregation
   */
  async getUniqueSegments(params: {
    periodStart: Date;
    periodEnd: Date;
    skillCategory?: string;
    region?: string;
  }): Promise<UniqueSegment[]> {
    const whereClause: Prisma.RateDataPointWhereInput = {
      occurredAt: {
        gte: params.periodStart,
        lte: params.periodEnd,
      },
    };

    if (params.skillCategory) {
      whereClause.skillCategory = params.skillCategory;
    }

    if (params.region) {
      whereClause.freelancerRegion = params.region;
    }

    const results = await this.prisma.rateDataPoint.groupBy({
      by: ['skillCategory', 'primarySkill', 'experienceLevel', 'freelancerRegion'],
      where: whereClause,
      _count: { id: true },
      having: {
        id: {
          _count: {
            gte: 5, // Minimum sample size
          },
        },
      },
    });

    return results.map((r) => ({
      skillCategory: r.skillCategory,
      primarySkill: r.primarySkill,
      experienceLevel: r.experienceLevel,
      region: r.freelancerRegion ?? 'GLOBAL',
    }));
  }

  /**
   * Get unique skills in a period
   */
  async getUniqueSkills(params: {
    skillCategory?: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<string[]> {
    const whereClause: Prisma.RateDataPointWhereInput = {
      occurredAt: {
        gte: params.periodStart,
        lte: params.periodEnd,
      },
    };

    if (params.skillCategory) {
      whereClause.skillCategory = params.skillCategory;
    }

    const results = await this.prisma.rateDataPoint.groupBy({
      by: ['primarySkill'],
      where: whereClause,
    });

    return results.map((r) => r.primarySkill);
  }

  /**
   * Get freelancer rates for a specific skill
   */
  async getFreelancerRatesForSkill(
    skill: string,
    options?: { limit?: number }
  ): Promise<Array<{ freelancerUserId: string; hourlyRate: number }>> {
    const results = await this.prisma.rateDataPoint.findMany({
      where: {
        primarySkill: skill,
        wasAccepted: true,
        effectiveHourlyRate: { not: null },
        occurredAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      select: {
        freelancerUserId: true,
        effectiveHourlyRate: true,
      },
      distinct: ['freelancerUserId'],
      take: options?.limit ?? 1000,
    });

    return results.map((r) => ({
      freelancerUserId: r.freelancerUserId,
      hourlyRate: Number(r.effectiveHourlyRate),
    }));
  }

  /**
   * Get user bid statistics for a skill
   */
  async getUserBidStats(userId: string, skill: string): Promise<UserBidStats> {
    const [total, accepted] = await Promise.all([
      this.prisma.rateDataPoint.count({
        where: {
          freelancerUserId: userId,
          primarySkill: skill,
          sourceType: 'BID',
        },
      }),
      this.prisma.rateDataPoint.count({
        where: {
          freelancerUserId: userId,
          primarySkill: skill,
          sourceType: 'BID',
          wasAccepted: true,
        },
      }),
    ]);

    return {
      totalBids: total,
      acceptedBids: accepted,
    };
  }

  /**
   * Get average rate for a skill with optional compliance filter
   */
  async getAverageRate(
    skill: string,
    options?: { hasCompliance?: boolean }
  ): Promise<number | null> {
    const whereClause: Prisma.RateDataPointWhereInput = {
      primarySkill: skill,
      wasAccepted: true,
      effectiveHourlyRate: { not: null },
      occurredAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    };

    if (options?.hasCompliance !== undefined) {
      whereClause.hasCompliancePremium = options.hasCompliance;
    }

    const result = await this.prisma.rateDataPoint.aggregate({
      where: whereClause,
      _avg: {
        effectiveHourlyRate: true,
      },
      _count: {
        id: true,
      },
    });

    if (result._count.id < 5) {
      return null;
    }

    return result._avg.effectiveHourlyRate ? Number(result._avg.effectiveHourlyRate) : null;
  }

  /**
   * Get rate data for aggregation
   */
  async getDataForAggregation(params: {
    skillCategory: string;
    primarySkill?: string | null;
    experienceLevel: ExperienceLevel;
    region: string;
    periodStart: Date;
    periodEnd: Date;
  }) {
    const where: Prisma.RateDataPointWhereInput = {
      skillCategory: params.skillCategory,
      experienceLevel: params.experienceLevel,
      occurredAt: {
        gte: params.periodStart,
        lte: params.periodEnd,
      },
    };

    if (params.primarySkill !== undefined && params.primarySkill !== null) {
      where.primarySkill = params.primarySkill;
    }
    if (params.region !== 'GLOBAL') {
      where.freelancerRegion = params.region;
    }

    return this.prisma.rateDataPoint.findMany({ where });
  }
}
