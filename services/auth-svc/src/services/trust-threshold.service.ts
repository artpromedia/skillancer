/**
 * @module @skillancer/auth-svc/services/trust-threshold
 * Trust Threshold Service
 *
 * Manages trust score thresholds and access control:
 * - Checks if users meet requirements for actions
 * - Manages configurable thresholds
 * - Provides suggestions for meeting requirements
 */

import { createLogger } from '@skillancer/logger';

import { getTrustScoreService, type TrustScoreService } from './trust-score.service.js';

import type { ThresholdRequirement, ThresholdCheckResult } from '../types/trust-score.types.js';
import type {
  PrismaClient,
  TrustTier,
  ThresholdContextType,
  VerificationLevel,
} from '@skillancer/database';
import type { Redis } from 'ioredis';

const logger = createLogger({ serviceName: 'trust-threshold-service' });

// =============================================================================
// CONSTANTS
// =============================================================================

/** Cache TTL for threshold configurations (15 minutes) */
const THRESHOLD_CACHE_TTL = 900;

/** Cache key prefix */
const THRESHOLD_CACHE_PREFIX = 'trust-threshold:';

// =============================================================================
// DEFAULT THRESHOLDS
// =============================================================================

const DEFAULT_THRESHOLDS: Record<ThresholdContextType, number> = {
  JOB: 0, // Per-job thresholds (default: anyone can apply)
  TENANT: 30, // Tenant-wide thresholds
  POD_TEMPLATE: 40, // SkillPod template thresholds
  GLOBAL: 20, // Platform-wide minimum
};

// =============================================================================
// TRUST THRESHOLD SERVICE
// =============================================================================

export class TrustThresholdService {
  private trustScoreService: TrustScoreService | null = null;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  /**
   * Lazy initialization of trust score service to avoid circular dependencies
   */
  private getTrustScoreServiceInstance(): TrustScoreService {
    if (!this.trustScoreService) {
      this.trustScoreService = getTrustScoreService();
    }
    return this.trustScoreService;
  }

  // ===========================================================================
  // THRESHOLD CHECKING
  // ===========================================================================

  /**
   * Check if a user meets a threshold requirement
   */
  async checkThreshold(
    userId: string,
    contextType: ThresholdContextType,
    contextId?: string
  ): Promise<ThresholdCheckResult> {
    // Get user's current trust score
    const { score } = await this.getTrustScoreServiceInstance().getTrustScore(userId);

    // Get the threshold requirement
    const requirement = await this.getThresholdRequirement(contextType, contextId);

    // Perform the check
    const passed = this.evaluateRequirement(score.overallScore, score.tier, requirement);

    const gap = passed ? 0 : requirement.minimumScore - score.overallScore;

    // Generate suggestions if not passed
    const suggestions = passed ? [] : this.generateSuggestions(score, requirement);

    const result: ThresholdCheckResult = {
      passed,
      currentScore: score.overallScore,
      requiredScore: requirement.minimumScore,
      currentTier: score.tier,
      requiredTier: requirement.minimumTier,
      gap,
      suggestions,
    };

    logger.debug({
      msg: 'Threshold check performed',
      userId,
      contextType,
      passed,
      currentScore: score.overallScore,
      requiredScore: requirement.minimumScore,
    });

    return result;
  }

  /**
   * Check multiple thresholds at once
   */
  async checkMultipleThresholds(
    userId: string,
    requirements: Array<{ contextType: ThresholdContextType; contextId?: string }>
  ): Promise<Map<ThresholdContextType, ThresholdCheckResult>> {
    const results = new Map<ThresholdContextType, ThresholdCheckResult>();

    // Get score once
    const { score } = await this.getTrustScoreServiceInstance().getTrustScore(userId);

    for (const req of requirements) {
      const requirement = await this.getThresholdRequirement(req.contextType, req.contextId);
      const passed = this.evaluateRequirement(score.overallScore, score.tier, requirement);
      const gap = passed ? 0 : requirement.minimumScore - score.overallScore;
      const suggestions = passed ? [] : this.generateSuggestions(score, requirement);

      results.set(req.contextType, {
        passed,
        currentScore: score.overallScore,
        requiredScore: requirement.minimumScore,
        currentTier: score.tier,
        requiredTier: requirement.minimumTier,
        gap,
        suggestions,
      });
    }

    return results;
  }

  /**
   * Quick check if user meets minimum score (no detailed result)
   */
  async meetsMinimumScore(
    userId: string,
    contextType: ThresholdContextType,
    contextId?: string
  ): Promise<boolean> {
    const result = await this.checkThreshold(userId, contextType, contextId);
    return result.passed;
  }

  // ===========================================================================
  // THRESHOLD CONFIGURATION
  // ===========================================================================

  /**
   * Get threshold requirement for a context
   */
  async getThresholdRequirement(
    contextType: ThresholdContextType,
    contextId?: string
  ): Promise<ThresholdRequirement> {
    // Try cache first
    const cached = await this.getCachedThreshold(contextType, contextId);
    if (cached) {
      return cached;
    }

    // Try database
    const dbThreshold = await this.prisma.trustScoreThreshold.findFirst({
      where: {
        contextType,
        contextId: contextId ?? null,
      },
    });

    if (dbThreshold) {
      const requirement: ThresholdRequirement = {
        contextType: dbThreshold.contextType,
        contextId: dbThreshold.contextId ?? undefined,
        minimumScore: dbThreshold.minimumScore,
        minimumTier: dbThreshold.minimumTier ?? undefined,
        requireVerification: dbThreshold.requireVerification,
        minimumVerificationLevel: dbThreshold.minimumVerificationLevel
          ? this.verificationLevelToNumber(dbThreshold.minimumVerificationLevel)
          : undefined,
      };

      await this.cacheThreshold(contextType, contextId, requirement);
      return requirement;
    }

    // Fall back to defaults
    const defaultRequirement: ThresholdRequirement = {
      contextType,
      contextId,
      minimumScore: DEFAULT_THRESHOLDS[contextType],
    };

    return defaultRequirement;
  }

  /**
   * Set or update a threshold configuration
   */
  async setThreshold(
    contextType: ThresholdContextType,
    minimumScore: number,
    createdBy: string,
    options: {
      contextId?: string;
      minimumTier?: TrustTier;
      requireVerification?: boolean;
      minimumVerificationLevel?: VerificationLevel;
    } = {}
  ): Promise<void> {
    // Check if threshold exists
    const existing = await this.prisma.trustScoreThreshold.findFirst({
      where: {
        contextType,
        contextId: options.contextId ?? null,
      },
    });

    // Build update/create data without undefined values
    const baseData: {
      minimumScore: number;
      requireVerification: boolean;
      minimumTier?: TrustTier;
      minimumVerificationLevel?: VerificationLevel;
    } = {
      minimumScore,
      requireVerification: options.requireVerification ?? false,
    };
    if (options.minimumTier !== undefined) {
      baseData.minimumTier = options.minimumTier;
    }
    if (options.minimumVerificationLevel !== undefined) {
      baseData.minimumVerificationLevel = options.minimumVerificationLevel;
    }

    if (existing) {
      await this.prisma.trustScoreThreshold.update({
        where: { id: existing.id },
        data: baseData,
      });
    } else {
      await this.prisma.trustScoreThreshold.create({
        data: {
          contextType,
          contextId: options.contextId ?? null,
          createdBy,
          ...baseData,
        },
      });
    }

    // Invalidate cache
    await this.invalidateThresholdCache(contextType, options.contextId);

    logger.info({
      msg: 'Threshold configuration updated',
      contextType,
      contextId: options.contextId,
      minimumScore,
      minimumTier: options.minimumTier,
    });
  }

  /**
   * Delete a threshold configuration
   */
  async deleteThreshold(contextType: ThresholdContextType, contextId?: string): Promise<void> {
    await this.prisma.trustScoreThreshold.deleteMany({
      where: {
        contextType,
        contextId: contextId ?? null,
      },
    });

    await this.invalidateThresholdCache(contextType, contextId);

    logger.info({
      msg: 'Threshold configuration deleted',
      contextType,
      contextId,
    });
  }

  /**
   * Get all thresholds
   */
  async getAllThresholds(): Promise<ThresholdRequirement[]> {
    const thresholds = await this.prisma.trustScoreThreshold.findMany({
      orderBy: { contextType: 'asc' },
    });

    return thresholds.map((t) => ({
      contextType: t.contextType,
      contextId: t.contextId ?? undefined,
      minimumScore: t.minimumScore,
      minimumTier: t.minimumTier ?? undefined,
      requireVerification: t.requireVerification,
      minimumVerificationLevel: t.minimumVerificationLevel
        ? this.verificationLevelToNumber(t.minimumVerificationLevel)
        : undefined,
    }));
  }

  /**
   * Convert VerificationLevel enum to number
   */
  private verificationLevelToNumber(level: VerificationLevel): number {
    const levelMap: Record<VerificationLevel, number> = {
      NONE: 0,
      EMAIL: 1,
      BASIC: 2,
      ENHANCED: 3,
      PREMIUM: 4,
    };
    return levelMap[level] ?? 0;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Evaluate if a score/tier meets the requirement
   */
  private evaluateRequirement(
    currentScore: number,
    currentTier: TrustTier,
    requirement: ThresholdRequirement
  ): boolean {
    // Check minimum score
    if (currentScore < requirement.minimumScore) {
      return false;
    }

    // Check tier requirement if specified
    if (requirement.minimumTier) {
      const tierOrder: TrustTier[] = [
        'EMERGING',
        'ESTABLISHED',
        'TRUSTED',
        'HIGHLY_TRUSTED',
        'ELITE',
      ];
      const currentTierIndex = tierOrder.indexOf(currentTier);
      const requiredTierIndex = tierOrder.indexOf(requirement.minimumTier);

      if (currentTierIndex < requiredTierIndex) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate suggestions for meeting requirements
   */
  private generateSuggestions(
    score: {
      overallScore: number;
      tier: TrustTier;
      components: {
        reviewScore: number;
        verificationScore: number;
        complianceScore: number;
        activityScore: number;
      };
    },
    requirement: ThresholdRequirement
  ): string[] {
    const suggestions: string[] = [];
    const gap = requirement.minimumScore - score.overallScore;

    if (gap > 0) {
      suggestions.push(
        `Increase your trust score by ${gap.toFixed(1)} points to meet the requirement`
      );
    }

    // Add component-specific suggestions
    if (score.components.reviewScore < 50) {
      suggestions.push('Complete projects and earn positive reviews');
    }

    if (score.components.verificationScore < 50) {
      suggestions.push('Complete identity verification');
    }

    if (score.components.complianceScore < 50) {
      suggestions.push('Maintain good compliance in SkillPod sessions');
    }

    if (score.components.activityScore < 50) {
      suggestions.push('Stay active on the platform');
    }

    return suggestions.slice(0, 3);
  }

  // ===========================================================================
  // CACHING
  // ===========================================================================

  private async getCachedThreshold(
    contextType: ThresholdContextType,
    contextId?: string
  ): Promise<ThresholdRequirement | null> {
    const key = this.getThresholdCacheKey(contextType, contextId);
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as ThresholdRequirement;
      }
    } catch {
      // Ignore cache errors
    }
    return null;
  }

  private async cacheThreshold(
    contextType: ThresholdContextType,
    contextId: string | undefined,
    requirement: ThresholdRequirement
  ): Promise<void> {
    const key = this.getThresholdCacheKey(contextType, contextId);
    try {
      await this.redis.setex(key, THRESHOLD_CACHE_TTL, JSON.stringify(requirement));
    } catch {
      // Ignore cache errors
    }
  }

  private async invalidateThresholdCache(
    contextType: ThresholdContextType,
    contextId?: string
  ): Promise<void> {
    const key = this.getThresholdCacheKey(contextType, contextId);
    try {
      await this.redis.del(key);
    } catch {
      // Ignore cache errors
    }
  }

  private getThresholdCacheKey(contextType: ThresholdContextType, contextId?: string): string {
    return `${THRESHOLD_CACHE_PREFIX}${contextType}:${contextId ?? 'global'}`;
  }
}

// =============================================================================
// MODULE INITIALIZATION
// =============================================================================

let thresholdService: TrustThresholdService | null = null;

/**
 * Initialize the trust threshold service
 */
export function initializeTrustThresholdService(
  prisma: PrismaClient,
  redis: Redis
): TrustThresholdService {
  thresholdService = new TrustThresholdService(prisma, redis);
  logger.info({ msg: 'Trust threshold service initialized' });
  return thresholdService;
}

/**
 * Get the initialized trust threshold service
 */
export function getTrustThresholdService(): TrustThresholdService {
  if (!thresholdService) {
    throw new Error(
      'Trust threshold service not initialized. Call initializeTrustThresholdService first.'
    );
  }
  return thresholdService;
}
