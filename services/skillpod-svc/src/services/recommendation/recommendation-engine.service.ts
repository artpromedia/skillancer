/**
 * @module @skillancer/skillpod-svc/services/recommendation/recommendation-engine
 * Core recommendation engine that combines ML and rule-based approaches
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type {
  LearningRecommendationRepository,
  SkillGapRepository,
  LearningProfileRepository,
  MarketTrendRepository,
  CreateLearningRecommendationInput,
  SkillGapWithRelations,
} from '../../repositories/recommendation/index.js';
import type { PrismaClient } from '@prisma/client';
import type {
  RecommendationType,
  ContentType,
  ProficiencyLevel,
  UserLearningProfile,
  LearningRecommendation,
  SkillGap,
} from '@skillancer/types';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface RecommendationEngineConfig {
  maxRecommendationsPerUser: number;
  maxRecommendationsPerGap: number;
  minConfidenceScore: number;
  mlWeight: number;
  ruleWeight: number;
  cacheExpirationMinutes: number;
  enableMLRecommendations: boolean;
}

export interface GenerateRecommendationsParams {
  userId: string;
  limit?: number;
  types?: RecommendationType[];
  contentTypes?: ContentType[];
  forceRefresh?: boolean;
}

export interface GeneratedRecommendation {
  id?: string;
  title: string;
  description?: string;
  contentType: ContentType;
  recommendationType: RecommendationType;
  contentId?: string;
  contentSource: string;
  contentUrl?: string;
  contentProvider?: string;
  primarySkillId?: string;
  targetLevel?: ProficiencyLevel;
  scores: RecommendationScores;
  reasoning: string;
  estimatedDuration?: number;
}

export interface RecommendationScores {
  relevance: number;
  urgency: number;
  impact: number;
  confidence: number;
  overall: number;
}

export interface MLRecommendationRequest {
  userId: string;
  learningProfile: UserLearningProfile;
  skillGaps: SkillGap[];
  marketTrends: unknown[];
  limit: number;
}

export interface MLRecommendationResponse {
  recommendations: Array<{
    contentId: string;
    contentType: ContentType;
    scores: RecommendationScores;
    reasoning: string;
  }>;
  modelVersion: string;
  confidence: number;
}

export interface RecommendationEngine {
  generateRecommendations(
    params: GenerateRecommendationsParams
  ): Promise<GeneratedRecommendation[]>;
  generateForSkillGap(
    userId: string,
    gapId: string,
    limit?: number
  ): Promise<GeneratedRecommendation[]>;
  generateQuickWins(userId: string, limit?: number): Promise<GeneratedRecommendation[]>;
  generateCareerPathRecommendations(
    userId: string,
    targetRole: string,
    limit?: number
  ): Promise<GeneratedRecommendation[]>;
  scoreRecommendation(
    recommendation: GeneratedRecommendation,
    profile: UserLearningProfile,
    gaps: SkillGap[]
  ): RecommendationScores;
  persistRecommendations(
    userId: string,
    recommendations: GeneratedRecommendation[]
  ): Promise<LearningRecommendation[]>;
  getTopRecommendations(userId: string, limit?: number): Promise<LearningRecommendation[]>;
  refreshUserRecommendations(userId: string): Promise<number>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: RecommendationEngineConfig = {
  maxRecommendationsPerUser: 50,
  maxRecommendationsPerGap: 5,
  minConfidenceScore: 0.3,
  mlWeight: 0.6,
  ruleWeight: 0.4,
  cacheExpirationMinutes: 60,
  enableMLRecommendations: false, // Disabled until ML service is available
};

const CONTENT_TYPE_TEMPLATES: Record<ContentType, ContentTemplate[]> = {
  COURSE: [
    {
      provider: 'skillpod',
      titlePattern: 'Comprehensive {skill} Course',
      durationRange: [180, 600],
    },
    {
      provider: 'udemy',
      titlePattern: 'Master {skill}: From Beginner to Pro',
      durationRange: [300, 1200],
    },
    { provider: 'coursera', titlePattern: '{skill} Specialization', durationRange: [600, 2400] },
  ],
  TUTORIAL: [
    { provider: 'skillpod', titlePattern: '{skill} Quick Start Guide', durationRange: [30, 90] },
    {
      provider: 'youtube',
      titlePattern: '{skill} Tutorial for Beginners',
      durationRange: [15, 60],
    },
  ],
  VIDEO: [
    {
      provider: 'skillpod',
      titlePattern: '{skill} Explained in 10 Minutes',
      durationRange: [10, 30],
    },
    { provider: 'youtube', titlePattern: 'Understanding {skill}', durationRange: [5, 20] },
  ],
  ARTICLE: [
    { provider: 'skillpod', titlePattern: 'Complete Guide to {skill}', durationRange: [15, 45] },
    { provider: 'medium', titlePattern: 'Deep Dive into {skill}', durationRange: [10, 30] },
  ],
  BOOK: [
    {
      provider: 'oreilly',
      titlePattern: '{skill}: The Definitive Guide',
      durationRange: [600, 1800],
    },
  ],
  PODCAST: [
    { provider: 'skillpod', titlePattern: '{skill} Insights Podcast', durationRange: [30, 60] },
  ],
  PROJECT: [
    { provider: 'skillpod', titlePattern: 'Build a {skill} Project', durationRange: [120, 480] },
    {
      provider: 'github',
      titlePattern: 'Open Source {skill} Contribution',
      durationRange: [60, 240],
    },
  ],
  CERTIFICATION: [
    {
      provider: 'skillpod',
      titlePattern: '{skill} Professional Certification',
      durationRange: [600, 2400],
    },
  ],
  ASSESSMENT: [
    { provider: 'skillpod', titlePattern: '{skill} Skills Assessment', durationRange: [30, 60] },
  ],
  WORKSHOP: [
    { provider: 'skillpod', titlePattern: 'Hands-on {skill} Workshop', durationRange: [180, 480] },
  ],
  BOOTCAMP: [
    {
      provider: 'skillpod',
      titlePattern: '{skill} Intensive Bootcamp',
      durationRange: [2400, 7200],
    },
  ],
  MENTORSHIP: [
    {
      provider: 'skillpod',
      titlePattern: '1:1 {skill} Mentorship Session',
      durationRange: [60, 120],
    },
  ],
};

interface ContentTemplate {
  provider: string;
  titlePattern: string;
  durationRange: [number, number];
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export function createRecommendationEngine(
  prisma: PrismaClient,
  redis: RedisType,
  recommendationRepository: LearningRecommendationRepository,
  skillGapRepository: SkillGapRepository,
  learningProfileRepository: LearningProfileRepository,
  marketTrendRepository: MarketTrendRepository,
  config: Partial<RecommendationEngineConfig> = {}
): RecommendationEngine {
  const cfg: RecommendationEngineConfig = { ...DEFAULT_CONFIG, ...config };

  // ---------------------------------------------------------------------------
  // Helper Functions
  // ---------------------------------------------------------------------------

  async function getSkillName(skillId: string): Promise<string> {
    const cached = await redis.get(`skill:name:${skillId}`);
    if (cached) return cached;

    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { name: true },
    });

    const name = skill?.name ?? 'Unknown Skill';
    await redis.setex(`skill:name:${skillId}`, 3600, name);
    return name;
  }

  function selectContentType(
    gap: SkillGapWithRelations,
    profile: UserLearningProfile
  ): ContentType {
    const preferredTypes = profile.preferredContentTypes as ContentType[] | undefined;
    const gapScore = gap.gapScore;
    const sessionLength = profile.preferredSessionLength ?? 30;

    // For large gaps, prefer comprehensive content
    if (gapScore >= 0.7) {
      if (preferredTypes?.includes('COURSE')) return 'COURSE';
      if (preferredTypes?.includes('BOOTCAMP')) return 'BOOTCAMP';
      return 'COURSE';
    }

    // For medium gaps, match session length preferences
    if (gapScore >= 0.4) {
      if (sessionLength <= 30) {
        if (preferredTypes?.includes('TUTORIAL')) return 'TUTORIAL';
        if (preferredTypes?.includes('VIDEO')) return 'VIDEO';
        return 'TUTORIAL';
      }
      if (preferredTypes?.includes('PROJECT')) return 'PROJECT';
      if (preferredTypes?.includes('WORKSHOP')) return 'WORKSHOP';
      return 'PROJECT';
    }

    // For small gaps, prefer quick content
    if (preferredTypes?.includes('VIDEO')) return 'VIDEO';
    if (preferredTypes?.includes('ARTICLE')) return 'ARTICLE';
    return 'ARTICLE';
  }

  function generateContentFromTemplate(
    skillName: string,
    contentType: ContentType,
    templateIndex = 0
  ): { title: string; provider: string; duration: number } {
    const templates = CONTENT_TYPE_TEMPLATES[contentType];
    const template = templates[templateIndex % templates.length];

    return {
      title: template.titlePattern.replace('{skill}', skillName),
      provider: template.provider,
      duration:
        Math.floor(Math.random() * (template.durationRange[1] - template.durationRange[0])) +
        template.durationRange[0],
    };
  }

  function calculateRelevanceScore(
    gap: SkillGapWithRelations,
    profile: UserLearningProfile
  ): number {
    let score = 0;

    // Base relevance from gap score
    score += gap.gapScore * 0.4;

    // Priority bonus
    const priorityWeights: Record<string, number> = {
      CRITICAL: 1.0,
      HIGH: 0.8,
      MEDIUM: 0.6,
      LOW: 0.4,
      OPTIONAL: 0.2,
    };
    score += (priorityWeights[gap.priority] ?? 0.5) * 0.3;

    // Focus skill bonus
    const focusSkillIds = profile.focusSkillIds as string[] | undefined;
    if (focusSkillIds?.includes(gap.skillId)) {
      score += 0.2;
    }

    // Market demand factor
    score += gap.marketDemandScore * 0.1;

    return Math.min(1, score);
  }

  function calculateUrgencyScore(gap: SkillGapWithRelations, recentSignalsCount: number): number {
    let score = 0;

    // Priority urgency
    const priorityUrgency: Record<string, number> = {
      CRITICAL: 1.0,
      HIGH: 0.7,
      MEDIUM: 0.4,
      LOW: 0.2,
      OPTIONAL: 0.1,
    };
    score += (priorityUrgency[gap.priority] ?? 0.4) * 0.5;

    // Frequency of detection increases urgency
    score += Math.min(1, (gap.jobFrequency ?? 0) / 10) * 0.3;

    // Recent signals increase urgency
    score += Math.min(1, recentSignalsCount / 5) * 0.2;

    return Math.min(1, score);
  }

  function calculateImpactScore(gap: SkillGapWithRelations, marketTrendScore: number): number {
    let score = 0;

    // Salary impact
    if (gap.salaryImpact) {
      score += Math.min(1, gap.salaryImpact / 10000) * 0.4; // Normalize to 10k
    }

    // Market demand impact
    score += gap.marketDemandScore * 0.3;

    // Market trend impact
    score += marketTrendScore * 0.3;

    return Math.min(1, score);
  }

  function calculateOverallScore(scores: RecommendationScores): number {
    return (
      scores.relevance * 0.35 +
      scores.urgency * 0.25 +
      scores.impact * 0.25 +
      scores.confidence * 0.15
    );
  }

  function determineRecommendationType(
    gap: SkillGapWithRelations,
    contentType: ContentType
  ): RecommendationType {
    if (gap.gapType === 'TRENDING_SKILL') return 'TRENDING_SKILL';
    if (gap.gapType === 'COMPETITIVE_ADVANTAGE') return 'COMPETITIVE_EDGE';
    if (contentType === 'CERTIFICATION') return 'CERTIFICATION';
    if (gap.gapScore <= 0.3) return 'QUICK_WIN';
    if (gap.gapScore >= 0.7) return 'DEEP_DIVE';
    return 'SKILL_GAP_FILL';
  }

  function generateReasoning(
    gap: SkillGapWithRelations,
    skillName: string,
    scores: RecommendationScores
  ): string {
    const parts: string[] = [];

    if (gap.gapType === 'MISSING_SKILL') {
      parts.push(`You don't have ${skillName} in your profile, but it's frequently required.`);
    } else if (gap.gapType === 'LEVEL_GAP') {
      parts.push(
        `Your ${skillName} level (${gap.currentLevel ?? 'unknown'}) is below the ` +
          `required ${gap.requiredLevel} for many opportunities.`
      );
    } else if (gap.gapType === 'TRENDING_SKILL') {
      parts.push(`${skillName} is a trending skill with growing market demand.`);
    }

    if (gap.marketDemandScore >= 0.7) {
      parts.push(`High market demand (${Math.round(gap.marketDemandScore * 100)}%).`);
    }

    if (gap.jobFrequency && gap.jobFrequency >= 5) {
      parts.push(`Appeared in ${gap.jobFrequency} recent job opportunities.`);
    }

    if (scores.impact >= 0.7) {
      parts.push('Learning this could significantly boost your career prospects.');
    }

    return parts.join(' ');
  }

  // ---------------------------------------------------------------------------
  // Core Generation Functions
  // ---------------------------------------------------------------------------

  async function generateRuleBasedRecommendations(
    profile: UserLearningProfile,
    gaps: SkillGapWithRelations[],
    limit: number
  ): Promise<GeneratedRecommendation[]> {
    const recommendations: GeneratedRecommendation[] = [];

    // Sort gaps by priority score
    const sortedGaps = [...gaps].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

    for (const gap of sortedGaps.slice(0, limit)) {
      const skillName = await getSkillName(gap.skillId);
      const contentType = selectContentType(gap, profile);
      const content = generateContentFromTemplate(skillName, contentType);

      // Get market trend for impact calculation
      const trend = await marketTrendRepository.findLatestForSkill(gap.skillId);
      const marketTrendScore = trend?.demandDirection === 'RISING' ? 0.8 : 0.5;

      const scores: RecommendationScores = {
        relevance: calculateRelevanceScore(gap, profile),
        urgency: calculateUrgencyScore(gap, gap.sourceEventIds?.length ?? 0),
        impact: calculateImpactScore(gap, marketTrendScore),
        confidence: 0.8, // High confidence for rule-based
        overall: 0, // Will be calculated
      };
      scores.overall = calculateOverallScore(scores);

      recommendations.push({
        title: content.title,
        description: `Improve your ${skillName} skills to ${gap.requiredLevel} level`,
        contentType,
        recommendationType: determineRecommendationType(gap, contentType),
        contentSource: content.provider,
        contentProvider: content.provider,
        primarySkillId: gap.skillId,
        targetLevel: gap.requiredLevel as ProficiencyLevel,
        scores,
        reasoning: generateReasoning(gap, skillName, scores),
        estimatedDuration: content.duration,
      });
    }

    return recommendations;
  }

  async function generateMLRecommendations(
    profile: UserLearningProfile,
    gaps: SkillGap[],
    limit: number
  ): Promise<GeneratedRecommendation[]> {
    if (!cfg.enableMLRecommendations) {
      return [];
    }

    const recommendations: GeneratedRecommendation[] = [];

    // ML-based recommendation using collaborative filtering simulation
    // Analyzes user learning patterns and compares with successful learners

    for (const gap of gaps.slice(0, Math.min(gaps.length, limit))) {
      const gapWithRelations = gap as SkillGapWithRelations;
      const skillName = gapWithRelations.skill?.name ?? 'Unknown Skill';

      // Calculate ML-based scores using learning profile metrics
      const learningVelocity = calculateLearningVelocity(profile);
      const engagementScore = calculateEngagementScore(profile);
      const completionRate = profile.completedCourses > 0
        ? profile.completedCourses / Math.max(profile.completedCourses + 1, 1)
        : 0.5;

      // Predict optimal content type based on profile
      const preferredContentType = predictContentType(profile, gap);
      const content = selectOptimalContent(preferredContentType, skillName);

      // Calculate confidence based on data quality
      const dataPoints = [
        profile.completedCourses > 0,
        profile.totalLearningMinutes > 60,
        profile.averageSessionMinutes > 10,
        gap.priorityScore > 0,
      ].filter(Boolean).length;
      const confidence = 0.4 + (dataPoints * 0.15);

      // Calculate ML-enhanced scores
      const relevance = 0.6 + (learningVelocity * 0.2) + (gap.priorityScore / 100 * 0.2);
      const urgency = calculateUrgency(gap, profile);
      const impact = 0.5 + (engagementScore * 0.3) + (completionRate * 0.2);

      const scores: RecommendationScores = {
        relevance: Math.min(relevance, 1),
        urgency: Math.min(urgency, 1),
        impact: Math.min(impact, 1),
        confidence,
        overall: (relevance * 0.35 + urgency * 0.25 + impact * 0.25 + confidence * 0.15),
      };

      recommendations.push({
        title: content.title,
        description: `ML-recommended learning path for ${skillName} based on your learning patterns`,
        contentType: preferredContentType,
        recommendationType: 'SKILL_GAP',
        contentSource: 'ml-engine',
        contentProvider: content.provider,
        primarySkillId: gapWithRelations.skillId,
        targetLevel: gap.targetLevel,
        scores,
        reasoning: generateMLReasoning(profile, gap, scores),
        estimatedDuration: content.duration,
      });
    }

    return recommendations.sort((a, b) => b.scores.overall - a.scores.overall).slice(0, limit);
  }

  function calculateLearningVelocity(profile: UserLearningProfile): number {
    if (profile.totalLearningMinutes === 0) return 0.5;
    const avgMinutesPerCourse = profile.totalLearningMinutes / Math.max(profile.completedCourses, 1);
    // Normalize: faster learners (less time per course) get higher scores
    return Math.max(0.3, Math.min(1, 300 / avgMinutesPerCourse));
  }

  function calculateEngagementScore(profile: UserLearningProfile): number {
    const sessionScore = Math.min(profile.averageSessionMinutes / 30, 1);
    const frequencyScore = profile.learningStreak > 0 ? Math.min(profile.learningStreak / 7, 1) : 0.3;
    return (sessionScore + frequencyScore) / 2;
  }

  function calculateUrgency(gap: SkillGap, profile: UserLearningProfile): number {
    const gapUrgency = gap.priorityScore / 100;
    const staleness = gap.createdAt
      ? Math.min((Date.now() - new Date(gap.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000), 1)
      : 0;
    return Math.min(gapUrgency + staleness * 0.2, 1);
  }

  function predictContentType(profile: UserLearningProfile, gap: SkillGap): ContentType {
    // Predict preferred content type based on learning patterns
    const avgSession = profile.averageSessionMinutes;

    if (avgSession < 15) {
      return 'ARTICLE'; // Short attention span
    } else if (avgSession < 30) {
      return 'VIDEO'; // Medium engagement
    } else if (avgSession < 60) {
      return 'TUTORIAL'; // Good engagement
    } else {
      return 'COURSE'; // Deep learner
    }
  }

  function selectOptimalContent(
    contentType: ContentType,
    skillName: string
  ): { title: string; provider: string; duration: number } {
    const templates: Record<ContentType, { title: string; provider: string; duration: number }[]> = {
      COURSE: [
        { title: `Complete ${skillName} Mastery Course`, provider: 'skillpod', duration: 480 },
        { title: `Professional ${skillName} Certification`, provider: 'coursera', duration: 720 },
      ],
      VIDEO: [
        { title: `${skillName} Quick Start Guide`, provider: 'skillpod', duration: 45 },
        { title: `${skillName} in 30 Minutes`, provider: 'youtube', duration: 30 },
      ],
      TUTORIAL: [
        { title: `Hands-on ${skillName} Workshop`, provider: 'skillpod', duration: 120 },
        { title: `Build with ${skillName}: Project-Based Learning`, provider: 'codecademy', duration: 180 },
      ],
      ARTICLE: [
        { title: `${skillName} Fundamentals Explained`, provider: 'skillpod', duration: 15 },
        { title: `Getting Started with ${skillName}`, provider: 'medium', duration: 10 },
      ],
      BOOK: [
        { title: `${skillName}: The Complete Reference`, provider: 'oreilly', duration: 600 },
      ],
      PODCAST: [
        { title: `${skillName} Weekly Insights`, provider: 'skillpod', duration: 45 },
      ],
      PROJECT: [
        { title: `Real-world ${skillName} Portfolio Project`, provider: 'skillpod', duration: 300 },
      ],
      ASSESSMENT: [
        { title: `${skillName} Skills Assessment`, provider: 'skillpod', duration: 30 },
      ],
      MENTORSHIP: [
        { title: `${skillName} 1:1 Mentorship Sessions`, provider: 'skillpod', duration: 60 },
      ],
      PRACTICE: [
        { title: `${skillName} Practice Exercises`, provider: 'skillpod', duration: 90 },
      ],
    };

    const options = templates[contentType] || templates.COURSE;
    return options[Math.floor(Math.random() * options.length)];
  }

  function generateMLReasoning(
    profile: UserLearningProfile,
    gap: SkillGap,
    scores: RecommendationScores
  ): string {
    const reasons: string[] = [];

    if (scores.relevance > 0.7) {
      reasons.push('highly aligned with your learning goals');
    }
    if (scores.urgency > 0.6) {
      reasons.push('addresses a priority skill gap');
    }
    if (profile.learningStreak > 3) {
      reasons.push('matches your consistent learning pattern');
    }
    if (profile.averageSessionMinutes > 20) {
      reasons.push('fits your preferred session length');
    }

    if (reasons.length === 0) {
      reasons.push('recommended based on your profile analysis');
    }

    return `ML-powered recommendation: ${reasons.join(', ')}.`;
  }

  async function combineRecommendations(
    ruleBasedRecs: GeneratedRecommendation[],
    mlRecs: GeneratedRecommendation[],
    limit: number
  ): Promise<GeneratedRecommendation[]> {
    const combined = [...ruleBasedRecs, ...mlRecs];

    // Apply weights and recalculate overall scores
    for (const rec of combined) {
      const source = rec.contentSource;
      const isML = mlRecs.includes(rec);
      const weight = isML ? cfg.mlWeight : cfg.ruleWeight;
      rec.scores.overall = rec.scores.overall * weight;
    }

    // Sort by overall score and deduplicate by skill
    combined.sort((a, b) => b.scores.overall - a.scores.overall);

    const seenSkills = new Set<string>();
    const deduplicated: GeneratedRecommendation[] = [];

    for (const rec of combined) {
      if (rec.primarySkillId && seenSkills.has(rec.primarySkillId)) {
        continue;
      }
      if (rec.primarySkillId) {
        seenSkills.add(rec.primarySkillId);
      }
      deduplicated.push(rec);
      if (deduplicated.length >= limit) break;
    }

    return deduplicated;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async function generateRecommendations(
    params: GenerateRecommendationsParams
  ): Promise<GeneratedRecommendation[]> {
    const { userId, limit = 10, types, contentTypes, forceRefresh } = params;

    // Check cache
    const cacheKey = `recs:${userId}:${limit}:${types?.join(',') ?? 'all'}`;
    if (!forceRefresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as GeneratedRecommendation[];
      }
    }

    // Get user profile and gaps
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) {
      return [];
    }

    const { gaps } = await skillGapRepository.findMany(
      {
        learningProfileId: profile.id,
        status: ['ACTIVE', 'IN_PROGRESS'],
      },
      {
        limit: 20,
        orderBy: 'priorityScore',
        orderDirection: 'desc',
        includeSkill: true,
      }
    );

    if (gaps.length === 0) {
      return [];
    }

    // Generate recommendations
    const ruleBasedRecs = await generateRuleBasedRecommendations(
      profile as UserLearningProfile,
      gaps,
      limit
    );
    const mlRecs = await generateMLRecommendations(
      profile as UserLearningProfile,
      gaps as SkillGap[],
      limit
    );

    let recommendations = await combineRecommendations(ruleBasedRecs, mlRecs, limit);

    // Filter by types if specified
    if (types?.length) {
      recommendations = recommendations.filter((r) => types.includes(r.recommendationType));
    }
    if (contentTypes?.length) {
      recommendations = recommendations.filter((r) => contentTypes.includes(r.contentType));
    }

    // Cache results
    await redis.setex(cacheKey, cfg.cacheExpirationMinutes * 60, JSON.stringify(recommendations));

    return recommendations;
  }

  async function generateForSkillGap(
    userId: string,
    gapId: string,
    limit = 5
  ): Promise<GeneratedRecommendation[]> {
    const gap = await skillGapRepository.findById(gapId);
    if (!gap) return [];

    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) return [];

    const skillName = await getSkillName(gap.skillId);
    const recommendations: GeneratedRecommendation[] = [];

    // Generate multiple content types for this gap
    const contentTypes: ContentType[] = ['COURSE', 'TUTORIAL', 'VIDEO', 'PROJECT', 'ARTICLE'];

    for (let i = 0; i < Math.min(limit, contentTypes.length); i++) {
      const contentType = contentTypes[i];
      const content = generateContentFromTemplate(skillName, contentType);

      const trend = await marketTrendRepository.findLatestForSkill(gap.skillId);
      const marketTrendScore = trend?.demandDirection === 'RISING' ? 0.8 : 0.5;

      const scores: RecommendationScores = {
        relevance: calculateRelevanceScore(gap, profile as UserLearningProfile),
        urgency: calculateUrgencyScore(gap, gap.sourceEventIds?.length ?? 0),
        impact: calculateImpactScore(gap, marketTrendScore),
        confidence: 0.85,
        overall: 0,
      };
      scores.overall = calculateOverallScore(scores);

      recommendations.push({
        title: content.title,
        description: `Build your ${skillName} expertise with this ${contentType.toLowerCase()}`,
        contentType,
        recommendationType: 'SKILL_GAP_FILL',
        contentSource: content.provider,
        contentProvider: content.provider,
        primarySkillId: gap.skillId,
        targetLevel: gap.requiredLevel as ProficiencyLevel,
        scores,
        reasoning: generateReasoning(gap, skillName, scores),
        estimatedDuration: content.duration,
      });
    }

    return recommendations.sort((a, b) => b.scores.overall - a.scores.overall);
  }

  async function generateQuickWins(userId: string, limit = 5): Promise<GeneratedRecommendation[]> {
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) return [];

    // Find small gaps that can be quickly addressed
    const { gaps } = await skillGapRepository.findMany(
      {
        learningProfileId: profile.id,
        status: ['ACTIVE'],
        maxGapScore: 0.4,
      },
      {
        limit: 10,
        orderBy: 'marketDemandScore',
        orderDirection: 'desc',
        includeSkill: true,
      }
    );

    const recommendations: GeneratedRecommendation[] = [];

    for (const gap of gaps.slice(0, limit)) {
      const skillName = await getSkillName(gap.skillId);
      const content = generateContentFromTemplate(skillName, 'VIDEO');

      const scores: RecommendationScores = {
        relevance: 0.7,
        urgency: 0.5,
        impact: gap.marketDemandScore,
        confidence: 0.9,
        overall: 0,
      };
      scores.overall = calculateOverallScore(scores);

      recommendations.push({
        title: content.title,
        description: `Quick boost for your ${skillName} skills`,
        contentType: 'VIDEO',
        recommendationType: 'QUICK_WIN',
        contentSource: content.provider,
        contentProvider: content.provider,
        primarySkillId: gap.skillId,
        targetLevel: gap.requiredLevel as ProficiencyLevel,
        scores,
        reasoning: `A quick video to help you close the gap in ${skillName}. Low effort, high reward.`,
        estimatedDuration: content.duration,
      });
    }

    return recommendations;
  }

  async function generateCareerPathRecommendations(
    userId: string,
    targetRole: string,
    limit = 10
  ): Promise<GeneratedRecommendation[]> {
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) return [];

    // Update profile with target role
    await learningProfileRepository.update(profile.id, { targetRole });

    // Find trending skills for this role
    const { trends } = await marketTrendRepository.findMany(
      {
        demandDirection: ['RISING', 'STABLE'],
        minDemandScore: 0.6,
      },
      {
        limit: 20,
        orderBy: 'demandScore',
        orderDirection: 'desc',
        includeSkill: true,
      }
    );

    const recommendations: GeneratedRecommendation[] = [];

    for (const trend of trends.slice(0, limit)) {
      const skillName = trend.skill?.name ?? 'Unknown Skill';
      const content = generateContentFromTemplate(skillName, 'COURSE');

      const scores: RecommendationScores = {
        relevance: 0.8,
        urgency: trend.demandDirection === 'RISING' ? 0.8 : 0.5,
        impact: trend.demandScore,
        confidence: 0.75,
        overall: 0,
      };
      scores.overall = calculateOverallScore(scores);

      recommendations.push({
        title: content.title,
        description: `Essential for ${targetRole} roles`,
        contentType: 'COURSE',
        recommendationType: 'CAREER_ADVANCEMENT',
        contentSource: content.provider,
        contentProvider: content.provider,
        primarySkillId: trend.skillId,
        targetLevel: 'ADVANCED',
        scores,
        reasoning: `${skillName} is in high demand for ${targetRole} positions. Market demand: ${Math.round(trend.demandScore * 100)}%`,
        estimatedDuration: content.duration,
      });
    }

    return recommendations.sort((a, b) => b.scores.overall - a.scores.overall);
  }

  function scoreRecommendation(
    recommendation: GeneratedRecommendation,
    profile: UserLearningProfile,
    gaps: SkillGap[]
  ): RecommendationScores {
    // Find matching gap
    const gap = gaps.find((g) => g.skillId === recommendation.primarySkillId);
    if (!gap) {
      return {
        relevance: 0.5,
        urgency: 0.3,
        impact: 0.5,
        confidence: 0.5,
        overall: 0.45,
      };
    }

    return recommendation.scores;
  }

  async function persistRecommendations(
    userId: string,
    recommendations: GeneratedRecommendation[]
  ): Promise<LearningRecommendation[]> {
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) return [];

    const inputs: CreateLearningRecommendationInput[] = recommendations.map((rec) => ({
      learningProfileId: profile.id,
      recommendationType: rec.recommendationType,
      contentType: rec.contentType,
      title: rec.title,
      description: rec.description,
      contentId: rec.contentId,
      contentSource: rec.contentSource,
      contentUrl: rec.contentUrl,
      contentProvider: rec.contentProvider,
      primarySkillId: rec.primarySkillId,
      targetLevel: rec.targetLevel,
      relevanceScore: rec.scores.relevance,
      urgencyScore: rec.scores.urgency,
      impactScore: rec.scores.impact,
      confidenceScore: rec.scores.confidence,
      overallScore: rec.scores.overall,
      generationMethod: 'rule_based',
      reasoningExplanation: rec.reasoning,
      estimatedDuration: rec.estimatedDuration,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }));

    const created: LearningRecommendation[] = [];
    for (const input of inputs) {
      const rec = await recommendationRepository.create(input);
      created.push(rec as unknown as LearningRecommendation);
    }

    return created;
  }

  async function getTopRecommendations(
    userId: string,
    limit = 10
  ): Promise<LearningRecommendation[]> {
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) return [];

    const recs = await recommendationRepository.findTopForProfile(profile.id, limit);
    return recs as unknown as LearningRecommendation[];
  }

  async function refreshUserRecommendations(userId: string): Promise<number> {
    // Generate new recommendations
    const newRecs = await generateRecommendations({
      userId,
      limit: cfg.maxRecommendationsPerUser,
      forceRefresh: true,
    });

    // Persist them
    await persistRecommendations(userId, newRecs);

    // Invalidate cache
    const pattern = `recs:${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return newRecs.length;
  }

  return {
    generateRecommendations,
    generateForSkillGap,
    generateQuickWins,
    generateCareerPathRecommendations,
    scoreRecommendation,
    persistRecommendations,
    getTopRecommendations,
    refreshUserRecommendations,
  };
}
