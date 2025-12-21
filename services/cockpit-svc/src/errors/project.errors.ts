/**
 * @module @skillancer/cockpit-svc/errors/project
 * Project Management Error Definitions
 */

export enum ProjectErrorCode {
  // Project errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PROJECT_ARCHIVED = 'PROJECT_ARCHIVED',
  NOT_MARKET_PROJECT = 'NOT_MARKET_PROJECT',
  PROJECT_ALREADY_EXISTS = 'PROJECT_ALREADY_EXISTS',

  // Task errors
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_ALREADY_COMPLETED = 'TASK_ALREADY_COMPLETED',
  CIRCULAR_TASK_REFERENCE = 'CIRCULAR_TASK_REFERENCE',

  // Milestone errors
  MILESTONE_NOT_FOUND = 'MILESTONE_NOT_FOUND',
  MILESTONE_ALREADY_COMPLETED = 'MILESTONE_ALREADY_COMPLETED',

  // Time entry errors
  TIME_ENTRY_NOT_FOUND = 'TIME_ENTRY_NOT_FOUND',
  TIMER_ALREADY_RUNNING = 'TIMER_ALREADY_RUNNING',
  NO_ACTIVE_TIMER = 'NO_ACTIVE_TIMER',
  INVALID_DURATION = 'INVALID_DURATION',

  // File errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',

  // Template errors
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_IN_USE = 'TEMPLATE_IN_USE',

  // Access errors
  ACCESS_DENIED = 'ACCESS_DENIED',
  CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND',

  // Sync errors
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  SYNC_FAILED = 'SYNC_FAILED',
  ALREADY_IMPORTED = 'ALREADY_IMPORTED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

const ERROR_MESSAGES: Record<ProjectErrorCode, string> = {
  [ProjectErrorCode.PROJECT_NOT_FOUND]: 'Project not found',
  [ProjectErrorCode.PROJECT_ARCHIVED]: 'This project has been archived',
  [ProjectErrorCode.NOT_MARKET_PROJECT]: 'This project is not linked to a Market contract',
  [ProjectErrorCode.PROJECT_ALREADY_EXISTS]: 'A project with this identifier already exists',
  [ProjectErrorCode.TASK_NOT_FOUND]: 'Task not found',
  [ProjectErrorCode.TASK_ALREADY_COMPLETED]: 'This task has already been completed',
  [ProjectErrorCode.CIRCULAR_TASK_REFERENCE]: 'Cannot create circular task reference',
  [ProjectErrorCode.MILESTONE_NOT_FOUND]: 'Milestone not found',
  [ProjectErrorCode.MILESTONE_ALREADY_COMPLETED]: 'This milestone has already been completed',
  [ProjectErrorCode.TIME_ENTRY_NOT_FOUND]: 'Time entry not found',
  [ProjectErrorCode.TIMER_ALREADY_RUNNING]: 'A timer is already running for this project',
  [ProjectErrorCode.NO_ACTIVE_TIMER]: 'No active timer found',
  [ProjectErrorCode.INVALID_DURATION]: 'Invalid duration specified',
  [ProjectErrorCode.FILE_NOT_FOUND]: 'File not found',
  [ProjectErrorCode.FILE_TOO_LARGE]: 'File size exceeds the maximum allowed size',
  [ProjectErrorCode.INVALID_FILE_TYPE]: 'Invalid file type',
  [ProjectErrorCode.TEMPLATE_NOT_FOUND]: 'Template not found',
  [ProjectErrorCode.TEMPLATE_IN_USE]: 'Template is currently in use',
  [ProjectErrorCode.ACCESS_DENIED]: 'You do not have permission to access this resource',
  [ProjectErrorCode.CLIENT_NOT_FOUND]: 'Client not found',
  [ProjectErrorCode.CONTRACT_NOT_FOUND]: 'Contract not found',
  [ProjectErrorCode.SYNC_FAILED]: 'Failed to sync from Skillancer Market',
  [ProjectErrorCode.ALREADY_IMPORTED]: 'This contract has already been imported',
  [ProjectErrorCode.VALIDATION_ERROR]: 'Validation error',
  [ProjectErrorCode.INVALID_STATUS_TRANSITION]: 'Invalid status transition',
  [ProjectErrorCode.INVALID_DATE_RANGE]: 'Invalid date range',
  [ProjectErrorCode.INTERNAL_ERROR]: 'An internal error occurred',
};

const ERROR_STATUS_CODES: Record<ProjectErrorCode, number> = {
  [ProjectErrorCode.PROJECT_NOT_FOUND]: 404,
  [ProjectErrorCode.PROJECT_ARCHIVED]: 400,
  [ProjectErrorCode.NOT_MARKET_PROJECT]: 400,
  [ProjectErrorCode.PROJECT_ALREADY_EXISTS]: 409,
  [ProjectErrorCode.TASK_NOT_FOUND]: 404,
  [ProjectErrorCode.TASK_ALREADY_COMPLETED]: 400,
  [ProjectErrorCode.CIRCULAR_TASK_REFERENCE]: 400,
  [ProjectErrorCode.MILESTONE_NOT_FOUND]: 404,
  [ProjectErrorCode.MILESTONE_ALREADY_COMPLETED]: 400,
  [ProjectErrorCode.TIME_ENTRY_NOT_FOUND]: 404,
  [ProjectErrorCode.TIMER_ALREADY_RUNNING]: 409,
  [ProjectErrorCode.NO_ACTIVE_TIMER]: 400,
  [ProjectErrorCode.INVALID_DURATION]: 400,
  [ProjectErrorCode.FILE_NOT_FOUND]: 404,
  [ProjectErrorCode.FILE_TOO_LARGE]: 413,
  [ProjectErrorCode.INVALID_FILE_TYPE]: 400,
  [ProjectErrorCode.TEMPLATE_NOT_FOUND]: 404,
  [ProjectErrorCode.TEMPLATE_IN_USE]: 409,
  [ProjectErrorCode.ACCESS_DENIED]: 403,
  [ProjectErrorCode.CLIENT_NOT_FOUND]: 404,
  [ProjectErrorCode.CONTRACT_NOT_FOUND]: 404,
  [ProjectErrorCode.SYNC_FAILED]: 500,
  [ProjectErrorCode.ALREADY_IMPORTED]: 409,
  [ProjectErrorCode.VALIDATION_ERROR]: 400,
  [ProjectErrorCode.INVALID_STATUS_TRANSITION]: 400,
  [ProjectErrorCode.INVALID_DATE_RANGE]: 400,
  [ProjectErrorCode.INTERNAL_ERROR]: 500,
};

export class ProjectError extends Error {
  public readonly code: ProjectErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | undefined;

  constructor(code: ProjectErrorCode, details?: Record<string, unknown>) {
    super(ERROR_MESSAGES[code]);
    this.name = 'ProjectError';
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code];
    this.details = details;

    // Maintain proper stack trace for V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProjectError);
    }
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export function getStatusCode(error: unknown): number {
  if (error instanceof ProjectError) {
    return error.statusCode;
  }
  return 500;
}
