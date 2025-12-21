/**
 * @module @skillancer/cockpit-svc/errors/calendar
 * Calendar Integration Error Definitions
 */

export enum CalendarErrorCode {
  // Connection errors
  CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
  CONNECTION_EXISTS = 'CONNECTION_EXISTS',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  UNSUPPORTED_PROVIDER = 'UNSUPPORTED_PROVIDER',
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',

  // OAuth errors
  OAUTH_ERROR = 'OAUTH_ERROR',
  OAUTH_CODE_INVALID = 'OAUTH_CODE_INVALID',
  OAUTH_TOKEN_EXCHANGE_FAILED = 'OAUTH_TOKEN_EXCHANGE_FAILED',
  OAUTH_TOKEN_REFRESH_FAILED = 'OAUTH_TOKEN_REFRESH_FAILED',
  OAUTH_TOKEN_EXPIRED = 'OAUTH_TOKEN_EXPIRED',
  INVALID_OAUTH_STATE = 'INVALID_OAUTH_STATE',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',

  // Calendar errors
  CALENDAR_NOT_FOUND = 'CALENDAR_NOT_FOUND',
  CALENDAR_ACCESS_DENIED = 'CALENDAR_ACCESS_DENIED',
  CALENDAR_SYNC_FAILED = 'CALENDAR_SYNC_FAILED',
  CALENDAR_LIST_FAILED = 'CALENDAR_LIST_FAILED',
  SYNC_TOKEN_EXPIRED = 'SYNC_TOKEN_EXPIRED',

  // Event errors
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',
  EVENT_ACCESS_DENIED = 'EVENT_ACCESS_DENIED',
  EVENT_CREATE_FAILED = 'EVENT_CREATE_FAILED',
  EVENT_UPDATE_FAILED = 'EVENT_UPDATE_FAILED',
  EVENT_DELETE_FAILED = 'EVENT_DELETE_FAILED',
  EVENT_CONFLICT = 'EVENT_CONFLICT',
  EVENT_FETCH_FAILED = 'EVENT_FETCH_FAILED',
  EXTERNAL_EVENT_NOT_FOUND = 'EXTERNAL_EVENT_NOT_FOUND',
  TIME_ENTRY_EXISTS = 'TIME_ENTRY_EXISTS',
  INVALID_TIME_RANGE = 'INVALID_TIME_RANGE',
  INVALID_RECURRENCE = 'INVALID_RECURRENCE',

  // Schedule errors
  SCHEDULE_NOT_FOUND = 'SCHEDULE_NOT_FOUND',
  SCHEDULE_ACCESS_DENIED = 'SCHEDULE_ACCESS_DENIED',
  INVALID_SCHEDULE = 'INVALID_SCHEDULE',
  SCHEDULE_IN_USE = 'SCHEDULE_IN_USE',

  // Booking link errors
  BOOKING_LINK_NOT_FOUND = 'BOOKING_LINK_NOT_FOUND',
  BOOKING_LINK_ACCESS_DENIED = 'BOOKING_LINK_ACCESS_DENIED',
  BOOKING_LINK_SLUG_EXISTS = 'BOOKING_LINK_SLUG_EXISTS',
  SLUG_EXISTS = 'SLUG_EXISTS',
  SLUG_INVALID = 'SLUG_INVALID',
  BOOKING_LINK_INACTIVE = 'BOOKING_LINK_INACTIVE',

  // Booking errors
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',
  BOOKING_ACCESS_DENIED = 'BOOKING_ACCESS_DENIED',
  SLOT_NOT_AVAILABLE = 'SLOT_NOT_AVAILABLE',
  TIMESLOT_NOT_AVAILABLE = 'TIMESLOT_NOT_AVAILABLE',
  MAX_BOOKINGS_REACHED = 'MAX_BOOKINGS_REACHED',
  INVALID_BOOKING_STATUS = 'INVALID_BOOKING_STATUS',
  DAILY_LIMIT_REACHED = 'DAILY_LIMIT_REACHED',
  MIN_NOTICE_REQUIRED = 'MIN_NOTICE_REQUIRED',
  MAX_ADVANCE_EXCEEDED = 'MAX_ADVANCE_EXCEEDED',
  ALREADY_CANCELLED = 'ALREADY_CANCELLED',
  ALREADY_COMPLETED = 'ALREADY_COMPLETED',
  INVALID_CANCELLATION_TOKEN = 'INVALID_CANCELLATION_TOKEN',

  // Sync errors
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  SYNC_FAILED = 'SYNC_FAILED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_DATE = 'INVALID_DATE',
  INVALID_TIMEZONE = 'INVALID_TIMEZONE',

  // External API errors
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

const ERROR_MESSAGES: Record<CalendarErrorCode, string> = {
  [CalendarErrorCode.CONNECTION_NOT_FOUND]: 'Calendar connection not found',
  [CalendarErrorCode.CONNECTION_EXISTS]: 'Calendar connection already exists',
  [CalendarErrorCode.CONNECTION_FAILED]: 'Failed to connect calendar',
  [CalendarErrorCode.UNSUPPORTED_PROVIDER]: 'Calendar provider not supported',

  [CalendarErrorCode.OAUTH_ERROR]: 'OAuth authentication failed',
  [CalendarErrorCode.OAUTH_CODE_INVALID]: 'Invalid authorization code',
  [CalendarErrorCode.TOKEN_EXPIRED]: 'Calendar access token expired',
  [CalendarErrorCode.TOKEN_REFRESH_FAILED]: 'Failed to refresh access token',
  [CalendarErrorCode.INSUFFICIENT_SCOPE]: 'Insufficient permissions for this operation',

  [CalendarErrorCode.CALENDAR_NOT_FOUND]: 'Calendar not found',
  [CalendarErrorCode.CALENDAR_ACCESS_DENIED]: 'Access to calendar denied',
  [CalendarErrorCode.CALENDAR_SYNC_FAILED]: 'Calendar synchronization failed',

  [CalendarErrorCode.EVENT_NOT_FOUND]: 'Event not found',
  [CalendarErrorCode.EVENT_ACCESS_DENIED]: 'Access to event denied',
  [CalendarErrorCode.EVENT_CREATE_FAILED]: 'Failed to create event',
  [CalendarErrorCode.EVENT_UPDATE_FAILED]: 'Failed to update event',
  [CalendarErrorCode.EVENT_DELETE_FAILED]: 'Failed to delete event',
  [CalendarErrorCode.EVENT_CONFLICT]: 'Event conflicts with existing event',
  [CalendarErrorCode.TIME_ENTRY_EXISTS]: 'A time entry already exists for this event',
  [CalendarErrorCode.INVALID_TIME_RANGE]: 'Invalid time range',
  [CalendarErrorCode.INVALID_RECURRENCE]: 'Invalid recurrence rule',

  [CalendarErrorCode.SCHEDULE_NOT_FOUND]: 'Availability schedule not found',
  [CalendarErrorCode.SCHEDULE_ACCESS_DENIED]: 'Access to schedule denied',
  [CalendarErrorCode.INVALID_SCHEDULE]: 'Invalid schedule configuration',
  [CalendarErrorCode.SCHEDULE_IN_USE]: 'Schedule is in use by booking links',

  [CalendarErrorCode.BOOKING_LINK_NOT_FOUND]: 'Booking link not found',
  [CalendarErrorCode.BOOKING_LINK_ACCESS_DENIED]: 'Access to booking link denied',
  [CalendarErrorCode.SLUG_EXISTS]: 'This booking link URL is already taken',
  [CalendarErrorCode.SLUG_INVALID]: 'Invalid booking link URL format',
  [CalendarErrorCode.BOOKING_LINK_INACTIVE]: 'This booking link is no longer active',

  [CalendarErrorCode.BOOKING_NOT_FOUND]: 'Booking not found',
  [CalendarErrorCode.BOOKING_ACCESS_DENIED]: 'Access to booking denied',
  [CalendarErrorCode.SLOT_NOT_AVAILABLE]: 'This time slot is no longer available',
  [CalendarErrorCode.DAILY_LIMIT_REACHED]: 'No more bookings available for this day',
  [CalendarErrorCode.MIN_NOTICE_REQUIRED]: 'Minimum notice time not met',
  [CalendarErrorCode.MAX_ADVANCE_EXCEEDED]: 'Cannot book this far in advance',
  [CalendarErrorCode.ALREADY_CANCELLED]: 'Booking is already cancelled',
  [CalendarErrorCode.ALREADY_COMPLETED]: 'Booking is already completed',
  [CalendarErrorCode.INVALID_CANCELLATION_TOKEN]: 'Invalid cancellation token',

  [CalendarErrorCode.SYNC_IN_PROGRESS]: 'Calendar sync is already in progress',
  [CalendarErrorCode.SYNC_FAILED]: 'Calendar synchronization failed',
  [CalendarErrorCode.SYNC_CONFLICT]: 'Sync conflict detected',

  [CalendarErrorCode.VALIDATION_ERROR]: 'Validation error',
  [CalendarErrorCode.INVALID_DATE]: 'Invalid date format',
  [CalendarErrorCode.INVALID_TIMEZONE]: 'Invalid timezone',

  [CalendarErrorCode.EXTERNAL_API_ERROR]: 'External calendar API error',
  [CalendarErrorCode.RATE_LIMIT_EXCEEDED]: 'API rate limit exceeded',

  // New error codes
  [CalendarErrorCode.PROVIDER_NOT_CONFIGURED]: 'Calendar provider is not configured',
  [CalendarErrorCode.INVALID_PROVIDER]: 'Invalid calendar provider',
  [CalendarErrorCode.UNAUTHORIZED_ACCESS]: 'Unauthorized access to resource',
  [CalendarErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED]: 'Failed to exchange OAuth authorization code',
  [CalendarErrorCode.OAUTH_TOKEN_REFRESH_FAILED]: 'Failed to refresh OAuth token',
  [CalendarErrorCode.OAUTH_TOKEN_EXPIRED]: 'OAuth token has expired',
  [CalendarErrorCode.INVALID_OAUTH_STATE]: 'Invalid OAuth state parameter',
  [CalendarErrorCode.CALENDAR_LIST_FAILED]: 'Failed to list calendars',
  [CalendarErrorCode.SYNC_TOKEN_EXPIRED]: 'Sync token has expired',
  [CalendarErrorCode.EVENT_FETCH_FAILED]: 'Failed to fetch events',
  [CalendarErrorCode.EXTERNAL_EVENT_NOT_FOUND]: 'External event not found',
  [CalendarErrorCode.BOOKING_LINK_SLUG_EXISTS]: 'Booking link slug already exists',
  [CalendarErrorCode.TIMESLOT_NOT_AVAILABLE]: 'Selected time slot is not available',
  [CalendarErrorCode.MAX_BOOKINGS_REACHED]: 'Maximum bookings limit reached',
  [CalendarErrorCode.INVALID_BOOKING_STATUS]: 'Invalid booking status for this operation',
};

const ERROR_STATUS_CODES: Record<CalendarErrorCode, number> = {
  [CalendarErrorCode.CONNECTION_NOT_FOUND]: 404,
  [CalendarErrorCode.CONNECTION_EXISTS]: 409,
  [CalendarErrorCode.CONNECTION_FAILED]: 500,
  [CalendarErrorCode.UNSUPPORTED_PROVIDER]: 400,

  [CalendarErrorCode.OAUTH_ERROR]: 401,
  [CalendarErrorCode.OAUTH_CODE_INVALID]: 400,
  [CalendarErrorCode.TOKEN_EXPIRED]: 401,
  [CalendarErrorCode.TOKEN_REFRESH_FAILED]: 401,
  [CalendarErrorCode.INSUFFICIENT_SCOPE]: 403,

  [CalendarErrorCode.CALENDAR_NOT_FOUND]: 404,
  [CalendarErrorCode.CALENDAR_ACCESS_DENIED]: 403,
  [CalendarErrorCode.CALENDAR_SYNC_FAILED]: 500,

  [CalendarErrorCode.EVENT_NOT_FOUND]: 404,
  [CalendarErrorCode.EVENT_ACCESS_DENIED]: 403,
  [CalendarErrorCode.EVENT_CREATE_FAILED]: 500,
  [CalendarErrorCode.EVENT_UPDATE_FAILED]: 500,
  [CalendarErrorCode.EVENT_DELETE_FAILED]: 500,
  [CalendarErrorCode.EVENT_CONFLICT]: 409,
  [CalendarErrorCode.TIME_ENTRY_EXISTS]: 409,
  [CalendarErrorCode.INVALID_TIME_RANGE]: 400,
  [CalendarErrorCode.INVALID_RECURRENCE]: 400,

  [CalendarErrorCode.SCHEDULE_NOT_FOUND]: 404,
  [CalendarErrorCode.SCHEDULE_ACCESS_DENIED]: 403,
  [CalendarErrorCode.INVALID_SCHEDULE]: 400,
  [CalendarErrorCode.SCHEDULE_IN_USE]: 409,

  [CalendarErrorCode.BOOKING_LINK_NOT_FOUND]: 404,
  [CalendarErrorCode.BOOKING_LINK_ACCESS_DENIED]: 403,
  [CalendarErrorCode.SLUG_EXISTS]: 409,
  [CalendarErrorCode.SLUG_INVALID]: 400,
  [CalendarErrorCode.BOOKING_LINK_INACTIVE]: 404,

  [CalendarErrorCode.BOOKING_NOT_FOUND]: 404,
  [CalendarErrorCode.BOOKING_ACCESS_DENIED]: 403,
  [CalendarErrorCode.SLOT_NOT_AVAILABLE]: 409,
  [CalendarErrorCode.DAILY_LIMIT_REACHED]: 409,
  [CalendarErrorCode.MIN_NOTICE_REQUIRED]: 400,
  [CalendarErrorCode.MAX_ADVANCE_EXCEEDED]: 400,
  [CalendarErrorCode.ALREADY_CANCELLED]: 409,
  [CalendarErrorCode.ALREADY_COMPLETED]: 409,
  [CalendarErrorCode.INVALID_CANCELLATION_TOKEN]: 401,

  [CalendarErrorCode.SYNC_IN_PROGRESS]: 409,
  [CalendarErrorCode.SYNC_FAILED]: 500,
  [CalendarErrorCode.SYNC_CONFLICT]: 409,

  [CalendarErrorCode.VALIDATION_ERROR]: 400,
  [CalendarErrorCode.INVALID_DATE]: 400,
  [CalendarErrorCode.INVALID_TIMEZONE]: 400,

  [CalendarErrorCode.EXTERNAL_API_ERROR]: 502,
  [CalendarErrorCode.RATE_LIMIT_EXCEEDED]: 429,

  // New error codes
  [CalendarErrorCode.PROVIDER_NOT_CONFIGURED]: 500,
  [CalendarErrorCode.INVALID_PROVIDER]: 400,
  [CalendarErrorCode.UNAUTHORIZED_ACCESS]: 403,
  [CalendarErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED]: 500,
  [CalendarErrorCode.OAUTH_TOKEN_REFRESH_FAILED]: 500,
  [CalendarErrorCode.OAUTH_TOKEN_EXPIRED]: 401,
  [CalendarErrorCode.INVALID_OAUTH_STATE]: 400,
  [CalendarErrorCode.CALENDAR_LIST_FAILED]: 502,
  [CalendarErrorCode.SYNC_TOKEN_EXPIRED]: 410,
  [CalendarErrorCode.EVENT_FETCH_FAILED]: 502,
  [CalendarErrorCode.EXTERNAL_EVENT_NOT_FOUND]: 404,
  [CalendarErrorCode.BOOKING_LINK_SLUG_EXISTS]: 409,
  [CalendarErrorCode.TIMESLOT_NOT_AVAILABLE]: 409,
  [CalendarErrorCode.MAX_BOOKINGS_REACHED]: 409,
  [CalendarErrorCode.INVALID_BOOKING_STATUS]: 400,
};

export class CalendarError extends Error {
  public readonly code: CalendarErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: CalendarErrorCode,
    messageOrDetails?: string | Record<string, unknown>,
    details?: Record<string, unknown>
  ) {
    const message = typeof messageOrDetails === 'string' ? messageOrDetails : ERROR_MESSAGES[code];

    super(message);
    this.name = 'CalendarError';
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code];
    this.details = typeof messageOrDetails === 'object' ? messageOrDetails : details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}
