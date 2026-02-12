/**
 * @skillancer/types - Market: Review Types
 * Review and rating schemas for feedback system
 */

import { z } from 'zod';

import { uuidSchema, dateSchema, timestampsSchema } from '../common/base';

// =============================================================================
// Review Enums
// =============================================================================

/**
 * Review type (who is reviewing)
 */
export const reviewTypeSchema = z.enum(['CLIENT_TO_FREELANCER', 'FREELANCER_TO_CLIENT']);
export type ReviewType = z.infer<typeof reviewTypeSchema>;

/**
 * Review status
 */
export const reviewStatusSchema = z.enum([
  'PENDING', // Waiting for review
  'PUBLISHED',
  'HIDDEN', // Hidden by admin
  'DISPUTED',
]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

/**
 * Rating criteria categories
 */
export const ratingCriteriaSchema = z.enum([
  'OVERALL',
  'COMMUNICATION',
  'QUALITY',
  'EXPERTISE',
  'PROFESSIONALISM',
  'TIMELINESS',
  'COOPERATION',
  'CLARITY', // For clients: clarity of requirements
  'RESPONSIVENESS',
  'RECOMMEND', // Would recommend
]);
export type RatingCriteria = z.infer<typeof ratingCriteriaSchema>;

// =============================================================================
// Review Sub-schemas
// =============================================================================

/**
 * Individual rating item
 */
export const ratingItemSchema = z.object({
  criteria: ratingCriteriaSchema,
  score: z.number().int().min(1).max(5),
});
export type RatingItem = z.infer<typeof ratingItemSchema>;

/**
 * Review response/reply
 */
export const reviewResponseSchema = z.object({
  id: uuidSchema,
  reviewId: uuidSchema,
  userId: uuidSchema,
  content: z.string().min(10).max(1000),
  createdAt: dateSchema,
  updatedAt: dateSchema.optional(),
});
export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

// =============================================================================
// Main Review Schema
// =============================================================================

/**
 * Complete review schema
 */
export const reviewSchema = z.object({
  id: uuidSchema,

  // Context
  contractId: uuidSchema,
  jobId: uuidSchema.optional(),
  serviceId: uuidSchema.optional(),

  // Participants
  reviewerUserId: uuidSchema,
  revieweeUserId: uuidSchema,
  tenantId: uuidSchema.optional(),

  // Type
  type: reviewTypeSchema,
  status: reviewStatusSchema,

  // Ratings
  overallRating: z.number().min(1).max(5),
  ratings: z.array(ratingItemSchema),

  // Content
  title: z.string().max(200).optional(),
  content: z.string().min(10).max(3000),

  // Highlights
  positives: z.array(z.string().max(200)).max(5).optional(),
  negatives: z.array(z.string().max(200)).max(5).optional(),

  // Would work again / recommend
  wouldWorkAgain: z.boolean().optional(),
  wouldRecommend: z.boolean().optional(),

  // Attachments (proof of work, screenshots)
  attachments: z
    .array(
      z.object({
        id: uuidSchema,
        url: z.string().url(),
        type: z.enum(['IMAGE', 'DOCUMENT']),
        caption: z.string().max(200).optional(),
      })
    )
    .max(5)
    .optional(),

  // Response from reviewee
  response: reviewResponseSchema.optional(),

  // Moderation
  isVerified: z.boolean().default(true), // Verified contract completion
  isEdited: z.boolean().default(false),
  editedAt: dateSchema.optional(),
  moderationNote: z.string().max(500).optional(),
  hiddenReason: z.string().max(500).optional(),

  // Helpfulness
  helpfulCount: z.number().int().nonnegative().default(0),
  notHelpfulCount: z.number().int().nonnegative().default(0),

  // Dispute
  hasDispute: z.boolean().default(false),
  disputeId: uuidSchema.optional(),

  ...timestampsSchema.shape,
});
export type Review = z.infer<typeof reviewSchema>;

// =============================================================================
// Review CRUD Schemas
// =============================================================================

/**
 * Create review input
 */
export const createReviewSchema = z
  .object({
    contractId: uuidSchema,
    type: reviewTypeSchema,
    overallRating: z.number().min(1).max(5),
    ratings: z.array(ratingItemSchema).min(1),
    title: z.string().max(200).optional(),
    content: z.string().min(10).max(3000),
    positives: z.array(z.string().max(200)).max(5).optional(),
    negatives: z.array(z.string().max(200)).max(5).optional(),
    wouldWorkAgain: z.boolean().optional(),
    wouldRecommend: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Ensure overall rating is provided in ratings array
      return data.ratings.some((r) => r.criteria === 'OVERALL');
    },
    { message: 'Overall rating must be included in ratings array' }
  );
export type CreateReview = z.infer<typeof createReviewSchema>;

/**
 * Update review input (limited editing allowed)
 */
export const updateReviewSchema = z.object({
  content: z.string().min(10).max(3000).optional(),
  positives: z.array(z.string().max(200)).max(5).optional(),
  negatives: z.array(z.string().max(200)).max(5).optional(),
});
export type UpdateReview = z.infer<typeof updateReviewSchema>;

/**
 * Create review response input
 */
export const createReviewResponseSchema = z.object({
  content: z.string().min(10).max(1000),
});
export type CreateReviewResponse = z.infer<typeof createReviewResponseSchema>;

/**
 * Review helpfulness vote
 */
export const reviewVoteSchema = z.object({
  reviewId: uuidSchema,
  isHelpful: z.boolean(),
});
export type ReviewVote = z.infer<typeof reviewVoteSchema>;

/**
 * Review filter parameters
 */
export const reviewFilterSchema = z.object({
  revieweeUserId: uuidSchema.optional(),
  reviewerUserId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  serviceId: uuidSchema.optional(),
  type: reviewTypeSchema.optional(),
  minRating: z.number().min(1).max(5).optional(),
  maxRating: z.number().min(1).max(5).optional(),
  status: z.array(reviewStatusSchema).optional(),
  hasResponse: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});
export type ReviewFilter = z.infer<typeof reviewFilterSchema>;

// =============================================================================
// Aggregated Rating Schema
// =============================================================================

/**
 * Aggregated ratings for a user or service
 */
export const aggregatedRatingsSchema = z.object({
  userId: uuidSchema.optional(),
  serviceId: uuidSchema.optional(),

  // Overall stats
  totalReviews: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5),

  // Rating distribution
  distribution: z.object({
    fiveStars: z.number().int().nonnegative(),
    fourStars: z.number().int().nonnegative(),
    threeStars: z.number().int().nonnegative(),
    twoStars: z.number().int().nonnegative(),
    oneStar: z.number().int().nonnegative(),
  }),

  // Criteria averages
  criteriaAverages: z.array(
    z.object({
      criteria: ratingCriteriaSchema,
      average: z.number().min(0).max(5),
      count: z.number().int().nonnegative(),
    })
  ),

  // Recommendation rate
  recommendationRate: z.number().min(0).max(100).optional(),
  repeatClientRate: z.number().min(0).max(100).optional(),

  // Time-based
  lastReviewAt: dateSchema.optional(),
  reviewsLast30Days: z.number().int().nonnegative().optional(),
});
export type AggregatedRatings = z.infer<typeof aggregatedRatingsSchema>;
