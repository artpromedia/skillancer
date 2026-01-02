// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/booking
 * Booking Repository
 */

import type { BookingFilters, BookingWithDetails } from '../types/calendar.types.js';
import type { PrismaClient, Booking, Prisma, BookingStatus } from '@skillancer/database';

export class BookingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    bookingLinkId: string;
    bookerName: string;
    bookerEmail: string;
    bookerTimezone?: string;
    startTime: Date;
    endTime: Date;
    customAnswers?: Record<string, unknown>;
    notes?: string | null;
    meetingUrl?: string | null;
    calendarEventId?: string | null;
    clientId?: string | null;
    status?: BookingStatus;
  }): Promise<Booking> {
    return this.prisma.booking.create({
      data: {
        userId: data.userId,
        bookingLinkId: data.bookingLinkId,
        bookerName: data.bookerName,
        bookerEmail: data.bookerEmail,
        bookerTimezone: data.bookerTimezone ?? 'UTC',
        startTime: data.startTime,
        endTime: data.endTime,
        customAnswers: (data.customAnswers ?? {}) as unknown as Prisma.InputJsonValue,
        notes: data.notes ?? null,
        meetingUrl: data.meetingUrl ?? null,
        calendarEventId: data.calendarEventId ?? null,
        clientId: data.clientId ?? null,
        status: data.status ?? 'PENDING',
      },
    });
  }

  async findById(id: string): Promise<Booking | null> {
    return this.prisma.booking.findUnique({
      where: { id },
    });
  }

  async findByIdWithDetails(id: string): Promise<BookingWithDetails | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        bookingLink: {
          select: {
            id: true,
            name: true,
            slug: true,
            eventTitle: true,
            eventDuration: true,
            locationType: true,
            locationDetails: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return booking as BookingWithDetails | null;
  }

  async findByFilters(params: BookingFilters): Promise<BookingWithDetails[]> {
    const where: Prisma.BookingWhereInput = {
      userId: params.userId,
    };

    if (params.startDate) {
      where.startTime = { gte: params.startDate };
    }

    if (params.endDate) {
      where.endTime = { lte: params.endDate };
    }

    if (params.status && params.status.length > 0) {
      where.status = { in: params.status };
    }

    if (params.bookingLinkId) {
      where.bookingLinkId = params.bookingLinkId;
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        bookingLink: {
          select: {
            id: true,
            name: true,
            slug: true,
            eventTitle: true,
            eventDuration: true,
            locationType: true,
            locationDetails: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return bookings as BookingWithDetails[];
  }

  async findByBookingLink(
    bookingLinkId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Booking[]> {
    const where: Prisma.BookingWhereInput = {
      bookingLinkId,
      status: { not: 'CANCELLED' },
    };

    if (startDate) {
      where.startTime = { gte: startDate };
    }

    if (endDate) {
      where.endTime = { lte: endDate };
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });
  }

  async findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: {
        userId,
        startTime: { lte: endDate },
        endTime: { gte: startDate },
        status: { not: 'CANCELLED' },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async update(
    id: string,
    data: Partial<{
      status: BookingStatus;
      startTime: Date;
      endTime: Date;
      meetingUrl: string | null;
      calendarEventId: string | null;
      clientId: string | null;
      notes: string | null;
      cancelledAt: Date | null;
      cancelledBy: string | null;
      cancellationReason: string | null;
      rescheduledFrom: string | null;
      rescheduledTo: string | null;
    }>
  ): Promise<Booking> {
    return this.prisma.booking.update({
      where: { id },
      data,
    });
  }

  async confirm(id: string, meetingUrl?: string): Promise<Booking> {
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        meetingUrl: meetingUrl ?? undefined,
        confirmationSentAt: new Date(),
      },
    });
  }

  async cancel(id: string, reason?: string): Promise<Booking> {
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason ?? null,
      },
    });
  }

  async complete(id: string): Promise<Booking> {
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: 'COMPLETED',
      },
    });
  }

  async markNoShow(id: string): Promise<Booking> {
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'NO_SHOW' },
    });
  }

  async findUpcoming(userId: string, limit: number = 10): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: {
        userId,
        startTime: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { startTime: 'asc' },
      take: limit,
    });
  }

  async findNeedingReminder(reminderHours: number[]): Promise<Booking[]> {
    const now = new Date();

    // Calculate the time windows for each reminder hour
    const orConditions: Prisma.BookingWhereInput[] = reminderHours.map((hours) => {
      const targetStart = new Date(now.getTime() + hours * 60 * 60 * 1000);
      const targetEnd = new Date(targetStart.getTime() + 5 * 60 * 1000); // 5 min window

      return {
        startTime: { gte: targetStart, lte: targetEnd },
      };
    });

    return this.prisma.booking.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        remindersSentAt: { isEmpty: true },
        OR: orConditions,
      },
      include: {
        bookingLink: {
          select: { reminderEmailEnabled: true, reminderMinutes: true },
        },
      },
    });
  }

  async markReminderSent(id: string): Promise<void> {
    await this.prisma.booking.update({
      where: { id },
      data: { remindersSentAt: { push: new Date() } },
    });
  }

  async countByBookingLinkOnDate(bookingLinkId: string, date: Date): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.booking.count({
      where: {
        bookingLinkId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' },
      },
    });
  }

  async findByEmail(email: string, userId: string, limit: number = 10): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: {
        userId,
        bookerEmail: email.toLowerCase(),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async delete(id: string): Promise<Booking> {
    return this.prisma.booking.delete({
      where: { id },
    });
  }
}

