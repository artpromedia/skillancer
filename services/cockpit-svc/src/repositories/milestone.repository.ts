/**
 * @module @skillancer/cockpit-svc/repositories/milestone
 * Milestone data access layer
 */

import { Prisma } from '@skillancer/database';

import type {
  Deliverable,
  MilestoneWithProgress,
  MilestoneStatus,
} from '../types/project.types.js';
import type { PrismaClient, ProjectMilestone } from '@skillancer/database';

export class MilestoneRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new milestone
   */
  async create(data: {
    projectId: string;
    title: string;
    description?: string | null;
    orderIndex?: number;
    dueDate?: Date | null;
    status?: MilestoneStatus;
    marketMilestoneId?: string | null;
    amount?: number | null;
    isPaid?: boolean;
    deliverables?: Deliverable[] | null;
    completedAt?: Date | null;
  }): Promise<ProjectMilestone> {
    return this.prisma.projectMilestone.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description ?? null,
        orderIndex: data.orderIndex ?? 0,
        dueDate: data.dueDate ?? null,
        status: data.status ?? 'PENDING',
        marketMilestoneId: data.marketMilestoneId ?? null,
        amount: data.amount ?? null,
        isPaid: data.isPaid ?? false,
        deliverables: data.deliverables
          ? (data.deliverables as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        completedAt: data.completedAt ?? null,
      },
    });
  }

  /**
   * Find a milestone by ID
   */
  async findById(id: string): Promise<ProjectMilestone | null> {
    return this.prisma.projectMilestone.findUnique({
      where: { id },
    });
  }

  /**
   * Find a milestone by ID with project
   */
  async findByIdWithProject(id: string) {
    return this.prisma.projectMilestone.findUnique({
      where: { id },
      include: {
        project: true,
        tasks: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  /**
   * Find a milestone by Market milestone ID
   */
  async findByMarketMilestone(marketMilestoneId: string): Promise<ProjectMilestone | null> {
    return this.prisma.projectMilestone.findFirst({
      where: { marketMilestoneId },
    });
  }

  /**
   * Find milestones by project
   */
  async findByProject(
    projectId: string,
    options?: {
      status?: MilestoneStatus[];
      dueDateBefore?: Date;
    }
  ): Promise<ProjectMilestone[]> {
    const where: Prisma.ProjectMilestoneWhereInput = { projectId };

    if (options?.status && options.status.length > 0) {
      where.status = { in: options.status };
    }

    if (options?.dueDateBefore) {
      where.dueDate = { lt: options.dueDateBefore };
    }

    return this.prisma.projectMilestone.findMany({
      where,
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Find milestones by project with progress
   */
  async findByProjectWithProgress(projectId: string): Promise<MilestoneWithProgress[]> {
    const milestones = await this.prisma.projectMilestone.findMany({
      where: { projectId },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return milestones.map((milestone) => {
      const taskCount = milestone.tasks.length;
      const completedTaskCount = milestone.tasks.filter((t) => t.status === 'COMPLETED').length;
      const progressPercent =
        taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;

      return {
        id: milestone.id,
        projectId: milestone.projectId,
        title: milestone.title,
        description: milestone.description,
        orderIndex: milestone.orderIndex,
        dueDate: milestone.dueDate,
        completedAt: milestone.completedAt,
        status: milestone.status,
        marketMilestoneId: milestone.marketMilestoneId,
        amount: milestone.amount ? Number(milestone.amount) : null,
        isPaid: milestone.isPaid,
        deliverables: milestone.deliverables as Deliverable[] | null,
        createdAt: milestone.createdAt,
        updatedAt: milestone.updatedAt,
        taskCount,
        completedTaskCount,
        progressPercent,
      };
    });
  }

  /**
   * Update a milestone
   */
  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      orderIndex: number;
      dueDate: Date | null;
      completedAt: Date | null;
      status: MilestoneStatus;
      amount: number | null;
      isPaid: boolean;
      deliverables: Deliverable[] | null;
    }>
  ): Promise<ProjectMilestone> {
    const updateData: Prisma.ProjectMilestoneUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.isPaid !== undefined) updateData.isPaid = data.isPaid;
    if (data.deliverables !== undefined) {
      updateData.deliverables = data.deliverables
        ? (data.deliverables as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }

    return this.prisma.projectMilestone.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a milestone
   */
  async delete(id: string): Promise<void> {
    // First, unlink tasks from this milestone
    await this.prisma.projectTask.updateMany({
      where: { milestoneId: id },
      data: { milestoneId: null },
    });

    // Then delete the milestone
    await this.prisma.projectMilestone.delete({
      where: { id },
    });
  }

  /**
   * Get the next order index
   */
  async getNextOrderIndex(projectId: string): Promise<number> {
    const result = await this.prisma.projectMilestone.aggregate({
      where: { projectId },
      _max: {
        orderIndex: true,
      },
    });

    return (result._max.orderIndex ?? -1) + 1;
  }

  /**
   * Batch update milestone orders
   */
  async updateOrders(orders: Array<{ milestoneId: string; orderIndex: number }>): Promise<void> {
    await this.prisma.$transaction(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      orders.map((order) =>
        this.prisma.projectMilestone.update({
          where: { id: order.milestoneId },
          data: { orderIndex: order.orderIndex },
        })
      )
    );
  }
}
