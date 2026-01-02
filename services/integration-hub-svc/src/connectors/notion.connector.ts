// @ts-nocheck
import {
  BaseConnector,
  OAuthTokens,
  WidgetData,
  WebhookResult,
  WidgetDefinition,
} from './base.connector';
import { IntegrationCategory, ExecutiveType } from './base.connector';

export class NotionConnector extends BaseConnector {
  readonly id = 'notion';
  readonly name = 'Notion';
  readonly category = IntegrationCategory.PRODUCTIVITY;
  readonly applicableRoles = [
    ExecutiveType.CTO,
    ExecutiveType.CFO,
    ExecutiveType.COO,
    ExecutiveType.CMO,
    ExecutiveType.CPO,
    ExecutiveType.CHRO,
    ExecutiveType.CLO,
    ExecutiveType.CISO,
    ExecutiveType.CDO,
    ExecutiveType.CSO,
    ExecutiveType.CRO,
  ];

  readonly oauthConfig = {
    authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    clientId: process.env.NOTION_CLIENT_ID || '',
    clientSecret: process.env.NOTION_CLIENT_SECRET || '',
    scopes: [],
    scopeSeparator: ' ',
  };

  readonly webhookEnabled = false;

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'recent-pages',
      name: 'Recent Pages',
      description: 'Recently edited pages in your workspace',
      refreshInterval: 300,
      requiredScopes: [],
    },
    {
      id: 'database-view',
      name: 'Database View',
      description: 'Embedded view of a Notion database',
      refreshInterval: 300,
      requiredScopes: [],
      configSchema: {
        type: 'object',
        properties: {
          databaseId: { type: 'string', description: 'Notion database ID' },
          filter: { type: 'object', description: 'Optional filter' },
        },
        required: ['databaseId'],
      },
    },
    {
      id: 'page-embed',
      name: 'Page Embed',
      description: 'Display specific page content',
      refreshInterval: 600,
      requiredScopes: [],
      configSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Notion page ID' },
        },
        required: ['pageId'],
      },
    },
  ];

  getAuthUrl(state: string, scopes?: string[]): string {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      state,
      owner: 'user',
    });

    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const credentials = Buffer.from(
      `${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`
    ).toString('base64');

    const response = await this.httpClient.post(
      this.oauthConfig.tokenUrl,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.getRedirectUri(),
      },
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: undefined,
      expiresAt: undefined,
      scopes: [],
      raw: response.data,
    };
  }

  async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error('Notion does not support token refresh. User must reconnect.');
  }

  async revokeToken(_accessToken: string): Promise<void> {
    this.logger.info('Notion tokens cannot be revoked via API');
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      await this.fetchData(tokens, '/users/me');
      return true;
    } catch {
      return false;
    }
  }

  async fetchData(
    tokens: OAuthTokens,
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    return this.makeRequest(tokens, {
      method: params?.method === 'POST' ? 'POST' : 'GET',
      url: `https://api.notion.com/v1${endpoint}`,
      data: params?.body,
      headers: {
        'Notion-Version': '2022-06-28',
      },
    });
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'recent-pages':
        return this.getRecentPages(tokens);
      case 'database-view':
        return this.getDatabaseView(tokens, params?.databaseId as string, params?.filter);
      case 'page-embed':
        return this.getPageContent(tokens, params?.pageId as string);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  private async getRecentPages(tokens: OAuthTokens): Promise<WidgetData> {
    const response = (await this.fetchData(tokens, '/search', {
      method: 'POST',
      body: {
        filter: { property: 'object', value: 'page' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: 10,
      },
    })) as { results: NotionPage[] };

    const pages = response.results.map((page: NotionPage) => ({
      id: page.id,
      title: this.getPageTitle(page),
      url: page.url,
      lastEdited: page.last_edited_time,
      icon: page.icon,
    }));

    return {
      widgetId: 'recent-pages',
      data: { pages },
      fetchedAt: new Date(),
    };
  }

  private async getDatabaseView(
    tokens: OAuthTokens,
    databaseId: string,
    filter?: unknown
  ): Promise<WidgetData> {
    const body: Record<string, unknown> = { page_size: 50 };
    if (filter) body.filter = filter;

    const response = (await this.fetchData(tokens, `/databases/${databaseId}/query`, {
      method: 'POST',
      body,
    })) as { results: NotionDatabaseItem[] };

    const items = response.results.map((item: NotionDatabaseItem) => ({
      id: item.id,
      properties: item.properties,
      url: item.url,
    }));

    return {
      widgetId: 'database-view',
      data: { items, databaseId },
      fetchedAt: new Date(),
    };
  }

  private async getPageContent(tokens: OAuthTokens, pageId: string): Promise<WidgetData> {
    const [page, blocks] = await Promise.all([
      this.fetchData(tokens, `/pages/${pageId}`) as Promise<NotionPage>,
      this.fetchData(tokens, `/blocks/${pageId}/children`) as Promise<{ results: NotionBlock[] }>,
    ]);

    return {
      widgetId: 'page-embed',
      data: {
        page: {
          id: page.id,
          title: this.getPageTitle(page),
          icon: page.icon,
        },
        blocks: blocks.results,
      },
      fetchedAt: new Date(),
    };
  }

  private getPageTitle(page: NotionPage): string {
    if (page.properties?.title?.title?.[0]?.plain_text) {
      return page.properties.title.title[0].plain_text;
    }
    if (page.properties?.Name?.title?.[0]?.plain_text) {
      return page.properties.Name.title[0].plain_text;
    }
    return 'Untitled';
  }

  async handleWebhook(_payload: unknown, _signature: string): Promise<WebhookResult> {
    throw new Error('Notion webhooks not supported');
  }
}

interface NotionPage {
  id: string;
  url: string;
  last_edited_time: string;
  icon?: { type: string; emoji?: string };
  properties?: {
    title?: { title: Array<{ plain_text: string }> };
    Name?: { title: Array<{ plain_text: string }> };
  };
}

interface NotionDatabaseItem {
  id: string;
  url: string;
  properties: Record<string, unknown>;
}

interface NotionBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

export const notionConnector = new NotionConnector();

