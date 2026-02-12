import { PrismaClient } from '@prisma/client';
import type {
  TeamReunionCreateInput,
  TeamReunionMemberInput,
} from '../types/talent-graph.types.js';
import { TeamReunionStatus } from '../types/talent-graph.types.js';

export class TeamReunionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a team reunion proposal
   */
  async createTeamReunion(input: TeamReunionCreateInput) {
    const reunion = await this.prisma.teamReunion.create({
      data: {
        creatorId: input.creatorId,
        name: input.name,
        description: input.description,
        company: input.company,
        projectName: input.projectName,
        projectDescription: input.projectDescription,
        proposedBudget: input.proposedBudget,
        proposedTimeline: input.proposedTimeline,
        requiredSkills: input.requiredSkills || [],
        status: 'PROPOSED',
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Add creator as first member
    await this.prisma.teamReunionMember.create({
      data: {
        teamReunionId: reunion.id,
        userId: input.creatorId,
        role: 'CREATOR',
        status: 'CONFIRMED',
        joinedAt: new Date(),
      },
    });

    return reunion;
  }

  /**
   * Get team reunion by ID
   */
  async getTeamReunionById(id: string) {
    const reunion = await this.prisma.teamReunion.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        members: {
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
      },
    });

    return reunion;
  }

  /**
   * Invite member to team reunion
   */
  async inviteMember(input: TeamReunionMemberInput, inviterId: string) {
    const reunion = await this.prisma.teamReunion.findUnique({
      where: { id: input.teamReunionId },
    });

    if (!reunion) {
      throw new Error('Team reunion not found');
    }

    // Check if inviter is part of the team
    const inviterMembership = await this.prisma.teamReunionMember.findFirst({
      where: {
        teamReunionId: input.teamReunionId,
        userId: inviterId,
        status: 'CONFIRMED',
      },
    });

    if (!inviterMembership) {
      throw new Error('Only team members can invite others');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.teamReunionMember.findFirst({
      where: {
        teamReunionId: input.teamReunionId,
        userId: input.userId,
      },
    });

    if (existingMembership) {
      throw new Error('User is already a member or has been invited');
    }

    // Verify work relationship exists
    const relationship = await this.prisma.workRelationship.findFirst({
      where: {
        company: reunion.company,
        OR: [
          { userId: inviterId, relatedUserId: input.userId },
          { userId: input.userId, relatedUserId: inviterId },
        ],
      },
    });

    if (!relationship) {
      throw new Error('Can only invite former colleagues from the same company');
    }

    const membership = await this.prisma.teamReunionMember.create({
      data: {
        teamReunionId: input.teamReunionId,
        userId: input.userId,
        invitedBy: inviterId,
        proposedRole: input.proposedRole,
        status: 'INVITED',
        inviteMessage: input.message,
      },
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
    });

    return membership;
  }

  /**
   * Respond to team reunion invitation
   */
  async respondToInvitation(
    teamReunionId: string,
    userId: string,
    accept: boolean,
    message?: string
  ) {
    const membership = await this.prisma.teamReunionMember.findFirst({
      where: {
        teamReunionId,
        userId,
        status: 'INVITED',
      },
    });

    if (!membership) {
      throw new Error('Invitation not found');
    }

    const updated = await this.prisma.teamReunionMember.update({
      where: { id: membership.id },
      data: {
        status: accept ? 'ACCEPTED' : 'DECLINED',
        responseMessage: message,
        respondedAt: new Date(),
      },
    });

    // Check if all invited members have responded and update status
    await this.updateReunionStatus(teamReunionId);

    return updated;
  }

  /**
   * Confirm participation
   */
  async confirmParticipation(teamReunionId: string, userId: string, role?: string) {
    const membership = await this.prisma.teamReunionMember.findFirst({
      where: {
        teamReunionId,
        userId,
        status: 'ACCEPTED',
      },
    });

    if (!membership) {
      throw new Error('Accepted membership not found');
    }

    const updated = await this.prisma.teamReunionMember.update({
      where: { id: membership.id },
      data: {
        status: 'CONFIRMED',
        role: role || membership.proposedRole,
        joinedAt: new Date(),
      },
    });

    await this.updateReunionStatus(teamReunionId);

    return updated;
  }

  /**
   * Update reunion status based on member states
   */
  private async updateReunionStatus(teamReunionId: string) {
    const members = await this.prisma.teamReunionMember.findMany({
      where: { teamReunionId },
    });

    const confirmedCount = members.filter((m: { status: string }) => m.status === 'CONFIRMED').length;
    const pendingCount = members.filter((m: { status: string }) => m.status === 'INVITED').length;

    let newStatus: TeamReunionStatus = TeamReunionStatus.PROPOSED;

    if (confirmedCount >= 3 && pendingCount === 0) {
      newStatus = TeamReunionStatus.CONFIRMED;
    } else if (confirmedCount >= 2) {
      newStatus = TeamReunionStatus.PROPOSED; // Still gathering team
    }

    await this.prisma.teamReunion.update({
      where: { id: teamReunionId },
      data: { status: newStatus },
    });
  }

  /**
   * Activate team reunion (convert to active project)
   */
  async activateReunion(teamReunionId: string, creatorId: string) {
    const reunion = await this.prisma.teamReunion.findUnique({
      where: { id: teamReunionId },
    });

    if (!reunion) {
      throw new Error('Team reunion not found');
    }

    if (reunion.creatorId !== creatorId) {
      throw new Error('Only the creator can activate the reunion');
    }

    if (reunion.status !== 'CONFIRMED') {
      throw new Error('Team reunion must be confirmed before activation');
    }

    const updated = await this.prisma.teamReunion.update({
      where: { id: teamReunionId },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Complete team reunion
   */
  async completeReunion(teamReunionId: string, creatorId: string) {
    const reunion = await this.prisma.teamReunion.findUnique({
      where: { id: teamReunionId },
    });

    if (!reunion) {
      throw new Error('Team reunion not found');
    }

    if (reunion.creatorId !== creatorId) {
      throw new Error('Only the creator can complete the reunion');
    }

    const updated = await this.prisma.teamReunion.update({
      where: { id: teamReunionId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get user's team reunions
   */
  async getUserTeamReunions(userId: string, status?: TeamReunionStatus, page = 1, limit = 20) {
    const membershipWhere: any = { userId };
    if (status) {
      membershipWhere.teamReunion = { status };
    }

    const memberships = await this.prisma.teamReunionMember.findMany({
      where: membershipWhere,
      include: {
        teamReunion: {
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
            members: {
              where: { status: { in: ['CONFIRMED', 'ACCEPTED'] } },
              select: {
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
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await this.prisma.teamReunionMember.count({ where: membershipWhere });

    return {
      reunions: memberships.map((m: { teamReunion: unknown; role?: string; proposedRole?: string; status: string }) => ({
        ...m.teamReunion as object,
        userRole: m.role || m.proposedRole,
        userStatus: m.status,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userId: string) {
    const invitations = await this.prisma.teamReunionMember.findMany({
      where: {
        userId,
        status: 'INVITED',
      },
      include: {
        teamReunion: {
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        invitedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  /**
   * Suggest former colleagues for a team reunion
   */
  async suggestColleagues(userId: string, company: string, limit = 10) {
    const relationships = await this.prisma.workRelationship.findMany({
      where: {
        company,
        OR: [{ userId }, { relatedUserId: userId }],
        verified: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            profile: {
              select: {
                skills: true,
                title: true,
              },
            },
          },
        },
        relatedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            profile: {
              select: {
                skills: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { strength: 'desc' },
      take: limit,
    });

    type RelationshipWithUsers = {
      userId: string;
      user: { id: string; firstName: string; lastName: string; avatarUrl?: string | null; profile?: { title?: string; skills?: string[] } | null };
      relatedUser: { id: string; firstName: string; lastName: string; avatarUrl?: string | null; profile?: { title?: string; skills?: string[] } | null };
      relationshipType: string;
      strength: string;
      startDate: Date;
      endDate?: Date | null;
    };
    return (relationships as unknown as RelationshipWithUsers[]).map((rel) => {
      const colleague = rel.userId === userId ? rel.relatedUser : rel.user;
      return {
        userId: colleague.id,
        name: `${colleague.firstName} ${colleague.lastName}`,
        avatarUrl: colleague.avatarUrl,
        title: colleague.profile?.title,
        skills: colleague.profile?.skills || [],
        relationshipType: rel.relationshipType,
        strength: rel.strength,
        workDuration: this.calculateWorkDuration(rel.startDate, rel.endDate ?? null),
      };
    });
  }

  /**
   * Cancel team reunion
   */
  async cancelReunion(teamReunionId: string, creatorId: string, reason?: string) {
    const reunion = await this.prisma.teamReunion.findUnique({
      where: { id: teamReunionId },
    });

    if (!reunion) {
      throw new Error('Team reunion not found');
    }

    if (reunion.creatorId !== creatorId) {
      throw new Error('Only the creator can cancel the reunion');
    }

    const updated = await this.prisma.teamReunion.update({
      where: { id: teamReunionId },
      data: {
        status: 'CANCELLED',
      },
    });

    return updated;
  }

  /**
   * Leave team reunion
   */
  async leaveReunion(teamReunionId: string, userId: string) {
    const membership = await this.prisma.teamReunionMember.findFirst({
      where: {
        teamReunionId,
        userId,
        role: { not: 'CREATOR' },
      },
    });

    if (!membership) {
      throw new Error('Membership not found or you are the creator');
    }

    await this.prisma.teamReunionMember.delete({ where: { id: membership.id } });

    return { success: true };
  }

  // Helper methods
  private calculateWorkDuration(startDate: Date, endDate: Date | null): string {
    const end = endDate || new Date();
    const months =
      (end.getFullYear() - startDate.getFullYear()) * 12 + (end.getMonth() - startDate.getMonth());

    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return remainingMonths > 0
        ? `${years} year${years > 1 ? 's' : ''} ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`
        : `${years} year${years > 1 ? 's' : ''}`;
    }

    return `${months} month${months > 1 ? 's' : ''}`;
  }
}
