// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/services/calendar
 * Main Calendar Service
 *
 * Orchestrates calendar connections, events, availability, and bookings
 */

import { randomBytes } from 'node:crypto';

import { createLogger } from '@skillancer/logger';

import {
  GoogleCalendarService,
  type GoogleCalendarConfig,
  type CreateGoogleEventParams,
} from './google-calendar.service.js';
import {
  MicrosoftCalendarService,
  type MicrosoftCalendarConfig,
  type CreateMicrosoftEventParams,
} from './microsoft-calendar.service.js';
import { CalendarError, CalendarErrorCode } from '../errors/calendar.errors.js';
import { AvailabilityScheduleRepository } from '../repositories/availability-schedule.repository.js';
import { BookingLinkRepository } from '../repositories/booking-link.repository.js';
import { BookingRepository } from '../repositories/booking.repository.js';
import { CalendarConnectionRepository } from '../repositories/calendar-connection.repository.js';
import { CalendarEventRepository } from '../repositories/calendar-event.repository.js';
import { ExternalCalendarRepository } from '../repositories/external-calendar.repository.js';

import type {
  OAuthTokens,
  CreateEventParams,
  UpdateEventParams,
  EventFilters,
  CalendarEventWithDetails,
  WeeklyHours,
  DateOverrides,
  CreateScheduleParams,
  AvailabilityCalendar,
  AvailableDate,
  CreateBookingLinkParams,
  CreateBookingParams,
  BookingWithDetails,
  BookingFilters,
  SyncResult,
  NormalizedEventData,
  TimeSlot,
} from '../types/calendar.types.js';
import type {
  PrismaClient,
  CalendarProvider,
  CalendarConnection,
  CalendarEvent,
} from '../types/prisma-shim.js';

const logger = createLogger({ name: 'calendar-service' });

export interface CalendarServiceConfig {
  google?: GoogleCalendarConfig;
  microsoft?: MicrosoftCalendarConfig;
  baseUrl: string; // For booking links
}

export class CalendarService {
  private readonly connectionRepo: CalendarConnectionRepository;
  private readonly calendarRepo: ExternalCalendarRepository;
  private readonly eventRepo: CalendarEventRepository;
  private readonly scheduleRepo: AvailabilityScheduleRepository;
  private readonly bookingLinkRepo: BookingLinkRepository;
  private readonly bookingRepo: BookingRepository;

  private readonly googleService?: GoogleCalendarService;
  private readonly microsoftService?: MicrosoftCalendarService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: CalendarServiceConfig
  ) {
    this.connectionRepo = new CalendarConnectionRepository(prisma);
    this.calendarRepo = new ExternalCalendarRepository(prisma);
    this.eventRepo = new CalendarEventRepository(prisma);
    this.scheduleRepo = new AvailabilityScheduleRepository(prisma);
    this.bookingLinkRepo = new BookingLinkRepository(prisma);
    this.bookingRepo = new BookingRepository(prisma);

    if (config.google) {
      this.googleService = new GoogleCalendarService(config.google);
    }

    if (config.microsoft) {
      this.microsoftService = new MicrosoftCalendarService(config.microsoft);
    }
  }

  // ============================================
  // OAuth & Connection Management
  // ============================================

  /**
   * Get OAuth authorization URL for a provider
   */
  getAuthorizationUrl(provider: CalendarProvider, userId: string): string {
    const state = this.generateOAuthState(userId, provider);

    switch (provider) {
      case 'GOOGLE':
        if (!this.googleService) {
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Google Calendar is not configured'
          );
        }
        return this.googleService.getAuthorizationUrl(state);

      case 'MICROSOFT':
        if (!this.microsoftService) {
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Microsoft Calendar is not configured'
          );
        }
        // Note: This is async but we're calling it sync - in real impl would need adjustment
        throw new CalendarError(
          CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
          'Use getAuthorizationUrlAsync for Microsoft'
        );

      default:
        throw new CalendarError(
          CalendarErrorCode.INVALID_PROVIDER,
          `Unsupported provider: ${provider}`
        );
    }
  }

  /**
   * Get OAuth authorization URL (async version for Microsoft)
   */
  async getAuthorizationUrlAsync(provider: CalendarProvider, userId: string): Promise<string> {
    const state = this.generateOAuthState(userId, provider);

    switch (provider) {
      case 'GOOGLE':
        if (!this.googleService) {
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Google Calendar is not configured'
          );
        }
        return this.googleService.getAuthorizationUrl(state);

      case 'MICROSOFT':
        if (!this.microsoftService) {
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Microsoft Calendar is not configured'
          );
        }
        return this.microsoftService.getAuthorizationUrl(state);

      default:
        throw new CalendarError(
          CalendarErrorCode.INVALID_PROVIDER,
          `Unsupported provider: ${provider}`
        );
    }
  }

  /**
   * Handle OAuth callback and create connection
   */
  async handleOAuthCallback(code: string, state: string): Promise<CalendarConnection> {
    const { userId, provider } = this.parseOAuthState(state);

    logger.info({ userId, provider }, 'Processing OAuth callback');

    let tokens: OAuthTokens;
    let accountId: string;
    let accountEmail: string;

    switch (provider) {
      case 'GOOGLE': {
        if (!this.googleService) {
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Google Calendar is not configured'
          );
        }
        tokens = await this.googleService.exchangeAuthCode(code);
        const googleUserInfo = await this.googleService.getUserInfo(tokens);
        accountId = googleUserInfo.id;
        accountEmail = googleUserInfo.email;
        break;
      }

      case 'MICROSOFT': {
        if (!this.microsoftService) {
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Microsoft Calendar is not configured'
          );
        }
        tokens = await this.microsoftService.exchangeAuthCode(code);
        const msUserInfo = await this.microsoftService.getUserInfo(tokens);
        accountId = msUserInfo.id;
        accountEmail = msUserInfo.email;
        break;
      }

      default:
        throw new CalendarError(
          CalendarErrorCode.INVALID_PROVIDER,
          `Unsupported provider: ${provider}`
        );
    }

    // Check if connection already exists
    const existing = await this.connectionRepo.findByProviderAccount(userId, provider, accountId);

    if (existing) {
      // Update existing connection with new tokens
      const updated = await this.connectionRepo.update(existing.id, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? existing.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        syncEnabled: true,
        lastSyncAt: null,
      });

      // Refresh calendars
      await this.syncCalendarList(updated.id);

      return updated;
    }

    // Create new connection
    const connection = await this.connectionRepo.create({
      userId,
      provider,
      providerAccountId: accountId,
      email: accountEmail,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      syncEnabled: true,
      syncDirection: 'BIDIRECTIONAL',
    });

    // Fetch and store calendars
    await this.syncCalendarList(connection.id);

    return connection;
  }

  /**
   * Disconnect a calendar provider
   */
  async disconnectProvider(connectionId: string, userId: string): Promise<void> {
    const connection = await this.connectionRepo.findById(connectionId);

    if (!connection) {
      throw new CalendarError(
        CalendarErrorCode.CONNECTION_NOT_FOUND,
        'Calendar connection not found'
      );
    }

    if (connection.userId !== userId) {
      throw new CalendarError(
        CalendarErrorCode.UNAUTHORIZED_ACCESS,
        'Not authorized to disconnect this calendar'
      );
    }

    // Revoke tokens with provider
    try {
      if (connection.provider === 'GOOGLE' && this.googleService) {
        await this.googleService.revokeToken(connection.accessToken);
      }
    } catch (error) {
      logger.warn({ error, connectionId }, 'Failed to revoke provider tokens');
    }

    // Delete associated events and calendars
    const calendars = await this.calendarRepo.findByConnection(connectionId);
    for (const cal of calendars) {
      await this.eventRepo.deleteByExternalCalendar(cal.id);
    }
    await this.calendarRepo.deleteByConnection(connectionId);

    // Delete connection
    await this.connectionRepo.delete(connectionId);

    logger.info({ connectionId, userId }, 'Disconnected calendar provider');
  }

  /**
   * Get user's calendar connections
   */
  async getConnections(userId: string) {
    return this.connectionRepo.findByUser(userId);
  }

  /**
   * Sync calendar list from provider
   */
  async syncCalendarList(connectionId: string): Promise<void> {
    const connection = await this.connectionRepo.findById(connectionId);

    if (!connection) {
      throw new CalendarError(
        CalendarErrorCode.CONNECTION_NOT_FOUND,
        'Calendar connection not found'
      );
    }

    const tokens = await this.getValidTokens(connection);
    let calendars;

    switch (connection.provider) {
      case 'GOOGLE':
        if (!this.googleService)
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Google not configured'
          );
        calendars = await this.googleService.listCalendars(tokens);
        break;
      case 'MICROSOFT':
        if (!this.microsoftService)
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Microsoft not configured'
          );
        calendars = await this.microsoftService.listCalendars(tokens);
        break;
      default:
        throw new CalendarError(
          CalendarErrorCode.INVALID_PROVIDER,
          `Unsupported: ${connection.provider}`
        );
    }

    // Upsert calendars
    for (const cal of calendars) {
      await this.calendarRepo.upsert({
        connectionId,
        externalId: cal.id,
        name: cal.name,
        color: cal.color ?? null,
        isPrimary: cal.isPrimary,
        accessRole: cal.accessRole ?? null,
        timezone: cal.timezone ?? null,
        syncEnabled: cal.isPrimary, // Enable sync for primary by default
      });
    }

    logger.info({ connectionId, count: calendars.length }, 'Synced calendar list');
  }

  // ============================================
  // Event Management
  // ============================================

  /**
   * Create a calendar event
   */
  async createEvent(userId: string, params: CreateEventParams): Promise<CalendarEventWithDetails> {
    logger.info({ userId, title: params.title }, 'Creating calendar event');

    // Create internal event
    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- EventType/EventVisibility types are properly defined but ESLint can't infer them */
    const event = await this.eventRepo.create({
      userId,
      source: 'INTERNAL',
      title: params.title,
      description: params.description,
      location: params.location,
      startTime: params.startTime,
      endTime: params.endTime,
      isAllDay: params.isAllDay,
      timezone: params.timezone,
      eventType: params.eventType,
      projectId: params.projectId,
      clientId: params.clientId,
      taskId: params.taskId,
      attendees: params.attendees,
      meetingUrl: params.meetingUrl,
      recurrenceRule: params.recurrenceRule,
      visibility: params.visibility,
      trackTime: params.trackTime,
      autoCreateTimeEntry: params.autoCreateTimeEntry,
      reminders: params.reminders,
      syncStatus: params.syncToExternal ? 'PENDING' : 'SYNCED',
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // Sync to external calendar if requested
    if (params.syncToExternal && params.externalCalendarId) {
      await this.syncEventToExternal(event, params.externalCalendarId);
    }

    const createdEvent = await this.eventRepo.findByIdWithDetails(event.id);
    if (!createdEvent) {
      throw new CalendarError(CalendarErrorCode.EVENT_NOT_FOUND, 'Failed to create event');
    }
    return createdEvent;
  }

  /**
   * Update a calendar event
   */
  async updateEvent(
    eventId: string,
    userId: string,
    params: UpdateEventParams
  ): Promise<CalendarEventWithDetails> {
    const event = await this.eventRepo.findById(eventId);

    if (!event) {
      throw new CalendarError(CalendarErrorCode.EVENT_NOT_FOUND, 'Calendar event not found');
    }

    if (event.userId !== userId) {
      throw new CalendarError(
        CalendarErrorCode.UNAUTHORIZED_ACCESS,
        'Not authorized to update this event'
      );
    }

    // Update internal event
    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- EventType/EventVisibility types are properly defined */
    const updated = await this.eventRepo.update(eventId, {
      title: params.title,
      description: params.description,
      location: params.location,
      startTime: params.startTime,
      endTime: params.endTime,
      isAllDay: params.isAllDay,
      timezone: params.timezone,
      eventType: params.eventType,
      projectId: params.projectId,
      clientId: params.clientId,
      attendees: params.attendees,
      meetingUrl: params.meetingUrl,
      recurrenceRule: params.recurrenceRule,
      visibility: params.visibility,
      trackTime: params.trackTime,
      autoCreateTimeEntry: params.autoCreateTimeEntry,
      reminders: params.reminders,
      syncStatus: event.externalCalendarId ? 'PENDING' : event.syncStatus,
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    // If event is linked to external calendar, sync changes
    if (updated.externalCalendarId && updated.externalEventId) {
      await this.syncEventToExternal(updated, updated.externalCalendarId);
    }

    const updatedEvent = await this.eventRepo.findByIdWithDetails(updated.id);
    if (!updatedEvent) {
      throw new CalendarError(CalendarErrorCode.EVENT_NOT_FOUND, 'Failed to update event');
    }
    return updatedEvent;
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    eventId: string,
    userId: string,
    deleteExternal: boolean = true
  ): Promise<void> {
    const event = await this.eventRepo.findById(eventId);

    if (!event) {
      throw new CalendarError(CalendarErrorCode.EVENT_NOT_FOUND, 'Calendar event not found');
    }

    if (event.userId !== userId) {
      throw new CalendarError(
        CalendarErrorCode.UNAUTHORIZED_ACCESS,
        'Not authorized to delete this event'
      );
    }

    // Delete from external calendar if linked
    if (deleteExternal && event.externalCalendarId && event.externalEventId) {
      try {
        await this.deleteExternalEvent(event);
      } catch (error) {
        logger.warn({ error, eventId }, 'Failed to delete external event');
      }
    }

    await this.eventRepo.softDelete(eventId);
  }

  /**
   * Get events for a user
   */
  async getEvents(filters: EventFilters): Promise<CalendarEventWithDetails[]> {
    return this.eventRepo.findByFilters(filters);
  }

  /**
   * Sync an internal event to external calendar
   */
  private async syncEventToExternal(
    event: CalendarEvent,
    externalCalendarId: string
  ): Promise<void> {
    const calendar = await this.calendarRepo.findById(externalCalendarId);
    if (!calendar) {
      logger.warn({ externalCalendarId }, 'External calendar not found for sync');
      return;
    }

    const connection = await this.connectionRepo.findById(calendar.connectionId);
    if (!connection) {
      logger.warn({ connectionId: calendar.connectionId }, 'Connection not found for sync');
      return;
    }

    const tokens = await this.getValidTokens(connection);
    let externalEvent: NormalizedEventData;

    try {
      if (event.externalEventId) {
        // Update existing external event
        externalEvent = await this.updateExternalEvent(
          connection.provider,
          tokens,
          calendar.externalId,
          event.externalEventId,
          event
        );
      } else {
        // Create new external event
        externalEvent = await this.createExternalEvent(
          connection.provider,
          tokens,
          calendar.externalId,
          event
        );
      }

      await this.eventRepo.update(event.id, {
        externalCalendarId,
        externalEventId: externalEvent.id,
        lastSyncAt: new Date(),
        syncStatus: 'SYNCED',
        etag: externalEvent.etag,
      });
    } catch (error) {
      logger.error({ error, eventId: event.id }, 'Failed to sync event to external');
      await this.eventRepo.update(event.id, { syncStatus: 'ERROR' });
    }
  }

  private async createExternalEvent(
    provider: CalendarProvider,
    tokens: OAuthTokens,
    calendarExternalId: string,
    event: CalendarEvent
  ): Promise<NormalizedEventData> {
    const isAllDay = event.isAllDay ?? false;

    switch (provider) {
      case 'GOOGLE': {
        if (!this.googleService)
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Google not configured'
          );

        const googleParams: CreateGoogleEventParams = {
          calendarId: calendarExternalId,
          summary: event.title,
          description: event.description ?? undefined,
          location: event.location ?? undefined,
          start: isAllDay
            ? { date: event.startTime.toISOString().slice(0, 10) }
            : { dateTime: event.startTime.toISOString(), timeZone: event.timezone },
          end: isAllDay
            ? { date: event.endTime.toISOString().slice(0, 10) }
            : { dateTime: event.endTime.toISOString(), timeZone: event.timezone },
          attendees: (event.attendees as Array<{ email: string; name?: string }>) ?? undefined,
          visibility: event.visibility?.toLowerCase() as
            | 'default'
            | 'public'
            | 'private'
            | 'confidential',
        };

        return this.googleService.createEvent(tokens, googleParams);
      }

      case 'MICROSOFT': {
        if (!this.microsoftService)
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Microsoft not configured'
          );

        const msParams: CreateMicrosoftEventParams = {
          calendarId: calendarExternalId,
          subject: event.title,
          body: event.description ? { content: event.description, contentType: 'text' } : undefined,
          location: event.location ?? undefined,
          start: { dateTime: event.startTime.toISOString(), timeZone: event.timezone },
          end: { dateTime: event.endTime.toISOString(), timeZone: event.timezone },
          isAllDay,
          attendees: (event.attendees as Array<{ email: string; name?: string }>) ?? undefined,
        };

        return this.microsoftService.createEvent(tokens, msParams);
      }

      default:
        throw new CalendarError(CalendarErrorCode.INVALID_PROVIDER, `Unsupported: ${provider}`);
    }
  }

  private async updateExternalEvent(
    provider: CalendarProvider,
    tokens: OAuthTokens,
    calendarExternalId: string,
    eventExternalId: string,
    event: CalendarEvent
  ): Promise<NormalizedEventData> {
    const isAllDay = event.isAllDay ?? false;

    switch (provider) {
      case 'GOOGLE':
        if (!this.googleService)
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Google not configured'
          );

        return this.googleService.updateEvent(tokens, calendarExternalId, eventExternalId, {
          summary: event.title,
          description: event.description ?? undefined,
          location: event.location ?? undefined,
          start: isAllDay
            ? { date: event.startTime.toISOString().slice(0, 10) }
            : { dateTime: event.startTime.toISOString(), timeZone: event.timezone },
          end: isAllDay
            ? { date: event.endTime.toISOString().slice(0, 10) }
            : { dateTime: event.endTime.toISOString(), timeZone: event.timezone },
        });

      case 'MICROSOFT':
        if (!this.microsoftService)
          throw new CalendarError(
            CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
            'Microsoft not configured'
          );

        return this.microsoftService.updateEvent(tokens, calendarExternalId, eventExternalId, {
          subject: event.title,
          body: event.description ? { content: event.description, contentType: 'text' } : undefined,
          location: event.location ?? undefined,
          start: { dateTime: event.startTime.toISOString(), timeZone: event.timezone },
          end: { dateTime: event.endTime.toISOString(), timeZone: event.timezone },
          isAllDay,
        });

      default:
        throw new CalendarError(CalendarErrorCode.INVALID_PROVIDER, `Unsupported: ${provider}`);
    }
  }

  private async deleteExternalEvent(event: CalendarEvent): Promise<void> {
    if (!event.externalCalendarId || !event.externalEventId) return;

    const calendar = await this.calendarRepo.findById(event.externalCalendarId);
    if (!calendar) return;

    const connection = await this.connectionRepo.findById(calendar.connectionId);
    if (!connection) return;

    const tokens = await this.getValidTokens(connection);

    switch (connection.provider) {
      case 'GOOGLE':
        if (this.googleService) {
          await this.googleService.deleteEvent(tokens, calendar.externalId, event.externalEventId);
        }
        break;
      case 'MICROSOFT':
        if (this.microsoftService) {
          await this.microsoftService.deleteEvent(
            tokens,
            calendar.externalId,
            event.externalEventId
          );
        }
        break;
    }
  }

  // ============================================
  // Availability Schedules
  // ============================================

  /**
   * Create availability schedule
   */
  async createSchedule(userId: string, params: CreateScheduleParams) {
    return this.scheduleRepo.create({
      userId,
      name: params.name,
      timezone: params.timezone,
      weeklyHours: params.weeklyHours,
      dateOverrides: params.dateOverrides ?? undefined,
      isDefault: params.isDefault,
      bufferBefore: params.bufferBefore,
      bufferAfter: params.bufferAfter,
      minNoticeHours: params.minNoticeHours ?? params.minimumNotice,
      maxAdvanceDays: params.maxAdvanceDays,
    });
  }

  /**
   * Get user's availability schedules
   */
  async getSchedules(userId: string) {
    return this.scheduleRepo.findByUser(userId);
  }

  /**
   * Get availability for a booking link
   */
  async getAvailability(
    bookingLinkId: string,
    startDate: Date,
    endDate: Date,
    _timezone: string = 'UTC'
  ): Promise<AvailabilityCalendar> {
    const bookingLink = await this.bookingLinkRepo.findBySlugWithSchedule(bookingLinkId);

    if (!bookingLink) {
      throw new CalendarError(CalendarErrorCode.BOOKING_LINK_NOT_FOUND, 'Booking link not found');
    }

    const schedule = bookingLink.schedule;
    const weeklyHours = schedule.weeklyHours as unknown as WeeklyHours;
    const dateOverrides = (schedule.dateOverrides as unknown as DateOverrides) || {};

    // Get existing bookings and events to block out
    const existingBookings = await this.bookingRepo.findByBookingLink(
      bookingLink.id,
      startDate,
      endDate
    );

    const existingEvents = await this.eventRepo.findByFilters({
      userId: bookingLink.userId,
      startDate,
      endDate,
    });

    const days: AvailableDate[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();

      // Check date override or use weekly hours
      let daySlots: TimeSlot[] | null;
      if (dateStr && dateOverrides[dateStr] !== undefined) {
        daySlots = dateOverrides[dateStr];
      } else {
        daySlots = weeklyHours[dayOfWeek] ?? null;
      }

      const slots: Array<{ start: Date; end: Date }> = [];

      if (daySlots && daySlots.length > 0) {
        for (const slot of daySlots) {
          // Generate time slots based on duration
          const slotStart = this.parseTimeToDate(current, slot.start);
          const slotEnd = this.parseTimeToDate(current, slot.end);

          let slotCurrent = new Date(slotStart);
          const durationMs = bookingLink.eventDuration * 60 * 1000;
          while (slotCurrent.getTime() + durationMs <= slotEnd.getTime()) {
            const slotEndTime = new Date(slotCurrent.getTime() + durationMs);

            // Check if slot is available (not blocked by bookings or events)
            const isBlocked = this.isTimeBlocked(
              slotCurrent,
              slotEndTime,
              existingBookings,
              existingEvents.map((e) => ({ startTime: e.startTime, endTime: e.endTime })),
              schedule.bufferBefore,
              schedule.bufferAfter
            );

            // Check minimum notice (minNoticeHours is in hours)
            const noticeDeadline = new Date(Date.now() + schedule.minNoticeHours * 60 * 60 * 1000);
            const hasEnoughNotice = slotCurrent > noticeDeadline;

            if (!isBlocked && hasEnoughNotice) {
              slots.push({
                start: new Date(slotCurrent),
                end: slotEndTime,
              });
            }

            slotCurrent = slotEndTime;
          }
        }
      }

      days.push({
        date: dateStr ?? '',
        slots,
        hasAvailability: slots.length > 0,
      });

      current.setDate(current.getDate() + 1);
    }

    return {
      month: startDate,
      timezone: schedule.timezone,
      availableDates: days,
      days,
    };
  }

  private parseTimeToDate(date: Date, time: string): Date {
    const parts = time.split(':').map(Number);
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  private isTimeBlocked(
    start: Date,
    end: Date,
    bookings: Array<{ startTime: Date; endTime: Date }>,
    events: Array<{ startTime: Date; endTime: Date }>,
    bufferBefore: number,
    bufferAfter: number
  ): boolean {
    const bufferedStart = new Date(start.getTime() - bufferBefore * 60 * 1000);
    const bufferedEnd = new Date(end.getTime() + bufferAfter * 60 * 1000);

    // Check bookings
    for (const booking of bookings) {
      if (bufferedStart < booking.endTime && bufferedEnd > booking.startTime) {
        return true;
      }
    }

    // Check events
    for (const event of events) {
      if (bufferedStart < event.endTime && bufferedEnd > event.startTime) {
        return true;
      }
    }

    return false;
  }

  // ============================================
  // Booking Links
  // ============================================

  /**
   * Create a booking link
   */
  async createBookingLink(userId: string, params: CreateBookingLinkParams) {
    // Generate slug if not provided
    const slug = params.slug ?? this.generateSlug(params.name);

    // Check slug availability
    const isAvailable = await this.bookingLinkRepo.isSlugAvailable(slug);
    if (!isAvailable) {
      throw new CalendarError(
        CalendarErrorCode.BOOKING_LINK_SLUG_EXISTS,
        'Booking link slug already exists'
      );
    }

    return this.bookingLinkRepo.create({
      userId,
      scheduleId: params.scheduleId,
      name: params.name,
      slug,
      eventTitle: params.eventTitle ?? params.name,
      description: params.description ?? null,
      duration: params.eventDuration,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- LocationType is properly defined
      locationType: params.locationType ?? 'VIDEO_CALL',
      locationValue: params.locationDetails ?? null,
      customQuestions: params.customQuestions ?? undefined,
      color: params.color ?? null,
      maxBookingsPerDay: params.maxBookingsPerDay ?? null,
    });
  }

  /**
   * Get user's booking links
   */
  async getBookingLinks(userId: string) {
    return this.bookingLinkRepo.findByUser(userId);
  }

  /**
   * Get public booking link info
   */
  async getPublicBookingLink(slug: string) {
    const link = await this.bookingLinkRepo.findPublicBySlug(slug);

    if (!link) {
      throw new CalendarError(CalendarErrorCode.BOOKING_LINK_NOT_FOUND, 'Booking link not found');
    }

    // Increment view count
    const fullLink = await this.bookingLinkRepo.findBySlug(slug);
    if (fullLink) {
      await this.bookingLinkRepo.incrementViewCount(fullLink.id);
    }

    return link;
  }

  // ============================================
  // Bookings
  // ============================================

  /**
   * Create a booking (public - from guest)
   */
  async createBooking(slug: string, params: CreateBookingParams): Promise<BookingWithDetails> {
    const bookingLink = await this.bookingLinkRepo.findBySlugWithSchedule(slug);

    if (!bookingLink || !bookingLink.isActive) {
      throw new CalendarError(
        CalendarErrorCode.BOOKING_LINK_NOT_FOUND,
        'Booking link not found or inactive'
      );
    }

    // Calculate endTime based on booking link duration
    const endTime = new Date(params.startTime.getTime() + bookingLink.eventDuration * 60 * 1000);

    // Validate time slot is available
    const availability = await this.getAvailability(
      bookingLink.id,
      params.startTime,
      endTime,
      params.bookerTimezone
    );

    const selectedSlotTime = params.startTime.getTime();
    const selectedSlot = availability.days
      .flatMap((d) => d.slots)
      .find((s) => s.start.getTime() === selectedSlotTime);

    if (!selectedSlot) {
      throw new CalendarError(
        CalendarErrorCode.TIMESLOT_NOT_AVAILABLE,
        'Selected time slot is not available'
      );
    }

    // Check daily booking limit
    if (bookingLink.maxBookingsPerDay) {
      const countToday = await this.bookingRepo.countByBookingLinkOnDate(
        bookingLink.id,
        params.startTime
      );
      if (countToday >= bookingLink.maxBookingsPerDay) {
        throw new CalendarError(
          CalendarErrorCode.MAX_BOOKINGS_REACHED,
          'Maximum bookings for this day reached'
        );
      }
    }

    // Create booking
    const booking = await this.bookingRepo.create({
      userId: bookingLink.userId,
      bookingLinkId: bookingLink.id,
      bookerName: params.bookerName,
      bookerEmail: params.bookerEmail.toLowerCase(),
      bookerTimezone: params.bookerTimezone,
      startTime: params.startTime,
      endTime,
      customAnswers: params.customAnswers ?? undefined,
      notes: params.notes ?? null,
      status: bookingLink.confirmationEmailEnabled ? 'CONFIRMED' : 'PENDING',
    });

    // Increment booking count
    await this.bookingLinkRepo.incrementBookingCount(bookingLink.id);

    // Create calendar event for the host
    const event = await this.eventRepo.create({
      userId: bookingLink.userId,
      source: 'BOOKING',
      title: `${bookingLink.name} with ${params.bookerName}`,
      description: params.notes ?? null,
      startTime: params.startTime,
      endTime,
      timezone: bookingLink.schedule.timezone,
      eventType: 'MEETING',
      attendees: [{ email: params.bookerEmail, name: params.bookerName }],
    });

    // Link event to booking
    await this.bookingRepo.update(booking.id, {
      calendarEventId: event.id,
    });

    // Auto-confirm if confirmation email is enabled (no manual confirmation required)
    if (bookingLink.confirmationEmailEnabled) {
      await this.bookingRepo.confirm(booking.id);
    }

    logger.info({ bookingId: booking.id, slug }, 'Created booking');

    const createdBooking = await this.bookingRepo.findByIdWithDetails(booking.id);
    if (!createdBooking) {
      throw new CalendarError(CalendarErrorCode.BOOKING_NOT_FOUND, 'Failed to create booking');
    }
    return createdBooking;
  }

  /**
   * Get user's bookings
   */
  async getBookings(filters: BookingFilters): Promise<BookingWithDetails[]> {
    return this.bookingRepo.findByFilters(filters);
  }

  /**
   * Confirm a booking
   */
  async confirmBooking(bookingId: string, userId: string): Promise<BookingWithDetails> {
    const booking = await this.bookingRepo.findById(bookingId);

    if (!booking) {
      throw new CalendarError(CalendarErrorCode.BOOKING_NOT_FOUND, 'Booking not found');
    }

    if (booking.userId !== userId) {
      throw new CalendarError(
        CalendarErrorCode.UNAUTHORIZED_ACCESS,
        'Not authorized to confirm this booking'
      );
    }

    if (booking.status !== 'PENDING') {
      throw new CalendarError(
        CalendarErrorCode.INVALID_BOOKING_STATUS,
        'Only pending bookings can be confirmed'
      );
    }

    await this.bookingRepo.confirm(bookingId);

    const confirmedBooking = await this.bookingRepo.findByIdWithDetails(bookingId);
    if (!confirmedBooking) {
      throw new CalendarError(
        CalendarErrorCode.BOOKING_NOT_FOUND,
        'Booking not found after confirmation'
      );
    }
    return confirmedBooking;
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(
    bookingId: string,
    userId: string | null,
    reason?: string
  ): Promise<BookingWithDetails> {
    const booking = await this.bookingRepo.findById(bookingId);

    if (!booking) {
      throw new CalendarError(CalendarErrorCode.BOOKING_NOT_FOUND, 'Booking not found');
    }

    // Allow cancellation by host or by guest (using booking ID only)
    if (userId && booking.userId !== userId) {
      throw new CalendarError(
        CalendarErrorCode.UNAUTHORIZED_ACCESS,
        'Not authorized to cancel this booking'
      );
    }

    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new CalendarError(
        CalendarErrorCode.INVALID_BOOKING_STATUS,
        'This booking cannot be cancelled'
      );
    }

    await this.bookingRepo.cancel(bookingId, reason);

    // Cancel associated calendar event
    if (booking.calendarEventId) {
      await this.eventRepo.softDelete(booking.calendarEventId);
    }

    logger.info({ bookingId, userId, reason }, 'Cancelled booking');

    const cancelledBooking = await this.bookingRepo.findByIdWithDetails(bookingId);
    if (!cancelledBooking) {
      throw new CalendarError(
        CalendarErrorCode.BOOKING_NOT_FOUND,
        'Booking not found after cancellation'
      );
    }
    return cancelledBooking;
  }

  // ============================================
  // Calendar Sync
  // ============================================

  /**
   * Sync all calendars for a connection
   */
  async syncConnection(connectionId: string): Promise<SyncResult> {
    const connection = await this.connectionRepo.findByIdWithCalendars(connectionId);

    if (!connection) {
      throw new CalendarError(
        CalendarErrorCode.CONNECTION_NOT_FOUND,
        'Calendar connection not found'
      );
    }

    const result: SyncResult = {
      success: true,
      imported: 0,
      updated: 0,
      deleted: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: [],
    };

    const tokens = await this.getValidTokens(connection);
    const calendars = await this.calendarRepo.findEnabledForSync(connectionId);

    for (const calendar of calendars) {
      try {
        const calResult = await this.syncCalendar(connection, calendar, tokens);
        result.eventsCreated += calResult.eventsCreated;
        result.eventsUpdated += calResult.eventsUpdated;
        result.eventsDeleted += calResult.eventsDeleted;
      } catch (error) {
        result.errors.push(
          `Failed to sync ${calendar.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Update last sync time
    await this.connectionRepo.update(connectionId, {
      lastSyncAt: new Date(),
    });

    result.success = result.errors.length === 0;

    return result;
  }

  private async syncCalendar(
    connection: CalendarConnection,
    calendar: { id: string; externalId: string },
    tokens: OAuthTokens
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      imported: 0,
      updated: 0,
      deleted: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: [],
    };

    // Get events from provider (full sync since we don't store per-calendar sync tokens)
    let events: NormalizedEventData[] = [];

    switch (connection.provider) {
      case 'GOOGLE': {
        if (!this.googleService) break;
        const googleResult = await this.googleService.listEvents(tokens, calendar.externalId, {
          showDeleted: true,
        });
        events = googleResult.events;
        break;
      }

      case 'MICROSOFT': {
        if (!this.microsoftService) break;
        const msResult = await this.microsoftService.listEvents(tokens, calendar.externalId, {});
        events = msResult.events;
        break;
      }
    }

    // Process events
    for (const event of events) {
      try {
        const existing = await this.eventRepo.findByExternalId(calendar.id, event.externalId);

        if (event.status === 'cancelled') {
          // Delete event
          if (existing) {
            await this.eventRepo.softDelete(existing.id);
            result.eventsDeleted++;
          }
        } else if (existing) {
          // Update event
          await this.eventRepo.update(existing.id, {
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            timezone: event.timezone ?? existing.timezone,
            meetingUrl: event.meetingUrl,
            attendees: event.attendees,
            lastSyncAt: new Date(),
            etag: event.etag,
          });
          result.eventsUpdated++;
        } else {
          // Create new event
          await this.eventRepo.create({
            userId: connection.userId,
            source: connection.provider, // Use actual provider (GOOGLE, MICROSOFT, APPLE)
            externalCalendarId: calendar.id,
            externalEventId: event.externalId,
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            timezone: event.timezone ?? 'UTC',
            isRecurring: event.isRecurring,
            recurrenceRule: event.recurrenceRule,
            organizerEmail: event.organizerEmail,
            attendees: event.attendees,
            meetingUrl: event.meetingUrl,
            conferenceType: event.conferenceType,
            visibility: event.visibility?.toUpperCase() as
              | 'DEFAULT'
              | 'PUBLIC'
              | 'PRIVATE'
              | 'CONFIDENTIAL',
            lastSyncAt: new Date(),
            etag: event.etag,
          });
          result.eventsCreated++;
        }
      } catch (error) {
        logger.error({ error, eventId: event.externalId }, 'Failed to process event during sync');
      }
    }

    return result;
  }

  // ============================================
  // Helpers
  // ============================================

  private generateOAuthState(userId: string, provider: CalendarProvider): string {
    const data = JSON.stringify({ userId, provider, timestamp: Date.now() });
    return Buffer.from(data).toString('base64url');
  }

  private parseOAuthState(state: string): { userId: string; provider: CalendarProvider } {
    try {
      const data = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
        userId: string;
        provider: CalendarProvider;
      };
      return { userId: data.userId, provider: data.provider };
    } catch {
      throw new CalendarError(
        CalendarErrorCode.INVALID_OAUTH_STATE,
        'Invalid OAuth state parameter'
      );
    }
  }

  private async getValidTokens(connection: CalendarConnection): Promise<OAuthTokens> {
    const now = new Date();
    const expiresAt = connection.tokenExpiresAt;

    // Check if token needs refresh (5 min buffer)
    if (expiresAt && expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      if (!connection.refreshToken) {
        throw new CalendarError(
          CalendarErrorCode.OAUTH_TOKEN_EXPIRED,
          'Token expired and no refresh token available'
        );
      }

      // Refresh token
      let newTokens: OAuthTokens;

      switch (connection.provider) {
        case 'GOOGLE':
          if (!this.googleService)
            throw new CalendarError(
              CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
              'Google not configured'
            );
          newTokens = await this.googleService.refreshToken(connection.refreshToken);
          break;
        case 'MICROSOFT':
          if (!this.microsoftService)
            throw new CalendarError(
              CalendarErrorCode.PROVIDER_NOT_CONFIGURED,
              'Microsoft not configured'
            );
          newTokens = await this.microsoftService.refreshToken(connection.providerAccountId);
          break;
        default:
          throw new CalendarError(
            CalendarErrorCode.INVALID_PROVIDER,
            `Unsupported: ${connection.provider}`
          );
      }

      // Update stored tokens
      await this.connectionRepo.update(connection.id, {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken ?? connection.refreshToken,
        tokenExpiresAt: newTokens.expiresAt,
      });

      return newTokens;
    }

    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.tokenExpiresAt,
      scope: undefined,
      tokenType: 'Bearer',
    };
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/(?:^-)|(?:-$)/g, '');
    const suffix = randomBytes(4).toString('hex');
    return `${base}-${suffix}`;
  }
}
