/**
 * @module @skillancer/market-svc/tests/smartmatch
 * SmartMatch Scoring Algorithm Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scoreCompliance,
  scoreSkills,
  scoreExperience,
  scoreTrust,
  scoreRate,
  scoreAvailability,
  scoreSuccessHistory,
  scoreResponsiveness,
} from '../services/smartmatch/scoring-functions.js';
import {
  normalizeWeights,
  calculateOverallScore,
  buildComponentScore,
  generateExplanations,
  paginate,
  sortMatches,
  formatBudgetRange,
  calculateCompetitionLevel,
} from '../services/smartmatch/score-utils.js';
import { DEFAULT_SMARTMATCH_WEIGHTS } from '../types/smartmatch.types.js';
import type {
  FreelancerSuccessMetrics,
  FreelancerWorkPattern,
  RateIntelligence,
  ComponentScore,
  MatchedFreelancer,
} from '../types/smartmatch.types.js';

// =============================================================================
// SCORING FUNCTIONS TESTS
// =============================================================================

describe('SmartMatch Scoring Functions', () => {
  // ---------------------------------------------------------------------------
  // Compliance Scoring
  // ---------------------------------------------------------------------------
  describe('scoreCompliance', () => {
    it('should return 100 when all required compliance is met', () => {
      const profile = {
        complianceTypes: ['ISO_27001', 'SOC2', 'GDPR'],
        clearanceLevels: [],
        compliances: [
          { type: 'ISO_27001', isExpiringSoon: false },
          { type: 'SOC2', isExpiringSoon: false },
          { type: 'GDPR', isExpiringSoon: false },
        ],
      };

      const result = scoreCompliance(profile, ['ISO_27001', 'SOC2'], [], undefined);

      expect(result.score).toBe(100);
      expect(result.factors.some((f) => f.name === 'Required Compliance')).toBe(true);
    });

    it('should return 0 when missing required compliance', () => {
      const profile = {
        complianceTypes: ['GDPR'],
        clearanceLevels: [],
        compliances: [{ type: 'GDPR', isExpiringSoon: false }],
      };

      const result = scoreCompliance(profile, ['ISO_27001', 'SOC2'], [], undefined);

      expect(result.score).toBe(0);
    });

    it('should add bonus for preferred compliance', () => {
      const profile = {
        complianceTypes: ['ISO_27001', 'HIPAA'],
        clearanceLevels: [],
        compliances: [
          { type: 'ISO_27001', isExpiringSoon: false },
          { type: 'HIPAA', isExpiringSoon: false },
        ],
      };

      const withPreferred = scoreCompliance(profile, ['ISO_27001'], ['HIPAA'], undefined);
      const withoutPreferred = scoreCompliance(profile, ['ISO_27001'], [], undefined);

      expect(withPreferred.score).toBeGreaterThan(withoutPreferred.score);
    });

    it('should handle clearance requirements', () => {
      const profileWithClearance = {
        complianceTypes: [],
        clearanceLevels: ['TOP_SECRET' as const],
        compliances: [],
      };

      const profileWithoutClearance = {
        complianceTypes: [],
        clearanceLevels: [],
        compliances: [],
      };

      const withClearance = scoreCompliance(profileWithClearance, [], [], 'TOP_SECRET');
      const withoutClearance = scoreCompliance(profileWithoutClearance, [], [], 'TOP_SECRET');

      expect(withClearance.score).toBeGreaterThan(withoutClearance.score);
    });

    it('should warn about expiring compliance', () => {
      const profile = {
        complianceTypes: ['ISO_27001'],
        clearanceLevels: [],
        compliances: [{ type: 'ISO_27001', isExpiringSoon: true }],
      };

      const result = scoreCompliance(profile, ['ISO_27001'], [], undefined);

      expect(result.factors.some((f) => f.name === 'Expiring Compliance')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Skills Scoring
  // ---------------------------------------------------------------------------
  describe('scoreSkills', () => {
    it('should return 100 for exact skill matches', () => {
      const result = scoreSkills(
        ['TypeScript', 'React', 'Node.js'],
        ['TypeScript', 'React', 'Node.js'],
        new Map([
          ['TypeScript', 5],
          ['React', 3],
          ['Node.js', 2],
        ]),
        new Map()
      );

      expect(result.score).toBe(100);
    });

    it('should give partial credit for partial matches', () => {
      const result = scoreSkills(
        ['TypeScript', 'React'],
        ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
        new Map(),
        new Map()
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    it('should add endorsement bonus', () => {
      const withEndorsements = scoreSkills(
        ['TypeScript'],
        ['TypeScript'],
        new Map([['TypeScript', 10]]),
        new Map()
      );

      const withoutEndorsements = scoreSkills(['TypeScript'], ['TypeScript'], new Map(), new Map());

      expect(withEndorsements.score).toBeGreaterThan(withoutEndorsements.score);
    });

    it('should give partial credit for related skills', () => {
      const result = scoreSkills(
        ['JavaScript'], // Freelancer has JavaScript
        ['TypeScript'], // Required TypeScript
        new Map(),
        new Map([
          ['typescript', { skill: 'JavaScript', strength: 0.8, relationshipType: 'SIBLING' }],
        ])
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.factors.some((f) => f.name === 'Related Skills')).toBe(true);
    });

    it('should return 0 for no matching skills', () => {
      const result = scoreSkills(
        ['Python', 'Django'],
        ['TypeScript', 'React'],
        new Map(),
        new Map()
      );

      expect(result.score).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Experience Scoring
  // ---------------------------------------------------------------------------
  describe('scoreExperience', () => {
    it('should return high score for matching experience level', () => {
      const result = scoreExperience(5, 20, 'INTERMEDIATE');

      expect(result.score).toBeGreaterThan(70);
    });

    it('should give bonus for platform projects', () => {
      const withProjects = scoreExperience(5, 50, 'INTERMEDIATE');
      const withoutProjects = scoreExperience(5, 0, 'INTERMEDIATE');

      expect(withProjects.score).toBeGreaterThan(withoutProjects.score);
    });

    it('should handle ENTRY level requirements', () => {
      const result = scoreExperience(1, 5, 'ENTRY');

      expect(result.score).toBeGreaterThan(50);
    });

    it('should handle EXPERT level requirements', () => {
      const expertResult = scoreExperience(10, 100, 'EXPERT');
      const juniorResult = scoreExperience(1, 5, 'EXPERT');

      expect(expertResult.score).toBeGreaterThan(juniorResult.score);
    });

    it('should handle missing experience data', () => {
      const result = scoreExperience(null, 0, 'INTERMEDIATE');

      expect(result.score).toBeLessThanOrEqual(50);
    });
  });

  // ---------------------------------------------------------------------------
  // Trust Scoring
  // ---------------------------------------------------------------------------
  describe('scoreTrust', () => {
    it('should return score based on trust score', () => {
      const highTrust = scoreTrust(90, 'VERIFIED', undefined);
      const lowTrust = scoreTrust(40, 'BASIC', undefined);

      expect(highTrust.score).toBeGreaterThan(lowTrust.score);
    });

    it('should add verification bonus', () => {
      const verified = scoreTrust(70, 'VERIFIED', undefined);
      const basic = scoreTrust(70, 'BASIC', undefined);

      expect(verified.score).toBeGreaterThan(basic.score);
    });

    it('should check minimum trust score', () => {
      const above = scoreTrust(80, 'BASIC', 70);
      const below = scoreTrust(60, 'BASIC', 70);

      expect(above.factors.some((f) => f.impact > 0)).toBe(true);
      expect(below.factors.some((f) => f.impact < 0)).toBe(true);
    });

    it('should cap score at 100', () => {
      const result = scoreTrust(100, 'VERIFIED', undefined);

      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Rate Scoring
  // ---------------------------------------------------------------------------
  describe('scoreRate', () => {
    const marketRate: RateIntelligence = {
      id: '1',
      skillCategory: 'Web Development',
      primarySkill: 'TypeScript',
      experienceLevel: 'INTERMEDIATE',
      region: null,
      sampleSize: 100,
      avgHourlyRate: 75,
      medianHourlyRate: 70,
      minHourlyRate: 40,
      maxHourlyRate: 150,
      percentile25: 55,
      percentile75: 95,
      percentile90: 120,
      avgFixedProjectRate: null,
      rateChangePct30d: null,
      rateChangePct90d: null,
      periodStart: new Date(),
      periodEnd: new Date(),
      createdAt: new Date(),
    };

    it('should return high score when rate is within budget', () => {
      const result = scoreRate(60, 50, 100, marketRate, 'TypeScript');

      expect(result.score).toBeGreaterThan(80);
    });

    it('should return lower score when rate exceeds budget', () => {
      const withinBudget = scoreRate(60, 50, 100, marketRate, 'TypeScript');
      const exceedsBudget = scoreRate(120, 50, 100, marketRate, 'TypeScript');

      expect(withinBudget.score).toBeGreaterThan(exceedsBudget.score);
    });

    it('should add value bonus for below-market rates', () => {
      const belowMarket = scoreRate(50, 40, 100, marketRate, 'TypeScript');

      expect(belowMarket.factors.some((f) => f.name === 'Rate Percentile')).toBe(true);
    });

    it('should handle missing rate data', () => {
      const result = scoreRate(null, 50, 100, marketRate, 'TypeScript');

      expect(result.score).toBeLessThanOrEqual(50);
    });
  });

  // ---------------------------------------------------------------------------
  // Availability Scoring
  // ---------------------------------------------------------------------------
  describe('scoreAvailability', () => {
    const workPattern: FreelancerWorkPattern = {
      id: '1',
      userId: 'user1',
      weeklyHoursAvailable: 40,
      preferredHoursPerWeek: 35,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00',
      timezone: 'America/New_York',
      avgResponseTimeMinutes: 30,
      avgFirstBidTimeHours: 2,
      preferredProjectDuration: ['WEEKLY', 'MONTHLY'],
      preferredBudgetMin: 1000,
      preferredBudgetMax: 10000,
      preferredLocationType: ['REMOTE'],
      currentActiveProjects: 1,
      maxConcurrentProjects: 3,
      unavailablePeriods: null,
      lastActiveAt: new Date(),
      lastBidAt: new Date(),
      lastProjectCompletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return high score when capacity is available', () => {
      const result = scoreAvailability(workPattern, new Date(), 20, 'America/New_York', 'WEEKLY');

      expect(result.score).toBeGreaterThan(70);
    });

    it('should give timezone overlap bonus', () => {
      const sameTimezone = scoreAvailability(
        workPattern,
        new Date(),
        20,
        'America/New_York',
        'WEEKLY'
      );
      const differentTimezone = scoreAvailability(
        workPattern,
        new Date(),
        20,
        'Asia/Tokyo',
        'WEEKLY'
      );

      expect(sameTimezone.score).toBeGreaterThan(differentTimezone.score);
    });

    it('should penalize low capacity', () => {
      const overloaded: FreelancerWorkPattern = {
        ...workPattern,
        currentActiveProjects: 3,
        maxConcurrentProjects: 3,
      };

      const result = scoreAvailability(overloaded, new Date(), 20, 'America/New_York', 'WEEKLY');

      expect(result.factors.some((f) => f.impact < 0)).toBe(true);
    });

    it('should handle missing work pattern', () => {
      const result = scoreAvailability(null, new Date(), 20, 'America/New_York', 'WEEKLY');

      expect(result.score).toBeLessThanOrEqual(50);
    });
  });

  // ---------------------------------------------------------------------------
  // Success History Scoring
  // ---------------------------------------------------------------------------
  describe('scoreSuccessHistory', () => {
    it('should return high score for excellent metrics', () => {
      const metrics: FreelancerSuccessMetrics = {
        totalProjects: 50,
        completedProjects: 48,
        cancelledProjects: 1,
        avgRating: 4.9,
        reviewCount: 45,
        repeatClientRate: 0.4,
        onTimeDeliveryRate: 0.98,
      };

      const result = scoreSuccessHistory(metrics);

      expect(result.score).toBeGreaterThan(90);
    });

    it('should penalize low completion rate', () => {
      const lowCompletion: FreelancerSuccessMetrics = {
        totalProjects: 20,
        completedProjects: 10,
        cancelledProjects: 5,
        avgRating: 4.0,
        reviewCount: 10,
        repeatClientRate: 0.1,
        onTimeDeliveryRate: 0.7,
      };

      const result = scoreSuccessHistory(lowCompletion);

      expect(result.score).toBeLessThan(70);
    });

    it('should add repeat client bonus', () => {
      const withRepeat: FreelancerSuccessMetrics = {
        totalProjects: 30,
        completedProjects: 28,
        cancelledProjects: 0,
        avgRating: 4.5,
        reviewCount: 25,
        repeatClientRate: 0.5,
        onTimeDeliveryRate: 0.9,
      };

      const withoutRepeat: FreelancerSuccessMetrics = {
        ...withRepeat,
        repeatClientRate: 0,
      };

      const withRepeatScore = scoreSuccessHistory(withRepeat);
      const withoutRepeatScore = scoreSuccessHistory(withoutRepeat);

      expect(withRepeatScore.score).toBeGreaterThan(withoutRepeatScore.score);
    });

    it('should handle new freelancer with no projects', () => {
      const newFreelancer: FreelancerSuccessMetrics = {
        totalProjects: 0,
        completedProjects: 0,
        cancelledProjects: 0,
        avgRating: 0,
        reviewCount: 0,
        repeatClientRate: 0,
        onTimeDeliveryRate: 0,
      };

      const result = scoreSuccessHistory(newFreelancer);

      expect(result.score).toBe(50); // Base score for new freelancers
    });
  });

  // ---------------------------------------------------------------------------
  // Responsiveness Scoring
  // ---------------------------------------------------------------------------
  describe('scoreResponsiveness', () => {
    it('should return high score for quick response time', () => {
      const quickResponse: FreelancerWorkPattern = {
        id: '1',
        userId: 'user1',
        weeklyHoursAvailable: 40,
        preferredHoursPerWeek: 35,
        workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
        timezone: 'America/New_York',
        avgResponseTimeMinutes: 15,
        avgFirstBidTimeHours: 1,
        preferredProjectDuration: [],
        preferredBudgetMin: null,
        preferredBudgetMax: null,
        preferredLocationType: [],
        currentActiveProjects: 1,
        maxConcurrentProjects: 3,
        unavailablePeriods: null,
        lastActiveAt: new Date(),
        lastBidAt: new Date(),
        lastProjectCompletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = scoreResponsiveness(quickResponse);

      expect(result.score).toBeGreaterThan(80);
    });

    it('should penalize slow response time', () => {
      const slowResponse: FreelancerWorkPattern = {
        id: '1',
        userId: 'user1',
        weeklyHoursAvailable: 40,
        preferredHoursPerWeek: 35,
        workingDays: [],
        workingHoursStart: null,
        workingHoursEnd: null,
        timezone: null,
        avgResponseTimeMinutes: 180, // 3 hours
        avgFirstBidTimeHours: 48, // 2 days
        preferredProjectDuration: [],
        preferredBudgetMin: null,
        preferredBudgetMax: null,
        preferredLocationType: [],
        currentActiveProjects: 0,
        maxConcurrentProjects: 3,
        unavailablePeriods: null,
        lastActiveAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        lastBidAt: null,
        lastProjectCompletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = scoreResponsiveness(slowResponse);

      expect(result.score).toBeLessThan(60);
    });

    it('should handle missing work pattern', () => {
      const result = scoreResponsiveness(null);

      expect(result.score).toBeLessThanOrEqual(50);
    });
  });
});

// =============================================================================
// SCORE UTILITIES TESTS
// =============================================================================

describe('SmartMatch Score Utilities', () => {
  // ---------------------------------------------------------------------------
  // Weight Normalization
  // ---------------------------------------------------------------------------
  describe('normalizeWeights', () => {
    it('should return default weights when empty', () => {
      const result = normalizeWeights({});

      expect(result.compliance).toBe(DEFAULT_SMARTMATCH_WEIGHTS.compliance);
      expect(result.skills).toBe(DEFAULT_SMARTMATCH_WEIGHTS.skills);
    });

    it('should normalize custom weights to sum to 1', () => {
      const result = normalizeWeights({
        compliance: 0.5,
        skills: 0.5,
      });

      const sum =
        result.compliance +
        result.skills +
        result.experience +
        result.trust +
        result.rate +
        result.availability +
        result.successHistory +
        result.responsiveness;

      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should preserve relative proportions', () => {
      const result = normalizeWeights({
        compliance: 0.4,
        skills: 0.2,
      });

      expect(result.compliance / result.skills).toBeCloseTo(2, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // Overall Score Calculation
  // ---------------------------------------------------------------------------
  describe('calculateOverallScore', () => {
    it('should calculate weighted average correctly', () => {
      const components: Record<string, ComponentScore> = {
        compliance: { score: 100, weight: 0.2, weighted: 20, factors: [] },
        skills: { score: 80, weight: 0.25, weighted: 20, factors: [] },
        experience: { score: 70, weight: 0.12, weighted: 8.4, factors: [] },
        trust: { score: 90, weight: 0.15, weighted: 13.5, factors: [] },
        rate: { score: 60, weight: 0.1, weighted: 6, factors: [] },
        availability: { score: 85, weight: 0.08, weighted: 6.8, factors: [] },
        successHistory: { score: 95, weight: 0.07, weighted: 6.65, factors: [] },
        responsiveness: { score: 75, weight: 0.03, weighted: 2.25, factors: [] },
      };

      const result = calculateOverallScore(components);

      expect(result).toBeCloseTo(83.6, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // Build Component Score
  // ---------------------------------------------------------------------------
  describe('buildComponentScore', () => {
    it('should calculate weighted score', () => {
      const scoreResult = {
        score: 80,
        factors: [{ name: 'Test', value: 80, impact: 80 }],
      };

      const result = buildComponentScore(scoreResult, 0.25);

      expect(result.score).toBe(80);
      expect(result.weight).toBe(0.25);
      expect(result.weighted).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // Explanation Generation
  // ---------------------------------------------------------------------------
  describe('generateExplanations', () => {
    it('should generate explanations for high-scoring components', () => {
      const components: Record<string, ComponentScore> = {
        compliance: { score: 100, weight: 0.2, weighted: 20, factors: [] },
        skills: { score: 95, weight: 0.25, weighted: 23.75, factors: [] },
        experience: { score: 70, weight: 0.12, weighted: 8.4, factors: [] },
        trust: { score: 90, weight: 0.15, weighted: 13.5, factors: [] },
        rate: { score: 60, weight: 0.1, weighted: 6, factors: [] },
        availability: { score: 85, weight: 0.08, weighted: 6.8, factors: [] },
        successHistory: { score: 95, weight: 0.07, weighted: 6.65, factors: [] },
        responsiveness: { score: 75, weight: 0.03, weighted: 2.25, factors: [] },
      };

      const result = generateExplanations(components, { skills: ['TypeScript'] });

      expect(result.explanations.length).toBeGreaterThan(0);
      expect(result.boosts.length).toBeGreaterThan(0);
    });

    it('should generate warnings for low-scoring components', () => {
      const components: Record<string, ComponentScore> = {
        compliance: { score: 100, weight: 0.2, weighted: 20, factors: [] },
        skills: { score: 40, weight: 0.25, weighted: 10, factors: [] },
        experience: { score: 30, weight: 0.12, weighted: 3.6, factors: [] },
        trust: { score: 50, weight: 0.15, weighted: 7.5, factors: [] },
        rate: { score: 20, weight: 0.1, weighted: 2, factors: [] },
        availability: { score: 85, weight: 0.08, weighted: 6.8, factors: [] },
        successHistory: { score: 95, weight: 0.07, weighted: 6.65, factors: [] },
        responsiveness: { score: 75, weight: 0.03, weighted: 2.25, factors: [] },
      };

      const result = generateExplanations(components, { skills: ['TypeScript'] });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------
  describe('paginate', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    it('should return correct page of results', () => {
      const result = paginate(items, { page: 1, limit: 10 });

      expect(result.items.length).toBe(10);
      expect(result.items[0].id).toBe(1);
      expect(result.items[9].id).toBe(10);
    });

    it('should return correct total count', () => {
      const result = paginate(items, { page: 1, limit: 10 });

      expect(result.total).toBe(100);
    });

    it('should handle last page with fewer items', () => {
      const result = paginate(items, { page: 10, limit: 15 });

      expect(result.items.length).toBe(10);
    });

    it('should return empty array for out of range page', () => {
      const result = paginate(items, { page: 100, limit: 10 });

      expect(result.items.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Sort Matches
  // ---------------------------------------------------------------------------
  describe('sortMatches', () => {
    const createMatch = (
      score: number,
      rate: number | null,
      rating: number | null,
      trust: number
    ): MatchedFreelancer => ({
      freelancer: {
        userId: `user-${score}`,
        name: `User ${score}`,
        avatarUrl: null,
        headline: null,
        skills: [],
        hourlyRate: rate,
        avgRating: rating,
        reviewCount: 10,
        totalProjects: 20,
        verificationLevel: 'BASIC',
      },
      score: {
        overall: score,
        components: {
          compliance: { score: 100, weight: 0.2, weighted: 20, factors: [] },
          skills: { score, weight: 0.25, weighted: score * 0.25, factors: [] },
          experience: { score: 70, weight: 0.12, weighted: 8.4, factors: [] },
          trust: { score: trust, weight: 0.15, weighted: trust * 0.15, factors: [] },
          rate: { score: 60, weight: 0.1, weighted: 6, factors: [] },
          availability: { score: 85, weight: 0.08, weighted: 6.8, factors: [] },
          successHistory: { score: 95, weight: 0.07, weighted: 6.65, factors: [] },
          responsiveness: { score: 75, weight: 0.03, weighted: 2.25, factors: [] },
        },
        explanations: [],
        warnings: [],
        boosts: [],
      },
      complianceStatus: {
        allRequirementsMet: true,
        metRequirements: [],
        missingRequirements: [],
        expiringRequirements: [],
      },
    });

    it('should sort by score descending', () => {
      const matches = [
        createMatch(70, 50, 4.0, 80),
        createMatch(90, 60, 4.5, 85),
        createMatch(80, 55, 4.2, 82),
      ];

      const result = sortMatches(matches, 'score');

      expect(result[0].score.overall).toBe(90);
      expect(result[1].score.overall).toBe(80);
      expect(result[2].score.overall).toBe(70);
    });

    it('should sort by rate ascending', () => {
      const matches = [
        createMatch(70, 60, 4.0, 80),
        createMatch(90, 40, 4.5, 85),
        createMatch(80, 50, 4.2, 82),
      ];

      const result = sortMatches(matches, 'rate');

      expect(result[0].freelancer.hourlyRate).toBe(40);
      expect(result[1].freelancer.hourlyRate).toBe(50);
      expect(result[2].freelancer.hourlyRate).toBe(60);
    });

    it('should sort by rating descending', () => {
      const matches = [
        createMatch(70, 50, 4.0, 80),
        createMatch(90, 60, 4.8, 85),
        createMatch(80, 55, 4.5, 82),
      ];

      const result = sortMatches(matches, 'rating');

      expect(result[0].freelancer.avgRating).toBe(4.8);
      expect(result[1].freelancer.avgRating).toBe(4.5);
      expect(result[2].freelancer.avgRating).toBe(4.0);
    });

    it('should sort by trust score descending', () => {
      const matches = [
        createMatch(70, 50, 4.0, 75),
        createMatch(90, 60, 4.5, 95),
        createMatch(80, 55, 4.2, 85),
      ];

      const result = sortMatches(matches, 'trust');

      expect(result[0].score.components.trust.score).toBe(95);
      expect(result[1].score.components.trust.score).toBe(85);
      expect(result[2].score.components.trust.score).toBe(75);
    });
  });

  // ---------------------------------------------------------------------------
  // Utility Functions
  // ---------------------------------------------------------------------------
  describe('formatBudgetRange', () => {
    it('should format range with both values', () => {
      expect(formatBudgetRange(1000, 5000)).toBe('$1,000 - $5,000');
    });

    it('should format range with only min', () => {
      expect(formatBudgetRange(1000, undefined)).toBe('$1,000+');
    });

    it('should format range with only max', () => {
      expect(formatBudgetRange(undefined, 5000)).toBe('Up to $5,000');
    });

    it('should handle undefined values', () => {
      expect(formatBudgetRange(undefined, undefined)).toBe('Not specified');
    });
  });

  describe('calculateCompetitionLevel', () => {
    it('should return LOW for few candidates', () => {
      expect(calculateCompetitionLevel(5)).toBe('LOW');
    });

    it('should return MEDIUM for moderate candidates', () => {
      expect(calculateCompetitionLevel(30)).toBe('MEDIUM');
    });

    it('should return HIGH for many candidates', () => {
      expect(calculateCompetitionLevel(80)).toBe('HIGH');
    });

    it('should return VERY_HIGH for very many candidates', () => {
      expect(calculateCompetitionLevel(150)).toBe('VERY_HIGH');
    });
  });
});
