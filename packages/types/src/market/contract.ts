/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @skillancer/types - Market: Contract Types
 * Contract schemas for agreed work between clients and freelancers
 */

import { z } from 'zod';

import { jobTypeSchema } from './job';
import {
  uuidSchema,
  dateSchema,
  currencyCodeSchema,
  moneySchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Contract Enums
// =============================================================================

/**
 * Contract status lifecycle
 */
export const contractStatusSchema = z.enum([
  'DRAFT',
  'PENDING_SIGNATURES',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'TERMINATED',
]);
export type ContractStatus = z.infer<typeof contractStatusSchema>;

/**
 * Milestone status
 */
export const milestoneStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'PAID',
  'CANCELLED',
]);
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

/**
 * Payment status for escrow
 */
export const escrowStatusSchema = z.enum([
  'NOT_FUNDED',
  'FUNDED',
  'RELEASED',
  'REFUNDED',
  'PARTIALLY_RELEASED',
  'IN_DISPUTE',
]);
export type EscrowStatus = z.infer<typeof escrowStatusSchema>;

// =============================================================================
// Contract Sub-schemas
// =============================================================================

/**
 * Contract milestone
 */
export const contractMilestoneSchema = z.object({
  id: uuidSchema,
  contractId: uuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  amount: z.number().positive(),
  currency: currencyCodeSchema,
  status: milestoneStatusSchema,
  order: z.number().int().nonnegative(),

  // Escrow
  escrowStatus: escrowStatusSchema,
  fundedAt: dateSchema.optional(),
  fundedTransactionId: uuidSchema.optional(),

  // Deliverables
  deliverables: z.array(z.string()).optional(),
  attachments: z
    .array(
      z.object({
        id: uuidSchema,
        name: z.string(),
        url: z.string().url(),
        mimeType: z.string(),
      })
    )
    .optional(),

  // Timeline
  dueDate: dateSchema.optional(),
  submittedAt: dateSchema.optional(),
  approvedAt: dateSchema.optional(),
  rejectedAt: dateSchema.optional(),
  rejectionReason: z.string().max(500).optional(),
  revisionRequests: z.number().int().nonnegative().default(0),

  // Payment
  paidAt: dateSchema.optional(),
  paymentTransactionId: uuidSchema.optional(),

  ...timestampsSchema.shape,
});
export type ContractMilestone = z.infer<typeof contractMilestoneSchema>;

/**
 * Work time entry (for hourly contracts)
 */
export const timeEntrySchema = z.object({
  id: uuidSchema,
  contractId: uuidSchema,
  description: z.string().max(500),
  hours: z.number().positive(),
  date: dateSchema,
  approved: z.boolean().default(false),
  approvedAt: dateSchema.optional(),

  // SkillPod tracking
  skillpodSessionId: uuidSchema.optional(),
  screenshots: z
    .array(
      z.object({
        id: uuidSchema,
        url: z.string().url(),
        timestamp: dateSchema,
        activityLevel: z.number().int().min(0).max(100).optional(),
      })
    )
    .optional(),

  ...timestampsSchema.shape,
});
export type TimeEntry = z.infer<typeof timeEntrySchema>;

// =============================================================================
// Main Contract Schema
// =============================================================================

/**
 * Complete contract schema
 */
export const contractSchema = z.object({
  id: uuidSchema,
  contractNumber: z.string(), // Human-readable contract number

  // Relationships
  jobId: uuidSchema.optional(), // May be from direct hire
  bidId: uuidSchema.optional(),
  serviceId: uuidSchema.optional(), // For productized service purchases
  clientUserId: uuidSchema,
  freelancerUserId: uuidSchema,
  tenantId: uuidSchema.optional(),

  // Contract details
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  type: jobTypeSchema,
  status: contractStatusSchema,

  // Terms
  scope: z.string().max(10000).optional(),
  deliverables: z.array(z.string()).optional(),
  terms: z.string().max(10000).optional(),

  // Pricing
  totalAmount: z.number().nonnegative(),
  currency: currencyCodeSchema.default('USD'),
  hourlyRate: z.number().positive().optional(),
  maxHours: z.number().positive().optional(),
  maxBudget: z.number().positive().optional(),

  // Milestones
  milestones: z.array(contractMilestoneSchema).optional(),

  // Time tracking (hourly)
  timeEntries: z.array(timeEntrySchema).optional(),
  totalHoursWorked: z.number().nonnegative().default(0),
  totalHoursApproved: z.number().nonnegative().default(0),

  // Financials
  amountPaid: z.number().nonnegative().default(0),
  amountInEscrow: z.number().nonnegative().default(0),
  platformFeePercent: z.number().min(0).max(100).default(10),

  // Signatures
  clientSignedAt: dateSchema.optional(),
  freelancerSignedAt: dateSchema.optional(),

  // Timeline
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  actualStartDate: dateSchema.optional(),
  actualEndDate: dateSchema.optional(),

  // Communication
  chatChannelId: uuidSchema.optional(),
  lastActivityAt: dateSchema.optional(),

  // SkillPod integration
  skillpodEnabled: z.boolean().default(false),
  skillpodPodId: uuidSchema.optional(),
  skillpodPolicy: z
    .object({
      screenshotsEnabled: z.boolean().default(false),
      screenshotFrequencyMinutes: z.number().int().min(1).max(60).default(10),
      activityTrackingEnabled: z.boolean().default(false),
    })
    .optional(),

  // Dispute
  hasDispute: z.boolean().default(false),
  disputeId: uuidSchema.optional(),

  ...timestampsSchema.shape,
});
export type Contract = z.infer<typeof contractSchema>;

// =============================================================================
// Contract CRUD Schemas
// =============================================================================

/**
 * Create contract input
 */
export const createContractSchema = z.object({
  jobId: uuidSchema.optional(),
  bidId: uuidSchema.optional(),
  serviceId: uuidSchema.optional(),
  freelancerUserId: uuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  type: jobTypeSchema,
  scope: z.string().max(10000).optional(),
  deliverables: z.array(z.string()).optional(),
  terms: z.string().max(10000).optional(),
  totalAmount: z.number().nonnegative(),
  currency: currencyCodeSchema.default('USD'),
  hourlyRate: z.number().positive().optional(),
  maxHours: z.number().positive().optional(),
  maxBudget: z.number().positive().optional(),
  milestones: z
    .array(
      contractMilestoneSchema.omit({
        id: true,
        contractId: true,
        escrowStatus: true,
        fundedAt: true,
        fundedTransactionId: true,
        submittedAt: true,
        approvedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        paidAt: true,
        paymentTransactionId: true,
        createdAt: true,
        updatedAt: true,
      })
    )
    .optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  skillpodEnabled: z.boolean().default(false),
  skillpodPolicy: z
    .object({
      screenshotsEnabled: z.boolean().default(false),
      screenshotFrequencyMinutes: z.number().int().min(1).max(60).default(10),
      activityTrackingEnabled: z.boolean().default(false),
    })
    .optional(),
});
export type CreateContract = z.infer<typeof createContractSchema>;

/**
 * Update contract input
 */
export const updateContractSchema = createContractSchema.partial().omit({
  freelancerUserId: true,
  bidId: true,
  jobId: true,
  serviceId: true,
});
export type UpdateContract = z.infer<typeof updateContractSchema>;

/**
 * Create milestone input
 */
export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  amount: z.number().positive(),
  dueDate: dateSchema.optional(),
  deliverables: z.array(z.string()).optional(),
  order: z.number().int().nonnegative(),
});
export type CreateMilestone = z.infer<typeof createMilestoneSchema>;

/**
 * Submit milestone deliverable
 */
export const submitMilestoneSchema = z.object({
  message: z.string().max(2000).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        mimeType: z.string(),
      })
    )
    .optional(),
});
export type SubmitMilestone = z.infer<typeof submitMilestoneSchema>;

/**
 * Milestone review action
 */
export const reviewMilestoneSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_REVISION']),
  feedback: z.string().max(2000).optional(),
  rejectionReason: z.string().max(500).optional(),
});
export type ReviewMilestone = z.infer<typeof reviewMilestoneSchema>;

/**
 * Contract filter parameters
 */
export const contractFilterSchema = z.object({
  clientUserId: uuidSchema.optional(),
  freelancerUserId: uuidSchema.optional(),
  status: z.array(contractStatusSchema).optional(),
  type: z.array(jobTypeSchema).optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
  startDateFrom: dateSchema.optional(),
  startDateTo: dateSchema.optional(),
  hasDispute: z.boolean().optional(),
});
export type ContractFilter = z.infer<typeof contractFilterSchema>;
