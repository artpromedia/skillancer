/**
 * @module @skillancer/market-svc/services/fraud-detection
 * Review Fraud Detection Service
 *
 * Detects and prevents fraudulent review activity including:
 * - Self-reviews
 * - Review rings
 * - Review bombing
 * - Sentiment manipulation
 * - Generic/copied content
 */

import { REVIEW_CONFIG } from '../config/rating-dimensions.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface FraudCheck {
  type: FraudCheckType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  metadata?: Record<string, unknown>;
}

export type FraudCheckType =
  | 'HIGH_VELOCITY'
  | 'SELF_REVIEW'
  | 'REVIEW_RING'
  | 'SENTIMENT_MISMATCH'
  | 'GENERIC_TEXT'
  | 'NEW_ACCOUNT_BOMBING'
  | 'DUPLICATE_CONTENT'
  | 'SUSPICIOUS_TIMING'
  | 'IP_MATCH'
  | 'DEVICE_MATCH';

export interface FraudCheckResult {
  blocked: boolean;
  requiresModeration: boolean;
  reason?: string;
  checks: FraudCheck[];
  riskScore: number; // 0-100
}

export interface FraudCheckParams {
  reviewerId: string;
  revieweeId: string;
  contractId: string;
  rating: number;
  feedback?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  deviceFingerprint?: string | undefined;
}

// =============================================================================
// FRAUD DETECTION SERVICE
// =============================================================================

export class FraudDetectionService {
  private readonly config = REVIEW_CONFIG.fraud;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  /**
   * Run all fraud checks on a review
   */
  async checkReview(params: FraudCheckParams): Promise<FraudCheckResult> {
    const checks: FraudCheck[] = [];

    // Run async checks in parallel
    const [velocityCheck, selfReviewCheck, reviewRingCheck, newAccountCheck, duplicateCheck] =
      await Promise.all([
        this.checkVelocity(params.reviewerId),
        this.checkSelfReview(params.reviewerId, params.revieweeId),
        this.checkReviewRing(params.reviewerId, params.revieweeId),
        this.checkNewAccountBombing(params.reviewerId, params.rating),
        params.feedback ? this.checkDuplicateContent(params.feedback, params.reviewerId) : null,
      ]);

    // Run synchronous checks
    const sentimentCheck = params.feedback
      ? this.checkSentimentMismatch(params.rating, params.feedback)
      : null;
    const genericTextCheck = params.feedback ? this.checkGenericText(params.feedback) : null;

    if (velocityCheck) checks.push(velocityCheck);
    if (selfReviewCheck) checks.push(selfReviewCheck);
    if (reviewRingCheck) checks.push(reviewRingCheck);
    if (sentimentCheck) checks.push(sentimentCheck);
    if (genericTextCheck) checks.push(genericTextCheck);
    if (newAccountCheck) checks.push(newAccountCheck);
    if (duplicateCheck) checks.push(duplicateCheck);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(checks);

    // Determine outcome
    const criticalChecks = checks.filter((c) => c.severity === 'CRITICAL');
    const highChecks = checks.filter((c) => c.severity === 'HIGH');

    // Block on critical or multiple high severity checks
    if (criticalChecks.length > 0) {
      this.logger.warn({
        msg: 'Review blocked - critical fraud check failed',
        reviewerId: params.reviewerId,
        checks: criticalChecks,
      });

      return {
        blocked: true,
        requiresModeration: false,
        reason: criticalChecks[0]?.reason ?? 'Critical fraud check failed',
        checks,
        riskScore,
      };
    }

    if (highChecks.length >= 2) {
      this.logger.warn({
        msg: 'Review blocked - multiple high fraud checks failed',
        reviewerId: params.reviewerId,
        checks: highChecks,
      });

      return {
        blocked: true,
        requiresModeration: false,
        reason: 'Multiple fraud indicators detected',
        checks,
        riskScore,
      };
    }

    // Moderate on single high or multiple medium
    const mediumChecks = checks.filter((c) => c.severity === 'MEDIUM');

    if (highChecks.length === 1 || mediumChecks.length >= 2 || riskScore >= 60) {
      return {
        blocked: false,
        requiresModeration: true,
        reason: checks[0]?.reason ?? 'Requires moderation',
        checks,
        riskScore,
      };
    }

    return {
      blocked: false,
      requiresModeration: false,
      checks,
      riskScore,
    };
  }

  // ===========================================================================
  // FRAUD CHECKS
  // ===========================================================================

  /**
   * Check for excessive review velocity
   */
  private async checkVelocity(reviewerId: string): Promise<FraudCheck | null> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentReviewCount = await this.prisma.review.count({
      where: {
        reviewerId,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    if (recentReviewCount >= this.config.maxReviewsPerDay) {
      return {
        type: 'HIGH_VELOCITY',
        severity: 'HIGH',
        reason: `Unusually high number of reviews (${recentReviewCount}) in 24 hours`,
        metadata: { recentReviewCount },
      };
    }

    // Also check hourly rate
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyCount = await this.prisma.review.count({
      where: {
        reviewerId,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (hourlyCount >= 5) {
      return {
        type: 'HIGH_VELOCITY',
        severity: 'MEDIUM',
        reason: `High hourly review rate (${hourlyCount} reviews in last hour)`,
        metadata: { hourlyCount },
      };
    }

    return null;
  }

  /**
   * Check for self-review indicators
   */
  private async checkSelfReview(
    reviewerId: string,
    revieweeId: string
  ): Promise<FraudCheck | null> {
    // Obviously can't review yourself
    if (reviewerId === revieweeId) {
      return {
        type: 'SELF_REVIEW',
        severity: 'CRITICAL',
        reason: 'Cannot review yourself',
      };
    }

    // Check shared email domain (excluding common providers)
    const commonDomains = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'icloud.com',
      'protonmail.com',
      'aol.com',
      'mail.com',
    ];

    const [reviewer, reviewee] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: reviewerId }, select: { email: true } }),
      this.prisma.user.findUnique({ where: { id: revieweeId }, select: { email: true } }),
    ]);

    if (reviewer?.email && reviewee?.email) {
      const reviewerDomain = reviewer.email.split('@')[1]?.toLowerCase();
      const revieweeDomain = reviewee.email.split('@')[1]?.toLowerCase();

      if (
        reviewerDomain &&
        revieweeDomain &&
        reviewerDomain === revieweeDomain &&
        !commonDomains.includes(reviewerDomain)
      ) {
        return {
          type: 'SELF_REVIEW',
          severity: 'HIGH',
          reason: 'Same corporate email domain detected',
          metadata: { domain: reviewerDomain },
        };
      }
    }

    // Check for shared login history (IPs) - would need session tracking
    // This is a placeholder - actual implementation would check session/login data
    const sharedSession = await this.checkSharedSessions(reviewerId, revieweeId);
    if (sharedSession) {
      return sharedSession;
    }

    return null;
  }

  /**
   * Check for shared sessions between users
   */
  private async checkSharedSessions(
    reviewerId: string,
    revieweeId: string
  ): Promise<FraudCheck | null> {
    // Check Redis for recent login IPs
    const reviewerIPs = await this.redis.smembers(`user:${reviewerId}:recent_ips`);
    const revieweeIPs = await this.redis.smembers(`user:${revieweeId}:recent_ips`);

    const sharedIPs = reviewerIPs.filter((ip) => revieweeIPs.includes(ip));

    if (sharedIPs.length > 0) {
      return {
        type: 'IP_MATCH',
        severity: 'HIGH',
        reason: 'Shared login IP addresses detected',
        metadata: { sharedIPCount: sharedIPs.length },
      };
    }

    // Check device fingerprints
    const reviewerDevices = await this.redis.smembers(`user:${reviewerId}:devices`);
    const revieweeDevices = await this.redis.smembers(`user:${revieweeId}:devices`);

    const sharedDevices = reviewerDevices.filter((d) => revieweeDevices.includes(d));

    if (sharedDevices.length > 0) {
      return {
        type: 'DEVICE_MATCH',
        severity: 'HIGH',
        reason: 'Shared device fingerprints detected',
        metadata: { sharedDeviceCount: sharedDevices.length },
      };
    }

    return null;
  }

  /**
   * Detect review ring patterns
   */
  private async checkReviewRing(
    reviewerId: string,
    revieweeId: string
  ): Promise<FraudCheck | null> {
    // Check for reciprocal review pattern
    const existingReciprocal = await this.prisma.review.findFirst({
      where: {
        reviewerId: revieweeId,
        revieweeId: reviewerId,
        status: 'REVEALED',
      },
    });

    if (existingReciprocal) {
      // Reciprocal reviews are allowed, but check if it's a pattern
      const [reviewerStats, revieweeStats] = await Promise.all([
        this.getReciprocalStats(reviewerId),
        this.getReciprocalStats(revieweeId),
      ]);

      const reviewerReciprocalRate =
        reviewerStats.total > 0 ? reviewerStats.reciprocal / reviewerStats.total : 0;
      const revieweeReciprocalRate =
        revieweeStats.total > 0 ? revieweeStats.reciprocal / revieweeStats.total : 0;

      if (
        reviewerReciprocalRate > this.config.reciprocalRateThreshold &&
        reviewerStats.total >= this.config.minReviewsForRingDetection
      ) {
        return {
          type: 'REVIEW_RING',
          severity: 'HIGH',
          reason: 'Reviewer has unusually high reciprocal review rate',
          metadata: {
            reciprocalRate: Math.round(reviewerReciprocalRate * 100),
            totalReviews: reviewerStats.total,
          },
        };
      }

      if (
        revieweeReciprocalRate > this.config.reciprocalRateThreshold &&
        revieweeStats.total >= this.config.minReviewsForRingDetection
      ) {
        return {
          type: 'REVIEW_RING',
          severity: 'MEDIUM',
          reason: 'Reviewee has unusually high reciprocal review rate',
          metadata: {
            reciprocalRate: Math.round(revieweeReciprocalRate * 100),
            totalReviews: revieweeStats.total,
          },
        };
      }
    }

    // Check for common reviewee patterns (ring detection)
    const ringPattern = await this.detectCommonRevieweePattern(reviewerId);
    if (ringPattern) {
      return ringPattern;
    }

    return null;
  }

  /**
   * Get reciprocal review statistics for a user
   */
  private async getReciprocalStats(userId: string): Promise<{ total: number; reciprocal: number }> {
    const givenReviews = await this.prisma.review.findMany({
      where: { reviewerId: userId, status: 'REVEALED' },
      select: { revieweeId: true },
    });

    const receivedReviews = await this.prisma.review.findMany({
      where: { revieweeId: userId, status: 'REVEALED' },
      select: { reviewerId: true },
    });

    const givenTo = new Set(givenReviews.map((r) => r.revieweeId));
    const receivedFrom = new Set(receivedReviews.map((r) => r.reviewerId));

    const reciprocalCount = [...givenTo].filter((id) => receivedFrom.has(id)).length;

    return {
      total: givenReviews.length,
      reciprocal: reciprocalCount,
    };
  }

  /**
   * Detect common reviewee patterns that might indicate a ring
   */
  private async detectCommonRevieweePattern(reviewerId: string): Promise<FraudCheck | null> {
    // Get all users this reviewer has reviewed
    const reviewedUsers = await this.prisma.review.findMany({
      where: { reviewerId, status: 'REVEALED' },
      select: { revieweeId: true },
    });

    if (reviewedUsers.length < 3) return null;

    // For each reviewed user, check who else reviewed them
    const revieweeIds = reviewedUsers.map((r) => r.revieweeId);

    const commonReviewers = await this.prisma.review.groupBy({
      by: ['reviewerId'],
      where: {
        revieweeId: { in: revieweeIds },
        reviewerId: { not: reviewerId },
        status: 'REVEALED',
      },
      _count: { revieweeId: true },
      having: {
        revieweeId: { _count: { gte: Math.ceil(revieweeIds.length * 0.7) } },
      },
    });

    if (commonReviewers.length >= 2) {
      return {
        type: 'REVIEW_RING',
        severity: 'MEDIUM',
        reason: 'Possible coordinated review activity detected',
        metadata: {
          commonReviewerCount: commonReviewers.length,
          overlapThreshold: '70%',
        },
      };
    }

    return null;
  }

  /**
   * Check for sentiment mismatch between rating and text
   */
  private checkSentimentMismatch(rating: number, feedback: string): FraudCheck | null {
    // Simple keyword-based sentiment analysis
    // In production, use a proper NLP service
    const positiveWords = [
      'excellent',
      'great',
      'amazing',
      'wonderful',
      'fantastic',
      'outstanding',
      'perfect',
      'best',
      'love',
      'recommend',
      'professional',
      'helpful',
      'responsive',
      'quality',
      'satisfied',
    ];

    const negativeWords = [
      'terrible',
      'awful',
      'horrible',
      'worst',
      'poor',
      'bad',
      'disappointing',
      'unprofessional',
      'rude',
      'scam',
      'avoid',
      'never',
      'waste',
      'refund',
      'complaint',
    ];

    const lowerFeedback = feedback.toLowerCase();
    const positiveCount = positiveWords.filter((w) => lowerFeedback.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lowerFeedback.includes(w)).length;

    // High rating but negative text
    if (rating >= 4 && negativeCount >= 3 && positiveCount === 0) {
      return {
        type: 'SENTIMENT_MISMATCH',
        severity: 'MEDIUM',
        reason: 'Review text sentiment does not match high rating',
        metadata: { rating, negativeWords: negativeCount },
      };
    }

    // Low rating but positive text
    if (rating <= 2 && positiveCount >= 3 && negativeCount === 0) {
      return {
        type: 'SENTIMENT_MISMATCH',
        severity: 'MEDIUM',
        reason: 'Review text sentiment does not match low rating',
        metadata: { rating, positiveWords: positiveCount },
      };
    }

    return null;
  }

  /**
   * Check for generic or template-like review text
   */
  private checkGenericText(feedback: string): FraudCheck | null {
    const genericPatterns = [
      /^great job\.?$/i,
      /^good work\.?$/i,
      /^nice\.?$/i,
      /^ok\.?$/i,
      /^good\.?$/i,
      /^thanks\.?$/i,
      /^thank you\.?$/i,
      /^highly recommended?\.?$/i,
      /^would recommend\.?$/i,
      /^5 stars?\.?$/i,
      /^excellent service\.?$/i,
      /^very good\.?$/i,
      /^a{3,}/i, // Repeated characters like "aaaa"
      /^.{1,15}$/i, // Very short reviews (less than 15 chars)
    ];

    const trimmedFeedback = feedback.trim();

    for (const pattern of genericPatterns) {
      if (pattern.test(trimmedFeedback)) {
        return {
          type: 'GENERIC_TEXT',
          severity: 'LOW',
          reason: 'Review text appears to be generic or template-like',
          metadata: { textLength: trimmedFeedback.length },
        };
      }
    }

    // Check for excessive repetition
    const words = trimmedFeedback.toLowerCase().split(/\s+/);
    if (words.length > 5) {
      const uniqueWords = new Set(words);
      const uniqueRatio = uniqueWords.size / words.length;

      if (uniqueRatio < 0.3) {
        return {
          type: 'GENERIC_TEXT',
          severity: 'LOW',
          reason: 'Review text contains excessive repetition',
          metadata: { uniqueRatio: Math.round(uniqueRatio * 100) },
        };
      }
    }

    return null;
  }

  /**
   * Check for new account negative review bombing
   */
  private async checkNewAccountBombing(
    reviewerId: string,
    rating: number
  ): Promise<FraudCheck | null> {
    // Only check for negative reviews
    if (rating > 2) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      select: { createdAt: true },
    });

    if (!user) return null;

    const accountAgeDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (accountAgeDays <= this.config.newAccountDays) {
      // Check how many negative reviews from this new account
      const negativeReviewCount = await this.prisma.review.count({
        where: {
          reviewerId,
          overallRating: { lte: 2 },
          createdAt: {
            gte: new Date(Date.now() - this.config.newAccountDays * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (negativeReviewCount >= this.config.maxNegativeFromNewAccount) {
        return {
          type: 'NEW_ACCOUNT_BOMBING',
          severity: 'HIGH',
          reason: 'New account with multiple negative reviews',
          metadata: {
            accountAgeDays,
            negativeReviewCount,
          },
        };
      }
    }

    return null;
  }

  /**
   * Check for duplicate/copied review content
   */
  private async checkDuplicateContent(
    feedback: string,
    reviewerId: string
  ): Promise<FraudCheck | null> {
    const normalizedFeedback = feedback.toLowerCase().trim();

    // Skip very short reviews
    if (normalizedFeedback.length < 50) return null;

    // Check for exact duplicates from the same reviewer
    const exactDuplicate = await this.prisma.review.findFirst({
      where: {
        reviewerId,
        content: feedback,
      },
    });

    if (exactDuplicate) {
      return {
        type: 'DUPLICATE_CONTENT',
        severity: 'HIGH',
        reason: 'Exact duplicate review content detected',
        metadata: { duplicateReviewId: exactDuplicate.id },
      };
    }

    // Check for similar content (simple approach - could use fuzzy matching)
    const recentReviews = await this.prisma.review.findMany({
      where: {
        reviewerId,
        content: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, content: true },
      take: 20,
    });

    for (const review of recentReviews) {
      if (review.content) {
        const similarity = this.calculateTextSimilarity(
          normalizedFeedback,
          review.content.toLowerCase()
        );
        if (similarity > 0.8) {
          return {
            type: 'DUPLICATE_CONTENT',
            severity: 'MEDIUM',
            reason: 'Very similar review content detected',
            metadata: {
              similarReviewId: review.id,
              similarity: Math.round(similarity * 100),
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * Simple text similarity calculation (Jaccard similarity)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 2));
    const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 2));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Calculate overall risk score from checks
   */
  private calculateRiskScore(checks: FraudCheck[]): number {
    if (checks.length === 0) return 0;

    const severityScores: Record<string, number> = {
      CRITICAL: 100,
      HIGH: 75,
      MEDIUM: 40,
      LOW: 15,
    };

    let totalScore = 0;
    for (const check of checks) {
      totalScore += severityScores[check.severity] || 0;
    }

    // Cap at 100
    return Math.min(100, totalScore);
  }

  /**
   * Log review for ongoing fraud analysis
   */
  async logReviewActivity(params: FraudCheckParams & { reviewId: string }): Promise<void> {
    // Store in Redis for real-time analysis
    const key = `fraud:activity:${params.reviewerId}`;
    await this.redis.lpush(
      key,
      JSON.stringify({
        reviewId: params.reviewId,
        revieweeId: params.revieweeId,
        rating: params.rating,
        timestamp: Date.now(),
        ip: params.ipAddress,
      })
    );
    await this.redis.ltrim(key, 0, 99); // Keep last 100 activities
    await this.redis.expire(key, 30 * 24 * 60 * 60); // 30 day TTL

    // Track IPs if available
    if (params.ipAddress) {
      await this.redis.sadd(`user:${params.reviewerId}:recent_ips`, params.ipAddress);
      await this.redis.expire(`user:${params.reviewerId}:recent_ips`, 30 * 24 * 60 * 60);
    }

    // Track device fingerprints if available
    if (params.deviceFingerprint) {
      await this.redis.sadd(`user:${params.reviewerId}:devices`, params.deviceFingerprint);
      await this.redis.expire(`user:${params.reviewerId}:devices`, 30 * 24 * 60 * 60);
    }
  }
}
