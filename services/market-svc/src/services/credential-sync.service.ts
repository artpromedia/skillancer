// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/require-await */
/**
 * @module @skillancer/market-svc/services/credential-sync
 * SkillPod Credential Sync Service
 *
 * Handles credential synchronization from SkillPod to Market,
 * including skill verification, confidence calculation, and cache management.
 *
 * NOTE: ESLint disabled for Prisma type errors - will be resolved after database migration
 */

import {
  VerifiedCredentialRepository,
  type CreateCredentialData,
} from '../repositories/credential.repository.js';
import { LearningActivityRepository } from '../repositories/learning-activity.repository.js';
import {
  SkillConfidenceRepository,
  type UpsertSkillConfidenceData,
} from '../repositories/skill-confidence.repository.js';
import {
  SkillVerificationRepository,
  type UpsertSkillVerificationData,
} from '../repositories/skill-verification.repository.js';

import type { PrismaClient, VerifiedCredential, SkillConfidence } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';
import type {
  CredentialEarnedEvent,
  CredentialRevokedEvent,
  CredentialRenewedEvent,
  SkillAssessmentCompletedEvent,
  LearningProgressEvent,
  PublicCredential,
  CredentialVerificationResult,
  ConfidenceWeights,
  ProjectStats,
} from '@skillancer/types';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface ConfidenceCalculationInput {
  userId: string;
  skillId: string;
  assessmentScore?: number;
  learningHours?: number;
  coursesCompleted?: number;
  assessmentsPassed?: number;
  endorsementCount?: number;
  projectsCompleted?: number;
  yearsExperience?: number;
  claimedLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
}

export interface ConfidenceCalculationResult {
  overallConfidence: number;
  assessmentScore: number | null;
  learningScore: number | null;
  experienceScore: number | null;
  endorsementScore: number | null;
  projectScore: number | null;
  calculatedLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  levelMatch: boolean;
}

export interface ProfileEnhancementResult {
  credentialsSynced: number;
  skillsVerified: number;
  confidenceUpdated: number;
  learningActivityUpdated: boolean;
}

// =============================================================================
// CONFIDENCE WEIGHTS
// =============================================================================

const CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  assessment: 0.35,
  learning: 0.2,
  experience: 0.2,
  endorsements: 0.1,
  projects: 0.15,
};

// =============================================================================
// CREDENTIAL SYNC SERVICE
// =============================================================================

export class CredentialSyncService {
  private readonly CACHE_PREFIX = 'credential';
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly VERIFICATION_CACHE_TTL = 86400; // 24 hours

  private readonly credentialRepo: VerifiedCredentialRepository;
  private readonly skillVerificationRepo: SkillVerificationRepository;
  private readonly skillConfidenceRepo: SkillConfidenceRepository;
  private readonly learningActivityRepo: LearningActivityRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.credentialRepo = new VerifiedCredentialRepository(prisma);
    this.skillVerificationRepo = new SkillVerificationRepository(prisma);
    this.skillConfidenceRepo = new SkillConfidenceRepository(prisma);
    this.learningActivityRepo = new LearningActivityRepository(prisma);
  }

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  /**
   * Handle credential earned event from SkillPod
   */
  async handleCredentialEarned(event: CredentialEarnedEvent): Promise<VerifiedCredential> {
    this.logger.info('Processing credential earned event', {
      userId: event.payload.userId,
      credentialId: event.payload.credentialId,
      type: event.payload.credentialType,
    });

    const { payload } = event;

    // Map SkillPod skill IDs to Market skill IDs
    const marketSkillIds = await this.mapSkillIds(payload.skillIds);

    // Create or update credential
    const credentialData: CreateCredentialData = {
      userId: payload.userId,
      sourceCredentialId: payload.credentialId,
      source: 'SKILLPOD',
      credentialType: payload.credentialType,
      title: payload.title,
      description: payload.description,
      skillIds: marketSkillIds,
      issueDate: new Date(payload.issuedAt),
      expirationDate: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      syncedAt: new Date(),
      score: payload.score,
      percentile: payload.percentile,
      proficiencyLevel: payload.proficiencyLevel,
      verificationUrl: payload.verificationUrl,
      verificationCode: payload.verificationCode,
      imageUrl: payload.imageUrl,
      badgeUrl: payload.badgeUrl,
      metadata: payload.metadata,
    };

    // Check if credential already exists
    const existing = await this.credentialRepo.findBySourceId(payload.userId, payload.credentialId);

    let credential: VerifiedCredential;
    if (existing) {
      credential = await this.credentialRepo.update(existing.id, {
        score: credentialData.score,
        percentile: credentialData.percentile,
        syncedAt: new Date(),
        expirationDate: credentialData.expirationDate,
        metadata: credentialData.metadata,
      });
    } else {
      credential = await this.credentialRepo.create(credentialData);
    }

    // Create skill verifications for each skill
    if (payload.credentialType === 'ASSESSMENT_PASS' && marketSkillIds.length > 0) {
      await this.createSkillVerifications(
        payload.userId,
        marketSkillIds,
        credential.id,
        payload.score ?? 0,
        payload.percentile,
        payload.proficiencyLevel ?? 'BEGINNER'
      );
    }

    // Recalculate confidence for affected skills
    for (const skillId of marketSkillIds) {
      await this.recalculateSkillConfidence(payload.userId, skillId);
    }

    // Invalidate caches
    await this.invalidateUserCredentialCache(payload.userId);

    // Update profile search index (fire and forget)
    this.updateProfileSearchIndex(payload.userId).catch((err) =>
      this.logger.error('Failed to update profile search index', { error: err })
    );

    this.logger.info('Credential earned processed successfully', {
      credentialId: credential.id,
      userId: payload.userId,
    });

    return credential;
  }

  /**
   * Handle credential revoked event from SkillPod
   */
  async handleCredentialRevoked(event: CredentialRevokedEvent): Promise<void> {
    this.logger.info('Processing credential revoked event', {
      userId: event.payload.userId,
      credentialId: event.payload.credentialId,
      reason: event.payload.reason,
    });

    const { payload } = event;

    // Find the credential
    const credential = await this.credentialRepo.findBySourceId(
      payload.userId,
      payload.credentialId
    );

    if (!credential) {
      this.logger.warn('Credential not found for revocation', {
        userId: payload.userId,
        sourceCredentialId: payload.credentialId,
      });
      return;
    }

    // Update credential status
    await this.credentialRepo.update(credential.id, {
      status: 'REVOKED',
      revokedAt: new Date(payload.revokedAt),
      revocationReason: payload.reason,
    });

    // Deactivate related skill verifications
    for (const skillId of credential.skillIds) {
      await this.skillVerificationRepo.deactivateByCredential(
        payload.userId,
        skillId,
        credential.id
      );

      // Recalculate confidence
      await this.recalculateSkillConfidence(payload.userId, skillId);
    }

    // Invalidate caches
    await this.invalidateUserCredentialCache(payload.userId);

    this.logger.info('Credential revoked processed successfully', {
      credentialId: credential.id,
      userId: payload.userId,
    });
  }

  /**
   * Handle credential renewed event from SkillPod
   */
  async handleCredentialRenewed(event: CredentialRenewedEvent): Promise<void> {
    this.logger.info('Processing credential renewed event', {
      userId: event.payload.userId,
      credentialId: event.payload.credentialId,
    });

    const { payload } = event;

    // Find the credential
    const credential = await this.credentialRepo.findBySourceId(
      payload.userId,
      payload.credentialId
    );

    if (!credential) {
      this.logger.warn('Credential not found for renewal', {
        userId: payload.userId,
        sourceCredentialId: payload.credentialId,
      });
      return;
    }

    // Update credential
    await this.credentialRepo.update(credential.id, {
      status: 'ACTIVE',
      expirationDate: new Date(payload.newExpirationDate),
      syncedAt: new Date(),
    });

    // Invalidate caches
    await this.invalidateUserCredentialCache(payload.userId);

    this.logger.info('Credential renewed processed successfully', {
      credentialId: credential.id,
      userId: payload.userId,
    });
  }

  /**
   * Handle skill assessment completed event from SkillPod
   */
  async handleSkillAssessmentCompleted(event: SkillAssessmentCompletedEvent): Promise<void> {
    this.logger.info('Processing skill assessment completed event', {
      userId: event.payload.userId,
      skillId: event.payload.skillId,
      score: event.payload.score,
    });

    const { payload } = event;

    // Map SkillPod skill ID to Market skill ID
    const [marketSkillId] = await this.mapSkillIds([payload.skillId]);
    if (!marketSkillId) {
      this.logger.warn('Could not map skill ID', { skillPodSkillId: payload.skillId });
      return;
    }

    // Create skill verification
    const verificationData: UpsertSkillVerificationData = {
      userId: payload.userId,
      skillId: marketSkillId,
      verificationType: 'ASSESSMENT',
      score: payload.score,
      maxScore: payload.maxScore,
      percentile: payload.percentile,
      proficiencyLevel: payload.proficiencyLevel,
      confidenceScore: this.calculateAssessmentConfidence(payload.score, payload.maxScore),
      confidenceFactors: {
        scorePercentage: (payload.score / payload.maxScore) * 100,
        proctored: payload.proctored,
        assessmentDuration: payload.assessmentDuration,
        questionsAnswered: payload.questionsAnswered,
      },
      proctored: payload.proctored,
      assessmentDuration: payload.assessmentDuration,
      questionBreakdown: payload.questionBreakdown as Record<string, unknown>,
      verifiedAt: new Date(payload.completedAt),
      validUntil: payload.validUntil ? new Date(payload.validUntil) : undefined,
    };

    await this.skillVerificationRepo.upsert(verificationData);

    // Recalculate skill confidence
    await this.recalculateSkillConfidence(payload.userId, marketSkillId);

    // Invalidate caches
    await this.invalidateUserCredentialCache(payload.userId);

    this.logger.info('Skill assessment processed successfully', {
      userId: payload.userId,
      skillId: marketSkillId,
    });
  }

  /**
   * Handle learning progress event from SkillPod
   */
  async handleLearningProgressUpdated(event: LearningProgressEvent): Promise<void> {
    this.logger.info('Processing learning progress event', {
      userId: event.payload.userId,
      totalHours: event.payload.totalHoursLearned,
    });

    const { payload } = event;

    // Update learning activity
    await this.learningActivityRepo.upsert({
      userId: payload.userId,
      totalHoursLearned: payload.totalHoursLearned,
      totalCourses: payload.totalCourses,
      completedCourses: payload.completedCourses,
      totalAssessments: payload.totalAssessments,
      passedAssessments: payload.passedAssessments,
      currentStreak: payload.currentStreak,
      longestStreak: payload.longestStreak,
      lastLearningDate: payload.lastActivityAt ? new Date(payload.lastActivityAt) : null,
      hoursLast30Days: payload.hoursLast30Days,
      hoursLast90Days: payload.hoursLast90Days,
    });

    // Update confidence for active skills based on learning hours
    if (payload.skillProgress) {
      for (const [skillPodSkillId, progress] of Object.entries(payload.skillProgress)) {
        const [marketSkillId] = await this.mapSkillIds([skillPodSkillId]);
        if (marketSkillId && progress.hoursLearned > 0) {
          await this.updateLearningScoreForSkill(
            payload.userId,
            marketSkillId,
            progress.hoursLearned,
            progress.coursesCompleted
          );
        }
      }
    }

    // Invalidate caches
    await this.invalidateUserCredentialCache(payload.userId);

    this.logger.info('Learning progress processed successfully', {
      userId: payload.userId,
    });
  }

  // =========================================================================
  // CONFIDENCE CALCULATION
  // =========================================================================

  /**
   * Recalculate skill confidence for a user and skill
   */
  async recalculateSkillConfidence(userId: string, skillId: string): Promise<SkillConfidence> {
    this.logger.debug('Recalculating skill confidence', { userId, skillId });

    // Get all data needed for calculation
    const [verifications, existingConfidence, projectStats] = await Promise.all([
      this.skillVerificationRepo.findActiveByUserAndSkill(userId, skillId),
      this.skillConfidenceRepo.findByUserAndSkill(userId, skillId),
      this.getProjectStatsForSkill(userId, skillId),
    ]);

    // Calculate component scores
    const assessmentScore = this.calculateAssessmentComponentScore(verifications);
    const learningScore = existingConfidence
      ? Number(existingConfidence.learningScore) || null
      : null;
    const experienceScore = this.calculateExperienceScore(
      existingConfidence?.yearsExperience ? Number(existingConfidence.yearsExperience) : null
    );
    const endorsementScore = this.calculateEndorsementScore(
      existingConfidence?.endorsementCount ? Number(existingConfidence.endorsementCount) : 0
    );
    const projectScore = this.calculateProjectScore(projectStats);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence({
      assessmentScore,
      learningScore,
      experienceScore,
      endorsementScore,
      projectScore,
    });

    // Determine calculated level
    const calculatedLevel = this.determineLevel(overallConfidence, assessmentScore);

    // Check level match
    const claimedLevel = existingConfidence?.claimedLevel as
      | 'BEGINNER'
      | 'INTERMEDIATE'
      | 'ADVANCED'
      | 'EXPERT'
      | null;
    const levelMatch = !claimedLevel || claimedLevel === calculatedLevel;

    // Calculate trend
    const previousConfidence = existingConfidence
      ? Number(existingConfidence.overallConfidence)
      : 0;
    const confidenceTrend = overallConfidence - previousConfidence;

    // Upsert confidence record
    const confidenceData: UpsertSkillConfidenceData = {
      userId,
      skillId,
      overallConfidence,
      assessmentScore,
      learningScore,
      experienceScore,
      endorsementScore,
      projectScore,
      assessmentsPassed: verifications.filter((v) => v.verificationType === 'ASSESSMENT').length,
      coursesCompleted: existingConfidence?.coursesCompleted
        ? Number(existingConfidence.coursesCompleted)
        : 0,
      hoursLearned: existingConfidence?.hoursLearned ? Number(existingConfidence.hoursLearned) : 0,
      projectsCompleted: projectStats.completed,
      endorsementCount: existingConfidence?.endorsementCount
        ? Number(existingConfidence.endorsementCount)
        : 0,
      yearsExperience: existingConfidence?.yearsExperience
        ? Number(existingConfidence.yearsExperience)
        : null,
      calculatedLevel,
      claimedLevel,
      levelMatch,
      confidenceTrend,
      lastActivityDate: new Date(),
    };

    return this.skillConfidenceRepo.upsert(confidenceData);
  }

  /**
   * Calculate assessment confidence from score
   */
  private calculateAssessmentConfidence(score: number, maxScore: number): number {
    const percentage = (score / maxScore) * 100;
    // Apply a curve: higher scores get exponentially more confidence
    return Math.min(100, Math.round(percentage * (1 + (percentage - 50) / 200)));
  }

  /**
   * Calculate assessment component score from verifications
   */
  private calculateAssessmentComponentScore(
    verifications: Array<{ verificationType: string; score: number; maxScore: number | null }>
  ): number | null {
    const assessmentVerifications = verifications.filter(
      (v) => v.verificationType === 'ASSESSMENT'
    );

    if (assessmentVerifications.length === 0) {
      return null;
    }

    // Use the best assessment score
    const bestScore = Math.max(
      ...assessmentVerifications.map((v) => (v.score / (v.maxScore || 100)) * 100)
    );

    return Math.round(bestScore);
  }

  /**
   * Calculate learning score from hours and courses
   */
  private calculateLearningScore(hoursLearned: number, coursesCompleted: number): number {
    // Hours contribution (up to 50 points for 100+ hours)
    const hoursScore = Math.min(50, (hoursLearned / 100) * 50);

    // Courses contribution (up to 50 points for 10+ courses)
    const coursesScore = Math.min(50, (coursesCompleted / 10) * 50);

    return Math.round(hoursScore + coursesScore);
  }

  /**
   * Calculate experience score from years
   */
  private calculateExperienceScore(yearsExperience: number | null): number | null {
    if (yearsExperience === null) {
      return null;
    }

    // Logarithmic scale: diminishing returns after 5 years
    return Math.round(Math.min(100, Math.log2(yearsExperience + 1) * 30));
  }

  /**
   * Calculate endorsement score from count
   */
  private calculateEndorsementScore(endorsementCount: number): number | null {
    if (endorsementCount === 0) {
      return null;
    }

    // Logarithmic scale: diminishing returns after 20 endorsements
    return Math.round(Math.min(100, Math.log2(endorsementCount + 1) * 20));
  }

  /**
   * Calculate project score from project stats
   */
  private calculateProjectScore(stats: ProjectStats): number | null {
    if (stats.completed === 0) {
      return null;
    }

    // Base score from completed projects (up to 60 points)
    const completedScore = Math.min(60, stats.completed * 10);

    // Bonus for successful projects (up to 30 points)
    const successRate = stats.completed > 0 ? stats.successful / stats.completed : 0;
    const successBonus = successRate * 30;

    // Rating bonus (up to 10 points)
    const ratingBonus = stats.averageRating ? ((stats.averageRating - 3) / 2) * 10 : 0;

    return Math.round(Math.min(100, completedScore + successBonus + ratingBonus));
  }

  /**
   * Calculate overall confidence from component scores
   */
  private calculateOverallConfidence(scores: {
    assessmentScore: number | null;
    learningScore: number | null;
    experienceScore: number | null;
    endorsementScore: number | null;
    projectScore: number | null;
  }): number {
    let totalWeight = 0;
    let weightedSum = 0;

    if (scores.assessmentScore !== null) {
      weightedSum += scores.assessmentScore * CONFIDENCE_WEIGHTS.assessment;
      totalWeight += CONFIDENCE_WEIGHTS.assessment;
    }

    if (scores.learningScore !== null) {
      weightedSum += scores.learningScore * CONFIDENCE_WEIGHTS.learning;
      totalWeight += CONFIDENCE_WEIGHTS.learning;
    }

    if (scores.experienceScore !== null) {
      weightedSum += scores.experienceScore * CONFIDENCE_WEIGHTS.experience;
      totalWeight += CONFIDENCE_WEIGHTS.experience;
    }

    if (scores.endorsementScore !== null) {
      weightedSum += scores.endorsementScore * CONFIDENCE_WEIGHTS.endorsements;
      totalWeight += CONFIDENCE_WEIGHTS.endorsements;
    }

    if (scores.projectScore !== null) {
      weightedSum += scores.projectScore * CONFIDENCE_WEIGHTS.projects;
      totalWeight += CONFIDENCE_WEIGHTS.projects;
    }

    // If we have no data, return 0
    if (totalWeight === 0) {
      return 0;
    }

    // Normalize by total weight used
    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Determine proficiency level from confidence and assessment score
   */
  private determineLevel(
    overallConfidence: number,
    assessmentScore: number | null
  ): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' {
    // Use assessment score if available (more reliable)
    const score = assessmentScore ?? overallConfidence;

    if (score >= 90) return 'EXPERT';
    if (score >= 70) return 'ADVANCED';
    if (score >= 40) return 'INTERMEDIATE';
    return 'BEGINNER';
  }

  // =========================================================================
  // UPDATE HELPERS
  // =========================================================================

  /**
   * Update learning score for a specific skill
   */
  private async updateLearningScoreForSkill(
    userId: string,
    skillId: string,
    hoursLearned: number,
    coursesCompleted: number
  ): Promise<void> {
    const existing = await this.skillConfidenceRepo.findByUserAndSkill(userId, skillId);
    const learningScore = this.calculateLearningScore(hoursLearned, coursesCompleted);

    if (existing) {
      await this.skillConfidenceRepo.update(existing.id, {
        learningScore,
        hoursLearned,
        coursesCompleted,
        lastActivityDate: new Date(),
      });

      // Trigger full recalculation
      await this.recalculateSkillConfidence(userId, skillId);
    }
  }

  /**
   * Create skill verifications from credential
   */
  private async createSkillVerifications(
    userId: string,
    skillIds: string[],
    credentialId: string,
    score: number,
    percentile: number | undefined,
    proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'
  ): Promise<void> {
    const confidenceScore = this.calculateAssessmentConfidence(score, 100);

    for (const skillId of skillIds) {
      await this.skillVerificationRepo.upsert({
        userId,
        skillId,
        verificationType: 'ASSESSMENT',
        credentialId,
        score,
        maxScore: 100,
        percentile,
        proficiencyLevel,
        confidenceScore,
        confidenceFactors: {
          scorePercentage: score,
          fromCredential: true,
        },
        verifiedAt: new Date(),
      });
    }
  }

  // =========================================================================
  // PUBLIC VERIFICATION API
  // =========================================================================

  /**
   * Verify a credential (public API)
   */
  async verifyCredential(
    credentialId: string,
    verificationCode?: string
  ): Promise<CredentialVerificationResult> {
    // Check cache first
    const cacheKey = `${this.CACHE_PREFIX}:verify:${credentialId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CredentialVerificationResult;
    }

    const credential = await this.credentialRepo.findById(credentialId);

    if (!credential) {
      return {
        valid: false,
        credentialId,
        message: 'Credential not found',
      };
    }

    // Verify code if provided
    if (verificationCode && credential.verificationCode !== verificationCode) {
      return {
        valid: false,
        credentialId,
        message: 'Invalid verification code',
      };
    }

    const isExpired = credential.expirationDate && new Date(credential.expirationDate) < new Date();
    const isRevoked = credential.status === 'REVOKED';

    const result: CredentialVerificationResult = {
      valid: credential.status === 'ACTIVE' && !isExpired,
      credentialId: credential.id,
      title: credential.title,
      issueDate: credential.issueDate.toISOString(),
      expirationDate: credential.expirationDate?.toISOString(),
      status: credential.status as 'ACTIVE' | 'EXPIRED' | 'REVOKED',
      credentialType: credential.credentialType as
        | 'COURSE_COMPLETION'
        | 'ASSESSMENT_PASS'
        | 'CERTIFICATION'
        | 'SKILL_BADGE'
        | 'LEARNING_PATH'
        | 'EXTERNAL_CERTIFICATION',
      source: credential.source as 'SKILLPOD' | 'EXTERNAL' | 'MANUAL',
      score: credential.score ? Number(credential.score) : undefined,
      proficiencyLevel: credential.proficiencyLevel as
        | 'BEGINNER'
        | 'INTERMEDIATE'
        | 'ADVANCED'
        | 'EXPERT'
        | undefined,
      message: isRevoked
        ? 'Credential has been revoked'
        : isExpired
          ? 'Credential has expired'
          : 'Credential is valid',
    };

    // Update last verified timestamp
    await this.credentialRepo.update(credential.id, {
      lastVerifiedAt: new Date(),
    });

    // Cache the result
    await this.redis.setex(cacheKey, this.VERIFICATION_CACHE_TTL, JSON.stringify(result));

    return result;
  }

  // =========================================================================
  // QUERY METHODS
  // =========================================================================

  /**
   * Get user credentials with caching
   */
  async getUserCredentials(userId: string): Promise<VerifiedCredential[]> {
    const cacheKey = `${this.CACHE_PREFIX}:user:${userId}:credentials`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as VerifiedCredential[];
    }

    const credentials = await this.credentialRepo.findActiveByUser(userId);

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(credentials));

    return credentials;
  }

  /**
   * Get visible credentials for public profile
   */
  async getVisibleCredentials(userId: string): Promise<PublicCredential[]> {
    const credentials = await this.credentialRepo.findVisibleByUser(userId);

    return credentials.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      credentialType: c.credentialType as
        | 'COURSE_COMPLETION'
        | 'ASSESSMENT_PASS'
        | 'CERTIFICATION'
        | 'SKILL_BADGE'
        | 'LEARNING_PATH'
        | 'EXTERNAL_CERTIFICATION',
      source: c.source as 'SKILLPOD' | 'EXTERNAL' | 'MANUAL',
      issueDate: c.issueDate.toISOString(),
      expirationDate: c.expirationDate?.toISOString(),
      proficiencyLevel: c.proficiencyLevel as
        | 'BEGINNER'
        | 'INTERMEDIATE'
        | 'ADVANCED'
        | 'EXPERT'
        | null,
      imageUrl: c.imageUrl,
      badgeUrl: c.badgeUrl,
      verificationUrl: c.verificationUrl,
      score: c.score ? Number(c.score) : undefined,
      percentile: c.percentile ? Number(c.percentile) : undefined,
    }));
  }

  /**
   * Get user skill confidences
   */
  async getUserSkillConfidences(userId: string): Promise<SkillConfidence[]> {
    const cacheKey = `${this.CACHE_PREFIX}:user:${userId}:confidences`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as SkillConfidence[];
    }

    const confidences = await this.skillConfidenceRepo.findByUser(userId);

    await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(confidences));

    return confidences;
  }

  /**
   * Get learning activity for user
   */
  async getLearningActivity(userId: string) {
    return this.learningActivityRepo.findByUser(userId);
  }

  /**
   * Update credential visibility
   */
  async updateCredentialVisibility(
    credentialId: string,
    userId: string,
    isVisible: boolean,
    displayOrder?: number
  ): Promise<VerifiedCredential | null> {
    const credential = await this.credentialRepo.findById(credentialId);

    if (!credential || credential.userId !== userId) {
      return null;
    }

    const updated = await this.credentialRepo.updateVisibility(
      credentialId,
      isVisible,
      displayOrder
    );

    await this.invalidateUserCredentialCache(userId);

    return updated;
  }

  // =========================================================================
  // BACKGROUND TASKS
  // =========================================================================

  /**
   * Check for expiring credentials and update statuses
   */
  async processExpiringCredentials(): Promise<{ expired: number; expiringSoon: number }> {
    // Find and update expired credentials
    const expiredCredentials = await this.credentialRepo.findExpired();
    let expiredCount = 0;

    for (const credential of expiredCredentials) {
      await this.credentialRepo.update(credential.id, {
        status: 'EXPIRED',
      });

      // Invalidate cache
      await this.invalidateUserCredentialCache(credential.userId);
      expiredCount++;
    }

    // Find credentials expiring in 30 days for notifications
    const expiringCredentials = await this.credentialRepo.findExpiringSoon(30);

    this.logger.info('Processed expiring credentials', {
      expired: expiredCount,
      expiringSoon: expiringCredentials.length,
    });

    return {
      expired: expiredCount,
      expiringSoon: expiringCredentials.length,
    };
  }

  /**
   * Reset stale learning streaks
   */
  async processStaleStreaks(): Promise<number> {
    const staleActivities = await this.learningActivityRepo.getUsersWithActiveStreaks();
    let resetCount = 0;

    for (const activity of staleActivities) {
      await this.learningActivityRepo.resetStreak(activity.userId);
      resetCount++;
    }

    this.logger.info('Reset stale learning streaks', { count: resetCount });

    return resetCount;
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Map SkillPod skill IDs to Market skill IDs
   */
  private async mapSkillIds(skillPodSkillIds: string[]): Promise<string[]> {
    if (skillPodSkillIds.length === 0) return [];

    // Query skills that have the SkillPod mapping in externalMappings
    const skills = await this.prisma.skill.findMany({
      where: {
        OR: skillPodSkillIds.map((id) => ({
          externalMappings: {
            path: ['skillpod'],
            equals: id,
          },
        })),
      },
      select: { id: true },
    });

    return skills.map((s) => s.id);
  }

  /**
   * Get project stats for a skill
   */
  private async getProjectStatsForSkill(userId: string, skillId: string): Promise<ProjectStats> {
    // Get completed projects with this skill
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [
          { clientId: userId },
          {
            bids: {
              some: {
                freelancerId: userId,
                status: 'SELECTED',
              },
            },
          },
        ],
        skills: {
          some: { skillId },
        },
        status: 'COMPLETED',
      },
      select: {
        id: true,
        reviews: {
          where: {
            revieweeId: userId,
            status: 'REVEALED',
          },
          select: {
            overallRating: true,
          },
        },
      },
    });

    const completed = projects.length;
    const ratings = projects
      .flatMap((p) => p.reviews)
      .map((r) => r.overallRating)
      .filter((r) => r !== null);

    return {
      completed,
      successful: ratings.filter((r) => r >= 4).length,
      averageRating:
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    };
  }

  /**
   * Invalidate user credential cache
   */
  private async invalidateUserCredentialCache(userId: string): Promise<void> {
    const patterns = [`${this.CACHE_PREFIX}:user:${userId}:*`, `reputation:summary:${userId}`];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }

  /**
   * Update profile search index
   * This is a placeholder - actual implementation depends on search infrastructure
   */
  private async updateProfileSearchIndex(userId: string): Promise<void> {
    // TODO: Integrate with search service (Elasticsearch/Meilisearch)
    this.logger.debug('Profile search index update requested', { userId });
  }
}

