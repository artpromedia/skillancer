// @ts-nocheck
/**
 * Verification Services Index
 * Sprint M4: Portable Verified Work History
 */

export {
  WorkHistoryVerifier,
  getWorkHistoryVerifier,
  VerificationRequest,
  VerificationStatus,
  VerificationCheck,
  BlockchainAnchor,
  VerificationEvidence,
} from './work-history-verifier';

export {
  EarningsVerifier,
  getEarningsVerifier,
  EarningsVerificationRequest,
  EarningsVerificationResult,
  EarningsDiscrepancy,
  FraudIndicator,
  EarningsSummary,
  PlatformEarnings,
  YearlyEarnings,
} from './earnings-verifier';

export {
  ReviewVerifier,
  getReviewVerifier,
  ReviewVerificationRequest,
  ReviewVerificationResult,
  ReviewCheck,
  ReviewFlag,
  CrossPlatformReviewScore,
  PlatformReviewSummary,
  SentimentAnalysis,
  ReviewTheme,
  ReviewTrend,
} from './review-verifier';
