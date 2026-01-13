/**
 * @module @skillancer/cockpit-svc/services/project
 * Project Service - Core project management functionality
 */

import { ProjectError, ProjectErrorCode } from '../errors/project.errors.js';
import {
  ProjectRepository,
  TaskRepository,
  MilestoneRepository,
  TimeEntryRepository,
  ActivityRepository,
  TemplateRepository,
  ClientRepository,
} from '../repositories/index.js';

import type {
  CreateProjectParams,
  UpdateProjectParams,
  ProjectFilters,
  ProjectWithMetrics,
  ProjectWithDetails,
  Deadline,
  TaskWithSubtasks,
  TimeSummary,
  FinancialSummary,
  TemplateTask,
  TemplateMilestone,
  ProjectStats,
  ProjectStatus,
} from '../types/project.types.js';
import type { PrismaClient } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';
import type { Redis } from 'ioredis';

// Cache TTL
const _PROJECT_CACHE_TTL = 300; // 5 minutes (unused for now)
const STATS_CACHE_TTL = 60; // 1 minute

export class ProjectService {
  private readonly projectRepository: ProjectRepository;
  private readonly taskRepository: TaskRepository;
  private readonly milestoneRepository: MilestoneRepository;
  private readonly timeEntryRepository: TimeEntryRepository;
  private readonly activityRepository: ActivityRepository;
  private readonly templateRepository: TemplateRepository;
  private readonly clientRepository: ClientRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly logger: Logger
  ) {
    this.projectRepository = new ProjectRepository(prisma);
    this.taskRepository = new TaskRepository(prisma);
    this.milestoneRepository = new MilestoneRepository(prisma);
    this.timeEntryRepository = new TimeEntryRepository(prisma);
    this.activityRepository = new ActivityRepository(prisma);
    this.templateRepository = new TemplateRepository(prisma);
    this.clientRepository = new ClientRepository(prisma);
  }

  /**
   * Create a new project
   */
  async createProject(params: CreateProjectParams) {
    // Validate client if provided
    if (params.clientId) {
      const client = await this.clientRepository.findById(params.clientId);
      if (!client || client.freelancerUserId !== params.freelancerUserId) {
        throw new ProjectError(ProjectErrorCode.CLIENT_NOT_FOUND);
      }
    }

    // Create project
    const project = await this.projectRepository.create({
      freelancerUserId: params.freelancerUserId,
      clientId: params.clientId,
      source: 'MANUAL',
      name: params.name,
      description: params.description,
      projectType: params.projectType || 'CLIENT_WORK',
      category: params.category,
      tags: params.tags || [],
      status: params.status || 'NOT_STARTED',
      priority: params.priority || 'MEDIUM',
      startDate: params.startDate,
      dueDate: params.dueDate,
      budgetType: params.budgetType,
      budgetAmount: params.budgetAmount,
      hourlyRate: params.hourlyRate,
      currency: params.currency || 'USD',
      estimatedHours: params.estimatedHours,
      color: params.color,
      notes: params.notes,
    });

    // Apply template if provided
    if (params.templateId) {
      await this.applyTemplate(project.id, params.templateId);
    }

    // Log activity
    await this.activityRepository.create({
      projectId: project.id,
      activityType: 'PROJECT_CREATED',
      description: `Project "${params.name}" created`,
    });

    // Update client metrics
    if (params.clientId) {
      await this.updateClientProjectMetrics(params.clientId);
    }

    this.logger.info(
      {
        projectId: project.id,
        freelancerUserId: params.freelancerUserId,
        clientId: params.clientId,
      },
      'Project created'
    );

    return project;
  }

  /**
   * Get projects by filters with metrics
   */
  async getProjects(params: ProjectFilters): Promise<{
    projects: ProjectWithMetrics[];
    total: number;
  }> {
    const { projects, total } = await this.projectRepository.findByFilters(params);

    // Enrich with metrics
    const enriched = await Promise.all(
      projects.map(async (project) => {
        const taskStats = await this.taskRepository.getStats(project.id);
        const upcomingDeadlines = await this.getUpcomingDeadlines(project.id, 7);

        // Get client display name
        let clientData: { id: string; displayName: string } | null = null;
        if (project.clientId) {
          const client = await this.clientRepository.findById(project.clientId);
          if (client) {
            clientData = {
              id: client.id,
              displayName:
                client.companyName ||
                [client.firstName, client.lastName].filter(Boolean).join(' ') ||
                client.email ||
                'Unknown Client',
            };
          }
        }

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          source: project.source,
          projectType: project.projectType,
          status: project.status,
          priority: project.priority,
          progressPercent: project.progressPercent,
          startDate: project.startDate,
          dueDate: project.dueDate,
          trackedHours: Number(project.trackedHours),
          estimatedHours: project.estimatedHours ? Number(project.estimatedHours) : null,
          totalBilled: Number(project.totalBilled),
          isArchived: project.isArchived,
          isFavorite: project.isFavorite,
          color: project.color,
          tags: project.tags,
          createdAt: project.createdAt,
          client: clientData,
          taskStats,
          upcomingDeadlines,
          isOverdue: Boolean(
            project.dueDate && new Date() > project.dueDate && project.status !== 'COMPLETED'
          ),
        };
      })
    );

    return { projects: enriched, total };
  }

  /**
   * Get project by ID with full details
   */
  async getProjectById(projectId: string, freelancerUserId: string): Promise<ProjectWithDetails> {
    const project = await this.projectRepository.findByIdWithDetails(projectId);
    if (!project) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    if (project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    // Get tasks
    const tasks = await this.taskRepository.findByProject(projectId);

    // Get milestones with progress
    const milestones = await this.milestoneRepository.findByProjectWithProgress(projectId);

    // Get recent activity
    const recentActivity = await this.activityRepository.getRecent(projectId, 20);

    // Get task stats
    const taskStats = await this.taskRepository.getStats(projectId);

    // Get time summary
    const timeSummary = await this.getTimeSummary(projectId);

    // Get financial summary
    const financialSummary = this.calculateFinancialSummary(project);

    // Build client data
    let clientData: ProjectWithDetails['client'] = null;
    if (project.client) {
      clientData = {
        id: project.client.id,
        displayName:
          project.client.companyName ||
          [project.client.firstName, project.client.lastName].filter(Boolean).join(' ') ||
          'Unknown Client',
        email: project.client.email,
        companyName: project.client.companyName,
      };
    }

    return {
      id: project.id,
      freelancerUserId: project.freelancerUserId,
      clientId: project.clientId,
      source: project.source,
      marketContractId: project.marketContractId,
      externalId: project.externalId,
      externalPlatform: project.externalPlatform,
      externalUrl: project.externalUrl,
      name: project.name,
      description: project.description,
      projectType: project.projectType,
      category: project.category,
      tags: project.tags,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      dueDate: project.dueDate,
      completedAt: project.completedAt,
      budgetType: project.budgetType,
      budgetAmount: project.budgetAmount ? Number(project.budgetAmount) : null,
      hourlyRate: project.hourlyRate ? Number(project.hourlyRate) : null,
      currency: project.currency,
      progressPercent: project.progressPercent,
      estimatedHours: project.estimatedHours ? Number(project.estimatedHours) : null,
      trackedHours: Number(project.trackedHours),
      billableHours: Number(project.billableHours),
      totalBilled: Number(project.totalBilled),
      totalPaid: Number(project.totalPaid),
      isArchived: project.isArchived,
      isFavorite: project.isFavorite,
      color: project.color,
      notes: project.notes,
      customFields: project.customFields as Record<string, unknown> | null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      client: clientData,
      tasks: this.buildTaskHierarchy(tasks),
      milestones,
      recentActivity,
      taskStats,
      timeSummary,
      financialSummary,
    };
  }

  /**
   * Update a project
   */
  async updateProject(projectId: string, freelancerUserId: string, updates: UpdateProjectParams) {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    // Validate client if being changed
    if (updates.clientId !== undefined && updates.clientId !== project.clientId) {
      if (updates.clientId) {
        const client = await this.clientRepository.findById(updates.clientId);
        if (client?.freelancerUserId !== freelancerUserId) {
          throw new ProjectError(ProjectErrorCode.CLIENT_NOT_FOUND);
        }
      }
    }

    const oldStatus = project.status;
    const updatedProject = await this.projectRepository.update(projectId, {
      ...updates,
      completedAt:
        updates.status === 'COMPLETED' && oldStatus !== 'COMPLETED'
          ? new Date()
          : updates.completedAt,
    });

    // Log status change
    if (updates.status && updates.status !== oldStatus) {
      await this.activityRepository.create({
        projectId,
        activityType: 'STATUS_CHANGED',
        description: `Status changed from ${oldStatus} to ${updates.status}`,
        metadata: { oldStatus, newStatus: updates.status },
      });
    }

    // Update client metrics if client changed
    if (updates.clientId !== undefined && updates.clientId !== project.clientId) {
      if (project.clientId) {
        await this.updateClientProjectMetrics(project.clientId);
      }
      if (updates.clientId) {
        await this.updateClientProjectMetrics(updates.clientId);
      }
    }

    this.logger.info({ projectId, updates: Object.keys(updates) }, 'Project updated');

    return updatedProject;
  }

  /**
   * Archive a project
   */
  async archiveProject(projectId: string, freelancerUserId: string) {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    await this.projectRepository.update(projectId, { isArchived: true });

    await this.activityRepository.create({
      projectId,
      activityType: 'PROJECT_UPDATED',
      description: 'Project archived',
    });

    if (project.clientId) {
      await this.updateClientProjectMetrics(project.clientId);
    }

    this.logger.info({ projectId }, 'Project archived');
  }

  /**
   * Unarchive a project
   */
  async unarchiveProject(projectId: string, freelancerUserId: string) {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    await this.projectRepository.update(projectId, { isArchived: false });

    await this.activityRepository.create({
      projectId,
      activityType: 'PROJECT_UPDATED',
      description: 'Project unarchived',
    });

    if (project.clientId) {
      await this.updateClientProjectMetrics(project.clientId);
    }

    this.logger.info({ projectId }, 'Project unarchived');
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(projectId: string, freelancerUserId: string) {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    const updatedProject = await this.projectRepository.update(projectId, {
      isFavorite: !project.isFavorite,
    });

    return { isFavorite: updatedProject.isFavorite };
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string, freelancerUserId: string) {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    await this.projectRepository.delete(projectId);

    if (project.clientId) {
      await this.updateClientProjectMetrics(project.clientId);
    }

    this.logger.info({ projectId }, 'Project deleted');
  }

  /**
   * Get project statistics
   */
  async getProjectStats(freelancerUserId: string): Promise<ProjectStats> {
    const cacheKey = `project:stats:${freelancerUserId}`;

    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ProjectStats;
    }

    const projects = await this.projectRepository.findByFreelancer(freelancerUserId);

    const stats: ProjectStats = {
      total: projects.length,
      byStatus: {} as Record<ProjectStatus, number>,
      byType: {},
      totalTrackedHours: 0,
      totalBilled: 0,
      totalPaid: 0,
      activeProjects: 0,
      overdueProjects: 0,
      completedThisMonth: 0,
    };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const project of projects) {
      // Count by status
      stats.byStatus[project.status] = (stats.byStatus[project.status] || 0) + 1;

      // Count by type
      stats.byType[project.projectType] = (stats.byType[project.projectType] || 0) + 1;

      // Sum financials
      stats.totalTrackedHours += Number(project.trackedHours || 0);
      stats.totalBilled += Number(project.totalBilled || 0);
      stats.totalPaid += Number(project.totalPaid || 0);

      // Active count
      if (['NOT_STARTED', 'IN_PROGRESS'].includes(project.status)) {
        stats.activeProjects++;
      }

      // Overdue count
      if (project.dueDate && now > project.dueDate && project.status !== 'COMPLETED') {
        stats.overdueProjects++;
      }

      // Completed this month
      if (project.completedAt && project.completedAt >= startOfMonth) {
        stats.completedThisMonth++;
      }
    }

    // Cache the result
    await this.redis.setex(cacheKey, STATS_CACHE_TTL, JSON.stringify(stats));

    return stats;
  }

  /**
   * Update project progress based on task completion
   */
  async updateProgress(projectId: string): Promise<void> {
    const taskStats = await this.taskRepository.getStats(projectId);

    let progress = 0;
    if (taskStats.total > 0) {
      progress = Math.round((taskStats.completed / taskStats.total) * 100);
    }

    await this.projectRepository.update(projectId, {
      progressPercent: progress,
    });
  }

  /**
   * Update project time tracking totals
   */
  async updateTimeTracking(projectId: string): Promise<void> {
    const totalMinutes = await this.timeEntryRepository.getTotalMinutes(projectId);
    const billableMinutes = await this.timeEntryRepository.getBillableMinutes(projectId);

    await this.projectRepository.update(projectId, {
      trackedHours: Math.round((totalMinutes / 60) * 100) / 100,
      billableHours: Math.round((billableMinutes / 60) * 100) / 100,
    });
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  private async getUpcomingDeadlines(projectId: string, days: number): Promise<Deadline[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const tasks = await this.taskRepository.findByProject(projectId, {
      dueDateBefore: endDate,
      status: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'],
    });

    const milestones = await this.milestoneRepository.findByProject(projectId, {
      dueDateBefore: endDate,
      status: ['PENDING', 'IN_PROGRESS'],
    });

    const deadlines: Deadline[] = [
      ...tasks
        .filter((t): t is typeof t & { dueDate: Date } => t.dueDate !== null)
        .map((t) => ({
          type: 'TASK' as const,
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
        })),
      ...milestones
        .filter((m): m is typeof m & { dueDate: Date } => m.dueDate !== null)
        .map((m) => ({
          type: 'MILESTONE' as const,
          id: m.id,
          title: m.title,
          dueDate: m.dueDate,
        })),
    ];

    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  private async getTimeSummary(projectId: string): Promise<TimeSummary> {
    const entries = await this.timeEntryRepository.findByProject(projectId);

    const totalMinutes = entries.reduce((sum, te) => sum + te.durationMinutes, 0);
    const billableMinutes = entries
      .filter((te) => te.isBillable)
      .reduce((sum, te) => sum + te.durationMinutes, 0);

    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const thisWeekMinutes = entries
      .filter((te) => te.date >= thisWeekStart)
      .reduce((sum, te) => sum + te.durationMinutes, 0);

    return {
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      billableHours: Math.round((billableMinutes / 60) * 100) / 100,
      thisWeekHours: Math.round((thisWeekMinutes / 60) * 100) / 100,
      billablePercentage: totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0,
    };
  }

  private calculateFinancialSummary(project: {
    budgetType: string | null;
    budgetAmount: unknown;
    hourlyRate: unknown;
    totalBilled: unknown;
    totalPaid: unknown;
    estimatedHours: unknown;
  }): FinancialSummary {
    const totalBilled = Number(project.totalBilled || 0);
    const totalPaid = Number(project.totalPaid || 0);
    const budgetAmount = Number(project.budgetAmount || 0);
    const hourlyRate = project.hourlyRate ? Number(project.hourlyRate) : undefined;
    const estimatedHours = Number(project.estimatedHours || 0);

    let projectedTotal = totalBilled;
    if (project.budgetType === 'FIXED') {
      projectedTotal = budgetAmount;
    } else if (project.budgetType === 'HOURLY' && hourlyRate && estimatedHours) {
      projectedTotal = estimatedHours * hourlyRate;
    }

    return {
      budgetType: project.budgetType as FinancialSummary['budgetType'],
      budgetAmount,
      hourlyRate,
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid,
      budgetUsed: budgetAmount > 0 ? Math.round((totalBilled / budgetAmount) * 100) : 0,
      budgetRemaining: budgetAmount - totalBilled,
      projectedTotal,
    };
  }

  private buildTaskHierarchy(
    tasks: Array<{
      id: string;
      projectId: string;
      title: string;
      description: string | null;
      parentTaskId: string | null;
      orderIndex: number;
      status: string;
      priority: string;
      startDate: Date | null;
      dueDate: Date | null;
      completedAt: Date | null;
      estimatedMinutes: number;
      trackedMinutes: number;
      milestoneId: string | null;
      tags: string[];
      isRecurring: boolean;
      recurrenceRule: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  ): TaskWithSubtasks[] {
    const taskMap = new Map<string, TaskWithSubtasks>();
    const rootTasks: TaskWithSubtasks[] = [];

    // First pass: create map
    for (const task of tasks) {
      taskMap.set(task.id, {
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        parentTaskId: task.parentTaskId,
        orderIndex: task.orderIndex,
        status: task.status as TaskWithSubtasks['status'],
        priority: task.priority as TaskWithSubtasks['priority'],
        startDate: task.startDate,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        estimatedMinutes: task.estimatedMinutes,
        trackedMinutes: task.trackedMinutes,
        milestoneId: task.milestoneId,
        tags: task.tags,
        isRecurring: task.isRecurring,
        recurrenceRule: task.recurrenceRule,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        subtasks: [],
      });
    }

    // Second pass: build hierarchy
    for (const task of tasks) {
      const taskWithSubs = taskMap.get(task.id);
      if (!taskWithSubs) continue;

      if (task.parentTaskId) {
        const parent = taskMap.get(task.parentTaskId);
        if (parent) {
          parent.subtasks.push(taskWithSubs);
        }
      } else {
        rootTasks.push(taskWithSubs);
      }
    }

    // Sort by order index
    const sortByOrder = (a: TaskWithSubtasks, b: TaskWithSubtasks) => a.orderIndex - b.orderIndex;
    rootTasks.sort(sortByOrder);
    for (const task of taskMap.values()) {
      task.subtasks.sort(sortByOrder);
    }

    return rootTasks;
  }

  private async applyTemplate(projectId: string, templateId: string): Promise<void> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) return;

    // Create tasks from template
    const templateTasks = (template.taskStructure as unknown as TemplateTask[]) ?? [];
    for (const templateTask of templateTasks) {
      const task = await this.taskRepository.create({
        projectId,
        title: templateTask.title,
        description: templateTask.description,
        estimatedMinutes: templateTask.estimatedMinutes || 0,
        orderIndex: templateTask.orderIndex || 0,
        status: 'TODO',
        priority: 'MEDIUM',
      });

      // Create subtasks
      if (templateTask.subtasks) {
        for (let i = 0; i < templateTask.subtasks.length; i++) {
          const subtask = templateTask.subtasks[i];
          if (!subtask) continue;

          await this.taskRepository.create({
            projectId,
            parentTaskId: task.id,
            title: subtask.title,
            description: subtask.description,
            estimatedMinutes: subtask.estimatedMinutes || 0,
            orderIndex: i,
            status: 'TODO',
            priority: 'MEDIUM',
          });
        }
      }
    }

    // Create milestones from template
    const templateMilestones =
      (template.milestoneStructure as unknown as TemplateMilestone[]) ?? [];
    if (templateMilestones) {
      for (const tm of templateMilestones) {
        const deliverables = tm.deliverables?.map((d, i) => ({
          ...d,
          completed: false,
          orderIndex: i,
        }));

        await this.milestoneRepository.create({
          projectId,
          title: tm.title,
          description: tm.description,
          deliverables,
          orderIndex: tm.orderIndex || 0,
          status: 'PENDING',
        });
      }
    }

    // Increment template use count
    await this.templateRepository.incrementUseCount(templateId);
  }

  private async updateClientProjectMetrics(clientId: string): Promise<void> {
    // Get all projects for this client
    const { projects } = await this.projectRepository.findByFilters({
      freelancerUserId: '', // Not used when clientId is provided
      clientId,
      isArchived: false,
    });

    const activeProjects = projects.filter((p) =>
      ['NOT_STARTED', 'IN_PROGRESS'].includes(p.status)
    ).length;

    // Update client
    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        totalProjects: projects.length,
        activeProjects,
        lastProjectAt: projects.length > 0 ? new Date() : null,
      },
    });
  }
}
