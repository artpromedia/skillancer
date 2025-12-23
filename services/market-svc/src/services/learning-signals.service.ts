/**
 * @module @skillancer/market-svc/services/learning-signals
 * Learning Signal Service
 *
 * Emits learning recommendation signals based on market activity.
 * This service wraps the event publisher and provides domain-specific
 * methods for emitting signals that SkillPod uses to generate recommendations.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  createLearningRecommendationEventPublisher,
  extractSkillGapsFromJobMatch,
  calculateSkillMatchScore,
  type LearningRecommendationEventPublisher,
  type SkillLevel,
  type SkillImportance,
  type SkillRequirement,
} from '../messaging/learning-recommendation-events.publisher.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface LearningSignalServiceConfig {
  enabled: boolean;
  channel: string;
}

const DEFAULT_CONFIG: LearningSignalServiceConfig = {
  enabled: true,
  channel: 'skillpod:learning-recommendations',
};

interface JobSkillInfo {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  experienceLevel: string;
  budgetMin?: number;
  budgetMax?: number;
  requiredSkills: Array<{
    skillId: string;
    skillName: string;
    level: SkillLevel;
    importance: SkillImportance;
  }>;
  preferredSkills: Array<{
    skillId: string;
    skillName: string;
    level: SkillLevel;
    importance: SkillImportance;
  }>;
}

interface UserSkillInfo {
  userId: string;
  skills: Array<{
    skillId: string;
    skillName: string;
    level: SkillLevel;
    yearsExperience: number;
  }>;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class LearningSignalService {
  private readonly publisher: LearningRecommendationEventPublisher;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger,
    config: Partial<LearningSignalServiceConfig> = {}
  ) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    this.publisher = createLearningRecommendationEventPublisher(
      { prisma, redis, logger },
      { enabled: mergedConfig.enabled, channel: mergedConfig.channel }
    );
  }

  /**
   * Signal that a user viewed a job posting
   */
  async signalJobViewed(
    userId: string,
    job: JobSkillInfo,
    viewContext: {
      source: 'search' | 'recommendation' | 'direct' | 'email';
      viewDuration: number; // seconds
    }
  ): Promise<void> {
    try {
      await this.publisher.publishJobViewed({
        userId,
        jobId: job.id,
        jobTitle: job.title,
        requiredSkills: job.requiredSkills.map((s) => ({
          skillId: s.skillId,
          skillName: s.skillName,
          level: s.level,
          importance: s.importance,
        })),
        preferredSkills: job.preferredSkills.map((s) => ({
          skillId: s.skillId,
          skillName: s.skillName,
          level: s.level,
          importance: s.importance,
        })),
        category: job.category,
        subcategory: job.subcategory,
        budgetRange:
          job.budgetMin && job.budgetMax ? { min: job.budgetMin, max: job.budgetMax } : undefined,
        experienceLevel: job.experienceLevel,
        viewDuration: viewContext.viewDuration,
        source: viewContext.source,
      });

      this.logger.debug({
        msg: 'Signaled job viewed for learning recommendations',
        userId,
        jobId: job.id,
      });
    } catch (error) {
      this.logger.warn({ msg: 'Failed to signal job viewed', userId, jobId: job.id, error });
    }
  }

  /**
   * Signal that a user applied to a job
   */
  async signalJobApplication(
    userId: string,
    job: JobSkillInfo,
    user: UserSkillInfo,
    applicationDetails: {
      proposalAmount: number;
      coverLetterLength: number;
      attachmentsCount: number;
    }
  ): Promise<void> {
    try {
      // Calculate skill match and gaps
      const allJobSkills = [
        ...job.requiredSkills.map((s) => ({
          skillId: s.skillId,
          requiredLevel: this.levelToNumber(s.level),
          importance: s.importance,
        })),
        ...job.preferredSkills.map((s) => ({
          skillId: s.skillId,
          requiredLevel: this.levelToNumber(s.level),
          importance: s.importance,
        })),
      ];

      const userSkillMap = new Map(
        user.skills.map((s) => [s.skillId, this.levelToNumber(s.level)])
      );

      const matchScore = calculateSkillMatchScore(
        allJobSkills,
        Array.from(userSkillMap.entries()).map(([skillId, level]) => ({
          skillId,
          currentLevel: level,
        }))
      );

      const skillGaps = extractSkillGapsFromJobMatch(
        job.requiredSkills.map((s) => ({
          skillId: s.skillId,
          skillName: s.skillName,
          requiredLevel: this.levelToNumber(s.level),
        })),
        user.skills.map((s) => ({
          skillId: s.skillId,
          currentLevel: this.levelToNumber(s.level),
        }))
      );

      const missingSkills = skillGaps.filter((g) => g.currentLevel === 0).map((g) => g.skillId);

      const partialSkills = skillGaps
        .filter((g) => g.currentLevel > 0 && g.currentLevel < g.requiredLevel)
        .map((g) => g.skillId);

      await this.publisher.publishJobApplication({
        userId,
        jobId: job.id,
        jobTitle: job.title,
        requiredSkills: job.requiredSkills as SkillRequirement[],
        preferredSkills: job.preferredSkills as SkillRequirement[],
        category: job.category,
        proposalAmount: applicationDetails.proposalAmount,
        coverLetterLength: applicationDetails.coverLetterLength,
        attachmentsCount: applicationDetails.attachmentsCount,
        userSkillMatch: Math.round(matchScore * 100),
        missingSkills,
        partialSkills,
      });

      this.logger.debug({
        msg: 'Signaled job application for learning recommendations',
        userId,
        jobId: job.id,
        matchScore: Math.round(matchScore * 100),
        missingSkillsCount: missingSkills.length,
      });
    } catch (error) {
      this.logger.warn({ msg: 'Failed to signal job application', userId, jobId: job.id, error });
    }
  }

  /**
   * Signal application outcome (hired, rejected, etc.)
   */
  async signalApplicationOutcome(
    userId: string,
    jobId: string,
    outcome: 'HIRED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED',
    details: {
      competitorCount?: number | undefined;
      userRank?: number | undefined;
      rejectionReason?: string | undefined;
      feedbackReceived?: string | undefined;
      missingSkillsMentioned?: string[] | undefined;
    } = {}
  ): Promise<void> {
    try {
      await this.publisher.publishJobApplicationOutcome({
        userId,
        jobId,
        outcome,
        competitorCount: details.competitorCount,
        userRank: details.userRank,
        rejectionReason: details.rejectionReason,
        feedbackReceived: details.feedbackReceived,
        missingSkillsMentioned: details.missingSkillsMentioned,
      });

      this.logger.debug({
        msg: 'Signaled application outcome for learning recommendations',
        userId,
        jobId,
        outcome,
      });
    } catch (error) {
      this.logger.warn({ msg: 'Failed to signal application outcome', userId, jobId, error });
    }
  }

  /**
   * Signal detected skill gap from job match analysis
   */
  async signalSkillGapDetected(
    userId: string,
    gap: {
      skillId: string;
      skillName: string;
      currentLevel?: SkillLevel | undefined;
      requiredLevel: SkillLevel;
      frequency: number;
      avgSalaryImpact: number;
      topJobsRequiring: string[];
    }
  ): Promise<void> {
    try {
      await this.publisher.publishProfileSkillGap({
        userId,
        gapType: gap.currentLevel ? 'LEVEL_MISMATCH' : 'MISSING',
        skillId: gap.skillId,
        skillName: gap.skillName,
        currentLevel: gap.currentLevel,
        requiredLevel: gap.requiredLevel,
        frequency: gap.frequency,
        avgSalaryImpact: gap.avgSalaryImpact,
        topJobsRequiring: gap.topJobsRequiring,
      });

      this.logger.debug({
        msg: 'Signaled skill gap for learning recommendations',
        userId,
        skillId: gap.skillId,
      });
    } catch (error) {
      this.logger.warn({ msg: 'Failed to signal skill gap', userId, skillId: gap.skillId, error });
    }
  }

  /**
   * Signal market trend update
   */
  async signalMarketTrendUpdate(
    category: string,
    trendData: {
      trendType: 'RISING' | 'STABLE' | 'DECLINING';
      skills: Array<{
        skillId: string;
        skillName: string;
        demandChange: number;
        avgRate: number;
        rateChange: number;
        jobCount: number;
        competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
      }>;
      period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
    }
  ): Promise<void> {
    try {
      await this.publisher.publishMarketTrend({
        category,
        trendType: trendData.trendType,
        skills: trendData.skills,
        period: trendData.period,
      });

      this.logger.debug({
        msg: 'Signaled market trend update',
        category,
        period: trendData.period,
      });
    } catch (error) {
      this.logger.warn({ msg: 'Failed to signal market trend update', category, error });
    }
  }

  /**
   * Signal skill demand change
   */
  async signalSkillDemandChange(
    skill: {
      skillId: string;
      skillName: string;
      category: string;
    },
    change: {
      previousDemand: number;
      currentDemand: number;
      changePercentage: number;
      period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
      jobCount: number;
      avgRateChange: number;
    }
  ): Promise<void> {
    try {
      await this.publisher.publishSkillDemandChange({
        skillId: skill.skillId,
        skillName: skill.skillName,
        category: skill.category,
        previousDemand: change.previousDemand,
        currentDemand: change.currentDemand,
        changePercentage: change.changePercentage,
        period: change.period,
        jobCount: change.jobCount,
        avgRateChange: change.avgRateChange,
      });

      this.logger.debug({
        msg: 'Signaled skill demand change',
        skillId: skill.skillId,
        changePercentage: change.changePercentage,
      });
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to signal skill demand change',
        skillId: skill.skillId,
        error,
      });
    }
  }

  /**
   * Check if the service is ready to emit signals
   */
  isReady(): boolean {
    return this.publisher.isReady();
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private levelToNumber(level: SkillLevel): number {
    const levelMap: Record<SkillLevel, number> = {
      BEGINNER: 1,
      INTERMEDIATE: 2,
      ADVANCED: 3,
      EXPERT: 4,
    };
    return levelMap[level] ?? 1;
  }
}

// =============================================================================
// SINGLETON FACTORY
// =============================================================================

let instance: LearningSignalService | null = null;

export function createLearningSignalService(
  prisma: PrismaClient,
  redis: Redis,
  logger: Logger,
  config?: Partial<LearningSignalServiceConfig>
): LearningSignalService {
  instance ??= new LearningSignalService(prisma, redis, logger, config);
  return instance;
}

export function getLearningSignalService(): LearningSignalService | null {
  return instance;
}
