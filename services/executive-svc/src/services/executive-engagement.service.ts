import { PrismaClient } from '../types/prisma-shim.js';
import {
  ExecutiveEngagementCreateInput,
  ExecutiveEngagementUpdateInput,
  ExecutiveEngagementStatus,
  ExecutiveTimeEntryInput,
  ExecutiveMilestoneInput,
  ExecutiveWorkspaceConfig,
} from '../types/executive.types';

export class ExecutiveEngagementService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new engagement proposal
   */
  async createEngagement(input: ExecutiveEngagementCreateInput) {
    // Verify executive profile exists and is approved
    const executiveProfile = await this.prisma.executiveProfile.findUnique({
      where: { id: input.executiveProfileId },
    });

    if (!executiveProfile) {
      throw new Error('Executive profile not found');
    }

    if (executiveProfile.vettingStatus !== 'APPROVED') {
      throw new Error('Executive is not approved for engagements');
    }

    // Check capacity
    if (executiveProfile.currentClients >= executiveProfile.maxClients) {
      throw new Error('Executive has reached maximum client capacity');
    }

    const engagement = await this.prisma.executiveEngagement.create({
      data: {
        executiveId: input.executiveProfileId,
        clientTenantId: input.clientTenantId,
        clientContactId: input.clientUserId,
        role: input.role as any,
        title: input.title,
        description: input.description,
        status: 'PROPOSAL',
        hoursPerWeek: input.hoursPerWeek,
        startDate: input.startDate,
        endDate: input.expectedEndDate,
        monthlyRetainer: input.monthlyRetainer,
        hourlyRate: input.hourlyRate,
        billingCycle: (input.billingCycle || 'MONTHLY') as any,
        scopeOfWork: input.objectives ? JSON.stringify(input.objectives) : null,
      },
      include: {
        executive: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return engagement;
  }

  /**
   * Get engagement by ID
   */
  async getEngagementById(id: string) {
    const engagement = await this.prisma.executiveEngagement.findUnique({
      where: { id },
      include: {
        executive: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        connectedIntegrations: {
          include: {
            integrationType: true,
          },
        },
        workspace: true,
        timeEntries: {
          orderBy: { date: 'desc' },
          take: 20,
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    return engagement;
  }

  /**
   * Get engagements for an executive
   */
  async getExecutiveEngagements(executiveProfileId: string, status?: ExecutiveEngagementStatus) {
    const where: any = { executiveId: executiveProfileId };

    if (status) {
      where.status = status;
    }

    const engagements = await this.prisma.executiveEngagement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        milestones: {
          where: { status: { not: 'COMPLETED' } },
          orderBy: { dueDate: 'asc' },
          take: 3,
        },
      },
    });

    return engagements;
  }

  /**
   * Get engagements for a client tenant
   */
  async getClientEngagements(clientTenantId: string, status?: ExecutiveEngagementStatus) {
    const where: any = { clientTenantId };

    if (status) {
      where.status = status;
    }

    const engagements = await this.prisma.executiveEngagement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        executive: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        milestones: {
          where: { status: { not: 'COMPLETED' } },
          orderBy: { dueDate: 'asc' },
          take: 3,
        },
      },
    });

    return engagements;
  }

  /**
   * Update engagement
   */
  async updateEngagement(id: string, input: ExecutiveEngagementUpdateInput) {
    const engagement = await this.prisma.executiveEngagement.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        status: input.status as any,
        hoursPerWeek: input.hoursPerWeek,
        endDate: input.endDate,
        monthlyRetainer: input.monthlyRetainer,
        hourlyRate: input.hourlyRate,
        billingCycle: input.billingCycle as any,
        lastActivityAt: new Date(),
      },
      include: {
        executive: true,
      },
    });

    // Update executive's current client count if status changed
    if (input.status === 'ACTIVE') {
      await this.prisma.executiveProfile.update({
        where: { id: engagement.executiveId },
        data: { currentClients: { increment: 1 } },
      });
    } else if (input.status === 'COMPLETED' || input.status === 'TERMINATED') {
      await this.prisma.executiveProfile.update({
        where: { id: engagement.executiveId },
        data: { currentClients: { decrement: 1 } },
      });
    }

    return engagement;
  }

  /**
   * Approve engagement
   */
  async approveEngagement(id: string, approverId: string) {
    const engagement = await this.prisma.executiveEngagement.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });

    // Update executive's current client count
    await this.prisma.executiveProfile.update({
      where: { id: engagement.executiveId },
      data: { currentClients: { increment: 1 } },
    });

    return engagement;
  }

  /**
   * Log time entry
   */
  async logTimeEntry(input: ExecutiveTimeEntryInput & { executiveId: string }) {
    const timeEntry = await this.prisma.executiveTimeEntry.create({
      data: {
        engagementId: input.engagementId,
        executiveId: input.executiveId,
        date: input.date,
        hours: input.hours,
        description: input.description || '',
        category: input.category as any,
        billable: input.billable ?? true,
      },
    });

    // Update total hours logged
    await this.prisma.executiveEngagement.update({
      where: { id: input.engagementId },
      data: {
        totalHoursLogged: { increment: Number(input.hours) },
        lastActivityAt: new Date(),
      },
    });

    return timeEntry;
  }

  /**
   * Get time entries for engagement
   */
  async getTimeEntries(engagementId: string, startDate?: Date, endDate?: Date) {
    const where: any = { engagementId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const timeEntries = await this.prisma.executiveTimeEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const totalHours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);
    const billableHours = timeEntries
      .filter((entry) => entry.billable)
      .reduce((sum, entry) => sum + Number(entry.hours), 0);

    return {
      entries: timeEntries,
      totalHours,
      billableHours,
    };
  }

  /**
   * Create milestone
   */
  async createMilestone(input: ExecutiveMilestoneInput) {
    const milestone = await this.prisma.executiveMilestone.create({
      data: {
        engagementId: input.engagementId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        deliverables: input.deliverables
          ? input.deliverables.map((d: string) => JSON.parse(JSON.stringify({ name: d })))
          : [],
        status: 'NOT_STARTED',
      },
    });

    return milestone;
  }

  /**
   * Update milestone status
   */
  async updateMilestoneStatus(milestoneId: string, status: string) {
    const milestone = await this.prisma.executiveMilestone.update({
      where: { id: milestoneId },
      data: {
        status: status as any,
      },
    });

    return milestone;
  }

  /**
   * Get milestones for engagement
   */
  async getMilestones(engagementId: string) {
    const milestones = await this.prisma.executiveMilestone.findMany({
      where: { engagementId },
      orderBy: { dueDate: 'asc' },
    });

    return milestones;
  }

  /**
   * Setup workspace for engagement
   */
  async setupWorkspace(engagementId: string, config: ExecutiveWorkspaceConfig) {
    const workspace = await this.prisma.executiveWorkspace.upsert({
      where: { engagementId },
      create: {
        engagementId,
        dashboardLayout: JSON.parse(JSON.stringify(config.dashboardLayout)),
        enabledWidgets: config.enabledWidgets,
        widgetConfigs: JSON.parse(JSON.stringify(config.widgetSettings)),
        pinnedDocuments:
          config.pinnedDocuments?.map((d: string) =>
            JSON.parse(JSON.stringify({ name: d, url: d, type: 'document' }))
          ) || [],
        favoriteActions: config.favoriteActions,
        pinnedLinks:
          config.quickLinks?.map((l: { title: string; url: string }) =>
            JSON.parse(JSON.stringify(l))
          ) || [],
      },
      update: {
        dashboardLayout: JSON.parse(JSON.stringify(config.dashboardLayout)),
        enabledWidgets: config.enabledWidgets,
        widgetConfigs: JSON.parse(JSON.stringify(config.widgetSettings)),
        pinnedDocuments:
          config.pinnedDocuments?.map((d: string) =>
            JSON.parse(JSON.stringify({ name: d, url: d, type: 'document' }))
          ) || [],
        favoriteActions: config.favoriteActions,
        pinnedLinks:
          config.quickLinks?.map((l: { title: string; url: string }) =>
            JSON.parse(JSON.stringify(l))
          ) || [],
      },
    });

    return workspace;
  }

  /**
   * Get workspace for engagement
   */
  async getWorkspace(engagementId: string) {
    const workspace = await this.prisma.executiveWorkspace.findUnique({
      where: { engagementId },
    });

    return workspace;
  }

  /**
   * Get engagement statistics
   */
  async getEngagementStats(executiveProfileId?: string, clientTenantId?: string) {
    const where: any = {};

    if (executiveProfileId) where.executiveId = executiveProfileId;
    if (clientTenantId) where.clientTenantId = clientTenantId;

    const [total, active, completed, totalRevenue] = await Promise.all([
      this.prisma.executiveEngagement.count({ where }),
      this.prisma.executiveEngagement.count({
        where: { ...where, status: 'ACTIVE' },
      }),
      this.prisma.executiveEngagement.count({
        where: { ...where, status: 'COMPLETED' },
      }),
      this.prisma.executiveEngagement.aggregate({
        where: { ...where, status: { in: ['ACTIVE', 'COMPLETED'] } },
        _sum: {
          monthlyRetainer: true,
        },
      }),
    ]);

    return {
      total,
      active,
      completed,
      totalRevenue: totalRevenue._sum.monthlyRetainer || 0,
    };
  }

  /**
   * End engagement
   */
  async endEngagement(id: string, reason?: string) {
    const engagement = await this.prisma.executiveEngagement.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endDate: new Date(),
      },
    });

    // Update executive's current client count
    await this.prisma.executiveProfile.update({
      where: { id: engagement.executiveId },
      data: { currentClients: { decrement: 1 } },
    });

    return engagement;
  }

  /**
   * Terminate engagement
   */
  async terminateEngagement(id: string, reason: string) {
    const engagement = await this.prisma.executiveEngagement.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        endDate: new Date(),
      },
    });

    // Update executive's current client count
    await this.prisma.executiveProfile.update({
      where: { id: engagement.executiveId },
      data: { currentClients: { decrement: 1 } },
    });

    return engagement;
  }
}
