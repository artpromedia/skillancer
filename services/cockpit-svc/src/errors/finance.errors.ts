/**
 * @module @skillancer/cockpit-svc/errors/finance
 * Error definitions for financial tracking system
 */

export enum FinanceErrorCode {
  // Account errors
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  ACCOUNT_ALREADY_EXISTS = 'ACCOUNT_ALREADY_EXISTS',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  ACCOUNT_HAS_TRANSACTIONS = 'ACCOUNT_HAS_TRANSACTIONS',
  DEFAULT_ACCOUNT_REQUIRED = 'DEFAULT_ACCOUNT_REQUIRED',
  CANNOT_DELETE_DEFAULT_ACCOUNT = 'CANNOT_DELETE_DEFAULT_ACCOUNT',

  // Transaction errors
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  TRANSACTION_ALREADY_RECONCILED = 'TRANSACTION_ALREADY_RECONCILED',
  TRANSACTION_LOCKED = 'TRANSACTION_LOCKED',
  INVALID_TRANSACTION_AMOUNT = 'INVALID_TRANSACTION_AMOUNT',
  INVALID_TRANSACTION_DATE = 'INVALID_TRANSACTION_DATE',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',
  SPLIT_AMOUNTS_MISMATCH = 'SPLIT_AMOUNTS_MISMATCH',

  // Category errors
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  CATEGORY_ALREADY_EXISTS = 'CATEGORY_ALREADY_EXISTS',
  CATEGORY_IN_USE = 'CATEGORY_IN_USE',
  SYSTEM_CATEGORY_CANNOT_MODIFY = 'SYSTEM_CATEGORY_CANNOT_MODIFY',
  CATEGORY_HIERARCHY_ERROR = 'CATEGORY_HIERARCHY_ERROR',

  // Recurring transaction errors
  RECURRING_TRANSACTION_NOT_FOUND = 'RECURRING_TRANSACTION_NOT_FOUND',
  RECURRING_TRANSACTION_INACTIVE = 'RECURRING_TRANSACTION_INACTIVE',
  INVALID_RECURRENCE_PATTERN = 'INVALID_RECURRENCE_PATTERN',

  // Goal errors
  GOAL_NOT_FOUND = 'GOAL_NOT_FOUND',
  GOAL_ALREADY_COMPLETED = 'GOAL_ALREADY_COMPLETED',
  INVALID_GOAL_DATES = 'INVALID_GOAL_DATES',
  INVALID_GOAL_AMOUNT = 'INVALID_GOAL_AMOUNT',

  // Mileage errors
  MILEAGE_LOG_NOT_FOUND = 'MILEAGE_LOG_NOT_FOUND',
  INVALID_MILEAGE_DISTANCE = 'INVALID_MILEAGE_DISTANCE',
  INVALID_ODOMETER_READINGS = 'INVALID_ODOMETER_READINGS',

  // Tax profile errors
  TAX_PROFILE_NOT_FOUND = 'TAX_PROFILE_NOT_FOUND',
  TAX_PROFILE_ALREADY_EXISTS = 'TAX_PROFILE_ALREADY_EXISTS',
  INVALID_TAX_YEAR = 'INVALID_TAX_YEAR',

  // Plaid errors
  PLAID_LINK_ERROR = 'PLAID_LINK_ERROR',
  PLAID_SYNC_ERROR = 'PLAID_SYNC_ERROR',
  PLAID_TOKEN_EXPIRED = 'PLAID_TOKEN_EXPIRED',
  PLAID_ITEM_ERROR = 'PLAID_ITEM_ERROR',
  PLAID_CONNECTION_REQUIRED = 'PLAID_CONNECTION_REQUIRED',

  // Report errors
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  REPORT_GENERATION_FAILED = 'REPORT_GENERATION_FAILED',
  NO_DATA_FOR_REPORT = 'NO_DATA_FOR_REPORT',

  // Export errors
  EXPORT_FAILED = 'EXPORT_FAILED',
  INVALID_EXPORT_FORMAT = 'INVALID_EXPORT_FORMAT',
  NO_TRANSACTIONS_TO_EXPORT = 'NO_TRANSACTIONS_TO_EXPORT',

  // Receipt errors
  RECEIPT_UPLOAD_FAILED = 'RECEIPT_UPLOAD_FAILED',
  RECEIPT_NOT_FOUND = 'RECEIPT_NOT_FOUND',
  INVALID_RECEIPT_FORMAT = 'INVALID_RECEIPT_FORMAT',
  OCR_FAILED = 'OCR_FAILED',

  // Authorization errors
  ACCESS_DENIED = 'ACCESS_DENIED',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

const ERROR_MESSAGES: Record<FinanceErrorCode, string> = {
  // Account errors
  [FinanceErrorCode.ACCOUNT_NOT_FOUND]: 'Financial account not found.',
  [FinanceErrorCode.ACCOUNT_ALREADY_EXISTS]: 'An account with this name already exists.',
  [FinanceErrorCode.ACCOUNT_INACTIVE]: 'This account is inactive.',
  [FinanceErrorCode.ACCOUNT_HAS_TRANSACTIONS]: 'Cannot delete account with existing transactions.',
  [FinanceErrorCode.DEFAULT_ACCOUNT_REQUIRED]: 'At least one default account is required.',
  [FinanceErrorCode.CANNOT_DELETE_DEFAULT_ACCOUNT]:
    'Cannot delete the default account. Set another account as default first.',

  // Transaction errors
  [FinanceErrorCode.TRANSACTION_NOT_FOUND]: 'Transaction not found.',
  [FinanceErrorCode.TRANSACTION_ALREADY_RECONCILED]:
    'This transaction has already been reconciled.',
  [FinanceErrorCode.TRANSACTION_LOCKED]: 'This transaction is locked and cannot be modified.',
  [FinanceErrorCode.INVALID_TRANSACTION_AMOUNT]: 'Transaction amount must be greater than 0.',
  [FinanceErrorCode.INVALID_TRANSACTION_DATE]: 'Invalid transaction date.',
  [FinanceErrorCode.DUPLICATE_TRANSACTION]: 'A similar transaction already exists.',
  [FinanceErrorCode.SPLIT_AMOUNTS_MISMATCH]:
    'Split amounts must equal the original transaction amount.',

  // Category errors
  [FinanceErrorCode.CATEGORY_NOT_FOUND]: 'Category not found.',
  [FinanceErrorCode.CATEGORY_ALREADY_EXISTS]: 'A category with this name already exists.',
  [FinanceErrorCode.CATEGORY_IN_USE]: 'Cannot delete category that is being used by transactions.',
  [FinanceErrorCode.SYSTEM_CATEGORY_CANNOT_MODIFY]: 'System categories cannot be modified.',
  [FinanceErrorCode.CATEGORY_HIERARCHY_ERROR]: 'Invalid category hierarchy.',

  // Recurring transaction errors
  [FinanceErrorCode.RECURRING_TRANSACTION_NOT_FOUND]: 'Recurring transaction not found.',
  [FinanceErrorCode.RECURRING_TRANSACTION_INACTIVE]: 'This recurring transaction is inactive.',
  [FinanceErrorCode.INVALID_RECURRENCE_PATTERN]: 'Invalid recurrence pattern specified.',

  // Goal errors
  [FinanceErrorCode.GOAL_NOT_FOUND]: 'Financial goal not found.',
  [FinanceErrorCode.GOAL_ALREADY_COMPLETED]: 'This goal has already been completed.',
  [FinanceErrorCode.INVALID_GOAL_DATES]: 'Goal end date must be after start date.',
  [FinanceErrorCode.INVALID_GOAL_AMOUNT]: 'Goal target amount must be greater than 0.',

  // Mileage errors
  [FinanceErrorCode.MILEAGE_LOG_NOT_FOUND]: 'Mileage log not found.',
  [FinanceErrorCode.INVALID_MILEAGE_DISTANCE]: 'Distance must be greater than 0.',
  [FinanceErrorCode.INVALID_ODOMETER_READINGS]:
    'End odometer reading must be greater than start reading.',

  // Tax profile errors
  [FinanceErrorCode.TAX_PROFILE_NOT_FOUND]: 'Tax profile not found.',
  [FinanceErrorCode.TAX_PROFILE_ALREADY_EXISTS]: 'A tax profile for this year already exists.',
  [FinanceErrorCode.INVALID_TAX_YEAR]: 'Invalid tax year specified.',

  // Plaid errors
  [FinanceErrorCode.PLAID_LINK_ERROR]: 'Failed to create Plaid link token.',
  [FinanceErrorCode.PLAID_SYNC_ERROR]: 'Failed to sync transactions from bank.',
  [FinanceErrorCode.PLAID_TOKEN_EXPIRED]:
    'Bank connection has expired. Please reconnect your account.',
  [FinanceErrorCode.PLAID_ITEM_ERROR]: 'Bank connection error. Please reconnect your account.',
  [FinanceErrorCode.PLAID_CONNECTION_REQUIRED]:
    'This account requires a bank connection to sync transactions.',

  // Report errors
  [FinanceErrorCode.INVALID_DATE_RANGE]: 'Invalid date range specified.',
  [FinanceErrorCode.REPORT_GENERATION_FAILED]: 'Failed to generate report.',
  [FinanceErrorCode.NO_DATA_FOR_REPORT]: 'No data available for the specified period.',

  // Export errors
  [FinanceErrorCode.EXPORT_FAILED]: 'Failed to export transactions.',
  [FinanceErrorCode.INVALID_EXPORT_FORMAT]: 'Invalid export format specified.',
  [FinanceErrorCode.NO_TRANSACTIONS_TO_EXPORT]: 'No transactions found to export.',

  // Receipt errors
  [FinanceErrorCode.RECEIPT_UPLOAD_FAILED]: 'Failed to upload receipt.',
  [FinanceErrorCode.RECEIPT_NOT_FOUND]: 'Receipt not found.',
  [FinanceErrorCode.INVALID_RECEIPT_FORMAT]: 'Invalid receipt file format.',
  [FinanceErrorCode.OCR_FAILED]: 'Failed to extract data from receipt.',

  // Authorization errors
  [FinanceErrorCode.ACCESS_DENIED]: 'You do not have access to this resource.',
  [FinanceErrorCode.UNAUTHORIZED]: 'Authentication required.',
};

const HTTP_STATUS_CODES: Record<FinanceErrorCode, number> = {
  // Account errors - 404/409
  [FinanceErrorCode.ACCOUNT_NOT_FOUND]: 404,
  [FinanceErrorCode.ACCOUNT_ALREADY_EXISTS]: 409,
  [FinanceErrorCode.ACCOUNT_INACTIVE]: 400,
  [FinanceErrorCode.ACCOUNT_HAS_TRANSACTIONS]: 409,
  [FinanceErrorCode.DEFAULT_ACCOUNT_REQUIRED]: 400,
  [FinanceErrorCode.CANNOT_DELETE_DEFAULT_ACCOUNT]: 400,

  // Transaction errors - 400/404/409
  [FinanceErrorCode.TRANSACTION_NOT_FOUND]: 404,
  [FinanceErrorCode.TRANSACTION_ALREADY_RECONCILED]: 409,
  [FinanceErrorCode.TRANSACTION_LOCKED]: 400,
  [FinanceErrorCode.INVALID_TRANSACTION_AMOUNT]: 400,
  [FinanceErrorCode.INVALID_TRANSACTION_DATE]: 400,
  [FinanceErrorCode.DUPLICATE_TRANSACTION]: 409,
  [FinanceErrorCode.SPLIT_AMOUNTS_MISMATCH]: 400,

  // Category errors - 400/404/409
  [FinanceErrorCode.CATEGORY_NOT_FOUND]: 404,
  [FinanceErrorCode.CATEGORY_ALREADY_EXISTS]: 409,
  [FinanceErrorCode.CATEGORY_IN_USE]: 409,
  [FinanceErrorCode.SYSTEM_CATEGORY_CANNOT_MODIFY]: 400,
  [FinanceErrorCode.CATEGORY_HIERARCHY_ERROR]: 400,

  // Recurring transaction errors - 400/404
  [FinanceErrorCode.RECURRING_TRANSACTION_NOT_FOUND]: 404,
  [FinanceErrorCode.RECURRING_TRANSACTION_INACTIVE]: 400,
  [FinanceErrorCode.INVALID_RECURRENCE_PATTERN]: 400,

  // Goal errors - 400/404
  [FinanceErrorCode.GOAL_NOT_FOUND]: 404,
  [FinanceErrorCode.GOAL_ALREADY_COMPLETED]: 400,
  [FinanceErrorCode.INVALID_GOAL_DATES]: 400,
  [FinanceErrorCode.INVALID_GOAL_AMOUNT]: 400,

  // Mileage errors - 400/404
  [FinanceErrorCode.MILEAGE_LOG_NOT_FOUND]: 404,
  [FinanceErrorCode.INVALID_MILEAGE_DISTANCE]: 400,
  [FinanceErrorCode.INVALID_ODOMETER_READINGS]: 400,

  // Tax profile errors - 400/404/409
  [FinanceErrorCode.TAX_PROFILE_NOT_FOUND]: 404,
  [FinanceErrorCode.TAX_PROFILE_ALREADY_EXISTS]: 409,
  [FinanceErrorCode.INVALID_TAX_YEAR]: 400,

  // Plaid errors - 400/502
  [FinanceErrorCode.PLAID_LINK_ERROR]: 502,
  [FinanceErrorCode.PLAID_SYNC_ERROR]: 502,
  [FinanceErrorCode.PLAID_TOKEN_EXPIRED]: 400,
  [FinanceErrorCode.PLAID_ITEM_ERROR]: 502,
  [FinanceErrorCode.PLAID_CONNECTION_REQUIRED]: 400,

  // Report errors - 400/500
  [FinanceErrorCode.INVALID_DATE_RANGE]: 400,
  [FinanceErrorCode.REPORT_GENERATION_FAILED]: 500,
  [FinanceErrorCode.NO_DATA_FOR_REPORT]: 404,

  // Export errors - 400/500
  [FinanceErrorCode.EXPORT_FAILED]: 500,
  [FinanceErrorCode.INVALID_EXPORT_FORMAT]: 400,
  [FinanceErrorCode.NO_TRANSACTIONS_TO_EXPORT]: 404,

  // Receipt errors - 400/500
  [FinanceErrorCode.RECEIPT_UPLOAD_FAILED]: 500,
  [FinanceErrorCode.RECEIPT_NOT_FOUND]: 404,
  [FinanceErrorCode.INVALID_RECEIPT_FORMAT]: 400,
  [FinanceErrorCode.OCR_FAILED]: 500,

  // Authorization errors - 401/403
  [FinanceErrorCode.ACCESS_DENIED]: 403,
  [FinanceErrorCode.UNAUTHORIZED]: 401,
};

export class FinanceError extends Error {
  readonly code: FinanceErrorCode;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(code: FinanceErrorCode, details?: Record<string, unknown>) {
    super(ERROR_MESSAGES[code]);
    this.name = 'FinanceError';
    this.code = code;
    this.httpStatus = HTTP_STATUS_CODES[code];
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

/**
 * Type guard to check if an error is a FinanceError
 */
export function isFinanceError(error: unknown): error is FinanceError {
  return error instanceof FinanceError;
}
