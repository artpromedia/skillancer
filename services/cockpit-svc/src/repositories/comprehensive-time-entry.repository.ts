/**
 * @module @skillancer/cockpit-svc/repositories/comprehensive-time-entry
 * Comprehensive Time Entry data access layer for the new time tracking system
 */

import type { TimeEntryFilters, TimeEntryWithDetails } from '../types/time-tracking.types.js';
import type { Prisma, PrismaClient, CockpitTimeEntry } from '@skillancer/database';

export class ComprehensiveTimeEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new time entry
   */
  async create(data: {
    freelancerUserId: string;
    projectId?: string | null;
    taskId?: string | null;
    clientId?: string | null;
    marketContractId?: string | null;
    marketTimeEntryId?: string | null;
    date: Date;
    startTime?: Date | null;
    endTime?: Date | null;
    durationMinutes: number;
    description?: string | null;
    category?: string | null;
    tags?: string[];
    isBillable?: boolean;
    hourlyRate?: number | null;
    amount?: number | null;
    currency?: string;
    trackingMethod?: 'TIMER' | 'MANUAL' | 'CALENDAR' | 'SKILLPOD' | 'IMPORTED';
    source?: 'COCKPIT' | 'MARKET' | 'SKILLPOD' | 'CALENDAR' | 'IMPORT' | 'MANUAL' | 'TIMER';
    hasEvidence?: boolean;
    evidenceType?:
      | 'SCREENSHOT'
      | 'SCREEN_RECORDING'
      | 'SKILLPOD_SESSION'
      | 'MANUAL_LOG'
      | 'ACTIVITY_LOG'
      | null;
    evidenceUrl?: string | null;
    activityLevel?: number | null;
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    syncedToMarket?: boolean;
    syncedAt?: Date | null;
  }): Promise<CockpitTimeEntry> {
    return this.prisma.cockpitTimeEntry.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        projectId: data.projectId ?? null,
        taskId: data.taskId ?? null,
        clientId: data.clientId ?? null,
        marketContractId: data.marketContractId ?? null,
        marketTimeEntryId: data.marketTimeEntryId ?? null,
        date: data.date,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMinutes: data.durationMinutes,
        description: data.description ?? null,
        category: data.category ?? null,
        tags: data.tags ?? [],
        isBillable: data.isBillable ?? true,
        hourlyRate: data.hourlyRate ?? null,
        amount: data.amount ?? null,
        currency: data.currency ?? 'USD',
        trackingMethod: data.trackingMethod ?? 'MANUAL',
        source: data.source ?? 'COCKPIT',
        hasEvidence: data.hasEvidence ?? false,
        evidenceType: data.evidenceType ?? null,
        evidenceUrl: data.evidenceUrl ?? null,
        activityLevel: data.activityLevel ?? null,
        approvalStatus: data.approvalStatus ?? null,
        syncedToMarket: data.syncedToMarket ?? false,
        syncedAt: data.syncedAt ?? null,
      },
    });
  }

  /**
   * Find time entry by ID
   */
  async findById(id: string): Promise<CockpitTimeEntry | null> {
    return this.prisma.cockpitTimeEntry.findUnique({
      where: { id },
    });
  }

  /**
   * Find time entry by ID with details
   */
  async findByIdWithDetails(id: string): Promise<TimeEntryWithDetails | null> {
    const entry = await this.prisma.cockpitTimeEntry.findUnique({
      where: { id },
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
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });

    return entry as TimeEntryWithDetails | null;
  }

  /**
   * Find time entry by market entry ID
   */
  async findByMarketEntryId(marketTimeEntryId: string): Promise<CockpitTimeEntry | null> {
    return this.prisma.cockpitTimeEntry.findUnique({
      where: { marketTimeEntryId },
    });
  }

  /**
   * Find time entries by filters
   */
  async findByFilters(params: TimeEntryFilters): Promise<{
    entries: TimeEntryWithDetails[];
    total: number;
  }> {
    const where: Prisma.CockpitTimeEntryWhereInput = {
      freelancerUserId: params.freelancerUserId,
    };

    if (params.projectId) {
      where.projectId = params.projectId;
    }

    if (params.taskId) {
      where.taskId = params.taskId;
    }

    if (params.clientId) {
      where.clientId = params.clientId;
    }

    if (params.startDate || params.endDate) {
      where.date = {};
      if (params.startDate) {
        where.date.gte = params.startDate;
      }
      if (params.endDate) {
        where.date.lte = params.endDate;
      }
    }

    if (params.isBillable !== undefined) {
      where.isBillable = params.isBillable;
    }

    if (params.isInvoiced !== undefined) {
      where.isInvoiced = params.isInvoiced;
    }

    if (params.category) {
      where.category = params.category;
    }

    if (params.tags && params.tags.length > 0) {
      where.tags = { hasSome: params.tags };
    }

    if (params.source) {
      where.source = params.source as any;
    }

    if (params.search) {
      where.description = { contains: params.search, mode: 'insensitive' };
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
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.cockpitTimeEntry.count({ where }),
    ]);

    return { entries: entries as TimeEntryWithDetails[], total };
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
   * Find time entries by client
   */
  async findByClient(clientId: string): Promise<CockpitTimeEntry[]> {
    return this.prisma.cockpitTimeEntry.findMany({
      where: { clientId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Find time entries by date range
   */
  async findByDateRange(
    freelancerUserId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TimeEntryWithDetails[]> {
    const entries = await this.prisma.cockpitTimeEntry.findMany({
      where: {
        freelancerUserId,
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
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return entries as TimeEntryWithDetails[];
  }

  /**
   * Update a time entry
   */
  async update(
    id: string,
    data: Partial<{
      projectId: string | null;
      taskId: string | null;
      clientId: string | null;
      marketContractId: string | null;
      marketTimeEntryId: string | null;
      date: Date;
      startTime: Date | null;
      endTime: Date | null;
      durationMinutes: number;
      description: string | null;
      category: string | null;
      tags: string[];
      isBillable: boolean;
      hourlyRate: number | null;
      amount: number | null;
      currency: string;
      isInvoiced: boolean;
      invoiceId: string | null;
      invoicedAt: Date | null;
      approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
      approvedAt: Date | null;
      approvedBy: string | null;
      rejectedAt: Date | null;
      rejectionReason: string | null;
      syncedToMarket: boolean;
      syncedAt: Date | null;
      syncError: string | null;
      isLocked: boolean;
      lockedAt: Date | null;
      lockedReason: string | null;
    }>
  ): Promise<CockpitTimeEntry> {
    const updateData: Prisma.CockpitTimeEntryUpdateInput = {};

    if (data.projectId !== undefined) {
      updateData.project = data.projectId
        ? { connect: { id: data.projectId } }
        : { disconnect: true };
    }
    if (data.taskId !== undefined) {
      updateData.task = data.taskId ? { connect: { id: data.taskId } } : { disconnect: true };
    }
    if (data.clientId !== undefined) {
      updateData.client = data.clientId ? { connect: { id: data.clientId } } : { disconnect: true };
    }
    if (data.marketContractId !== undefined) updateData.marketContractId = data.marketContractId;
    if (data.marketTimeEntryId !== undefined) updateData.marketTimeEntryId = data.marketTimeEntryId;
    if (data.date !== undefined) updateData.date = data.date;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isBillable !== undefined) updateData.isBillable = data.isBillable;
    if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.isInvoiced !== undefined) updateData.isInvoiced = data.isInvoiced;
    if (data.invoiceId !== undefined) updateData.invoiceId = data.invoiceId;
    if (data.invoicedAt !== undefined) updateData.invoicedAt = data.invoicedAt;
    if (data.approvalStatus !== undefined) updateData.approvalStatus = data.approvalStatus;
    if (data.approvedAt !== undefined) updateData.approvedAt = data.approvedAt;
    if (data.approvedBy !== undefined) updateData.approvedBy = data.approvedBy;
    if (data.rejectedAt !== undefined) updateData.rejectedAt = data.rejectedAt;
    if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason;
    if (data.syncedToMarket !== undefined) updateData.syncedToMarket = data.syncedToMarket;
    if (data.syncedAt !== undefined) updateData.syncedAt = data.syncedAt;
    if (data.syncError !== undefined) updateData.syncError = data.syncError;
    if (data.isLocked !== undefined) updateData.isLocked = data.isLocked;
    if (data.lockedAt !== undefined) updateData.lockedAt = data.lockedAt;
    if (data.lockedReason !== undefined) updateData.lockedReason = data.lockedReason;

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
   * Bulk update time entries
   */
  async bulkUpdate(
    ids: string[],
    data: Partial<{
      projectId: string | null;
      isBillable: boolean;
      category: string | null;
    }>
  ): Promise<number> {
    const result = await this.prisma.cockpitTimeEntry.updateMany({
      where: { id: { in: ids } },
      data,
    });
    return result.count;
  }

  /**
   * Lock entries by date range
   */
  async lockByDateRange(
    freelancerUserId: string,
    startDate: Date,
    endDate: Date,
    reason?: string
  ): Promise<number> {
    const result = await this.prisma.cockpitTimeEntry.updateMany({
      where: {
        freelancerUserId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        isLocked: false,
      },
      data: {
        isLocked: true,
        lockedAt: new Date(),
        lockedReason: reason ?? 'Timesheet locked',
      },
    });
    return result.count;
  }

  /**
   * Mark entries as invoiced
   */
  async markAsInvoiced(ids: string[], invoiceId: string): Promise<number> {
    const result = await this.prisma.cockpitTimeEntry.updateMany({
      where: { id: { in: ids } },
      data: {
        isInvoiced: true,
        invoiceId,
        invoicedAt: new Date(),
        isLocked: true,
        lockedAt: new Date(),
        lockedReason: 'Invoiced',
      },
    });
    return result.count;
  }

  /**
   * Get aggregate stats for project
   */
  async getProjectStats(projectId: string): Promise<{
    totalMinutes: number;
    billableMinutes: number;
    totalAmount: number;
    entryCount: number;
  }> {
    const [totals, billable, count] = await Promise.all([
      this.prisma.cockpitTimeEntry.aggregate({
        where: { projectId },
        _sum: {
          durationMinutes: true,
          amount: true,
        },
      }),
      this.prisma.cockpitTimeEntry.aggregate({
        where: { projectId, isBillable: true },
        _sum: { durationMinutes: true },
      }),
      this.prisma.cockpitTimeEntry.count({ where: { projectId } }),
    ]);

    return {
      totalMinutes: totals._sum.durationMinutes ?? 0,
      billableMinutes: billable._sum.durationMinutes ?? 0,
      totalAmount: Number(totals._sum.amount ?? 0),
      entryCount: count,
    };
  }

  /**
   * Get uninvoiced billable entries
   */
  async getUninvoicedBillable(
    freelancerUserId: string,
    projectId?: string,
    clientId?: string
  ): Promise<TimeEntryWithDetails[]> {
    const where: Prisma.CockpitTimeEntryWhereInput = {
      freelancerUserId,
      isBillable: true,
      isInvoiced: false,
    };

    if (projectId) where.projectId = projectId;
    if (clientId) where.clientId = clientId;

    const entries = await this.prisma.cockpitTimeEntry.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      },
      orderBy: [{ date: 'asc' }],
    });

    return entries as TimeEntryWithDetails[];
  }

  /**
   * Get entries pending sync
   */
  async getPendingSync(freelancerUserId: string): Promise<CockpitTimeEntry[]> {
    return this.prisma.cockpitTimeEntry.findMany({
      where: {
        freelancerUserId,
        marketContractId: { not: null },
        syncedToMarket: false,
        syncError: null,
      },
    });
  }

  /**
   * Get entries with sync errors
   */
  async getSyncErrors(freelancerUserId: string): Promise<CockpitTimeEntry[]> {
    return this.prisma.cockpitTimeEntry.findMany({
      where: {
        freelancerUserId,
        syncError: { not: null },
      },
    });
  }
}
