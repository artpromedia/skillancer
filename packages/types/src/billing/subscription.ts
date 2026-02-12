/**
 * @skillancer/types - Billing: Subscription Types
 * Platform subscription and plan schemas
 */

import { z } from 'zod';

import { uuidSchema, dateSchema, currencyCodeSchema, timestampsSchema } from '../common/base';

// =============================================================================
// Subscription Enums
// =============================================================================

/**
 * Subscription status
 */
export const subscriptionStatusSchema = z.enum([
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'UNPAID',
  'PAUSED',
  'CANCELLED',
  'EXPIRED',
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

/**
 * Billing cycle
 */
export const billingCycleSchema = z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL']);
export type BillingCycle = z.infer<typeof billingCycleSchema>;

/**
 * Plan tier
 */
export const planTierSchema = z.enum([
  'FREE',
  'STARTER',
  'PROFESSIONAL',
  'BUSINESS',
  'ENTERPRISE',
  'CUSTOM',
]);
export type PlanTier = z.infer<typeof planTierSchema>;

/**
 * Feature type
 */
export const featureTypeSchema = z.enum([
  'BOOLEAN', // On/off feature
  'NUMERIC', // Limited by number
  'UNLIMITED', // No limit
  'TIERED', // Different limits per tier
]);
export type FeatureType = z.infer<typeof featureTypeSchema>;

// =============================================================================
// Plan Sub-schemas
// =============================================================================

/**
 * Plan feature definition
 */
export const planFeatureSchema = z.object({
  id: z.string(),
  name: z.string().max(100),
  description: z.string().max(500).optional(),
  type: featureTypeSchema,

  // For boolean features
  enabled: z.boolean().optional(),

  // For numeric features
  limit: z.number().int().nonnegative().optional(),
  usageMetric: z.string().optional(), // e.g., 'contracts_per_month'

  // Display
  displayOrder: z.number().int().nonnegative().default(0),
  highlightText: z.string().max(50).optional(), // e.g., "Popular", "New"
});
export type PlanFeature = z.infer<typeof planFeatureSchema>;

/**
 * Plan pricing
 */
export const planPricingSchema = z.object({
  billingCycle: billingCycleSchema,
  amount: z.number().nonnegative(),
  currency: currencyCodeSchema.default('USD'),

  // Discounts
  originalAmount: z.number().nonnegative().optional(), // Before discount
  discountPercent: z.number().min(0).max(100).optional(),

  // Per-seat pricing (for team plans)
  pricePerSeat: z.number().nonnegative().optional(),
  includedSeats: z.number().int().positive().optional(),
});
export type PlanPricing = z.infer<typeof planPricingSchema>;

// =============================================================================
// Main Plan Schema
// =============================================================================

/**
 * Subscription plan schema
 */
export const planSchema = z.object({
  id: uuidSchema,

  // Basic info
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  tier: planTierSchema,

  // Target audience
  targetAudience: z.enum(['FREELANCER', 'CLIENT', 'AGENCY', 'ENTERPRISE']).optional(),

  // Pricing
  pricing: z.array(planPricingSchema),

  // Features
  features: z.array(planFeatureSchema),

  // Platform fees
  platformFeePercent: z.number().min(0).max(100), // Fee on transactions

  // SkillPod credits
  skillpodHoursIncluded: z.number().int().nonnegative().default(0),
  skillpodHourlyRate: z.number().nonnegative().optional(),

  // Limits
  maxActiveContracts: z.number().int().positive().optional(),
  maxActiveJobs: z.number().int().positive().optional(),
  maxTeamMembers: z.number().int().positive().optional(),
  maxStorageGb: z.number().positive().optional(),

  // Support
  supportLevel: z.enum(['COMMUNITY', 'EMAIL', 'PRIORITY', 'DEDICATED']).default('EMAIL'),

  // Trial
  trialDays: z.number().int().nonnegative().default(0),

  // Visibility
  isPublic: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  displayOrder: z.number().int().nonnegative().default(0),

  // Availability
  isActive: z.boolean().default(true),
  availableFrom: dateSchema.optional(),
  availableUntil: dateSchema.optional(),

  // Metadata
  metadata: z.record(z.unknown()).optional(),

  ...timestampsSchema.shape,
});
export type Plan = z.infer<typeof planSchema>;

// =============================================================================
// Main Subscription Schema
// =============================================================================

/**
 * User subscription schema
 */
export const subscriptionSchema = z.object({
  id: uuidSchema,

  // Owner
  userId: uuidSchema,
  tenantId: uuidSchema.optional(),

  // Plan
  planId: uuidSchema,
  planName: z.string(),
  planTier: planTierSchema,

  // Status
  status: subscriptionStatusSchema,

  // Billing
  billingCycle: billingCycleSchema,
  amount: z.number().nonnegative(),
  currency: currencyCodeSchema.default('USD'),

  // Seats (for team plans)
  seats: z.number().int().positive().default(1),
  pricePerSeat: z.number().nonnegative().optional(),

  // Period
  currentPeriodStart: dateSchema,
  currentPeriodEnd: dateSchema,

  // Trial
  trialStart: dateSchema.optional(),
  trialEnd: dateSchema.optional(),

  // Cancellation
  cancelledAt: dateSchema.optional(),
  cancelAtPeriodEnd: z.boolean().default(false),
  cancellationReason: z.string().max(500).optional(),

  // Pause
  pausedAt: dateSchema.optional(),
  resumeAt: dateSchema.optional(),

  // Payment
  paymentMethodId: uuidSchema.optional(),
  lastPaymentAt: dateSchema.optional(),
  lastPaymentAmount: z.number().nonnegative().optional(),
  nextPaymentAt: dateSchema.optional(),
  nextPaymentAmount: z.number().nonnegative().optional(),

  // Failed payments
  failedPaymentCount: z.number().int().nonnegative().default(0),
  lastFailedPaymentAt: dateSchema.optional(),

  // Usage (for metered features)
  usage: z.record(z.number()).optional(),

  // External provider
  externalId: z.string().optional(),
  externalProvider: z.enum(['STRIPE', 'PADDLE', 'MANUAL', 'OTHER']).optional(),

  // Discount/coupon
  couponCode: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountEndsAt: dateSchema.optional(),

  ...timestampsSchema.shape,
});
export type Subscription = z.infer<typeof subscriptionSchema>;

// =============================================================================
// Subscription CRUD Schemas
// =============================================================================

/**
 * Create subscription input
 */
export const createSubscriptionSchema = z.object({
  planId: uuidSchema,
  billingCycle: billingCycleSchema,
  seats: z.number().int().positive().default(1),
  paymentMethodId: uuidSchema,
  couponCode: z.string().optional(),
});
export type CreateSubscription = z.infer<typeof createSubscriptionSchema>;

/**
 * Update subscription input
 */
export const updateSubscriptionSchema = z.object({
  planId: uuidSchema.optional(),
  billingCycle: billingCycleSchema.optional(),
  seats: z.number().int().positive().optional(),
  paymentMethodId: uuidSchema.optional(),
});
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;

/**
 * Cancel subscription input
 */
export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
  cancelAtPeriodEnd: z.boolean().default(true),
  feedback: z
    .enum([
      'TOO_EXPENSIVE',
      'NOT_USING',
      'MISSING_FEATURES',
      'SWITCHING_COMPETITOR',
      'TECHNICAL_ISSUES',
      'OTHER',
    ])
    .optional(),
});
export type CancelSubscription = z.infer<typeof cancelSubscriptionSchema>;

/**
 * Subscription filter parameters
 */
export const subscriptionFilterSchema = z.object({
  userId: uuidSchema.optional(),
  planId: uuidSchema.optional(),
  status: z.array(subscriptionStatusSchema).optional(),
  tier: z.array(planTierSchema).optional(),
  billingCycle: z.array(billingCycleSchema).optional(),
});
export type SubscriptionFilter = z.infer<typeof subscriptionFilterSchema>;

// =============================================================================
// Usage Tracking Schema
// =============================================================================

/**
 * Usage record for metered features
 */
export const usageRecordSchema = z.object({
  id: uuidSchema,
  subscriptionId: uuidSchema,
  featureId: z.string(),

  quantity: z.number().int().positive(),
  timestamp: dateSchema,

  // Context
  description: z.string().max(200).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: uuidSchema.optional(),

  // Idempotency
  idempotencyKey: z.string().optional(),

  ...timestampsSchema.shape,
});
export type UsageRecord = z.infer<typeof usageRecordSchema>;

/**
 * Usage summary for a period
 */
export const usageSummarySchema = z.object({
  subscriptionId: uuidSchema,
  periodStart: dateSchema,
  periodEnd: dateSchema,

  features: z.array(
    z.object({
      featureId: z.string(),
      featureName: z.string(),
      used: z.number().int().nonnegative(),
      limit: z.number().int().optional(), // null = unlimited
      percentUsed: z.number().min(0).max(100).optional(),
    })
  ),
});
export type UsageSummary = z.infer<typeof usageSummarySchema>;
