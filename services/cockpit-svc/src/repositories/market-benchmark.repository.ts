// @ts-nocheck
/**
 * Market Rate Benchmark Repository
 *
 * Repository for managing market rate benchmarks from various sources.
 */

import {
  type PrismaClient,
  Prisma,
  type MarketRateBenchmark,
  type TrendDirection,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import type { BenchmarkCreateInput } from '@skillancer/types/cockpit';

export class MarketRateBenchmarkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create or update a market benchmark
   */
  async upsert(data: BenchmarkCreateInput): Promise<MarketRateBenchmark> {
    try {
      return await this.prisma.marketRateBenchmark.upsert({
        where: {
          skillId_region_periodStart: {
            skillId: data.skillId,
            region: data.region || 'GLOBAL',
            periodStart: data.periodStart,
          },
        },
        create: {
          skillId: data.skillId,
          skillName: data.skillName,
          category: data.category,
          region: data.region || 'GLOBAL',
          rateP10: new Prisma.Decimal(data.rateP10),
          rateP25: new Prisma.Decimal(data.rateP25),
          rateP50: new Prisma.Decimal(data.rateP50),
          rateP75: new Prisma.Decimal(data.rateP75),
          rateP90: new Prisma.Decimal(data.rateP90),
          rateMean: new Prisma.Decimal(data.rateMean),
          beginnerRate: data.beginnerRate ? new Prisma.Decimal(data.beginnerRate) : null,
          intermediateRate: data.intermediateRate
            ? new Prisma.Decimal(data.intermediateRate)
            : null,
          advancedRate: data.advancedRate ? new Prisma.Decimal(data.advancedRate) : null,
          expertRate: data.expertRate ? new Prisma.Decimal(data.expertRate) : null,
          sampleSize: data.sampleSize,
          jobCount: data.jobCount,
          freelancerCount: data.freelancerCount,
          demandScore: new Prisma.Decimal(data.demandScore),
          rateChangeMonthly: data.rateChangeMonthly
            ? new Prisma.Decimal(data.rateChangeMonthly)
            : null,
          rateChangeYearly: data.rateChangeYearly
            ? new Prisma.Decimal(data.rateChangeYearly)
            : null,
          trendDirection: data.trendDirection || 'STABLE',
          sources: data.sources,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          generatedAt: data.generatedAt,
        },
        update: {
          skillName: data.skillName,
          category: data.category,
          rateP10: new Prisma.Decimal(data.rateP10),
          rateP25: new Prisma.Decimal(data.rateP25),
          rateP50: new Prisma.Decimal(data.rateP50),
          rateP75: new Prisma.Decimal(data.rateP75),
          rateP90: new Prisma.Decimal(data.rateP90),
          rateMean: new Prisma.Decimal(data.rateMean),
          beginnerRate: data.beginnerRate ? new Prisma.Decimal(data.beginnerRate) : null,
          intermediateRate: data.intermediateRate
            ? new Prisma.Decimal(data.intermediateRate)
            : null,
          advancedRate: data.advancedRate ? new Prisma.Decimal(data.advancedRate) : null,
          expertRate: data.expertRate ? new Prisma.Decimal(data.expertRate) : null,
          sampleSize: data.sampleSize,
          jobCount: data.jobCount,
          freelancerCount: data.freelancerCount,
          demandScore: new Prisma.Decimal(data.demandScore),
          rateChangeMonthly: data.rateChangeMonthly
            ? new Prisma.Decimal(data.rateChangeMonthly)
            : null,
          rateChangeYearly: data.rateChangeYearly
            ? new Prisma.Decimal(data.rateChangeYearly)
            : null,
          trendDirection: data.trendDirection || 'STABLE',
          sources: data.sources,
          periodEnd: data.periodEnd,
          generatedAt: data.generatedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to upsert market benchmark', { error, data });
      throw error;
    }
  }

  /**
   * Find the latest benchmark for a skill and region
   */
  async findLatest(
    skillId: string,
    region: string = 'GLOBAL'
  ): Promise<MarketRateBenchmark | null> {
    try {
      return await this.prisma.marketRateBenchmark.findFirst({
        where: {
          skillId,
          region,
        },
        orderBy: { periodStart: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find latest benchmark', { error, skillId, region });
      throw error;
    }
  }

  /**
   * Find the previous benchmark (for trend calculation)
   */
  async findPrevious(
    skillId: string,
    region: string = 'GLOBAL'
  ): Promise<MarketRateBenchmark | null> {
    try {
      const benchmarks = await this.prisma.marketRateBenchmark.findMany({
        where: {
          skillId,
          region,
        },
        orderBy: { periodStart: 'desc' },
        take: 2,
      });
      return benchmarks[1] ?? null;
    } catch (error) {
      logger.error('Failed to find previous benchmark', { error, skillId, region });
      throw error;
    }
  }

  /**
   * Find benchmark by ID
   */
  async findById(id: string): Promise<MarketRateBenchmark | null> {
    try {
      return await this.prisma.marketRateBenchmark.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to find benchmark by id', { error, id });
      throw error;
    }
  }

  /**
   * Find benchmarks by category
   */
  async findByCategory(category: string, region?: string): Promise<MarketRateBenchmark[]> {
    try {
      const where: Prisma.MarketRateBenchmarkWhereInput = { category };
      if (region) {
        where.region = region;
      }

      return await this.prisma.marketRateBenchmark.findMany({
        where,
        orderBy: { demandScore: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find benchmarks by category', { error, category, region });
      throw error;
    }
  }

  /**
   * Find high-demand skills
   */
  async findHighDemand(
    threshold: number = 70,
    region?: string,
    limit: number = 20
  ): Promise<MarketRateBenchmark[]> {
    try {
      const where: Prisma.MarketRateBenchmarkWhereInput = {
        demandScore: { gte: threshold },
      };
      if (region) {
        where.region = region;
      }

      return await this.prisma.marketRateBenchmark.findMany({
        where,
        orderBy: { demandScore: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to find high demand benchmarks', { error, threshold, region });
      throw error;
    }
  }

  /**
   * Find trending skills
   */
  async findTrending(
    direction: TrendDirection = 'RISING',
    region?: string,
    limit: number = 20
  ): Promise<MarketRateBenchmark[]> {
    try {
      const where: Prisma.MarketRateBenchmarkWhereInput = {
        trendDirection: direction,
      };
      if (region) {
        where.region = region;
      }

      return await this.prisma.marketRateBenchmark.findMany({
        where,
        orderBy: { rateChangeMonthly: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to find trending benchmarks', { error, direction, region });
      throw error;
    }
  }

  /**
   * Get benchmark history for a skill
   */
  async getHistory(
    skillId: string,
    region: string = 'GLOBAL',
    months: number = 12
  ): Promise<MarketRateBenchmark[]> {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      return await this.prisma.marketRateBenchmark.findMany({
        where: {
          skillId,
          region,
          periodStart: { gte: startDate },
        },
        orderBy: { periodStart: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to get benchmark history', { error, skillId, region, months });
      throw error;
    }
  }

  /**
   * Get all unique skill IDs with benchmarks
   */
  async getUniqueSkillIds(): Promise<string[]> {
    try {
      const result = await this.prisma.marketRateBenchmark.findMany({
        distinct: ['skillId'],
        select: { skillId: true },
      });
      return result.map((r) => r.skillId);
    } catch (error) {
      logger.error('Failed to get unique skill ids', { error });
      throw error;
    }
  }

  /**
   * Get stale benchmarks (older than specified days)
   */
  async findStale(staleDays: number = 30, limit: number = 100): Promise<MarketRateBenchmark[]> {
    try {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - staleDays);

      return await this.prisma.marketRateBenchmark.findMany({
        where: {
          generatedAt: { lt: staleDate },
        },
        orderBy: { generatedAt: 'asc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to find stale benchmarks', { error, staleDays });
      throw error;
    }
  }

  /**
   * Delete old benchmarks
   */
  async deleteOld(olderThan: Date): Promise<number> {
    try {
      const result = await this.prisma.marketRateBenchmark.deleteMany({
        where: {
          periodStart: { lt: olderThan },
        },
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete old benchmarks', { error, olderThan });
      throw error;
    }
  }
}

