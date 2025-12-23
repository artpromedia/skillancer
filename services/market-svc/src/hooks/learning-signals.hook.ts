/**
 * @module @skillancer/market-svc/hooks/learning-signals
 * Learning Signals Hook
 *
 * Provides easy-to-use hooks for emitting learning recommendation signals
 * from routes without tightly coupling to the service implementation.
 */

import { getLearningSignalService } from '../services/learning-signals.service.js';

import type {
  SkillLevel,
  SkillImportance,
} from '../messaging/learning-recommendation-events.publisher.js';

// =============================================================================
// TYPES
// =============================================================================

interface JobInfo {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  experienceLevel: string;
  budgetMin?: number;
  budgetMax?: number;
  skills?: Array<{
    skill?: {
      id?: string;
      name?: string;
    };
    importance?: string;
    level?: string;
  }>;
}

interface UserProfileInfo {
  id: string;
  skills?: Array<{
    skill?: {
      id?: string;
      name?: string;
    };
    level?: string;
    yearsExperience?: number;
  }>;
}

// =============================================================================
// SIGNAL HOOKS
// =============================================================================

/**
 * Signal that a job was viewed by a user
 * Call this when GET /projects/:id is accessed
 */
export async function signalJobViewed(
  userId: string | undefined,
  job: JobInfo,
  context: {
    source?: 'search' | 'recommendation' | 'direct' | 'email';
    viewStartTime?: number;
  } = {}
): Promise<void> {
  if (!userId) return;

  const service = getLearningSignalService();
  if (!service) return;

  const viewDuration = context.viewStartTime
    ? Math.floor((Date.now() - context.viewStartTime) / 1000)
    : 0;

  // Transform job skills to expected format
  const requiredSkills = (job.skills || [])
    .filter((s) => s.importance === 'REQUIRED')
    .map((s) => ({
      skillId: s.skill?.id || '',
      skillName: s.skill?.name || '',
      level: (s.level || 'INTERMEDIATE') as SkillLevel,
      importance: 'REQUIRED' as SkillImportance,
    }));

  const preferredSkills = (job.skills || [])
    .filter((s) => s.importance !== 'REQUIRED')
    .map((s) => ({
      skillId: s.skill?.id || '',
      skillName: s.skill?.name || '',
      level: (s.level || 'INTERMEDIATE') as SkillLevel,
      importance: (s.importance || 'PREFERRED') as SkillImportance,
    }));

  const jobInfo = {
    id: job.id,
    title: job.title,
    category: job.category || 'general',
    experienceLevel: job.experienceLevel || 'INTERMEDIATE',
    budgetMin: job.budgetMin,
    budgetMax: job.budgetMax,
    requiredSkills,
    preferredSkills,
  };

  // Only add subcategory if defined (exactOptionalPropertyTypes compatibility)
  if (job.subcategory) {
    Object.assign(jobInfo, { subcategory: job.subcategory });
  }

  await service.signalJobViewed(userId, jobInfo as never, {
    source: context.source || 'direct',
    viewDuration,
  });
}

/**
 * Signal that a user submitted a bid/application
 * Call this when POST /bids is successful
 */
export async function signalBidSubmitted(
  user: UserProfileInfo,
  job: JobInfo,
  bidDetails: {
    proposedRate: number;
    coverLetter: string;
    attachments?: unknown[];
  }
): Promise<void> {
  const service = getLearningSignalService();
  if (!service) return;

  // Transform job skills to expected format
  const requiredSkills = (job.skills || [])
    .filter((s) => s.importance === 'REQUIRED')
    .map((s) => ({
      skillId: s.skill?.id || '',
      skillName: s.skill?.name || '',
      level: (s.level || 'INTERMEDIATE') as SkillLevel,
      importance: 'REQUIRED' as SkillImportance,
    }));

  const preferredSkills = (job.skills || [])
    .filter((s) => s.importance !== 'REQUIRED')
    .map((s) => ({
      skillId: s.skill?.id || '',
      skillName: s.skill?.name || '',
      level: (s.level || 'INTERMEDIATE') as SkillLevel,
      importance: (s.importance || 'PREFERRED') as SkillImportance,
    }));

  // Transform user skills
  const userSkills = (user.skills || []).map((s) => ({
    skillId: s.skill?.id || '',
    skillName: s.skill?.name || '',
    level: (s.level || 'INTERMEDIATE') as SkillLevel,
    yearsExperience: s.yearsExperience || 0,
  }));

  const jobInfo = {
    id: job.id,
    title: job.title,
    category: job.category || 'general',
    experienceLevel: job.experienceLevel || 'INTERMEDIATE',
    budgetMin: job.budgetMin,
    budgetMax: job.budgetMax,
    requiredSkills,
    preferredSkills,
  };

  // Only add subcategory if defined (exactOptionalPropertyTypes compatibility)
  if (job.subcategory) {
    Object.assign(jobInfo, { subcategory: job.subcategory });
  }

  await service.signalJobApplication(
    user.id,
    jobInfo as never,
    {
      userId: user.id,
      skills: userSkills,
    },
    {
      proposalAmount: bidDetails.proposedRate,
      coverLetterLength: bidDetails.coverLetter.length,
      attachmentsCount: bidDetails.attachments?.length || 0,
    }
  );
}

/**
 * Signal bid outcome (accepted, rejected, etc.)
 * Call this when bid status changes
 */
export async function signalBidOutcome(
  userId: string,
  jobId: string,
  outcome: 'HIRED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED',
  details: {
    competitorCount?: number | undefined;
    userRank?: number | undefined;
    rejectionReason?: string | undefined;
    feedback?: string | undefined;
    missingSkills?: string[] | undefined;
  } = {}
): Promise<void> {
  const service = getLearningSignalService();
  if (!service) return;

  await service.signalApplicationOutcome(userId, jobId, outcome, {
    competitorCount: details.competitorCount,
    userRank: details.userRank,
    rejectionReason: details.rejectionReason,
    feedbackReceived: details.feedback,
    missingSkillsMentioned: details.missingSkills,
  });
}

/**
 * Signal skill gap detection
 * Call this when analyzing user profile against job requirements
 */
export async function signalSkillGap(
  userId: string,
  gap: {
    skillId: string;
    skillName: string;
    currentLevel?: SkillLevel | undefined;
    requiredLevel: SkillLevel;
    frequency: number;
    avgSalaryImpact: number;
    topJobsRequiring: string[];
  }
): Promise<void> {
  const service = getLearningSignalService();
  if (!service) return;

  await service.signalSkillGapDetected(userId, gap);
}

/**
 * Signal market trend update
 * Call this from trend analysis workers
 */
export async function signalMarketTrend(
  category: string,
  trend: {
    trendType: 'RISING' | 'STABLE' | 'DECLINING';
    skills: Array<{
      skillId: string;
      skillName: string;
      demandChange: number;
      avgRate: number;
      rateChange: number;
      jobCount: number;
      competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
    }>;
    period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  }
): Promise<void> {
  const service = getLearningSignalService();
  if (!service) return;

  await service.signalMarketTrendUpdate(category, trend);
}
