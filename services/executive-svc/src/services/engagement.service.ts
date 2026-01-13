/**
 * Engagement Service
 *
 * Manages executive-client engagements including lifecycle,
 * status transitions, capacity management, and workspace creation.
 */

import { prisma } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import type {
  ExecutiveEngagement,
  ExecutiveProfile,
  EngagementStatus,
  ExecutiveType,
  BillingModel,
  EngagementBillingCycle,
} from '../types/prisma-shim.js';

// Types
export interface CreateEngagementInput {
  executiveId: string;
  clientTenantId: string;
  clientContactId: string;
  title: string;
  role: ExecutiveType;
  description?: string;
  hoursPerWeek: number;
  hoursPerWeekMin?: number;
  hoursPerWeekMax?: number;
  billingModel: BillingModel;
  monthlyRetainer?: number;
  hourlyRate?: number;
  currency?: string;
  billingCycle?: EngagementBillingCycle;
  paymentTerms?: number;
  scopeOfWork?: string;
  meetingCadence?: string;
  communicationChannels?: string[];
}

export interface UpdateEngagementInput {
  title?: string;
  description?: string;
  hoursPerWeek?: number;
  hoursPerWeekMin?: number;
  hoursPerWeekMax?: number;
  monthlyRetainer?: number;
  hourlyRate?: number;
  scopeOfWork?: string;
  meetingCadence?: string;
  communicationChannels?: string[];
  startDate?: Date;
  endDate?: Date;
  renewalDate?: Date;
}

export interface EngagementFilters {
  status?: EngagementStatus | EngagementStatus[];
  role?: ExecutiveType;
  clientTenantId?: string;
}

export interface CapacityCheck {
  available: boolean;
  currentClients: number;
  maxClients: number;
  currentHoursCommitted: number;
  maxHoursPerWeek: number;
  remainingCapacity: number;
}

// Valid status transitions
const STATUS_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  PROPOSAL: ['NEGOTIATING', 'TERMINATED'],
  NEGOTIATING: ['CONTRACT_SENT', 'PROPOSAL', 'TERMINATED'],
  CONTRACT_SENT: ['ACTIVE', 'NEGOTIATING', 'TERMINATED'],
  ACTIVE: ['PAUSED', 'RENEWAL', 'COMPLETED', 'TERMINATED'],
  PAUSED: ['ACTIVE', 'TERMINATED'],
  RENEWAL: ['ACTIVE', 'COMPLETED', 'TERMINATED'],
  COMPLETED: [],
  TERMINATED: [],
};

class EngagementService {
  /**
   * Create a new engagement
   */
  async createEngagement(input: CreateEngagementInput): Promise<ExecutiveEngagement> {
    const {
      executiveId,
      clientTenantId,
      clientContactId,
      title,
      role,
      hoursPerWeek,
      billingModel,
      ...rest
    } = input;

    // Validate executive is approved
    const executive = await prisma.executiveProfile.findUnique({
      where: { id: executiveId },
    });

    if (!executive) {
      throw new Error('Executive not found');
    }

    if (executive.vettingStatus !== 'APPROVED') {
      throw new Error('Executive must be approved to create engagements');
    }

    // Check capacity
    const capacity = await this.checkExecutiveCapacity(executiveId);
    if (!capacity.available) {
      throw new Error(
        `Executive at maximum capacity: ${capacity.currentClients}/${capacity.maxClients} clients`
      );
    }

    // Create engagement with workspace
    const engagement = await prisma.$transaction(async (tx) => {
      // Create the engagement
      const newEngagement = await tx.executiveEngagement.create({
        data: {
          executiveId,
          clientTenantId,
          clientContactId,
          title,
          role,
          hoursPerWeek,
          billingModel,
          status: 'PROPOSAL',
          currency: rest.currency || 'USD',
          billingCycle: rest.billingCycle || 'MONTHLY',
          paymentTerms: rest.paymentTerms || 30,
          description: rest.description,
          hoursPerWeekMin: rest.hoursPerWeekMin,
          hoursPerWeekMax: rest.hoursPerWeekMax,
          monthlyRetainer: rest.monthlyRetainer,
          hourlyRate: rest.hourlyRate,
          scopeOfWork: rest.scopeOfWork,
          meetingCadence: rest.meetingCadence,
          communicationChannels: rest.communicationChannels || [],
        },
      });

      // Create the workspace
      await tx.executiveWorkspace.create({
        data: {
          engagementId: newEngagement.id,
          enabledWidgets: this.getDefaultWidgets(role),
          pinnedDocuments: [],
          pinnedLinks: [],
          favoriteActions: [],
          recentFiles: [],
          recentTools: [],
        },
      });

      return newEngagement;
    });

    logger.info(
      {
        engagementId: engagement.id,
        executiveId,
        clientTenantId,
      },
      'Engagement created'
    );

    return engagement;
  }

  /**
   * Update an engagement
   */
  async updateEngagement(
    engagementId: string,
    updates: UpdateEngagementInput
  ): Promise<ExecutiveEngagement> {
    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    // Validate status allows updates
    if (engagement.status === 'COMPLETED' || engagement.status === 'TERMINATED') {
      throw new Error('Cannot update completed or terminated engagements');
    }

    const updated = await prisma.executiveEngagement.update({
      where: { id: engagementId },
      data: updates,
    });

    logger.info({ engagementId, updates }, 'Engagement updated');

    return updated;
  }

  /**
   * Update engagement status
   */
  async updateEngagementStatus(
    engagementId: string,
    newStatus: EngagementStatus,
    reason?: string
  ): Promise<ExecutiveEngagement> {
    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: engagementId },
      include: { executive: true },
    });

    if (!engagement) {
      throw new Error('Engagement not found');
    }

    // Validate transition
    const allowedTransitions = STATUS_TRANSITIONS[engagement.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${engagement.status} to ${newStatus}`);
    }

    // Prepare update data
    const updateData: any = { status: newStatus };

    // Handle status-specific logic
    switch (newStatus) {
      case 'ACTIVE':
        updateData.startDate = updateData.startDate || new Date();
        // Update executive's current client count
        await prisma.executiveProfile.update({
          where: { id: engagement.executiveId },
          data: { currentClients: { increment: 1 } },
        });
        break;

      case 'COMPLETED':
        updateData.endDate = new Date();
        // Decrement client count
        await prisma.executiveProfile.update({
          where: { id: engagement.executiveId },
          data: { currentClients: { decrement: 1 } },
        });
        break;

      case 'TERMINATED':
        updateData.terminatedAt = new Date();
        updateData.terminationReason = reason;
        // Decrement if was active
        if (engagement.status === 'ACTIVE' || engagement.status === 'PAUSED') {
          await prisma.executiveProfile.update({
            where: { id: engagement.executiveId },
            data: { currentClients: { decrement: 1 } },
          });
        }
        break;

      case 'RENEWAL':
        updateData.renewalDate = new Date();
        break;
    }

    const updated = await prisma.executiveEngagement.update({
      where: { id: engagementId },
      data: updateData,
    });

    logger.info(
      {
        engagementId,
        oldStatus: engagement.status,
        newStatus,
        reason,
      },
      'Engagement status updated'
    );

    return updated;
  }

  /**
   * Get engagements for an executive
   */
  async getEngagementsByExecutive(
    executiveId: string,
    filters?: EngagementFilters
  ): Promise<ExecutiveEngagement[]> {
    const where: any = { executiveId };

    if (filters?.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }

    if (filters?.role) {
      where.role = filters.role;
    }

    return prisma.executiveEngagement.findMany({
      where,
      include: {
        workspace: true,
        milestones: {
          where: { status: { not: 'CANCELLED' } },
          take: 5,
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  /**
   * Get engagements for a client tenant
   */
  async getEngagementsByClient(
    clientTenantId: string,
    filters?: EngagementFilters
  ): Promise<ExecutiveEngagement[]> {
    const where: any = { clientTenantId };

    if (filters?.status) {
      where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }

    if (filters?.role) {
      where.role = filters.role;
    }

    return prisma.executiveEngagement.findMany({
      where,
      include: {
        executive: {
          select: {
            id: true,
            headline: true,
            profilePhotoUrl: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get engagement details
   */
  async getEngagementDetails(
    engagementId: string,
    requesterId: string
  ): Promise<ExecutiveEngagement | null> {
    const engagement = await prisma.executiveEngagement.findUnique({
      where: { id: engagementId },
      include: {
        executive: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        workspace: true,
        milestones: {
          orderBy: { orderIndex: 'asc' },
        },
        timeEntries: {
          take: 20,
          orderBy: { date: 'desc' },
        },
        connectedIntegrations: true,
      },
    });

    if (!engagement) {
      return null;
    }

    // Verify requester has access (executive or client contact)
    const executive = await prisma.executiveProfile.findFirst({
      where: { userId: requesterId },
    });

    const hasAccess =
      executive?.id === engagement.executiveId || engagement.clientContactId === requesterId;

    if (!hasAccess) {
      throw new Error('Access denied to this engagement');
    }

    return engagement;
  }

  /**
   * Check executive capacity
   */
  async checkExecutiveCapacity(executiveId: string): Promise<CapacityCheck> {
    const executive = await prisma.executiveProfile.findUnique({
      where: { id: executiveId },
    });

    if (!executive) {
      throw new Error('Executive not found');
    }

    // Get active engagements to calculate committed hours
    const activeEngagements = await prisma.executiveEngagement.findMany({
      where: {
        executiveId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: { hoursPerWeek: true },
    });

    const currentHoursCommitted = activeEngagements.reduce((sum, e) => sum + e.hoursPerWeek, 0);

    const remainingCapacity = executive.hoursPerWeekMax - currentHoursCommitted;

    return {
      available: executive.currentClients < executive.maxClients && remainingCapacity > 0,
      currentClients: executive.currentClients,
      maxClients: executive.maxClients,
      currentHoursCommitted,
      maxHoursPerWeek: executive.hoursPerWeekMax,
      remainingCapacity: Math.max(0, remainingCapacity),
    };
  }

  /**
   * Get executive utilization
   */
  async getExecutiveUtilization(
    executiveId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    hoursByEngagement: { engagementId: string; title: string; hours: number }[];
    hoursByCategory: { category: string; hours: number }[];
    utilizationRate: number;
  }> {
    const executive = await prisma.executiveProfile.findUnique({
      where: { id: executiveId },
    });

    if (!executive) {
      throw new Error('Executive not found');
    }

    // Get time entries in date range
    const timeEntries = await prisma.executiveTimeEntry.findMany({
      where: {
        executiveId,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        engagement: { select: { id: true, title: true } },
      },
    });

    // Calculate totals
    let totalHours = 0;
    let billableHours = 0;
    const engagementHours: Record<string, { title: string; hours: number }> = {};
    const categoryHours: Record<string, number> = {};

    for (const entry of timeEntries) {
      const hours = Number(entry.hours);
      totalHours += hours;

      if (entry.billable) {
        billableHours += hours;
      }

      // By engagement
      if (!engagementHours[entry.engagementId]) {
        engagementHours[entry.engagementId] = {
          title: entry.engagement.title,
          hours: 0,
        };
      }
      engagementHours[entry.engagementId].hours += hours;

      // By category
      categoryHours[entry.category] = (categoryHours[entry.category] || 0) + hours;
    }

    // Calculate utilization rate
    const weeksDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const availableHours = weeksDiff * executive.hoursPerWeekMax;
    const utilizationRate = availableHours > 0 ? (totalHours / availableHours) * 100 : 0;

    return {
      totalHours,
      billableHours,
      nonBillableHours: totalHours - billableHours,
      hoursByEngagement: Object.entries(engagementHours).map(([id, data]) => ({
        engagementId: id,
        ...data,
      })),
      hoursByCategory: Object.entries(categoryHours).map(([category, hours]) => ({
        category,
        hours,
      })),
      utilizationRate: Math.round(utilizationRate * 10) / 10,
    };
  }

  /**
   * Get default widgets for executive type
   */
  private getDefaultWidgets(role: ExecutiveType): string[] {
    const baseWidgets = ['time-summary', 'recent-activity', 'milestones', 'quick-actions'];

    const roleWidgets: Record<string, string[]> = {
      FRACTIONAL_CTO: ['tech-health', 'team-overview', 'sprint-progress'],
      FRACTIONAL_CFO: ['financial-overview', 'cashflow', 'budget-tracker'],
      FRACTIONAL_CMO: ['marketing-metrics', 'campaign-performance', 'pipeline'],
      FRACTIONAL_COO: ['operations-dashboard', 'kpi-tracker', 'process-health'],
      FRACTIONAL_CHRO: ['team-health', 'hiring-pipeline', 'engagement-scores'],
      FRACTIONAL_CPO: ['product-roadmap', 'feature-progress', 'user-metrics'],
      FRACTIONAL_CRO: ['revenue-metrics', 'sales-pipeline', 'forecast'],
      FRACTIONAL_CISO: ['security-posture', 'compliance-status', 'risk-matrix'],
      FRACTIONAL_CLO: ['legal-matters', 'contract-status', 'compliance'],
      FRACTIONAL_CDO: ['data-quality', 'analytics-dashboard', 'data-governance'],
      BOARD_ADVISOR: ['company-overview', 'key-metrics', 'strategic-initiatives'],
      INTERIM_EXECUTIVE: ['handover-status', 'key-priorities', 'team-overview'],
    };

    return [...baseWidgets, ...(roleWidgets[role] || [])];
  }
}

export const engagementService = new EngagementService();
