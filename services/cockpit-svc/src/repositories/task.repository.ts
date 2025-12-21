/**
 * @module @skillancer/cockpit-svc/repositories/task
 * Task data access layer
 */

import type { TaskStats, TaskStatus } from '../types/project.types.js';
import type { Prisma, PrismaClient, CrmPriority, ProjectTask } from '@skillancer/database';

export class TaskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new task
   */
  async create(data: {
    projectId: string;
    title: string;
    description?: string | null;
    parentTaskId?: string | null;
    orderIndex?: number;
    status: TaskStatus;
    priority: CrmPriority;
    startDate?: Date | null;
    dueDate?: Date | null;
    estimatedMinutes?: number;
    milestoneId?: string | null;
    tags?: string[];
    isRecurring?: boolean;
    recurrenceRule?: string | null;
  }): Promise<ProjectTask> {
    return this.prisma.projectTask.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description ?? null,
        parentTaskId: data.parentTaskId ?? null,
        orderIndex: data.orderIndex ?? 0,
        status: data.status,
        priority: data.priority,
        startDate: data.startDate ?? null,
        dueDate: data.dueDate ?? null,
        estimatedMinutes: data.estimatedMinutes ?? 0,
        milestoneId: data.milestoneId ?? null,
        tags: data.tags ?? [],
        isRecurring: data.isRecurring ?? false,
        recurrenceRule: data.recurrenceRule ?? null,
      },
    });
  }

  /**
   * Find a task by ID
   */
  async findById(id: string): Promise<ProjectTask | null> {
    return this.prisma.projectTask.findUnique({
      where: { id },
    });
  }

  /**
   * Find a task by ID with project
   */
  async findByIdWithProject(id: string) {
    return this.prisma.projectTask.findUnique({
      where: { id },
      include: {
        project: true,
        subtasks: {
          orderBy: { orderIndex: 'asc' },
        },
        milestone: true,
      },
    });
  }

  /**
   * Find tasks by project
   */
  async findByProject(
    projectId: string,
    options?: {
      status?: TaskStatus[];
      dueDateBefore?: Date;
      dueDateAfter?: Date;
      milestoneId?: string;
      parentTaskId?: string | null;
    }
  ): Promise<ProjectTask[]> {
    const where: Prisma.ProjectTaskWhereInput = { projectId };

    if (options?.status && options.status.length > 0) {
      where.status = { in: options.status };
    }

    if (options?.dueDateBefore) {
      where.dueDate = { ...(where.dueDate as object), lt: options.dueDateBefore };
    }

    if (options?.dueDateAfter) {
      where.dueDate = { ...(where.dueDate as object), gt: options.dueDateAfter };
    }

    if (options?.milestoneId !== undefined) {
      where.milestoneId = options.milestoneId;
    }

    if (options?.parentTaskId !== undefined) {
      where.parentTaskId = options.parentTaskId;
    }

    return this.prisma.projectTask.findMany({
      where,
      orderBy: [{ parentTaskId: 'asc' }, { orderIndex: 'asc' }],
    });
  }

  /**
   * Find tasks by date range for workload
   */
  async findByDateRange(
    freelancerUserId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<ProjectTask & { project: { id: string; name: string } }>> {
    return this.prisma.projectTask.findMany({
      where: {
        project: {
          freelancerUserId,
          isArchived: false,
        },
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    }) as Promise<Array<ProjectTask & { project: { id: string; name: string } }>>;
  }

  /**
   * Update a task
   */
  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      parentTaskId: string | null;
      orderIndex: number;
      status: TaskStatus;
      priority: CrmPriority;
      startDate: Date | null;
      dueDate: Date | null;
      completedAt: Date | null;
      estimatedMinutes: number;
      trackedMinutes: number;
      milestoneId: string | null;
      tags: string[];
      isRecurring: boolean;
      recurrenceRule: string | null;
    }>
  ): Promise<ProjectTask> {
    const updateData: Prisma.ProjectTaskUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.parentTaskId !== undefined) {
      updateData.parentTask = data.parentTaskId
        ? { connect: { id: data.parentTaskId } }
        : { disconnect: true };
    }
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.estimatedMinutes !== undefined) updateData.estimatedMinutes = data.estimatedMinutes;
    if (data.trackedMinutes !== undefined) updateData.trackedMinutes = data.trackedMinutes;
    if (data.milestoneId !== undefined) {
      updateData.milestone = data.milestoneId
        ? { connect: { id: data.milestoneId } }
        : { disconnect: true };
    }
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
    if (data.recurrenceRule !== undefined) updateData.recurrenceRule = data.recurrenceRule;

    return this.prisma.projectTask.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    // First, delete subtasks
    await this.prisma.projectTask.deleteMany({
      where: { parentTaskId: id },
    });

    // Then delete the task itself
    await this.prisma.projectTask.delete({
      where: { id },
    });
  }

  /**
   * Get the next order index for tasks
   */
  async getNextOrderIndex(projectId: string, parentTaskId?: string | null): Promise<number> {
    const result = await this.prisma.projectTask.aggregate({
      where: {
        projectId,
        parentTaskId: parentTaskId ?? null,
      },
      _max: {
        orderIndex: true,
      },
    });

    return (result._max.orderIndex ?? -1) + 1;
  }

  /**
   * Get task stats for a project
   */
  async getStats(projectId: string): Promise<TaskStats> {
    const now = new Date();

    const [total, completed, inProgress, todo, blocked, overdue] = await Promise.all([
      this.prisma.projectTask.count({
        where: { projectId },
      }),
      this.prisma.projectTask.count({
        where: { projectId, status: 'COMPLETED' },
      }),
      this.prisma.projectTask.count({
        where: { projectId, status: 'IN_PROGRESS' },
      }),
      this.prisma.projectTask.count({
        where: { projectId, status: 'TODO' },
      }),
      this.prisma.projectTask.count({
        where: { projectId, status: 'BLOCKED' },
      }),
      this.prisma.projectTask.count({
        where: {
          projectId,
          dueDate: { lt: now },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
    ]);

    return { total, completed, inProgress, todo, blocked, overdue };
  }

  /**
   * Add tracked time to a task
   */
  async addTrackedMinutes(id: string, minutes: number): Promise<ProjectTask> {
    return this.prisma.projectTask.update({
      where: { id },
      data: {
        trackedMinutes: { increment: minutes },
      },
    });
  }

  /**
   * Get overdue tasks for a freelancer
   */
  async findOverdue(freelancerUserId: string): Promise<ProjectTask[]> {
    return this.prisma.projectTask.findMany({
      where: {
        project: {
          freelancerUserId,
          isArchived: false,
        },
        dueDate: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Batch update task orders
   */
  async updateOrders(
    orders: Array<{ taskId: string; orderIndex: number; parentTaskId?: string | null }>
  ): Promise<void> {
    await this.prisma.$transaction(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      orders.map((order) =>
        this.prisma.projectTask.update({
          where: { id: order.taskId },
          data: {
            orderIndex: order.orderIndex,
            parentTaskId: order.parentTaskId,
          },
        })
      )
    );
  }
}
