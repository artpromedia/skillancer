// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/activity
 * Project Activity data access layer
 */

import { Prisma } from '../types/prisma-shim.js';

import type { ProjectActivityItem, ProjectActivityType } from '../types/project.types.js';
import type { PrismaClient, ProjectActivity } from '../types/prisma-shim.js';

export class ActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new activity
   */
  async create(data: {
    projectId: string;
    activityType: ProjectActivityType;
    description: string;
    taskId?: string | null;
    milestoneId?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<ProjectActivity> {
    return this.prisma.projectActivity.create({
      data: {
        projectId: data.projectId,
        activityType: data.activityType,
        description: data.description,
        taskId: data.taskId ?? null,
        milestoneId: data.milestoneId ?? null,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
  }

  /**
   * Find activities by project
   */
  async findByProject(
    projectId: string,
    options?: {
      limit?: number;
      offset?: number;
      activityTypes?: ProjectActivityType[];
    }
  ): Promise<{ activities: ProjectActivity[]; total: number }> {
    const where: Prisma.ProjectActivityWhereInput = { projectId };

    if (options?.activityTypes && options.activityTypes.length > 0) {
      where.activityType = { in: options.activityTypes };
    }

    const [activities, total] = await Promise.all([
      this.prisma.projectActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 20,
        skip: options?.offset ?? 0,
      }),
      this.prisma.projectActivity.count({ where }),
    ]);

    return { activities, total };
  }

  /**
   * Get recent activity for a project
   */
  async getRecent(projectId: string, limit: number = 20): Promise<ProjectActivityItem[]> {
    const activities = await this.prisma.projectActivity.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return activities.map((activity) => ({
      id: activity.id,
      projectId: activity.projectId,
      activityType: activity.activityType,
      description: activity.description,
      taskId: activity.taskId,
      milestoneId: activity.milestoneId,
      metadata: activity.metadata as Record<string, unknown> | null,
      createdAt: activity.createdAt,
    }));
  }

  /**
   * Get activity for a freelancer across all projects
   */
  async findByFreelancer(
    freelancerUserId: string,
    options?: {
      limit?: number;
      offset?: number;
      projectId?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): Promise<{ activities: ProjectActivity[]; total: number }> {
    const where: Prisma.ProjectActivityWhereInput = {
      project: {
        freelancerUserId,
      },
    };

    if (options?.projectId) {
      where.projectId = options.projectId;
    }

    if (options?.dateFrom || options?.dateTo) {
      where.createdAt = {};
      if (options?.dateFrom) {
        where.createdAt.gte = options.dateFrom;
      }
      if (options?.dateTo) {
        where.createdAt.lte = options.dateTo;
      }
    }

    const [activities, total] = await Promise.all([
      this.prisma.projectActivity.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      this.prisma.projectActivity.count({ where }),
    ]);

    return { activities, total };
  }

  /**
   * Delete activities for a project
   */
  async deleteByProject(projectId: string): Promise<void> {
    await this.prisma.projectActivity.deleteMany({
      where: { projectId },
    });
  }
}

