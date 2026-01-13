/**
 * @module @skillancer/market-svc/services/rate-intelligence
 * Rate Intelligence Service - Market rate analysis and recommendations
 */

import { DemandTrendRepository } from '../repositories/demand-trend.repository.js';
import { RateAggregateRepository } from '../repositories/rate-aggregate.repository.js';
import { RateDataRepository } from '../repositories/rate-data.repository.js';
import { RateHistoryRepository } from '../repositories/rate-history.repository.js';
import { RateRecommendationRepository } from '../repositories/rate-recommendation.repository.js';

import type {
  MarketRateQuery,
  MarketRateResult,
  HourlyRateStats,
  FreelancerRateAnalysis,
  MarketPositionCategory,
  CompetitiveAnalysis,
  PerformanceCorrelation,
  RateRecommendationResult,
  RecommendationReason,
  RateChangeHistoryItem,
  BudgetRecommendation,
  BudgetRecommendationParams,
  BidComparisonResult,
  DemandTrendResult,
  SkillTrendItem,
  HotSkillItem,
  RateHistoryResult,
  RateHistoryPeriod,
  CompliancePremium,
} from '../types/rate-intelligence.types.js';
import type {
  PrismaClient,
  RateAggregate,
  SkillDemandTrend,
  ExperienceLevel,
  DemandLevel,
} from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = 'rate-intel:';

const SKILL_CATEGORIES: Record<string, string[]> = {
  DEVELOPMENT: [
    'javascript',
    'react',
    'python',
    'java',
    'node.js',
    'typescript',
    'vue',
    'angular',
    'golang',
    'rust',
  ],
  DESIGN: ['ui design', 'ux design', 'graphic design', 'figma', 'sketch', 'adobe', 'web design'],
  DATA: ['data science', 'machine learning', 'python', 'sql', 'tableau', 'power bi', 'ai'],
  MARKETING: ['seo', 'social media', 'content marketing', 'google ads', 'facebook ads', 'ppc'],
  WRITING: ['copywriting', 'content writing', 'technical writing', 'editing', 'blog writing'],
  MOBILE: ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
  DEVOPS: ['aws', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'cloud'],
};

const REGION_MAP: Record<string, string> = {
  US: 'US',
  CA: 'US',
  GB: 'EU',
  DE: 'EU',
  FR: 'EU',
  NL: 'EU',
  ES: 'EU',
  IT: 'EU',
  IN: 'ASIA',
  PH: 'ASIA',
  PK: 'ASIA',
  BD: 'ASIA',
  AU: 'OCEANIA',
  NZ: 'OCEANIA',
};

const DEFAULT_RATES: Partial<Record<ExperienceLevel, { min: number; max: number }>> = {
  ENTRY: { min: 25, max: 50 },
  JUNIOR: { min: 35, max: 60 },
  INTERMEDIATE: { min: 50, max: 100 },
  MID: { min: 60, max: 120 },
  SENIOR: { min: 80, max: 150 },
  EXPERT: { min: 100, max: 200 },
  PRINCIPAL: { min: 150, max: 300 },
};

const BASE_BID_COUNTS: Record<DemandLevel, number> = {
  VERY_LOW: 3,
  LOW: 8,
  MODERATE: 15,
  MEDIUM: 20,
  HIGH: 25,
  VERY_HIGH: 40,
};

// =============================================================================
// ERROR CLASS
// =============================================================================

export class RateIntelligenceError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'RateIntelligenceError';
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getSkillCategory(skill: string): string {
  const normalizedSkill = skill.toLowerCase();
  for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
    if (skills.some((s) => normalizedSkill.includes(s) || s.includes(normalizedSkill))) {
      return category;
    }
  }
  return 'OTHER';
}

function getRegion(country: string | null | undefined): string {
  if (!country) return 'GLOBAL';
  return REGION_MAP[country] ?? 'GLOBAL';
}

function inferExperienceLevel(yearsOfExperience: number | null | undefined): ExperienceLevel {
  if (!yearsOfExperience) return 'INTERMEDIATE';
  if (yearsOfExperience < 2) return 'ENTRY';
  if (yearsOfExperience < 5) return 'INTERMEDIATE';
  return 'EXPERT';
}

function calculatePercentile(rate: number, marketRates: HourlyRateStats): number {
  if (rate <= marketRates.min) return 1;
  if (rate >= marketRates.max) return 99;

  const checkpoints = [
    { percentile: 10, rate: marketRates.percentile10 },
    { percentile: 25, rate: marketRates.percentile25 },
    { percentile: 50, rate: marketRates.median },
    { percentile: 75, rate: marketRates.percentile75 },
    { percentile: 90, rate: marketRates.percentile90 },
  ];

  for (let i = 0; i < checkpoints.length - 1; i++) {
    const current = checkpoints[i];
    const next = checkpoints[i + 1];
    if (current && next && rate >= current.rate && rate <= next.rate) {
      const rangePct = next.percentile - current.percentile;
      const rangeRate = next.rate - current.rate;
      const positionInRange = rangeRate > 0 ? (rate - current.rate) / rangeRate : 0;
      return Math.round(current.percentile + positionInRange * rangePct);
    }
  }

  return 50;
}

function categorizeMarketPosition(percentile: number): MarketPositionCategory {
  if (percentile < 25) return 'BELOW_MARKET';
  if (percentile <= 75) return 'AT_MARKET';
  if (percentile <= 90) return 'ABOVE_MARKET';
  return 'PREMIUM';
}

function calculateSupplyLevel(demandTrend: SkillDemandTrend | null): string {
  if (!demandTrend) return 'MODERATE';
  const ratio = Number(demandTrend.demandSupplyRatio);
  if (ratio > 1.5) return 'LOW';
  if (ratio > 1) return 'MODERATE';
  if (ratio > 0.7) return 'HIGH';
  return 'VERY_HIGH';
}

function calculateCompetitionLevel(demandTrend: SkillDemandTrend | null): string {
  if (!demandTrend) return 'MODERATE';
  const avgBids = Number(demandTrend.avgBidsPerProject);
  if (avgBids < 5) return 'LOW';
  if (avgBids < 15) return 'MODERATE';
  if (avgBids < 30) return 'HIGH';
  return 'VERY_HIGH';
}

function calculateEarningsChange(
  oldRate: number,
  newRate: number,
  oldWinRate: number,
  newWinRate: number
): number {
  const oldEarnings = oldRate * oldWinRate;
  const newEarnings = newRate * newWinRate;
  return oldEarnings > 0 ? ((newEarnings - oldEarnings) / oldEarnings) * 100 : 0;
}

// =============================================================================
// RATE INTELLIGENCE SERVICE
// =============================================================================

export class RateIntelligenceService {
  private readonly rateDataRepository: RateDataRepository;
  private readonly rateAggregateRepository: RateAggregateRepository;
  private readonly demandTrendRepository: DemandTrendRepository;
  private readonly recommendationRepository: RateRecommendationRepository;
  private readonly rateHistoryRepository: RateHistoryRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.rateDataRepository = new RateDataRepository(prisma);
    this.rateAggregateRepository = new RateAggregateRepository(prisma);
    this.demandTrendRepository = new DemandTrendRepository(prisma);
    this.recommendationRepository = new RateRecommendationRepository(prisma);
    this.rateHistoryRepository = new RateHistoryRepository(prisma);
  }

  // ===========================================================================
  // MARKET RATE METHODS
  // ===========================================================================

  /**
   * Get market rate for a skill
   */
  async getMarketRate(query: MarketRateQuery): Promise<MarketRateResult | null> {
    const cacheKey = `${CACHE_PREFIX}market:${JSON.stringify(query)}`;

    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as MarketRateResult;
    }

    const experienceLevel = query.experienceLevel ?? 'INTERMEDIATE';
    const region = query.region ?? 'GLOBAL';
    const skillCategory = query.skillCategory ?? getSkillCategory(query.skill);

    // Get latest aggregate for skill
    let aggregate = await this.rateAggregateRepository.findLatest({
      skillCategory,
      primarySkill: query.skill,
      experienceLevel,
      region,
      periodType: 'MONTHLY',
    });

    // Fall back to category-level if insufficient data
    if (!aggregate || aggregate.sampleSize < 10) {
      aggregate = await this.rateAggregateRepository.findLatest({
        skillCategory,
        primarySkill: null,
        experienceLevel,
        region,
        periodType: 'MONTHLY',
      });

      if (!aggregate) {
        return null;
      }
    }

    // Get previous period for trend
    const previousAggregate = await this.rateAggregateRepository.findPrevious({
      skillCategory: aggregate.skillCategory,
      primarySkill: aggregate.primarySkill,
      experienceLevel: aggregate.experienceLevel,
      region: aggregate.region,
      periodType: aggregate.periodType,
      periodStart: aggregate.periodStart,
    });

    // Get demand trend
    const demandTrend = await this.demandTrendRepository.findLatest(query.skill);

    // Calculate compliance premium if applicable
    let compliancePremium: CompliancePremium | undefined;
    if (query.complianceRequired?.length) {
      compliancePremium = await this.calculateCompliancePremium(query.skill);
    }

    const result = this.buildMarketRateResult(
      aggregate,
      query,
      previousAggregate,
      demandTrend,
      compliancePremium
    );

    // Cache result
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);

    return result;
  }

  private buildMarketRateResult(
    aggregate: RateAggregate,
    query: MarketRateQuery,
    previousAggregate?: RateAggregate | null,
    demandTrend?: SkillDemandTrend | null,
    compliancePremium?: CompliancePremium
  ): MarketRateResult {
    let changePercent30d: number | null = null;
    let changePercent90d: number | null = null;
    let direction: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';

    if (previousAggregate) {
      const prevMedian = Number(previousAggregate.hourlyRateMedian);
      const currMedian = Number(aggregate.hourlyRateMedian);
      changePercent30d = prevMedian > 0 ? ((currMedian - prevMedian) / prevMedian) * 100 : null;

      if (changePercent30d !== null) {
        if (changePercent30d > 2) direction = 'UP';
        else if (changePercent30d < -2) direction = 'DOWN';
      }
    }

    if (aggregate.rateChangeFromPrevious) {
      changePercent90d = Number(aggregate.rateChangeFromPrevious);
    }

    // Build fixed project rate if available
    const fixedProjectRate = aggregate.fixedRateAvg
      ? {
          min: Number(aggregate.fixedRateMin),
          max: Number(aggregate.fixedRateMax),
          avg: Number(aggregate.fixedRateAvg),
          median: Number(aggregate.fixedRateMedian),
        }
      : null;

    return {
      skill: query.skill,
      experienceLevel: aggregate.experienceLevel,
      region: aggregate.region,
      sampleSize: aggregate.sampleSize,
      hourlyRate: {
        min: Number(aggregate.hourlyRateMin),
        max: Number(aggregate.hourlyRateMax),
        avg: Number(aggregate.hourlyRateAvg),
        median: Number(aggregate.hourlyRateMedian),
        percentile10: Number(aggregate.hourlyRateP10),
        percentile25: Number(aggregate.hourlyRateP25),
        percentile75: Number(aggregate.hourlyRateP75),
        percentile90: Number(aggregate.hourlyRateP90),
      },
      ...(fixedProjectRate !== null && { fixedProjectRate }),
      acceptanceRates: {
        belowMarket: Number(aggregate.acceptanceRateLow ?? 0),
        atMarket: Number(aggregate.acceptanceRateMid ?? 0),
        aboveMarket: Number(aggregate.acceptanceRateHigh ?? 0),
      },
      trend: {
        changePercent30d,
        changePercent90d,
        direction,
      },
      ...(compliancePremium !== undefined && { compliancePremium }),
      demandLevel: demandTrend?.demandLevel ?? 'MODERATE',
      lastUpdated: aggregate.createdAt,
    };
  }

  // ===========================================================================
  // FREELANCER ANALYSIS METHODS
  // ===========================================================================

  /**
   * Analyze freelancer's rate position in the market
   */
  async analyzeFreelancerRate(
    userId: string,
    primarySkill: string
  ): Promise<FreelancerRateAnalysis> {
    // Get freelancer profile
    const profile = await this.prisma.userProfile.findFirst({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!profile) {
      throw new RateIntelligenceError('FREELANCER_NOT_FOUND', 'Freelancer profile not found');
    }

    const currentRate = profile.hourlyRate ? Number(profile.hourlyRate) : null;
    if (!currentRate) {
      throw new RateIntelligenceError('NO_RATE_SET', 'Freelancer has not set an hourly rate');
    }

    // Get market data
    const marketRate = await this.getMarketRate({
      skill: primarySkill,
      experienceLevel: inferExperienceLevel(profile.yearsExperience),
      region: profile.country ? getRegion(profile.country) : 'GLOBAL',
    });

    if (!marketRate) {
      throw new RateIntelligenceError('NO_MARKET_DATA', 'Insufficient market data for this skill');
    }

    // Calculate market position
    const percentile = calculatePercentile(currentRate, marketRate.hourlyRate);
    const marketPosition = categorizeMarketPosition(percentile);
    const vsMedian =
      ((currentRate - marketRate.hourlyRate.median) / marketRate.hourlyRate.median) * 100;

    // Get competitive analysis
    const competitiveAnalysis = await this.getCompetitiveAnalysis(primarySkill, currentRate);

    // Get performance correlation
    const performanceCorrelation = await this.getPerformanceCorrelation(
      userId,
      primarySkill,
      currentRate,
      marketRate
    );

    // Generate recommendations
    const recommendations = await this.generateRateRecommendations(
      userId,
      currentRate,
      percentile,
      marketRate,
      performanceCorrelation
    );

    // Get rate history
    const rateHistory = await this.getRateHistory(userId);

    return {
      currentRate,
      marketPosition: {
        percentile,
        category: marketPosition,
        vsMedian: Math.round(vsMedian * 10) / 10,
      },
      competitiveAnalysis,
      performanceCorrelation,
      recommendations,
      historicalPerformance: {
        rateChanges: rateHistory,
      },
    };
  }

  private async getCompetitiveAnalysis(
    skill: string,
    currentRate: number
  ): Promise<CompetitiveAnalysis> {
    const freelancerRates = await this.rateDataRepository.getFreelancerRatesForSkill(skill);

    const above = freelancerRates.filter((r) => r.hourlyRate > currentRate).length;
    const below = freelancerRates.filter((r) => r.hourlyRate < currentRate).length;
    const same = freelancerRates.filter(
      (r) => Math.abs(r.hourlyRate - currentRate) <= currentRate * 0.05
    ).length;

    return {
      freelancersAbove: above,
      freelancersBelow: below,
      freelancersAtSameLevel: same,
    };
  }

  private async getPerformanceCorrelation(
    userId: string,
    skill: string,
    currentRate: number,
    marketRate: MarketRateResult
  ): Promise<PerformanceCorrelation> {
    const userBidStats = await this.rateDataRepository.getUserBidStats(userId, skill);
    const yourWinRate =
      userBidStats.totalBids > 0 ? userBidStats.acceptedBids / userBidStats.totalBids : 0;

    const percentile = calculatePercentile(currentRate, marketRate.hourlyRate);
    let avgWinRateAtYourRate: number;

    if (percentile < 25) {
      avgWinRateAtYourRate = marketRate.acceptanceRates.belowMarket;
    } else if (percentile <= 75) {
      avgWinRateAtYourRate = marketRate.acceptanceRates.atMarket;
    } else {
      avgWinRateAtYourRate = marketRate.acceptanceRates.aboveMarket;
    }

    const optimalRateRange = {
      min: marketRate.hourlyRate.percentile25,
      max: Math.round(
        marketRate.hourlyRate.percentile25 +
          (marketRate.hourlyRate.percentile75 - marketRate.hourlyRate.percentile25) * 0.5
      ),
    };

    return {
      yourWinRate,
      avgWinRateAtYourRate,
      optimalRateRange,
    };
  }

  private async getRateHistory(userId: string): Promise<RateChangeHistoryItem[]> {
    const history = await this.rateHistoryRepository.findByUser(userId, { limit: 10 });

    return history.map((h) => ({
      date: h.changedAt,
      oldRate: Number(h.previousHourlyRate ?? 0),
      newRate: Number(h.newHourlyRate),
      impactOnWinRate:
        h.winRateAfterChange !== null && h.winRateBeforeChange !== null
          ? Number(h.winRateAfterChange) - Number(h.winRateBeforeChange)
          : null,
    }));
  }

  // ===========================================================================
  // RATE RECOMMENDATIONS
  // ===========================================================================

  /**
   * Convert database recommendation to result format
   */
  private toRecommendationResult(
    rec: Awaited<ReturnType<RateRecommendationRepository['create']>>
  ): RateRecommendationResult {
    return {
      id: rec.id,
      userId: rec.userId,
      recommendationType: rec.recommendationType,
      currentRate: Number(rec.currentRate),
      currentPercentile: rec.currentPercentile,
      recommendedRateMin: Number(rec.recommendedRateMin),
      recommendedRateMax: Number(rec.recommendedRateMax),
      recommendedPercentile: rec.recommendedPercentile,
      reasons: rec.reasons as unknown as RecommendationReason[],
      projectedWinRateChange: rec.projectedWinRateChange
        ? Number(rec.projectedWinRateChange)
        : null,
      projectedEarningsChange: rec.projectedEarningsChange
        ? Number(rec.projectedEarningsChange)
        : null,
      status: rec.status,
      validUntil: rec.validUntil,
      createdAt: rec.createdAt,
    };
  }

  /**
   * Create rate increase recommendation for underpriced freelancer
   */
  private async createRateIncreaseRecommendation(
    userId: string,
    currentRate: number,
    currentPercentile: number,
    marketRate: MarketRateResult,
    winRate: number
  ): Promise<RateRecommendationResult> {
    const recommendedMin = marketRate.hourlyRate.percentile25;
    const recommendedMax = marketRate.hourlyRate.median;

    const reasons: RecommendationReason[] = [
      {
        factor: 'HIGH_WIN_RATE',
        description: `Your win rate of ${Math.round(winRate * 100)}% suggests you can charge more`,
        impact: 'POSITIVE',
      },
      {
        factor: 'BELOW_MARKET',
        description: `You're currently at the ${currentPercentile}th percentile, below market average`,
        impact: 'POSITIVE',
      },
      {
        factor: 'MARKET_DEMAND',
        description: `${marketRate.demandLevel} demand for ${marketRate.skill} supports higher rates`,
        impact:
          marketRate.demandLevel === 'HIGH' || marketRate.demandLevel === 'VERY_HIGH'
            ? 'POSITIVE'
            : 'NEUTRAL',
      },
    ];

    const rec = await this.recommendationRepository.create({
      userId,
      recommendationType: 'RATE_INCREASE',
      currentRate,
      currentPercentile,
      recommendedRateMin: recommendedMin,
      recommendedRateMax: recommendedMax,
      recommendedPercentile: 40,
      reasons,
      projectedWinRateChange: -0.05,
      projectedEarningsChange: ((recommendedMin - currentRate) / currentRate) * 100 * 0.95,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return this.toRecommendationResult(rec);
  }

  /**
   * Create rate decrease recommendation for overpriced freelancer
   */
  private async createRateDecreaseRecommendation(
    userId: string,
    currentRate: number,
    currentPercentile: number,
    marketRate: MarketRateResult,
    winRate: number
  ): Promise<RateRecommendationResult> {
    const recommendedMin = marketRate.hourlyRate.median;
    const recommendedMax = marketRate.hourlyRate.percentile75;

    const reasons: RecommendationReason[] = [
      {
        factor: 'LOW_WIN_RATE',
        description: `Your win rate of ${Math.round(winRate * 100)}% is below average`,
        impact: 'NEGATIVE',
      },
      {
        factor: 'ABOVE_MARKET',
        description: `You're at the ${currentPercentile}th percentile, above most competitors`,
        impact: 'NEUTRAL',
      },
      {
        factor: 'OPTIMIZATION',
        description: 'Adjusting to market rate could significantly increase your bookings',
        impact: 'POSITIVE',
      },
    ];

    const rec = await this.recommendationRepository.create({
      userId,
      recommendationType: 'RATE_DECREASE',
      currentRate,
      currentPercentile,
      recommendedRateMin: recommendedMin,
      recommendedRateMax: recommendedMax,
      recommendedPercentile: 60,
      reasons,
      projectedWinRateChange: 0.15,
      projectedEarningsChange: calculateEarningsChange(
        currentRate,
        (recommendedMin + recommendedMax) / 2,
        winRate,
        winRate + 0.15
      ),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return this.toRecommendationResult(rec);
  }

  /**
   * Create demand-based rate adjustment recommendation
   */
  private async createDemandBasedRecommendation(
    userId: string,
    currentRate: number,
    currentPercentile: number,
    marketRate: MarketRateResult
  ): Promise<RateRecommendationResult> {
    const increasePercent = Math.min(15, Math.abs(marketRate.trend.changePercent30d ?? 5));
    const recommendedRate = currentRate * (1 + increasePercent / 100);

    const reasons: RecommendationReason[] = [
      {
        factor: 'HIGH_DEMAND',
        description: `${marketRate.skill} is in very high demand right now`,
        impact: 'POSITIVE',
      },
      {
        factor: 'RISING_RATES',
        description: `Market rates have increased ${Math.round(marketRate.trend.changePercent30d ?? 0)}% in the last month`,
        impact: 'POSITIVE',
      },
    ];

    const rec = await this.recommendationRepository.create({
      userId,
      recommendationType: 'DEMAND_BASED_ADJUSTMENT',
      currentRate,
      currentPercentile,
      recommendedRateMin: Math.round(recommendedRate * 0.95),
      recommendedRateMax: Math.round(recommendedRate * 1.05),
      recommendedPercentile: Math.min(90, currentPercentile + 10),
      reasons,
      projectedWinRateChange: -0.02,
      projectedEarningsChange: increasePercent * 0.98,
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    return this.toRecommendationResult(rec);
  }

  private async generateRateRecommendations(
    userId: string,
    currentRate: number,
    currentPercentile: number,
    marketRate: MarketRateResult,
    performanceData: PerformanceCorrelation
  ): Promise<RateRecommendationResult[]> {
    const recommendations: RateRecommendationResult[] = [];
    const winRate = performanceData.yourWinRate;

    // Check if rate is below optimal with high win rate
    if (currentPercentile < 25 && winRate > 0.3) {
      const rec = await this.createRateIncreaseRecommendation(
        userId,
        currentRate,
        currentPercentile,
        marketRate,
        winRate
      );
      recommendations.push(rec);
    }

    // Check if rate is significantly above market with low win rate
    if (currentPercentile > 75 && winRate < 0.15) {
      const rec = await this.createRateDecreaseRecommendation(
        userId,
        currentRate,
        currentPercentile,
        marketRate,
        winRate
      );
      recommendations.push(rec);
    }

    // Demand-based recommendations
    const isHighDemandRising =
      marketRate.demandLevel === 'VERY_HIGH' && marketRate.trend.direction === 'UP';
    const recommendedRate =
      currentRate * (1 + Math.min(15, Math.abs(marketRate.trend.changePercent30d ?? 5)) / 100);
    const shouldRecommendDemandBased = recommendedRate > currentRate && currentPercentile < 80;

    if (isHighDemandRising && shouldRecommendDemandBased) {
      const rec = await this.createDemandBasedRecommendation(
        userId,
        currentRate,
        currentPercentile,
        marketRate
      );
      recommendations.push(rec);
    }

    return recommendations;
  }

  /**
   * Respond to a recommendation
   */
  async respondToRecommendation(
    recommendationId: string,
    userId: string,
    action: 'ACCEPT' | 'REJECT',
    newRate?: number,
    reason?: string
  ): Promise<RateRecommendationResult> {
    const recommendation = await this.recommendationRepository.findById(recommendationId);

    if (!recommendation) {
      throw new RateIntelligenceError('RECOMMENDATION_NOT_FOUND', 'Recommendation not found');
    }

    if (recommendation.userId !== userId) {
      throw new RateIntelligenceError(
        'UNAUTHORIZED',
        'You are not authorized to respond to this recommendation'
      );
    }

    let actionTaken: string;
    if (action === 'ACCEPT') {
      actionTaken = newRate ? `Rate updated to $${newRate}/hr` : 'Recommendation accepted';
    } else {
      actionTaken = reason ?? 'Recommendation rejected';
    }

    const updated = await this.recommendationRepository.updateStatus(recommendationId, {
      status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
      actionTaken,
    });

    return {
      id: updated.id,
      userId: updated.userId,
      recommendationType: updated.recommendationType,
      currentRate: Number(updated.currentRate),
      currentPercentile: updated.currentPercentile,
      recommendedRateMin: Number(updated.recommendedRateMin),
      recommendedRateMax: Number(updated.recommendedRateMax),
      recommendedPercentile: updated.recommendedPercentile,
      reasons: updated.reasons as unknown as RecommendationReason[],
      projectedWinRateChange: updated.projectedWinRateChange
        ? Number(updated.projectedWinRateChange)
        : null,
      projectedEarningsChange: updated.projectedEarningsChange
        ? Number(updated.projectedEarningsChange)
        : null,
      status: updated.status,
      validUntil: updated.validUntil,
      createdAt: updated.createdAt,
    };
  }

  // ===========================================================================
  // BUDGET RECOMMENDATIONS FOR CLIENTS
  // ===========================================================================

  /**
   * Get budget recommendation for a project
   */
  async getBudgetRecommendation(params: BudgetRecommendationParams): Promise<BudgetRecommendation> {
    const firstSkill = params.skills[0];

    if (!firstSkill) {
      return this.getDefaultBudgetRecommendation(params);
    }

    // TypeScript now knows primarySkill is defined after the guard
    const primarySkill: string = firstSkill;

    const marketRate = await this.getMarketRate({
      skill: primarySkill,
      experienceLevel: params.experienceLevel,
      ...(params.complianceRequired !== undefined && {
        complianceRequired: params.complianceRequired,
      }),
    });

    if (!marketRate) {
      return this.getDefaultBudgetRecommendation(params);
    }

    const hourlyRates = marketRate.hourlyRate;

    let budgetMultiplier = 1;
    if (params.complianceRequired?.length && marketRate.compliancePremium) {
      budgetMultiplier = 1 + marketRate.compliancePremium.premiumPercent / 100;
    }

    const economicalRate = {
      min: Math.round(hourlyRates.percentile10 * budgetMultiplier),
      max: Math.round(hourlyRates.percentile25 * budgetMultiplier),
    };

    const competitiveRate = {
      min: Math.round(hourlyRates.percentile25 * budgetMultiplier),
      max: Math.round(hourlyRates.percentile75 * budgetMultiplier),
    };

    const premiumRate = {
      min: Math.round(hourlyRates.percentile75 * budgetMultiplier),
      max: Math.round(hourlyRates.percentile90 * budgetMultiplier),
    };

    let recommendedBudget: BudgetRecommendation['recommendedBudget'];
    if (params.projectType === 'FIXED' && params.estimatedHours) {
      recommendedBudget = {
        economical: {
          min: economicalRate.min * params.estimatedHours,
          max: economicalRate.max * params.estimatedHours,
          description: 'Budget-friendly option, may attract less experienced freelancers',
        },
        competitive: {
          min: competitiveRate.min * params.estimatedHours,
          max: competitiveRate.max * params.estimatedHours,
          description: 'Market-rate budget, attracts quality freelancers with good experience',
        },
        premium: {
          min: premiumRate.min * params.estimatedHours,
          max: premiumRate.max * params.estimatedHours,
          description: 'Premium budget for top-tier talent and fast turnaround',
        },
      };
    } else {
      recommendedBudget = {
        economical: {
          ...economicalRate,
          description: 'Budget-friendly hourly rate, may attract less experienced freelancers',
        },
        competitive: {
          ...competitiveRate,
          description: 'Market-rate hourly, attracts quality freelancers',
        },
        premium: {
          ...premiumRate,
          description: 'Premium rate for top-tier talent',
        },
      };
    }

    const baseBidCount = BASE_BID_COUNTS[marketRate.demandLevel];
    const expectedBidCount = {
      economical: Math.round(baseBidCount * (1 - marketRate.acceptanceRates.belowMarket)),
      competitive: Math.round(baseBidCount),
      premium: Math.round(baseBidCount * (1 + marketRate.acceptanceRates.aboveMarket * 0.5)),
    };

    const demandTrend = await this.demandTrendRepository.findLatest(primarySkill);

    return {
      skill: primarySkill,
      projectType: params.projectType,
      experienceLevel: params.experienceLevel,
      recommendedBudget,
      expectedBidCount,
      qualityExpectation: {
        economical: 'Entry to mid-level freelancers, good for straightforward projects',
        competitive: 'Experienced freelancers with proven track records',
        premium: 'Expert-level talent, ideal for complex or time-sensitive projects',
      },
      marketContext: {
        demandLevel: marketRate.demandLevel,
        supplyLevel: calculateSupplyLevel(demandTrend),
        competitionLevel: calculateCompetitionLevel(demandTrend),
      },
    };
  }

  private getDefaultBudgetRecommendation(params: BudgetRecommendationParams): BudgetRecommendation {
    const rates = DEFAULT_RATES[params.experienceLevel] ?? DEFAULT_RATES.INTERMEDIATE;
    const hours = params.estimatedHours ?? 40;
    const skill = params.skills[0] ?? 'general';

    return {
      skill,
      projectType: params.projectType,
      experienceLevel: params.experienceLevel,
      recommendedBudget: {
        economical: {
          min: params.projectType === 'FIXED' ? rates.min * hours * 0.8 : rates.min * 0.8,
          max: params.projectType === 'FIXED' ? rates.min * hours : rates.min,
          description: 'Budget-friendly option',
        },
        competitive: {
          min:
            params.projectType === 'FIXED'
              ? ((rates.min + rates.max) / 2) * hours * 0.9
              : ((rates.min + rates.max) / 2) * 0.9,
          max:
            params.projectType === 'FIXED'
              ? ((rates.min + rates.max) / 2) * hours * 1.1
              : ((rates.min + rates.max) / 2) * 1.1,
          description: 'Market-rate budget',
        },
        premium: {
          min: params.projectType === 'FIXED' ? rates.max * hours : rates.max,
          max: params.projectType === 'FIXED' ? rates.max * hours * 1.2 : rates.max * 1.2,
          description: 'Premium budget for top talent',
        },
      },
      expectedBidCount: {
        economical: 5,
        competitive: 15,
        premium: 25,
      },
      qualityExpectation: {
        economical: 'Entry to mid-level freelancers',
        competitive: 'Experienced freelancers',
        premium: 'Expert-level talent',
      },
      marketContext: {
        demandLevel: 'MODERATE',
        supplyLevel: 'MODERATE',
        competitionLevel: 'MODERATE',
      },
    };
  }

  // ===========================================================================
  // BID COMPARISON
  // ===========================================================================

  /**
   * Determine verdict and explanation based on percentile
   */
  private getBidVerdict(percentile: number): {
    verdict: BidComparisonResult['recommendation']['verdict'];
    explanation: string;
  } {
    if (percentile <= 30) {
      return {
        verdict: 'EXCELLENT',
        explanation: 'This bid is well below market average and represents excellent value',
      };
    }
    if (percentile <= 60) {
      return {
        verdict: 'FAIR',
        explanation: 'Rate is within market range for this skill and experience level',
      };
    }
    if (percentile <= 80) {
      return {
        verdict: 'HIGH',
        explanation: 'Rate is above average but may be justified by experience or quality',
      };
    }
    return {
      verdict: 'VERY_HIGH',
      explanation: 'Rate is significantly above market average',
    };
  }

  /**
   * Build considerations list for bid comparison
   */
  private buildBidConsiderations(
    freelancer: {
      ratingAggregation: {
        freelancerAverageRating: unknown;
        freelancerTotalReviews: number | null;
      } | null;
      freelancerCompliances: unknown[];
    } | null,
    vsMedian: number
  ): string[] {
    const considerations: string[] = [];

    if (freelancer?.ratingAggregation) {
      const rating = Number(freelancer.ratingAggregation.freelancerAverageRating);
      const reviews = freelancer.ratingAggregation.freelancerTotalReviews;
      if (rating >= 4.5 && reviews && reviews >= 10) {
        considerations.push(`Freelancer has ${rating.toFixed(1)} rating from ${reviews} reviews`);
      }
    }

    if (vsMedian > 10) {
      considerations.push(
        `Rate is ${Math.round(vsMedian)}% above average for accepted bids on similar projects`
      );
    }

    if (freelancer?.freelancerCompliances && freelancer.freelancerCompliances.length > 0) {
      considerations.push('Freelancer has relevant compliance certifications');
    }

    return considerations;
  }

  /**
   * Compare a bid against market rates
   */
  async compareBidToMarket(projectId: string, bidId: string): Promise<BidComparisonResult> {
    const bid = await this.prisma.bid.findUnique({
      where: { id: bidId },
      include: {
        job: {
          include: {
            skills: { include: { skill: true } },
          },
        },
      },
    });

    if (!bid) {
      throw new RateIntelligenceError('BID_NOT_FOUND', 'Bid not found');
    }

    const freelancer = await this.prisma.user.findUnique({
      where: { id: bid.freelancerId },
      include: {
        profile: true,
        ratingAggregation: true,
        freelancerCompliances: true,
      },
    });

    const jobSkills = bid.job?.skills ?? [];
    const primarySkill =
      jobSkills.length > 0 && jobSkills[0]?.skill ? jobSkills[0].skill.name : 'general';

    const marketRate = await this.getMarketRate({
      skill: primarySkill,
      experienceLevel: inferExperienceLevel(freelancer?.profile?.yearsExperience),
    });

    if (!marketRate) {
      throw new RateIntelligenceError('NO_MARKET_DATA', 'Insufficient market data');
    }

    const bidRate = Number(bid.proposedRate);
    const percentile = calculatePercentile(bidRate, marketRate.hourlyRate);
    const vsMedian =
      ((bidRate - marketRate.hourlyRate.median) / marketRate.hourlyRate.median) * 100;

    const { verdict, explanation } = this.getBidVerdict(percentile);
    const considerations = this.buildBidConsiderations(freelancer, vsMedian);
    const freelancerAvgRate = await this.rateDataRepository.getAverageRate(primarySkill);

    return {
      bid: {
        rate: bidRate,
        type: bid.rateType === 'HOURLY' ? 'HOURLY' : 'FIXED',
      },
      marketComparison: {
        percentile,
        vsMedian: Math.round(vsMedian * 10) / 10,
        category: categorizeMarketPosition(percentile),
      },
      historicalContext: {
        similarProjectsAvgRate: marketRate.hourlyRate.avg,
        acceptedBidsAvgRate: marketRate.hourlyRate.median * 0.9,
        thisFreelancerAvgRate: freelancerAvgRate ?? marketRate.hourlyRate.avg,
      },
      recommendation: {
        verdict,
        explanation,
        considerations,
      },
    };
  }

  // ===========================================================================
  // DEMAND TRENDS
  // ===========================================================================

  /**
   * Get skill demand trends
   */
  async getDemandTrends(params: {
    skill?: string;
    skillCategory?: string;
    period?: '30d' | '90d' | '1y';
  }): Promise<DemandTrendResult> {
    const trends: SkillTrendItem[] = [];

    if (params.skill) {
      const trend = await this.demandTrendRepository.findLatest(params.skill);
      const history = await this.demandTrendRepository.getSkillHistory(params.skill, { limit: 3 });

      if (trend) {
        trends.push(this.buildTrendItem(trend, history));
      }
    } else if (params.skillCategory) {
      const categoryTrends = await this.demandTrendRepository.getByCategory(params.skillCategory, {
        limit: 20,
      });
      for (const trend of categoryTrends) {
        const history = await this.demandTrendRepository.getSkillHistory(trend.skill, { limit: 3 });
        trends.push(this.buildTrendItem(trend, history));
      }
    }

    // Get hot skills
    const hotSkillsData = await this.demandTrendRepository.getHotSkills(5);
    const hotSkills: HotSkillItem[] = hotSkillsData.map((s) => ({
      skill: s.skill,
      demandLevel: s.demandLevel,
      rateGrowth: Number(s.rateChangeFromPrevious ?? 0),
    }));

    // Get declining skills
    const decliningSkillsData = await this.demandTrendRepository.getDecliningSkills(5);
    const decliningSkills: HotSkillItem[] = decliningSkillsData.map((s) => ({
      skill: s.skill,
      demandLevel: s.demandLevel,
      rateGrowth: Number(s.rateChangeFromPrevious ?? 0),
    }));

    return {
      trends,
      hotSkills,
      decliningSkills,
    };
  }

  private buildTrendItem(trend: SkillDemandTrend, history: SkillDemandTrend[]): SkillTrendItem {
    const previousPeriod = history[1];
    const changePercent = previousPeriod
      ? ((trend.projectCount - previousPeriod.projectCount) / previousPeriod.projectCount) * 100
      : 0;

    let forecast: 'INCREASING' | 'STABLE' | 'DECREASING' = 'STABLE';
    if (changePercent > 10) forecast = 'INCREASING';
    else if (changePercent < -10) forecast = 'DECREASING';

    return {
      skill: trend.skill,
      skillCategory: trend.skillCategory,
      demandLevel: trend.demandLevel,
      demandSupplyRatio: Number(trend.demandSupplyRatio),
      avgBidsPerProject: Number(trend.avgBidsPerProject),
      rateChange: {
        percent30d: Number(trend.rateChangeFromPrevious ?? 0),
        percent90d: null,
      },
      projectVolume: {
        current: trend.projectCount,
        previous: previousPeriod?.projectCount ?? trend.projectCount,
        changePercent: Math.round(changePercent * 10) / 10,
      },
      forecast: {
        nextMonth: forecast,
        confidence: 0.7,
      },
    };
  }

  // ===========================================================================
  // RATE HISTORY
  // ===========================================================================

  /**
   * Determine history limit from period
   */
  private getHistoryLimit(period?: '6m' | '1y' | '2y'): number {
    if (period === '2y') return 24;
    if (period === '1y') return 12;
    return 6;
  }

  /**
   * Calculate year-over-year rate growth
   */
  private calculateRateGrowth(history: RateHistoryPeriod[]): number | null {
    if (history.length < 12) return null;

    const currentItem = history[0];
    const yearAgoItem = history[11];
    if (!currentItem || !yearAgoItem) return null;

    const current = currentItem.medianRate;
    const yearAgo = yearAgoItem.medianRate;
    return yearAgo > 0 ? ((current - yearAgo) / yearAgo) * 100 : null;
  }

  /**
   * Calculate rate volatility from history
   */
  private calculateVolatility(rates: number[]): 'LOW' | 'MODERATE' | 'HIGH' {
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVar = avgRate > 0 ? stdDev / avgRate : 0;

    if (coeffOfVar < 0.1) return 'LOW';
    if (coeffOfVar < 0.2) return 'MODERATE';
    return 'HIGH';
  }

  /**
   * Determine demand trend direction
   */
  private determineDemandTrendDirection(
    rateGrowth: number | null
  ): 'INCREASING' | 'STABLE' | 'DECREASING' {
    if (rateGrowth && rateGrowth > 5) return 'INCREASING';
    if (rateGrowth && rateGrowth < -5) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * Get historical rate data for a skill
   */
  async getRateHistoryBySkill(params: {
    skill: string;
    experienceLevel?: ExperienceLevel;
    region?: string;
    period?: '6m' | '1y' | '2y';
  }): Promise<RateHistoryResult> {
    const limit = this.getHistoryLimit(params.period);

    const aggregates = await this.rateAggregateRepository.getHistory({
      skill: params.skill,
      ...(params.experienceLevel !== undefined && { experienceLevel: params.experienceLevel }),
      ...(params.region !== undefined && { region: params.region }),
      periodType: 'MONTHLY',
      limit,
    });

    const history: RateHistoryPeriod[] = aggregates.map((a) => ({
      period: a.periodStart.toISOString().substring(0, 7),
      avgRate: Number(a.hourlyRateAvg),
      medianRate: Number(a.hourlyRateMedian),
      sampleSize: a.sampleSize,
      demandLevel: 'MODERATE' as DemandLevel,
    }));

    const rateGrowth1y = this.calculateRateGrowth(history);
    const rates = history.map((h) => h.medianRate);

    return {
      skill: params.skill,
      history: [...history].reverse(),
      summary: {
        rateGrowth1y: rateGrowth1y === null ? null : Math.round(rateGrowth1y * 10) / 10,
        demandTrend: this.determineDemandTrendDirection(rateGrowth1y),
        volatility: this.calculateVolatility(rates),
      },
    };
  }

  // ===========================================================================
  // COMPLIANCE PREMIUM
  // ===========================================================================

  private async calculateCompliancePremium(skill: string): Promise<CompliancePremium> {
    const [withCompliance, withoutCompliance] = await Promise.all([
      this.rateDataRepository.getAverageRate(skill, { hasCompliance: true }),
      this.rateDataRepository.getAverageRate(skill, { hasCompliance: false }),
    ]);

    if (!withCompliance || !withoutCompliance) {
      return { hasData: false, premiumPercent: 15 };
    }

    const premium = ((withCompliance - withoutCompliance) / withoutCompliance) * 100;
    return { hasData: true, premiumPercent: Math.round(premium) };
  }

  // ===========================================================================
  // PENDING RECOMMENDATIONS
  // ===========================================================================

  /**
   * Get pending recommendations for a user
   */
  async getPendingRecommendations(userId: string): Promise<RateRecommendationResult[]> {
    const recommendations = await this.recommendationRepository.findPendingByUser(userId);

    return recommendations.map((rec) => ({
      id: rec.id,
      userId: rec.userId,
      recommendationType: rec.recommendationType,
      currentRate: Number(rec.currentRate),
      currentPercentile: rec.currentPercentile,
      recommendedRateMin: Number(rec.recommendedRateMin),
      recommendedRateMax: Number(rec.recommendedRateMax),
      recommendedPercentile: rec.recommendedPercentile,
      reasons: rec.reasons as unknown as RecommendationReason[],
      projectedWinRateChange: rec.projectedWinRateChange
        ? Number(rec.projectedWinRateChange)
        : null,
      projectedEarningsChange: rec.projectedEarningsChange
        ? Number(rec.projectedEarningsChange)
        : null,
      status: rec.status,
      validUntil: rec.validUntil,
      createdAt: rec.createdAt,
    }));
  }

  // ===========================================================================
  // USER RATE HISTORY
  // ===========================================================================

  /**
   * Get rate change history for a user
   */
  async getUserRateHistory(
    userId: string,
    options?: { limit?: number }
  ): Promise<RateChangeHistoryItem[]> {
    const history = await this.rateHistoryRepository.findByUser(userId, options);

    return history.map((item) => ({
      date: item.changedAt,
      oldRate: item.previousHourlyRate ? Number(item.previousHourlyRate) : 0,
      newRate: Number(item.newHourlyRate),
      impactOnWinRate: null, // Would need to calculate based on historical win rate data
    }));
  }
}
