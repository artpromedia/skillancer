// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/services/template
 * Template Service - Project template management
 */

import { ProjectError, ProjectErrorCode } from '../errors/project.errors.js';
import { TemplateRepository, ProjectRepository } from '../repositories/index.js';

import type {
  CreateTemplateParams,
  UpdateTemplateParams,
  ProjectTemplateWithStats,
  TemplateTask,
  TemplateMilestone,
  TemplateWithUsage,
  Deliverable,
  ProjectType,
  BudgetType,
} from '../types/project.types.js';
import type { PrismaClient, ProjectTemplate, ProjectTask } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class TemplateService {
  private readonly templateRepository: TemplateRepository;
  private readonly projectRepository: ProjectRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.templateRepository = new TemplateRepository(prisma);
    this.projectRepository = new ProjectRepository(prisma);
  }

  /**
   * Create a project template
   */
  async createTemplate(params: CreateTemplateParams): Promise<ProjectTemplate> {
    const taskStructure = params.tasks?.map((task, i) => ({
      title: task.title,
      description: task.description,
      estimatedMinutes: task.estimatedMinutes,
      orderIndex: i,
      subtasks: task.subtasks?.map((sub, j) => ({
        title: sub.title,
        description: sub.description,
        estimatedMinutes: sub.estimatedMinutes,
        orderIndex: j,
      })),
    }));

    const milestoneStructure = params.milestones?.map((m, i) => ({
      title: m.title,
      description: m.description,
      daysFromStart: m.daysFromStart,
      orderIndex: i,
      deliverables: m.deliverables?.map((d, j) => ({
        title: d.title,
        description: d.description,
        orderIndex: j,
      })),
    }));

    const template = await this.templateRepository.create({
      freelancerUserId: params.freelancerUserId,
      name: params.name,
      description: params.description,
      category: params.category,
      projectType: params.projectType,
      budgetType: params.budgetType,
      defaultHourlyRate: params.defaultHourlyRate,
      estimatedHours: params.estimatedHours,
      taskStructure: taskStructure ?? [],
      milestoneStructure,
      tags: params.tags,
    });

    this.logger.info({ templateId: template.id, name: params.name }, 'Template created');

    return template;
  }

  /**
   * Create template from existing project
   */
  async createFromProject(
    projectId: string,
    freelancerUserId: string,
    params: { name: string; description?: string; category?: string }
  ): Promise<ProjectTemplate> {
    const project = await this.projectRepository.findByIdWithDetails(projectId);
    if (!project || project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    // Build task structure from project tasks
    const buildTaskStructure = (
      tasks: ProjectTask[],
      parentId: string | null = null
    ): TemplateTask[] => {
      return [...tasks]
        .filter((t) => t.parentTaskId === parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((task, i) => ({
          title: task.title,
          description: task.description ?? undefined,
          estimatedMinutes: task.estimatedMinutes ?? undefined,
          orderIndex: i,
          subtasks: buildTaskStructure(tasks, task.id),
        }));
    };

    const taskStructure = buildTaskStructure(project.tasks);

    // Build milestone structure
    const milestoneStructure: TemplateMilestone[] = [...project.milestones]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((m, i) => ({
        title: m.title,
        description: m.description ?? undefined,
        daysFromStart:
          m.dueDate && project.startDate
            ? Math.ceil((m.dueDate.getTime() - project.startDate.getTime()) / (1000 * 60 * 60 * 24))
            : undefined,
        orderIndex: i,
        deliverables: (m.deliverables as Deliverable[] | null)?.map((d, j) => ({
          title: d.title,
          description: d.description ?? undefined,
          orderIndex: j,
        })),
      }));

    // Calculate estimated hours from tasks
    const estimatedMinutes = project.tasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

    const template = await this.templateRepository.create({
      freelancerUserId,
      name: params.name,
      description: params.description ?? project.description ?? undefined,
      category: params.category,
      projectType: project.projectType,
      budgetType: project.budgetType,
      defaultHourlyRate: project.hourlyRate ? Number(project.hourlyRate) : undefined,
      estimatedHours: estimatedMinutes > 0 ? estimatedMinutes / 60 : undefined,
      taskStructure,
      milestoneStructure,
      tags: project.tags || undefined,
    });

    this.logger.info(
      { templateId: template.id, projectId, name: params.name },
      'Template created from project'
    );

    return template;
  }

  /**
   * Get template by ID
   */
  async getTemplateById(
    templateId: string,
    freelancerUserId: string
  ): Promise<ProjectTemplateWithStats> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new ProjectError(ProjectErrorCode.TEMPLATE_NOT_FOUND);
    }

    if (template.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    // Count tasks and milestones
    const taskStructure = (template.taskStructure as unknown as TemplateTask[]) || [];
    const milestoneStructure =
      (template.milestoneStructure as unknown as TemplateMilestone[]) || [];

    const countTasks = (tasks: TemplateTask[]): number => {
      return tasks.reduce(
        (acc, t) => acc + 1 + countTasks((t.subtasks as TemplateTask[]) || []),
        0
      );
    };

    return {
      ...template,
      defaultHourlyRate: template.defaultHourlyRate ? Number(template.defaultHourlyRate) : null,
      estimatedHours: template.estimatedHours ? Number(template.estimatedHours) : null,
      taskCount: countTasks(taskStructure),
      milestoneCount: milestoneStructure.length,
    };
  }

  /**
   * Get templates for freelancer
   */
  async getTemplates(
    freelancerUserId: string,
    options?: { category?: string; search?: string }
  ): Promise<TemplateWithUsage[]> {
    return this.templateRepository.findByFreelancer(freelancerUserId, options);
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: string,
    freelancerUserId: string,
    updates: UpdateTemplateParams
  ): Promise<ProjectTemplate> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new ProjectError(ProjectErrorCode.TEMPLATE_NOT_FOUND);
    }

    if (template.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    type UpdateData = Partial<{
      name: string;
      description: string | null;
      category: string | null;
      taskStructure: TemplateTask[];
      milestoneStructure: TemplateMilestone[];
      projectType: ProjectType | null;
      budgetType: BudgetType | null;
      defaultHourlyRate: number | null;
      estimatedHours: number | null;
      tags: string[];
    }>;
    const updateData: UpdateData = {};

    // Copy simple fields
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description ?? null;
    if (updates.category !== undefined) updateData.category = updates.category ?? null;
    if (updates.projectType !== undefined) updateData.projectType = updates.projectType ?? null;
    if (updates.budgetType !== undefined) updateData.budgetType = updates.budgetType ?? null;
    if (updates.defaultHourlyRate !== undefined)
      updateData.defaultHourlyRate = updates.defaultHourlyRate ?? null;
    if (updates.estimatedHours !== undefined)
      updateData.estimatedHours = updates.estimatedHours ?? null;
    if (updates.tags !== undefined) updateData.tags = updates.tags;

    // Transform tasks if provided
    if (updates.tasks) {
      updateData.taskStructure = updates.tasks.map((task, i) => ({
        title: task.title,
        description: task.description,
        estimatedMinutes: task.estimatedMinutes,
        orderIndex: i,
        subtasks: task.subtasks?.map((sub, j) => ({
          title: sub.title,
          description: sub.description,
          estimatedMinutes: sub.estimatedMinutes,
          orderIndex: j,
        })),
      }));
    }

    // Transform milestones if provided
    if (updates.milestones) {
      updateData.milestoneStructure = updates.milestones.map((m, i) => ({
        title: m.title,
        description: m.description,
        daysFromStart: m.daysFromStart,
        orderIndex: i,
        deliverables: m.deliverables?.map((d, j) => ({
          title: d.title,
          description: d.description,
          orderIndex: j,
        })),
      }));
    }

    const updated = await this.templateRepository.update(templateId, updateData);

    this.logger.info({ templateId, updates: Object.keys(updates) }, 'Template updated');

    return updated;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, freelancerUserId: string): Promise<void> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new ProjectError(ProjectErrorCode.TEMPLATE_NOT_FOUND);
    }

    if (template.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    await this.templateRepository.delete(templateId);

    this.logger.info({ templateId }, 'Template deleted');
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(
    templateId: string,
    freelancerUserId: string,
    name?: string
  ): Promise<ProjectTemplate> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new ProjectError(ProjectErrorCode.TEMPLATE_NOT_FOUND);
    }

    if (template.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    const duplicate = await this.templateRepository.create({
      freelancerUserId,
      name: name || `${template.name} (Copy)`,
      description: template.description ?? undefined,
      category: template.category ?? undefined,
      projectType: template.projectType,
      budgetType: template.budgetType,
      defaultHourlyRate: template.defaultHourlyRate
        ? Number(template.defaultHourlyRate)
        : undefined,
      estimatedHours: template.estimatedHours ? Number(template.estimatedHours) : undefined,
      taskStructure: (template.taskStructure as unknown as TemplateTask[]) ?? [],
      milestoneStructure: (template.milestoneStructure as unknown as TemplateMilestone[]) ?? null,
      tags: template.tags || undefined,
    });

    this.logger.info({ templateId, duplicateId: duplicate.id }, 'Template duplicated');

    return duplicate;
  }

  /**
   * Get template categories
   */
  async getCategories(freelancerUserId: string): Promise<string[]> {
    const templates = await this.templateRepository.findByFreelancer(freelancerUserId);
    const categories = new Set<string>();
    templates.forEach((t) => {
      if (t.category) categories.add(t.category);
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }
}

