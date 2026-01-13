/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * Bid Quality Service
 *
 * Evaluates bid quality using multiple factors:
 * - Cover letter quality (length, personalization, templates)
 * - Rate reasonability (within budget range)
 * - Freelancer profile completeness
 * - Historical success rate
 * - Spam detection
 */

import type {
  BidQualityFactors,
  BidQualityInput,
  BidQualityResult,
} from '../types/bidding.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Quality scoring weights
const WEIGHTS = {
  coverLetter: 0.25,
  rateMatch: 0.2,
  profileComplete: 0.15,
  successRate: 0.2,
  responsiveness: 0.1,
  trustScore: 0.1,
};

// Minimum thresholds
const MIN_COVER_LETTER_LENGTH = 100;
const OPTIMAL_COVER_LETTER_LENGTH = 500;
const MAX_COVER_LETTER_LENGTH = 2000;

// Spam detection patterns
const SPAM_PATTERNS = [
  /please\s+contact\s+me\s+(?:at|on)\s+(?:whatsapp|telegram|skype)/i,
  /(?:phone|call|text)\s+me\s+at\s+\d+/i,
  /(\d+[\s-]?){6,}/, // Phone numbers
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses
  /(?:add|contact|reach)\s+me\s+on\s+(?:facebook|instagram|twitter|linkedin)/i,
  /pay\s+(?:me\s+)?(?:via|through)\s+(?:paypal|venmo|cashapp|crypto)/i,
];

// Template detection patterns
const TEMPLATE_PATTERNS = [
  /^dear\s+(?:sir|madam|hiring\s+manager)/i,
  /i\s+am\s+(?:a\s+)?(?:highly\s+)?experienced\s+(?:professional|expert|developer)/i,
  /i\s+am\s+writing\s+to\s+express\s+my\s+interest/i,
  /i\s+would\s+love\s+to\s+work\s+on\s+this\s+project/i,
  /please\s+check\s+my\s+portfolio/i,
  /i\s+have\s+\d+\+?\s+years?\s+of\s+experience/i,
];

// Cache TTL for freelancer scores
const FREELANCER_SCORE_TTL = 60 * 60; // 1 hour

export class BidQualityService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {}

  /**
   * Calculate bid quality score
   */
  async calculateQualityScore(input: BidQualityInput): Promise<BidQualityResult> {
    const factors: BidQualityFactors = {};
    let totalScore = 0;

    // 1. Evaluate cover letter
    const coverLetterScore = this.evaluateCoverLetter(input.coverLetter, factors);
    totalScore += coverLetterScore * WEIGHTS.coverLetter;

    // 2. Evaluate rate reasonability
    const rateScore = this.evaluateRate(
      input.proposedRate,
      input.budgetMin,
      input.budgetMax,
      factors
    );
    totalScore += rateScore * WEIGHTS.rateMatch;

    // 3. Get freelancer metrics (cached)
    const freelancerMetrics = await this.getFreelancerMetrics(input.freelancerId, factors);
    totalScore += freelancerMetrics.profileScore * WEIGHTS.profileComplete;
    totalScore += freelancerMetrics.successScore * WEIGHTS.successRate;
    totalScore += freelancerMetrics.responsivenessScore * WEIGHTS.responsiveness;
    totalScore += freelancerMetrics.trustScore * WEIGHTS.trustScore;

    // 4. Check for spam
    const spamResult = this.detectSpam(input.coverLetter, input.freelancerId);

    // Normalize to 0-100
    const finalScore = Math.round(totalScore * 100);

    return {
      score: finalScore,
      factors,
      isSpam: spamResult.isSpam,
      spamReason: spamResult.reason,
    };
  }

  /**
   * Evaluate cover letter quality
   */
  private evaluateCoverLetter(coverLetter: string, factors: BidQualityFactors): number {
    let score = 0;

    // Length check
    const length = coverLetter.length;
    factors.coverLetterLength = length;

    if (length < MIN_COVER_LETTER_LENGTH) {
      factors.coverLetterLengthScore = 0;
    } else if (length <= OPTIMAL_COVER_LETTER_LENGTH) {
      factors.coverLetterLengthScore =
        (length - MIN_COVER_LETTER_LENGTH) /
        (OPTIMAL_COVER_LETTER_LENGTH - MIN_COVER_LETTER_LENGTH);
    } else if (length <= MAX_COVER_LETTER_LENGTH) {
      factors.coverLetterLengthScore = 1;
    } else {
      // Penalty for too long
      factors.coverLetterLengthScore = 0.8;
    }
    score += factors.coverLetterLengthScore * 0.4;

    // Template detection
    const templateMatches = TEMPLATE_PATTERNS.filter((p) => p.test(coverLetter));
    factors.templateIndicators = templateMatches.length;
    if (templateMatches.length === 0) {
      factors.personalizationScore = 1;
    } else if (templateMatches.length <= 2) {
      factors.personalizationScore = 0.7;
    } else {
      factors.personalizationScore = 0.3;
    }
    score += factors.personalizationScore * 0.4;

    // Readability (basic check - average word length, sentence structure)
    const words = coverLetter.split(/\s+/);
    const avgWordLength = coverLetter.replaceAll(/\s+/g, '').length / words.length;
    factors.avgWordLength = avgWordLength;

    // Penalize very short or very long average word lengths
    if (avgWordLength >= 4 && avgWordLength <= 8) {
      factors.readabilityScore = 1;
    } else if (avgWordLength >= 3 && avgWordLength <= 10) {
      factors.readabilityScore = 0.7;
    } else {
      factors.readabilityScore = 0.4;
    }
    score += factors.readabilityScore * 0.2;

    return Math.min(1, score);
  }

  /**
   * Evaluate rate reasonability
   */
  private evaluateRate(
    proposedRate: number,
    budgetMin?: number,
    budgetMax?: number,
    factors?: BidQualityFactors
  ): number {
    if (factors) {
      factors.proposedRate = proposedRate;
      if (budgetMin !== undefined) factors.budgetMin = budgetMin;
      if (budgetMax !== undefined) factors.budgetMax = budgetMax;
    }

    // No budget specified - assume reasonable
    if (budgetMin === undefined && budgetMax === undefined) {
      if (factors) factors.rateWithinBudget = true;
      return 0.8;
    }

    // Check if within range
    const min = budgetMin || 0;
    const max = budgetMax || Infinity;

    if (proposedRate >= min && proposedRate <= max) {
      if (factors) factors.rateWithinBudget = true;

      // Prefer rates in the middle-lower part of range (competitive)
      if (max !== Infinity) {
        const range = max - min;
        const position = (proposedRate - min) / range;
        // Optimal is 30-70% of range
        if (position >= 0.3 && position <= 0.7) {
          return 1;
        }
        return 0.8;
      }
      return 1;
    }

    if (factors) factors.rateWithinBudget = false;

    // Outside range - calculate how far
    if (proposedRate < min) {
      const ratio = proposedRate / min;
      return Math.max(0.2, ratio * 0.7);
    }

    if (proposedRate > max) {
      const ratio = max / proposedRate;
      return Math.max(0.1, ratio * 0.6);
    }

    return 0.5;
  }

  /**
   * Get freelancer quality metrics
   */
  private async getFreelancerMetrics(
    freelancerId: string,
    factors: BidQualityFactors
  ): Promise<{
    profileScore: number;
    successScore: number;
    responsivenessScore: number;
    trustScore: number;
  }> {
    // Check cache first
    const cacheKey = `freelancer:quality:${freelancerId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const metrics = JSON.parse(cached);
      Object.assign(factors, metrics.factors);
      return metrics.scores;
    }

    // Fetch freelancer data
    const freelancer = await this.prisma.user.findUnique({
      where: { id: freelancerId },
      include: {
        profile: true,
        ratingAggregation: true,
        trustScore: true,
        _count: {
          select: {
            contractsAsFreelancer: true,
          },
        },
      },
    });

    if (!freelancer) {
      return {
        profileScore: 0,
        successScore: 0,
        responsivenessScore: 0,
        trustScore: 0,
      };
    }

    // Calculate profile completeness
    let profileFields = 0;
    const totalProfileFields = 6;
    const profile = freelancer.profile;

    if (profile) {
      if (profile.bio) profileFields++;
      if (profile.title) profileFields++;
      if (profile.hourlyRate) profileFields++;
      if (profile.country) profileFields++;
      if (profile.portfolioUrl) profileFields++;
    }
    factors.profileCompleteness = profileFields / totalProfileFields;
    const profileScore = factors.profileCompleteness;

    // Calculate success rate
    const ratingAgg = freelancer.ratingAggregation;
    const totalContracts = freelancer._count.contractsAsFreelancer || 0;

    factors.totalContracts = totalContracts;
    factors.averageRating = ratingAgg?.freelancerAverageRating
      ? Number(ratingAgg.freelancerAverageRating)
      : undefined;

    let successScore = 0.5; // Default for new freelancers
    if (totalContracts > 0 && ratingAgg) {
      const avgRating = Number(ratingAgg.freelancerAverageRating) || 0;
      // Normalize 1-5 rating to 0-1 score
      successScore = Math.min(1, (avgRating - 1) / 4);

      // Boost for high volume
      if (totalContracts >= 10) successScore = Math.min(1, successScore * 1.1);
      if (totalContracts >= 50) successScore = Math.min(1, successScore * 1.05);
    }
    factors.successRateScore = successScore;

    // Responsiveness - based on trust score metrics
    const trustData = freelancer.trustScore;
    let responsivenessScore = 0.5;
    if (trustData) {
      // Use overall score as proxy for responsiveness
      responsivenessScore = Math.min(1, (trustData.overallScore || 50) / 100);
    }
    factors.responsivenessScore = responsivenessScore;

    // Trust score
    let trustScore = 0.5;
    if (trustData) {
      trustScore = Math.min(1, (trustData.overallScore || 50) / 100);
    }
    factors.trustScore = trustScore;
    factors.trustTier = trustData?.tier;

    // Cache the results
    const cacheData = {
      factors: {
        profileCompleteness: factors.profileCompleteness,
        totalContracts: factors.totalContracts,
        averageRating: factors.averageRating,
        successRateScore: factors.successRateScore,
        responsivenessScore: factors.responsivenessScore,
        trustScore: factors.trustScore,
        trustTier: factors.trustTier,
      },
      scores: { profileScore, successScore, responsivenessScore, trustScore },
    };
    await this.redis.setex(cacheKey, FREELANCER_SCORE_TTL, JSON.stringify(cacheData));

    return { profileScore, successScore, responsivenessScore, trustScore };
  }

  /**
   * Detect spam in bid
   */
  detectSpam(coverLetter: string, freelancerId: string): { isSpam: boolean; reason?: string } {
    // Check for spam patterns
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(coverLetter)) {
        this.logger.warn({
          msg: 'Spam pattern detected in bid',
          freelancerId,
          pattern: pattern.toString(),
        });
        return {
          isSpam: true,
          reason: 'Cover letter contains prohibited content (external contact info)',
        };
      }
    }

    // Check for excessive repetition
    const words = coverLetter.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      if (word.length > 3) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    const maxRepetition = Math.max(...wordCounts.values(), 0);
    if (maxRepetition > 10 && maxRepetition > words.length * 0.1) {
      return {
        isSpam: true,
        reason: 'Cover letter contains excessive word repetition',
      };
    }

    // Check for too short cover letter (likely copy-paste)
    if (coverLetter.length < 50) {
      return {
        isSpam: true,
        reason: 'Cover letter is too short to be meaningful',
      };
    }

    return { isSpam: false };
  }

  /**
   * Bulk evaluate bids for a project
   */
  async evaluateBidsForProject(projectId: string): Promise<Map<string, number>> {
    const bids = await this.prisma.bid.findMany({
      where: { jobId: projectId },
      select: { id: true, qualityScore: true },
    });

    const scores = new Map<string, number>();
    for (const bid of bids) {
      scores.set(bid.id, Number(bid.qualityScore) || 0);
    }

    return scores;
  }

  /**
   * Get quality distribution for a project
   */
  async getProjectQualityDistribution(
    projectId: string
  ): Promise<{ excellent: number; good: number; fair: number; poor: number }> {
    const bids = await this.prisma.bid.findMany({
      where: {
        jobId: projectId,
        isSpam: false,
        status: { not: 'WITHDRAWN' },
      },
      select: { qualityScore: true },
    });

    return {
      excellent: bids.filter((b) => (b.qualityScore || 0) >= 80).length,
      good: bids.filter((b) => (b.qualityScore || 0) >= 60 && (b.qualityScore || 0) < 80).length,
      fair: bids.filter((b) => (b.qualityScore || 0) >= 40 && (b.qualityScore || 0) < 60).length,
      poor: bids.filter((b) => (b.qualityScore || 0) < 40).length,
    };
  }

  /**
   * Invalidate freelancer quality cache
   */
  async invalidateFreelancerCache(freelancerId: string): Promise<void> {
    await this.redis.del(`freelancer:quality:${freelancerId}`);
  }
}
