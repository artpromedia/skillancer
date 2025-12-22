/**
 * @module @skillancer/types/credential/types
 * Credential and skill verification types
 */

import type { CredentialType, ProficiencyLevel } from './credential.events.js';

// =============================================================================
// CREDENTIAL SOURCE & STATUS
// =============================================================================

export type CredentialSource = 'SKILLPOD' | 'EXTERNAL' | 'MANUAL';

export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING_RENEWAL';

export type VerificationType =
  | 'ASSESSMENT'
  | 'COURSE_COMPLETION'
  | 'CERTIFICATION'
  | 'PEER_ENDORSEMENT'
  | 'CLIENT_REVIEW'
  | 'PROJECT_COMPLETION';

// =============================================================================
// VERIFIED CREDENTIAL
// =============================================================================

export interface VerifiedCredential {
  id: string;
  userId: string;
  freelancerProfileId: string;
  sourceCredentialId: string;
  source: CredentialSource;
  credentialType: CredentialType;
  title: string;
  description?: string;
  skillIds: string[];
  issueDate: Date;
  expirationDate?: Date;
  syncedAt: Date;
  score?: number;
  percentile?: number;
  proficiencyLevel?: ProficiencyLevel;
  verificationUrl: string;
  verificationCode: string;
  isVerified: boolean;
  lastVerifiedAt: Date;
  isVisible: boolean;
  displayOrder: number;
  imageUrl?: string;
  badgeUrl?: string;
  metadata?: Record<string, unknown>;
  status: CredentialStatus;
  revokedAt?: Date;
  revocationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// SKILL VERIFICATION
// =============================================================================

export interface SkillVerification {
  id: string;
  userId: string;
  skillId: string;
  verificationType: VerificationType;
  credentialId?: string;
  score: number;
  maxScore: number;
  percentile?: number;
  proficiencyLevel: ProficiencyLevel;
  confidenceScore: number; // 0-100
  confidenceFactors: Record<string, unknown>;
  proctored: boolean;
  assessmentDuration?: number;
  questionBreakdown?: Record<string, unknown>;
  verifiedAt: Date;
  validUntil?: Date;
  isActive: boolean;
  showOnProfile: boolean;
  showScore: boolean;
  showPercentile: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// SKILL CONFIDENCE
// =============================================================================

export interface SkillConfidence {
  id: string;
  userId: string;
  skillId: string;
  overallConfidence: number; // 0-100
  assessmentScore?: number;
  learningScore?: number;
  experienceScore?: number;
  endorsementScore?: number;
  projectScore?: number;
  assessmentsPassed: number;
  coursesCompleted: number;
  hoursLearned: number;
  projectsCompleted: number;
  endorsementCount: number;
  yearsExperience?: number;
  calculatedLevel: ProficiencyLevel;
  claimedLevel?: ProficiencyLevel;
  levelMatch: boolean;
  confidenceTrend: number;
  lastActivityDate?: Date;
  updatedAt: Date;
}

// =============================================================================
// LEARNING ACTIVITY
// =============================================================================

export interface LearningActivity {
  id: string;
  userId: string;
  totalHoursLearned: number;
  totalCourses: number;
  completedCourses: number;
  totalAssessments: number;
  passedAssessments: number;
  totalCredentials: number;
  activeCredentials: number;
  currentStreak: number;
  longestStreak: number;
  lastLearningDate?: Date;
  hoursLast30Days: number;
  hoursLast90Days: number;
  hoursLast365Days: number;
  showOnProfile: boolean;
  showHours: boolean;
  showStreak: boolean;
  updatedAt: Date;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface PublicCredential {
  id: string;
  title: string;
  type: CredentialType;
  issueDate: Date;
  expirationDate?: Date;
  score?: number;
  percentile?: number;
  proficiencyLevel?: ProficiencyLevel;
  verificationUrl: string;
  badgeUrl?: string;
  isVerified: boolean;
  skills: string[];
}

export interface SkillConfidenceSummary {
  skillId: string;
  skillName: string;
  overallConfidence: number;
  calculatedLevel: ProficiencyLevel;
  claimedLevel?: ProficiencyLevel;
  levelMatch: boolean;
  isVerified: boolean;
  lastActivityDate?: Date;
  components: {
    assessment: number | null;
    learning: number | null;
    experience: number | null;
    projects: number | null;
    endorsements: number | null;
  };
}

export interface CredentialVerificationResult {
  valid: boolean;
  reason?: string;
  credential?: {
    id: string;
    title: string;
    type: CredentialType;
    issueDate: Date;
    expirationDate?: Date;
    score?: number;
    percentile?: number;
    skills: string[];
    verificationUrl: string;
    issuer: string;
  };
  holder?: {
    userId: string;
    name?: string;
    profileUrl?: string;
  };
  verifiedAt?: Date;
  revokedAt?: Date;
  revocationReason?: string;
  expiredAt?: Date;
}

export interface CredentialsSummary {
  totalCredentials: number;
  activeCertifications: number;
  verifiedSkills: number;
  expiringSoon: number;
}

export interface LearningActivitySummary {
  totalHoursLearned: number;
  completedCourses: number;
  passedAssessments: number;
  activeCredentials: number;
  currentStreak: number;
  longestStreak: number;
  hoursLast30Days: number;
  lastLearningDate?: Date;
}

// =============================================================================
// API REQUEST TYPES
// =============================================================================

export interface UpdateCredentialVisibilityRequest {
  isVisible: boolean;
  displayOrder?: number;
}

export interface RequestSkillVerificationResponse {
  verificationUrl: string;
  estimatedDuration: number; // minutes
  prerequisites: string[];
}

// =============================================================================
// CONFIDENCE CALCULATION
// =============================================================================

export interface ConfidenceWeights {
  assessment: number;
  learning: number;
  experience: number;
  project: number;
  endorsement: number;
}

export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  assessment: 0.35,
  learning: 0.2,
  experience: 0.15,
  project: 0.2,
  endorsement: 0.1,
};

export interface ProjectStats {
  completedCount: number;
  avgRating: number | null;
  repeatClientCount: number;
}
