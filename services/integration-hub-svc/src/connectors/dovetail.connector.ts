import { EventEmitter } from 'events';

// Dovetail Connector
//
// Authentication: API Token
//
// Supported Widgets:
// - user-feedback - Research insights, themes, sentiment
// - user-research - Projects, sessions, highlights

interface DovetailConfig {
  apiToken: string;
  workspaceId: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  highlightsCount: number;
  notesCount: number;
  insightsCount: number;
}

interface Highlight {
  id: string;
  text: string;
  sourceType: 'note' | 'transcript' | 'video';
  tags: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  projectId: string;
  noteId?: string;
  createdAt: string;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  evidenceCount: number;
  tags: string[];
  status: 'draft' | 'published';
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface Note {
  id: string;
  title: string;
  content: string;
  projectId: string;
  participantId?: string;
  highlightsCount: number;
  createdAt: string;
}

interface Theme {
  id: string;
  name: string;
  description: string;
  highlightCount: number;
  projectIds: string[];
}

export class DovetailConnector extends EventEmitter {
  private config: DovetailConfig;
  private baseUrl = 'https://dovetailapp.com/api/v1';

  constructor(config: DovetailConfig) {
    super();
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/workspaces/${this.config.workspaceId}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dovetail API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== PROJECTS ====================

  async getProjects(status?: 'active' | 'archived'): Promise<Project[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const data = await this.request<{ data: Project[] }>(`/projects?${params.toString()}`);

    return data.data || [];
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      const data = await this.request<{ data: Project }>(`/projects/${projectId}`);
      return data.data;
    } catch {
      return null;
    }
  }

  async getActiveProjects(): Promise<Project[]> {
    return this.getProjects('active');
  }

  // ==================== HIGHLIGHTS ====================

  async getHighlights(projectId?: string): Promise<Highlight[]> {
    const endpoint = projectId ? `/projects/${projectId}/highlights` : '/highlights';

    const data = await this.request<{ data: Highlight[] }>(endpoint);
    return data.data || [];
  }

  async getHighlightsByTag(tag: string): Promise<Highlight[]> {
    const highlights = await this.getHighlights();
    return highlights.filter((h) => h.tags.includes(tag));
  }

  async getHighlightsBySentiment(
    sentiment: 'positive' | 'negative' | 'neutral'
  ): Promise<Highlight[]> {
    const highlights = await this.getHighlights();
    return highlights.filter((h) => h.sentiment === sentiment);
  }

  async getRecentHighlights(limit: number = 20): Promise<Highlight[]> {
    const highlights = await this.getHighlights();
    return highlights
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // ==================== INSIGHTS ====================

  async getInsights(projectId?: string): Promise<Insight[]> {
    const endpoint = projectId ? `/projects/${projectId}/insights` : '/insights';

    const data = await this.request<{ data: Insight[] }>(endpoint);
    return data.data || [];
  }

  async getPublishedInsights(): Promise<Insight[]> {
    const insights = await this.getInsights();
    return insights.filter((i) => i.status === 'published');
  }

  async getRecentInsights(limit: number = 10): Promise<Insight[]> {
    const insights = await this.getInsights();
    return insights
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  // ==================== TAGS ====================

  async getTags(): Promise<Tag[]> {
    const data = await this.request<{ data: Tag[] }>('/tags');
    return data.data || [];
  }

  async getTopTags(limit: number = 10): Promise<Tag[]> {
    const tags = await this.getTags();
    return tags.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  // ==================== THEMES ====================

  async getThemes(): Promise<Theme[]> {
    const data = await this.request<{ data: Theme[] }>('/themes');
    return data.data || [];
  }

  async getTopThemes(limit: number = 10): Promise<Theme[]> {
    const themes = await this.getThemes();
    return themes.sort((a, b) => b.highlightCount - a.highlightCount).slice(0, limit);
  }

  // ==================== NOTES ====================

  async getNotes(projectId: string): Promise<Note[]> {
    const data = await this.request<{ data: Note[] }>(`/projects/${projectId}/notes`);
    return data.data || [];
  }

  // ==================== WIDGET DATA ====================

  async getUserFeedbackWidgetData(): Promise<{
    totalHighlights: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number };
    topThemes: Array<{ name: string; count: number }>;
    recentInsights: Insight[];
  }> {
    const [highlights, themes, insights] = await Promise.all([
      this.getHighlights(),
      this.getTopThemes(5),
      this.getRecentInsights(5),
    ]);

    const sentimentBreakdown = {
      positive: highlights.filter((h) => h.sentiment === 'positive').length,
      negative: highlights.filter((h) => h.sentiment === 'negative').length,
      neutral: highlights.filter((h) => h.sentiment === 'neutral' || !h.sentiment).length,
    };

    return {
      totalHighlights: highlights.length,
      sentimentBreakdown,
      topThemes: themes.map((t) => ({ name: t.name, count: t.highlightCount })),
      recentInsights: insights,
    };
  }

  async getUserResearchWidgetData(): Promise<{
    activeProjects: number;
    totalInsights: number;
    totalHighlights: number;
    projects: Array<{
      id: string;
      name: string;
      highlights: number;
      insights: number;
    }>;
    topTags: Array<{ name: string; count: number }>;
  }> {
    const [projects, insights, highlights, tags] = await Promise.all([
      this.getActiveProjects(),
      this.getInsights(),
      this.getHighlights(),
      this.getTopTags(5),
    ]);

    return {
      activeProjects: projects.length,
      totalInsights: insights.length,
      totalHighlights: highlights.length,
      projects: projects.slice(0, 5).map((p) => ({
        id: p.id,
        name: p.name,
        highlights: p.highlightsCount,
        insights: p.insightsCount,
      })),
      topTags: tags.map((t) => ({ name: t.name, count: t.count })),
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getProjects();
      return true;
    } catch {
      return false;
    }
  }
}

export const createDovetailConnector = (config: DovetailConfig): DovetailConnector => {
  return new DovetailConnector(config);
};
