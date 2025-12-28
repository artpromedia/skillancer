/**
 * @module @skillancer/types/recommendation/recommendation.types
 * Learning Recommendation Types
 */

import type { GapType, TrendType, TrendPeriod } from './market-activity.events.js';
import type { CompetitionLevel } from '../cockpit/pricing.types.js';

// =============================================================================
// ENUMS AS TYPES
// =============================================================================

export type GapPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type GapStatus =
  | 'IDENTIFIED'
  | 'LEARNING_STARTED'
  | 'LEARNING_IN_PROGRESS'
  | 'ASSESSMENT_PENDING'
  | 'RESOLVED'
  | 'DISMISSED';

export type SignalType =
  | 'JOB_VIEW'
  | 'JOB_APPLICATION'
  | 'JOB_REJECTION'
  | 'SKILL_GAP_DETECTED'
  | 'CLIENT_FEEDBACK'
  | 'MARKET_TREND'
  | 'COMPETITOR_SKILL'
  | 'RATE_OPPORTUNITY';

export type RecommendationType =
  | 'FILL_GAP'
  | 'TRENDING_SKILL'
  | 'CAREER_ADVANCEMENT'
  | 'CERTIFICATION'
  | 'SKILL_REFRESH'
  | 'COMPETITIVE_EDGE'
  | 'RATE_INCREASE';

export type ContentType =
  | 'COURSE'
  | 'ASSESSMENT'
  | 'LEARNING_PATH'
  | 'CERTIFICATION'
  | 'PROJECT'
  | 'ARTICLE';

export type LearningRecommendationStatus =
  | 'PENDING'
  | 'VIEWED'
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DISMISSED'
  | 'EXPIRED';

export type PathType = 'SKILL_BASED' | 'ROLE_BASED' | 'GAP_FILLING' | 'TRENDING' | 'CUSTOM';

export type PathGenerationSource =
  | 'SKILL_GAP_ANALYSIS'
  | 'CAREER_GOAL'
  | 'MARKET_TREND'
  | 'COMPETITOR_ANALYSIS'
  | 'USER_REQUEST'
  | 'SYSTEM_SUGGESTION';

export type PathStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';

export type LearningStyle = 'VISUAL' | 'AUDITORY' | 'READING' | 'KINESTHETIC' | 'MIXED';

export type DifficultyPreference = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'CHALLENGING';

// =============================================================================
// USER LEARNING PROFILE
// =============================================================================

export interface UserLearningProfile {
  id: string;
  userId: string;

  // Career info (synced from Market)
  primaryCategory?: string;
  targetCategories: string[];
  currentHourlyRate?: number;
  targetHourlyRate?: number;
  experienceLevel?: string;

  // Learning preferences
  preferredLearningStyle?: 'video' | 'reading' | 'hands-on';
  weeklyLearningHours?: number;
  preferredDifficulty?: string;

  // Goals
  careerGoals?: Record<string, unknown>;
  skillGoals?: Record<string, unknown>;
  certificationGoals?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// SKILL GAP
// =============================================================================

export interface SkillGap {
  id: string;
  userId: string;
  learningProfileId: string;

  // Skill info
  skillId: string;
  skillName: string;

  // Gap details
  gapType: GapType;
  currentLevel?: string;
  targetLevel: string;

  // Impact metrics
  priority: GapPriority;
  frequency: number;
  avgSalaryImpact?: number;
  marketDemand?: number;

  // Source tracking
  sources: unknown[];
  lastSeenAt: Date;

  // Resolution
  status: GapStatus;
  resolvedAt?: Date;
  resolutionMethod?: string;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// MARKET ACTIVITY SIGNAL
// =============================================================================

export interface MarketActivitySignal {
  id: string;
  userId: string;
  learningProfileId: string;

  // Signal type
  signalType: SignalType;

  // Signal data
  skillId?: string;
  skillName?: string;
  category?: string;

  // Context
  sourceEventType: string;
  sourceEventId?: string;

  // Signal strength
  strength: number; // 0-100
  confidence: number; // 0-100

  // Metadata
  metadata?: Record<string, unknown>;

  // Processing
  processedAt?: Date;
  usedInRecommendation: boolean;

  createdAt: Date;
  expiresAt: Date;
}

// =============================================================================
// LEARNING RECOMMENDATION
// =============================================================================

export interface LearningRecommendationReason {
  type: string;
  message: string;
}

export interface RecommendationOutcome {
  type: string;
  value: string;
}

export interface LearningRecommendation {
  id: string;
  userId: string;
  learningProfileId: string;

  // Recommendation type
  recommendationType: RecommendationType;

  // Content reference
  contentType: ContentType;
  contentId: string;
  contentTitle: string;

  // Related skill gap
  skillGapId?: string;

  // Scoring
  relevanceScore: number; // 0-100
  urgencyScore: number; // 0-100
  impactScore: number; // 0-100
  overallScore: number; // 0-100

  // Reasoning
  reasons: LearningRecommendationReason[];
  expectedOutcomes: RecommendationOutcome[];

  // Display
  displayPriority: number;
  isHighlighted: boolean;
  expiresAt?: Date;

  // Interaction tracking
  status: LearningRecommendationStatus;
  viewedAt?: Date;
  clickedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  dismissedAt?: Date;
  dismissReason?: string;

  // Feedback
  userRating?: number; // 1-5
  wasHelpful?: boolean;
  feedback?: string;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// USER LEARNING PATH
// =============================================================================

export interface UserLearningPath {
  id: string;
  userId: string;
  learningProfileId: string;

  // Path info
  learningPathId: string;
  pathTitle: string;
  pathType: PathType;

  // Generation context
  generatedFrom: PathGenerationSource;
  targetRole?: string;
  targetSkills: string[];

  // Progress
  status: PathStatus;
  progressPercent: number;
  currentStepIndex: number;
  totalSteps: number;

  // Estimated impact
  estimatedHours: number;
  estimatedRateIncrease?: number; // percentage
  estimatedJobMatchIncrease?: number; // percentage

  // Dates
  startedAt?: Date;
  targetCompletionDate?: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// MARKET TREND
// =============================================================================

export interface MarketTrend {
  id: string;

  // Trend scope
  category: string;
  subcategory?: string;
  region?: string;

  // Skill trend
  skillId: string;
  skillName: string;

  // Trend data
  trendDirection: TrendType;
  demandScore: number; // 0-100
  demandChange: number; // percentage

  // Rate data
  avgHourlyRate: number;
  rateChange: number; // percentage
  ratePercentile?: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };

  // Supply/demand
  jobCount: number;
  freelancerCount: number;
  competitionLevel: CompetitionLevel;

  // Time period
  period: TrendPeriod;
  periodStart: Date;
  periodEnd: Date;

  // Forecast
  forecastDirection?: TrendType;
  forecastConfidence?: number;

  createdAt: Date;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface RecommendationContent {
  type: ContentType;
  id: string;
  title: string;
  thumbnail?: string;
  duration?: string;
  difficulty?: string;
}

export interface RecommendationScores {
  relevance: number;
  urgency: number;
  impact: number;
  overall: number;
}

export interface RelatedGapInfo {
  skillName: string;
  currentLevel?: string;
  targetLevel: string;
}

export interface RecommendationResponse {
  id: string;
  type: RecommendationType;
  content: RecommendationContent;
  scores: RecommendationScores;
  reasons: LearningRecommendationReason[];
  expectedOutcomes: RecommendationOutcome[];
  relatedGap?: RelatedGapInfo;
  isHighlighted: boolean;
}

export interface RecommendationsListResponse {
  recommendations: RecommendationResponse[];
  totalCount: number;
}

export interface RecommendedAction {
  type: ContentType;
  title: string;
}

export interface SkillGapResponse {
  id: string;
  skillName: string;
  gapType: GapType;
  currentLevel?: string;
  targetLevel: string;
  priority: GapPriority;
  frequency: number;
  avgSalaryImpact?: number;
  status: GapStatus;
  recommendedActions: RecommendedAction[];
}

export interface SkillGapsSummary {
  criticalGaps: number;
  highPriorityGaps: number;
  totalGaps: number;
  estimatedEarningsImpact: number;
}

export interface SkillGapsListResponse {
  gaps: SkillGapResponse[];
  summary: SkillGapsSummary;
}

export interface LearningPathSuggestion {
  type: PathType;
  targetRole?: string;
  targetSkills?: string[];
  currentMatch?: number;
  targetMatch?: number;
  estimatedHours: number;
  estimatedWeeks: number;
  skillsToAcquire?: string[];
  estimatedRateIncrease?: number;
  estimatedJobMatchIncrease?: number;
}

export interface LearningPathSuggestionsResponse {
  suggestions: LearningPathSuggestion[];
}

export interface LearningPathStep {
  order: number;
  type: ContentType;
  contentId: string;
  title: string;
  estimatedHours: number;
  skills: string[];
}

export interface LearningPathOutcomes {
  rateIncrease?: number;
  jobMatchIncrease?: number;
  newCertifications?: number;
}

export interface LearningPathResponse {
  id: string;
  title: string;
  type: PathType;
  steps: LearningPathStep[];
  totalSteps: number;
  estimatedHours: number;
  targetCompletionDate?: string;
  estimatedOutcomes: LearningPathOutcomes;
}

export interface MarketTrendResponse {
  skillName: string;
  trendDirection: TrendType;
  demandChange: number;
  avgHourlyRate: number;
  rateChange: number;
  jobCount: number;
  competitionLevel: CompetitionLevel;
  userHasSkill: boolean;
  recommendedPath?: {
    id: string;
    estimatedHours: number;
  };
}

export interface MarketTrendsListResponse {
  trends: MarketTrendResponse[];
  period: TrendPeriod;
  category?: string;
}

// =============================================================================
// API REQUEST TYPES
// =============================================================================

export interface CreateLearningPathRequest {
  targetRole?: string;
  targetSkills?: string[];
  weeklyHours?: number;
  deadline?: string;
}

export interface RecommendationInteractionRequest {
  action: 'VIEW' | 'CLICK' | 'START' | 'DISMISS';
  dismissReason?: string;
}

export interface GetLearningRecommendationsQuery {
  limit?: number;
  type?: RecommendationType;
}

export interface GetMarketTrendsQuery {
  category?: string;
  period?: TrendPeriod;
}
