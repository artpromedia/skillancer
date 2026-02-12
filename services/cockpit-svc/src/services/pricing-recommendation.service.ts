// @ts-nocheck
/**
 * Pricing Recommendation Service
 *
 * Provides data-driven pricing recommendations based on verified skills,
 * credentials, market data, and experience.
 */

import { logger } from '@skillancer/logger';

import type { ExternalRatesService } from './external-rates.service.js';
import type { MLPricingService } from './ml-pricing.service.js';
import type { MarketRateBenchmarkRepository } from '../repositories/market-benchmark.repository.js';
import type { PricingRecommendationRepository } from '../repositories/pricing-recommendation.repository.js';
import type { RateHistoryRepository } from '../repositories/rate-history.repository.js';
import type { RevenueProjectionRepository } from '../repositories/revenue-projection.repository.js';
import type { SkillRateRepository } from '../repositories/skill-rate.repository.js';
import type {
  SkillRate,
  MarketRateBenchmark,
  PricingRecommendation,
  RevenueProjection,
  RateHistory,
  RateFeatures,
  RatePrediction,
  PricingDashboard,
  SkillRateSummary,
  RecommendationSummary,
  RecommendationReason,
  CompetitorAnalysis,
  MarketPosition,
  MarketDemand,
  CompetitionLevel,
  TrendDirection,
  PricingRecommendationType,
  ScenarioType,
  SkillVerificationData,
  CredentialData,
  ProjectHistoryData,
  MarketSkillData,
} from '@skillancer/types/cockpit';
import type { Redis } from 'ioredis';

// API Client interfaces (to be implemented with actual clients)
interface SkillPodApiClient {
  getSkillVerification(userId: string, skillId: string): Promise<SkillVerificationData | null>;
  getCredentialsForSkill(userId: string, skillId: string): Promise<CredentialData[]>;
  getVerifiedSkills(userId: string): Promise<Array<{ skillId: string; skillName: string }>>;
}

interface MarketApiClient {
  getSkillRateData(skillId: string): Promise<MarketSkillData | null>;
}

interface CockpitDataService {
  getProjectHistoryForSkill(userId: string, skillId: string): Promise<ProjectHistoryData>;
  getProfileSkills(userId: string): Promise<Array<{ skillId: string; skillName: string }>>;
  updateProfileSkillRate(userId: string, skillId: string, rate: number): Promise<void>;
}

interface NotificationService {
  send(notification: { userId: string; type: string; data: Record<string, any> }): Promise<void>;
}

export class PricingRecommendationService {
  constructor(
    private readonly skillRateRepository: SkillRateRepository,
    private readonly benchmarkRepository: MarketRateBenchmarkRepository,
    private readonly recommendationRepository: PricingRecommendationRepository,
    private readonly rateHistoryRepository: RateHistoryRepository,
    private readonly projectionRepository: RevenueProjectionRepository,
    private readonly skillPodClient: SkillPodApiClient,
    private readonly marketClient: MarketApiClient,
    private readonly cockpitDataService: CockpitDataService,
    private readonly externalRatesService: ExternalRatesService,
    private readonly mlPricingService: MLPricingService,
    private readonly redis: Redis,
    private readonly notificationService?: NotificationService
  ) {}

  // ==================== Rate Calculation ====================

  /**
   * Calculate recommended rate for a specific skill
   */
  async calculateSkillRate(userId: string, skillId: string): Promise<SkillRate> {
    logger.info('Calculating skill rate', { userId, skillId });

    // Gather all data points in parallel
    const [
      skillVerification,
      credentials,
      projectHistory,
      marketBenchmark,
      externalRates,
      currentRate,
    ] = await Promise.all([
      this.skillPodClient.getSkillVerification(userId, skillId),
      this.skillPodClient.getCredentialsForSkill(userId, skillId),
      this.cockpitDataService.getProjectHistoryForSkill(userId, skillId),
      this.getBenchmarkForSkill(skillId),
      this.externalRatesService.getRatesForSkill(skillId),
      this.getCurrentRateForSkill(userId, skillId),
    ]);

    // Build feature vector for ML model
    const features = this.buildFeatureVector({
      skillVerification,
      credentials,
      projectHistory,
      marketBenchmark,
      externalRates,
      currentRate,
    });

    // Get ML prediction
    const mlPrediction = await this.mlPricingService.predictRate(features);

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore({
      hasVerification: !!skillVerification,
      verificationRecency: skillVerification?.verifiedAt,
      credentialCount: credentials.length,
      projectCount: projectHistory.projectCount,
      avgRating: projectHistory.avgRating,
      benchmarkSampleSize: marketBenchmark?.sampleSize || 0,
      mlConfidence: mlPrediction.confidence,
    });

    // Determine market position
    const marketPosition = this.determineMarketPosition(mlPrediction.optimalRate, marketBenchmark);

    // Create or update skill rate
    const skillRate = await this.skillRateRepository.upsert({
      userId,
      skillId,
      skillName: skillVerification?.skillName || features.skillName,
      currentHourlyRate: currentRate ?? undefined,
      recommendedMinRate: mlPrediction.minRate,
      recommendedOptimalRate: mlPrediction.optimalRate,
      recommendedMaxRate: mlPrediction.maxRate,
      currency: 'USD',
      confidenceScore,
      skillLevel: skillVerification?.proficiencyLevel,
      verificationScore: skillVerification?.confidenceScore,
      experienceYears: projectHistory.yearsExperience,
      projectsCompleted: projectHistory.projectCount,
      avgClientRating: projectHistory.avgRating,
      marketPosition,
      marketDemand: this.categorizeMarketDemand(marketBenchmark?.demandScore),
      competitionLevel: this.categorizeCompetition(marketBenchmark),
      calculatedAt: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Valid for 7 days
    });

    // Generate recommendation if significant difference
    if (currentRate && Math.abs(mlPrediction.optimalRate - currentRate) / currentRate > 0.1) {
      await this.generateRateRecommendation(userId, skillRate, mlPrediction, marketBenchmark);
    }

    logger.info('Skill rate calculated', {
      userId,
      skillId,
      currentRate,
      recommendedRate: mlPrediction.optimalRate,
      confidence: confidenceScore,
    });

    return skillRate;
  }

  /**
   * Calculate rates for all user skills
   */
  async calculateAllSkillRates(userId: string): Promise<SkillRate[]> {
    logger.info('Calculating all skill rates', { userId });

    // Get all skills from profile and verifications
    const [profileSkills, verifiedSkills] = await Promise.all([
      this.cockpitDataService.getProfileSkills(userId),
      this.skillPodClient.getVerifiedSkills(userId),
    ]);

    // Merge skill lists
    const allSkillIds = new Set([
      ...profileSkills.map((s) => s.skillId),
      ...verifiedSkills.map((s) => s.skillId),
    ]);

    const skillRates: SkillRate[] = [];

    for (const skillId of allSkillIds) {
      try {
        const skillRate = await this.calculateSkillRate(userId, skillId);
        skillRates.push(skillRate);
      } catch (error) {
        logger.error('Failed to calculate rate for skill', { error, skillId, userId });
      }
    }

    return skillRates.sort(
      (a, b) => Number(b.recommendedOptimalRate || 0) - Number(a.recommendedOptimalRate || 0)
    );
  }

  /**
   * Get skill rates for a user
   */
  async getSkillRates(userId: string): Promise<SkillRate[]> {
    return this.skillRateRepository.findByUser(userId);
  }

  // ==================== Recommendations ====================

  /**
   * Generate a rate recommendation
   */
  private async generateRateRecommendation(
    userId: string,
    skillRate: SkillRate,
    prediction: RatePrediction,
    benchmark: MarketRateBenchmark | null
  ): Promise<PricingRecommendation> {
    const currentRate = Number(skillRate.currentHourlyRate) || 0;
    const recommendedRate = prediction.optimalRate;
    const rateChange = recommendedRate - currentRate;
    const rateChangePercent = currentRate > 0 ? (rateChange / currentRate) * 100 : 100;

    // Determine recommendation type
    let recommendationType: PricingRecommendationType;
    if (rateChange > 0) {
      if (skillRate.verificationScore && Number(skillRate.verificationScore) > 80) {
        recommendationType = 'SKILL_PREMIUM';
      } else if (skillRate.projectsCompleted && skillRate.projectsCompleted > 10) {
        recommendationType = 'EXPERIENCE_UPGRADE';
      } else if (benchmark && benchmark.trendDirection === 'RISING') {
        recommendationType = 'DEMAND_BASED';
      } else {
        recommendationType = 'RATE_INCREASE';
      }
    } else {
      recommendationType = rateChangePercent < -20 ? 'MARKET_ADJUSTMENT' : 'RATE_DECREASE';
    }

    // Calculate projected impact
    const avgMonthlyHours = await this.getAvgMonthlyHours(userId, skillRate.skillId);
    const projectedMonthlyImpact = rateChange * avgMonthlyHours;
    const projectedYearlyImpact = projectedMonthlyImpact * 12;

    // Build reasoning
    const reasoning = this.buildRecommendationReasoning({
      skillRate,
      prediction,
      benchmark,
      rateChange,
    });

    // Build competitor analysis
    const competitorAnalysis: CompetitorAnalysis | null = benchmark
      ? {
          marketMedian: Number(benchmark.rateP50),
          yourPosition: skillRate.marketPosition as MarketPosition,
          topTierRate: Number(benchmark.rateP90),
          trend: benchmark.trendDirection as TrendDirection,
        }
      : null;

    const recommendation = await this.recommendationRepository.create({
      userId,
      recommendationType,
      scope: 'SKILL',
      skillId: skillRate.skillId,
      skillName: skillRate.skillName,
      currentRate: currentRate,
      recommendedRate,
      rateChange,
      rateChangePercent,
      projectedMonthlyImpact,
      projectedYearlyImpact,
      confidenceScore: Number(skillRate.confidenceScore),
      reasoning,
      marketPosition: skillRate.marketPosition as MarketPosition,
      competitorAnalysis,
      status: 'PENDING',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Valid for 30 days
    });

    // Notify user of significant recommendations
    if (
      Math.abs(rateChangePercent) >= 15 &&
      Number(skillRate.confidenceScore) >= 70 &&
      this.notificationService
    ) {
      await this.notificationService.send({
        userId,
        type: 'PRICING_RECOMMENDATION',
        data: {
          recommendationId: recommendation.id,
          skillName: skillRate.skillName,
          currentRate,
          recommendedRate,
          potentialImpact: projectedYearlyImpact,
        },
      });
    }

    return recommendation;
  }

  /**
   * Get active recommendations for a user
   */
  async getActiveRecommendations(userId: string): Promise<PricingRecommendation[]> {
    return this.recommendationRepository.findActive(userId);
  }

  /**
   * Get all recommendations with filters
   */
  async getRecommendations(
    userId: string,
    filters?: {
      status?: ('PENDING' | 'VIEWED' | 'APPLIED' | 'DISMISSED' | 'EXPIRED')[];
      skillId?: string;
      limit?: number;
    }
  ): Promise<PricingRecommendation[]> {
    const recommendations = await this.recommendationRepository.findByUser(userId, {
      status: filters?.status,
      skillId: filters?.skillId,
    });

    return filters?.limit ? recommendations.slice(0, filters.limit) : recommendations;
  }

  /**
   * Apply a recommendation
   */
  async applyRecommendation(
    userId: string,
    recommendationId: string
  ): Promise<{ success: boolean; updatedRate?: SkillRate }> {
    const recommendation = await this.recommendationRepository.findById(recommendationId);

    if (!recommendation || recommendation.userId !== userId) {
      throw new Error('Recommendation not found');
    }

    if (recommendation.status === 'APPLIED') {
      throw new Error('Recommendation already applied');
    }

    // Update the skill rate
    if (recommendation.skillId) {
      await this.skillRateRepository.update(recommendation.skillId, userId, {
        currentHourlyRate: Number(recommendation.recommendedRate),
      });

      // Record in rate history
      await this.rateHistoryRepository.create({
        userId,
        skillId: recommendation.skillId,
        skillName: recommendation.skillName || undefined,
        hourlyRate: Number(recommendation.recommendedRate),
        source: 'RECOMMENDATION',
        effectiveDate: new Date(),
      });

      // Update profile rate if applicable
      await this.cockpitDataService.updateProfileSkillRate(
        userId,
        recommendation.skillId,
        Number(recommendation.recommendedRate)
      );
    }

    // Mark recommendation as applied
    await this.recommendationRepository.markApplied(recommendationId);

    // Get updated skill rate
    const updatedRate = recommendation.skillId
      ? await this.skillRateRepository.findByUserAndSkill(userId, recommendation.skillId)
      : undefined;

    logger.info('Recommendation applied', {
      userId,
      recommendationId,
      skillId: recommendation.skillId,
      newRate: Number(recommendation.recommendedRate),
    });

    return { success: true, updatedRate: updatedRate || undefined };
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(
    userId: string,
    recommendationId: string,
    reason?: string
  ): Promise<void> {
    const recommendation = await this.recommendationRepository.findById(recommendationId);

    if (!recommendation || recommendation.userId !== userId) {
      throw new Error('Recommendation not found');
    }

    await this.recommendationRepository.markDismissed(recommendationId, reason);

    logger.info('Recommendation dismissed', {
      userId,
      recommendationId,
      reason,
    });
  }

  // ==================== Market Benchmarks ====================

  /**
   * Get benchmark for a skill
   */
  async getBenchmarkForSkill(
    skillId: string,
    region: string = 'GLOBAL'
  ): Promise<MarketRateBenchmark | null> {
    // Check cache
    const cacheKey = `benchmark:${skillId}:${region}`;
    const cached = await this.getCached<MarketRateBenchmark>(cacheKey);
    if (cached) return cached;

    // Get from database
    const benchmark = await this.benchmarkRepository.findLatest(skillId, region);

    if (benchmark) {
      await this.setCached(cacheKey, benchmark, 86400); // Cache for 24 hours
    }

    return benchmark;
  }

  /**
   * Update market benchmarks for a skill
   */
  async updateMarketBenchmarks(skillId: string): Promise<MarketRateBenchmark> {
    logger.info('Updating market benchmarks', { skillId });

    // Collect data from multiple sources
    const [marketData, externalRates] = await Promise.all([
      this.marketClient.getSkillRateData(skillId),
      this.externalRatesService.getRatesForSkill(skillId),
    ]);

    // Combine and weight data sources
    const allRates: Array<{ rate: number; level: string; weight: number; source: string }> = [];

    if (marketData?.rates) {
      allRates.push(
        ...marketData.rates.map((r) => ({
          rate: r.rate,
          level: r.level || 'INTERMEDIATE',
          weight: (r.weight || 1) * 2.0, // Higher weight for our platform
          source: 'market',
        }))
      );
    }

    if (externalRates?.rates) {
      allRates.push(
        ...externalRates.rates.map((r) => ({
          rate: r.rate,
          level: r.level || 'INTERMEDIATE',
          weight: r.weight || 1.0,
          source: 'external',
        }))
      );
    }

    if (allRates.length === 0) {
      throw new Error('No rate data available');
    }

    // Calculate percentiles
    const sortedRates = allRates.map((r) => r.rate).sort((a, b) => a - b);
    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * sortedRates.length) - 1;
      return sortedRates[Math.max(0, index)];
    };

    // Calculate by experience level
    const byLevel = this.calculateRatesByLevel(allRates);

    // Calculate demand score
    const demandScore = this.calculateDemandScore(marketData);

    // Get previous benchmark for trends
    const previousBenchmark = await this.benchmarkRepository.findPrevious(skillId, 'GLOBAL');
    const rateChangeMonthly = previousBenchmark
      ? ((percentile(50) - Number(previousBenchmark.rateP50)) / Number(previousBenchmark.rateP50)) *
        100
      : null;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const benchmark = await this.benchmarkRepository.upsert({
      skillId,
      skillName: marketData?.skillName || skillId,
      category: marketData?.category,
      region: 'GLOBAL',
      rateP10: percentile(10),
      rateP25: percentile(25),
      rateP50: percentile(50),
      rateP75: percentile(75),
      rateP90: percentile(90),
      rateMean: sortedRates.reduce((a, b) => a + b, 0) / sortedRates.length,
      beginnerRate: byLevel.beginner ?? undefined,
      intermediateRate: byLevel.intermediate ?? undefined,
      advancedRate: byLevel.advanced ?? undefined,
      expertRate: byLevel.expert ?? undefined,
      sampleSize: allRates.length,
      jobCount: marketData?.jobCount || 0,
      freelancerCount: marketData?.freelancerCount || 0,
      demandScore,
      rateChangeMonthly: rateChangeMonthly ?? undefined,
      trendDirection: this.determineTrendDirection(rateChangeMonthly),
      sources: ['market', 'upwork', 'fiverr', 'glassdoor'],
      periodStart,
      periodEnd,
      generatedAt: new Date(),
    });

    // Invalidate cache
    await this.redis.del(`benchmark:${skillId}:GLOBAL`);

    logger.info('Market benchmarks updated', {
      skillId,
      medianRate: percentile(50),
      sampleSize: allRates.length,
    });

    return benchmark;
  }

  // ==================== Revenue Projections ====================

  /**
   * Calculate revenue projections
   */
  async calculateRevenueProjections(
    userId: string,
    params?: {
      hourlyRate?: number;
      hoursPerWeek?: number;
      weeksPerYear?: number;
      utilizationRate?: number;
      monthlyExpenses?: number;
    }
  ): Promise<RevenueProjection[]> {
    // Get current data
    const currentRate = params?.hourlyRate || (await this.getCurrentAverageRate(userId));
    const currentHoursPerWeek = params?.hoursPerWeek || (await this.getAvgWeeklyHours(userId));
    const weeksPerYear = params?.weeksPerYear || 48;
    const utilizationRate = params?.utilizationRate || 75;
    const monthlyExpenses = params?.monthlyExpenses || (await this.getAvgMonthlyExpenses(userId));

    // Get recommended rate
    const skillRates = await this.skillRateRepository.findByUser(userId);
    const avgRecommendedRate =
      skillRates.length > 0
        ? skillRates.reduce((sum, r) => sum + Number(r.recommendedOptimalRate || 0), 0) /
          skillRates.length
        : currentRate * 1.2;

    // Define scenarios
    const scenarios: Array<{
      name: string;
      type: ScenarioType;
      rate: number;
      hours: number;
    }> = [
      {
        name: 'Current',
        type: 'CURRENT',
        rate: currentRate,
        hours: currentHoursPerWeek,
      },
      {
        name: 'Conservative Growth',
        type: 'CONSERVATIVE',
        rate: currentRate * 1.1,
        hours: currentHoursPerWeek,
      },
      {
        name: 'Moderate Growth',
        type: 'MODERATE',
        rate: avgRecommendedRate,
        hours: currentHoursPerWeek,
      },
      {
        name: 'Aggressive Growth',
        type: 'AGGRESSIVE',
        rate: avgRecommendedRate * 1.15,
        hours: Math.min(currentHoursPerWeek * 1.1, 50),
      },
    ];

    const projections: RevenueProjection[] = [];

    for (const scenario of scenarios) {
      const billableHours = scenario.hours * (utilizationRate / 100);
      const weeklyRevenue = scenario.rate * billableHours;
      const monthlyRevenue = weeklyRevenue * 4.33; // Average weeks per month
      const yearlyRevenue = weeklyRevenue * weeksPerYear;
      const yearlyExpenses = monthlyExpenses * 12;
      const yearlyNetIncome = yearlyRevenue - yearlyExpenses;
      const monthlyNetIncome = yearlyNetIncome / 12;

      // Compare to current
      const currentWeeklyRevenue = currentRate * currentHoursPerWeek * (utilizationRate / 100);
      const currentMonthlyRevenue = currentWeeklyRevenue * 4.33;
      const currentYearlyRevenue = currentWeeklyRevenue * weeksPerYear;

      const vsCurrentMonthly = monthlyRevenue - currentMonthlyRevenue;
      const vsCurrentYearly = yearlyRevenue - currentYearlyRevenue;

      const projection = await this.projectionRepository.upsert({
        userId,
        scenarioName: scenario.name,
        scenarioType: scenario.type,
        hourlyRate: scenario.rate,
        hoursPerWeek: scenario.hours,
        weeksPerYear,
        utilizationRate,
        weeklyRevenue,
        monthlyRevenue,
        yearlyRevenue,
        monthlyExpenses,
        yearlyExpenses,
        monthlyNetIncome,
        yearlyNetIncome,
        vsCurrentMonthly: scenario.type !== 'CURRENT' ? vsCurrentMonthly : undefined,
        vsCurrentYearly: scenario.type !== 'CURRENT' ? vsCurrentYearly : undefined,
        isActive: scenario.type === 'CURRENT',
      });

      projections.push(projection);
    }

    return projections;
  }

  /**
   * Create a custom projection
   */
  async createCustomProjection(
    userId: string,
    params: {
      name: string;
      hourlyRate: number;
      hoursPerWeek: number;
      weeksPerYear?: number;
      utilizationRate?: number;
      monthlyExpenses?: number;
    }
  ): Promise<RevenueProjection> {
    const weeksPerYear = params.weeksPerYear || 48;
    const utilizationRate = params.utilizationRate || 75;
    const monthlyExpenses = params.monthlyExpenses || 0;

    const billableHours = params.hoursPerWeek * (utilizationRate / 100);
    const weeklyRevenue = params.hourlyRate * billableHours;
    const monthlyRevenue = weeklyRevenue * 4.33;
    const yearlyRevenue = weeklyRevenue * weeksPerYear;
    const yearlyExpenses = monthlyExpenses * 12;
    const yearlyNetIncome = yearlyRevenue - yearlyExpenses;
    const monthlyNetIncome = yearlyNetIncome / 12;

    return this.projectionRepository.create({
      userId,
      scenarioName: params.name,
      scenarioType: 'CUSTOM',
      hourlyRate: params.hourlyRate,
      hoursPerWeek: params.hoursPerWeek,
      weeksPerYear,
      utilizationRate,
      weeklyRevenue,
      monthlyRevenue,
      yearlyRevenue,
      monthlyExpenses,
      yearlyExpenses,
      monthlyNetIncome,
      yearlyNetIncome,
      isActive: false,
    });
  }

  /**
   * Get projections for a user
   */
  async getProjections(userId: string): Promise<RevenueProjection[]> {
    return this.projectionRepository.findByUser(userId);
  }

  /**
   * Delete a custom projection
   */
  async deleteProjection(userId: string, projectionId: string): Promise<void> {
    const projection = await this.projectionRepository.findById(projectionId);

    if (!projection || projection.userId !== userId) {
      throw new Error('Projection not found');
    }

    if (projection.scenarioType !== 'CUSTOM') {
      throw new Error('Can only delete custom projections');
    }

    await this.projectionRepository.delete(projectionId);
  }

  // ==================== Rate History ====================

  /**
   * Get rate history for a user
   */
  async getRateHistory(
    userId: string,
    options?: { skillId?: string; months?: number }
  ): Promise<{ history: RateHistory[]; trend: { labels: string[]; rates: number[] } }> {
    const history = options?.skillId
      ? await this.rateHistoryRepository.findBySkill(userId, options.skillId)
      : await this.rateHistoryRepository.findRecent(userId, options?.months || 12);

    const trend = this.formatRateHistory(history);

    return { history, trend };
  }

  /**
   * Record a rate in history
   */
  async recordRate(
    userId: string,
    data: {
      skillId?: string;
      skillName?: string;
      hourlyRate: number;
      source: 'MANUAL' | 'PROJECT' | 'CONTRACT' | 'PROFILE' | 'RECOMMENDATION';
      projectId?: string;
      contractId?: string;
      clientRating?: number;
      projectSuccess?: boolean;
      repeatClient?: boolean;
    }
  ): Promise<RateHistory> {
    return this.rateHistoryRepository.create({
      userId,
      skillId: data.skillId,
      skillName: data.skillName,
      hourlyRate: data.hourlyRate,
      source: data.source,
      projectId: data.projectId,
      contractId: data.contractId,
      clientRating: data.clientRating,
      projectSuccess: data.projectSuccess,
      repeatClient: data.repeatClient,
      effectiveDate: new Date(),
    });
  }

  // ==================== Pricing Dashboard ====================

  /**
   * Get comprehensive pricing dashboard
   */
  async getPricingDashboard(userId: string): Promise<PricingDashboard> {
    const [skillRates, recommendations, projections, rateHistory] = await Promise.all([
      this.skillRateRepository.findByUser(userId),
      this.getActiveRecommendations(userId),
      this.projectionRepository.findByUser(userId),
      this.rateHistoryRepository.findRecent(userId, 12),
    ]);

    // Calculate overall stats
    const ratesWithCurrent = skillRates.filter((r) => r.currentHourlyRate);
    const avgCurrentRate =
      ratesWithCurrent.length > 0
        ? ratesWithCurrent.reduce((sum, r) => sum + Number(r.currentHourlyRate || 0), 0) /
          ratesWithCurrent.length
        : 0;

    const avgRecommendedRate =
      skillRates.length > 0
        ? skillRates.reduce((sum, r) => sum + Number(r.recommendedOptimalRate || 0), 0) /
          skillRates.length
        : 0;

    const potentialIncrease = avgRecommendedRate - avgCurrentRate;
    const avgConfidence =
      skillRates.length > 0
        ? skillRates.reduce((sum, r) => sum + Number(r.confidenceScore), 0) / skillRates.length
        : 0;

    // Find dominant market position
    const positionCounts = skillRates.reduce(
      (acc, r) => {
        acc[r.marketPosition] = (acc[r.marketPosition] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const dominantPosition =
      (Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as MarketPosition) ||
      'AVERAGE';

    // Calculate rate trend
    const rateTrend = this.calculateRateTrend(rateHistory);

    // Get current projection
    const currentProjection = projections.find((p) => p.scenarioType === 'CURRENT');
    const moderateProjection = projections.find((p) => p.scenarioType === 'MODERATE');

    return {
      overview: {
        avgCurrentRate,
        avgRecommendedRate,
        potentialIncrease,
        potentialIncreasePercent:
          avgCurrentRate > 0 ? (potentialIncrease / avgCurrentRate) * 100 : 0,
        avgConfidence,
        marketPosition: dominantPosition,
        rateTrend,
      },
      skillRates: skillRates.map((r) => ({
        skillId: r.skillId,
        skillName: r.skillName,
        currentRate: r.currentHourlyRate ? Number(r.currentHourlyRate) : null,
        recommendedRate: Number(r.recommendedOptimalRate),
        minRate: Number(r.recommendedMinRate),
        maxRate: Number(r.recommendedMaxRate),
        confidence: Number(r.confidenceScore),
        marketPosition: r.marketPosition as MarketPosition,
        marketDemand: r.marketDemand as MarketDemand,
        skillLevel: r.skillLevel,
      })),
      recommendations: recommendations.slice(0, 5).map((r) => ({
        id: r.id,
        type: r.recommendationType as PricingRecommendationType,
        skillName: r.skillName,
        currentRate: Number(r.currentRate),
        recommendedRate: Number(r.recommendedRate),
        changePercent: Number(r.rateChangePercent),
        yearlyImpact: Number(r.projectedYearlyImpact),
        confidence: Number(r.confidenceScore),
        reasoning: r.reasoning,
      })),
      projections: {
        current: currentProjection
          ? {
              monthly: Number(currentProjection.monthlyRevenue),
              yearly: Number(currentProjection.yearlyRevenue),
              netMonthly: Number(currentProjection.monthlyNetIncome),
              netYearly: Number(currentProjection.yearlyNetIncome),
            }
          : null,
        potential: moderateProjection
          ? {
              monthly: Number(moderateProjection.monthlyRevenue),
              yearly: Number(moderateProjection.yearlyRevenue),
              netMonthly: Number(moderateProjection.monthlyNetIncome),
              netYearly: Number(moderateProjection.yearlyNetIncome),
              increaseMonthly: Number(moderateProjection.vsCurrentMonthly),
              increaseYearly: Number(moderateProjection.vsCurrentYearly),
            }
          : null,
      },
      rateHistory: this.formatRateHistory(rateHistory),
    };
  }

  // ==================== Helper Methods ====================

  private buildFeatureVector(data: {
    skillVerification: SkillVerificationData | null;
    credentials: CredentialData[];
    projectHistory: ProjectHistoryData;
    marketBenchmark: MarketRateBenchmark | null;
    externalRates: { rates: any[]; median: number } | null;
    currentRate: number | null;
  }): RateFeatures {
    return {
      skillName: data.skillVerification?.skillName || '',
      skillLevel: data.skillVerification?.proficiencyLevel || 'INTERMEDIATE',
      verificationScore: data.skillVerification?.confidenceScore || 0,
      credentialCount: data.credentials.length,
      hasCertification: data.credentials.some((c) => c.type === 'CERTIFICATION'),
      yearsExperience: data.projectHistory.yearsExperience || 0,
      projectCount: data.projectHistory.projectCount || 0,
      avgRating: data.projectHistory.avgRating || 0,
      successRate: data.projectHistory.successRate || 0,
      repeatClientRate: data.projectHistory.repeatClientRate || 0,
      marketMedian: data.marketBenchmark ? Number(data.marketBenchmark.rateP50) : 50,
      marketP75: data.marketBenchmark ? Number(data.marketBenchmark.rateP75) : 75,
      marketP90: data.marketBenchmark ? Number(data.marketBenchmark.rateP90) : 100,
      demandScore: Number(data.marketBenchmark?.demandScore) || 50,
      competitionLevel: data.marketBenchmark?.freelancerCount || 1000,
      externalMedian: data.externalRates?.median || 50,
      currentRate: data.currentRate,
    };
  }

  private calculateConfidenceScore(factors: {
    hasVerification: boolean;
    verificationRecency?: Date;
    credentialCount: number;
    projectCount: number;
    avgRating: number;
    benchmarkSampleSize: number;
    mlConfidence: number;
  }): number {
    let score = 50; // Base score

    // Verification bonus
    if (factors.hasVerification) {
      score += 15;

      // Recency bonus
      if (factors.verificationRecency) {
        const daysSince =
          (Date.now() - factors.verificationRecency.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) score += 5;
        else if (daysSince < 90) score += 3;
      }
    }

    // Credential bonus
    score += Math.min(10, factors.credentialCount * 3);

    // Project history bonus
    if (factors.projectCount >= 10) score += 10;
    else if (factors.projectCount >= 5) score += 5;
    else if (factors.projectCount >= 1) score += 2;

    // Rating bonus
    if (factors.avgRating >= 4.8) score += 5;
    else if (factors.avgRating >= 4.5) score += 3;

    // Market data quality
    if (factors.benchmarkSampleSize >= 100) score += 5;
    else if (factors.benchmarkSampleSize >= 50) score += 3;

    // ML model confidence
    score = (score + factors.mlConfidence) / 2;

    return Math.min(100, Math.max(0, score));
  }

  private determineMarketPosition(
    rate: number,
    benchmark: MarketRateBenchmark | null
  ): MarketPosition {
    if (!benchmark) return 'AVERAGE';

    const p25 = Number(benchmark.rateP25);
    const p50 = Number(benchmark.rateP50);
    const p75 = Number(benchmark.rateP75);
    const p90 = Number(benchmark.rateP90);

    if (rate >= p90) return 'TOP_TIER';
    if (rate >= p75) return 'PREMIUM';
    if (rate >= p50) return 'ABOVE_AVERAGE';
    if (rate >= p25) return 'AVERAGE';
    if (rate >= p25 * 0.75) return 'BELOW_AVERAGE';
    return 'BUDGET';
  }

  private categorizeMarketDemand(demandScore: number | undefined): MarketDemand {
    if (!demandScore) return 'MODERATE';
    if (demandScore >= 80) return 'VERY_HIGH';
    if (demandScore >= 60) return 'HIGH';
    if (demandScore >= 40) return 'MODERATE';
    return 'LOW';
  }

  private categorizeCompetition(benchmark: MarketRateBenchmark | null): CompetitionLevel {
    if (!benchmark) return 'MEDIUM';

    const ratio = benchmark.freelancerCount / Math.max(1, benchmark.jobCount);

    if (ratio >= 10) return 'VERY_HIGH';
    if (ratio >= 5) return 'HIGH';
    if (ratio >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private buildRecommendationReasoning(data: {
    skillRate: SkillRate;
    prediction: RatePrediction;
    benchmark: MarketRateBenchmark | null;
    rateChange: number;
  }): RecommendationReason[] {
    const reasons: RecommendationReason[] = [];

    // Skill verification
    if (data.skillRate.verificationScore && Number(data.skillRate.verificationScore) >= 80) {
      reasons.push({
        factor: 'VERIFIED_SKILL',
        impact: 'positive',
        message: `Your ${data.skillRate.skillName} skill is verified at ${data.skillRate.skillLevel} level`,
        weight: 0.25,
      });
    }

    // Experience
    if (data.skillRate.projectsCompleted && data.skillRate.projectsCompleted >= 10) {
      reasons.push({
        factor: 'EXPERIENCE',
        impact: 'positive',
        message: `You've completed ${data.skillRate.projectsCompleted} projects with this skill`,
        weight: 0.2,
      });
    }

    // Client rating
    if (data.skillRate.avgClientRating && Number(data.skillRate.avgClientRating) >= 4.5) {
      reasons.push({
        factor: 'CLIENT_SATISFACTION',
        impact: 'positive',
        message: `Your average client rating of ${Number(data.skillRate.avgClientRating).toFixed(1)} supports premium pricing`,
        weight: 0.15,
      });
    }

    // Market position
    if (data.benchmark) {
      if (
        data.skillRate.marketPosition === 'BELOW_AVERAGE' ||
        data.skillRate.marketPosition === 'BUDGET'
      ) {
        reasons.push({
          factor: 'MARKET_POSITION',
          impact: data.rateChange > 0 ? 'opportunity' : 'neutral',
          message: `Your current rate is below market median of $${Number(data.benchmark.rateP50).toFixed(0)}/hr`,
          weight: 0.2,
        });
      }

      if (data.benchmark.trendDirection === 'RISING') {
        reasons.push({
          factor: 'MARKET_TREND',
          impact: 'positive',
          message: `Market rates for ${data.skillRate.skillName} are trending upward`,
          weight: 0.1,
        });
      }

      if (data.skillRate.marketDemand === 'HIGH' || data.skillRate.marketDemand === 'VERY_HIGH') {
        reasons.push({
          factor: 'DEMAND',
          impact: 'positive',
          message: `High market demand for ${data.skillRate.skillName}`,
          weight: 0.1,
        });
      }
    }

    return reasons;
  }

  private calculateRatesByLevel(rates: Array<{ rate: number; level: string; weight: number }>): {
    beginner: number | null;
    intermediate: number | null;
    advanced: number | null;
    expert: number | null;
  } {
    const byLevel: Record<string, number[]> = {
      BEGINNER: [],
      INTERMEDIATE: [],
      ADVANCED: [],
      EXPERT: [],
    };

    for (const rate of rates) {
      const level = rate.level.toUpperCase();
      if (byLevel[level]) {
        byLevel[level].push(rate.rate);
      }
    }

    const median = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    return {
      beginner: median(byLevel.BEGINNER),
      intermediate: median(byLevel.INTERMEDIATE),
      advanced: median(byLevel.ADVANCED),
      expert: median(byLevel.EXPERT),
    };
  }

  private calculateDemandScore(marketData: MarketSkillData | null): number {
    if (!marketData) return 50;

    let score = 50;

    if (marketData.jobCount > 1000) score += 15;
    else if (marketData.jobCount > 500) score += 10;
    else if (marketData.jobCount > 100) score += 5;

    if (marketData.jobGrowth > 20) score += 15;
    else if (marketData.jobGrowth > 10) score += 10;
    else if (marketData.jobGrowth > 0) score += 5;
    else if (marketData.jobGrowth < -10) score -= 10;

    const ratio = marketData.freelancerCount / Math.max(1, marketData.jobCount);
    if (ratio < 2) score += 10;
    else if (ratio < 5) score += 5;
    else if (ratio > 10) score -= 10;

    return Math.min(100, Math.max(0, score));
  }

  private determineTrendDirection(rateChangeMonthly: number | null): TrendDirection {
    if (rateChangeMonthly === null) return 'STABLE';
    if (rateChangeMonthly >= 5) return 'RAPIDLY_RISING';
    if (rateChangeMonthly >= 1) return 'RISING';
    if (rateChangeMonthly <= -3) return 'DECLINING';
    return 'STABLE';
  }

  private async getCurrentRateForSkill(userId: string, skillId: string): Promise<number | null> {
    const skillRate = await this.skillRateRepository.findByUserAndSkill(userId, skillId);
    return skillRate ? Number(skillRate.currentHourlyRate) : null;
  }

  private async getCurrentAverageRate(userId: string): Promise<number> {
    const history = await this.rateHistoryRepository.findRecent(userId, 6);
    if (history.length === 0) return 50;
    return history.reduce((sum, h) => sum + Number(h.hourlyRate), 0) / history.length;
  }

  private async getAvgMonthlyHours(userId: string, skillId?: string): Promise<number> {
    // Would query time tracking data
    return 120; // Default
  }

  private async getAvgWeeklyHours(userId: string): Promise<number> {
    // Would query time tracking data
    return 30; // Default
  }

  private async getAvgMonthlyExpenses(userId: string): Promise<number> {
    // Would query financial data
    return 500; // Default
  }

  private calculateRateTrend(history: RateHistory[]): {
    direction: 'UP' | 'DOWN' | 'STABLE';
    changePercent: number;
  } {
    if (history.length < 2) {
      return { direction: 'STABLE', changePercent: 0 };
    }

    const recent = history.slice(0, Math.ceil(history.length / 2));
    const older = history.slice(Math.ceil(history.length / 2));

    const recentAvg = recent.reduce((sum, h) => sum + Number(h.hourlyRate), 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + Number(h.hourlyRate), 0) / older.length;

    const changePercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    let direction: 'UP' | 'DOWN' | 'STABLE';
    if (changePercent >= 5) direction = 'UP';
    else if (changePercent <= -5) direction = 'DOWN';
    else direction = 'STABLE';

    return { direction, changePercent };
  }

  private formatRateHistory(history: RateHistory[]): {
    labels: string[];
    rates: number[];
  } {
    const monthly = new Map<string, number[]>();

    for (const entry of history) {
      const month = entry.effectiveDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      if (!monthly.has(month)) {
        monthly.set(month, []);
      }
      monthly.get(month)!.push(Number(entry.hourlyRate));
    }

    const labels: string[] = [];
    const rates: number[] = [];

    for (const [month, monthRates] of monthly) {
      labels.push(month);
      rates.push(monthRates.reduce((a, b) => a + b, 0) / monthRates.length);
    }

    return { labels: labels.reverse(), rates: rates.reverse() };
  }

  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached value', { error, key });
      return null;
    }
  }

  private async setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Failed to set cached value', { error, key });
    }
  }
}
