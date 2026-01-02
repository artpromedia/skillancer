// @ts-nocheck
/**
 * Guild Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Core guild management: creation, updates, verification, and dissolution
 */

import crypto from 'crypto';

import { db } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { TRPCError } from '@trpc/server';
import slugify from 'slugify';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export const CreateGuildSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  tagline: z.string().max(300).optional(),
  logo: z.string().url().optional(),
  specializations: z.array(z.string()).max(10).default([]),
  technologies: z.array(z.string()).max(20).default([]),
  settings: z
    .object({
      defaultRevenueSplit: z.enum(['EQUAL', 'ROLE_BASED', 'CUSTOM']).default('EQUAL'),
      memberApprovalRequired: z.boolean().default(true),
      minVerificationLevel: z.enum(['NONE', 'EMAIL', 'BASIC', 'ENHANCED']).default('BASIC'),
      guildFeePercent: z.number().min(0).max(30).default(0),
      treasuryEnabled: z.boolean().default(false),
    })
    .default({}),
  foundingMembers: z.array(z.string().uuid()).min(1).max(9), // Creator + up to 9 others
});

export const UpdateGuildSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  tagline: z.string().max(300).optional(),
  logo: z.string().url().optional(),
  specializations: z.array(z.string()).max(10).optional(),
  technologies: z.array(z.string()).max(20).optional(),
  settings: z
    .object({
      defaultRevenueSplit: z.enum(['EQUAL', 'ROLE_BASED', 'CUSTOM']).optional(),
      memberApprovalRequired: z.boolean().optional(),
      minVerificationLevel: z.enum(['NONE', 'EMAIL', 'BASIC', 'ENHANCED']).optional(),
      guildFeePercent: z.number().min(0).max(30).optional(),
      treasuryEnabled: z.boolean().optional(),
    })
    .optional(),
});

export type CreateGuildInput = z.infer<typeof CreateGuildSchema>;
export type UpdateGuildInput = z.infer<typeof UpdateGuildSchema>;

export interface GuildWithMembers {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tagline: string | null;
  logo: string | null;
  specializations: string[];
  technologies: string[];
  isVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISSOLVED';
  rating: number;
  projectCount: number;
  totalEarnings: number;
  memberCount: number;
  createdAt: Date;
}

// =============================================================================
// SERVICE
// =============================================================================

export class GuildService {
  private log = logger.child({ service: 'GuildService' });

  /**
   * Generate unique slug for guild
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = slugify(name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (await db.guild.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Create a new guild
   */
  async createGuild(creatorId: string, input: CreateGuildInput): Promise<GuildWithMembers> {
    const validated = CreateGuildSchema.parse(input);

    this.log.info({ creatorId, name: validated.name }, 'Creating new guild');

    // Generate unique slug
    const slug = await this.generateUniqueSlug(validated.name);

    // Create guild with founding members in transaction
    const guild = await db.$transaction(async (tx) => {
      // Create the guild
      const newGuild = await tx.guild.create({
        data: {
          slug,
          name: validated.name,
          description: validated.description,
          tagline: validated.tagline,
          logo: validated.logo,
          specializations: validated.specializations,
          technologies: validated.technologies,
          settings: validated.settings,
          status: 'ACTIVE',
        },
      });

      // Add creator as leader
      await tx.guildMember.create({
        data: {
          guildId: newGuild.id,
          userId: creatorId,
          role: 'LEADER',
          status: 'ACTIVE',
          isPrimary: true,
          permissions: {
            canInvite: true,
            canRemove: true,
            canManageProjects: true,
            canManageFinances: true,
            canDissolve: true,
          },
        },
      });

      // Send invitations to founding members
      for (const memberId of validated.foundingMembers) {
        if (memberId !== creatorId) {
          await tx.guildMember.create({
            data: {
              guildId: newGuild.id,
              userId: memberId,
              role: 'MEMBER',
              status: 'INVITED',
              isPrimary: false,
              permissions: {
                canInvite: false,
                canRemove: false,
                canManageProjects: false,
                canManageFinances: false,
                canDissolve: false,
              },
            },
          });
        }
      }

      // Create treasury if enabled
      if (validated.settings.treasuryEnabled) {
        await tx.guildTreasury.create({
          data: {
            guildId: newGuild.id,
            balance: 0,
            currency: 'USD',
            settings: {
              spendingLimits: {
                MEMBER: 0,
                ADMIN: 1000,
                LEADER: -1, // Unlimited
              },
              approvalThreshold: 500,
            },
          },
        });
      }

      return newGuild;
    });

    const memberCount = await db.guildMember.count({
      where: { guildId: guild.id },
    });

    return {
      id: guild.id,
      slug: guild.slug,
      name: guild.name,
      description: guild.description,
      tagline: guild.tagline,
      logo: guild.logo,
      specializations: guild.specializations,
      technologies: guild.technologies,
      isVerified: guild.isVerified,
      status: guild.status,
      rating: Number(guild.rating),
      projectCount: guild.projectCount,
      totalEarnings: Number(guild.totalEarnings),
      memberCount,
      createdAt: guild.createdAt,
    };
  }

  /**
   * Get guild by ID
   */
  async getGuildById(guildId: string): Promise<GuildWithMembers | null> {
    const guild = await db.guild.findUnique({
      where: { id: guildId, deletedAt: null },
      include: {
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      },
    });

    if (!guild) return null;

    return {
      id: guild.id,
      slug: guild.slug,
      name: guild.name,
      description: guild.description,
      tagline: guild.tagline,
      logo: guild.logo,
      specializations: guild.specializations,
      technologies: guild.technologies,
      isVerified: guild.isVerified,
      status: guild.status,
      rating: Number(guild.rating),
      projectCount: guild.projectCount,
      totalEarnings: Number(guild.totalEarnings),
      memberCount: guild._count.members,
      createdAt: guild.createdAt,
    };
  }

  /**
   * Get guild by slug (for public profile)
   */
  async getGuildBySlug(slug: string): Promise<GuildWithMembers | null> {
    const guild = await db.guild.findUnique({
      where: { slug, deletedAt: null },
      include: {
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      },
    });

    if (!guild) return null;

    return {
      id: guild.id,
      slug: guild.slug,
      name: guild.name,
      description: guild.description,
      tagline: guild.tagline,
      logo: guild.logo,
      specializations: guild.specializations,
      technologies: guild.technologies,
      isVerified: guild.isVerified,
      status: guild.status,
      rating: Number(guild.rating),
      projectCount: guild.projectCount,
      totalEarnings: Number(guild.totalEarnings),
      memberCount: guild._count.members,
      createdAt: guild.createdAt,
    };
  }

  /**
   * Update guild
   */
  async updateGuild(
    guildId: string,
    userId: string,
    input: UpdateGuildInput
  ): Promise<GuildWithMembers> {
    // Check permissions
    await this.requirePermission(guildId, userId, 'canManageProjects');

    const validated = UpdateGuildSchema.parse(input);

    const guild = await db.guild.update({
      where: { id: guildId },
      data: {
        name: validated.name,
        description: validated.description,
        tagline: validated.tagline,
        logo: validated.logo,
        specializations: validated.specializations,
        technologies: validated.technologies,
        settings: validated.settings,
      },
      include: {
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      },
    });

    this.log.info({ guildId, userId }, 'Guild updated');

    return {
      id: guild.id,
      slug: guild.slug,
      name: guild.name,
      description: guild.description,
      tagline: guild.tagline,
      logo: guild.logo,
      specializations: guild.specializations,
      technologies: guild.technologies,
      isVerified: guild.isVerified,
      status: guild.status,
      rating: Number(guild.rating),
      projectCount: guild.projectCount,
      totalEarnings: Number(guild.totalEarnings),
      memberCount: guild._count.members,
      createdAt: guild.createdAt,
    };
  }

  /**
   * Dissolve guild (soft delete)
   */
  async dissolveGuild(guildId: string, userId: string): Promise<void> {
    // Only leader can dissolve
    const membership = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!membership || membership.role !== 'LEADER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the guild leader can dissolve the guild',
      });
    }

    await db.$transaction(async (tx) => {
      // Update all members to departed
      await tx.guildMember.updateMany({
        where: { guildId },
        data: { status: 'DEPARTED', leftAt: new Date() },
      });

      // Mark guild as dissolved
      await tx.guild.update({
        where: { id: guildId },
        data: {
          status: 'DISSOLVED',
          deletedAt: new Date(),
        },
      });
    });

    this.log.info({ guildId, userId }, 'Guild dissolved');
  }

  /**
   * Transfer leadership
   */
  async transferLeadership(
    guildId: string,
    currentLeaderId: string,
    newLeaderId: string
  ): Promise<void> {
    // Verify current leader
    const currentLeader = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: currentLeaderId } },
    });

    if (!currentLeader || currentLeader.role !== 'LEADER') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the current leader can transfer leadership',
      });
    }

    // Verify new leader is active member
    const newLeader = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: newLeaderId } },
    });

    if (!newLeader || newLeader.status !== 'ACTIVE') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'New leader must be an active guild member',
      });
    }

    await db.$transaction(async (tx) => {
      // Demote current leader to admin
      await tx.guildMember.update({
        where: { guildId_userId: { guildId, userId: currentLeaderId } },
        data: {
          role: 'ADMIN',
          permissions: {
            canInvite: true,
            canRemove: true,
            canManageProjects: true,
            canManageFinances: true,
            canDissolve: false,
          },
        },
      });

      // Promote new leader
      await tx.guildMember.update({
        where: { guildId_userId: { guildId, userId: newLeaderId } },
        data: {
          role: 'LEADER',
          permissions: {
            canInvite: true,
            canRemove: true,
            canManageProjects: true,
            canManageFinances: true,
            canDissolve: true,
          },
        },
      });
    });

    this.log.info({ guildId, currentLeaderId, newLeaderId }, 'Leadership transferred');
  }

  /**
   * List guilds with filters (for discovery)
   */
  async listGuilds(options: {
    search?: string;
    specializations?: string[];
    minRating?: number;
    minMembers?: number;
    maxMembers?: number;
    isVerified?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<{ guilds: GuildWithMembers[]; nextCursor?: string }> {
    const limit = Math.min(options.limit || 20, 50);

    const where: Record<string, unknown> = {
      status: 'ACTIVE',
      deletedAt: null,
    };

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
        { tagline: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options.specializations?.length) {
      where.specializations = { hasSome: options.specializations };
    }

    if (options.minRating) {
      where.rating = { gte: options.minRating };
    }

    if (options.isVerified !== undefined) {
      where.isVerified = options.isVerified;
    }

    const guilds = await db.guild.findMany({
      where,
      include: {
        _count: { select: { members: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: [{ rating: 'desc' }, { projectCount: 'desc' }],
      take: limit + 1,
      cursor: options.cursor ? { id: options.cursor } : undefined,
      skip: options.cursor ? 1 : 0,
    });

    const hasMore = guilds.length > limit;
    const results = hasMore ? guilds.slice(0, -1) : guilds;

    // Filter by member count if needed
    let filteredResults = results;
    if (options.minMembers || options.maxMembers) {
      filteredResults = results.filter((g) => {
        const count = g._count.members;
        if (options.minMembers && count < options.minMembers) return false;
        if (options.maxMembers && count > options.maxMembers) return false;
        return true;
      });
    }

    return {
      guilds: filteredResults.map((guild) => ({
        id: guild.id,
        slug: guild.slug,
        name: guild.name,
        description: guild.description,
        tagline: guild.tagline,
        logo: guild.logo,
        specializations: guild.specializations,
        technologies: guild.technologies,
        isVerified: guild.isVerified,
        status: guild.status,
        rating: Number(guild.rating),
        projectCount: guild.projectCount,
        totalEarnings: Number(guild.totalEarnings),
        memberCount: guild._count.members,
        createdAt: guild.createdAt,
      })),
      nextCursor: hasMore ? results[results.length - 1]?.id : undefined,
    };
  }

  /**
   * Get user's guilds
   */
  async getUserGuilds(userId: string): Promise<GuildWithMembers[]> {
    const memberships = await db.guildMember.findMany({
      where: {
        userId,
        status: { in: ['ACTIVE', 'INVITED'] },
      },
      include: {
        guild: {
          include: {
            _count: { select: { members: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
      orderBy: { isPrimary: 'desc' },
    });

    return memberships
      .filter((m) => m.guild.status === 'ACTIVE')
      .map((m) => ({
        id: m.guild.id,
        slug: m.guild.slug,
        name: m.guild.name,
        description: m.guild.description,
        tagline: m.guild.tagline,
        logo: m.guild.logo,
        specializations: m.guild.specializations,
        technologies: m.guild.technologies,
        isVerified: m.guild.isVerified,
        status: m.guild.status,
        rating: Number(m.guild.rating),
        projectCount: m.guild.projectCount,
        totalEarnings: Number(m.guild.totalEarnings),
        memberCount: m.guild._count.members,
        createdAt: m.guild.createdAt,
      }));
  }

  /**
   * Check if user has specific permission in guild
   */
  async requirePermission(guildId: string, userId: string, permission: string): Promise<void> {
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
        message: `You do not have ${permission} permission in this guild`,
      });
    }
  }

  /**
   * Verify guild (admin action)
   */
  async verifyGuild(guildId: string): Promise<void> {
    // Check all active members are verified
    const members = await db.guildMember.findMany({
      where: { guildId, status: 'ACTIVE' },
      include: { user: true },
    });

    const allVerified = members.every((m) => m.user.verificationLevel !== 'NONE');

    if (!allVerified) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All active members must be verified before guild verification',
      });
    }

    await db.guild.update({
      where: { id: guildId },
      data: { isVerified: true },
    });

    this.log.info({ guildId }, 'Guild verified');
  }
}

export const guildService = new GuildService();

