// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/timesheet
 * Timesheet data access layer
 */

import type { PrismaClient, Timesheet, Prisma } from '../types/prisma-shim.js';

/** Timesheet status type alias */
type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export class TimesheetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find timesheet by ID
   */
  async findById(id: string): Promise<Timesheet | null> {
    return this.prisma.timesheet.findUnique({
      where: { id },
    });
  }

  /**
   * Find timesheet by user and week start date
   */
  async findByUserAndWeek(userId: string, weekStartDate: Date): Promise<Timesheet | null> {
    // Normalize to date only (no time)
    const dateOnly = new Date(weekStartDate);
    dateOnly.setHours(0, 0, 0, 0);

    return this.prisma.timesheet.findUnique({
      where: {
        freelancerUserId_weekStartDate: {
          freelancerUserId: userId,
          weekStartDate: dateOnly,
        },
      },
    });
  }

  /**
   * Create timesheet
   */
  async create(data: {
    freelancerUserId: string;
    weekStartDate: Date;
    weekEndDate: Date;
    totalMinutes: number;
    billableMinutes: number;
    totalAmount: number;
    status?: TimesheetStatus;
    notes?: string;
  }): Promise<Timesheet> {
    // Normalize dates
    const weekStart = new Date(data.weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(data.weekEndDate);
    weekEnd.setHours(0, 0, 0, 0);

    return this.prisma.timesheet.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        totalMinutes: data.totalMinutes,
        billableMinutes: data.billableMinutes,
        totalAmount: data.totalAmount,
        status: data.status ?? 'DRAFT',
        notes: data.notes ?? null,
      },
    });
  }

  /**
   * Update timesheet
   */
  async update(
    id: string,
    data: Partial<{
      totalMinutes: number;
      billableMinutes: number;
      totalAmount: number;
      status: TimesheetStatus;
      submittedAt: Date | null;
      approvedAt: Date | null;
      approvedBy: string | null;
      rejectedAt: Date | null;
      rejectionReason: string | null;
      isLocked: boolean;
      lockedAt: Date | null;
      notes: string | null;
    }>
  ): Promise<Timesheet> {
    const updateData: Prisma.TimesheetUpdateInput = {};

    if (data.totalMinutes !== undefined) updateData.totalMinutes = data.totalMinutes;
    if (data.billableMinutes !== undefined) updateData.billableMinutes = data.billableMinutes;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.submittedAt !== undefined) updateData.submittedAt = data.submittedAt;
    if (data.approvedAt !== undefined) updateData.approvedAt = data.approvedAt;
    if (data.approvedBy !== undefined) updateData.approvedBy = data.approvedBy;
    if (data.rejectedAt !== undefined) updateData.rejectedAt = data.rejectedAt;
    if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason;
    if (data.isLocked !== undefined) updateData.isLocked = data.isLocked;
    if (data.lockedAt !== undefined) updateData.lockedAt = data.lockedAt;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return this.prisma.timesheet.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Find timesheets by user with pagination
   */
  async findByUser(
    userId: string,
    params?: {
      status?: TimesheetStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<{ timesheets: Timesheet[]; total: number }> {
    const where: Prisma.TimesheetWhereInput = {
      freelancerUserId: userId,
    };

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.startDate || params?.endDate) {
      where.weekStartDate = {};
      if (params.startDate) {
        where.weekStartDate.gte = params.startDate;
      }
      if (params.endDate) {
        where.weekStartDate.lte = params.endDate;
      }
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const skip = (page - 1) * limit;

    const [timesheets, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        orderBy: { weekStartDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.timesheet.count({ where }),
    ]);

    return { timesheets, total };
  }

  /**
   * Find pending timesheets for approval
   */
  async findPendingApproval(): Promise<Timesheet[]> {
    return this.prisma.timesheet.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { submittedAt: 'asc' },
    });
  }

  /**
   * Find timesheets that should be auto-generated
   */
  async findMissingTimesheets(userId: string, startDate: Date, endDate: Date): Promise<Date[]> {
    const existingTimesheets = await this.prisma.timesheet.findMany({
      where: {
        freelancerUserId: userId,
        weekStartDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { weekStartDate: true },
    });

    const existingDates = new Set(
      existingTimesheets.map((t) => t.weekStartDate.toISOString().split('T')[0])
    );

    const missingDates: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      if (!existingDates.has(dateStr)) {
        missingDates.push(new Date(current));
      }
      current.setDate(current.getDate() + 7); // Move to next week
    }

    return missingDates;
  }

  /**
   * Get or create timesheet for a week
   */
  async getOrCreate(data: {
    freelancerUserId: string;
    weekStartDate: Date;
    weekEndDate: Date;
    totalMinutes: number;
    billableMinutes: number;
    totalAmount: number;
  }): Promise<Timesheet> {
    const existing = await this.findByUserAndWeek(data.freelancerUserId, data.weekStartDate);

    if (existing) {
      return this.update(existing.id, {
        totalMinutes: data.totalMinutes,
        billableMinutes: data.billableMinutes,
        totalAmount: data.totalAmount,
      });
    }

    return this.create(data);
  }
}
