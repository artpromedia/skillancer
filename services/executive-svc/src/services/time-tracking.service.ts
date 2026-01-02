/**
 * Executive Time Tracking Service
 *
 * Manages time entries for executive engagements including
 * creation, approval workflow, and reporting.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { ExecutiveTimeCategory } from '@prisma/client';
import type { ExecutiveTimeEntry, TimeEntryStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Types
export interface CreateTimeEntryInput {
  engagementId: string;
  executiveId: string;
  date: Date;
  hours: number;
  description: string;
  category?: ExecutiveTimeCategory;
  billable?: boolean;
  skillpodSessionId?: string;
}

export interface UpdateTimeEntryInput {
  date?: Date;
  hours?: number;
  description?: string;
  category?: ExecutiveTimeCategory;
  billable?: boolean;
}

export interface TimeEntriesFilter {
  startDate?: Date;
  endDate?: Date;
  status?: TimeEntryStatus | TimeEntryStatus[];
  category?: ExecutiveTimeCategory;
  billable?: boolean;
}

export interface TimeSummary {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  pendingHours: number;
  approvedHours: number;
  byCategory: { category: string; hours: number }[];
  byWeek: { weekStart: string; hours: number }[];
  comparedToCommitment: {
    committed: number;
    actual: number;
    variance: number;
    variancePercent: number;
  };
}

export interface WeeklyTimesheet {
  weekStart: Date;
  weekEnd: Date;
  engagements: {
    engagementId: string;
    title: string;
    clientName: string;
    entries: { date: Date; hours: number; description: string; id: string }[];
    totalHours: number;
  }[];
  grandTotal: number;
}

class TimeTrackingService {
  /**
   * Create a time entry
   */
  async createTimeEntry(input: CreateTimeEntryInput): Promise<ExecutiveTimeEntry> {
    const {
      engagementId,
      executiveId,
      date,
      hours,
      description,
      category = ExecutiveTimeCategory.ADVISORY,
      billable = true,
      skillpodSessionId,
    } = input;

    // Validate engagement
    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    if (engagement.status !== 'ACTIVE' && engagement.status !== 'PAUSED') {
      throw new Error('Cannot log time to inactive engagement');
    }

    if (engagement.executiveId !== executiveId) {
      throw new Error('Access denied to this engagement');
    }

    // Validate hours
    if (hours <= 0 || hours > 24) {
      throw new Error('Hours must be between 0 and 24');
    }

    // Check total hours for the day
    const existingEntries = await prisma.executiveTimeEntry.findMany({
      where: {
        executiveId,
        date: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    const totalForDay = existingEntries.reduce((sum, e) => sum + Number(e.hours), 0);

    if (totalForDay + hours > 24) {
      throw new Error('Total hours for the day cannot exceed 24');
    }

    // Create entry
    const entry = await prisma.executiveTimeEntry.create({
      data: {
        engagementId,
        executiveId,
        date,
        hours,
        description,
        category,
        billable,
        skillpodSessionId,
        status: 'PENDING',
      },
    });

    // Update engagement totals
    await prisma.executiveEngagement.update({
      where: { id: engagementId },
      data: {
        totalHoursLogged: { increment: hours },
        lastActivityAt: new Date(),
      },
    });

    logger.info(
      {
        entryId: entry.id,
        engagementId,
        hours,
      },
      'Time entry created'
    );

    return entry;
  }

  /**
   * Update a time entry
   */
  async updateTimeEntry(
    entryId: string,
    executiveId: string,
    updates: UpdateTimeEntryInput
  ): Promise<ExecutiveTimeEntry> {
    const entry = await prisma.executiveTimeEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new Error('Time entry not found');
    }

    if (entry.executiveId !== executiveId) {
      throw new Error('Access denied');
    }

    // Cannot update invoiced entries
    if (entry.status === 'INVOICED') {
      throw new Error('Cannot update invoiced time entries');
    }

    // If approved, reset to pending
    const newStatus = entry.status === 'APPROVED' ? 'PENDING' : entry.status;

    // Calculate hours difference for totals
    const hoursDiff = updates.hours ? updates.hours - Number(entry.hours) : 0;

    const updated = await prisma.executiveTimeEntry.update({
      where: { id: entryId },
      data: {
        ...updates,
        status: newStatus,
      },
    });

    // Update engagement totals if hours changed
    if (hoursDiff !== 0) {
      await prisma.executiveEngagement.update({
        where: { id: entry.engagementId },
        data: {
          totalHoursLogged: { increment: hoursDiff },
        },
      });
    }

    logger.info({ entryId, updates }, 'Time entry updated');

    return updated;
  }

  /**
   * Delete a time entry
   */
  async deleteTimeEntry(entryId: string, executiveId: string): Promise<void> {
    const entry = await prisma.executiveTimeEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new Error('Time entry not found');
    }

    if (entry.executiveId !== executiveId) {
      throw new Error('Access denied');
    }

    if (entry.status === 'INVOICED') {
      throw new Error('Cannot delete invoiced time entries');
    }

    await prisma.executiveTimeEntry.delete({
      where: { id: entryId },
    });

    // Update engagement totals
    await prisma.executiveEngagement.update({
      where: { id: entry.engagementId },
      data: {
        totalHoursLogged: { decrement: Number(entry.hours) },
      },
    });

    logger.info({ entryId }, 'Time entry deleted');
  }

  /**
   * Submit timesheet for approval
   */
  async submitTimesheet(
    engagementId: string,
    executiveId: string,
    entryIds: string[]
  ): Promise<ExecutiveTimeEntry[]> {
    // Verify all entries belong to this executive and engagement
    const entries = await prisma.executiveTimeEntry.findMany({
      where: {
        id: { in: entryIds },
        engagementId,
        executiveId,
      },
    });

    if (entries.length !== entryIds.length) {
      throw new Error('Some entries not found or access denied');
    }

    // Check all are pending
    const nonPending = entries.filter((e) => e.status !== 'PENDING');
    if (nonPending.length > 0) {
      throw new Error('Some entries are not in pending status');
    }

    // Update status to submitted
    const updated = await prisma.executiveTimeEntry.updateMany({
      where: { id: { in: entryIds } },
      data: { status: 'SUBMITTED' },
    });

    logger.info(
      {
        engagementId,
        entryCount: updated.count,
      },
      'Timesheet submitted'
    );

    // Return updated entries
    return prisma.executiveTimeEntry.findMany({
      where: { id: { in: entryIds } },
    });
  }

  /**
   * Approve time entries (client action)
   */
  async approveTimeEntries(
    engagementId: string,
    entryIds: string[],
    approverId: string
  ): Promise<ExecutiveTimeEntry[]> {
    // Verify entries belong to this engagement
    const entries = await prisma.executiveTimeEntry.findMany({
      where: {
        id: { in: entryIds },
        engagementId,
        status: 'SUBMITTED',
      },
    });

    if (entries.length !== entryIds.length) {
      throw new Error('Some entries not found or not in submitted status');
    }

    // Approve all
    await prisma.executiveTimeEntry.updateMany({
      where: { id: { in: entryIds } },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    logger.info(
      {
        engagementId,
        entryCount: entries.length,
        approverId,
      },
      'Time entries approved'
    );

    return prisma.executiveTimeEntry.findMany({
      where: { id: { in: entryIds } },
    });
  }

  /**
   * Reject time entries
   */
  async rejectTimeEntries(
    engagementId: string,
    entryIds: string[],
    approverId: string,
    reason: string
  ): Promise<ExecutiveTimeEntry[]> {
    const entries = await prisma.executiveTimeEntry.findMany({
      where: {
        id: { in: entryIds },
        engagementId,
        status: 'SUBMITTED',
      },
    });

    if (entries.length !== entryIds.length) {
      throw new Error('Some entries not found or not in submitted status');
    }

    await prisma.executiveTimeEntry.updateMany({
      where: { id: { in: entryIds } },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });

    logger.info(
      {
        engagementId,
        entryCount: entries.length,
        reason,
      },
      'Time entries rejected'
    );

    return prisma.executiveTimeEntry.findMany({
      where: { id: { in: entryIds } },
    });
  }

  /**
   * Get time entries for an engagement
   */
  async getTimeEntriesByEngagement(
    engagementId: string,
    filters?: TimeEntriesFilter
  ): Promise<ExecutiveTimeEntry[]> {
    const where: any = { engagementId };

    if (filters?.startDate) {
      where.date = { ...where.date, gte: filters.startDate };
    }
    if (filters?.endDate) {
      where.date = { ...where.date, lte: filters.endDate };
    }
    if (filters?.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }
    if (filters?.category) {
      where.category = filters.category;
    }
    if (typeof filters?.billable === 'boolean') {
      where.billable = filters.billable;
    }

    return prisma.executiveTimeEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get time summary for an engagement
   */
  async getTimeSummary(engagementId: string, startDate: Date, endDate: Date): Promise<TimeSummary> {
    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    const entries = await prisma.executiveTimeEntry.findMany({
      where: {
        engagementId,
        date: { gte: startDate, lte: endDate },
      },
    });

    // Calculate totals
    let totalHours = 0;
    let billableHours = 0;
    let pendingHours = 0;
    let approvedHours = 0;
    const categoryHours: Record<string, number> = {};
    const weekHours: Record<string, number> = {};

    for (const entry of entries) {
      const hours = Number(entry.hours);
      totalHours += hours;

      if (entry.billable) {
        billableHours += hours;
      }

      if (entry.status === 'PENDING' || entry.status === 'SUBMITTED') {
        pendingHours += hours;
      }
      if (entry.status === 'APPROVED' || entry.status === 'INVOICED') {
        approvedHours += hours;
      }

      // By category
      categoryHours[entry.category] = (categoryHours[entry.category] || 0) + hours;

      // By week
      const weekStart = this.getWeekStart(entry.date);
      const weekKey = weekStart.toISOString().split('T')[0];
      weekHours[weekKey] = (weekHours[weekKey] || 0) + hours;
    }

    // Calculate commitment comparison
    const weeksDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const committed = weeksDiff * engagement.hoursPerWeek;
    const variance = totalHours - committed;

    return {
      totalHours,
      billableHours,
      nonBillableHours: totalHours - billableHours,
      pendingHours,
      approvedHours,
      byCategory: Object.entries(categoryHours).map(([category, hours]) => ({
        category,
        hours,
      })),
      byWeek: Object.entries(weekHours)
        .map(([weekStart, hours]) => ({ weekStart, hours }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
      comparedToCommitment: {
        committed,
        actual: totalHours,
        variance,
        variancePercent: committed > 0 ? (variance / committed) * 100 : 0,
      },
    };
  }

  /**
   * Get executive's weekly timesheet
   */
  async getExecutiveTimesheet(executiveId: string, weekOf: Date): Promise<WeeklyTimesheet> {
    const weekStart = this.getWeekStart(weekOf);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Get all active engagements
    const engagements = await prisma.executiveEngagement.findMany({
      where: {
        executiveId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: {
        id: true,
        title: true,
        clientTenantId: true,
      },
    });

    // Get all time entries for the week
    const entries = await prisma.executiveTimeEntry.findMany({
      where: {
        executiveId,
        date: { gte: weekStart, lte: weekEnd },
      },
      orderBy: { date: 'asc' },
    });

    // Group entries by engagement
    const entriesByEngagement: Record<string, ExecutiveTimeEntry[]> = {};
    for (const entry of entries) {
      if (!entriesByEngagement[entry.engagementId]) {
        entriesByEngagement[entry.engagementId] = [];
      }
      entriesByEngagement[entry.engagementId].push(entry);
    }

    // Build timesheet
    const timesheetEngagements = engagements.map((eng) => {
      const engEntries = entriesByEngagement[eng.id] || [];
      const totalHours = engEntries.reduce((sum, e) => sum + Number(e.hours), 0);

      return {
        engagementId: eng.id,
        title: eng.title,
        clientName: eng.clientTenantId, // TODO: Resolve to actual name
        entries: engEntries.map((e) => ({
          id: e.id,
          date: e.date,
          hours: Number(e.hours),
          description: e.description,
        })),
        totalHours,
      };
    });

    const grandTotal = timesheetEngagements.reduce((sum, e) => sum + e.totalHours, 0);

    return {
      weekStart,
      weekEnd,
      engagements: timesheetEngagements,
      grandTotal,
    };
  }

  /**
   * Sync time from SkillPod sessions
   */
  async syncSkillPodTime(
    engagementId: string,
    sessions: { sessionId: string; duration: number; date: Date }[]
  ): Promise<{ created: number; skipped: number }> {
    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    let created = 0;
    let skipped = 0;

    for (const session of sessions) {
      // Check if already synced
      const existing = await prisma.executiveTimeEntry.findFirst({
        where: {
          engagementId,
          skillpodSessionId: session.sessionId,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create time entry from session
      await this.createTimeEntry({
        engagementId,
        executiveId: engagement.executiveId,
        date: session.date,
        hours: session.duration / 60, // Convert minutes to hours
        description: 'SkillPod session (auto-tracked)',
        category: ExecutiveTimeCategory.EXECUTION,
        billable: true,
        skillpodSessionId: session.sessionId,
      });

      created++;
    }

    logger.info({ engagementId, created, skipped }, 'SkillPod time synced');

    return { created, skipped };
  }

  /**
   * Get start of week (Monday)
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

export const timeTrackingService = new TimeTrackingService();
