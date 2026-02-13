import { PrismaClient } from '@prisma/client';
import { InteractionType } from '../types/copilot.types.js';
import type {
  CopilotInteractionInput,
  CopilotResponse,
  ProposalDraftInput,
  ProposalDraftResult,
  RateSuggestionInput,
  RateSuggestionResult,
  MessageAssistInput,
  MessageAssistResult,
  ProfileOptimizeInput,
  ProfileOptimizeResult,
  MarketInsightInput,
  MarketInsightResult,
} from '../types/copilot.types.js';
import { MLRecommendationClient } from '../clients/ml-recommendation.client.js';

export class CopilotService {
  private readonly mlClient: MLRecommendationClient;

  constructor(private readonly prisma: PrismaClient) {
    this.mlClient = new MLRecommendationClient();
  }

  /**
   * Generate a proposal draft.
   *
   * Delegates job analysis, suggestion generation, scoring, and rate
   * optimization to ml-recommendation-svc. Keeps draft persistence
   * and interaction logging local.
   */
  async generateProposalDraft(input: ProposalDraftInput): Promise<ProposalDraftResult> {
    const startTime = Date.now();

    // Get user's profile for personalization context
    const userProfile = await this.getUserProfile(input.userId);
    const userName = (userProfile as any)?.firstName || 'there';

    // Build freelancer context for the ML service
    const freelancerContext = {
      user_id: input.userId,
      name: userName,
      skills: input.userSkills,
      tone: input.tone || 'PROFESSIONAL',
      emphasis: input.emphasis || [],
    };

    // Try ML-powered generation, fall back to local templates
    let coverLetter: string;
    let keyPoints: string[];
    let suggestedRate: number;
    let rateJustification: string;
    let estimatedWinRate: number;
    let improvements: any[];

    try {
      // Delegate to ml-recommendation-svc for AI-powered results
      const [suggestions, rateResult] = await Promise.all([
        this.mlClient.generateProposalSuggestions({
          job_id: input.jobId,
          job_description: input.jobDescription,
          freelancer_context: freelancerContext,
          tone: input.tone?.toLowerCase(),
          focus_areas: input.emphasis,
        }),
        this.mlClient.optimizeRate({
          job_id: input.jobId,
          job_title: input.jobTitle,
          job_description: input.jobDescription,
          skills_required: input.requiredSkills,
          budget_min: input.budget?.min,
          budget_max: input.budget?.max,
          freelancer_profile: freelancerContext,
          strategy: 'balanced',
        }),
      ]);

      // Compose cover letter from ML suggestions
      const hook = suggestions.opening_hooks[0];
      const hookText =
        typeof hook === 'object' && hook !== null
          ? (hook as any).text || JSON.stringify(hook)
          : String(hook || '');

      const greeting = input.clientName ? `Dear ${input.clientName},` : 'Hello,';
      coverLetter = [
        greeting,
        '',
        hookText,
        '',
        suggestions.experience_highlights.map((h) => `• ${h}`).join('\n'),
        '',
        input.proposedTimeline
          ? `I can complete this project within ${input.proposedTimeline}.`
          : '',
        '',
        suggestions.closing_cta[0] || "I'd love to discuss how I can help. Let's connect!",
        '',
        `Best regards,`,
        userName,
      ]
        .filter(Boolean)
        .join('\n');

      keyPoints = [
        ...suggestions.experience_highlights.slice(0, 3),
        ...suggestions.personalization_tips.slice(0, 2),
      ];

      suggestedRate = rateResult.recommended_rate;
      rateJustification = rateResult.reasoning.join('; ');
      estimatedWinRate = rateResult.win_probability;
      improvements = suggestions.personalization_tips.map((tip) => ({
        section: 'Personalization',
        current: '',
        suggested: tip,
        reason: 'ML-powered recommendation',
      }));
    } catch {
      // ML service unavailable — fall back to local generation
      const skillMatch = this.calculateSkillMatch(input.requiredSkills, input.userSkills);
      coverLetter = this.generateCoverLetterLocal(input, userProfile, skillMatch);
      keyPoints = this.generateKeyPointsLocal(input, skillMatch);
      suggestedRate = this.calculateSuggestedRateLocal(input);
      rateJustification = `Based on skill count for ${input.requiredSkills.slice(0, 2).join(' and ')}`;
      estimatedWinRate = this.estimateWinRateLocal(skillMatch, suggestedRate, input);
      improvements = this.generateImprovementsLocal(coverLetter, input);
    }

    // Store the draft (always local — copilot-svc owns draft persistence)
    const draft = await this.prisma.proposalDraft.create({
      data: {
        userId: input.userId,
        jobId: input.jobId,
        jobTitle: input.jobTitle,
        content: coverLetter,
        suggestedRate,
        estimatedWinRate: Math.round(estimatedWinRate * 100),
        keyPoints,
        improvements: JSON.parse(JSON.stringify(improvements)),
        status: 'DRAFT',
      },
    });

    // Log interaction
    await this.logInteraction(
      {
        userId: input.userId,
        interactionType: InteractionType.PROPOSAL_DRAFT,
        inputContext: input as any,
      },
      {
        content: coverLetter,
        confidence: estimatedWinRate,
        tokensUsed: coverLetter.length / 4,
        processingTime: Date.now() - startTime,
      }
    );

    return {
      draftId: draft.id,
      content: coverLetter,
      coverLetter,
      keyPoints,
      suggestedRate,
      rateJustification,
      estimatedWinRate: Math.round(estimatedWinRate * 100),
      improvements,
    };
  }

  /**
   * Get rate suggestions.
   *
   * Delegates rate optimization to ml-recommendation-svc.
   * Falls back to local heuristics if unavailable.
   */
  async suggestRate(input: RateSuggestionInput): Promise<RateSuggestionResult> {
    const startTime = Date.now();

    try {
      // Delegate to ml-recommendation-svc
      const result = await this.mlClient.optimizeRate({
        job_id: 'rate-suggestion',
        job_title: 'Rate inquiry',
        job_description: `Skills: ${input.skills.join(', ')}`,
        skills_required: input.skills,
        freelancer_profile: {
          user_id: input.userId,
          skills: input.skills,
          experience_years: input.experience,
          location: input.location,
        },
        strategy: 'balanced',
      });

      const suggestedHourlyRate = {
        min: result.rate_range.min,
        max: result.rate_range.max,
        optimal: result.recommended_rate,
      };

      // Map ML market position to our enum
      const pos = result.market_position.position?.toUpperCase() || 'AT_MARKET';
      let marketPosition: 'BELOW_MARKET' | 'AT_MARKET' | 'ABOVE_MARKET' = 'AT_MARKET';
      if (pos.includes('BELOW')) marketPosition = 'BELOW_MARKET';
      else if (pos.includes('ABOVE')) marketPosition = 'ABOVE_MARKET';

      await this.logInteraction(
        {
          userId: input.userId,
          interactionType: InteractionType.RATE_SUGGEST,
          inputContext: input as any,
        },
        {
          content: JSON.stringify(suggestedHourlyRate),
          confidence: result.confidence,
          tokensUsed: 100,
          processingTime: Date.now() - startTime,
        }
      );

      return {
        suggestedHourlyRate,
        marketPosition,
        competitorRange: result.rate_range,
        factors: result.reasoning.map((r) => ({
          factor: r,
          impact: 'POSITIVE' as const,
          weight: 0.1,
          explanation: r,
        })),
        recommendations: result.alternative_strategies.map(
          (s) => (s as any).description || JSON.stringify(s)
        ),
      };
    } catch {
      // Fallback to local heuristics
      return this.suggestRateLocal(input, startTime);
    }
  }

  /**
   * Assist with message drafting.
   *
   * This stays local — template-based intent responses don't need ML.
   * The LLM proxy can be used here later for enhanced quality.
   */
  async assistMessage(input: MessageAssistInput): Promise<MessageAssistResult> {
    const startTime = Date.now();

    const contextAnalysis = this.analyzeConversation(input.conversationContext);
    const suggestedMessage = this.generateMessage(input, contextAnalysis);
    const alternativeVersions = this.generateAlternativeMessages(input, contextAnalysis);
    const toneAnalysis = input.draftMessage
      ? this.analyzeTone(input.draftMessage)
      : { current: 'NEUTRAL', recommended: input.tone || 'PROFESSIONAL' };
    const { covered, missing } = this.identifyKeyPoints(input, contextAnalysis);

    await this.logInteraction(
      {
        userId: input.userId,
        interactionType: InteractionType.MESSAGE_ASSIST,
        inputContext: input as any,
      },
      {
        content: suggestedMessage,
        confidence: 0.75,
        tokensUsed: suggestedMessage.length / 4,
        processingTime: Date.now() - startTime,
      }
    );

    return {
      suggestedMessage,
      alternativeVersions,
      toneAnalysis,
      keyPointsCovered: covered,
      missingPoints: missing,
    };
  }

  /**
   * Optimize user profile.
   *
   * This stays local — profile completeness scoring and template-based
   * optimization are unique to copilot-svc and don't require ML.
   */
  async optimizeProfile(input: ProfileOptimizeInput): Promise<ProfileOptimizeResult> {
    const startTime = Date.now();

    const completenessScore = this.calculateProfileCompleteness(input);
    const optimizedHeadline = this.generateOptimizedHeadline(input);
    const optimizedSummary = this.generateOptimizedSummary(input);
    const { toHighlight, toAdd } = await this.analyzeSkills(input);
    const keywordSuggestions = this.generateKeywordSuggestions(input);
    const improvements = this.generateProfileImprovements(input, completenessScore);

    await this.logInteraction(
      {
        userId: input.userId,
        interactionType: InteractionType.PROFILE_OPTIMIZE,
        inputContext: input as any,
      },
      {
        content: optimizedSummary,
        confidence: 0.85,
        tokensUsed: 200,
        processingTime: Date.now() - startTime,
      }
    );

    return {
      optimizedHeadline,
      optimizedSummary,
      skillsToHighlight: toHighlight,
      skillsToAdd: toAdd,
      keywordSuggestions,
      completenessScore,
      improvements,
    };
  }

  /**
   * Get market insights.
   *
   * Delegates to ml-recommendation-svc for real market data.
   * Falls back to local static data if unavailable.
   */
  async getMarketInsights(input: MarketInsightInput): Promise<MarketInsightResult> {
    try {
      const result = await this.mlClient.getMarketInsights({
        skills: input.skills,
        industry: input.industry,
        location: input.location,
      });

      return {
        demandLevel: result.demand_level as 'HIGH' | 'MEDIUM' | 'LOW',
        demandTrend: result.demand_trend as 'RISING' | 'STABLE' | 'FALLING',
        averageRate: result.average_rate,
        competitionLevel: result.competition_level as 'HIGH' | 'MEDIUM' | 'LOW',
        topCompetitors: result.top_competitors,
        skillGaps: result.skill_gaps,
        emergingSkills: result.emerging_skills,
        marketTips: result.market_tips,
      };
    } catch {
      // Fallback to local static data
      return this.getMarketInsightsLocal(input);
    }
  }

  // ===========================================================================
  // Draft CRUD (always local — copilot-svc owns draft persistence)
  // ===========================================================================

  async getProposalDraft(draftId: string) {
    return this.prisma.proposalDraft.findUnique({ where: { id: draftId } });
  }

  async updateProposalDraft(draftId: string, content: string) {
    return this.prisma.proposalDraft.update({
      where: { id: draftId },
      data: { content, updatedAt: new Date() },
    });
  }

  async getUserProposalDrafts(userId: string, status?: string) {
    const where: any = { userId };
    if (status) where.status = status;
    return this.prisma.proposalDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInteractionHistory(userId: string, type?: InteractionType, limit = 50) {
    const where: any = { userId };
    if (type) where.interactionType = type;
    return this.prisma.copilotInteraction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ===========================================================================
  // Local fallback helpers (used when ml-recommendation-svc is unavailable)
  // ===========================================================================

  private calculateSkillMatch(required: string[], userSkills: string[]): number {
    const requiredLower = required.map((s) => s.toLowerCase());
    const userLower = userSkills.map((s) => s.toLowerCase());
    const matched = requiredLower.filter((s) => userLower.includes(s));
    return required.length > 0 ? matched.length / required.length : 0;
  }

  private generateCoverLetterLocal(
    input: ProposalDraftInput,
    profile: any,
    skillMatch: number
  ): string {
    const userName = profile?.firstName || 'there';
    const matchedSkills = input.requiredSkills.filter((s) =>
      input.userSkills.map((u) => u.toLowerCase()).includes(s.toLowerCase())
    );

    const greeting = input.clientName ? `Dear ${input.clientName}` : 'Hello';
    const intro = `${greeting},\n\nI'm excited to apply for the ${input.jobTitle} position. With my expertise in ${matchedSkills.slice(0, 3).join(', ')}${matchedSkills.length > 3 ? ' and more' : ''}, I'm confident I can deliver exceptional results for your project.`;
    const body = `\nAfter reviewing your requirements, I understand you need ${this.summarizeRequirements(input.jobDescription)}. This aligns perfectly with my experience, particularly in:\n\n${matchedSkills.slice(0, 4).map((s) => `• ${s}`).join('\n')}\n\n${input.emphasis ? `I'd particularly like to emphasize my strength in ${input.emphasis.join(' and ')}.` : ''}`;
    const timeline = input.proposedTimeline
      ? `\nI can complete this project within ${input.proposedTimeline}.`
      : '';
    const closing = `\nI'd love to discuss how I can help achieve your goals. Let's schedule a call to explore this further.\n\nBest regards,\n${userName}`;

    return intro + body + timeline + closing;
  }

  private summarizeRequirements(description: string): string {
    const sentences = description.split(/[.!?]/);
    return sentences[0]?.trim() || 'a skilled professional';
  }

  private calculateSuggestedRateLocal(input: ProposalDraftInput): number {
    const baseRate = 50 + input.requiredSkills.length * 5;
    if (input.budget) {
      const budgetRate = (input.budget.min + input.budget.max) / 2;
      return Math.round(Math.min(baseRate, budgetRate * 1.1));
    }
    return Math.round(baseRate);
  }

  private generateKeyPointsLocal(input: ProposalDraftInput, skillMatch: number): string[] {
    const points: string[] = [];
    points.push(`${Math.round(skillMatch * 100)}% skill match with requirements`);
    if (skillMatch >= 0.8) points.push('Strong alignment with all key requirements');
    if (input.userSkills.length >= input.requiredSkills.length)
      points.push('Comprehensive skill coverage');
    points.push('Ready to start immediately');
    return points;
  }

  private estimateWinRateLocal(
    skillMatch: number,
    rate: number,
    input: ProposalDraftInput
  ): number {
    let winRate = 0.3;
    winRate += skillMatch * 0.3;
    if (input.budget) {
      const midBudget = (input.budget.min + input.budget.max) / 2;
      if (rate <= midBudget) winRate += 0.15;
    }
    return Math.min(0.85, Math.max(0.1, winRate));
  }

  private generateImprovementsLocal(coverLetter: string, input: ProposalDraftInput): any[] {
    const improvements: any[] = [];
    if (!input.clientName) {
      improvements.push({
        section: 'Greeting',
        current: 'Hello',
        suggested: 'Dear [Client Name]',
        reason: 'Personalized greetings increase response rates by 15%',
      });
    }
    if (coverLetter.length < 500) {
      improvements.push({
        section: 'Length',
        current: 'Brief proposal',
        suggested: 'Add more details about your approach',
        reason: 'Proposals with 500-800 words have higher success rates',
      });
    }
    return improvements;
  }

  private async suggestRateLocal(
    input: RateSuggestionInput,
    startTime: number
  ): Promise<RateSuggestionResult> {
    const baseRate = 50 + input.skills.length * 5;
    const factors = this.analyzeRateFactorsLocal(input);
    const rateAdjustment = factors.reduce(
      (adj, f) => adj + (f.impact === 'POSITIVE' ? f.weight : -f.weight),
      0
    );
    const adjustedRate = baseRate * (1 + rateAdjustment);
    const suggestedHourlyRate = {
      min: Math.round(adjustedRate * 0.85),
      max: Math.round(adjustedRate * 1.15),
      optimal: Math.round(adjustedRate),
    };

    let marketPosition: 'BELOW_MARKET' | 'AT_MARKET' | 'ABOVE_MARKET' = 'AT_MARKET';
    const p25 = baseRate * 0.7;
    const p75 = baseRate * 1.3;
    if (suggestedHourlyRate.optimal < p25) marketPosition = 'BELOW_MARKET';
    else if (suggestedHourlyRate.optimal > p75) marketPosition = 'ABOVE_MARKET';

    const recommendations = [
      'Consider offering package deals for long-term engagements',
      ...(input.experience >= 5
        ? ['Highlight your track record and case studies to justify premium rates']
        : []),
      'Be prepared to negotiate within your range',
    ];

    await this.logInteraction(
      {
        userId: input.userId,
        interactionType: InteractionType.RATE_SUGGEST,
        inputContext: input as any,
      },
      {
        content: JSON.stringify(suggestedHourlyRate),
        confidence: 0.8,
        tokensUsed: 100,
        processingTime: Date.now() - startTime,
      }
    );

    return {
      suggestedHourlyRate,
      marketPosition,
      competitorRange: { min: p25, max: p75 },
      factors,
      recommendations,
    };
  }

  private analyzeRateFactorsLocal(input: RateSuggestionInput): any[] {
    const factors: any[] = [];
    if (input.experience >= 10) {
      factors.push({
        factor: 'Senior Experience',
        impact: 'POSITIVE',
        weight: 0.15,
        explanation: '10+ years of experience commands premium rates',
      });
    } else if (input.experience < 2) {
      factors.push({
        factor: 'Limited Experience',
        impact: 'NEGATIVE',
        weight: 0.1,
        explanation: 'Less experience may require more competitive pricing',
      });
    }
    if (input.skills.some((s) => new Set(['AI', 'Machine Learning', 'Blockchain']).has(s))) {
      factors.push({
        factor: 'High-Demand Skills',
        impact: 'POSITIVE',
        weight: 0.2,
        explanation: 'These skills are currently in high demand',
      });
    }
    if (input.projectComplexity === 'HIGH') {
      factors.push({
        factor: 'High Complexity',
        impact: 'POSITIVE',
        weight: 0.1,
        explanation: 'Complex projects justify higher rates',
      });
    }
    return factors;
  }

  private getMarketInsightsLocal(input: MarketInsightInput): MarketInsightResult {
    const baseRate = 50 + input.skills.length * 5;
    return {
      demandLevel: 'MEDIUM',
      demandTrend: 'STABLE',
      averageRate: { hourly: baseRate, project: baseRate * 160 },
      competitionLevel: 'MEDIUM',
      topCompetitors: 500,
      skillGaps: ['Cloud Architecture', 'DevOps'],
      emergingSkills: ['AI/ML', 'Web3', 'Sustainability'],
      marketTips: [
        'Highlight your specialized skills in proposals',
        'Consider expanding into emerging skill areas',
        'Build a strong portfolio to stand out from competition',
      ],
    };
  }

  // ===========================================================================
  // Message assist helpers (local — these stay in copilot-svc)
  // ===========================================================================

  private analyzeConversation(messages: string[]): any {
    return { sentiment: 'NEUTRAL', topics: ['project', 'timeline'], pendingQuestions: [] };
  }

  private generateMessage(input: MessageAssistInput, context: any): string {
    const intents: Record<string, string> = {
      NEGOTIATE:
        'I appreciate your offer. After considering the scope, I believe a rate of X would be fair given the complexity involved.',
      CLARIFY:
        'Thank you for the details. Could you please clarify the following points so I can provide a more accurate estimate?',
      DECLINE:
        "Thank you for considering me for this project. Unfortunately, I won't be able to take this on at this time.",
      ACCEPT:
        "I'm pleased to accept this project! I'm excited to get started and deliver great results.",
      FOLLOW_UP:
        'I wanted to follow up on our previous conversation. Please let me know if you have any updates.',
    };
    const key = (input.intent || 'FOLLOW_UP') as keyof typeof intents;
    return intents[key] ?? intents.FOLLOW_UP;
  }

  private generateAlternativeMessages(input: MessageAssistInput, context: any): string[] {
    return [
      'Alternative version 1: More formal approach...',
      'Alternative version 2: More casual approach...',
    ];
  }

  private analyzeTone(text: string): { current: string; recommended: string } {
    return { current: 'PROFESSIONAL', recommended: 'PROFESSIONAL' };
  }

  private identifyKeyPoints(
    input: MessageAssistInput,
    context: any
  ): { covered: string[]; missing: string[] } {
    return {
      covered: ['Project understanding', 'Timeline discussion'],
      missing: ['Budget confirmation', 'Next steps'],
    };
  }

  // ===========================================================================
  // Profile optimization helpers (local — these stay in copilot-svc)
  // ===========================================================================

  private calculateProfileCompleteness(input: ProfileOptimizeInput): number {
    let score = 0;
    if (input.currentHeadline) score += 20;
    if (input.currentSummary) score += 30;
    if (input.skills.length >= 5) score += 20;
    if (input.experience.length >= 2) score += 30;
    return score;
  }

  private generateOptimizedHeadline(input: ProfileOptimizeInput): string {
    const topSkills = input.skills.slice(0, 2).join(' & ');
    return `Expert ${topSkills} Professional | ${input.targetRoles?.[0] || 'Freelance Specialist'}`;
  }

  private generateOptimizedSummary(input: ProfileOptimizeInput): string {
    return (
      `Experienced professional specializing in ${input.skills.slice(0, 3).join(', ')}. ` +
      `With ${input.experience.length} years of experience, I help businesses achieve their goals through ` +
      `innovative solutions and dedicated service. Ready to bring value to your next project.`
    );
  }

  private async analyzeSkills(
    input: ProfileOptimizeInput
  ): Promise<{ toHighlight: string[]; toAdd: string[] }> {
    return {
      toHighlight: input.skills.slice(0, 5),
      toAdd: ['Communication', 'Project Management', 'Problem Solving'],
    };
  }

  private generateKeywordSuggestions(input: ProfileOptimizeInput): string[] {
    return [...input.skills.slice(0, 5), ...(input.targetRoles || [])];
  }

  private generateProfileImprovements(input: ProfileOptimizeInput, completeness: number): any[] {
    const improvements: any[] = [];
    if (!input.currentHeadline) {
      improvements.push({
        section: 'Headline',
        suggestion: 'Add a compelling headline to improve visibility',
        impact: 'HIGH',
      });
    }
    if (!input.currentSummary) {
      improvements.push({
        section: 'Summary',
        suggestion: 'Add a professional summary to showcase your expertise',
        impact: 'HIGH',
      });
    }
    if (input.skills.length < 10) {
      improvements.push({
        section: 'Skills',
        suggestion: 'Add more relevant skills to improve matching',
        impact: 'MEDIUM',
      });
    }
    return improvements;
  }

  // ===========================================================================
  // Shared helpers
  // ===========================================================================

  private async getUserProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
  }

  private async getUserRateHistory(userId: string) {
    const contracts = await this.prisma.proposalDraft.findMany({
      where: { userId, status: 'ACCEPTED' },
      select: { suggestedRate: true },
      take: 20,
    });
    return {
      averageRate:
        contracts.length > 0
          ? contracts.reduce(
              (s: number, c: { suggestedRate: unknown }) => s + Number(c.suggestedRate),
              0
            ) / contracts.length
          : 0,
      count: contracts.length,
    };
  }

  private async logInteraction(
    input: CopilotInteractionInput,
    response: Partial<CopilotResponse>
  ) {
    await this.prisma.copilotInteraction.create({
      data: {
        userId: input.userId,
        interactionType: input.interactionType,
        inputContext: JSON.parse(JSON.stringify(input.inputContext)),
        response: response.content,
        suggestions: [],
        confidence: response.confidence || 0,
        tokensUsed: response.tokensUsed || 0,
        processingTimeMs: response.processingTime || 0,
      },
    });
  }
}
