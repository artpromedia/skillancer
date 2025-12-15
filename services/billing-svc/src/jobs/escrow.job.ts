/**
 * @module @skillancer/billing-svc/jobs/escrow
 * Escrow-related background jobs for marketplace contracts
 */

import { prisma } from '@skillancer/database';
import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';

import { getConfig } from '../config/index.js';
import { getDisputeService } from '../services/dispute.service.js';
import { getMilestoneService } from '../services/milestone.service.js';

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

  // Create Redis connection
  const redisOptions: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest: null;
  } = {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
  };

  if (config.redis.password) {
    redisOptions.password = config.redis.password;
  }

  redisConnection = new Redis(redisOptions);

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
    console.error(`[EscrowJob] Job ${job?.name} failed:`, err);
  });

  escrowWorker.on('completed', (job) => {
    console.log(`[EscrowJob] Job ${job.name} completed`);
  });

  console.log('[EscrowJob] Escrow jobs initialized');
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
  console.log('[EscrowJob] Escrow jobs shut down');
}

// =============================================================================
// JOB PROCESSORS
// =============================================================================

/**
 * Process auto-approve milestone job
 * Automatically approves milestone after 14 days if client hasn't responded
 */
async function processAutoApproveMilestone(data: AutoApproveMilestoneJobData): Promise<void> {
  console.log(`[EscrowJob] Processing auto-approve for milestone ${data.milestoneId}`);

  const milestoneService = getMilestoneService();

  try {
    // Check if milestone is still in SUBMITTED status
    const milestone = await prisma.milestone.findUnique({
      where: { id: data.milestoneId },
      include: {
        contract: {
          select: { clientId: true, freelancerId: true },
        },
      },
    });

    if (!milestone) {
      console.log(`[EscrowJob] Milestone ${data.milestoneId} not found, skipping`);
      return;
    }

    if (milestone.status !== 'SUBMITTED') {
      console.log(
        `[EscrowJob] Milestone ${data.milestoneId} is no longer SUBMITTED (${milestone.status}), skipping`
      );
      return;
    }

    // Auto-approve the milestone
    await milestoneService.autoApproveMilestone(data.milestoneId);

    console.log(`[EscrowJob] Milestone ${data.milestoneId} auto-approved`);

    // TODO: Send notification to client and freelancer about auto-approval
  } catch (error) {
    console.error(`[EscrowJob] Error auto-approving milestone ${data.milestoneId}:`, error);
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
  console.log(
    `[EscrowJob] Processing approval reminder for milestone ${data.milestoneId} (${data.daysUntilAutoApproval} days left)`
  );

  try {
    // Check if milestone is still in SUBMITTED status
    const milestone = await prisma.milestone.findUnique({
      where: { id: data.milestoneId },
      select: { status: true, title: true },
    });

    if (!milestone || milestone.status !== 'SUBMITTED') {
      console.log(`[EscrowJob] Milestone ${data.milestoneId} no longer needs reminder, skipping`);
      return;
    }

    // TODO: Send reminder notification to client
    // await notificationService.sendMilestoneApprovalReminder({
    //   milestoneId: data.milestoneId,
    //   clientId: data.clientId,
    //   daysUntilAutoApproval: data.daysUntilAutoApproval,
    // });

    console.log(`[EscrowJob] Reminder sent for milestone ${data.milestoneId}`);
  } catch (error) {
    console.error(`[EscrowJob] Error sending reminder for milestone ${data.milestoneId}:`, error);
    throw error;
  }
}

/**
 * Process dispute response reminder
 * Sends reminder to respondent about pending dispute response
 */
async function processDisputeResponseReminder(data: DisputeResponseReminderJobData): Promise<void> {
  console.log(
    `[EscrowJob] Processing response reminder for dispute ${data.disputeId} (${data.daysUntilEscalation} days left)`
  );

  try {
    // Check if dispute is still open
    const dispute = await prisma.dispute.findUnique({
      where: { id: data.disputeId },
      select: { status: true, respondedAt: true },
    });

    if (!dispute || dispute.status !== 'OPEN' || dispute.respondedAt) {
      console.log(`[EscrowJob] Dispute ${data.disputeId} no longer needs reminder, skipping`);
      return;
    }

    // TODO: Send reminder notification to respondent
    // await notificationService.sendDisputeResponseReminder({
    //   disputeId: data.disputeId,
    //   respondentId: data.respondentId,
    //   daysUntilEscalation: data.daysUntilEscalation,
    // });

    console.log(`[EscrowJob] Reminder sent for dispute ${data.disputeId}`);
  } catch (error) {
    console.error(`[EscrowJob] Error sending reminder for dispute ${data.disputeId}:`, error);
    throw error;
  }
}

/**
 * Process dispute auto-escalate
 * Automatically escalates dispute if no response within deadline
 */
async function processDisputeAutoEscalate(data: DisputeAutoEscalateJobData): Promise<void> {
  console.log(`[EscrowJob] Processing auto-escalate for dispute ${data.disputeId}`);

  try {
    // Check if dispute is still open and hasn't been responded to
    const dispute = await prisma.dispute.findUnique({
      where: { id: data.disputeId },
      select: { status: true, respondedAt: true, raisedBy: true },
    });

    if (!dispute) {
      console.log(`[EscrowJob] Dispute ${data.disputeId} not found, skipping`);
      return;
    }

    if (dispute.status !== 'OPEN' || dispute.respondedAt) {
      console.log(`[EscrowJob] Dispute ${data.disputeId} already responded/escalated, skipping`);
      return;
    }

    // Auto-escalate the dispute
    const disputeService = getDisputeService();
    await disputeService.escalateDispute({
      disputeId: data.disputeId,
      userId: 'SYSTEM',
      reason: 'Auto-escalated due to no response within deadline',
    });

    console.log(`[EscrowJob] Dispute ${data.disputeId} auto-escalated`);

    // TODO: Send notification to both parties
  } catch (error) {
    console.error(`[EscrowJob] Error auto-escalating dispute ${data.disputeId}:`, error);
    throw error;
  }
}

/**
 * Process escrow balance check
 * Validates escrow balance consistency
 */
async function processEscrowBalanceCheck(data: EscrowBalanceCheckJobData): Promise<void> {
  console.log(`[EscrowJob] Processing balance check for contract ${data.contractId}`);

  try {
    const balance = await prisma.escrowBalance.findUnique({
      where: { contractId: data.contractId },
    });

    if (!balance) {
      console.log(`[EscrowJob] No escrow balance for contract ${data.contractId}`);
      return;
    }

    // Calculate expected balance
    const expectedBalance =
      Number(balance.totalFunded) - Number(balance.totalReleased) - Number(balance.totalRefunded);

    const actualBalance = Number(balance.currentBalance);

    if (Math.abs(expectedBalance - actualBalance) > 0.01) {
      console.error(
        `[EscrowJob] Balance mismatch for contract ${data.contractId}: ` +
          `expected ${expectedBalance}, actual ${actualBalance}`
      );

      // TODO: Alert ops team about balance mismatch
    } else {
      console.log(`[EscrowJob] Balance check passed for contract ${data.contractId}`);
    }
  } catch (error) {
    console.error(`[EscrowJob] Error checking balance for contract ${data.contractId}:`, error);
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
    console.warn('[EscrowJob] Queue not initialized, skipping job scheduling');
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

  console.log(
    `[EscrowJob] Scheduled auto-approve for milestone ${milestoneId} at ${autoApproveAt.toISOString()}`
  );

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
    console.warn('[EscrowJob] Queue not initialized, skipping job scheduling');
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

  console.log(`[EscrowJob] Scheduled dispute jobs for ${disputeId}`);
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

  console.log(`[EscrowJob] Cancelled jobs for milestone ${milestoneId}`);
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

  console.log(`[EscrowJob] Cancelled jobs for dispute ${disputeId}`);
}

// =============================================================================
// CRON JOBS
// =============================================================================

/**
 * Schedule recurring cron jobs
 */
export async function scheduleEscrowCronJobs(): Promise<void> {
  if (!escrowQueue) {
    console.warn('[EscrowJob] Queue not initialized, skipping cron scheduling');
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

  console.log('[EscrowJob] Cron jobs scheduled');
}

/**
 * Process daily balance check for all active contracts
 */
export async function processDailyBalanceCheck(): Promise<void> {
  console.log('[EscrowJob] Running daily balance check');

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

  console.log(`[EscrowJob] Queued balance checks for ${activeBalances.length} contracts`);
}

/**
 * Check for milestones that should have been auto-approved (backup)
 */
export async function checkPendingAutoApprovals(): Promise<void> {
  console.log('[EscrowJob] Checking for pending auto-approvals');

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
      console.log(`[EscrowJob] Backup auto-approved milestone ${milestone.id}`);
    } catch (error) {
      console.error(`[EscrowJob] Error backup auto-approving milestone ${milestone.id}:`, error);
    }
  }

  console.log(`[EscrowJob] Processed ${pendingMilestones.length} pending milestones`);
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
