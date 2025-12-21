/**
 * @module @skillancer/cockpit-svc/services/microsoft-calendar
 * Microsoft Calendar (Outlook) API Service
 *
 * Handles OAuth authentication and Microsoft Graph Calendar API operations
 */

import { ConfidentialClientApplication, type AuthorizationUrlRequest } from '@azure/msal-node';
import { Client as GraphClient } from '@microsoft/microsoft-graph-client';
import { createLogger } from '@skillancer/logger';

import { CalendarError, CalendarErrorCode } from '../errors/calendar.errors.js';

import type {
  OAuthTokens,
  OAuthUserInfo,
  ExternalCalendarData,
  NormalizedEventData,
} from '../types/calendar.types.js';

const logger = createLogger({ name: 'microsoft-calendar' });

export interface MicrosoftCalendarConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

interface MicrosoftCalendar {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
  owner?: { address: string };
}

interface MicrosoftEvent {
  id: string;
  subject?: string;
  body?: { content?: string; contentType?: string };
  location?: { displayName?: string };
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  recurrence?: { pattern: unknown; range: unknown };
  seriesMasterId?: string;
  organizer?: { emailAddress?: { address?: string; name?: string } };
  attendees?: Array<{
    emailAddress?: { address?: string; name?: string };
    status?: { response?: string };
  }>;
  onlineMeeting?: { joinUrl?: string };
  onlineMeetingUrl?: string;
  onlineMeetingProvider?: string;
  showAs?: string;
  sensitivity?: string;
  isCancelled?: boolean;
  webLink?: string;
  changeKey?: string;
}

interface CalendarViewResponse {
  value: MicrosoftEvent[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

/** Microsoft Graph User response */
interface MicrosoftUser {
  id: string;
  mail?: string | null;
  displayName?: string | null;
  userPrincipalName?: string;
}

/** Microsoft Graph calendar list response */
interface MicrosoftCalendarListResponse {
  value: MicrosoftCalendar[];
}

export interface CreateMicrosoftEventParams {
  calendarId: string;
  subject: string;
  body?: { content: string; contentType: 'text' | 'html' };
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  attendees?: Array<{ email: string; name?: string }>;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer';
  recurrence?: { pattern: unknown; range: unknown };
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
}

export class MicrosoftCalendarService {
  private readonly config: MicrosoftCalendarConfig;
  private readonly msalClient: ConfidentialClientApplication;

  private readonly scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'Calendars.ReadWrite',
    'User.Read',
  ];

  constructor(config: MicrosoftCalendarConfig) {
    this.config = config;

    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
    });
  }

  /**
   * Create an authenticated Graph client
   */
  private createGraphClient(accessToken: string): GraphClient {
    return GraphClient.init({
      authProvider: (done) => done(null, accessToken),
    });
  }

  /**
   * Generate OAuth authorization URL
   */
  async getAuthorizationUrl(state: string): Promise<string> {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: this.scopes,
      redirectUri: this.config.redirectUri,
      state,
      prompt: 'consent',
    };

    return this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeAuthCode(code: string): Promise<OAuthTokens> {
    try {
      const result = await this.msalClient.acquireTokenByCode({
        code,
        scopes: this.scopes,
        redirectUri: this.config.redirectUri,
      });

      if (!result?.accessToken) {
        throw new CalendarError(
          CalendarErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED,
          'No access token received from Microsoft'
        );
      }

      return {
        accessToken: result.accessToken,
        refreshToken: null, // MSAL handles token refresh internally
        expiresAt: result.expiresOn ?? null,
        scope: result.scopes.join(' '),
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to exchange auth code');

      if (error instanceof CalendarError) throw error;

      throw new CalendarError(
        CalendarErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED,
        'Failed to exchange Microsoft authorization code',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Refresh an access token
   * Note: MSAL handles token caching/refresh internally
   * This method uses the silent token acquisition flow
   */
  async refreshToken(accountId: string): Promise<OAuthTokens> {
    try {
      const accounts = await this.msalClient.getTokenCache().getAllAccounts();
      const account = accounts.find((a) => a.homeAccountId === accountId);

      if (!account) {
        throw new CalendarError(
          CalendarErrorCode.OAUTH_TOKEN_REFRESH_FAILED,
          'Account not found in MSAL cache'
        );
      }

      const result = await this.msalClient.acquireTokenSilent({
        scopes: this.scopes,
        account,
      });

      if (!result?.accessToken) {
        throw new CalendarError(
          CalendarErrorCode.OAUTH_TOKEN_REFRESH_FAILED,
          'No access token received during refresh'
        );
      }

      return {
        accessToken: result.accessToken,
        refreshToken: null,
        expiresAt: result.expiresOn ?? null,
        scope: result.scopes.join(' '),
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error({ error }, 'Failed to refresh token');

      throw new CalendarError(
        CalendarErrorCode.OAUTH_TOKEN_REFRESH_FAILED,
        'Failed to refresh Microsoft access token',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(tokens: OAuthTokens): Promise<OAuthUserInfo> {
    try {
      const client = this.createGraphClient(tokens.accessToken);

      const user = (await client
        .api('/me')
        .select(['id', 'mail', 'displayName', 'userPrincipalName'])
        .get()) as MicrosoftUser;

      return {
        id: user.id,
        email: user.mail ?? user.userPrincipalName ?? '',
        name: user.displayName ?? undefined,
        picture: undefined, // Would require additional photo API call
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get user info');

      throw new CalendarError(
        CalendarErrorCode.EXTERNAL_API_ERROR,
        'Failed to get Microsoft user info',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List user's calendars
   */
  async listCalendars(tokens: OAuthTokens): Promise<ExternalCalendarData[]> {
    try {
      const client = this.createGraphClient(tokens.accessToken);

      const response = (await client
        .api('/me/calendars')
        .select(['id', 'name', 'color', 'isDefaultCalendar', 'canEdit', 'owner'])
        .get()) as MicrosoftCalendarListResponse;

      return (response.value ?? []).map((cal: MicrosoftCalendar) => ({
        id: cal.id,
        name: cal.name ?? 'Unnamed Calendar',
        color: this.mapMicrosoftColor(cal.color),
        isPrimary: cal.isDefaultCalendar ?? false,
        accessRole: cal.canEdit ? 'writer' : 'reader',
        timezone: undefined, // Microsoft calendars don't expose timezone directly
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to list calendars');

      throw new CalendarError(
        CalendarErrorCode.CALENDAR_LIST_FAILED,
        'Failed to list Microsoft calendars',
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
      deltaToken?: string;
    } = {}
  ): Promise<{
    events: NormalizedEventData[];
    nextDeltaToken: string | null;
  }> {
    try {
      const client = this.createGraphClient(tokens.accessToken);

      let apiPath: string;
      const events: NormalizedEventData[] = [];
      let nextDeltaToken: string | null = null;

      if (options.deltaToken) {
        // Use delta query for incremental sync
        apiPath = options.deltaToken;
      } else {
        // Use calendarView for initial sync
        const startDateTime = (options.timeMin ?? new Date()).toISOString();
        const endDateTime = (
          options.timeMax ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        ).toISOString();

        apiPath = `/me/calendars/${calendarId}/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}`;
      }

      let response: CalendarViewResponse = (await client
        .api(apiPath)
        .top(options.maxResults ?? 250)
        .get()) as CalendarViewResponse;

      // Process events
      for (const event of response.value ?? []) {
        events.push(this.mapEventToExternalData(event));
      }

      // Handle pagination
      while (response['@odata.nextLink']) {
        response = (await client.api(response['@odata.nextLink']).get()) as CalendarViewResponse;
        for (const event of response.value ?? []) {
          events.push(this.mapEventToExternalData(event));
        }
      }

      // Extract delta token for future sync
      if (response['@odata.deltaLink']) {
        nextDeltaToken = response['@odata.deltaLink'];
      }

      return { events, nextDeltaToken };
    } catch (error) {
      logger.error({ error, calendarId }, 'Failed to list events');

      throw new CalendarError(
        CalendarErrorCode.EVENT_FETCH_FAILED,
        'Failed to list Microsoft calendar events',
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
      const client = this.createGraphClient(tokens.accessToken);

      const event = (await client
        .api(`/me/calendars/${calendarId}/events/${eventId}`)
        .get()) as MicrosoftEvent;

      return this.mapEventToExternalData(event);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      logger.error({ error, calendarId, eventId }, 'Failed to get event');

      throw new CalendarError(
        CalendarErrorCode.EVENT_FETCH_FAILED,
        'Failed to get Microsoft calendar event',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Create a calendar event
   */
  async createEvent(
    tokens: OAuthTokens,
    params: CreateMicrosoftEventParams
  ): Promise<NormalizedEventData> {
    try {
      const client = this.createGraphClient(tokens.accessToken);

      const requestBody: Record<string, unknown> = {
        subject: params.subject,
        start: params.start,
        end: params.end,
        isAllDay: params.isAllDay ?? false,
      };

      if (params.body) {
        requestBody.body = params.body;
      }

      if (params.location) {
        requestBody.location = { displayName: params.location };
      }

      if (params.attendees) {
        requestBody.attendees = params.attendees.map((a) => ({
          emailAddress: { address: a.email, name: a.name },
          type: 'required',
        }));
      }

      if (params.isOnlineMeeting) {
        requestBody.isOnlineMeeting = true;
        requestBody.onlineMeetingProvider = params.onlineMeetingProvider ?? 'teamsForBusiness';
      }

      if (params.recurrence) {
        requestBody.recurrence = params.recurrence;
      }

      if (params.showAs) {
        requestBody.showAs = params.showAs;
      }

      if (params.sensitivity) {
        requestBody.sensitivity = params.sensitivity;
      }

      const event = (await client
        .api(`/me/calendars/${params.calendarId}/events`)
        .post(requestBody)) as MicrosoftEvent;

      return this.mapEventToExternalData(event);
    } catch (error) {
      logger.error({ error, params }, 'Failed to create event');

      throw new CalendarError(
        CalendarErrorCode.EVENT_CREATE_FAILED,
        'Failed to create Microsoft calendar event',
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
    updates: Partial<CreateMicrosoftEventParams>
  ): Promise<NormalizedEventData> {
    try {
      const client = this.createGraphClient(tokens.accessToken);

      const requestBody: Record<string, unknown> = {};

      if (updates.subject !== undefined) requestBody.subject = updates.subject;
      if (updates.body !== undefined) requestBody.body = updates.body;
      if (updates.location !== undefined) {
        requestBody.location = { displayName: updates.location };
      }
      if (updates.start !== undefined) requestBody.start = updates.start;
      if (updates.end !== undefined) requestBody.end = updates.end;
      if (updates.isAllDay !== undefined) requestBody.isAllDay = updates.isAllDay;
      if (updates.attendees !== undefined) {
        requestBody.attendees = updates.attendees.map((a) => ({
          emailAddress: { address: a.email, name: a.name },
          type: 'required',
        }));
      }
      if (updates.isOnlineMeeting !== undefined) {
        requestBody.isOnlineMeeting = updates.isOnlineMeeting;
      }
      if (updates.recurrence !== undefined) {
        requestBody.recurrence = updates.recurrence;
      }
      if (updates.showAs !== undefined) requestBody.showAs = updates.showAs;
      if (updates.sensitivity !== undefined) {
        requestBody.sensitivity = updates.sensitivity;
      }

      const event = (await client
        .api(`/me/calendars/${calendarId}/events/${eventId}`)
        .patch(requestBody)) as MicrosoftEvent;

      return this.mapEventToExternalData(event);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new CalendarError(
          CalendarErrorCode.EXTERNAL_EVENT_NOT_FOUND,
          'Event not found in Microsoft Calendar'
        );
      }

      logger.error({ error, calendarId, eventId }, 'Failed to update event');

      throw new CalendarError(
        CalendarErrorCode.EVENT_UPDATE_FAILED,
        'Failed to update Microsoft calendar event',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(tokens: OAuthTokens, calendarId: string, eventId: string): Promise<void> {
    try {
      const client = this.createGraphClient(tokens.accessToken);

      await client.api(`/me/calendars/${calendarId}/events/${eventId}`).delete();
    } catch (error) {
      if (this.isNotFoundError(error)) {
        // Event already deleted
        return;
      }

      logger.error({ error, calendarId, eventId }, 'Failed to delete event');

      throw new CalendarError(
        CalendarErrorCode.EVENT_DELETE_FAILED,
        'Failed to delete Microsoft calendar event',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Map Microsoft Calendar event to NormalizedEventData
   */
  private mapEventToExternalData(event: MicrosoftEvent): NormalizedEventData {
    let startTime: Date;
    let endTime: Date;
    const isAllDay = event.isAllDay ?? false;

    if (event.start?.dateTime) {
      startTime = new Date(event.start.dateTime);
      endTime = new Date(event.end?.dateTime ?? event.start.dateTime);
    } else {
      startTime = new Date();
      endTime = new Date();
    }

    // Extract meeting URL
    let meetingUrl: string | null = null;
    let conferenceType: string | null = null;

    if (event.onlineMeeting?.joinUrl) {
      meetingUrl = event.onlineMeeting.joinUrl;
      conferenceType = event.onlineMeetingProvider ?? 'Teams';
    } else if (event.onlineMeetingUrl) {
      meetingUrl = event.onlineMeetingUrl;
      conferenceType = 'online';
    }

    // Map attendees
    const attendees = (event.attendees ?? []).map((a) => ({
      email: a.emailAddress?.address ?? '',
      name: a.emailAddress?.name ?? null,
      status: this.mapAttendeeStatus(a.status?.response),
    }));

    // Determine status
    let status: 'confirmed' | 'tentative' | 'cancelled' = 'confirmed';
    if (event.isCancelled) {
      status = 'cancelled';
    } else if (event.showAs === 'tentative') {
      status = 'tentative';
    }

    // Map visibility
    let visibility: 'default' | 'public' | 'private' | 'confidential' = 'default';
    if (event.sensitivity === 'private') visibility = 'private';
    if (event.sensitivity === 'confidential') visibility = 'confidential';

    return {
      id: event.id,
      externalId: event.id,
      title: event.subject ?? 'Untitled Event',
      description: event.body?.content ?? null,
      location: event.location?.displayName ?? null,
      startTime,
      endTime,
      isAllDay,
      timezone: event.start?.timeZone ?? null,
      isRecurring: !!event.seriesMasterId || !!event.recurrence,
      recurrenceRule: event.recurrence ? JSON.stringify(event.recurrence) : null,
      organizerEmail: event.organizer?.emailAddress?.address ?? null,
      attendees,
      meetingUrl,
      conferenceType,
      status,
      visibility,
      etag: event.changeKey ?? undefined,
    };
  }

  /**
   * Map Microsoft Calendar color presets
   */
  private mapMicrosoftColor(color: string | undefined): string | null {
    const colorMap: Record<string, string> = {
      auto: '#0078D4',
      lightBlue: '#0078D4',
      lightGreen: '#107C10',
      lightOrange: '#FF8C00',
      lightGray: '#737373',
      lightYellow: '#FCE100',
      lightTeal: '#00B294',
      lightPink: '#E3008C',
      lightBrown: '#8E562E',
      lightRed: '#D13438',
    };

    return color ? (colorMap[color] ?? color) : null;
  }

  /**
   * Map Microsoft attendee response status
   */
  private mapAttendeeStatus(
    response: string | undefined
  ): 'needsAction' | 'declined' | 'tentative' | 'accepted' {
    switch (response) {
      case 'accepted':
        return 'accepted';
      case 'declined':
        return 'declined';
      case 'tentativelyAccepted':
        return 'tentative';
      default:
        return 'needsAction';
    }
  }

  /**
   * Check if error is a 404 not found
   */
  private isNotFoundError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      (error as Record<string, unknown>).statusCode === 404
    );
  }
}
