/**
 * Zod Validation Schemas for Intelligence Service
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const OutcomeTypeSchema = z.enum([
  'ON_TIME',
  'DELAYED',
  'EARLY',
  'OVER_BUDGET',
  'UNDER_BUDGET',
  'ON_BUDGET',
  'SCOPE_CHANGED',
  'CANCELLED',
]);

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const AlertStatusSchema = z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED']);

export const BenchmarkCategorySchema = z.enum([
  'RATE',
  'DURATION',
  'SUCCESS_RATE',
  'RESPONSE_TIME',
  'CLIENT_SATISFACTION',
  'REHIRE_RATE',
]);

export const InsightTypeSchema = z.enum([
  'RATE_OPTIMIZATION',
  'SKILL_GAP',
  'MARKET_TREND',
  'PERFORMANCE',
  'OPPORTUNITY',
  'RISK',
]);

// =============================================================================
// OUTCOME TRACKING SCHEMAS
// =============================================================================

export const RecordOutcomeSchema = z.object({
  engagementId: z.string().uuid(),
  outcomeType: OutcomeTypeSchema,
  completedAt: z.string().datetime(),
  actualDuration: z.number().positive().optional(),
  estimatedDuration: z.number().positive().optional(),
  actualBudget: z.number().positive().optional(),
  estimatedBudget: z.number().positive().optional(),
  clientSatisfactionScore: z.number().int().min(1).max(5).optional(),
  freelancerSatisfactionScore: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const UpdateOutcomeSchema = z.object({
  clientSatisfactionScore: z.number().int().min(1).max(5).optional(),
  freelancerSatisfactionScore: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// =============================================================================
// PREDICTION SCHEMAS
// =============================================================================

export const RequestPredictionSchema = z.object({
  engagementId: z.string().uuid().optional(),
  freelancerId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  predictionType: z.enum([
    'SUCCESS_PROBABILITY',
    'COMPLETION_TIME',
    'BUDGET_VARIANCE',
    'CLIENT_SATISFACTION',
    'RISK_SCORE',
  ]),
  context: z.object({
    skills: z.array(z.string().max(50)).max(20).optional(),
    budget: z.number().positive().optional(),
    duration: z.number().positive().optional(),
    complexity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  }).optional(),
}).refine(
  (data) => data.engagementId || data.freelancerId || data.clientId,
  { message: 'At least one of engagementId, freelancerId, or clientId must be provided' }
);

export const GetPredictionsQuerySchema = z.object({
  engagementId: z.string().uuid().optional(),
  freelancerId: z.string().uuid().optional(),
  predictionType: z.string().optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// =============================================================================
// RISK ALERT SCHEMAS
// =============================================================================

export const CreateRiskAlertSchema = z.object({
  engagementId: z.string().uuid(),
  riskLevel: RiskLevelSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  suggestedActions: z.array(z.string().max(500)).max(5).optional(),
  dueDate: z.string().datetime().optional(),
});

export const UpdateRiskAlertSchema = z.object({
  status: AlertStatusSchema,
  resolution: z.string().max(1000).optional(),
});

export const GetRiskAlertsQuerySchema = z.object({
  engagementId: z.string().uuid().optional(),
  riskLevel: RiskLevelSchema.optional(),
  status: AlertStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// =============================================================================
// BENCHMARK SCHEMAS
// =============================================================================

export const GetBenchmarksQuerySchema = z.object({
  category: BenchmarkCategorySchema,
  skills: z.array(z.string().max(50)).min(1).max(10),
  industry: z.string().max(100).optional(),
  experience: z.number().int().min(0).max(50).optional(),
  location: z.string().max(100).optional(),
});

export const CompareToBenchmarkSchema = z.object({
  category: BenchmarkCategorySchema,
  value: z.number(),
  skills: z.array(z.string().max(50)).min(1).max(10),
  industry: z.string().max(100).optional(),
});

// =============================================================================
// INSIGHT SCHEMAS
// =============================================================================

export const GetInsightsQuerySchema = z.object({
  type: InsightTypeSchema.optional(),
  skills: z.array(z.string().max(50)).max(10).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

export const GenerateInsightReportSchema = z.object({
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  reportType: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']),
  includeCategories: z.array(InsightTypeSchema).optional(),
  format: z.enum(['PDF', 'JSON', 'HTML']).optional().default('PDF'),
});

// =============================================================================
// ANALYTICS SCHEMAS
// =============================================================================

export const GetAnalyticsQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  metrics: z.array(z.enum([
    'TOTAL_ENGAGEMENTS',
    'SUCCESS_RATE',
    'AVERAGE_DURATION',
    'AVERAGE_BUDGET',
    'CLIENT_SATISFACTION',
    'ON_TIME_DELIVERY',
    'REPEAT_CLIENT_RATE',
  ])).min(1).max(10),
  groupBy: z.enum(['DAY', 'WEEK', 'MONTH']).optional().default('WEEK'),
  filters: z.object({
    skills: z.array(z.string().max(50)).max(10).optional(),
    clients: z.array(z.string().uuid()).max(10).optional(),
    freelancers: z.array(z.string().uuid()).max(10).optional(),
  }).optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type RecordOutcomeInput = z.infer<typeof RecordOutcomeSchema>;
export type UpdateOutcomeInput = z.infer<typeof UpdateOutcomeSchema>;
export type RequestPredictionInput = z.infer<typeof RequestPredictionSchema>;
export type CreateRiskAlertInput = z.infer<typeof CreateRiskAlertSchema>;
export type GetBenchmarksQuery = z.infer<typeof GetBenchmarksQuerySchema>;
export type GetInsightsQuery = z.infer<typeof GetInsightsQuerySchema>;
export type GetAnalyticsQuery = z.infer<typeof GetAnalyticsQuerySchema>;
