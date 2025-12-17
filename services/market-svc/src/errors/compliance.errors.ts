/**
 * @module @skillancer/market-svc/errors/compliance
 * Compliance-related error classes and error codes
 */

export enum ComplianceErrorCode {
  // Compliance errors
  UNKNOWN_COMPLIANCE_TYPE = 'UNKNOWN_COMPLIANCE_TYPE',
  CERTIFICATION_REQUIRED = 'CERTIFICATION_REQUIRED',
  TRAINING_REQUIRED = 'TRAINING_REQUIRED',
  COMPLIANCE_NOT_FOUND = 'COMPLIANCE_NOT_FOUND',
  COMPLIANCE_ALREADY_EXISTS = 'COMPLIANCE_ALREADY_EXISTS',
  COMPLIANCE_EXPIRED = 'COMPLIANCE_EXPIRED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  VERIFICATION_IN_PROGRESS = 'VERIFICATION_IN_PROGRESS',
  INVALID_DOCUMENT = 'INVALID_DOCUMENT',
  DOCUMENT_REQUIRED = 'DOCUMENT_REQUIRED',

  // Clearance errors
  CLEARANCE_NOT_FOUND = 'CLEARANCE_NOT_FOUND',
  CLEARANCE_ALREADY_EXISTS = 'CLEARANCE_ALREADY_EXISTS',
  CLEARANCE_EXPIRED = 'CLEARANCE_EXPIRED',
  INVALID_CLEARANCE_LEVEL = 'INVALID_CLEARANCE_LEVEL',

  // Attestation errors
  ATTESTATION_REQUIRED = 'ATTESTATION_REQUIRED',
  ATTESTATION_EXPIRED = 'ATTESTATION_EXPIRED',
  ATTESTATION_ALREADY_EXISTS = 'ATTESTATION_ALREADY_EXISTS',
  INVALID_ATTESTATION_ANSWERS = 'INVALID_ATTESTATION_ANSWERS',

  // Requirement errors
  REQUIREMENT_NOT_FOUND = 'REQUIREMENT_NOT_FOUND',
  TENANT_REQUIREMENT_NOT_FOUND = 'TENANT_REQUIREMENT_NOT_FOUND',

  // Matching errors
  NO_MATCHING_FREELANCERS = 'NO_MATCHING_FREELANCERS',
  INVALID_MATCHING_CRITERIA = 'INVALID_MATCHING_CRITERIA',

  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

const ERROR_MESSAGES: Record<ComplianceErrorCode, string> = {
  [ComplianceErrorCode.UNKNOWN_COMPLIANCE_TYPE]: 'Unknown compliance type',
  [ComplianceErrorCode.CERTIFICATION_REQUIRED]:
    'Certification is required for this compliance type',
  [ComplianceErrorCode.TRAINING_REQUIRED]:
    'Training completion is required for this compliance type',
  [ComplianceErrorCode.COMPLIANCE_NOT_FOUND]: 'Compliance record not found',
  [ComplianceErrorCode.COMPLIANCE_ALREADY_EXISTS]: 'Compliance record already exists for this type',
  [ComplianceErrorCode.COMPLIANCE_EXPIRED]: 'Compliance has expired',
  [ComplianceErrorCode.VERIFICATION_FAILED]: 'Compliance verification failed',
  [ComplianceErrorCode.VERIFICATION_IN_PROGRESS]: 'Verification is already in progress',
  [ComplianceErrorCode.INVALID_DOCUMENT]: 'Invalid compliance document',
  [ComplianceErrorCode.DOCUMENT_REQUIRED]: 'Document is required for this compliance type',

  [ComplianceErrorCode.CLEARANCE_NOT_FOUND]: 'Security clearance not found',
  [ComplianceErrorCode.CLEARANCE_ALREADY_EXISTS]:
    'Security clearance already exists for this level',
  [ComplianceErrorCode.CLEARANCE_EXPIRED]: 'Security clearance has expired',
  [ComplianceErrorCode.INVALID_CLEARANCE_LEVEL]: 'Invalid security clearance level',

  [ComplianceErrorCode.ATTESTATION_REQUIRED]: 'Attestation is required',
  [ComplianceErrorCode.ATTESTATION_EXPIRED]: 'Attestation has expired',
  [ComplianceErrorCode.ATTESTATION_ALREADY_EXISTS]: 'Active attestation already exists',
  [ComplianceErrorCode.INVALID_ATTESTATION_ANSWERS]: 'Invalid attestation answers',

  [ComplianceErrorCode.REQUIREMENT_NOT_FOUND]: 'Compliance requirement not found',
  [ComplianceErrorCode.TENANT_REQUIREMENT_NOT_FOUND]: 'Tenant compliance requirement not found',

  [ComplianceErrorCode.NO_MATCHING_FREELANCERS]: 'No freelancers match the compliance criteria',
  [ComplianceErrorCode.INVALID_MATCHING_CRITERIA]: 'Invalid matching criteria provided',

  [ComplianceErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ComplianceErrorCode.FORBIDDEN]: 'You do not have permission to perform this action',
};

const ERROR_STATUS_CODES: Record<ComplianceErrorCode, number> = {
  [ComplianceErrorCode.UNKNOWN_COMPLIANCE_TYPE]: 400,
  [ComplianceErrorCode.CERTIFICATION_REQUIRED]: 400,
  [ComplianceErrorCode.TRAINING_REQUIRED]: 400,
  [ComplianceErrorCode.COMPLIANCE_NOT_FOUND]: 404,
  [ComplianceErrorCode.COMPLIANCE_ALREADY_EXISTS]: 409,
  [ComplianceErrorCode.COMPLIANCE_EXPIRED]: 410,
  [ComplianceErrorCode.VERIFICATION_FAILED]: 422,
  [ComplianceErrorCode.VERIFICATION_IN_PROGRESS]: 409,
  [ComplianceErrorCode.INVALID_DOCUMENT]: 400,
  [ComplianceErrorCode.DOCUMENT_REQUIRED]: 400,

  [ComplianceErrorCode.CLEARANCE_NOT_FOUND]: 404,
  [ComplianceErrorCode.CLEARANCE_ALREADY_EXISTS]: 409,
  [ComplianceErrorCode.CLEARANCE_EXPIRED]: 410,
  [ComplianceErrorCode.INVALID_CLEARANCE_LEVEL]: 400,

  [ComplianceErrorCode.ATTESTATION_REQUIRED]: 400,
  [ComplianceErrorCode.ATTESTATION_EXPIRED]: 410,
  [ComplianceErrorCode.ATTESTATION_ALREADY_EXISTS]: 409,
  [ComplianceErrorCode.INVALID_ATTESTATION_ANSWERS]: 400,

  [ComplianceErrorCode.REQUIREMENT_NOT_FOUND]: 404,
  [ComplianceErrorCode.TENANT_REQUIREMENT_NOT_FOUND]: 404,

  [ComplianceErrorCode.NO_MATCHING_FREELANCERS]: 404,
  [ComplianceErrorCode.INVALID_MATCHING_CRITERIA]: 400,

  [ComplianceErrorCode.UNAUTHORIZED]: 401,
  [ComplianceErrorCode.FORBIDDEN]: 403,
};

export class ComplianceError extends Error {
  readonly code: ComplianceErrorCode;
  readonly statusCode: number;

  constructor(code: ComplianceErrorCode, customMessage?: string) {
    super(customMessage || ERROR_MESSAGES[code]);
    this.name = 'ComplianceError';
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code];

    // Ensure prototype chain is properly set
    Object.setPrototypeOf(this, ComplianceError.prototype);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}
