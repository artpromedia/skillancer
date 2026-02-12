// @ts-nocheck
/**
 * Guild Projects Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Handles project assignment, tracking, and completion
 */

import { db } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export const CreateGuildProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(3).max(200),
  description: z.string().optional(),
  budget: z.number().positive(),
  deadline: z.coerce.date().optional(),
  assignments: z.array(
    z.object({
      memberId: z.string().uuid(),
      role: z.string(),
      allocation: z.number().min(0).max(100), // Percentage
      estimatedHours: z.number().positive().optional(),
    })
  ),
});

export const UpdateProjectAssignmentSchema = z.object({
  role: z.string().optional(),
  allocation: z.number().min(0).max(100).optional(),
  estimatedHours: z.number().positive().optional(),
  actualHours: z.number().min(0).optional(),
});

export type CreateGuildProjectInput = z.infer<typeof CreateGuildProjectSchema>;
export type UpdateProjectAssignmentInput = z.infer<typeof UpdateProjectAssignmentSchema>;

export interface GuildProjectInfo {
  id: string;
  guildId: string;
  projectId: string;
  name: string;
  description: string | null;
  status: 'PLANNING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'CANCELLED';
  budget: number;
  deadline: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  assignments: ProjectAssignment[];
}

export interface ProjectAssignment {
  id: string;
  memberId: string;
  memberName: string;
  role: string;
  allocation: number;
  estimatedHours: number | null;
  actualHours: number | null;
  hoursLogged: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class GuildProjectsService {
  private log = logger.child({ service: 'GuildProjectsService' });

  /**
   * Create a new guild project
   */
  async createProject(
    guildId: string,
    managerId: string,
    input: CreateGuildProjectInput
  ): Promise<GuildProjectInfo> {
    const validated = CreateGuildProjectSchema.parse(input);

    // Verify manager has permission
    await this.requireProjectPermission(guildId, managerId);

    // Verify all assignees are guild members
    const memberIds = validated.assignments.map((a) => a.memberId);
    const members = await db.guildMember.findMany({
      where: {
        guildId,
        userId: { in: memberIds },
        status: 'ACTIVE',
      },
    });

    if (members.length !== memberIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All assignees must be active guild members',
      });
    }

    // Validate total allocation <= 100%
    const totalAllocation = validated.assignments.reduce((sum, a) => sum + a.allocation, 0);
    if (totalAllocation > 100) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Total allocation cannot exceed 100%',
      });
    }

    // Create project with assignments
    const project = await db.$transaction(async (tx) => {
      const guildProject = await tx.guildProject.create({
        data: {
          guildId,
          projectId: validated.projectId,
          name: validated.name,
          description: validated.description,
          budget: validated.budget,
          deadline: validated.deadline,
          status: 'PLANNING',
        },
      });

      // Create assignments
      for (const assignment of validated.assignments) {
        await tx.guildProjectAssignment.create({
          data: {
            guildProjectId: guildProject.id,
            memberId: assignment.memberId,
            role: assignment.role,
            allocation: assignment.allocation,
            estimatedHours: assignment.estimatedHours,
          },
        });
      }

      return guildProject;
    });

    this.log.info({ guildId, projectId: project.id }, 'Guild project created');

    return this.getProject(project.id);
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<GuildProjectInfo> {
    const project = await db.guildProject.findUnique({
      where: { id: projectId },
      include: {
        assignments: {
          include: {
            member: {
              include: {
                user: {
                  select: { displayName: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Guild project not found',
      });
    }

    return {
      id: project.id,
      guildId: project.guildId,
      projectId: project.projectId,
      name: project.name,
      description: project.description,
      status: project.status,
      budget: Number(project.budget),
      deadline: project.deadline,
      startedAt: project.startedAt,
      completedAt: project.completedAt,
      assignments: project.assignments.map((a) => ({
        id: a.id,
        memberId: a.memberId,
        memberName:
          a.member.user.displayName || `${a.member.user.firstName} ${a.member.user.lastName}`,
        role: a.role,
        allocation: a.allocation,
        estimatedHours: a.estimatedHours,
        actualHours: a.actualHours,
        hoursLogged: a.hoursLogged,
      })),
    };
  }

  /**
   * List guild projects
   */
  async listGuildProjects(
    guildId: string,
    options: {
      status?: ('PLANNING' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'CANCELLED')[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ projects: GuildProjectInfo[]; total: number }> {
    const where: Record<string, unknown> = { guildId };

    if (options.status?.length) {
      where.status = { in: options.status };
    }

    const [projects, total] = await Promise.all([
      db.guildProject.findMany({
        where,
        include: {
          assignments: {
            include: {
              member: {
                include: {
                  user: {
                    select: { displayName: true, firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 20,
        skip: options.offset ?? 0,
      }),
      db.guildProject.count({ where }),
    ]);

    return {
      projects: projects.map((project) => ({
        id: project.id,
        guildId: project.guildId,
        projectId: project.projectId,
        name: project.name,
        description: project.description,
        status: project.status,
        budget: Number(project.budget),
        deadline: project.deadline,
        startedAt: project.startedAt,
        completedAt: project.completedAt,
        assignments: project.assignments.map((a) => ({
          id: a.id,
          memberId: a.memberId,
          memberName:
            a.member.user.displayName || `${a.member.user.firstName} ${a.member.user.lastName}`,
          role: a.role,
          allocation: a.allocation,
          estimatedHours: a.estimatedHours,
          actualHours: a.actualHours,
          hoursLogged: a.hoursLogged,
        })),
      })),
      total,
    };
  }

  /**
   * Start project
   */
  async startProject(projectId: string, managerId: string): Promise<GuildProjectInfo> {
    const project = await db.guildProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    await this.requireProjectPermission(project.guildId, managerId);

    if (project.status !== 'PLANNING') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only planning projects can be started',
      });
    }

    await db.guildProject.update({
      where: { id: projectId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    this.log.info({ projectId }, 'Guild project started');

    return this.getProject(projectId);
  }

  /**
   * Complete project
   */
  async completeProject(projectId: string, managerId: string): Promise<GuildProjectInfo> {
    const project = await db.guildProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    await this.requireProjectPermission(project.guildId, managerId);

    if (project.status !== 'IN_PROGRESS' && project.status !== 'UNDER_REVIEW') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only active or under review projects can be completed',
      });
    }

    await db.guildProject.update({
      where: { id: projectId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    this.log.info({ projectId }, 'Guild project completed');

    return this.getProject(projectId);
  }

  /**
   * Cancel project
   */
  async cancelProject(projectId: string, managerId: string, reason?: string): Promise<void> {
    const project = await db.guildProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    await this.requireProjectPermission(project.guildId, managerId);

    if (project.status === 'COMPLETED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Completed projects cannot be cancelled',
      });
    }

    await db.guildProject.update({
      where: { id: projectId },
      data: {
        status: 'CANCELLED',
        metadata: { cancelReason: reason },
      },
    });

    this.log.info({ projectId, reason }, 'Guild project cancelled');
  }

  /**
   * Update project assignment
   */
  async updateAssignment(
    assignmentId: string,
    managerId: string,
    input: UpdateProjectAssignmentInput
  ): Promise<ProjectAssignment> {
    const assignment = await db.guildProjectAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        guildProject: true,
        member: {
          include: {
            user: { select: { displayName: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!assignment) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });
    }

    await this.requireProjectPermission(assignment.guildProject.guildId, managerId);

    const validated = UpdateProjectAssignmentSchema.parse(input);

    const updated = await db.guildProjectAssignment.update({
      where: { id: assignmentId },
      data: validated,
      include: {
        member: {
          include: {
            user: { select: { displayName: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return {
      id: updated.id,
      memberId: updated.memberId,
      memberName:
        updated.member.user.displayName ||
        `${updated.member.user.firstName} ${updated.member.user.lastName}`,
      role: updated.role,
      allocation: updated.allocation,
      estimatedHours: updated.estimatedHours,
      actualHours: updated.actualHours,
      hoursLogged: updated.hoursLogged,
    };
  }

  /**
   * Log hours for assignment
   */
  async logHours(
    assignmentId: string,
    memberId: string,
    hours: number,
    description?: string
  ): Promise<void> {
    const assignment = await db.guildProjectAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Assignment not found' });
    }

    if (assignment.memberId !== memberId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the assigned member can log hours',
      });
    }

    await db.guildProjectAssignment.update({
      where: { id: assignmentId },
      data: { hoursLogged: { increment: hours } },
    });

    this.log.info({ assignmentId, hours, description }, 'Hours logged');
  }

  /**
   * Add member to project
   */
  async addMemberToProject(
    projectId: string,
    managerId: string,
    assignment: {
      memberId: string;
      role: string;
      allocation: number;
      estimatedHours?: number;
    }
  ): Promise<ProjectAssignment> {
    const project = await db.guildProject.findUnique({
      where: { id: projectId },
      include: { assignments: true },
    });

    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    await this.requireProjectPermission(project.guildId, managerId);

    // Check member is valid
    const member = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId: project.guildId, userId: assignment.memberId } },
      include: {
        user: { select: { displayName: true, firstName: true, lastName: true } },
      },
    });

    if (!member || member.status !== 'ACTIVE') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Member must be an active guild member',
      });
    }

    // Check not already assigned
    const existing = project.assignments.find((a) => a.memberId === assignment.memberId);
    if (existing) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Member is already assigned to this project',
      });
    }

    // Check allocation
    const currentAllocation = project.assignments.reduce((sum, a) => sum + a.allocation, 0);
    if (currentAllocation + assignment.allocation > 100) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Total allocation cannot exceed 100%',
      });
    }

    const created = await db.guildProjectAssignment.create({
      data: {
        guildProjectId: projectId,
        memberId: assignment.memberId,
        role: assignment.role,
        allocation: assignment.allocation,
        estimatedHours: assignment.estimatedHours,
      },
      include: {
        member: {
          include: {
            user: { select: { displayName: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    return {
      id: created.id,
      memberId: created.memberId,
      memberName:
        created.member.user.displayName ||
        `${created.member.user.firstName} ${created.member.user.lastName}`,
      role: created.role,
      allocation: created.allocation,
      estimatedHours: created.estimatedHours,
      actualHours: created.actualHours,
      hoursLogged: created.hoursLogged,
    };
  }

  /**
   * Remove member from project
   */
  async removeMemberFromProject(
    projectId: string,
    managerId: string,
    memberId: string
  ): Promise<void> {
    const project = await db.guildProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    await this.requireProjectPermission(project.guildId, managerId);

    const assignment = await db.guildProjectAssignment.findFirst({
      where: { guildProjectId: projectId, memberId },
    });

    if (!assignment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Member is not assigned to this project',
      });
    }

    await db.guildProjectAssignment.delete({
      where: { id: assignment.id },
    });

    this.log.info({ projectId, memberId }, 'Member removed from project');
  }

  /**
   * Get member's project history
   */
  async getMemberProjectHistory(
    guildId: string,
    memberId: string
  ): Promise<
    {
      project: { id: string; name: string; status: string };
      role: string;
      allocation: number;
      hoursLogged: number;
    }[]
  > {
    const assignments = await db.guildProjectAssignment.findMany({
      where: {
        memberId,
        guildProject: { guildId },
      },
      include: {
        guildProject: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assignments.map((a) => ({
      project: a.guildProject,
      role: a.role,
      allocation: a.allocation,
      hoursLogged: a.hoursLogged,
    }));
  }

  /**
   * Check project permission
   */
  private async requireProjectPermission(guildId: string, userId: string): Promise<void> {
    const membership = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not an active member of this guild',
      });
    }

    const permissions = membership.permissions as Record<string, boolean>;
    if (!permissions.canManageProjects && membership.role !== 'LEADER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to manage projects',
      });
    }
  }
}

export const guildProjectsService = new GuildProjectsService();
