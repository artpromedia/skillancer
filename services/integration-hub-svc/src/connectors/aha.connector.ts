import { EventEmitter } from 'events';

// Aha! Connector
//
// Authentication: API Key
//
// Supported Widgets:
// - roadmap-overview - Features by status, releases, timeline
// - feature-prioritization - Features by score
// - ideas-portal - User-submitted ideas

interface AhaConfig {
  apiKey: string;
  subdomain: string;
}

interface AhaProduct {
  id: string;
  name: string;
  reference_prefix: string;
  description: string;
  created_at: string;
}

interface AhaFeature {
  id: string;
  reference_num: string;
  name: string;
  description: string;
  workflow_status: {
    id: string;
    name: string;
    color: string;
  };
  release?: {
    id: string;
    name: string;
    release_date: string;
  };
  score?: number;
  effort?: number;
  value?: number;
  assigned_to_user?: {
    id: string;
    name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

interface AhaRelease {
  id: string;
  reference_num: string;
  name: string;
  release_date: string;
  released: boolean;
  parking_lot: boolean;
  features_count: number;
  progress: number;
  created_at: string;
}

interface AhaIdea {
  id: string;
  reference_num: string;
  name: string;
  description: string;
  workflow_status: {
    id: string;
    name: string;
  };
  score: number;
  votes_count: number;
  comments_count: number;
  created_by_portal_user?: {
    email: string;
    name: string;
  };
  created_at: string;
}

interface AhaGoal {
  id: string;
  reference_num: string;
  name: string;
  description: string;
  progress: number;
  success_metric: string;
  time_frame: string;
}

export class AhaConnector extends EventEmitter {
  private config: AhaConfig;
  private baseUrl: string;

  constructor(config: AhaConfig) {
    super();
    this.config = config;
    this.baseUrl = `https://${config.subdomain}.aha.io/api/v1`;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Aha! API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== PRODUCTS ====================

  async getProducts(): Promise<AhaProduct[]> {
    const data = await this.request<{ products: AhaProduct[] }>('/products');
    return data.products || [];
  }

  async getProduct(productId: string): Promise<AhaProduct | null> {
    try {
      const data = await this.request<{ product: AhaProduct }>(`/products/${productId}`);
      return data.product;
    } catch {
      return null;
    }
  }

  // ==================== FEATURES ====================

  async getFeatures(
    productId: string,
    filters?: { status?: string; releaseId?: string }
  ): Promise<AhaFeature[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('workflow_status', filters.status);
    if (filters?.releaseId) params.append('release_id', filters.releaseId);

    const data = await this.request<{ features: AhaFeature[] }>(
      `/products/${productId}/features?${params.toString()}`
    );

    return data.features || [];
  }

  async getFeature(featureId: string): Promise<AhaFeature | null> {
    try {
      const data = await this.request<{ feature: AhaFeature }>(`/features/${featureId}`);
      return data.feature;
    } catch {
      return null;
    }
  }

  async getFeaturesByStatus(productId: string): Promise<Record<string, AhaFeature[]>> {
    const features = await this.getFeatures(productId);
    const byStatus: Record<string, AhaFeature[]> = {};

    features.forEach((f) => {
      const status = f.workflow_status?.name || 'Unknown';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(f);
    });

    return byStatus;
  }

  async getTopScoredFeatures(productId: string, limit: number = 10): Promise<AhaFeature[]> {
    const features = await this.getFeatures(productId);
    return features
      .filter((f) => f.score !== undefined)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }

  // ==================== RELEASES ====================

  async getReleases(productId: string): Promise<AhaRelease[]> {
    const data = await this.request<{ releases: AhaRelease[] }>(`/products/${productId}/releases`);
    return data.releases || [];
  }

  async getUpcomingReleases(productId: string): Promise<AhaRelease[]> {
    const releases = await this.getReleases(productId);
    const now = new Date();

    return releases
      .filter((r) => !r.released && !r.parking_lot && new Date(r.release_date) > now)
      .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime());
  }

  async getRelease(releaseId: string): Promise<AhaRelease | null> {
    try {
      const data = await this.request<{ release: AhaRelease }>(`/releases/${releaseId}`);
      return data.release;
    } catch {
      return null;
    }
  }

  // ==================== IDEAS ====================

  async getIdeas(productId: string): Promise<AhaIdea[]> {
    const data = await this.request<{ ideas: AhaIdea[] }>(`/products/${productId}/ideas`);
    return data.ideas || [];
  }

  async getTopIdeas(productId: string, limit: number = 10): Promise<AhaIdea[]> {
    const ideas = await this.getIdeas(productId);
    return ideas.sort((a, b) => b.votes_count - a.votes_count).slice(0, limit);
  }

  async getIdeasByStatus(productId: string): Promise<Record<string, AhaIdea[]>> {
    const ideas = await this.getIdeas(productId);
    const byStatus: Record<string, AhaIdea[]> = {};

    ideas.forEach((i) => {
      const status = i.workflow_status?.name || 'Unknown';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(i);
    });

    return byStatus;
  }

  // ==================== GOALS ====================

  async getGoals(productId: string): Promise<AhaGoal[]> {
    const data = await this.request<{ goals: AhaGoal[] }>(`/products/${productId}/goals`);
    return data.goals || [];
  }

  // ==================== WIDGET DATA ====================

  async getRoadmapWidgetData(productId: string): Promise<{
    totalFeatures: number;
    byStatus: Record<string, number>;
    upcomingReleases: Array<{
      id: string;
      name: string;
      date: string;
      progress: number;
      featureCount: number;
    }>;
  }> {
    const [features, releases, byStatus] = await Promise.all([
      this.getFeatures(productId),
      this.getUpcomingReleases(productId),
      this.getFeaturesByStatus(productId),
    ]);

    const statusCounts: Record<string, number> = {};
    Object.entries(byStatus).forEach(([status, feats]) => {
      statusCounts[status] = feats.length;
    });

    return {
      totalFeatures: features.length,
      byStatus: statusCounts,
      upcomingReleases: releases.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.name,
        date: r.release_date,
        progress: r.progress,
        featureCount: r.features_count,
      })),
    };
  }

  async getIdeasWidgetData(productId: string): Promise<{
    totalIdeas: number;
    topVoted: Array<{
      id: string;
      name: string;
      votes: number;
      status: string;
    }>;
    byStatus: Record<string, number>;
  }> {
    const [ideas, byStatus] = await Promise.all([
      this.getIdeas(productId),
      this.getIdeasByStatus(productId),
    ]);

    const statusCounts: Record<string, number> = {};
    Object.entries(byStatus).forEach(([status, items]) => {
      statusCounts[status] = items.length;
    });

    const topVoted = ideas
      .sort((a, b) => b.votes_count - a.votes_count)
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        name: i.name,
        votes: i.votes_count,
        status: i.workflow_status?.name || 'Unknown',
      }));

    return {
      totalIdeas: ideas.length,
      topVoted,
      byStatus: statusCounts,
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getProducts();
      return true;
    } catch {
      return false;
    }
  }
}

export const createAhaConnector = (config: AhaConfig): AhaConnector => {
  return new AhaConnector(config);
};
