// @ts-nocheck
import {
  BaseConnector,
  OAuthTokens,
  WidgetData,
  WebhookResult,
  WidgetDefinition,
} from './base.connector';
import { IntegrationCategory, ExecutiveType } from './base.connector';

export class GitLabConnector extends BaseConnector {
  readonly id = 'gitlab';
  readonly name = 'GitLab';
  readonly category = IntegrationCategory.DEVTOOLS;
  readonly applicableRoles = [ExecutiveType.CTO, ExecutiveType.CPO];

  readonly oauthConfig = {
    authorizationUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    clientId: process.env.GITLAB_CLIENT_ID || '',
    clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
    scopes: ['read_api', 'read_repository', 'read_user'],
    scopeSeparator: ' ',
  };

  readonly webhookEnabled = true;

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'merge-requests',
      name: 'Merge Requests',
      description: 'Open MRs awaiting review',
      refreshInterval: 180,
      requiredScopes: ['read_api'],
    },
    {
      id: 'pipeline-status',
      name: 'Pipeline Status',
      description: 'CI/CD pipeline health',
      refreshInterval: 120,
      requiredScopes: ['read_api'],
    },
    {
      id: 'recent-commits',
      name: 'Recent Commits',
      description: 'Latest commits across projects',
      refreshInterval: 300,
      requiredScopes: ['read_api'],
    },
    {
      id: 'project-statistics',
      name: 'Project Statistics',
      description: 'Repository size and activity',
      refreshInterval: 3600,
      requiredScopes: ['read_api'],
    },
  ];

  getAuthUrl(state: string, scopes?: string[]): string {
    const scopeList = scopes || this.oauthConfig.scopes;
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: scopeList.join(this.oauthConfig.scopeSeparator),
      state,
    });
    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(this.oauthConfig.tokenUrl, {
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.getRedirectUri(),
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.data.expires_in);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt,
      scopes: this.oauthConfig.scopes,
      raw: response.data,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(this.oauthConfig.tokenUrl, {
      client_id: this.oauthConfig.clientId,
      client_secret: this.oauthConfig.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.data.expires_in);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresAt,
      scopes: this.oauthConfig.scopes,
      raw: response.data,
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await this.httpClient.post('https://gitlab.com/oauth/revoke', {
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        token: accessToken,
      });
    } catch (error) {
      this.logger.warn({ error }, 'Failed to revoke GitLab token');
    }
  }

  async testConnection(tokens: OAuthTokens): Promise<boolean> {
    try {
      await this.fetchData(tokens, '/user');
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
      method: (params?.method as string) || 'GET',
      url: `https://gitlab.com/api/v4${endpoint}`,
      params: params?.query,
    });
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'merge-requests':
        return this.getMergeRequests(tokens);
      case 'pipeline-status':
        return this.getPipelineStatus(tokens, params?.projectIds as number[]);
      case 'recent-commits':
        return this.getRecentCommits(tokens, params?.projectIds as number[]);
      case 'project-statistics':
        return this.getProjectStatistics(tokens, params?.projectId as number);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  private async getMergeRequests(tokens: OAuthTokens): Promise<WidgetData> {
    const mrs = (await this.fetchData(tokens, '/merge_requests', {
      query: { state: 'opened', scope: 'all', per_page: 30 },
    })) as GitLabMR[];

    return {
      widgetId: 'merge-requests',
      data: {
        mergeRequests: mrs.map((mr) => ({
          id: mr.iid,
          title: mr.title,
          author: mr.author.name,
          authorAvatar: mr.author.avatar_url,
          project: mr.references.full,
          createdAt: mr.created_at,
          updatedAt: mr.updated_at,
          draft: mr.draft,
          webUrl: mr.web_url,
          hasConflicts: mr.has_conflicts,
          ageInDays: Math.floor((Date.now() - new Date(mr.created_at).getTime()) / 86400000),
        })),
        totalOpen: mrs.length,
      },
      fetchedAt: new Date(),
    };
  }

  private async getPipelineStatus(tokens: OAuthTokens, projectIds?: number[]): Promise<WidgetData> {
    const projects = projectIds?.length
      ? projectIds
      : (await this.getTopProjects(tokens)).map((p) => p.id);

    const allPipelines: PipelineInfo[] = [];

    for (const projectId of projects.slice(0, 5)) {
      try {
        const pipelines = (await this.fetchData(tokens, `/projects/${projectId}/pipelines`, {
          query: { per_page: 5 },
        })) as GitLabPipeline[];

        allPipelines.push(
          ...pipelines.map((p) => ({
            id: p.id,
            projectId,
            status: p.status,
            ref: p.ref,
            sha: p.sha.substring(0, 7),
            createdAt: p.created_at,
            webUrl: p.web_url,
          }))
        );
      } catch {
        // Skip projects without pipelines
      }
    }

    allPipelines.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const recent = allPipelines.slice(0, 15);
    const successRate = recent.length
      ? (recent.filter((p) => p.status === 'success').length / recent.length) * 100
      : 0;

    return {
      widgetId: 'pipeline-status',
      data: {
        pipelines: recent,
        successRate: Math.round(successRate),
        failing: recent.filter((p) => p.status === 'failed').length,
        running: recent.filter((p) => p.status === 'running').length,
      },
      fetchedAt: new Date(),
    };
  }

  private async getRecentCommits(tokens: OAuthTokens, projectIds?: number[]): Promise<WidgetData> {
    const projects = projectIds?.length
      ? projectIds
      : (await this.getTopProjects(tokens)).map((p) => p.id);

    const allCommits: CommitInfo[] = [];

    for (const projectId of projects.slice(0, 5)) {
      try {
        const commits = (await this.fetchData(tokens, `/projects/${projectId}/repository/commits`, {
          query: { per_page: 10 },
        })) as GitLabCommit[];

        allCommits.push(
          ...commits.map((c) => ({
            sha: c.short_id,
            message: c.title,
            author: c.author_name,
            date: c.created_at,
            projectId,
            webUrl: c.web_url,
          }))
        );
      } catch {
        // Skip projects we can't access
      }
    }

    allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      widgetId: 'recent-commits',
      data: { commits: allCommits.slice(0, 20) },
      fetchedAt: new Date(),
    };
  }

  private async getProjectStatistics(tokens: OAuthTokens, projectId: number): Promise<WidgetData> {
    const project = (await this.fetchData(tokens, `/projects/${projectId}`, {
      query: { statistics: true },
    })) as GitLabProject;

    return {
      widgetId: 'project-statistics',
      data: {
        name: project.name,
        path: project.path_with_namespace,
        defaultBranch: project.default_branch,
        visibility: project.visibility,
        statistics: project.statistics,
        lastActivity: project.last_activity_at,
        openIssues: project.open_issues_count,
        forks: project.forks_count,
        stars: project.star_count,
      },
      fetchedAt: new Date(),
    };
  }

  private async getTopProjects(tokens: OAuthTokens): Promise<GitLabProject[]> {
    return (await this.fetchData(tokens, '/projects', {
      query: { membership: true, order_by: 'last_activity_at', per_page: 10 },
    })) as GitLabProject[];
  }

  async handleWebhook(payload: GitLabWebhookPayload, signature: string): Promise<WebhookResult> {
    if (!this.verifyWebhookSignature(signature)) {
      return { success: false, error: 'Invalid signature' };
    }

    return {
      success: true,
      eventType: payload.object_kind,
      data: { project: payload.project?.path_with_namespace },
    };
  }

  private verifyWebhookSignature(signature: string): boolean {
    const secret = process.env.GITLAB_WEBHOOK_SECRET || '';
    return signature === secret;
  }
}

interface GitLabMR {
  iid: number;
  title: string;
  author: { name: string; avatar_url: string };
  references: { full: string };
  created_at: string;
  updated_at: string;
  draft: boolean;
  web_url: string;
  has_conflicts: boolean;
}

interface GitLabPipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  created_at: string;
  web_url: string;
}

interface PipelineInfo {
  id: number;
  projectId: number;
  status: string;
  ref: string;
  sha: string;
  createdAt: string;
  webUrl: string;
}

interface GitLabCommit {
  short_id: string;
  title: string;
  author_name: string;
  created_at: string;
  web_url: string;
}

interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  projectId: number;
  webUrl: string;
}

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  default_branch: string;
  visibility: string;
  statistics?: Record<string, unknown>;
  last_activity_at: string;
  open_issues_count: number;
  forks_count: number;
  star_count: number;
}

interface GitLabWebhookPayload {
  object_kind: string;
  project?: { path_with_namespace: string };
}

export const gitlabConnector = new GitLabConnector();

