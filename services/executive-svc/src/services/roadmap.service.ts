import type { FastifyInstance } from 'fastify';
import { prisma } from '@skillancer/database';
import {
  TechnicalRoadmap,
  RoadmapInitiative,
  InitiativeMilestone,
  InitiativeStatus,
} from '@prisma/client';
import { logger } from '@skillancer/logger';

const log = logger.child({ service: 'roadmap-service' });

export interface CreateRoadmapInput {
  engagementId: string;
  title: string;
  description?: string;
  timeframe?: string;
}

export interface UpdateRoadmapInput {
  title?: string;
  description?: string;
  timeframe?: string;
}

export interface CreateInitiativeInput {
  roadmapId: string;
  title: string;
  description?: string;
  quarter?: string;
  startDate?: Date;
  endDate?: Date;
  status?: InitiativeStatus;
  progress?: number;
  category?: string;
  priority?: number;
  ownerId?: string;
  ownerName?: string;
  jiraEpicKey?: string;
  jiraEpicUrl?: string;
  githubIssueUrl?: string;
  dependsOn?: string[];
}

export interface UpdateInitiativeInput {
  title?: string;
  description?: string;
  quarter?: string;
  startDate?: Date;
  endDate?: Date;
  status?: InitiativeStatus;
  progress?: number;
  category?: string;
  priority?: number;
  ownerId?: string;
  ownerName?: string;
  jiraEpicKey?: string;
  jiraEpicUrl?: string;
  githubIssueUrl?: string;
  dependsOn?: string[];
}

export interface CreateMilestoneInput {
  initiativeId: string;
  title: string;
  dueDate?: Date;
}

export interface UpdateMilestoneInput {
  title?: string;
  dueDate?: Date;
  completed?: boolean;
}

export class RoadmapService {
  // ==================== Roadmap CRUD ====================

  async createRoadmap(input: CreateRoadmapInput): Promise<TechnicalRoadmap> {
    log.info({ engagementId: input.engagementId }, 'Creating technical roadmap');

    const roadmap = await prisma.technicalRoadmap.create({
      data: {
        engagementId: input.engagementId,
        title: input.title,
        description: input.description,
        timeframe: input.timeframe,
      },
      include: { initiatives: { include: { milestones: true } } },
    });

    log.info({ roadmapId: roadmap.id }, 'Roadmap created');
    return roadmap;
  }

  async getRoadmap(id: string): Promise<TechnicalRoadmap | null> {
    return prisma.technicalRoadmap.findUnique({
      where: { id },
      include: {
        initiatives: {
          orderBy: [{ priority: 'desc' }, { sortOrder: 'asc' }],
          include: { milestones: { orderBy: { dueDate: 'asc' } } },
        },
      },
    });
  }

  async getRoadmapByEngagement(engagementId: string): Promise<TechnicalRoadmap | null> {
    return prisma.technicalRoadmap.findUnique({
      where: { engagementId },
      include: {
        initiatives: {
          orderBy: [{ priority: 'desc' }, { sortOrder: 'asc' }],
          include: { milestones: { orderBy: { dueDate: 'asc' } } },
        },
      },
    });
  }

  async updateRoadmap(id: string, input: UpdateRoadmapInput): Promise<TechnicalRoadmap> {
    log.info({ roadmapId: id }, 'Updating roadmap');

    return prisma.technicalRoadmap.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        timeframe: input.timeframe,
      },
      include: { initiatives: { include: { milestones: true } } },
    });
  }

  async deleteRoadmap(id: string): Promise<void> {
    log.info({ roadmapId: id }, 'Deleting roadmap');
    await prisma.technicalRoadmap.delete({ where: { id } });
  }

  // ==================== Initiative CRUD ====================

  async createInitiative(input: CreateInitiativeInput): Promise<RoadmapInitiative> {
    log.info({ roadmapId: input.roadmapId, title: input.title }, 'Creating initiative');

    const maxSort = await prisma.roadmapInitiative.aggregate({
      where: { roadmapId: input.roadmapId },
      _max: { sortOrder: true },
    });

    const initiative = await prisma.roadmapInitiative.create({
      data: {
        roadmapId: input.roadmapId,
        title: input.title,
        description: input.description,
        quarter: input.quarter,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status || 'PLANNED',
        progress: input.progress || 0,
        category: input.category,
        priority: input.priority || 0,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        jiraEpicKey: input.jiraEpicKey,
        jiraEpicUrl: input.jiraEpicUrl,
        githubIssueUrl: input.githubIssueUrl,
        dependsOn: input.dependsOn || [],
      },
      include: { milestones: true },
    });

    log.info({ initiativeId: initiative.id }, 'Initiative created');
    return initiative;
  }

  async getInitiative(id: string): Promise<RoadmapInitiative | null> {
    return prisma.roadmapInitiative.findUnique({
      where: { id },
      include: { milestones: { orderBy: { dueDate: 'asc' } } },
    });
  }

  async updateInitiative(id: string, input: UpdateInitiativeInput): Promise<RoadmapInitiative> {
    log.info({ initiativeId: id }, 'Updating initiative');

    return prisma.roadmapInitiative.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        quarter: input.quarter,
        startDate: input.startDate,
        endDate: input.endDate,
        status: input.status,
        progress: input.progress,
        category: input.category,
        priority: input.priority,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        jiraEpicKey: input.jiraEpicKey,
        jiraEpicUrl: input.jiraEpicUrl,
        githubIssueUrl: input.githubIssueUrl,
        dependsOn: input.dependsOn,
      },
      include: { milestones: true },
    });
  }

  async deleteInitiative(id: string): Promise<void> {
    log.info({ initiativeId: id }, 'Deleting initiative');
    await prisma.roadmapInitiative.delete({ where: { id } });
  }

  async reorderInitiatives(roadmapId: string, initiativeIds: string[]): Promise<void> {
    log.info({ roadmapId }, 'Reordering initiatives');

    await prisma.$transaction(
      initiativeIds.map((id, index) =>
        prisma.roadmapInitiative.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
  }

  async updateInitiativeStatus(
    id: string,
    status: InitiativeStatus,
    progress?: number
  ): Promise<RoadmapInitiative> {
    log.info({ initiativeId: id, status }, 'Updating initiative status');

    const data: { status: InitiativeStatus; progress?: number } = { status };
    if (progress !== undefined) data.progress = progress;
    if (status === 'COMPLETED') data.progress = 100;

    return prisma.roadmapInitiative.update({
      where: { id },
      data,
      include: { milestones: true },
    });
  }

  // ==================== Milestone CRUD ====================

  async createMilestone(input: CreateMilestoneInput): Promise<InitiativeMilestone> {
    log.info({ initiativeId: input.initiativeId, title: input.title }, 'Creating milestone');

    return prisma.initiativeMilestone.create({
      data: {
        initiativeId: input.initiativeId,
        title: input.title,
        dueDate: input.dueDate,
        completed: false,
      },
    });
  }

  async updateMilestone(id: string, input: UpdateMilestoneInput): Promise<InitiativeMilestone> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate;
    if (input.completed !== undefined) {
      data.completed = input.completed;
      data.completedAt = input.completed ? new Date() : null;
    }

    return prisma.initiativeMilestone.update({ where: { id }, data });
  }

  async deleteMilestone(id: string): Promise<void> {
    await prisma.initiativeMilestone.delete({ where: { id } });
  }

  async toggleMilestoneComplete(id: string): Promise<InitiativeMilestone> {
    const milestone = await prisma.initiativeMilestone.findUnique({ where: { id } });
    if (!milestone) throw new Error('Milestone not found');

    return prisma.initiativeMilestone.update({
      where: { id },
      data: {
        completed: !milestone.completed,
        completedAt: milestone.completed ? null : new Date(),
      },
    });
  }

  // ==================== Analytics ====================

  async getRoadmapStats(roadmapId: string): Promise<RoadmapStats> {
    const initiatives = await prisma.roadmapInitiative.findMany({
      where: { roadmapId },
      include: { milestones: true },
    });

    const byStatus = {
      planned: initiatives.filter((i) => i.status === 'PLANNED').length,
      inProgress: initiatives.filter((i) => i.status === 'IN_PROGRESS').length,
      blocked: initiatives.filter((i) => i.status === 'BLOCKED').length,
      completed: initiatives.filter((i) => i.status === 'COMPLETED').length,
      cancelled: initiatives.filter((i) => i.status === 'CANCELLED').length,
    };

    const avgProgress = initiatives.length
      ? initiatives.reduce((sum, i) => sum + i.progress, 0) / initiatives.length
      : 0;

    const totalMilestones = initiatives.reduce((sum, i) => sum + i.milestones.length, 0);
    const completedMilestones = initiatives.reduce(
      (sum, i) => sum + i.milestones.filter((m) => m.completed).length,
      0
    );

    const overdueMilestones = initiatives.reduce(
      (sum, i) =>
        sum +
        i.milestones.filter((m) => !m.completed && m.dueDate && m.dueDate < new Date()).length,
      0
    );

    return {
      totalInitiatives: initiatives.length,
      byStatus,
      averageProgress: Math.round(avgProgress),
      totalMilestones,
      completedMilestones,
      overdueMilestones,
      milestonesCompletionRate: totalMilestones
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0,
    };
  }

  async getInitiativesByQuarter(roadmapId: string): Promise<Record<string, RoadmapInitiative[]>> {
    const initiatives = await prisma.roadmapInitiative.findMany({
      where: { roadmapId },
      include: { milestones: true },
      orderBy: [{ quarter: 'asc' }, { priority: 'desc' }],
    });

    const byQuarter: Record<string, RoadmapInitiative[]> = {};
    for (const initiative of initiatives) {
      const quarter = initiative.quarter || 'Unscheduled';
      if (!byQuarter[quarter]) byQuarter[quarter] = [];
      byQuarter[quarter].push(initiative);
    }

    return byQuarter;
  }

  async getBlockedInitiatives(roadmapId: string): Promise<RoadmapInitiative[]> {
    return prisma.roadmapInitiative.findMany({
      where: { roadmapId, status: 'BLOCKED' },
      include: { milestones: true },
    });
  }

  async getUpcomingMilestones(roadmapId: string, days = 14): Promise<UpcomingMilestone[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const initiatives = await prisma.roadmapInitiative.findMany({
      where: { roadmapId },
      include: {
        milestones: {
          where: {
            completed: false,
            dueDate: { lte: futureDate },
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    const upcoming: UpcomingMilestone[] = [];
    for (const initiative of initiatives) {
      for (const milestone of initiative.milestones) {
        upcoming.push({
          milestone,
          initiativeId: initiative.id,
          initiativeTitle: initiative.title,
          isOverdue: milestone.dueDate ? milestone.dueDate < new Date() : false,
        });
      }
    }

    return upcoming.sort((a, b) => {
      if (!a.milestone.dueDate) return 1;
      if (!b.milestone.dueDate) return -1;
      return a.milestone.dueDate.getTime() - b.milestone.dueDate.getTime();
    });
  }
}

interface RoadmapStats {
  totalInitiatives: number;
  byStatus: {
    planned: number;
    inProgress: number;
    blocked: number;
    completed: number;
    cancelled: number;
  };
  averageProgress: number;
  totalMilestones: number;
  completedMilestones: number;
  overdueMilestones: number;
  milestonesCompletionRate: number;
}

interface UpcomingMilestone {
  milestone: InitiativeMilestone;
  initiativeId: string;
  initiativeTitle: string;
  isOverdue: boolean;
}

export function registerRoadmapService(app: FastifyInstance): void {
  const service = new RoadmapService();
  app.decorate('roadmapService', service);
}

declare module 'fastify' {
  interface FastifyInstance {
    roadmapService: RoadmapService;
  }
}

export const roadmapService = new RoadmapService();
