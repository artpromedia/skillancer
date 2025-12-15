/**
 * Services barrel export
 */

export { ReviewService } from './review.service.js';
export { ReviewAggregationService } from './review-aggregation.service.js';
export { ReviewModerationService } from './review-moderation.service.js';
export type {
  ModerationResult,
  ModerationQueueItem,
  ModerateReviewParams,
  ResolveReportParams,
} from './review-moderation.service.js';
export { ReviewInvitationService } from './review-invitation.service.js';
export type {
  CreateInvitationParams,
  InvitationWithDetails,
  PendingInvitation,
} from './review-invitation.service.js';

// Enhanced Review System
export { EnhancedReviewService } from './enhanced-review.service.js';
export type {
  SubmitReviewParams,
  RespondToReviewParams,
  VoteHelpfulParams,
  ReportReviewParams,
  GetUserReviewsOptions,
  ReviewSubmissionResult,
} from './enhanced-review.service.js';

export { FraudDetectionService } from './fraud-detection.service.js';
export type {
  FraudCheckParams,
  FraudCheckResult,
  FraudCheck,
  FraudCheckType,
} from './fraud-detection.service.js';

export { ReputationService } from './reputation.service.js';
export type {
  ReputationStats,
  ReputationSummary,
  RatingValue,
  TrendDirection,
} from './reputation.service.js';
