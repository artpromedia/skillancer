/**
 * @module @skillancer/market-svc/services/smartmatch
 * SmartMatch module exports
 */

// Service
export { SmartMatchService } from './smartmatch.service.js';

// Scoring functions
export {
  scoreCompliance,
  scoreSkills,
  scoreExperience,
  scoreTrust,
  scoreRate,
  scoreAvailability,
  scoreSuccessHistory,
  scoreResponsiveness,
} from './scoring-functions.js';

// Score utilities
export {
  buildComponentScore,
  calculateOverallScore,
  generateExplanations,
  normalizeWeights,
  sortMatches,
  paginate,
  generateSearchId,
  generateMatchCacheKey,
  generateWorkPatternCacheKey,
  generateMarketRateCacheKey,
  formatBudgetRange,
  calculateCompetitionLevel,
} from './score-utils.js';

// Types (re-export for convenience)
export type {
  MatchScoreBreakdown,
  ComponentScore,
  MatchingCriteria,
  SmartMatchConfig,
  SmartMatchWeights,
  FreelancerSuccessMetrics,
  FreelancerWorkPattern,
  RateIntelligence,
  MatchedFreelancer,
  FindMatchesResult,
  FreelancerProfileSummary,
  ComplianceStatus,
  RelatedSkillMatch,
} from '../../types/smartmatch.types.js';
