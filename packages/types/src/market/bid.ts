/**
 * @skillancer/types - Market: Bid Types
 * Bid/proposal schemas for job applications
 */

import { z } from 'zod';

import { jobTypeSchema } from './job';
import {
  uuidSchema,
  dateSchema,
  currencyCodeSchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Bid Enums
// =============================================================================

/**
 * Bid status lifecycle
 */
export const bidStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
]);
export type BidStatus = z.infer<typeof bidStatusSchema>;

// =============================================================================
// Bid Schema
// =============================================================================

/**
 * Milestone in a bid (for milestone-based projects)
 */
export const bidMilestoneSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  amount: z.number().positive(),
  durationDays: z.number().int().positive(),
  order: z.number().int().nonnegative(),
});
export type BidMilestone = z.infer<typeof bidMilestoneSchema>;

/**
 * Complete bid schema
 */
export const bidSchema = z.object({
  id: uuidSchema,
  jobId: uuidSchema,
  freelancerUserId: uuidSchema,
  tenantId: uuidSchema.optional(),
  
  // Proposal content
  coverLetter: z.string().min(100).max(5000),
  proposedApproach: z.string().max(3000).optional(),
  relevantExperience: z.string().max(2000).optional(),
  
  // Pricing
  type: jobTypeSchema,
  amount: z.number().positive(),
  currency: currencyCodeSchema.default('USD'),
  hourlyRate: z.number().positive().optional(), // For hourly jobs
  estimatedHours: z.number().positive().optional(),
  
  // Milestones (for milestone-based projects)
  milestones: z.array(bidMilestoneSchema).optional(),
  
  // Timeline
  estimatedDurationDays: z.number().int().positive().optional(),
  availableStartDate: dateSchema.optional(),
  
  // Status
  status: bidStatusSchema,
  
  // Attachments/samples
  attachments: z.array(z.object({
    id: uuidSchema,
    name: z.string(),
    url: z.string().url(),
    mimeType: z.string(),
    size: z.number().int().positive(),
  })).optional(),
  portfolioItems: z.array(uuidSchema).optional(),
  
  // Client response
  clientMessage: z.string().max(2000).optional(),
  shortlistedAt: dateSchema.optional(),
  acceptedAt: dateSchema.optional(),
  rejectedAt: dateSchema.optional(),
  rejectionReason: z.string().max(500).optional(),
  
  // Metadata
  isBookmarked: z.boolean().default(false),
  viewedByClient: z.boolean().default(false),
  viewedAt: dateSchema.optional(),
  
  // Timestamps
  submittedAt: dateSchema.optional(),
  expiresAt: dateSchema.optional(),
  ...timestampsSchema.shape,
});
export type Bid = z.infer<typeof bidSchema>;

// =============================================================================
// Bid CRUD Schemas
// =============================================================================

/**
 * Create bid input
 */
export const createBidSchema = z.object({
  jobId: uuidSchema,
  coverLetter: z.string().min(100).max(5000),
  proposedApproach: z.string().max(3000).optional(),
  relevantExperience: z.string().max(2000).optional(),
  type: jobTypeSchema,
  amount: z.number().positive(),
  currency: currencyCodeSchema.default('USD'),
  hourlyRate: z.number().positive().optional(),
  estimatedHours: z.number().positive().optional(),
  milestones: z.array(bidMilestoneSchema.omit({ id: true })).optional(),
  estimatedDurationDays: z.number().int().positive().optional(),
  availableStartDate: dateSchema.optional(),
  portfolioItems: z.array(uuidSchema).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT'),
});
export type CreateBid = z.infer<typeof createBidSchema>;

/**
 * Update bid input
 */
export const updateBidSchema = createBidSchema.partial().omit({
  jobId: true,
  status: true,
});
export type UpdateBid = z.infer<typeof updateBidSchema>;

/**
 * Client response to bid
 */
export const bidResponseSchema = z.object({
  action: z.enum(['SHORTLIST', 'ACCEPT', 'REJECT']),
  message: z.string().max(2000).optional(),
  rejectionReason: z.string().max(500).optional(),
});
export type BidResponse = z.infer<typeof bidResponseSchema>;

/**
 * Bid filter parameters
 */
export const bidFilterSchema = z.object({
  jobId: uuidSchema.optional(),
  freelancerUserId: uuidSchema.optional(),
  status: z.array(bidStatusSchema).optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  isBookmarked: z.boolean().optional(),
});
export type BidFilter = z.infer<typeof bidFilterSchema>;
