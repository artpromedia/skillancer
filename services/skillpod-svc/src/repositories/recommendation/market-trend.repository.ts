// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/repositories/recommendation/market-trend
 * Market Trend repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { PrismaClient, MarketTrend, Prisma } from '@/types/prisma-shim.js';
import type { TrendDirection, TrendPeriod, CompetitionLevel } from '@skillancer/types';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketTrendWithRelations extends MarketTrend {
  skill?: {
    id: string;
    name: string;
    slug: string;
    category: string;
  };
}

export interface CreateMarketTrendInput {
  skillId: string;
  trendPeriod: TrendPeriod;
  periodStart: Date;
  periodEnd: Date;
  demandScore: number;
  demandDirection: TrendDirection;
  demandChangePercent?: number;
  jobPostingCount?: number;
  applicationCount?: number;
  averageRate?: number;
  rateDirection?: TrendDirection;
  rateChangePercent?: number;
  ratePercentile25?: number;
  ratePercentile50?: number;
  ratePercentile75?: number;
  competitionLevel?: CompetitionLevel;
  freelancerSupply?: number;
  supplyDemandRatio?: number;
  region?: string;
  topLocations?: string[];
  industry?: string;
  topIndustries?: string[];
  emergingCombinations?: string[];
  decliningCombinations?: string[];
  predictedDemand6Mo?: number;
  predictedDemand12Mo?: number;
  predictionConfidence?: number;
  dataPoints?: number;
  dataSources?: string[];
}

export interface UpdateMarketTrendInput {
  demandScore?: number;
  demandDirection?: TrendDirection;
  demandChangePercent?: number;
  jobPostingCount?: number;
  applicationCount?: number;
  averageRate?: number;
  rateDirection?: TrendDirection;
  rateChangePercent?: number;
  ratePercentile25?: number;
  ratePercentile50?: number;
  ratePercentile75?: number;
  competitionLevel?: CompetitionLevel;
  freelancerSupply?: number;
  supplyDemandRatio?: number;
  topLocations?: string[];
  topIndustries?: string[];
  emergingCombinations?: string[];
  decliningCombinations?: string[];
  predictedDemand6Mo?: number;
  predictedDemand12Mo?: number;
  predictionConfidence?: number;
  dataPoints?: number;
  dataSources?: string[];
  calculatedAt?: Date;
}

export interface MarketTrendListFilter {
  skillId?: string;
  skillIds?: string[];
  trendPeriod?: TrendPeriod;
  demandDirection?: TrendDirection | TrendDirection[];
  rateDirection?: TrendDirection | TrendDirection[];
  minDemandScore?: number;
  maxDemandScore?: number;
  competitionLevel?: CompetitionLevel | CompetitionLevel[];
  region?: string;
  industry?: string;
  periodStartAfter?: Date;
  periodStartBefore?: Date;
  isGlobal?: boolean;
}

export interface MarketTrendListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'demandScore' | 'demandChangePercent' | 'averageRate' | 'calculatedAt' | 'periodStart';
  orderDirection?: 'asc' | 'desc';
  includeSkill?: boolean;
}

export interface TrendSummary {
  skillId: string;
  skillName?: string;
  latestDemandScore: number;
  demandTrend: TrendDirection;
  averageRate: number | null;
  rateTrend: TrendDirection | null;
  competitionLevel: CompetitionLevel;
  predictedGrowth: number | null;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface MarketTrendRepository {
  create(input: CreateMarketTrendInput): Promise<MarketTrend>;
  createMany(inputs: CreateMarketTrendInput[]): Promise<number>;
  findById(id: string): Promise<MarketTrendWithRelations | null>;
  findLatestForSkill(
    skillId: string,
    period?: TrendPeriod
  ): Promise<MarketTrendWithRelations | null>;
  findMany(
    filter: MarketTrendListFilter,
    options?: MarketTrendListOptions
  ): Promise<{
    trends: MarketTrendWithRelations[];
    total: number;
  }>;
  findTrendingSkills(limit?: number, period?: TrendPeriod): Promise<MarketTrendWithRelations[]>;
  findDecliningSkills(limit?: number, period?: TrendPeriod): Promise<MarketTrendWithRelations[]>;
  findHighDemandSkills(minDemandScore: number, limit?: number): Promise<MarketTrendWithRelations[]>;
  getHistoryForSkill(skillId: string, period: TrendPeriod, limit?: number): Promise<MarketTrend[]>;
  update(id: string, input: UpdateMarketTrendInput): Promise<MarketTrend>;
  upsert(input: CreateMarketTrendInput): Promise<MarketTrend>;
  delete(id: string): Promise<void>;
  deleteOlderThan(date: Date): Promise<number>;
  getSummariesForSkills(skillIds: string[]): Promise<TrendSummary[]>;
  getRegionalComparison(skillId: string, period?: TrendPeriod): Promise<MarketTrend[]>;
  getIndustryComparison(skillId: string, period?: TrendPeriod): Promise<MarketTrend[]>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createMarketTrendRepository(prisma: PrismaClient): MarketTrendRepository {
  async function create(input: CreateMarketTrendInput): Promise<MarketTrend> {
    return prisma.marketTrend.create({
      data: {
        skillId: input.skillId,
        trendPeriod: input.trendPeriod,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        demandScore: input.demandScore,
        demandDirection: input.demandDirection,
        demandChangePercent: input.demandChangePercent ?? 0,
        jobPostingCount: input.jobPostingCount ?? 0,
        applicationCount: input.applicationCount ?? 0,
        averageRate: input.averageRate,
        rateDirection: input.rateDirection,
        rateChangePercent: input.rateChangePercent ?? 0,
        ratePercentile25: input.ratePercentile25,
        ratePercentile50: input.ratePercentile50,
        ratePercentile75: input.ratePercentile75,
        competitionLevel: input.competitionLevel ?? 'MEDIUM',
        freelancerSupply: input.freelancerSupply ?? 0,
        supplyDemandRatio: input.supplyDemandRatio,
        region: input.region,
        topLocations: input.topLocations ?? [],
        industry: input.industry,
        topIndustries: input.topIndustries ?? [],
        emergingCombinations: input.emergingCombinations ?? [],
        decliningCombinations: input.decliningCombinations ?? [],
        predictedDemand6Mo: input.predictedDemand6Mo,
        predictedDemand12Mo: input.predictedDemand12Mo,
        predictionConfidence: input.predictionConfidence,
        dataPoints: input.dataPoints ?? 0,
        dataSources: input.dataSources ?? [],
      },
    });
  }

  async function createMany(inputs: CreateMarketTrendInput[]): Promise<number> {
    const result = await prisma.marketTrend.createMany({
      data: inputs.map((input) => ({
        skillId: input.skillId,
        trendPeriod: input.trendPeriod,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        demandScore: input.demandScore,
        demandDirection: input.demandDirection,
        demandChangePercent: input.demandChangePercent ?? 0,
        jobPostingCount: input.jobPostingCount ?? 0,
        applicationCount: input.applicationCount ?? 0,
        averageRate: input.averageRate,
        rateDirection: input.rateDirection,
        rateChangePercent: input.rateChangePercent ?? 0,
        ratePercentile25: input.ratePercentile25,
        ratePercentile50: input.ratePercentile50,
        ratePercentile75: input.ratePercentile75,
        competitionLevel: input.competitionLevel ?? 'MEDIUM',
        freelancerSupply: input.freelancerSupply ?? 0,
        supplyDemandRatio: input.supplyDemandRatio,
        region: input.region,
        topLocations: input.topLocations ?? [],
        industry: input.industry,
        topIndustries: input.topIndustries ?? [],
        emergingCombinations: input.emergingCombinations ?? [],
        decliningCombinations: input.decliningCombinations ?? [],
        predictedDemand6Mo: input.predictedDemand6Mo,
        predictedDemand12Mo: input.predictedDemand12Mo,
        predictionConfidence: input.predictionConfidence,
        dataPoints: input.dataPoints ?? 0,
        dataSources: input.dataSources ?? [],
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async function findById(id: string): Promise<MarketTrendWithRelations | null> {
    return prisma.marketTrend.findUnique({
      where: { id },
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
      },
    });
  }

  async function findLatestForSkill(
    skillId: string,
    period: TrendPeriod = 'MONTHLY'
  ): Promise<MarketTrendWithRelations | null> {
    return prisma.marketTrend.findFirst({
      where: {
        skillId,
        trendPeriod: period,
        region: null, // Global
        industry: null, // All industries
      },
      orderBy: { periodStart: 'desc' },
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
      },
    });
  }

  async function findMany(
    filter: MarketTrendListFilter,
    options: MarketTrendListOptions = {}
  ): Promise<{
    trends: MarketTrendWithRelations[];
    total: number;
  }> {
    const { page = 1, limit = 50, orderBy = 'demandScore', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.MarketTrendWhereInput = {};

    if (filter.skillId) where.skillId = filter.skillId;
    if (filter.skillIds?.length) where.skillId = { in: filter.skillIds };
    if (filter.trendPeriod) where.trendPeriod = filter.trendPeriod;
    if (filter.demandDirection) {
      where.demandDirection = Array.isArray(filter.demandDirection)
        ? { in: filter.demandDirection }
        : filter.demandDirection;
    }
    if (filter.rateDirection) {
      where.rateDirection = Array.isArray(filter.rateDirection)
        ? { in: filter.rateDirection }
        : filter.rateDirection;
    }
    if (filter.minDemandScore !== undefined || filter.maxDemandScore !== undefined) {
      where.demandScore = {};
      if (filter.minDemandScore !== undefined) where.demandScore.gte = filter.minDemandScore;
      if (filter.maxDemandScore !== undefined) where.demandScore.lte = filter.maxDemandScore;
    }
    if (filter.competitionLevel) {
      where.competitionLevel = Array.isArray(filter.competitionLevel)
        ? { in: filter.competitionLevel }
        : filter.competitionLevel;
    }
    if (filter.region !== undefined) where.region = filter.region;
    if (filter.industry !== undefined) where.industry = filter.industry;
    if (filter.periodStartAfter || filter.periodStartBefore) {
      where.periodStart = {};
      if (filter.periodStartAfter) where.periodStart.gte = filter.periodStartAfter;
      if (filter.periodStartBefore) where.periodStart.lte = filter.periodStartBefore;
    }
    if (filter.isGlobal) {
      where.region = null;
      where.industry = null;
    }

    const [trends, total] = await Promise.all([
      prisma.marketTrend.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: orderDirection },
        include: options.includeSkill
          ? {
              skill: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  category: true,
                },
              },
            }
          : undefined,
      }),
      prisma.marketTrend.count({ where }),
    ]);

    return { trends, total };
  }

  async function findTrendingSkills(
    limit = 20,
    period: TrendPeriod = 'MONTHLY'
  ): Promise<MarketTrendWithRelations[]> {
    return prisma.marketTrend.findMany({
      where: {
        trendPeriod: period,
        demandDirection: 'RISING',
        region: null,
        industry: null,
      },
      orderBy: [{ demandChangePercent: 'desc' }, { demandScore: 'desc' }],
      take: limit,
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
      },
    });
  }

  async function findDecliningSkills(
    limit = 20,
    period: TrendPeriod = 'MONTHLY'
  ): Promise<MarketTrendWithRelations[]> {
    return prisma.marketTrend.findMany({
      where: {
        trendPeriod: period,
        demandDirection: 'DECLINING',
        region: null,
        industry: null,
      },
      orderBy: [{ demandChangePercent: 'asc' }, { demandScore: 'asc' }],
      take: limit,
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
      },
    });
  }

  async function findHighDemandSkills(
    minDemandScore: number,
    limit = 20
  ): Promise<MarketTrendWithRelations[]> {
    return prisma.marketTrend.findMany({
      where: {
        demandScore: { gte: minDemandScore },
        trendPeriod: 'MONTHLY',
        region: null,
        industry: null,
      },
      orderBy: { demandScore: 'desc' },
      take: limit,
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
      },
    });
  }

  async function getHistoryForSkill(
    skillId: string,
    period: TrendPeriod,
    limit = 12
  ): Promise<MarketTrend[]> {
    return prisma.marketTrend.findMany({
      where: {
        skillId,
        trendPeriod: period,
        region: null,
        industry: null,
      },
      orderBy: { periodStart: 'desc' },
      take: limit,
    });
  }

  async function update(id: string, input: UpdateMarketTrendInput): Promise<MarketTrend> {
    return prisma.marketTrend.update({
      where: { id },
      data: {
        ...input,
        calculatedAt: new Date(),
      },
    });
  }

  async function upsert(input: CreateMarketTrendInput): Promise<MarketTrend> {
    return prisma.marketTrend.upsert({
      where: {
        skillId_trendPeriod_periodStart_region_industry: {
          skillId: input.skillId,
          trendPeriod: input.trendPeriod,
          periodStart: input.periodStart,
          region: input.region ?? null,
          industry: input.industry ?? null,
        },
      },
      create: {
        skillId: input.skillId,
        trendPeriod: input.trendPeriod,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        demandScore: input.demandScore,
        demandDirection: input.demandDirection,
        demandChangePercent: input.demandChangePercent ?? 0,
        jobPostingCount: input.jobPostingCount ?? 0,
        applicationCount: input.applicationCount ?? 0,
        averageRate: input.averageRate,
        rateDirection: input.rateDirection,
        rateChangePercent: input.rateChangePercent ?? 0,
        ratePercentile25: input.ratePercentile25,
        ratePercentile50: input.ratePercentile50,
        ratePercentile75: input.ratePercentile75,
        competitionLevel: input.competitionLevel ?? 'MEDIUM',
        freelancerSupply: input.freelancerSupply ?? 0,
        supplyDemandRatio: input.supplyDemandRatio,
        region: input.region,
        topLocations: input.topLocations ?? [],
        industry: input.industry,
        topIndustries: input.topIndustries ?? [],
        emergingCombinations: input.emergingCombinations ?? [],
        decliningCombinations: input.decliningCombinations ?? [],
        predictedDemand6Mo: input.predictedDemand6Mo,
        predictedDemand12Mo: input.predictedDemand12Mo,
        predictionConfidence: input.predictionConfidence,
        dataPoints: input.dataPoints ?? 0,
        dataSources: input.dataSources ?? [],
      },
      update: {
        periodEnd: input.periodEnd,
        demandScore: input.demandScore,
        demandDirection: input.demandDirection,
        demandChangePercent: input.demandChangePercent,
        jobPostingCount: input.jobPostingCount,
        applicationCount: input.applicationCount,
        averageRate: input.averageRate,
        rateDirection: input.rateDirection,
        rateChangePercent: input.rateChangePercent,
        ratePercentile25: input.ratePercentile25,
        ratePercentile50: input.ratePercentile50,
        ratePercentile75: input.ratePercentile75,
        competitionLevel: input.competitionLevel,
        freelancerSupply: input.freelancerSupply,
        supplyDemandRatio: input.supplyDemandRatio,
        topLocations: input.topLocations,
        topIndustries: input.topIndustries,
        emergingCombinations: input.emergingCombinations,
        decliningCombinations: input.decliningCombinations,
        predictedDemand6Mo: input.predictedDemand6Mo,
        predictedDemand12Mo: input.predictedDemand12Mo,
        predictionConfidence: input.predictionConfidence,
        dataPoints: input.dataPoints,
        dataSources: input.dataSources,
        calculatedAt: new Date(),
      },
    });
  }

  async function deleteTrend(id: string): Promise<void> {
    await prisma.marketTrend.delete({ where: { id } });
  }

  async function deleteOlderThan(date: Date): Promise<number> {
    const result = await prisma.marketTrend.deleteMany({
      where: { periodEnd: { lt: date } },
    });
    return result.count;
  }

  async function getSummariesForSkills(skillIds: string[]): Promise<TrendSummary[]> {
    const trends = await prisma.marketTrend.findMany({
      where: {
        skillId: { in: skillIds },
        trendPeriod: 'MONTHLY',
        region: null,
        industry: null,
      },
      orderBy: { periodStart: 'desc' },
      distinct: ['skillId'],
      include: {
        skill: {
          select: { name: true },
        },
      },
    });

    return trends.map((t) => ({
      skillId: t.skillId,
      skillName: t.skill?.name,
      latestDemandScore: t.demandScore,
      demandTrend: t.demandDirection as TrendDirection,
      averageRate: t.averageRate,
      rateTrend: t.rateDirection as TrendDirection | null,
      competitionLevel: t.competitionLevel as CompetitionLevel,
      predictedGrowth: t.predictedDemand6Mo,
    }));
  }

  async function getRegionalComparison(
    skillId: string,
    period: TrendPeriod = 'MONTHLY'
  ): Promise<MarketTrend[]> {
    return prisma.marketTrend.findMany({
      where: {
        skillId,
        trendPeriod: period,
        region: { not: null },
        industry: null,
      },
      orderBy: { demandScore: 'desc' },
    });
  }

  async function getIndustryComparison(
    skillId: string,
    period: TrendPeriod = 'MONTHLY'
  ): Promise<MarketTrend[]> {
    return prisma.marketTrend.findMany({
      where: {
        skillId,
        trendPeriod: period,
        region: null,
        industry: { not: null },
      },
      orderBy: { demandScore: 'desc' },
    });
  }

  return {
    create,
    createMany,
    findById,
    findLatestForSkill,
    findMany,
    findTrendingSkills,
    findDecliningSkills,
    findHighDemandSkills,
    getHistoryForSkill,
    update,
    upsert,
    delete: deleteTrend,
    deleteOlderThan,
    getSummariesForSkills,
    getRegionalComparison,
    getIndustryComparison,
  };
}
