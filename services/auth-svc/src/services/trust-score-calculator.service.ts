/**
 * @module @skillancer/auth-svc/services/trust-score-calculator
 * Trust Score Calculator Service
 *
 * Pure calculation logic for trust scores. This service:
 * - Calculates individual component scores
 * - Applies weighted averages
 * - Determines trust tiers
 * - Generates factor explanations
 */

import { TrustTier, TrustTrend } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';

import { DEFAULT_TRUST_SCORE_WEIGHTS } from '../types/trust-score.types.js';

import type {
  ReviewScoreData,
  ComplianceScoreData,
  VerificationScoreData,
  TenureScoreData,
  ActivityScoreData,
  TrustScoreComponents,
  TrustScoreWeights,
  TrustScoreResult,
  TrustScoreFactor,
  TrustScoreCalculationOptions,
} from '../types/trust-score.types.js';

const logger = createLogger({ serviceName: 'trust-score-calculator' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum reviews required for full review score weight */
const MIN_REVIEWS_THRESHOLD = 5;

/** Reviews considered "recent" for recency bonus */
const _RECENT_REVIEW_DAYS = 90;

/** Maximum tenure bonus days */
const MAX_TENURE_DAYS = 730; // 2 years

/** Days of inactivity before score starts decreasing */
const ACTIVITY_THRESHOLD_DAYS = 30;

/** Maximum response time (hours) before penalty */
const MAX_RESPONSE_TIME_HOURS = 24;

// =============================================================================
// TIER THRESHOLDS
// =============================================================================

interface TierThreshold {
  tier: TrustTier;
  minScore: number;
  maxScore: number;
}

const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: TrustTier.ELITE, minScore: 95, maxScore: 100 },
  { tier: TrustTier.HIGHLY_TRUSTED, minScore: 80, maxScore: 94.99 },
  { tier: TrustTier.TRUSTED, minScore: 60, maxScore: 79.99 },
  { tier: TrustTier.ESTABLISHED, minScore: 40, maxScore: 59.99 },
  { tier: TrustTier.EMERGING, minScore: 0, maxScore: 39.99 },
];

// =============================================================================
// TRUST SCORE CALCULATOR SERVICE
// =============================================================================

export class TrustScoreCalculatorService {
  /**
   * Calculate the complete trust score from all component data
   */
  calculateTrustScore(
    reviewData: ReviewScoreData,
    complianceData: ComplianceScoreData,
    verificationData: VerificationScoreData,
    tenureData: TenureScoreData,
    activityData: ActivityScoreData,
    previousScore: number | null,
    options: TrustScoreCalculationOptions = {}
  ): TrustScoreResult {
    const weights = { ...DEFAULT_TRUST_SCORE_WEIGHTS, ...options.weights };

    // Calculate individual component scores
    const reviewScore = this.calculateReviewScore(reviewData);
    const complianceScore = this.calculateComplianceScore(complianceData);
    const verificationScore = this.calculateVerificationScore(verificationData);
    const tenureScore = this.calculateTenureScore(tenureData);
    const activityScore = this.calculateActivityScore(activityData);

    const components: TrustScoreComponents = {
      reviewScore,
      complianceScore,
      verificationScore,
      tenureScore,
      activityScore,
    };

    // Apply weights for overall score
    const overallScore = this.calculateWeightedScore(components, weights);

    // Determine tier
    const tier = this.determineTier(overallScore);

    // Calculate trend
    const { trend, scoreChangeAmount } = this.calculateTrend(overallScore, previousScore);

    // Generate factor explanations if requested
    const factors = options.includeFactors
      ? this.generateFactors(
          components,
          weights,
          reviewData,
          complianceData,
          verificationData,
          tenureData,
          activityData
        )
      : [];

    const result: TrustScoreResult = {
      overallScore: Math.round(overallScore),
      previousScore: previousScore ?? undefined,
      components,
      weights,
      tier,
      trend,
      scoreChangeAmount,
      factors,
      calculatedAt: new Date(),
    };

    logger.info({
      msg: 'Trust score calculated',
      overallScore: result.overallScore,
      tier,
      trend,
      components,
    });

    return result;
  }

  // ===========================================================================
  // COMPONENT SCORE CALCULATIONS
  // ===========================================================================

  /**
   * Calculate review component score (0-100)
   */
  private calculateReviewScore(data: ReviewScoreData): number {
    if (data.totalReviews === 0) {
      // New users with no reviews get a neutral starting score
      return 50;
    }

    let score = 0;

    // Base score from average rating (max 60 points)
    // Convert 1-5 scale to 0-60
    const ratingScore = ((data.averageRating - 1) / 4) * 60;
    score += ratingScore;

    // Volume bonus (max 15 points)
    // More reviews = more reliable score
    const volumeBonus = Math.min(data.totalReviews / MIN_REVIEWS_THRESHOLD, 1) * 15;
    score += volumeBonus;

    // Recency bonus (max 10 points)
    // Recent reviews indicate ongoing quality
    const recencyRatio = data.recentReviews / Math.max(data.totalReviews, 1);
    const recencyBonus = recencyRatio * 10;
    score += recencyBonus;

    // Verified reviews bonus (max 10 points)
    // Reviews from verified transactions are more trustworthy
    const verifiedRatio = data.verifiedReviews / Math.max(data.totalReviews, 1);
    const verifiedBonus = verifiedRatio * 10;
    score += verifiedBonus;

    // Response rate bonus (max 5 points)
    const responseBonus = data.responseRate * 5;
    score += responseBonus;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate compliance component score (0-100)
   */
  private calculateComplianceScore(data: ComplianceScoreData): number {
    if (data.totalSessions === 0) {
      // Users with no SkillPod sessions start at neutral
      return 50;
    }

    let score = 100;

    // On-time completion rate (base score)
    const onTimeRate = data.onTimeSessions / data.totalSessions;
    score = onTimeRate * 80; // Max 80 from on-time rate

    // Violation penalty
    // Each violation reduces score based on severity
    const violationPenalty = Math.min(data.severityScore * 5, 30);
    score -= violationPenalty;

    // Recency factor - recent good behavior gets bonus
    if (data.recentComplianceRate > 0.95) {
      score += 15;
    } else if (data.recentComplianceRate > 0.85) {
      score += 10;
    } else if (data.recentComplianceRate > 0.75) {
      score += 5;
    }

    // Volume consideration - more sessions = more reliable score
    const volumeMultiplier = Math.min(data.totalSessions / 10, 1);
    score = 50 + (score - 50) * volumeMultiplier;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate verification component score (0-100)
   */
  private calculateVerificationScore(data: VerificationScoreData): number {
    let score = 0;

    // Verification level (max 50 points)
    // Level 0-4 maps to 0, 12.5, 25, 37.5, 50
    score += (data.verificationLevel / 4) * 50;

    // Individual verification bonuses
    if (data.emailVerified) score += 10;
    if (data.phoneVerified) score += 10;
    if (data.identityVerified) score += 15;
    if (data.paymentVerified) score += 5;

    // Skills verification (max 5 points)
    if (data.totalSkills > 0) {
      const skillsVerifiedRatio = data.skillsVerified / data.totalSkills;
      score += skillsVerifiedRatio * 5;
    }

    // Portfolio verification (max 5 points)
    const portfolioBonus = Math.min(data.portfolioVerified, 5);
    score += portfolioBonus;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate tenure component score (0-100)
   */
  private calculateTenureScore(data: TenureScoreData): number {
    let score = 0;

    // Base tenure score (max 70 points)
    // Logarithmic scaling - faster gains early, slower later
    const tenureMonths = data.tenureDays / 30;
    const tenureBase = Math.min(Math.log2(tenureMonths + 1) * 15, 70);
    score += tenureBase;

    // Transaction history bonus (max 15 points)
    if (data.firstTransactionAt) {
      const daysSinceFirstTx = Math.floor(
        (Date.now() - data.firstTransactionAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const txBonus = Math.min(daysSinceFirstTx / 180, 1) * 15;
      score += txBonus;
    }

    // Good standing bonus (max 15 points)
    if (data.goodStanding) {
      score += 15;
    }

    // Warning penalty
    const warningPenalty = Math.min(data.warningCount * 5, 20);
    score -= warningPenalty;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate activity component score (0-100)
   */
  private calculateActivityScore(data: ActivityScoreData): number {
    let score = 0;

    // Recent activity (max 40 points)
    if (data.daysSinceActivity <= 7) {
      score += 40;
    } else if (data.daysSinceActivity <= 14) {
      score += 35;
    } else if (data.daysSinceActivity <= ACTIVITY_THRESHOLD_DAYS) {
      score += 25;
    } else if (data.daysSinceActivity <= 60) {
      score += 15;
    } else if (data.daysSinceActivity <= 90) {
      score += 10;
    } else {
      score += 5;
    }

    // Login frequency (max 20 points)
    const loginFrequencyScore = Math.min(data.avgLoginsPerMonth / 15, 1) * 20;
    score += loginFrequencyScore;

    // Profile completeness (max 20 points)
    score += data.profileCompleteness * 20;

    // Message response rate (max 15 points)
    score += data.messageResponseRate * 15;

    // Response time bonus (max 5 points)
    if (data.avgMessageResponseTime <= 1) {
      score += 5;
    } else if (data.avgMessageResponseTime <= 4) {
      score += 4;
    } else if (data.avgMessageResponseTime <= MAX_RESPONSE_TIME_HOURS) {
      score += 2;
    }

    return Math.min(Math.max(score, 0), 100);
  }

  // ===========================================================================
  // AGGREGATION & TIER DETERMINATION
  // ===========================================================================

  /**
   * Calculate weighted overall score
   * Weights are percentages (should sum to 100)
   */
  private calculateWeightedScore(
    components: TrustScoreComponents,
    weights: TrustScoreWeights
  ): number {
    // Weights are percentages, so divide by 100 to get decimal multipliers
    return (
      (components.reviewScore * weights.reviewWeight +
        components.complianceScore * weights.complianceWeight +
        components.verificationScore * weights.verificationWeight +
        components.tenureScore * weights.tenureWeight +
        components.activityScore * weights.activityWeight) /
      100
    );
  }

  /**
   * Determine trust tier from overall score
   */
  private determineTier(score: number): TrustTier {
    const threshold = TIER_THRESHOLDS.find((t) => score >= t.minScore && score <= t.maxScore);
    return threshold?.tier ?? TrustTier.EMERGING;
  }

  /**
   * Calculate score trend
   */
  private calculateTrend(
    currentScore: number,
    previousScore: number | null
  ): { trend: TrustTrend; scoreChangeAmount: number } {
    if (previousScore === null) {
      return { trend: TrustTrend.STABLE, scoreChangeAmount: 0 };
    }

    const delta = currentScore - previousScore;
    const scoreChangeAmount = Math.round(delta);

    let trend: TrustTrend;
    if (delta > 5) {
      trend = TrustTrend.RISING;
    } else if (delta > 0) {
      trend = TrustTrend.STABLE; // Minor increase treated as stable
    } else if (delta > -5) {
      trend = TrustTrend.STABLE; // Minor decrease treated as stable
    } else {
      trend = TrustTrend.DECLINING;
    }

    return { trend, scoreChangeAmount };
  }

  // ===========================================================================
  // FACTOR EXPLANATIONS
  // ===========================================================================

  /**
   * Generate human-readable factor explanations
   */
  private generateFactors(
    components: TrustScoreComponents,
    weights: TrustScoreWeights,
    reviewData: ReviewScoreData,
    complianceData: ComplianceScoreData,
    verificationData: VerificationScoreData,
    tenureData: TenureScoreData,
    activityData: ActivityScoreData
  ): TrustScoreFactor[] {
    const factors: TrustScoreFactor[] = [];

    // Review factors
    if (reviewData.totalReviews > 0) {
      factors.push({
        component: 'reviewScore',
        impact:
          reviewData.averageRating >= 4
            ? 'positive'
            : reviewData.averageRating >= 3
              ? 'neutral'
              : 'negative',
        description: `${reviewData.averageRating.toFixed(1)} average rating from ${reviewData.totalReviews} reviews`,
        value: reviewData.averageRating,
        maxValue: 5,
      });

      if (reviewData.verifiedReviews / reviewData.totalReviews > 0.8) {
        factors.push({
          component: 'reviewScore',
          impact: 'positive',
          description: 'High percentage of verified reviews',
          value: Math.round((reviewData.verifiedReviews / reviewData.totalReviews) * 100),
          maxValue: 100,
        });
      }
    } else {
      factors.push({
        component: 'reviewScore',
        impact: 'neutral',
        description: 'No reviews yet - complete transactions to build your reputation',
        value: 0,
        maxValue: 100,
      });
    }

    // Compliance factors
    if (complianceData.totalSessions > 0) {
      const onTimeRate = complianceData.onTimeSessions / complianceData.totalSessions;
      factors.push({
        component: 'complianceScore',
        impact: onTimeRate >= 0.9 ? 'positive' : onTimeRate >= 0.7 ? 'neutral' : 'negative',
        description: `${Math.round(onTimeRate * 100)}% on-time completion rate in SkillPod sessions`,
        value: Math.round(onTimeRate * 100),
        maxValue: 100,
      });

      if (complianceData.violationCount > 0) {
        factors.push({
          component: 'complianceScore',
          impact: 'negative',
          description: `${complianceData.violationCount} compliance violations recorded`,
          value: complianceData.violationCount,
        });
      }
    }

    // Verification factors
    const verificationFactors: string[] = [];
    if (verificationData.identityVerified) verificationFactors.push('identity');
    if (verificationData.emailVerified) verificationFactors.push('email');
    if (verificationData.phoneVerified) verificationFactors.push('phone');
    if (verificationData.paymentVerified) verificationFactors.push('payment');

    if (verificationFactors.length > 0) {
      factors.push({
        component: 'verificationScore',
        impact: 'positive',
        description: `Verified: ${verificationFactors.join(', ')}`,
        value: verificationData.verificationLevel,
        maxValue: 4,
      });
    } else {
      factors.push({
        component: 'verificationScore',
        impact: 'negative',
        description: 'Complete verification to increase your trust score',
        value: 0,
        maxValue: 4,
      });
    }

    // Tenure factors
    if (tenureData.tenureDays >= 365) {
      factors.push({
        component: 'tenureScore',
        impact: 'positive',
        description: `Platform member for ${Math.floor(tenureData.tenureDays / 365)} year(s)`,
        value: tenureData.tenureDays,
        maxValue: MAX_TENURE_DAYS,
      });
    } else if (tenureData.tenureDays >= 30) {
      factors.push({
        component: 'tenureScore',
        impact: 'neutral',
        description: `Platform member for ${Math.floor(tenureData.tenureDays / 30)} month(s)`,
        value: tenureData.tenureDays,
        maxValue: MAX_TENURE_DAYS,
      });
    } else {
      factors.push({
        component: 'tenureScore',
        impact: 'neutral',
        description: 'New member - your trust score will improve as you build history',
        value: tenureData.tenureDays,
        maxValue: MAX_TENURE_DAYS,
      });
    }

    if (!tenureData.goodStanding) {
      factors.push({
        component: 'tenureScore',
        impact: 'negative',
        description: 'Account has received warnings or suspensions',
        value: tenureData.warningCount,
      });
    }

    // Activity factors
    if (activityData.daysSinceActivity <= 7) {
      factors.push({
        component: 'activityScore',
        impact: 'positive',
        description: 'Active within the last week',
        value: 7 - activityData.daysSinceActivity,
        maxValue: 7,
      });
    } else if (activityData.daysSinceActivity > ACTIVITY_THRESHOLD_DAYS) {
      factors.push({
        component: 'activityScore',
        impact: 'negative',
        description: `Inactive for ${activityData.daysSinceActivity} days`,
        value: activityData.daysSinceActivity,
      });
    }

    if (activityData.profileCompleteness < 0.5) {
      factors.push({
        component: 'activityScore',
        impact: 'negative',
        description: `Profile is only ${Math.round(activityData.profileCompleteness * 100)}% complete`,
        value: Math.round(activityData.profileCompleteness * 100),
        maxValue: 100,
      });
    }

    return factors;
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Get tier description for display
   */
  getTierDescription(tier: TrustTier): string {
    const descriptions: Record<TrustTier, string> = {
      [TrustTier.EMERGING]: 'New member building their reputation',
      [TrustTier.ESTABLISHED]: 'Building trust through positive interactions',
      [TrustTier.TRUSTED]: 'Established member with good track record',
      [TrustTier.HIGHLY_TRUSTED]: 'Highly trusted member with excellent reputation',
      [TrustTier.ELITE]: 'Top-tier member with exceptional trust score',
    };
    return descriptions[tier] ?? 'Unknown tier';
  }

  /**
   * Get trend description for display
   */
  getTrendDescription(trend: TrustTrend, delta: number): string {
    switch (trend) {
      case TrustTrend.RISING:
        return `Your score increased by ${delta} points recently`;
      case TrustTrend.DECLINING:
        return `Your score decreased by ${Math.abs(delta)} points recently`;
      case TrustTrend.STABLE:
      default:
        return 'Your score has been stable';
    }
  }

  /**
   * Get improvement suggestions based on components
   */
  getImprovementSuggestions(
    components: TrustScoreComponents,
    weights: TrustScoreWeights
  ): Array<{ component: string; potentialGain: number; suggestion: string }> {
    const suggestions: Array<{ component: string; potentialGain: number; suggestion: string }> = [];

    // Calculate potential gains for each component (weights are percentages)
    const maxPossible = 100;

    if (components.reviewScore < maxPossible) {
      const potentialGain = ((maxPossible - components.reviewScore) * weights.reviewWeight) / 100;
      suggestions.push({
        component: 'Reviews',
        potentialGain,
        suggestion: 'Complete more projects and encourage clients to leave reviews',
      });
    }

    if (components.complianceScore < maxPossible) {
      const potentialGain =
        ((maxPossible - components.complianceScore) * weights.complianceWeight) / 100;
      suggestions.push({
        component: 'Compliance',
        potentialGain,
        suggestion: 'Complete SkillPod sessions on time and follow platform guidelines',
      });
    }

    if (components.verificationScore < maxPossible) {
      const potentialGain =
        ((maxPossible - components.verificationScore) * weights.verificationWeight) / 100;
      suggestions.push({
        component: 'Verification',
        potentialGain,
        suggestion: 'Complete identity verification and verify your skills',
      });
    }

    if (components.activityScore < maxPossible) {
      const potentialGain =
        ((maxPossible - components.activityScore) * weights.activityWeight) / 100;
      suggestions.push({
        component: 'Activity',
        potentialGain,
        suggestion: 'Stay active on the platform and complete your profile',
      });
    }

    // Sort by potential gain (highest first)
    return suggestions.sort((a, b) => b.potentialGain - a.potentialGain);
  }
}

// =============================================================================
// MODULE SINGLETON
// =============================================================================

let calculatorService: TrustScoreCalculatorService | null = null;

/**
 * Get or create the trust score calculator service instance
 */
export function getTrustScoreCalculatorService(): TrustScoreCalculatorService {
  if (!calculatorService) {
    calculatorService = new TrustScoreCalculatorService();
  }
  return calculatorService;
}
