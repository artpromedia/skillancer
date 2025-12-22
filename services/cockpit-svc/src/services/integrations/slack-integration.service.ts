/**
 * @module @skillancer/cockpit-svc/services/integrations/slack
 * Slack Integration Service - Slash commands, notifications, and interactive components
 */

import crypto from 'node:crypto';

import { BaseIntegrationService, type RateLimitConfig } from './base-integration.service.js';

import type {
  OAuthConfig,
  OAuthTokens,
  ApiKeyConfig,
  SyncOptions,
  SyncResult,
  AccountInfo,
  WebhookPayload,
} from '../../types/integration.types.js';
import type { EncryptionService } from '../encryption.service.js';
import type { Integration, IntegrationProvider, PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// ============================================================================
// Types
// ============================================================================

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: SlackBlockElement[];
  fields?: Array<{ type: string; text: string }>;
  accessory?: SlackBlockElement;
}

interface SlackBlockElement {
  type: string;
  text?: { type: string; text: string };
  action_id?: string;
  url?: string;
  style?: string;
  value?: string;
}

interface SlackAttachment {
  color?: string;
  fallback?: string;
  text?: string;
}

export interface SlackSlashCommand {
  command: string;
  text: string;
  user_id: string;
  user_name: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  response_url: string;
  trigger_id: string;
}

export interface SlackCommandResponse {
  response_type: 'ephemeral' | 'in_channel';
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

export interface SlackInteractionPayload {
  type: string;
  user: { id: string; name: string };
  team: { id: string };
  actions: Array<{ action_id: string; value?: string }>;
  trigger_id: string;
  response_url: string;
}

interface SlackSettings {
  notificationChannel?: string;
  notifyOnPayment?: boolean;
  notifyOnInvoice?: boolean;
  notifyOnProject?: boolean;
  notifyOnDeadline?: boolean;
}

interface SlackAuthResponse {
  ok: boolean;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  team: { id: string; name: string };
  authed_user: { id: string };
  error?: string;
}

// ============================================================================
// Slack Integration Service
// ============================================================================

export class SlackIntegrationService extends BaseIntegrationService {
  private readonly BASE_URL = 'https://slack.com/api';
  private readonly OAUTH_URL = 'https://slack.com/oauth/v2/authorize';
  private readonly TOKEN_URL = 'https://slack.com/api/oauth.v2.access';

  constructor(prisma: PrismaClient, logger: Logger, encryption: EncryptionService) {
    super(prisma, logger, encryption);
  }

  // ============================================================================
  // Provider Info
  // ============================================================================

  get provider(): IntegrationProvider {
    return 'SLACK';
  }

  get displayName(): string {
    return 'Slack';
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  getOAuthConfig(): OAuthConfig | null {
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      authorizationUrl: this.OAUTH_URL,
      tokenUrl: this.TOKEN_URL,
      clientId,
      clientSecret,
      scopes: [
        'channels:read',
        'channels:history',
        'chat:write',
        'commands',
        'users:read',
        'users:read.email',
        'incoming-webhook',
      ],
    };
  }

  getApiKeyConfig(): ApiKeyConfig | null {
    // Slack requires OAuth
    return null;
  }

  getRateLimitConfig(): RateLimitConfig {
    return {
      maxRequests: 50,
      windowMs: 60 * 1000, // 50 requests per minute
    };
  }

  // ============================================================================
  // OAuth Methods
  // ============================================================================

  getOAuthUrl(userId: string, state: string, redirectUri: string): string {
    const config = this.getOAuthConfig();
    if (!config) {
      throw this.createError('CONFIG_ERROR', 'Slack OAuth not configured');
    }

    const scopes = config.scopes.join(',');
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
      user_scope: 'users:read',
    });

    return `${this.OAUTH_URL}?${params.toString()}`;
  }

  async exchangeAuthCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw this.createError('CONFIG_ERROR', 'Slack OAuth not configured');
    }

    const params = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = (await response.json()) as SlackAuthResponse;

    if (!data.ok) {
      this.logger.error({ error: data.error }, 'Slack OAuth exchange failed');
      throw this.createError('OAUTH_ERROR', data.error ?? 'OAuth exchange failed');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();
    if (!config) {
      throw this.createError('CONFIG_ERROR', 'Slack OAuth not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch(`${this.BASE_URL}/oauth.v2.access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = (await response.json()) as SlackAuthResponse;

    if (!data.ok) {
      throw this.createError('REFRESH_ERROR', data.error ?? 'Token refresh failed');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async revokeAccess(accessToken: string): Promise<void> {
    await fetch(`${this.BASE_URL}/auth.revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  // ============================================================================
  // API Key Methods
  // ============================================================================

  // eslint-disable-next-line @typescript-eslint/require-await
  async validateApiKey(_apiKey: string, _apiSecret?: string): Promise<boolean> {
    throw this.createError('UNSUPPORTED', 'Slack requires OAuth authentication');
  }

  // ============================================================================
  // Account Info
  // ============================================================================

  async getAccountInfo(integration: Integration): Promise<AccountInfo> {
    const authResponse = await this.makeRequest<{
      ok: boolean;
      team_id: string;
      team: string;
      user_id: string;
      bot_user_id?: string;
      enterprise_id?: string;
      error?: string;
    }>(integration, 'GET', `${this.BASE_URL}/auth.test`);

    if (!authResponse.data.ok) {
      throw this.createError('AUTH_ERROR', authResponse.data.error ?? 'Auth test failed');
    }

    return {
      id: authResponse.data.team_id,
      name: authResponse.data.team,
      metadata: {
        user_id: authResponse.data.user_id,
        bot_user_id: authResponse.data.bot_user_id,
        enterprise_id: authResponse.data.enterprise_id,
      },
    };
  }

  // ============================================================================
  // Sync Methods
  // ============================================================================

  getSupportedSyncTypes(): string[] {
    // Slack is event-driven, minimal sync needed
    return ['connection_status'];
  }

  async sync(integration: Integration, options: SyncOptions): Promise<SyncResult> {
    const context = await this.createSyncContext(integration, options);

    try {
      // Slack doesn't need traditional sync - just verify connection
      await this.getAccountInfo(integration);
      return await this.completeSyncContext(context, true);
    } catch (error) {
      context.errors.push({
        message: (error as Error).message,
        entity: 'connection',
      });
      context.recordsFailed++;
      return await this.completeSyncContext(context, false);
    }
  }

  // ============================================================================
  // Slack API Methods
  // ============================================================================

  async listChannels(integration: Integration): Promise<SlackChannel[]> {
    const response = await this.makeRequest<{
      ok: boolean;
      channels: SlackChannel[];
      error?: string;
    }>(
      integration,
      'GET',
      `${this.BASE_URL}/conversations.list?types=public_channel,private_channel&limit=200`
    );

    if (!response.data.ok) {
      throw this.createError('API_ERROR', response.data.error ?? 'Failed to list channels');
    }

    return response.data.channels;
  }

  async sendMessage(
    integration: Integration,
    channelId: string,
    message: SlackMessage
  ): Promise<string> {
    const response = await this.makeRequest<{
      ok: boolean;
      ts: string;
      error?: string;
    }>(integration, 'POST', `${this.BASE_URL}/chat.postMessage`, {
      body: {
        channel: channelId,
        text: message.text,
        blocks: message.blocks,
        attachments: message.attachments,
        thread_ts: message.thread_ts,
        unfurl_links: false,
        unfurl_media: false,
      },
    });

    if (!response.data.ok) {
      throw this.createError('SEND_ERROR', response.data.error ?? 'Failed to send message');
    }

    return response.data.ts;
  }

  async sendNotification(
    integration: Integration,
    notification: {
      type: string;
      title: string;
      message: string;
      url?: string;
      color?: string;
    }
  ): Promise<void> {
    const settings = integration.syncOptions as SlackSettings | null;

    if (!settings?.notificationChannel) {
      this.logger.debug('No notification channel configured, skipping');
      return;
    }

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: notification.title,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.message,
        },
      },
    ];

    if (notification.url) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
            },
            url: notification.url,
            action_id: 'view_details',
          },
        ],
      });
    }

    await this.sendMessage(integration, settings.notificationChannel, {
      text: notification.title,
      blocks,
      attachments: [
        {
          color: notification.color ?? '#3B82F6',
          fallback: notification.message,
        },
      ],
    });
  }

  // ============================================================================
  // Slash Command Handlers
  // ============================================================================

  async handleSlashCommand(
    integration: Integration,
    command: SlackSlashCommand
  ): Promise<SlackCommandResponse> {
    const [action = '', ...args] = command.text.split(' ');

    switch (command.command) {
      case '/skillancer':
        return this.handleSkillancerCommand(integration, action, args);

      case '/timer':
        return this.handleTimerCommand(action, args);

      default:
        return {
          response_type: 'ephemeral',
          text: 'Unknown command. Use `/skillancer help` for available commands.',
        };
    }
  }

  private async handleSkillancerCommand(
    integration: Integration,
    action: string,
    _args: string[]
  ): Promise<SlackCommandResponse> {
    switch (action) {
      case 'status':
        return this.getStatusResponse(integration);

      case 'projects':
        return this.getProjectsResponse(integration);

      case 'help':
      default:
        return this.getHelpResponse();
    }
  }

  private handleTimerCommand(action: string, args: string[]): SlackCommandResponse {
    switch (action) {
      case 'start':
        return this.startTimerResponse(args.join(' '));

      case 'stop':
        return this.stopTimerResponse();

      case 'status':
        return this.getTimerStatusResponse();

      case 'log':
        return this.logTimeResponse(args);

      default:
        return {
          response_type: 'ephemeral',
          text: 'Usage: `/timer start [description]`, `/timer stop`, `/timer status`, `/timer log [hours] [description]`',
        };
    }
  }

  private startTimerResponse(description: string): SlackCommandResponse {
    // Note: Actual timer logic would integrate with TimeTrackingService
    return {
      response_type: 'in_channel',
      text: `⏱️ Timer started: ${description || 'No description'}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⏱️ *Timer Started*\n${description || '_No description_'}`,
          },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Stop' },
            action_id: 'stop_timer',
            style: 'danger',
          },
        },
      ],
    };
  }

  private stopTimerResponse(): SlackCommandResponse {
    // Note: Actual timer logic would integrate with TimeTrackingService
    return {
      response_type: 'in_channel',
      text: '⏹️ Timer stopped',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '⏹️ *Timer Stopped*\nDuration: *0h 0m*',
          },
        },
      ],
    };
  }

  private getTimerStatusResponse(): SlackCommandResponse {
    return {
      response_type: 'ephemeral',
      text: 'No active timer. Use `/timer start [description]` to begin tracking.',
    };
  }

  private logTimeResponse(args: string[]): SlackCommandResponse {
    if (args.length < 2) {
      return {
        response_type: 'ephemeral',
        text: 'Usage: `/timer log [hours] [description]`\nExample: `/timer log 2.5 Client meeting`',
      };
    }

    const hoursStr = args[0];
    if (!hoursStr) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide the number of hours.',
      };
    }

    const hours = Number.parseFloat(hoursStr);
    if (Number.isNaN(hours) || hours <= 0) {
      return {
        response_type: 'ephemeral',
        text: 'Invalid hours. Please enter a positive number.',
      };
    }

    const description = args.slice(1).join(' ');

    return {
      response_type: 'in_channel',
      text: `✅ Logged ${hours} hours: ${description}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async getStatusResponse(_integration: Integration): Promise<SlackCommandResponse> {
    // Note: Would integrate with ProjectService and TimeTrackingService
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📊 Your Skillancer Status' },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: '*Active Projects*\n0' },
            { type: 'mrkdwn', text: '*Hours This Month*\n0.0' },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open Dashboard' },
              url: `${process.env.APP_URL ?? 'https://skillancer.com'}/cockpit`,
            },
          ],
        },
      ],
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async getProjectsResponse(_integration: Integration): Promise<SlackCommandResponse> {
    // Note: Would integrate with ProjectService
    return {
      response_type: 'ephemeral',
      text: 'No active projects found.',
    };
  }

  private getHelpResponse(): SlackCommandResponse {
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🚀 Skillancer Commands' },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*General Commands*
• \`/skillancer status\` - View your dashboard summary
• \`/skillancer projects\` - List active projects
• \`/skillancer help\` - Show this help message

*Timer Commands*
• \`/timer start [description]\` - Start a timer
• \`/timer stop\` - Stop the active timer
• \`/timer status\` - Check timer status
• \`/timer log [hours] [description]\` - Log time manually`,
          },
        },
      ],
    };
  }

  // ============================================================================
  // Interactive Component Handlers
  // ============================================================================

  // eslint-disable-next-line @typescript-eslint/require-await
  async handleInteractiveAction(
    _integration: Integration,
    payload: SlackInteractionPayload
  ): Promise<SlackCommandResponse | null> {
    const action = payload.actions[0];

    if (!action) {
      return null;
    }

    switch (action.action_id) {
      case 'stop_timer':
        return this.stopTimerResponse();

      case 'view_details':
        // Just acknowledge - the button opens a URL
        return null;

      default:
        this.logger.debug({ actionId: action.action_id }, 'Unknown interactive action');
        return null;
    }
  }

  // ============================================================================
  // Webhook Methods
  // ============================================================================

  getSupportedWebhookEvents(): string[] {
    return ['url_verification', 'app_mention', 'message', 'app_home_opened'];
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string, _secret: string): boolean {
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      this.logger.warn('SLACK_SIGNING_SECRET not configured');
      return false;
    }

    // Extract timestamp and signature from headers
    // Signature format: v0=hash
    const parts = signature.split(',');
    const v0Signature = parts.find((p) => p.startsWith('v0='));
    if (!v0Signature) {
      return false;
    }

    // The payload should include timestamp
    const payloadStr = typeof payload === 'string' ? payload : payload.toString();

    const expectedSignature =
      'v0=' + crypto.createHmac('sha256', signingSecret).update(payloadStr).digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(v0Signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  async processWebhook(integration: Integration, payload: WebhookPayload): Promise<void> {
    const eventType = payload.eventType;
    const data = payload.payload;

    switch (eventType) {
      case 'app_mention':
        await this.handleAppMention(integration, data);
        break;

      case 'message':
        // Handle direct messages if needed
        this.logger.debug({ eventType }, 'Received Slack message event');
        break;

      default:
        this.logger.debug({ eventType }, 'Unhandled Slack event type');
    }
  }

  private async handleAppMention(
    integration: Integration,
    payload: Record<string, unknown>
  ): Promise<void> {
    const event = payload.event as { channel: string; ts: string };
    if (!event?.channel) return;

    await this.sendMessage(integration, event.channel, {
      text: "Hi! I'm Skillancer Bot. Use `/skillancer help` to see available commands.",
      thread_ts: event.ts,
    });
  }
}
