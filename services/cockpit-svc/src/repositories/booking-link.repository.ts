// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/booking-link
 * Booking Link Repository
 */

import type { CustomQuestion, PublicBookingLinkView } from '../types/calendar.types.js';
import type { PrismaClient, BookingLink, Prisma, LocationType } from '@skillancer/database';

export class BookingLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    scheduleId: string;
    name: string;
    slug: string;
    eventTitle?: string;
    description?: string | null;
    duration: number;
    eventType?: string;
    locationType: LocationType;
    locationValue?: string | null;
    customQuestions?: CustomQuestion[];
    confirmationMessage?: string | null;
    color?: string | null;
    requiresConfirmation?: boolean;
    sendReminders?: boolean;
    reminderHours?: number[];
    maxBookingsPerDay?: number | null;
    isActive?: boolean;
  }): Promise<BookingLink> {
    return this.prisma.bookingLink.create({
      data: {
        userId: data.userId,
        scheduleId: data.scheduleId,
        name: data.name,
        slug: data.slug,
        eventTitle: data.eventTitle ?? data.name,
        eventDuration: data.duration,
        description: data.description ?? null,
        locationType: data.locationType,
        locationDetails: data.locationValue ?? null,
        customQuestions: (data.customQuestions ?? []) as unknown as Prisma.InputJsonValue,
        color: data.color ?? null,
        confirmationEmailEnabled: !data.requiresConfirmation,
        reminderEmailEnabled: data.sendReminders ?? true,
        reminderMinutes: data.reminderHours?.map((h) => h * 60) ?? [1440, 60],
        maxBookingsPerDay: data.maxBookingsPerDay ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<BookingLink | null> {
    return this.prisma.bookingLink.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<BookingLink | null> {
    return this.prisma.bookingLink.findUnique({
      where: { slug },
    });
  }

  async findBySlugWithSchedule(slug: string) {
    return this.prisma.bookingLink.findUnique({
      where: { slug },
      include: {
        schedule: true,
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
  }

  async findPublicBySlug(slug: string): Promise<PublicBookingLinkView | null> {
    const link = await this.prisma.bookingLink.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        eventTitle: true,
        eventDuration: true,
        locationType: true,
        locationDetails: true,
        conferenceType: true,
        customQuestions: true,
        color: true,
        schedule: {
          select: {
            timezone: true,
            weeklyHours: true,
            bufferBefore: true,
            bufferAfter: true,
            minNoticeHours: true,
            maxAdvanceDays: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!link) return null;

    return {
      id: link.id,
      slug: link.slug,
      name: link.name,
      description: link.description,
      eventTitle: link.eventTitle,
      eventDuration: link.eventDuration,
      locationType: link.locationType,
      conferenceType: link.conferenceType,
      customQuestions: link.customQuestions as unknown as CustomQuestion[] | null,
      color: link.color,
      host: {
        name: `${link.user.firstName} ${link.user.lastName}`.trim(),
        avatarUrl: null,
      },
      timezone: link.schedule.timezone,
    };
  }

  async findByUser(userId: string): Promise<BookingLink[]> {
    return this.prisma.bookingLink.findMany({
      where: { userId },
      include: {
        schedule: {
          select: { id: true, name: true },
        },
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySchedule(scheduleId: string): Promise<BookingLink[]> {
    return this.prisma.bookingLink.findMany({
      where: { scheduleId },
      orderBy: { name: 'asc' },
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string | null;
      eventTitle: string;
      eventDuration: number;
      locationType: LocationType;
      locationDetails: string | null;
      customQuestions: CustomQuestion[];
      confirmationEmailEnabled: boolean;
      reminderEmailEnabled: boolean;
      reminderMinutes: number[];
      color: string | null;
      maxBookingsPerDay: number | null;
      isActive: boolean;
      scheduleId: string;
    }>
  ): Promise<BookingLink> {
    const updateData: Prisma.BookingLinkUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.eventTitle !== undefined) updateData.eventTitle = data.eventTitle;
    if (data.eventDuration !== undefined) updateData.eventDuration = data.eventDuration;
    if (data.locationType !== undefined) updateData.locationType = data.locationType;
    if (data.locationDetails !== undefined) updateData.locationDetails = data.locationDetails;
    if (data.customQuestions !== undefined) {
      updateData.customQuestions = data.customQuestions as unknown as Prisma.InputJsonValue;
    }
    if (data.confirmationEmailEnabled !== undefined) {
      updateData.confirmationEmailEnabled = data.confirmationEmailEnabled;
    }
    if (data.reminderEmailEnabled !== undefined) {
      updateData.reminderEmailEnabled = data.reminderEmailEnabled;
    }
    if (data.reminderMinutes !== undefined) updateData.reminderMinutes = data.reminderMinutes;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.maxBookingsPerDay !== undefined) {
      updateData.maxBookingsPerDay = data.maxBookingsPerDay;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.scheduleId !== undefined) {
      updateData.schedule = { connect: { id: data.scheduleId } };
    }

    return this.prisma.bookingLink.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<BookingLink> {
    return this.prisma.bookingLink.delete({
      where: { id },
    });
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.bookingLink.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  async incrementBookingCount(id: string): Promise<void> {
    await this.prisma.bookingLink.update({
      where: { id },
      data: { bookingCount: { increment: 1 } },
    });
  }

  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.prisma.bookingLink.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) return true;
    if (excludeId && existing.id === excludeId) return true;
    return false;
  }

  async getStats(id: string): Promise<{
    viewCount: number;
    bookingCount: number;
    conversionRate: number;
    upcomingBookings: number;
  }> {
    const link = await this.prisma.bookingLink.findUnique({
      where: { id },
      select: { viewCount: true, bookingCount: true },
    });

    if (!link) {
      return {
        viewCount: 0,
        bookingCount: 0,
        conversionRate: 0,
        upcomingBookings: 0,
      };
    }

    const upcomingBookings = await this.prisma.booking.count({
      where: {
        bookingLinkId: id,
        startTime: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    const conversionRate = link.viewCount > 0 ? (link.bookingCount / link.viewCount) * 100 : 0;

    return {
      viewCount: link.viewCount,
      bookingCount: link.bookingCount,
      conversionRate: Math.round(conversionRate * 100) / 100,
      upcomingBookings,
    };
  }
}

