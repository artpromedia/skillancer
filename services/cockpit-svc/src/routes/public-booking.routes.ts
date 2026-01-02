// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/routes/public-booking
 * Public Booking API Routes (No Authentication)
 *
 * These routes are publicly accessible for guests to view
 * booking links, check availability, and create bookings.
 */

import { Type, type Static } from '@sinclair/typebox';

import { CalendarError, CalendarErrorCode } from '../errors/calendar.errors.js';

import type { CalendarService } from '../services/calendar.service.js';
import type { FastifyPluginAsync } from 'fastify';

// ============================================
// Request/Response Schemas
// ============================================

const BookingLinkSlugParams = Type.Object({
  slug: Type.String({ pattern: '^[a-z0-9-]+$', minLength: 3, maxLength: 50 }),
});

const AvailabilityQuery = Type.Object({
  startDate: Type.String({ format: 'date' }),
  endDate: Type.String({ format: 'date' }),
  timezone: Type.Optional(Type.String()),
});

const CreateBookingBody = Type.Object({
  bookerName: Type.String({ minLength: 1, maxLength: 100 }),
  bookerEmail: Type.String({ format: 'email' }),
  startTime: Type.String({ format: 'date-time' }),
  endTime: Type.String({ format: 'date-time' }),
  timezone: Type.Optional(Type.String()),
  answers: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  notes: Type.Optional(Type.String({ maxLength: 1000 })),
});

const BookingIdParams = Type.Object({
  bookingId: Type.String({ format: 'uuid' }),
});

const CancelBookingBody = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
});

type CreateBookingBodyType = Static<typeof CreateBookingBody>;
type CancelBookingBodyType = Static<typeof CancelBookingBody>;

// ============================================
// Route Plugin
// ============================================

export interface PublicBookingRoutesOptions {
  calendarService: CalendarService;
}

// eslint-disable-next-line @typescript-eslint/require-await
export const publicBookingRoutes: FastifyPluginAsync<PublicBookingRoutesOptions> = async (
  fastify,
  options
) => {
  const { calendarService } = options;

  /**
   * Get public booking link details
   * Returns information needed for the booking page
   */
  fastify.get<{
    Params: Static<typeof BookingLinkSlugParams>;
  }>(
    '/:slug',
    {
      schema: {
        params: BookingLinkSlugParams,
        tags: ['Public Booking'],
        summary: 'Get booking link details',
        description: 'Get public information about a booking link for display on the booking page',
        response: {
          200: Type.Object({
            id: Type.String(),
            slug: Type.String(),
            name: Type.String(),
            description: Type.Union([Type.String(), Type.Null()]),
            eventTitle: Type.String(),
            eventDuration: Type.Number(),
            locationType: Type.String(),
            conferenceType: Type.Union([Type.String(), Type.Null()]),
            customQuestions: Type.Union([
              Type.Array(
                Type.Object({
                  id: Type.String(),
                  question: Type.String(),
                  type: Type.String(),
                  required: Type.Boolean(),
                  options: Type.Optional(Type.Array(Type.String())),
                })
              ),
              Type.Null(),
            ]),
            color: Type.Union([Type.String(), Type.Null()]),
            timezone: Type.String(),
            host: Type.Object({
              name: Type.String(),
              avatarUrl: Type.Union([Type.String(), Type.Null()]),
            }),
          }),
          404: Type.Object({
            error: Type.Object({
              code: Type.String(),
              message: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, _reply) => {
      const { slug } = request.params;

      const bookingLink = await calendarService.getPublicBookingLink(slug);

      return bookingLink;
    }
  );

  /**
   * Get availability for a booking link
   * Returns available time slots for a date range
   */
  fastify.get<{
    Params: Static<typeof BookingLinkSlugParams>;
    Querystring: Static<typeof AvailabilityQuery>;
  }>(
    '/:slug/availability',
    {
      schema: {
        params: BookingLinkSlugParams,
        querystring: AvailabilityQuery,
        tags: ['Public Booking'],
        summary: 'Get availability',
        description: 'Get available time slots for booking',
        response: {
          200: Type.Object({
            timezone: Type.String(),
            days: Type.Array(
              Type.Object({
                date: Type.String(),
                slots: Type.Array(
                  Type.Object({
                    start: Type.String(),
                    end: Type.String(),
                    available: Type.Boolean(),
                  })
                ),
              })
            ),
          }),
          404: Type.Object({
            error: Type.Object({
              code: Type.String(),
              message: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const { startDate, endDate, timezone } = request.query;

      // Limit date range to 60 days to prevent abuse
      const start = new Date(startDate);
      const end = new Date(endDate);
      const maxDays = 60;
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > maxDays) {
        return reply.status(400).send({
          error: {
            code: 'DATE_RANGE_TOO_LARGE',
            message: `Date range cannot exceed ${maxDays} days`,
          },
        });
      }

      // Get booking link to find its ID
      const bookingLink = await calendarService.getPublicBookingLink(slug);
      if (!bookingLink) {
        return reply.status(404).send({
          error: {
            code: CalendarErrorCode.BOOKING_LINK_NOT_FOUND,
            message: 'Booking link not found',
          },
        });
      }

      // Need to get the full booking link to get its ID
      // This is a bit of a workaround - in production, would optimize this
      const availability = await calendarService.getAvailability(
        slug, // Pass slug, service will resolve
        start,
        end,
        timezone
      );

      return availability;
    }
  );

  /**
   * Create a booking
   * Guest submits their booking request
   */
  fastify.post<{
    Params: Static<typeof BookingLinkSlugParams>;
    Body: CreateBookingBodyType;
  }>(
    '/:slug/book',
    {
      schema: {
        params: BookingLinkSlugParams,
        body: CreateBookingBody,
        tags: ['Public Booking'],
        summary: 'Create a booking',
        description: 'Submit a booking request for a time slot',
        response: {
          201: Type.Object({
            booking: Type.Object({
              id: Type.String(),
              startTime: Type.String(),
              endTime: Type.String(),
              status: Type.String(),
              bookerName: Type.String(),
              bookerEmail: Type.String(),
              meetingUrl: Type.Union([Type.String(), Type.Null()]),
              calendarLinks: Type.Object({
                google: Type.String(),
                outlook: Type.String(),
                ical: Type.String(),
              }),
            }),
          }),
          400: Type.Object({
            error: Type.Object({
              code: Type.String(),
              message: Type.String(),
            }),
          }),
          404: Type.Object({
            error: Type.Object({
              code: Type.String(),
              message: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const body = request.body;

      const booking = await calendarService.createBooking(slug, {
        bookerName: body.bookerName,
        bookerEmail: body.bookerEmail,
        startTime: new Date(body.startTime),
        bookerTimezone: body.timezone ?? 'UTC',
        customAnswers: body.answers as Record<string, unknown>,
        notes: body.notes,
      });

      // Generate calendar links for the guest
      const calendarLinks = generateCalendarLinks(booking);

      return reply.status(201).send({
        booking: {
          id: booking.id,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          status: booking.status,
          bookerName: booking.bookerName,
          bookerEmail: booking.bookerEmail,
          meetingUrl: booking.meetingUrl,
          calendarLinks,
        },
      });
    }
  );

  /**
   * Get booking details (for confirmation page)
   * Limited information for security
   */
  fastify.get<{
    Params: Static<typeof BookingIdParams>;
  }>(
    '/bookings/:bookingId',
    {
      schema: {
        params: BookingIdParams,
        tags: ['Public Booking'],
        summary: 'Get booking details',
        description: 'Get booking information for confirmation or cancellation page',
        response: {
          200: Type.Object({
            booking: Type.Object({
              id: Type.String(),
              startTime: Type.String(),
              endTime: Type.String(),
              status: Type.String(),
              bookerName: Type.String(),
              meetingUrl: Type.Union([Type.String(), Type.Null()]),
              hostName: Type.String(),
              eventName: Type.String(),
              location: Type.Union([Type.String(), Type.Null()]),
              cancellable: Type.Boolean(),
            }),
          }),
          404: Type.Object({
            error: Type.Object({
              code: Type.String(),
              message: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { bookingId } = request.params;

      // Get booking with limited details (no email for privacy)
      const booking = await calendarService.getBookings({
        userId: '', // Will be ignored since we're querying by ID
      });

      // Find the specific booking
      // In production, would have a direct findById method
      const found = booking.find((b) => b.id === bookingId);

      if (!found) {
        return reply.status(404).send({
          error: {
            code: CalendarErrorCode.BOOKING_NOT_FOUND,
            message: 'Booking not found',
          },
        });
      }

      const hostName = found.user
        ? `${found.user.firstName} ${found.user.lastName}`.trim()
        : 'Host';

      const cancellable =
        ['PENDING', 'CONFIRMED'].includes(found.status) && new Date(found.startTime) > new Date();

      return {
        booking: {
          id: found.id,
          startTime: found.startTime.toISOString(),
          endTime: found.endTime.toISOString(),
          status: found.status,
          bookerName: found.bookerName,
          meetingUrl: found.meetingUrl,
          hostName,
          eventName: found.bookingLink?.name ?? 'Meeting',
          location: found.bookingLink?.locationDetails ?? null,
          cancellable,
        },
      };
    }
  );

  /**
   * Cancel a booking (by guest)
   * Guest can cancel their own booking using the booking ID
   */
  fastify.post<{
    Params: Static<typeof BookingIdParams>;
    Body: CancelBookingBodyType;
  }>(
    '/bookings/:bookingId/cancel',
    {
      schema: {
        params: BookingIdParams,
        body: CancelBookingBody,
        tags: ['Public Booking'],
        summary: 'Cancel a booking',
        description: 'Guest can cancel their booking',
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            message: Type.String(),
          }),
          400: Type.Object({
            error: Type.Object({
              code: Type.String(),
              message: Type.String(),
            }),
          }),
          404: Type.Object({
            error: Type.Object({
              code: Type.String(),
              message: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, _reply) => {
      const { bookingId } = request.params;
      const { reason } = request.body;

      // Cancel without userId (guest cancellation)
      await calendarService.cancelBooking(bookingId, null, reason);

      return {
        success: true,
        message: 'Booking cancelled successfully',
      };
    }
  );

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof CalendarError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    // Log unexpected errors
    fastify.log.error(error);

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
};

/**
 * Generate calendar download/add links for booking
 */
function generateCalendarLinks(booking: {
  id: string;
  startTime: Date;
  endTime: Date;
  bookerName: string;
  bookingLink?: { name: string; locationValue?: string | null } | null;
  meetingUrl?: string | null;
}): { google: string; outlook: string; ical: string } {
  const title = encodeURIComponent(booking.bookingLink?.name ?? 'Meeting');
  const start = formatDateForCalendar(booking.startTime);
  const end = formatDateForCalendar(booking.endTime);
  const location = encodeURIComponent(
    booking.meetingUrl ?? booking.bookingLink?.locationValue ?? ''
  );
  const details = encodeURIComponent(`Booking with ${booking.bookerName}`);

  // Google Calendar link
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;

  // Outlook.com link
  const outlookStart = booking.startTime.toISOString();
  const outlookEnd = booking.endTime.toISOString();
  const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${outlookStart}&enddt=${outlookEnd}&body=${details}&location=${location}`;

  // iCal download link (would be served by a separate endpoint)
  const ical = `/api/public/book/bookings/${booking.id}/calendar.ics`;

  return { google, outlook, ical };
}

/**
 * Format date for Google Calendar URL
 */
function formatDateForCalendar(date: Date): string {
  return date
    .toISOString()
    .replaceAll(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export default publicBookingRoutes;

