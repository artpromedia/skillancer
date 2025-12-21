/**
 * @module @skillancer/cockpit-svc/routes/calendar
 * Calendar API Routes (Authenticated)
 */

import { Type, type Static } from '@sinclair/typebox';

import { CalendarError } from '../errors/calendar.errors.js';

import type { CalendarService } from '../services/calendar.service.js';
import type { CustomQuestion } from '../types/calendar.types.js';
import type {
  CalendarProvider,
  EventType,
  EventVisibility,
  LocationType,
  BookingStatus,
} from '@skillancer/database';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

// ============================================
// Request/Response Schemas
// ============================================

const OAuthConnectParams = Type.Object({
  provider: Type.Enum({ GOOGLE: 'GOOGLE', MICROSOFT: 'MICROSOFT' }),
});

const OAuthCallbackQuery = Type.Object({
  code: Type.String(),
  state: Type.String(),
});

const ConnectionIdParams = Type.Object({
  connectionId: Type.String({ format: 'uuid' }),
});

const CreateEventBody = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String()),
  location: Type.Optional(Type.String()),
  startTime: Type.String({ format: 'date-time' }),
  endTime: Type.String({ format: 'date-time' }),
  isAllDay: Type.Optional(Type.Boolean()),
  timezone: Type.Optional(Type.String()),
  eventType: Type.Optional(
    Type.Enum({
      MEETING: 'MEETING',
      TASK: 'TASK',
      REMINDER: 'REMINDER',
      BLOCKED: 'BLOCKED',
      FOCUS: 'FOCUS',
      DEADLINE: 'DEADLINE',
      MILESTONE: 'MILESTONE',
      OTHER: 'OTHER',
    })
  ),
  projectId: Type.Optional(Type.String({ format: 'uuid' })),
  clientId: Type.Optional(Type.String({ format: 'uuid' })),
  taskId: Type.Optional(Type.String({ format: 'uuid' })),
  attendees: Type.Optional(
    Type.Array(
      Type.Object({
        email: Type.String({ format: 'email' }),
        name: Type.Optional(Type.String()),
      })
    )
  ),
  meetingUrl: Type.Optional(Type.String({ format: 'uri' })),
  recurrenceRule: Type.Optional(Type.String()),
  visibility: Type.Optional(
    Type.Enum({
      DEFAULT: 'DEFAULT',
      PUBLIC: 'PUBLIC',
      PRIVATE: 'PRIVATE',
      CONFIDENTIAL: 'CONFIDENTIAL',
    })
  ),
  trackTime: Type.Optional(Type.Boolean()),
  autoCreateTimeEntry: Type.Optional(Type.Boolean()),
  syncToExternal: Type.Optional(Type.Boolean()),
  externalCalendarId: Type.Optional(Type.String({ format: 'uuid' })),
  reminders: Type.Optional(
    Type.Array(
      Type.Object({
        type: Type.Enum({ email: 'email', notification: 'notification' }),
        minutesBefore: Type.Number({ minimum: 0 }),
      })
    )
  ),
});

const UpdateEventBody = Type.Partial(CreateEventBody);

const EventIdParams = Type.Object({
  eventId: Type.String({ format: 'uuid' }),
});

const EventsQuery = Type.Object({
  startDate: Type.String({ format: 'date-time' }),
  endDate: Type.String({ format: 'date-time' }),
  eventTypes: Type.Optional(Type.Array(Type.String())),
  projectId: Type.Optional(Type.String({ format: 'uuid' })),
  clientId: Type.Optional(Type.String({ format: 'uuid' })),
  calendarIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  includeDeleted: Type.Optional(Type.Boolean()),
});

const CreateScheduleBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  timezone: Type.Optional(Type.String()),
  weeklyHours: Type.Record(
    Type.String(),
    Type.Union([
      Type.Null(),
      Type.Array(
        Type.Object({
          start: Type.String({ pattern: '^[0-2][0-9]:[0-5][0-9]$' }),
          end: Type.String({ pattern: '^[0-2][0-9]:[0-5][0-9]$' }),
        })
      ),
    ])
  ),
  dateOverrides: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Union([
        Type.Null(),
        Type.Array(
          Type.Object({
            start: Type.String({ pattern: '^[0-2][0-9]:[0-5][0-9]$' }),
            end: Type.String({ pattern: '^[0-2][0-9]:[0-5][0-9]$' }),
          })
        ),
      ])
    )
  ),
  isDefault: Type.Optional(Type.Boolean()),
  bufferBefore: Type.Optional(Type.Number({ minimum: 0, maximum: 120 })),
  bufferAfter: Type.Optional(Type.Number({ minimum: 0, maximum: 120 })),
  minimumNotice: Type.Optional(Type.Number({ minimum: 0 })),
  maxAdvanceDays: Type.Optional(Type.Number({ minimum: 1, maximum: 365 })),
});

const UpdateScheduleBody = Type.Partial(CreateScheduleBody);

const _ScheduleIdParams = Type.Object({
  scheduleId: Type.String({ format: 'uuid' }),
});

const CreateBookingLinkBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  slug: Type.Optional(Type.String({ pattern: '^[a-z0-9-]+$', minLength: 3, maxLength: 50 })),
  description: Type.Optional(Type.String()),
  scheduleId: Type.String({ format: 'uuid' }),
  duration: Type.Number({ minimum: 5, maximum: 480 }),
  locationType: Type.Enum({
    VIDEO: 'VIDEO',
    PHONE: 'PHONE',
    IN_PERSON: 'IN_PERSON',
    CUSTOM: 'CUSTOM',
  }),
  locationValue: Type.Optional(Type.String()),
  customQuestions: Type.Optional(
    Type.Array(
      Type.Object({
        id: Type.String(),
        question: Type.String(),
        type: Type.Enum({
          text: 'text',
          textarea: 'textarea',
          select: 'select',
          checkbox: 'checkbox',
        }),
        required: Type.Boolean(),
        options: Type.Optional(Type.Array(Type.String())),
      })
    )
  ),
  confirmationMessage: Type.Optional(Type.String()),
  color: Type.Optional(Type.String()),
  requiresConfirmation: Type.Optional(Type.Boolean()),
  sendReminders: Type.Optional(Type.Boolean()),
  reminderHours: Type.Optional(Type.Array(Type.Number())),
  maxBookingsPerDay: Type.Optional(Type.Number({ minimum: 1 })),
});

const UpdateBookingLinkBody = Type.Partial(CreateBookingLinkBody);

const BookingLinkIdParams = Type.Object({
  bookingLinkId: Type.String({ format: 'uuid' }),
});

const BookingsQuery = Type.Object({
  startDate: Type.Optional(Type.String({ format: 'date-time' })),
  endDate: Type.Optional(Type.String({ format: 'date-time' })),
  status: Type.Optional(Type.Array(Type.String())),
  bookingLinkId: Type.Optional(Type.String({ format: 'uuid' })),
});

const BookingIdParams = Type.Object({
  bookingId: Type.String({ format: 'uuid' }),
});

const CancelBookingBody = Type.Object({
  reason: Type.Optional(Type.String()),
});

type CreateEventBodyType = Static<typeof CreateEventBody>;
type UpdateEventBodyType = Static<typeof UpdateEventBody>;
type CreateScheduleBodyType = Static<typeof CreateScheduleBody>;
type _UpdateScheduleBodyType = Static<typeof UpdateScheduleBody>;
type CreateBookingLinkBodyType = Static<typeof CreateBookingLinkBody>;
type _UpdateBookingLinkBodyType = Static<typeof UpdateBookingLinkBody>;

// ============================================
// Route Plugin
// ============================================

export interface CalendarRoutesOptions {
  calendarService: CalendarService;
}

// eslint-disable-next-line @typescript-eslint/require-await
export const calendarRoutes: FastifyPluginAsync<CalendarRoutesOptions> = async (
  fastify,
  options
) => {
  const { calendarService } = options;

  // Get user ID from request (assumes auth middleware has set this)
  const getUserId = (request: FastifyRequest): string => {
    const userId = request.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  };

  // ============================================
  // OAuth & Connections
  // ============================================

  fastify.get<{
    Params: Static<typeof OAuthConnectParams>;
  }>(
    '/connect/:provider',
    {
      schema: {
        params: OAuthConnectParams,
        tags: ['Calendar'],
        summary: 'Get OAuth authorization URL',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const { provider } = request.params;

      const authUrl = await calendarService.getAuthorizationUrlAsync(
        provider as CalendarProvider,
        userId
      );

      return { authorizationUrl: authUrl };
    }
  );

  fastify.get<{
    Querystring: Static<typeof OAuthCallbackQuery>;
  }>(
    '/callback',
    {
      schema: {
        querystring: OAuthCallbackQuery,
        tags: ['Calendar'],
        summary: 'OAuth callback handler',
      },
    },
    async (request, reply) => {
      const { code, state } = request.query;

      try {
        const connection = await calendarService.handleOAuthCallback(code, state);

        // Redirect to frontend with success
        return await reply.redirect(
          `${process.env.FRONTEND_URL}/settings/calendar?connected=${connection.provider}`
        );
      } catch (error) {
        // Redirect to frontend with error
        const message = error instanceof Error ? error.message : 'Connection failed';
        return reply.redirect(
          `${process.env.FRONTEND_URL}/settings/calendar?error=${encodeURIComponent(message)}`
        );
      }
    }
  );

  fastify.get(
    '/connections',
    {
      schema: {
        tags: ['Calendar'],
        summary: 'Get calendar connections',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const connections = await calendarService.getConnections(userId);
      return { connections };
    }
  );

  fastify.delete<{
    Params: Static<typeof ConnectionIdParams>;
  }>(
    '/connections/:connectionId',
    {
      schema: {
        params: ConnectionIdParams,
        tags: ['Calendar'],
        summary: 'Disconnect calendar provider',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const { connectionId } = request.params;

      await calendarService.disconnectProvider(connectionId, userId);
      return { success: true };
    }
  );

  fastify.post<{
    Params: Static<typeof ConnectionIdParams>;
  }>(
    '/connections/:connectionId/sync',
    {
      schema: {
        params: ConnectionIdParams,
        tags: ['Calendar'],
        summary: 'Manually sync a calendar connection',
      },
    },
    async (request, _reply) => {
      const { connectionId } = request.params;
      const result = await calendarService.syncConnection(connectionId);
      return result;
    }
  );

  // ============================================
  // Events
  // ============================================

  fastify.get<{
    Querystring: Static<typeof EventsQuery>;
  }>(
    '/events',
    {
      schema: {
        querystring: EventsQuery,
        tags: ['Calendar'],
        summary: 'Get calendar events',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const { startDate, endDate, eventTypes, projectId, clientId, calendarIds, includeDeleted } =
        request.query;

      const events = await calendarService.getEvents({
        userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        eventTypes: eventTypes as EventType[] | undefined,
        projectId,
        clientId,
        calendarIds,
        includeDeleted,
      });

      return { events };
    }
  );

  fastify.post<{
    Body: CreateEventBodyType;
  }>(
    '/events',
    {
      schema: {
        body: CreateEventBody,
        tags: ['Calendar'],
        summary: 'Create calendar event',
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const body = request.body;

      // Transform reminders from route format to service format
      const reminders = body.reminders?.map((r) => ({
        minutes: r.minutesBefore,
        method: r.type,
      }));

      const event = await calendarService.createEvent(userId, {
        title: body.title,
        description: body.description,
        location: body.location,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        isAllDay: body.isAllDay,
        timezone: body.timezone ?? 'UTC',
        eventType: body.eventType as EventType,
        projectId: body.projectId,
        clientId: body.clientId,
        taskId: body.taskId,
        attendees: body.attendees,
        meetingUrl: body.meetingUrl,
        recurrenceRule: body.recurrenceRule,
        visibility: body.visibility as EventVisibility | undefined,
        trackTime: body.trackTime,
        autoCreateTimeEntry: body.autoCreateTimeEntry,
        syncToExternal: body.syncToExternal,
        externalCalendarId: body.externalCalendarId,
        reminders,
      });

      return reply.status(201).send({ event });
    }
  );

  fastify.patch<{
    Params: Static<typeof EventIdParams>;
    Body: UpdateEventBodyType;
  }>(
    '/events/:eventId',
    {
      schema: {
        params: EventIdParams,
        body: UpdateEventBody,
        tags: ['Calendar'],
        summary: 'Update calendar event',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const { eventId } = request.params;
      const body = request.body;

      // Transform reminders from route format to service format
      const reminders = body.reminders?.map((r) => ({
        minutes: r.minutesBefore,
        method: r.type,
      }));

      const event = await calendarService.updateEvent(eventId, userId, {
        title: body.title,
        description: body.description,
        location: body.location,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        isAllDay: body.isAllDay,
        timezone: body.timezone,
        eventType: body.eventType as EventType,
        projectId: body.projectId,
        clientId: body.clientId,
        attendees: body.attendees,
        meetingUrl: body.meetingUrl,
        recurrenceRule: body.recurrenceRule,
        visibility: body.visibility as EventVisibility | undefined,
        trackTime: body.trackTime,
        autoCreateTimeEntry: body.autoCreateTimeEntry,
        reminders,
      });

      return { event };
    }
  );

  fastify.delete<{
    Params: Static<typeof EventIdParams>;
  }>(
    '/events/:eventId',
    {
      schema: {
        params: EventIdParams,
        tags: ['Calendar'],
        summary: 'Delete calendar event',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const { eventId } = request.params;

      await calendarService.deleteEvent(eventId, userId);
      return { success: true };
    }
  );

  // ============================================
  // Availability Schedules
  // ============================================

  fastify.get(
    '/schedules',
    {
      schema: {
        tags: ['Calendar'],
        summary: 'Get availability schedules',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const schedules = await calendarService.getSchedules(userId);
      return { schedules };
    }
  );

  fastify.post<{
    Body: CreateScheduleBodyType;
  }>(
    '/schedules',
    {
      schema: {
        body: CreateScheduleBody,
        tags: ['Calendar'],
        summary: 'Create availability schedule',
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const body = request.body;

      const schedule = await calendarService.createSchedule(userId, {
        name: body.name,
        timezone: body.timezone,
        weeklyHours: body.weeklyHours as unknown as Record<
          string,
          Array<{ start: string; end: string }> | null
        >,
        dateOverrides: body.dateOverrides as unknown as
          | Record<string, Array<{ start: string; end: string }> | null>
          | undefined,
        isDefault: body.isDefault,
        bufferBefore: body.bufferBefore,
        bufferAfter: body.bufferAfter,
        minNoticeHours: body.minimumNotice,
        maxAdvanceDays: body.maxAdvanceDays,
      });

      return reply.status(201).send({ schedule });
    }
  );

  // ============================================
  // Booking Links
  // ============================================

  fastify.get(
    '/booking-links',
    {
      schema: {
        tags: ['Calendar'],
        summary: 'Get booking links',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const bookingLinks = await calendarService.getBookingLinks(userId);
      return { bookingLinks };
    }
  );

  fastify.post<{
    Body: CreateBookingLinkBodyType;
  }>(
    '/booking-links',
    {
      schema: {
        body: CreateBookingLinkBody,
        tags: ['Calendar'],
        summary: 'Create booking link',
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const body = request.body;

      const bookingLink = await calendarService.createBookingLink(userId, {
        name: body.name,
        slug: body.slug,
        description: body.description,
        scheduleId: body.scheduleId,
        eventDuration: body.duration,
        locationType: body.locationType as LocationType,
        locationDetails: body.locationValue,
        customQuestions: body.customQuestions as CustomQuestion[] | undefined,
        color: body.color,
        confirmationEmailEnabled: !body.requiresConfirmation,
        reminderEmailEnabled: body.sendReminders ?? true,
        reminderMinutes: body.reminderHours?.map((h) => h * 60),
        maxBookingsPerDay: body.maxBookingsPerDay,
      });

      return reply.status(201).send({ bookingLink });
    }
  );

  fastify.get<{
    Params: Static<typeof BookingLinkIdParams>;
  }>(
    '/booking-links/:bookingLinkId/stats',
    {
      schema: {
        params: BookingLinkIdParams,
        tags: ['Calendar'],
        summary: 'Get booking link statistics',
      },
    },
    (_request, _reply) => {
      // Would use BookingLinkRepository.getStats() here
      return { viewCount: 0, bookingCount: 0, conversionRate: 0, upcomingBookings: 0 };
    }
  );

  // ============================================
  // Bookings
  // ============================================

  fastify.get<{
    Querystring: Static<typeof BookingsQuery>;
  }>(
    '/bookings',
    {
      schema: {
        querystring: BookingsQuery,
        tags: ['Calendar'],
        summary: 'Get bookings',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const { startDate, endDate, status, bookingLinkId } = request.query;

      const bookings = await calendarService.getBookings({
        userId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status as BookingStatus[] | undefined,
        bookingLinkId,
      });

      return { bookings };
    }
  );

  fastify.post<{
    Params: Static<typeof BookingIdParams>;
  }>(
    '/bookings/:bookingId/confirm',
    {
      schema: {
        params: BookingIdParams,
        tags: ['Calendar'],
        summary: 'Confirm a booking',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const { bookingId } = request.params;

      const booking = await calendarService.confirmBooking(bookingId, userId);
      return { booking };
    }
  );

  fastify.post<{
    Params: Static<typeof BookingIdParams>;
    Body: Static<typeof CancelBookingBody>;
  }>(
    '/bookings/:bookingId/cancel',
    {
      schema: {
        params: BookingIdParams,
        body: CancelBookingBody,
        tags: ['Calendar'],
        summary: 'Cancel a booking',
      },
    },
    async (request, _reply) => {
      const userId = getUserId(request);
      const { bookingId } = request.params;
      const { reason } = request.body;

      const booking = await calendarService.cancelBooking(bookingId, userId, reason);
      return { booking };
    }
  );

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof CalendarError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    throw error;
  });
};

export default calendarRoutes;
