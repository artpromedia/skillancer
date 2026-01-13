/**
 * @module @skillancer/market-svc/repositories/rate-aggregate
 * Rate Aggregate repository for storing computed rate statistics
 */

import type { RateAggregateQuery, RateAggregateData } from '../types/rate-intelligence.types.js';
import type {
  PrismaClient,
  Prisma,
  ExperienceLevel,
  PeriodType,
  RateAggregate,
} from '../types/prisma-shim.js';

/**
 * Build optional rate fields for create/update operations
 */
function buildOptionalRateFields(
  data: RateAggregateData
): Partial<Prisma.RateAggregateCreateInput> {
  return {
    ...(data.fixedRateMin !== undefined && { fixedRateMin: data.fixedRateMin }),
    ...(data.fixedRateMax !== undefined && { fixedRateMax: data.fixedRateMax }),
    ...(data.fixedRateAvg !== undefined && { fixedRateAvg: data.fixedRateAvg }),
    ...(data.fixedRateMedian !== undefined && { fixedRateMedian: data.fixedRateMedian }),
    ...(data.acceptanceRateLow !== undefined && { acceptanceRateLow: data.acceptanceRateLow }),
    ...(data.acceptanceRateMid !== undefined && { acceptanceRateMid: data.acceptanceRateMid }),
    ...(data.acceptanceRateHigh !== undefined && { acceptanceRateHigh: data.acceptanceRateHigh }),
    ...(data.avgRatingLowPrice !== undefined && { avgRatingLowPrice: data.avgRatingLowPrice }),
    ...(data.avgRatingMidPrice !== undefined && { avgRatingMidPrice: data.avgRatingMidPrice }),
    ...(data.avgRatingHighPrice !== undefined && { avgRatingHighPrice: data.avgRatingHighPrice }),
    ...(data.compliancePremiumPct !== undefined && {
      compliancePremiumPct: data.compliancePremiumPct,
    }),
    ...(data.rateChangeFromPrevious !== undefined && {
      rateChangeFromPrevious: data.rateChangeFromPrevious,
    }),
  };
}

/**
 * Build core rate fields for both create and update
 */
function buildCoreRateFields(data: RateAggregateData) {
  return {
    sampleSize: data.sampleSize,
    acceptedCount: data.acceptedCount,
    completedCount: data.completedCount,
    hourlyRateMin: data.hourlyRateMin,
    hourlyRateMax: data.hourlyRateMax,
    hourlyRateAvg: data.hourlyRateAvg,
    hourlyRateMedian: data.hourlyRateMedian,
    hourlyRateStdDev: data.hourlyRateStdDev,
    hourlyRateP10: data.hourlyRateP10,
    hourlyRateP25: data.hourlyRateP25,
    hourlyRateP75: data.hourlyRateP75,
    hourlyRateP90: data.hourlyRateP90,
  };
}

export class RateAggregateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find the latest aggregate matching the query
   */
  async findLatest(query: RateAggregateQuery): Promise<RateAggregate | null> {
    return this.prisma.rateAggregate.findFirst({
      where: {
        skillCategory: query.skillCategory,
        primarySkill: query.primarySkill ?? null,
        experienceLevel: query.experienceLevel,
        region: query.region,
        periodType: query.periodType,
      },
      orderBy: {
        periodStart: 'desc',
      },
    });
  }

  /**
   * Find the previous period's aggregate
   */
  async findPrevious(current: {
    skillCategory: string;
    primarySkill?: string | null;
    experienceLevel: ExperienceLevel;
    region: string;
    periodType: PeriodType;
    periodStart: Date;
  }): Promise<RateAggregate | null> {
    return this.prisma.rateAggregate.findFirst({
      where: {
        skillCategory: current.skillCategory,
        primarySkill: current.primarySkill ?? null,
        experienceLevel: current.experienceLevel,
        region: current.region,
        periodType: current.periodType,
        periodStart: {
          lt: current.periodStart,
        },
      },
      orderBy: {
        periodStart: 'desc',
      },
    });
  }

  /**
   * Upsert a rate aggregate
   */
  async upsert(data: RateAggregateData): Promise<RateAggregate> {
    const where: Prisma.RateAggregateWhereUniqueInput = {
      skillCategory_primarySkill_experienceLevel_region_periodType_periodStart: {
        skillCategory: data.skillCategory,
        primarySkill: data.primarySkill ?? '',
        experienceLevel: data.experienceLevel,
        region: data.region,
        periodType: data.periodType,
        periodStart: data.periodStart,
      },
    };

    const coreFields = buildCoreRateFields(data);
    const optionalFields = buildOptionalRateFields(data);

    const createData: Prisma.RateAggregateCreateInput = {
      skillCategory: data.skillCategory,
      primarySkill: data.primarySkill,
      experienceLevel: data.experienceLevel,
      region: data.region,
      periodType: data.periodType,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      ...coreFields,
      ...optionalFields,
    };

    const updateData: Prisma.RateAggregateUpdateInput = {
      periodEnd: data.periodEnd,
      ...coreFields,
      ...optionalFields,
    };

    return this.prisma.rateAggregate.upsert({
      where,
      create: createData,
      update: updateData,
    });
  }

  /**
   * Get historical aggregates for a skill
   */
  async getHistory(params: {
    skill: string;
    experienceLevel?: ExperienceLevel;
    region?: string;
    periodType: PeriodType;
    limit?: number;
  }): Promise<RateAggregate[]> {
    const where: Prisma.RateAggregateWhereInput = {
      primarySkill: params.skill,
      region: params.region ?? 'GLOBAL',
      periodType: params.periodType,
    };

    if (params.experienceLevel !== undefined) {
      where.experienceLevel = params.experienceLevel;
    }

    return this.prisma.rateAggregate.findMany({
      where,
      orderBy: {
        periodStart: 'desc',
      },
      take: params.limit ?? 12,
    });
  }

  /**
   * Get all aggregates for a period type
   */
  async getByPeriodType(
    periodType: PeriodType,
    options?: { limit?: number }
  ): Promise<RateAggregate[]> {
    return this.prisma.rateAggregate.findMany({
      where: {
        periodType,
      },
      orderBy: {
        periodStart: 'desc',
      },
      take: options?.limit ?? 100,
    });
  }
}
