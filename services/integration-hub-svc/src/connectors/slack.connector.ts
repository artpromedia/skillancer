// @ts-nocheck
/**
 * Slack Connector
 *
 * Integration with Slack for team communication
 */

import { BaseConnector } from './base.connector';
import type {
  OAuthConfig,
  OAuthTokens,
  WidgetDefinition,
  WidgetData,
  WebhookResult,
  IntegrationCategory,
} from './base.connector';
import { ExecutiveType } from '@skillancer/types';

export class SlackConnector extends BaseConnector {
  readonly id = 'slack';
  readonly name = 'Slack';
  readonly description = 'Connect to Slack for team communication and notifications';
  readonly category: IntegrationCategory = 'COMMUNICATION';
  readonly logoUrl = '/integrations/slack.svg';

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
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    scopes: [
      'channels:read',
      'channels:history',
      'chat:write',
      'users:read',
      'team:read',
      'im:read',
      'im:history',
    ],
    scopeSeparator: ',',
  };

  readonly webhookEnabled = true;

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'slack-channel-activity',
      name: 'Channel Activity',
      description: 'Recent messages in selected channels',
      refreshInterval: 60,
      requiredScopes: ['channels:read', 'channels:history'],
      configSchema: {
        type: 'object',
        properties: {
          channelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Channel IDs to monitor',
          },
          messageLimit: {
            type: 'number',
            default: 10,
            description: 'Number of messages to show',
          },
        },
      },
    },
    {
      id: 'slack-team-presence',
      name: 'Team Presence',
      description: 'See who is online and available',
      refreshInterval: 120,
      requiredScopes: ['users:read'],
    },
    {
      id: 'slack-notifications',
      name: 'Unread Mentions',
      description: 'Your unread mentions and DMs',
      refreshInterval: 30,
      requiredScopes: ['im:read', 'im:history'],
    },
    {
      id: 'slack-quick-message',
      name: 'Quick Message',
      description: 'Send messages to channels or users',
      refreshInterval: 0,
      requiredScopes: ['chat:write'],
    },
  ];

  /**
   * Generate authorization URL
   */
  getAuthUrl(state: string, scopes?: string[]): string {
    const effectiveScopes = scopes || this.oauthConfig.scopes;
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      scope: effectiveScopes.join(this.oauthConfig.scopeSeparator),
      redirect_uri: this.getRedirectUri(),
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
        redirect_uri: this.getRedirectUri(),
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = response.data;
    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || undefined,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scopes: data.scope?.split(',') || [],
      providerAccountId: data.team?.id,
      providerMetadata: {
        teamName: data.team?.name,
        botUserId: data.bot_user_id,
        appId: data.app_id,
      },
    };
  }

  /**
   * Refresh access token (Slack tokens don't typically expire)
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    // Slack access tokens don't expire by default
    // If using token rotation, implement refresh here
    throw new Error('Slack tokens do not require refresh');
  }

  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    await this.httpClient.post(
      'https://slack.com/api/auth.revoke',
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  }

  /**
   * Test connection
   */
  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      const response = await this.httpClient.get('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      return response.data.ok === true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch data from Slack API
   */
  async fetchData(
    tokens: OAuthTokens,
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const url = `https://slack.com/api/${endpoint}`;
    const response = await this.httpClient.get(url, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      params,
    });

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

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
      case 'slack-channel-activity':
        return this.getChannelActivityData(tokens, params);
      case 'slack-team-presence':
        return this.getTeamPresenceData(tokens);
      case 'slack-notifications':
        return this.getNotificationsData(tokens);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(payload: Record<string, unknown>, signature: string): Promise<WebhookResult> {
    // Verify Slack signature
    // Slack uses X-Slack-Signature header with format: v0=hash

    const eventType = (payload.type as string) || 'unknown';
    const event = payload.event as Record<string, unknown> | undefined;

    return {
      eventType,
      data: event || payload,
      integrationId: payload.team_id as string,
      timestamp: new Date(),
    };
  }

  // Private methods for widget data

  private async getChannelActivityData(
    tokens: OAuthTokens,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    const channelIds = (params?.channelIds as string[]) || [];
    const limit = (params?.messageLimit as number) || 10;

    if (channelIds.length === 0) {
      // Get user's channels if none specified
      const channelsResponse = (await this.fetchData(tokens, 'conversations.list', {
        types: 'public_channel,private_channel',
        limit: 5,
      })) as { channels: Array<{ id: string; name: string }> };
      channelIds.push(...channelsResponse.channels.map((c) => c.id));
    }

    const messages: Array<{
      channel: string;
      channelName: string;
      user: string;
      text: string;
      ts: string;
    }> = [];

    for (const channelId of channelIds.slice(0, 5)) {
      try {
        const history = (await this.fetchData(tokens, 'conversations.history', {
          channel: channelId,
          limit,
        })) as { messages: Array<{ user: string; text: string; ts: string }> };

        const channelInfo = (await this.fetchData(tokens, 'conversations.info', {
          channel: channelId,
        })) as { channel: { name: string } };

        messages.push(
          ...history.messages.map((m) => ({
            channel: channelId,
            channelName: channelInfo.channel.name,
            user: m.user,
            text: m.text,
            ts: m.ts,
          }))
        );
      } catch {
        // Skip channels with errors
      }
    }

    return {
      widgetId: 'slack-channel-activity',
      data: {
        messages: messages.slice(0, limit * 2),
        channelCount: channelIds.length,
      },
      lastUpdated: new Date(),
    };
  }

  private async getTeamPresenceData(tokens: OAuthTokens): Promise<WidgetData> {
    const usersResponse = (await this.fetchData(tokens, 'users.list', {
      limit: 50,
    })) as {
      members: Array<{
        id: string;
        name: string;
        real_name: string;
        is_bot: boolean;
        deleted: boolean;
      }>;
    };

    const activeUsers = usersResponse.members.filter((u) => !u.is_bot && !u.deleted);

    const presencePromises = activeUsers.slice(0, 20).map(async (user) => {
      try {
        const presence = (await this.fetchData(tokens, 'users.getPresence', {
          user: user.id,
        })) as { presence: string };
        return {
          id: user.id,
          name: user.real_name || user.name,
          presence: presence.presence,
        };
      } catch {
        return {
          id: user.id,
          name: user.real_name || user.name,
          presence: 'unknown',
        };
      }
    });

    const usersWithPresence = await Promise.all(presencePromises);

    return {
      widgetId: 'slack-team-presence',
      data: {
        users: usersWithPresence,
        online: usersWithPresence.filter((u) => u.presence === 'active').length,
        away: usersWithPresence.filter((u) => u.presence === 'away').length,
        total: usersWithPresence.length,
      },
      lastUpdated: new Date(),
    };
  }

  private async getNotificationsData(tokens: OAuthTokens): Promise<WidgetData> {
    // Get recent DMs and mentions
    const conversations = (await this.fetchData(tokens, 'conversations.list', {
      types: 'im,mpim',
      limit: 10,
    })) as { channels: Array<{ id: string; user: string }> };

    const unreadMessages: Array<{
      channel: string;
      user: string;
      text: string;
      ts: string;
    }> = [];

    for (const conv of conversations.channels.slice(0, 5)) {
      try {
        const history = (await this.fetchData(tokens, 'conversations.history', {
          channel: conv.id,
          limit: 5,
        })) as { messages: Array<{ user: string; text: string; ts: string }> };

        unreadMessages.push(
          ...history.messages.map((m) => ({
            channel: conv.id,
            user: m.user,
            text: m.text,
            ts: m.ts,
          }))
        );
      } catch {
        // Skip on error
      }
    }

    return {
      widgetId: 'slack-notifications',
      data: {
        messages: unreadMessages,
        unreadCount: unreadMessages.length,
      },
      lastUpdated: new Date(),
    };
  }

  private getRedirectUri(): string {
    const baseUrl = process.env.INTEGRATION_HUB_URL || 'https://api.skillancer.com/integration-hub';
    return `${baseUrl}/oauth/callback/slack`;
  }
}

export const slackConnector = new SlackConnector();
