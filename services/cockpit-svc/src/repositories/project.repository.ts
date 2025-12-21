/**
 * @module @skillancer/cockpit-svc/repositories/project
 * Project data access layer
 */

import { Prisma } from '@skillancer/database';

import type {
  ProjectFilters,
  TaskStats,
  ProjectSource,
  ProjectType,
  ProjectStatus,
  BudgetType,
} from '../types/project.types.js';
import type { PrismaClient, CrmPriority, CockpitProject } from '@skillancer/database';

export class ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new project
   */
  async create(data: {
    freelancerUserId: string;
    clientId?: string | null;
    source: ProjectSource;
    marketContractId?: string | null;
    externalId?: string | null;
    externalPlatform?: string | null;
    externalUrl?: string | null;
    name: string;
    description?: string | null;
    projectType: ProjectType;
    category?: string | null;
    tags?: string[];
    status: ProjectStatus;
    priority: CrmPriority;
    startDate?: Date | null;
    dueDate?: Date | null;
    budgetType?: BudgetType | null;
    budgetAmount?: number | null;
    hourlyRate?: number | null;
    currency?: string;
    estimatedHours?: number | null;
    trackedHours?: number;
    billableHours?: number;
    totalBilled?: number;
    totalPaid?: number;
    color?: string | null;
    notes?: string | null;
    customFields?: Record<string, unknown> | null;
  }): Promise<CockpitProject> {
    return this.prisma.cockpitProject.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        clientId: data.clientId ?? null,
        source: data.source,
        marketContractId: data.marketContractId ?? null,
        externalId: data.externalId ?? null,
        externalPlatform: data.externalPlatform ?? null,
        externalUrl: data.externalUrl ?? null,
        name: data.name,
        description: data.description ?? null,
        projectType: data.projectType,
        category: data.category ?? null,
        tags: data.tags ?? [],
        status: data.status,
        priority: data.priority,
        startDate: data.startDate ?? null,
        dueDate: data.dueDate ?? null,
        budgetType: data.budgetType ?? null,
        budgetAmount: data.budgetAmount ?? null,
        hourlyRate: data.hourlyRate ?? null,
        currency: data.currency ?? 'USD',
        estimatedHours: data.estimatedHours ?? null,
        trackedHours: data.trackedHours ?? 0,
        billableHours: data.billableHours ?? 0,
        totalBilled: data.totalBilled ?? 0,
        totalPaid: data.totalPaid ?? 0,
        color: data.color ?? null,
        notes: data.notes ?? null,
        customFields: (data.customFields as Prisma.InputJsonValue) ?? Prisma.DbNull,
      },
    });
  }

  /**
   * Find a project by ID
   */
  async findById(id: string): Promise<CockpitProject | null> {
    return this.prisma.cockpitProject.findUnique({
      where: { id },
    });
  }

  /**
   * Find a project by ID with full details
   */
  async findByIdWithDetails(id: string) {
    return this.prisma.cockpitProject.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            companyName: true,
          },
        },
        tasks: {
          orderBy: [{ parentTaskId: 'asc' }, { orderIndex: 'asc' }],
        },
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  /**
   * Find a project by Market contract ID
   */
  async findByMarketContract(marketContractId: string): Promise<CockpitProject | null> {
    return this.prisma.cockpitProject.findUnique({
      where: { marketContractId },
    });
  }

  /**
   * Find projects by filters
   */
  async findByFilters(params: ProjectFilters): Promise<{
    projects: CockpitProject[];
    total: number;
  }> {
    const where: Prisma.CockpitProjectWhereInput = {
      freelancerUserId: params.freelancerUserId,
    };

    if (params.clientId) {
      where.clientId = params.clientId;
    }

    if (params.status && params.status.length > 0) {
      where.status = { in: params.status };
    }

    if (params.priority && params.priority.length > 0) {
      where.priority = { in: params.priority };
    }

    if (params.source && params.source.length > 0) {
      where.source = { in: params.source };
    }

    if (params.projectType && params.projectType.length > 0) {
      where.projectType = { in: params.projectType };
    }

    if (params.tags && params.tags.length > 0) {
      where.tags = { hasSome: params.tags };
    }

    if (params.startDateFrom || params.startDateTo) {
      where.startDate = {};
      if (params.startDateFrom) {
        where.startDate.gte = params.startDateFrom;
      }
      if (params.startDateTo) {
        where.startDate.lte = params.startDateTo;
      }
    }

    if (params.dueDateFrom || params.dueDateTo) {
      where.dueDate = {};
      if (params.dueDateFrom) {
        where.dueDate.gte = params.dueDateFrom;
      }
      if (params.dueDateTo) {
        where.dueDate.lte = params.dueDateTo;
      }
    }

    if (params.isArchived !== undefined) {
      where.isArchived = params.isArchived;
    }

    if (params.isFavorite !== undefined) {
      where.isFavorite = params.isFavorite;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { category: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.CockpitProjectOrderByWithRelationInput = {};
    switch (params.sortBy) {
      case 'name':
        orderBy.name = params.sortOrder || 'asc';
        break;
      case 'dueDate':
        orderBy.dueDate = params.sortOrder || 'asc';
        break;
      case 'status':
        orderBy.status = params.sortOrder || 'asc';
        break;
      case 'priority':
        orderBy.priority = params.sortOrder || 'desc';
        break;
      case 'progress':
        orderBy.progressPercent = params.sortOrder || 'desc';
        break;
      case 'created':
      default:
        orderBy.createdAt = params.sortOrder || 'desc';
        break;
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.prisma.cockpitProject.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
      }),
      this.prisma.cockpitProject.count({ where }),
    ]);

    return { projects: projects as CockpitProject[], total };
  }

  /**
   * Update a project
   */
  async update(
    id: string,
    data: Partial<{
      clientId: string | null;
      name: string;
      description: string | null;
      projectType: ProjectType;
      category: string | null;
      tags: string[];
      status: ProjectStatus;
      priority: CrmPriority;
      startDate: Date | null;
      dueDate: Date | null;
      completedAt: Date | null;
      budgetType: BudgetType | null;
      budgetAmount: number | null;
      hourlyRate: number | null;
      currency: string;
      progressPercent: number;
      estimatedHours: number | null;
      trackedHours: number;
      billableHours: number;
      totalBilled: number;
      totalPaid: number;
      isArchived: boolean;
      isFavorite: boolean;
      color: string | null;
      notes: string | null;
      customFields: Record<string, unknown> | null;
    }>
  ): Promise<CockpitProject> {
    const updateData: Prisma.CockpitProjectUpdateInput = {};

    if (data.clientId !== undefined)
      updateData.client = data.clientId ? { connect: { id: data.clientId } } : { disconnect: true };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.projectType !== undefined) updateData.projectType = data.projectType;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.budgetType !== undefined) updateData.budgetType = data.budgetType;
    if (data.budgetAmount !== undefined) updateData.budgetAmount = data.budgetAmount;
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.progressPercent !== undefined) updateData.progressPercent = data.progressPercent;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.trackedHours !== undefined) updateData.trackedHours = data.trackedHours;
    if (data.billableHours !== undefined) updateData.billableHours = data.billableHours;
    if (data.totalBilled !== undefined) updateData.totalBilled = data.totalBilled;
    if (data.totalPaid !== undefined) updateData.totalPaid = data.totalPaid;
    if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
    if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.customFields !== undefined) {
      updateData.customFields = (data.customFields as Prisma.InputJsonValue) ?? Prisma.DbNull;
    }

    return this.prisma.cockpitProject.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a project
   */
  async delete(id: string): Promise<void> {
    await this.prisma.cockpitProject.delete({
      where: { id },
    });
  }

  /**
   * Get projects by freelancer
   */
  async findByFreelancer(
    freelancerUserId: string,
    options?: { isArchived?: boolean }
  ): Promise<CockpitProject[]> {
    return this.prisma.cockpitProject.findMany({
      where: {
        freelancerUserId,
        isArchived: options?.isArchived ?? false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get task stats for a project
   */
  async getTaskStats(projectId: string): Promise<TaskStats> {
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
   * Count projects with overdue tasks
   */
  async countWithOverdueTasks(freelancerUserId: string): Promise<number> {
    const result = await this.prisma.cockpitProject.findMany({
      where: {
        freelancerUserId,
        isArchived: false,
        tasks: {
          some: {
            dueDate: { lt: new Date() },
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        },
      },
      select: { id: true },
    });

    return result.length;
  }
}
