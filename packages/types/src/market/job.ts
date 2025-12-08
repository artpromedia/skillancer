/**
 * @skillancer/types - Market: Job Types
 * Job posting and management schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  dateSchema,
  currencyCodeSchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Job Enums
// =============================================================================

/**
 * Job status lifecycle
 */
export const jobStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ON_HOLD',
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

/**
 * Job payment type
 */
export const jobTypeSchema = z.enum([
  'FIXED_PRICE',
  'HOURLY',
  'RETAINER',
  'MILESTONE',
]);
export type JobType = z.infer<typeof jobTypeSchema>;

/**
 * Job visibility
 */
export const jobVisibilitySchema = z.enum([
  'PUBLIC',
  'PRIVATE',
  'INVITE_ONLY',
  'TENANT_ONLY',
]);
export type JobVisibility = z.infer<typeof jobVisibilitySchema>;

/**
 * Experience level required
 */
export const experienceLevelSchema = z.enum([
  'ENTRY',
  'INTERMEDIATE',
  'EXPERT',
]);
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;

/**
 * Project duration estimate
 */
export const projectDurationSchema = z.enum([
  'LESS_THAN_WEEK',
  'ONE_TO_FOUR_WEEKS',
  'ONE_TO_THREE_MONTHS',
  'THREE_TO_SIX_MONTHS',
  'MORE_THAN_SIX_MONTHS',
  'ONGOING',
]);
export type ProjectDuration = z.infer<typeof projectDurationSchema>;

// =============================================================================
// Job Schema
// =============================================================================

/**
 * Job skill requirement
 */
export const jobSkillSchema = z.object({
  name: z.string().min(1).max(100),
  required: z.boolean().default(true),
  yearsRequired: z.number().int().nonnegative().optional(),
});
export type JobSkill = z.infer<typeof jobSkillSchema>;

/**
 * Job attachment
 */
export const jobAttachmentSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(255),
  url: z.string().url(),
  mimeType: z.string(),
  size: z.number().int().positive(),
});
export type JobAttachment = z.infer<typeof jobAttachmentSchema>;

/**
 * Complete job schema
 */
export const jobSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema.optional(),
  clientUserId: uuidSchema,
  
  // Basic info
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(10000),
  shortDescription: z.string().max(500).optional(),
  
  // Skills & requirements
  skills: z.array(jobSkillSchema).min(1).max(15),
  experienceLevel: experienceLevelSchema,
  
  // Pricing
  type: jobTypeSchema,
  budgetMin: z.number().positive(),
  budgetMax: z.number().positive(),
  currency: currencyCodeSchema.default('USD'),
  
  // Timeline
  duration: projectDurationSchema.optional(),
  timelineDays: z.number().int().positive().optional(),
  startDate: dateSchema.optional(),
  deadline: dateSchema.optional(),
  
  // Status & visibility
  status: jobStatusSchema,
  visibility: jobVisibilitySchema.default('PUBLIC'),
  
  // SkillPod integration
  secureMode: z.boolean().default(false),
  complianceRequirements: z.array(z.string()).optional(),
  requiredCertifications: z.array(z.string()).optional(),
  
  // Files
  attachments: z.array(jobAttachmentSchema).optional(),
  
  // Metadata
  category: z.string().optional(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).max(10).optional(),
  
  // Stats
  viewCount: z.number().int().nonnegative().default(0),
  bidCount: z.number().int().nonnegative().default(0),
  
  // Timestamps
  publishedAt: dateSchema.optional(),
  closesAt: dateSchema.optional(),
  ...timestampsSchema.shape,
}).refine((data) => data.budgetMin <= data.budgetMax, {
  message: 'Minimum budget must be less than or equal to maximum budget',
  path: ['budgetMax'],
});
export type Job = z.infer<typeof jobSchema>;

// =============================================================================
// Job CRUD Schemas
// =============================================================================

/**
 * Base job data for create/update
 */
const baseJobDataSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50).max(10000),
  shortDescription: z.string().max(500).optional(),
  skills: z.array(jobSkillSchema).min(1).max(15),
  experienceLevel: experienceLevelSchema,
  type: jobTypeSchema,
  budgetMin: z.number().positive(),
  budgetMax: z.number().positive(),
  currency: currencyCodeSchema.default('USD'),
  duration: projectDurationSchema.optional(),
  timelineDays: z.number().int().positive().optional(),
  startDate: dateSchema.optional(),
  deadline: dateSchema.optional(),
  visibility: jobVisibilitySchema.default('PUBLIC'),
  secureMode: z.boolean().default(false),
  complianceRequirements: z.array(z.string()).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).max(10).optional(),
});

/**
 * Create job input
 */
export const createJobSchema = baseJobDataSchema.extend({
  status: z.enum(['DRAFT', 'OPEN']).default('DRAFT'),
}).refine((data) => data.budgetMin <= data.budgetMax, {
  message: 'Minimum budget must be less than or equal to maximum budget',
  path: ['budgetMax'],
});
export type CreateJob = z.infer<typeof createJobSchema>;

/**
 * Update job input
 */
export const updateJobSchema = baseJobDataSchema.partial();
export type UpdateJob = z.infer<typeof updateJobSchema>;

/**
 * Job search/filter parameters
 */
export const jobFilterSchema = z.object({
  query: z.string().optional(),
  skills: z.array(z.string()).optional(),
  type: z.array(jobTypeSchema).optional(),
  experienceLevel: z.array(experienceLevelSchema).optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  currency: currencyCodeSchema.optional(),
  duration: z.array(projectDurationSchema).optional(),
  secureMode: z.boolean().optional(),
  category: z.string().optional(),
  clientUserId: uuidSchema.optional(),
  status: z.array(jobStatusSchema).optional(),
});
export type JobFilter = z.infer<typeof jobFilterSchema>;
