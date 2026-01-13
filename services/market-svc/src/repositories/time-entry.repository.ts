/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/time-entry
 * Time Entry V2 data access layer
 */

import { Prisma } from '../types/prisma-shim.js';

import type {
  CreateTimeEntryInput,
  UpdateTimeEntryInput,
  TimeEntryListOptions,
  TimeEntryWithDetails,
  TimeEntrySummary,
} from '../types/contract.types.js';
import type { PrismaClient, TimeEntryStatusV2 } from '../types/prisma-shim.js';

/**
 * Time Entry Repository
 *
 * Handles database operations for time entries V2.
 */
export class TimeEntryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly defaultInclude = {
    contract: {
      select: {
        id: true,
        title: true,
        contractNumber: true,
        hourlyRate: true,
        clientUserId: true,
      },
    },
    freelancer: {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    },
  };

  /**
   * Create a time entry
   */
  async create(data: CreateTimeEntryInput) {
    // Get hourly rate from contract
    const contract = await this.prisma.contractV2.findUnique({
      where: { id: data.contractId },
      select: { hourlyRate: true },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const hourlyRate = data.hourlyRate || Number(contract.hourlyRate || 0);
    const hours = data.durationMinutes / 60;
    const amount = hours * hourlyRate;

    return this.prisma.timeEntryV2.create({
      data: {
        contractId: data.contractId,
        freelancerUserId: data.freelancerUserId,
        date: data.date,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMinutes: data.durationMinutes,
        description: data.description,
        taskCategory: data.taskCategory ?? null,
        evidenceType: data.evidenceType ?? null,
        screenshots: (data.evidence || []) as unknown as Prisma.InputJsonValue,
        skillpodSessionId: data.skillpodSessionId ?? null,
        autoTracked: data.autoTracked ?? false,
        hourlyRate: new Prisma.Decimal(hourlyRate),
        amount: new Prisma.Decimal(amount),
        currency: data.currency ?? 'USD',
        status: 'PENDING',
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Find time entry by ID
   */
  async findById(id: string): Promise<TimeEntryWithDetails | null> {
    return this.prisma.timeEntryV2.findUnique({
      where: { id },
      include: this.defaultInclude,
    }) as Promise<TimeEntryWithDetails | null>;
  }

  /**
   * Update time entry
   */
  async update(id: string, data: UpdateTimeEntryInput) {
    const updateData: Prisma.TimeEntryV2UpdateInput = {
      updatedAt: new Date(),
    };

    // Get current entry and contract for rate calculation
    const currentEntry = await this.prisma.timeEntryV2.findUnique({
      where: { id },
      include: { contract: { select: { hourlyRate: true } } },
    });

    if (!currentEntry) {
      throw new Error('Time entry not found');
    }

    if (data.durationMinutes !== undefined) {
      updateData.durationMinutes = data.durationMinutes;
      const hourlyRate = Number(currentEntry.hourlyRate);
      const hours = data.durationMinutes / 60;
      updateData.amount = new Prisma.Decimal(hours * hourlyRate);
    }
    if (data.date !== undefined) updateData.date = data.date;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.taskCategory !== undefined) updateData.taskCategory = data.taskCategory;
    if (data.evidence !== undefined) {
      updateData.screenshots = data.evidence as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.timeEntryV2.update({
      where: { id },
      data: updateData,
      include: this.defaultInclude,
    });
  }

  /**
   * Update time entry status
   */
  async updateStatus(
    id: string,
    status: TimeEntryStatusV2,
    additionalData?: Partial<{
      approvedAt: Date;
      rejectedAt: Date;
      rejectionReason: string;
      paidAt: Date;
      invoiceId: string;
      invoicedAt: Date;
    }>
  ) {
    return this.prisma.timeEntryV2.update({
      where: { id },
      data: {
        status,
        ...additionalData,
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Approve time entry
   */
  async approve(id: string) {
    return this.prisma.timeEntryV2.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Reject time entry
   */
  async reject(id: string, rejectionReason: string) {
    return this.prisma.timeEntryV2.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectionReason,
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Bulk approve time entries
   */
  async bulkApprove(ids: string[]) {
    return this.prisma.timeEntryV2.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark time entries as paid
   */
  async markPaid(ids: string[], invoiceId: string) {
    return this.prisma.timeEntryV2.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'PAID',
        invoiceId,
        invoicedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Delete time entry
   */
  async delete(id: string) {
    return this.prisma.timeEntryV2.delete({
      where: { id },
    });
  }

  /**
   * List time entries with filters
   */
  async list(options: TimeEntryListOptions): Promise<{
    data: TimeEntryWithDetails[];
    total: number;
  }> {
    const {
      contractId,
      freelancerId,
      status,
      dateFrom,
      dateTo,
      invoiced,
      page = 1,
      limit = 50,
    } = options;

    const where: Prisma.TimeEntryV2WhereInput = {};

    if (contractId) where.contractId = contractId;
    if (freelancerId) where.freelancerUserId = freelancerId;

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = dateFrom;
      if (dateTo) where.date.lte = dateTo;
    }

    // Filter by invoiced status
    if (invoiced !== undefined) {
      where.invoiceId = invoiced ? { not: null } : null;
    }

    const [data, total] = await Promise.all([
      this.prisma.timeEntryV2.findMany({
        where,
        include: this.defaultInclude,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timeEntryV2.count({ where }),
    ]);

    return { data: data as TimeEntryWithDetails[], total };
  }

  /**
   * Get time entry summary for a contract
   */
  async getSummary(contractId: string): Promise<TimeEntrySummary> {
    const entries = await this.prisma.timeEntryV2.findMany({
      where: { contractId },
      select: {
        date: true,
        durationMinutes: true,
        amount: true,
        status: true,
      },
      orderBy: { date: 'asc' },
    });

    const summary: TimeEntrySummary = {
      totalMinutes: 0,
      totalAmount: 0,
      entriesCount: entries.length,
      approvedMinutes: 0,
      pendingMinutes: 0,
    };

    for (const entry of entries) {
      const minutes = entry.durationMinutes;
      const amount = Number(entry.amount);

      summary.totalMinutes += minutes;
      summary.totalAmount += amount;

      switch (entry.status) {
        case 'APPROVED':
        case 'PAID':
          summary.approvedMinutes += minutes;
          break;
        case 'PENDING':
          summary.pendingMinutes += minutes;
          break;
      }
    }

    return summary;
  }

  /**
   * Get unbilled time entries for a contract
   */
  async getUnbilled(contractId: string) {
    return this.prisma.timeEntryV2.findMany({
      where: {
        contractId,
        status: 'APPROVED',
        invoiceId: null,
      },
      include: this.defaultInclude,
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Get pending time entries for approval
   */
  async getPendingApproval(contractId: string) {
    return this.prisma.timeEntryV2.findMany({
      where: {
        contractId,
        status: 'PENDING',
      },
      include: this.defaultInclude,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Check for duplicate time entry
   */
  async checkDuplicate(contractId: string, freelancerUserId: string, date: Date): Promise<boolean> {
    const existing = await this.prisma.timeEntryV2.findFirst({
      where: {
        contractId,
        freelancerUserId,
        date: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    return existing !== null;
  }

  /**
   * Get total minutes logged in a period
   */
  async getTotalMinutesInPeriod(
    contractId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await this.prisma.timeEntryV2.aggregate({
      where: {
        contractId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ['PENDING', 'APPROVED', 'PAID'] },
      },
      _sum: {
        durationMinutes: true,
      },
    });

    return result._sum?.durationMinutes ?? 0;
  }

  /**
   * Helper: Get start of week for a date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
