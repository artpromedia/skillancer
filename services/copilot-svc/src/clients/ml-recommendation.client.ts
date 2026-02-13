/**
 * @module @skillancer/copilot-svc/clients/ml-recommendation
 * Lightweight HTTP client for calling ml-recommendation-svc from copilot-svc.
 *
 * Uses native fetch (available in Node 20+) to avoid adding a dependency.
 * All AI/ML operations are delegated through this client.
 * Includes timeout, retry on 5xx, and graceful degradation.
 */

// ============================================================================
// Types (mirror the Python service's request/response schemas)
// ============================================================================

export interface GenerateSuggestionsInput {
  job_id: string;
  job_description: string;
  freelancer_context: Record<string, unknown>;
  tone?: string;
  focus_areas?: string[];
}

export interface ProposalSuggestions {
  job_id: string;
  opening_hooks: Array<Record<string, unknown>>;
  experience_highlights: string[];
  questions_to_ask: string[];
  closing_cta: string[];
  personalization_tips: string[];
  tone_recommendations: string;
  optimal_length: Record<string, unknown>;
  confidence: number;
}

export interface OptimizeRateInput {
  job_id: string;
  job_title: string;
  job_description: string;
  skills_required: string[];
  budget_min?: number;
  budget_max?: number;
  duration?: string;
  freelancer_profile: Record<string, unknown>;
  strategy?: string;
}

export interface RateRecommendation {
  recommended_rate: number;
  rate_range: { min: number; max: number };
  win_probability: number;
  expected_value: number;
  confidence: number;
  reasoning: string[];
  alternative_strategies: Array<Record<string, unknown>>;
  market_position: { percentile: number; position: string };
}

export interface MarketInsightsInput {
  skills: string[];
  industry?: string;
  location?: string;
}

export interface MarketInsights {
  demand_level: string;
  demand_trend: string;
  average_rate: { hourly: number; project: number };
  competition_level: string;
  top_competitors: number;
  skill_gaps: string[];
  emerging_skills: string[];
  market_tips: string[];
}

// ============================================================================
// Client
// ============================================================================

export class MLRecommendationClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string;
  private readonly timeout: number;

  constructor() {
    this.baseUrl =
      process.env.ML_RECOMMENDATION_SERVICE_URL || 'http://ml-recommendation-svc:8080';
    this.serviceToken = process.env.ML_SERVICE_TOKEN || '';
    this.timeout = Number(process.env.ML_SERVICE_TIMEOUT_MS) || 15000;
  }

  // ==========================================================================
  // Proposal AI
  // ==========================================================================

  async generateProposalSuggestions(
    input: GenerateSuggestionsInput
  ): Promise<ProposalSuggestions> {
    return this.post<ProposalSuggestions>('/ai/proposal/generate-suggestions', input);
  }

  // ==========================================================================
  // Rate Optimizer
  // ==========================================================================

  async optimizeRate(input: OptimizeRateInput): Promise<RateRecommendation> {
    return this.post<RateRecommendation>('/ai/rate/optimize', input);
  }

  // ==========================================================================
  // Market Insights
  // ==========================================================================

  async getMarketInsights(input: MarketInsightsInput): Promise<MarketInsights> {
    return this.post<MarketInsights>('/ai/market/insights', input);
  }

  // ==========================================================================
  // Internal HTTP helpers
  // ==========================================================================

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': this.serviceToken,
          'X-Calling-Service': 'copilot-svc',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `ml-recommendation-svc returned ${response.status}: ${response.statusText}`
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
