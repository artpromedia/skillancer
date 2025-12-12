/**
 * @module @skillancer/auth-svc/services/trust-score
 * Trust Score Service
 *
 * Main orchestrator for trust score operations:
 * - Fetches component data from various sources
 * - Coordinates score calculation
 * - Manages caching and persistence
 * - Handles trust score events
 */

import { createLogger } from '@skillancer/logger';

import {
  getTrustScoreCalculatorService,
  type TrustScoreCalculatorService,
} from './trust-score-calculator.service.js';

import type {
  ReviewScoreData,
  ComplianceScoreData,
  ComplianceEvent,
  VerificationScoreData,
  TenureScoreData,
  ActivityScoreData,
  TrustScoreResult,
  TrustScoreResponse,
  TrustScoreCalculationOptions,
  TrustScoreEvent,
  TrustScoreExplanation,
  TrustScoreHistoryEntry,
  TrustBadge,
  TrustBadgeType,
} from '../types/trust-score.types.js';
import type { TrustTier, Prisma, PrismaClient } from '@skillancer/database';
import type { Redis } from 'ioredis';

const logger = createLogger({ serviceName: 'trust-score-service' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Cache TTL for trust scores (1 hour) */
const CACHE_TTL_SECONDS = 3600;

/** Minimum interval between recalculations (5 minutes) */
const MIN_RECALC_INTERVAL_MS = 5 * 60 * 1000;

/** Cache key prefix */
const CACHE_KEY_PREFIX = 'trust-score:';

// =============================================================================
// TRUST SCORE SERVICE
// =============================================================================

export class TrustScoreService {
  private calculator: TrustScoreCalculatorService;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {
    this.calculator = getTrustScoreCalculatorService();
  }

  // ===========================================================================
  // MAIN PUBLIC METHODS
  // ===========================================================================

  /**
   * Get trust score for a user
   * Returns cached version if available and fresh enough
   */
  async getTrustScore(
    userId: string,
    options: TrustScoreCalculationOptions = {}
  ): Promise<TrustScoreResponse> {
    // Check cache first unless skipped
    if (!options.skipCache && !options.forceRecalculate) {
      const cached = await this.getCachedScore(userId);
      if (cached) {
        return {
          userId,
          score: cached,
          cached: true,
          cachedAt: cached.calculatedAt,
        };
      }
    }

    // Calculate fresh score
    const score = await this.calculateAndPersist(userId, options);
    return {
      userId,
      score,
      cached: false,
    };
  }

  /**
   * Recalculate trust score for a user
   * Forces a fresh calculation even if cached
   */
  async recalculateTrustScore(
    userId: string,
    trigger: string,
    options: TrustScoreCalculationOptions = {}
  ): Promise<TrustScoreResult> {
    const score = await this.calculateAndPersist(userId, {
      ...options,
      forceRecalculate: true,
    });

    // Record in history
    await this.recordHistory(userId, score, trigger);

    logger.info({
      msg: 'Trust score recalculated',
      userId,
      trigger,
      score: score.overallScore,
      tier: score.tier,
    });

    return score;
  }

  /**
   * Handle a trust score event
   * Determines if recalculation is needed based on event type
   */
  async handleTrustScoreEvent(event: TrustScoreEvent): Promise<void> {
    const { type, userId, priority } = event;

    // Check if recently recalculated (prevent spam)
    const lastCalc = await this.getLastCalculationTime(userId);
    if (lastCalc && Date.now() - lastCalc.getTime() < MIN_RECALC_INTERVAL_MS) {
      if (priority !== 'high') {
        logger.debug({
          msg: 'Skipping recalculation - too soon since last',
          userId,
          eventType: type,
        });
        return;
      }
    }

    // Recalculate based on event
    await this.recalculateTrustScore(userId, type, {
      includeFactors: true,
    });
  }

  /**
   * Get detailed explanation of trust score
   */
  async getTrustScoreExplanation(userId: string): Promise<TrustScoreExplanation> {
    const { score } = await this.getTrustScore(userId, { includeFactors: true });
    return this.buildExplanation(score);
  }

  /**
   * Get trust score history for a user
   */
  async getTrustScoreHistory(userId: string, limit = 30): Promise<TrustScoreHistoryEntry[]> {
    const history = await this.prisma.trustScoreHistory.findMany({
      where: { trustScore: { userId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        overallScore: true,
        reviewScore: true,
        complianceScore: true,
        verificationScore: true,
        tenureScore: true,
        activityScore: true,
        tier: true,
        triggerEvent: true,
        createdAt: true,
      },
    });

    return history.map((h) => ({
      id: h.id,
      overallScore: h.overallScore,
      components: {
        reviewScore: h.reviewScore,
        complianceScore: h.complianceScore,
        verificationScore: h.verificationScore,
        tenureScore: h.tenureScore,
        activityScore: h.activityScore,
      },
      tier: h.tier as TrustTier,
      triggerEvent: h.triggerEvent,
      createdAt: h.createdAt,
    }));
  }

  /**
   * Get earned trust badges for a user
   */
  async getEarnedBadges(userId: string): Promise<TrustBadge[]> {
    const { score } = await this.getTrustScore(userId);
    return this.determineBadges(score);
  }

  // ===========================================================================
  // CORE CALCULATION FLOW
  // ===========================================================================

  /**
   * Calculate and persist trust score
   */
  private async calculateAndPersist(
    userId: string,
    options: TrustScoreCalculationOptions
  ): Promise<TrustScoreResult> {
    // Fetch all component data in parallel
    const [reviewData, complianceData, verificationData, tenureData, activityData, previousScore] =
      await Promise.all([
        this.fetchReviewData(userId),
        this.fetchComplianceData(userId),
        this.fetchVerificationData(userId),
        this.fetchTenureData(userId),
        this.fetchActivityData(userId),
        this.getPreviousScore(userId),
      ]);

    // Calculate score
    const score = this.calculator.calculateTrustScore(
      reviewData,
      complianceData,
      verificationData,
      tenureData,
      activityData,
      previousScore,
      options
    );

    // Persist to database
    await this.persistScore(userId, score);

    // Cache the result
    await this.cacheScore(userId, score);

    return score;
  }

  // ===========================================================================
  // DATA FETCHING METHODS
  // ===========================================================================

  /**
   * Fetch review data for a user
   */
  private async fetchReviewData(userId: string): Promise<ReviewScoreData> {
    // Get aggregated review data
    const aggregation = await this.prisma.userRatingAggregation.findUnique({
      where: { userId },
    });

    if (!aggregation) {
      return {
        averageRating: 0,
        totalReviews: 0,
        recentReviews: 0,
        verifiedReviews: 0,
        responseRate: 0,
        avgResponseTime: 0,
      };
    }

    // Use freelancer ratings as primary (can be extended to combine both)
    const totalReviews = aggregation.freelancerTotalReviews + aggregation.clientTotalReviews;
    const avgRating =
      totalReviews > 0
        ? (Number(aggregation.freelancerAverageRating) * aggregation.freelancerTotalReviews +
            Number(aggregation.clientAverageRating) * aggregation.clientTotalReviews) /
          totalReviews
        : 0;

    // Get recent reviews count (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentReviews = await this.prisma.review.count({
      where: {
        revieweeId: userId,
        status: 'REVEALED',
        createdAt: { gte: ninetyDaysAgo },
      },
    });

    // Get verified reviews count (contract-based reviews are verified)
    const verifiedReviews = await this.prisma.review.count({
      where: {
        revieweeId: userId,
        status: 'REVEALED',
        contractId: { not: null },
      },
    });

    // Calculate response rate
    const totalWithResponse = await this.prisma.review.count({
      where: {
        revieweeId: userId,
        status: 'REVEALED',
        response: { isNot: null },
      },
    });

    const responseRate = totalReviews > 0 ? totalWithResponse / totalReviews : 0;

    // Estimate average response time (simplified)
    // In production, you'd track actual response times
    const avgResponseTime = 12; // Default assumption

    return {
      averageRating: avgRating,
      totalReviews,
      recentReviews,
      verifiedReviews,
      responseRate,
      avgResponseTime,
    };
  }

  /**
   * Fetch compliance data for a user
   * Note: SkillPodComplianceRecord tracks violations, not session completions
   */
  private async fetchComplianceData(userId: string): Promise<ComplianceScoreData> {
    // Get compliance records (which are violations)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const complianceRecords = await this.prisma.skillPodComplianceRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Get session count from sessions table if available, otherwise estimate from contracts
    // For now, use a simplified approach based on contracts/jobs
    const completedContracts = await this.prisma.contract.count({
      where: {
        OR: [{ freelancerId: userId }, { clientId: userId }],
        status: 'COMPLETED',
      },
    });

    // Estimate sessions - assume average 3 sessions per contract
    const estimatedSessions = Math.max(1, completedContracts * 3);

    if (complianceRecords.length === 0) {
      return {
        totalSessions: estimatedSessions,
        onTimeSessions: estimatedSessions,
        violationCount: 0,
        severityScore: 0,
        recentComplianceRate: 1,
        events: [],
      };
    }

    // All records are violations since that's what the compliance table tracks
    const violations = complianceRecords;
    const unresolvedViolations = violations.filter((v) => !v.isResolved);

    // Calculate severity score
    const severityWeights: Record<string, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 4,
      CRITICAL: 8,
    };
    const severityScore = violations.reduce(
      (sum, v) => sum + (severityWeights[v.severity] ?? 0),
      0
    );

    // Recent compliance rate - based on violations in last 30 days
    const recentViolations = violations.filter((r) => r.createdAt >= thirtyDaysAgo);
    // Higher violation count = lower compliance rate
    // Formula: 1 - (weighted violations / estimated sessions)
    const recentViolationScore = recentViolations.reduce(
      (sum, v) => sum + (severityWeights[v.severity] ?? 1),
      0
    );
    const recentComplianceRate = Math.max(
      0,
      1 - Math.min(1, recentViolationScore / (estimatedSessions * 2))
    );

    return {
      totalSessions: estimatedSessions,
      onTimeSessions: estimatedSessions - unresolvedViolations.length,
      violationCount: violations.length,
      severityScore,
      recentComplianceRate,
      events: complianceRecords.map((r) => {
        const event: ComplianceEvent = {
          eventType: r.eventType,
          severity: r.severity,
          createdAt: r.createdAt,
          isResolved: r.isResolved,
        };
        if (r.metadata) {
          event.metadata = r.metadata as Record<string, unknown>;
        }
        return event;
      }),
    };
  }

  /**
   * Fetch verification data for a user
   */
  private async fetchVerificationData(userId: string): Promise<VerificationScoreData> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        verificationLevel: true,
        status: true,
        skills: true,
        portfolioItems: true,
        paymentMethods: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!user) {
      return {
        verificationLevel: 0,
        identityVerified: false,
        emailVerified: false,
        phoneVerified: false,
        paymentVerified: false,
        skillsVerified: 0,
        totalSkills: 0,
        portfolioVerified: 0,
      };
    }

    // Map verification level string to number
    const levelMap: Record<string, number> = {
      NONE: 0,
      EMAIL: 1,
      BASIC: 2,
      ENHANCED: 3,
      PREMIUM: 4,
    };

    // Determine email verification based on verification level or status
    const emailVerified = user.verificationLevel !== 'NONE' || user.status === 'ACTIVE';

    return {
      verificationLevel: levelMap[user.verificationLevel] ?? 0,
      identityVerified:
        user.verificationLevel === 'ENHANCED' || user.verificationLevel === 'PREMIUM',
      emailVerified,
      phoneVerified: user.verificationLevel !== 'NONE' && user.verificationLevel !== 'EMAIL',
      paymentVerified: user.paymentMethods.length > 0,
      skillsVerified: user.skills.length, // Consider all claimed skills as verified for now
      totalSkills: user.skills.length,
      portfolioVerified: user.portfolioItems.length,
    };
  }

  /**
   * Fetch tenure data for a user
   */
  private async fetchTenureData(userId: string): Promise<TenureScoreData> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        status: true,
        auditLogs: {
          where: {
            action: {
              in: ['ACCOUNT_WARNING', 'ACCOUNT_SUSPENDED'],
            },
          },
          select: { createdAt: true },
        },
      },
    });

    if (!user) {
      return {
        accountCreatedAt: new Date(),
        tenureDays: 0,
        goodStanding: true,
        warningCount: 0,
      };
    }

    // Get first completed contract date
    const firstContract = await this.prisma.contract.findFirst({
      where: {
        OR: [{ clientId: userId }, { freelancerId: userId }],
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const tenureDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    return {
      accountCreatedAt: user.createdAt,
      tenureDays,
      firstTransactionAt: firstContract?.createdAt,
      goodStanding: user.status === 'ACTIVE',
      warningCount: user.auditLogs.length,
    };
  }

  /**
   * Fetch activity data for a user
   */
  private async fetchActivityData(userId: string): Promise<ActivityScoreData> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        lastLoginAt: true,
        avatarUrl: true,
        bio: true,
        profile: {
          select: {
            bio: true,
            title: true,
            completenessScore: true,
          },
        },
      },
    });

    if (!user) {
      return {
        lastLoginAt: new Date(),
        daysSinceActivity: 0,
        avgLoginsPerMonth: 0,
        profileCompleteness: 0,
        messageResponseRate: 0,
        avgMessageResponseTime: 24,
      };
    }

    const lastLoginAt = user.lastLoginAt ?? new Date();
    const daysSinceActivity = Math.floor(
      (Date.now() - lastLoginAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate profile completeness
    let completeness = 0;
    if (user.bio || user.profile?.bio) completeness += 0.3;
    if (user.profile?.title) completeness += 0.2;
    if (user.avatarUrl) completeness += 0.2;

    // Use pre-calculated completeness if available
    if (user.profile?.completenessScore) {
      completeness = Math.max(completeness, user.profile.completenessScore / 100);
    }

    // Check skills
    const skillCount = await this.prisma.userSkill.count({
      where: { userId },
    });
    if (skillCount > 0) completeness += 0.15;
    if (skillCount >= 3) completeness += 0.15;

    // Get message response metrics
    const sentMessages = await this.prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    const receivedMessages = await this.prisma.message.count({
      where: {
        receiverId: userId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    const messageResponseRate =
      receivedMessages > 0 ? Math.min(sentMessages / receivedMessages, 1) : 1;

    // Estimate average logins per month (simplified)
    // In production, you'd track actual login history
    const avgLoginsPerMonth = daysSinceActivity < 7 ? 10 : daysSinceActivity < 30 ? 5 : 2;

    return {
      lastLoginAt,
      daysSinceActivity,
      avgLoginsPerMonth,
      profileCompleteness: Math.min(completeness, 1),
      messageResponseRate,
      avgMessageResponseTime: 12, // Default assumption
    };
  }

  // ===========================================================================
  // PERSISTENCE METHODS
  // ===========================================================================

  /**
   * Get previous trust score for trend calculation
   */
  private async getPreviousScore(userId: string): Promise<number | null> {
    const existing = await this.prisma.trustScore.findUnique({
      where: { userId },
      select: { overallScore: true },
    });
    return existing?.overallScore ?? null;
  }

  /**
   * Persist trust score to database
   */
  private async persistScore(userId: string, score: TrustScoreResult): Promise<void> {
    await this.prisma.trustScore.upsert({
      where: { userId },
      create: {
        userId,
        overallScore: score.overallScore,
        reviewScore: score.components.reviewScore,
        complianceScore: score.components.complianceScore,
        verificationScore: score.components.verificationScore,
        tenureScore: score.components.tenureScore,
        activityScore: score.components.activityScore,
        reviewWeight: score.weights.reviewWeight,
        complianceWeight: score.weights.complianceWeight,
        verificationWeight: score.weights.verificationWeight,
        tenureWeight: score.weights.tenureWeight,
        activityWeight: score.weights.activityWeight,
        tier: score.tier,
        trend: score.trend,
        scoreChangeAmount: score.scoreChangeAmount,
        factors: score.factors as unknown as Prisma.InputJsonValue,
        lastCalculatedAt: score.calculatedAt,
      },
      update: {
        overallScore: score.overallScore,
        reviewScore: score.components.reviewScore,
        complianceScore: score.components.complianceScore,
        verificationScore: score.components.verificationScore,
        tenureScore: score.components.tenureScore,
        activityScore: score.components.activityScore,
        reviewWeight: score.weights.reviewWeight,
        complianceWeight: score.weights.complianceWeight,
        verificationWeight: score.weights.verificationWeight,
        tenureWeight: score.weights.tenureWeight,
        activityWeight: score.weights.activityWeight,
        tier: score.tier,
        trend: score.trend,
        scoreChangeAmount: score.scoreChangeAmount,
        factors: score.factors as unknown as Prisma.InputJsonValue,
        lastCalculatedAt: score.calculatedAt,
      },
    });
  }

  /**
   * Record history entry for score changes
   */
  private async recordHistory(
    userId: string,
    score: TrustScoreResult,
    triggerEvent: string
  ): Promise<void> {
    const trustScore = await this.prisma.trustScore.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!trustScore) return;

    await this.prisma.trustScoreHistory.create({
      data: {
        trustScoreId: trustScore.id,
        overallScore: score.overallScore,
        reviewScore: score.components.reviewScore,
        complianceScore: score.components.complianceScore,
        verificationScore: score.components.verificationScore,
        tenureScore: score.components.tenureScore,
        activityScore: score.components.activityScore,
        tier: score.tier,
        triggerEvent,
      },
    });
  }

  /**
   * Get last calculation timestamp
   */
  private async getLastCalculationTime(userId: string): Promise<Date | null> {
    const score = await this.prisma.trustScore.findUnique({
      where: { userId },
      select: { lastCalculatedAt: true },
    });
    return score?.lastCalculatedAt ?? null;
  }

  // ===========================================================================
  // CACHING METHODS
  // ===========================================================================

  /**
   * Cache trust score in Redis
   */
  private async cacheScore(userId: string, score: TrustScoreResult): Promise<void> {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    try {
      await this.redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(score));
    } catch (error) {
      logger.warn({ msg: 'Failed to cache trust score', userId, error });
    }
  }

  /**
   * Get cached trust score
   */
  private async getCachedScore(userId: string): Promise<TrustScoreResult | null> {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as TrustScoreResult;
        // Restore Date object
        parsed.calculatedAt = new Date(parsed.calculatedAt);
        return parsed;
      }
    } catch (error) {
      logger.warn({ msg: 'Failed to get cached trust score', userId, error });
    }
    return null;
  }

  /**
   * Invalidate cached trust score
   */
  async invalidateCache(userId: string): Promise<void> {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.warn({ msg: 'Failed to invalidate trust score cache', userId, error });
    }
  }

  // ===========================================================================
  // EXPLANATION & BADGES
  // ===========================================================================

  /**
   * Build detailed explanation for display
   */
  private buildExplanation(score: TrustScoreResult): TrustScoreExplanation {
    const components = [
      {
        name: 'Reviews & Ratings',
        score: score.components.reviewScore,
        weight: score.weights.reviewWeight,
        contribution: score.components.reviewScore * score.weights.reviewWeight,
        status: this.getComponentStatus(score.components.reviewScore),
        tips: this.getReviewTips(score.components.reviewScore),
      },
      {
        name: 'SkillPod Compliance',
        score: score.components.complianceScore,
        weight: score.weights.complianceWeight,
        contribution: score.components.complianceScore * score.weights.complianceWeight,
        status: this.getComponentStatus(score.components.complianceScore),
        tips: this.getComplianceTips(score.components.complianceScore),
      },
      {
        name: 'Verification',
        score: score.components.verificationScore,
        weight: score.weights.verificationWeight,
        contribution: score.components.verificationScore * score.weights.verificationWeight,
        status: this.getComponentStatus(score.components.verificationScore),
        tips: this.getVerificationTips(score.components.verificationScore),
      },
      {
        name: 'Platform Tenure',
        score: score.components.tenureScore,
        weight: score.weights.tenureWeight,
        contribution: score.components.tenureScore * score.weights.tenureWeight,
        status: this.getComponentStatus(score.components.tenureScore),
        tips: this.getTenureTips(score.components.tenureScore),
      },
      {
        name: 'Activity',
        score: score.components.activityScore,
        weight: score.weights.activityWeight,
        contribution: score.components.activityScore * score.weights.activityWeight,
        status: this.getComponentStatus(score.components.activityScore),
        tips: this.getActivityTips(score.components.activityScore),
      },
    ];

    const improvementPriorities = this.calculator
      .getImprovementSuggestions(score.components, score.weights)
      .slice(0, 3)
      .map((s) => ({
        component: s.component,
        potentialGain: Math.round(s.potentialGain * 10) / 10,
        actionRequired: s.suggestion,
      }));

    return {
      overallScore: score.overallScore,
      tier: score.tier,
      tierDescription: this.calculator.getTierDescription(score.tier),
      trend: score.trend,
      trendDescription: this.calculator.getTrendDescription(score.trend, score.scoreChangeAmount),
      components,
      improvementPriorities,
    };
  }

  private getComponentStatus(score: number): 'excellent' | 'good' | 'fair' | 'needs-improvement' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'needs-improvement';
  }

  private getReviewTips(score: number): string[] {
    const tips: string[] = [];
    if (score < 60) tips.push('Complete more projects to get reviews');
    if (score < 80) tips.push('Respond to reviews to show engagement');
    if (score >= 80) tips.push('Keep up the great work!');
    return tips;
  }

  private getComplianceTips(score: number): string[] {
    const tips: string[] = [];
    if (score < 60) tips.push('Complete SkillPod sessions on time');
    if (score < 80) tips.push('Follow all platform guidelines');
    if (score >= 80) tips.push('Excellent compliance record!');
    return tips;
  }

  private getVerificationTips(score: number): string[] {
    const tips: string[] = [];
    if (score < 40) tips.push('Verify your email and phone number');
    if (score < 60) tips.push('Complete identity verification');
    if (score < 80) tips.push('Add verified skills to your profile');
    return tips;
  }

  private getTenureTips(score: number): string[] {
    const tips: string[] = [];
    if (score < 40) tips.push('Your score will improve as you build history');
    if (score >= 60) tips.push('Your platform tenure is helping your score');
    return tips;
  }

  private getActivityTips(score: number): string[] {
    const tips: string[] = [];
    if (score < 40) tips.push('Log in regularly to stay active');
    if (score < 60) tips.push('Complete your profile');
    if (score < 80) tips.push('Respond promptly to messages');
    return tips;
  }

  /**
   * Determine earned badges based on score
   */
  private determineBadges(score: TrustScoreResult): TrustBadge[] {
    const badges: TrustBadge[] = [];

    // Tier-based badges
    const tierBadgeMap: Record<TrustTier, TrustBadgeType | null> = {
      EMERGING: 'new-member',
      ESTABLISHED: 'rising-star',
      TRUSTED: 'trusted',
      HIGHLY_TRUSTED: 'top-rated',
      ELITE: 'elite',
    };

    const tierBadge = tierBadgeMap[score.tier];
    if (tierBadge) {
      badges.push({
        type: tierBadge,
        name: this.getBadgeName(tierBadge),
        description: this.getBadgeDescription(tierBadge),
        earnedAt: new Date(),
        requirements: {
          minTier: score.tier,
        },
      });
    }

    // Compliance champion badge
    if (score.components.complianceScore >= 95) {
      badges.push({
        type: 'compliance-champion',
        name: 'Compliance Champion',
        description: 'Exceptional SkillPod compliance record',
        earnedAt: new Date(),
        requirements: {
          minScore: 95,
          additionalCriteria: ['95+ compliance score'],
        },
      });
    }

    // Verified pro badge
    if (score.components.verificationScore >= 90) {
      badges.push({
        type: 'verified-pro',
        name: 'Verified Professional',
        description: 'Fully verified identity and credentials',
        earnedAt: new Date(),
        requirements: {
          minScore: 90,
          additionalCriteria: ['Complete verification'],
        },
      });
    }

    return badges;
  }

  private getBadgeName(type: TrustBadgeType): string {
    const names: Record<TrustBadgeType, string> = {
      'new-member': 'New Member',
      'rising-star': 'Rising Star',
      trusted: 'Trusted',
      'top-rated': 'Top Rated',
      elite: 'Elite',
      'compliance-champion': 'Compliance Champion',
      'verified-pro': 'Verified Pro',
    };
    return names[type];
  }

  private getBadgeDescription(type: TrustBadgeType): string {
    const descriptions: Record<TrustBadgeType, string> = {
      'new-member': 'Welcome to the Skillancer community',
      'rising-star': 'Building a strong reputation',
      trusted: 'Established and trusted member',
      'top-rated': 'Among the highest rated members',
      elite: 'Top tier member with exceptional trust',
      'compliance-champion': 'Exceptional compliance record',
      'verified-pro': 'Fully verified credentials',
    };
    return descriptions[type];
  }
}

// =============================================================================
// MODULE INITIALIZATION
// =============================================================================

let trustScoreService: TrustScoreService | null = null;

/**
 * Initialize the trust score service
 */
export function initializeTrustScoreService(prisma: PrismaClient, redis: Redis): TrustScoreService {
  trustScoreService = new TrustScoreService(prisma, redis);
  logger.info({ msg: 'Trust score service initialized' });
  return trustScoreService;
}

/**
 * Get the initialized trust score service
 */
export function getTrustScoreService(): TrustScoreService {
  if (!trustScoreService) {
    throw new Error('Trust score service not initialized. Call initializeTrustScoreService first.');
  }
  return trustScoreService;
}
