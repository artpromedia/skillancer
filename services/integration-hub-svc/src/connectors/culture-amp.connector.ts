import { EventEmitter } from 'node:events';

// Culture Amp Connector
// Authentication: API Token
// Widgets: engagement-score, survey-results, enps-score

interface CultureAmpConfig {
  apiToken: string;
  accountId: string;
}

interface Survey {
  id: string;
  name: string;
  type: 'engagement' | 'pulse' | 'onboarding' | 'exit' | 'custom';
  status: 'draft' | 'active' | 'closed';
  launchDate?: string;
  closeDate?: string;
  responseRate: number;
  totalResponses: number;
  totalInvited: number;
}

interface SurveyResult {
  surveyId: string;
  overallScore: number;
  participationRate: number;
  factors: Array<{
    name: string;
    score: number;
    benchmark: number;
    trend: number;
  }>;
  demographics: Record<string, Record<string, number>>;
}

interface EngagementScore {
  current: number;
  previous: number;
  trend: number;
  benchmark: number;
  percentile: number;
}

interface ENPSData {
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
  totalResponses: number;
  trend: number;
}

interface Benchmark {
  category: string;
  industryAvg: number;
  topQuartile: number;
  bottomQuartile: number;
}

export class CultureAmpConnector extends EventEmitter {
  private config: CultureAmpConfig | null = null;
  private baseUrl = 'https://api.cultureamp.com/v1';

  async connect(config: CultureAmpConfig): Promise<void> {
    this.config = config;
    await this.validateConnection();
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.emit('disconnected');
  }

  private async validateConnection(): Promise<void> {
    await this.request('/account');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.config) throw new Error('Not connected');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        'X-Account-Id': this.config.accountId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Culture Amp API error: ${response.status}`);
    }

    return response.json();
  }

  // ==================== SURVEYS ====================

  async getSurveys(): Promise<Survey[]> {
    const data = await this.request<{ surveys: Survey[] }>('/surveys');
    return data.surveys;
  }

  async getSurvey(surveyId: string): Promise<Survey> {
    return this.request<Survey>(`/surveys/${surveyId}`);
  }

  async getSurveyResults(surveyId: string): Promise<SurveyResult> {
    return this.request<SurveyResult>(`/surveys/${surveyId}/results`);
  }

  // ==================== ENGAGEMENT ====================

  async getEngagementScore(): Promise<EngagementScore> {
    return this.request<EngagementScore>('/engagement/score');
  }

  async getEngagementTrend(periods: number = 4): Promise<Array<{ period: string; score: number }>> {
    const data = await this.request<{ trend: Array<{ period: string; score: number }> }>(
      `/engagement/trend?periods=${periods}`
    );
    return data.trend;
  }

  // ==================== eNPS ====================

  async getENPS(): Promise<ENPSData> {
    return this.request<ENPSData>('/enps');
  }

  async getENPSTrend(periods: number = 4): Promise<Array<{ period: string; score: number }>> {
    const data = await this.request<{ trend: Array<{ period: string; score: number }> }>(
      `/enps/trend?periods=${periods}`
    );
    return data.trend;
  }

  // ==================== BENCHMARKS ====================

  async getBenchmarks(): Promise<Benchmark[]> {
    const data = await this.request<{ benchmarks: Benchmark[] }>('/benchmarks');
    return data.benchmarks;
  }

  async getIndustryBenchmark(industry: string): Promise<Benchmark> {
    return this.request<Benchmark>(`/benchmarks/industry/${encodeURIComponent(industry)}`);
  }

  // ==================== KEY DRIVERS ====================

  async getKeyDrivers(
    surveyId: string
  ): Promise<Array<{ driver: string; impact: number; score: number }>> {
    const data = await this.request<{
      drivers: Array<{ driver: string; impact: number; score: number }>;
    }>(`/surveys/${surveyId}/drivers`);
    return data.drivers;
  }

  // ==================== WIDGET DATA ====================

  async getEngagementWidgetData(): Promise<{
    score: EngagementScore;
    trend: Array<{ period: string; score: number }>;
    benchmark: number;
  }> {
    const [score, trend, benchmarks] = await Promise.all([
      this.getEngagementScore(),
      this.getEngagementTrend(),
      this.getBenchmarks(),
    ]);

    const overallBenchmark = benchmarks.find((b) => b.category === 'overall');

    return {
      score,
      trend,
      benchmark: overallBenchmark?.industryAvg ?? 0,
    };
  }

  async getENPSWidgetData(): Promise<{
    enps: ENPSData;
    trend: Array<{ period: string; score: number }>;
  }> {
    const [enps, trend] = await Promise.all([this.getENPS(), this.getENPSTrend()]);

    return { enps, trend };
  }

  async getSurveyResultsWidgetData(surveyId: string): Promise<{
    survey: Survey;
    results: SurveyResult;
    drivers: Array<{ driver: string; impact: number; score: number }>;
  }> {
    const [survey, results, drivers] = await Promise.all([
      this.getSurvey(surveyId),
      this.getSurveyResults(surveyId),
      this.getKeyDrivers(surveyId),
    ]);

    return { survey, results, drivers };
  }
}

export const cultureAmpConnector = new CultureAmpConnector();
