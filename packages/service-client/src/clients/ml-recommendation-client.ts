/**
 * @module @skillancer/service-client/clients/ml-recommendation-client
 * ML Recommendation service client for AI-powered proposals, rates, career coaching, and market insights
 *
 * This client is the canonical interface for Node.js services to call the Python ML backend.
 * All AI/ML operations should go through this client to maintain clear service boundaries.
 */

import { BaseServiceClient, type ServiceClientConfig } from '../base-client.js';

// ============================================================================
// Types — Proposal AI
// ============================================================================

export interface AnalyzeJobInput {
  job_id: string;
  job_title: string;
  job_description: string;
  budget_min?: number;
  budget_max?: number;
  client_history?: Record<string, unknown>;
}

export interface JobAnalysis {
  job_id: string;
  key_requirements: string[];
  client_priorities: string[];
  budget_signals: Record<string, unknown>;
  tone_preference: string;
  urgency_level: string;
  competition_estimate: string;
  keywords: string[];
  red_flags: string[];
  opportunities: string[];
  processing_time_ms: number;
}

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

export interface ScoreProposalInput {
  job_id: string;
  job_description: string;
  proposal_text: string;
  freelancer_id: string;
}

export interface ProposalScore {
  overall_score: number;
  category_scores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  win_probability: number;
  comparison_to_winners: Record<string, unknown>;
  suggested_rewrites?: Array<Record<string, unknown>>;
}

export interface ImproveProposalInput {
  job_id: string;
  job_description: string;
  section_text: string;
  section_type: string;
  improvement_focus?: string;
}

export interface ProposalImprovement {
  original_text: string;
  improved_versions: Array<Record<string, unknown>>;
  changes_explained: string[];
  confidence: number;
}

// ============================================================================
// Types — Rate Optimizer
// ============================================================================

export interface OptimizeRateInput {
  job_id: string;
  job_title: string;
  job_description: string;
  skills_required: string[];
  budget_min?: number;
  budget_max?: number;
  duration?: string;
  freelancer_profile: Record<string, unknown>;
  strategy?: 'competitive' | 'balanced' | 'premium';
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

export interface AnalyzeRateInput {
  job_id: string;
  proposed_rate: number;
  job_skills: string[];
  freelancer_profile: Record<string, unknown>;
}

export interface RateAnalysis {
  proposed_rate: number;
  win_probability: number;
  market_position: string;
  market_percentile: number;
  competitive_analysis: Record<string, unknown>;
  recommendations: string[];
  expected_value: number;
}

export interface MarketRateData {
  skill: string;
  experience_level: string;
  percentile_25: number;
  percentile_50: number;
  percentile_75: number;
  percentile_90: number;
  sample_size: number;
  trend: string;
  last_updated: string;
}

// ============================================================================
// Types — Market Insights
// ============================================================================

export interface MarketInsightsInput {
  skills: string[];
  industry?: string;
  location?: string;
  timeframe?: string;
}

export interface MarketInsights {
  demand_level: 'HIGH' | 'MEDIUM' | 'LOW';
  demand_trend: 'RISING' | 'STABLE' | 'FALLING';
  average_rate: { hourly: number; project: number };
  competition_level: 'HIGH' | 'MEDIUM' | 'LOW';
  top_competitors: number;
  skill_gaps: string[];
  emerging_skills: string[];
  market_tips: string[];
}

// ============================================================================
// Types — LLM Proxy
// ============================================================================

export interface LlmCompletionInput {
  prompt: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

export interface LlmCompletionResult {
  content: string;
  model: string;
  tokens_used: number;
  processing_time_ms: number;
}

// ============================================================================
// ML Recommendation Service Client
// ============================================================================

export class MLRecommendationServiceClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['ML_RECOMMENDATION_SERVICE_URL'] ?? 'http://ml-recommendation-svc:8080',
      serviceName: 'ml-recommendation-svc',
      timeout: 30000,
      retries: 2,
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        resetTimeout: 30000,
      },
      defaultHeaders: {
        'x-service-token': process.env['ML_SERVICE_TOKEN'] ?? '',
      },
      ...config,
    });
  }

  // ==========================================================================
  // Proposal AI
  // ==========================================================================

  async analyzeJob(input: AnalyzeJobInput): Promise<JobAnalysis> {
    return this.post<JobAnalysis>('ai/proposal/analyze-job', input);
  }

  async generateProposalSuggestions(input: GenerateSuggestionsInput): Promise<ProposalSuggestions> {
    return this.post<ProposalSuggestions>('ai/proposal/generate-suggestions', input);
  }

  async scoreProposal(input: ScoreProposalInput): Promise<ProposalScore> {
    return this.post<ProposalScore>('ai/proposal/score', input);
  }

  async improveProposal(input: ImproveProposalInput): Promise<ProposalImprovement> {
    return this.post<ProposalImprovement>('ai/proposal/improve', input);
  }

  // ==========================================================================
  // Rate Optimizer
  // ==========================================================================

  async optimizeRate(input: OptimizeRateInput): Promise<RateRecommendation> {
    return this.post<RateRecommendation>('ai/rate/optimize', input);
  }

  async analyzeRate(input: AnalyzeRateInput): Promise<RateAnalysis> {
    return this.post<RateAnalysis>('ai/rate/analyze', input);
  }

  async getMarketRate(
    skill: string,
    experienceLevel?: string,
    location?: string
  ): Promise<MarketRateData> {
    const searchParams: Record<string, string> = {};
    if (experienceLevel) searchParams['experience_level'] = experienceLevel;
    if (location) searchParams['location'] = location;
    return this.get<MarketRateData>(`ai/rate/market/${encodeURIComponent(skill)}`, { searchParams });
  }

  // ==========================================================================
  // Market Insights (aggregates skill gaps, trends, and recommendations)
  // ==========================================================================

  async getMarketInsights(input: MarketInsightsInput): Promise<MarketInsights> {
    return this.post<MarketInsights>('ai/market/insights', input);
  }

  // ==========================================================================
  // LLM Proxy (for services that need LLM completions without direct API keys)
  // ==========================================================================

  async complete(input: LlmCompletionInput): Promise<LlmCompletionResult> {
    return this.post<LlmCompletionResult>('ai/llm/complete', input);
  }

  // ==========================================================================
  // Health
  // ==========================================================================

  async checkHealth(): Promise<{ status: string; version: string }> {
    return this.get<{ status: string; version: string }>('health');
  }
}

// Export singleton instance
export const mlRecommendationClient = new MLRecommendationServiceClient();
