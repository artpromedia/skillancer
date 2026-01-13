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
  constructor(private prisma: PrismaClient) {}

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
    if (executiveProfile.currentClientCount >= executiveProfile.maxClients) {
      throw new Error('Executive has reached maximum client capacity');
    }

    const engagement = await this.prisma.executiveEngagement.create({
      data: {
        executiveProfileId: input.executiveProfileId,
        clientTenantId: input.clientTenantId,
        clientUserId: input.clientUserId,
        role: input.role,
        title: input.title,
        description: input.description,
        status: 'PROPOSAL',
        hoursPerWeek: input.hoursPerWeek,
        startDate: input.startDate,
        expectedEndDate: input.expectedEndDate,
        monthlyRetainer: input.monthlyRetainer,
        hourlyRate: input.hourlyRate,
        billingCycle: input.billingCycle || 'MONTHLY',
        equityPercentage: input.equityPercentage,
        objectives: input.objectives ? JSON.parse(JSON.stringify(input.objectives)) : null,
        successMetrics: input.successMetrics ? JSON.parse(JSON.stringify(input.successMetrics)) : null,
      },
      include: {
        executiveProfile: {
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
        clientTenant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        clientUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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
        executiveProfile: {
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
        clientTenant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            website: true,
          },
        },
        clientUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        integrations: {
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
    const where: any = { executiveProfileId };

    if (status) {
      where.status = status;
    }

    const engagements = await this.prisma.executiveEngagement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        clientTenant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        clientUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
        executiveProfile: {
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
        status: input.status,
        hoursPerWeek: input.hoursPerWeek,
        endDate: input.endDate,
        expectedEndDate: input.expectedEndDate,
        monthlyRetainer: input.monthlyRetainer,
        hourlyRate: input.hourlyRate,
        billingCycle: input.billingCycle,
        equityPercentage: input.equityPercentage,
        objectives: input.objectives ? JSON.parse(JSON.stringify(input.objectives)) : undefined,
        successMetrics: input.successMetrics ? JSON.parse(JSON.stringify(input.successMetrics)) : undefined,
        workspaceConfig: input.workspaceConfig ? JSON.parse(JSON.stringify(input.workspaceConfig)) : undefined,
        lastActivityAt: new Date(),
      },
      include: {
        executiveProfile: true,
        clientTenant: true,
      },
    });

    // Update executive's current client count if status changed
    if (input.status === 'ACTIVE') {
      await this.prisma.executiveProfile.update({
        where: { id: engagement.executiveProfileId },
        data: { currentClientCount: { increment: 1 } },
      });
    } else if (input.status === 'COMPLETED' || input.status === 'TERMINATED') {
      await this.prisma.executiveProfile.update({
        where: { id: engagement.executiveProfileId },
        data: { currentClientCount: { decrement: 1 } },
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
        approvalStatus: 'APPROVED',
        approvedBy: { push: approverId },
        approvedAt: new Date(),
        startDate: new Date(),
      },
    });

    // Update executive's current client count
    await this.prisma.executiveProfile.update({
      where: { id: engagement.executiveProfileId },
      data: { currentClientCount: { increment: 1 } },
    });

    return engagement;
  }

  /**
   * Log time entry
   */
  async logTimeEntry(input: ExecutiveTimeEntryInput) {
    const timeEntry = await this.prisma.executiveTimeEntry.create({
      data: {
        engagementId: input.engagementId,
        date: input.date,
        hours: input.hours,
        description: input.description,
        category: input.category,
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
        deliverables: input.deliverables ? JSON.parse(JSON.stringify(input.deliverables)) : null,
        successCriteria: input.successCriteria,
        status: 'PENDING',
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
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
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
        widgetSettings: JSON.parse(JSON.stringify(config.widgetSettings)),
        pinnedDocuments: config.pinnedDocuments,
        favoriteActions: config.favoriteActions,
        quickLinks: JSON.parse(JSON.stringify(config.quickLinks)),
      },
      update: {
        dashboardLayout: JSON.parse(JSON.stringify(config.dashboardLayout)),
        enabledWidgets: config.enabledWidgets,
        widgetSettings: JSON.parse(JSON.stringify(config.widgetSettings)),
        pinnedDocuments: config.pinnedDocuments,
        favoriteActions: config.favoriteActions,
        quickLinks: JSON.parse(JSON.stringify(config.quickLinks)),
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

    if (executiveProfileId) where.executiveProfileId = executiveProfileId;
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
      where: { id: engagement.executiveProfileId },
      data: { currentClientCount: { decrement: 1 } },
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
      where: { id: engagement.executiveProfileId },
      data: { currentClientCount: { decrement: 1 } },
    });

    return engagement;
  }
}
