/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Review Jobs
 *
 * Background job handlers for the review system:
 * - Processing expired invitations
 * - Sending review reminders
 * - Aggregating review statistics
 * - Trust Score updates
 */

import { ReviewAggregationService } from '../services/review-aggregation.service.js';
import { ReviewInvitationService } from '../services/review-invitation.service.js';

import type { PrismaClient, ReviewStatus } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

export interface JobResult {
  success: boolean;
  processed: number;
  errors: string[];
}

export class ReviewJobs {
  private readonly invitationService: ReviewInvitationService;
  private readonly aggregationService: ReviewAggregationService;
  private readonly LOCK_PREFIX = 'review:job:lock:';
  private readonly LOCK_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.invitationService = new ReviewInvitationService(prisma, redis, logger);
    this.aggregationService = new ReviewAggregationService(prisma, redis, logger);
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
   * Process expired review invitations
   * Should run hourly
   */
  async processExpiredInvitations(): Promise<JobResult> {
    const jobName = 'processExpiredInvitations';

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      const count = await this.invitationService.processExpiredInvitations();

      this.logger.info({ msg: 'Job completed', job: jobName, processed: count });

      return { success: true, processed: count, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ msg: 'Job failed', job: jobName, error: errorMessage });
      return { success: false, processed: 0, errors: [errorMessage] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Send review reminders
   * Should run daily
   */
  async sendReviewReminders(): Promise<JobResult> {
    const jobName = 'sendReviewReminders';
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      const invitations = await this.invitationService.getInvitationsNeedingReminders();

      for (const invitation of invitations) {
        try {
          await this.invitationService.sendReminder(invitation.id);
          processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to send reminder for ${invitation.id}: ${errorMessage}`);
          this.logger.error({
            msg: 'Failed to send reminder',
            invitationId: invitation.id,
            error: errorMessage,
          });
        }
      }

      this.logger.info({
        msg: 'Job completed',
        job: jobName,
        processed,
        errors: errors.length,
      });

      return { success: errors.length === 0, processed, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ msg: 'Job failed', job: jobName, error: errorMessage });
      return { success: false, processed, errors: [errorMessage] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Recalculate aggregations for users with recent reviews
   * Should run every 15 minutes
   */
  async recalculateAggregations(): Promise<JobResult> {
    const jobName = 'recalculateAggregations';
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      // Find users with reviews in the last hour that need recalculation
      const recentReviews = await this.prisma.review.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
        select: {
          revieweeId: true,
        },
        distinct: ['revieweeId'],
      });

      const userIds: string[] = [...new Set<string>(recentReviews.map((r) => String(r.revieweeId)))];

      for (const userId of userIds) {
        try {
          // Recalculate aggregations for each user
          await this.aggregationService.updateRatingAggregations(userId);
          processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to recalculate for ${userId}: ${errorMessage}`);
          this.logger.error({
            msg: 'Failed to recalculate aggregation',
            userId,
            error: errorMessage,
          });
        }
      }

      this.logger.info({
        msg: 'Job completed',
        job: jobName,
        processed,
        errors: errors.length,
      });

      return { success: errors.length === 0, processed, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ msg: 'Job failed', job: jobName, error: errorMessage });
      return { success: false, processed, errors: [errorMessage] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Update Trust Scores based on review changes
   * Should run daily
   */
  async updateTrustScores(): Promise<JobResult> {
    const jobName = 'updateTrustScores';
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      // Get all users with reviews
      const revealedStatus: ReviewStatus = 'REVEALED';
      const usersWithReviews = await this.prisma.review.findMany({
        where: {
          status: revealedStatus,
        },
        select: {
          revieweeId: true,
        },
        distinct: ['revieweeId'],
      });

      for (const { revieweeId } of usersWithReviews) {
        try {
          // Get aggregated ratings
          const aggregation = await this.aggregationService.getOrCalculateAggregation(revieweeId);

          if (aggregation) {
            // Calculate Trust Score components from reviews
            const freelancerReviews = aggregation.freelancer?.totalReviews ?? 0;
            const clientReviews = aggregation.client?.totalReviews ?? 0;
            const reviewCount = freelancerReviews + clientReviews;

            if (reviewCount > 0) {
              const freelancerScore = aggregation.freelancer?.averageRating ?? 0;
              const clientScore = aggregation.client?.averageRating ?? 0;
              const weightedAvg =
                (freelancerScore * freelancerReviews + clientScore * clientReviews) / reviewCount;
              // Normalize to 0-100 scale (reviews are 1-5, so (avg-1)/4*100)
              const normalizedScore = Math.round(((weightedAvg - 1) / 4) * 100);

              // Update or create trust score record
              // FUTURE: Integrate with actual Trust Score service
              this.logger.debug({
                msg: 'Trust score calculated',
                userId: revieweeId,
                reviewScore: normalizedScore,
                reviewCount,
              });
            }
          }

          processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to update trust score for ${revieweeId}: ${errorMessage}`);
          this.logger.error({
            msg: 'Failed to update trust score',
            userId: revieweeId,
            error: errorMessage,
          });
        }
      }

      this.logger.info({
        msg: 'Job completed',
        job: jobName,
        processed,
        errors: errors.length,
      });

      return { success: errors.length === 0, processed, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ msg: 'Job failed', job: jobName, error: errorMessage });
      return { success: false, processed, errors: [errorMessage] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Cleanup old review reports that have been resolved
   * Should run weekly
   */
  async cleanupOldReports(): Promise<JobResult> {
    const jobName = 'cleanupOldReports';

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      // Archive reports older than 90 days that are resolved
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      // Just count resolved reports - no updates needed for now
      const count = await this.prisma.reviewReport.count({
        where: {
          status: { in: ['RESOLVED', 'DISMISSED'] },
          resolvedAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.info({ msg: 'Job completed', job: jobName, processed: count });

      return { success: true, processed: count, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ msg: 'Job failed', job: jobName, error: errorMessage });
      return { success: false, processed: 0, errors: [errorMessage] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Run all scheduled jobs
   * Main entry point for cron scheduler
   */
  async runScheduledJobs(): Promise<void> {
    this.logger.info({ msg: 'Running scheduled review jobs' });

    // Run jobs in sequence to avoid overwhelming the database
    await this.processExpiredInvitations();
    await this.sendReviewReminders();
    await this.recalculateAggregations();
  }
}
