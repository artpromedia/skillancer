// @ts-nocheck
/**
 * Google Calendar Connector
 *
 * Integration with Google Calendar for scheduling
 */

import { BaseConnector } from './base.connector';
import type {
  OAuthConfig,
  OAuthTokens,
  WidgetDefinition,
  WidgetData,
  IntegrationCategory,
} from './base.connector';
import { ExecutiveType } from '@skillancer/types';

export class GoogleCalendarConnector extends BaseConnector {
  readonly id = 'google-calendar';
  readonly name = 'Google Calendar';
  readonly description = 'Connect to Google Calendar for scheduling and availability';
  readonly category: IntegrationCategory = 'PRODUCTIVITY';
  readonly logoUrl = '/integrations/google-calendar.svg';

  readonly applicableRoles: ExecutiveType[] = [
    'FRACTIONAL_CTO',
    'FRACTIONAL_CFO',
    'FRACTIONAL_CMO',
    'FRACTIONAL_COO',
    'FRACTIONAL_CPO',
    'FRACTIONAL_CHRO',
    'FRACTIONAL_CSO',
    'FRACTIONAL_CISO',
    'BOARD_ADVISOR',
    'STRATEGIC_ADVISOR',
    'TECHNICAL_ADVISOR',
    'OPERATING_PARTNER',
  ];

  readonly oauthConfig: OAuthConfig = {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ],
    scopeSeparator: ' ',
  };

  readonly webhookEnabled = true;

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'gcal-upcoming-meetings',
      name: 'Upcoming Meetings',
      description: 'Your next scheduled meetings',
      refreshInterval: 300, // 5 minutes
      requiredScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      configSchema: {
        type: 'object',
        properties: {
          maxResults: {
            type: 'number',
            default: 5,
            description: 'Number of meetings to show',
          },
          calendarIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Calendar IDs to include',
          },
        },
      },
    },
    {
      id: 'gcal-today-schedule',
      name: "Today's Schedule",
      description: "Full view of today's calendar",
      refreshInterval: 300,
      requiredScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    },
    {
      id: 'gcal-availability',
      name: 'Availability Status',
      description: 'Your current free/busy status',
      refreshInterval: 60,
      requiredScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    },
    {
      id: 'gcal-week-overview',
      name: 'Week Overview',
      description: 'Summary of this week meetings',
      refreshInterval: 900, // 15 minutes
      requiredScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    },
  ];

  /**
   * Generate authorization URL
   */
  getAuthUrl(state: string, scopes?: string[]): string {
    const effectiveScopes = scopes || this.oauthConfig.scopes;
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: effectiveScopes.join(this.oauthConfig.scopeSeparator),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(
      this.oauthConfig.tokenUrl,
      new URLSearchParams({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.getRedirectUri(),
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = response.data;
    if (data.error) {
      throw new Error(`Google OAuth error: ${data.error_description || data.error}`);
    }

    // Get user info
    const userInfo = await this.httpClient.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope?.split(' ') || [],
      providerAccountId: userInfo.data.id,
      providerMetadata: {
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(
      this.oauthConfig.tokenUrl,
      new URLSearchParams({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = response.data;
    if (data.error) {
      throw new Error(`Google token refresh error: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: refreshToken, // Google doesn't always return a new refresh token
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope?.split(' ') || [],
    };
  }

  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    await this.httpClient.post(
      `https://oauth2.googleapis.com/revoke?token=${accessToken}`,
      {},
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
  }

  /**
   * Test connection
   */
  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      const response = await this.httpClient.get(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
          params: { maxResults: 1 },
        }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Fetch data from Google Calendar API
   */
  async fetchData(
    tokens: OAuthTokens,
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const baseUrl = 'https://www.googleapis.com/calendar/v3';
    const response = await this.httpClient.get(`${baseUrl}/${endpoint}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      params,
    });
    return response.data;
  }

  /**
   * Get widget data
   */
  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'gcal-upcoming-meetings':
        return this.getUpcomingMeetingsData(tokens, params);
      case 'gcal-today-schedule':
        return this.getTodayScheduleData(tokens);
      case 'gcal-availability':
        return this.getAvailabilityData(tokens);
      case 'gcal-week-overview':
        return this.getWeekOverviewData(tokens);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  // Private methods for widget data

  private async getUpcomingMeetingsData(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const maxResults = (params?.maxResults as number) || 5;
    const now = new Date();

    const events = (await this.fetchData(tokens, 'calendars/primary/events', {
      timeMin: now.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    })) as {
      items: Array<{
        id: string;
        summary: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        location?: string;
        hangoutLink?: string;
        attendees?: Array<{ email: string; responseStatus: string }>;
      }>;
    };

    const meetings = events.items.map((event) => ({
      id: event.id,
      title: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location,
      meetingLink: event.hangoutLink,
      attendeeCount: event.attendees?.length || 0,
    }));

    return {
      widgetId: 'gcal-upcoming-meetings',
      data: {
        meetings,
        total: meetings.length,
      },
      lastUpdated: new Date(),
    };
  }

  private async getTodayScheduleData(tokens: OAuthTokens): Promise<WidgetData> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const events = (await this.fetchData(tokens, 'calendars/primary/events', {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })) as {
      items: Array<{
        id: string;
        summary: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        location?: string;
        hangoutLink?: string;
        colorId?: string;
      }>;
    };

    const schedule = events.items.map((event) => ({
      id: event.id,
      title: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location,
      meetingLink: event.hangoutLink,
      isAllDay: !event.start.dateTime,
      color: event.colorId,
    }));

    // Calculate busy time
    let busyMinutes = 0;
    for (const event of schedule) {
      if (!event.isAllDay && event.start && event.end) {
        const start = new Date(event.start);
        const end = new Date(event.end);
        busyMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
      }
    }

    return {
      widgetId: 'gcal-today-schedule',
      data: {
        events: schedule,
        totalEvents: schedule.length,
        busyHours: Math.round((busyMinutes / 60) * 10) / 10,
        freeHours: Math.round(((8 * 60 - busyMinutes) / 60) * 10) / 10, // Assuming 8-hour workday
      },
      lastUpdated: new Date(),
    };
  }

  private async getAvailabilityData(tokens: OAuthTokens): Promise<WidgetData> {
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // Next hour

    const freeBusy = (
      await this.httpClient.post(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          timeMin: now.toISOString(),
          timeMax: endTime.toISOString(),
          items: [{ id: 'primary' }],
        },
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      )
    ).data as {
      calendars: {
        primary: { busy: Array<{ start: string; end: string }> };
      };
    };

    const busyPeriods = freeBusy.calendars.primary.busy;
    const isBusy = busyPeriods.length > 0;

    let currentMeeting = null;
    let nextFreeAt = null;

    if (isBusy) {
      // Get current meeting details
      const events = (await this.fetchData(tokens, 'calendars/primary/events', {
        timeMin: now.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 1,
      })) as { items: Array<{ summary: string; end: { dateTime: string } }> };

      if (events.items.length > 0) {
        currentMeeting = {
          title: events.items[0].summary,
          endsAt: events.items[0].end.dateTime,
        };
        nextFreeAt = events.items[0].end.dateTime;
      }
    }

    return {
      widgetId: 'gcal-availability',
      data: {
        status: isBusy ? 'busy' : 'available',
        currentMeeting,
        nextFreeAt,
        busyPeriods: busyPeriods.length,
      },
      lastUpdated: new Date(),
    };
  }

  private async getWeekOverviewData(tokens: OAuthTokens): Promise<WidgetData> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const events = (await this.fetchData(tokens, 'calendars/primary/events', {
      timeMin: startOfWeek.toISOString(),
      timeMax: endOfWeek.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })) as {
      items: Array<{
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
      }>;
    };

    // Group by day
    const dayStats: Record<string, { count: number; busyMinutes: number }> = {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const day of days) {
      dayStats[day] = { count: 0, busyMinutes: 0 };
    }

    for (const event of events.items) {
      const startDate = new Date(event.start.dateTime || event.start.date || '');
      const dayName = days[startDate.getDay()];
      dayStats[dayName].count++;

      if (event.start.dateTime && event.end.dateTime) {
        const start = new Date(event.start.dateTime);
        const end = new Date(event.end.dateTime);
        dayStats[dayName].busyMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
      }
    }

    const weekSummary = Object.entries(dayStats).map(([day, stats]) => ({
      day,
      meetingCount: stats.count,
      busyHours: Math.round((stats.busyMinutes / 60) * 10) / 10,
    }));

    const totalMeetings = events.items.length;
    const totalBusyMinutes = Object.values(dayStats).reduce((sum, s) => sum + s.busyMinutes, 0);

    return {
      widgetId: 'gcal-week-overview',
      data: {
        weekSummary,
        totalMeetings,
        totalBusyHours: Math.round((totalBusyMinutes / 60) * 10) / 10,
        avgMeetingsPerDay: Math.round((totalMeetings / 5) * 10) / 10, // Weekdays only
      },
      lastUpdated: new Date(),
    };
  }

  private getRedirectUri(): string {
    const baseUrl = process.env.INTEGRATION_HUB_URL || 'https://api.skillancer.com/integration-hub';
    return `${baseUrl}/oauth/callback/google-calendar`;
  }
}

export const googleCalendarConnector = new GoogleCalendarConnector();

