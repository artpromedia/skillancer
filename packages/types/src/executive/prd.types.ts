/**
 * @skillancer/types - PRD Types
 * Product Requirements Document types and validation schemas
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const PRDStatusEnum = z.enum([
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'IN_DEVELOPMENT',
  'SHIPPED',
  'ARCHIVED',
]);
export type PRDStatus = z.infer<typeof PRDStatusEnum>;

// =============================================================================
// PRD CONTENT SCHEMAS
// =============================================================================

export const prdGoalSchema = z.object({
  id: z.string().uuid().optional(),
  goal: z.string().min(1),
  metric: z.string().optional(),
  target: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});
export type PRDGoal = z.infer<typeof prdGoalSchema>;

export const userStorySchema = z.object({
  id: z.string().uuid().optional(),
  as: z.string().min(1), // "As a [user type]"
  iWant: z.string().min(1), // "I want to [action]"
  soThat: z.string().min(1), // "So that [benefit]"
  acceptanceCriteria: z.array(z.string()).optional(),
  priority: z.enum(['must-have', 'should-have', 'could-have', 'wont-have']).optional(),
  storyPoints: z.number().optional(),
});
export type UserStory = z.infer<typeof userStorySchema>;

export const prdRequirementSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['functional', 'non-functional']),
  category: z.string().optional(), // "Security", "Performance", "Usability", etc.
  description: z.string().min(1),
  priority: z.enum(['p0', 'p1', 'p2', 'p3']).optional(),
  acceptance: z.string().optional(),
});
export type PRDRequirement = z.infer<typeof prdRequirementSchema>;

export const successMetricSchema = z.object({
  id: z.string().uuid().optional(),
  metric: z.string().min(1),
  baseline: z.string().optional(),
  target: z.string().min(1),
  source: z.string().optional(), // "Amplitude", "Mixpanel", "Internal"
  measurementPeriod: z.string().optional(),
});
export type SuccessMetric = z.infer<typeof successMetricSchema>;

export const prdPhaseSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  milestones: z
    .array(
      z.object({
        name: z.string(),
        date: z.string().optional(),
        status: z.enum(['pending', 'in-progress', 'complete']).optional(),
      })
    )
    .optional(),
});
export type PRDPhase = z.infer<typeof prdPhaseSchema>;

export const prdTimelineSchema = z.object({
  phases: z.array(prdPhaseSchema),
});
export type PRDTimeline = z.infer<typeof prdTimelineSchema>;

// =============================================================================
// PRD MAIN SCHEMAS
// =============================================================================

export const prdSchema = z.object({
  id: z.string().uuid(),
  engagementId: z.string().uuid(),
  title: z.string().min(1),
  status: PRDStatusEnum,
  overview: z.string().nullable().optional(),
  problemStatement: z.string().nullable().optional(),
  goals: z.array(prdGoalSchema),
  userStories: z.array(userStorySchema),
  requirements: z.array(prdRequirementSchema),
  successMetrics: z.array(successMetricSchema),
  timeline: prdTimelineSchema.nullable().optional(),
  openQuestions: z.array(z.string()),
  appendix: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  reviewers: z.array(z.string().uuid()),
  templateId: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PRD = z.infer<typeof prdSchema>;

export const createPRDSchema = z.object({
  engagementId: z.string().uuid(),
  title: z.string().min(1).max(200),
  overview: z.string().optional(),
  problemStatement: z.string().optional(),
  goals: z.array(prdGoalSchema).optional().default([]),
  userStories: z.array(userStorySchema).optional().default([]),
  requirements: z.array(prdRequirementSchema).optional().default([]),
  successMetrics: z.array(successMetricSchema).optional().default([]),
  timeline: prdTimelineSchema.optional(),
  openQuestions: z.array(z.string()).optional().default([]),
  appendix: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  reviewers: z.array(z.string().uuid()).optional().default([]),
  templateId: z.string().uuid().optional(),
});
export type CreatePRDInput = z.infer<typeof createPRDSchema>;

export const updatePRDSchema = createPRDSchema.partial().omit({ engagementId: true }).extend({
  status: PRDStatusEnum.optional(),
});
export type UpdatePRDInput = z.infer<typeof updatePRDSchema>;

// =============================================================================
// PRD COMMENT SCHEMAS
// =============================================================================

export const prdCommentSchema = z.object({
  id: z.string().uuid(),
  prdId: z.string().uuid(),
  section: z.string(),
  content: z.string(),
  authorId: z.string().uuid(),
  resolved: z.boolean(),
  resolvedAt: z.date().nullable().optional(),
  resolvedBy: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PRDComment = z.infer<typeof prdCommentSchema>;

export const createPRDCommentSchema = z.object({
  prdId: z.string().uuid(),
  section: z.string().min(1),
  content: z.string().min(1),
  parentId: z.string().uuid().optional(),
});
export type CreatePRDCommentInput = z.infer<typeof createPRDCommentSchema>;

// =============================================================================
// PRD VERSION SCHEMAS
// =============================================================================

export const prdVersionSchema = z.object({
  id: z.string().uuid(),
  prdId: z.string().uuid(),
  version: z.number().int().positive(),
  content: z.record(z.unknown()), // Full PRD snapshot as JSON
  changedBy: z.string().uuid(),
  changeNote: z.string().nullable().optional(),
  changes: z.array(z.string()).nullable().optional(), // List of changed fields
  createdAt: z.date(),
});
export type PRDVersion = z.infer<typeof prdVersionSchema>;

// =============================================================================
// PRD TEMPLATE SCHEMAS
// =============================================================================

export const prdTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  content: z.record(z.unknown()),
  isSystem: z.boolean(),
  createdBy: z.string().uuid().nullable().optional(),
  isPublic: z.boolean(),
  useCount: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PRDTemplate = z.infer<typeof prdTemplateSchema>;

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface PRDWithRelations extends PRD {
  comments?: PRDComment[];
  versions?: PRDVersion[];
  engagement?: {
    id: string;
    title: string;
    clientTenantId: string;
  };
}

export interface PRDListResponse {
  prds: PRD[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PRDExportFormat {
  format: 'pdf' | 'notion' | 'confluence' | 'markdown' | 'json';
}
