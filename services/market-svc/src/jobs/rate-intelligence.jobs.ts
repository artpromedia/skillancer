/**
 * @module @skillancer/market-svc/jobs/rate-intelligence
 * Rate Intelligence Jobs - Background tasks for rate data processing
 */

import { DemandTrendRepository } from '../repositories/demand-trend.repository.js';
import { RateAggregateRepository } from '../repositories/rate-aggregate.repository.js';
import { RateDataRepository } from '../repositories/rate-data.repository.js';
import { RateRecommendationRepository } from '../repositories/rate-recommendation.repository.js';
import { createRateAggregationWorker } from '../workers/rate-aggregation.worker.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// =============================================================================
// INTERFACES
// =============================================================================

export interface JobResult {
  success: boolean;
  processed: number;
  errors: string[];
  duration?: number;
}

// =============================================================================
// RATE INTELLIGENCE JOBS CLASS
// =============================================================================

export class RateIntelligenceJobs {
  private readonly aggregationWorker: ReturnType<typeof createRateAggregationWorker>;
  private readonly recommendationRepository: RateRecommendationRepository;
  private readonly LOCK_PREFIX = 'rate-intel:job:lock:';
  private readonly LOCK_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    const rateDataRepository = new RateDataRepository(prisma);
    const aggregateRepository = new RateAggregateRepository(prisma);
    const demandTrendRepository = new DemandTrendRepository(prisma);

    this.aggregationWorker = createRateAggregationWorker({
      prisma,
      rateDataRepository,
      aggregateRepository,
      demandTrendRepository,
      logger,
    });

    this.recommendationRepository = new RateRecommendationRepository(prisma);
  }

  /**
   * Acquire a distributed lock for a job
   */
  private async acquireLock(jobName: string): Promise<boolean> {
    const lockKey = `${this.LOCK_PREFIX}${jobName}`;
    const result = await this.redis.set(lockKey, Date.now().toString(), 'EX', this.LOCK_TTL, 'NX');
    return result === 'OK';
  }

  /**
   * Release a distributed lock
   */
  private async releaseLock(jobName: string): Promise<void> {
    const lockKey = `${this.LOCK_PREFIX}${jobName}`;
    await this.redis.del(lockKey);
  }

  /**
   * Daily rate aggregation job
   * Should run once per day (e.g., at 2 AM)
   */
  async runDailyAggregation(): Promise<JobResult> {
    const jobName = 'dailyRateAggregation';
    const startTime = Date.now();
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [], duration: 0 };
    }

    try {
      this.logger.info({ msg: 'Starting daily rate aggregation', job: jobName });

      // Aggregate daily rates for all regions
      const regions = ['US', 'EU', 'ASIA', 'GLOBAL'];

      for (const region of regions) {
        try {
          await this.aggregationWorker.aggregateRates('DAILY', undefined, region);
          processed++;
        } catch (error) {
          const errorMsg = `Failed to aggregate daily rates for ${region}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          this.logger.error({ msg: errorMsg, job: jobName, region });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Daily rate aggregation completed',
        job: jobName,
        processed,
        errors: errors.length,
        duration,
      });

      return { success: errors.length === 0, processed, errors, duration };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Weekly rate aggregation job
   * Should run once per week (e.g., Sunday at 3 AM)
   */
  async runWeeklyAggregation(): Promise<JobResult> {
    const jobName = 'weeklyRateAggregation';
    const startTime = Date.now();
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [], duration: 0 };
    }

    try {
      this.logger.info({ msg: 'Starting weekly rate aggregation', job: jobName });

      const regions = ['US', 'EU', 'ASIA', 'GLOBAL'];

      for (const region of regions) {
        try {
          await this.aggregationWorker.aggregateRates('WEEKLY', undefined, region);
          processed++;
        } catch (error) {
          const errorMsg = `Failed to aggregate weekly rates for ${region}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          this.logger.error({ msg: errorMsg, job: jobName, region });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Weekly rate aggregation completed',
        job: jobName,
        processed,
        errors: errors.length,
        duration,
      });

      return { success: errors.length === 0, processed, errors, duration };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Monthly rate aggregation and demand trend calculation
   * Should run on the 1st of each month at 4 AM
   */
  async runMonthlyAggregation(): Promise<JobResult> {
    const jobName = 'monthlyRateAggregation';
    const startTime = Date.now();
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [], duration: 0 };
    }

    try {
      this.logger.info({ msg: 'Starting monthly rate aggregation', job: jobName });

      const regions = ['US', 'EU', 'ASIA', 'GLOBAL'];

      // Aggregate monthly rates
      for (const region of regions) {
        try {
          await this.aggregationWorker.aggregateRates('MONTHLY', undefined, region);
          processed++;
        } catch (error) {
          const errorMsg = `Failed to aggregate monthly rates for ${region}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          this.logger.error({ msg: errorMsg, job: jobName, region });
        }
      }

      // Calculate demand trends
      try {
        await this.aggregationWorker.calculateDemandTrends();
        processed++;
      } catch (error) {
        const errorMsg = `Failed to calculate demand trends: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        this.logger.error({ msg: errorMsg, job: jobName });
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Monthly rate aggregation completed',
        job: jobName,
        processed,
        errors: errors.length,
        duration,
      });

      return { success: errors.length === 0, processed, errors, duration };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Quarterly rate aggregation
   * Should run on the 1st of each quarter at 5 AM
   */
  async runQuarterlyAggregation(): Promise<JobResult> {
    const jobName = 'quarterlyRateAggregation';
    const startTime = Date.now();
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [], duration: 0 };
    }

    try {
      this.logger.info({ msg: 'Starting quarterly rate aggregation', job: jobName });

      const regions = ['US', 'EU', 'ASIA', 'GLOBAL'];

      for (const region of regions) {
        try {
          await this.aggregationWorker.aggregateRates('QUARTERLY', undefined, region);
          processed++;
        } catch (error) {
          const errorMsg = `Failed to aggregate quarterly rates for ${region}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          this.logger.error({ msg: errorMsg, job: jobName, region });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Quarterly rate aggregation completed',
        job: jobName,
        processed,
        errors: errors.length,
        duration,
      });

      return { success: errors.length === 0, processed, errors, duration };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Full aggregation job (for initial setup or data recovery)
   * Should be run manually when needed
   */
  async runFullAggregation(): Promise<JobResult> {
    const jobName = 'fullRateAggregation';
    const startTime = Date.now();

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [], duration: 0 };
    }

    try {
      this.logger.info({ msg: 'Starting full rate aggregation', job: jobName });

      await this.aggregationWorker.runFullAggregation();

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Full rate aggregation completed',
        job: jobName,
        duration,
      });

      return { success: true, processed: 1, errors: [], duration };
    } catch (error) {
      const errorMsg = `Full aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error({ msg: errorMsg, job: jobName });
      return { success: false, processed: 0, errors: [errorMsg], duration: Date.now() - startTime };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Expire old recommendations
   * Should run daily
   */
  async expireOldRecommendations(): Promise<JobResult> {
    const jobName = 'expireRecommendations';
    const startTime = Date.now();

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [], duration: 0 };
    }

    try {
      this.logger.info({ msg: 'Starting recommendation expiration', job: jobName });

      const result = await this.recommendationRepository.expireOld();

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Recommendation expiration completed',
        job: jobName,
        expired: result.count,
        duration,
      });

      return { success: true, processed: result.count, errors: [], duration };
    } catch (error) {
      const errorMsg = `Recommendation expiration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error({ msg: errorMsg, job: jobName });
      return { success: false, processed: 0, errors: [errorMsg], duration: Date.now() - startTime };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Clean up old rate data points (older than 2 years)
   * Should run monthly
   */
  async cleanupOldRateData(): Promise<JobResult> {
    const jobName = 'cleanupRateData';
    const startTime = Date.now();

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [], duration: 0 };
    }

    try {
      this.logger.info({ msg: 'Starting old rate data cleanup', job: jobName });

      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const result = await this.prisma.rateDataPoint.deleteMany({
        where: {
          occurredAt: {
            lt: twoYearsAgo,
          },
        },
      });

      const duration = Date.now() - startTime;
      this.logger.info({
        msg: 'Old rate data cleanup completed',
        job: jobName,
        deleted: result.count,
        duration,
      });

      return { success: true, processed: result.count, errors: [], duration };
    } catch (error) {
      const errorMsg = `Rate data cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error({ msg: errorMsg, job: jobName });
      return { success: false, processed: 0, errors: [errorMsg], duration: Date.now() - startTime };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Invalidate rate cache
   * Should be called after aggregation jobs complete
   */
  async invalidateRateCache(): Promise<void> {
    const cachePattern = 'rate-intel:*';

    try {
      const keys = await this.redis.keys(cachePattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.info({ msg: 'Rate cache invalidated', keysDeleted: keys.length });
      }
    } catch (error) {
      this.logger.error({
        msg: 'Failed to invalidate rate cache',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
