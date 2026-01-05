import { EventEmitter } from 'node:events';

// UserTesting Connector
//
// Authentication: API Key
//
// Supported Widgets:
// - user-research - Studies, recordings, insights
// - user-feedback - Test results, NPS, usability scores

interface UserTestingConfig {
  apiKey: string;
  apiSecret: string;
}

interface Study {
  id: string;
  name: string;
  description: string;
  type: 'moderated' | 'unmoderated' | 'live_conversation';
  status: 'draft' | 'active' | 'paused' | 'completed';
  targetParticipants: number;
  completedParticipants: number;
  createdAt: string;
  launchedAt?: string;
  completedAt?: string;
}

interface Participant {
  id: string;
  studyId: string;
  sessionId: string;
  status: 'completed' | 'in_progress' | 'screened_out' | 'dropped';
  duration: number;
  completedAt?: string;
  demographics?: {
    age?: string;
    gender?: string;
    location?: string;
    occupation?: string;
  };
}

interface Recording {
  id: string;
  studyId: string;
  participantId: string;
  duration: number;
  videoUrl: string;
  transcriptUrl?: string;
  highlights: RecordingHighlight[];
  createdAt: string;
}

interface RecordingHighlight {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  tags: string[];
}

interface Task {
  id: string;
  studyId: string;
  name: string;
  description: string;
  type: 'task' | 'question' | 'rating';
  successRate?: number;
  avgDuration?: number;
  responses?: TaskResponse[];
}

interface TaskResponse {
  participantId: string;
  success: boolean;
  duration: number;
  rating?: number;
  answer?: string;
}

interface StudyMetrics {
  studyId: string;
  npsScore?: number;
  susScore?: number;
  taskSuccessRate: number;
  avgCompletionTime: number;
  participantCount: number;
}

export class UserTestingConnector extends EventEmitter {
  private config: UserTestingConfig;
  private baseUrl = 'https://api.usertesting.com/v2';

  constructor(config: UserTestingConfig) {
    super();
    this.config = config;
  }

  private get headers(): Record<string, string> {
    const credentials = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString(
      'base64'
    );

    return {
      Authorization: `Basic ${credentials}`,
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
      throw new Error(`UserTesting API Error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== STUDIES ====================

  async getStudies(status?: Study['status']): Promise<Study[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);

    const data = await this.request<{ data: Study[] }>(`/studies?${params.toString()}`);

    return data.data || [];
  }

  async getStudy(studyId: string): Promise<Study | null> {
    try {
      const data = await this.request<{ data: Study }>(`/studies/${studyId}`);
      return data.data;
    } catch {
      return null;
    }
  }

  async getActiveStudies(): Promise<Study[]> {
    return this.getStudies('active');
  }

  async getCompletedStudies(): Promise<Study[]> {
    return this.getStudies('completed');
  }

  async getRecentStudies(limit: number = 10): Promise<Study[]> {
    const studies = await this.getStudies();
    return studies
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // ==================== PARTICIPANTS ====================

  async getParticipants(studyId: string): Promise<Participant[]> {
    const data = await this.request<{ data: Participant[] }>(`/studies/${studyId}/participants`);
    return data.data || [];
  }

  async getCompletedParticipants(studyId: string): Promise<Participant[]> {
    const participants = await this.getParticipants(studyId);
    return participants.filter((p) => p.status === 'completed');
  }

  // ==================== RECORDINGS ====================

  async getRecordings(studyId: string): Promise<Recording[]> {
    const data = await this.request<{ data: Recording[] }>(`/studies/${studyId}/recordings`);
    return data.data || [];
  }

  async getRecording(studyId: string, recordingId: string): Promise<Recording | null> {
    try {
      const data = await this.request<{ data: Recording }>(
        `/studies/${studyId}/recordings/${recordingId}`
      );
      return data.data;
    } catch {
      return null;
    }
  }

  async getAllHighlights(studyId: string): Promise<RecordingHighlight[]> {
    const recordings = await this.getRecordings(studyId);
    return recordings.flatMap((r) => r.highlights);
  }

  // ==================== TASKS ====================

  async getTasks(studyId: string): Promise<Task[]> {
    const data = await this.request<{ data: Task[] }>(`/studies/${studyId}/tasks`);
    return data.data || [];
  }

  async getTaskSuccessRates(studyId: string): Promise<
    Array<{
      taskId: string;
      name: string;
      successRate: number;
      avgDuration: number;
    }>
  > {
    const tasks = await this.getTasks(studyId);
    return tasks.map((t) => ({
      taskId: t.id,
      name: t.name,
      successRate: t.successRate || 0,
      avgDuration: t.avgDuration || 0,
    }));
  }

  // ==================== METRICS ====================

  async getStudyMetrics(studyId: string): Promise<StudyMetrics> {
    const data = await this.request<{ data: StudyMetrics }>(`/studies/${studyId}/metrics`);
    return data.data;
  }

  async getAggregateMetrics(): Promise<{
    totalStudies: number;
    avgNps: number;
    avgSus: number;
    avgTaskSuccess: number;
    totalParticipants: number;
  }> {
    const studies = await this.getCompletedStudies();
    const metricsPromises = studies
      .slice(0, 20)
      .map((s) => this.getStudyMetrics(s.id).catch(() => null));

    const metrics = (await Promise.all(metricsPromises)).filter(
      (m): m is StudyMetrics => m !== null
    );

    if (metrics.length === 0) {
      return {
        totalStudies: studies.length,
        avgNps: 0,
        avgSus: 0,
        avgTaskSuccess: 0,
        totalParticipants: 0,
      };
    }

    const npsScores = metrics.filter((m) => m.npsScore !== undefined);
    const susScores = metrics.filter((m) => m.susScore !== undefined);

    return {
      totalStudies: studies.length,
      avgNps:
        npsScores.length > 0
          ? npsScores.reduce((sum, m) => sum + (m.npsScore || 0), 0) / npsScores.length
          : 0,
      avgSus:
        susScores.length > 0
          ? susScores.reduce((sum, m) => sum + (m.susScore || 0), 0) / susScores.length
          : 0,
      avgTaskSuccess: metrics.reduce((sum, m) => sum + m.taskSuccessRate, 0) / metrics.length,
      totalParticipants: metrics.reduce((sum, m) => sum + m.participantCount, 0),
    };
  }

  // ==================== WIDGET DATA ====================

  async getUserResearchWidgetData(): Promise<{
    activeStudies: number;
    totalParticipants: number;
    avgCompletionRate: number;
    recentStudies: Array<{
      id: string;
      name: string;
      status: string;
      progress: number;
    }>;
  }> {
    const [active, all] = await Promise.all([this.getActiveStudies(), this.getStudies()]);

    const totalParticipants = all.reduce((sum, s) => sum + s.completedParticipants, 0);
    const avgCompletion =
      all.length > 0
        ? all.reduce(
            (sum, s) =>
              sum + (s.targetParticipants > 0 ? s.completedParticipants / s.targetParticipants : 0),
            0
          ) / all.length
        : 0;

    return {
      activeStudies: active.length,
      totalParticipants,
      avgCompletionRate: Math.round(avgCompletion * 100),
      recentStudies: all.slice(0, 5).map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        progress:
          s.targetParticipants > 0
            ? Math.round((s.completedParticipants / s.targetParticipants) * 100)
            : 0,
      })),
    };
  }

  async getUserFeedbackWidgetData(): Promise<{
    avgNps: number;
    avgSus: number;
    avgTaskSuccess: number;
    recentHighlights: Array<{
      text: string;
      studyName: string;
      tags: string[];
    }>;
  }> {
    const aggregateMetrics = await this.getAggregateMetrics();
    const recentStudies = await this.getRecentStudies(5);

    const allHighlights: Array<{
      text: string;
      studyName: string;
      tags: string[];
    }> = [];

    for (const study of recentStudies.slice(0, 3)) {
      const highlights = await this.getAllHighlights(study.id);
      highlights.slice(0, 3).forEach((h) => {
        allHighlights.push({
          text: h.text,
          studyName: study.name,
          tags: h.tags,
        });
      });
    }

    return {
      avgNps: Math.round(aggregateMetrics.avgNps),
      avgSus: Math.round(aggregateMetrics.avgSus),
      avgTaskSuccess: Math.round(aggregateMetrics.avgTaskSuccess * 100),
      recentHighlights: allHighlights.slice(0, 5),
    };
  }

  // ==================== CONNECTION TEST ====================

  async testConnection(): Promise<boolean> {
    try {
      await this.getStudies();
      return true;
    } catch {
      return false;
    }
  }
}

export const createUserTestingConnector = (config: UserTestingConfig): UserTestingConnector => {
  return new UserTestingConnector(config);
};
