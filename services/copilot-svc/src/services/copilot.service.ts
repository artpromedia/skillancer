import { PrismaClient } from '@prisma/client';
import {
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
  Suggestion,
  SuggestionType,
  InteractionType,
} from '../types/copilot.types';

export class CopilotService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a proposal draft
   */
  async generateProposalDraft(input: ProposalDraftInput): Promise<ProposalDraftResult> {
    const startTime = Date.now();

    // Get user's profile and history
    const [userProfile, previousProposals] = await Promise.all([
      this.getUserProfile(input.userId),
      this.getSuccessfulProposals(input.userId),
    ]);

    // Calculate skill match
    const skillMatch = this.calculateSkillMatch(input.requiredSkills, input.userSkills);

    // Generate cover letter based on patterns
    const coverLetter = this.generateCoverLetter(input, userProfile, skillMatch);

    // Calculate suggested rate
    const suggestedRate = await this.calculateSuggestedRate(input);

    // Generate key points
    const keyPoints = this.generateKeyPoints(input, skillMatch);

    // Calculate estimated win rate
    const estimatedWinRate = this.estimateWinRate(skillMatch, suggestedRate, input);

    // Generate improvements
    const improvements = this.generateImprovements(coverLetter, input);

    // Store the draft
    const draft = await this.prisma.proposalDraft.create({
      data: {
        userId: input.userId,
        jobId: input.jobId,
        jobTitle: input.jobTitle,
        content: coverLetter,
        suggestedRate: suggestedRate.optimal,
        estimatedWinRate,
        keyPoints,
        improvements: JSON.parse(JSON.stringify(improvements)),
        status: 'DRAFT',
      },
    });

    // Log interaction
    await this.logInteraction({
      userId: input.userId,
      interactionType: InteractionType.PROPOSAL_DRAFT,
      inputContext: input as any,
    }, {
      content: coverLetter,
      confidence: estimatedWinRate,
      tokensUsed: coverLetter.length / 4, // Approximate
      processingTime: Date.now() - startTime,
    });

    return {
      draftId: draft.id,
      content: coverLetter,
      coverLetter,
      keyPoints,
      suggestedRate: suggestedRate.optimal,
      rateJustification: suggestedRate.justification,
      estimatedWinRate,
      improvements,
    };
  }

  /**
   * Get rate suggestions
   */
  async suggestRate(input: RateSuggestionInput): Promise<RateSuggestionResult> {
    const startTime = Date.now();

    // Get market data for skills
    const marketData = await this.getMarketRates(input.skills, input.industry);

    // Get user's history
    const userHistory = await this.getUserRateHistory(input.userId);

    // Calculate suggested rate based on factors
    const factors = this.analyzeRateFactors(input, marketData, userHistory);

    // Calculate final rate suggestion
    const rateAdjustment = factors.reduce((adj, f) => adj + (f.impact === 'POSITIVE' ? f.weight : -f.weight), 0);
    const baseRate = marketData.averageRate;
    const adjustedRate = baseRate * (1 + rateAdjustment);

    const suggestedHourlyRate = {
      min: Math.round(adjustedRate * 0.85),
      max: Math.round(adjustedRate * 1.15),
      optimal: Math.round(adjustedRate),
    };

    // Determine market position
    let marketPosition: 'BELOW_MARKET' | 'AT_MARKET' | 'ABOVE_MARKET' = 'AT_MARKET';
    if (suggestedHourlyRate.optimal < marketData.p25) marketPosition = 'BELOW_MARKET';
    else if (suggestedHourlyRate.optimal > marketData.p75) marketPosition = 'ABOVE_MARKET';

    // Generate recommendations
    const recommendations = this.generateRateRecommendations(input, marketData, factors);

    // Log interaction
    await this.logInteraction({
      userId: input.userId,
      interactionType: InteractionType.RATE_SUGGEST,
      inputContext: input as any,
    }, {
      content: JSON.stringify(suggestedHourlyRate),
      confidence: 0.8,
      tokensUsed: 100,
      processingTime: Date.now() - startTime,
    });

    return {
      suggestedHourlyRate,
      marketPosition,
      competitorRange: {
        min: marketData.p25,
        max: marketData.p75,
      },
      factors,
      recommendations,
    };
  }

  /**
   * Assist with message drafting
   */
  async assistMessage(input: MessageAssistInput): Promise<MessageAssistResult> {
    const startTime = Date.now();

    // Analyze conversation context
    const contextAnalysis = this.analyzeConversation(input.conversationContext);

    // Generate suggested message
    const suggestedMessage = this.generateMessage(input, contextAnalysis);

    // Generate alternative versions
    const alternativeVersions = this.generateAlternativeMessages(input, contextAnalysis);

    // Analyze current draft tone if provided
    const toneAnalysis = input.draftMessage
      ? this.analyzeTone(input.draftMessage)
      : { current: 'NEUTRAL', recommended: input.tone || 'PROFESSIONAL' };

    // Identify key points and gaps
    const { covered, missing } = this.identifyKeyPoints(input, contextAnalysis);

    // Log interaction
    await this.logInteraction({
      userId: input.userId,
      interactionType: InteractionType.MESSAGE_ASSIST,
      inputContext: input as any,
    }, {
      content: suggestedMessage,
      confidence: 0.75,
      tokensUsed: suggestedMessage.length / 4,
      processingTime: Date.now() - startTime,
    });

    return {
      suggestedMessage,
      alternativeVersions,
      toneAnalysis,
      keyPointsCovered: covered,
      missingPoints: missing,
    };
  }

  /**
   * Optimize user profile
   */
  async optimizeProfile(input: ProfileOptimizeInput): Promise<ProfileOptimizeResult> {
    const startTime = Date.now();

    // Analyze current profile completeness
    const completenessScore = this.calculateProfileCompleteness(input);

    // Generate optimized headline
    const optimizedHeadline = this.generateOptimizedHeadline(input);

    // Generate optimized summary
    const optimizedSummary = this.generateOptimizedSummary(input);

    // Analyze skills
    const { toHighlight, toAdd } = await this.analyzeSkills(input);

    // Generate keyword suggestions for SEO
    const keywordSuggestions = this.generateKeywordSuggestions(input);

    // Generate improvement suggestions
    const improvements = this.generateProfileImprovements(input, completenessScore);

    // Log interaction
    await this.logInteraction({
      userId: input.userId,
      interactionType: InteractionType.PROFILE_OPTIMIZE,
      inputContext: input as any,
    }, {
      content: optimizedSummary,
      confidence: 0.85,
      tokensUsed: 200,
      processingTime: Date.now() - startTime,
    });

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
   * Get market insights
   */
  async getMarketInsights(input: MarketInsightInput): Promise<MarketInsightResult> {
    // Get market data
    const marketData = await this.getMarketRates(input.skills, input.industry);

    // Analyze demand
    const demandAnalysis = await this.analyzeDemand(input.skills, input.industry);

    // Identify skill gaps and emerging skills
    const { gaps, emerging } = await this.analyzeSkillTrends(input.skills, input.industry);

    // Generate tips
    const tips = this.generateMarketTips(input, demandAnalysis, marketData);

    return {
      demandLevel: demandAnalysis.level,
      demandTrend: demandAnalysis.trend,
      averageRate: {
        hourly: marketData.averageRate,
        project: marketData.averageRate * 160, // Approximate monthly
      },
      competitionLevel: demandAnalysis.competition,
      topCompetitors: demandAnalysis.competitorCount,
      skillGaps: gaps,
      emergingSkills: emerging,
      marketTips: tips,
    };
  }

  /**
   * Get proposal draft by ID
   */
  async getProposalDraft(draftId: string) {
    const draft = await this.prisma.proposalDraft.findUnique({
      where: { id: draftId },
    });
    return draft;
  }

  /**
   * Update proposal draft
   */
  async updateProposalDraft(draftId: string, content: string) {
    const draft = await this.prisma.proposalDraft.update({
      where: { id: draftId },
      data: { content, updatedAt: new Date() },
    });
    return draft;
  }

  /**
   * Get user's proposal drafts
   */
  async getUserProposalDrafts(userId: string, status?: string) {
    const where: any = { userId };
    if (status) where.status = status;

    const drafts = await this.prisma.proposalDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return drafts;
  }

  /**
   * Get user's copilot interaction history
   */
  async getInteractionHistory(userId: string, type?: InteractionType, limit = 50) {
    const where: any = { userId };
    if (type) where.interactionType = type;

    const interactions = await this.prisma.copilotInteraction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return interactions;
  }

  // Private helper methods

  private async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    return user;
  }

  private async getSuccessfulProposals(userId: string) {
    const drafts = await this.prisma.proposalDraft.findMany({
      where: {
        userId,
        status: 'ACCEPTED',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return drafts;
  }

  private calculateSkillMatch(required: string[], userSkills: string[]): number {
    const requiredLower = required.map((s) => s.toLowerCase());
    const userLower = userSkills.map((s) => s.toLowerCase());

    const matched = requiredLower.filter((s) => userLower.includes(s));
    return required.length > 0 ? matched.length / required.length : 0;
  }

  private generateCoverLetter(input: ProposalDraftInput, profile: any, skillMatch: number): string {
    const userName = profile?.firstName || 'there';
    const matchedSkills = input.requiredSkills.filter((s) =>
      input.userSkills.map((u) => u.toLowerCase()).includes(s.toLowerCase())
    );

    let tone = 'professional';
    if (input.tone === 'FRIENDLY') tone = 'friendly';
    else if (input.tone === 'FORMAL') tone = 'formal';

    const greeting = input.clientName ? `Dear ${input.clientName}` : 'Hello';

    const intro = `${greeting},

I'm excited to apply for the ${input.jobTitle} position. With my expertise in ${matchedSkills.slice(0, 3).join(', ')}${matchedSkills.length > 3 ? ' and more' : ''}, I'm confident I can deliver exceptional results for your project.`;

    const body = `
After reviewing your requirements, I understand you need ${this.summarizeRequirements(input.jobDescription)}. This aligns perfectly with my experience, particularly in:

${matchedSkills.slice(0, 4).map((s) => `• ${s}`).join('\n')}

${input.emphasis ? `I'd particularly like to emphasize my strength in ${input.emphasis.join(' and ')}.` : ''}`;

    const timeline = input.proposedTimeline
      ? `\nI can complete this project within ${input.proposedTimeline}.`
      : '';

    const closing = `
I'd love to discuss how I can help achieve your goals. Let's schedule a call to explore this further.

Best regards,
${userName}`;

    return intro + body + timeline + closing;
  }

  private summarizeRequirements(description: string): string {
    // Simple summarization - in production would use NLP
    const sentences = description.split(/[.!?]/);
    return sentences[0]?.trim() || 'a skilled professional';
  }

  private async calculateSuggestedRate(input: ProposalDraftInput): Promise<{
    optimal: number;
    justification: string;
  }> {
    // Get market rates for skills
    const marketData = await this.getMarketRates(input.requiredSkills, input.clientIndustry);

    let rate = marketData.averageRate;

    // Adjust based on budget if provided
    if (input.budget) {
      const budgetRate = (input.budget.min + input.budget.max) / 2;
      rate = Math.min(rate, budgetRate * 1.1); // Don't exceed budget by too much
    }

    return {
      optimal: Math.round(rate),
      justification: `Based on market rates for ${input.requiredSkills.slice(0, 2).join(' and ')} skills`,
    };
  }

  private generateKeyPoints(input: ProposalDraftInput, skillMatch: number): string[] {
    const points: string[] = [];

    points.push(`${Math.round(skillMatch * 100)}% skill match with requirements`);

    if (skillMatch >= 0.8) {
      points.push('Strong alignment with all key requirements');
    }

    if (input.userSkills.length >= input.requiredSkills.length) {
      points.push('Comprehensive skill coverage');
    }

    points.push('Ready to start immediately');

    return points;
  }

  private estimateWinRate(skillMatch: number, rate: { optimal: number }, input: ProposalDraftInput): number {
    let winRate = 0.3; // Base rate

    // Skill match bonus
    winRate += skillMatch * 0.3;

    // Rate competitiveness
    if (input.budget) {
      const midBudget = (input.budget.min + input.budget.max) / 2;
      if (rate.optimal <= midBudget) winRate += 0.15;
    }

    return Math.min(0.85, Math.max(0.1, winRate));
  }

  private generateImprovements(coverLetter: string, input: ProposalDraftInput): any[] {
    const improvements: any[] = [];

    // Check for personalization
    if (!input.clientName) {
      improvements.push({
        section: 'Greeting',
        current: 'Hello',
        suggested: 'Dear [Client Name]',
        reason: 'Personalized greetings increase response rates by 15%',
      });
    }

    // Check length
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

  private async getMarketRates(skills: string[], industry?: string): Promise<{
    averageRate: number;
    p25: number;
    p75: number;
  }> {
    // In production, this would query actual market data
    // For now, return reasonable defaults based on skill count
    const baseRate = 50 + skills.length * 5;

    return {
      averageRate: baseRate,
      p25: baseRate * 0.7,
      p75: baseRate * 1.3,
    };
  }

  private async getUserRateHistory(userId: string) {
    const contracts = await this.prisma.proposalDraft.findMany({
      where: {
        userId,
        status: 'ACCEPTED',
      },
      select: { suggestedRate: true },
      take: 20,
    });

    return {
      averageRate: contracts.length > 0
        ? contracts.reduce((s, c) => s + Number(c.suggestedRate), 0) / contracts.length
        : 0,
      count: contracts.length,
    };
  }

  private analyzeRateFactors(input: RateSuggestionInput, marketData: any, userHistory: any): any[] {
    const factors: any[] = [];

    // Experience factor
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

    // Skill demand factor
    if (input.skills.some((s) => ['AI', 'Machine Learning', 'Blockchain'].includes(s))) {
      factors.push({
        factor: 'High-Demand Skills',
        impact: 'POSITIVE',
        weight: 0.2,
        explanation: 'These skills are currently in high demand',
      });
    }

    // Complexity factor
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

  private generateRateRecommendations(input: RateSuggestionInput, marketData: any, factors: any[]): string[] {
    const recommendations: string[] = [];

    recommendations.push('Consider offering package deals for long-term engagements');

    if (input.experience >= 5) {
      recommendations.push('Highlight your track record and case studies to justify premium rates');
    }

    recommendations.push('Be prepared to negotiate within your range');

    return recommendations;
  }

  private analyzeConversation(messages: string[]): any {
    return {
      sentiment: 'NEUTRAL',
      topics: ['project', 'timeline'],
      pendingQuestions: [],
    };
  }

  private generateMessage(input: MessageAssistInput, context: any): string {
    const intents: Record<string, string> = {
      NEGOTIATE: 'I appreciate your offer. After considering the scope, I believe a rate of X would be fair given the complexity involved.',
      CLARIFY: 'Thank you for the details. Could you please clarify the following points so I can provide a more accurate estimate?',
      DECLINE: 'Thank you for considering me for this project. Unfortunately, I won\'t be able to take this on at this time.',
      ACCEPT: 'I\'m pleased to accept this project! I\'m excited to get started and deliver great results.',
      FOLLOW_UP: 'I wanted to follow up on our previous conversation. Please let me know if you have any updates.',
    };

    return intents[input.intent || 'FOLLOW_UP'];
  }

  private generateAlternativeMessages(input: MessageAssistInput, context: any): string[] {
    return [
      'Alternative version 1: More formal approach...',
      'Alternative version 2: More casual approach...',
    ];
  }

  private analyzeTone(text: string): { current: string; recommended: string } {
    return {
      current: 'PROFESSIONAL',
      recommended: 'PROFESSIONAL',
    };
  }

  private identifyKeyPoints(input: MessageAssistInput, context: any): { covered: string[]; missing: string[] } {
    return {
      covered: ['Project understanding', 'Timeline discussion'],
      missing: ['Budget confirmation', 'Next steps'],
    };
  }

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
    return `Experienced professional specializing in ${input.skills.slice(0, 3).join(', ')}. ` +
      `With ${input.experience.length} years of experience, I help businesses achieve their goals through ` +
      `innovative solutions and dedicated service. Ready to bring value to your next project.`;
  }

  private async analyzeSkills(input: ProfileOptimizeInput): Promise<{ toHighlight: string[]; toAdd: string[] }> {
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

  private async analyzeDemand(skills: string[], industry?: string): Promise<{
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    trend: 'RISING' | 'STABLE' | 'FALLING';
    competition: 'HIGH' | 'MEDIUM' | 'LOW';
    competitorCount: number;
  }> {
    // In production, would analyze real market data
    return {
      level: 'MEDIUM',
      trend: 'STABLE',
      competition: 'MEDIUM',
      competitorCount: 500,
    };
  }

  private async analyzeSkillTrends(skills: string[], industry?: string): Promise<{
    gaps: string[];
    emerging: string[];
  }> {
    return {
      gaps: ['Cloud Architecture', 'DevOps'],
      emerging: ['AI/ML', 'Web3', 'Sustainability'],
    };
  }

  private generateMarketTips(input: MarketInsightInput, demand: any, market: any): string[] {
    return [
      'Highlight your specialized skills in proposals',
      'Consider expanding into emerging skill areas',
      'Build a strong portfolio to stand out from competition',
    ];
  }

  private async logInteraction(input: CopilotInteractionInput, response: Partial<CopilotResponse>) {
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
