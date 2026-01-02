/**
 * Zod Validation Schemas for Executive Service
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const ExecutiveTypeSchema = z.enum(['ELITE', 'PREMIER', 'SIGNATURE']);

export const EngagementStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
]);

export const BillingTypeSchema = z.enum(['FIXED', 'HOURLY', 'MILESTONE', 'RETAINER']);

export const WorkspaceTypeSchema = z.enum(['SHARED', 'DEDICATED', 'ENTERPRISE']);

export const IntegrationCategorySchema = z.enum([
  'COMMUNICATION',
  'PROJECT_MANAGEMENT',
  'DEVELOPMENT',
  'DESIGN',
  'FINANCE',
  'STORAGE',
  'CRM',
  'OTHER',
]);

export const IntegrationStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED', 'ERROR']);

// =============================================================================
// EXECUTIVE PROFILE SCHEMAS
// =============================================================================

export const CreateExecutiveProfileSchema = z.object({
  executiveType: ExecutiveTypeSchema,
  companyName: z.string().min(1).max(200),
  industry: z.string().min(1).max(100),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
  annualBudget: z.number().positive().optional(),
  preferredEngagementTypes: z.array(z.string().max(50)).max(10).optional(),
  specialRequirements: z.string().max(2000).optional(),
});

export const UpdateExecutiveProfileSchema = CreateExecutiveProfileSchema.partial();

// =============================================================================
// ENGAGEMENT SCHEMAS
// =============================================================================

export const MilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueDate: z.string().datetime(),
  amount: z.number().positive(),
});

export const CreateEngagementSchema = z.object({
  executiveProfileId: z.string().uuid(),
  freelancerIds: z.array(z.string().uuid()).min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(10000),
  scope: z.string().max(5000).optional(),
  billingType: BillingTypeSchema,
  hourlyRate: z.number().positive().optional(),
  fixedAmount: z.number().positive().optional(),
  retainerAmount: z.number().positive().optional(),
  estimatedHours: z.number().positive().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  milestones: z.array(MilestoneSchema).max(50).optional(),
  ndaRequired: z.boolean().optional().default(false),
  dedicatedSupport: z.boolean().optional().default(false),
}).refine(
  (data) => {
    if (data.billingType === 'HOURLY' && !data.hourlyRate) return false;
    if (data.billingType === 'FIXED' && !data.fixedAmount) return false;
    if (data.billingType === 'RETAINER' && !data.retainerAmount) return false;
    if (data.billingType === 'MILESTONE' && (!data.milestones || data.milestones.length === 0)) return false;
    return true;
  },
  { message: 'Required billing details must be provided based on billing type' }
);

export const UpdateEngagementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(10000).optional(),
  scope: z.string().max(5000).optional(),
  endDate: z.string().datetime().optional(),
  status: EngagementStatusSchema.optional(),
});

export const AddEngagementMilestoneSchema = MilestoneSchema;

// =============================================================================
// WORKSPACE SCHEMAS
// =============================================================================

export const CreateWorkspaceSchema = z.object({
  engagementId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: WorkspaceTypeSchema,
  settings: z.object({
    allowFileSharing: z.boolean().optional().default(true),
    allowVideoCall: z.boolean().optional().default(true),
    retentionDays: z.number().int().min(30).max(3650).optional().default(365),
  }).optional(),
});

export const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.object({
    allowFileSharing: z.boolean().optional(),
    allowVideoCall: z.boolean().optional(),
    retentionDays: z.number().int().min(30).max(3650).optional(),
  }).optional(),
});

// =============================================================================
// INTEGRATION SCHEMAS
// =============================================================================

export const ConnectIntegrationSchema = z.object({
  integrationType: z.string().min(1).max(50),
  authorizationCode: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const UpdateIntegrationSchema = z.object({
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const SyncIntegrationSchema = z.object({
  integrationId: z.string().uuid(),
  fullSync: z.boolean().optional().default(false),
});

// =============================================================================
// QUERY SCHEMAS
// =============================================================================

export const ListEngagementsQuerySchema = z.object({
  status: EngagementStatusSchema.optional(),
  executiveProfileId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const ListIntegrationsQuerySchema = z.object({
  category: IntegrationCategorySchema.optional(),
  status: IntegrationStatusSchema.optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateExecutiveProfileInput = z.infer<typeof CreateExecutiveProfileSchema>;
export type UpdateExecutiveProfileInput = z.infer<typeof UpdateExecutiveProfileSchema>;
export type CreateEngagementInput = z.infer<typeof CreateEngagementSchema>;
export type UpdateEngagementInput = z.infer<typeof UpdateEngagementSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type ConnectIntegrationInput = z.infer<typeof ConnectIntegrationSchema>;
