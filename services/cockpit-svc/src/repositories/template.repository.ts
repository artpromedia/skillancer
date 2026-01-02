// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/template
 * Project Template data access layer
 */

import { Prisma } from '@skillancer/database';

import type {
  TemplateTask,
  TemplateMilestone,
  TemplateWithUsage,
  ProjectType,
  BudgetType,
} from '../types/project.types.js';
import type { PrismaClient, ProjectTemplate } from '@skillancer/database';

export class TemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new template
   */
  async create(data: {
    freelancerUserId: string;
    name: string;
    description?: string | null;
    category?: string | null;
    taskStructure: TemplateTask[];
    milestoneStructure?: TemplateMilestone[] | null;
    projectType?: ProjectType | null;
    budgetType?: BudgetType | null;
    defaultHourlyRate?: number | null;
    estimatedHours?: number | null;
    tags?: string[];
  }): Promise<ProjectTemplate> {
    return this.prisma.projectTemplate.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        taskStructure: data.taskStructure as unknown as Prisma.InputJsonValue,
        milestoneStructure: data.milestoneStructure
          ? (data.milestoneStructure as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        projectType: data.projectType ?? null,
        budgetType: data.budgetType ?? null,
        defaultHourlyRate: data.defaultHourlyRate ?? null,
        estimatedHours: data.estimatedHours ?? null,
        tags: data.tags ?? [],
      },
    });
  }

  /**
   * Find a template by ID
   */
  async findById(id: string): Promise<ProjectTemplate | null> {
    return this.prisma.projectTemplate.findUnique({
      where: { id },
    });
  }

  /**
   * Find templates by freelancer
   */
  async findByFreelancer(
    freelancerUserId: string,
    options?: {
      category?: string;
      search?: string;
    }
  ): Promise<TemplateWithUsage[]> {
    const where: Prisma.ProjectTemplateWhereInput = {
      freelancerUserId,
    };

    if (options?.category) {
      where.category = options.category;
    }

    if (options?.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { description: { contains: options.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const templates = await this.prisma.projectTemplate.findMany({
      where,
      orderBy: [{ useCount: 'desc' }, { createdAt: 'desc' }],
    });

    return templates.map((template) => {
      const tasks = (template.taskStructure as TemplateTask[] | null) ?? [];
      const milestones = template.milestoneStructure as TemplateMilestone[] | null;

      return {
        id: template.id,
        freelancerUserId: template.freelancerUserId,
        name: template.name,
        description: template.description,
        category: template.category,
        taskCount: tasks.length,
        milestoneCount: milestones?.length ?? 0,
        useCount: template.useCount,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      };
    });
  }

  /**
   * Update a template
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      category: string | null;
      taskStructure: TemplateTask[];
      milestoneStructure: TemplateMilestone[] | null;
      projectType: ProjectType | null;
      budgetType: BudgetType | null;
      defaultHourlyRate: number | null;
      estimatedHours: number | null;
      tags: string[];
    }>
  ): Promise<ProjectTemplate> {
    const updateData: Prisma.ProjectTemplateUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.taskStructure !== undefined) {
      updateData.taskStructure = data.taskStructure as unknown as Prisma.InputJsonValue;
    }
    if (data.milestoneStructure !== undefined) {
      updateData.milestoneStructure = data.milestoneStructure
        ? (data.milestoneStructure as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }
    if (data.projectType !== undefined) updateData.projectType = data.projectType;
    if (data.budgetType !== undefined) updateData.budgetType = data.budgetType;
    if (data.defaultHourlyRate !== undefined) updateData.defaultHourlyRate = data.defaultHourlyRate;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.tags !== undefined) updateData.tags = data.tags;

    return this.prisma.projectTemplate.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a template
   */
  async delete(id: string): Promise<void> {
    await this.prisma.projectTemplate.delete({
      where: { id },
    });
  }

  /**
   * Increment use count
   */
  async incrementUseCount(id: string): Promise<void> {
    await this.prisma.projectTemplate.update({
      where: { id },
      data: {
        useCount: { increment: 1 },
      },
    });
  }

  /**
   * Get categories for a freelancer
   */
  async getCategories(freelancerUserId: string): Promise<string[]> {
    const result = await this.prisma.projectTemplate.groupBy({
      by: ['category'],
      where: {
        freelancerUserId,
        category: { not: null },
      },
    });

    return result.map((r) => r.category).filter((c): c is string => c !== null);
  }
}

