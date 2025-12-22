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

// Project Bidding System
export { ProjectService } from './project.service.js';
export { BidService } from './bid.service.js';
export { InvitationService } from './invitation.service.js';
export { QuestionService } from './question.service.js';
export { BidQualityService } from './bid-quality.service.js';

// Service Catalog System
export { ServiceCatalogService } from './service-catalog.service.js';
export { ServiceOrderService } from './service-order.service.js';
export { ServiceReviewService } from './service-review.service.js';

// Rate Intelligence System
export { RateIntelligenceService, RateIntelligenceError } from './rate-intelligence.service.js';
export { createRateDataCollectorService } from './rate-data-collector.service.js';
export type { RateDataCollectorService } from './rate-data-collector.service.js';

// Contract Management System (services TBD)

// SkillPod Credential Integration
export { CredentialSyncService } from './credential-sync.service.js';
export type {
  ConfidenceCalculationInput,
  ConfidenceCalculationResult,
  ProfileEnhancementResult,
} from './credential-sync.service.js';
