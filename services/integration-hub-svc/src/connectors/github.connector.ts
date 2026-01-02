// @ts-nocheck
import {
  BaseConnector,
  OAuthTokens,
  WidgetData,
  WebhookResult,
  WidgetDefinition,
} from './base.connector';
import { IntegrationCategory, ExecutiveType } from './base.connector';

export class GitHubConnector extends BaseConnector {
  readonly id = 'github';
  readonly name = 'GitHub';
  readonly category = IntegrationCategory.DEVTOOLS;
  readonly applicableRoles = [ExecutiveType.CTO, ExecutiveType.CPO];

  readonly oauthConfig = {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    scopes: ['repo', 'read:org', 'read:user'],
    scopeSeparator: ' ',
  };

  readonly webhookEnabled = true;

  readonly supportedWidgets: WidgetDefinition[] = [
    {
      id: 'recent-commits',
      name: 'Recent Commits',
      description: 'Latest commits across repositories',
      refreshInterval: 300,
      requiredScopes: ['repo'],
    },
    {
      id: 'pull-requests',
      name: 'Pull Requests',
      description: 'Open PRs needing review',
      refreshInterval: 180,
      requiredScopes: ['repo'],
    },
    {
      id: 'repository-health',
      name: 'Repository Health',
      description: 'Branch protection, issues, and coverage',
      refreshInterval: 600,
      requiredScopes: ['repo'],
    },
    {
      id: 'contributor-activity',
      name: 'Contributor Activity',
      description: 'Commits and PRs per developer',
      refreshInterval: 3600,
      requiredScopes: ['repo'],
    },
    {
      id: 'actions-status',
      name: 'Actions Status',
      description: 'CI/CD workflow runs',
      refreshInterval: 120,
      requiredScopes: ['repo'],
    },
  ];

  getAuthUrl(state: string, scopes?: string[]): string {
    const scopeList = scopes || this.oauthConfig.scopes;
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.getRedirectUri(),
      scope: scopeList.join(this.oauthConfig.scopeSeparator),
      state,
    });
    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await this.httpClient.post(
      this.oauthConfig.tokenUrl,
      {
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        code,
        redirect_uri: this.getRedirectUri(),
      },
      { headers: { Accept: 'application/json' } }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: undefined,
      scopes: response.data.scope?.split(',') || this.oauthConfig.scopes,
      raw: response.data,
    };
  }

  async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error('GitHub OAuth tokens do not expire. User must reconnect if revoked.');
  }

  async revokeToken(accessToken: string): Promise<void> {
    try {
      await this.httpClient.delete(
        `https://api.github.com/applications/${this.oauthConfig.clientId}/token`,
        {
          auth: { username: this.oauthConfig.clientId, password: this.oauthConfig.clientSecret },
          data: { access_token: accessToken },
        }
      );
    } catch (error) {
      this.logger.warn({ error }, 'Failed to revoke GitHub token');
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
      url: `https://api.github.com${endpoint}`,
      params: params?.query,
    });
  }

  async getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData> {
    switch (widgetId) {
      case 'recent-commits':
        return this.getRecentCommits(tokens, params?.repos as string[]);
      case 'pull-requests':
        return this.getPullRequests(tokens, params?.repos as string[]);
      case 'repository-health':
        return this.getRepositoryHealth(tokens, params?.repo as string);
      case 'contributor-activity':
        return this.getContributorActivity(tokens, params?.repo as string);
      case 'actions-status':
        return this.getActionsStatus(tokens, params?.repos as string[]);
      default:
        throw new Error(`Unknown widget: ${widgetId}`);
    }
  }

  private async getRecentCommits(tokens: OAuthTokens, repos?: string[]): Promise<WidgetData> {
    const repoList = repos?.length ? repos : await this.getTopRepos(tokens);
    const allCommits: GitHubCommit[] = [];

    for (const repo of repoList.slice(0, 5)) {
      try {
        const commits = (await this.fetchData(tokens, `/repos/${repo}/commits`, {
          query: { per_page: 10 },
        })) as GitHubCommit[];
        allCommits.push(...commits.map((c) => ({ ...c, _repo: repo })));
      } catch {
        // Skip repos we can't access
      }
    }

    allCommits.sort(
      (a, b) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime()
    );

    return {
      widgetId: 'recent-commits',
      data: {
        commits: allCommits.slice(0, 20).map((c) => ({
          sha: c.sha.substring(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          authorAvatar: c.author?.avatar_url,
          date: c.commit.author.date,
          repo: (c as GitHubCommit & { _repo: string })._repo,
          url: c.html_url,
        })),
      },
      fetchedAt: new Date(),
    };
  }

  private async getPullRequests(tokens: OAuthTokens, repos?: string[]): Promise<WidgetData> {
    const repoList = repos?.length ? repos : await this.getTopRepos(tokens);
    const allPRs: PullRequestInfo[] = [];

    for (const repo of repoList.slice(0, 10)) {
      try {
        const prs = (await this.fetchData(tokens, `/repos/${repo}/pulls`, {
          query: { state: 'open', per_page: 20 },
        })) as GitHubPR[];

        allPRs.push(
          ...prs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            author: pr.user.login,
            authorAvatar: pr.user.avatar_url,
            repo,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            draft: pr.draft,
            reviewStatus: pr.requested_reviewers?.length ? 'review_requested' : 'pending',
            url: pr.html_url,
            mergeable: pr.mergeable,
            ageInDays: Math.floor((Date.now() - new Date(pr.created_at).getTime()) / 86400000),
          }))
        );
      } catch {
        // Skip repos we can't access
      }
    }

    allPRs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return {
      widgetId: 'pull-requests',
      data: {
        pullRequests: allPRs,
        totalOpen: allPRs.length,
        needingReview: allPRs.filter((pr) => pr.reviewStatus === 'review_requested').length,
        drafts: allPRs.filter((pr) => pr.draft).length,
      },
      fetchedAt: new Date(),
    };
  }

  private async getRepositoryHealth(tokens: OAuthTokens, repo: string): Promise<WidgetData> {
    const [repoData, branches, issues] = await Promise.all([
      this.fetchData(tokens, `/repos/${repo}`) as Promise<GitHubRepo>,
      this.fetchData(tokens, `/repos/${repo}/branches`, { query: { per_page: 100 } }) as Promise<
        GitHubBranch[]
      >,
      this.fetchData(tokens, `/repos/${repo}/issues`, {
        query: { state: 'open', per_page: 1 },
      }) as Promise<unknown[]>,
    ]);

    let branchProtection = false;
    try {
      await this.fetchData(tokens, `/repos/${repo}/branches/${repoData.default_branch}/protection`);
      branchProtection = true;
    } catch {
      branchProtection = false;
    }

    return {
      widgetId: 'repository-health',
      data: {
        name: repoData.name,
        fullName: repoData.full_name,
        defaultBranch: repoData.default_branch,
        branchProtection,
        openIssues: repoData.open_issues_count,
        totalBranches: branches.length,
        staleBranches: branches.filter((b) => !b.protected && b.name !== repoData.default_branch)
          .length,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        language: repoData.language,
        lastPush: repoData.pushed_at,
      },
      fetchedAt: new Date(),
    };
  }

  private async getContributorActivity(tokens: OAuthTokens, repo: string): Promise<WidgetData> {
    const stats = (await this.fetchData(
      tokens,
      `/repos/${repo}/stats/contributors`
    )) as ContributorStats[];

    const contributors = (stats || [])
      .map((s) => ({
        login: s.author.login,
        avatar: s.author.avatar_url,
        totalCommits: s.total,
        weeklyCommits: s.weeks.slice(-4).reduce((sum, w) => sum + w.c, 0),
      }))
      .sort((a, b) => b.totalCommits - a.totalCommits);

    return {
      widgetId: 'contributor-activity',
      data: { contributors: contributors.slice(0, 15), repo },
      fetchedAt: new Date(),
    };
  }

  private async getActionsStatus(tokens: OAuthTokens, repos?: string[]): Promise<WidgetData> {
    const repoList = repos?.length ? repos : await this.getTopRepos(tokens);
    const allRuns: WorkflowRunInfo[] = [];

    for (const repo of repoList.slice(0, 5)) {
      try {
        const response = (await this.fetchData(tokens, `/repos/${repo}/actions/runs`, {
          query: { per_page: 10 },
        })) as { workflow_runs: GitHubWorkflowRun[] };

        allRuns.push(
          ...response.workflow_runs.map((run) => ({
            id: run.id,
            name: run.name,
            repo,
            status: run.status,
            conclusion: run.conclusion,
            branch: run.head_branch,
            createdAt: run.created_at,
            duration:
              run.updated_at && run.created_at
                ? Math.floor(
                    (new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 1000
                  )
                : null,
            url: run.html_url,
          }))
        );
      } catch {
        // Skip repos without Actions
      }
    }

    allRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const recent = allRuns.slice(0, 20);
    const successRate = recent.length
      ? (recent.filter((r) => r.conclusion === 'success').length / recent.length) * 100
      : 0;

    return {
      widgetId: 'actions-status',
      data: {
        runs: recent,
        successRate: Math.round(successRate),
        totalRuns: recent.length,
        failing: recent.filter((r) => r.conclusion === 'failure').length,
      },
      fetchedAt: new Date(),
    };
  }

  private async getTopRepos(tokens: OAuthTokens): Promise<string[]> {
    const repos = (await this.fetchData(tokens, '/user/repos', {
      query: { sort: 'pushed', per_page: 20 },
    })) as GitHubRepo[];
    return repos.map((r) => r.full_name);
  }

  async handleWebhook(payload: GitHubWebhookPayload, signature: string): Promise<WebhookResult> {
    if (!this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      return { success: false, error: 'Invalid signature' };
    }

    return {
      success: true,
      eventType: payload.action ? `${payload.action}` : 'push',
      data: {
        repository: payload.repository?.full_name,
        sender: payload.sender?.login,
      },
    };
  }

  private verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  author?: { avatar_url: string };
  html_url: string;
}

interface GitHubPR {
  number: number;
  title: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  draft: boolean;
  requested_reviewers?: unknown[];
  html_url: string;
  mergeable?: boolean;
}

interface PullRequestInfo {
  number: number;
  title: string;
  author: string;
  authorAvatar: string;
  repo: string;
  createdAt: string;
  updatedAt: string;
  draft: boolean;
  reviewStatus: string;
  url: string;
  mergeable?: boolean;
  ageInDays: number;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  default_branch: string;
  open_issues_count: number;
  stargazers_count: number;
  forks_count: number;
  language: string;
  pushed_at: string;
}

interface GitHubBranch {
  name: string;
  protected: boolean;
}

interface ContributorStats {
  author: { login: string; avatar_url: string };
  total: number;
  weeks: Array<{ c: number }>;
}

interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  head_branch: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface WorkflowRunInfo {
  id: number;
  name: string;
  repo: string;
  status: string;
  conclusion: string;
  branch: string;
  createdAt: string;
  duration: number | null;
  url: string;
}

interface GitHubWebhookPayload {
  action?: string;
  repository?: { full_name: string };
  sender?: { login: string };
}

export const githubConnector = new GitHubConnector();

