/**
 * @module @skillancer/market-svc/types/review
 * Review system types and interfaces
 *
 * Note: These types are self-contained until Prisma schema is regenerated.
 * After running `pnpm db:generate`, these can be updated to import from @skillancer/database.
 */

// =============================================================================
// ENUMS (matching Prisma schema)
// =============================================================================

export type ReviewType = 'CLIENT_TO_FREELANCER' | 'FREELANCER_TO_CLIENT';
export type ReviewStatus = 'PENDING' | 'REVEALED' | 'HIDDEN';
export type ReviewReportReason =
  | 'INAPPROPRIATE_CONTENT'
  | 'FALSE_INFORMATION'
  | 'HARASSMENT'
  | 'SPAM'
  | 'OTHER';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'UPHELD' | 'DISMISSED';
export type ReviewInvitationStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

// =============================================================================
// CATEGORY RATINGS
// =============================================================================

/**
 * Category ratings when client reviews freelancer
 */
export interface FreelancerCategoryRatings {
  communication: number; // 1-5
  quality: number; // 1-5
  expertise: number; // 1-5
  professionalism: number; // 1-5
  deadline: number; // 1-5
}

/**
 * Category ratings when freelancer reviews client
 */
export interface ClientCategoryRatings {
  communication: number; // 1-5
  requirements: number; // 1-5
  paymentPromptness: number; // 1-5
  professionalism: number; // 1-5
}

// =============================================================================
// REVIEW SUBMISSION
// =============================================================================

export interface SubmitReviewParams {
  contractId: string;
  reviewerId: string;
  rating: number;
  content?: string;
  categoryRatings: FreelancerCategoryRatings | ClientCategoryRatings;
  isPrivate?: boolean;
}

// =============================================================================
// REVIEW WITH DETAILS
// =============================================================================

export interface ReviewWithDetails {
  id: string;
  contractId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  content: string | null;
  status: ReviewStatus;
  createdAt: Date;
  revealedAt: Date | null;
  reviewer: {
    id: string;
    email?: string;
    firstName: string | null;
    lastName: string | null;
  };
  reviewee: {
    id: string;
    email?: string;
    firstName: string | null;
    lastName: string | null;
  };
  contract: {
    id: string;
    title: string;
  };
}

// =============================================================================
// REVIEW LIST RESPONSE
// =============================================================================

export interface ReviewListResponse {
  reviews: ReviewWithDetails[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// =============================================================================
// AGGREGATION TYPES
// =============================================================================

export interface FreelancerAggregation {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: Record<string, number>;
  qualityAvg: number | null;
  communicationAvg: number | null;
  expertiseAvg: number | null;
  professionalismAvg: number | null;
  repeatRate: number | null;
}

export interface ClientAggregation {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: Record<string, number>;
  clarityAvg: number | null;
  responsivenessAvg: number | null;
  paymentAvg: number | null;
  professionalismAvg: number | null;
  repeatRate: number | null;
}

export interface AggregationResult {
  freelancer: FreelancerAggregation;
  client: ClientAggregation;
}

// Interface matching Prisma Review model
export interface Review {
  id: string;
  contractId: string;
  reviewerId: string;
  revieweeId: string;
  reviewType: ReviewType;
  overallRating: number;
  categoryRatings: unknown;
  content: string | null;
  status: ReviewStatus;
  isPrivate: boolean;
  createdAt: Date;
  revealedAt: Date | null;
  responseId: string | null;
  moderatedAt: Date | null;
  moderatedBy: string | null;
  moderationReason: string | null;
}

// =============================================================================
// USER REVIEW AGGREGATION
// =============================================================================

export interface UserReviewAggregation {
  userId: string;
  // As freelancer (receiving CLIENT_TO_FREELANCER reviews)
  freelancerTotalReviews: number;
  freelancerAverageRating: number;
  freelancerCommunicationAvg: number;
  freelancerQualityAvg: number;
  freelancerExpertiseAvg: number;
  freelancerProfessionalismAvg: number;
  freelancerDeadlineAvg: number;
  freelancerRepeatClientRate: number;
  // As client (receiving FREELANCER_TO_CLIENT reviews)
  clientTotalReviews: number;
  clientAverageRating: number;
  clientCommunicationAvg: number;
  clientRequirementsAvg: number;
  clientPaymentAvg: number;
  clientProfessionalismAvg: number;
  clientRepeatFreelancerRate: number;
  // Metadata
  lastCalculatedAt: Date;
}
