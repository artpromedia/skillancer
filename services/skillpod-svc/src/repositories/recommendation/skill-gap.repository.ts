// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/repositories/recommendation/skill-gap
 * Skill Gap repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { PrismaClient, SkillGap, Prisma } from '@/types/prisma-shim.js';
import type {
  GapType,
  GapPriority,
  GapStatus,
  CompetitionLevel,
  ProficiencyLevel,
} from '@skillancer/types';

// =============================================================================
// TYPES
// =============================================================================

export interface SkillGapWithRelations extends SkillGap {
  skill?: {
    id: string;
    name: string;
    slug: string;
    category: string;
  };
  learningProfile?: {
    id: string;
    userId: string;
  };
  recommendations?: Array<{
    id: string;
    title: string;
    status: string;
    overallScore: number;
  }>;
  _count?: {
    recommendations: number;
  };
}

export interface CreateSkillGapInput {
  learningProfileId: string;
  skillId: string;
  gapType: GapType;
  currentLevel?: ProficiencyLevel;
  requiredLevel: ProficiencyLevel;
  gapScore: number;
  marketDemandScore?: number;
  salaryImpact?: number;
  competitionLevel?: CompetitionLevel;
  jobFrequency?: number;
  priority?: GapPriority;
  priorityScore?: number;
  sourceEventIds?: string[];
  detectionMethod: string;
}

export interface UpdateSkillGapInput {
  gapScore?: number;
  currentLevel?: ProficiencyLevel;
  requiredLevel?: ProficiencyLevel;
  marketDemandScore?: number;
  salaryImpact?: number;
  competitionLevel?: CompetitionLevel;
  jobFrequency?: number;
  priority?: GapPriority;
  priorityScore?: number;
  status?: GapStatus;
  sourceEventIds?: string[];
  lastConfirmedAt?: Date;
  resolvedAt?: Date;
  resolutionMethod?: string;
}

export interface SkillGapListFilter {
  learningProfileId?: string;
  skillId?: string;
  gapType?: GapType;
  priority?: GapPriority | GapPriority[];
  status?: GapStatus | GapStatus[];
  minGapScore?: number;
  maxGapScore?: number;
  minMarketDemand?: number;
  detectionMethod?: string;
}

export interface SkillGapListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'priorityScore' | 'gapScore' | 'marketDemandScore' | 'createdAt' | 'lastConfirmedAt';
  orderDirection?: 'asc' | 'desc';
  includeSkill?: boolean;
  includeRecommendations?: boolean;
}

export interface SkillGapStats {
  total: number;
  byPriority: Record<GapPriority, number>;
  byStatus: Record<GapStatus, number>;
  byGapType: Record<GapType, number>;
  averageGapScore: number;
  averageMarketDemand: number;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface SkillGapRepository {
  create(input: CreateSkillGapInput): Promise<SkillGap>;
  createMany(inputs: CreateSkillGapInput[]): Promise<number>;
  findById(id: string): Promise<SkillGapWithRelations | null>;
  findByProfileAndSkill(
    learningProfileId: string,
    skillId: string
  ): Promise<SkillGapWithRelations | null>;
  findMany(
    filter: SkillGapListFilter,
    options?: SkillGapListOptions
  ): Promise<{
    gaps: SkillGapWithRelations[];
    total: number;
  }>;
  findTopPriority(learningProfileId: string, limit?: number): Promise<SkillGapWithRelations[]>;
  update(id: string, input: UpdateSkillGapInput): Promise<SkillGap>;
  updateMany(ids: string[], input: UpdateSkillGapInput): Promise<number>;
  resolve(id: string, resolutionMethod: string): Promise<SkillGap>;
  dismiss(id: string): Promise<SkillGap>;
  reactivate(id: string): Promise<SkillGap>;
  delete(id: string): Promise<void>;
  addSourceEvent(id: string, eventId: string): Promise<void>;
  getStats(learningProfileId: string): Promise<SkillGapStats>;
  upsert(input: CreateSkillGapInput): Promise<SkillGap>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createSkillGapRepository(prisma: PrismaClient): SkillGapRepository {
  async function create(input: CreateSkillGapInput): Promise<SkillGap> {
    return prisma.skillGap.create({
      data: {
        learningProfileId: input.learningProfileId,
        skillId: input.skillId,
        gapType: input.gapType,
        currentLevel: input.currentLevel,
        requiredLevel: input.requiredLevel,
        gapScore: input.gapScore,
        marketDemandScore: input.marketDemandScore ?? 0,
        salaryImpact: input.salaryImpact,
        competitionLevel: input.competitionLevel ?? 'MEDIUM',
        jobFrequency: input.jobFrequency ?? 0,
        priority: input.priority ?? 'MEDIUM',
        priorityScore: input.priorityScore ?? 0.5,
        sourceEventIds: input.sourceEventIds ?? [],
        detectionMethod: input.detectionMethod,
      },
    });
  }

  async function createMany(inputs: CreateSkillGapInput[]): Promise<number> {
    const result = await prisma.skillGap.createMany({
      data: inputs.map((input) => ({
        learningProfileId: input.learningProfileId,
        skillId: input.skillId,
        gapType: input.gapType,
        currentLevel: input.currentLevel,
        requiredLevel: input.requiredLevel,
        gapScore: input.gapScore,
        marketDemandScore: input.marketDemandScore ?? 0,
        salaryImpact: input.salaryImpact,
        competitionLevel: input.competitionLevel ?? 'MEDIUM',
        jobFrequency: input.jobFrequency ?? 0,
        priority: input.priority ?? 'MEDIUM',
        priorityScore: input.priorityScore ?? 0.5,
        sourceEventIds: input.sourceEventIds ?? [],
        detectionMethod: input.detectionMethod,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async function findById(id: string): Promise<SkillGapWithRelations | null> {
    return prisma.skillGap.findUnique({
      where: { id },
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
        recommendations: {
          select: {
            id: true,
            title: true,
            status: true,
            overallScore: true,
          },
          where: { status: { in: ['PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS'] } },
          orderBy: { overallScore: 'desc' },
          take: 5,
        },
        _count: {
          select: { recommendations: true },
        },
      },
    });
  }

  async function findByProfileAndSkill(
    learningProfileId: string,
    skillId: string
  ): Promise<SkillGapWithRelations | null> {
    return prisma.skillGap.findUnique({
      where: {
        learningProfileId_skillId: {
          learningProfileId,
          skillId,
        },
      },
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
        recommendations: {
          select: {
            id: true,
            title: true,
            status: true,
            overallScore: true,
          },
          where: { status: { in: ['PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS'] } },
          orderBy: { overallScore: 'desc' },
          take: 5,
        },
        _count: {
          select: { recommendations: true },
        },
      },
    });
  }

  async function findMany(
    filter: SkillGapListFilter,
    options: SkillGapListOptions = {}
  ): Promise<{
    gaps: SkillGapWithRelations[];
    total: number;
  }> {
    const { page = 1, limit = 20, orderBy = 'priorityScore', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.SkillGapWhereInput = {};

    if (filter.learningProfileId) where.learningProfileId = filter.learningProfileId;
    if (filter.skillId) where.skillId = filter.skillId;
    if (filter.gapType) where.gapType = filter.gapType;
    if (filter.priority) {
      where.priority = Array.isArray(filter.priority) ? { in: filter.priority } : filter.priority;
    }
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.minGapScore !== undefined || filter.maxGapScore !== undefined) {
      where.gapScore = {};
      if (filter.minGapScore !== undefined) where.gapScore.gte = filter.minGapScore;
      if (filter.maxGapScore !== undefined) where.gapScore.lte = filter.maxGapScore;
    }
    if (filter.minMarketDemand !== undefined) {
      where.marketDemandScore = { gte: filter.minMarketDemand };
    }
    if (filter.detectionMethod) where.detectionMethod = filter.detectionMethod;

    const include: Prisma.SkillGapInclude = {};
    if (options.includeSkill) {
      include.skill = {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
        },
      };
    }
    if (options.includeRecommendations) {
      include.recommendations = {
        select: {
          id: true,
          title: true,
          status: true,
          overallScore: true,
        },
        where: { status: { in: ['PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS'] } },
        orderBy: { overallScore: 'desc' },
        take: 3,
      };
    }
    include._count = { select: { recommendations: true } };

    const [gaps, total] = await Promise.all([
      prisma.skillGap.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: orderDirection },
        include,
      }),
      prisma.skillGap.count({ where }),
    ]);

    return { gaps, total };
  }

  async function findTopPriority(
    learningProfileId: string,
    limit = 10
  ): Promise<SkillGapWithRelations[]> {
    return prisma.skillGap.findMany({
      where: {
        learningProfileId,
        status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      },
      orderBy: [{ priorityScore: 'desc' }, { marketDemandScore: 'desc' }],
      take: limit,
      include: {
        skill: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
          },
        },
        recommendations: {
          select: {
            id: true,
            title: true,
            status: true,
            overallScore: true,
          },
          where: { status: { in: ['PENDING', 'VIEWED', 'STARTED', 'IN_PROGRESS'] } },
          orderBy: { overallScore: 'desc' },
          take: 3,
        },
        _count: {
          select: { recommendations: true },
        },
      },
    });
  }

  async function update(id: string, input: UpdateSkillGapInput): Promise<SkillGap> {
    return prisma.skillGap.update({
      where: { id },
      data: {
        ...input,
        lastConfirmedAt: input.lastConfirmedAt ?? new Date(),
      },
    });
  }

  async function updateMany(ids: string[], input: UpdateSkillGapInput): Promise<number> {
    const result = await prisma.skillGap.updateMany({
      where: { id: { in: ids } },
      data: input,
    });
    return result.count;
  }

  async function resolve(id: string, resolutionMethod: string): Promise<SkillGap> {
    return prisma.skillGap.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionMethod,
      },
    });
  }

  async function dismiss(id: string): Promise<SkillGap> {
    return prisma.skillGap.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        resolvedAt: new Date(),
        resolutionMethod: 'user_dismissed',
      },
    });
  }

  async function reactivate(id: string): Promise<SkillGap> {
    return prisma.skillGap.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        resolvedAt: null,
        resolutionMethod: null,
        lastConfirmedAt: new Date(),
      },
    });
  }

  async function deleteGap(id: string): Promise<void> {
    await prisma.skillGap.delete({ where: { id } });
  }

  async function addSourceEvent(id: string, eventId: string): Promise<void> {
    const gap = await prisma.skillGap.findUnique({
      where: { id },
      select: { sourceEventIds: true },
    });

    if (!gap) return;

    const sourceEventIds = [...gap.sourceEventIds, eventId];

    await prisma.skillGap.update({
      where: { id },
      data: {
        sourceEventIds,
        lastConfirmedAt: new Date(),
      },
    });
  }

  async function getStats(learningProfileId: string): Promise<SkillGapStats> {
    const gaps = await prisma.skillGap.findMany({
      where: { learningProfileId },
      select: {
        priority: true,
        status: true,
        gapType: true,
        gapScore: true,
        marketDemandScore: true,
      },
    });

    const byPriority = {} as Record<GapPriority, number>;
    const byStatus = {} as Record<GapStatus, number>;
    const byGapType = {} as Record<GapType, number>;
    let totalGapScore = 0;
    let totalMarketDemand = 0;

    for (const gap of gaps) {
      byPriority[gap.priority as GapPriority] = (byPriority[gap.priority as GapPriority] ?? 0) + 1;
      byStatus[gap.status as GapStatus] = (byStatus[gap.status as GapStatus] ?? 0) + 1;
      byGapType[gap.gapType as GapType] = (byGapType[gap.gapType as GapType] ?? 0) + 1;
      totalGapScore += gap.gapScore;
      totalMarketDemand += gap.marketDemandScore;
    }

    return {
      total: gaps.length,
      byPriority,
      byStatus,
      byGapType,
      averageGapScore: gaps.length > 0 ? totalGapScore / gaps.length : 0,
      averageMarketDemand: gaps.length > 0 ? totalMarketDemand / gaps.length : 0,
    };
  }

  async function upsert(input: CreateSkillGapInput): Promise<SkillGap> {
    return prisma.skillGap.upsert({
      where: {
        learningProfileId_skillId: {
          learningProfileId: input.learningProfileId,
          skillId: input.skillId,
        },
      },
      create: {
        learningProfileId: input.learningProfileId,
        skillId: input.skillId,
        gapType: input.gapType,
        currentLevel: input.currentLevel,
        requiredLevel: input.requiredLevel,
        gapScore: input.gapScore,
        marketDemandScore: input.marketDemandScore ?? 0,
        salaryImpact: input.salaryImpact,
        competitionLevel: input.competitionLevel ?? 'MEDIUM',
        jobFrequency: input.jobFrequency ?? 0,
        priority: input.priority ?? 'MEDIUM',
        priorityScore: input.priorityScore ?? 0.5,
        sourceEventIds: input.sourceEventIds ?? [],
        detectionMethod: input.detectionMethod,
      },
      update: {
        gapType: input.gapType,
        currentLevel: input.currentLevel,
        requiredLevel: input.requiredLevel,
        gapScore: input.gapScore,
        marketDemandScore: input.marketDemandScore,
        salaryImpact: input.salaryImpact,
        competitionLevel: input.competitionLevel,
        jobFrequency: input.jobFrequency,
        priority: input.priority,
        priorityScore: input.priorityScore,
        lastConfirmedAt: new Date(),
      },
    });
  }

  return {
    create,
    createMany,
    findById,
    findByProfileAndSkill,
    findMany,
    findTopPriority,
    update,
    updateMany,
    resolve,
    dismiss,
    reactivate,
    delete: deleteGap,
    addSourceEvent,
    getStats,
    upsert,
  };
}
