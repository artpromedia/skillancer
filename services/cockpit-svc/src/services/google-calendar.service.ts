/**
 * @module @skillancer/cockpit-svc/services/google-calendar
 * Google Calendar API Service
 *
 * Handles OAuth authentication and Google Calendar API operations
 */

import { createLogger } from '@skillancer/logger';
import { google, type calendar_v3 } from 'googleapis';

import { CalendarError, CalendarErrorCode } from '../errors/calendar.errors.js';

import type {
  OAuthTokens,
  OAuthUserInfo,
  ExternalCalendarData,
  NormalizedEventData,
} from '../types/calendar.types.js';
import type { OAuth2Client } from 'google-auth-library';

const logger = createLogger({ name: 'google-calendar' });

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface CreateGoogleEventParams {
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  conferenceDataVersion?: 0 | 1;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
  recurrence?: string[];
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: 'email' | 'popup'; minutes: number }>;
  };
  visibility?: 'default' | 'public' | 'private' | 'confidential';
}

export class GoogleCalendarService {
  private readonly config: GoogleCalendarConfig;

  constructor(config: GoogleCalendarConfig) {
    this.config = config;
  }

  /**
   * Create an OAuth2 client instance
   */
  private createOAuth2Client(): OAuth2Client {
    return new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
  }

  /**
   * Create an authenticated OAuth2 client
   */
  private createAuthenticatedClient(tokens: OAuthTokens): OAuth2Client {
    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiresAt?.getTime(),
    });
    return oauth2Client;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const oauth2Client = this.createOAuth2Client();

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      state,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeAuthCode(code: string): Promise<OAuthTokens> {
    try {
      const oauth2Client = this.createOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new CalendarError(
          CalendarErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED,
          'No access token received from Google'
        );
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope ?? null,
        tokenType: tokens.token_type ?? 'Bearer',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to exchange auth code');

      if (error instanceof CalendarError) throw error;

      throw new CalendarError(
        CalendarErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED,
        'Failed to exchange authorization code',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Refresh an access token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    try {
      const oauth2Client = this.createOAuth2Client();
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new CalendarError(
          CalendarErrorCode.OAUTH_TOKEN_REFRESH_FAILED,
          'No access token received during refresh'
        );
      }

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token ?? refreshToken,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        scope: credentials.scope ?? null,
        tokenType: credentials.token_type ?? 'Bearer',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to refresh token');

      throw new CalendarError(
        CalendarErrorCode.OAUTH_TOKEN_REFRESH_FAILED,
        'Failed to refresh access token',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      const oauth2Client = this.createOAuth2Client();
      await oauth2Client.revokeToken(accessToken);
    } catch (error) {
      logger.warn({ error }, 'Failed to revoke token');
      // Don't throw - revocation failure shouldn't block disconnection
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo> {
    try {
      const oauth2Client = this.createAuthenticatedClient(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });

      const { data } = await oauth2.userinfo.get();

      if (!data.id || !data.email) {
        throw new CalendarError(
          CalendarErrorCode.EXTERNAL_API_ERROR,
          'Invalid user info response from Google'
        );
      }

      return {
        id: data.id,
        email: data.email,
        name: data.name ?? undefined,
        picture: data.picture ?? undefined,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get user info');

      if (error instanceof CalendarError) throw error;

      throw new CalendarError(
        CalendarErrorCode.EXTERNAL_API_ERROR,
        'Failed to get Google user info',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List user's calendars
   */
  async listCalendars(tokens: OAuthTokens): Promise<ExternalCalendarData[]> {
    try {
      const oauth2Client = this.createAuthenticatedClient(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const { data } = await calendar.calendarList.list();

      return (data.items ?? [])
        .filter((cal) => cal.id != null)
        .map((cal) => ({
          id: cal.id as string,
          name: cal.summary ?? 'Unnamed Calendar',
          color: cal.backgroundColor ?? null,
          isPrimary: cal.primary ?? false,
          accessRole: this.mapAccessRole(cal.accessRole),
          timezone: cal.timeZone ?? undefined,
        }));
    } catch (error) {
      logger.error({ error }, 'Failed to list calendars');

      throw new CalendarError(
        CalendarErrorCode.CALENDAR_LIST_FAILED,
        'Failed to list Google calendars',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List events from a calendar
   */
  async listEvents(
    tokens: OAuthTokens,
    calendarId: string,
    options: {
      timeMin?: Date;
      timeMax?: Date;
      maxResults?: number;
      syncToken?: string;
      showDeleted?: boolean;
    } = {}
  ): Promise<{
    events: NormalizedEventData[];
    nextSyncToken: string | null;
  }> {
    try {
      const oauth2Client = this.createAuthenticatedClient(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: options.maxResults ?? 250,
        showDeleted: options.showDeleted ?? false,
      };

      if (options.syncToken) {
        params.syncToken = options.syncToken;
      } else {
        if (options.timeMin) params.timeMin = options.timeMin.toISOString();
        if (options.timeMax) params.timeMax = options.timeMax.toISOString();
      }

      const { data } = await calendar.events.list(params);

      const events = (data.items ?? []).map((event) => this.mapEventToExternalData(event));

      return {
        events,
        nextSyncToken: data.nextSyncToken ?? null,
      };
    } catch (error) {
      logger.error({ error, calendarId }, 'Failed to list events');

      // Check for sync token expired
      if (this.isGoogleError(error) && error.code === 410) {
        throw new CalendarError(
          CalendarErrorCode.SYNC_TOKEN_EXPIRED,
          'Sync token expired, full sync required'
        );
      }

      throw new CalendarError(
        CalendarErrorCode.EVENT_FETCH_FAILED,
        'Failed to list Google calendar events',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get a single event
   */
  async getEvent(
    tokens: OAuthTokens,
    calendarId: string,
    eventId: string
  ): Promise<NormalizedEventData | null> {
    try {
      const oauth2Client = this.createAuthenticatedClient(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const { data } = await calendar.events.get({
        calendarId,
        eventId,
      });

      return this.mapEventToExternalData(data);
    } catch (error) {
      if (this.isGoogleError(error) && error.code === 404) {
        return null;
      }

      logger.error({ error, calendarId, eventId }, 'Failed to get event');

      throw new CalendarError(
        CalendarErrorCode.EVENT_FETCH_FAILED,
        'Failed to get Google calendar event',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Create a calendar event
   */
  async createEvent(
    tokens: OAuthTokens,
    params: CreateGoogleEventParams
  ): Promise<NormalizedEventData> {
    try {
      const oauth2Client = this.createAuthenticatedClient(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const requestBody: calendar_v3.Schema$Event = {
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: params.start,
        end: params.end,
        attendees: params.attendees,
        recurrence: params.recurrence,
        reminders: params.reminders,
        visibility: params.visibility,
      };

      // Add conference data for Google Meet
      if (params.conferenceDataVersion === 1) {
        requestBody.conferenceData = {
          createRequest: {
            requestId: `skillancer-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const { data } = await calendar.events.insert({
        calendarId: params.calendarId,
        requestBody,
        conferenceDataVersion: params.conferenceDataVersion,
        sendUpdates: params.sendUpdates ?? 'none',
      });

      return this.mapEventToExternalData(data);
    } catch (error) {
      logger.error({ error, params }, 'Failed to create event');

      throw new CalendarError(
        CalendarErrorCode.EVENT_CREATE_FAILED,
        'Failed to create Google calendar event',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Update a calendar event
   */
  async updateEvent(
    tokens: OAuthTokens,
    calendarId: string,
    eventId: string,
    updates: Partial<CreateGoogleEventParams>
  ): Promise<NormalizedEventData> {
    try {
      const oauth2Client = this.createAuthenticatedClient(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const requestBody: calendar_v3.Schema$Event = {};

      if (updates.summary !== undefined) requestBody.summary = updates.summary;
      if (updates.description !== undefined) requestBody.description = updates.description;
      if (updates.location !== undefined) requestBody.location = updates.location;
      if (updates.start !== undefined) requestBody.start = updates.start;
      if (updates.end !== undefined) requestBody.end = updates.end;
      if (updates.attendees !== undefined) requestBody.attendees = updates.attendees;
      if (updates.recurrence !== undefined) requestBody.recurrence = updates.recurrence;
      if (updates.reminders !== undefined) requestBody.reminders = updates.reminders;
      if (updates.visibility !== undefined) requestBody.visibility = updates.visibility;

      const { data } = await calendar.events.patch({
        calendarId,
        eventId,
        requestBody,
        sendUpdates: updates.sendUpdates ?? 'none',
      });

      return this.mapEventToExternalData(data);
    } catch (error) {
      logger.error({ error, calendarId, eventId }, 'Failed to update event');

      if (this.isGoogleError(error) && error.code === 404) {
        throw new CalendarError(
          CalendarErrorCode.EXTERNAL_EVENT_NOT_FOUND,
          'Event not found in Google Calendar'
        );
      }

      throw new CalendarError(
        CalendarErrorCode.EVENT_UPDATE_FAILED,
        'Failed to update Google calendar event',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    tokens: OAuthTokens,
    calendarId: string,
    eventId: string,
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'none'
  ): Promise<void> {
    try {
      const oauth2Client = this.createAuthenticatedClient(tokens);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates,
      });
    } catch (error) {
      if (this.isGoogleError(error) && error.code === 404) {
        // Event already deleted
        return;
      }

      logger.error({ error, calendarId, eventId }, 'Failed to delete event');

      throw new CalendarError(
        CalendarErrorCode.EVENT_DELETE_FAILED,
        'Failed to delete Google calendar event',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Map Google Calendar event to NormalizedEventData
   */
  private mapEventToExternalData(event: calendar_v3.Schema$Event): NormalizedEventData {
    let startTime: Date;
    let endTime: Date;
    let isAllDay = false;

    if (event.start?.date) {
      // All-day event
      isAllDay = true;
      startTime = new Date(event.start.date);
      endTime = new Date(event.end?.date ?? event.start.date);
    } else {
      startTime = new Date(event.start?.dateTime ?? new Date());
      endTime = new Date(event.end?.dateTime ?? new Date());
    }

    // Extract meeting URL from conference data
    let meetingUrl: string | null = null;
    let conferenceType: string | null = null;

    if (event.conferenceData?.entryPoints) {
      const videoEntry = event.conferenceData.entryPoints.find((e) => e.entryPointType === 'video');
      if (videoEntry) {
        meetingUrl = videoEntry.uri ?? null;
        conferenceType = event.conferenceData.conferenceSolution?.name ?? 'video';
      }
    } else if (event.hangoutLink) {
      meetingUrl = event.hangoutLink;
      conferenceType = 'Google Meet';
    }

    return {
      id: event.id ?? '',
      externalId: event.id ?? '',
      title: event.summary ?? 'Untitled Event',
      description: event.description ?? null,
      location: event.location ?? null,
      startTime,
      endTime,
      isAllDay,
      timezone: event.start?.timeZone ?? undefined,
      isRecurring: !!event.recurringEventId,
      recurrenceRule: event.recurrence?.[0] ?? null,
      organizerEmail: event.organizer?.email ?? null,
      attendees: (event.attendees ?? [])
        .filter((a) => a.email != null)
        .map((a) => ({
          email: a.email as string,
          name: a.displayName ?? null,
          status: a.responseStatus ?? 'needsAction',
        })),
      meetingUrl,
      conferenceType,
      status: this.mapEventStatus(event.status),
      visibility:
        (event.visibility as 'default' | 'public' | 'private' | 'confidential') ?? 'default',
      etag: event.etag ?? undefined,
    };
  }

  /**
   * Map Google Calendar access role
   */
  private mapAccessRole(
    role: string | null | undefined
  ): 'freeBusyReader' | 'reader' | 'writer' | 'owner' {
    switch (role) {
      case 'freeBusyReader':
        return 'freeBusyReader';
      case 'reader':
        return 'reader';
      case 'writer':
        return 'writer';
      case 'owner':
        return 'owner';
      default:
        return 'reader';
    }
  }

  /**
   * Map Google Calendar event status
   */
  private mapEventStatus(
    status: string | null | undefined
  ): 'confirmed' | 'tentative' | 'cancelled' {
    switch (status) {
      case 'confirmed':
        return 'confirmed';
      case 'tentative':
        return 'tentative';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'confirmed';
    }
  }

  /**
   * Type guard for Google API errors
   */
  private isGoogleError(error: unknown): error is { code: number; message: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as Record<string, unknown>).code === 'number'
    );
  }
}
