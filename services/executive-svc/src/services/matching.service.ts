/**
 * Executive Matching Service
 *
 * Matches clients with appropriate executives based on their requirements,
 * using a scoring algorithm that considers multiple factors.
 */

import { prisma, Prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import type { ExecutiveType, CompanyStage } from '../types/prisma-shim.js';

interface ClientRequest {
  executiveType: ExecutiveType;
  industry?: string;
  companyStage?: CompanyStage;
  hoursPerWeek: number;
  budgetRangeMin?: number;
  budgetRangeMax?: number;
  timezone?: string;
  specificNeeds?: string[];
  urgency?: 'immediately' | 'within_30_days' | 'flexible';
}

interface MatchResult {
  executiveId: string;
  executive: {
    id: string;
    headline: string;
    yearsExecutiveExp: number;
    industries: string[];
    profilePhotoUrl?: string | null;
    availableFrom?: Date | null;
    timezone?: string | null;
    hourlyRateMin?: number | null;
    hourlyRateMax?: number | null;
    profileCompleteness: number;
  };
  matchScore: number;
  matchReasons: MatchReasons;
}

interface MatchReasons {
  typeMatch: boolean;
  industryMatch: boolean;
  stageMatch: boolean;
  availabilityMatch: boolean;
  budgetMatch: boolean;
  timezoneMatch: boolean;
  experienceLevel: 'junior' | 'mid' | 'senior' | 'expert';
  highlights: string[];
}

// Scoring weights
const SCORING_WEIGHTS = {
  TYPE_MATCH: 30, // Must match
  INDUSTRY_MATCH: 20,
  STAGE_MATCH: 15,
  AVAILABILITY_MATCH: 15,
  BUDGET_MATCH: 10,
  TIMEZONE_MATCH: 5,
  PROFILE_COMPLETENESS: 5,
} as const;

export class MatchingService {
  private readonly logger = logger.child({ service: 'MatchingService' });

  /**
   * Find matching executives for a client request
   */
  async matchExecutives(request: ClientRequest, limit = 10): Promise<MatchResult[]> {
    this.logger.info({ request, limit }, 'Finding matching executives');

    // Get all approved, searchable executives of the matching type
    const executives = await prisma.executiveProfile.findMany({
      where: {
        executiveType: request.executiveType,
        vettingStatus: 'APPROVED',
        searchable: true,
      },
      select: {
        id: true,
        headline: true,
        yearsExecutiveExp: true,
        industries: true,
        companyStages: true,
        specializations: true,
        profilePhotoUrl: true,
        availableFrom: true,
        timezone: true,
        hoursPerWeekMin: true,
        hoursPerWeekMax: true,
        hourlyRateMin: true,
        hourlyRateMax: true,
        monthlyRetainerMin: true,
        monthlyRetainerMax: true,
        profileCompleteness: true,
        currentClients: true,
        maxClients: true,
        featuredExecutive: true,
      },
    });

    // Score each executive
    const scoredExecutives = executives
      .map((exec) => this.scoreExecutive(exec, request))
      .filter((result) => result.matchScore >= 30) // Minimum threshold
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    this.logger.info(
      { matchCount: scoredExecutives.length, topScore: scoredExecutives[0]?.matchScore },
      'Matching complete'
    );

    return scoredExecutives;
  }

  /**
   * Get top matches for a client request
   */
  async getTopMatches(request: ClientRequest, limit = 5): Promise<MatchResult[]> {
    const matches = await this.matchExecutives(request, limit);
    return matches.filter((m) => m.matchScore >= 60); // Higher threshold for "top" matches
  }

  /**
   * Explain why an executive matches a request
   */
  explainMatch(matchResult: MatchResult): string[] {
    const explanations: string[] = [];
    const reasons = matchResult.matchReasons;

    if (reasons.typeMatch) {
      explanations.push(`Verified ${matchResult.executive.headline}`);
    }

    if (reasons.industryMatch) {
      explanations.push('Has direct experience in your industry');
    }

    if (reasons.stageMatch) {
      explanations.push('Has worked with companies at your growth stage');
    }

    if (reasons.availabilityMatch) {
      explanations.push('Available to start within your timeline');
    }

    if (reasons.budgetMatch) {
      explanations.push('Rates align with your budget range');
    }

    if (reasons.timezoneMatch) {
      explanations.push('Located in a compatible timezone');
    }

    explanations.push(...reasons.highlights);

    return explanations;
  }

  /**
   * Predict success score for an executive-client pairing
   */
  async predictSuccessScore(
    executiveId: string,
    request: ClientRequest
  ): Promise<{
    score: number;
    confidence: number;
    factors: Array<{ name: string; impact: 'positive' | 'neutral' | 'negative'; weight: number }>;
  }> {
    const executive = await prisma.executiveProfile.findUnique({
      where: { id: executiveId },
      include: {
        engagements: {
          where: { status: 'COMPLETED' },
          select: { id: true },
        },
      },
    });

    if (!executive) {
      throw new Error('Executive not found');
    }

    const factors: Array<{
      name: string;
      impact: 'positive' | 'neutral' | 'negative';
      weight: number;
    }> = [];

    // Experience factor
    const expFactor =
      executive.yearsExecutiveExp >= 10
        ? 'positive'
        : executive.yearsExecutiveExp >= 5
          ? 'neutral'
          : 'negative';
    factors.push({ name: 'Years of Experience', impact: expFactor, weight: 15 });

    // Industry match
    const industryMatch = request.industry && executive.industries.includes(request.industry);
    factors.push({
      name: 'Industry Experience',
      impact: industryMatch ? 'positive' : 'neutral',
      weight: 20,
    });

    // Stage match
    const stageMatch =
      request.companyStage && executive.companyStages.includes(request.companyStage);
    factors.push({
      name: 'Company Stage Experience',
      impact: stageMatch ? 'positive' : 'neutral',
      weight: 15,
    });

    // Past success (completed engagements)
    const completedEngagements = executive.engagements.length;
    const successFactor =
      completedEngagements >= 5 ? 'positive' : completedEngagements >= 1 ? 'neutral' : 'negative';
    factors.push({ name: 'Track Record', impact: successFactor, weight: 25 });

    // Profile completeness
    const profileFactor =
      executive.profileCompleteness >= 90
        ? 'positive'
        : executive.profileCompleteness >= 70
          ? 'neutral'
          : 'negative';
    factors.push({ name: 'Profile Quality', impact: profileFactor, weight: 10 });

    // Availability
    const isAvailable = !executive.availableFrom || executive.availableFrom <= new Date();
    factors.push({
      name: 'Immediate Availability',
      impact: isAvailable ? 'positive' : 'neutral',
      weight: 15,
    });

    // Calculate overall score
    let score = 0;
    for (const factor of factors) {
      if (factor.impact === 'positive') score += factor.weight;
      else if (factor.impact === 'neutral') score += factor.weight * 0.5;
    }

    // Confidence based on data availability
    const confidence = Math.min(
      30 + executive.profileCompleteness * 0.3 + completedEngagements * 5,
      95
    );

    return { score: Math.round(score), confidence: Math.round(confidence), factors };
  }

  /**
   * Create a match request from a client
   */
  async createMatchRequest(data: {
    clientName: string;
    clientEmail: string;
    clientCompany: string;
    clientTitle?: string;
    executiveType: ExecutiveType;
    companyStage?: CompanyStage;
    companySize?: string;
    industry?: string;
    hoursPerWeek: number;
    budgetRangeMin?: number;
    budgetRangeMax?: number;
    timeline?: string;
    specificNeeds?: string;
  }) {
    this.logger.info(
      { clientEmail: data.clientEmail, executiveType: data.executiveType },
      'Creating match request'
    );

    const matchRequest = await prisma.executiveMatchRequest.create({
      data: {
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientCompany: data.clientCompany,
        clientTitle: data.clientTitle,
        executiveType: data.executiveType,
        companyStage: data.companyStage,
        companySize: data.companySize,
        industry: data.industry,
        requirements: {},
        hoursPerWeek: data.hoursPerWeek,
        budgetRangeMin: data.budgetRangeMin,
        budgetRangeMax: data.budgetRangeMax,
        timeline: data.timeline,
        specificNeeds: data.specificNeeds,
        status: 'PENDING',
      },
    });

    return matchRequest;
  }

  /**
   * Process a match request and find matches
   */
  async processMatchRequest(requestId: string) {
    const request = await prisma.executiveMatchRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Match request not found');
    }

    // Update status to matching
    await prisma.executiveMatchRequest.update({
      where: { id: requestId },
      data: { status: 'MATCHING' },
    });

    // Find matches
    const clientRequest: ClientRequest = {
      executiveType: request.executiveType,
      industry: request.industry || undefined,
      companyStage: request.companyStage || undefined,
      hoursPerWeek: request.hoursPerWeek,
      budgetRangeMin: request.budgetRangeMin?.toNumber(),
      budgetRangeMax: request.budgetRangeMax?.toNumber(),
    };

    const matches = await this.matchExecutives(clientRequest, 5);

    // Create match records
    for (const match of matches) {
      await prisma.executiveMatch.create({
        data: {
          requestId,
          executiveId: match.executiveId,
          matchScore: match.matchScore,
          matchReasons: match.matchReasons as unknown as Prisma.InputJsonValue,
          status: 'SUGGESTED',
        },
      });
    }

    // Update request status
    await prisma.executiveMatchRequest.update({
      where: { id: requestId },
      data: { status: 'MATCHES_SENT' },
    });

    return matches;
  }

  /**
   * Request an introduction to an executive
   */
  async requestIntroduction(matchId: string, message?: string) {
    const match = await prisma.executiveMatch.findUnique({
      where: { id: matchId },
      include: {
        request: true,
        executive: true,
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Update match status
    await prisma.executiveMatch.update({
      where: { id: matchId },
      data: {
        status: 'INTRO_REQUESTED',
        clientInterested: true,
        clientNotes: message,
      },
    });

    // TODO: Send notification to executive
    // notificationService.sendIntroRequestNotification(match.executive, match.request, message);

    this.logger.info({ matchId, executiveId: match.executiveId }, 'Introduction requested');

    return { success: true };
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private scoreExecutive(
    executive: {
      id: string;
      headline: string;
      yearsExecutiveExp: number;
      industries: string[];
      companyStages: CompanyStage[];
      specializations: string[];
      profilePhotoUrl?: string | null;
      availableFrom?: Date | null;
      timezone?: string | null;
      hoursPerWeekMin?: number | null;
      hoursPerWeekMax?: number | null;
      hourlyRateMin?: { toNumber(): number } | null;
      hourlyRateMax?: { toNumber(): number } | null;
      monthlyRetainerMin?: { toNumber(): number } | null;
      monthlyRetainerMax?: { toNumber(): number } | null;
      profileCompleteness: number;
      currentClients: number;
      maxClients: number;
      featuredExecutive: boolean;
    },
    request: ClientRequest
  ): MatchResult {
    let score = 0;
    const reasons: MatchReasons = {
      typeMatch: true, // Already filtered by type
      industryMatch: false,
      stageMatch: false,
      availabilityMatch: false,
      budgetMatch: false,
      timezoneMatch: false,
      experienceLevel: this.getExperienceLevel(executive.yearsExecutiveExp),
      highlights: [],
    };

    // Type match (already filtered, add base score)
    score += SCORING_WEIGHTS.TYPE_MATCH;

    // Industry match
    if (request.industry && executive.industries.includes(request.industry)) {
      score += SCORING_WEIGHTS.INDUSTRY_MATCH;
      reasons.industryMatch = true;
      reasons.highlights.push(`${executive.yearsExecutiveExp}+ years in ${request.industry}`);
    } else if (!request.industry) {
      score += SCORING_WEIGHTS.INDUSTRY_MATCH * 0.5; // Partial score if no preference
    }

    // Company stage match
    if (request.companyStage && executive.companyStages.includes(request.companyStage)) {
      score += SCORING_WEIGHTS.STAGE_MATCH;
      reasons.stageMatch = true;
    } else if (!request.companyStage) {
      score += SCORING_WEIGHTS.STAGE_MATCH * 0.5;
    }

    // Availability match
    const now = new Date();
    const isAvailableNow = !executive.availableFrom || executive.availableFrom <= now;
    const hasCapacity = executive.currentClients < executive.maxClients;
    const meetsHourRequirement =
      !executive.hoursPerWeekMax || executive.hoursPerWeekMax >= request.hoursPerWeek;

    if (isAvailableNow && hasCapacity && meetsHourRequirement) {
      score += SCORING_WEIGHTS.AVAILABILITY_MATCH;
      reasons.availabilityMatch = true;
      if (request.urgency === 'immediately') {
        reasons.highlights.push('Available to start immediately');
      }
    } else if (hasCapacity && meetsHourRequirement) {
      score += SCORING_WEIGHTS.AVAILABILITY_MATCH * 0.5;
    }

    // Budget match
    if (request.budgetRangeMin !== undefined && request.budgetRangeMax !== undefined) {
      const execMin = executive.hourlyRateMin?.toNumber() || 0;
      const execMax = executive.hourlyRateMax?.toNumber() || Infinity;

      if (execMin <= request.budgetRangeMax && execMax >= request.budgetRangeMin) {
        score += SCORING_WEIGHTS.BUDGET_MATCH;
        reasons.budgetMatch = true;
      } else if (execMin <= request.budgetRangeMax * 1.2) {
        score += SCORING_WEIGHTS.BUDGET_MATCH * 0.5; // Within 20%
      }
    } else {
      score += SCORING_WEIGHTS.BUDGET_MATCH * 0.5;
    }

    // Timezone match
    if (request.timezone && executive.timezone) {
      const isCompatible = this.isTimezoneCompatible(request.timezone, executive.timezone);
      if (isCompatible) {
        score += SCORING_WEIGHTS.TIMEZONE_MATCH;
        reasons.timezoneMatch = true;
      }
    } else {
      score += SCORING_WEIGHTS.TIMEZONE_MATCH * 0.5;
    }

    // Profile completeness
    score += (executive.profileCompleteness / 100) * SCORING_WEIGHTS.PROFILE_COMPLETENESS;

    // Bonus for featured executives
    if (executive.featuredExecutive) {
      score += 5;
      reasons.highlights.push('Featured Executive');
    }

    // Experience bonus
    if (executive.yearsExecutiveExp >= 15) {
      reasons.highlights.push('15+ years executive experience');
    }

    return {
      executiveId: executive.id,
      executive: {
        id: executive.id,
        headline: executive.headline,
        yearsExecutiveExp: executive.yearsExecutiveExp,
        industries: executive.industries,
        profilePhotoUrl: executive.profilePhotoUrl,
        availableFrom: executive.availableFrom,
        timezone: executive.timezone,
        hourlyRateMin: executive.hourlyRateMin?.toNumber() || null,
        hourlyRateMax: executive.hourlyRateMax?.toNumber() || null,
        profileCompleteness: executive.profileCompleteness,
      },
      matchScore: Math.round(score),
      matchReasons: reasons,
    };
  }

  private getExperienceLevel(years: number): 'junior' | 'mid' | 'senior' | 'expert' {
    if (years >= 15) return 'expert';
    if (years >= 10) return 'senior';
    if (years >= 5) return 'mid';
    return 'junior';
  }

  private isTimezoneCompatible(tz1: string, tz2: string): boolean {
    // Simplified timezone compatibility check
    // In production, use proper timezone library
    const timezoneGroups: Record<string, string[]> = {
      americas: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
      europe: ['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam'],
      asia: ['Asia/Tokyo', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Mumbai'],
    };

    for (const group of Object.values(timezoneGroups)) {
      if (group.includes(tz1) && group.includes(tz2)) {
        return true;
      }
    }

    return tz1 === tz2;
  }
}

export const matchingService = new MatchingService();
