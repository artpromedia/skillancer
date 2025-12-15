/**
 * @module @skillancer/market-svc/errors/review
 * Review-specific error definitions
 */

export const ReviewErrorCode = {
  CONTRACT_NOT_FOUND: 'CONTRACT_NOT_FOUND',
  CONTRACT_NOT_COMPLETED: 'CONTRACT_NOT_COMPLETED',
  NOT_CONTRACT_PARTY: 'NOT_CONTRACT_PARTY',
  REVIEW_ALREADY_SUBMITTED: 'REVIEW_ALREADY_SUBMITTED',
  REVIEW_WINDOW_EXPIRED: 'REVIEW_WINDOW_EXPIRED',
  INVALID_RATING: 'INVALID_RATING',
  INVALID_OVERALL_RATING: 'INVALID_OVERALL_RATING',
  INVALID_QUALITY_RATING: 'INVALID_QUALITY_RATING',
  INVALID_COMMUNICATION_RATING: 'INVALID_COMMUNICATION_RATING',
  INVALID_EXPERTISE_RATING: 'INVALID_EXPERTISE_RATING',
  INVALID_PROFESSIONALISM_RATING: 'INVALID_PROFESSIONALISM_RATING',
  INVALID_CLARITY_RATING: 'INVALID_CLARITY_RATING',
  INVALID_RESPONSIVENESS_RATING: 'INVALID_RESPONSIVENESS_RATING',
  INVALID_PAYMENT_RATING: 'INVALID_PAYMENT_RATING',
  CONTENT_TOO_LONG: 'CONTENT_TOO_LONG',
  REVIEW_NOT_FOUND: 'REVIEW_NOT_FOUND',
  REVIEW_NOT_REVEALED: 'REVIEW_NOT_REVEALED',
  NOT_REVIEWEE: 'NOT_REVIEWEE',
  ALREADY_RESPONDED: 'ALREADY_RESPONDED',
  RESPONSE_ALREADY_EXISTS: 'RESPONSE_ALREADY_EXISTS',
  CANNOT_VOTE_OWN_REVIEW: 'CANNOT_VOTE_OWN_REVIEW',
  CANNOT_REPORT_OWN_REVIEW: 'CANNOT_REPORT_OWN_REVIEW',
  REPORT_ALREADY_EXISTS: 'REPORT_ALREADY_EXISTS',
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  // Fraud detection and hiding
  REVIEW_BLOCKED: 'REVIEW_BLOCKED',
  REVIEW_ALREADY_HIDDEN: 'REVIEW_ALREADY_HIDDEN',
  REVIEW_NOT_HIDDEN: 'REVIEW_NOT_HIDDEN',
  HIDE_LIMIT_REACHED: 'HIDE_LIMIT_REACHED',
} as const;

export type ReviewErrorCodeType = (typeof ReviewErrorCode)[keyof typeof ReviewErrorCode];

export class ReviewError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: ReviewErrorCodeType, message?: string, statusCode?: number) {
    super(message ?? getErrorMessage(code));
    this.name = 'ReviewError';
    this.code = code;
    this.statusCode = statusCode ?? getStatusCode(code);
    Error.captureStackTrace(this, this.constructor);
  }
}

function getErrorMessage(code: ReviewErrorCodeType): string {
  const messages: Record<ReviewErrorCodeType, string> = {
    CONTRACT_NOT_FOUND: 'Contract not found',
    CONTRACT_NOT_COMPLETED: 'Cannot review a contract that is not completed',
    NOT_CONTRACT_PARTY: 'You are not a party to this contract',
    REVIEW_ALREADY_SUBMITTED: 'You have already submitted a review for this contract',
    REVIEW_WINDOW_EXPIRED: 'The review window has expired',
    INVALID_RATING: 'Rating must be between 1 and 5',
    INVALID_OVERALL_RATING: 'Overall rating must be between 1 and 5',
    INVALID_QUALITY_RATING: 'Quality rating must be between 1 and 5',
    INVALID_COMMUNICATION_RATING: 'Communication rating must be between 1 and 5',
    INVALID_EXPERTISE_RATING: 'Expertise rating must be between 1 and 5',
    INVALID_PROFESSIONALISM_RATING: 'Professionalism rating must be between 1 and 5',
    INVALID_CLARITY_RATING: 'Clarity rating must be between 1 and 5',
    INVALID_RESPONSIVENESS_RATING: 'Responsiveness rating must be between 1 and 5',
    INVALID_PAYMENT_RATING: 'Payment rating must be between 1 and 5',
    CONTENT_TOO_LONG: 'Review content exceeds maximum length',
    REVIEW_NOT_FOUND: 'Review not found',
    REVIEW_NOT_REVEALED: 'Review has not been revealed yet',
    NOT_REVIEWEE: 'Only the reviewee can respond to this review',
    ALREADY_RESPONDED: 'You have already responded to this review',
    RESPONSE_ALREADY_EXISTS: 'A response already exists for this review',
    CANNOT_VOTE_OWN_REVIEW: 'You cannot vote on your own review',
    CANNOT_REPORT_OWN_REVIEW: 'You cannot report your own review',
    REPORT_ALREADY_EXISTS: 'You have already reported this review',
    INVITATION_NOT_FOUND: 'Review invitation not found',
    INVITATION_EXPIRED: 'Review invitation has expired',
    UNAUTHORIZED: 'You are not authorized to perform this action',
    REVIEW_BLOCKED: 'Review could not be submitted due to suspicious activity',
    REVIEW_ALREADY_HIDDEN: 'Review is already hidden',
    REVIEW_NOT_HIDDEN: 'Review is not hidden',
    HIDE_LIMIT_REACHED: 'You have reached the maximum number of hidden reviews',
  };
  return messages[code];
}

function getStatusCode(code: ReviewErrorCodeType): number {
  const statusCodes: Partial<Record<ReviewErrorCodeType, number>> = {
    CONTRACT_NOT_FOUND: 404,
    REVIEW_NOT_FOUND: 404,
    INVITATION_NOT_FOUND: 404,
    NOT_CONTRACT_PARTY: 403,
    NOT_REVIEWEE: 403,
    UNAUTHORIZED: 403,
    CANNOT_VOTE_OWN_REVIEW: 403,
    CANNOT_REPORT_OWN_REVIEW: 403,
    REVIEW_BLOCKED: 403,
    HIDE_LIMIT_REACHED: 403,
    REVIEW_ALREADY_SUBMITTED: 409,
    RESPONSE_ALREADY_EXISTS: 409,
    ALREADY_RESPONDED: 409,
    REPORT_ALREADY_EXISTS: 409,
    REVIEW_ALREADY_HIDDEN: 409,
    REVIEW_NOT_HIDDEN: 409,
    CONTRACT_NOT_COMPLETED: 422,
    REVIEW_WINDOW_EXPIRED: 422,
    INVITATION_EXPIRED: 422,
    REVIEW_NOT_REVEALED: 422,
  };
  return statusCodes[code] ?? 400;
}
