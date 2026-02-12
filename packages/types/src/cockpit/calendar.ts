/**
 * @skillancer/types - Cockpit: Calendar Types
 * Calendar and scheduling schemas for the dashboard
 */

import { z } from 'zod';

import { uuidSchema, dateSchema, timestampsSchema } from '../common/base';

// =============================================================================
// Calendar Enums
// =============================================================================

/**
 * Event type
 */
export const eventTypeSchema = z.enum([
  'MEETING',
  'CALL',
  'DEADLINE',
  'MILESTONE',
  'TASK',
  'REMINDER',
  'BLOCKED_TIME',
  'AVAILABILITY',
  'INTERVIEW',
  'REVIEW',
  'OTHER',
]);
export type EventType = z.infer<typeof eventTypeSchema>;

/**
 * Event status
 */
export const eventStatusSchema = z.enum([
  'TENTATIVE',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

/**
 * Event visibility
 */
export const eventVisibilitySchema = z.enum([
  'PUBLIC',
  'PRIVATE',
  'BUSY', // Shows as busy but no details
]);
export type EventVisibility = z.infer<typeof eventVisibilitySchema>;

/**
 * Recurrence frequency
 */
export const recurrenceFrequencySchema = z.enum([
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'YEARLY',
  'CUSTOM',
]);
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;

/**
 * Attendee response status
 */
export const attendeeResponseSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE']);
export type AttendeeResponse = z.infer<typeof attendeeResponseSchema>;

// =============================================================================
// Calendar Sub-schemas
// =============================================================================

/**
 * Event attendee
 */
export const eventAttendeeSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema.optional(),
  email: z.string().email(),
  name: z.string().max(200).optional(),
  isOrganizer: z.boolean().default(false),
  isOptional: z.boolean().default(false),
  response: attendeeResponseSchema.default('PENDING'),
  responseAt: dateSchema.optional(),
  comment: z.string().max(500).optional(),
});
export type EventAttendee = z.infer<typeof eventAttendeeSchema>;

/**
 * Event reminder
 */
export const eventReminderSchema = z.object({
  id: uuidSchema,
  type: z.enum(['EMAIL', 'PUSH', 'SMS']),
  minutesBefore: z.number().int().nonnegative(),
  sent: z.boolean().default(false),
  sentAt: dateSchema.optional(),
});
export type EventReminder = z.infer<typeof eventReminderSchema>;

/**
 * Event recurrence rule
 */
export const recurrenceRuleSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().positive().default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(), // 0 = Sunday
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  endDate: dateSchema.optional(),
  occurrences: z.number().int().positive().optional(),
  exceptions: z.array(dateSchema).optional(), // Dates to skip
});
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;

/**
 * Meeting location/link
 */
export const meetingLocationSchema = z.object({
  type: z.enum(['IN_PERSON', 'VIDEO', 'PHONE', 'SKILLPOD']),
  address: z.string().max(500).optional(),
  meetingUrl: z.string().url().optional(),
  meetingId: z.string().max(100).optional(),
  meetingPassword: z.string().max(100).optional(),
  provider: z.enum(['ZOOM', 'GOOGLE_MEET', 'TEAMS', 'SKILLANCER', 'OTHER']).optional(),
  phoneNumber: z.string().max(30).optional(),
  skillpodPodId: uuidSchema.optional(),
});
export type MeetingLocation = z.infer<typeof meetingLocationSchema>;

// =============================================================================
// Main Event Schema
// =============================================================================

/**
 * Complete calendar event schema
 */
export const calendarEventSchema = z.object({
  id: uuidSchema,

  // Owner
  userId: uuidSchema,
  tenantId: uuidSchema.optional(),

  // Relationships
  clientId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  jobId: uuidSchema.optional(),
  milestoneId: uuidSchema.optional(),

  // Basic info
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: eventTypeSchema,
  status: eventStatusSchema.default('CONFIRMED'),
  visibility: eventVisibilitySchema.default('PRIVATE'),

  // Timing
  startTime: dateSchema,
  endTime: dateSchema,
  isAllDay: z.boolean().default(false),
  timezone: z.string().default('UTC'),

  // Location
  location: meetingLocationSchema.optional(),

  // Recurrence
  isRecurring: z.boolean().default(false),
  recurrence: recurrenceRuleSchema.optional(),
  recurringEventId: uuidSchema.optional(), // Parent event for instances
  originalStartTime: dateSchema.optional(), // For modified recurring instances

  // Attendees
  attendees: z.array(eventAttendeeSchema).optional(),

  // Reminders
  reminders: z.array(eventReminderSchema).optional(),

  // Appearance
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),

  // External sync
  externalId: z.string().optional(),
  externalProvider: z.enum(['GOOGLE', 'OUTLOOK', 'APPLE', 'OTHER']).optional(),
  externalUrl: z.string().url().optional(),
  lastSyncedAt: dateSchema.optional(),

  // Notes and attachments
  notes: z.string().max(5000).optional(),
  attachments: z
    .array(
      z.object({
        id: uuidSchema,
        name: z.string(),
        url: z.string().url(),
        mimeType: z.string(),
      })
    )
    .optional(),

  ...timestampsSchema.shape,
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

// =============================================================================
// Calendar CRUD Schemas
// =============================================================================

/**
 * Create event input
 */
/**
 * Base event data for create/update
 */
const baseEventDataSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: eventTypeSchema,
  status: eventStatusSchema.default('CONFIRMED'),
  visibility: eventVisibilitySchema.default('PRIVATE'),
  startTime: dateSchema,
  endTime: dateSchema,
  isAllDay: z.boolean().default(false),
  timezone: z.string().default('UTC'),
  location: meetingLocationSchema.optional(),
  isRecurring: z.boolean().default(false),
  recurrence: recurrenceRuleSchema.optional(),
  attendees: z
    .array(eventAttendeeSchema.omit({ id: true, response: true, responseAt: true }))
    .optional(),
  reminders: z.array(eventReminderSchema.omit({ id: true, sent: true, sentAt: true })).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  clientId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  jobId: uuidSchema.optional(),
  milestoneId: uuidSchema.optional(),
});

export const createEventSchema = baseEventDataSchema.refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: 'End time must be after start time', path: ['endTime'] }
);
export type CreateEvent = z.infer<typeof createEventSchema>;

/**
 * Update event input
 */
export const updateEventSchema = baseEventDataSchema.partial().extend({
  updateRecurring: z.enum(['THIS', 'THIS_AND_FUTURE', 'ALL']).optional(),
});
export type UpdateEvent = z.infer<typeof updateEventSchema>;

/**
 * Event RSVP input
 */
export const eventRsvpSchema = z.object({
  eventId: uuidSchema,
  response: attendeeResponseSchema,
  comment: z.string().max(500).optional(),
});
export type EventRsvp = z.infer<typeof eventRsvpSchema>;

/**
 * Event filter parameters
 */
export const eventFilterSchema = z.object({
  startDateFrom: dateSchema.optional(),
  startDateTo: dateSchema.optional(),
  type: z.array(eventTypeSchema).optional(),
  status: z.array(eventStatusSchema).optional(),
  clientId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  includeRecurring: z.boolean().default(true),
  search: z.string().optional(),
});
export type EventFilter = z.infer<typeof eventFilterSchema>;

// =============================================================================
// Availability Schema
// =============================================================================

/**
 * User availability window
 */
export const availabilityWindowSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/), // HH:MM
  timezone: z.string().default('UTC'),
  isActive: z.boolean().default(true),
});
export type AvailabilityWindow = z.infer<typeof availabilityWindowSchema>;

/**
 * User availability settings
 */
export const availabilitySettingsSchema = z.object({
  userId: uuidSchema,
  windows: z.array(availabilityWindowSchema),
  bufferMinutesBefore: z.number().int().nonnegative().default(0),
  bufferMinutesAfter: z.number().int().nonnegative().default(0),
  minNoticeHours: z.number().int().nonnegative().default(24),
  maxAdvanceDays: z.number().int().positive().default(60),
  defaultMeetingDurationMinutes: z.number().int().positive().default(30),
  allowOverlapping: z.boolean().default(false),
});
export type AvailabilitySettings = z.infer<typeof availabilitySettingsSchema>;
