/**
 * AI API Client
 * Client library for AI Work Assistant APIs
 * Sprint M7: AI Work Assistant
 */

// =============================================================================
// TYPES
// =============================================================================

export interface JobAnalysis {
  jobId: string;
  keyRequirements: string[];
  clientPriorities: string[];
  budgetSignals: {
    range: { min: number; max: number } | null;
    flexibility: 'rigid' | 'flexible' | 'unknown';
  };
  tonePreference: string;
  urgencyLevel: string;
  competitionEstimate: string;
  keywords: string[];
  redFlags: string[];
  opportunities: string[];
}

export interface ProposalSuggestions {
  jobId: string;
  openingHooks: Array<{
    text: string;
    confidence: number;
    reasoning: string;
  }>;
  experienceHighlights: string[];
  questionsToAsk: string[];
  closingCta: string[];
  personalizationTips: string[];
  toneRecommendations: string;
  optimalLength: {
    min: number;
    max: number;
    recommended: number;
  };
  confidence: number;
}

export interface ProposalScore {
  overallScore: number;
  categoryScores: {
    requirementCoverage: number;
    personalization: number;
    clarity: number;
    callToAction: number;
    professionalism: number;
  };
  strengths: string[];
  improvements: string[];
  winProbability: number;
  comparisonToWinners: {
    percentile: number;
    averageScore: number;
  };
  suggestedRewrites?: Array<{
    section: string;
    original: string;
    improved: string;
  }>;
}

export interface RateRecommendation {
  recommendedRate: number;
  rateRange: { min: number; max: number };
  winProbability: number;
  expectedValue: number;
  confidence: number;
  reasoning: string[];
  alternativeStrategies: Array<{
    name: string;
    rate: number;
    winProbability: number;
    tradeoffs: string;
  }>;
  marketPosition: {
    percentile: number;
    position: string;
  };
}

export interface CareerAnalysis {
  userId: string;
  currentState: {
    monthlyEarnings: number;
    hourlyRate: number;
    activeClients: number;
    totalProjects: number;
    completionRate: number;
    rating: number;
    topSkills: string[];
    experienceYears: number;
  };
  trajectory: {
    trend: string;
    growthRate: number;
    projection6Months: number;
    projection12Months: number;
  };
  marketPosition: {
    ratePercentile: number;
    earningsPercentile: number;
    skillDemandScore: number;
    competitionLevel: string;
  };
  growthOpportunities: Array<{
    type: string;
    title: string;
    description: string;
    potentialImpact: string;
    effortRequired: string;
  }>;
}

export interface CareerRecommendation {
  type: string;
  title: string;
  description: string;
  potentialImpact: string;
  actionItems: string[];
  timeframe: string;
  confidence: number;
}

export interface CareerGoal {
  id: string;
  category: string;
  timeframe: string;
  targetValue: number;
  currentValue: number;
  description: string;
  progressPercentage: number;
  status: string;
  deadline: string;
  feasibilityScore: number;
  recommendations: string[];
}

export interface Feedback {
  suggestionId: string;
  feedbackType: 'helpful' | 'not_helpful' | 'used' | 'modified' | 'ignored';
  suggestionType: string;
  comment?: string;
}

// =============================================================================
// API CLIENT
// =============================================================================

interface FetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class AIApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  private async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // PROPOSAL AI
  // ---------------------------------------------------------------------------

  /**
   * Analyze a job posting for key insights
   */
  async analyzeJob(jobId: string, description: string): Promise<JobAnalysis> {
    return this.fetch<JobAnalysis>('/ai/proposals/analyze-job', {
      method: 'POST',
      body: { jobId, description },
    });
  }

  /**
   * Generate personalized proposal suggestions
   */
  async generateProposalSuggestions(
    jobId: string,
    context: {
      skills: string[];
      experience: string;
      portfolioHighlights: string[];
      writingStyle?: string;
    }
  ): Promise<ProposalSuggestions> {
    return this.fetch<ProposalSuggestions>('/ai/proposals/generate-suggestions', {
      method: 'POST',
      body: { jobId, freelancerContext: context },
    });
  }

  /**
   * Score a proposal draft
   */
  async scoreProposal(proposalDraft: string, jobId: string): Promise<ProposalScore> {
    return this.fetch<ProposalScore>('/ai/proposals/score', {
      method: 'POST',
      body: { proposalText: proposalDraft, jobId },
    });
  }

  /**
   * Improve a specific section of a proposal
   */
  async improveProposalSection(
    section: string,
    context: { jobDescription: string; sectionType: string }
  ): Promise<{
    originalText: string;
    improvedVersions: Array<{ text: string; confidence: number }>;
    changesExplained: string[];
  }> {
    return this.fetch('/ai/proposals/improve', {
      method: 'POST',
      body: {
        sectionText: section,
        sectionType: context.sectionType,
        jobDescription: context.jobDescription,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // RATE OPTIMIZER
  // ---------------------------------------------------------------------------

  /**
   * Get optimal rate recommendation for a job
   */
  async getOptimalRate(
    jobId: string,
    freelancerProfile: {
      skills: string[];
      experienceYears: number;
      rating: number;
      winRate: number;
      averageRate: number;
    }
  ): Promise<RateRecommendation> {
    return this.fetch<RateRecommendation>('/ai/rate/optimize', {
      method: 'POST',
      body: { jobId, freelancerProfile },
    });
  }

  /**
   * Analyze a proposed rate
   */
  async analyzeRate(
    jobId: string,
    proposedRate: number,
    jobSkills: string[]
  ): Promise<{
    proposedRate: number;
    winProbability: number;
    marketPosition: string;
    marketPercentile: number;
    recommendations: string[];
  }> {
    return this.fetch('/ai/rate/analyze', {
      method: 'POST',
      body: { jobId, proposedRate, jobSkills },
    });
  }

  /**
   * Get market rate for a skill
   */
  async getMarketRate(
    skill: string,
    experienceLevel?: string
  ): Promise<{
    skill: string;
    experienceLevel: string;
    percentile25: number;
    percentile50: number;
    percentile75: number;
    percentile90: number;
    trend: string;
  }> {
    const params = new URLSearchParams({ skill });
    if (experienceLevel) params.set('experienceLevel', experienceLevel);

    return this.fetch(`/ai/rate/market/${skill}?${params}`);
  }

  // ---------------------------------------------------------------------------
  // CAREER COACH
  // ---------------------------------------------------------------------------

  /**
   * Get comprehensive career analysis
   */
  async getCareerAnalysis(): Promise<CareerAnalysis> {
    return this.fetch<CareerAnalysis>('/ai/career/analysis');
  }

  /**
   * Get personalized career recommendations
   */
  async getCareerRecommendations(limit?: number): Promise<{
    recommendations: CareerRecommendation[];
    priorityActions: string[];
    quickWins: string[];
    longTermStrategies: string[];
  }> {
    const params = limit ? `?limit=${limit}` : '';
    return this.fetch(`/ai/career/recommendations${params}`);
  }

  /**
   * Set a career goal
   */
  async setCareerGoal(goal: {
    category: string;
    timeframe: string;
    targetValue: number;
    description: string;
  }): Promise<CareerGoal> {
    return this.fetch<CareerGoal>('/ai/career/goals', {
      method: 'POST',
      body: goal,
    });
  }

  /**
   * Get progress towards career goals
   */
  async getCareerProgress(): Promise<{
    goals: Array<{
      id: string;
      category: string;
      description: string;
      progress: number;
      status: string;
    }>;
    overallProgress: number;
    achievements: Array<{
      title: string;
      date: string;
      description: string;
    }>;
    nextMilestones: Array<{
      goalId: string;
      title: string;
      dueDate: string;
    }>;
  }> {
    return this.fetch('/ai/career/progress');
  }

  /**
   * Get earnings prediction
   */
  async getEarningsPrediction(
    horizonMonths: number = 12,
    includeScenarios: boolean = true
  ): Promise<{
    currentMonthly: number;
    predictedMonthly: Record<string, number>;
    growthRate: number;
    confidenceInterval: { lower: number; upper: number };
    scenarios?: Array<{
      name: string;
      description: string;
      predictedMonthly: number;
      impactPercentage: number;
    }>;
    keyFactors: string[];
  }> {
    const params = new URLSearchParams({
      horizonMonths: String(horizonMonths),
      includeScenarios: String(includeScenarios),
    });
    return this.fetch(`/ai/career/earnings-prediction?${params}`);
  }

  /**
   * Model a what-if scenario
   */
  async modelScenario(
    scenarioType: string,
    parameters: Record<string, unknown>
  ): Promise<{
    scenarioType: string;
    currentProjection: { monthly: number; annual: number };
    scenarioProjection: { monthly: number; annual: number };
    impact: {
      monthlyIncrease: number;
      percentageIncrease: number;
      annualIncrease: number;
    };
    feasibility: number;
    timeToImpact: string;
    actionSteps: string[];
  }> {
    return this.fetch('/ai/career/scenario', {
      method: 'POST',
      body: { scenarioType, parameters },
    });
  }

  // ---------------------------------------------------------------------------
  // FEEDBACK
  // ---------------------------------------------------------------------------

  /**
   * Submit feedback on an AI suggestion
   */
  async submitFeedback(feedback: Feedback): Promise<{ status: string }> {
    return this.fetch('/ai/feedback', {
      method: 'POST',
      body: feedback,
    });
  }
}

// =============================================================================
// HOOKS
// =============================================================================

import { useState, useCallback } from 'react';

export function useAIClient() {
  const client = new AIApiClient('/api');

  return {
    analyzeJob: client.analyzeJob.bind(client),
    generateProposalSuggestions: client.generateProposalSuggestions.bind(client),
    scoreProposal: client.scoreProposal.bind(client),
    improveProposalSection: client.improveProposalSection.bind(client),
    getOptimalRate: client.getOptimalRate.bind(client),
    analyzeRate: client.analyzeRate.bind(client),
    getMarketRate: client.getMarketRate.bind(client),
    getCareerAnalysis: client.getCareerAnalysis.bind(client),
    getCareerRecommendations: client.getCareerRecommendations.bind(client),
    setCareerGoal: client.setCareerGoal.bind(client),
    getCareerProgress: client.getCareerProgress.bind(client),
    getEarningsPrediction: client.getEarningsPrediction.bind(client),
    modelScenario: client.modelScenario.bind(client),
    submitFeedback: client.submitFeedback.bind(client),
  };
}

export function useJobAnalysis() {
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useAIClient();

  const analyze = useCallback(async (jobId: string, description: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.analyzeJob(jobId, description);
      setAnalysis(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze job';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { analysis, isLoading, error, analyze };
}

export function useProposalScore() {
  const [score, setScore] = useState<ProposalScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useAIClient();

  const scoreProposal = useCallback(async (proposalDraft: string, jobId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.scoreProposal(proposalDraft, jobId);
      setScore(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to score proposal';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { score, isLoading, error, scoreProposal };
}

export function useRateOptimizer() {
  const [recommendation, setRecommendation] = useState<RateRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useAIClient();

  const optimize = useCallback(
    async (jobId: string, freelancerProfile: Parameters<typeof client.getOptimalRate>[1]) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.getOptimalRate(jobId, freelancerProfile);
        setRecommendation(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to optimize rate';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { recommendation, isLoading, error, optimize };
}

interface RateAdvisorInput {
  jobCategory: string;
  jobSkills: string[];
  jobBudget?: {
    min?: number;
    max?: number;
    type: 'fixed' | 'hourly';
  };
  freelancerProfile?: {
    skills: string[];
    experienceLevel: 'entry' | 'intermediate' | 'expert';
    successRate?: number;
    totalEarnings?: number;
  };
}

interface RateAdvisorResult {
  optimalRate: number;
  minRate: number;
  maxRate: number;
  confidence: number;
  reasoning: string;
  marketPosition: 'below' | 'competitive' | 'above';
}

export function useRateAdvisor() {
  const [recommendation, setRecommendation] = useState<RateAdvisorResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRecommendation = useCallback(async (input: RateAdvisorInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/rates/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error('Failed to get rate recommendation');
      }

      const result: RateAdvisorResult = await response.json();
      setRecommendation(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get recommendation';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { recommendation, isLoading, error, getRecommendation };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const aiClient = new AIApiClient('/api');
export { AIApiClient };
