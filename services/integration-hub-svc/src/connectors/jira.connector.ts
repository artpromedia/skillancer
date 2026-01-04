// @ts-nocheck
import {
  BaseConnector,
  OAuthTokens,
  WidgetData,
  WebhookResult,
  WidgetDefinition,
} from './base.connector';
import type { ExecutiveType } from '@skillancer/database';
import type { IntegrationCategory } from '../types/index.js';

export class JiraConnector extends BaseConnector {
  readonly id = 'jira';
  readonly name = 'Jira';
  readonly category: IntegrationCategory = 'DEVTOOLS';
  readonly applicableRoles: ExecutiveType[] = [
    'FRACTIONAL_CTO',
    'FRACTIONAL_COO',
    'FRACTIONAL_CPO',
  ];

  readonly oauthConfig = {
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientId: process.env.JIRA_CLIENT_ID || '',
    clientSecret: process.env.JIRA_CLIENT_SECRET || '',
    scopes: ['read:jira-work', 'read:jira-user', 'offline_access'],
    scopeSeparator: ' ',
  };

  readonly webhookEnabled = true;

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'sprint-progress',
      name: 'Sprint Progress',
      description: 'Current sprint status and burndown',
      refreshInterval: 300,
      requiredScopes: ['read:jira-work'],
      configSchema: {
        type: 'object',
        properties: {
          boardId: { type: 'string', description: 'Jira board ID' },
        },
        required: ['boardId'],
      },
    },
    {
      id: 'my-issues',
      name: 'My Issues',
      description: 'Issues assigned to you',
      refreshInterval: 180,
      requiredScopes: ['read:jira-work'],
    },
    {
      id: 'recent-activity',
      name: 'Recent Activity',
      description: 'Recent project activity',
      refreshInterval: 300,
      requiredScopes: ['read:jira-work'],
      configSchema: {
        type: 'object',
        properties: {
          projectKey: { type: 'string', description: 'Jira project key' },
        },
      },
    },
    {
      id: 'velocity-chart',
      name: 'Velocity Chart',
      description: 'Team velocity over sprints',
      refreshInterval: 3600,
      requiredScopes: ['read:jira-work'],
      configSchema: {
        type: 'object',
        properties: {
          boardId: { type: 'string', description: 'Jira board ID' },
          sprintCount: { type: 'number', description: 'Number of sprints', default: 6 },
        },
        required: ['boardId'],
      },
    },
  ];

  private cloudId: string | null = null;

  getAuthUrl(state: string, scopes?: string[]): string {
    const scopeList = scopes || this.oauthConfig.scopes;
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.oauthConfig.clientId,
      scope: scopeList.join(this.oauthConfig.scopeSeparator),
      redirect_uri: this.getRedirectUri(),
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(this.oauthConfig.tokenUrl, {
      grant_type: 'authorization_code',
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      code,
      redirect_uri: this.getRedirectUri(),
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.data.expires_in);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt,
      scopes: response.data.scope?.split(' ') || this.oauthConfig.scopes,
      raw: response.data,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(this.oauthConfig.tokenUrl, {
      grant_type: 'refresh_token',
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      refresh_token: refreshToken,
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.data.expires_in);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresAt,
      scopes: response.data.scope?.split(' ') || this.oauthConfig.scopes,
      raw: response.data,
    };
  }

  async revokeToken(_accessToken: string): Promise<void> {
    this.logger.info('Atlassian tokens expire automatically');
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      await this.getCloudId(tokens);
      return true;
    } catch {
      return false;
    }
  }

  private async getCloudId(tokens: OAuthTokens): Promise<string> {
    if (this.cloudId) return this.cloudId;

    const response = (await this.makeRequest(tokens, {
      method: 'GET',
      url: 'https://api.atlassian.com/oauth/token/accessible-resources',
    })) as Array<{ id: string; name: string; url: string }>;

    if (!response.length) {
      throw new Error('No accessible Jira sites found');
    }

    this.cloudId = response[0].id;
    return this.cloudId;
  }

  async fetchData(
    tokens: OAuthTokens,
    endpoint: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const cloudId = await this.getCloudId(tokens);
    const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`;

    return this.makeRequest(tokens, {
      method: (params?.method as string) || 'GET',
      url: `${baseUrl}${endpoint}`,
      params: params?.query,
      data: params?.body,
    });
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'sprint-progress':
        return this.getSprintProgress(tokens, params?.boardId as string);
      case 'my-issues':
        return this.getMyIssues(tokens);
      case 'recent-activity':
        return this.getRecentActivity(tokens, params?.projectKey as string);
      case 'velocity-chart':
        return this.getVelocityChart(
          tokens,
          params?.boardId as string,
          params?.sprintCount as number
        );
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  private async getSprintProgress(tokens: OAuthTokens, boardId: string): Promise<WidgetData> {
    const cloudId = await this.getCloudId(tokens);
    const agileUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0`;

    const sprintsResponse = (await this.makeRequest(tokens, {
      method: 'GET',
      url: `${agileUrl}/board/${boardId}/sprint`,
      params: { state: 'active' },
    })) as { values: JiraSprint[] };

    if (!sprintsResponse.values?.length) {
      return {
        widgetId: 'sprint-progress',
        data: { sprint: null, message: 'No active sprint' },
        fetchedAt: new Date(),
      };
    }

    const sprint = sprintsResponse.values[0];
    const issuesResponse = (await this.makeRequest(tokens, {
      method: 'GET',
      url: `${agileUrl}/sprint/${sprint.id}/issue`,
      params: { fields: 'status,summary,assignee,issuetype,priority' },
    })) as { issues: JiraIssue[] };

    const issues = issuesResponse.issues || [];
    const statusCounts = issues.reduce((acc: Record<string, number>, issue: JiraIssue) => {
      const status = issue.fields.status.statusCategory.name;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      widgetId: 'sprint-progress',
      data: {
        sprint: {
          id: sprint.id,
          name: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          goal: sprint.goal,
        },
        totalIssues: issues.length,
        statusCounts,
        progress: {
          done: statusCounts['Done'] || 0,
          inProgress: statusCounts['In Progress'] || 0,
          todo: statusCounts['To Do'] || 0,
        },
      },
      fetchedAt: new Date(),
    };
  }

  private async getMyIssues(tokens: OAuthTokens): Promise<WidgetData> {
    const response = (await this.fetchData(tokens, '/rest/api/3/search', {
      method: 'POST',
      body: {
        jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY priority DESC, updated DESC',
        maxResults: 20,
        fields: ['summary', 'status', 'priority', 'issuetype', 'project', 'updated'],
      },
    })) as { issues: JiraIssue[]; total: number };

    const issues = response.issues.map((issue: JiraIssue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      statusCategory: issue.fields.status.statusCategory.name,
      priority: issue.fields.priority?.name,
      type: issue.fields.issuetype?.name,
      project: issue.fields.project?.key,
      updated: issue.fields.updated,
    }));

    return {
      widgetId: 'my-issues',
      data: { issues, total: response.total },
      fetchedAt: new Date(),
    };
  }

  private async getRecentActivity(tokens: OAuthTokens, projectKey?: string): Promise<WidgetData> {
    let jql = 'updated >= -7d ORDER BY updated DESC';
    if (projectKey) {
      jql = `project = ${projectKey} AND ${jql}`;
    }

    const response = (await this.fetchData(tokens, '/rest/api/3/search', {
      method: 'POST',
      body: {
        jql,
        maxResults: 30,
        fields: ['summary', 'status', 'assignee', 'updated', 'issuetype', 'project'],
      },
    })) as { issues: JiraIssue[] };

    const activity = response.issues.map((issue: JiraIssue) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName,
      updated: issue.fields.updated,
      type: issue.fields.issuetype?.name,
      project: issue.fields.project?.key,
    }));

    return {
      widgetId: 'recent-activity',
      data: { activity },
      fetchedAt: new Date(),
    };
  }

  private async getVelocityChart(
    tokens: OAuthTokens,
    boardId: string,
    sprintCount = 6
  ): Promise<WidgetData> {
    const cloudId = await this.getCloudId(tokens);
    const agileUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0`;

    const sprintsResponse = (await this.makeRequest(tokens, {
      method: 'GET',
      url: `${agileUrl}/board/${boardId}/sprint`,
      params: { state: 'closed', maxResults: sprintCount },
    })) as { values: JiraSprint[] };

    const sprints = sprintsResponse.values || [];
    const velocity: VelocityPoint[] = [];

    for (const sprint of sprints.slice(-sprintCount)) {
      const issuesResponse = (await this.makeRequest(tokens, {
        method: 'GET',
        url: `${agileUrl}/sprint/${sprint.id}/issue`,
        params: { fields: 'status,customfield_10016' },
      })) as { issues: JiraIssue[] };

      const completedPoints = issuesResponse.issues
        .filter((i: JiraIssue) => i.fields.status.statusCategory.name === 'Done')
        .reduce((sum: number, i: JiraIssue) => sum + (i.fields.customfield_10016 || 0), 0);

      velocity.push({
        sprintName: sprint.name,
        completedPoints,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      });
    }

    const avgVelocity = velocity.length
      ? velocity.reduce((sum, v) => sum + v.completedPoints, 0) / velocity.length
      : 0;

    return {
      widgetId: 'velocity-chart',
      data: { velocity, averageVelocity: Math.round(avgVelocity) },
      fetchedAt: new Date(),
    };
  }

  async handleWebhook(payload: JiraWebhookPayload, signature: string): Promise<WebhookResult> {
    if (!this.verifyWebhookSignature(payload, signature)) {
      return { success: false, error: 'Invalid signature' };
    }

    const eventType = payload.webhookEvent;
    const issue = payload.issue;

    return {
      success: true,
      eventType,
      data: {
        issueKey: issue?.key,
        issueId: issue?.id,
        event: eventType,
        timestamp: payload.timestamp,
      },
    };
  }

  private verifyWebhookSignature(_payload: unknown, _signature: string): boolean {
    // Jira Cloud webhooks use different verification
    // For now, accept all (in production, verify properly)
    return true;
  }
}

interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
      statusCategory: { name: string };
    };
    priority?: { name: string };
    issuetype?: { name: string };
    project?: { key: string };
    assignee?: { displayName: string };
    updated?: string;
    customfield_10016?: number; // Story points
  };
}

interface JiraWebhookPayload {
  webhookEvent: string;
  timestamp: number;
  issue?: { id: string; key: string };
}

interface VelocityPoint {
  sprintName: string;
  completedPoints: number;
  startDate?: string;
  endDate?: string;
}

export const jiraConnector = new JiraConnector();
