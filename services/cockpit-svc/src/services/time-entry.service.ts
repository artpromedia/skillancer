// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/services/time-entry
 * Time Entry Service - Time tracking functionality
 */

import { ProjectError, ProjectErrorCode } from '../errors/project.errors.js';
import {
  ProjectRepository,
  TaskRepository,
  TimeEntryRepository,
  ActivityRepository,
} from '../repositories/index.js';

import type {
  CreateTimeEntryParams,
  UpdateTimeEntryParams,
  TimeEntryFilters,
  TimeStats,
} from '../types/project.types.js';
import type { PrismaClient, CockpitTimeEntry } from '../types/prisma-shim.js';
import type { Logger } from '@skillancer/logger';

export class TimeEntryService {
  private readonly projectRepository: ProjectRepository;
  private readonly taskRepository: TaskRepository;
  private readonly timeEntryRepository: TimeEntryRepository;
  private readonly activityRepository: ActivityRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.projectRepository = new ProjectRepository(prisma);
    this.taskRepository = new TaskRepository(prisma);
    this.timeEntryRepository = new TimeEntryRepository(prisma);
    this.activityRepository = new ActivityRepository(prisma);
  }

  /**
   * Create a time entry
   */
  async createTimeEntry(params: CreateTimeEntryParams): Promise<CockpitTimeEntry> {
    // Verify project ownership
    const project = await this.projectRepository.findById(params.projectId);
    if (!project || project.freelancerUserId !== params.freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    // Verify task belongs to project if provided
    if (params.taskId) {
      const task = await this.taskRepository.findById(params.taskId);
      if (!task || task.projectId !== params.projectId) {
        throw new ProjectError(ProjectErrorCode.TASK_NOT_FOUND);
      }
    }

    // Calculate duration from start/end if not provided
    let durationMinutes = params.durationMinutes ?? 0;
    if (!params.durationMinutes && params.startTime && params.endTime) {
      const diffMs = params.endTime.getTime() - params.startTime.getTime();
      durationMinutes = Math.round(diffMs / 60000);
    }

    const timeEntry = await this.timeEntryRepository.create({
      freelancerUserId: params.freelancerUserId,
      projectId: params.projectId,
      taskId: params.taskId,
      description: params.description,
      date: params.date ?? params.startTime ?? new Date(),
      startTime: params.startTime,
      endTime: params.endTime,
      durationMinutes,
      isBillable: params.isBillable ?? true,
      source: params.source || 'MANUAL',
    });

    // Update project time stats
    await this.updateProjectTimeStats(params.projectId);

    // Log activity
    const hours = durationMinutes ? (durationMinutes / 60).toFixed(1) : '0';
    const descSuffix = params.description ? `: ${params.description}` : '';
    await this.activityRepository.create({
      projectId: params.projectId,
      activityType: 'TIME_LOGGED',
      description: `${hours}h logged${descSuffix}`,
      taskId: params.taskId,
    });

    this.logger.info(
      { timeEntryId: timeEntry.id, projectId: params.projectId, durationMinutes },
      'Time entry created'
    );

    return timeEntry;
  }

  /**
   * Start a timer (create running time entry)
   */
  async startTimer(params: {
    projectId: string;
    freelancerUserId: string;
    taskId?: string;
    description?: string;
  }): Promise<CockpitTimeEntry> {
    // Verify project ownership
    const project = await this.projectRepository.findById(params.projectId);
    if (!project || project.freelancerUserId !== params.freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    // Check for existing running timer
    const existing = await this.timeEntryRepository.findRunningTimer(params.projectId);
    if (existing) {
      throw new ProjectError(ProjectErrorCode.TIMER_ALREADY_RUNNING);
    }

    // Verify task belongs to project if provided
    if (params.taskId) {
      const task = await this.taskRepository.findById(params.taskId);
      if (!task || task.projectId !== params.projectId) {
        throw new ProjectError(ProjectErrorCode.TASK_NOT_FOUND);
      }
    }

    const now = new Date();
    const timeEntry = await this.timeEntryRepository.create({
      freelancerUserId: params.freelancerUserId,
      projectId: params.projectId,
      taskId: params.taskId,
      description: params.description,
      date: now,
      startTime: now,
      durationMinutes: 0, // Will be calculated when timer stops
      isBillable: true,
      source: 'TIMER',
    });

    this.logger.info({ timeEntryId: timeEntry.id, projectId: params.projectId }, 'Timer started');

    return timeEntry;
  }

  /**
   * Stop a running timer
   */
  async stopTimer(projectId: string, freelancerUserId: string): Promise<CockpitTimeEntry> {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    const runningTimer = await this.timeEntryRepository.findRunningTimer(projectId);
    if (!runningTimer?.startTime) {
      throw new ProjectError(ProjectErrorCode.NO_ACTIVE_TIMER);
    }

    const endTime = new Date();
    const durationMinutes = Math.round(
      (endTime.getTime() - runningTimer.startTime.getTime()) / 60000
    );

    const stoppedEntry = await this.timeEntryRepository.update(runningTimer.id, {
      endTime,
      durationMinutes,
    });

    // Update project time stats
    await this.updateProjectTimeStats(projectId);

    // Log activity
    const hours = (durationMinutes / 60).toFixed(1);
    const descSuffix = runningTimer.description ? `: ${runningTimer.description}` : '';
    await this.activityRepository.create({
      projectId,
      activityType: 'TIME_LOGGED',
      description: `${hours}h logged via timer${descSuffix}`,
      taskId: runningTimer.taskId,
    });

    this.logger.info({ timeEntryId: runningTimer.id, durationMinutes }, 'Timer stopped');

    return stoppedEntry;
  }

  /**
   * Get running timer for a project
   */
  async getRunningTimer(
    projectId: string,
    freelancerUserId: string
  ): Promise<CockpitTimeEntry | null> {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    return this.timeEntryRepository.findRunningTimer(projectId);
  }

  /**
   * Get time entry by ID
   */
  async getTimeEntryById(timeEntryId: string, freelancerUserId: string): Promise<CockpitTimeEntry> {
    const timeEntry = await this.timeEntryRepository.findById(timeEntryId);
    if (!timeEntry) {
      throw new ProjectError(ProjectErrorCode.TIME_ENTRY_NOT_FOUND);
    }

    if (!timeEntry.projectId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    const project = await this.projectRepository.findById(timeEntry.projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    return timeEntry;
  }

  /**
   * Get time entries with filters
   */
  async getTimeEntries(
    freelancerUserId: string,
    filters: Omit<TimeEntryFilters, 'freelancerUserId'>
  ): Promise<{ entries: CockpitTimeEntry[]; total: number }> {
    // If projectId is provided, verify ownership
    if (filters.projectId) {
      const project = await this.projectRepository.findById(filters.projectId);
      if (project?.freelancerUserId !== freelancerUserId) {
        throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
      }
    }

    return this.timeEntryRepository.findByFilters({
      ...filters,
      freelancerUserId,
    });
  }

  /**
   * Update a time entry
   */
  async updateTimeEntry(
    timeEntryId: string,
    freelancerUserId: string,
    updates: UpdateTimeEntryParams
  ): Promise<CockpitTimeEntry> {
    const timeEntry = await this.timeEntryRepository.findById(timeEntryId);
    if (!timeEntry) {
      throw new ProjectError(ProjectErrorCode.TIME_ENTRY_NOT_FOUND);
    }

    if (!timeEntry.projectId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    const project = await this.projectRepository.findById(timeEntry.projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    // Recalculate duration if times changed
    const updateData: UpdateTimeEntryParams & { durationMinutes?: number } = { ...updates };
    const startTime = updates.startTime ?? timeEntry.startTime;
    const endTime = updates.endTime ?? timeEntry.endTime;
    if (startTime && endTime && !updates.durationMinutes) {
      updateData.durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    }

    const updated = await this.timeEntryRepository.update(timeEntryId, updateData);

    // Update project time stats
    if (timeEntry.projectId) {
      await this.updateProjectTimeStats(timeEntry.projectId);
    }

    this.logger.info({ timeEntryId, updates: Object.keys(updates) }, 'Time entry updated');

    return updated;
  }

  /**
   * Delete a time entry
   */
  async deleteTimeEntry(timeEntryId: string, freelancerUserId: string): Promise<void> {
    const timeEntry = await this.timeEntryRepository.findById(timeEntryId);
    if (!timeEntry) {
      throw new ProjectError(ProjectErrorCode.TIME_ENTRY_NOT_FOUND);
    }

    if (!timeEntry.projectId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    const project = await this.projectRepository.findById(timeEntry.projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.ACCESS_DENIED);
    }

    await this.timeEntryRepository.delete(timeEntryId);

    // Update project time stats
    await this.updateProjectTimeStats(timeEntry.projectId);

    this.logger.info({ timeEntryId, projectId: timeEntry.projectId }, 'Time entry deleted');
  }

  /**
   * Get time statistics for a project
   */
  async getProjectTimeStats(projectId: string, freelancerUserId: string): Promise<TimeStats> {
    const project = await this.projectRepository.findById(projectId);
    if (project?.freelancerUserId !== freelancerUserId) {
      throw new ProjectError(ProjectErrorCode.PROJECT_NOT_FOUND);
    }

    const [totalMinutes, billableMinutes] = await Promise.all([
      this.timeEntryRepository.getTotalMinutes(projectId),
      this.timeEntryRepository.getBillableMinutes(projectId),
    ]);

    // Calculate estimated time from tasks
    const tasks = await this.taskRepository.findByProject(projectId);
    const estimatedMinutes = tasks.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

    return {
      totalMinutes,
      billableMinutes,
      nonBillableMinutes: totalMinutes - billableMinutes,
      estimatedMinutes,
      remainingMinutes: Math.max(0, estimatedMinutes - totalMinutes),
      utilizationPercent:
        estimatedMinutes > 0 ? Math.round((totalMinutes / estimatedMinutes) * 100) : 0,
    };
  }

  /**
   * Get time entries by date range across all projects
   */
  async getTimeEntriesByDateRange(
    freelancerUserId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ entries: CockpitTimeEntry[]; total: number }> {
    return this.timeEntryRepository.findByFilters({
      freelancerUserId,
      dateFrom: startDate,
      dateTo: endDate,
    });
  }

  /**
   * Update project time tracking stats
   */
  private async updateProjectTimeStats(projectId: string): Promise<void> {
    const [totalMinutes, billableMinutes] = await Promise.all([
      this.timeEntryRepository.getTotalMinutes(projectId),
      this.timeEntryRepository.getBillableMinutes(projectId),
    ]);

    await this.projectRepository.update(projectId, {
      trackedHours: totalMinutes / 60,
      billableHours: billableMinutes / 60,
    });
  }
}
