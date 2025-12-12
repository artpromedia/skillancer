/**
 * Trust Score Types
 * Types for the cross-product trust score system
 */

import type {
  TrustTier,
  TrustTrend,
  ComplianceEventType,
  ComplianceSeverity,
  ThresholdContextType,
} from '@skillancer/database';

// ============================================================================
// Component Score Interfaces
// ============================================================================

/**
 * Review data for trust score calculation
 */
export interface ReviewScoreData {
  /** User's average rating (1-5 scale) */
  averageRating: number;
  /** Total number of reviews received */
  totalReviews: number;
  /** Recent reviews (last 90 days) for recency weighting */
  recentReviews: number;
  /** Number of verified transaction reviews */
  verifiedReviews: number;
  /** Review response rate (0-1) */
  responseRate: number;
  /** Average response time in hours */
  avgResponseTime: number;
}

/**
 * SkillPod compliance data for trust score calculation
 */
export interface ComplianceScoreData {
  /** Total SkillPod sessions completed */
  totalSessions: number;
  /** Sessions completed on time */
  onTimeSessions: number;
  /** Sessions with violations */
  violationCount: number;
  /** Severity-weighted violation score */
  severityScore: number;
  /** Recent compliance rate (last 30 days) */
  recentComplianceRate: number;
  /** Compliance events for detailed analysis */
  events: ComplianceEvent[];
}

/**
 * Individual compliance event
 */
export interface ComplianceEvent {
  eventType: ComplianceEventType;
  severity: ComplianceSeverity;
  createdAt: Date;
  isResolved: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Verification data for trust score calculation
 */
export interface VerificationScoreData {
  /** User's verification level (0-4: none, basic, standard, enhanced, premium) */
  verificationLevel: number;
  /** Identity verified */
  identityVerified: boolean;
  /** Email verified */
  emailVerified: boolean;
  /** Phone verified */
  phoneVerified: boolean;
  /** Payment method verified */
  paymentVerified: boolean;
  /** Skills verified count */
  skillsVerified: number;
  /** Total skills claimed */
  totalSkills: number;
  /** Portfolio items verified */
  portfolioVerified: number;
}

/**
 * Platform tenure data for trust score calculation
 */
export interface TenureScoreData {
  /** Account creation date */
  accountCreatedAt: Date;
  /** Days since account creation */
  tenureDays: number;
  /** First completed transaction date */
  firstTransactionAt?: Date | undefined;
  /** Account in good standing (no suspensions) */
  goodStanding: boolean;
  /** Number of account warnings */
  warningCount: number;
}

/**
 * Activity data for trust score calculation
 */
export interface ActivityScoreData {
  /** Last login date */
  lastLoginAt: Date;
  /** Days since last activity */
  daysSinceActivity: number;
  /** Average logins per month */
  avgLoginsPerMonth: number;
  /** Profile completeness (0-1) */
  profileCompleteness: number;
  /** Response rate to messages (0-1) */
  messageResponseRate: number;
  /** Average response time in hours */
  avgMessageResponseTime: number;
}

// ============================================================================
// Trust Score Result Interfaces
// ============================================================================

/**
 * Component scores breakdown
 */
export interface TrustScoreComponents {
  reviewScore: number;
  complianceScore: number;
  verificationScore: number;
  tenureScore: number;
  activityScore: number;
}

/**
 * Component weights for score calculation
 */
export interface TrustScoreWeights {
  reviewWeight: number;
  complianceWeight: number;
  verificationWeight: number;
  tenureWeight: number;
  activityWeight: number;
}

/**
 * Default weights for trust score calculation (as percentages that sum to 100)
 */
export const DEFAULT_TRUST_SCORE_WEIGHTS: TrustScoreWeights = {
  reviewWeight: 40,
  complianceWeight: 25,
  verificationWeight: 20,
  tenureWeight: 10,
  activityWeight: 5,
};

/**
 * Trust score factor explanation
 */
export interface TrustScoreFactor {
  component: keyof TrustScoreComponents;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  value: number;
  maxValue?: number;
}

/**
 * Complete trust score calculation result
 */
export interface TrustScoreResult {
  /** Overall trust score (0-100) */
  overallScore: number;
  /** Previous overall score for trend */
  previousScore?: number | undefined;
  /** Component breakdown */
  components: TrustScoreComponents;
  /** Weights used */
  weights: TrustScoreWeights;
  /** Calculated tier */
  tier: TrustTier;
  /** Score trend */
  trend: TrustTrend;
  /** Score change from previous */
  scoreChangeAmount: number;
  /** Contributing factors */
  factors: TrustScoreFactor[];
  /** Last calculated timestamp */
  calculatedAt: Date;
  /** Next suggested recalculation */
  nextRecalculationAt?: Date | undefined;
}

// ============================================================================
// Threshold Interfaces
// ============================================================================

/**
 * Threshold requirement for a specific context
 */
export interface ThresholdRequirement {
  contextType: ThresholdContextType;
  contextId?: string | undefined;
  minimumScore: number;
  minimumTier?: TrustTier | undefined;
  requireVerification?: boolean | undefined;
  minimumVerificationLevel?: number | undefined;
}

/**
 * Result of checking a threshold
 */
export interface ThresholdCheckResult {
  passed: boolean;
  currentScore: number;
  requiredScore: number;
  currentTier: TrustTier;
  requiredTier?: TrustTier | undefined;
  gap: number;
  suggestions: string[];
}

// ============================================================================
// Event Interfaces
// ============================================================================

/**
 * Events that trigger trust score recalculation
 */
export type TrustScoreEventType =
  | 'review.created'
  | 'review.updated'
  | 'review.deleted'
  | 'compliance.recorded'
  | 'verification.completed'
  | 'verification.revoked'
  | 'account.warning'
  | 'account.suspension.lifted'
  | 'activity.login'
  | 'profile.updated'
  | 'scheduled.recalculation';

/**
 * Trust score event payload
 */
export interface TrustScoreEvent {
  type: TrustScoreEventType;
  userId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  priority?: 'high' | 'normal' | 'low';
}

// ============================================================================
// Service Options Interfaces
// ============================================================================

/**
 * Options for trust score calculation
 */
export interface TrustScoreCalculationOptions {
  /** Force recalculation even if recently calculated */
  forceRecalculate?: boolean;
  /** Include detailed factor explanations */
  includeFactors?: boolean;
  /** Custom weights override */
  weights?: Partial<TrustScoreWeights>;
  /** Skip cache and fetch fresh data */
  skipCache?: boolean;
}

/**
 * Options for batch trust score operations
 */
export interface TrustScoreBatchOptions {
  /** Batch size for processing */
  batchSize?: number;
  /** Delay between batches in ms */
  batchDelayMs?: number;
  /** Continue on individual failures */
  continueOnError?: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Trust score API response
 */
export interface TrustScoreResponse {
  userId: string;
  score: TrustScoreResult;
  cached: boolean;
  cachedAt?: Date;
}

/**
 * Trust score history entry
 */
export interface TrustScoreHistoryEntry {
  id: string;
  overallScore: number;
  components: TrustScoreComponents;
  tier: TrustTier;
  triggerEvent: string;
  createdAt: Date;
}

/**
 * Trust score explanation for users
 */
export interface TrustScoreExplanation {
  overallScore: number;
  tier: TrustTier;
  tierDescription: string;
  trend: TrustTrend;
  trendDescription: string;
  components: {
    name: string;
    score: number;
    weight: number;
    contribution: number;
    status: 'excellent' | 'good' | 'fair' | 'needs-improvement';
    tips: string[];
  }[];
  improvementPriorities: {
    component: string;
    potentialGain: number;
    actionRequired: string;
  }[];
}

// ============================================================================
// Badge Types
// ============================================================================

/**
 * Trust badge types
 */
export type TrustBadgeType =
  | 'new-member'
  | 'rising-star'
  | 'trusted'
  | 'top-rated'
  | 'elite'
  | 'compliance-champion'
  | 'verified-pro';

/**
 * Trust badge definition
 */
export interface TrustBadge {
  type: TrustBadgeType;
  name: string;
  description: string;
  iconUrl?: string;
  earnedAt?: Date;
  requirements: {
    minScore?: number;
    minTier?: TrustTier;
    additionalCriteria?: string[];
  };
}

// ============================================================================
// Re-exports from database for convenience
// ============================================================================

export type {
  TrustTier,
  TrustTrend,
  ComplianceEventType,
  ComplianceSeverity,
  ThresholdContextType,
};
