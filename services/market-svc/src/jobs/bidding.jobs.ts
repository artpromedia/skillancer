/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Bidding Jobs
 *
 * Background job handlers for the bidding system:
 * - Processing bid notifications
 * - Expiring old invitations
 * - Auto-closing stale projects
 * - Bid statistics aggregation
 */

import { BidQualityService } from '../services/bid-quality.service.js';
import { InvitationService } from '../services/invitation.service.js';

import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

export interface JobResult {
  success: boolean;
  processed: number;
  errors: string[];
}

interface BidNotification {
  type: string;
  recipientId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export class BiddingJobs {
  private readonly invitationService: InvitationService;
  private readonly qualityService: BidQualityService;
  private readonly LOCK_PREFIX = 'bidding:job:lock:';
  private readonly LOCK_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.invitationService = new InvitationService(prisma, redis, logger);
    this.qualityService = new BidQualityService(prisma, redis, logger);
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
   * Process bid notifications
   * Should run every minute
   */
  async processBidNotifications(): Promise<JobResult> {
    const jobName = 'processBidNotifications';
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      // Define notification queues to process
      const queues = [
        { key: 'bid:notifications', type: 'bid' },
        { key: 'invitation:notifications', type: 'invitation' },
        { key: 'question:notifications', type: 'question' },
      ];

      // Process each queue
      for (const queue of queues) {
        const result = await this.processNotificationQueue(queue.key, queue.type);
        processed += result.processed;
        errors.push(...result.errors);
      }

      this.logger.info({ msg: 'Job completed', job: jobName, processed, errors: errors.length });

      return { success: errors.length === 0, processed, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ msg: 'Job failed', job: jobName, error: errorMessage });
      return { success: false, processed, errors: [errorMessage, ...errors] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Process a single notification queue
   */
  private async processNotificationQueue(
    queueKey: string,
    type: string
  ): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    const notifications = await this.getNotifications(queueKey, 100);

    for (const notification of notifications) {
      try {
        this.sendNotification(notification);
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to process ${type} notification: ${errorMessage}`);
        this.logger.error({
          msg: `Failed to process ${type} notification`,
          notification,
          error: errorMessage,
        });
      }
    }

    return { processed, errors };
  }

  /**
   * Get notifications from Redis queue
   */
  private async getNotifications(queueKey: string, batchSize: number): Promise<BidNotification[]> {
    const notifications: BidNotification[] = [];

    for (let i = 0; i < batchSize; i++) {
      const item = await this.redis.rpop(queueKey);
      if (!item) break;

      try {
        notifications.push(JSON.parse(item) as BidNotification);
      } catch {
        this.logger.error({ msg: 'Failed to parse notification', item });
      }
    }

    return notifications;
  }

  /**
   * Send notification (placeholder - would integrate with notification service)
   */
  private sendNotification(notification: BidNotification): void {
    // TODO: Integrate with notification-svc
    // For now, just log the notification
    this.logger.info({
      msg: 'Processing notification',
      type: notification.type,
      recipientId: notification.recipientId,
    });

    // Would call notification service here:
    // await notificationClient.send({
    //   type: notification.type,
    //   userId: notification.recipientId,
    //   data: notification.data,
    // });
  }

  /**
   * Expire old invitations
   * Should run every hour
   */
  async expireOldInvitations(): Promise<JobResult> {
    const jobName = 'expireOldInvitations';

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      const count = await this.invitationService.expireOldInvitations();

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
   * Auto-close stale projects
   * Should run daily
   */
  async autoCloseStaleProjects(): Promise<JobResult> {
    const jobName = 'autoCloseStaleProjects';
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      // Find projects that have been published for 90+ days with no activity
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 90);

      const staleProjects = await this.prisma.job.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { lt: staleDate },
          // No bids in the last 30 days
          bids: {
            none: {
              submittedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          },
        },
        select: { id: true, title: true, clientId: true },
        take: 100,
      });

      for (const project of staleProjects) {
        try {
          await this.prisma.job.update({
            where: { id: project.id },
            data: {
              status: 'CANCELLED',
              deletedAt: new Date(),
            },
          });

          // Notify client
          await this.redis.lpush(
            'bid:notifications',
            JSON.stringify({
              type: 'PROJECT_AUTO_CLOSED',
              recipientId: project.clientId,
              data: {
                projectId: project.id,
                projectTitle: project.title,
                reason: 'No activity for 90 days',
              },
              timestamp: new Date().toISOString(),
            })
          );

          processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to close project ${project.id}: ${errorMessage}`);
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
      return { success: false, processed, errors: [errorMessage, ...errors] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Update bid quality scores for new freelancer data
   * Should run daily
   */
  async refreshBidQualityScores(): Promise<JobResult> {
    const jobName = 'refreshBidQualityScores';
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      // Invalidate freelancer quality cache for users with recent activity
      const recentActivityDate = new Date();
      recentActivityDate.setDate(recentActivityDate.getDate() - 1);

      const freelancersWithActivity = await this.prisma.user.findMany({
        where: {
          bids: { some: {} }, // Users who have submitted bids (freelancers)
          OR: [
            { ratingAggregation: { updatedAt: { gte: recentActivityDate } } },
            { trustScore: { updatedAt: { gte: recentActivityDate } } },
          ],
        },
        select: { id: true },
        take: 1000,
      });

      for (const freelancer of freelancersWithActivity) {
        try {
          await this.qualityService.invalidateFreelancerCache(freelancer.id);
          processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to invalidate cache for ${freelancer.id}: ${errorMessage}`);
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
      return { success: false, processed, errors: [errorMessage, ...errors] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Generate bid statistics for analytics
   * Should run daily
   */
  async generateBidStatistics(): Promise<JobResult> {
    const jobName = 'generateBidStatistics';

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Calculate daily statistics
      const [newProjects, newBids, acceptedBids, avgBidRate] = await Promise.all([
        this.prisma.job.count({
          where: {
            createdAt: { gte: yesterday, lt: today },
          },
        }),
        this.prisma.bid.count({
          where: {
            submittedAt: { gte: yesterday, lt: today },
          },
        }),
        this.prisma.bid.count({
          where: {
            status: 'ACCEPTED',
            updatedAt: { gte: yesterday, lt: today },
          },
        }),
        this.prisma.bid.aggregate({
          where: {
            submittedAt: { gte: yesterday, lt: today },
          },
          _avg: { proposedRate: true },
        }),
      ]);

      const statsDate = yesterday.toISOString().split('T')[0];
      const stats = {
        date: statsDate,
        newProjects,
        newBids,
        acceptedBids,
        avgBidRate: avgBidRate._avg.proposedRate || 0,
        conversionRate: newBids > 0 ? (acceptedBids / newBids) * 100 : 0,
      };

      // Store in Redis for dashboards
      if (statsDate) {
        await this.redis.hset('bidding:daily-stats', statsDate, JSON.stringify(stats));
      }

      this.logger.info({
        msg: 'Job completed',
        job: jobName,
        stats,
      });

      return { success: true, processed: 1, errors: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ msg: 'Job failed', job: jobName, error: errorMessage });
      return { success: false, processed: 0, errors: [errorMessage] };
    } finally {
      await this.releaseLock(jobName);
    }
  }

  /**
   * Send deadline reminders for projects
   * Should run every 6 hours
   */
  async sendDeadlineReminders(): Promise<JobResult> {
    const jobName = 'sendDeadlineReminders';
    const errors: string[] = [];
    let processed = 0;

    if (!(await this.acquireLock(jobName))) {
      this.logger.info({ msg: 'Job already running, skipping', job: jobName });
      return { success: true, processed: 0, errors: [] };
    }

    try {
      this.logger.info({ msg: 'Starting job', job: jobName });

      // Find projects with deadlines in the next 48 hours
      const reminderWindow = new Date();
      reminderWindow.setHours(reminderWindow.getHours() + 48);

      const projects = await this.prisma.job.findMany({
        where: {
          status: 'PUBLISHED',
          expiresAt: {
            gte: new Date(),
            lte: reminderWindow,
          },
        },
        include: {
          _count: { select: { bids: true } },
        },
      });

      for (const project of projects) {
        try {
          // Check if reminder already sent (use Redis to track)
          const reminderKey = `bidding:deadline-reminder:${project.id}`;
          const alreadySent = await this.redis.get(reminderKey);

          if (alreadySent) continue;

          // Send reminder to client
          await this.redis.lpush(
            'bid:notifications',
            JSON.stringify({
              type: 'PROJECT_DEADLINE_REMINDER',
              recipientId: project.clientId,
              data: {
                projectId: project.id,
                projectTitle: project.title,
                expiresAt: project.expiresAt,
                bidCount: project._count.bids,
              },
              timestamp: new Date().toISOString(),
            })
          );

          // Mark as sent
          await this.redis.setex(reminderKey, 86400, '1'); // 24 hour cooldown
          processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to send reminder for ${project.id}: ${errorMessage}`);
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
      return { success: false, processed, errors: [errorMessage, ...errors] };
    } finally {
      await this.releaseLock(jobName);
    }
  }
}
