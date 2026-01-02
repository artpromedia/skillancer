// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/services/recommendation/signal-processor
 * Processes market activity signals and extracts skill gap indicators
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type {
  MarketActivitySignalRepository,
  SkillGapRepository,
  LearningProfileRepository,
  CreateSkillGapInput,
} from '../../repositories/recommendation/index.js';
import type { PrismaClient } from '@prisma/client';
import type {
  JobViewedEvent,
  JobAppliedEvent,
  JobOutcomeEvent,
  ContractCompletedEvent,
  ProfileSkillGapEvent,
  MarketTrendEvent,
  MarketActivityEventPayload,
  SignalType,
  GapType,
  GapPriority,
  ProficiencyLevel,
} from '@skillancer/types';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface SignalProcessorConfig {
  signalDecayRate: number;
  signalExpirationHours: number;
  minSignalStrength: number;
  gapDetectionThreshold: number;
  batchSize: number;
}

export interface ProcessedSignalResult {
  signalId: string;
  detectedGaps: DetectedGap[];
  updatedGaps: string[];
  newSignals: number;
}

export interface DetectedGap {
  skillId: string;
  skillName: string;
  gapType: GapType;
  currentLevel?: ProficiencyLevel;
  requiredLevel: ProficiencyLevel;
  gapScore: number;
  priority: GapPriority;
  detectionMethod: string;
}

export interface SignalProcessor {
  processJobViewedSignal(userId: string, event: JobViewedEvent): Promise<ProcessedSignalResult>;
  processJobAppliedSignal(userId: string, event: JobAppliedEvent): Promise<ProcessedSignalResult>;
  processJobOutcomeSignal(userId: string, event: JobOutcomeEvent): Promise<ProcessedSignalResult>;
  processContractCompletedSignal(
    userId: string,
    event: ContractCompletedEvent
  ): Promise<ProcessedSignalResult>;
  processProfileGapSignal(
    userId: string,
    event: ProfileSkillGapEvent
  ): Promise<ProcessedSignalResult>;
  processMarketTrendSignal(userId: string, event: MarketTrendEvent): Promise<ProcessedSignalResult>;
  processUnprocessedSignals(limit?: number): Promise<ProcessedSignalResult[]>;
  applySignalDecay(): Promise<number>;
  cleanupExpiredSignals(): Promise<number>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: SignalProcessorConfig = {
  signalDecayRate: 0.05, // 5% decay per day
  signalExpirationHours: 720, // 30 days
  minSignalStrength: 0.1,
  gapDetectionThreshold: 0.3,
  batchSize: 100,
};

const SIGNAL_TYPE_WEIGHTS: Record<SignalType, number> = {
  JOB_VIEW: 0.3,
  JOB_APPLICATION: 0.7,
  JOB_REJECTION: 1.0,
  JOB_ACCEPTANCE: 0.8,
  CONTRACT_STARTED: 0.6,
  CONTRACT_COMPLETED: 0.8,
  CLIENT_FEEDBACK: 0.9,
  SKILL_SEARCH: 0.4,
  PROFILE_GAP: 0.9,
  COMPETITOR_ANALYSIS: 0.5,
  MARKET_TREND: 0.6,
  CERTIFICATION_REQUIRED: 0.8,
};

const PROFICIENCY_LEVEL_ORDER: Record<ProficiencyLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export function createSignalProcessor(
  prisma: PrismaClient,
  redis: RedisType,
  signalRepository: MarketActivitySignalRepository,
  skillGapRepository: SkillGapRepository,
  learningProfileRepository: LearningProfileRepository,
  config: Partial<SignalProcessorConfig> = {}
): SignalProcessor {
  const cfg: SignalProcessorConfig = { ...DEFAULT_CONFIG, ...config };

  // ---------------------------------------------------------------------------
  // Helper Functions
  // ---------------------------------------------------------------------------

  function calculateGapScore(
    currentLevel: ProficiencyLevel | undefined,
    requiredLevel: ProficiencyLevel
  ): number {
    const currentOrder = currentLevel ? PROFICIENCY_LEVEL_ORDER[currentLevel] : 0;
    const requiredOrder = PROFICIENCY_LEVEL_ORDER[requiredLevel];
    const gap = requiredOrder - currentOrder;
    return Math.min(1, Math.max(0, gap / 4)); // Normalize to 0-1
  }

  function determineGapPriority(
    gapScore: number,
    marketDemand: number,
    frequency: number
  ): GapPriority {
    const combinedScore = gapScore * 0.4 + marketDemand * 0.4 + Math.min(frequency / 10, 1) * 0.2;

    if (combinedScore >= 0.8) return 'CRITICAL';
    if (combinedScore >= 0.6) return 'HIGH';
    if (combinedScore >= 0.4) return 'MEDIUM';
    if (combinedScore >= 0.2) return 'LOW';
    return 'OPTIONAL';
  }

  function extractSkillGaps(
    requiredSkills: Array<{ skillId: string; skillName: string; requiredLevel: ProficiencyLevel }>,
    userSkills: Map<string, ProficiencyLevel>,
    detectionMethod: string
  ): DetectedGap[] {
    const gaps: DetectedGap[] = [];

    for (const required of requiredSkills) {
      const currentLevel = userSkills.get(required.skillId);
      const gapScore = calculateGapScore(currentLevel, required.requiredLevel);

      if (gapScore >= cfg.gapDetectionThreshold) {
        gaps.push({
          skillId: required.skillId,
          skillName: required.skillName,
          gapType: currentLevel ? 'LEVEL_GAP' : 'MISSING_SKILL',
          currentLevel,
          requiredLevel: required.requiredLevel,
          gapScore,
          priority: determineGapPriority(gapScore, 0.5, 1),
          detectionMethod,
        });
      }
    }

    return gaps;
  }

  async function getUserSkillLevels(userId: string): Promise<Map<string, ProficiencyLevel>> {
    const userSkills = await prisma.userSkill.findMany({
      where: { userId },
      select: { skillId: true, proficiencyLevel: true },
    });

    return new Map(userSkills.map((s) => [s.skillId, s.proficiencyLevel as ProficiencyLevel]));
  }

  async function createOrUpdateGaps(
    learningProfileId: string,
    gaps: DetectedGap[],
    eventId: string
  ): Promise<{ created: string[]; updated: string[] }> {
    const created: string[] = [];
    const updated: string[] = [];

    for (const gap of gaps) {
      const existing = await skillGapRepository.findByProfileAndSkill(
        learningProfileId,
        gap.skillId
      );

      if (existing) {
        // Update existing gap
        await skillGapRepository.addSourceEvent(existing.id, eventId);
        const newGapScore = Math.max(existing.gapScore, gap.gapScore);
        await skillGapRepository.update(existing.id, {
          gapScore: newGapScore,
          priority: gap.priority,
          priorityScore: newGapScore,
          jobFrequency: (existing.jobFrequency ?? 0) + 1,
        });
        updated.push(existing.id);
      } else {
        // Create new gap
        const input: CreateSkillGapInput = {
          learningProfileId,
          skillId: gap.skillId,
          gapType: gap.gapType,
          currentLevel: gap.currentLevel,
          requiredLevel: gap.requiredLevel,
          gapScore: gap.gapScore,
          priority: gap.priority,
          priorityScore: gap.gapScore,
          sourceEventIds: [eventId],
          detectionMethod: gap.detectionMethod,
          jobFrequency: 1,
        };
        const newGap = await skillGapRepository.create(input);
        created.push(newGap.id);
      }
    }

    return { created, updated };
  }

  // ---------------------------------------------------------------------------
  // Signal Processors
  // ---------------------------------------------------------------------------

  async function processJobViewedSignal(
    userId: string,
    event: JobViewedEvent
  ): Promise<ProcessedSignalResult> {
    const profile = await learningProfileRepository.getOrCreate(userId);

    // Create signal
    const signal = await signalRepository.create({
      learningProfileId: profile.id,
      signalType: 'JOB_VIEW',
      signalSource: 'market-svc',
      signalStrength: SIGNAL_TYPE_WEIGHTS.JOB_VIEW,
      sourceId: event.payload.jobId,
      sourceType: 'job',
      skillIds: event.payload.requiredSkills.map((s) => s.skillId),
      requiredLevels: Object.fromEntries(
        event.payload.requiredSkills.map((s) => [s.skillId, s.requiredLevel])
      ),
      contextData: {
        jobTitle: event.payload.jobTitle,
        budget: event.payload.budget,
        viewDuration: event.payload.viewDuration,
        scrollDepth: event.payload.scrollDepth,
        searchContext: event.payload.searchContext,
      },
      expiresAt: new Date(Date.now() + cfg.signalExpirationHours * 60 * 60 * 1000),
    });

    // Extract skill gaps
    const userSkills = await getUserSkillLevels(userId);
    const gaps = extractSkillGaps(event.payload.requiredSkills, userSkills, 'job_view');

    // Create/update gaps
    const { created, updated } = await createOrUpdateGaps(profile.id, gaps, signal.id);

    // Mark signal as processed
    await signalRepository.markProcessed(signal.id, {
      gapsDetected: gaps.length,
      gapsCreated: created.length,
      gapsUpdated: updated.length,
    });

    return {
      signalId: signal.id,
      detectedGaps: gaps,
      updatedGaps: [...created, ...updated],
      newSignals: 1,
    };
  }

  async function processJobAppliedSignal(
    userId: string,
    event: JobAppliedEvent
  ): Promise<ProcessedSignalResult> {
    const profile = await learningProfileRepository.getOrCreate(userId);

    const signal = await signalRepository.create({
      learningProfileId: profile.id,
      signalType: 'JOB_APPLICATION',
      signalSource: 'market-svc',
      signalStrength: SIGNAL_TYPE_WEIGHTS.JOB_APPLICATION,
      sourceId: event.payload.jobId,
      sourceType: 'job_application',
      skillIds: event.payload.requiredSkills.map((s) => s.skillId),
      requiredLevels: Object.fromEntries(
        event.payload.requiredSkills.map((s) => [s.skillId, s.requiredLevel])
      ),
      contextData: {
        jobTitle: event.payload.jobTitle,
        applicationId: event.payload.applicationId,
        coverLetter: event.payload.coverLetterExcerpt,
        proposedRate: event.payload.proposedRate,
      },
      skillGapIndicators: {
        matchedSkills: event.payload.matchedSkills,
        missingSkills: event.payload.missingSkills,
        matchScore: event.payload.matchScore,
      },
      expiresAt: new Date(Date.now() + cfg.signalExpirationHours * 60 * 60 * 1000),
    });

    // Higher weight for missing skills in applications
    const userSkills = await getUserSkillLevels(userId);
    const gaps = extractSkillGaps(
      event.payload.missingSkills.map((s) => ({
        skillId: s.skillId,
        skillName: s.skillName,
        requiredLevel: s.requiredLevel,
      })),
      userSkills,
      'job_application_missing'
    );

    const { created, updated } = await createOrUpdateGaps(profile.id, gaps, signal.id);

    await signalRepository.markProcessed(signal.id, {
      gapsDetected: gaps.length,
      gapsCreated: created.length,
      gapsUpdated: updated.length,
    });

    return {
      signalId: signal.id,
      detectedGaps: gaps,
      updatedGaps: [...created, ...updated],
      newSignals: 1,
    };
  }

  async function processJobOutcomeSignal(
    userId: string,
    event: JobOutcomeEvent
  ): Promise<ProcessedSignalResult> {
    const profile = await learningProfileRepository.getOrCreate(userId);

    const signalType: SignalType =
      event.payload.outcome === 'REJECTED' ? 'JOB_REJECTION' : 'JOB_ACCEPTANCE';

    const signal = await signalRepository.create({
      learningProfileId: profile.id,
      signalType,
      signalSource: 'market-svc',
      signalStrength: SIGNAL_TYPE_WEIGHTS[signalType],
      sourceId: event.payload.applicationId,
      sourceType: 'job_outcome',
      skillIds: event.payload.skillGapFeedback?.map((s) => s.skillId) ?? [],
      contextData: {
        jobId: event.payload.jobId,
        outcome: event.payload.outcome,
        clientFeedback: event.payload.clientFeedback,
        rejectionReason: event.payload.rejectionReason,
      },
      skillGapIndicators: event.payload.skillGapFeedback
        ? { feedback: event.payload.skillGapFeedback }
        : undefined,
      expiresAt: new Date(Date.now() + cfg.signalExpirationHours * 60 * 60 * 1000),
    });

    const gaps: DetectedGap[] = [];

    // Process skill gap feedback from rejection
    if (event.payload.outcome === 'REJECTED' && event.payload.skillGapFeedback) {
      const userSkills = await getUserSkillLevels(userId);
      for (const feedback of event.payload.skillGapFeedback) {
        const currentLevel = userSkills.get(feedback.skillId);
        const gapScore = calculateGapScore(currentLevel, feedback.requiredLevel);

        gaps.push({
          skillId: feedback.skillId,
          skillName: feedback.skillName,
          gapType: currentLevel ? 'LEVEL_GAP' : 'MISSING_SKILL',
          currentLevel,
          requiredLevel: feedback.requiredLevel,
          gapScore: Math.min(1, gapScore * 1.2), // Boost score for rejection
          priority: 'HIGH',
          detectionMethod: 'job_rejection_feedback',
        });
      }
    }

    const { created, updated } = await createOrUpdateGaps(profile.id, gaps, signal.id);

    await signalRepository.markProcessed(signal.id, {
      outcome: event.payload.outcome,
      gapsDetected: gaps.length,
      gapsCreated: created.length,
      gapsUpdated: updated.length,
    });

    return {
      signalId: signal.id,
      detectedGaps: gaps,
      updatedGaps: [...created, ...updated],
      newSignals: 1,
    };
  }

  async function processContractCompletedSignal(
    userId: string,
    event: ContractCompletedEvent
  ): Promise<ProcessedSignalResult> {
    const profile = await learningProfileRepository.getOrCreate(userId);

    const signal = await signalRepository.create({
      learningProfileId: profile.id,
      signalType: 'CONTRACT_COMPLETED',
      signalSource: 'market-svc',
      signalStrength: SIGNAL_TYPE_WEIGHTS.CONTRACT_COMPLETED,
      sourceId: event.payload.contractId,
      sourceType: 'contract',
      skillIds: event.payload.usedSkills.map((s) => s.skillId),
      contextData: {
        projectType: event.payload.projectType,
        clientRating: event.payload.clientRating,
        completionStatus: event.payload.completionStatus,
        earnings: event.payload.earnings,
        duration: event.payload.duration,
      },
      skillGapIndicators: event.payload.skillFeedback
        ? { feedback: event.payload.skillFeedback }
        : undefined,
      expiresAt: new Date(Date.now() + cfg.signalExpirationHours * 60 * 60 * 1000),
    });

    const gaps: DetectedGap[] = [];

    // Analyze client feedback for skill improvements
    if (event.payload.skillFeedback) {
      for (const feedback of event.payload.skillFeedback) {
        if (feedback.needsImprovement) {
          gaps.push({
            skillId: feedback.skillId,
            skillName: feedback.skillName,
            gapType: 'LEVEL_GAP',
            currentLevel: feedback.demonstratedLevel,
            requiredLevel: feedback.expectedLevel,
            gapScore: calculateGapScore(feedback.demonstratedLevel, feedback.expectedLevel),
            priority: 'MEDIUM',
            detectionMethod: 'contract_feedback',
          });
        }
      }
    }

    const { created, updated } = await createOrUpdateGaps(profile.id, gaps, signal.id);

    // Update engagement metrics based on successful completion
    if (event.payload.completionStatus === 'SUCCESS') {
      const completionBonus = 0.1 * (event.payload.clientRating / 5);
      await learningProfileRepository.updateEngagementMetrics(profile.id, {
        completionRate: Math.min(1, (profile.completionRate ?? 0) + completionBonus),
      });
    }

    await signalRepository.markProcessed(signal.id, {
      gapsDetected: gaps.length,
      gapsCreated: created.length,
      gapsUpdated: updated.length,
    });

    return {
      signalId: signal.id,
      detectedGaps: gaps,
      updatedGaps: [...created, ...updated],
      newSignals: 1,
    };
  }

  async function processProfileGapSignal(
    userId: string,
    event: ProfileSkillGapEvent
  ): Promise<ProcessedSignalResult> {
    const profile = await learningProfileRepository.getOrCreate(userId);

    const signal = await signalRepository.create({
      learningProfileId: profile.id,
      signalType: 'PROFILE_GAP',
      signalSource: 'market-svc',
      signalStrength: SIGNAL_TYPE_WEIGHTS.PROFILE_GAP,
      sourceId: event.payload.analysisId,
      sourceType: 'profile_analysis',
      skillIds: event.payload.gaps.map((g) => g.skillId),
      contextData: {
        analysisType: event.payload.analysisType,
        targetRole: event.payload.targetRole,
        competitorCount: event.payload.competitorCount,
      },
      skillGapIndicators: {
        gaps: event.payload.gaps,
        recommendations: event.payload.recommendations,
      },
      expiresAt: new Date(Date.now() + cfg.signalExpirationHours * 60 * 60 * 1000),
    });

    const gaps: DetectedGap[] = event.payload.gaps.map((g) => ({
      skillId: g.skillId,
      skillName: g.skillName,
      gapType: g.gapType,
      currentLevel: g.currentLevel,
      requiredLevel: g.requiredLevel,
      gapScore: g.gapScore,
      priority: g.priority,
      detectionMethod: 'profile_analysis',
    }));

    const { created, updated } = await createOrUpdateGaps(profile.id, gaps, signal.id);

    await signalRepository.markProcessed(signal.id, {
      gapsDetected: gaps.length,
      gapsCreated: created.length,
      gapsUpdated: updated.length,
    });

    return {
      signalId: signal.id,
      detectedGaps: gaps,
      updatedGaps: [...created, ...updated],
      newSignals: 1,
    };
  }

  async function processMarketTrendSignal(
    userId: string,
    event: MarketTrendEvent
  ): Promise<ProcessedSignalResult> {
    const profile = await learningProfileRepository.getOrCreate(userId);

    const signal = await signalRepository.create({
      learningProfileId: profile.id,
      signalType: 'MARKET_TREND',
      signalSource: 'market-svc',
      signalStrength: SIGNAL_TYPE_WEIGHTS.MARKET_TREND,
      sourceId: event.payload.trendId,
      sourceType: 'market_trend',
      skillIds: event.payload.relatedSkillIds,
      contextData: {
        trendType: event.payload.trendType,
        trendDirection: event.payload.direction,
        impactScore: event.payload.impactScore,
        timeframe: event.payload.timeframe,
      },
      marketTrendData: {
        opportunities: event.payload.opportunities,
        risks: event.payload.risks,
        recommendations: event.payload.recommendations,
      },
      expiresAt: new Date(Date.now() + cfg.signalExpirationHours * 60 * 60 * 1000),
    });

    // For trending skills, create gaps for skills user doesn't have
    const userSkills = await getUserSkillLevels(userId);
    const gaps: DetectedGap[] = [];

    for (const opportunity of event.payload.opportunities) {
      if (!userSkills.has(opportunity.skillId)) {
        gaps.push({
          skillId: opportunity.skillId,
          skillName: opportunity.skillName,
          gapType: 'TRENDING_SKILL',
          requiredLevel: 'INTERMEDIATE',
          gapScore: opportunity.opportunityScore,
          priority: opportunity.urgency as GapPriority,
          detectionMethod: 'market_trend',
        });
      }
    }

    const { created, updated } = await createOrUpdateGaps(profile.id, gaps, signal.id);

    await signalRepository.markProcessed(signal.id, {
      gapsDetected: gaps.length,
      gapsCreated: created.length,
      gapsUpdated: updated.length,
    });

    return {
      signalId: signal.id,
      detectedGaps: gaps,
      updatedGaps: [...created, ...updated],
      newSignals: 1,
    };
  }

  async function processUnprocessedSignals(limit = 100): Promise<ProcessedSignalResult[]> {
    const signals = await signalRepository.findUnprocessed(limit);
    const results: ProcessedSignalResult[] = [];

    for (const signal of signals) {
      try {
        // Mark as processed even if no further action needed
        await signalRepository.markProcessed(signal.id, {
          processedAt: new Date(),
          note: 'Batch processed',
        });

        results.push({
          signalId: signal.id,
          detectedGaps: [],
          updatedGaps: [],
          newSignals: 0,
        });
      } catch (error) {
        console.error(`Error processing signal ${signal.id}:`, error);
      }
    }

    return results;
  }

  async function applySignalDecay(): Promise<number> {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    return signalRepository.applyDecay(cfg.signalDecayRate, oneDayAgo);
  }

  async function cleanupExpiredSignals(): Promise<number> {
    return signalRepository.deleteExpired();
  }

  return {
    processJobViewedSignal,
    processJobAppliedSignal,
    processJobOutcomeSignal,
    processContractCompletedSignal,
    processProfileGapSignal,
    processMarketTrendSignal,
    processUnprocessedSignals,
    applySignalDecay,
    cleanupExpiredSignals,
  };
}

