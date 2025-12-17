/**
 * @module @skillancer/market-svc/types/rate-intelligence
 * Type definitions for the Rate Intelligence System
 */

import type {
  ExperienceLevel,
  RateSourceType,
  RateType,
  PeriodType,
  RecommendationType,
  RecommendationStatus,
  DemandLevel,
} from '@skillancer/database';

// =============================================================================
// RATE DATA TYPES
// =============================================================================

export interface RateDataPointCreate {
  sourceType: RateSourceType;
  sourceId: string;
  primarySkill: string;
  secondarySkills: string[];
  skillCategory: string;
  rateType: RateType;
  hourlyRate?: number | null;
  fixedRate?: number | null;
  projectDurationDays?: number | null | undefined;
  effectiveHourlyRate?: number | null;
  experienceLevel: ExperienceLevel;
  freelancerUserId: string;
  clientUserId: string;
  freelancerCountry?: string | null | undefined;
  freelancerRegion?: string | null;
  clientCountry?: string | null | undefined;
  wasAccepted: boolean;
  projectCompleted?: boolean | null;
  clientRating?: number | null;
  complianceRequired: string[];
  hasCompliancePremium: boolean;
  occurredAt: Date;
}

export interface RateDataPointUpdate {
  wasAccepted?: boolean;
  projectCompleted?: boolean;
  clientRating?: number;
}

export interface UniqueSegment {
  skillCategory: string;
  primarySkill: string | null;
  experienceLevel: ExperienceLevel;
  region: string;
}

// =============================================================================
// MARKET RATE TYPES
// =============================================================================

export interface MarketRateQuery {
  skill: string;
  skillCategory?: string;
  experienceLevel?: ExperienceLevel;
  region?: string;
  complianceRequired?: string[];
}

export interface HourlyRateStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  percentile10: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
}

export interface FixedRateStats {
  min: number;
  max: number;
  avg: number;
  median: number;
}

export interface AcceptanceRates {
  belowMarket: number;
  atMarket: number;
  aboveMarket: number;
}

export interface RateTrend {
  changePercent30d: number | null;
  changePercent90d: number | null;
  direction: 'UP' | 'DOWN' | 'STABLE';
}

export interface CompliancePremium {
  hasData: boolean;
  premiumPercent: number;
}

export interface MarketRateResult {
  skill: string;
  experienceLevel: ExperienceLevel;
  region: string;
  sampleSize: number;
  hourlyRate: HourlyRateStats;
  fixedProjectRate?: FixedRateStats;
  acceptanceRates: AcceptanceRates;
  trend: RateTrend;
  compliancePremium?: CompliancePremium;
  demandLevel: DemandLevel;
  lastUpdated: Date;
}

// =============================================================================
// FREELANCER ANALYSIS TYPES
// =============================================================================

export type MarketPositionCategory = 'BELOW_MARKET' | 'AT_MARKET' | 'ABOVE_MARKET' | 'PREMIUM';

export interface MarketPosition {
  percentile: number;
  category: MarketPositionCategory;
  vsMedian: number;
}

export interface CompetitiveAnalysis {
  freelancersAbove: number;
  freelancersBelow: number;
  freelancersAtSameLevel: number;
}

export interface PerformanceCorrelation {
  yourWinRate: number;
  avgWinRateAtYourRate: number;
  optimalRateRange: {
    min: number;
    max: number;
  };
}

export interface RateChangeHistoryItem {
  date: Date;
  oldRate: number;
  newRate: number;
  impactOnWinRate: number | null;
}

export interface RecommendationReason {
  factor: string;
  description: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface RateRecommendationResult {
  id: string;
  userId: string;
  recommendationType: RecommendationType;
  currentRate: number;
  currentPercentile: number;
  recommendedRateMin: number;
  recommendedRateMax: number;
  recommendedPercentile: number;
  reasons: RecommendationReason[];
  projectedWinRateChange: number | null;
  projectedEarningsChange: number | null;
  status: RecommendationStatus;
  validUntil: Date;
  createdAt: Date;
}

export interface FreelancerRateAnalysis {
  currentRate: number;
  marketPosition: MarketPosition;
  competitiveAnalysis: CompetitiveAnalysis;
  performanceCorrelation: PerformanceCorrelation;
  recommendations: RateRecommendationResult[];
  historicalPerformance: {
    rateChanges: RateChangeHistoryItem[];
  };
}

// =============================================================================
// BUDGET RECOMMENDATION TYPES
// =============================================================================

export interface BudgetTier {
  min: number;
  max: number;
  description: string;
}

export interface BudgetRecommendation {
  skill: string;
  projectType: 'HOURLY' | 'FIXED';
  experienceLevel: ExperienceLevel;
  recommendedBudget: {
    economical: BudgetTier;
    competitive: BudgetTier;
    premium: BudgetTier;
  };
  expectedBidCount: {
    economical: number;
    competitive: number;
    premium: number;
  };
  qualityExpectation: {
    economical: string;
    competitive: string;
    premium: string;
  };
  marketContext: {
    demandLevel: DemandLevel;
    supplyLevel: string;
    competitionLevel: string;
  };
}

export interface BudgetRecommendationParams {
  skills: string[];
  projectType: 'HOURLY' | 'FIXED';
  experienceLevel: ExperienceLevel;
  estimatedHours?: number;
  complianceRequired?: string[];
}

// =============================================================================
// BID COMPARISON TYPES
// =============================================================================

export interface BidComparisonResult {
  bid: {
    rate: number;
    type: 'HOURLY' | 'FIXED';
  };
  marketComparison: {
    percentile: number;
    vsMedian: number;
    category: MarketPositionCategory;
  };
  historicalContext: {
    similarProjectsAvgRate: number;
    acceptedBidsAvgRate: number;
    thisFreelancerAvgRate: number;
  };
  recommendation: {
    verdict: 'EXCELLENT' | 'FAIR' | 'HIGH' | 'VERY_HIGH';
    explanation: string;
    considerations: string[];
  };
}

// =============================================================================
// DEMAND TREND TYPES
// =============================================================================

export interface SkillTrendItem {
  skill: string;
  skillCategory: string;
  demandLevel: DemandLevel;
  demandSupplyRatio: number;
  avgBidsPerProject: number;
  rateChange: {
    percent30d: number | null;
    percent90d: number | null;
  };
  projectVolume: {
    current: number;
    previous: number;
    changePercent: number;
  };
  forecast: {
    nextMonth: 'INCREASING' | 'STABLE' | 'DECREASING';
    confidence: number;
  };
}

export interface HotSkillItem {
  skill: string;
  demandLevel: DemandLevel;
  rateGrowth: number;
}

export interface DemandTrendResult {
  trends: SkillTrendItem[];
  hotSkills: HotSkillItem[];
  decliningSkills: HotSkillItem[];
}

// =============================================================================
// RATE HISTORY TYPES
// =============================================================================

export interface RateHistoryPeriod {
  period: string;
  avgRate: number;
  medianRate: number;
  sampleSize: number;
  demandLevel: DemandLevel;
}

export interface RateHistoryResult {
  skill: string;
  history: RateHistoryPeriod[];
  summary: {
    rateGrowth1y: number | null;
    demandTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
    volatility: 'LOW' | 'MODERATE' | 'HIGH';
  };
}

// =============================================================================
// AGGREGATE TYPES
// =============================================================================

export interface RateAggregateQuery {
  skillCategory: string;
  primarySkill?: string | null;
  experienceLevel: ExperienceLevel;
  region: string;
  periodType: PeriodType;
}

export interface RateAggregateData {
  skillCategory: string;
  primarySkill: string | null;
  experienceLevel: ExperienceLevel;
  region: string;
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  sampleSize: number;
  acceptedCount: number;
  completedCount: number;
  hourlyRateMin: number;
  hourlyRateMax: number;
  hourlyRateAvg: number;
  hourlyRateMedian: number;
  hourlyRateStdDev: number;
  hourlyRateP10: number;
  hourlyRateP25: number;
  hourlyRateP75: number;
  hourlyRateP90: number;
  fixedRateMin?: number | null;
  fixedRateMax?: number | null;
  fixedRateAvg?: number | null;
  fixedRateMedian?: number | null;
  acceptanceRateLow?: number | null;
  acceptanceRateMid?: number | null;
  acceptanceRateHigh?: number | null;
  avgRatingLowPrice?: number | null;
  avgRatingMidPrice?: number | null;
  avgRatingHighPrice?: number | null;
  compliancePremiumPct?: number | null;
  rateChangeFromPrevious?: number | null;
}

// =============================================================================
// STATS HELPER TYPES
// =============================================================================

export interface RateStatistics {
  min: number;
  max: number;
  avg: number;
  median: number;
  stdDev: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

export interface AcceptanceRatesByTier {
  low: number;
  mid: number;
  high: number;
}

export interface RatingsByTier {
  low: number | null;
  mid: number | null;
  high: number | null;
}

export interface UserBidStats {
  totalBids: number;
  acceptedBids: number;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type {
  ExperienceLevel,
  RateSourceType,
  RateType,
  PeriodType,
  RateChangeReason,
  RecommendationType,
  RecommendationStatus,
  DemandLevel,
} from '@skillancer/database';
