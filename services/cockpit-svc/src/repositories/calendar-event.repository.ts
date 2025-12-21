/**
 * @module @skillancer/cockpit-svc/repositories/calendar-event
 * Calendar Event Repository
 */

import type { EventFilters, CalendarEventWithDetails } from '../types/calendar.types.js';
import type {
  PrismaClient,
  CalendarEvent,
  Prisma,
  EventType,
  EventSource,
  EventStatus,
  SyncStatus,
} from '@skillancer/database';

export class CalendarEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    source?: EventSource;
    externalCalendarId?: string | null;
    externalEventId?: string | null;
    title: string;
    description?: string | null;
    location?: string | null;
    startTime: Date;
    endTime: Date;
    isAllDay?: boolean;
    timezone?: string;
    isRecurring?: boolean;
    recurrenceRule?: string | null;
    recurrenceId?: string | null;
    originalStartTime?: Date | null;
    eventType?: EventType;
    category?: string | null;
    color?: string | null;
    projectId?: string | null;
    clientId?: string | null;
    taskId?: string | null;
    attendees?: unknown;
    organizerEmail?: string | null;
    meetingUrl?: string | null;
    conferenceType?: string | null;
    status?: EventStatus;
    visibility?: 'DEFAULT' | 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';
    trackTime?: boolean;
    timeEntryId?: string | null;
    autoCreateTimeEntry?: boolean;
    reminders?: unknown;
    lastSyncAt?: Date | null;
    syncStatus?: SyncStatus;
    etag?: string | null;
    metadata?: unknown;
  }): Promise<CalendarEvent> {
    return this.prisma.calendarEvent.create({
      data: {
        userId: data.userId,
        source: data.source ?? 'INTERNAL',
        externalCalendarId: data.externalCalendarId ?? null,
        externalEventId: data.externalEventId ?? null,
        title: data.title,
        description: data.description ?? null,
        location: data.location ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        isAllDay: data.isAllDay ?? false,
        timezone: data.timezone ?? 'UTC',
        isRecurring: data.isRecurring ?? false,
        recurrenceRule: data.recurrenceRule ?? null,
        recurrenceId: data.recurrenceId ?? null,
        originalStartTime: data.originalStartTime ?? null,
        eventType: data.eventType ?? 'MEETING',
        category: data.category ?? null,
        color: data.color ?? null,
        projectId: data.projectId ?? null,
        clientId: data.clientId ?? null,
        taskId: data.taskId ?? null,
        attendees: (data.attendees as Prisma.InputJsonValue) ?? null,
        organizerEmail: data.organizerEmail ?? null,
        meetingUrl: data.meetingUrl ?? null,
        conferenceType: data.conferenceType ?? null,
        status: data.status ?? 'CONFIRMED',
        visibility: data.visibility ?? 'DEFAULT',
        trackTime: data.trackTime ?? false,
        timeEntryId: data.timeEntryId ?? null,
        autoCreateTimeEntry: data.autoCreateTimeEntry ?? false,
        reminders: (data.reminders as Prisma.InputJsonValue) ?? null,
        lastSyncAt: data.lastSyncAt ?? null,
        syncStatus: data.syncStatus ?? 'SYNCED',
        etag: data.etag ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? null,
      },
    });
  }

  async findById(id: string): Promise<CalendarEvent | null> {
    return this.prisma.calendarEvent.findUnique({
      where: { id },
    });
  }

  async findByIdWithDetails(id: string): Promise<CalendarEventWithDetails | null> {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        externalCalendar: true,
      },
    });

    return event as CalendarEventWithDetails | null;
  }

  async findByExternalId(
    externalCalendarId: string,
    externalEventId: string
  ): Promise<CalendarEvent | null> {
    return this.prisma.calendarEvent.findUnique({
      where: {
        externalCalendarId_externalEventId: {
          externalCalendarId,
          externalEventId,
        },
      },
    });
  }

  async findByFilters(params: EventFilters): Promise<CalendarEventWithDetails[]> {
    const where: Prisma.CalendarEventWhereInput = {
      userId: params.userId,
      deletedAt: params.includeDeleted ? undefined : null,
      startTime: { lte: params.endDate },
      endTime: { gte: params.startDate },
    };

    if (params.eventTypes && params.eventTypes.length > 0) {
      where.eventType = { in: params.eventTypes };
    }

    if (params.projectId) {
      where.projectId = params.projectId;
    }

    if (params.clientId) {
      where.clientId = params.clientId;
    }

    if (params.calendarIds && params.calendarIds.length > 0) {
      where.OR = [{ source: 'INTERNAL' }, { externalCalendarId: { in: params.calendarIds } }];
    }

    const events = await this.prisma.calendarEvent.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        client: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        externalCalendar: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return events as CalendarEventWithDetails[];
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      location: string | null;
      startTime: Date;
      endTime: Date;
      isAllDay: boolean;
      timezone: string;
      eventType: EventType;
      category: string | null;
      color: string | null;
      projectId: string | null;
      clientId: string | null;
      taskId: string | null;
      attendees: unknown;
      meetingUrl: string | null;
      conferenceType: string | null;
      recurrenceRule: string | null;
      status: EventStatus;
      visibility: 'DEFAULT' | 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL';
      trackTime: boolean;
      timeEntryId: string | null;
      autoCreateTimeEntry: boolean;
      reminders: unknown;
      externalCalendarId: string | null;
      externalEventId: string | null;
      lastSyncAt: Date | null;
      syncStatus: SyncStatus;
      etag: string | null;
      deletedAt: Date | null;
    }>
  ): Promise<CalendarEvent> {
    return this.prisma.calendarEvent.update({
      where: { id },
      data: data as Prisma.CalendarEventUpdateInput,
    });
  }

  async softDelete(id: string): Promise<CalendarEvent> {
    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'CANCELLED',
      },
    });
  }

  async deleteByExternalCalendar(externalCalendarId: string): Promise<number> {
    const result = await this.prisma.calendarEvent.deleteMany({
      where: { externalCalendarId },
    });
    return result.count;
  }

  async findPendingSync(userId: string): Promise<CalendarEvent[]> {
    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        source: 'INTERNAL',
        externalCalendarId: { not: null },
        syncStatus: 'PENDING',
        deletedAt: null,
      },
    });
  }

  async findWithAutoTimeEntry(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        autoCreateTimeEntry: true,
        timeEntryId: null,
        endTime: { lte: endDate, gte: startDate },
        status: 'CONFIRMED',
        deletedAt: null,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findUpcoming(userId: string, minutes: number): Promise<CalendarEvent[]> {
    const now = new Date();
    const targetTime = new Date(now.getTime() + minutes * 60 * 1000);

    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: { gte: now, lte: targetTime },
        status: 'CONFIRMED',
        deletedAt: null,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async countByDateRange(userId: string, startDate: Date, endDate: Date): Promise<number> {
    return this.prisma.calendarEvent.count({
      where: {
        userId,
        startTime: { lte: endDate },
        endTime: { gte: startDate },
        status: { not: 'CANCELLED' },
        deletedAt: null,
      },
    });
  }
}
