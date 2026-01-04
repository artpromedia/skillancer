// @ts-nocheck
/**
 * HIPAA Training Reminder Background Job
 * Sprint M9: Healthcare Vertical Module
 *
 * Sends reminders for expiring and overdue HIPAA training
 */

import { structlog } from '@skillancer/logger';

// TODO: trainingTracker import path needs to be fixed when compliance-svc is integrated
// import { trainingTracker } from '@skillancer/compliance-svc';
const trainingTracker = {
  getExpiringCertifications: async () => [],
  getOverdueCertifications: async () => [],
  sendExpirationWarning: async () => {},
  sendOverdueReminder: async () => {},
};

const logger = structlog.get('training-reminder-job');

// ============================================================================
// Job Configuration
// ============================================================================

const JOB_CONFIG = {
  // Run daily at 9 AM
  schedule: '0 9 * * *',

  // Expiration warning thresholds (days)
  expirationWarnings: [60, 30, 14, 7, 3, 1],

  // Overdue reminder frequency (days)
  overdueReminderFrequency: 3,

  // Batch size for processing
  batchSize: 100,
};

// ============================================================================
// Types
// ============================================================================

export interface TrainingReminderResult {
  processedUsers: number;
  expiringReminders: number;
  overdueReminders: number;
  complianceBlocks: number;
  notificationsSent: number;
  errors: string[];
}

interface UserTrainingStatus {
  userId: string;
  email: string;
  name: string;
  trainings: Array<{
    type: string;
    name: string;
    expiresAt: Date | null;
    completedAt: Date | null;
    required: boolean;
  }>;
}

// ============================================================================
// Job Functions
// ============================================================================

/**
 * Main job function - send training reminders
 */
export async function runTrainingReminderJob(): Promise<TrainingReminderResult> {
  logger.info('Starting training reminder job');

  const result: TrainingReminderResult = {
    processedUsers: 0,
    expiringReminders: 0,
    overdueReminders: 0,
    complianceBlocks: 0,
    notificationsSent: 0,
    errors: [],
  };

  try {
    // Step 1: Send expiring training reminders
    await sendExpiringTrainingReminders(result);

    // Step 2: Send overdue training reminders
    await sendOverdueTrainingReminders(result);

    // Step 3: Block non-compliant users from healthcare jobs
    await blockNonCompliantUsers(result);

    // Step 4: Send weekly compliance summary to admins
    if (isMonday()) {
      await sendWeeklyComplianceSummary(result);
    }

    logger.info('Training reminder job completed', {
      processedUsers: result.processedUsers,
      expiringReminders: result.expiringReminders,
      overdueReminders: result.overdueReminders,
      complianceBlocks: result.complianceBlocks,
    });
  } catch (error) {
    logger.error('Training reminder job failed', { error });
    result.errors.push(`Job failed: ${error}`);
  }

  return result;
}

/**
 * Send reminders for training expiring soon
 */
async function sendExpiringTrainingReminders(result: TrainingReminderResult): Promise<void> {
  logger.info('Sending expiring training reminders');

  for (const daysUntilExpiry of JOB_CONFIG.expirationWarnings) {
    try {
      const expiringTrainings = await getTrainingsExpiringInDays(daysUntilExpiry);

      for (const training of expiringTrainings) {
        result.processedUsers++;

        // Determine urgency level
        const urgency = getUrgencyLevel(daysUntilExpiry);

        // Send reminder
        await sendTrainingReminder({
          userId: training.userId,
          trainingType: training.type,
          trainingName: training.name,
          expiresAt: training.expiresAt,
          daysUntilExpiry,
          urgency,
          action: 'renew',
        });

        result.expiringReminders++;
        result.notificationsSent++;

        logger.info('Sent expiring training reminder', {
          userId: training.userId,
          trainingType: training.type,
          daysUntilExpiry,
        });
      }
    } catch (error) {
      logger.error('Error sending expiring reminders', { daysUntilExpiry, error });
      result.errors.push(`Error for ${daysUntilExpiry}-day expiring: ${error}`);
    }
  }
}

/**
 * Send reminders for overdue/expired training
 */
async function sendOverdueTrainingReminders(result: TrainingReminderResult): Promise<void> {
  logger.info('Sending overdue training reminders');

  try {
    const overdueTrainings = await getOverdueTrainings();

    for (const training of overdueTrainings) {
      // Check if reminder was sent recently
      const daysSinceLastReminder = await getDaysSinceLastReminder(training.userId, training.type);

      if (daysSinceLastReminder < JOB_CONFIG.overdueReminderFrequency) {
        continue;
      }

      result.processedUsers++;

      // Send overdue reminder
      await sendTrainingReminder({
        userId: training.userId,
        trainingType: training.type,
        trainingName: training.name,
        expiresAt: training.expiresAt,
        daysOverdue: getDaysOverdue(training.expiresAt),
        urgency: 'critical',
        action: 'complete-immediately',
      });

      result.overdueReminders++;
      result.notificationsSent++;

      logger.info('Sent overdue training reminder', {
        userId: training.userId,
        trainingType: training.type,
      });
    }
  } catch (error) {
    logger.error('Error sending overdue reminders', { error });
    result.errors.push(`Error sending overdue reminders: ${error}`);
  }
}

/**
 * Block users with overdue required training from healthcare jobs
 */
async function blockNonCompliantUsers(result: TrainingReminderResult): Promise<void> {
  logger.info('Blocking non-compliant users');

  try {
    const nonCompliantUsers = await getNonCompliantUsers();

    for (const user of nonCompliantUsers) {
      // Check if already blocked
      if (await isAlreadyBlocked(user.userId)) {
        continue;
      }

      result.processedUsers++;

      // Block from healthcare jobs
      await blockFromHealthcareJobs(user.userId, 'overdue_hipaa_training');

      // Send blocking notification
      await sendBlockingNotification({
        userId: user.userId,
        reason: 'Overdue HIPAA training',
        overdueTrainings: user.overdueTrainings,
        unblockAction: 'Complete all required HIPAA training',
      });

      result.complianceBlocks++;
      result.notificationsSent++;

      logger.info('Blocked non-compliant user', { userId: user.userId });
    }
  } catch (error) {
    logger.error('Error blocking non-compliant users', { error });
    result.errors.push(`Error blocking users: ${error}`);
  }
}

/**
 * Send weekly compliance summary to admins
 */
async function sendWeeklyComplianceSummary(result: TrainingReminderResult): Promise<void> {
  logger.info('Sending weekly compliance summary');

  try {
    const summary = await getComplianceSummary();

    await sendAdminNotification({
      type: 'weekly_compliance_summary',
      data: {
        totalUsers: summary.totalUsers,
        compliantUsers: summary.compliantUsers,
        complianceRate: summary.complianceRate,
        expiringThisWeek: summary.expiringThisWeek,
        overdueTrainings: summary.overdueTrainings,
        blockedUsers: summary.blockedUsers,
      },
    });

    result.notificationsSent++;

    logger.info('Sent weekly compliance summary');
  } catch (error) {
    logger.error('Error sending compliance summary', { error });
    result.errors.push(`Error sending summary: ${error}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getUrgencyLevel(daysUntilExpiry: number): 'low' | 'medium' | 'high' | 'critical' {
  if (daysUntilExpiry <= 3) return 'critical';
  if (daysUntilExpiry <= 7) return 'high';
  if (daysUntilExpiry <= 14) return 'medium';
  return 'low';
}

function getDaysOverdue(expiresAt: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - expiresAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isMonday(): boolean {
  return new Date().getDay() === 1;
}

// ============================================================================
// Database Functions (to be implemented)
// ============================================================================

async function getTrainingsExpiringInDays(days: number): Promise<any[]> {
  // Query HIPAATraining where expiresAt between now and now + days
  // And no reminder sent for this threshold
  return [];
}

async function getOverdueTrainings(): Promise<any[]> {
  // Query HIPAATraining where expiresAt < now
  // And training is required
  return [];
}

async function getDaysSinceLastReminder(userId: string, trainingType: string): Promise<number> {
  // Check notification log for last reminder sent
  return Infinity;
}

async function getNonCompliantUsers(): Promise<any[]> {
  // Get users with required training overdue by more than grace period
  return [];
}

async function isAlreadyBlocked(userId: string): Promise<boolean> {
  // Check if user is already blocked from healthcare jobs
  return false;
}

async function blockFromHealthcareJobs(userId: string, reason: string): Promise<void> {
  logger.info('Blocking user from healthcare jobs', { userId, reason });
}

async function getComplianceSummary(): Promise<any> {
  return {
    totalUsers: 0,
    compliantUsers: 0,
    complianceRate: 100,
    expiringThisWeek: 0,
    overdueTrainings: 0,
    blockedUsers: 0,
  };
}

async function sendTrainingReminder(params: any): Promise<void> {
  logger.info('Sending training reminder', params);
}

async function sendBlockingNotification(params: any): Promise<void> {
  logger.info('Sending blocking notification', params);
}

async function sendAdminNotification(params: any): Promise<void> {
  logger.info('Sending admin notification', params);
}

// ============================================================================
// Exports
// ============================================================================

export const trainingReminderJob = {
  name: 'training-reminder',
  schedule: JOB_CONFIG.schedule,
  run: runTrainingReminderJob,
};
