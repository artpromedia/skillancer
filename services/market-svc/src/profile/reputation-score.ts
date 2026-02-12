// @ts-nocheck
/**
 * Reputation Score Service
 * Cross-platform reputation calculation with weighted factors
 * Sprint M4: Portable Verified Work History
 */

import { createLogger } from '@skillancer/logger';
import { prisma } from '@skillancer/database';
import { Platform, VerificationLevel } from '../integrations/platform-connector';

const logger = createLogger('reputation-score');

// =============================================================================
// TYPES
// =============================================================================

export interface ReputationScore {
  userId: string;
  overallScore: number; // 0-100
  tier: ReputationTier;

  // Component scores (0-100 each)
  components: {
    earnings: ComponentScore;
    reviews: ComponentScore;
    completion: ComponentScore;
    responsiveness: ComponentScore;
    profile: ComponentScore;
    credentials: ComponentScore;
  };

  // Historical data
  history: ScoreHistory[];
  trend: 'rising' | 'stable' | 'declining';

  // Breakdown by platform
  platformScores: Record<Platform, number>;

  // Badges and achievements
  badges: ReputationBadge[];

  // Percentile
  percentile: number;

  // Metadata
  calculatedAt: Date;
  dataPoints: number;
}

export type ReputationTier = 'rising' | 'established' | 'expert' | 'elite' | 'legendary';

export interface ComponentScore {
  score: number;
  weight: number;
  contributionToTotal: number;
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  name: string;
  value: number;
  impact: number;
  description: string;
}

export interface ScoreHistory {
  date: Date;
  score: number;
  tier: ReputationTier;
  change: number;
}

export interface ReputationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: Date;
  category: 'achievement' | 'milestone' | 'skill' | 'verification';
}

// =============================================================================
// SCORING CONFIGURATION
// =============================================================================

const SCORE_WEIGHTS = {
  earnings: 0.3, // 30% - Total verified earnings
  reviews: 0.25, // 25% - Review ratings and count
  completion: 0.15, // 15% - Project completion rate
  responsiveness: 0.1, // 10% - Response time and availability
  profile: 0.1, // 10% - Profile completeness and verification
  credentials: 0.1, // 10% - Verified credentials
};

const TIER_THRESHOLDS = {
  legendary: 95,
  elite: 85,
  expert: 70,
  established: 50,
  rising: 0,
};

const BADGE_DEFINITIONS: Record<string, Omit<ReputationBadge, 'id' | 'earnedAt'>> = {
  first_verified_project: {
    name: 'Verified Pro',
    description: 'Completed first verified project',
    icon: '✓',
    category: 'milestone',
  },
  earnings_10k: {
    name: '$10K Earner',
    description: 'Earned over $10,000 in verified earnings',
    icon: '💰',
    category: 'milestone',
  },
  earnings_100k: {
    name: '$100K Earner',
    description: 'Earned over $100,000 in verified earnings',
    icon: '💎',
    category: 'milestone',
  },
  perfect_rating: {
    name: 'Perfect 5',
    description: 'Maintained 5-star rating across 10+ reviews',
    icon: '⭐',
    category: 'achievement',
  },
  multi_platform: {
    name: 'Multi-Platform Pro',
    description: 'Connected and verified on 3+ platforms',
    icon: '🔗',
    category: 'verification',
  },
  quick_responder: {
    name: 'Quick Responder',
    description: 'Average response time under 1 hour',
    icon: '⚡',
    category: 'achievement',
  },
  skill_master: {
    name: 'Skill Master',
    description: 'Expert level in 5+ verified skills',
    icon: '🎯',
    category: 'skill',
  },
  blockchain_verified: {
    name: 'Blockchain Verified',
    description: 'Work history anchored on blockchain',
    icon: '🔐',
    category: 'verification',
  },
};

// =============================================================================
// REPUTATION SCORE SERVICE
// =============================================================================

export class ReputationScoreService {
  // ---------------------------------------------------------------------------
  // MAIN CALCULATION
  // ---------------------------------------------------------------------------

  /**
   * Calculate comprehensive reputation score
   */
  async calculateReputationScore(userId: string): Promise<ReputationScore> {
    logger.info({ userId }, 'Calculating reputation score');

    // Get all relevant data
    const data = await this.fetchUserData(userId);

    // Calculate component scores
    const earnings = this.calculateEarningsScore(data);
    const reviews = this.calculateReviewsScore(data);
    const completion = this.calculateCompletionScore(data);
    const responsiveness = this.calculateResponsivenessScore(data);
    const profile = this.calculateProfileScore(data);
    const credentials = this.calculateCredentialsScore(data);

    // Calculate overall score
    const overallScore = Math.round(
      earnings.score * SCORE_WEIGHTS.earnings +
        reviews.score * SCORE_WEIGHTS.reviews +
        completion.score * SCORE_WEIGHTS.completion +
        responsiveness.score * SCORE_WEIGHTS.responsiveness +
        profile.score * SCORE_WEIGHTS.profile +
        credentials.score * SCORE_WEIGHTS.credentials
    );

    // Determine tier
    const tier = this.determineTier(overallScore);

    // Calculate platform scores
    const platformScores = this.calculatePlatformScores(data);

    // Get historical data and trend
    const history = await this.getScoreHistory(userId);
    const trend = this.calculateTrend(history, overallScore);

    // Check for badges
    const badges = await this.evaluateBadges(userId, data, overallScore);

    // Calculate percentile
    const percentile = await this.calculatePercentile(overallScore);

    const score: ReputationScore = {
      userId,
      overallScore,
      tier,
      components: {
        earnings: { ...earnings, weight: SCORE_WEIGHTS.earnings },
        reviews: { ...reviews, weight: SCORE_WEIGHTS.reviews },
        completion: { ...completion, weight: SCORE_WEIGHTS.completion },
        responsiveness: { ...responsiveness, weight: SCORE_WEIGHTS.responsiveness },
        profile: { ...profile, weight: SCORE_WEIGHTS.profile },
        credentials: { ...credentials, weight: SCORE_WEIGHTS.credentials },
      },
      history,
      trend,
      platformScores,
      badges,
      percentile,
      calculatedAt: new Date(),
      dataPoints: data.workHistory.length + data.reviews.length,
    };

    // Store score
    await this.storeScore(score);

    logger.info({ userId, overallScore, tier }, 'Reputation score calculated');

    return score;
  }

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------

  private async fetchUserData(userId: string): Promise<{
    user: any;
    workHistory: any[];
    reviews: any[];
    connections: any[];
    credentials: any[];
    profile: any;
  }> {
    const [user, workHistory, reviews, connections, credentials, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.workHistory.findMany({
        where: { userId },
        include: { reviews: true },
      }),
      prisma.review.findMany({ where: { userId } }),
      prisma.platformConnection.findMany({ where: { userId } }),
      prisma.verifiableCredential.findMany({
        where: { subjectId: { contains: userId }, revoked: false },
      }),
      prisma.unifiedProfile.findUnique({ where: { userId } }),
    ]);

    return {
      user,
      workHistory,
      reviews: reviews.concat(workHistory.flatMap((wh) => wh.reviews || [])),
      connections,
      credentials,
      profile,
    };
  }

  // ---------------------------------------------------------------------------
  // COMPONENT SCORE CALCULATIONS
  // ---------------------------------------------------------------------------

  private calculateEarningsScore(data: any): Omit<ComponentScore, 'weight'> {
    const factors: ScoreFactor[] = [];
    let score = 0;

    // Factor 1: Total verified earnings
    const verifiedWorkHistory = data.workHistory.filter(
      (wh: any) => wh.verificationLevel !== VerificationLevel.SELF_REPORTED
    );
    const totalVerifiedEarnings = verifiedWorkHistory.reduce(
      (sum: number, wh: any) => sum + (wh.earnings || 0),
      0
    );

    // Logarithmic scale: $0-1K = 0-20, $1K-10K = 20-40, $10K-100K = 40-70, $100K+ = 70-100
    let earningsPoints = 0;
    if (totalVerifiedEarnings >= 100000) {
      earningsPoints = 70 + Math.min((totalVerifiedEarnings - 100000) / 10000, 30);
    } else if (totalVerifiedEarnings >= 10000) {
      earningsPoints = 40 + ((totalVerifiedEarnings - 10000) / 90000) * 30;
    } else if (totalVerifiedEarnings >= 1000) {
      earningsPoints = 20 + ((totalVerifiedEarnings - 1000) / 9000) * 20;
    } else {
      earningsPoints = (totalVerifiedEarnings / 1000) * 20;
    }

    factors.push({
      name: 'Verified Earnings',
      value: totalVerifiedEarnings,
      impact: earningsPoints * 0.7,
      description: `$${totalVerifiedEarnings.toLocaleString()} verified across platforms`,
    });

    // Factor 2: Earnings growth (if history available)
    const earningsGrowth = this.calculateEarningsGrowth(data.workHistory);
    const growthPoints = Math.max(0, Math.min(earningsGrowth * 5, 30));

    factors.push({
      name: 'Earnings Growth',
      value: earningsGrowth,
      impact: growthPoints * 0.3,
      description: `${earningsGrowth > 0 ? '+' : ''}${(earningsGrowth * 100).toFixed(0)}% YoY growth`,
    });

    score = Math.min(100, earningsPoints * 0.7 + growthPoints * 0.3);

    return {
      score: Math.round(score),
      contributionToTotal: Math.round(score * SCORE_WEIGHTS.earnings),
      factors,
    };
  }

  private calculateReviewsScore(data: any): Omit<ComponentScore, 'weight'> {
    const factors: ScoreFactor[] = [];
    const reviews = data.reviews;

    if (reviews.length === 0) {
      return {
        score: 0,
        contributionToTotal: 0,
        factors: [
          {
            name: 'No Reviews',
            value: 0,
            impact: 0,
            description: 'No reviews yet',
          },
        ],
      };
    }

    // Factor 1: Average rating
    const avgRating =
      reviews.reduce((sum: number, r: any) => sum + r.rating / (r.maxRating || 5), 0) /
      reviews.length;
    const ratingPoints = avgRating * 100; // 0-100 based on 0-1 normalized rating

    factors.push({
      name: 'Average Rating',
      value: avgRating * 5,
      impact: ratingPoints * 0.5,
      description: `${(avgRating * 5).toFixed(1)}/5 average rating`,
    });

    // Factor 2: Review count (diminishing returns after 20)
    const countPoints = Math.min(reviews.length * 3, 60);

    factors.push({
      name: 'Review Count',
      value: reviews.length,
      impact: countPoints * 0.3,
      description: `${reviews.length} total reviews`,
    });

    // Factor 3: Recent review trend
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentReviews = reviews.filter(
      (r: any) => r.reviewDate && new Date(r.reviewDate) > sixMonthsAgo
    );
    const recentAvg =
      recentReviews.length > 0
        ? recentReviews.reduce((sum: number, r: any) => sum + r.rating / (r.maxRating || 5), 0) /
          recentReviews.length
        : avgRating;

    const trendBonus = (recentAvg - avgRating) * 50; // +/- 25 points max

    factors.push({
      name: 'Recent Trend',
      value: recentAvg * 5,
      impact: Math.max(-10, Math.min(trendBonus * 0.2, 10)),
      description: recentAvg > avgRating ? 'Improving reviews' : 'Consistent performance',
    });

    const score = Math.min(100, ratingPoints * 0.5 + countPoints * 0.3 + trendBonus * 0.2);

    return {
      score: Math.round(Math.max(0, score)),
      contributionToTotal: Math.round(score * SCORE_WEIGHTS.reviews),
      factors,
    };
  }

  private calculateCompletionScore(data: any): Omit<ComponentScore, 'weight'> {
    const factors: ScoreFactor[] = [];
    const workHistory = data.workHistory;

    if (workHistory.length === 0) {
      return {
        score: 0,
        contributionToTotal: 0,
        factors: [
          {
            name: 'No Projects',
            value: 0,
            impact: 0,
            description: 'No projects yet',
          },
        ],
      };
    }

    // Factor 1: Completion rate
    const completed = workHistory.filter((wh: any) => wh.status === 'COMPLETED').length;
    const completionRate = completed / workHistory.length;
    const completionPoints = completionRate * 100;

    factors.push({
      name: 'Completion Rate',
      value: completionRate,
      impact: completionPoints * 0.7,
      description: `${(completionRate * 100).toFixed(0)}% projects completed`,
    });

    // Factor 2: On-time delivery (if data available)
    const onTimeProjects = workHistory.filter((wh: any) => wh.deliveredOnTime).length;
    const onTimeRate = workHistory.some((wh: any) => wh.deliveredOnTime !== undefined)
      ? onTimeProjects / workHistory.length
      : 0.8; // Default assumption
    const onTimePoints = onTimeRate * 100;

    factors.push({
      name: 'On-Time Delivery',
      value: onTimeRate,
      impact: onTimePoints * 0.3,
      description: `${(onTimeRate * 100).toFixed(0)}% delivered on time`,
    });

    const score = completionPoints * 0.7 + onTimePoints * 0.3;

    return {
      score: Math.round(score),
      contributionToTotal: Math.round(score * SCORE_WEIGHTS.completion),
      factors,
    };
  }

  private calculateResponsivenessScore(data: any): Omit<ComponentScore, 'weight'> {
    const factors: ScoreFactor[] = [];

    // Default score if no response time data
    let score = 70;

    // Factor 1: Average response time (if tracked)
    const avgResponseTime = data.user?.avgResponseTimeHours;
    if (avgResponseTime !== undefined) {
      // Under 1 hour = 100, under 4 hours = 80, under 24 hours = 60, over 24 hours = 40
      let responsePoints = 40;
      if (avgResponseTime < 1) responsePoints = 100;
      else if (avgResponseTime < 4) responsePoints = 80;
      else if (avgResponseTime < 24) responsePoints = 60;

      factors.push({
        name: 'Response Time',
        value: avgResponseTime,
        impact: responsePoints * 0.7,
        description: `Average ${avgResponseTime < 1 ? 'under 1 hour' : `${avgResponseTime.toFixed(0)} hours`}`,
      });

      score = responsePoints;
    } else {
      factors.push({
        name: 'Response Time',
        value: null,
        impact: 50,
        description: 'No response time data',
      });
    }

    // Factor 2: Active connections (proxy for availability)
    const activeConnections = data.connections.filter((c: any) => c.isActive).length;
    const activityBonus = Math.min(activeConnections * 5, 20);

    factors.push({
      name: 'Platform Activity',
      value: activeConnections,
      impact: activityBonus * 0.3,
      description: `Active on ${activeConnections} platform(s)`,
    });

    score = Math.min(100, score * 0.7 + activityBonus);

    return {
      score: Math.round(score),
      contributionToTotal: Math.round(score * SCORE_WEIGHTS.responsiveness),
      factors,
    };
  }

  private calculateProfileScore(data: any): Omit<ComponentScore, 'weight'> {
    const factors: ScoreFactor[] = [];
    const profile = data.profile;

    // Profile completeness
    const completeness = profile?.profileCompleteness || 0;

    factors.push({
      name: 'Profile Completeness',
      value: completeness,
      impact: completeness * 0.5,
      description: `${completeness}% complete`,
    });

    // Verification level bonus
    const verificationLevel = this.getHighestVerificationLevel(data.workHistory);
    const verificationBonus = {
      [VerificationLevel.SELF_REPORTED]: 0,
      [VerificationLevel.PLATFORM_CONNECTED]: 15,
      [VerificationLevel.PLATFORM_VERIFIED]: 30,
      [VerificationLevel.CRYPTOGRAPHICALLY_SEALED]: 50,
    }[verificationLevel];

    factors.push({
      name: 'Verification Level',
      value: verificationLevel,
      impact: verificationBonus * 0.5,
      description: `${verificationLevel} verification`,
    });

    const score = completeness * 0.5 + verificationBonus;

    return {
      score: Math.round(Math.min(100, score)),
      contributionToTotal: Math.round(score * SCORE_WEIGHTS.profile),
      factors,
    };
  }

  private calculateCredentialsScore(data: any): Omit<ComponentScore, 'weight'> {
    const factors: ScoreFactor[] = [];
    const credentials = data.credentials;

    if (credentials.length === 0) {
      return {
        score: 30, // Base score for having account
        contributionToTotal: Math.round(30 * SCORE_WEIGHTS.credentials),
        factors: [
          {
            name: 'No Credentials',
            value: 0,
            impact: 30,
            description: 'No verified credentials yet',
          },
        ],
      };
    }

    // Factor 1: Credential count
    const countPoints = Math.min(credentials.length * 15, 60);

    factors.push({
      name: 'Credential Count',
      value: credentials.length,
      impact: countPoints * 0.6,
      description: `${credentials.length} verified credential(s)`,
    });

    // Factor 2: Credential types
    const types = new Set(credentials.map((c: any) => c.type));
    const typePoints = Math.min(types.size * 10, 40);

    factors.push({
      name: 'Credential Types',
      value: types.size,
      impact: typePoints * 0.4,
      description: `${types.size} different credential type(s)`,
    });

    const score = countPoints * 0.6 + typePoints * 0.4;

    return {
      score: Math.round(Math.min(100, score + 30)), // +30 base for having account
      contributionToTotal: Math.round(score * SCORE_WEIGHTS.credentials),
      factors,
    };
  }

  // ---------------------------------------------------------------------------
  // PLATFORM SCORES
  // ---------------------------------------------------------------------------

  private calculatePlatformScores(data: any): Record<Platform, number> {
    const scores: Record<Platform, number> = {} as Record<Platform, number>;

    for (const connection of data.connections) {
      const platform = connection.platform as Platform;
      const platformWorkHistory = data.workHistory.filter((wh: any) => wh.platform === platform);

      if (platformWorkHistory.length === 0) {
        scores[platform] = 50; // Base score for connected
        continue;
      }

      // Calculate platform-specific score
      const completed = platformWorkHistory.filter((wh: any) => wh.status === 'COMPLETED').length;
      const completionRate = completed / platformWorkHistory.length;

      const reviews = platformWorkHistory.flatMap((wh: any) => wh.reviews || []);
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + r.rating / (r.maxRating || 5), 0) /
            reviews.length
          : 0;

      const platformScore = Math.round(completionRate * 40 + avgRating * 60);

      scores[platform] = platformScore;
    }

    return scores;
  }

  // ---------------------------------------------------------------------------
  // BADGES
  // ---------------------------------------------------------------------------

  private async evaluateBadges(
    userId: string,
    data: any,
    overallScore: number
  ): Promise<ReputationBadge[]> {
    const existingBadges = await prisma.reputationBadge.findMany({
      where: { userId },
    });
    const existingIds = new Set(existingBadges.map((b) => b.badgeId));
    const newBadges: ReputationBadge[] = existingBadges.map((b) => ({
      id: b.badgeId,
      name: b.name,
      description: b.description,
      icon: b.icon,
      earnedAt: b.earnedAt,
      category: b.category as ReputationBadge['category'],
    }));

    // Check for new badges
    const checksToRun: [string, () => boolean][] = [
      [
        'first_verified_project',
        () =>
          data.workHistory.some(
            (wh: any) => wh.verificationLevel !== VerificationLevel.SELF_REPORTED
          ),
      ],
      [
        'earnings_10k',
        () => {
          const total = data.workHistory.reduce(
            (sum: number, wh: any) => sum + (wh.earnings || 0),
            0
          );
          return total >= 10000;
        },
      ],
      [
        'earnings_100k',
        () => {
          const total = data.workHistory.reduce(
            (sum: number, wh: any) => sum + (wh.earnings || 0),
            0
          );
          return total >= 100000;
        },
      ],
      [
        'perfect_rating',
        () => {
          if (data.reviews.length < 10) return false;
          return data.reviews.every((r: any) => r.rating === (r.maxRating || 5));
        },
      ],
      [
        'multi_platform',
        () => {
          const verifiedPlatforms = new Set(
            data.workHistory
              .filter((wh: any) => wh.verificationLevel !== VerificationLevel.SELF_REPORTED)
              .map((wh: any) => wh.platform)
          );
          return verifiedPlatforms.size >= 3;
        },
      ],
      [
        'blockchain_verified',
        () =>
          data.workHistory.some(
            (wh: any) => wh.verificationLevel === VerificationLevel.CRYPTOGRAPHICALLY_SEALED
          ),
      ],
    ];

    for (const [badgeId, check] of checksToRun) {
      if (!existingIds.has(badgeId) && check()) {
        const badgeDef = BADGE_DEFINITIONS[badgeId];
        if (badgeDef) {
          const badge: ReputationBadge = {
            id: badgeId,
            ...badgeDef,
            earnedAt: new Date(),
          };
          newBadges.push(badge);

          // Store new badge
          await prisma.reputationBadge.create({
            data: {
              userId,
              badgeId: badge.id,
              name: badge.name,
              description: badge.description,
              icon: badge.icon,
              category: badge.category,
              earnedAt: badge.earnedAt,
            },
          });
        }
      }
    }

    return newBadges;
  }

  // ---------------------------------------------------------------------------
  // HISTORY & TRENDS
  // ---------------------------------------------------------------------------

  private async getScoreHistory(userId: string): Promise<ScoreHistory[]> {
    const history = await prisma.reputationScoreHistory.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 12, // Last 12 data points
    });

    return history.map((h) => ({
      date: h.date,
      score: h.score,
      tier: h.tier as ReputationTier,
      change: h.change,
    }));
  }

  private calculateTrend(
    history: ScoreHistory[],
    currentScore: number
  ): 'rising' | 'stable' | 'declining' {
    if (history.length < 2) return 'stable';

    const recentAvg =
      history.slice(0, 3).reduce((sum, h) => sum + h.score, 0) / Math.min(history.length, 3);
    const olderAvg =
      history.length > 3
        ? history.slice(3, 6).reduce((sum, h) => sum + h.score, 0) / Math.min(history.length - 3, 3)
        : recentAvg;

    const change = recentAvg - olderAvg;

    if (change > 5) return 'rising';
    if (change < -5) return 'declining';
    return 'stable';
  }

  // ---------------------------------------------------------------------------
  // PERCENTILE
  // ---------------------------------------------------------------------------

  private async calculatePercentile(score: number): Promise<number> {
    // Get distribution of all scores
    const allScores = await prisma.reputationScore.findMany({
      select: { overallScore: true },
    });

    if (allScores.length === 0) return 100;

    const belowCount = allScores.filter((s) => s.overallScore < score).length;
    return Math.round((belowCount / allScores.length) * 100);
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private determineTier(score: number): ReputationTier {
    if (score >= TIER_THRESHOLDS.legendary) return 'legendary';
    if (score >= TIER_THRESHOLDS.elite) return 'elite';
    if (score >= TIER_THRESHOLDS.expert) return 'expert';
    if (score >= TIER_THRESHOLDS.established) return 'established';
    return 'rising';
  }

  private calculateEarningsGrowth(workHistory: any[]): number {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    const thisYearEarnings = workHistory
      .filter((wh) => new Date(wh.startDate).getFullYear() === thisYear)
      .reduce((sum, wh) => sum + (wh.earnings || 0), 0);

    const lastYearEarnings = workHistory
      .filter((wh) => new Date(wh.startDate).getFullYear() === lastYear)
      .reduce((sum, wh) => sum + (wh.earnings || 0), 0);

    if (lastYearEarnings === 0) return thisYearEarnings > 0 ? 1 : 0;
    return (thisYearEarnings - lastYearEarnings) / lastYearEarnings;
  }

  private getHighestVerificationLevel(workHistory: any[]): VerificationLevel {
    let highest = VerificationLevel.SELF_REPORTED;
    for (const wh of workHistory) {
      if ((wh.verificationLevel as VerificationLevel) > highest) {
        highest = wh.verificationLevel;
      }
    }
    return highest;
  }

  private async storeScore(score: ReputationScore): Promise<void> {
    // Get previous score for change calculation
    const previous = await prisma.reputationScore.findUnique({
      where: { userId: score.userId },
    });

    const change = previous ? score.overallScore - previous.overallScore : 0;

    // Store current score
    await prisma.reputationScore.upsert({
      where: { userId: score.userId },
      update: {
        overallScore: score.overallScore,
        tier: score.tier,
        components: score.components as any,
        platformScores: score.platformScores as any,
        percentile: score.percentile,
        calculatedAt: score.calculatedAt,
      },
      create: {
        userId: score.userId,
        overallScore: score.overallScore,
        tier: score.tier,
        components: score.components as any,
        platformScores: score.platformScores as any,
        percentile: score.percentile,
        calculatedAt: score.calculatedAt,
      },
    });

    // Store history entry
    await prisma.reputationScoreHistory.create({
      data: {
        userId: score.userId,
        date: new Date(),
        score: score.overallScore,
        tier: score.tier,
        change,
      },
    });
  }
}

// Singleton instance
let serviceInstance: ReputationScoreService | null = null;

export function getReputationScoreService(): ReputationScoreService {
  if (!serviceInstance) {
    serviceInstance = new ReputationScoreService();
  }
  return serviceInstance;
}
