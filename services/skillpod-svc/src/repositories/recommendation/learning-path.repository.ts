/**
 * @module @skillancer/skillpod-svc/repositories/recommendation/learning-path
 * User Learning Path repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type { PrismaClient, UserLearningPath, Prisma } from '@prisma/client';
import type { PathType, PathGenerationSource, PathStatus } from '@skillancer/types';

// =============================================================================
// TYPES
// =============================================================================

export interface PathMilestone {
  id: string;
  title: string;
  description?: string;
  skillIds: string[];
  items: PathMilestoneItem[];
  estimatedDuration: number;
  requiredCompletions: number;
  completedItems: number;
  isCompleted: boolean;
}

export interface PathMilestoneItem {
  id: string;
  type: 'recommendation' | 'assessment' | 'project' | 'certification';
  contentId?: string;
  title: string;
  estimatedDuration: number;
  isCompleted: boolean;
  completedAt?: string;
}

export interface UserLearningPathWithRelations extends UserLearningPath {
  learningProfile?: {
    id: string;
    userId: string;
  };
}

export interface CreateLearningPathInput {
  learningProfileId: string;
  title: string;
  description?: string;
  pathType: PathType;
  targetRole?: string;
  targetSkillIds?: string[];
  targetLevels?: Record<string, string>;
  estimatedCareerImpact?: string;
  generatedBy: PathGenerationSource;
  generationContext?: Record<string, unknown>;
  milestones: PathMilestone[];
  totalDuration?: number;
}

export interface UpdateLearningPathInput {
  title?: string;
  description?: string;
  targetRole?: string;
  targetSkillIds?: string[];
  targetLevels?: Record<string, string>;
  estimatedCareerImpact?: string;
  milestones?: PathMilestone[];
  totalDuration?: number;
  totalItems?: number;
  status?: PathStatus;
  currentMilestoneIndex?: number;
  completedItems?: number;
  progressPercentage?: number;
  lastActivityAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  abandonedAt?: Date;
  isPinned?: boolean;
  userNotes?: string;
}

export interface LearningPathListFilter {
  learningProfileId?: string;
  pathType?: PathType | PathType[];
  status?: PathStatus | PathStatus[];
  generatedBy?: PathGenerationSource;
  targetRole?: string;
  isPinned?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  hasProgress?: boolean;
}

export interface LearningPathListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'progressPercentage' | 'lastActivityAt';
  orderDirection?: 'asc' | 'desc';
}

export interface LearningPathStats {
  total: number;
  byStatus: Record<PathStatus, number>;
  byType: Record<PathType, number>;
  averageProgress: number;
  completionRate: number;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface LearningPathRepository {
  create(input: CreateLearningPathInput): Promise<UserLearningPath>;
  findById(id: string): Promise<UserLearningPathWithRelations | null>;
  findMany(
    filter: LearningPathListFilter,
    options?: LearningPathListOptions
  ): Promise<{
    paths: UserLearningPathWithRelations[];
    total: number;
  }>;
  findActiveForProfile(learningProfileId: string): Promise<UserLearningPathWithRelations[]>;
  findPinnedForProfile(learningProfileId: string): Promise<UserLearningPathWithRelations[]>;
  update(id: string, input: UpdateLearningPathInput): Promise<UserLearningPath>;
  updateProgress(
    id: string,
    completedItems: number,
    currentMilestoneIndex: number
  ): Promise<UserLearningPath>;
  updateMilestone(
    id: string,
    milestoneIndex: number,
    milestone: PathMilestone
  ): Promise<UserLearningPath>;
  completeItem(id: string, milestoneIndex: number, itemId: string): Promise<UserLearningPath>;
  start(id: string): Promise<UserLearningPath>;
  pause(id: string): Promise<UserLearningPath>;
  resume(id: string): Promise<UserLearningPath>;
  complete(id: string): Promise<UserLearningPath>;
  abandon(id: string): Promise<UserLearningPath>;
  pin(id: string): Promise<void>;
  unpin(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  getStats(learningProfileId: string): Promise<LearningPathStats>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createLearningPathRepository(prisma: PrismaClient): LearningPathRepository {
  async function create(input: CreateLearningPathInput): Promise<UserLearningPath> {
    const totalItems = input.milestones.reduce((sum, m) => sum + m.items.length, 0);

    return prisma.userLearningPath.create({
      data: {
        learningProfileId: input.learningProfileId,
        title: input.title,
        description: input.description,
        pathType: input.pathType,
        targetRole: input.targetRole,
        targetSkillIds: input.targetSkillIds ?? [],
        targetLevels: input.targetLevels ?? {},
        estimatedCareerImpact: input.estimatedCareerImpact,
        generatedBy: input.generatedBy,
        generationContext: input.generationContext ?? {},
        milestones: input.milestones as unknown as Prisma.InputJsonValue,
        totalDuration: input.totalDuration,
        totalItems,
      },
    });
  }

  async function findById(id: string): Promise<UserLearningPathWithRelations | null> {
    return prisma.userLearningPath.findUnique({
      where: { id },
      include: {
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async function findMany(
    filter: LearningPathListFilter,
    options: LearningPathListOptions = {}
  ): Promise<{
    paths: UserLearningPathWithRelations[];
    total: number;
  }> {
    const { page = 1, limit = 20, orderBy = 'updatedAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.UserLearningPathWhereInput = {};

    if (filter.learningProfileId) where.learningProfileId = filter.learningProfileId;
    if (filter.pathType) {
      where.pathType = Array.isArray(filter.pathType) ? { in: filter.pathType } : filter.pathType;
    }
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.generatedBy) where.generatedBy = filter.generatedBy;
    if (filter.targetRole) where.targetRole = { contains: filter.targetRole, mode: 'insensitive' };
    if (filter.isPinned !== undefined) where.isPinned = filter.isPinned;
    if (filter.createdAfter || filter.createdBefore) {
      where.createdAt = {};
      if (filter.createdAfter) where.createdAt.gte = filter.createdAfter;
      if (filter.createdBefore) where.createdAt.lte = filter.createdBefore;
    }
    if (filter.hasProgress !== undefined) {
      where.progressPercentage = filter.hasProgress ? { gt: 0 } : { equals: 0 };
    }

    const [paths, total] = await Promise.all([
      prisma.userLearningPath.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: orderDirection },
        include: {
          learningProfile: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      }),
      prisma.userLearningPath.count({ where }),
    ]);

    return { paths, total };
  }

  async function findActiveForProfile(
    learningProfileId: string
  ): Promise<UserLearningPathWithRelations[]> {
    return prisma.userLearningPath.findMany({
      where: {
        learningProfileId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      orderBy: [{ isPinned: 'desc' }, { lastActivityAt: 'desc' }],
      include: {
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async function findPinnedForProfile(
    learningProfileId: string
  ): Promise<UserLearningPathWithRelations[]> {
    return prisma.userLearningPath.findMany({
      where: {
        learningProfileId,
        isPinned: true,
      },
      orderBy: { lastActivityAt: 'desc' },
      include: {
        learningProfile: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  async function update(id: string, input: UpdateLearningPathInput): Promise<UserLearningPath> {
    const data: Prisma.UserLearningPathUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.targetRole !== undefined) data.targetRole = input.targetRole;
    if (input.targetSkillIds !== undefined) data.targetSkillIds = input.targetSkillIds;
    if (input.targetLevels !== undefined) data.targetLevels = input.targetLevels;
    if (input.estimatedCareerImpact !== undefined) {
      data.estimatedCareerImpact = input.estimatedCareerImpact;
    }
    if (input.milestones !== undefined) {
      data.milestones = input.milestones as unknown as Prisma.InputJsonValue;
    }
    if (input.totalDuration !== undefined) data.totalDuration = input.totalDuration;
    if (input.totalItems !== undefined) data.totalItems = input.totalItems;
    if (input.status !== undefined) data.status = input.status;
    if (input.currentMilestoneIndex !== undefined) {
      data.currentMilestoneIndex = input.currentMilestoneIndex;
    }
    if (input.completedItems !== undefined) data.completedItems = input.completedItems;
    if (input.progressPercentage !== undefined) data.progressPercentage = input.progressPercentage;
    if (input.lastActivityAt !== undefined) data.lastActivityAt = input.lastActivityAt;
    if (input.startedAt !== undefined) data.startedAt = input.startedAt;
    if (input.completedAt !== undefined) data.completedAt = input.completedAt;
    if (input.abandonedAt !== undefined) data.abandonedAt = input.abandonedAt;
    if (input.isPinned !== undefined) data.isPinned = input.isPinned;
    if (input.userNotes !== undefined) data.userNotes = input.userNotes;

    return prisma.userLearningPath.update({
      where: { id },
      data,
    });
  }

  async function updateProgress(
    id: string,
    completedItems: number,
    currentMilestoneIndex: number
  ): Promise<UserLearningPath> {
    const path = await prisma.userLearningPath.findUnique({
      where: { id },
      select: { totalItems: true },
    });

    const progressPercentage = path?.totalItems ? (completedItems / path.totalItems) * 100 : 0;

    return prisma.userLearningPath.update({
      where: { id },
      data: {
        completedItems,
        currentMilestoneIndex,
        progressPercentage,
        lastActivityAt: new Date(),
      },
    });
  }

  async function updateMilestone(
    id: string,
    milestoneIndex: number,
    milestone: PathMilestone
  ): Promise<UserLearningPath> {
    const path = await prisma.userLearningPath.findUnique({
      where: { id },
      select: { milestones: true },
    });

    if (!path) throw new Error('Learning path not found');

    const milestones = path.milestones as unknown as PathMilestone[];
    milestones[milestoneIndex] = milestone;

    return prisma.userLearningPath.update({
      where: { id },
      data: {
        milestones: milestones as unknown as Prisma.InputJsonValue,
        lastActivityAt: new Date(),
      },
    });
  }

  async function completeItem(
    id: string,
    milestoneIndex: number,
    itemId: string
  ): Promise<UserLearningPath> {
    const path = await prisma.userLearningPath.findUnique({
      where: { id },
      select: { milestones: true, completedItems: true, totalItems: true },
    });

    if (!path) throw new Error('Learning path not found');

    const milestones = path.milestones as unknown as PathMilestone[];
    const milestone = milestones[milestoneIndex];

    if (!milestone) throw new Error('Milestone not found');

    const item = milestone.items.find((i) => i.id === itemId);
    if (!item) throw new Error('Item not found');

    if (!item.isCompleted) {
      item.isCompleted = true;
      item.completedAt = new Date().toISOString();
      milestone.completedItems += 1;

      if (milestone.completedItems >= milestone.requiredCompletions) {
        milestone.isCompleted = true;
      }

      const completedItems = path.completedItems + 1;
      const progressPercentage = path.totalItems ? (completedItems / path.totalItems) * 100 : 0;

      // Check if all milestones are completed
      const allCompleted = milestones.every((m) => m.isCompleted);
      const newMilestoneIndex = allCompleted
        ? milestones.length - 1
        : milestones.findIndex((m) => !m.isCompleted);

      return prisma.userLearningPath.update({
        where: { id },
        data: {
          milestones: milestones as unknown as Prisma.InputJsonValue,
          completedItems,
          progressPercentage,
          currentMilestoneIndex: newMilestoneIndex >= 0 ? newMilestoneIndex : milestoneIndex,
          lastActivityAt: new Date(),
          status: allCompleted ? 'COMPLETED' : 'ACTIVE',
          completedAt: allCompleted ? new Date() : null,
        },
      });
    }

    return prisma.userLearningPath.findUniqueOrThrow({ where: { id } });
  }

  async function start(id: string): Promise<UserLearningPath> {
    return prisma.userLearningPath.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }

  async function pause(id: string): Promise<UserLearningPath> {
    return prisma.userLearningPath.update({
      where: { id },
      data: {
        status: 'PAUSED',
        lastActivityAt: new Date(),
      },
    });
  }

  async function resume(id: string): Promise<UserLearningPath> {
    return prisma.userLearningPath.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        lastActivityAt: new Date(),
      },
    });
  }

  async function complete(id: string): Promise<UserLearningPath> {
    return prisma.userLearningPath.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        progressPercentage: 100,
        lastActivityAt: new Date(),
      },
    });
  }

  async function abandon(id: string): Promise<UserLearningPath> {
    return prisma.userLearningPath.update({
      where: { id },
      data: {
        status: 'ABANDONED',
        abandonedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }

  async function pin(id: string): Promise<void> {
    await prisma.userLearningPath.update({
      where: { id },
      data: { isPinned: true },
    });
  }

  async function unpin(id: string): Promise<void> {
    await prisma.userLearningPath.update({
      where: { id },
      data: { isPinned: false },
    });
  }

  async function deletePath(id: string): Promise<void> {
    await prisma.userLearningPath.delete({ where: { id } });
  }

  async function getStats(learningProfileId: string): Promise<LearningPathStats> {
    const paths = await prisma.userLearningPath.findMany({
      where: { learningProfileId },
      select: {
        status: true,
        pathType: true,
        progressPercentage: true,
      },
    });

    const byStatus = {} as Record<PathStatus, number>;
    const byType = {} as Record<PathType, number>;
    let totalProgress = 0;
    let completedCount = 0;

    for (const path of paths) {
      byStatus[path.status as PathStatus] = (byStatus[path.status as PathStatus] ?? 0) + 1;
      byType[path.pathType as PathType] = (byType[path.pathType as PathType] ?? 0) + 1;
      totalProgress += path.progressPercentage;
      if (path.status === 'COMPLETED') completedCount++;
    }

    const startedPaths = paths.filter((p) =>
      ['ACTIVE', 'PAUSED', 'COMPLETED'].includes(p.status)
    ).length;

    return {
      total: paths.length,
      byStatus,
      byType,
      averageProgress: paths.length > 0 ? totalProgress / paths.length : 0,
      completionRate: startedPaths > 0 ? completedCount / startedPaths : 0,
    };
  }

  return {
    create,
    findById,
    findMany,
    findActiveForProfile,
    findPinnedForProfile,
    update,
    updateProgress,
    updateMilestone,
    completeItem,
    start,
    pause,
    resume,
    complete,
    abandon,
    pin,
    unpin,
    delete: deletePath,
    getStats,
  };
}
