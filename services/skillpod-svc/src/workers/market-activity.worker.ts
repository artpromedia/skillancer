// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/workers/market-activity
 * BullMQ worker for processing market activity events and generating learning recommendations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import { Worker, Queue, type Job } from 'bullmq';

import type {
  SignalProcessorService,
  RecommendationEngineService,
  LearningPathGeneratorService,
} from '../services/recommendation/index.js';
import type {
  JobViewedEventPayload,
  JobApplicationEventPayload,
  JobApplicationOutcomeEventPayload,
  ProfileSkillGapEventPayload,
  MarketTrendEventPayload,
  SkillDemandChangeEventPayload,
} from '@skillancer/types';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export type MarketActivityJobType =
  | 'job_viewed'
  | 'job_application'
  | 'job_application_outcome'
  | 'profile_skill_gap_detected'
  | 'market_trend_update'
  | 'skill_demand_change'
  | 'generate_recommendations'
  | 'refresh_learning_path'
  | 'batch_process_signals';

export interface GenerateRecommendationsData {
  userId: string;
  tenantId: string;
  triggerSource: 'scheduled' | 'event' | 'user_request';
  options?: {
    forceRefresh?: boolean;
    includeMLScores?: boolean;
    maxRecommendations?: number;
  };
}

export interface RefreshLearningPathData {
  userId: string;
  tenantId: string;
  pathId?: string;
  reason: 'skill_gap_update' | 'goal_change' | 'progress_update' | 'market_shift';
}

export interface BatchProcessSignalsData {
  tenantId: string;
  signalType?: string;
  fromDate?: string;
  toDate?: string;
}

export type MarketActivityJobData =
  | { type: 'job_viewed'; data: JobViewedEventPayload }
  | { type: 'job_application'; data: JobApplicationEventPayload }
  | { type: 'job_application_outcome'; data: JobApplicationOutcomeEventPayload }
  | { type: 'profile_skill_gap_detected'; data: ProfileSkillGapEventPayload }
  | { type: 'market_trend_update'; data: MarketTrendEventPayload }
  | { type: 'skill_demand_change'; data: SkillDemandChangeEventPayload }
  | { type: 'generate_recommendations'; data: GenerateRecommendationsData }
  | { type: 'refresh_learning_path'; data: RefreshLearningPathData }
  | { type: 'batch_process_signals'; data: BatchProcessSignalsData };

export interface MarketActivityJobResult {
  success: boolean;
  processedAt: Date;
  signalsCreated?: number;
  recommendationsGenerated?: number;
  learningPathsUpdated?: number;
  error?: string;
}

// =============================================================================
// QUEUE NAME
// =============================================================================

export const MARKET_ACTIVITY_QUEUE = 'skillpod:market-activity';

// =============================================================================
// QUEUE FACTORY
// =============================================================================

export function createMarketActivityQueue(redis: Redis): Queue<MarketActivityJobData> {
  return new Queue<MarketActivityJobData>(MARKET_ACTIVITY_QUEUE, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600 * 24, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 3600 * 24 * 7, // 7 days
      },
    },
  });
}

// =============================================================================
// WORKER FACTORY
// =============================================================================

export interface MarketActivityWorkerDeps {
  redis: Redis;
  signalProcessor: SignalProcessorService;
  recommendationEngine: RecommendationEngineService;
  learningPathGenerator: LearningPathGeneratorService;
  logger?: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

export function createMarketActivityWorker(
  deps: MarketActivityWorkerDeps
): Worker<MarketActivityJobData, MarketActivityJobResult> {
  const {
    redis,
    signalProcessor,
    recommendationEngine,
    learningPathGenerator,
    logger = console,
  } = deps;

  const worker = new Worker<MarketActivityJobData, MarketActivityJobResult>(
    MARKET_ACTIVITY_QUEUE,
    async (job: Job<MarketActivityJobData>): Promise<MarketActivityJobResult> => {
      const { type, data } = job.data;
      const startTime = Date.now();

      logger.info(`Processing market activity job: ${type}`, {
        jobId: job.id,
        type,
        attempt: job.attemptsMade + 1,
      });

      try {
        const result = await processJob(type, data);

        logger.info(`Completed market activity job: ${type}`, {
          jobId: job.id,
          type,
          duration: Date.now() - startTime,
          ...result,
        });

        return result;
      } catch (error) {
        logger.error(`Failed to process market activity job: ${type}`, {
          jobId: job.id,
          type,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        return {
          success: false,
          processedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    {
      connection: redis,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  // ===========================================================================
  // JOB PROCESSOR
  // ===========================================================================

  async function processJob(
    type: MarketActivityJobType,
    data: MarketActivityJobData['data']
  ): Promise<MarketActivityJobResult> {
    switch (type) {
      case 'job_viewed':
        return handleJobViewed(data as JobViewedEventPayload);
      case 'job_application':
        return handleJobApplication(data as JobApplicationEventPayload);
      case 'job_application_outcome':
        return handleJobApplicationOutcome(data as JobApplicationOutcomeEventPayload);
      case 'profile_skill_gap_detected':
        return handleProfileSkillGap(data as ProfileSkillGapEventPayload);
      case 'market_trend_update':
        return handleMarketTrendUpdate(data as MarketTrendEventPayload);
      case 'skill_demand_change':
        return handleSkillDemandChange(data as SkillDemandChangeEventPayload);
      case 'generate_recommendations':
        return handleGenerateRecommendations(data as GenerateRecommendationsData);
      case 'refresh_learning_path':
        return handleRefreshLearningPath(data as RefreshLearningPathData);
      case 'batch_process_signals':
        return handleBatchProcessSignals(data as BatchProcessSignalsData);
      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unknown job type: ${String(_exhaustiveCheck)}`);
      }
    }
  }

  // ===========================================================================
  // JOB HANDLERS
  // ===========================================================================

  async function handleJobViewed(data: JobViewedEventPayload): Promise<MarketActivityJobResult> {
    const signal = await signalProcessor.processJobViewedEvent(data);

    // Check if we should trigger recommendations
    const shouldTrigger = await shouldTriggerRecommendations(data.userId, 'job_view');

    if (shouldTrigger) {
      await queueRecommendationGeneration(data.userId, data.tenantId, 'event');
    }

    return {
      success: true,
      processedAt: new Date(),
      signalsCreated: signal ? 1 : 0,
    };
  }

  async function handleJobApplication(
    data: JobApplicationEventPayload
  ): Promise<MarketActivityJobResult> {
    const signal = await signalProcessor.processJobApplicationEvent(data);

    // Application events are higher priority - always trigger recommendations
    await queueRecommendationGeneration(data.userId, data.tenantId, 'event');

    return {
      success: true,
      processedAt: new Date(),
      signalsCreated: signal ? 1 : 0,
    };
  }

  async function handleJobApplicationOutcome(
    data: JobApplicationOutcomeEventPayload
  ): Promise<MarketActivityJobResult> {
    const signal = await signalProcessor.processApplicationOutcomeEvent(data);

    // Rejection outcomes are critical for skill gap analysis
    if (data.outcome === 'rejected' || data.outcome === 'interview_failed') {
      await queueRecommendationGeneration(data.userId, data.tenantId, 'event');
    }

    return {
      success: true,
      processedAt: new Date(),
      signalsCreated: signal ? 1 : 0,
    };
  }

  async function handleProfileSkillGap(
    data: ProfileSkillGapEventPayload
  ): Promise<MarketActivityJobResult> {
    // Process skill gaps detected from profile analysis
    const skillGaps = await signalProcessor.processProfileSkillGaps(data);

    // Skill gap detection should trigger learning path refresh
    if (skillGaps.length > 0) {
      await queueLearningPathRefresh(data.userId, data.tenantId, 'skill_gap_update');
    }

    return {
      success: true,
      processedAt: new Date(),
      signalsCreated: skillGaps.length,
    };
  }

  async function handleMarketTrendUpdate(
    data: MarketTrendEventPayload
  ): Promise<MarketActivityJobResult> {
    // Process market trend updates for all affected users
    const processedCount = await signalProcessor.processMarketTrendEvent(data);

    return {
      success: true,
      processedAt: new Date(),
      signalsCreated: processedCount,
    };
  }

  async function handleSkillDemandChange(
    data: SkillDemandChangeEventPayload
  ): Promise<MarketActivityJobResult> {
    // Update skill demand metrics and notify affected users
    const affectedUsers = await signalProcessor.processSkillDemandChange(data);

    // Queue recommendation refresh for users with this skill gap
    for (const userId of affectedUsers.slice(0, 100)) {
      await queueRecommendationGeneration(userId, data.tenantId, 'event');
    }

    return {
      success: true,
      processedAt: new Date(),
      signalsCreated: affectedUsers.length,
    };
  }

  async function handleGenerateRecommendations(
    data: GenerateRecommendationsData
  ): Promise<MarketActivityJobResult> {
    const { userId, tenantId, options } = data;

    const recommendations = await recommendationEngine.generateRecommendations({
      userId,
      tenantId,
      forceRefresh: options?.forceRefresh ?? false,
      includeMLScores: options?.includeMLScores ?? true,
      maxRecommendations: options?.maxRecommendations ?? 10,
    });

    return {
      success: true,
      processedAt: new Date(),
      recommendationsGenerated: recommendations.length,
    };
  }

  async function handleRefreshLearningPath(
    data: RefreshLearningPathData
  ): Promise<MarketActivityJobResult> {
    const { userId, tenantId, pathId, reason } = data;

    let updatedPaths: number;

    if (pathId) {
      // Refresh specific path
      await learningPathGenerator.refreshPath({
        pathId,
        userId,
        tenantId,
        reason,
      });
      updatedPaths = 1;
    } else {
      // Refresh all active paths for user
      const paths = await learningPathGenerator.refreshUserPaths({
        userId,
        tenantId,
        reason,
      });
      updatedPaths = paths.length;
    }

    return {
      success: true,
      processedAt: new Date(),
      learningPathsUpdated: updatedPaths,
    };
  }

  async function handleBatchProcessSignals(
    data: BatchProcessSignalsData
  ): Promise<MarketActivityJobResult> {
    const { tenantId, signalType, fromDate, toDate } = data;

    const result = await signalProcessor.batchProcessSignals({
      tenantId,
      signalType,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    return {
      success: true,
      processedAt: new Date(),
      signalsCreated: result.processedCount,
    };
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  /**
   * Determines if we should trigger recommendation generation based on activity
   * Implements rate limiting to prevent excessive recommendation regeneration
   */
  async function shouldTriggerRecommendations(userId: string, eventType: string): Promise<boolean> {
    const cacheKey = `recommendation:trigger:${userId}:${eventType}`;

    // Check if we've triggered recently (within 5 minutes)
    const lastTrigger = await redis.get(cacheKey);
    if (lastTrigger) {
      return false;
    }

    // Get activity count in last hour
    const activityKey = `recommendation:activity:${userId}`;
    const activityCount = await redis.incr(activityKey);

    if (activityCount === 1) {
      await redis.expire(activityKey, 3600); // 1 hour TTL
    }

    // Trigger after 3+ activities or first application
    const shouldTrigger = activityCount >= 3 || eventType === 'job_application';

    if (shouldTrigger) {
      await redis.set(cacheKey, Date.now().toString(), 'EX', 300); // 5 minute cooldown
    }

    return shouldTrigger;
  }

  /**
   * Queue a recommendation generation job
   */
  async function queueRecommendationGeneration(
    userId: string,
    tenantId: string,
    triggerSource: 'scheduled' | 'event' | 'user_request'
  ): Promise<void> {
    const queue = createMarketActivityQueue(redis);

    await queue.add(
      'generate-recommendations',
      {
        type: 'generate_recommendations',
        data: {
          userId,
          tenantId,
          triggerSource,
        },
      },
      {
        delay: triggerSource === 'event' ? 30000 : 0, // 30 second delay for event-triggered
        priority: triggerSource === 'user_request' ? 1 : 2,
        jobId: `gen-rec:${userId}:${Date.now()}`,
      }
    );

    await queue.close();
  }

  /**
   * Queue a learning path refresh job
   */
  async function queueLearningPathRefresh(
    userId: string,
    tenantId: string,
    reason: RefreshLearningPathData['reason']
  ): Promise<void> {
    const queue = createMarketActivityQueue(redis);

    await queue.add(
      'refresh-learning-path',
      {
        type: 'refresh_learning_path',
        data: {
          userId,
          tenantId,
          reason,
        },
      },
      {
        delay: 60000, // 1 minute delay to batch updates
        priority: 3,
        jobId: `refresh-path:${userId}:${Date.now()}`,
      }
    );

    await queue.close();
  }

  // ===========================================================================
  // WORKER EVENT HANDLERS
  // ===========================================================================

  worker.on('completed', (job) => {
    logger.info(`Market activity job completed`, {
      jobId: job.id,
      name: job.name,
      type: job.data.type,
    });
  });

  worker.on('failed', (job, error) => {
    logger.error(`Market activity job failed`, {
      jobId: job?.id,
      name: job?.name,
      type: job?.data.type,
      error: error.message,
    });
  });

  worker.on('error', (error) => {
    logger.error(`Market activity worker error`, {
      error: error.message,
    });
  });

  return worker;
}

// =============================================================================
// SCHEDULER FACTORY
// =============================================================================

export interface MarketActivitySchedulerConfig {
  redis: Redis;
  tenantId?: string;
  scheduledRecommendationsCron?: string;
  batchProcessingCron?: string;
}

/**
 * Creates scheduled jobs for market activity processing
 */
export async function setupMarketActivityScheduler(
  config: MarketActivitySchedulerConfig
): Promise<void> {
  const {
    redis,
    tenantId = 'default',
    scheduledRecommendationsCron = '0 6 * * *', // Daily at 6 AM
    batchProcessingCron = '0 2 * * *', // Daily at 2 AM
  } = config;

  const queue = createMarketActivityQueue(redis);

  // Schedule daily recommendation generation for all active users
  await queue.upsertJobScheduler(
    `scheduled-recommendations-${tenantId}`,
    {
      pattern: scheduledRecommendationsCron,
    },
    {
      name: 'batch-generate-recommendations',
      data: {
        type: 'batch_process_signals' as const,
        data: {
          tenantId,
        },
      },
    }
  );

  // Schedule nightly batch processing of unprocessed signals
  await queue.upsertJobScheduler(
    `batch-processing-${tenantId}`,
    {
      pattern: batchProcessingCron,
    },
    {
      name: 'batch-process-signals',
      data: {
        type: 'batch_process_signals' as const,
        data: {
          tenantId,
        },
      },
    }
  );

  await queue.close();
}

