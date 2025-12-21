/**
 * @module @skillancer/cockpit-svc/services/workload
 * Workload Service - Capacity planning and workload management
 */

import { ProjectRepository, TaskRepository, TimeEntryRepository } from '../repositories/index.js';

import type { WorkloadView, DailyWorkload, CapacitySettings } from '../types/project.types.js';
import type { PrismaClient, CockpitProject, ProjectTask } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

// Default capacity settings
const DEFAULT_CAPACITY: CapacitySettings = {
  hoursPerDay: 8,
  workDays: [1, 2, 3, 4, 5], // Mon-Fri
  bufferPercent: 20, // 20% buffer for context switching
};

export class WorkloadService {
  private readonly projectRepository: ProjectRepository;
  private readonly taskRepository: TaskRepository;
  private readonly timeEntryRepository: TimeEntryRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.projectRepository = new ProjectRepository(prisma);
    this.taskRepository = new TaskRepository(prisma);
    this.timeEntryRepository = new TimeEntryRepository(prisma);
  }

  /**
   * Get workload view for a date range
   */
  async getWorkload(
    freelancerUserId: string,
    startDate: Date,
    endDate: Date,
    capacity?: Partial<CapacitySettings>
  ): Promise<WorkloadView> {
    const settings = { ...DEFAULT_CAPACITY, ...capacity };

    // Get active projects
    const projects = await this.prisma.cockpitProject.findMany({
      where: {
        freelancerUserId,
        status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD'] },
        OR: [
          { dueDate: { gte: startDate, lte: endDate } },
          { startDate: { gte: startDate, lte: endDate } },
          {
            AND: [
              { startDate: { lte: startDate } },
              { OR: [{ dueDate: { gte: endDate } }, { dueDate: null }] },
            ],
          },
        ],
      },
      include: {
        tasks: {
          where: {
            status: { in: ['TODO', 'IN_PROGRESS'] },
          },
        },
        client: { select: { companyName: true } },
      },
    });

    // Get time entries for the date range
    const { entries: timeEntries } = await this.timeEntryRepository.findByFilters({
      freelancerUserId,
      dateFrom: startDate,
      dateTo: endDate,
    });

    // Calculate daily workload
    const entriesWithProjects = timeEntries.filter(
      (e): e is typeof e & { projectId: string } => e.projectId !== null
    );
    type ProjectWithDetails = CockpitProject & {
      tasks: ProjectTask[];
      client: { companyName: string } | null;
    };
    const dailyWorkload = this.calculateDailyWorkload(
      startDate,
      endDate,
      projects as ProjectWithDetails[],
      entriesWithProjects,
      settings
    );

    // Calculate total capacity for the period
    const workDays = this.countWorkDays(startDate, endDate, settings.workDays);
    const effectiveHoursPerDay = settings.hoursPerDay * (1 - settings.bufferPercent / 100);
    const totalCapacityMinutes = workDays * effectiveHoursPerDay * 60;

    // Calculate committed minutes
    const committedMinutes = projects.reduce((acc, project) => {
      return acc + this.getProjectWorkloadMinutes(project, startDate, endDate);
    }, 0);

    // Calculate logged minutes in period
    const loggedMinutes = timeEntries.reduce((acc, entry) => acc + (entry.durationMinutes || 0), 0);

    const utilizationPercent =
      totalCapacityMinutes > 0 ? Math.round((committedMinutes / totalCapacityMinutes) * 100) : 0;

    // Build project summaries
    const projectSummaries = projects.map((project) => ({
      projectId: project.id,
      projectName: project.name,
      clientName: project.client?.companyName ?? undefined,
      deadline: project.dueDate,
      remainingMinutes: this.getRemainingMinutes(project),
      priority: project.priority,
      status: project.status,
    }));

    return {
      startDate,
      endDate,
      dailyWorkload,
      totalCapacityMinutes,
      committedMinutes,
      loggedMinutes,
      availableMinutes: Math.max(0, totalCapacityMinutes - committedMinutes),
      utilizationPercent,
      isOverbooked: committedMinutes > totalCapacityMinutes,
      projects: projectSummaries,
    };
  }

  /**
   * Get availability for a specific date
   */
  async getAvailability(
    freelancerUserId: string,
    date: Date,
    capacity?: Partial<CapacitySettings>
  ): Promise<DailyWorkload> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const workload = await this.getWorkload(freelancerUserId, startOfDay, endOfDay, capacity);

    return (
      workload.dailyWorkload[0] || {
        date: startOfDay,
        capacityMinutes: 0,
        scheduledMinutes: 0,
        loggedMinutes: 0,
        availableMinutes: 0,
        isWorkDay: false,
        projects: [],
      }
    );
  }

  /**
   * Find next available slots with enough capacity
   */
  async findAvailableSlots(
    freelancerUserId: string,
    requiredMinutes: number,
    startDate: Date,
    maxDaysToSearch: number = 30,
    capacity?: Partial<CapacitySettings>
  ): Promise<Array<{ date: Date; availableMinutes: number }>> {
    const slots: Array<{ date: Date; availableMinutes: number }> = [];

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + maxDaysToSearch);

    const workload = await this.getWorkload(freelancerUserId, startDate, endDate, capacity);

    for (const day of workload.dailyWorkload) {
      if (day.isWorkDay && day.availableMinutes >= requiredMinutes) {
        slots.push({
          date: day.date,
          availableMinutes: day.availableMinutes,
        });
      }
    }

    return slots;
  }

  /**
   * Calculate if a new project can fit
   */
  async canFitProject(
    freelancerUserId: string,
    estimatedMinutes: number,
    startDate: Date,
    deadline: Date,
    capacity?: Partial<CapacitySettings>
  ): Promise<{
    canFit: boolean;
    utilizationWithProject: number;
    currentUtilization: number;
    recommendation?: string;
  }> {
    const workload = await this.getWorkload(freelancerUserId, startDate, deadline, capacity);

    const newUtilization =
      workload.totalCapacityMinutes > 0
        ? Math.round(
            ((workload.committedMinutes + estimatedMinutes) / workload.totalCapacityMinutes) * 100
          )
        : 100;

    let recommendation: string | undefined;
    if (newUtilization > 100) {
      recommendation = `This project would push utilization to ${newUtilization}%. Consider extending the deadline or reducing scope.`;
    } else if (newUtilization > 85) {
      recommendation = `Utilization would be ${newUtilization}%. Proceed with caution and build in buffer time.`;
    }

    return {
      canFit: newUtilization <= 100,
      utilizationWithProject: newUtilization,
      currentUtilization: workload.utilizationPercent,
      recommendation,
    };
  }

  /**
   * Get weekly workload summary
   */
  async getWeeklySummary(
    freelancerUserId: string,
    weekStart: Date,
    capacity?: Partial<CapacitySettings>
  ): Promise<{
    weekStart: Date;
    weekEnd: Date;
    dailyBreakdown: DailyWorkload[];
    totalCapacityMinutes: number;
    totalScheduledMinutes: number;
    totalLoggedMinutes: number;
    averageUtilization: number;
  }> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const workload = await this.getWorkload(freelancerUserId, weekStart, weekEnd, capacity);

    const _workDays = workload.dailyWorkload.filter((d) => d.isWorkDay);
    const totalScheduled = workload.dailyWorkload.reduce((acc, d) => acc + d.scheduledMinutes, 0);

    return {
      weekStart,
      weekEnd,
      dailyBreakdown: workload.dailyWorkload,
      totalCapacityMinutes: workload.totalCapacityMinutes,
      totalScheduledMinutes: totalScheduled,
      totalLoggedMinutes: workload.loggedMinutes,
      averageUtilization: workload.utilizationPercent,
    };
  }

  /**
   * Calculate daily workload breakdown
   */
  private calculateDailyWorkload(
    startDate: Date,
    endDate: Date,
    projects: Array<
      CockpitProject & { tasks: ProjectTask[]; client: { companyName: string } | null }
    >,
    timeEntries: Array<{
      startTime: Date | null;
      durationMinutes: number | null;
      projectId: string;
    }>,
    settings: CapacitySettings
  ): DailyWorkload[] {
    const days: DailyWorkload[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const isWorkDay = settings.workDays.includes(dayOfWeek);
      const capacityMinutes = isWorkDay
        ? settings.hoursPerDay * 60 * (1 - settings.bufferPercent / 100)
        : 0;

      // Calculate logged time for this day
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      const loggedMinutes = timeEntries
        .filter((e) => {
          if (!e.startTime) return false;
          const entryDate = new Date(e.startTime);
          return entryDate >= dayStart && entryDate <= dayEnd;
        })
        .reduce((acc, e) => acc + (e.durationMinutes || 0), 0);

      // Calculate scheduled minutes from project tasks
      const dailyProjects: Array<{
        projectId: string;
        projectName: string;
        scheduledMinutes: number;
      }> = [];

      let scheduledMinutes = 0;
      for (const project of projects) {
        const projectMinutes = this.getProjectDailyMinutes(project, current, settings);
        if (projectMinutes > 0) {
          scheduledMinutes += projectMinutes;
          dailyProjects.push({
            projectId: project.id,
            projectName: project.name,
            scheduledMinutes: projectMinutes,
          });
        }
      }

      days.push({
        date: new Date(current),
        capacityMinutes,
        scheduledMinutes,
        loggedMinutes,
        availableMinutes: Math.max(0, capacityMinutes - scheduledMinutes),
        isWorkDay,
        projects: dailyProjects,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  /**
   * Calculate remaining work minutes for a project
   */
  private getRemainingMinutes(project: CockpitProject & { tasks: ProjectTask[] }): number {
    // Sum remaining estimates from incomplete tasks
    const taskRemaining = project.tasks
      .filter((t) => t.status !== 'COMPLETED')
      .reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);

    // Or use project-level estimates if no task-level
    if (taskRemaining === 0 && project.estimatedHours) {
      const totalEstimated = Number(project.estimatedHours) * 60;
      const progress = project.progressPercent || 0;
      return totalEstimated * (1 - progress / 100);
    }

    return taskRemaining;
  }

  /**
   * Calculate workload minutes for a project within a date range
   */
  private getProjectWorkloadMinutes(
    project: CockpitProject & { tasks: ProjectTask[] },
    startDate: Date,
    endDate: Date
  ): number {
    const remaining = this.getRemainingMinutes(project);
    if (remaining === 0) return 0;

    // Calculate what portion of the project falls within the date range
    const projectStart = project.startDate || new Date();
    const projectEnd = project.dueDate || endDate;

    const overlapStart = Math.max(startDate.getTime(), projectStart.getTime());
    const overlapEnd = Math.min(endDate.getTime(), projectEnd.getTime());

    if (overlapEnd < overlapStart) return 0;

    const totalDays = Math.max(
      1,
      Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));

    return Math.round((remaining * overlapDays) / totalDays);
  }

  /**
   * Calculate daily minutes for a project
   */
  private getProjectDailyMinutes(
    project: CockpitProject & { tasks: ProjectTask[] },
    date: Date,
    settings: CapacitySettings
  ): number {
    const projectStart = project.startDate || new Date();
    const projectEnd = project.dueDate;

    // Check if date is within project bounds
    if (date < projectStart || (projectEnd && date > projectEnd)) {
      return 0;
    }

    const remaining = this.getRemainingMinutes(project);
    if (remaining === 0) return 0;

    // Calculate remaining work days until deadline
    const today = new Date();
    const deadline = projectEnd || new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const workDays = this.countWorkDays(today, deadline, settings.workDays);

    if (workDays === 0) return remaining; // All remaining work on this day

    return Math.round(remaining / workDays);
  }

  /**
   * Count work days in a range
   */
  private countWorkDays(startDate: Date, endDate: Date, workDays: number[]): number {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      if (workDays.includes(current.getDay())) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }
}
