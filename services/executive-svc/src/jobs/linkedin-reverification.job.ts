/**
 * LinkedIn Reverification Job
 *
 * Periodically re-verifies executive LinkedIn profiles
 * Schedule: Weekly on Sundays at 2am
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { VettingStatus } from '../types/prisma-shim.js';

const REVERIFICATION_INTERVAL_DAYS = 180; // 6 months
const GRACE_PERIOD_DAYS = 30;

export async function runLinkedInReverification(): Promise<void> {
  const jobId = `linkedin-reverification-${Date.now()}`;
  logger.info({ jobId }, 'Starting LinkedIn reverification job');

  try {
    await checkDueReverifications(jobId);
    await handleExpiredVerifications(jobId);
    await flagMissingProfiles(jobId);

    logger.info({ jobId }, 'LinkedIn reverification job completed');
  } catch (error) {
    logger.error({ jobId, error }, 'LinkedIn reverification job failed');
    throw error;
  }
}

async function checkDueReverifications(jobId: string): Promise<void> {
  const reverificationDate = new Date();
  reverificationDate.setDate(reverificationDate.getDate() - REVERIFICATION_INTERVAL_DAYS);

  const executives = await prisma.executiveProfile.findMany({
    where: {
      linkedinVerified: true,
      vettingStatus: VettingStatus.APPROVED,
      updatedAt: { lt: reverificationDate },
    },
    include: { user: true },
  });

  for (const exec of executives) {
    try {
      // Attempt to refresh LinkedIn data
      // In production, would call LinkedIn API
      logger.info(
        { jobId, executiveId: exec.id, linkedinUrl: exec.linkedinUrl },
        'Reverifying LinkedIn profile'
      );

      // If token expired, send reconnect email
      // await sendLinkedInReconnectEmail(exec);
    } catch (error) {
      logger.warn({ jobId, executiveId: exec.id, error }, 'LinkedIn reverification failed');
    }
  }

  logger.info({ jobId, count: executives.length }, 'Reverifications checked');
}

async function handleExpiredVerifications(jobId: string): Promise<void> {
  const gracePeriodDate = new Date();
  gracePeriodDate.setDate(gracePeriodDate.getDate() - GRACE_PERIOD_DAYS);

  // Find executives past grace period without reverification
  const expiredExecutives = await prisma.executiveProfile.findMany({
    where: {
      linkedinVerified: true,
      vettingStatus: VettingStatus.APPROVED,
      linkedinLastVerified: { lt: gracePeriodDate },
    },
  });

  for (const exec of expiredExecutives) {
    logger.info({ jobId, executiveId: exec.id }, 'Flagging expired LinkedIn verification');
  }
}

async function flagMissingProfiles(jobId: string): Promise<void> {
  const executives = await prisma.executiveProfile.findMany({
    where: {
      linkedinVerified: true,
      vettingStatus: VettingStatus.APPROVED,
      linkedinUrl: { not: null },
    },
  });

  for (const exec of executives) {
    try {
      // Check if LinkedIn profile still exists
      // In production, would make HEAD request or API call
      const profileExists = true; // Placeholder

      if (!profileExists) {
        await prisma.executiveProfile.update({
          where: { id: exec.id },
          data: {
            linkedinVerified: false,
            searchable: false,
          },
        });

        logger.warn(
          { jobId, executiveId: exec.id, linkedinUrl: exec.linkedinUrl },
          'LinkedIn profile no longer exists'
        );

        // Notify admin
      }
    } catch (error) {
      logger.error({ jobId, executiveId: exec.id, error }, 'Error checking LinkedIn profile');
    }
  }
}

export default {
  name: 'linkedin-reverification',
  schedule: '0 2 * * 0', // Weekly on Sundays at 2am
  run: runLinkedInReverification,
};
