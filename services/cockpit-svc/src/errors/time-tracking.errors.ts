/**
 * @module @skillancer/cockpit-svc/errors/time-tracking
 * Error definitions for time tracking system
 */

export enum TimeTrackingErrorCode {
  // Timer errors
  TIMER_ALREADY_RUNNING = 'TIMER_ALREADY_RUNNING',
  NO_ACTIVE_TIMER = 'NO_ACTIVE_TIMER',
  TIMER_NOT_RUNNING = 'TIMER_NOT_RUNNING',
  TIMER_NOT_PAUSED = 'TIMER_NOT_PAUSED',
  TIMER_NOT_FOUND = 'TIMER_NOT_FOUND',

  // Time entry errors
  ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND',
  ENTRY_LOCKED = 'ENTRY_LOCKED',
  ENTRY_INVOICED = 'ENTRY_INVOICED',
  ENTRY_ALREADY_EXISTS = 'ENTRY_ALREADY_EXISTS',
  INVALID_DURATION = 'INVALID_DURATION',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',

  // Timesheet errors
  TIMESHEET_NOT_FOUND = 'TIMESHEET_NOT_FOUND',
  TIMESHEET_ALREADY_SUBMITTED = 'TIMESHEET_ALREADY_SUBMITTED',
  TIMESHEET_ALREADY_APPROVED = 'TIMESHEET_ALREADY_APPROVED',
  TIMESHEET_LOCKED = 'TIMESHEET_LOCKED',
  TIMESHEET_CANNOT_REOPEN = 'TIMESHEET_CANNOT_REOPEN',

  // Settings errors
  SETTINGS_NOT_FOUND = 'SETTINGS_NOT_FOUND',
  INVALID_SETTINGS = 'INVALID_SETTINGS',

  // Category errors
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  CATEGORY_ALREADY_EXISTS = 'CATEGORY_ALREADY_EXISTS',
  CATEGORY_IN_USE = 'CATEGORY_IN_USE',
  SYSTEM_CATEGORY_CANNOT_DELETE = 'SYSTEM_CATEGORY_CANNOT_DELETE',

  // Validation errors
  DESCRIPTION_REQUIRED = 'DESCRIPTION_REQUIRED',
  PROJECT_REQUIRED = 'PROJECT_REQUIRED',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',

  // Sync errors
  SYNC_FAILED = 'SYNC_FAILED',
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  CONTRACT_NOT_HOURLY = 'CONTRACT_NOT_HOURLY',
  MARKET_SYNC_ERROR = 'MARKET_SYNC_ERROR',

  // Export errors
  EXPORT_FAILED = 'EXPORT_FAILED',
  INVALID_EXPORT_FORMAT = 'INVALID_EXPORT_FORMAT',
  NO_ENTRIES_TO_EXPORT = 'NO_ENTRIES_TO_EXPORT',

  // Invoice errors
  ENTRIES_ALREADY_INVOICED = 'ENTRIES_ALREADY_INVOICED',
  INVOICE_NOT_FOUND = 'INVOICE_NOT_FOUND',
}

const ERROR_MESSAGES: Record<TimeTrackingErrorCode, string> = {
  // Timer errors
  [TimeTrackingErrorCode.TIMER_ALREADY_RUNNING]:
    'A timer is already running. Stop it before starting a new one.',
  [TimeTrackingErrorCode.NO_ACTIVE_TIMER]: 'No active timer found.',
  [TimeTrackingErrorCode.TIMER_NOT_RUNNING]: 'Timer is not running.',
  [TimeTrackingErrorCode.TIMER_NOT_PAUSED]: 'Timer is not paused.',
  [TimeTrackingErrorCode.TIMER_NOT_FOUND]: 'Timer not found.',

  // Time entry errors
  [TimeTrackingErrorCode.ENTRY_NOT_FOUND]: 'Time entry not found.',
  [TimeTrackingErrorCode.ENTRY_LOCKED]: 'This time entry is locked and cannot be modified.',
  [TimeTrackingErrorCode.ENTRY_INVOICED]: 'Cannot modify an invoiced time entry.',
  [TimeTrackingErrorCode.ENTRY_ALREADY_EXISTS]: 'A time entry with these details already exists.',
  [TimeTrackingErrorCode.INVALID_DURATION]: 'Duration must be greater than 0.',
  [TimeTrackingErrorCode.INVALID_DATE_RANGE]: 'Invalid date range specified.',

  // Timesheet errors
  [TimeTrackingErrorCode.TIMESHEET_NOT_FOUND]: 'Timesheet not found.',
  [TimeTrackingErrorCode.TIMESHEET_ALREADY_SUBMITTED]: 'Timesheet has already been submitted.',
  [TimeTrackingErrorCode.TIMESHEET_ALREADY_APPROVED]: 'Timesheet has already been approved.',
  [TimeTrackingErrorCode.TIMESHEET_LOCKED]: 'Timesheet is locked and cannot be modified.',
  [TimeTrackingErrorCode.TIMESHEET_CANNOT_REOPEN]: 'This timesheet cannot be reopened.',

  // Settings errors
  [TimeTrackingErrorCode.SETTINGS_NOT_FOUND]: 'Time tracking settings not found.',
  [TimeTrackingErrorCode.INVALID_SETTINGS]: 'Invalid settings provided.',

  // Category errors
  [TimeTrackingErrorCode.CATEGORY_NOT_FOUND]: 'Category not found.',
  [TimeTrackingErrorCode.CATEGORY_ALREADY_EXISTS]: 'A category with this name already exists.',
  [TimeTrackingErrorCode.CATEGORY_IN_USE]: 'Cannot delete category that is in use.',
  [TimeTrackingErrorCode.SYSTEM_CATEGORY_CANNOT_DELETE]: 'System categories cannot be deleted.',

  // Validation errors
  [TimeTrackingErrorCode.DESCRIPTION_REQUIRED]: 'Description is required.',
  [TimeTrackingErrorCode.PROJECT_REQUIRED]: 'Project is required based on your settings.',
  [TimeTrackingErrorCode.TASK_NOT_FOUND]: 'Task not found.',
  [TimeTrackingErrorCode.PROJECT_NOT_FOUND]: 'Project not found.',
  [TimeTrackingErrorCode.CLIENT_NOT_FOUND]: 'Client not found.',
  [TimeTrackingErrorCode.ACCESS_DENIED]: 'You do not have permission to access this resource.',

  // Sync errors
  [TimeTrackingErrorCode.SYNC_FAILED]: 'Failed to sync with external service.',
  [TimeTrackingErrorCode.CONTRACT_NOT_FOUND]: 'Contract not found.',
  [TimeTrackingErrorCode.CONTRACT_NOT_HOURLY]: 'Contract is not hourly-based.',
  [TimeTrackingErrorCode.MARKET_SYNC_ERROR]: 'Failed to sync with Skillancer Market.',

  // Export errors
  [TimeTrackingErrorCode.EXPORT_FAILED]: 'Failed to export time entries.',
  [TimeTrackingErrorCode.INVALID_EXPORT_FORMAT]: 'Invalid export format specified.',
  [TimeTrackingErrorCode.NO_ENTRIES_TO_EXPORT]: 'No time entries found to export.',

  // Invoice errors
  [TimeTrackingErrorCode.ENTRIES_ALREADY_INVOICED]: 'Some entries have already been invoiced.',
  [TimeTrackingErrorCode.INVOICE_NOT_FOUND]: 'Invoice not found.',
};

const ERROR_HTTP_CODES: Partial<Record<TimeTrackingErrorCode, number>> = {
  [TimeTrackingErrorCode.TIMER_ALREADY_RUNNING]: 409,
  [TimeTrackingErrorCode.NO_ACTIVE_TIMER]: 404,
  [TimeTrackingErrorCode.TIMER_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.ENTRY_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.ENTRY_LOCKED]: 403,
  [TimeTrackingErrorCode.ENTRY_INVOICED]: 403,
  [TimeTrackingErrorCode.TIMESHEET_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.TIMESHEET_LOCKED]: 403,
  [TimeTrackingErrorCode.SETTINGS_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.CATEGORY_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.CATEGORY_ALREADY_EXISTS]: 409,
  [TimeTrackingErrorCode.PROJECT_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.TASK_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.CLIENT_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.CONTRACT_NOT_FOUND]: 404,
  [TimeTrackingErrorCode.ACCESS_DENIED]: 403,
  [TimeTrackingErrorCode.INVALID_DURATION]: 400,
  [TimeTrackingErrorCode.INVALID_DATE_RANGE]: 400,
  [TimeTrackingErrorCode.DESCRIPTION_REQUIRED]: 400,
  [TimeTrackingErrorCode.PROJECT_REQUIRED]: 400,
  [TimeTrackingErrorCode.INVALID_SETTINGS]: 400,
  [TimeTrackingErrorCode.INVALID_EXPORT_FORMAT]: 400,
};

export class TimeTrackingError extends Error {
  readonly code: TimeTrackingErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(code: TimeTrackingErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message || ERROR_MESSAGES[code] || 'Time tracking error');
    this.name = 'TimeTrackingError';
    this.code = code;
    this.statusCode = ERROR_HTTP_CODES[code] || 400;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeTrackingError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}
