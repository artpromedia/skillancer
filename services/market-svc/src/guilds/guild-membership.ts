// @ts-nocheck
/**
 * Guild Membership Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Handles member invitations, roles, and lifecycle management
 */

import crypto from 'crypto';

import { db } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'ASSOCIATE']).default('MEMBER'),
  message: z.string().max(500).optional(),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'ASSOCIATE']),
  permissions: z
    .object({
      canInvite: z.boolean().optional(),
      canRemove: z.boolean().optional(),
      canManageProjects: z.boolean().optional(),
      canManageFinances: z.boolean().optional(),
    })
    .optional(),
});

export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;

export interface GuildMemberInfo {
  id: string;
  guildId: string;
  userId: string;
  role: 'LEADER' | 'ADMIN' | 'MEMBER' | 'ASSOCIATE';
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEPARTED';
  isPrimary: boolean;
  projectsCompleted: number;
  totalEarned: number;
  joinedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    avatarUrl: string | null;
    verificationLevel: string;
  };
}

// =============================================================================
// ROLE PERMISSIONS
// =============================================================================

const DEFAULT_PERMISSIONS = {
  LEADER: {
    canInvite: true,
    canRemove: true,
    canManageProjects: true,
    canManageFinances: true,
    canDissolve: true,
  },
  ADMIN: {
    canInvite: true,
    canRemove: true,
    canManageProjects: true,
    canManageFinances: true,
    canDissolve: false,
  },
  MEMBER: {
    canInvite: false,
    canRemove: false,
    canManageProjects: false,
    canManageFinances: false,
    canDissolve: false,
  },
  ASSOCIATE: {
    canInvite: false,
    canRemove: false,
    canManageProjects: false,
    canManageFinances: false,
    canDissolve: false,
  },
};

// =============================================================================
// SERVICE
// =============================================================================

export class GuildMembershipService {
  private log = logger.child({ service: 'GuildMembershipService' });

  /**
   * Get all members of a guild
   */
  async getGuildMembers(
    guildId: string,
    options: {
      status?: ('INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DEPARTED')[];
      role?: ('LEADER' | 'ADMIN' | 'MEMBER' | 'ASSOCIATE')[];
    } = {}
  ): Promise<GuildMemberInfo[]> {
    const where: Record<string, unknown> = { guildId };

    if (options.status?.length) {
      where.status = { in: options.status };
    } else {
      where.status = { in: ['INVITED', 'ACTIVE'] };
    }

    if (options.role?.length) {
      where.role = { in: options.role };
    }

    const members = await db.guildMember.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            verificationLevel: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // LEADER first
        { joinedAt: 'asc' },
      ],
    });

    return members.map((m) => ({
      id: m.id,
      guildId: m.guildId,
      userId: m.userId,
      role: m.role,
      status: m.status,
      isPrimary: m.isPrimary,
      projectsCompleted: m.projectsCompleted,
      totalEarned: Number(m.totalEarned),
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  /**
   * Get member by user ID
   */
  async getMember(guildId: string, userId: string): Promise<GuildMemberInfo | null> {
    const member = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            verificationLevel: true,
          },
        },
      },
    });

    if (!member) return null;

    return {
      id: member.id,
      guildId: member.guildId,
      userId: member.userId,
      role: member.role,
      status: member.status,
      isPrimary: member.isPrimary,
      projectsCompleted: member.projectsCompleted,
      totalEarned: Number(member.totalEarned),
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Invite a new member to guild
   */
  async inviteMember(
    guildId: string,
    inviterId: string,
    input: InviteMemberInput
  ): Promise<{ invitationId: string; token: string }> {
    const validated = InviteMemberSchema.parse(input);

    // Check inviter has permission
    await this.requirePermission(guildId, inviterId, 'canInvite');

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email: validated.email },
    });

    // Check if already a member
    if (user) {
      const existing = await db.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId: user.id } },
      });

      if (existing) {
        if (existing.status === 'ACTIVE') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User is already a member of this guild',
          });
        }
        if (existing.status === 'INVITED') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'User has already been invited to this guild',
          });
        }
      }
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invitation
    const invitation = await db.guildInvitation.create({
      data: {
        guildId,
        email: validated.email,
        role: validated.role,
        message: validated.message,
        token,
        expiresAt,
        status: 'PENDING',
      },
    });

    // If user exists, also create member record
    if (user) {
      await db.guildMember.create({
        data: {
          guildId,
          userId: user.id,
          role: validated.role,
          status: 'INVITED',
          permissions: DEFAULT_PERMISSIONS[validated.role],
        },
      });
    }

    this.log.info({ guildId, inviterId, email: validated.email }, 'Member invitation sent');

    return { invitationId: invitation.id, token };
  }

  /**
   * Accept guild invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<GuildMemberInfo> {
    const invitation = await db.guildInvitation.findUnique({
      where: { token },
      include: { guild: true },
    });

    if (!invitation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invitation not found',
      });
    }

    if (invitation.status !== 'PENDING') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invitation has already been used or cancelled',
      });
    }

    if (invitation.expiresAt < new Date()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invitation has expired',
      });
    }

    // Verify user email matches
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This invitation was sent to a different email address',
      });
    }

    // Accept invitation in transaction
    const member = await db.$transaction(async (tx) => {
      // Update invitation
      await tx.guildInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      // Update or create member
      const existingMember = await tx.guildMember.findUnique({
        where: { guildId_userId: { guildId: invitation.guildId, userId } },
      });

      if (existingMember) {
        return tx.guildMember.update({
          where: { id: existingMember.id },
          data: { status: 'ACTIVE' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatarUrl: true,
                verificationLevel: true,
              },
            },
          },
        });
      }

      return tx.guildMember.create({
        data: {
          guildId: invitation.guildId,
          userId,
          role: invitation.role,
          status: 'ACTIVE',
          permissions: DEFAULT_PERMISSIONS[invitation.role],
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
              verificationLevel: true,
            },
          },
        },
      });
    });

    this.log.info({ guildId: invitation.guildId, userId }, 'Member accepted invitation');

    return {
      id: member.id,
      guildId: member.guildId,
      userId: member.userId,
      role: member.role,
      status: member.status,
      isPrimary: member.isPrimary,
      projectsCompleted: member.projectsCompleted,
      totalEarned: Number(member.totalEarned),
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  /**
   * Decline guild invitation
   */
  async declineInvitation(token: string, userId: string): Promise<void> {
    const invitation = await db.guildInvitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.status !== 'PENDING') {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invitation not found or already processed',
      });
    }

    await db.$transaction(async (tx) => {
      await tx.guildInvitation.update({
        where: { id: invitation.id },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });

      // Remove pending member record if exists
      await tx.guildMember.deleteMany({
        where: {
          guildId: invitation.guildId,
          userId,
          status: 'INVITED',
        },
      });
    });

    this.log.info({ guildId: invitation.guildId, userId }, 'Invitation declined');
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    guildId: string,
    adminUserId: string,
    targetUserId: string,
    input: UpdateMemberRoleInput
  ): Promise<GuildMemberInfo> {
    // Check admin has permission
    await this.requirePermission(guildId, adminUserId, 'canRemove');

    // Cannot change leader role
    const target = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: targetUserId } },
    });

    if (!target) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Member not found',
      });
    }

    if (target.role === 'LEADER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot change leader role. Use transfer leadership instead.',
      });
    }

    const validated = UpdateMemberRoleSchema.parse(input);
    const permissions = {
      ...DEFAULT_PERMISSIONS[validated.role],
      ...validated.permissions,
    };

    const updated = await db.guildMember.update({
      where: { guildId_userId: { guildId, userId: targetUserId } },
      data: { role: validated.role, permissions },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            verificationLevel: true,
          },
        },
      },
    });

    this.log.info(
      { guildId, adminUserId, targetUserId, role: validated.role },
      'Member role updated'
    );

    return {
      id: updated.id,
      guildId: updated.guildId,
      userId: updated.userId,
      role: updated.role,
      status: updated.status,
      isPrimary: updated.isPrimary,
      projectsCompleted: updated.projectsCompleted,
      totalEarned: Number(updated.totalEarned),
      joinedAt: updated.joinedAt,
      user: updated.user,
    };
  }

  /**
   * Remove member from guild
   */
  async removeMember(guildId: string, adminUserId: string, targetUserId: string): Promise<void> {
    // Check admin has permission
    await this.requirePermission(guildId, adminUserId, 'canRemove');

    const target = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: targetUserId } },
    });

    if (!target) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Member not found',
      });
    }

    if (target.role === 'LEADER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot remove the guild leader',
      });
    }

    await db.guildMember.update({
      where: { guildId_userId: { guildId, userId: targetUserId } },
      data: { status: 'DEPARTED', leftAt: new Date() },
    });

    this.log.info({ guildId, adminUserId, targetUserId }, 'Member removed');
  }

  /**
   * Leave guild voluntarily
   */
  async leaveGuild(guildId: string, userId: string): Promise<void> {
    const member = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!member) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'You are not a member of this guild',
      });
    }

    if (member.role === 'LEADER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Leader cannot leave. Transfer leadership first.',
      });
    }

    await db.guildMember.update({
      where: { guildId_userId: { guildId, userId } },
      data: { status: 'DEPARTED', leftAt: new Date() },
    });

    this.log.info({ guildId, userId }, 'Member left guild');
  }

  /**
   * Set primary guild
   */
  async setPrimaryGuild(userId: string, guildId: string): Promise<void> {
    // Verify membership
    const member = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!member || member.status !== 'ACTIVE') {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'You are not an active member of this guild',
      });
    }

    await db.$transaction(async (tx) => {
      // Remove primary from all
      await tx.guildMember.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Set new primary
      await tx.guildMember.update({
        where: { guildId_userId: { guildId, userId } },
        data: { isPrimary: true },
      });
    });

    this.log.info({ userId, guildId }, 'Primary guild updated');
  }

  /**
   * Get pending invitations for user
   */
  async getPendingInvitations(email: string): Promise<
    {
      id: string;
      guildId: string;
      guildName: string;
      guildLogo: string | null;
      role: string;
      message: string | null;
      expiresAt: Date;
    }[]
  > {
    const invitations = await db.guildInvitation.findMany({
      where: {
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      include: {
        guild: {
          select: { id: true, name: true, logo: true },
        },
      },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      guildId: inv.guild.id,
      guildName: inv.guild.name,
      guildLogo: inv.guild.logo,
      role: inv.role,
      message: inv.message,
      expiresAt: inv.expiresAt,
    }));
  }

  /**
   * Check permission helper
   */
  private async requirePermission(
    guildId: string,
    userId: string,
    permission: string
  ): Promise<void> {
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
    if (!permissions[permission] && membership.role !== 'LEADER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have ${permission} permission`,
      });
    }
  }
}

export const guildMembershipService = new GuildMembershipService();
