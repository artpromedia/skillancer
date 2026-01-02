// @ts-nocheck
/**
 * Executive Integration Service
 *
 * Integrates executive engagements into the cockpit service,
 * enabling clients to manage their executives, approve time,
 * and view engagement analytics.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';

// Types
export interface ClientExecutiveSummary {
  activeExecutives: number;
  totalHoursThisMonth: number;
  totalHoursApproved: number;
  totalHoursPending: number;
  totalSpendThisMonth: number;
  avgRating: number;
}

export interface ExecutiveEngagementView {
  id: string;
  executiveId: string;
  executiveName: string;
  executiveTitle: string;
  role: string;
  status: string;
  hoursPerWeek: number;
  hoursThisMonth: number;
  hoursApproved: number;
  hoursPending: number;
  startDate: string;
  rating?: number;
  lastActivity?: string;
}

export interface PendingTimeEntry {
  id: string;
  engagementId: string;
  executiveName: string;
  date: string;
  hours: number;
  description: string;
  category: string;
  billable: boolean;
  submittedAt: string;
}

class ExecutiveIntegrationService {
  /**
   * Get summary of executives for a client tenant
   */
  async getClientExecutiveSummary(clientTenantId: string): Promise<ClientExecutiveSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get active engagements
    const engagements = await prisma.executiveEngagement.findMany({
      where: {
        clientTenantId,
        status: 'ACTIVE',
      },
      include: {
        timeEntries: {
          where: {
            date: { gte: monthStart },
          },
        },
      },
    });

    let totalHoursThisMonth = 0;
    let totalHoursApproved = 0;
    let totalHoursPending = 0;

    for (const engagement of engagements) {
      for (const entry of engagement.timeEntries) {
        const hours = Number(entry.hours);
        totalHoursThisMonth += hours;

        if (entry.status === 'APPROVED' || entry.status === 'INVOICED') {
          totalHoursApproved += hours;
        }
        if (entry.status === 'PENDING' || entry.status === 'SUBMITTED') {
          totalHoursPending += hours;
        }
      }
    }

    // Calculate total spend (simplified - would use actual rates)
    const avgHourlyRate = 350;
    const totalSpendThisMonth = totalHoursApproved * avgHourlyRate;

    return {
      activeExecutives: engagements.length,
      totalHoursThisMonth,
      totalHoursApproved,
      totalHoursPending,
      totalSpendThisMonth,
      avgRating: 4.8, // Would calculate from actual ratings
    };
  }

  /**
   * Get all executives engaged by client
   */
  async getClientExecutives(
    clientTenantId: string,
    filters?: { status?: string | string[] }
  ): Promise<ExecutiveEngagementView[]> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const where: any = { clientTenantId };
    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    const engagements = await prisma.executiveEngagement.findMany({
      where,
      include: {
        executive: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        timeEntries: {
          where: {
            date: { gte: monthStart },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return engagements.map((eng) => {
      const hoursThisMonth = eng.timeEntries.reduce(
        (sum, e) => sum + Number(e.hours),
        0
      );
      const hoursApproved = eng.timeEntries
        .filter((e) => e.status === 'APPROVED' || e.status === 'INVOICED')
        .reduce((sum, e) => sum + Number(e.hours), 0);
      const hoursPending = eng.timeEntries
        .filter((e) => e.status === 'PENDING' || e.status === 'SUBMITTED')
        .reduce((sum, e) => sum + Number(e.hours), 0);

      return {
        id: eng.id,
        executiveId: eng.executiveId,
        executiveName: eng.executive?.user
          ? `${eng.executive.user.firstName} ${eng.executive.user.lastName}`
          : 'Unknown',
        executiveTitle: eng.role.replace('FRACTIONAL_', 'Fractional ').replace('_', ' '),
        role: eng.title,
        status: eng.status,
        hoursPerWeek: eng.hoursPerWeek,
        hoursThisMonth,
        hoursApproved,
        hoursPending,
        startDate: eng.startDate.toISOString(),
        lastActivity: eng.lastActivityAt?.toISOString(),
      };
    });
  }

  /**
   * Get all pending time entries for approval
   */
  async getPendingTimeEntries(clientTenantId: string): Promise<PendingTimeEntry[]> {
    const entries = await prisma.executiveTimeEntry.findMany({
      where: {
        engagement: { clientTenantId },
        status: 'SUBMITTED',
      },
      include: {
        engagement: {
          include: {
            executive: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return entries.map((entry) => ({
      id: entry.id,
      engagementId: entry.engagementId,
      executiveName: entry.engagement.executive?.user
        ? `${entry.engagement.executive.user.firstName} ${entry.engagement.executive.user.lastName}`
        : 'Unknown',
      date: entry.date.toISOString(),
      hours: Number(entry.hours),
      description: entry.description,
      category: entry.category,
      billable: entry.billable,
      submittedAt: entry.updatedAt.toISOString(),
    }));
  }

  /**
   * Approve time entries (client action)
   */
  async approveTimeEntries(
    clientTenantId: string,
    entryIds: string[],
    approverId: string
  ): Promise<number> {
    // Verify all entries belong to this client's engagements
    const entries = await prisma.executiveTimeEntry.findMany({
      where: {
        id: { in: entryIds },
        engagement: { clientTenantId },
        status: 'SUBMITTED',
      },
    });

    if (entries.length !== entryIds.length) {
      throw new Error('Some entries not found or not in submitted status');
    }

    // Approve all
    const result = await prisma.executiveTimeEntry.updateMany({
      where: { id: { in: entryIds } },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });

    logger.info('Time entries approved by client', {
      clientTenantId,
      entryCount: result.count,
      approverId,
    });

    return result.count;
  }

  /**
   * Reject time entries (client action)
   */
  async rejectTimeEntries(
    clientTenantId: string,
    entryIds: string[],
    approverId: string,
    reason: string
  ): Promise<number> {
    // Verify all entries belong to this client's engagements
    const entries = await prisma.executiveTimeEntry.findMany({
      where: {
        id: { in: entryIds },
        engagement: { clientTenantId },
        status: 'SUBMITTED',
      },
    });

    if (entries.length !== entryIds.length) {
      throw new Error('Some entries not found or not in submitted status');
    }

    // Reject all
    const result = await prisma.executiveTimeEntry.updateMany({
      where: { id: { in: entryIds } },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
    });

    logger.info('Time entries rejected by client', {
      clientTenantId,
      entryCount: result.count,
      reason,
    });

    return result.count;
  }

  /**
   * Get engagement billing summary for invoicing
   */
  async getEngagementBillingSummary(
    engagementId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalHours: number;
    billableHours: number;
    totalAmount: number;
    entries: {
      date: string;
      hours: number;
      description: string;
      category: string;
      rate: number;
      amount: number;
    }[];
  }> {
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
        status: 'APPROVED',
      },
      orderBy: { date: 'asc' },
    });

    const hourlyRate = engagement.hourlyRate || engagement.overageRate || 0;
    
    const billingEntries = entries.map((entry) => ({
      date: entry.date.toISOString(),
      hours: Number(entry.hours),
      description: entry.description,
      category: entry.category,
      rate: entry.billable ? hourlyRate : 0,
      amount: entry.billable ? Number(entry.hours) * hourlyRate : 0,
    }));

    const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
    const billableHours = entries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + Number(e.hours), 0);
    const totalAmount = billingEntries.reduce((sum, e) => sum + e.amount, 0);

    return {
      totalHours,
      billableHours,
      totalAmount,
      entries: billingEntries,
    };
  }
}

export const executiveIntegrationService = new ExecutiveIntegrationService();

