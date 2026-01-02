// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/services/recommendation/learning-path-generator
 * Generates personalized learning paths based on skill gaps and career goals
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type {
  LearningPathRepository,
  SkillGapRepository,
  LearningProfileRepository,
  MarketTrendRepository,
  PathMilestone,
  PathMilestoneItem,
  CreateLearningPathInput,
} from '../../repositories/recommendation/index.js';
import type { PrismaClient } from '@prisma/client';
import type {
  PathType,
  PathGenerationSource,
  GapPriority,
  ProficiencyLevel,
  UserLearningPath,
} from '@skillancer/types';
import type { Redis as RedisType } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface LearningPathGeneratorConfig {
  maxMilestonesPerPath: number;
  maxItemsPerMilestone: number;
  defaultPathDuration: number; // in minutes
  enableAutoGeneration: boolean;
}

export interface GeneratePathParams {
  userId: string;
  pathType: PathType;
  title?: string;
  targetRole?: string;
  targetSkillIds?: string[];
  targetLevels?: Record<string, ProficiencyLevel>;
}

export interface GeneratedPath {
  title: string;
  description: string;
  pathType: PathType;
  targetRole?: string;
  targetSkillIds: string[];
  targetLevels: Record<string, ProficiencyLevel>;
  estimatedCareerImpact: string;
  milestones: PathMilestone[];
  totalDuration: number;
}

export interface LearningPathGenerator {
  generatePath(params: GeneratePathParams): Promise<GeneratedPath>;
  generateSkillMasteryPath(
    userId: string,
    skillId: string,
    targetLevel: ProficiencyLevel
  ): Promise<GeneratedPath>;
  generateRoleTransitionPath(userId: string, targetRole: string): Promise<GeneratedPath>;
  generateMarketAlignmentPath(userId: string): Promise<GeneratedPath>;
  savePath(
    userId: string,
    path: GeneratedPath,
    source: PathGenerationSource
  ): Promise<UserLearningPath>;
  getActivePaths(userId: string): Promise<UserLearningPath[]>;
  suggestNextMilestone(pathId: string): Promise<PathMilestone | null>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: LearningPathGeneratorConfig = {
  maxMilestonesPerPath: 5,
  maxItemsPerMilestone: 4,
  defaultPathDuration: 1800, // 30 hours
  enableAutoGeneration: true,
};

const MILESTONE_TEMPLATES: Record<
  ProficiencyLevel,
  { name: string; description: string; requiredCompletions: number }
> = {
  BEGINNER: {
    name: 'Foundation',
    description: 'Build fundamental understanding',
    requiredCompletions: 2,
  },
  INTERMEDIATE: {
    name: 'Core Skills',
    description: 'Develop practical skills',
    requiredCompletions: 3,
  },
  ADVANCED: {
    name: 'Advanced Techniques',
    description: 'Master advanced concepts',
    requiredCompletions: 3,
  },
  EXPERT: {
    name: 'Expert Mastery',
    description: 'Achieve expert-level proficiency',
    requiredCompletions: 4,
  },
};

const ITEM_TYPE_DURATIONS: Record<string, [number, number]> = {
  recommendation: [30, 120],
  assessment: [15, 45],
  project: [60, 240],
  certification: [120, 480],
};

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export function createLearningPathGenerator(
  prisma: PrismaClient,
  redis: RedisType,
  pathRepository: LearningPathRepository,
  skillGapRepository: SkillGapRepository,
  learningProfileRepository: LearningProfileRepository,
  marketTrendRepository: MarketTrendRepository,
  config: Partial<LearningPathGeneratorConfig> = {}
): LearningPathGenerator {
  const cfg: LearningPathGeneratorConfig = { ...DEFAULT_CONFIG, ...config };

  // ---------------------------------------------------------------------------
  // Helper Functions
  // ---------------------------------------------------------------------------

  async function getSkillInfo(skillId: string): Promise<{ name: string; category: string } | null> {
    const cached = await redis.get(`skill:info:${skillId}`);
    if (cached) return JSON.parse(cached);

    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { name: true, category: true },
    });

    if (skill) {
      await redis.setex(`skill:info:${skillId}`, 3600, JSON.stringify(skill));
    }
    return skill;
  }

  function generateMilestoneId(): string {
    return `milestone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function generateItemId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function calculateItemDuration(type: string): number {
    const range = ITEM_TYPE_DURATIONS[type] ?? [30, 60];
    return Math.floor(Math.random() * (range[1] - range[0])) + range[0];
  }

  function createMilestoneItem(
    type: 'recommendation' | 'assessment' | 'project' | 'certification',
    title: string
  ): PathMilestoneItem {
    return {
      id: generateItemId(),
      type,
      title,
      estimatedDuration: calculateItemDuration(type),
      isCompleted: false,
    };
  }

  function determineMilestones(
    currentLevel: ProficiencyLevel | undefined,
    targetLevel: ProficiencyLevel
  ): ProficiencyLevel[] {
    const levels: ProficiencyLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
    const currentIndex = currentLevel ? levels.indexOf(currentLevel) : -1;
    const targetIndex = levels.indexOf(targetLevel);

    return levels.slice(currentIndex + 1, targetIndex + 1);
  }

  async function buildMilestoneForLevel(
    skillName: string,
    skillId: string,
    level: ProficiencyLevel
  ): Promise<PathMilestone> {
    const template = MILESTONE_TEMPLATES[level];
    const items: PathMilestoneItem[] = [];

    // Add learning content
    items.push(
      createMilestoneItem('recommendation', `Learn ${skillName} ${level.toLowerCase()} concepts`)
    );

    // Add practice project
    items.push(createMilestoneItem('project', `${level} ${skillName} practice project`));

    // Add assessment
    items.push(createMilestoneItem('assessment', `${skillName} ${level.toLowerCase()} assessment`));

    // Add certification for advanced levels
    if (level === 'ADVANCED' || level === 'EXPERT') {
      items.push(
        createMilestoneItem('certification', `${skillName} ${level.toLowerCase()} certification`)
      );
    }

    const totalDuration = items.reduce((sum, item) => sum + item.estimatedDuration, 0);

    return {
      id: generateMilestoneId(),
      title: `${template.name}: ${skillName}`,
      description: template.description,
      skillIds: [skillId],
      items,
      estimatedDuration: totalDuration,
      requiredCompletions: Math.min(template.requiredCompletions, items.length),
      completedItems: 0,
      isCompleted: false,
    };
  }

  function estimateCareerImpact(
    skillNames: string[],
    targetRole?: string,
    demandScores?: number[]
  ): string {
    const avgDemand = demandScores?.length
      ? demandScores.reduce((a, b) => a + b, 0) / demandScores.length
      : 0.5;

    if (avgDemand >= 0.8) {
      return `High impact: Mastering ${skillNames.join(', ')} positions you for top ${targetRole ?? 'opportunities'}`;
    }
    if (avgDemand >= 0.6) {
      return `Moderate impact: ${skillNames.join(', ')} skills are valuable for ${targetRole ?? 'career growth'}`;
    }
    return `Building ${skillNames.join(', ')} foundations for future opportunities`;
  }

  // ---------------------------------------------------------------------------
  // Path Generation Functions
  // ---------------------------------------------------------------------------

  async function generatePath(params: GeneratePathParams): Promise<GeneratedPath> {
    switch (params.pathType) {
      case 'SKILL_MASTERY':
        if (params.targetSkillIds?.[0]) {
          return generateSkillMasteryPath(
            params.userId,
            params.targetSkillIds[0],
            params.targetLevels?.[params.targetSkillIds[0]] ?? 'ADVANCED'
          );
        }
        throw new Error('Skill ID required for SKILL_MASTERY path');

      case 'ROLE_TRANSITION':
        if (params.targetRole) {
          return generateRoleTransitionPath(params.userId, params.targetRole);
        }
        throw new Error('Target role required for ROLE_TRANSITION path');

      case 'MARKET_ALIGNMENT':
        return generateMarketAlignmentPath(params.userId);

      case 'CERTIFICATION_TRACK':
        // Similar to skill mastery but focused on certifications
        if (params.targetSkillIds?.[0]) {
          return generateCertificationPath(params.userId, params.targetSkillIds[0]);
        }
        throw new Error('Skill ID required for CERTIFICATION_TRACK path');

      default:
        return generateMarketAlignmentPath(params.userId);
    }
  }

  async function generateSkillMasteryPath(
    userId: string,
    skillId: string,
    targetLevel: ProficiencyLevel
  ): Promise<GeneratedPath> {
    const profile = await learningProfileRepository.findByUserId(userId);
    const skillInfo = await getSkillInfo(skillId);
    const skillName = skillInfo?.name ?? 'Unknown Skill';

    // Get current level from user skills
    const userSkill = await prisma.userSkill.findFirst({
      where: { userId, skillId },
      select: { proficiencyLevel: true },
    });
    const currentLevel = userSkill?.proficiencyLevel as ProficiencyLevel | undefined;

    // Get market trend for this skill
    const trend = await marketTrendRepository.findLatestForSkill(skillId);

    // Determine milestones needed
    const requiredLevels = determineMilestones(currentLevel, targetLevel);
    const milestones: PathMilestone[] = [];

    for (const level of requiredLevels) {
      const milestone = await buildMilestoneForLevel(skillName, skillId, level);
      milestones.push(milestone);
    }

    const totalDuration = milestones.reduce((sum, m) => sum + m.estimatedDuration, 0);

    return {
      title: `Master ${skillName}`,
      description: `A structured path to achieve ${targetLevel} proficiency in ${skillName}`,
      pathType: 'SKILL_MASTERY',
      targetSkillIds: [skillId],
      targetLevels: { [skillId]: targetLevel },
      estimatedCareerImpact: estimateCareerImpact(
        [skillName],
        undefined,
        trend ? [trend.demandScore] : undefined
      ),
      milestones,
      totalDuration,
    };
  }

  async function generateRoleTransitionPath(
    userId: string,
    targetRole: string
  ): Promise<GeneratedPath> {
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) throw new Error('User profile not found');

    // Get user's current skill gaps
    const { gaps } = await skillGapRepository.findMany(
      {
        learningProfileId: profile.id,
        status: ['ACTIVE', 'IN_PROGRESS'],
        priority: ['CRITICAL', 'HIGH', 'MEDIUM'],
      },
      {
        limit: cfg.maxMilestonesPerPath,
        orderBy: 'priorityScore',
        orderDirection: 'desc',
        includeSkill: true,
      }
    );

    // Get trending skills for the target role
    const { trends } = await marketTrendRepository.findMany(
      {
        demandDirection: ['RISING'],
        minDemandScore: 0.6,
      },
      {
        limit: 5,
        orderBy: 'demandScore',
        orderDirection: 'desc',
        includeSkill: true,
      }
    );

    const milestones: PathMilestone[] = [];
    const targetSkillIds: string[] = [];
    const targetLevels: Record<string, ProficiencyLevel> = {};

    // Create milestones from gaps
    for (const gap of gaps.slice(0, cfg.maxMilestonesPerPath - 1)) {
      const skillInfo = gap.skill ?? (await getSkillInfo(gap.skillId));
      const skillName = skillInfo?.name ?? 'Unknown Skill';

      const milestone = await buildMilestoneForLevel(
        skillName,
        gap.skillId,
        gap.requiredLevel as ProficiencyLevel
      );
      milestones.push(milestone);

      targetSkillIds.push(gap.skillId);
      targetLevels[gap.skillId] = gap.requiredLevel as ProficiencyLevel;
    }

    // Add a trending skill milestone if space
    if (milestones.length < cfg.maxMilestonesPerPath && trends.length > 0) {
      const trend = trends[0];
      const skillName = trend.skill?.name ?? 'Trending Skill';

      const milestone = await buildMilestoneForLevel(skillName, trend.skillId, 'INTERMEDIATE');
      milestones.push(milestone);

      targetSkillIds.push(trend.skillId);
      targetLevels[trend.skillId] = 'INTERMEDIATE';
    }

    const totalDuration = milestones.reduce((sum, m) => sum + m.estimatedDuration, 0);
    const skillNames = await Promise.all(
      targetSkillIds.map(async (id) => {
        const info = await getSkillInfo(id);
        return info?.name ?? 'Unknown';
      })
    );

    return {
      title: `Transition to ${targetRole}`,
      description: `Build the skills needed for a successful ${targetRole} career`,
      pathType: 'ROLE_TRANSITION',
      targetRole,
      targetSkillIds,
      targetLevels,
      estimatedCareerImpact: estimateCareerImpact(skillNames, targetRole),
      milestones,
      totalDuration,
    };
  }

  async function generateMarketAlignmentPath(userId: string): Promise<GeneratedPath> {
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) throw new Error('User profile not found');

    // Get top trending skills with rising demand
    const { trends } = await marketTrendRepository.findMany(
      {
        demandDirection: ['RISING'],
        minDemandScore: 0.7,
      },
      {
        limit: cfg.maxMilestonesPerPath,
        orderBy: 'demandChangePercent',
        orderDirection: 'desc',
        includeSkill: true,
      }
    );

    const milestones: PathMilestone[] = [];
    const targetSkillIds: string[] = [];
    const targetLevels: Record<string, ProficiencyLevel> = {};
    const demandScores: number[] = [];

    for (const trend of trends) {
      const skillName = trend.skill?.name ?? 'Trending Skill';

      const milestone = await buildMilestoneForLevel(skillName, trend.skillId, 'INTERMEDIATE');
      milestones.push(milestone);

      targetSkillIds.push(trend.skillId);
      targetLevels[trend.skillId] = 'INTERMEDIATE';
      demandScores.push(trend.demandScore);
    }

    const totalDuration = milestones.reduce((sum, m) => sum + m.estimatedDuration, 0);
    const skillNames = await Promise.all(
      targetSkillIds.map(async (id) => {
        const info = await getSkillInfo(id);
        return info?.name ?? 'Unknown';
      })
    );

    return {
      title: 'Market-Aligned Skills',
      description: 'Learn the most in-demand skills in the current market',
      pathType: 'MARKET_ALIGNMENT',
      targetSkillIds,
      targetLevels,
      estimatedCareerImpact: estimateCareerImpact(skillNames, undefined, demandScores),
      milestones,
      totalDuration,
    };
  }

  async function generateCertificationPath(
    userId: string,
    skillId: string
  ): Promise<GeneratedPath> {
    const skillInfo = await getSkillInfo(skillId);
    const skillName = skillInfo?.name ?? 'Unknown Skill';

    const milestones: PathMilestone[] = [];

    // Foundation milestone
    milestones.push({
      id: generateMilestoneId(),
      title: 'Certification Prep: Fundamentals',
      description: 'Master the foundational concepts',
      skillIds: [skillId],
      items: [
        createMilestoneItem('recommendation', `${skillName} fundamentals course`),
        createMilestoneItem('assessment', 'Practice exam 1'),
      ],
      estimatedDuration: 240,
      requiredCompletions: 2,
      completedItems: 0,
      isCompleted: false,
    });

    // Advanced topics milestone
    milestones.push({
      id: generateMilestoneId(),
      title: 'Certification Prep: Advanced Topics',
      description: 'Deep dive into advanced concepts',
      skillIds: [skillId],
      items: [
        createMilestoneItem('recommendation', `${skillName} advanced topics`),
        createMilestoneItem('project', 'Hands-on practice project'),
        createMilestoneItem('assessment', 'Practice exam 2'),
      ],
      estimatedDuration: 360,
      requiredCompletions: 3,
      completedItems: 0,
      isCompleted: false,
    });

    // Certification exam milestone
    milestones.push({
      id: generateMilestoneId(),
      title: 'Certification Exam',
      description: 'Complete the official certification',
      skillIds: [skillId],
      items: [
        createMilestoneItem('assessment', 'Final practice exam'),
        createMilestoneItem('certification', `${skillName} Professional Certification`),
      ],
      estimatedDuration: 180,
      requiredCompletions: 2,
      completedItems: 0,
      isCompleted: false,
    });

    const totalDuration = milestones.reduce((sum, m) => sum + m.estimatedDuration, 0);

    return {
      title: `${skillName} Certification Track`,
      description: `Complete path to earning your ${skillName} certification`,
      pathType: 'CERTIFICATION_TRACK',
      targetSkillIds: [skillId],
      targetLevels: { [skillId]: 'EXPERT' },
      estimatedCareerImpact: `Certification validates your expertise and increases earning potential`,
      milestones,
      totalDuration,
    };
  }

  async function savePath(
    userId: string,
    path: GeneratedPath,
    source: PathGenerationSource
  ): Promise<UserLearningPath> {
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) throw new Error('User profile not found');

    const input: CreateLearningPathInput = {
      learningProfileId: profile.id,
      title: path.title,
      description: path.description,
      pathType: path.pathType,
      targetRole: path.targetRole,
      targetSkillIds: path.targetSkillIds,
      targetLevels: path.targetLevels,
      estimatedCareerImpact: path.estimatedCareerImpact,
      generatedBy: source,
      generationContext: {
        generatedAt: new Date().toISOString(),
        milestonesCount: path.milestones.length,
      },
      milestones: path.milestones,
      totalDuration: path.totalDuration,
    };

    const savedPath = await pathRepository.create(input);
    return savedPath as unknown as UserLearningPath;
  }

  async function getActivePaths(userId: string): Promise<UserLearningPath[]> {
    const profile = await learningProfileRepository.findByUserId(userId);
    if (!profile) return [];

    const paths = await pathRepository.findActiveForProfile(profile.id);
    return paths as unknown as UserLearningPath[];
  }

  async function suggestNextMilestone(pathId: string): Promise<PathMilestone | null> {
    const path = await pathRepository.findById(pathId);
    if (!path) return null;

    const milestones = path.milestones as unknown as PathMilestone[];
    const nextMilestone = milestones.find((m) => !m.isCompleted);

    return nextMilestone ?? null;
  }

  return {
    generatePath,
    generateSkillMasteryPath,
    generateRoleTransitionPath,
    generateMarketAlignmentPath,
    savePath,
    getActivePaths,
    suggestNextMilestone,
  };
}

