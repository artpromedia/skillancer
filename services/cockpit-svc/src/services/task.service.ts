// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/services/task
 * Task Service - Task management functionality
 */

import { ProjectError, ProjectErrorCode } from '../errors/project.errors.js';
import { ProjectRepository, TaskRepository, ActivityRepository } from '../repositories/index.js';

import type {
  CreateTaskParams,
  UpdateTaskParams,
  TaskOrder,
  TaskStatus,
} from '../types/project.types.js';
import type { PrismaClient, ProjectTask } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

export class TaskService {
  private readonly projectRepository: ProjectRepository;
  private readonly taskRepository: TaskRepository;
  private readonly activityRepository: ActivityRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.projectRepository = new ProjectRepository(prisma);
    this.taskRepository = new TaskRepository(prisma);
    this.activityRepository = new ActivityRepository(prisma);
  }

  /**
   * Create a new task
   */
  async createTask(params: CreateTaskParams): Promise<ProjectTask> {
    // Verify project ownership
    const project = await this.projectRepository.findById(params.projectId);
    if (!project || project.freelancerUserId !== params.freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    // Validate parent task if provided
    if (params.parentTaskId) {
      const parentTask = await this.taskRepository.findById(params.parentTaskId);
      if (!parentTask || parentTask.projectId !== params.projectId) {
        throw new ProjectError(ProjectErrorCode.TASK_NOT_FOUND);
      }
    }

    // Validate milestone if provided
    if (params.milestoneId) {
      const milestone = await this.prisma.projectMilestone.findFirst({
        where: { id: params.milestoneId, projectId: params.projectId },
      });
      if (!milestone) {
        throw new ProjectError(ProjectErrorCode.MILESTONE_NOT_FOUND);
      }
    }

    // Get order index
    const orderIndex = await this.taskRepository.getNextOrderIndex(
      params.projectId,
      params.parentTaskId
    );

    const task = await this.taskRepository.create({
      projectId: params.projectId,
      title: params.title,
      description: params.description,
      parentTaskId: params.parentTaskId,
      orderIndex,
      status: params.status || 'TODO',
      priority: params.priority || 'MEDIUM',
      startDate: params.startDate,
      dueDate: params.dueDate,
      estimatedMinutes: params.estimatedMinutes || 0,
      milestoneId: params.milestoneId,
      tags: params.tags || [],
      isRecurring: params.isRecurring || false,
      recurrenceRule: params.recurrenceRule,
    });

    // Log activity
    await this.activityRepository.create({
      projectId: params.projectId,
      activityType: 'TASK_CREATED',
      description: `Task "${params.title}" created`,
      taskId: task.id,
    });

    // Update project progress
    await this.updateProjectProgress(params.projectId);

    this.logger.info({ taskId: task.id, projectId: params.projectId }, 'Task created');

    return task;
  }

  /**
   * Get task by ID
   */
  async getTaskById(taskId: string, freelancerUserId: string) {
    const task = await this.taskRepository.findByIdWithProject(taskId);
    if (!task) {
      throw new ProjectError(ProjectErrorCode.TASK_NOT_FOUND);
    }

    if (task.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    return task;
  }

  /**
   * Get tasks by project
   */
  async getTasksByProject(
    projectId: string,
    freelancerUserId: string,
    options?: {
      status?: TaskStatus[];
      milestoneId?: string;
      parentTaskId?: string | null;
    }
  ): Promise<ProjectTask[]> {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    return this.taskRepository.findByProject(projectId, {
      status: options?.status,
      milestoneId: options?.milestoneId,
      parentTaskId: options?.parentTaskId,
    });
  }

  /**
   * Update a task
   */
  async updateTask(
    taskId: string,
    freelancerUserId: string,
    updates: UpdateTaskParams
  ): Promise<ProjectTask> {
    const task = await this.taskRepository.findByIdWithProject(taskId);
    if (!task) {
      throw new ProjectError(ProjectErrorCode.TASK_NOT_FOUND);
    }

    if (task.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    const oldStatus = task.status;
    const updateData: UpdateTaskParams & { completedAt?: Date | null } = { ...updates };

    // Handle completion
    if (updates.status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (updates.status && updates.status !== 'COMPLETED' && task.completedAt) {
      updateData.completedAt = null;
    }

    const updatedTask = await this.taskRepository.update(taskId, updateData);

    // Log completion
    if (updates.status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
      await this.activityRepository.create({
        projectId: task.projectId,
        activityType: 'TASK_COMPLETED',
        description: `Task "${task.title}" completed`,
        taskId: task.id,
      });
    } else if (updates.status && updates.status !== oldStatus) {
      await this.activityRepository.create({
        projectId: task.projectId,
        activityType: 'TASK_UPDATED',
        description: `Task "${task.title}" status changed to ${updates.status}`,
        taskId: task.id,
        metadata: { oldStatus, newStatus: updates.status },
      });
    }

    // Update project progress
    await this.updateProjectProgress(task.projectId);

    this.logger.info({ taskId, updates: Object.keys(updates) }, 'Task updated');

    return updatedTask;
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, freelancerUserId: string): Promise<ProjectTask> {
    return this.updateTask(taskId, freelancerUserId, { status: 'COMPLETED' });
  }

  /**
   * Reopen a task
   */
  async reopenTask(taskId: string, freelancerUserId: string): Promise<ProjectTask> {
    return this.updateTask(taskId, freelancerUserId, { status: 'TODO' });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string, freelancerUserId: string): Promise<void> {
    const task = await this.taskRepository.findByIdWithProject(taskId);
    if (!task) {
      throw new ProjectError(ProjectErrorCode.TASK_NOT_FOUND);
    }

    if (task.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    await this.taskRepository.delete(taskId);

    // Log activity
    await this.activityRepository.create({
      projectId: task.projectId,
      activityType: 'TASK_DELETED',
      description: `Task "${task.title}" deleted`,
    });

    // Update project progress
    await this.updateProjectProgress(task.projectId);

    this.logger.info({ taskId, projectId: task.projectId }, 'Task deleted');
  }

  /**
   * Reorder tasks
   */
  async reorderTasks(
    projectId: string,
    freelancerUserId: string,
    taskOrders: TaskOrder[]
  ): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    // Validate all tasks belong to this project
    for (const order of taskOrders) {
      const task = await this.taskRepository.findById(order.taskId);
      if (task?.projectId !== projectId) {
        throw new ProjectError(ProjectErrorCode.TASK_NOT_FOUND);
      }

      // Check for circular references
      if (order.parentTaskId) {
        if (order.parentTaskId === order.taskId) {
          throw new ProjectError(ProjectErrorCode.CIRCULAR_TASK_REFERENCE);
        }
        // Check if new parent is a descendant of this task
        if (await this.isDescendant(order.taskId, order.parentTaskId)) {
          throw new ProjectError(ProjectErrorCode.CIRCULAR_TASK_REFERENCE);
        }
      }
    }

    await this.taskRepository.updateOrders(taskOrders);

    this.logger.info({ projectId, taskCount: taskOrders.length }, 'Tasks reordered');
  }

  /**
   * Get overdue tasks for a freelancer
   */
  async getOverdueTasks(freelancerUserId: string): Promise<ProjectTask[]> {
    return this.taskRepository.findOverdue(freelancerUserId);
  }

  /**
   * Add time to a task
   */
  async addTrackedTime(
    taskId: string,
    freelancerUserId: string,
    minutes: number
  ): Promise<ProjectTask> {
    const task = await this.taskRepository.findByIdWithProject(taskId);
    if (!task) {
      throw new ProjectError(ProjectErrorCode.TASK_NOT_FOUND);
    }

    if (task.project.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    return this.taskRepository.addTrackedMinutes(taskId, minutes);
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  private async updateProjectProgress(projectId: string): Promise<void> {
    const taskStats = await this.taskRepository.getStats(projectId);

    let progress = 0;
    if (taskStats.total > 0) {
      progress = Math.round((taskStats.completed / taskStats.total) * 100);
    }

    await this.projectRepository.update(projectId, {
      progressPercent: progress,
    });
  }

  private async isDescendant(taskId: string, potentialDescendantId: string): Promise<boolean> {
    const task = await this.taskRepository.findById(potentialDescendantId);
    if (!task) return false;

    if (task.parentTaskId === taskId) return true;

    if (task.parentTaskId) {
      return this.isDescendant(taskId, task.parentTaskId);
    }

    return false;
  }
}
