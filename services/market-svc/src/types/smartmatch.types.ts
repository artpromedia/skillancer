/**
 * @module @skillancer/market-svc/types/smartmatch
 * SmartMatch Scoring Algorithm types and interfaces
 */

// =============================================================================
// ENUMS (matching Prisma schema)
// =============================================================================

export type MatchingEventType =
  | 'SEARCH_RESULT'
  | 'RECOMMENDATION'
  | 'INVITATION_SENT'
  | 'BID_SUBMITTED'
  | 'BID_VIEWED'
  | 'BID_SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'HIRED'
  | 'PROJECT_COMPLETED';

export type MatchingOutcome =
  | 'IGNORED'
  | 'VIEWED'
  | 'SHORTLISTED'
  | 'INTERVIEWED'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type SkillRelationType = 'PARENT_CHILD' | 'SIBLING' | 'COMPLEMENTARY' | 'PREREQUISITE';

export type EndorsementType = 'WORKED_WITH' | 'VERIFIED_SKILL' | 'RECOMMENDATION';

export type ExperienceLevel = 'ENTRY' | 'INTERMEDIATE' | 'EXPERT' | 'ANY';

export type DurationType =
  | 'LESS_THAN_A_WEEK'
  | 'ONE_TO_TWO_WEEKS'
  | 'TWO_TO_FOUR_WEEKS'
  | 'ONE_TO_THREE_MONTHS'
  | 'THREE_TO_SIX_MONTHS'
  | 'MORE_THAN_SIX_MONTHS';

export type VerificationLevel = 'NONE' | 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM';

export type ClearanceLevel =
  | 'PUBLIC_TRUST'
  | 'CONFIDENTIAL'
  | 'SECRET'
  | 'TOP_SECRET'
  | 'TOP_SECRET_SCI';

export type ComplianceType =
  | 'HIPAA'
  | 'SOC2'
  | 'PCI_DSS'
  | 'GDPR'
  | 'ISO_27001'
  | 'FEDRAMP'
  | 'NIST'
  | 'CCPA'
  | 'FERPA'
  | 'GLBA'
  | 'CUSTOM';

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface SmartMatchWeights {
  compliance: number;
  skills: number;
  experience: number;
  trust: number;
  rate: number;
  availability: number;
  successHistory: number;
  responsiveness: number;
}

export interface SmartMatchConfig {
  weights: SmartMatchWeights;
}

export const DEFAULT_SMARTMATCH_WEIGHTS: SmartMatchWeights = {
  compliance: 0.2,
  skills: 0.25,
  experience: 0.12,
  trust: 0.15,
  rate: 0.1,
  availability: 0.08,
  successHistory: 0.07,
  responsiveness: 0.03,
};

// =============================================================================
// SCORING TYPES
// =============================================================================

export type ScoreImpact = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export interface ScoreFactor {
  name: string;
  value: unknown;
  impact: ScoreImpact;
  description: string;
}

export interface ComponentScore {
  score: number; // 0-100
  weight: number; // 0-1
  weighted: number; // score * weight
  factors: ScoreFactor[];
}

export interface MatchScoreBreakdown {
  overall: number;
  components: {
    compliance: ComponentScore;
    skills: ComponentScore;
    experience: ComponentScore;
    trust: ComponentScore;
    rate: ComponentScore;
    availability: ComponentScore;
    successHistory: ComponentScore;
    responsiveness: ComponentScore;
  };
  explanations: string[];
  warnings: string[];
  boosts: string[];
}

// =============================================================================
// MATCHING CRITERIA TYPES
// =============================================================================

export interface MatchingCriteria {
  projectId?: string;
  requiredCompliance?: string[];
  requiredClearance?: ClearanceLevel;
  preferredCompliance?: string[];
  skills: string[];
  budgetMin?: number;
  budgetMax?: number;
  experienceLevel?: ExperienceLevel;
  minTrustScore?: number;
  startDate?: Date;
  hoursPerWeek?: number;
  timezone?: string;
  durationType?: DurationType;
  excludeUserIds?: string[];
}

export interface MatchingOptions {
  page?: number;
  limit?: number;
  sortBy?: 'score' | 'rate' | 'trust';
}

// =============================================================================
// FREELANCER PROFILE TYPES
// =============================================================================

export interface FreelancerProfileSummary {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  headline?: string | null;
  skills: string[];
  hourlyRate?: number | null;
  avgRating?: number | null;
  reviewCount: number;
  totalProjects: number;
  verificationLevel: VerificationLevel;
}

export interface FreelancerSuccessMetrics {
  totalProjects: number;
  completedProjects: number;
  cancelledProjects: number;
  avgRating: number;
  reviewCount: number;
  repeatClientRate: number;
  onTimeDeliveryRate: number;
}

export interface FreelancerProfile {
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    verificationLevel: VerificationLevel;
  };
  headline?: string | null;
  skills: string[];
  hourlyRateMin?: number | null;
  yearsOfExperience?: number | null;
  totalProjects: number;
  avgRating?: number | null;
  reviewCount: number;
  skillEndorsements?: SkillEndorsement[];
}

export interface SkillEndorsement {
  id: string;
  userId: string;
  skill: string;
  endorsedByUserId: string;
  endorsementType: EndorsementType;
  projectId?: string | null;
  comment?: string | null;
  createdAt: Date;
}

// =============================================================================
// WORK PATTERN TYPES
// =============================================================================

export interface UnavailablePeriod {
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface FreelancerWorkPattern {
  id: string;
  userId: string;
  weeklyHoursAvailable?: number | null;
  preferredHoursPerWeek?: number | null;
  workingDays: string[];
  workingHoursStart?: string | null;
  workingHoursEnd?: string | null;
  timezone?: string | null;
  avgResponseTimeMinutes?: number | null;
  avgFirstBidTimeHours?: number | null;
  preferredProjectDuration: string[];
  preferredBudgetMin?: number | null;
  preferredBudgetMax?: number | null;
  preferredLocationType: string[];
  currentActiveProjects: number;
  maxConcurrentProjects: number;
  unavailablePeriods?: UnavailablePeriod[] | null;
  lastActiveAt?: Date | null;
  lastBidAt?: Date | null;
  lastProjectCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateWorkPatternInput {
  weeklyHoursAvailable?: number;
  preferredHoursPerWeek?: number;
  workingDays?: string[];
  workingHoursStart?: string;
  workingHoursEnd?: string;
  timezone?: string;
  preferredProjectDuration?: string[];
  preferredBudgetMin?: number;
  preferredBudgetMax?: number;
  preferredLocationType?: string[];
  maxConcurrentProjects?: number;
  unavailablePeriods?: UnavailablePeriod[];
}

// =============================================================================
// RATE INTELLIGENCE TYPES
// =============================================================================

export interface RateIntelligence {
  id: string;
  skillCategory: string;
  primarySkill?: string | null;
  experienceLevel: ExperienceLevel;
  region?: string | null;
  sampleSize: number;
  avgHourlyRate: number;
  medianHourlyRate: number;
  minHourlyRate: number;
  maxHourlyRate: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  avgFixedProjectRate?: number | null;
  rateChangePct30d?: number | null;
  rateChangePct90d?: number | null;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

export interface RateAnalysis {
  marketRate: RateIntelligence | null;
  freelancerRate: number;
  percentile: number;
  comparison: 'BELOW_MARKET' | 'AT_MARKET' | 'ABOVE_MARKET';
  percentDifference: number;
}

// =============================================================================
// SKILL RELATIONSHIP TYPES
// =============================================================================

export interface SkillRelationship {
  id: string;
  skill1: string;
  skill2: string;
  relationshipType: SkillRelationType;
  strength: number;
  bidirectional: boolean;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RelatedSkillMatch {
  skill: string;
  strength: number;
  relationshipType: SkillRelationType;
}

export interface CreateSkillRelationshipInput {
  skill1: string;
  skill2: string;
  relationshipType: SkillRelationType;
  strength: number;
  bidirectional?: boolean;
  source?: string;
}

export interface CreateEndorsementInput {
  userId: string;
  skill: string;
  endorsementType: EndorsementType;
  projectId?: string;
  comment?: string;
}

// =============================================================================
// MATCHING EVENT TYPES
// =============================================================================

export interface MatchingEventInput {
  eventType: MatchingEventType;
  projectId?: string;
  serviceId?: string;
  clientUserId: string;
  freelancerUserId: string;
  matchScore?: number;
  matchRank?: number;
  matchFactors?: Record<string, number>;
  searchCriteria?: MatchingCriteria;
}

export interface MatchingEventOutcomeInput {
  outcome: MatchingOutcome;
  wasHired?: boolean;
  projectSuccessful?: boolean;
  clientSatisfactionScore?: number;
}

export interface MatchingEvent {
  id: string;
  eventType: MatchingEventType;
  projectId?: string | null;
  serviceId?: string | null;
  clientUserId: string;
  freelancerUserId: string;
  matchScore?: number | null;
  matchRank?: number | null;
  matchFactors?: Record<string, number> | null;
  outcome?: MatchingOutcome | null;
  outcomeAt?: Date | null;
  wasHired?: boolean | null;
  projectSuccessful?: boolean | null;
  clientSatisfactionScore?: number | null;
  searchCriteria?: MatchingCriteria | null;
  createdAt: Date;
}

// =============================================================================
// MATCHED FREELANCER TYPES
// =============================================================================

export interface ComplianceStatus {
  allRequirementsMet: boolean;
  metRequirements: string[];
  missingRequirements: string[];
  expiringRequirements: string[];
}

export interface MatchedFreelancer {
  freelancer: FreelancerProfileSummary;
  score: MatchScoreBreakdown;
  complianceStatus: ComplianceStatus;
}

export interface FindMatchesResult {
  matches: MatchedFreelancer[];
  total: number;
  searchId: string;
}

// =============================================================================
// RECOMMENDATION TYPES
// =============================================================================

export interface ProjectRecommendation {
  project: {
    id: string;
    title: string;
    description: string;
    budgetRange: string;
    skills: string[];
    postedAt: Date;
  };
  matchScore: number;
  matchReasons: string[];
  competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FreelancerRecommendations {
  recommendations: ProjectRecommendation[];
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface CalculateScoreRequest {
  freelancerUserId: string;
  criteria: MatchingCriteria;
  config?: Partial<SmartMatchConfig>;
}

export interface FindMatchesRequest {
  projectId?: string;
  criteria: MatchingCriteria;
  weights?: Partial<SmartMatchWeights>;
  page?: number;
  limit?: number;
  sortBy?: 'score' | 'rate' | 'trust';
}

export interface GetRecommendationsRequest {
  limit?: number;
  excludeApplied?: boolean;
}

export interface RecordOutcomeRequest {
  freelancerUserId: string;
  outcome: MatchingOutcome;
  reason?: string;
}
