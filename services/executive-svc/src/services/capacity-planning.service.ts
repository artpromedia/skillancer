import { prisma } from '@skillancer/database';

// Capacity Planning Service
// Manages team capacity, resource allocation, and utilization tracking

export interface TeamMemberInput {
  engagementId: string;
  name: string;
  email?: string;
  role: string;
  department?: string;
  weeklyCapacityHours?: number;
  externalUserId?: string;
  externalSource?: string;
}

export interface ResourceAllocationInput {
  teamMemberId: string;
  projectName: string;
  projectId?: string;
  projectSource?: string;
  allocatedHours: number;
  weekStartDate: Date;
  weekEndDate: Date;
  notes?: string;
}

export class CapacityPlanningService {
  // Create team member
  async createTeamMember(input: TeamMemberInput) {
    return prisma.teamMember.create({
      data: {
        engagementId: input.engagementId,
        name: input.name,
        email: input.email,
        role: input.role,
        department: input.department,
        weeklyCapacityHours: input.weeklyCapacityHours || 40,
        externalUserId: input.externalUserId,
        externalSource: input.externalSource,
      },
    });
  }

  // Get team members
  async getTeamMembers(
    engagementId: string,
    options?: {
      department?: string;
    }
  ) {
    const where: any = { engagementId };
    if (options?.department) where.department = options.department;

    return prisma.teamMember.findMany({
      where,
      include: {
        allocations: {
          where: {
            weekEndDate: { gte: new Date() },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Create resource allocation
  async createAllocation(input: ResourceAllocationInput) {
    const member = await prisma.teamMember.findUnique({
      where: { id: input.teamMemberId },
    });

    if (!member) throw new Error('Team member not found');

    return prisma.resourceAllocation.create({
      data: {
        teamMemberId: input.teamMemberId,
        projectName: input.projectName,
        projectId: input.projectId,
        projectSource: input.projectSource,
        allocatedHours: input.allocatedHours,
        weekStartDate: input.weekStartDate,
        weekEndDate: input.weekEndDate,
        notes: input.notes,
      },
      include: {
        teamMember: { select: { id: true, name: true, role: true } },
      },
    });
  }

  // Get allocations for a time period
  async getAllocations(engagementId: string, startDate: Date, endDate: Date) {
    return prisma.resourceAllocation.findMany({
      where: {
        teamMember: { engagementId },
        OR: [{ weekStartDate: { lte: endDate }, weekEndDate: { gte: startDate } }],
      },
      include: {
        teamMember: { select: { id: true, name: true, role: true, department: true } },
      },
      orderBy: { weekStartDate: 'asc' },
    });
  }

  // Get team capacity overview
  async getTeamCapacity(engagementId: string, weekStart: Date) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const members = await prisma.teamMember.findMany({
      where: { engagementId },
      include: {
        allocations: {
          where: {
            weekStartDate: { lte: weekEnd },
            weekEndDate: { gte: weekStart },
          },
        },
      },
    });

    return members.map((member) => {
      const totalAllocated = member.allocations.reduce(
        (sum, a) => sum + Number(a.allocatedHours),
        0
      );
      const capacity = Number(member.weeklyCapacityHours) || 40;
      const utilization = capacity > 0 ? Math.round((totalAllocated / capacity) * 100) : 0;

      return {
        id: member.id,
        name: member.name,
        role: member.role,
        department: member.department,
        capacity,
        allocated: totalAllocated,
        available: Math.max(0, capacity - totalAllocated),
        utilization,
        status:
          utilization > 100
            ? 'OVERALLOCATED'
            : utilization > 80
              ? 'OPTIMAL'
              : utilization > 50
                ? 'AVAILABLE'
                : 'UNDERUTILIZED',
        allocations: member.allocations,
      };
    });
  }

  // Get department summary
  async getDepartmentSummary(engagementId: string) {
    const members = await prisma.teamMember.findMany({
      where: { engagementId },
      include: {
        allocations: {
          where: { weekEndDate: { gte: new Date() } },
        },
      },
    });

    const departments: Record<
      string,
      {
        headcount: number;
        totalCapacity: number;
        totalAllocated: number;
        avgUtilization: number;
      }
    > = {};

    for (const member of members) {
      const dept = member.department || 'Unassigned';
      if (!departments[dept]) {
        departments[dept] = {
          headcount: 0,
          totalCapacity: 0,
          totalAllocated: 0,
          avgUtilization: 0,
        };
      }

      const allocated = member.allocations.reduce((sum, a) => sum + Number(a.allocatedHours), 0);
      departments[dept].headcount++;
      departments[dept].totalCapacity += Number(member.weeklyCapacityHours) || 40;
      departments[dept].totalAllocated += allocated;
    }

    return Object.entries(departments).map(([name, data]) => ({
      name,
      headcount: data.headcount,
      totalCapacity: data.totalCapacity,
      totalAllocated: data.totalAllocated,
      avgUtilization:
        data.totalCapacity > 0 ? Math.round((data.totalAllocated / data.totalCapacity) * 100) : 0,
    }));
  }

  // Get capacity widget data
  async getCapacityWidgetData(engagementId: string) {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week

    const teamCapacity = await this.getTeamCapacity(engagementId, weekStart);
    const departmentSummary = await this.getDepartmentSummary(engagementId);

    const totalHeadcount = teamCapacity.length;
    const totalCapacity = teamCapacity.reduce((sum, m) => sum + m.capacity, 0);
    const totalAllocated = teamCapacity.reduce((sum, m) => sum + m.allocated, 0);
    const avgUtilization =
      totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

    const byStatus = {
      overallocated: teamCapacity.filter((m) => m.status === 'OVERALLOCATED').length,
      optimal: teamCapacity.filter((m) => m.status === 'OPTIMAL').length,
      available: teamCapacity.filter((m) => m.status === 'AVAILABLE').length,
      underutilized: teamCapacity.filter((m) => m.status === 'UNDERUTILIZED').length,
    };

    return {
      totalHeadcount,
      totalCapacity,
      totalAllocated,
      avgUtilization,
      byStatus,
      departments: departmentSummary,
      topAllocated: teamCapacity
        .sort((a, b) => b.utilization - a.utilization)
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          utilization: m.utilization,
          status: m.status,
        })),
    };
  }

  // Update team member
  async updateTeamMember(id: string, data: Partial<TeamMemberInput>) {
    return prisma.teamMember.update({
      where: { id },
      data,
    });
  }

  // Update allocation
  async updateAllocation(id: string, data: Partial<ResourceAllocationInput>) {
    return prisma.resourceAllocation.update({
      where: { id },
      data,
    });
  }

  // Delete allocation
  async deleteAllocation(id: string) {
    return prisma.resourceAllocation.delete({ where: { id } });
  }
}

export const capacityPlanningService = new CapacityPlanningService();
