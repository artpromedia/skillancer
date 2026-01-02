// @ts-nocheck
/**
 * Verification Background Jobs
 * Async processing for platform sync and verification
 * Sprint M4: Portable Verified Work History
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { PlatformRegistry } from '../integrations/platform-connector';
import { getWorkHistoryVerifier } from '../verification/work-history-verifier';
import { getEarningsVerifier } from '../verification/earnings-verifier';
import { getReviewVerifier } from '../verification/review-verifier';
import { getPortableCredentialService } from '../credentials/portable-credential';
import { getReputationScoreService } from '../profile/reputation-score';

// Types
interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

type JobProcessor = (userId: string, payload: any) => Promise<JobResult>;

// ============================================================================
// JOB PROCESSORS
// ============================================================================

const jobProcessors: Record<string, JobProcessor> = {
  /**
   * Sync data from a connected platform
   */
  PLATFORM_SYNC: async (
    userId: string,
    payload: { platformId: string; forceRefresh?: boolean }
  ) => {
    const { platformId, forceRefresh } = payload;

    const connection = await prisma.platformConnection.findUnique({
      where: {
        userId_platform: { userId, platform: platformId },
      },
    });

    if (!connection) {
      return { success: false, error: 'Platform not connected' };
    }

    const connector = PlatformRegistry.get(platformId);
    if (!connector) {
      return { success: false, error: 'Platform connector not found' };
    }

    try {
      // Update status to syncing
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: { status: 'SYNCING' },
      });

      await connector.connect(userId, connection.accessToken!);

      const [profile, workHistory, reviews, earnings] = await Promise.all([
        connector.fetchProfile(),
        connector.fetchWorkHistory(),
        connector.fetchReviews(),
        connector.fetchEarnings(),
      ]);

      // Store work history items
      let itemsCreated = 0;
      let itemsUpdated = 0;

      for (const item of workHistory) {
        const result = await prisma.workHistoryItem.upsert({
          where: {
            userId_platform_externalId: {
              userId,
              platform: platformId,
              externalId: item.id,
            },
          },
          create: {
            userId,
            platform: platformId,
            externalId: item.id,
            title: item.title,
            client: item.client.name,
            category: item.category || '',
            startDate: item.startDate,
            endDate: item.endDate,
            amount: item.totalAmount || 0,
            currency: item.currency || 'USD',
            status: item.status,
            description: item.description || '',
            skills: item.skills || [],
            verificationLevel: 'PLATFORM_CONNECTED',
            rawData: item as any,
          },
          update: {
            title: item.title,
            client: item.client.name,
            category: item.category || '',
            startDate: item.startDate,
            endDate: item.endDate,
            amount: item.totalAmount || 0,
            status: item.status,
            description: item.description || '',
            skills: item.skills || [],
            rawData: item as any,
            updatedAt: new Date(),
          },
        });

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          itemsCreated++;
        } else {
          itemsUpdated++;
        }
      }

      // Store reviews
      let reviewsCreated = 0;
      for (const review of reviews) {
        await prisma.workHistoryReview.upsert({
          where: {
            review_userId_platform_externalId: {
              userId,
              platform: platformId,
              externalId: review.id,
            },
          },
          create: {
            userId,
            platform: platformId,
            externalId: review.id,
            projectId: review.projectId,
            rating: review.rating,
            text: review.text || '',
            reviewerName: review.reviewerName || 'Anonymous',
            reviewDate: review.date,
          },
          update: {
            rating: review.rating,
            text: review.text || '',
            reviewerName: review.reviewerName || 'Anonymous',
            reviewDate: review.date,
            updatedAt: new Date(),
          },
        });
        reviewsCreated++;
      }

      // Update connection with sync stats
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          status: 'CONNECTED',
          lastSyncAt: new Date(),
          syncStats: {
            itemsCreated,
            itemsUpdated,
            reviewsCreated,
            totalEarnings: earnings.total,
            lastSync: new Date().toISOString(),
          },
        },
      });

      // Queue reputation recalculation
      await queueJob(userId, 'REPUTATION_CALCULATE', {});

      return {
        success: true,
        data: {
          itemsCreated,
          itemsUpdated,
          reviewsCreated,
          totalEarnings: earnings.total,
        },
      };
    } catch (error) {
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          status: 'ERROR',
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  },

  /**
   * Verify work history items
   */
  WORK_HISTORY_VERIFY: async (userId: string, payload: { itemIds: string[] }) => {
    const verifier = getWorkHistoryVerifier();
    const results: any[] = [];

    for (const itemId of payload.itemIds) {
      const item = await prisma.workHistoryItem.findFirst({
        where: { id: itemId, userId },
      });

      if (!item) {
        results.push({ id: itemId, error: 'Not found' });
        continue;
      }

      const verification = await verifier.verify({
        id: item.id,
        title: item.title,
        client: { name: item.client },
        platform: item.platform,
        startDate: item.startDate,
        endDate: item.endDate || undefined,
        totalAmount: Number(item.amount),
        currency: item.currency,
        status: item.status,
      });

      await prisma.workHistoryItem.update({
        where: { id: item.id },
        data: {
          verificationLevel: verification.level,
          verificationHash: verification.hash,
          verificationData: verification as any,
          verifiedAt: new Date(),
        },
      });

      results.push({
        id: item.id,
        level: verification.level,
        score: verification.score,
      });
    }

    return { success: true, data: { results } };
  },

  /**
   * Verify earnings
   */
  EARNINGS_VERIFY: async (userId: string, payload: { platformId?: string }) => {
    const verifier = getEarningsVerifier();

    const where: any = { userId };
    if (payload.platformId) where.platform = payload.platformId;

    const items = await prisma.workHistoryItem.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        platform: true,
        startDate: true,
      },
    });

    const earnings = items.map((item) => ({
      id: item.id,
      amount: Number(item.amount),
      currency: item.currency,
      platform: item.platform,
      date: item.startDate,
    }));

    const verification = await verifier.verify(earnings);

    return {
      success: true,
      data: {
        total: verification.total,
        byPlatform: verification.byPlatform,
        riskLevel: verification.riskLevel,
      },
    };
  },

  /**
   * Verify reviews
   */
  REVIEW_VERIFY: async (userId: string, payload: {}) => {
    const verifier = getReviewVerifier();

    const reviews = await prisma.workHistoryReview.findMany({
      where: { userId },
    });

    const reviewData = reviews.map((r) => ({
      id: r.id,
      rating: Number(r.rating),
      text: r.text,
      reviewerName: r.reviewerName,
      date: r.reviewDate,
      projectId: r.projectId,
      platform: r.platform,
    }));

    const verification = await verifier.verify(reviewData);

    // Update review authenticity scores
    for (const result of verification.reviews) {
      await prisma.workHistoryReview.update({
        where: { id: result.id },
        data: {
          isVerified: result.score >= 0.7,
          authenticityScore: result.score,
        },
      });
    }

    return {
      success: true,
      data: {
        averageRating: verification.aggregated.averageRating,
        totalReviews: verification.aggregated.totalReviews,
        authenticReviews: verification.reviews.filter((r) => r.score >= 0.7).length,
      },
    };
  },

  /**
   * Issue a verifiable credential
   */
  CREDENTIAL_ISSUE: async (
    userId: string,
    payload: { type: string; itemIds?: string[]; includeBlockchain?: boolean }
  ) => {
    const credentialService = getPortableCredentialService();

    // Gather data based on credential type
    let credentialData: any;

    if (payload.type === 'WorkHistory' && payload.itemIds) {
      const items = await prisma.workHistoryItem.findMany({
        where: { id: { in: payload.itemIds }, userId },
      });
      credentialData = items;
    } else if (payload.type === 'CompleteProfile') {
      const [items, reviews, connections] = await Promise.all([
        prisma.workHistoryItem.findMany({ where: { userId } }),
        prisma.workHistoryReview.findMany({ where: { userId } }),
        prisma.platformConnection.findMany({
          where: { userId, status: 'CONNECTED' },
        }),
      ]);
      credentialData = { items, reviews, connections };
    }

    const credential = await credentialService.issueCredential(
      payload.type as any,
      { id: userId },
      credentialData
    );

    // Store credential
    await prisma.verifiableCredential.create({
      data: {
        id: credential.id,
        type: payload.type,
        subjectId: userId,
        credential: credential as any,
        issuedAt: new Date(credential.issuanceDate),
        expiresAt: credential.expirationDate ? new Date(credential.expirationDate) : null,
        status: 'ACTIVE',
      },
    });

    return { success: true, data: { credentialId: credential.id } };
  },

  /**
   * Revoke a credential
   */
  CREDENTIAL_REVOKE: async (userId: string, payload: { credentialId: string; reason: string }) => {
    await prisma.verifiableCredential.update({
      where: { id: payload.credentialId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revocationReason: payload.reason,
      },
    });

    return { success: true, data: { revoked: true } };
  },

  /**
   * Calculate/recalculate reputation score
   */
  REPUTATION_CALCULATE: async (userId: string, payload: {}) => {
    const reputationService = getReputationScoreService();

    // Gather all user data
    const [items, reviews, connections] = await Promise.all([
      prisma.workHistoryItem.findMany({ where: { userId } }),
      prisma.workHistoryReview.findMany({ where: { userId } }),
      prisma.platformConnection.findMany({
        where: { userId, status: 'CONNECTED' },
      }),
    ]);

    // Calculate scores
    const totalEarnings = items.reduce((sum, i) => sum + Number(i.amount), 0);
    const completedProjects = items.filter((i) => i.status === 'completed').length;
    const totalProjects = items.length;
    const averageRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length
        : 0;

    const score = reputationService.calculate({
      earnings: {
        total: totalEarnings,
        platformBreakdown: {},
        verifiedPercentage: 80,
      },
      reviews: {
        count: reviews.length,
        averageRating,
        positivePercentage:
          (reviews.filter((r) => Number(r.rating) >= 4).length / Math.max(reviews.length, 1)) * 100,
      },
      completion: {
        totalProjects,
        completedProjects,
        cancelledProjects: items.filter((i) => i.status === 'cancelled').length,
      },
      responsiveness: {
        averageResponseTime: 2, // hours - would come from messaging data
        responseRate: 95,
      },
      profile: {
        completeness: 85,
        verificationsCount: items.filter(
          (i) =>
            i.verificationLevel === 'PLATFORM_VERIFIED' ||
            i.verificationLevel === 'CRYPTOGRAPHICALLY_SEALED'
        ).length,
        platformsConnected: connections.length,
      },
      credentials: {
        count: 0, // Would query credentials
        types: [],
        latestIssued: null,
      },
    });

    // Determine tier
    let tier: 'RISING' | 'ESTABLISHED' | 'EXPERT' | 'ELITE' | 'LEGENDARY' = 'RISING';
    if (score.overall >= 95) tier = 'LEGENDARY';
    else if (score.overall >= 85) tier = 'ELITE';
    else if (score.overall >= 70) tier = 'EXPERT';
    else if (score.overall >= 50) tier = 'ESTABLISHED';

    // Upsert reputation score
    await prisma.unifiedReputationScore.upsert({
      where: { userId },
      create: {
        userId,
        overallScore: score.overall,
        tier,
        earningsScore: score.components.earnings,
        reviewsScore: score.components.reviews,
        completionScore: score.components.completion,
        responsivenessScore: score.components.responsiveness,
        profileScore: score.components.profile,
        credentialsScore: score.components.credentials,
        totalEarnings,
        totalProjects,
        completedProjects,
        totalReviews: reviews.length,
        averageRating,
        platformCount: connections.length,
        percentileRank: 75, // Would calculate from all users
        trend: 'STABLE',
        trendPercentage: 0,
        scoreHistory: [{ date: new Date().toISOString(), score: score.overall }],
        badges: score.badges || [],
        calculatedAt: new Date(),
      },
      update: {
        overallScore: score.overall,
        tier,
        earningsScore: score.components.earnings,
        reviewsScore: score.components.reviews,
        completionScore: score.components.completion,
        responsivenessScore: score.components.responsiveness,
        profileScore: score.components.profile,
        credentialsScore: score.components.credentials,
        totalEarnings,
        totalProjects,
        completedProjects,
        totalReviews: reviews.length,
        averageRating,
        platformCount: connections.length,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        overallScore: score.overall,
        tier,
        components: score.components,
      },
    };
  },

  /**
   * Anchor data to blockchain
   */
  BLOCKCHAIN_ANCHOR: async (
    userId: string,
    payload: { type: 'work_history' | 'credential'; itemId: string }
  ) => {
    // In production, this would interact with actual blockchain
    const txHash = `0x${Buffer.from(Math.random().toString()).toString('hex').slice(0, 64)}`;
    const blockNumber = Math.floor(Math.random() * 1000000) + 45000000;

    if (payload.type === 'work_history') {
      await prisma.workHistoryItem.update({
        where: { id: payload.itemId },
        data: {
          verificationLevel: 'CRYPTOGRAPHICALLY_SEALED',
          blockchainNetwork: 'polygon',
          blockchainTxHash: txHash,
          blockchainBlock: blockNumber,
        },
      });
    } else if (payload.type === 'credential') {
      await prisma.verifiableCredential.update({
        where: { id: payload.itemId },
        data: {
          blockchainNetwork: 'polygon',
          blockchainTxHash: txHash,
        },
      });
    }

    return {
      success: true,
      data: {
        network: 'polygon',
        txHash,
        blockNumber,
      },
    };
  },
};

// ============================================================================
// JOB QUEUE FUNCTIONS
// ============================================================================

/**
 * Queue a new job for processing
 */
export async function queueJob(
  userId: string,
  type: keyof typeof jobProcessors,
  payload: any,
  scheduledFor: Date = new Date()
): Promise<string> {
  const job = await prisma.verificationJob.create({
    data: {
      userId,
      type,
      payload,
      status: 'PENDING',
      scheduledFor,
    },
  });

  logger.info('Job queued', { jobId: job.id, type, userId });
  return job.id;
}

/**
 * Process pending jobs
 */
export async function processJobs(limit: number = 10): Promise<void> {
  const jobs = await prisma.verificationJob.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: new Date() },
      attempts: { lt: 3 },
    },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
  });

  for (const job of jobs) {
    await processJob(job.id);
  }
}

/**
 * Process a single job
 */
export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.verificationJob.findUnique({
    where: { id: jobId },
  });

  if (!job || job.status !== 'PENDING') {
    return;
  }

  const processor = jobProcessors[job.type];
  if (!processor) {
    logger.error('Unknown job type', { jobId, type: job.type });
    await prisma.verificationJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        lastError: `Unknown job type: ${job.type}`,
      },
    });
    return;
  }

  try {
    await prisma.verificationJob.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    const result = await processor(job.userId, job.payload as any);

    await prisma.verificationJob.update({
      where: { id: jobId },
      data: {
        status: result.success ? 'COMPLETED' : 'FAILED',
        result: result.data || null,
        lastError: result.error || null,
        completedAt: new Date(),
      },
    });

    logger.info('Job completed', { jobId, type: job.type, success: result.success });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    const updatedJob = await prisma.verificationJob.update({
      where: { id: jobId },
      data: {
        status: job.attempts + 1 >= job.maxAttempts ? 'FAILED' : 'PENDING',
        lastError: errorMessage,
      },
    });

    logger.error('Job failed', {
      jobId,
      type: job.type,
      error: errorMessage,
      attempts: updatedJob.attempts,
    });
  }
}

/**
 * Retry failed jobs
 */
export async function retryFailedJobs(): Promise<number> {
  const result = await prisma.verificationJob.updateMany({
    where: {
      status: 'FAILED',
      attempts: { lt: 3 },
    },
    data: {
      status: 'PENDING',
      scheduledFor: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes delay
    },
  });

  return result.count;
}

/**
 * Clean up old completed jobs
 */
export async function cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await prisma.verificationJob.deleteMany({
    where: {
      status: { in: ['COMPLETED', 'CANCELLED'] },
      completedAt: { lt: cutoff },
    },
  });

  return result.count;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<any> {
  const job = await prisma.verificationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return null;
  }

  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    scheduledFor: job.scheduledFor,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    result: job.result,
    error: job.lastError,
  };
}

// ============================================================================
// SCHEDULED TASKS
// ============================================================================

/**
 * Schedule periodic sync for all connected platforms
 */
export async function schedulePeriodicSync(): Promise<void> {
  const connections = await prisma.platformConnection.findMany({
    where: {
      status: 'CONNECTED',
      OR: [
        { lastSyncAt: null },
        { lastSyncAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // 24 hours
      ],
    },
    take: 100,
  });

  for (const connection of connections) {
    await queueJob(connection.userId, 'PLATFORM_SYNC', {
      platformId: connection.platform,
    });
  }

  logger.info('Scheduled periodic sync', { count: connections.length });
}

/**
 * Schedule reputation recalculation for active users
 */
export async function scheduleReputationRecalculation(): Promise<void> {
  const recentActivity = await prisma.workHistoryItem.findMany({
    where: {
      updatedAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { userId: true },
    distinct: ['userId'],
    take: 100,
  });

  for (const { userId } of recentActivity) {
    await queueJob(userId, 'REPUTATION_CALCULATE', {});
  }

  logger.info('Scheduled reputation recalculation', { count: recentActivity.length });
}

/**
 * Check for expiring credentials and send notifications
 */
export async function checkExpiringCredentials(): Promise<void> {
  const expiringIn30Days = new Date();
  expiringIn30Days.setDate(expiringIn30Days.getDate() + 30);

  const expiringCredentials = await prisma.verifiableCredential.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: {
        gt: new Date(),
        lt: expiringIn30Days,
      },
    },
    include: {
      subject: true,
    },
  });

  // In production, this would trigger notification emails
  logger.info('Found expiring credentials', { count: expiringCredentials.length });
}

