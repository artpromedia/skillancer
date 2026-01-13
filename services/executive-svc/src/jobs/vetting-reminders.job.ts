/**
 * Vetting Reminder Job
 *
 * Sends automated reminders to executives stuck in vetting stages
 * Schedule: Daily at 9am
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import {
  VettingStage,
  VettingStatus,
  BackgroundCheckStatus,
  ReferenceStatus,
} from '../types/prisma-shim.js';

interface ReminderConfig {
  stage: VettingStage;
  daysThreshold: number;
  reminderType: string;
}

const REMINDER_CONFIGS: ReminderConfig[] = [
  { stage: VettingStage.INTERVIEW_SCHEDULED, daysThreshold: 3, reminderType: 'schedule_interview' },
  { stage: VettingStage.REFERENCE_CHECK, daysThreshold: 5, reminderType: 'add_references' },
  { stage: VettingStage.REFERENCE_CHECK, daysThreshold: 7, reminderType: 'reference_followup' },
  { stage: VettingStage.BACKGROUND_CHECK, daysThreshold: 3, reminderType: 'background_consent' },
];

export async function runVettingReminders(): Promise<void> {
  const jobId = `vetting-reminders-${Date.now()}`;
  logger.info({ jobId }, 'Starting vetting reminders job');

  try {
    // Check for stale interview scheduling
    await sendInterviewReminders(jobId);

    // Check for missing references
    await sendReferenceReminders(jobId);

    // Check for pending background checks
    await sendBackgroundCheckReminders(jobId);

    // Check for stale applications
    await handleStaleApplications(jobId);

    logger.info({ jobId }, 'Vetting reminders job completed');
  } catch (error) {
    logger.error({ jobId, error }, 'Vetting reminders job failed');
    throw error;
  }
}

async function sendInterviewReminders(jobId: string): Promise<void> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const executives = await prisma.executiveProfile.findMany({
    where: {
      vettingStage: VettingStage.AUTOMATED_SCREENING,
      vettingStatus: VettingStatus.IN_REVIEW,
      updatedAt: { lt: threeDaysAgo },
    },
    include: { user: true },
  });

  for (const exec of executives) {
    logger.info(
      {
        jobId,
        executiveId: exec.id,
        email: exec.user.email,
      },
      'Sending interview scheduling reminder'
    );
    // Queue notification
  }

  logger.info({ jobId, count: executives.length }, 'Interview reminders sent');
}

async function sendReferenceReminders(jobId: string): Promise<void> {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  const executives = await prisma.executiveProfile.findMany({
    where: {
      vettingStage: VettingStage.REFERENCE_CHECK,
      vettingStatus: VettingStatus.IN_REVIEW,
      referencesVerified: { lt: 3 },
      updatedAt: { lt: fiveDaysAgo },
    },
    include: { user: true, references: true },
  });

  for (const exec of executives) {
    const pendingRefs = exec.references.filter((r) => r.status === ReferenceStatus.PENDING);
    if (pendingRefs.length > 0) {
      logger.info(
        {
          jobId,
          executiveId: exec.id,
          pendingCount: pendingRefs.length,
        },
        'Sending reference reminder'
      );
    }
  }

  logger.info({ jobId, count: executives.length }, 'Reference reminders sent');
}

async function sendBackgroundCheckReminders(jobId: string): Promise<void> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const executives = await prisma.executiveProfile.findMany({
    where: {
      vettingStage: VettingStage.BACKGROUND_CHECK,
      backgroundCheckStatus: BackgroundCheckStatus.PENDING,
      updatedAt: { lt: threeDaysAgo },
    },
    include: { user: true },
  });

  for (const exec of executives) {
    logger.info(
      {
        jobId,
        executiveId: exec.id,
      },
      'Sending background check reminder'
    );
  }

  logger.info({ jobId, count: executives.length }, 'Background check reminders sent');
}

async function handleStaleApplications(jobId: string): Promise<void> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Send "still interested?" emails
  const staleExecutives = await prisma.executiveProfile.findMany({
    where: {
      vettingStatus: VettingStatus.IN_REVIEW,
      updatedAt: { lt: fourteenDaysAgo, gt: thirtyDaysAgo },
    },
    include: { user: true },
  });

  for (const exec of staleExecutives) {
    logger.info({ jobId, executiveId: exec.id }, 'Sending still interested email');
  }

  // Auto-withdraw after 30 days
  const abandonedExecutives = await prisma.executiveProfile.findMany({
    where: {
      vettingStatus: VettingStatus.IN_REVIEW,
      updatedAt: { lt: thirtyDaysAgo },
    },
  });

  for (const exec of abandonedExecutives) {
    await prisma.executiveProfile.update({
      where: { id: exec.id },
      data: { vettingStatus: VettingStatus.WITHDRAWN },
    });
    logger.info({ jobId, executiveId: exec.id }, 'Auto-withdrawn stale application');
  }

  logger.info(
    {
      jobId,
      reminded: staleExecutives.length,
      withdrawn: abandonedExecutives.length,
    },
    'Stale applications handled'
  );
}

export default {
  name: 'vetting-reminders',
  schedule: '0 9 * * *', // Daily at 9am
  run: runVettingReminders,
};
