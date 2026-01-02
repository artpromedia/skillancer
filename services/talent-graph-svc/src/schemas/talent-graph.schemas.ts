/**
 * Zod Validation Schemas for Talent Graph Service
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const RelationshipTypeSchema = z.enum([
  'WORKED_WITH',
  'MANAGED_BY',
  'MANAGED',
  'MENTORED_BY',
  'MENTORED',
  'REFERRED_BY',
  'REFERRED',
  'COLLABORATED',
]);

export const RelationshipStrengthSchema = z.enum(['WEAK', 'MODERATE', 'STRONG', 'VERY_STRONG']);

export const IntroductionStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'COMPLETED',
]);

export const ReunionStatusSchema = z.enum([
  'PROPOSED',
  'PLANNING',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

// =============================================================================
// WORK RELATIONSHIP SCHEMAS
// =============================================================================

export const CreateRelationshipSchema = z.object({
  connectedUserId: z.string().uuid(),
  relationshipType: RelationshipTypeSchema,
  strength: RelationshipStrengthSchema.optional().default('MODERATE'),
  projectId: z.string().uuid().optional(),
  engagementId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  skills: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(1000).optional(),
  isPublic: z.boolean().optional().default(false),
});

export const UpdateRelationshipSchema = z.object({
  strength: RelationshipStrengthSchema.optional(),
  endDate: z.string().datetime().optional(),
  skills: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

export const EndorseRelationshipSchema = z.object({
  relationshipId: z.string().uuid(),
  endorsement: z.string().min(10).max(500),
  skills: z.array(z.string().max(50)).max(5).optional(),
});

// =============================================================================
// WARM INTRODUCTION SCHEMAS
// =============================================================================

export const RequestIntroductionSchema = z.object({
  targetUserId: z.string().uuid(),
  connectorUserId: z.string().uuid(),
  purpose: z.string().min(10).max(1000),
  context: z.string().max(2000).optional(),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH']).optional().default('NORMAL'),
  expiresAt: z.string().datetime().optional(),
});

export const RespondToIntroductionSchema = z.object({
  introductionId: z.string().uuid(),
  response: z.enum(['ACCEPT', 'DECLINE']),
  message: z.string().max(1000).optional(),
});

export const CompleteIntroductionSchema = z.object({
  introductionId: z.string().uuid(),
  outcome: z.enum(['SUCCESSFUL', 'NOT_A_FIT', 'NO_RESPONSE', 'OTHER']),
  feedback: z.string().max(500).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

// =============================================================================
// TEAM REUNION SCHEMAS
// =============================================================================

export const ProposeReunionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  originalProjectId: z.string().uuid().optional(),
  originalEngagementId: z.string().uuid().optional(),
  invitedUserIds: z.array(z.string().uuid()).min(1).max(50),
  proposedStartDate: z.string().datetime().optional(),
  proposedScope: z.string().max(5000).optional(),
  requiredSkills: z.array(z.string().max(50)).max(20).optional(),
});

export const UpdateReunionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  proposedStartDate: z.string().datetime().optional(),
  proposedScope: z.string().max(5000).optional(),
  status: ReunionStatusSchema.optional(),
});

export const RespondToReunionSchema = z.object({
  reunionId: z.string().uuid(),
  response: z.enum(['INTERESTED', 'NOT_INTERESTED', 'MAYBE']),
  message: z.string().max(500).optional(),
  availability: z.string().max(500).optional(),
});

// =============================================================================
// GRAPH QUERY SCHEMAS
// =============================================================================

export const GetConnectionsQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(3).optional().default(1),
  relationshipType: RelationshipTypeSchema.optional(),
  minStrength: RelationshipStrengthSchema.optional(),
  skills: z.array(z.string().max(50)).max(10).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const FindPathQuerySchema = z.object({
  targetUserId: z.string().uuid(),
  maxDepth: z.coerce.number().int().min(1).max(5).optional().default(3),
});

export const GetRecommendationsQuerySchema = z.object({
  purpose: z.enum(['COLLABORATION', 'MENTORSHIP', 'REFERRAL', 'TEAM_BUILDING']),
  skills: z.array(z.string().max(50)).max(10).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

export const GetIntroductionsQuerySchema = z.object({
  status: IntroductionStatusSchema.optional(),
  role: z.enum(['REQUESTER', 'CONNECTOR', 'TARGET']).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const GetReunionsQuerySchema = z.object({
  status: ReunionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateRelationshipInput = z.infer<typeof CreateRelationshipSchema>;
export type UpdateRelationshipInput = z.infer<typeof UpdateRelationshipSchema>;
export type RequestIntroductionInput = z.infer<typeof RequestIntroductionSchema>;
export type ProposeReunionInput = z.infer<typeof ProposeReunionSchema>;
export type GetConnectionsQuery = z.infer<typeof GetConnectionsQuerySchema>;
export type FindPathQuery = z.infer<typeof FindPathQuerySchema>;
