/**
 * Subscription Metrics Job
 *
 * Collects and reports subscription metrics for monitoring and alerting.
 * Run via cron: 0 * * * * (hourly)
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

interface SubscriptionMetrics {
  timestamp: Date;
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  cancelledSubscriptions: number;
  tierBreakdown: Record<string, number>;
  mrr: number;
  arr: number;
  newSubscriptionsLast24h: number;
  churnedLast30d: number;
}

export async function collectSubscriptionMetrics(): Promise<SubscriptionMetrics> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get subscription counts by status
  const statusCounts = await prisma.executiveSubscription.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const statusMap: Record<string, number> = {};
  statusCounts.forEach((s) => {
    statusMap[s.status] = s._count.id;
  });

  // Get tier breakdown
  const tierCounts = await prisma.executiveSubscription.groupBy({
    by: ['tier'],
    where: { status: 'ACTIVE' },
    _count: { id: true },
  });

  const tierBreakdown: Record<string, number> = {};
  tierCounts.forEach((t) => {
    tierBreakdown[t.tier] = t._count.id;
  });

  // Calculate MRR from active subscriptions
  const activeSubscriptions = await prisma.executiveSubscription.findMany({
    where: { status: 'ACTIVE' },
    select: { monthlyPrice: true },
  });

  const mrr = activeSubscriptions.reduce((sum, s) => sum + (s.monthlyPrice?.toNumber() || 0), 0);

  // New subscriptions in last 24h
  const newSubs = await prisma.executiveSubscription.count({
    where: { createdAt: { gte: oneDayAgo } },
  });

  // Churned in last 30 days
  const churned = await prisma.executiveSubscription.count({
    where: {
      status: 'CANCELLED',
      cancelledAt: { gte: thirtyDaysAgo },
    },
  });

  const metrics: SubscriptionMetrics = {
    timestamp: now,
    totalSubscriptions: Object.values(statusMap).reduce((a, b) => a + b, 0),
    activeSubscriptions: statusMap['ACTIVE'] || 0,
    trialingSubscriptions: statusMap['TRIALING'] || 0,
    pastDueSubscriptions: statusMap['PAST_DUE'] || 0,
    cancelledSubscriptions: statusMap['CANCELLED'] || 0,
    tierBreakdown,
    mrr,
    arr: mrr * 12,
    newSubscriptionsLast24h: newSubs,
    churnedLast30d: churned,
  };

  logger.info({ metrics }, 'Subscription metrics collected');

  // TODO: Push to metrics service (Prometheus, DataDog, etc.)
  // await metricsService.push('executive.subscriptions', metrics);

  return metrics;
}

/**
 * Platform Fee Collection Job
 *
 * Processes platform fees for marketplace engagements.
 * Run via cron: 0 2 1 * * (monthly on 1st at 2am)
 */
export async function processPlatformFees(): Promise<void> {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  logger.info(
    {
      billingPeriod: { start: lastMonth, end: thisMonth },
    },
    'Processing platform fees'
  );

  // Find all active marketplace engagements
  const engagements = await prisma.executiveEngagement.findMany({
    where: {
      status: 'ACTIVE',
      isMarketplaceEngagement: true,
    },
    include: {
      executive: { select: { userId: true } },
      platformFees: {
        where: { periodStart: lastMonth },
      },
    },
  });

  let processed = 0;
  let skipped = 0;

  for (const engagement of engagements) {
    // Skip if already processed
    if (engagement.platformFees.length > 0) {
      skipped++;
      continue;
    }

    // Calculate months since engagement start
    const startDate = engagement.startDate || engagement.createdAt;
    const monthsSinceStart = Math.floor(
      (thisMonth.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)
    );

    // Determine fee percentage based on tenure
    let feePercentage: number;
    if (monthsSinceStart <= 3) {
      feePercentage = 15;
    } else if (monthsSinceStart <= 12) {
      feePercentage = 10;
    } else {
      feePercentage = 5;
    }

    // Get billing amount for the month
    const billingAmount = engagement.monthlyRetainer?.toNumber() || 0;
    const feeAmount = billingAmount * (feePercentage / 100);
    const netAmount = billingAmount - feeAmount;

    // Create platform fee record
    await prisma.platformFeeRecord.create({
      data: {
        engagementId: engagement.id,
        billingMonth: monthsSinceStart + 1,
        periodStart: lastMonth,
        periodEnd: thisMonth,
        grossAmount: billingAmount,
        feePercentage,
        feeAmount,
        netAmount,
        status: 'PENDING',
      },
    });

    processed++;
  }

  logger.info({ processed, skipped }, 'Platform fees processed');
}

/**
 * Subscription Renewal Check Job
 *
 * Checks for expiring subscriptions and sends renewal reminders.
 * Run via cron: 0 9 * * * (daily at 9am)
 */
export async function checkSubscriptionRenewals(): Promise<void> {
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Find subscriptions expiring in 7 days
  const expiringIn7Days = await prisma.executiveSubscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: {
        gte: now,
        lte: sevenDays,
      },
      cancelAtPeriodEnd: true,
    },
    include: {
      executive: {
        include: { user: { select: { email: true, firstName: true } } },
      },
    },
  });

  // Find subscriptions expiring in 3 days
  const expiringIn3Days = await prisma.executiveSubscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: {
        gte: now,
        lte: threeDays,
      },
      cancelAtPeriodEnd: true,
    },
    include: {
      executive: {
        include: { user: { select: { email: true, firstName: true } } },
      },
    },
  });

  logger.info(
    {
      expiringIn7Days: expiringIn7Days.length,
      expiringIn3Days: expiringIn3Days.length,
    },
    'Subscription renewal check'
  );

  // TODO: Send email notifications
  // for (const sub of expiringIn7Days) {
  //   await emailService.send('subscription-expiring-7days', sub.executive.user.email, {...});
  // }
}

// Export for cron runner
export const jobs = {
  collectSubscriptionMetrics,
  processPlatformFees,
  checkSubscriptionRenewals,
};
