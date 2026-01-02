import { EventEmitter } from 'events';

// Productboard Connector
//
// Authentication: API Token
//
// Supported Widgets:
// 1. roadmap-overview - Features by status, timeline view, release planning
// 2. feature-prioritization - Features by score, user impact, effort estimates
// 3. user-insights - Notes and feedback, feature requests, insight trends

interface ProductboardConfig {
  apiToken: string;
}

interface Feature {
  id: string;
  name: string;
  description: string;
  status: {
    id: string;
    name: string;
  };
  parent?: {
    id: string;
    name: string;
  };
  owner?: {
    id: string;
    email: string;
    name: string;
  };
  timeframe?: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  score?: number;
  userImpact?: number;
  effort?: number;
  createdAt: string;
  updatedAt: string;
}

interface Release {
  id: string;
  name: string;
  description: string;
  releaseDate: string;
  status: 'planned' | 'in_progress' | 'released';
  features: string[];
}

interface Note {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceUrl?: string;
  tags: string[];
  company?: {
    id: string;
    name: string;
  };
  user?: {
    email: string;
    name: string;
  };
  createdAt: string;
}

interface Component {
  id: string;
  name: string;
  description: string;
  featureCount: number;
}

interface Objective {
  id: string;
  name: string;
  description: string;
  progress: number;
  features: string[];
}

export class ProductboardConnector extends EventEmitter {
  private config: ProductboardConfig;
  private baseUrl = 'https://api.productboard.com';

  constructor(config: ProductboardConfig) {
    super();
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
      'X-Version': '1',
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
      throw new Error(`Productboard API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== FEATURES ====================

  async getFeatures(filters?: {
    status?: string;
    componentId?: string;
    ownerId?: string;
  }): Promise<Feature[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status.name', filters.status);
    if (filters?.componentId) params.append('component.id', filters.componentId);

    const data = await this.request<{ data: Feature[] }>(`/features?${params.toString()}`);

    return data.data || [];
  }

  async getFeature(featureId: string): Promise<Feature | null> {
    try {
      const data = await this.request<{ data: Feature }>(`/features/${featureId}`);
      return data.data;
    } catch {
      return null;
    }
  }

  async getFeaturesByStatus(): Promise<Record<string, Feature[]>> {
    const features = await this.getFeatures();
    const byStatus: Record<string, Feature[]> = {};

    features.forEach((f) => {
      const status = f.status?.name || 'Unknown';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(f);
    });

    return byStatus;
  }

  async getFeaturesByTimeframe(): Promise<Record<string, Feature[]>> {
    const features = await this.getFeatures();
    const byTimeframe: Record<string, Feature[]> = {};

    features.forEach((f) => {
      const timeframe = f.timeframe?.name || 'Unscheduled';
      if (!byTimeframe[timeframe]) byTimeframe[timeframe] = [];
      byTimeframe[timeframe].push(f);
    });

    return byTimeframe;
  }

  async getTopScoredFeatures(limit: number = 10): Promise<Feature[]> {
    const features = await this.getFeatures();
    return features
      .filter((f) => f.score !== undefined)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }

  // ==================== RELEASES ====================

  async getReleases(): Promise<Release[]> {
    const data = await this.request<{ data: Release[] }>('/releases');
    return data.data || [];
  }

  async getUpcomingReleases(): Promise<Release[]> {
    const releases = await this.getReleases();
    const now = new Date();
    return releases
      .filter((r) => new Date(r.releaseDate) > now && r.status !== 'released')
      .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());
  }

  async getRelease(releaseId: string): Promise<Release | null> {
    const releases = await this.getReleases();
    return releases.find((r) => r.id === releaseId) || null;
  }

  // ==================== NOTES (INSIGHTS) ====================

  async getNotes(filters?: { source?: string; tag?: string; companyId?: string }): Promise<Note[]> {
    const params = new URLSearchParams();
    if (filters?.source) params.append('source', filters.source);
    if (filters?.tag) params.append('tags.name', filters.tag);

    const data = await this.request<{ data: Note[] }>(`/notes?${params.toString()}`);

    return data.data || [];
  }

  async getRecentNotes(limit: number = 20): Promise<Note[]> {
    const notes = await this.getNotes();
    return notes
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async getNotesByTag(): Promise<Record<string, Note[]>> {
    const notes = await this.getNotes();
    const byTag: Record<string, Note[]> = {};

    notes.forEach((n) => {
      n.tags.forEach((tag) => {
        if (!byTag[tag]) byTag[tag] = [];
        byTag[tag].push(n);
      });
    });

    return byTag;
  }

  async getTopTags(limit: number = 10): Promise<Array<{ tag: string; count: number }>> {
    const byTag = await this.getNotesByTag();
    return Object.entries(byTag)
      .map(([tag, notes]) => ({ tag, count: notes.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // ==================== COMPONENTS ====================

  async getComponents(): Promise<Component[]> {
    const data = await this.request<{ data: Component[] }>('/components');
    return data.data || [];
  }

  // ==================== OBJECTIVES ====================

  async getObjectives(): Promise<Objective[]> {
    const data = await this.request<{ data: Objective[] }>('/objectives');
    return data.data || [];
  }

  async getObjective(objectiveId: string): Promise<Objective | null> {
    const objectives = await this.getObjectives();
    return objectives.find((o) => o.id === objectiveId) || null;
  }

  // ==================== WIDGET DATA ====================

  async getRoadmapWidgetData(): Promise<{
    totalFeatures: number;
    byStatus: Record<string, number>;
    upcomingReleases: Array<{
      id: string;
      name: string;
      date: string;
      featureCount: number;
    }>;
    currentQuarterFeatures: Feature[];
  }> {
    const [features, releases, byStatus] = await Promise.all([
      this.getFeatures(),
      this.getUpcomingReleases(),
      this.getFeaturesByStatus(),
    ]);

    const statusCounts: Record<string, number> = {};
    Object.entries(byStatus).forEach(([status, feats]) => {
      statusCounts[status] = feats.length;
    });

    const now = new Date();
    const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
    const currentQuarterFeatures = features.filter((f) => {
      if (!f.timeframe?.endDate) return false;
      const endDate = new Date(f.timeframe.endDate);
      return endDate <= quarterEnd && endDate >= now;
    });

    return {
      totalFeatures: features.length,
      byStatus: statusCounts,
      upcomingReleases: releases.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.name,
        date: r.releaseDate,
        featureCount: r.features.length,
      })),
      currentQuarterFeatures: currentQuarterFeatures.slice(0, 10),
    };
  }

  async getPrioritizationWidgetData(): Promise<{
    topFeatures: Array<{
      id: string;
      name: string;
      score: number;
      userImpact: number;
      effort: number;
    }>;
    avgScore: number;
    unscored: number;
  }> {
    const features = await this.getFeatures();
    const scored = features.filter((f) => f.score !== undefined);
    const unscored = features.length - scored.length;

    const avgScore =
      scored.length > 0 ? scored.reduce((sum, f) => sum + (f.score || 0), 0) / scored.length : 0;

    const topFeatures = scored
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10)
      .map((f) => ({
        id: f.id,
        name: f.name,
        score: f.score || 0,
        userImpact: f.userImpact || 0,
        effort: f.effort || 0,
      }));

    return {
      topFeatures,
      avgScore: Math.round(avgScore * 10) / 10,
      unscored,
    };
  }

  async getUserInsightsWidgetData(): Promise<{
    totalNotes: number;
    recentNotes: Note[];
    topThemes: Array<{ tag: string; count: number }>;
    notesBySource: Record<string, number>;
  }> {
    const [notes, topThemes] = await Promise.all([this.getNotes(), this.getTopTags(5)]);

    const notesBySource: Record<string, number> = {};
    notes.forEach((n) => {
      notesBySource[n.source] = (notesBySource[n.source] || 0) + 1;
    });

    return {
      totalNotes: notes.length,
      recentNotes: notes
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
      topThemes,
      notesBySource,
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getFeatures();
      return true;
    } catch {
      return false;
    }
  }
}

export const createProductboardConnector = (config: ProductboardConfig): ProductboardConnector => {
  return new ProductboardConnector(config);
};
