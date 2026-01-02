/**
 * Zod Validation Schemas for Copilot Service
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const InteractionTypeSchema = z.enum([
  'PROPOSAL_DRAFT',
  'RATE_SUGGEST',
  'MESSAGE_ASSIST',
  'PROFILE_OPTIMIZE',
  'MARKET_INSIGHT',
]);

export const ToneSchema = z.enum(['PROFESSIONAL', 'FRIENDLY', 'FORMAL', 'CASUAL']);

export const MessageIntentSchema = z.enum([
  'NEGOTIATE',
  'CLARIFY',
  'DECLINE',
  'ACCEPT',
  'FOLLOW_UP',
]);

export const ProjectComplexitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const DraftStatusSchema = z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']);

// =============================================================================
// PROPOSAL DRAFT SCHEMAS
// =============================================================================

export const BudgetRangeSchema = z.object({
  min: z.number().positive(),
  max: z.number().positive(),
}).refine((data) => data.max >= data.min, {
  message: 'Max budget must be greater than or equal to min budget',
});

export const GenerateProposalDraftSchema = z.object({
  jobId: z.string().uuid(),
  jobTitle: z.string().min(1).max(200),
  jobDescription: z.string().min(10).max(10000),
  requiredSkills: z.array(z.string().min(1).max(50)).min(1).max(20),
  userSkills: z.array(z.string().min(1).max(50)).min(1).max(50),
  clientName: z.string().min(1).max(100).optional(),
  clientIndustry: z.string().min(1).max(100).optional(),
  budget: BudgetRangeSchema.optional(),
  proposedTimeline: z.string().max(200).optional(),
  tone: ToneSchema.optional().default('PROFESSIONAL'),
  emphasis: z.array(z.string().max(100)).max(5).optional(),
});

export const UpdateProposalDraftSchema = z.object({
  content: z.string().min(100).max(10000),
});

export const GetProposalDraftsQuerySchema = z.object({
  status: DraftStatusSchema.optional(),
});

// =============================================================================
// RATE SUGGESTION SCHEMAS
// =============================================================================

export const SuggestRateSchema = z.object({
  skills: z.array(z.string().min(1).max(50)).min(1).max(20),
  experience: z.number().int().min(0).max(50),
  industry: z.string().min(1).max(100).optional(),
  location: z.string().max(100).optional(),
  projectComplexity: ProjectComplexitySchema.optional().default('MEDIUM'),
  projectDuration: z.string().max(100).optional(),
  clientSize: z.enum(['STARTUP', 'SMB', 'ENTERPRISE']).optional(),
});

// =============================================================================
// MESSAGE ASSIST SCHEMAS
// =============================================================================

export const AssistMessageSchema = z.object({
  conversationContext: z.array(z.string()).max(20),
  draftMessage: z.string().max(5000).optional(),
  intent: MessageIntentSchema.optional(),
  tone: ToneSchema.optional().default('PROFESSIONAL'),
  keyPoints: z.array(z.string().max(200)).max(10).optional(),
});

// =============================================================================
// PROFILE OPTIMIZATION SCHEMAS
// =============================================================================

export const ExperienceItemSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  duration: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
});

export const OptimizeProfileSchema = z.object({
  currentHeadline: z.string().max(200).optional(),
  currentSummary: z.string().max(5000).optional(),
  skills: z.array(z.string().min(1).max(50)).min(1).max(50),
  experience: z.array(ExperienceItemSchema).max(20),
  targetRoles: z.array(z.string().max(100)).max(10).optional(),
  targetIndustries: z.array(z.string().max(100)).max(10).optional(),
});

// =============================================================================
// MARKET INSIGHTS SCHEMAS
// =============================================================================

export const GetMarketInsightsSchema = z.object({
  skills: z.array(z.string().min(1).max(50)).min(1).max(10),
  industry: z.string().min(1).max(100).optional(),
  location: z.string().max(100).optional(),
  timeframe: z.enum(['1m', '3m', '6m', '1y']).optional().default('3m'),
});

// =============================================================================
// HISTORY SCHEMAS
// =============================================================================

export const GetHistoryQuerySchema = z.object({
  type: InteractionTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type GenerateProposalDraftInput = z.infer<typeof GenerateProposalDraftSchema>;
export type UpdateProposalDraftInput = z.infer<typeof UpdateProposalDraftSchema>;
export type SuggestRateInput = z.infer<typeof SuggestRateSchema>;
export type AssistMessageInput = z.infer<typeof AssistMessageSchema>;
export type OptimizeProfileInput = z.infer<typeof OptimizeProfileSchema>;
export type GetMarketInsightsInput = z.infer<typeof GetMarketInsightsSchema>;
