/**
 * @module @skillancer/market-svc/services/smartmatch/score-utils
 * Utility functions and explanation generators for SmartMatch
 */

import type {
  MatchScoreBreakdown,
  ComponentScore,
  ScoreFactor,
  SmartMatchWeights,
  MatchingCriteria,
} from '../../types/smartmatch.types.js';

// =============================================================================
// EXPLANATION GENERATOR
// =============================================================================

export interface ExplanationResult {
  explanations: string[];
  warnings: string[];
  boosts: string[];
}

export function generateExplanations(
  components: MatchScoreBreakdown['components'],
  _criteria: MatchingCriteria
): ExplanationResult {
  const explanations: string[] = [];
  const warnings: string[] = [];
  const boosts: string[] = [];

  // Top positive factors
  const positiveFactors = Object.values(components)
    .flatMap((c) => c.factors)
    .filter((f) => f.impact === 'POSITIVE')
    .slice(0, 3);

  for (const factor of positiveFactors) {
    boosts.push(factor.description);
  }

  // Top negative factors (warnings)
  const negativeFactors = Object.values(components)
    .flatMap((c) => c.factors)
    .filter((f) => f.impact === 'NEGATIVE')
    .slice(0, 3);

  for (const factor of negativeFactors) {
    warnings.push(factor.description);
  }

  // Generate summary explanation
  const topScores = Object.entries(components)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 2);

  for (const [name, component] of topScores) {
    if (component.score >= 80) {
      explanations.push(`Strong ${name} match (${component.score}%)`);
    }
  }

  return { explanations, warnings, boosts };
}

// =============================================================================
// COMPONENT SCORE BUILDER
// =============================================================================

export interface BaseScore {
  score: number;
  factors: ScoreFactor[];
}

export function buildComponentScore(baseScore: BaseScore, weight: number): ComponentScore {
  return {
    score: baseScore.score,
    weight,
    weighted: baseScore.score * weight,
    factors: baseScore.factors,
  };
}

// =============================================================================
// OVERALL SCORE CALCULATOR
// =============================================================================

export function calculateOverallScore(components: MatchScoreBreakdown['components']): number {
  const total = Object.values(components).reduce((sum, c) => sum + c.weighted, 0);
  return Math.round(total);
}

// =============================================================================
// WEIGHTS VALIDATION
// =============================================================================

export const DEFAULT_WEIGHTS: SmartMatchWeights = {
  compliance: 0.2,
  skills: 0.25,
  experience: 0.12,
  trust: 0.15,
  rate: 0.1,
  availability: 0.08,
  successHistory: 0.07,
  responsiveness: 0.03,
};

export function normalizeWeights(weights: Partial<SmartMatchWeights>): SmartMatchWeights {
  const merged = { ...DEFAULT_WEIGHTS, ...weights };

  // Ensure weights sum to 1.0
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);

  if (Math.abs(sum - 1.0) > 0.01) {
    // Normalize weights to sum to 1.0
    const factor = 1.0 / sum;
    return {
      compliance: merged.compliance * factor,
      skills: merged.skills * factor,
      experience: merged.experience * factor,
      trust: merged.trust * factor,
      rate: merged.rate * factor,
      availability: merged.availability * factor,
      successHistory: merged.successHistory * factor,
      responsiveness: merged.responsiveness * factor,
    };
  }

  return merged;
}

// =============================================================================
// SORTING UTILITIES
// =============================================================================

export type SortByOption = 'score' | 'rate' | 'trust';

export interface SortableMatch {
  score: MatchScoreBreakdown;
  freelancer: {
    hourlyRate?: number | null;
  };
}

export function sortMatches<T extends SortableMatch>(
  matches: T[],
  sortBy: SortByOption = 'score'
): T[] {
  return [...matches].sort((a, b) => {
    switch (sortBy) {
      case 'score':
        return b.score.overall - a.score.overall;
      case 'rate': {
        const rateA = a.freelancer.hourlyRate ?? Infinity;
        const rateB = b.freelancer.hourlyRate ?? Infinity;
        return rateA - rateB; // Lower rate first
      }
      case 'trust':
        return b.score.components.trust.score - a.score.components.trust.score;
      default:
        return b.score.overall - a.score.overall;
    }
  });
}

// =============================================================================
// PAGINATION UTILITIES
// =============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(items: T[], params: PaginationParams): PaginatedResult<T> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const total = items.length;
  const totalPages = Math.ceil(total / limit);

  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedItems = items.slice(start, end);

  return {
    items: paginatedItems,
    total,
    page,
    limit,
    totalPages,
  };
}

// =============================================================================
// CACHE KEY GENERATORS
// =============================================================================

export function generateScoreCacheKey(
  freelancerUserId: string,
  criteria: MatchingCriteria
): string {
  const criteriaHash = JSON.stringify({
    skills: criteria.skills?.sort(),
    requiredCompliance: criteria.requiredCompliance?.sort(),
    requiredClearance: criteria.requiredClearance,
    budgetMin: criteria.budgetMin,
    budgetMax: criteria.budgetMax,
    experienceLevel: criteria.experienceLevel,
    minTrustScore: criteria.minTrustScore,
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < criteriaHash.length; i++) {
    const char = criteriaHash.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `smartmatch:score:${freelancerUserId}:${Math.abs(hash).toString(16)}`;
}

export function generateSearchCacheKey(criteria: MatchingCriteria): string {
  const criteriaHash = JSON.stringify({
    skills: criteria.skills?.sort(),
    requiredCompliance: criteria.requiredCompliance?.sort(),
    requiredClearance: criteria.requiredClearance,
    budgetMin: criteria.budgetMin,
    budgetMax: criteria.budgetMax,
    experienceLevel: criteria.experienceLevel,
    minTrustScore: criteria.minTrustScore,
    excludeUserIds: criteria.excludeUserIds?.sort(),
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < criteriaHash.length; i++) {
    const char = criteriaHash.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return `smartmatch:search:${Math.abs(hash).toString(16)}`;
}

// =============================================================================
// SEARCH ID GENERATOR
// =============================================================================

export function generateSearchId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `srch_${timestamp}${random}`;
}

// =============================================================================
// BUDGET RANGE FORMATTER
// =============================================================================

export function formatBudgetRange(min?: number | null, max?: number | null): string {
  if (min === undefined && max === undefined) {
    return 'Open Budget';
  }
  if (min !== undefined && max !== undefined) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  }
  if (min !== undefined) {
    return `$${min.toLocaleString()}+`;
  }
  return `Up to $${max?.toLocaleString()}`;
}

// =============================================================================
// COMPETITION LEVEL CALCULATOR
// =============================================================================

export type CompetitionLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export function calculateCompetitionLevel(bidCount: number): CompetitionLevel {
  if (bidCount <= 5) return 'LOW';
  if (bidCount <= 15) return 'MEDIUM';
  return 'HIGH';
}
