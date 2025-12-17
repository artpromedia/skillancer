/**
 * @module @skillancer/market-svc/workers/rate-aggregation
 * Rate Aggregation Worker - Periodically aggregates rate data
 */

import type { DemandTrendRepository } from '../repositories/demand-trend.repository.js';
import type { RateAggregateRepository } from '../repositories/rate-aggregate.repository.js';
import type { RateDataRepository } from '../repositories/rate-data.repository.js';
import type {
  PrismaClient,
  PeriodType,
  DemandLevel,
  RateDataPoint,
  ExperienceLevel,
} from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

const SKILL_CATEGORIES: Record<string, string[]> = {
  DEVELOPMENT: ['javascript', 'react', 'python', 'java', 'node.js', 'typescript'],
  DESIGN: ['ui design', 'ux design', 'graphic design', 'figma'],
  DATA: ['data science', 'machine learning', 'sql', 'tableau'],
  MARKETING: ['seo', 'social media', 'content marketing'],
  WRITING: ['copywriting', 'content writing', 'technical writing'],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getSkillCategory(skill: string): string {
  const normalized = skill.toLowerCase();
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    if (skills.some((s) => normalized.includes(s))) {
      return category;
    }
  }
  return 'OTHER';
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  const lowerVal = sorted[lower] ?? 0;
  const upperVal = sorted[upper] ?? lowerVal;

  if (lower === upper) {
    return lowerVal;
  }

  return Math.round((lowerVal * (1 - fraction) + upperVal * fraction) * 100) / 100;
}

function calculateStatistics(values: number[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
  stdDev: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
} {
  const n = values.length;
  if (n === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, stdDev: 0, p10: 0, p25: 0, p75: 0, p90: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);

  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / n;

  const squaredDiffs = sorted.map((v) => Math.pow(v - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    min: sorted[0] ?? 0,
    max: sorted[n - 1] ?? 0,
    avg: Math.round(avg * 100) / 100,
    median: calculatePercentile(sorted, 50),
    stdDev: Math.round(stdDev * 100) / 100,
    p10: calculatePercentile(sorted, 10),
    p25: calculatePercentile(sorted, 25),
    p75: calculatePercentile(sorted, 75),
    p90: calculatePercentile(sorted, 90),
  };
}

function determineDemandLevel(
  demandSupplyRatio: number,
  avgBidsPerProject: number,
  projectCount: number
): DemandLevel {
  // Low project count = insufficient data
  if (projectCount < 10) return 'MODERATE';

  // High demand/supply ratio + low bids = VERY_HIGH demand
  if (demandSupplyRatio > 2 && avgBidsPerProject < 10) return 'VERY_HIGH';
  if (demandSupplyRatio > 1.5 && avgBidsPerProject < 15) return 'HIGH';
  if (demandSupplyRatio > 0.8 && avgBidsPerProject < 25) return 'MODERATE';
  if (demandSupplyRatio > 0.5) return 'LOW';
  return 'VERY_LOW';
}

function getPeriodBounds(periodType: PeriodType): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);

  const periodStart = new Date(now);

  switch (periodType) {
    case 'DAILY':
      periodStart.setDate(periodStart.getDate() - 1);
      break;
    case 'WEEKLY':
      periodStart.setDate(periodStart.getDate() - 7);
      break;
    case 'MONTHLY':
      periodStart.setMonth(periodStart.getMonth() - 1);
      break;
    case 'QUARTERLY':
      periodStart.setMonth(periodStart.getMonth() - 3);
      break;
  }

  periodStart.setHours(0, 0, 0, 0);
  return { periodStart, periodEnd };
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface RateAggregationWorkerDeps {
  prisma: PrismaClient;
  rateDataRepository: RateDataRepository;
  aggregateRepository: RateAggregateRepository;
  demandTrendRepository: DemandTrendRepository;
  logger: Logger;
}

// =============================================================================
// WORKER FACTORY
// =============================================================================

/**
 * Calculate acceptance rates by price tier
 */
function calculateAcceptanceRates(
  dataPoints: RateDataPoint[],
  stats: { p25: number; p75: number }
): { low: number; mid: number; high: number } {
  const low = dataPoints.filter((d) => Number(d.effectiveHourlyRate) < stats.p25);
  const mid = dataPoints.filter(
    (d) => Number(d.effectiveHourlyRate) >= stats.p25 && Number(d.effectiveHourlyRate) <= stats.p75
  );
  const high = dataPoints.filter((d) => Number(d.effectiveHourlyRate) > stats.p75);

  return {
    low: low.length > 0 ? low.filter((d) => d.wasAccepted).length / low.length : 0,
    mid: mid.length > 0 ? mid.filter((d) => d.wasAccepted).length / mid.length : 0,
    high: high.length > 0 ? high.filter((d) => d.wasAccepted).length / high.length : 0,
  };
}

/**
 * Calculate average ratings by price tier
 */
function calculateRatingsByTier(
  dataPoints: RateDataPoint[],
  stats: { p25: number; p75: number }
): { low: number | null; mid: number | null; high: number | null } {
  const withRating = dataPoints.filter((d) => d.clientRating !== null);

  const low = withRating.filter((d) => Number(d.effectiveHourlyRate) < stats.p25);
  const mid = withRating.filter(
    (d) => Number(d.effectiveHourlyRate) >= stats.p25 && Number(d.effectiveHourlyRate) <= stats.p75
  );
  const high = withRating.filter((d) => Number(d.effectiveHourlyRate) > stats.p75);

  const avgRating = (items: RateDataPoint[]) => {
    if (items.length === 0) return null;
    const sum = items.reduce((a, b) => a + Number(b.clientRating ?? 0), 0);
    return Math.round((sum / items.length) * 100) / 100;
  };

  return {
    low: avgRating(low),
    mid: avgRating(mid),
    high: avgRating(high),
  };
}

/**
 * Calculate compliance premium percentage
 */
function calculateCompliancePremium(dataPoints: RateDataPoint[]): number | null {
  const withCompliance = dataPoints.filter((d) => d.hasCompliancePremium);
  const withoutCompliance = dataPoints.filter((d) => !d.hasCompliancePremium);

  if (withCompliance.length < 5 || withoutCompliance.length < 5) {
    return null;
  }

  const avgWithCompliance =
    withCompliance.reduce((a, b) => a + Number(b.effectiveHourlyRate), 0) / withCompliance.length;
  const avgWithoutCompliance =
    withoutCompliance.reduce((a, b) => a + Number(b.effectiveHourlyRate), 0) /
    withoutCompliance.length;

  return (
    Math.round(((avgWithCompliance - avgWithoutCompliance) / avgWithoutCompliance) * 100 * 100) /
    100
  );
}

export function createRateAggregationWorker(deps: RateAggregationWorkerDeps) {
  const { prisma, rateDataRepository, aggregateRepository, demandTrendRepository, logger } = deps;

  /**
   * Process a single segment for aggregation
   */
  async function processSegment(
    segment: {
      skillCategory: string;
      primarySkill: string | null;
      experienceLevel: ExperienceLevel;
      region: string;
    },
    periodType: PeriodType,
    periodStart: Date,
    periodEnd: Date
  ): Promise<boolean> {
    const dataPoints = await rateDataRepository.findMany({
      where: {
        skillCategory: segment.skillCategory,
        ...(segment.primarySkill !== null && { primarySkill: segment.primarySkill }),
        experienceLevel: segment.experienceLevel,
        freelancerRegion: segment.region,
        occurredAt: { gte: periodStart, lte: periodEnd },
      },
    });

    if (dataPoints.length < 5) {
      return false;
    }

    const hourlyRates = dataPoints
      .filter((d) => d.effectiveHourlyRate !== null)
      .map((d) => Number(d.effectiveHourlyRate))
      .sort((a, b) => a - b);

    const fixedRates = dataPoints
      .filter((d) => d.fixedRate !== null)
      .map((d) => Number(d.fixedRate))
      .sort((a, b) => a - b);

    if (hourlyRates.length < 5) {
      return false;
    }

    const stats = calculateStatistics(hourlyRates);
    const fixedStats = fixedRates.length >= 5 ? calculateStatistics(fixedRates) : null;
    const acceptanceRates = calculateAcceptanceRates(dataPoints, stats);
    const ratingsByTier = calculateRatingsByTier(dataPoints, stats);

    const previousAggregate = await aggregateRepository.findPrevious({
      skillCategory: segment.skillCategory,
      primarySkill: segment.primarySkill,
      experienceLevel: segment.experienceLevel,
      region: segment.region,
      periodType,
      periodStart,
    });

    const rateChange = previousAggregate
      ? ((stats.median - Number(previousAggregate.hourlyRateMedian)) /
          Number(previousAggregate.hourlyRateMedian)) *
        100
      : null;

    const compliancePremium = calculateCompliancePremium(dataPoints);

    await aggregateRepository.upsert({
      skillCategory: segment.skillCategory,
      primarySkill: segment.primarySkill,
      experienceLevel: segment.experienceLevel,
      region: segment.region,
      periodType,
      periodStart,
      periodEnd,
      sampleSize: hourlyRates.length,
      acceptedCount: dataPoints.filter((d) => d.wasAccepted).length,
      completedCount: dataPoints.filter((d) => d.projectCompleted).length,
      hourlyRateMin: stats.min,
      hourlyRateMax: stats.max,
      hourlyRateAvg: stats.avg,
      hourlyRateMedian: stats.median,
      hourlyRateStdDev: stats.stdDev,
      hourlyRateP10: stats.p10,
      hourlyRateP25: stats.p25,
      hourlyRateP75: stats.p75,
      hourlyRateP90: stats.p90,
      fixedRateMin: fixedStats?.min ?? null,
      fixedRateMax: fixedStats?.max ?? null,
      fixedRateAvg: fixedStats?.avg ?? null,
      fixedRateMedian: fixedStats?.median ?? null,
      acceptanceRateLow: acceptanceRates.low,
      acceptanceRateMid: acceptanceRates.mid,
      acceptanceRateHigh: acceptanceRates.high,
      avgRatingLowPrice: ratingsByTier.low,
      avgRatingMidPrice: ratingsByTier.mid,
      avgRatingHighPrice: ratingsByTier.high,
      compliancePremiumPct: compliancePremium,
      rateChangeFromPrevious: rateChange,
    });

    return true;
  }

  /**
   * Aggregate rates for a specific period and segment
   */
  async function aggregateRates(
    periodType: PeriodType,
    skillCategory?: string,
    region?: string
  ): Promise<void> {
    const { periodStart, periodEnd } = getPeriodBounds(periodType);

    logger.info({ msg: 'Starting rate aggregation', periodType, skillCategory, region });

    const segments = await rateDataRepository.getUniqueSegments({
      periodStart,
      periodEnd,
      ...(skillCategory !== undefined && { skillCategory }),
      ...(region !== undefined && { region }),
    });

    logger.info({ msg: `Found ${segments.length} segments to aggregate` });

    for (const segment of segments) {
      try {
        const processed = await processSegment(segment, periodType, periodStart, periodEnd);
        if (processed) {
          logger.debug({ msg: 'Aggregated segment', segment });
        } else {
          logger.debug({
            msg: 'Skipping segment with insufficient data',
            segment,
          });
        }
      } catch (error) {
        logger.error({
          msg: 'Failed to aggregate segment',
          segment,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info({ msg: 'Completed rate aggregation', periodType });
  }

  /**
   * Find skill record by name
   */
  async function findSkillRecord(skill: string) {
    return prisma.skill.findFirst({
      where: {
        OR: [
          { name: { contains: skill, mode: 'insensitive' } },
          {
            slug: {
              contains: skill.toLowerCase().replaceAll(/\s+/g, '-'),
              mode: 'insensitive',
            },
          },
        ],
      },
    });
  }

  /**
   * Get job statistics for a skill
   */
  async function getJobStats(
    skillRecord: { id: string } | null,
    periodStart: Date,
    periodEnd: Date
  ) {
    if (!skillRecord) {
      return { projectCount: 0, totalBudget: 0, avgBudget: 0 };
    }

    const projectCount = await prisma.jobSkill.count({
      where: {
        skillId: skillRecord.id,
        job: {
          createdAt: { gte: periodStart, lte: periodEnd },
          status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
        },
      },
    });

    const jobsWithSkill = await prisma.job.findMany({
      where: {
        skills: { some: { skillId: skillRecord.id } },
        createdAt: { gte: periodStart, lte: periodEnd },
        status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
      },
      select: { budgetMax: true },
    });

    const totalBudget = jobsWithSkill.reduce((sum, j) => sum + Number(j.budgetMax ?? 0), 0);
    const avgBudget = jobsWithSkill.length > 0 ? totalBudget / jobsWithSkill.length : 0;

    return { projectCount, totalBudget, avgBudget };
  }

  /**
   * Get freelancer and bid statistics for a skill
   */
  async function getFreelancerAndBidStats(
    skillRecord: { id: string } | null,
    periodStart: Date,
    periodEnd: Date
  ) {
    if (!skillRecord) {
      return { freelancerCount: 0, totalBids: 0 };
    }

    const freelancerCount = await prisma.userSkill.count({
      where: {
        skillId: skillRecord.id,
        user: {
          status: 'ACTIVE',
          bids: { some: {} },
        },
      },
    });

    const totalBids = await prisma.bid.count({
      where: {
        job: {
          skills: { some: { skillId: skillRecord.id } },
        },
        submittedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    return { freelancerCount, totalBids };
  }

  /**
   * Process a single skill for demand trends
   */
  async function processSkillDemand(
    skill: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    const skillRecord = await findSkillRecord(skill);
    const { projectCount, totalBudget, avgBudget } = await getJobStats(
      skillRecord,
      periodStart,
      periodEnd
    );
    const { freelancerCount, totalBids } = await getFreelancerAndBidStats(
      skillRecord,
      periodStart,
      periodEnd
    );

    const demandSupplyRatio = freelancerCount > 0 ? projectCount / freelancerCount : 0;
    const avgBidsPerProject = projectCount > 0 ? totalBids / projectCount : 0;

    const demandLevel = determineDemandLevel(demandSupplyRatio, avgBidsPerProject, projectCount);

    const previousTrend = await demandTrendRepository.findPrevious(skill, periodStart);

    await demandTrendRepository.upsert({
      skill,
      skillCategory: getSkillCategory(skill),
      periodStart,
      periodEnd,
      projectCount,
      totalBudget,
      avgBudget,
      activeFreelancers: freelancerCount,
      totalBids,
      avgBidsPerProject,
      demandSupplyRatio,
      demandChangeFromPrevious: previousTrend
        ? ((projectCount - previousTrend.projectCount) / previousTrend.projectCount) * 100
        : null,
      rateChangeFromPrevious: null,
      demandLevel,
    });

    logger.debug({ msg: 'Calculated demand trend', skill, demandLevel });
  }

  /**
   * Calculate demand trends for skills
   */
  async function calculateDemandTrends(skillCategory?: string): Promise<void> {
    const { periodStart, periodEnd } = getPeriodBounds('MONTHLY');

    logger.info({ msg: 'Starting demand trend calculation', skillCategory });

    // Get unique skills from rate data
    const skills = await rateDataRepository.getUniqueSkills({
      ...(skillCategory !== undefined && { skillCategory }),
      periodStart,
      periodEnd,
    });

    logger.info({ msg: `Found ${skills.length} skills for demand analysis` });

    for (const skill of skills) {
      try {
        await processSkillDemand(skill, periodStart, periodEnd);
      } catch (error) {
        logger.error({
          msg: 'Failed to calculate demand trend',
          skill,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info({ msg: 'Completed demand trend calculation' });
  }

  /**
   * Run full aggregation for all periods and regions
   */
  async function runFullAggregation(): Promise<void> {
    logger.info({ msg: 'Starting full rate aggregation' });

    const periodTypes: PeriodType[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
    const regions = ['US', 'EU', 'ASIA', 'GLOBAL'];

    for (const periodType of periodTypes) {
      for (const region of regions) {
        await aggregateRates(periodType, undefined, region);
      }
    }

    await calculateDemandTrends();

    logger.info({ msg: 'Completed full rate aggregation' });
  }

  return {
    aggregateRates,
    calculateDemandTrends,
    runFullAggregation,
  };
}

export type RateAggregationWorker = ReturnType<typeof createRateAggregationWorker>;
