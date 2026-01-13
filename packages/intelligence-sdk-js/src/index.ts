/**
 * Skillancer Intelligence SDK for JavaScript/TypeScript
 * Sprint M10: Talent Intelligence API
 *
 * Official SDK for the Skillancer Talent Intelligence API.
 * Provides type-safe access to rate benchmarks, availability,
 * demand signals, and workforce planning endpoints.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

export interface SkillancerConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    request_id: string;
    timestamp: string;
  };
}

// Rate Types
export interface RateBenchmark {
  skill: string;
  experience_level: string | null;
  location: string | null;
  currency: string;
  sample_size: number;
  p10_rate: number;
  p25_rate: number;
  median_rate: number;
  p75_rate: number;
  p90_rate: number;
  trends: {
    yoy_change: number;
    qoq_change: number;
    mom_change: number;
  };
  confidence_score: number;
  data_freshness: string;
}

export interface RateComparison {
  skills: Array<{
    skill: string;
    median_rate: number;
    p25_rate: number;
    p75_rate: number;
    sample_size: number;
  }>;
  base_skill: string;
  comparison_date: string;
}

export interface RateHistory {
  skill: string;
  location: string | null;
  periods: number;
  history: Array<{
    period: string;
    median_rate: number;
    p25_rate: number;
    p75_rate: number;
    sample_size: number;
  }>;
  trend_analysis: {
    direction: string;
    strength: number;
    forecast_next_quarter: number;
  };
}

// Availability Types
export interface AvailabilityData {
  skill: string;
  experience_level: string | null;
  location: string | null;
  available_now: number;
  available_7_days: number;
  available_30_days: number;
  available_90_days: number;
  total_qualified: number;
  availability_score: number;
  avg_hours_per_week: number | null;
  total_hours_available: number | null;
  snapshot_date: string;
}

export interface AvailabilityForecast {
  skill: string;
  location: string | null;
  current_available: number;
  forecast: Array<{
    period: string;
    projected: number;
    confidence: number;
  }>;
  factors: {
    project_completions: number;
    seasonal_adjustment: number;
    growth_trend: number;
  };
}

export interface RegionalAvailability {
  skill: string;
  total_global: number;
  regions: Array<{
    region: string;
    region_name: string;
    available_now: number;
    total_qualified: number;
    availability_score: number;
    avg_rate: number | null;
  }>;
}

// Demand Types
export interface DemandData {
  skill: string;
  location: string | null;
  current_demand: number;
  demand_score: number;
  supply_demand_ratio: number;
  open_positions: number;
  avg_time_to_fill: number;
  competition_level: string;
  trend_direction: string;
  trend_strength: number;
  snapshot_date: string;
}

export interface EmergingSkill {
  skill: string;
  category: string;
  growth_rate: number;
  current_demand: number;
  projected_demand: number;
  time_horizon: string;
  related_skills: string[];
  drivers: string[];
  confidence_level: number;
}

export interface DecliningSkill {
  skill: string;
  category: string;
  decline_rate: number;
  current_demand: number;
  projected_demand: number;
  replacement_skills: string[];
  transition_path: string | null;
  urgency: string;
}

// Workforce Types
export interface SkillRequirement {
  skill: string;
  count: number;
  experience_level: 'junior' | 'mid' | 'senior' | 'expert';
  hours_per_week: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export interface TeamEstimate {
  total_cost: number;
  monthly_burn: number;
  skill_breakdown: Array<{
    skill: string;
    count: number;
    experience_level: string;
    avg_rate: number;
    monthly_cost: number;
    availability: string;
    time_to_hire: number;
    confidence_level: number;
  }>;
  timeline: {
    estimated_start_date: string;
    onboarding_time: number;
    full_productivity_date: string;
  };
  risks: Array<{
    type: string;
    description: string;
    severity: string;
    mitigation: string;
  }>;
  alternatives: Array<{
    suggestion: string;
    cost_savings: number;
    tradeoffs: string[];
  }>;
}

export interface SkillGapAnalysis {
  skill: string;
  current_supply: number;
  projected_demand: number;
  gap_size: number;
  gap_severity: string;
  price_impact: {
    current_avg_rate: number;
    projected_rate: number;
    change_percent: number;
  };
  recommendations: Array<{
    action: string;
    timeframe: string;
    cost: string | null;
  }>;
}

export interface MarketReport {
  generated_at: string;
  period: string;
  executive_summary: string;
  key_metrics: {
    total_active_freelancers: number;
    total_open_projects: number;
    avg_project_value: number;
    market_growth_rate: number;
  };
  top_skills: Array<{
    skill: string;
    demand: number;
    avg_rate: number;
    trend: string;
  }>;
  emerging_trends: string[];
  region_insights: Array<{
    region: string;
    talent: number;
    avg_rate: number;
    growth: number;
  }>;
  predictions: Array<{
    prediction: string;
    confidence: number;
    timeframe: string;
  }>;
}

// ============================================================================
// API Client Classes
// ============================================================================

class RatesClient {
  constructor(private client: SkillancerIntelligence) {}

  async getBenchmark(
    params: {
      skill: string;
      experienceLevel?: string;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<RateBenchmark>> {
    return this.client.request<RateBenchmark>(
      '/v1/rates/benchmark',
      {
        skill: params.skill,
        experience_level: params.experienceLevel,
        location: params.location,
      },
      options
    );
  }

  async compare(
    params: {
      skills: string[];
      experienceLevel?: string;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<RateComparison>> {
    return this.client.request<RateComparison>(
      '/v1/rates/compare',
      {
        skills: params.skills.join(','),
        experience_level: params.experienceLevel,
        location: params.location,
      },
      options
    );
  }

  async getHistory(
    params: {
      skill: string;
      periods?: number;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<RateHistory>> {
    return this.client.request<RateHistory>(
      '/v1/rates/history',
      {
        skill: params.skill,
        periods: params.periods,
        location: params.location,
      },
      options
    );
  }

  async byLocation(
    params: {
      skill: string;
      experienceLevel?: string;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      locations: Array<{ location: string; median_rate: number; sample_size: number }>;
    }>
  > {
    return this.client.request(
      '/v1/rates/by-location',
      {
        skill: params.skill,
        experience_level: params.experienceLevel,
      },
      options
    );
  }

  async byExperience(
    params: {
      skill: string;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      levels: Array<{ level: string; median_rate: number; sample_size: number }>;
    }>
  > {
    return this.client.request(
      '/v1/rates/by-experience',
      {
        skill: params.skill,
        location: params.location,
      },
      options
    );
  }
}

class AvailabilityClient {
  constructor(private client: SkillancerIntelligence) {}

  async getCurrent(
    params: {
      skill: string;
      experienceLevel?: string;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<AvailabilityData>> {
    return this.client.request<AvailabilityData>(
      '/v1/availability/current',
      {
        skill: params.skill,
        experience_level: params.experienceLevel,
        location: params.location,
      },
      options
    );
  }

  async forecast(
    params: {
      skill: string;
      periods?: number;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<AvailabilityForecast>> {
    return this.client.request<AvailabilityForecast>(
      '/v1/availability/forecast',
      {
        skill: params.skill,
        periods: params.periods,
        location: params.location,
      },
      options
    );
  }

  async byRegion(
    params: {
      skill: string;
      experienceLevel?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<RegionalAvailability>> {
    return this.client.request<RegionalAvailability>(
      '/v1/availability/by-region',
      {
        skill: params.skill,
        experience_level: params.experienceLevel,
      },
      options
    );
  }

  async getTrends(
    params: {
      skill: string;
      periods?: number;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      trends: Array<{ period: string; available: number; score: number }>;
    }>
  > {
    return this.client.request(
      '/v1/availability/trends',
      {
        skill: params.skill,
        periods: params.periods,
        location: params.location,
      },
      options
    );
  }

  async byTimezone(
    params: {
      skill: string;
      experienceLevel?: string;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      timezones: Array<{ timezone: string; available: number; percentage: number }>;
    }>
  > {
    return this.client.request(
      '/v1/availability/by-timezone',
      {
        skill: params.skill,
        experience_level: params.experienceLevel,
      },
      options
    );
  }
}

class DemandClient {
  constructor(private client: SkillancerIntelligence) {}

  async getCurrent(
    params: {
      skill: string;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<DemandData>> {
    return this.client.request<DemandData>(
      '/v1/demand/current',
      {
        skill: params.skill,
        location: params.location,
      },
      options
    );
  }

  async getTrends(
    params: {
      skill: string;
      periods?: number;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      history: Array<{ period: string; demand: number }>;
      forecast: Array<{ period: string; projected: number }>;
    }>
  > {
    return this.client.request(
      '/v1/demand/trends',
      {
        skill: params.skill,
        periods: params.periods,
        location: params.location,
      },
      options
    );
  }

  async getEmerging(
    params?: {
      category?: string;
      limit?: number;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<{ skills: EmergingSkill[]; count: number }>> {
    return this.client.request(
      '/v1/demand/emerging',
      {
        category: params?.category,
        limit: params?.limit,
      },
      options
    );
  }

  async getDeclining(
    params?: {
      category?: string;
      limit?: number;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<{ skills: DecliningSkill[]; count: number }>> {
    return this.client.request(
      '/v1/demand/declining',
      {
        category: params?.category,
        limit: params?.limit,
      },
      options
    );
  }

  async getCorrelations(
    params: {
      skill: string;
      limit?: number;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      related_skills: Array<{
        skill: string;
        correlation: number;
        co_occurrence: number;
        trend: string;
      }>;
    }>
  > {
    return this.client.request(
      '/v1/demand/correlations',
      {
        skill: params.skill,
        limit: params.limit,
      },
      options
    );
  }

  async byIndustry(
    params: {
      skill: string;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      industries: Array<{ industry: string; demand: number; percentage: number }>;
    }>
  > {
    return this.client.request(
      '/v1/demand/by-industry',
      {
        skill: params.skill,
      },
      options
    );
  }

  async getHeatmap(
    params: {
      skill: string;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      regions: Array<{ region: string; demand: number; intensity: number }>;
    }>
  > {
    return this.client.request(
      '/v1/demand/heatmap',
      {
        skill: params.skill,
      },
      options
    );
  }
}

class WorkforceClient {
  constructor(private client: SkillancerIntelligence) {}

  async estimate(
    params: {
      skills: SkillRequirement[];
      projectDuration: number;
      startDate: string;
      location?: string;
      timezone?: string;
      budget?: number;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<TeamEstimate>> {
    return this.client.requestPost<TeamEstimate>(
      '/v1/workforce/estimate',
      {
        skills: params.skills,
        project_duration: params.projectDuration,
        start_date: params.startDate,
        location: params.location,
        timezone: params.timezone,
        budget: params.budget,
      },
      options
    );
  }

  async analyzeSkillGaps(
    params: {
      skills: string[];
      location?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<{ analyses: SkillGapAnalysis[] }>> {
    return this.client.request(
      '/v1/workforce/skill-gaps',
      {
        skills: params.skills.join(','),
        location: params.location,
      },
      options
    );
  }

  async getMarketReport(
    params?: {
      category?: string;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<ApiResponse<MarketReport>> {
    return this.client.request<MarketReport>(
      '/v1/workforce/market-report',
      {
        category: params?.category,
        location: params?.location,
      },
      options
    );
  }

  async runScenarios(
    params: {
      skills: SkillRequirement[];
      projectDuration: number;
      startDate: string;
      location?: string;
      budget?: number;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      scenarios: Array<{
        name: string;
        probability: number;
        impact: { on_costs: number; on_timeline: number; on_availability: number };
        recommendations: string[];
      }>;
    }>
  > {
    return this.client.requestPost(
      '/v1/workforce/scenarios',
      {
        skills: params.skills,
        project_duration: params.projectDuration,
        start_date: params.startDate,
        location: params.location,
        budget: params.budget,
      },
      options
    );
  }

  async compareOptions(
    params: {
      skill: string;
      hoursPerWeek: number;
      durationMonths: number;
      location?: string;
    },
    options?: RequestOptions
  ): Promise<
    ApiResponse<{
      skill: string;
      options: {
        freelance: { monthly_cost: number; total_cost: number; pros: string[]; cons: string[] };
        full_time: { monthly_cost: number; total_cost: number; pros: string[]; cons: string[] };
        agency: { monthly_cost: number; total_cost: number; pros: string[]; cons: string[] };
      };
    }>
  > {
    return this.client.request(
      '/v1/workforce/compare-options',
      {
        skill: params.skill,
        hours_per_week: params.hoursPerWeek,
        duration_months: params.durationMonths,
        location: params.location,
      },
      options
    );
  }
}

// ============================================================================
// Main Client
// ============================================================================

export class SkillancerIntelligence {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  public rates: RatesClient;
  public availability: AvailabilityClient;
  public demand: DemandClient;
  public workforce: WorkforceClient;

  constructor(config: SkillancerConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.skillancer.com';
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;

    this.rates = new RatesClient(this);
    this.availability = new AvailabilityClient(this);
    this.demand = new DemandClient(this);
    this.workforce = new WorkforceClient(this);
  }

  async request<T>(
    path: string,
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = new URL(path, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      ...(options?.signal && { signal: options.signal }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string } & Record<string, unknown>;
      throw new SkillancerError(error.message || 'API request failed', response.status, error);
    }

    return (await response.json()) as ApiResponse<T>;
  }

  async requestPost<T>(
    path: string,
    body: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = new URL(path, this.baseUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      ...(options?.signal && { signal: options.signal }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { message?: string } & Record<string, unknown>;
      throw new SkillancerError(error.message || 'API request failed', response.status, error);
    }

    return (await response.json()) as ApiResponse<T>;
  }
}

// ============================================================================
// Error Class
// ============================================================================

export class SkillancerError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SkillancerError';
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default SkillancerIntelligence;
