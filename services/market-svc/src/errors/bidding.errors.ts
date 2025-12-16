/**
 * @module @skillancer/market-svc/errors/bidding
 * Bidding system error definitions
 */

export const BiddingErrorCode = {
  // Project errors
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_NOT_PUBLISHED: 'PROJECT_NOT_PUBLISHED',
  PROJECT_CLOSED: 'PROJECT_CLOSED',
  PROJECT_EXPIRED: 'PROJECT_EXPIRED',
  PROJECT_NOT_OPEN: 'PROJECT_NOT_OPEN',
  PROJECT_ALREADY_PUBLISHED: 'PROJECT_ALREADY_PUBLISHED',
  PROJECT_ALREADY_CLOSED: 'PROJECT_ALREADY_CLOSED',
  NOT_PROJECT_OWNER: 'NOT_PROJECT_OWNER',
  INVALID_PROJECT_STATUS: 'INVALID_PROJECT_STATUS',

  // Bid errors
  BID_NOT_FOUND: 'BID_NOT_FOUND',
  BID_ALREADY_EXISTS: 'BID_ALREADY_EXISTS',
  BID_ALREADY_ACCEPTED: 'BID_ALREADY_ACCEPTED',
  BID_ALREADY_REJECTED: 'BID_ALREADY_REJECTED',
  BID_ALREADY_WITHDRAWN: 'BID_ALREADY_WITHDRAWN',
  CANNOT_BID_OWN_PROJECT: 'CANNOT_BID_OWN_PROJECT',
  NOT_BID_OWNER: 'NOT_BID_OWNER',
  BID_RATE_OUT_OF_RANGE: 'BID_RATE_OUT_OF_RANGE',
  BID_SPAM_DETECTED: 'BID_SPAM_DETECTED',
  INVALID_BID_STATUS: 'INVALID_BID_STATUS',
  BID_LIMIT_REACHED: 'BID_LIMIT_REACHED',

  // Message errors
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  NOT_MESSAGE_PARTICIPANT: 'NOT_MESSAGE_PARTICIPANT',
  MESSAGE_TOO_LONG: 'MESSAGE_TOO_LONG',

  // Invitation errors
  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_ALREADY_EXISTS: 'INVITATION_ALREADY_EXISTS',
  INVITATION_ALREADY_SENT: 'INVITATION_ALREADY_SENT',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_ALREADY_RESPONDED: 'INVITATION_ALREADY_RESPONDED',
  INVITATION_LIMIT_REACHED: 'INVITATION_LIMIT_REACHED',
  NOT_INVITATION_RECIPIENT: 'NOT_INVITATION_RECIPIENT',
  CANNOT_INVITE_SELF: 'CANNOT_INVITE_SELF',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // Question errors
  QUESTION_NOT_FOUND: 'QUESTION_NOT_FOUND',
  QUESTION_ALREADY_ANSWERED: 'QUESTION_ALREADY_ANSWERED',
  NOT_QUESTION_OWNER: 'NOT_QUESTION_OWNER',
  QUESTION_HIDDEN: 'QUESTION_HIDDEN',
  QUESTION_LIMIT_REACHED: 'QUESTION_LIMIT_REACHED',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',

  // Trust/compliance errors
  TRUST_SCORE_TOO_LOW: 'TRUST_SCORE_TOO_LOW',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  COMPLIANCE_CHECK_FAILED: 'COMPLIANCE_CHECK_FAILED',

  // General errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type BiddingErrorCodeType = (typeof BiddingErrorCode)[keyof typeof BiddingErrorCode];

export class BiddingError extends Error {
  public readonly code: BiddingErrorCodeType;
  public readonly statusCode: number;

  constructor(code: BiddingErrorCodeType, message?: string, statusCode?: number) {
    super(message ?? getErrorMessage(code));
    this.name = 'BiddingError';
    this.code = code;
    this.statusCode = statusCode ?? getStatusCode(code);
  }
}

function getErrorMessage(code: BiddingErrorCodeType): string {
  const messages: Record<BiddingErrorCodeType, string> = {
    PROJECT_NOT_FOUND: 'Project not found',
    PROJECT_NOT_PUBLISHED: 'Project is not published',
    PROJECT_CLOSED: 'Project is closed for bidding',
    PROJECT_EXPIRED: 'Project has expired',
    PROJECT_NOT_OPEN: 'Project is not open for bidding',
    PROJECT_ALREADY_PUBLISHED: 'Project is already published',
    PROJECT_ALREADY_CLOSED: 'Project is already closed',
    NOT_PROJECT_OWNER: 'You are not the owner of this project',
    INVALID_PROJECT_STATUS: 'Invalid project status for this operation',

    BID_NOT_FOUND: 'Bid not found',
    BID_ALREADY_EXISTS: 'You have already submitted a bid for this project',
    BID_ALREADY_ACCEPTED: 'This bid has already been accepted',
    BID_ALREADY_REJECTED: 'This bid has already been rejected',
    BID_ALREADY_WITHDRAWN: 'This bid has already been withdrawn',
    CANNOT_BID_OWN_PROJECT: 'You cannot bid on your own project',
    NOT_BID_OWNER: 'You are not the owner of this bid',
    BID_RATE_OUT_OF_RANGE: 'Proposed rate is outside the project budget range',
    BID_SPAM_DETECTED: 'Your bid was flagged as spam. Please provide a more detailed proposal.',
    INVALID_BID_STATUS: 'Invalid bid status for this operation',
    BID_LIMIT_REACHED: 'You have reached the maximum number of active bids',

    MESSAGE_NOT_FOUND: 'Message not found',
    NOT_MESSAGE_PARTICIPANT: 'You are not a participant in this conversation',
    MESSAGE_TOO_LONG: 'Message exceeds maximum length',

    INVITATION_NOT_FOUND: 'Invitation not found',
    INVITATION_ALREADY_EXISTS: 'An invitation has already been sent to this freelancer',
    INVITATION_ALREADY_SENT: 'An invitation has already been sent to this freelancer',
    INVITATION_EXPIRED: 'This invitation has expired',
    INVITATION_ALREADY_RESPONDED: 'This invitation has already been responded to',
    INVITATION_LIMIT_REACHED: 'Maximum number of invitations reached',
    NOT_INVITATION_RECIPIENT: 'You are not the recipient of this invitation',
    CANNOT_INVITE_SELF: 'You cannot invite yourself',
    USER_NOT_FOUND: 'User not found',

    QUESTION_NOT_FOUND: 'Question not found',
    QUESTION_ALREADY_ANSWERED: 'This question has already been answered',
    NOT_QUESTION_OWNER: 'You are not authorized to answer this question',
    QUESTION_HIDDEN: 'This question has been hidden by moderators',
    QUESTION_LIMIT_REACHED: 'You have reached the maximum number of questions for this project',
    RATE_LIMITED: 'You are making requests too quickly. Please slow down.',

    TRUST_SCORE_TOO_LOW: 'Your trust score does not meet the requirements',
    VERIFICATION_REQUIRED: 'Additional verification is required for this action',
    COMPLIANCE_CHECK_FAILED: 'Compliance check failed',

    UNAUTHORIZED: 'Authentication required',
    FORBIDDEN: 'You do not have permission to perform this action',
    VALIDATION_ERROR: 'Validation error',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  };

  return messages[code];
}

export function getStatusCode(code: BiddingErrorCodeType): number {
  const notFoundCodes: BiddingErrorCodeType[] = [
    'PROJECT_NOT_FOUND',
    'BID_NOT_FOUND',
    'MESSAGE_NOT_FOUND',
    'INVITATION_NOT_FOUND',
    'QUESTION_NOT_FOUND',
    'USER_NOT_FOUND',
  ];

  const forbiddenCodes: BiddingErrorCodeType[] = [
    'NOT_PROJECT_OWNER',
    'NOT_BID_OWNER',
    'NOT_MESSAGE_PARTICIPANT',
    'NOT_INVITATION_RECIPIENT',
    'NOT_QUESTION_OWNER',
    'CANNOT_BID_OWN_PROJECT',
    'CANNOT_INVITE_SELF',
    'FORBIDDEN',
  ];

  const conflictCodes: BiddingErrorCodeType[] = [
    'BID_ALREADY_EXISTS',
    'BID_ALREADY_ACCEPTED',
    'BID_ALREADY_REJECTED',
    'BID_ALREADY_WITHDRAWN',
    'INVITATION_ALREADY_EXISTS',
    'INVITATION_ALREADY_SENT',
    'INVITATION_ALREADY_RESPONDED',
    'QUESTION_ALREADY_ANSWERED',
    'PROJECT_ALREADY_PUBLISHED',
    'PROJECT_ALREADY_CLOSED',
  ];

  const badRequestCodes: BiddingErrorCodeType[] = [
    'PROJECT_NOT_PUBLISHED',
    'PROJECT_CLOSED',
    'PROJECT_EXPIRED',
    'PROJECT_NOT_OPEN',
    'INVALID_PROJECT_STATUS',
    'BID_RATE_OUT_OF_RANGE',
    'BID_SPAM_DETECTED',
    'INVALID_BID_STATUS',
    'BID_LIMIT_REACHED',
    'MESSAGE_TOO_LONG',
    'INVITATION_EXPIRED',
    'INVITATION_LIMIT_REACHED',
    'QUESTION_HIDDEN',
    'QUESTION_LIMIT_REACHED',
    'TRUST_SCORE_TOO_LOW',
    'VERIFICATION_REQUIRED',
    'COMPLIANCE_CHECK_FAILED',
    'VALIDATION_ERROR',
  ];

  if (notFoundCodes.includes(code)) return 404;
  if (forbiddenCodes.includes(code)) return 403;
  if (conflictCodes.includes(code)) return 409;
  if (badRequestCodes.includes(code)) return 400;
  if (code === 'UNAUTHORIZED') return 401;
  if (code === 'RATE_LIMIT_EXCEEDED' || code === 'RATE_LIMITED') return 429;

  return 500;
}
