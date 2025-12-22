/**
 * @module @skillancer/types/credential/events
 * Cross-service credential events for SkillPod ↔ Market integration
 */

// =============================================================================
// CREDENTIAL TYPES
// =============================================================================

export type CredentialType =
  | 'COURSE_COMPLETION'
  | 'ASSESSMENT_PASS'
  | 'CERTIFICATION'
  | 'SKILL_BADGE'
  | 'LEARNING_PATH';

export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export type CredentialRevocationReason =
  | 'EXPIRED'
  | 'POLICY_VIOLATION'
  | 'MANUAL_REVOCATION'
  | 'SUPERSEDED';

export type RenewalMethod = 'REASSESSMENT' | 'CONTINUING_EDUCATION' | 'MANUAL';

export type VerificationRequestedBy = 'USER' | 'CLIENT' | 'SYSTEM';

export type VerificationPriority = 'LOW' | 'NORMAL' | 'HIGH';

// =============================================================================
// EVENTS PUBLISHED BY SKILLPOD
// =============================================================================

/**
 * Emitted when a user earns a new credential (course completion, certification, etc.)
 */
export interface CredentialEarnedEvent {
  eventType: 'credential.earned';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    credentialId: string;
    credentialType: CredentialType;
    skillIds: string[];
    title: string;
    description?: string;
    issueDate: Date;
    expirationDate?: Date;
    score?: number;
    percentile?: number;
    metadata: {
      courseId?: string;
      assessmentId?: string;
      learningPathId?: string;
      proctored?: boolean;
      attempts?: number;
      timeSpent?: number; // minutes
      difficulty?: string;
    };
    verificationUrl: string;
    verificationCode: string;
    imageUrl?: string;
    badgeUrl?: string;
  };
}

/**
 * Emitted when a credential is revoked
 */
export interface CredentialRevokedEvent {
  eventType: 'credential.revoked';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    credentialId: string;
    reason: CredentialRevocationReason;
    revokedAt: Date;
  };
}

/**
 * Emitted when a credential is renewed
 */
export interface CredentialRenewedEvent {
  eventType: 'credential.renewed';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    credentialId: string;
    previousExpirationDate: Date;
    newExpirationDate: Date;
    renewalMethod: RenewalMethod;
  };
}

/**
 * Emitted when a user completes a skill assessment
 */
export interface SkillAssessmentCompletedEvent {
  eventType: 'skill.assessment.completed';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    skillId: string;
    skillName: string;
    assessmentId: string;
    score: number;
    maxScore: number;
    percentile: number;
    proficiencyLevel: ProficiencyLevel;
    previousLevel?: ProficiencyLevel;
    confidence: number; // 0-100
    proctored: boolean;
    assessmentDuration: number; // minutes
    questionBreakdown: Array<{
      category: string;
      correct: number;
      total: number;
    }>;
  };
}

/**
 * Emitted when learning progress is updated
 */
export interface LearningProgressEvent {
  eventType: 'learning.progress.updated';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    skillId: string;
    progressPercent: number;
    hoursLearned: number;
    coursesCompleted: number;
    assessmentsPassed: number;
    streakDays: number;
    lastActivityDate: Date;
  };
}

// =============================================================================
// EVENTS CONSUMED BY SKILLPOD (FROM MARKET)
// =============================================================================

/**
 * Emitted when a user adds a skill to their market profile
 */
export interface ProfileSkillAddedEvent {
  eventType: 'profile.skill.added';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    skillId: string;
    skillName: string;
    claimedLevel: ProficiencyLevel;
    yearsExperience?: number;
  };
}

/**
 * Emitted when skill verification is requested
 */
export interface SkillVerificationRequestedEvent {
  eventType: 'skill.verification.requested';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    skillId: string;
    requestedBy: VerificationRequestedBy;
    priority: VerificationPriority;
  };
}

/**
 * Emitted when profile skills are enhanced with credential data
 */
export interface ProfileSkillsEnhancedEvent {
  eventType: 'profile.skills.enhanced';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    skillEnhancements: Array<{
      skillId: string;
      confidence: number;
      level: ProficiencyLevel;
      isVerified: boolean;
    }>;
    credentialCount: number;
    certificationCount: number;
    learningHours: number;
    currentStreak: number;
  };
}

// =============================================================================
// EVENT UNION TYPES
// =============================================================================

export type SkillPodCredentialEvent =
  | CredentialEarnedEvent
  | CredentialRevokedEvent
  | CredentialRenewedEvent
  | SkillAssessmentCompletedEvent
  | LearningProgressEvent;

export type MarketProfileEvent =
  | ProfileSkillAddedEvent
  | SkillVerificationRequestedEvent
  | ProfileSkillsEnhancedEvent;

export type CredentialIntegrationEvent = SkillPodCredentialEvent | MarketProfileEvent;
