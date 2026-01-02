// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/types/calendar
 * Calendar Integration Type Definitions
 */

import type {
  CalendarConnection,
  ExternalCalendar,
  CalendarEvent,
  Booking,
  CalendarProvider,
  SyncDirection,
  SyncStatus,
  EventType,
  EventStatus,
  EventVisibility,
  LocationType,
  BookingStatus,
} from '@skillancer/database';

// Re-export enums for convenience
export type {
  CalendarProvider,
  SyncDirection,
  SyncStatus,
  EventSource,
  EventType,
  EventStatus,
  EventVisibility,
  LocationType,
  BookingStatus,
} from '@skillancer/database';

// ==========================================
// OAuth & Token Types
// ==========================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date | null;
  tokenType?: string;
  scope?: string | null;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
  picture?: string;
}

// ==========================================
// External Calendar Data Types
// ==========================================

export interface ExternalCalendarData {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  timezone?: string | null;
  accessRole?: string | null;
  isPrimary: boolean;
}

export interface ExternalEventData {
  id: string;
  etag?: string;
  summary?: string;
  subject?: string;
  description?: string | null;
  body?: string | null;
  location?: string | null;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
  }>;
  organizer?: {
    email: string;
    displayName?: string;
  };
  recurrence?: string[];
  recurringEventId?: string;
  hangoutLink?: string;
  onlineMeeting?: {
    joinUrl?: string;
  };
  visibility?: string;
}

/**
 * Normalized event data for internal use
 */
export interface NormalizedEventData {
  id: string;
  externalId: string;
  etag?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  timezone?: string | null;
  status?: string;
  visibility?: string;
  isRecurring: boolean;
  recurrenceRule?: string | null;
  organizerEmail?: string | null;
  attendees?: Array<{ email: string; name?: string | null; status?: string }>;
  meetingUrl?: string | null;
  conferenceType?: string | null;
  isCancelled?: boolean;
}

// ==========================================
// Connection Types
// ==========================================

export interface CreateConnectionParams {
  userId: string;
  provider: CalendarProvider;
  providerAccountId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  email: string;
  displayName?: string | null;
  syncEnabled?: boolean;
  syncDirection?: SyncDirection;
}

export interface UpdateConnectionParams {
  accessToken?: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  syncEnabled?: boolean;
  syncDirection?: SyncDirection;
  selectedCalendarIds?: string[];
  primaryCalendarId?: string | null;
  lastSyncAt?: Date | null;
  lastSyncError?: string | null;
  syncStatus?: SyncStatus;
}

export interface ConnectionWithCalendars extends CalendarConnection {
  calendars: ExternalCalendar[];
}

// ==========================================
// Event Types
// ==========================================

export interface CreateEventParams {
  userId?: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay?: boolean;
  timezone?: string;
  eventType?: EventType;
  category?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  taskId?: string | null;
  attendees?: Array<{ email: string; name?: string }>;
  meetingUrl?: string | null;
  conferenceType?: string | null;
  recurrenceRule?: string | null;
  reminders?: Array<{ minutes: number; method: string }>;
  trackTime?: boolean;
  autoCreateTimeEntry?: boolean;
  syncToExternal?: boolean;
  externalCalendarId?: string | null;
  color?: string | null;
  visibility?: EventVisibility;
}

export interface UpdateEventParams {
  title?: string;
  description?: string | null;
  location?: string | null;
  startTime?: Date;
  endTime?: Date;
  isAllDay?: boolean;
  timezone?: string;
  eventType?: EventType;
  category?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  taskId?: string | null;
  attendees?: Array<{ email: string; name?: string }>;
  meetingUrl?: string | null;
  conferenceType?: string | null;
  recurrenceRule?: string | null;
  reminders?: Array<{ minutes: number; method: string }>;
  trackTime?: boolean;
  autoCreateTimeEntry?: boolean;
  status?: EventStatus;
  visibility?: EventVisibility;
  color?: string | null;
}

export interface EventFilters {
  userId: string;
  startDate: Date;
  endDate: Date;
  calendarIds?: string[];
  eventTypes?: EventType[];
  projectId?: string;
  clientId?: string;
  includeRecurring?: boolean;
  includeDeleted?: boolean;
}

export interface CalendarEventWithDetails extends CalendarEvent {
  project?: {
    id: string;
    name: string;
  } | null;
  client?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
  } | null;
  externalCalendar?: ExternalCalendar | null;
}

// ==========================================
// Availability Types
// ==========================================

export interface TimeSlot {
  start: string; // HH:mm format
  end: string;
}

export interface WeeklyHours {
  [dayOfWeek: string]: TimeSlot[] | null; // day names or numbers, null for day off
}

export interface DateOverrides {
  [date: string]: TimeSlot[] | null; // date in YYYY-MM-DD format, null for day off
}

export interface CreateScheduleParams {
  userId?: string;
  name: string;
  timezone?: string;
  weeklyHours: WeeklyHours;
  dateOverrides?: DateOverrides | null;
  bufferBefore?: number;
  bufferAfter?: number;
  minNoticeHours?: number;
  minimumNotice?: number;
  maxAdvanceDays?: number;
  isDefault?: boolean;
}

export interface UpdateScheduleParams {
  name?: string;
  timezone?: string;
  weeklyHours?: WeeklyHours;
  dateOverrides?: DateOverrides | null;
  bufferBefore?: number;
  bufferAfter?: number;
  minNoticeHours?: number;
  maxAdvanceDays?: number;
  isDefault?: boolean;
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface AvailableDate {
  date: string;
  slots: Array<{ start: Date; end: Date }>;
  hasAvailability: boolean;
}

export interface AvailabilityCalendar {
  month: Date;
  timezone: string;
  availableDates: AvailableDate[];
  days: AvailableDate[];
}

// ==========================================
// Booking Link Types
// ==========================================

export interface CustomQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[]; // for select type
}

export interface CreateBookingLinkParams {
  userId?: string;
  name: string;
  slug?: string;
  eventTitle?: string;
  eventDuration: number;
  eventType?: EventType;
  description?: string | null;
  locationType?: LocationType;
  locationDetails?: string | null;
  conferenceType?: string | null;
  scheduleId: string;
  customQuestions?: CustomQuestion[] | null;
  maxBookingsPerDay?: number | null;
  color?: string | null;
  confirmationEmailEnabled?: boolean;
  reminderEmailEnabled?: boolean;
  reminderMinutes?: number[];
}

export interface UpdateBookingLinkParams {
  name?: string;
  slug?: string;
  eventTitle?: string;
  eventDuration?: number;
  eventType?: EventType;
  description?: string | null;
  locationType?: LocationType;
  locationDetails?: string | null;
  conferenceType?: string | null;
  scheduleId?: string;
  customQuestions?: CustomQuestion[] | null;
  maxBookingsPerDay?: number | null;
  color?: string | null;
  confirmationEmailEnabled?: boolean;
  reminderEmailEnabled?: boolean;
  reminderMinutes?: number[];
  isActive?: boolean;
}

export interface PublicBookingLinkView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  eventTitle: string;
  eventDuration: number;
  locationType: LocationType;
  conferenceType: string | null;
  customQuestions: CustomQuestion[] | null;
  color: string | null;
  host: {
    name: string;
    avatarUrl: string | null;
  };
  timezone: string;
}

// ==========================================
// Booking Types
// ==========================================

export interface CreateBookingParams {
  bookingLinkSlug?: string; // Optional - can be passed as separate arg to service
  bookerName: string;
  bookerEmail: string;
  bookerPhone?: string | null;
  bookerTimezone: string;
  startTime: Date;
  customAnswers?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface BookingWithDetails extends Booking {
  bookingLink: {
    id: string;
    name: string;
    eventTitle: string;
    eventDuration: number;
    locationType?: string;
    locationDetails?: string | null;
  };
  user?: {
    firstName: string;
    lastName: string;
    email?: string;
  };
}

export interface BookingCalendarLinks {
  google: string;
  outlook: string;
  ical: string;
}

export interface BookingConfirmation {
  booking: Booking;
  calendarLinks: BookingCalendarLinks;
}

export interface BookingFilters {
  userId: string;
  status?: BookingStatus[];
  startDate?: Date;
  endDate?: Date;
  bookingLinkId?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// Sync Types
// ==========================================

export interface SyncResult {
  success: boolean;
  imported: number;
  updated: number;
  deleted: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: string[];
}

export interface CalendarSyncJob {
  connectionId: string;
  type: 'initial' | 'incremental' | 'full';
}

// ==========================================
// Reminder Types
// ==========================================

export interface EventReminderJob {
  eventId: string;
  method: string;
  userId: string;
}

export interface BookingReminderJob {
  bookingId: string;
  minutes: number;
  type: 'guest' | 'host';
}

// ==========================================
// Meeting Types
// ==========================================

export interface MeetingDetails {
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
}

export interface MeetingLinkResult {
  url: string;
  joinInfo?: string;
  meetingId?: string;
}

