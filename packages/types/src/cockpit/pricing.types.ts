// ============================================================================
// Skill-Based Pricing Recommendations - Type Definitions
// ============================================================================

// ==================== Enums ====================

export type MarketPosition =
  | 'BUDGET'
  | 'BELOW_AVERAGE'
  | 'AVERAGE'
  | 'ABOVE_AVERAGE'
  | 'PREMIUM'
  | 'TOP_TIER';

export type MarketDemand = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';

export type CompetitionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type TrendDirection = 'DECLINING' | 'STABLE' | 'RISING' | 'RAPIDLY_RISING';

export type PricingRecommendationType =
  | 'RATE_INCREASE'
  | 'RATE_DECREASE'
  | 'SKILL_PREMIUM'
  | 'MARKET_ADJUSTMENT'
  | 'EXPERIENCE_UPGRADE'
  | 'CERTIFICATION_PREMIUM'
  | 'DEMAND_BASED';

export type RecommendationScope = 'GLOBAL' | 'SKILL' | 'PROJECT_TYPE' | 'CLIENT_TIER';

export type RecommendationStatus = 'PENDING' | 'VIEWED' | 'APPLIED' | 'DISMISSED' | 'EXPIRED';

export type RateSource = 'MANUAL' | 'PROJECT' | 'CONTRACT' | 'PROFILE' | 'RECOMMENDATION';

export type ScenarioType = 'CURRENT' | 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'CUSTOM';

// ==================== Core Interfaces ====================

export interface SkillRate {
  id: string;
  userId: string;
  skillId: string;
  skillName: string;
  currentHourlyRate: number | null;
  currentProjectRate: number | null;
  currency: string;
  recommendedMinRate: number | null;
  recommendedOptimalRate: number | null;
  recommendedMaxRate: number | null;
  confidenceScore: number;
  skillLevel: string | null;
  verificationScore: number | null;
  experienceYears: number | null;
  projectsCompleted: number | null;
  avgClientRating: number | null;
  marketPosition: MarketPosition;
  marketDemand: MarketDemand;
  competitionLevel: CompetitionLevel;
  calculatedAt: Date;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketRateBenchmark {
  id: string;
  skillId: string;
  skillName: string;
  category: string | null;
  region: string | null;
  rateP10: number;
  rateP25: number;
  rateP50: number;
  rateP75: number;
  rateP90: number;
  rateMean: number;
  beginnerRate: number | null;
  intermediateRate: number | null;
  advancedRate: number | null;
  expertRate: number | null;
  sampleSize: number;
  jobCount: number;
  freelancerCount: number;
  demandScore: number;
  rateChangeMonthly: number | null;
  rateChangeYearly: number | null;
  trendDirection: TrendDirection;
  sources: string[];
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

export interface PricingRecommendation {
  id: string;
  userId: string;
  recommendationType: PricingRecommendationType;
  scope: RecommendationScope;
  skillId: string | null;
  skillName: string | null;
  projectType: string | null;
  currentRate: number | null;
  recommendedRate: number;
  rateChange: number;
  rateChangePercent: number;
  projectedMonthlyImpact: number | null;
  projectedYearlyImpact: number | null;
  confidenceScore: number;
  reasoning: RecommendationReason[];
  marketPosition: MarketPosition;
  competitorAnalysis: CompetitorAnalysis | null;
  status: RecommendationStatus;
  viewedAt: Date | null;
  appliedAt: Date | null;
  dismissedAt: Date | null;
  dismissReason: string | null;
  validFrom: Date;
  validUntil: Date;
  createdAt: Date;
}

export interface RateHistory {
  id: string;
  userId: string;
  skillId: string | null;
  skillName: string | null;
  hourlyRate: number;
  currency: string;
  source: RateSource;
  projectId: string | null;
  contractId: string | null;
  clientRating: number | null;
  projectSuccess: boolean | null;
  repeatClient: boolean | null;
  effectiveDate: Date;
  createdAt: Date;
}

export interface RevenueProjection {
  id: string;
  userId: string;
  scenarioName: string;
  scenarioType: ScenarioType;
  hourlyRate: number;
  hoursPerWeek: number;
  weeksPerYear: number;
  utilizationRate: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  monthlyExpenses: number | null;
  yearlyExpenses: number | null;
  monthlyNetIncome: number | null;
  yearlyNetIncome: number | null;
  vsCurrentMonthly: number | null;
  vsCurrentYearly: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Supporting Types ====================

export interface RecommendationReason {
  factor: RecommendationFactor;
  impact: 'positive' | 'negative' | 'neutral' | 'opportunity';
  message: string;
  weight: number;
}

export type RecommendationFactor =
  | 'VERIFIED_SKILL'
  | 'EXPERIENCE'
  | 'CLIENT_SATISFACTION'
  | 'MARKET_POSITION'
  | 'MARKET_TREND'
  | 'DEMAND'
  | 'CERTIFICATION'
  | 'COMPETITION'
  | 'PROJECT_HISTORY';

export interface CompetitorAnalysis {
  marketMedian: number;
  yourPosition: MarketPosition;
  topTierRate: number;
  trend: TrendDirection;
}

export interface RateFeatures {
  skillName: string;
  skillLevel: string;
  verificationScore: number;
  credentialCount: number;
  hasCertification: boolean;
  yearsExperience: number;
  projectCount: number;
  avgRating: number;
  successRate: number;
  repeatClientRate: number;
  marketMedian: number;
  marketP75: number;
  marketP90: number;
  demandScore: number;
  competitionLevel: number;
  externalMedian: number;
  currentRate: number | null;
}

export interface RatePrediction {
  minRate: number;
  optimalRate: number;
  maxRate: number;
  confidence: number;
}

// ==================== Dashboard Types ====================

export interface PricingDashboard {
  overview: PricingOverview;
  skillRates: SkillRateSummary[];
  recommendations: RecommendationSummary[];
  projections: ProjectionSummary;
  rateHistory: RateHistoryChart;
}

export interface PricingOverview {
  avgCurrentRate: number;
  avgRecommendedRate: number;
  potentialIncrease: number;
  potentialIncreasePercent: number;
  avgConfidence: number;
  marketPosition: MarketPosition;
  rateTrend: {
    direction: 'UP' | 'DOWN' | 'STABLE';
    changePercent: number;
  };
}

export interface SkillRateSummary {
  skillId: string;
  skillName: string;
  currentRate: number | null;
  recommendedRate: number;
  minRate: number;
  maxRate: number;
  confidence: number;
  marketPosition: MarketPosition;
  marketDemand: MarketDemand;
  skillLevel: string | null;
}

export interface RecommendationSummary {
  id: string;
  type: PricingRecommendationType;
  skillName: string | null;
  currentRate: number;
  recommendedRate: number;
  changePercent: number;
  yearlyImpact: number;
  confidence: number;
  reasoning: RecommendationReason[];
}

export interface ProjectionSummary {
  current: ProjectionValues | null;
  potential: PotentialProjectionValues | null;
}

export interface ProjectionValues {
  monthly: number;
  yearly: number;
  netMonthly: number;
  netYearly: number;
}

export interface PotentialProjectionValues extends ProjectionValues {
  increaseMonthly: number;
  increaseYearly: number;
}

export interface RateHistoryChart {
  labels: string[];
  rates: number[];
}

// ==================== API Request/Response Types ====================

export interface CalculateSkillRateRequest {
  skillId: string;
}

export interface CalculateSkillRateResponse {
  skillRate: SkillRate;
  recommendation?: PricingRecommendation;
}

export interface GetRecommendationsQuery {
  status?: RecommendationStatus[];
  skillId?: string;
  limit?: number;
}

export interface ApplyRecommendationResponse {
  success: boolean;
  updatedRate?: SkillRate;
}

export interface DismissRecommendationRequest {
  reason?: string;
}

export interface GetBenchmarkQuery {
  region?: string;
}

export interface CreateProjectionRequest {
  name: string;
  hourlyRate: number;
  hoursPerWeek: number;
  weeksPerYear?: number;
  utilizationRate?: number;
  monthlyExpenses?: number;
}

export interface GetRateHistoryQuery {
  skillId?: string;
  months?: number;
}

export interface RateHistoryResponse {
  history: RateHistory[];
  trend: RateHistoryChart;
}

// ==================== Service Input Types ====================

export interface SkillRateCreateInput {
  userId: string;
  skillId: string;
  skillName: string;
  currentHourlyRate?: number;
  currentProjectRate?: number;
  currency?: string;
  recommendedMinRate?: number;
  recommendedOptimalRate?: number;
  recommendedMaxRate?: number;
  confidenceScore: number;
  skillLevel?: string;
  verificationScore?: number;
  experienceYears?: number;
  projectsCompleted?: number;
  avgClientRating?: number;
  marketPosition?: MarketPosition;
  marketDemand?: MarketDemand;
  competitionLevel?: CompetitionLevel;
  calculatedAt: Date;
  validUntil: Date;
}

export interface SkillRateUpdateInput {
  currentHourlyRate?: number;
  currentProjectRate?: number;
  currency?: string;
  recommendedMinRate?: number;
  recommendedOptimalRate?: number;
  recommendedMaxRate?: number;
  confidenceScore?: number;
  skillLevel?: string;
  verificationScore?: number;
  experienceYears?: number;
  projectsCompleted?: number;
  avgClientRating?: number;
  marketPosition?: MarketPosition;
  marketDemand?: MarketDemand;
  competitionLevel?: CompetitionLevel;
  calculatedAt?: Date;
  validUntil?: Date;
}

export interface BenchmarkCreateInput {
  skillId: string;
  skillName: string;
  category?: string;
  region?: string;
  rateP10: number;
  rateP25: number;
  rateP50: number;
  rateP75: number;
  rateP90: number;
  rateMean: number;
  beginnerRate?: number;
  intermediateRate?: number;
  advancedRate?: number;
  expertRate?: number;
  sampleSize: number;
  jobCount: number;
  freelancerCount: number;
  demandScore: number;
  rateChangeMonthly?: number;
  rateChangeYearly?: number;
  trendDirection?: TrendDirection;
  sources: string[];
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

export interface RecommendationCreateInput {
  userId: string;
  recommendationType: PricingRecommendationType;
  scope: RecommendationScope;
  skillId?: string;
  skillName?: string;
  projectType?: string;
  currentRate?: number;
  recommendedRate: number;
  rateChange: number;
  rateChangePercent: number;
  projectedMonthlyImpact?: number;
  projectedYearlyImpact?: number;
  confidenceScore: number;
  reasoning: RecommendationReason[];
  marketPosition: MarketPosition;
  competitorAnalysis?: CompetitorAnalysis;
  status?: RecommendationStatus;
  validFrom: Date;
  validUntil: Date;
}

export interface RateHistoryCreateInput {
  userId: string;
  skillId?: string;
  skillName?: string;
  hourlyRate: number;
  currency?: string;
  source?: RateSource;
  projectId?: string;
  contractId?: string;
  clientRating?: number;
  projectSuccess?: boolean;
  repeatClient?: boolean;
  effectiveDate: Date;
}

export interface ProjectionCreateInput {
  userId: string;
  scenarioName: string;
  scenarioType: ScenarioType;
  hourlyRate: number;
  hoursPerWeek: number;
  weeksPerYear?: number;
  utilizationRate?: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  monthlyExpenses?: number;
  yearlyExpenses?: number;
  monthlyNetIncome?: number;
  yearlyNetIncome?: number;
  vsCurrentMonthly?: number;
  vsCurrentYearly?: number;
  isActive?: boolean;
}

// ==================== External Data Types ====================

export interface SkillVerificationData {
  userId: string;
  skillId: string;
  skillName: string;
  proficiencyLevel: string;
  confidenceScore: number;
  verifiedAt: Date;
}

export interface CredentialData {
  id: string;
  skillId: string;
  type: 'CERTIFICATION' | 'COURSE' | 'DEGREE' | 'BADGE';
  name: string;
  issuer: string;
  issuedAt: Date;
  expiresAt?: Date;
}

export interface ProjectHistoryData {
  projectCount: number;
  avgRating: number;
  successRate: number;
  repeatClientRate: number;
  yearsExperience: number;
  totalEarnings: number;
  avgProjectValue: number;
}

export interface ExternalRateData {
  source: string;
  rates: Array<{
    rate: number;
    level?: string;
    weight?: number;
  }>;
  median: number;
  updatedAt: Date;
}

export interface MarketSkillData {
  skillId: string;
  skillName: string;
  category?: string;
  jobCount: number;
  freelancerCount: number;
  jobGrowth: number;
  rates: Array<{
    rate: number;
    level?: string;
    weight?: number;
  }>;
}

// ==================== Event Types ====================

export interface SkillRateCalculatedEvent {
  type: 'skill_rate.calculated';
  userId: string;
  skillId: string;
  skillName: string;
  currentRate: number | null;
  recommendedRate: number;
  confidenceScore: number;
  marketPosition: MarketPosition;
  timestamp: Date;
}

export interface RecommendationCreatedEvent {
  type: 'pricing_recommendation.created';
  recommendationId: string;
  userId: string;
  recommendationType: PricingRecommendationType;
  skillName: string | null;
  currentRate: number;
  recommendedRate: number;
  yearlyImpact: number;
  confidenceScore: number;
  timestamp: Date;
}

export interface RecommendationAppliedEvent {
  type: 'pricing_recommendation.applied';
  recommendationId: string;
  userId: string;
  skillId: string | null;
  oldRate: number;
  newRate: number;
  timestamp: Date;
}

export interface BenchmarkUpdatedEvent {
  type: 'market_benchmark.updated';
  skillId: string;
  skillName: string;
  region: string;
  medianRate: number;
  trendDirection: TrendDirection;
  demandScore: number;
  timestamp: Date;
}
