/**
 * @module @skillancer/cockpit-svc/errors/crm
 * CRM Error Definitions
 */

export enum CrmErrorCode {
  // Client errors
  CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND',
  DUPLICATE_CLIENT_EMAIL = 'DUPLICATE_CLIENT_EMAIL',
  CLIENT_ARCHIVED = 'CLIENT_ARCHIVED',

  // Contact errors
  CONTACT_NOT_FOUND = 'CONTACT_NOT_FOUND',

  // Interaction errors
  INTERACTION_NOT_FOUND = 'INTERACTION_NOT_FOUND',

  // Opportunity errors
  OPPORTUNITY_NOT_FOUND = 'OPPORTUNITY_NOT_FOUND',
  INVALID_STAGE_TRANSITION = 'INVALID_STAGE_TRANSITION',
  OPPORTUNITY_CLOSED = 'OPPORTUNITY_CLOSED',

  // Document errors
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  INVALID_DOCUMENT_TYPE = 'INVALID_DOCUMENT_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // Reminder errors
  REMINDER_NOT_FOUND = 'REMINDER_NOT_FOUND',
  REMINDER_COMPLETED = 'REMINDER_COMPLETED',

  // Custom field errors
  CUSTOM_FIELD_NOT_FOUND = 'CUSTOM_FIELD_NOT_FOUND',
  DUPLICATE_CUSTOM_FIELD = 'DUPLICATE_CUSTOM_FIELD',

  // Access errors
  ACCESS_DENIED = 'ACCESS_DENIED',

  // Sync errors
  SYNC_FAILED = 'SYNC_FAILED',
  PLATFORM_USER_NOT_FOUND = 'PLATFORM_USER_NOT_FOUND',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

const ERROR_MESSAGES: Record<CrmErrorCode, string> = {
  [CrmErrorCode.CLIENT_NOT_FOUND]: 'Client not found',
  [CrmErrorCode.DUPLICATE_CLIENT_EMAIL]: 'A client with this email already exists',
  [CrmErrorCode.CLIENT_ARCHIVED]: 'This client has been archived',
  [CrmErrorCode.CONTACT_NOT_FOUND]: 'Contact not found',
  [CrmErrorCode.INTERACTION_NOT_FOUND]: 'Interaction not found',
  [CrmErrorCode.OPPORTUNITY_NOT_FOUND]: 'Opportunity not found',
  [CrmErrorCode.INVALID_STAGE_TRANSITION]: 'Invalid stage transition',
  [CrmErrorCode.OPPORTUNITY_CLOSED]: 'This opportunity is already closed',
  [CrmErrorCode.DOCUMENT_NOT_FOUND]: 'Document not found',
  [CrmErrorCode.INVALID_DOCUMENT_TYPE]: 'Invalid document type',
  [CrmErrorCode.FILE_TOO_LARGE]: 'File size exceeds the maximum allowed size',
  [CrmErrorCode.REMINDER_NOT_FOUND]: 'Reminder not found',
  [CrmErrorCode.REMINDER_COMPLETED]: 'This reminder has already been completed',
  [CrmErrorCode.CUSTOM_FIELD_NOT_FOUND]: 'Custom field not found',
  [CrmErrorCode.DUPLICATE_CUSTOM_FIELD]: 'A custom field with this name already exists',
  [CrmErrorCode.ACCESS_DENIED]: 'You do not have permission to access this resource',
  [CrmErrorCode.SYNC_FAILED]: 'Failed to sync from Skillancer Market',
  [CrmErrorCode.PLATFORM_USER_NOT_FOUND]: 'Platform user not found',
  [CrmErrorCode.VALIDATION_ERROR]: 'Validation error',
  [CrmErrorCode.INTERNAL_ERROR]: 'An internal error occurred',
};

const ERROR_STATUS_CODES: Record<CrmErrorCode, number> = {
  [CrmErrorCode.CLIENT_NOT_FOUND]: 404,
  [CrmErrorCode.DUPLICATE_CLIENT_EMAIL]: 409,
  [CrmErrorCode.CLIENT_ARCHIVED]: 400,
  [CrmErrorCode.CONTACT_NOT_FOUND]: 404,
  [CrmErrorCode.INTERACTION_NOT_FOUND]: 404,
  [CrmErrorCode.OPPORTUNITY_NOT_FOUND]: 404,
  [CrmErrorCode.INVALID_STAGE_TRANSITION]: 400,
  [CrmErrorCode.OPPORTUNITY_CLOSED]: 400,
  [CrmErrorCode.DOCUMENT_NOT_FOUND]: 404,
  [CrmErrorCode.INVALID_DOCUMENT_TYPE]: 400,
  [CrmErrorCode.FILE_TOO_LARGE]: 413,
  [CrmErrorCode.REMINDER_NOT_FOUND]: 404,
  [CrmErrorCode.REMINDER_COMPLETED]: 400,
  [CrmErrorCode.CUSTOM_FIELD_NOT_FOUND]: 404,
  [CrmErrorCode.DUPLICATE_CUSTOM_FIELD]: 409,
  [CrmErrorCode.ACCESS_DENIED]: 403,
  [CrmErrorCode.SYNC_FAILED]: 500,
  [CrmErrorCode.PLATFORM_USER_NOT_FOUND]: 404,
  [CrmErrorCode.VALIDATION_ERROR]: 400,
  [CrmErrorCode.INTERNAL_ERROR]: 500,
};

export class CrmError extends Error {
  public readonly code: CrmErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | undefined;

  constructor(code: CrmErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message || ERROR_MESSAGES[code]);
    this.name = 'CrmError';
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code];
    this.details = details ?? undefined;

    // Ensure prototype chain is properly set
    Object.setPrototypeOf(this, CrmError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Get HTTP status code for a CRM error code
 */
export function getStatusCode(code: CrmErrorCode): number {
  return ERROR_STATUS_CODES[code] || 500;
}
