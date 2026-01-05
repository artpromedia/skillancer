import { EventEmitter } from 'node:events';

// Lattice Connector
// Authentication: API Token
// Widgets: performance-overview, goals-progress, feedback-activity

interface LatticeConfig {
  apiToken: string;
  companyId: string;
}

interface ReviewCycle {
  id: string;
  name: string;
  type: 'annual' | 'mid-year' | '360' | 'probation' | 'custom';
  status: 'draft' | 'active' | 'completed' | 'archived';
  startDate: string;
  endDate: string;
  completionRate: number;
  totalParticipants: number;
  completedReviews: number;
}

interface Review {
  id: string;
  cycleId: string;
  revieweeId: string;
  revieweeName: string;
  reviewerId: string;
  reviewerName: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'acknowledged';
  rating?: number;
  submittedAt?: string;
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  ownerName: string;
  status: 'not_started' | 'on_track' | 'at_risk' | 'behind' | 'completed';
  progress: number;
  dueDate?: string;
  parentGoalId?: string;
  alignedTo?: string;
}

interface FeedbackItem {
  id: string;
  type: 'feedback' | 'praise' | 'recognition';
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  message: string;
  isPublic: boolean;
  createdAt: string;
  values?: string[];
}

interface PerformanceOverview {
  activeCycles: ReviewCycle[];
  overallCompletionRate: number;
  ratingDistribution: Record<string, number>;
  upcomingDeadlines: Array<{ cycleId: string; cycleName: string; deadline: string }>;
}

interface GoalsProgress {
  totalGoals: number;
  byStatus: Record<string, number>;
  averageProgress: number;
  completionRate: number;
  alignmentRate: number;
}

interface FeedbackActivity {
  totalFeedback: number;
  feedbackGiven: number;
  feedbackReceived: number;
  recognitions: number;
  topRecognizedValues: Array<{ value: string; count: number }>;
  trend: Array<{ period: string; count: number }>;
}

export class LatticeConnector extends EventEmitter {
  private config: LatticeConfig | null = null;
  private baseUrl = 'https://api.lattice.com/v1';

  async connect(config: LatticeConfig): Promise<void> {
    this.config = config;
    await this.validateConnection();
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.emit('disconnected');
  }

  private async validateConnection(): Promise<void> {
    await this.request('/company');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config) throw new Error('Not connected');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        'X-Company-Id': this.config.companyId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Lattice API error: ${response.status}`);
    }

    return response.json();
  }

  // ==================== REVIEW CYCLES ====================

  async getReviewCycles(): Promise<ReviewCycle[]> {
    const data = await this.request<{ cycles: ReviewCycle[] }>('/review-cycles');
    return data.cycles;
  }

  async getReviewCycle(cycleId: string): Promise<ReviewCycle> {
    return this.request<ReviewCycle>(`/review-cycles/${cycleId}`);
  }

  async getReviews(cycleId: string): Promise<Review[]> {
    const data = await this.request<{ reviews: Review[] }>(`/review-cycles/${cycleId}/reviews`);
    return data.reviews;
  }

  async getReviewStats(cycleId: string): Promise<{
    completionRate: number;
    ratingDistribution: Record<string, number>;
    avgRating: number;
  }> {
    return this.request(`/review-cycles/${cycleId}/stats`);
  }

  // ==================== GOALS ====================

  async getGoals(filters?: { status?: string; ownerId?: string }): Promise<Goal[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.ownerId) params.append('owner_id', filters.ownerId);

    const data = await this.request<{ goals: Goal[] }>(`/goals?${params}`);
    return data.goals;
  }

  async getGoal(goalId: string): Promise<Goal> {
    return this.request<Goal>(`/goals/${goalId}`);
  }

  async getGoalProgress(): Promise<GoalsProgress> {
    return this.request<GoalsProgress>('/goals/progress');
  }

  // ==================== FEEDBACK ====================

  async getFeedback(filters?: { type?: string; since?: string }): Promise<FeedbackItem[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.since) params.append('since', filters.since);

    const data = await this.request<{ feedback: FeedbackItem[] }>(`/feedback?${params}`);
    return data.feedback;
  }

  async getFeedbackActivity(
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<FeedbackActivity> {
    return this.request<FeedbackActivity>(`/feedback/activity?period=${period}`);
  }

  // ==================== WIDGET DATA ====================

  async getPerformanceOverview(): Promise<PerformanceOverview> {
    const cycles = await this.getReviewCycles();
    const activeCycles = cycles.filter((c) => c.status === 'active');

    const totalParticipants = activeCycles.reduce((sum, c) => sum + c.totalParticipants, 0);
    const completedReviews = activeCycles.reduce((sum, c) => sum + c.completedReviews, 0);

    const upcomingDeadlines = activeCycles
      .map((c) => ({
        cycleId: c.id,
        cycleName: c.name,
        deadline: c.endDate,
      }))
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

    return {
      activeCycles,
      overallCompletionRate:
        totalParticipants > 0 ? (completedReviews / totalParticipants) * 100 : 0,
      ratingDistribution: {},
      upcomingDeadlines,
    };
  }

  async getGoalsWidgetData(): Promise<GoalsProgress> {
    return this.getGoalProgress();
  }

  async getFeedbackWidgetData(): Promise<FeedbackActivity> {
    return this.getFeedbackActivity('month');
  }
}

export const latticeConnector = new LatticeConnector();
