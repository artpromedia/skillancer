/**
 * Vetting Pipeline Service
 *
 * Orchestrates the multi-stage executive vetting process:
 * 1. APPLICATION - Initial application submitted
 * 2. AUTOMATED_SCREENING - LinkedIn verification, experience check
 * 3. INTERVIEW_SCHEDULED - Interview scheduled with recruiter
 * 4. INTERVIEW_COMPLETED - Interview conducted and scored
 * 5. REFERENCE_CHECK - Professional references verified
 * 6. BACKGROUND_CHECK - Background check completed
 * 7. FINAL_REVIEW - Admin final approval
 * 8. COMPLETE - Vetting complete, profile searchable
 */

import { prisma } from '@skillancer/database';
import type {
  ExecutiveProfile,
  VettingStage,
  VettingStatus,
  VettingInterview,
  InterviewType,
  InterviewRecommendation,
  InterviewStatus,
} from '../types/prisma-shim.js';
import { getConfig } from '../config/index.js';

// Types
interface ScreeningResult {
  score: number;
  passed: boolean;
  reasons: string[];
  details: {
    linkedinScore: number;
    experienceScore: number;
    titleScore: number;
    profileCompletenessScore: number;
  };
}

interface InterviewInput {
  scheduledAt: Date;
  interviewer: string;
  interviewerName?: string;
  interviewType: InterviewType;
  duration?: number;
  meetingUrl?: string;
}

interface InterviewOutcomeInput {
  conductedAt: Date;
  actualDuration?: number;
  communicationScore?: number;
  leadershipScore?: number;
  technicalExpertiseScore?: number;
  strategicThinkingScore?: number;
  cultureFitScore?: number;
  executivePresenceScore?: number;
  recommendation: InterviewRecommendation;
  notes?: string;
  strengthsObserved?: string[];
  concernsNoted?: string[];
  recordingUrl?: string;
}

// Valid stage transitions
const VALID_TRANSITIONS: Record<VettingStage, VettingStage[]> = {
  APPLICATION: ['AUTOMATED_SCREENING'],
  AUTOMATED_SCREENING: ['INTERVIEW_SCHEDULED'],
  INTERVIEW_SCHEDULED: ['INTERVIEW_COMPLETED'],
  INTERVIEW_COMPLETED: ['REFERENCE_CHECK'],
  REFERENCE_CHECK: ['BACKGROUND_CHECK'],
  BACKGROUND_CHECK: ['FINAL_REVIEW'],
  FINAL_REVIEW: ['COMPLETE'],
  COMPLETE: [],
};

/**
 * Initialize vetting pipeline for an executive
 */
export async function initializeVetting(executiveId: string): Promise<ExecutiveProfile> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  if (profile.vettingStatus !== 'PENDING') {
    throw new Error('Vetting already initialized');
  }

  // Update to IN_REVIEW status
  const updated = await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      vettingStatus: 'IN_REVIEW',
      vettingStage: 'APPLICATION',
      vettingStartedAt: new Date(),
    },
  });

  // Log event
  await logVettingEvent(executiveId, {
    eventType: 'SCREENING_STARTED',
    fromStage: 'APPLICATION',
    toStage: 'APPLICATION',
    fromStatus: 'PENDING',
    toStatus: 'IN_REVIEW',
    actorType: 'system',
    description: 'Vetting pipeline initialized',
  });

  // Trigger automated screening
  const screeningResult = await runAutomatedScreening(executiveId);

  // Auto-advance or queue for review based on score
  const config = getConfig();
  if (screeningResult.score >= config.vettingAutoAdvanceScore) {
    await advanceVettingStage(executiveId, 'AUTOMATED_SCREENING', 'Auto-advanced: high screening score');
  } else if (screeningResult.score < config.vettingMinScreeningScore) {
    await rejectExecutive(executiveId, 'AUTOMATED_SCREENING', 'Did not meet minimum screening requirements');
  }
  // Otherwise, wait for manual review

  return updated;
}

/**
 * Run automated screening checks
 */
export async function runAutomatedScreening(executiveId: string): Promise<ScreeningResult> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
    include: {
      user: true,
      executiveHistory: true,
    },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  const reasons: string[] = [];
  let totalScore = 0;

  // LinkedIn score (25 points)
  let linkedinScore = 0;
  if (profile.linkedinVerified) {
    linkedinScore = 25;
    reasons.push('LinkedIn profile verified');
  } else if (profile.linkedinUrl) {
    linkedinScore = 10;
    reasons.push('LinkedIn URL provided but not verified');
  } else {
    reasons.push('No LinkedIn profile provided');
  }

  // Experience score (25 points)
  let experienceScore = 0;
  if (profile.yearsExecutiveExp >= 10) {
    experienceScore = 25;
    reasons.push(`${profile.yearsExecutiveExp} years executive experience`);
  } else if (profile.yearsExecutiveExp >= 5) {
    experienceScore = 20;
    reasons.push(`${profile.yearsExecutiveExp} years executive experience`);
  } else if (profile.yearsExecutiveExp >= 3) {
    experienceScore = 15;
    reasons.push(`${profile.yearsExecutiveExp} years executive experience (minimum met)`);
  } else {
    experienceScore = 5;
    reasons.push(`Insufficient executive experience: ${profile.yearsExecutiveExp} years`);
  }

  // Title score (25 points) - based on executive history
  let titleScore = 0;
  const cLevelTitles = profile.executiveHistory.filter((h) =>
    /^(Chief|C[A-Z]O|VP|Vice President|Director|Head of)/i.test(h.title)
  );
  if (cLevelTitles.length >= 3) {
    titleScore = 25;
    reasons.push(`${cLevelTitles.length} executive-level positions`);
  } else if (cLevelTitles.length >= 2) {
    titleScore = 20;
    reasons.push(`${cLevelTitles.length} executive-level positions`);
  } else if (cLevelTitles.length >= 1) {
    titleScore = 15;
    reasons.push(`${cLevelTitles.length} executive-level position`);
  } else {
    reasons.push('No verifiable executive-level positions');
  }

  // Profile completeness score (25 points)
  let profileCompletenessScore = 0;
  if (profile.profileCompleteness >= 80) {
    profileCompletenessScore = 25;
    reasons.push('Profile is well-completed');
  } else if (profile.profileCompleteness >= 60) {
    profileCompletenessScore = 20;
    reasons.push('Profile is mostly complete');
  } else if (profile.profileCompleteness >= 40) {
    profileCompletenessScore = 15;
    reasons.push('Profile needs more detail');
  } else {
    profileCompletenessScore = 5;
    reasons.push('Profile is incomplete');
  }

  totalScore = linkedinScore + experienceScore + titleScore + profileCompletenessScore;

  const result: ScreeningResult = {
    score: totalScore,
    passed: totalScore >= getConfig().vettingMinScreeningScore,
    reasons,
    details: {
      linkedinScore,
      experienceScore,
      titleScore,
      profileCompletenessScore,
    },
  };

  // Store screening result
  await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      vettingScore: totalScore,
      vettingNotes: JSON.stringify(result),
    },
  });

  // Log event
  await logVettingEvent(executiveId, {
    eventType: result.passed ? 'SCREENING_PASSED' : 'SCREENING_FAILED',
    actorType: 'system',
    description: `Automated screening completed with score ${totalScore}/100`,
    metadata: result,
  });

  return result;
}

/**
 * Advance executive to next vetting stage
 */
export async function advanceVettingStage(
  executiveId: string,
  newStage: VettingStage,
  notes?: string
): Promise<ExecutiveProfile> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  // Validate transition
  const validNextStages = VALID_TRANSITIONS[profile.vettingStage];
  if (!validNextStages.includes(newStage)) {
    throw new Error(
      `Invalid stage transition: ${profile.vettingStage} -> ${newStage}. Valid: ${validNextStages.join(', ')}`
    );
  }

  const updated = await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      vettingStage: newStage,
      vettingNotes: notes,
    },
  });

  // Log event
  await logVettingEvent(executiveId, {
    eventType: 'STAGE_ADVANCED',
    fromStage: profile.vettingStage,
    toStage: newStage,
    actorType: 'admin',
    description: `Advanced from ${profile.vettingStage} to ${newStage}`,
    notes,
  });

  // Trigger stage-specific actions
  await handleStageTransition(executiveId, profile.vettingStage, newStage);

  return updated;
}

/**
 * Handle stage-specific actions after transition
 */
async function handleStageTransition(
  executiveId: string,
  fromStage: VettingStage,
  toStage: VettingStage
): Promise<void> {
  switch (toStage) {
    case 'INTERVIEW_SCHEDULED':
      // TODO: Send interview invitation email
      break;

    case 'REFERENCE_CHECK':
      // TODO: Send reference request emails
      break;

    case 'BACKGROUND_CHECK':
      // TODO: Initiate Checkr background check
      break;

    case 'COMPLETE':
      // Make profile searchable
      await prisma.executiveProfile.update({
        where: { id: executiveId },
        data: {
          vettingStatus: 'APPROVED',
          vettingCompletedAt: new Date(),
          searchable: true,
        },
      });
      // TODO: Send approval email
      break;
  }
}

/**
 * Schedule an interview
 */
export async function scheduleInterview(
  executiveId: string,
  input: InterviewInput
): Promise<VettingInterview> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  const interview = await prisma.vettingInterview.create({
    data: {
      executiveId,
      scheduledAt: input.scheduledAt,
      interviewer: input.interviewer,
      interviewerName: input.interviewerName,
      interviewType: input.interviewType,
      duration: input.duration ?? 45,
      meetingUrl: input.meetingUrl,
      status: 'SCHEDULED',
    },
  });

  // Advance stage if not already
  if (profile.vettingStage === 'AUTOMATED_SCREENING') {
    await advanceVettingStage(executiveId, 'INTERVIEW_SCHEDULED', 'Interview scheduled');
  }

  // Log event
  await logVettingEvent(executiveId, {
    eventType: 'INTERVIEW_SCHEDULED',
    actorId: input.interviewer,
    actorType: 'admin',
    description: `${input.interviewType} interview scheduled for ${input.scheduledAt.toISOString()}`,
    metadata: { interviewId: interview.id },
  });

  return interview;
}

/**
 * Record interview outcome
 */
export async function recordInterviewOutcome(
  interviewId: string,
  input: InterviewOutcomeInput
): Promise<VettingInterview> {
  const interview = await prisma.vettingInterview.findUnique({
    where: { id: interviewId },
  });

  if (!interview) {
    throw new Error('Interview not found');
  }

  // Calculate overall score
  const scores = [
    input.communicationScore,
    input.leadershipScore,
    input.technicalExpertiseScore,
    input.strategicThinkingScore,
    input.cultureFitScore,
    input.executivePresenceScore,
  ].filter((s): s is number => s !== undefined);

  const overallScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10)
    : undefined;

  const updated = await prisma.vettingInterview.update({
    where: { id: interviewId },
    data: {
      status: 'COMPLETED',
      conductedAt: input.conductedAt,
      actualDuration: input.actualDuration,
      communicationScore: input.communicationScore,
      leadershipScore: input.leadershipScore,
      technicalExpertiseScore: input.technicalExpertiseScore,
      strategicThinkingScore: input.strategicThinkingScore,
      cultureFitScore: input.cultureFitScore,
      executivePresenceScore: input.executivePresenceScore,
      overallScore,
      recommendation: input.recommendation,
      notes: input.notes,
      strengthsObserved: input.strengthsObserved || [],
      concernsNoted: input.concernsNoted || [],
      recordingUrl: input.recordingUrl,
    },
  });

  // Log event
  await logVettingEvent(interview.executiveId, {
    eventType: 'INTERVIEW_COMPLETED',
    actorId: interview.interviewer,
    actorType: 'admin',
    description: `Interview completed with recommendation: ${input.recommendation}`,
    metadata: {
      interviewId,
      overallScore,
      recommendation: input.recommendation,
    },
  });

  // Handle recommendation
  if (input.recommendation === 'STRONG_NO' || input.recommendation === 'NO') {
    await rejectExecutive(
      interview.executiveId,
      'INTERVIEW_COMPLETED',
      `Interview recommendation: ${input.recommendation}`
    );
  } else if (input.recommendation === 'STRONG_YES' || input.recommendation === 'YES') {
    await advanceVettingStage(
      interview.executiveId,
      'INTERVIEW_COMPLETED',
      `Interview passed: ${input.recommendation}`
    );
  }
  // MAYBE requires manual decision

  return updated;
}

/**
 * Mark interview as no-show
 */
export async function markInterviewNoShow(interviewId: string): Promise<VettingInterview> {
  const interview = await prisma.vettingInterview.update({
    where: { id: interviewId },
    data: { status: 'NO_SHOW' },
  });

  await logVettingEvent(interview.executiveId, {
    eventType: 'INTERVIEW_NO_SHOW',
    actorType: 'system',
    description: 'Executive did not attend scheduled interview',
    metadata: { interviewId },
  });

  return interview;
}

/**
 * Reject an executive application
 */
export async function rejectExecutive(
  executiveId: string,
  stage: VettingStage,
  reason: string
): Promise<ExecutiveProfile> {
  const profile = await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      vettingStatus: 'REJECTED',
      vettingNotes: reason,
      searchable: false,
    },
  });

  await logVettingEvent(executiveId, {
    eventType: 'REJECTED',
    fromStatus: 'IN_REVIEW',
    toStatus: 'REJECTED',
    actorType: 'admin',
    description: `Application rejected at ${stage}: ${reason}`,
    notes: reason,
  });

  // TODO: Send rejection email

  return profile;
}

/**
 * Approve an executive (final approval)
 */
export async function approveExecutive(
  executiveId: string,
  notes?: string,
  featured?: boolean
): Promise<ExecutiveProfile> {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  if (profile.vettingStage !== 'FINAL_REVIEW') {
    throw new Error('Executive must be in FINAL_REVIEW stage for approval');
  }

  const updated = await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: {
      vettingStatus: 'APPROVED',
      vettingStage: 'COMPLETE',
      vettingCompletedAt: new Date(),
      vettingNotes: notes,
      searchable: true,
      featuredExecutive: featured ?? false,
    },
  });

  await logVettingEvent(executiveId, {
    eventType: 'APPROVED',
    fromStatus: 'IN_REVIEW',
    toStatus: 'APPROVED',
    toStage: 'COMPLETE',
    actorType: 'admin',
    description: 'Executive approved and profile made searchable',
    notes,
  });

  // TODO: Send approval email
  // TODO: Trigger onboarding flow

  return updated;
}

/**
 * Get vetting pipeline overview
 */
export async function getVettingPipeline(
  filters?: {
    stage?: VettingStage;
    status?: VettingStatus;
    assignedReviewer?: string;
  },
  page: number = 1,
  pageSize: number = 20
) {
  const where: any = {
    vettingStatus: { in: ['PENDING', 'IN_REVIEW'] },
  };

  if (filters?.stage) {
    where.vettingStage = filters.stage;
  }

  if (filters?.status) {
    where.vettingStatus = filters.status;
  }

  if (filters?.assignedReviewer) {
    where.assignedReviewer = filters.assignedReviewer;
  }

  const [executives, total] = await Promise.all([
    prisma.executiveProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            executiveHistory: true,
            references: true,
            interviews: true,
          },
        },
      },
      orderBy: { vettingStartedAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.executiveProfile.count({ where }),
  ]);

  // Calculate days in current stage
  const executivesWithMetrics = executives.map((exec) => ({
    ...exec,
    daysInStage: exec.vettingStartedAt
      ? Math.floor((Date.now() - exec.vettingStartedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  }));

  return {
    executives: executivesWithMetrics,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get full vetting details for an executive
 */
export async function getVettingDetails(executiveId: string) {
  const profile = await prisma.executiveProfile.findUnique({
    where: { id: executiveId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      executiveHistory: {
        orderBy: { startDate: 'desc' },
      },
      references: true,
      interviews: {
        orderBy: { scheduledAt: 'desc' },
      },
      vettingEvents: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!profile) {
    throw new Error('Executive profile not found');
  }

  return profile;
}

/**
 * Assign reviewer to executive
 */
export async function assignReviewer(
  executiveId: string,
  reviewerId: string
): Promise<ExecutiveProfile> {
  const updated = await prisma.executiveProfile.update({
    where: { id: executiveId },
    data: { assignedReviewer: reviewerId },
  });

  await logVettingEvent(executiveId, {
    eventType: 'REVIEWER_ASSIGNED',
    actorId: reviewerId,
    actorType: 'admin',
    description: `Reviewer assigned`,
  });

  return updated;
}

/**
 * Helper: Log vetting event
 */
async function logVettingEvent(
  executiveId: string,
  event: {
    eventType: string;
    fromStage?: VettingStage;
    toStage?: VettingStage;
    fromStatus?: VettingStatus;
    toStatus?: VettingStatus;
    actorId?: string;
    actorType: string;
    description: string;
    notes?: string;
    metadata?: any;
  }
): Promise<void> {
  await prisma.vettingEvent.create({
    data: {
      executiveId,
      eventType: event.eventType as any,
      fromStage: event.fromStage,
      toStage: event.toStage,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorId: event.actorId,
      actorType: event.actorType,
      description: event.description,
      notes: event.notes,
      metadata: event.metadata,
    },
  });
}
