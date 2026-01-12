/**
 * CPO Dashboard API Client
 * Handles all CPO (Chief Product Officer) dashboard API calls
 */

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

// Helper for API calls
async function fetchApi<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Types
export interface UserMetricsData {
  dau: number;
  wau: number;
  mau: number;
  dauTrend: number;
  wauTrend: number;
  mauTrend: number;
  stickiness: number;
  sparklineData?: Array<{ date: string; dau: number; wau: number; mau: number }>;
}

export interface FeatureData {
  name: string;
  adoptionRate: number;
  activeUsers: number;
  trend: number;
  targetAdoption: number;
  launchDate?: string;
}

export interface FeatureAdoptionData {
  features: FeatureData[];
  totalUsers: number;
}

export interface Experiment {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'draft';
  startDate: string;
  endDate?: string;
  variants: Array<{
    name: string;
    traffic: number;
    conversions: number;
    conversionRate: number;
  }>;
  sampleSize: number;
  targetSampleSize: number;
  confidence?: number;
  winner?: string;
}

export interface ExperimentsData {
  experiments: Experiment[];
  activeCount: number;
  completedCount: number;
}

export interface RoadmapItem {
  id: string;
  title: string;
  description?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  quarter: string;
  progress: number;
  team?: string;
  dueDate?: string;
}

export interface FeatureRoadmapData {
  items: RoadmapItem[];
  quarters: string[];
}

export interface FeedbackItem {
  id: string;
  type: 'feature_request' | 'bug' | 'improvement' | 'praise';
  title: string;
  description?: string;
  source: string;
  votes: number;
  status: 'new' | 'under_review' | 'planned' | 'in_progress' | 'completed' | 'declined';
  sentiment?: 'positive' | 'neutral' | 'negative';
  createdAt: string;
  userId?: string;
}

export interface UserFeedbackData {
  feedback: FeedbackItem[];
  stats: {
    total: number;
    featureRequests: number;
    bugs: number;
    improvements: number;
    avgSentiment: number;
  };
}

export interface PrioritizationItem {
  id: string;
  title: string;
  description?: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;
  category?: string;
  status: 'backlog' | 'planned' | 'in_progress' | 'done';
}

export interface PrioritizationData {
  items: PrioritizationItem[];
}

export interface ResearchInsight {
  id: string;
  title: string;
  summary: string;
  type: 'user_interview' | 'survey' | 'analytics' | 'competitive';
  date: string;
  participants?: number;
  keyFindings: string[];
  recommendations?: string[];
}

export interface ResearchInsightsData {
  insights: ResearchInsight[];
  recentStudies: number;
  totalParticipants: number;
}

export interface PRD {
  id: string;
  title: string;
  status: 'draft' | 'review' | 'approved' | 'archived';
  author: string;
  createdAt: string;
  updatedAt: string;
  feature?: string;
  summary?: string;
}

export interface RecentPRDsData {
  prds: PRD[];
  draftCount: number;
  reviewCount: number;
}

// CPO API
export const cpoApi = {
  /**
   * Get user metrics (DAU/WAU/MAU)
   */
  async getUserMetrics(engagementId: string): Promise<UserMetricsData> {
    return fetchApi<UserMetricsData>(`/engagements/${engagementId}/cpo/metrics/users`);
  },

  /**
   * Get feature adoption data
   */
  async getFeatureAdoption(engagementId: string): Promise<FeatureAdoptionData> {
    return fetchApi<FeatureAdoptionData>(`/engagements/${engagementId}/cpo/features/adoption`);
  },

  /**
   * Get experiments data
   */
  async getExperiments(engagementId: string): Promise<ExperimentsData> {
    return fetchApi<ExperimentsData>(`/engagements/${engagementId}/cpo/experiments`);
  },

  /**
   * Get feature roadmap
   */
  async getRoadmap(engagementId: string): Promise<FeatureRoadmapData> {
    return fetchApi<FeatureRoadmapData>(`/engagements/${engagementId}/cpo/roadmap`);
  },

  /**
   * Get user feedback
   */
  async getUserFeedback(engagementId: string): Promise<UserFeedbackData> {
    return fetchApi<UserFeedbackData>(`/engagements/${engagementId}/cpo/feedback`);
  },

  /**
   * Get prioritization data
   */
  async getPrioritization(engagementId: string): Promise<PrioritizationData> {
    return fetchApi<PrioritizationData>(`/engagements/${engagementId}/cpo/prioritization`);
  },

  /**
   * Get research insights
   */
  async getResearchInsights(engagementId: string): Promise<ResearchInsightsData> {
    return fetchApi<ResearchInsightsData>(`/engagements/${engagementId}/cpo/research`);
  },

  /**
   * Get recent PRDs
   */
  async getRecentPRDs(engagementId: string): Promise<RecentPRDsData> {
    return fetchApi<RecentPRDsData>(`/engagements/${engagementId}/cpo/prds`);
  },

  /**
   * Get all CPO dashboard data in one call
   */
  async getDashboardData(engagementId: string): Promise<{
    userMetrics: UserMetricsData;
    featureAdoption: FeatureAdoptionData;
    experiments: ExperimentsData;
    roadmap: FeatureRoadmapData;
    feedback: UserFeedbackData;
    prioritization: PrioritizationData;
    research: ResearchInsightsData;
    prds: RecentPRDsData;
  }> {
    return fetchApi(`/engagements/${engagementId}/cpo/dashboard`);
  },
};

export default cpoApi;
