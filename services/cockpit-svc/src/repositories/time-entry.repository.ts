// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/time-entry
 * Time Entry data access layer
 */

import type { TimeEntryFilters, TimeEntrySource } from '../types/project.types.js';
import type { Prisma, PrismaClient, CockpitTimeEntry } from '@skillancer/database';

export class TimeEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new time entry
   */
  async create(data: {
    freelancerUserId: string;
    projectId?: string | null;
    taskId?: string | null;
    clientId?: string | null;
    description?: string | null;
    date: Date;
    startTime?: Date | null;
    endTime?: Date | null;
    durationMinutes: number;
    isBillable?: boolean;
    hourlyRate?: number | null;
    amount?: number | null;
    source?: TimeEntrySource;
  }): Promise<CockpitTimeEntry> {
    return this.prisma.cockpitTimeEntry.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        projectId: data.projectId ?? null,
        taskId: data.taskId ?? null,
        clientId: data.clientId ?? null,
        description: data.description ?? null,
        date: data.date,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMinutes: data.durationMinutes,
        isBillable: data.isBillable ?? true,
        hourlyRate: data.hourlyRate ?? null,
        amount: data.amount ?? null,
        source: data.source ?? 'COCKPIT',
      },
    });
  }

  /**
   * Find a time entry by ID
   */
  async findById(id: string): Promise<CockpitTimeEntry | null> {
    return this.prisma.cockpitTimeEntry.findUnique({
      where: { id },
    });
  }

  /**
   * Find a time entry by ID with project
   */
  async findByIdWithProject(id: string) {
    return this.prisma.cockpitTimeEntry.findUnique({
      where: { id },
      include: {
        project: true,
        task: true,
      },
    });
  }

  /**
   * Find time entries by filters
   */
  async findByFilters(params: TimeEntryFilters): Promise<{
    entries: CockpitTimeEntry[];
    total: number;
  }> {
    const where: Prisma.CockpitTimeEntryWhereInput = {
      project: {
        freelancerUserId: params.freelancerUserId,
      },
    };

    if (params.projectId) {
      where.projectId = params.projectId;
    }

    if (params.taskId) {
      where.taskId = params.taskId;
    }

    if (params.dateFrom || params.dateTo) {
      where.date = {};
      if (params.dateFrom) {
        where.date.gte = params.dateFrom;
      }
      if (params.dateTo) {
        where.date.lte = params.dateTo;
      }
    }

    if (params.isBillable !== undefined) {
      where.isBillable = params.isBillable;
    }

    if (params.isInvoiced !== undefined) {
      where.isInvoiced = params.isInvoiced;
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.cockpitTimeEntry.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.cockpitTimeEntry.count({ where }),
    ]);

    return { entries: entries as CockpitTimeEntry[], total };
  }

  /**
   * Find time entries by project
   */
  async findByProject(projectId: string): Promise<CockpitTimeEntry[]> {
    return this.prisma.cockpitTimeEntry.findMany({
      where: { projectId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Find time entries by task
   */
  async findByTask(taskId: string): Promise<CockpitTimeEntry[]> {
    return this.prisma.cockpitTimeEntry.findMany({
      where: { taskId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Update a time entry
   */
  async update(
    id: string,
    data: Partial<{
      taskId: string | null;
      description: string | null;
      date: Date;
      startTime: Date | null;
      endTime: Date | null;
      durationMinutes: number;
      isBillable: boolean;
      hourlyRate: number | null;
      amount: number | null;
      invoiceId: string | null;
      isInvoiced: boolean;
      timerStartedAt: Date | null;
      timerPausedAt: Date | null;
    }>
  ): Promise<CockpitTimeEntry> {
    const updateData: Prisma.CockpitTimeEntryUpdateInput = {};

    if (data.taskId !== undefined) {
      updateData.task = data.taskId ? { connect: { id: data.taskId } } : { disconnect: true };
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
    if (data.isBillable !== undefined) updateData.isBillable = data.isBillable;
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.invoiceId !== undefined) updateData.invoiceId = data.invoiceId;
    if (data.isInvoiced !== undefined) updateData.isInvoiced = data.isInvoiced;
    if (data.timerStartedAt !== undefined) updateData.timerStartedAt = data.timerStartedAt;
    if (data.timerPausedAt !== undefined) updateData.timerPausedAt = data.timerPausedAt;

    return this.prisma.cockpitTimeEntry.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a time entry
   */
  async delete(id: string): Promise<void> {
    await this.prisma.cockpitTimeEntry.delete({
      where: { id },
    });
  }

  /**
   * Get running timer for a project
   */
  async findRunningTimer(projectId: string): Promise<CockpitTimeEntry | null> {
    return this.prisma.cockpitTimeEntry.findFirst({
      where: {
        projectId,
        timerStartedAt: { not: null },
        timerPausedAt: null,
        endTime: null,
      },
    });
  }

  /**
   * Get running timers for a freelancer
   */
  async findRunningTimers(freelancerUserId: string): Promise<CockpitTimeEntry[]> {
    return this.prisma.cockpitTimeEntry.findMany({
      where: {
        freelancerUserId,
        timerStartedAt: { not: null },
        timerPausedAt: null,
        endTime: null,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Get total tracked hours for a project
   */
  async getTotalMinutes(projectId: string): Promise<number> {
    const result = await this.prisma.cockpitTimeEntry.aggregate({
      where: { projectId },
      _sum: {
        durationMinutes: true,
      },
    });

    return result._sum.durationMinutes ?? 0;
  }

  /**
   * Get total billable hours for a project
   */
  async getBillableMinutes(projectId: string): Promise<number> {
    const result = await this.prisma.cockpitTimeEntry.aggregate({
      where: {
        projectId,
        isBillable: true,
      },
      _sum: {
        durationMinutes: true,
      },
    });

    return result._sum.durationMinutes ?? 0;
  }

  /**
   * Get time entries for a date range
   */
  async findByDateRange(
    freelancerUserId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CockpitTimeEntry[]> {
    return this.prisma.cockpitTimeEntry.findMany({
      where: {
        project: {
          freelancerUserId,
        },
        date: {
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
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }
}

