/**
 * @module @skillancer/market-svc/errors/smartmatch
 * SmartMatch-related error classes and error codes
 */

export enum SmartMatchErrorCode {
  // Freelancer errors
  FREELANCER_NOT_FOUND = 'FREELANCER_NOT_FOUND',
  FREELANCER_INACTIVE = 'FREELANCER_INACTIVE',
  FREELANCER_UNAVAILABLE = 'FREELANCER_UNAVAILABLE',

  // Matching errors
  INVALID_CRITERIA = 'INVALID_CRITERIA',
  NO_MATCHES_FOUND = 'NO_MATCHES_FOUND',
  MATCHING_TIMEOUT = 'MATCHING_TIMEOUT',

  // Work pattern errors
  WORK_PATTERN_NOT_FOUND = 'WORK_PATTERN_NOT_FOUND',
  INVALID_WORK_PATTERN = 'INVALID_WORK_PATTERN',

  // Rate intelligence errors
  RATE_DATA_NOT_FOUND = 'RATE_DATA_NOT_FOUND',
  INSUFFICIENT_RATE_DATA = 'INSUFFICIENT_RATE_DATA',

  // Skill errors
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  INVALID_SKILL_RELATIONSHIP = 'INVALID_SKILL_RELATIONSHIP',
  ENDORSEMENT_EXISTS = 'ENDORSEMENT_EXISTS',
  SELF_ENDORSEMENT_NOT_ALLOWED = 'SELF_ENDORSEMENT_NOT_ALLOWED',

  // Event errors
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',
  INVALID_OUTCOME = 'INVALID_OUTCOME',

  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

const ERROR_MESSAGES: Record<SmartMatchErrorCode, string> = {
  [SmartMatchErrorCode.FREELANCER_NOT_FOUND]: 'Freelancer not found',
  [SmartMatchErrorCode.FREELANCER_INACTIVE]: 'Freelancer account is inactive',
  [SmartMatchErrorCode.FREELANCER_UNAVAILABLE]: 'Freelancer is currently unavailable',

  [SmartMatchErrorCode.INVALID_CRITERIA]: 'Invalid matching criteria provided',
  [SmartMatchErrorCode.NO_MATCHES_FOUND]: 'No freelancers match the specified criteria',
  [SmartMatchErrorCode.MATCHING_TIMEOUT]: 'Matching operation timed out',

  [SmartMatchErrorCode.WORK_PATTERN_NOT_FOUND]: 'Work pattern not found for this user',
  [SmartMatchErrorCode.INVALID_WORK_PATTERN]: 'Invalid work pattern data',

  [SmartMatchErrorCode.RATE_DATA_NOT_FOUND]: 'Rate intelligence data not found',
  [SmartMatchErrorCode.INSUFFICIENT_RATE_DATA]: 'Insufficient data for rate analysis',

  [SmartMatchErrorCode.SKILL_NOT_FOUND]: 'Skill not found',
  [SmartMatchErrorCode.INVALID_SKILL_RELATIONSHIP]: 'Invalid skill relationship',
  [SmartMatchErrorCode.ENDORSEMENT_EXISTS]: 'You have already endorsed this skill',
  [SmartMatchErrorCode.SELF_ENDORSEMENT_NOT_ALLOWED]: 'You cannot endorse your own skills',

  [SmartMatchErrorCode.EVENT_NOT_FOUND]: 'Matching event not found',
  [SmartMatchErrorCode.INVALID_OUTCOME]: 'Invalid matching outcome',

  [SmartMatchErrorCode.UNAUTHORIZED]: 'Authentication required',
  [SmartMatchErrorCode.FORBIDDEN]: 'You do not have permission to perform this action',
};

const ERROR_STATUS_CODES: Record<SmartMatchErrorCode, number> = {
  [SmartMatchErrorCode.FREELANCER_NOT_FOUND]: 404,
  [SmartMatchErrorCode.FREELANCER_INACTIVE]: 403,
  [SmartMatchErrorCode.FREELANCER_UNAVAILABLE]: 400,

  [SmartMatchErrorCode.INVALID_CRITERIA]: 400,
  [SmartMatchErrorCode.NO_MATCHES_FOUND]: 404,
  [SmartMatchErrorCode.MATCHING_TIMEOUT]: 504,

  [SmartMatchErrorCode.WORK_PATTERN_NOT_FOUND]: 404,
  [SmartMatchErrorCode.INVALID_WORK_PATTERN]: 400,

  [SmartMatchErrorCode.RATE_DATA_NOT_FOUND]: 404,
  [SmartMatchErrorCode.INSUFFICIENT_RATE_DATA]: 400,

  [SmartMatchErrorCode.SKILL_NOT_FOUND]: 404,
  [SmartMatchErrorCode.INVALID_SKILL_RELATIONSHIP]: 400,
  [SmartMatchErrorCode.ENDORSEMENT_EXISTS]: 409,
  [SmartMatchErrorCode.SELF_ENDORSEMENT_NOT_ALLOWED]: 400,

  [SmartMatchErrorCode.EVENT_NOT_FOUND]: 404,
  [SmartMatchErrorCode.INVALID_OUTCOME]: 400,

  [SmartMatchErrorCode.UNAUTHORIZED]: 401,
  [SmartMatchErrorCode.FORBIDDEN]: 403,
};

export class SmartMatchError extends Error {
  readonly code: SmartMatchErrorCode;
  readonly statusCode: number;

  constructor(code: SmartMatchErrorCode, customMessage?: string) {
    super(customMessage || ERROR_MESSAGES[code]);
    this.name = 'SmartMatchError';
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code];

    // Ensure prototype chain is properly set
    Object.setPrototypeOf(this, SmartMatchError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}
