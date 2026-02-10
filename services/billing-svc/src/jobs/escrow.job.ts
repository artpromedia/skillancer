// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/jobs/escrow
 * Escrow-related background jobs for marketplace contracts
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';

import { getConfig } from '../config/index.js';
import { getDisputeService } from '../services/dispute.service.js';
import { getMilestoneService } from '../services/milestone.service.js';
import { billingNotifications } from '../services/billing-notifications.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

const config = getConfig();
const QUEUE_NAME = 'escrow-jobs';

// Auto-approval period in days
const AUTO_APPROVAL_DAYS = 14;

// Reminder periods in days before auto-approval
const REMINDER_DAYS = [7, 3, 1];

// Job names
export const ESCROW_JOB_NAMES = {
  AUTO_APPROVE_MILESTONE: 'escrow:auto-approve-milestone',
  MILESTONE_APPROVAL_REMINDER: 'escrow:milestone-approval-reminder',
  DISPUTE_RESPONSE_REMINDER: 'escrow:dispute-response-reminder',
  DISPUTE_AUTO_ESCALATE: 'escrow:dispute-auto-escalate',
  ESCROW_BALANCE_CHECK: 'escrow:balance-check',
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface AutoApproveMilestoneJobData {
  milestoneId: string;
  contractId: string;
  submittedAt: string;
}

interface MilestoneApprovalReminderJobData {
  milestoneId: string;
  contractId: string;
  clientId: string;
  freelancerId: string;
  daysUntilAutoApproval: number;
}

interface DisputeResponseReminderJobData {
  disputeId: string;
  contractId: string;
  respondentId: string;
  daysUntilEscalation: number;
}

interface DisputeAutoEscalateJobData {
  disputeId: string;
  contractId: string;
}

interface EscrowBalanceCheckJobData {
  contractId: string;
}

// =============================================================================
// QUEUE SETUP
// =============================================================================

let escrowQueue: Queue | null = null;
let escrowWorker: Worker | null = null;
let redisConnection: Redis | null = null;

/**
 * Initialize the escrow jobs queue and worker
 */
export function initializeEscrowJobs(): void {
  if (escrowQueue) return;

  // Create Redis connection - prefer REDIS_URL for K8s/Docker environments
  if (process.env.REDIS_URL) {
    redisConnection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  } else {
    redisConnection = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    });
  }

  // Create queue
  escrowQueue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000, // 1 minute initial delay
      },
      removeOnComplete: {
        age: 7 * 24 * 60 * 60, // Keep completed jobs for 7 days
        count: 1000,
      },
      removeOnFail: {
        age: 30 * 24 * 60 * 60, // Keep failed jobs for 30 days
      },
    },
  });

  // Create worker
  escrowWorker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      switch (job.name) {
        case ESCROW_JOB_NAMES.AUTO_APPROVE_MILESTONE:
          return processAutoApproveMilestone(job.data as AutoApproveMilestoneJobData);

        case ESCROW_JOB_NAMES.MILESTONE_APPROVAL_REMINDER:
          return processMilestoneApprovalReminder(job.data as MilestoneApprovalReminderJobData);

        case ESCROW_JOB_NAMES.DISPUTE_RESPONSE_REMINDER:
          return processDisputeResponseReminder(job.data as DisputeResponseReminderJobData);

        case ESCROW_JOB_NAMES.DISPUTE_AUTO_ESCALATE:
          return processDisputeAutoEscalate(job.data as DisputeAutoEscalateJobData);

        case ESCROW_JOB_NAMES.ESCROW_BALANCE_CHECK:
          return processEscrowBalanceCheck(job.data as EscrowBalanceCheckJobData);

        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  // Error handling
  escrowWorker.on('failed', (job, err) => {
    logger.error('Escrow job failed', {
      jobName: job?.name,
      jobId: job?.id,
      error: err.message,
    });
  });

  escrowWorker.on('completed', (job) => {
    logger.info('Escrow job completed', { jobName: job.name, jobId: job.id });
  });

  logger.info('Escrow jobs initialized', { queue: QUEUE_NAME });
}

/**
 * Shutdown the escrow jobs
 */
export async function shutdownEscrowJobs(): Promise<void> {
  if (escrowWorker) {
    await escrowWorker.close();
    escrowWorker = null;
  }
  if (escrowQueue) {
    await escrowQueue.close();
    escrowQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
  logger.info('Escrow jobs shut down');
}

// =============================================================================
// JOB PROCESSORS
// =============================================================================

/**
 * Process auto-approve milestone job
 * Automatically approves milestone after 14 days if client hasn't responded
 */
async function processAutoApproveMilestone(data: AutoApproveMilestoneJobData): Promise<void> {
  logger.info('Processing auto-approve milestone', { milestoneId: data.milestoneId });

  const milestoneService = getMilestoneService();

  try {
    // Check if milestone is still in SUBMITTED status
    const milestone = await prisma.milestone.findUnique({
      where: { id: data.milestoneId },
      include: {
        contract: {
          select: { clientId: true, freelancerId: true, title: true },
        },
      },
    });

    if (!milestone) {
      logger.info('Milestone not found, skipping auto-approve', { milestoneId: data.milestoneId });
      return;
    }

    if (milestone.status !== 'SUBMITTED') {
      logger.info('Milestone no longer SUBMITTED, skipping', {
        milestoneId: data.milestoneId,
        status: milestone.status,
      });
      return;
    }

    // Auto-approve the milestone
    await milestoneService.autoApproveMilestone(data.milestoneId);

    logger.info('Milestone auto-approved', { milestoneId: data.milestoneId });

    // Send notification to client and freelancer about auto-approval
    await billingNotifications.notifyMilestoneAutoApproved(
      { userId: milestone.contract.clientId },
      { userId: milestone.contract.freelancerId },
      {
        contractId: data.contractId,
        contractTitle: milestone.contract.title || 'Contract',
        milestoneId: milestone.id,
        milestoneName: milestone.title || 'Milestone',
        amount: `${(Number(milestone.amount) / 100).toFixed(2)}`,
      }
    );
  } catch (error) {
    logger.error('Error auto-approving milestone', {
      milestoneId: data.milestoneId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process milestone approval reminder
 * Sends reminder to client about pending milestone approval
 */
async function processMilestoneApprovalReminder(
  data: MilestoneApprovalReminderJobData
): Promise<void> {
  logger.info('Processing approval reminder', {
    milestoneId: data.milestoneId,
    daysUntilAutoApproval: data.daysUntilAutoApproval,
  });

  try {
    // Check if milestone is still in SUBMITTED status
    const milestone = await prisma.milestone.findUnique({
      where: { id: data.milestoneId },
      include: {
        contract: { select: { title: true } },
      },
    });

    if (!milestone || milestone.status !== 'SUBMITTED') {
      logger.info('Milestone no longer needs reminder, skipping', {
        milestoneId: data.milestoneId,
      });
      return;
    }

    // Send reminder notification to client
    await billingNotifications.notifyMilestoneSubmitted(
      { userId: data.clientId },
      {
        contractId: data.contractId,
        contractTitle: milestone.contract?.title || 'Contract',
        milestoneId: data.milestoneId,
        milestoneName: milestone.title || 'Milestone',
        amount: `${(Number(milestone.amount) / 100).toFixed(2)}`,
      }
    );

    logger.info('Reminder sent for milestone', { milestoneId: data.milestoneId });
  } catch (error) {
    logger.error('Error sending reminder for milestone', {
      milestoneId: data.milestoneId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process dispute response reminder
 * Sends reminder to respondent about pending dispute response
 */
async function processDisputeResponseReminder(data: DisputeResponseReminderJobData): Promise<void> {
  logger.info('Processing response reminder for dispute', {
    disputeId: data.disputeId,
    daysUntilEscalation: data.daysUntilEscalation,
  });

  try {
    // Check if dispute is still open
    const dispute = await prisma.dispute.findUnique({
      where: { id: data.disputeId },
      include: {
        contract: { select: { title: true, clientId: true, freelancerId: true } },
      },
    });

    if (!dispute || dispute.status !== 'OPEN' || dispute.respondedAt) {
      logger.info('Dispute no longer needs reminder, skipping', { disputeId: data.disputeId });
      return;
    }

    // Send reminder notification using system notification
    await billingNotifications.alertOpsTeam({
      severity: 'medium',
      title: 'Dispute Response Reminder',
      message: `Dispute ${data.disputeId} requires response within ${data.daysUntilEscalation} days`,
      context: {
        disputeId: data.disputeId,
        contractId: data.contractId,
        respondentId: data.respondentId,
        daysUntilEscalation: data.daysUntilEscalation,
      },
    });

    logger.info('Reminder sent for dispute', { disputeId: data.disputeId });
  } catch (error) {
    logger.error('Error sending reminder for dispute', {
      disputeId: data.disputeId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process dispute auto-escalate
 * Automatically escalates dispute if no response within deadline
 */
async function processDisputeAutoEscalate(data: DisputeAutoEscalateJobData): Promise<void> {
  logger.info('Processing auto-escalate for dispute', { disputeId: data.disputeId });

  try {
    // Check if dispute is still open and hasn't been responded to
    const dispute = await prisma.dispute.findUnique({
      where: { id: data.disputeId },
      include: {
        contract: { select: { title: true, clientId: true, freelancerId: true } },
      },
    });

    if (!dispute) {
      logger.info('Dispute not found, skipping', { disputeId: data.disputeId });
      return;
    }

    if (dispute.status !== 'OPEN' || dispute.respondedAt) {
      logger.info('Dispute already responded/escalated, skipping', { disputeId: data.disputeId });
      return;
    }

    // Auto-escalate the dispute
    const disputeService = getDisputeService();
    await disputeService.escalateDispute({
      disputeId: data.disputeId,
      userId: 'SYSTEM',
      reason: 'Auto-escalated due to no response within deadline',
    });

    logger.info('Dispute auto-escalated', { disputeId: data.disputeId });

    // Notify both parties
    if (dispute.contract) {
      await billingNotifications.notifyDisputeOpened(
        {
          client: { userId: dispute.contract.clientId },
          freelancer: { userId: dispute.contract.freelancerId },
        },
        {
          disputeId: data.disputeId,
          contractId: data.contractId,
          contractTitle: dispute.contract.title || 'Contract',
          reason: 'Dispute escalated due to no response within deadline',
        }
      );
    }
  } catch (error) {
    logger.error('Error auto-escalating dispute', {
      disputeId: data.disputeId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Process escrow balance check
 * Validates escrow balance consistency
 */
async function processEscrowBalanceCheck(data: EscrowBalanceCheckJobData): Promise<void> {
  logger.info('Processing balance check for contract', { contractId: data.contractId });

  try {
    const balance = await prisma.escrowBalance.findUnique({
      where: { contractId: data.contractId },
    });

    if (!balance) {
      logger.info('No escrow balance for contract', { contractId: data.contractId });
      return;
    }

    // Calculate expected balance
    const expectedBalance =
      Number(balance.totalFunded) - Number(balance.totalReleased) - Number(balance.totalRefunded);

    const actualBalance = Number(balance.currentBalance);

    if (Math.abs(expectedBalance - actualBalance) > 0.01) {
      logger.error('Escrow balance mismatch detected', {
        contractId: data.contractId,
        expectedBalance,
        actualBalance,
        difference: Math.abs(expectedBalance - actualBalance),
      });

      // Alert ops team about balance mismatch
      await billingNotifications.alertOpsTeam({
        severity: 'critical',
        title: 'Escrow Balance Mismatch',
        message: `Contract ${data.contractId} has a balance discrepancy of ${Math.abs(expectedBalance - actualBalance).toFixed(2)}`,
        context: {
          contractId: data.contractId,
          expectedBalance,
          actualBalance,
          totalFunded: balance.totalFunded,
          totalReleased: balance.totalReleased,
          totalRefunded: balance.totalRefunded,
        },
      });
    } else {
      logger.info('Balance check passed', { contractId: data.contractId });
    }
  } catch (error) {
    logger.error('Error checking balance for contract', {
      contractId: data.contractId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// =============================================================================
// JOB SCHEDULERS
// =============================================================================

/**
 * Schedule auto-approve job for a milestone
 */
export async function scheduleAutoApprove(
  milestoneId: string,
  contractId: string,
  submittedAt: Date
): Promise<void> {
  if (!escrowQueue) {
    logger.warn('Escrow queue not initialized, skipping job scheduling');
    return;
  }

  // Calculate delay (14 days from submission)
  const autoApproveAt = new Date(submittedAt);
  autoApproveAt.setDate(autoApproveAt.getDate() + AUTO_APPROVAL_DAYS);
  const delay = Math.max(0, autoApproveAt.getTime() - Date.now());

  // Schedule the auto-approve job
  await escrowQueue.add(
    ESCROW_JOB_NAMES.AUTO_APPROVE_MILESTONE,
    {
      milestoneId,
      contractId,
      submittedAt: submittedAt.toISOString(),
    } satisfies AutoApproveMilestoneJobData,
    {
      delay,
      jobId: `auto-approve-${milestoneId}`,
    }
  );

  logger.info('Scheduled auto-approve for milestone', {
    milestoneId,
    autoApproveAt: autoApproveAt.toISOString(),
  });

  // Schedule reminder jobs
  await scheduleMilestoneReminders(milestoneId, contractId, submittedAt);
}

/**
 * Schedule milestone approval reminders
 */
async function scheduleMilestoneReminders(
  milestoneId: string,
  contractId: string,
  submittedAt: Date
): Promise<void> {
  if (!escrowQueue) return;

  // Get contract details for client/freelancer IDs
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { clientId: true, freelancerId: true },
  });

  if (!contract) return;

  for (const reminderDays of REMINDER_DAYS) {
    const daysUntilAutoApproval = reminderDays;
    const reminderAt = new Date(submittedAt);
    reminderAt.setDate(reminderAt.getDate() + (AUTO_APPROVAL_DAYS - reminderDays));

    const delay = Math.max(0, reminderAt.getTime() - Date.now());

    if (delay > 0) {
      await escrowQueue.add(
        ESCROW_JOB_NAMES.MILESTONE_APPROVAL_REMINDER,
        {
          milestoneId,
          contractId,
          clientId: contract.clientId,
          freelancerId: contract.freelancerId,
          daysUntilAutoApproval,
        } satisfies MilestoneApprovalReminderJobData,
        {
          delay,
          jobId: `reminder-${milestoneId}-${reminderDays}d`,
        }
      );
    }
  }
}

/**
 * Schedule dispute response reminder and auto-escalate
 */
export async function scheduleDisputeJobs(
  disputeId: string,
  contractId: string,
  respondentId: string,
  respondBy: Date
): Promise<void> {
  if (!escrowQueue) {
    logger.warn('Escrow queue not initialized, skipping job scheduling');
    return;
  }

  // Schedule auto-escalate at respond-by deadline
  const escalateDelay = Math.max(0, respondBy.getTime() - Date.now());

  await escrowQueue.add(
    ESCROW_JOB_NAMES.DISPUTE_AUTO_ESCALATE,
    {
      disputeId,
      contractId,
    } satisfies DisputeAutoEscalateJobData,
    {
      delay: escalateDelay,
      jobId: `auto-escalate-${disputeId}`,
    }
  );

  // Schedule reminders (3 days, 1 day before deadline)
  const reminderDays = [3, 1];
  for (const days of reminderDays) {
    const reminderAt = new Date(respondBy);
    reminderAt.setDate(reminderAt.getDate() - days);

    const delay = Math.max(0, reminderAt.getTime() - Date.now());

    if (delay > 0) {
      await escrowQueue.add(
        ESCROW_JOB_NAMES.DISPUTE_RESPONSE_REMINDER,
        {
          disputeId,
          contractId,
          respondentId,
          daysUntilEscalation: days,
        } satisfies DisputeResponseReminderJobData,
        {
          delay,
          jobId: `dispute-reminder-${disputeId}-${days}d`,
        }
      );
    }
  }

  logger.info('Scheduled dispute jobs', { disputeId });
}

/**
 * Cancel scheduled jobs for a milestone (when manually approved/rejected)
 */
export async function cancelMilestoneJobs(milestoneId: string): Promise<void> {
  if (!escrowQueue) return;

  // Remove auto-approve job
  const autoApproveJob = await escrowQueue.getJob(`auto-approve-${milestoneId}`);
  if (autoApproveJob) {
    await autoApproveJob.remove();
  }

  // Remove reminder jobs
  for (const days of REMINDER_DAYS) {
    const reminderJob = await escrowQueue.getJob(`reminder-${milestoneId}-${days}d`);
    if (reminderJob) {
      await reminderJob.remove();
    }
  }

  logger.info('Cancelled jobs for milestone', { milestoneId });
}

/**
 * Cancel scheduled jobs for a dispute (when responded/resolved)
 */
export async function cancelDisputeJobs(disputeId: string): Promise<void> {
  if (!escrowQueue) return;

  // Remove auto-escalate job
  const escalateJob = await escrowQueue.getJob(`auto-escalate-${disputeId}`);
  if (escalateJob) {
    await escalateJob.remove();
  }

  // Remove reminder jobs
  for (const days of [3, 1]) {
    const reminderJob = await escrowQueue.getJob(`dispute-reminder-${disputeId}-${days}d`);
    if (reminderJob) {
      await reminderJob.remove();
    }
  }

  logger.info('Cancelled jobs for dispute', { disputeId });
}

// =============================================================================
// CRON JOBS
// =============================================================================

/**
 * Schedule recurring cron jobs
 */
export async function scheduleEscrowCronJobs(): Promise<void> {
  if (!escrowQueue) {
    logger.warn('Escrow queue not initialized, skipping cron scheduling');
    return;
  }

  // Daily balance check at 2 AM
  await escrowQueue.add(
    'escrow:daily-balance-check',
    {},
    {
      repeat: {
        pattern: '0 2 * * *', // Every day at 2 AM
      },
      jobId: 'daily-balance-check',
    }
  );

  // Check for milestones pending auto-approval (hourly backup check)
  await escrowQueue.add(
    'escrow:check-pending-approvals',
    {},
    {
      repeat: {
        pattern: '0 * * * *', // Every hour
      },
      jobId: 'check-pending-approvals',
    }
  );

  logger.info('Escrow cron jobs scheduled');
}

/**
 * Process daily balance check for all active contracts
 */
export async function processDailyBalanceCheck(): Promise<void> {
  logger.info('Running daily balance check');

  const activeBalances = await prisma.escrowBalance.findMany({
    where: {
      status: { in: ['ACTIVE', 'FROZEN'] },
    },
    select: { contractId: true },
  });

  for (const balance of activeBalances) {
    if (escrowQueue) {
      await escrowQueue.add(
        ESCROW_JOB_NAMES.ESCROW_BALANCE_CHECK,
        { contractId: balance.contractId } satisfies EscrowBalanceCheckJobData,
        {
          jobId: `balance-check-${balance.contractId}-${Date.now()}`,
        }
      );
    }
  }

  logger.info('Queued balance checks', { count: activeBalances.length });
}

/**
 * Check for milestones that should have been auto-approved (backup)
 */
export async function checkPendingAutoApprovals(): Promise<void> {
  logger.info('Checking for pending auto-approvals');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUTO_APPROVAL_DAYS);

  const pendingMilestones = await prisma.milestone.findMany({
    where: {
      status: 'SUBMITTED',
      submittedAt: { lte: cutoffDate },
    },
    select: {
      id: true,
      contractId: true,
      submittedAt: true,
    },
  });

  const milestoneService = getMilestoneService();

  for (const milestone of pendingMilestones) {
    try {
      await milestoneService.autoApproveMilestone(milestone.id);
      logger.info('Backup auto-approved milestone', { milestoneId: milestone.id });
    } catch (error) {
      logger.error('Error backup auto-approving milestone', {
        milestoneId: milestone.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Processed pending milestones', { count: pendingMilestones.length });
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  escrowQueue,
  escrowWorker,
  type AutoApproveMilestoneJobData,
  type MilestoneApprovalReminderJobData,
  type DisputeResponseReminderJobData,
  type DisputeAutoEscalateJobData,
  type EscrowBalanceCheckJobData,
};
