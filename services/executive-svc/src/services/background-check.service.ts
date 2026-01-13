/**
 * Background Check Service (Checkr Integration)
 *
 * Handles background check workflow:
 * - Initiating checks via Checkr API
 * - Processing webhooks
 * - Reviewing results
 * - Advancing vetting pipeline
 */

import { prisma } from '@skillancer/database';
import type { ExecutiveProfile, BackgroundCheckStatus } from '../types/prisma-shim.js';
import { getConfig } from '../config/index.js';

// Types
interface CheckrCandidate {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface CheckrReport {
  id: string;
  status: string;
  result: string | null;
  completed_at: string | null;
  turnaround_time: number | null;
}

interface CheckrWebhookEvent {
  type: string;
  data: {
    object: {
      id: string;
      [key: string]: any;
    };
  };
}

// Checkr package types
type CheckrPackage = 'tasker_standard' | 'driver_standard' | 'executive_pro';

/**
 * Initiate background check for an executive
 */
export async function initiateBackgroundCheck(
  executiveId: string
): Promise<ExecutiveProfile> {
  const config = getConfig();

  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
    include: {
      user: true,
    },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  if (profile.backgroundCheckStatus !== 'NOT_STARTED') {
    throw new Error('Background check already initiated');
  }

  if (!config.checkrApiKey) {
    // For development/testing without Checkr
    console.warn('Checkr API key not configured - skipping background check');
    return prisma.executiveProfile.update({
      where: { id: executiveId },
      data: {
        backgroundCheckStatus: 'PENDING',
        vettingNotes: 'Background check pending - Checkr not configured',
      },
    });
  }

  try {
    // Step 1: Create Checkr candidate
    const candidate = await createCheckrCandidate({
      email: profile.user.email,
      first_name: profile.user.firstName,
      last_name: profile.user.lastName,
    });

    // Step 2: Create invitation for the candidate
    const invitation = await createCheckrInvitation(candidate.id, 'executive_pro');

    // Update profile with Checkr reference
    const updated = await prisma.executiveProfile.update({
      where: { id: executiveId },
      data: {
        backgroundCheckStatus: 'PENDING',
        backgroundCheckId: candidate.id,
      },
    });

    // Log vetting event
    await prisma.vettingEvent.create({
      data: {
        executiveId,
        eventType: 'BACKGROUND_CHECK_INITIATED',
        actorType: 'system',
        description: 'Background check initiated via Checkr',
        metadata: {
          candidateId: candidate.id,
          invitationId: invitation.id,
        },
      },
    });

    // TODO: Send email to executive with consent/info link

    return updated;
  } catch (error) {
    console.error('Failed to initiate background check:', error);

    await prisma.executiveProfile.update({
      where: { id: executiveId },
      data: {
        backgroundCheckStatus: 'REQUIRES_REVIEW',
        vettingNotes: `Background check initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    });

    throw error;
  }
}

/**
 * Handle Checkr webhook events
 */
export async function handleCheckrWebhook(event: CheckrWebhookEvent): Promise<void> {
  const config = getConfig();

  console.log('Received Checkr webhook:', event.type);

  switch (event.type) {
    case 'candidate.created':
      // Candidate record created - no action needed
      break;

    case 'invitation.completed':
      // Candidate has completed the invitation flow
      await handleInvitationCompleted(event.data.object.id);
      break;

    case 'report.created':
      // Report processing has started
      await handleReportCreated(event.data.object.id);
      break;

    case 'report.completed':
      // Report is complete - process results
      await handleReportCompleted(event.data.object);
      break;

    case 'report.suspended':
      // Report needs manual review
      await handleReportSuspended(event.data.object);
      break;

    default:
      console.log('Unhandled Checkr webhook type:', event.type);
  }
}

/**
 * Handle invitation completed
 */
async function handleInvitationCompleted(invitationId: string): Promise<void> {
  // The candidate has submitted their information
  // Status will change once report is created
  console.log('Checkr invitation completed:', invitationId);
}

/**
 * Handle report created
 */
async function handleReportCreated(reportId: string): Promise<void> {
  // Find the executive by report/candidate ID
  // For now, we'll need to look up by the stored backgroundCheckId
  console.log('Checkr report created:', reportId);
}

/**
 * Handle report completed
 */
async function handleReportCompleted(report: any): Promise<void> {
  // Find executive by candidate ID
  const profile = await prisma.executiveProfile.findFirst({
    where: { backgroundCheckId: report.candidate_id },
  });

  if (!profile) {
    console.warn('No executive found for Checkr candidate:', report.candidate_id);
    return;
  }

  const result = report.result; // 'clear', 'consider', 'adverse_action'
  const status: BackgroundCheckStatus = result === 'clear' ? 'PASSED' : 'REQUIRES_REVIEW';

  await prisma.executiveProfile.update({
    where: { id: profile.id },
    data: {
      backgroundCheckStatus: status,
      backgroundCheckDate: new Date(),
      vettingNotes: `Background check ${result}`,
    },
  });

  // Log event
  await prisma.vettingEvent.create({
    data: {
      executiveId: profile.id,
      eventType: status === 'PASSED' ? 'BACKGROUND_CHECK_COMPLETED' : 'BACKGROUND_CHECK_FAILED',
      actorType: 'system',
      description: `Background check completed with result: ${result}`,
      metadata: { reportId: report.id, result },
    },
  });

  // Advance vetting if clear
  if (status === 'PASSED' && profile.vettingStage === 'BACKGROUND_CHECK') {
    await prisma.executiveProfile.update({
      where: { id: profile.id },
      data: { vettingStage: 'FINAL_REVIEW' },
    });

    await prisma.vettingEvent.create({
      data: {
        executiveId: profile.id,
        eventType: 'STAGE_ADVANCED',
        fromStage: 'BACKGROUND_CHECK',
        toStage: 'FINAL_REVIEW',
        actorType: 'system',
        description: 'Background check passed, moved to final review',
      },
    });
  }
}

/**
 * Handle report suspended (needs manual review)
 */
async function handleReportSuspended(report: any): Promise<void> {
  const profile = await prisma.executiveProfile.findFirst({
    where: { backgroundCheckId: report.candidate_id },
  });

  if (!profile) {
    return;
  }

  await prisma.executiveProfile.update({
    where: { id: profile.id },
    data: {
      backgroundCheckStatus: 'REQUIRES_REVIEW',
      vettingNotes: 'Background check requires manual review',
    },
  });

  await prisma.vettingEvent.create({
    data: {
      executiveId: profile.id,
      eventType: 'BACKGROUND_CHECK_FAILED',
      actorType: 'system',
      description: 'Background check suspended - requires manual review',
      metadata: { reportId: report.id },
    },
  });
}

/**
 * Review background check result (admin action)
 */
export async function reviewBackgroundCheck(
  executiveId: string,
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO',
  adminId: string,
  notes?: string
): Promise<ExecutiveProfile> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  if (profile.backgroundCheckStatus !== 'REQUIRES_REVIEW') {
    throw new Error('Background check is not in review status');
  }

  let newStatus: BackgroundCheckStatus;
  let newVettingStatus = profile.vettingStatus;
  let newVettingStage = profile.vettingStage;

  switch (decision) {
    case 'APPROVE':
      newStatus = 'PASSED';
      newVettingStage = 'FINAL_REVIEW';
      break;

    case 'REJECT':
      newStatus = 'FAILED';
      newVettingStatus = 'REJECTED';
      break;

    case 'REQUEST_INFO':
      newStatus = 'REQUIRES_REVIEW';
      // Status unchanged, admin needs to follow up
      break;
  }

  const updated = await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      backgroundCheckStatus: newStatus,
      vettingStatus: newVettingStatus,
      vettingStage: newVettingStage,
      vettingNotes: notes,
    },
  });

  // Log event
  await prisma.vettingEvent.create({
    data: {
      executiveId,
      eventType: decision === 'APPROVE' ? 'BACKGROUND_CHECK_COMPLETED' : 'BACKGROUND_CHECK_FAILED',
      actorId: adminId,
      actorType: 'admin',
      description: `Background check review: ${decision}`,
      notes,
    },
  });

  return updated;
}

/**
 * Get background check status
 */
export async function getBackgroundCheckStatus(
  executiveId: string
): Promise<{
  status: BackgroundCheckStatus;
  date: Date | null;
  checkrId: string | null;
}> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
    select: {
      backgroundCheckStatus: true,
      backgroundCheckDate: true,
      backgroundCheckId: true,
    },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  return {
    status: profile.backgroundCheckStatus,
    date: profile.backgroundCheckDate,
    checkrId: profile.backgroundCheckId,
  };
}

// =============================================================================
// Checkr API Helpers (would be replaced with actual API calls)
// =============================================================================

async function createCheckrCandidate(data: {
  email: string;
  first_name: string;
  last_name: string;
}): Promise<CheckrCandidate> {
  const config = getConfig();

  // In production, this would call the Checkr API
  // POST https://api.checkr.com/v1/candidates
  // Headers: Authorization: Basic base64(api_key:)

  if (config.checkrEnvironment === 'sandbox') {
    // Mock response for sandbox/testing
    return {
      id: `cand_${Date.now()}`,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
    };
  }

  const response = await fetch('https://api.checkr.com/v1/candidates', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${config.checkrApiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Checkr API error: ${response.status}`);
  }

  return response.json();
}

async function createCheckrInvitation(
  candidateId: string,
  packageName: CheckrPackage
): Promise<{ id: string; url: string }> {
  const config = getConfig();

  if (config.checkrEnvironment === 'sandbox') {
    // Mock response for sandbox/testing
    return {
      id: `inv_${Date.now()}`,
      url: `https://checkr.com/invitations/mock_${Date.now()}`,
    };
  }

  const response = await fetch('https://api.checkr.com/v1/invitations', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${config.checkrApiKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      candidate_id: candidateId,
      package: packageName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Checkr API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Verify Checkr webhook signature
 */
export function verifyCheckrWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const config = getConfig();

  if (!config.checkrWebhookSecret) {
    console.warn('Checkr webhook secret not configured');
    return config.nodeEnv === 'development'; // Allow in dev
  }

  // Checkr uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', config.checkrWebhookSecret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
