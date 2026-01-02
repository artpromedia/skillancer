// @ts-nocheck
/**
 * Review Verifier
 * Review authenticity and cross-platform review scoring
 * Sprint M4: Portable Verified Work History
 */

import { createLogger } from '@skillancer/logger';
import { prisma } from '@skillancer/database';
import { createHash } from 'crypto';
import {
  Platform,
  VerificationLevel,
  PlatformReview,
  getConnector,
} from '../integrations/platform-connector';

const logger = createLogger('review-verifier');

// =============================================================================
// TYPES
// =============================================================================

export interface ReviewVerificationRequest {
  userId: string;
  reviewId: string;
  platform: Platform;
}

export interface ReviewVerificationResult {
  reviewId: string;
  verified: boolean;
  authenticityScore: number;
  checks: ReviewCheck[];
  flags: ReviewFlag[];
  verifiedAt: Date;
}

export interface ReviewCheck {
  name: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface ReviewFlag {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface CrossPlatformReviewScore {
  userId: string;
  overallRating: number;
  totalReviews: number;
  verifiedReviews: number;
  platformBreakdown: PlatformReviewSummary[];
  sentimentAnalysis: SentimentAnalysis;
  themes: ReviewTheme[];
  trendData: ReviewTrend[];
}

export interface PlatformReviewSummary {
  platform: Platform;
  averageRating: number;
  reviewCount: number;
  verifiedCount: number;
  recentRating: number; // Last 6 months
}

export interface SentimentAnalysis {
  positive: number; // 0-100
  neutral: number;
  negative: number;
  keywords: { word: string; count: number; sentiment: 'positive' | 'negative' }[];
}

export interface ReviewTheme {
  theme: string;
  frequency: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  examples: string[];
}

export interface ReviewTrend {
  period: string; // e.g., "2024-Q1"
  averageRating: number;
  reviewCount: number;
}

// =============================================================================
// AUTHENTICITY DETECTION
// =============================================================================

const REVIEW_AUTHENTICITY_CHECKS = {
  platformVerified: {
    name: 'Platform Verified',
    weight: 30,
    description: 'Review was fetched from platform API',
  },
  linkedToProject: {
    name: 'Linked to Project',
    weight: 25,
    description: 'Review is linked to a verified project',
  },
  reviewerIdentified: {
    name: 'Reviewer Identified',
    weight: 15,
    description: 'Reviewer has verified platform identity',
  },
  contentAnalysis: {
    name: 'Content Analysis',
    weight: 15,
    description: 'Review content appears authentic',
  },
  timelineValid: {
    name: 'Timeline Valid',
    weight: 15,
    description: 'Review date aligns with project timeline',
  },
};

const SUSPICIOUS_PATTERNS = [
  { pattern: /\b(amazing|incredible|fantastic)\b.*\b(best|ever|perfect)\b/i, score: 10 },
  { pattern: /highly recommend/i, score: 5 },
  { pattern: /^.{1,50}$/m, score: 8 }, // Very short review
  { pattern: /\d{4}[-\/]\d{2}[-\/]\d{2}/i, score: 3 }, // Contains dates
];

// =============================================================================
// REVIEW VERIFIER
// =============================================================================

export class ReviewVerifier {
  // ---------------------------------------------------------------------------
  // VERIFICATION FLOW
  // ---------------------------------------------------------------------------

  /**
   * Verify a single review
   */
  async verifyReview(request: ReviewVerificationRequest): Promise<ReviewVerificationResult> {
    logger.info(
      {
        reviewId: request.reviewId,
        platform: request.platform,
      },
      'Starting review verification'
    );

    // Get review from database
    const review = await prisma.review.findUnique({
      where: { id: request.reviewId },
      include: {
        workHistory: true,
        platformConnection: true,
      },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    // Verify user owns this review
    if (review.userId !== request.userId) {
      throw new Error('Unauthorized access to review');
    }

    // Run verification checks
    const checks = await this.runVerificationChecks(review);

    // Detect suspicious patterns
    const flags = this.detectSuspiciousPatterns(review);

    // Calculate authenticity score
    const authenticityScore = this.calculateAuthenticityScore(checks, flags);

    const result: ReviewVerificationResult = {
      reviewId: request.reviewId,
      verified: authenticityScore >= 70,
      authenticityScore,
      checks,
      flags,
      verifiedAt: new Date(),
    };

    // Update database
    await prisma.review.update({
      where: { id: request.reviewId },
      data: {
        verified: result.verified,
        authenticityScore,
        verifiedAt: result.verifiedAt,
      },
    });

    logger.info(
      {
        reviewId: request.reviewId,
        verified: result.verified,
        authenticityScore,
      },
      'Review verification complete'
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // VERIFICATION CHECKS
  // ---------------------------------------------------------------------------

  private async runVerificationChecks(review: any): Promise<ReviewCheck[]> {
    const checks: ReviewCheck[] = [];

    // Check 1: Platform Verified
    if (review.syncedFromPlatform && review.platformReviewId) {
      checks.push({
        name: REVIEW_AUTHENTICITY_CHECKS.platformVerified.name,
        passed: true,
        score: 100,
        details: 'Review fetched directly from platform API',
      });
    } else {
      checks.push({
        name: REVIEW_AUTHENTICITY_CHECKS.platformVerified.name,
        passed: false,
        score: 0,
        details: 'Review was manually entered',
      });
    }

    // Check 2: Linked to Project
    if (review.workHistory && review.workHistory.platformProjectId) {
      checks.push({
        name: REVIEW_AUTHENTICITY_CHECKS.linkedToProject.name,
        passed: true,
        score: 100,
        details: `Linked to project: ${review.workHistory.title}`,
      });
    } else {
      checks.push({
        name: REVIEW_AUTHENTICITY_CHECKS.linkedToProject.name,
        passed: false,
        score: 0,
        details: 'Not linked to a verified project',
      });
    }

    // Check 3: Reviewer Identified
    if (review.reviewerId && review.reviewerName) {
      checks.push({
        name: REVIEW_AUTHENTICITY_CHECKS.reviewerIdentified.name,
        passed: true,
        score: 100,
        details: `Reviewer: ${review.reviewerName}`,
      });
    } else {
      checks.push({
        name: REVIEW_AUTHENTICITY_CHECKS.reviewerIdentified.name,
        passed: false,
        score: 50,
        details: 'Reviewer identity not fully verified',
      });
    }

    // Check 4: Content Analysis
    const contentScore = this.analyzeReviewContent(review.reviewText || '');
    checks.push({
      name: REVIEW_AUTHENTICITY_CHECKS.contentAnalysis.name,
      passed: contentScore >= 70,
      score: contentScore,
      details:
        contentScore >= 70
          ? 'Review content appears authentic'
          : 'Review content shows some suspicious patterns',
    });

    // Check 5: Timeline Valid
    if (review.workHistory && review.reviewDate) {
      const projectEnd = review.workHistory.endDate || review.workHistory.startDate;
      const reviewDate = new Date(review.reviewDate);
      const projectDate = new Date(projectEnd);

      // Review should be after project start and within reasonable time
      const daysSinceProject =
        (reviewDate.getTime() - projectDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceProject >= -7 && daysSinceProject <= 365) {
        checks.push({
          name: REVIEW_AUTHENTICITY_CHECKS.timelineValid.name,
          passed: true,
          score: 100,
          details: 'Review date aligns with project timeline',
        });
      } else {
        checks.push({
          name: REVIEW_AUTHENTICITY_CHECKS.timelineValid.name,
          passed: false,
          score: 30,
          details: `Review date is ${Math.abs(daysSinceProject).toFixed(0)} days from project`,
        });
      }
    } else {
      checks.push({
        name: REVIEW_AUTHENTICITY_CHECKS.timelineValid.name,
        passed: false,
        score: 50,
        details: 'Cannot verify timeline',
      });
    }

    return checks;
  }

  private analyzeReviewContent(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    let score = 100;

    // Check for suspicious patterns
    for (const { pattern, score: penalty } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(text)) {
        score -= penalty;
      }
    }

    // Length check
    if (text.length < 20) {
      score -= 20;
    } else if (text.length > 50 && text.length < 200) {
      score += 5; // Good length
    }

    // Variety check - reviews with varied language are more authentic
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const varietyRatio = uniqueWords.size / words.length;

    if (varietyRatio > 0.7) {
      score += 10;
    } else if (varietyRatio < 0.4) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  private detectSuspiciousPatterns(review: any): ReviewFlag[] {
    const flags: ReviewFlag[] = [];
    const text = review.reviewText || '';

    // Check for generic phrases
    if (/great to work with|would recommend|professional and reliable/i.test(text)) {
      flags.push({
        type: 'generic_language',
        severity: 'info',
        description: 'Review uses generic phrases common in template reviews',
      });
    }

    // Check for perfect rating with minimal text
    if (review.rating === review.maxRating && text.length < 50) {
      flags.push({
        type: 'perfect_minimal',
        severity: 'warning',
        description: 'Perfect rating with minimal review content',
      });
    }

    // Check for all caps
    if (/[A-Z]{10,}/.test(text)) {
      flags.push({
        type: 'excessive_caps',
        severity: 'info',
        description: 'Review contains excessive capitalization',
      });
    }

    // Check for emoji overuse
    const emojiCount = (text.match(/[\u{1F600}-\u{1F6FF}]/gu) || []).length;
    if (emojiCount > 5) {
      flags.push({
        type: 'emoji_overuse',
        severity: 'info',
        description: 'Review contains many emojis',
      });
    }

    return flags;
  }

  // ---------------------------------------------------------------------------
  // SCORING
  // ---------------------------------------------------------------------------

  private calculateAuthenticityScore(checks: ReviewCheck[], flags: ReviewFlag[]): number {
    // Weighted average of check scores
    let totalWeight = 0;
    let weightedSum = 0;

    for (const check of checks) {
      const checkDef = Object.values(REVIEW_AUTHENTICITY_CHECKS).find((c) => c.name === check.name);
      const weight = checkDef?.weight || 10;

      totalWeight += weight;
      weightedSum += check.score * weight;
    }

    let score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Deduct for flags
    for (const flag of flags) {
      switch (flag.severity) {
        case 'info':
          score -= 2;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'critical':
          score -= 25;
          break;
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ---------------------------------------------------------------------------
  // CROSS-PLATFORM AGGREGATION
  // ---------------------------------------------------------------------------

  /**
   * Calculate cross-platform review score
   */
  async calculateCrossPlatformScore(userId: string): Promise<CrossPlatformReviewScore> {
    logger.info({ userId }, 'Calculating cross-platform review score');

    // Get all reviews
    const reviews = await prisma.review.findMany({
      where: { userId },
      include: { workHistory: true },
      orderBy: { reviewDate: 'desc' },
    });

    if (reviews.length === 0) {
      return this.emptyReviewScore(userId);
    }

    // Calculate platform breakdown
    const platformMap = new Map<Platform, PlatformReviewSummary>();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const review of reviews) {
      const platform = (review.workHistory?.platform || 'MANUAL') as Platform;
      const existing = platformMap.get(platform) || {
        platform,
        averageRating: 0,
        reviewCount: 0,
        verifiedCount: 0,
        recentRating: 0,
      };

      existing.reviewCount += 1;
      existing.averageRating += review.rating / (review.maxRating || 5);

      if (review.verified) {
        existing.verifiedCount += 1;
      }

      if (review.reviewDate && new Date(review.reviewDate) > sixMonthsAgo) {
        existing.recentRating += review.rating / (review.maxRating || 5);
      }

      platformMap.set(platform, existing);
    }

    // Normalize averages
    for (const [platform, summary] of platformMap) {
      summary.averageRating = (summary.averageRating / summary.reviewCount) * 5;
      if (summary.recentRating > 0) {
        const recentCount = reviews.filter(
          (r) =>
            (r.workHistory?.platform || 'MANUAL') === platform &&
            r.reviewDate &&
            new Date(r.reviewDate) > sixMonthsAgo
        ).length;
        summary.recentRating = (summary.recentRating / recentCount) * 5;
      }
    }

    // Calculate overall rating (weighted by verification)
    let overallRating = 0;
    let totalWeight = 0;

    for (const review of reviews) {
      const weight = review.verified ? 1.5 : 1;
      const normalizedRating = review.rating / (review.maxRating || 5);
      overallRating += normalizedRating * weight;
      totalWeight += weight;
    }

    overallRating = totalWeight > 0 ? (overallRating / totalWeight) * 5 : 0;

    // Sentiment analysis
    const sentimentAnalysis = this.analyzeSentiment(reviews);

    // Extract themes
    const themes = this.extractThemes(reviews);

    // Calculate trends
    const trendData = this.calculateTrends(reviews);

    return {
      userId,
      overallRating: Math.round(overallRating * 100) / 100,
      totalReviews: reviews.length,
      verifiedReviews: reviews.filter((r) => r.verified).length,
      platformBreakdown: Array.from(platformMap.values()),
      sentimentAnalysis,
      themes,
      trendData,
    };
  }

  private emptyReviewScore(userId: string): CrossPlatformReviewScore {
    return {
      userId,
      overallRating: 0,
      totalReviews: 0,
      verifiedReviews: 0,
      platformBreakdown: [],
      sentimentAnalysis: {
        positive: 0,
        neutral: 100,
        negative: 0,
        keywords: [],
      },
      themes: [],
      trendData: [],
    };
  }

  // ---------------------------------------------------------------------------
  // SENTIMENT ANALYSIS
  // ---------------------------------------------------------------------------

  private analyzeSentiment(reviews: any[]): SentimentAnalysis {
    const positiveWords = [
      'great',
      'excellent',
      'amazing',
      'wonderful',
      'fantastic',
      'professional',
      'skilled',
      'talented',
      'recommend',
      'best',
      'perfect',
      'outstanding',
    ];

    const negativeWords = [
      'poor',
      'bad',
      'terrible',
      'awful',
      'disappointing',
      'unprofessional',
      'late',
      'missed',
      'failed',
      'avoid',
      'worst',
      'slow',
    ];

    const keywordCounts = new Map<string, { count: number; sentiment: 'positive' | 'negative' }>();
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    for (const review of reviews) {
      const text = (review.reviewText || '').toLowerCase();
      const normalizedRating = review.rating / (review.maxRating || 5);

      // Count by rating
      if (normalizedRating >= 0.8) {
        positiveCount++;
      } else if (normalizedRating <= 0.4) {
        negativeCount++;
      } else {
        neutralCount++;
      }

      // Extract keywords
      for (const word of positiveWords) {
        if (text.includes(word)) {
          const existing = keywordCounts.get(word) || {
            count: 0,
            sentiment: 'positive' as const,
          };
          existing.count++;
          keywordCounts.set(word, existing);
        }
      }

      for (const word of negativeWords) {
        if (text.includes(word)) {
          const existing = keywordCounts.get(word) || {
            count: 0,
            sentiment: 'negative' as const,
          };
          existing.count++;
          keywordCounts.set(word, existing);
        }
      }
    }

    const total = reviews.length || 1;

    return {
      positive: Math.round((positiveCount / total) * 100),
      neutral: Math.round((neutralCount / total) * 100),
      negative: Math.round((negativeCount / total) * 100),
      keywords: Array.from(keywordCounts.entries())
        .map(([word, data]) => ({ word, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  // ---------------------------------------------------------------------------
  // THEME EXTRACTION
  // ---------------------------------------------------------------------------

  private extractThemes(reviews: any[]): ReviewTheme[] {
    const themePatterns: {
      theme: string;
      patterns: RegExp[];
      sentiment: ReviewTheme['sentiment'];
    }[] = [
      {
        theme: 'Communication',
        patterns: [/communicat/i, /responsive/i, /reply|respond/i],
        sentiment: 'positive',
      },
      {
        theme: 'Quality of Work',
        patterns: [/quality|excellent work|great work/i, /professional/i],
        sentiment: 'positive',
      },
      {
        theme: 'Timeliness',
        patterns: [/on time|deadline|timely|fast|quick/i],
        sentiment: 'positive',
      },
      {
        theme: 'Technical Skills',
        patterns: [/technical|skill|expert|knowledge/i],
        sentiment: 'positive',
      },
      {
        theme: 'Reliability',
        patterns: [/reliable|dependable|trust/i],
        sentiment: 'positive',
      },
      {
        theme: 'Delays',
        patterns: [/late|delay|missed deadline/i, /slow/i],
        sentiment: 'negative',
      },
      {
        theme: 'Communication Issues',
        patterns: [/hard to reach|no response|didn't respond/i],
        sentiment: 'negative',
      },
    ];

    const themes: ReviewTheme[] = [];

    for (const { theme, patterns, sentiment } of themePatterns) {
      const examples: string[] = [];
      let frequency = 0;

      for (const review of reviews) {
        const text = review.reviewText || '';

        for (const pattern of patterns) {
          if (pattern.test(text)) {
            frequency++;
            if (examples.length < 3) {
              const match = text.match(pattern);
              if (match) {
                // Extract surrounding context
                const startIndex = Math.max(0, text.indexOf(match[0]) - 20);
                const endIndex = Math.min(
                  text.length,
                  text.indexOf(match[0]) + match[0].length + 20
                );
                examples.push(`...${text.substring(startIndex, endIndex)}...`);
              }
            }
            break; // Only count once per review
          }
        }
      }

      if (frequency > 0) {
        themes.push({ theme, frequency, sentiment, examples });
      }
    }

    return themes.sort((a, b) => b.frequency - a.frequency);
  }

  // ---------------------------------------------------------------------------
  // TREND CALCULATION
  // ---------------------------------------------------------------------------

  private calculateTrends(reviews: any[]): ReviewTrend[] {
    const quarterMap = new Map<string, { ratings: number[]; count: number }>();

    for (const review of reviews) {
      if (!review.reviewDate) continue;

      const date = new Date(review.reviewDate);
      const year = date.getFullYear();
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      const period = `${year}-Q${quarter}`;

      const existing = quarterMap.get(period) || { ratings: [], count: 0 };
      existing.ratings.push(review.rating / (review.maxRating || 5));
      existing.count++;
      quarterMap.set(period, existing);
    }

    return Array.from(quarterMap.entries())
      .map(([period, data]) => ({
        period,
        averageRating: (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 5,
        reviewCount: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  // ---------------------------------------------------------------------------
  // BATCH OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Verify all reviews for a user
   */
  async verifyAllReviews(userId: string): Promise<Map<string, ReviewVerificationResult>> {
    const reviews = await prisma.review.findMany({
      where: { userId, verified: false },
      include: { workHistory: true },
    });

    const results = new Map<string, ReviewVerificationResult>();

    for (const review of reviews) {
      try {
        const result = await this.verifyReview({
          userId,
          reviewId: review.id,
          platform: (review.workHistory?.platform || 'MANUAL') as Platform,
        });
        results.set(review.id, result);
      } catch (error) {
        logger.warn({ error, reviewId: review.id }, 'Failed to verify review');
      }
    }

    return results;
  }
}

// Singleton instance
let verifierInstance: ReviewVerifier | null = null;

export function getReviewVerifier(): ReviewVerifier {
  if (!verifierInstance) {
    verifierInstance = new ReviewVerifier();
  }
  return verifierInstance;
}

