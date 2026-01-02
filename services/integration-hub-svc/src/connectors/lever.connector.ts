import { EventEmitter } from 'events';

// Lever Connector
//
// OAuth Configuration: Lever OAuth 2.0
//
// Supported Widgets:
// - Similar to Greenhouse
// - Lever-specific features

interface LeverOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface LeverTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface Posting {
  id: string;
  text: string;
  state: 'published' | 'internal' | 'closed' | 'draft' | 'pending';
  distributionChannels: string[];
  user: string;
  owner: string;
  hiringManager: string;
  categories: {
    team: string;
    department: string;
    location: string;
    commitment: string;
  };
  tags: string[];
  content: {
    description: string;
    lists: Array<{ text: string; content: string }>;
    closing: string;
  };
  urls: {
    show: string;
    apply: string;
  };
  createdAt: number;
  updatedAt: number;
}

interface Opportunity {
  id: string;
  name: string;
  headline: string;
  contact: string;
  emails: string[];
  phones: Array<{ type: string; value: string }>;
  location: string;
  links: string[];
  stage: string;
  stageChanges: Array<{
    toStageId: string;
    toStageIndex: number;
    updatedAt: number;
  }>;
  origin: string;
  sources: string[];
  owner: string;
  followers: string[];
  applications: string[];
  archived: {
    reason: string;
    archivedAt: number;
  } | null;
  createdAt: number;
  updatedAt: number;
  lastInteractionAt: number;
  isAnonymized: boolean;
  dataProtection: unknown;
}

interface Stage {
  id: string;
  text: string;
}

interface Offer {
  id: string;
  opportunityId: string;
  postingId: string;
  status: 'draft' | 'approval-sent' | 'approved' | 'sent' | 'opened' | 'signed' | 'rejected';
  sentAt?: number;
  signedAt?: number;
  createdAt: number;
  creator: string;
  fields: Array<{
    identifier: string;
    value: unknown;
  }>;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  photo?: string;
}

interface PipelineData {
  stages: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  totalCandidates: number;
  byPosting: Record<string, number>;
}

interface OpenPosition {
  id: string;
  title: string;
  department: string;
  location: string;
  state: string;
  daysOpen: number;
  candidateCount: number;
  hiringManager?: string;
}

export class LeverConnector extends EventEmitter {
  private oauthConfig: LeverOAuthConfig;
  private tokens: LeverTokens | null = null;
  private baseUrl = 'https://api.lever.co/v1';

  constructor(oauthConfig: LeverOAuthConfig) {
    super();
    this.oauthConfig = oauthConfig;
  }

  // ==================== OAUTH METHODS ====================

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.oauthConfig.redirectUri,
      response_type: 'code',
      state,
      scope: 'offline_access postings:read:admin opportunities:read:admin offers:read:admin',
    });

    return `https://auth.lever.co/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<LeverTokens> {
    const response = await fetch('https://auth.lever.co/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        redirect_uri: this.oauthConfig.redirectUri,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const data = await response.json();

    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    return this.tokens;
  }

  async refreshAccessToken(): Promise<LeverTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://auth.lever.co/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        refresh_token: this.tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    this.tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    return this.tokens;
  }

  setTokens(tokens: LeverTokens): void {
    this.tokens = tokens;
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) {
      throw new Error('Not authenticated');
    }

    if (this.tokens.expiresAt <= new Date()) {
      await this.refreshAccessToken();
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens!.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Lever API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private async paginatedRequest<T>(endpoint: string): Promise<T[]> {
    let allResults: T[] = [];
    let offset: string | undefined;
    const limit = 100;

    do {
      const separator = endpoint.includes('?') ? '&' : '?';
      let url = `${endpoint}${separator}limit=${limit}`;
      if (offset) url += `&offset=${offset}`;

      const response = await this.request<{ data: T[]; hasNext: boolean; next?: string }>(url);
      allResults = allResults.concat(response.data);
      offset = response.hasNext ? response.next : undefined;
    } while (offset);

    return allResults;
  }

  // ==================== POSTING METHODS ====================

  async getPostings(state?: string): Promise<Posting[]> {
    let endpoint = '/postings';
    if (state) endpoint += `?state=${state}`;
    return this.paginatedRequest<Posting>(endpoint);
  }

  async getPosting(postingId: string): Promise<Posting> {
    const response = await this.request<{ data: Posting }>(`/postings/${postingId}`);
    return response.data;
  }

  // ==================== OPPORTUNITY METHODS ====================

  async getOpportunities(filters?: {
    stage?: string;
    postingId?: string;
    archived?: boolean;
  }): Promise<Opportunity[]> {
    let endpoint = '/opportunities';
    const params = new URLSearchParams();

    if (filters?.stage) params.append('stage_id', filters.stage);
    if (filters?.postingId) params.append('posting_id', filters.postingId);
    if (filters?.archived !== undefined) params.append('archived', String(filters.archived));

    if (params.toString()) endpoint += `?${params.toString()}`;

    return this.paginatedRequest<Opportunity>(endpoint);
  }

  async getOpportunity(opportunityId: string): Promise<Opportunity> {
    const response = await this.request<{ data: Opportunity }>(`/opportunities/${opportunityId}`);
    return response.data;
  }

  // ==================== STAGE METHODS ====================

  async getStages(): Promise<Stage[]> {
    const response = await this.request<{ data: Stage[] }>('/stages');
    return response.data;
  }

  // ==================== OFFER METHODS ====================

  async getOffers(opportunityId?: string): Promise<Offer[]> {
    if (opportunityId) {
      const response = await this.request<{ data: Offer[] }>(
        `/opportunities/${opportunityId}/offers`
      );
      return response.data;
    }

    // Get all opportunities and their offers
    const opportunities = await this.getOpportunities();
    const allOffers: Offer[] = [];

    for (const opp of opportunities.slice(0, 50)) {
      // Limit for performance
      const offers = await this.request<{ data: Offer[] }>(`/opportunities/${opp.id}/offers`);
      allOffers.push(...offers.data);
    }

    return allOffers;
  }

  // ==================== USER METHODS ====================

  async getUsers(): Promise<User[]> {
    const response = await this.request<{ data: User[] }>('/users');
    return response.data;
  }

  async getUser(userId: string): Promise<User> {
    const response = await this.request<{ data: User }>(`/users/${userId}`);
    return response.data;
  }

  // ==================== WIDGET DATA METHODS ====================

  async getPipelineData(): Promise<PipelineData> {
    const [stages, opportunities] = await Promise.all([
      this.getStages(),
      this.getOpportunities({ archived: false }),
    ]);

    const stageCount: Record<string, number> = {};
    const byPosting: Record<string, number> = {};

    for (const stage of stages) {
      stageCount[stage.id] = 0;
    }

    for (const opp of opportunities) {
      if (opp.stage) {
        stageCount[opp.stage] = (stageCount[opp.stage] || 0) + 1;
      }

      for (const appId of opp.applications) {
        byPosting[appId] = (byPosting[appId] || 0) + 1;
      }
    }

    const pipelineStages = stages.map((stage) => ({
      id: stage.id,
      name: stage.text,
      count: stageCount[stage.id] || 0,
    }));

    return {
      stages: pipelineStages,
      totalCandidates: opportunities.length,
      byPosting,
    };
  }

  async getOpenPositions(): Promise<OpenPosition[]> {
    const postings = await this.getPostings('published');
    const opportunities = await this.getOpportunities({ archived: false });
    const users = await this.getUsers();
    const now = Date.now();

    const userMap = new Map(users.map((u) => [u.id, u]));
    const oppCountByPosting: Record<string, number> = {};

    for (const opp of opportunities) {
      for (const appId of opp.applications) {
        oppCountByPosting[appId] = (oppCountByPosting[appId] || 0) + 1;
      }
    }

    return postings.map((posting) => {
      const daysOpen = Math.floor((now - posting.createdAt) / (1000 * 60 * 60 * 24));
      const hiringManagerUser = userMap.get(posting.hiringManager);

      return {
        id: posting.id,
        title: posting.text,
        department: posting.categories.department || 'Unknown',
        location: posting.categories.location || 'Remote',
        state: posting.state,
        daysOpen,
        candidateCount: oppCountByPosting[posting.id] || 0,
        hiringManager: hiringManagerUser?.name,
      };
    });
  }

  async getHiringMetrics(daysBack: number = 90): Promise<{
    offersExtended: number;
    offersSigned: number;
    offersRejected: number;
    averageTimeToOffer: number;
    conversionRate: number;
  }> {
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const offers = await this.getOffers();

    const recentOffers = offers.filter((o) => o.createdAt >= cutoff);
    const signedOffers = recentOffers.filter((o) => o.status === 'signed');
    const rejectedOffers = recentOffers.filter((o) => o.status === 'rejected');
    const sentOffers = recentOffers.filter((o) => o.sentAt);

    // Calculate average time from sent to signed
    const timesToSign = signedOffers
      .filter((o) => o.sentAt && o.signedAt)
      .map((o) => (o.signedAt! - o.sentAt!) / (1000 * 60 * 60 * 24));

    const averageTimeToOffer =
      timesToSign.length > 0 ? timesToSign.reduce((a, b) => a + b, 0) / timesToSign.length : 0;

    const decidedOffers = signedOffers.length + rejectedOffers.length;

    return {
      offersExtended: sentOffers.length,
      offersSigned: signedOffers.length,
      offersRejected: rejectedOffers.length,
      averageTimeToOffer,
      conversionRate: decidedOffers > 0 ? (signedOffers.length / decidedOffers) * 100 : 0,
    };
  }

  async getSourceAnalytics(): Promise<
    Array<{
      source: string;
      candidates: number;
      hires: number;
      conversionRate: number;
    }>
  > {
    const opportunities = await this.getOpportunities();
    const offers = await this.getOffers();
    const signedOfferOppIds = new Set(
      offers.filter((o) => o.status === 'signed').map((o) => o.opportunityId)
    );

    const sourceStats: Record<string, { candidates: number; hires: number }> = {};

    for (const opp of opportunities) {
      for (const source of opp.sources) {
        if (!sourceStats[source]) {
          sourceStats[source] = { candidates: 0, hires: 0 };
        }
        sourceStats[source].candidates++;

        if (signedOfferOppIds.has(opp.id)) {
          sourceStats[source].hires++;
        }
      }
    }

    return Object.entries(sourceStats)
      .map(([source, stats]) => ({
        source,
        candidates: stats.candidates,
        hires: stats.hires,
        conversionRate: stats.candidates > 0 ? (stats.hires / stats.candidates) * 100 : 0,
      }))
      .sort((a, b) => b.hires - a.hires);
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getStages();
      return true;
    } catch {
      return false;
    }
  }
}

export const createLeverConnector = (config: LeverOAuthConfig): LeverConnector => {
  return new LeverConnector(config);
};
