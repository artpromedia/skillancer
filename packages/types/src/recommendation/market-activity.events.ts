/**
 * @module @skillancer/types/recommendation/market-activity.events
 * Market Activity Events for Learning Recommendations
 *
 * Events published by Market service and consumed by SkillPod
 * for generating personalized learning recommendations.
 */

// =============================================================================
// SKILL REQUIREMENT TYPES
// =============================================================================

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export type SkillImportance = 'REQUIRED' | 'PREFERRED' | 'NICE_TO_HAVE';

export interface SkillRequirement {
  skillId: string;
  skillName: string;
  level: SkillLevel;
  importance: SkillImportance;
}

// =============================================================================
// JOB ACTIVITY EVENTS
// =============================================================================

/**
 * Emitted when a user views a job listing
 */
export interface JobViewedEvent {
  eventType: 'job.viewed';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    jobId: string;
    jobTitle: string;
    requiredSkills: SkillRequirement[];
    preferredSkills: SkillRequirement[];
    category: string;
    subcategory?: string;
    budgetRange?: { min: number; max: number };
    experienceLevel: string;
    viewDuration: number; // seconds
    source: 'search' | 'recommendation' | 'direct' | 'email';
  };
}

/**
 * Emitted when a user applies to a job
 */
export interface JobAppliedEvent {
  eventType: 'job.applied';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    jobId: string;
    jobTitle: string;
    requiredSkills: SkillRequirement[];
    preferredSkills: SkillRequirement[];
    category: string;
    proposalAmount: number;
    coverLetterLength: number;
    attachmentsCount: number;
    userSkillMatch: number; // 0-100 match score
    missingSkills: string[];
    partialSkills: string[]; // Has skill but lower level
  };
}

/**
 * Emitted when a job application has an outcome
 */
export interface JobOutcomeEvent {
  eventType: 'job.outcome';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    jobId: string;
    outcome: 'HIRED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED';
    competitorCount?: number;
    userRank?: number; // Position among applicants
    rejectionReason?: string;
    feedbackReceived?: string;
    missingSkillsMentioned?: string[];
  };
}

// =============================================================================
// CONTRACT & FEEDBACK EVENTS
// =============================================================================

/**
 * Emitted when a contract is completed
 */
export interface ContractCompletedEvent {
  eventType: 'contract.completed';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    contractId: string;
    projectType: string;
    skills: string[];
    clientRating: number;
    clientFeedback?: string;
    skillsMentionedPositive?: string[];
    skillsMentionedNegative?: string[];
    wouldHireAgain: boolean;
    earnedAmount: number;
    duration: number; // days
  };
}

// =============================================================================
// SKILL GAP & ANALYSIS EVENTS
// =============================================================================

export type GapType = 'MISSING' | 'LEVEL_MISMATCH' | 'OUTDATED';

/**
 * Emitted when a skill gap is detected in user's profile
 */
export interface ProfileSkillGapEvent {
  eventType: 'profile.skill_gap.detected';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    gapType: GapType;
    skillId: string;
    skillName: string;
    currentLevel?: string;
    requiredLevel: string;
    frequency: number; // How often this gap appears
    avgSalaryImpact: number; // Potential earnings increase
    topJobsRequiring: string[];
  };
}

export type TrendType = 'RISING' | 'STABLE' | 'DECLINING';
export type CompetitionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type TrendPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

/**
 * Emitted when market trends are updated
 */
export interface MarketTrendEvent {
  eventType: 'market.trend.updated';
  timestamp: Date;
  correlationId: string;
  payload: {
    category: string;
    trendType: TrendType;
    skills: {
      skillId: string;
      skillName: string;
      demandChange: number; // percentage
      avgRate: number;
      rateChange: number;
      jobCount: number;
      competitionLevel: CompetitionLevel;
    }[];
    period: TrendPeriod;
  };
}

/**
 * Emitted when competitor analysis is completed
 */
export interface CompetitorAnalysisEvent {
  eventType: 'competitor.analysis.completed';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    category: string;
    topPerformers: {
      anonymizedId: string;
      skills: string[];
      certifications: string[];
      avgRating: number;
      completedJobs: number;
      avgHourlyRate: number;
    }[];
    skillsInCommon: string[];
    skillsUserLacks: string[];
    recommendedSkillsToAdd: string[];
  };
}

// =============================================================================
// EVENTS PUBLISHED BY SKILLPOD (back to Market)
// =============================================================================

/**
 * Emitted when learning recommendations are generated
 */
export interface LearningRecommendationsGeneratedEvent {
  eventType: 'learning.recommendations.generated';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    trigger: string;
    recommendationCount: number;
    topRecommendations: {
      id: string;
      type: string;
      contentType: string;
      score: number;
    }[];
  };
}

/**
 * Emitted when a learning path is created
 */
export interface LearningPathCreatedEvent {
  eventType: 'learning.path.created';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    pathId: string;
    pathType: string;
    targetSkills: string[];
    estimatedHours: number;
  };
}

/**
 * Emitted when recommendation generation is requested
 */
export interface RecommendationGenerationRequestedEvent {
  eventType: 'recommendation.generation.requested';
  timestamp: Date;
  correlationId: string;
  payload: {
    userId: string;
    trigger: string;
  };
}

// =============================================================================
// EVENT UNION TYPES
// =============================================================================

export type MarketActivityEvent =
  | JobViewedEvent
  | JobAppliedEvent
  | JobOutcomeEvent
  | ContractCompletedEvent
  | ProfileSkillGapEvent
  | MarketTrendEvent
  | CompetitorAnalysisEvent;

export type SkillPodRecommendationEvent =
  | LearningRecommendationsGeneratedEvent
  | LearningPathCreatedEvent
  | RecommendationGenerationRequestedEvent;

export type RecommendationIntegrationEvent = MarketActivityEvent | SkillPodRecommendationEvent;

// =============================================================================
// EVENT PAYLOAD TYPES (for publisher/consumer convenience)
// =============================================================================

export type JobViewedEventPayload = JobViewedEvent['payload'];
export type JobApplicationEventPayload = JobAppliedEvent['payload'];
export type JobApplicationOutcomeEventPayload = JobOutcomeEvent['payload'];
export type ContractCompletedEventPayload = ContractCompletedEvent['payload'];
export type ProfileSkillGapEventPayload = ProfileSkillGapEvent['payload'];
export type MarketTrendEventPayload = MarketTrendEvent['payload'];
export type CompetitorAnalysisEventPayload = CompetitorAnalysisEvent['payload'];
export type LearningRecommendationsGeneratedEventPayload =
  LearningRecommendationsGeneratedEvent['payload'];
export type LearningPathCreatedEventPayload = LearningPathCreatedEvent['payload'];

// Additional payload types for publisher convenience
export interface SkillDemandChangeEventPayload {
  skillId: string;
  skillName: string;
  category: string;
  previousDemand: number;
  currentDemand: number;
  changePercentage: number;
  period: TrendPeriod;
  jobCount: number;
  avgRateChange: number;
}
