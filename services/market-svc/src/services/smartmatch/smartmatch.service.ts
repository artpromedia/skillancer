/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/**
 * @module @skillancer/market-svc/services/smartmatch/smartmatch.service
 * SmartMatch Service - Intelligent freelancer-to-project matching
 */

import {
  buildComponentScore,
  calculateOverallScore,
  generateExplanations,
  normalizeWeights,
  sortMatches,
  paginate,
  generateSearchId,
  type SortByOption,
} from './score-utils.js';
import {
  scoreCompliance,
  scoreSkills,
  scoreExperience,
  scoreTrust,
  scoreRate,
  scoreAvailability,
  scoreSuccessHistory,
  scoreResponsiveness,
  type ComplianceProfile,
} from './scoring-functions.js';
import { SmartMatchError, SmartMatchErrorCode } from '../../errors/smartmatch.errors.js';
import { SmartMatchRepository } from '../../repositories/smartmatch.repository.js';

import type {
  MatchScoreBreakdown,
  MatchingCriteria,
  SmartMatchConfig,
  SmartMatchWeights,
  FreelancerSuccessMetrics,
  FreelancerWorkPattern,
  RateIntelligence,
  MatchedFreelancer,
  FindMatchesResult,
  FreelancerProfileSummary,
  ComplianceStatus,
  MatchingEventType,
  MatchingOutcome,
  RelatedSkillMatch,
  VerificationLevel,
  ClearanceLevel,
} from '../../types/smartmatch.types.js';
import type { PrismaClient } from '../../types/prisma-shim.js';

// =============================================================================
// TYPE DEFINITIONS FOR PRISMA RESULTS
// =============================================================================

interface PrismaSkill {
  skill: {
    name: string;
  };
}

interface PrismaProfile {
  yearsExperience?: number | null;
  hourlyRate?: unknown;
  title?: string | null;
}

interface PrismaTrustScore {
  overallScore: number;
}

interface PrismaRatingAggregation {
  averageRating?: unknown;
  totalReviews?: number | null;
}

interface PrismaContract {
  status: string;
  clientUserId?: string;
}

interface PrismaCompliance {
  complianceType: string;
  expiresAt?: Date | null;
}

interface PrismaClearance {
  clearanceLevel: string;
}

interface PrismaContractV2 {
  id: string;
  status: string;
  completedAt: Date | null;
  clientUserId: string;
}

interface FreelancerProfile {
  id: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  verificationLevel?: string | null;
  skills: PrismaSkill[];
  profile?: PrismaProfile | null;
  trustScore?: PrismaTrustScore | null;
  ratingAggregation?: PrismaRatingAggregation | null;
  contractsAsFreelancer?: PrismaContract[];
  contractsAsFreelancerV2?: PrismaContractV2[];
  freelancerCompliances?: PrismaCompliance[];
  securityClearances?: PrismaClearance[];
}

interface WorkPatternData {
  id: string;
  userId: string;
  weeklyHoursAvailable: number | null;
  preferredHoursPerWeek: number | null;
  workingDays: string[] | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  timezone: string | null;
  avgResponseTimeMinutes: number | null;
  avgFirstBidTimeHours: number | null;
  preferredProjectDuration: string[] | null;
  preferredBudgetMin: unknown;
  preferredBudgetMax: unknown;
  preferredLocationType: string[] | null;
  currentActiveProjects: number | null;
  maxConcurrentProjects: number | null;
  unavailablePeriods: unknown;
  lastActiveAt: Date | null;
  lastBidAt: Date | null;
  lastProjectCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MarketRateData {
  id: string;
  skillCategory: string;
  primarySkill: string | null;
  experienceLevel: string | null;
  region: string | null;
  sampleSize: number;
  avgHourlyRate: unknown;
  medianHourlyRate: unknown;
  minHourlyRate: unknown;
  maxHourlyRate: unknown;
  percentile25: unknown;
  percentile75: unknown;
  percentile90: unknown;
  avgFixedProjectRate: unknown;
  rateChangePct30d: unknown;
  rateChangePct90d: unknown;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export class SmartMatchService {
  private readonly repository: SmartMatchRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.repository = new SmartMatchRepository(prisma);
  }

  // ===========================================================================
  // SCORE CALCULATION
  // ===========================================================================

  /**
   * Calculate match score for a single freelancer against criteria
   */
  async calculateMatchScore(
    freelancerUserId: string,
    criteria: MatchingCriteria,
    config?: Partial<SmartMatchConfig>
  ): Promise<MatchScoreBreakdown> {
    // Get freelancer data
    const [profile, workPattern, successMetrics] = await Promise.all([
      this.repository.getFreelancerProfile(freelancerUserId),
      this.repository.getWorkPattern(freelancerUserId),
      this.getSuccessMetrics(freelancerUserId),
    ]);

    if (!profile) {
      throw new SmartMatchError(SmartMatchErrorCode.FREELANCER_NOT_FOUND);
    }

    // Normalize weights
    const weights = normalizeWeights(config?.weights ?? {});

    // Build compliance profile
    const complianceProfile = await this.buildComplianceProfile(freelancerUserId);

    // Get related skills map
    const relatedSkillsMap = await this.buildRelatedSkillsMap(
      criteria.skills,
      profile.skills.map((s) => s.skill.name)
    );

    // Get endorsement counts
    const endorsementCounts = await this.repository.getEndorsementCounts(freelancerUserId);

    // Get market rate
    const marketRate = criteria.skills[0]
      ? await this.repository.getMarketRate({
          skillCategory: criteria.skills[0],
          primarySkill: criteria.skills[0],
        })
      : null;

    // Calculate each component score
    const complianceScore = scoreCompliance(
      complianceProfile,
      criteria.requiredCompliance || [],
      criteria.preferredCompliance || [],
      criteria.requiredClearance
    );

    const skillsScore = scoreSkills(
      profile.skills.map((s) => s.skill.name),
      criteria.skills,
      endorsementCounts,
      relatedSkillsMap
    );

    const experienceScore = scoreExperience(
      profile.profile?.yearsExperience ?? null,
      (profile.contractsAsFreelancer?.length ?? 0) + (profile.contractsAsFreelancerV2?.length ?? 0),
      criteria.experienceLevel
    );

    const trustScoreValue = profile.trustScore?.overallScore ?? 50;
    const trustScoreResult = scoreTrust(
      trustScoreValue,
      profile.verificationLevel as VerificationLevel,
      criteria.minTrustScore
    );

    const hourlyRate = profile.profile?.hourlyRate ? Number(profile.profile.hourlyRate) : null;
    const rateScore = scoreRate(
      hourlyRate,
      criteria.budgetMin,
      criteria.budgetMax,
      marketRate ? this.convertMarketRate(marketRate) : null,
      criteria.skills[0]
    );

    const availabilityScore = scoreAvailability(
      workPattern ? this.convertWorkPattern(workPattern) : null,
      criteria.startDate,
      criteria.hoursPerWeek,
      criteria.timezone,
      criteria.durationType
    );

    const successHistoryScore = scoreSuccessHistory(successMetrics);

    const responsivenessScore = scoreResponsiveness(
      workPattern ? this.convertWorkPattern(workPattern) : null
    );

    // Build component scores with weights
    const components: MatchScoreBreakdown['components'] = {
      compliance: buildComponentScore(complianceScore, weights.compliance),
      skills: buildComponentScore(skillsScore, weights.skills),
      experience: buildComponentScore(experienceScore, weights.experience),
      trust: buildComponentScore(trustScoreResult, weights.trust),
      rate: buildComponentScore(rateScore, weights.rate),
      availability: buildComponentScore(availabilityScore, weights.availability),
      successHistory: buildComponentScore(successHistoryScore, weights.successHistory),
      responsiveness: buildComponentScore(responsivenessScore, weights.responsiveness),
    };

    // Calculate overall score
    const overall = calculateOverallScore(components);

    // Generate explanations
    const { explanations, warnings, boosts } = generateExplanations(components, criteria);

    return {
      overall,
      components,
      explanations,
      warnings,
      boosts,
    };
  }

  // ===========================================================================
  // FIND MATCHES
  // ===========================================================================

  /**
   * Find best matching freelancers for given criteria
   */
  async findMatches(
    clientUserId: string,
    criteria: MatchingCriteria,
    options: {
      weights?: Partial<SmartMatchWeights>;
      page?: number;
      limit?: number;
      sortBy?: SortByOption;
    } = {}
  ): Promise<FindMatchesResult> {
    const { page = 1, limit = 20, sortBy = 'score' } = options;

    // Get candidate freelancers
    const { users } = await this.repository.getFreelancersForMatching({
      skills: criteria.skills,
      excludeUserIds: [...(criteria.excludeUserIds || []), clientUserId],
      limit: 500, // Get more candidates for scoring
    });

    // Score each candidate
    const scoredMatches: MatchedFreelancer[] = [];

    for (const user of users) {
      try {
        const score = await this.calculateMatchScore(
          user.id,
          criteria,
          options.weights ? { weights: normalizeWeights(options.weights) } : undefined
        );

        // Skip if essential requirements not met (score = 0 in compliance)
        if (score.components.compliance.score === 0 && criteria.requiredCompliance?.length) {
          continue;
        }

        const complianceStatus = this.buildComplianceStatus(
          user as unknown as FreelancerProfile,
          criteria.requiredCompliance || [],
          criteria.preferredCompliance || []
        );

        const freelancerSummary = this.buildFreelancerSummary(user as unknown as FreelancerProfile);

        scoredMatches.push({
          freelancer: freelancerSummary,
          score,
          complianceStatus,
        });
      } catch {
        // Skip freelancers that fail scoring
        continue;
      }
    }

    // Sort matches
    const sortedMatches = sortMatches(scoredMatches, sortBy);

    // Paginate results
    const paginatedResult = paginate(sortedMatches, { page, limit });

    // Generate search ID for tracking
    const searchId = generateSearchId();

    // Record matching events for learning
    await this.recordSearchEvents(clientUserId, criteria, paginatedResult.items, searchId);

    return {
      matches: paginatedResult.items,
      total: paginatedResult.total,
      searchId,
    };
  }

  // ===========================================================================
  // MATCHING EVENTS
  // ===========================================================================

  /**
   * Record matching event
   */
  async recordMatchingEvent(
    eventType: MatchingEventType,
    clientUserId: string,
    freelancerUserId: string,
    data: {
      projectId?: string;
      serviceId?: string;
      matchScore?: number;
      matchRank?: number;
      matchFactors?: Record<string, number>;
      searchCriteria?: MatchingCriteria;
    }
  ): Promise<void> {
    await this.repository.createMatchingEvent({
      eventType,
      clientUserId,
      freelancerUserId,
      ...data,
    });
  }

  /**
   * Update matching outcome
   */
  async updateMatchingOutcome(
    eventId: string,
    outcome: MatchingOutcome,
    data?: {
      wasHired?: boolean;
      projectSuccessful?: boolean;
      clientSatisfactionScore?: number;
    }
  ): Promise<void> {
    await this.repository.updateMatchingEventOutcome(eventId, {
      outcome,
      ...data,
    });
  }

  // ===========================================================================
  // WORK PATTERN MANAGEMENT
  // ===========================================================================

  /**
   * Get work pattern for a freelancer
   */
  async getWorkPattern(userId: string) {
    return this.repository.getWorkPattern(userId);
  }

  /**
   * Update work pattern for a freelancer
   */
  async updateWorkPattern(
    userId: string,
    data: {
      weeklyHoursAvailable?: number;
      preferredHoursPerWeek?: number;
      workingDays?: string[];
      workingHoursStart?: string;
      workingHoursEnd?: string;
      timezone?: string;
      preferredProjectDuration?: string[];
      preferredBudgetMin?: number;
      preferredBudgetMax?: number;
      preferredLocationType?: string[];
      maxConcurrentProjects?: number;
    }
  ) {
    return this.repository.upsertWorkPattern(userId, data);
  }

  /**
   * Update last activity
   */
  async trackActivity(userId: string): Promise<void> {
    await this.repository.updateLastActive(userId);
  }

  /**
   * Update last bid
   */
  async trackBid(userId: string): Promise<void> {
    await this.repository.updateLastBid(userId);
  }

  // ===========================================================================
  // SKILL ENDORSEMENTS
  // ===========================================================================

  /**
   * Endorse a freelancer's skill
   */
  async endorseSkill(
    endorserUserId: string,
    freelancerUserId: string,
    skill: string,
    data: {
      endorsementType: 'WORKED_WITH' | 'VERIFIED_SKILL' | 'RECOMMENDATION';
      projectId?: string;
      comment?: string;
    }
  ) {
    // Prevent self-endorsement
    if (endorserUserId === freelancerUserId) {
      throw new SmartMatchError(SmartMatchErrorCode.SELF_ENDORSEMENT_NOT_ALLOWED);
    }

    // Check if already endorsed
    const exists = await this.repository.endorsementExists(freelancerUserId, skill, endorserUserId);
    if (exists) {
      throw new SmartMatchError(SmartMatchErrorCode.ENDORSEMENT_EXISTS);
    }

    return this.repository.createEndorsement(endorserUserId, {
      userId: freelancerUserId,
      skill,
      endorsementType: data.endorsementType,
      ...(data.projectId && { projectId: data.projectId }),
      ...(data.comment && { comment: data.comment }),
    });
  }

  /**
   * Get endorsements for a freelancer
   */
  async getEndorsements(userId: string, skill?: string) {
    return this.repository.getSkillEndorsements(userId, skill);
  }

  // ===========================================================================
  // SKILL RELATIONSHIPS
  // ===========================================================================

  /**
   * Get related skills
   */
  async getRelatedSkills(skill: string) {
    return this.repository.findRelatedSkills(skill);
  }

  /**
   * Create skill relationship
   */
  async createSkillRelationship(data: {
    skill1: string;
    skill2: string;
    relationshipType: 'PARENT_CHILD' | 'SIBLING' | 'COMPLEMENTARY' | 'PREREQUISITE';
    strength: number;
    bidirectional?: boolean;
  }) {
    return this.repository.createSkillRelationship(data);
  }

  // ===========================================================================
  // RATE INTELLIGENCE
  // ===========================================================================

  /**
   * Get market rate for a skill
   */
  async getMarketRate(
    skillCategory: string,
    primarySkill?: string,
    experienceLevel?: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT',
    region?: string
  ) {
    return this.repository.getMarketRate({
      skillCategory,
      ...(primarySkill && { primarySkill }),
      ...(experienceLevel && { experienceLevel }),
      ...(region && { region }),
    });
  }

  /**
   * Get rate trends for a skill
   */
  async getRateTrends(skillCategory: string, periods?: number) {
    return this.repository.getRateTrends(skillCategory, periods);
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  private async buildComplianceProfile(userId: string): Promise<ComplianceProfile> {
    const profile = (await this.repository.getFreelancerProfile(
      userId
    )) as FreelancerProfile | null;

    if (!profile) {
      return {
        complianceTypes: [],
        clearanceLevels: [],
        compliances: [],
      };
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const compliances = (profile.freelancerCompliances || []).map((c: PrismaCompliance) => ({
      type: c.complianceType,
      isExpiringSoon: c.expiresAt ? new Date(c.expiresAt) <= thirtyDaysFromNow : false,
    }));

    return {
      complianceTypes: compliances.map((c: { type: string }) => c.type),
      clearanceLevels: (profile.securityClearances || []).map(
        (c: PrismaClearance) => c.clearanceLevel
      ) as ClearanceLevel[],
      compliances,
    };
  }

  private async buildRelatedSkillsMap(
    requiredSkills: string[],
    freelancerSkills: string[]
  ): Promise<Map<string, RelatedSkillMatch | null>> {
    const map = new Map<string, RelatedSkillMatch | null>();
    const normalizedFreelancerSkills = new Set(freelancerSkills.map((s) => s.toLowerCase()));

    for (const skill of requiredSkills) {
      const normalizedSkill = skill.toLowerCase();

      // If freelancer has exact skill, no need to find related
      if (normalizedFreelancerSkills.has(normalizedSkill)) {
        map.set(normalizedSkill, null);
        continue;
      }

      // Find related skills
      const relatedSkills = await this.repository.findRelatedSkills(skill);

      // Check if freelancer has any related skill
      const matchingRelated = relatedSkills.find((rel) =>
        normalizedFreelancerSkills.has(rel.skill.toLowerCase())
      );

      map.set(normalizedSkill, matchingRelated || null);
    }

    return map;
  }

  private async getSuccessMetrics(userId: string): Promise<FreelancerSuccessMetrics> {
    const profile = (await this.repository.getFreelancerProfile(
      userId
    )) as FreelancerProfile | null;

    if (!profile) {
      return {
        totalProjects: 0,
        completedProjects: 0,
        cancelledProjects: 0,
        avgRating: 0,
        reviewCount: 0,
        repeatClientRate: 0,
        onTimeDeliveryRate: 0,
      };
    }

    // Combine both old and new contract relations
    const contractsV1 = profile.contractsAsFreelancer || [];
    const contractsV2 = profile.contractsAsFreelancerV2 || [];

    // Use V2 contracts if available, otherwise fall back to V1
    const contracts = contractsV2.length > 0 ? contractsV2 : contractsV1;
    const completed = contracts.filter((c: { status: string }) => c.status === 'COMPLETED');
    const cancelled = contracts.filter((c: { status: string }) => c.status === 'CANCELLED');

    // Calculate repeat client rate - use clientUserId from V2 or clientId from V1
    const clientIds =
      contractsV2.length > 0
        ? contractsV2.map((c: PrismaContractV2) => c.clientUserId).filter(Boolean)
        : contractsV1.map((c: PrismaContract) => c.clientUserId).filter(Boolean);
    const uniqueClients = new Set(clientIds).size;
    const repeatClients = clientIds.length > uniqueClients ? clientIds.length - uniqueClients : 0;

    return {
      totalProjects: contracts.length,
      completedProjects: completed.length,
      cancelledProjects: cancelled.length,
      avgRating: profile.ratingAggregation?.averageRating
        ? Number(profile.ratingAggregation.averageRating)
        : 0,
      reviewCount: profile.ratingAggregation?.totalReviews ?? 0,
      repeatClientRate: contracts.length > 0 ? repeatClients / contracts.length : 0,
      onTimeDeliveryRate: completed.length > 0 ? 0.9 : 0, // Placeholder
    };
  }

  private convertWorkPattern(pattern: WorkPatternData): FreelancerWorkPattern {
    // Build base result with required properties
    const result: Record<string, unknown> = {
      id: pattern.id,
      userId: pattern.userId,
      workingDays: pattern.workingDays || [],
      preferredProjectDuration: pattern.preferredProjectDuration || [],
      preferredLocationType: pattern.preferredLocationType || [],
      currentActiveProjects: pattern.currentActiveProjects ?? 0,
      maxConcurrentProjects: pattern.maxConcurrentProjects ?? 3,
      createdAt: pattern.createdAt,
      updatedAt: pattern.updatedAt,
    };

    // Define optional property mappings (property name -> value transformer)
    const optionalProps: [keyof WorkPatternData, string, (v: unknown) => unknown][] = [
      ['weeklyHoursAvailable', 'weeklyHoursAvailable', (v) => v],
      ['preferredHoursPerWeek', 'preferredHoursPerWeek', (v) => v],
      ['workingHoursStart', 'workingHoursStart', (v) => v],
      ['workingHoursEnd', 'workingHoursEnd', (v) => v],
      ['timezone', 'timezone', (v) => v],
      ['avgResponseTimeMinutes', 'avgResponseTimeMinutes', (v) => v],
      ['avgFirstBidTimeHours', 'avgFirstBidTimeHours', (v) => v],
      ['preferredBudgetMin', 'preferredBudgetMin', (v) => (v ? Number(v) : null)],
      ['preferredBudgetMax', 'preferredBudgetMax', (v) => (v ? Number(v) : null)],
      ['unavailablePeriods', 'unavailablePeriods', (v) => v ?? null],
      ['lastActiveAt', 'lastActiveAt', (v) => v],
      ['lastBidAt', 'lastBidAt', (v) => v],
      ['lastProjectCompletedAt', 'lastProjectCompletedAt', (v) => v],
    ];

    // Add optional properties when defined
    for (const [sourceKey, targetKey, transform] of optionalProps) {
      if (pattern[sourceKey] !== undefined) {
        result[targetKey] = transform(pattern[sourceKey]);
      }
    }

    return result as unknown as FreelancerWorkPattern;
  }

  private convertMarketRate(rate: MarketRateData): RateIntelligence {
    return {
      id: rate.id,
      skillCategory: rate.skillCategory,
      primarySkill: rate.primarySkill,
      experienceLevel: rate.experienceLevel as RateIntelligence['experienceLevel'],
      region: rate.region,
      sampleSize: rate.sampleSize,
      avgHourlyRate: Number(rate.avgHourlyRate),
      medianHourlyRate: Number(rate.medianHourlyRate),
      minHourlyRate: Number(rate.minHourlyRate),
      maxHourlyRate: Number(rate.maxHourlyRate),
      percentile25: Number(rate.percentile25),
      percentile75: Number(rate.percentile75),
      percentile90: Number(rate.percentile90),
      avgFixedProjectRate: rate.avgFixedProjectRate ? Number(rate.avgFixedProjectRate) : null,
      rateChangePct30d: rate.rateChangePct30d ? Number(rate.rateChangePct30d) : null,
      rateChangePct90d: rate.rateChangePct90d ? Number(rate.rateChangePct90d) : null,
      periodStart: rate.periodStart,
      periodEnd: rate.periodEnd,
      createdAt: rate.createdAt,
    };
  }

  private buildComplianceStatus(
    user: FreelancerProfile,
    requiredCompliance: string[],
    _preferredCompliance: string[]
  ): ComplianceStatus {
    const userComplianceTypes = new Set(
      (user.freelancerCompliances || []).map((c) => c.complianceType)
    );

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const metRequirements = requiredCompliance.filter((r) => userComplianceTypes.has(r));
    const missingRequirements = requiredCompliance.filter((r) => !userComplianceTypes.has(r));

    const expiringRequirements = (user.freelancerCompliances || [])
      .filter((c) => c.expiresAt && new Date(c.expiresAt) <= thirtyDaysFromNow)
      .map((c) => c.complianceType);

    return {
      allRequirementsMet: missingRequirements.length === 0,
      metRequirements,
      missingRequirements,
      expiringRequirements,
    };
  }

  private buildFreelancerSummary(user: FreelancerProfile): FreelancerProfileSummary {
    return {
      userId: user.id,
      name: user.displayName || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      avatarUrl: user.avatarUrl ?? null,
      headline: user.profile?.title ?? null,
      skills: (user.skills || []).map((s) => s.skill.name),
      hourlyRate: user.profile?.hourlyRate ? Number(user.profile.hourlyRate) : null,
      avgRating: user.ratingAggregation?.averageRating
        ? Number(user.ratingAggregation.averageRating)
        : null,
      reviewCount: user.ratingAggregation?.totalReviews ?? 0,
      totalProjects:
        (user.contractsAsFreelancer?.length ?? 0) + (user.contractsAsFreelancerV2?.length ?? 0),
      verificationLevel: (user.verificationLevel as VerificationLevel) ?? 'NONE',
    };
  }

  private async recordSearchEvents(
    clientUserId: string,
    criteria: MatchingCriteria,
    matches: MatchedFreelancer[],
    _searchId: string
  ): Promise<void> {
    // Record first 10 results for learning
    const recordPromises = matches.slice(0, 10).map(async (match, index) =>
      this.repository.createMatchingEvent({
        eventType: 'SEARCH_RESULT',
        clientUserId,
        freelancerUserId: match.freelancer.userId,
        ...(criteria.projectId && { projectId: criteria.projectId }),
        matchScore: match.score.overall,
        matchRank: index + 1,
        matchFactors: {
          compliance: match.score.components.compliance.weighted,
          skills: match.score.components.skills.weighted,
          experience: match.score.components.experience.weighted,
          trust: match.score.components.trust.weighted,
          rate: match.score.components.rate.weighted,
          availability: match.score.components.availability.weighted,
          successHistory: match.score.components.successHistory.weighted,
          responsiveness: match.score.components.responsiveness.weighted,
        },
        searchCriteria: criteria,
      })
    );

    await Promise.allSettled(recordPromises);
  }
}
