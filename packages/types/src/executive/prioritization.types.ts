/**
 * @skillancer/types - Prioritization Types
 * Feature prioritization framework types and validation schemas
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const PrioritizationFrameworkEnum = z.enum([
  'RICE',
  'ICE',
  'VALUE_EFFORT',
  'KANO',
  'MOSCOW',
  'CUSTOM',
]);
export type PrioritizationFramework = z.infer<typeof PrioritizationFrameworkEnum>;

export const FeatureStatusEnum = z.enum([
  'IDEA',
  'BACKLOG',
  'PLANNED',
  'IN_PROGRESS',
  'SHIPPED',
  'DEPRECATED',
]);
export type FeatureStatus = z.infer<typeof FeatureStatusEnum>;

export const FeatureTierEnum = z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'NICE_TO_HAVE', 'WONT_HAVE']);
export type FeatureTier = z.infer<typeof FeatureTierEnum>;

// =============================================================================
// SCORING CONFIGURATION SCHEMAS
// =============================================================================

export const customCriteriaSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
  description: z.string().optional(),
  scale: z
    .object({
      min: z.number(),
      max: z.number(),
      labels: z.record(z.string()).optional(), // { "1": "Very Low", "5": "Very High" }
    })
    .optional(),
});
export type CustomCriteria = z.infer<typeof customCriteriaSchema>;

export const impactLevelSchema = z.object({
  value: z.number(),
  label: z.string(),
  description: z.string().optional(),
});
export type ImpactLevel = z.infer<typeof impactLevelSchema>;

// =============================================================================
// RICE SCORING
// =============================================================================

export const riceScoresSchema = z.object({
  reach: z.number().int().min(0), // Users affected per quarter
  impact: z.number().min(0.25).max(3), // 0.25 (minimal), 0.5 (low), 1 (medium), 2 (high), 3 (massive)
  confidence: z.number().int().min(0).max(100), // 0-100%
  effort: z.number().positive(), // Person-weeks
});
export type RICEScores = z.infer<typeof riceScoresSchema>;

export const riceImpactLevels: ImpactLevel[] = [
  { value: 0.25, label: 'Minimal', description: 'Barely noticeable improvement' },
  { value: 0.5, label: 'Low', description: 'Small but meaningful improvement' },
  { value: 1, label: 'Medium', description: 'Noticeable improvement for users' },
  { value: 2, label: 'High', description: 'Significant improvement' },
  { value: 3, label: 'Massive', description: 'Game-changing improvement' },
];

/**
 * Calculate RICE score: (Reach × Impact × Confidence) / Effort
 */
export function calculateRICEScore(scores: RICEScores): number {
  const { reach, impact, confidence, effort } = scores;
  if (effort === 0) return 0;
  return (reach * impact * (confidence / 100)) / effort;
}

// =============================================================================
// ICE SCORING
// =============================================================================

export const iceScoresSchema = z.object({
  impact: z.number().int().min(1).max(10),
  confidence: z.number().int().min(1).max(10),
  ease: z.number().int().min(1).max(10),
});
export type ICEScores = z.infer<typeof iceScoresSchema>;

/**
 * Calculate ICE score: Impact × Confidence × Ease
 */
export function calculateICEScore(scores: ICEScores): number {
  return scores.impact * scores.confidence * scores.ease;
}

// =============================================================================
// VALUE/EFFORT SCORING
// =============================================================================

export const valueEffortScoresSchema = z.object({
  value: z.number().int().min(1).max(10),
  effort: z.number().int().min(1).max(10),
});
export type ValueEffortScores = z.infer<typeof valueEffortScoresSchema>;

/**
 * Calculate Value/Effort score
 */
export function calculateValueEffortScore(scores: ValueEffortScores): number {
  if (scores.effort === 0) return 0;
  return scores.value / scores.effort;
}

/**
 * Determine quadrant for value/effort matrix
 */
export function getValueEffortQuadrant(scores: ValueEffortScores): string {
  const isHighValue = scores.value >= 6;
  const isHighEffort = scores.effort >= 6;

  if (isHighValue && !isHighEffort) return 'quick-wins'; // High value, low effort
  if (isHighValue && isHighEffort) return 'big-bets'; // High value, high effort
  if (!isHighValue && !isHighEffort) return 'fill-ins'; // Low value, low effort
  return 'money-pits'; // Low value, high effort
}

// =============================================================================
// MOSCOW SCORING
// =============================================================================

export const moscowCategorySchema = z.enum(['must', 'should', 'could', 'wont']);
export type MoSCoWCategory = z.infer<typeof moscowCategorySchema>;

// =============================================================================
// FEATURE SCHEMAS
// =============================================================================

export const prioritizedFeatureSchema = z.object({
  id: z.string().uuid(),
  prioritizationId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),

  // RICE scores
  reach: z.number().int().nullable().optional(),
  impact: z.number().nullable().optional(),
  confidence: z.number().int().nullable().optional(),
  effort: z.number().nullable().optional(),

  // ICE scores
  iceImpact: z.number().int().nullable().optional(),
  iceConfidence: z.number().int().nullable().optional(),
  iceEase: z.number().int().nullable().optional(),

  // Value/Effort scores
  valueScore: z.number().int().nullable().optional(),
  effortScore: z.number().int().nullable().optional(),

  // Custom scores
  customScores: z.record(z.number()).nullable().optional(),

  // Calculated results
  score: z.number().nullable().optional(),
  rank: z.number().int().nullable().optional(),
  tier: z.string().nullable().optional(),

  // External source
  externalId: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  externalUrl: z.string().url().nullable().optional(),

  // Status
  status: FeatureStatusEnum,
  roadmapQuarter: z.string().nullable().optional(),

  // Related PRD
  relatedPrdId: z.string().uuid().nullable().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PrioritizedFeature = z.infer<typeof prioritizedFeatureSchema>;

export const createFeatureSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),

  // RICE scores
  reach: z.number().int().min(0).optional(),
  impact: z.number().min(0.25).max(3).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  effort: z.number().positive().optional(),

  // ICE scores
  iceImpact: z.number().int().min(1).max(10).optional(),
  iceConfidence: z.number().int().min(1).max(10).optional(),
  iceEase: z.number().int().min(1).max(10).optional(),

  // Value/Effort scores
  valueScore: z.number().int().min(1).max(10).optional(),
  effortScore: z.number().int().min(1).max(10).optional(),

  // Custom scores
  customScores: z.record(z.number()).optional(),

  // External source
  externalId: z.string().optional(),
  externalSource: z.string().optional(),
  externalUrl: z.string().url().optional(),

  // Status
  status: FeatureStatusEnum.optional().default('BACKLOG'),
  roadmapQuarter: z.string().optional(),
  tier: z.string().optional(),

  // Related PRD
  relatedPrdId: z.string().uuid().optional(),
});
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;

export const updateFeatureSchema = createFeatureSchema.partial();
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;

// =============================================================================
// PRIORITIZATION FRAMEWORK SCHEMAS
// =============================================================================

export const featurePrioritizationSchema = z.object({
  id: z.string().uuid(),
  engagementId: z.string().uuid(),
  framework: PrioritizationFrameworkEnum,
  customWeights: z.record(z.unknown()).nullable().optional(),
  impactLevels: z.array(impactLevelSchema).nullable().optional(),
  effortLevels: z.array(impactLevelSchema).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type FeaturePrioritization = z.infer<typeof featurePrioritizationSchema>;

export const createPrioritizationSchema = z.object({
  engagementId: z.string().uuid(),
  framework: PrioritizationFrameworkEnum.optional().default('RICE'),
  customWeights: z.record(z.unknown()).optional(),
  impactLevels: z.array(impactLevelSchema).optional(),
  effortLevels: z.array(impactLevelSchema).optional(),
});
export type CreatePrioritizationInput = z.infer<typeof createPrioritizationSchema>;

export const updatePrioritizationSchema = createPrioritizationSchema.partial().omit({
  engagementId: true,
});
export type UpdatePrioritizationInput = z.infer<typeof updatePrioritizationSchema>;

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface FeaturePrioritizationWithFeatures extends FeaturePrioritization {
  features: PrioritizedFeature[];
}

export interface RankedFeaturesResponse {
  features: PrioritizedFeature[];
  total: number;
  framework: PrioritizationFramework;
}

export interface PriorityMatrixData {
  quadrants: {
    quickWins: PrioritizedFeature[];
    bigBets: PrioritizedFeature[];
    fillIns: PrioritizedFeature[];
    moneyPits: PrioritizedFeature[];
  };
  framework: PrioritizationFramework;
}

// =============================================================================
// SYNC TYPES (for external tools)
// =============================================================================

export interface ExternalFeatureSync {
  source: 'productboard' | 'aha' | 'linear' | 'jira';
  externalId: string;
  title: string;
  description?: string;
  status?: string;
  score?: number;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ externalId: string; error: string }>;
}
