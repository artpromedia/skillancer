/**
 * @module @skillancer/market-svc/messaging/learning-recommendation-events
 * Market Activity Event Publisher for SkillPod Learning Recommendations
 *
 * Publishes job activity and market events to SkillPod for
 * generating personalized learning recommendations.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// LOCAL TYPE DEFINITIONS
// =============================================================================

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type SkillImportance = 'REQUIRED' | 'PREFERRED' | 'NICE_TO_HAVE';
export type TrendPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
export type GapType = 'MISSING' | 'LEVEL_MISMATCH' | 'OUTDATED';

export interface SkillRequirement {
  skillId: string;
  skillName: string;
  level: SkillLevel;
  importance: SkillImportance;
}

export interface JobViewedEventPayload {
  userId: string;
  jobId: string;
  jobTitle: string;
  requiredSkills: SkillRequirement[];
  preferredSkills: SkillRequirement[];
  category: string;
  subcategory?: string | undefined;
  budgetRange?: { min: number; max: number } | undefined;
  experienceLevel: string;
  viewDuration: number;
  source: 'search' | 'recommendation' | 'direct' | 'email';
}

export interface JobApplicationEventPayload {
  userId: string;
  jobId: string;
  jobTitle: string;
  requiredSkills: SkillRequirement[];
  preferredSkills: SkillRequirement[];
  category: string;
  proposalAmount: number;
  coverLetterLength: number;
  attachmentsCount: number;
  userSkillMatch: number;
  missingSkills: string[];
  partialSkills: string[];
}

export interface JobApplicationOutcomeEventPayload {
  userId: string;
  jobId: string;
  outcome: 'HIRED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED';
  competitorCount?: number | undefined;
  userRank?: number | undefined;
  rejectionReason?: string | undefined;
  feedbackReceived?: string | undefined;
  missingSkillsMentioned?: string[] | undefined;
}

export interface ProfileSkillGapEventPayload {
  userId: string;
  gapType: GapType;
  skillId: string;
  skillName: string;
  currentLevel?: string | undefined;
  requiredLevel: string;
  frequency: number;
  avgSalaryImpact: number;
  topJobsRequiring: string[];
}

export interface MarketTrendEventPayload {
  category: string;
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
  period: TrendPeriod;
}

export interface SkillDemandChangeEventPayload {
  skillId: string;
  skillName: string;
  category: string;
  previousDemand: number;
  currentDemand: number;
  changePercentage: number;
  period: TrendPeriod;
  jobCount: number;
  avgRateChange: number;
}

// =============================================================================
// TYPES
// =============================================================================

export interface LearningRecommendationPublisherDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
}

export interface LearningRecommendationPublisherConfig {
  /**
   * Enable event publishing
   */
  enabled: boolean;
  /**
   * Redis channel/stream for events
   */
  channel: string;
  /**
   * Whether to use Redis Streams (recommended) or Pub/Sub
   */
  useStreams: boolean;
  /**
   * Maximum stream length (for streams mode)
   */
  maxStreamLength: number;
}

const DEFAULT_CONFIG: LearningRecommendationPublisherConfig = {
  enabled: true,
  channel: 'skillpod:learning-recommendations',
  useStreams: true,
  maxStreamLength: 100000,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateCorrelationId(): string {
  return `lr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export const LEARNING_RECOMMENDATION_EVENT_TYPES = {
  JOB_VIEWED: 'market.job.viewed',
  JOB_APPLICATION: 'market.job.application',
  JOB_APPLICATION_OUTCOME: 'market.job.outcome',
  PROFILE_SKILL_GAP: 'market.profile.skill_gap',
  MARKET_TREND: 'market.trend.update',
  SKILL_DEMAND_CHANGE: 'market.skill.demand_change',
} as const;

export type LearningRecommendationEventType =
  (typeof LEARNING_RECOMMENDATION_EVENT_TYPES)[keyof typeof LEARNING_RECOMMENDATION_EVENT_TYPES];

// =============================================================================
// EVENT PUBLISHER INTERFACE
// =============================================================================

export interface LearningRecommendationEventPublisher {
  /**
   * Publish a job viewed event
   */
  publishJobViewed(payload: JobViewedEventPayload): Promise<void>;

  /**
   * Publish a job application event
   */
  publishJobApplication(payload: JobApplicationEventPayload): Promise<void>;

  /**
   * Publish a job application outcome event
   */
  publishJobApplicationOutcome(payload: JobApplicationOutcomeEventPayload): Promise<void>;

  /**
   * Publish a profile skill gap detected event
   */
  publishProfileSkillGap(payload: ProfileSkillGapEventPayload): Promise<void>;

  /**
   * Publish a market trend update event
   */
  publishMarketTrend(payload: MarketTrendEventPayload): Promise<void>;

  /**
   * Publish a skill demand change event
   */
  publishSkillDemandChange(payload: SkillDemandChangeEventPayload): Promise<void>;

  /**
   * Check if publisher is ready
   */
  isReady(): boolean;
}

// =============================================================================
// PUBLISHER IMPLEMENTATION
// =============================================================================

export function createLearningRecommendationEventPublisher(
  deps: LearningRecommendationPublisherDeps,
  config: Partial<LearningRecommendationPublisherConfig> = {}
): LearningRecommendationEventPublisher {
  const { redis, logger } = deps;
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  let isConnected = false;

  // Check Redis connection
  redis.on('ready', () => {
    isConnected = true;
    logger.info({ msg: 'Learning recommendation event publisher connected' });
  });

  redis.on('error', (error) => {
    isConnected = false;
    logger.error({ msg: 'Learning recommendation event publisher error', error });
  });

  // ===========================================================================
  // INTERNAL HELPERS
  // ===========================================================================

  async function publishEvent(
    eventType: LearningRecommendationEventType,
    payload: Record<string, unknown>
  ): Promise<void> {
    if (!mergedConfig.enabled) {
      logger.debug({ msg: 'Learning recommendation events disabled, skipping', eventType });
      return;
    }

    const event = {
      eventType,
      timestamp: new Date().toISOString(),
      correlationId: generateCorrelationId(),
      payload,
    };

    try {
      if (mergedConfig.useStreams) {
        // Use Redis Streams for reliable messaging
        await redis.xadd(
          mergedConfig.channel,
          'MAXLEN',
          '~',
          mergedConfig.maxStreamLength.toString(),
          '*',
          'event',
          JSON.stringify(event)
        );
      } else {
        // Use Pub/Sub for simple broadcasting
        await redis.publish(mergedConfig.channel, JSON.stringify(event));
      }

      logger.debug({
        msg: 'Published learning recommendation event',
        eventType,
        correlationId: event.correlationId,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to publish learning recommendation event',
        eventType,
        error,
      });
      throw error;
    }
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  async function publishJobViewed(payload: JobViewedEventPayload): Promise<void> {
    await publishEvent(
      LEARNING_RECOMMENDATION_EVENT_TYPES.JOB_VIEWED,
      payload as unknown as Record<string, unknown>
    );
  }

  async function publishJobApplication(payload: JobApplicationEventPayload): Promise<void> {
    await publishEvent(
      LEARNING_RECOMMENDATION_EVENT_TYPES.JOB_APPLICATION,
      payload as unknown as Record<string, unknown>
    );
  }

  async function publishJobApplicationOutcome(
    payload: JobApplicationOutcomeEventPayload
  ): Promise<void> {
    await publishEvent(
      LEARNING_RECOMMENDATION_EVENT_TYPES.JOB_APPLICATION_OUTCOME,
      payload as unknown as Record<string, unknown>
    );
  }

  async function publishProfileSkillGap(payload: ProfileSkillGapEventPayload): Promise<void> {
    await publishEvent(
      LEARNING_RECOMMENDATION_EVENT_TYPES.PROFILE_SKILL_GAP,
      payload as unknown as Record<string, unknown>
    );
  }

  async function publishMarketTrend(payload: MarketTrendEventPayload): Promise<void> {
    await publishEvent(
      LEARNING_RECOMMENDATION_EVENT_TYPES.MARKET_TREND,
      payload as unknown as Record<string, unknown>
    );
  }

  async function publishSkillDemandChange(payload: SkillDemandChangeEventPayload): Promise<void> {
    await publishEvent(
      LEARNING_RECOMMENDATION_EVENT_TYPES.SKILL_DEMAND_CHANGE,
      payload as unknown as Record<string, unknown>
    );
  }

  function isReady(): boolean {
    return isConnected && mergedConfig.enabled;
  }

  return {
    publishJobViewed,
    publishJobApplication,
    publishJobApplicationOutcome,
    publishProfileSkillGap,
    publishMarketTrend,
    publishSkillDemandChange,
    isReady,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extracts skill gaps from a job posting and user profile comparison
 */
export function extractSkillGapsFromJobMatch(
  jobSkills: { skillId: string; skillName: string; requiredLevel: number }[],
  userSkills: { skillId: string; currentLevel: number }[]
): { skillId: string; skillName: string; currentLevel: number; requiredLevel: number }[] {
  const userSkillMap = new Map(userSkills.map((s) => [s.skillId, s.currentLevel]));
  const gaps: {
    skillId: string;
    skillName: string;
    currentLevel: number;
    requiredLevel: number;
  }[] = [];

  for (const jobSkill of jobSkills) {
    const currentLevel = userSkillMap.get(jobSkill.skillId) ?? 0;
    if (currentLevel < jobSkill.requiredLevel) {
      gaps.push({
        skillId: jobSkill.skillId,
        skillName: jobSkill.skillName,
        currentLevel,
        requiredLevel: jobSkill.requiredLevel,
      });
    }
  }

  return gaps;
}

/**
 * Calculates match score between user skills and job requirements
 */
export function calculateSkillMatchScore(
  jobSkills: { skillId: string; requiredLevel: number; importance: string }[],
  userSkills: { skillId: string; currentLevel: number }[]
): number {
  if (jobSkills.length === 0) return 1;

  const userSkillMap = new Map(userSkills.map((s) => [s.skillId, s.currentLevel]));

  let totalWeight = 0;
  let matchedWeight = 0;

  const importanceWeights: Record<string, number> = {
    REQUIRED: 3,
    PREFERRED: 2,
    NICE_TO_HAVE: 1,
  };

  for (const jobSkill of jobSkills) {
    const weight = importanceWeights[jobSkill.importance] ?? 1;
    totalWeight += weight;

    const userLevel = userSkillMap.get(jobSkill.skillId) ?? 0;
    const matchRatio = Math.min(userLevel / jobSkill.requiredLevel, 1);
    matchedWeight += weight * matchRatio;
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}
