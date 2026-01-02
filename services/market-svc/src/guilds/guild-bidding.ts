// @ts-nocheck
/**
 * Guild Bidding Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Handles guild-level proposals and bidding logic
 */

import { db } from '@skillancer/database';
import { logger } from '@skillancer/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export const CreateGuildProposalSchema = z.object({
  projectListingId: z.string().uuid(),
  coverLetter: z.string().min(50).max(5000),
  proposedBudget: z.number().positive(),
  proposedTimeline: z.number().int().positive(), // Days
  proposedTeam: z.array(
    z.object({
      memberId: z.string().uuid(),
      role: z.string().min(1).max(100),
      allocation: z.number().min(0).max(100),
      hourlyRate: z.number().positive().optional(),
    })
  ),
  milestones: z
    .array(
      z.object({
        title: z.string().min(3).max(200),
        description: z.string().max(1000).optional(),
        deliverables: z.array(z.string()).optional(),
        dueInDays: z.number().int().positive(),
        amount: z.number().positive(),
      })
    )
    .optional(),
  attachments: z.array(z.string().url()).optional(),
});

export const UpdateGuildProposalSchema = CreateGuildProposalSchema.partial().extend({
  status: z.enum(['SUBMITTED', 'WITHDRAWN']).optional(),
});

export type CreateGuildProposalInput = z.infer<typeof CreateGuildProposalSchema>;
export type UpdateGuildProposalInput = z.infer<typeof UpdateGuildProposalSchema>;

export interface GuildProposalInfo {
  id: string;
  guildId: string;
  guildName: string;
  guildLogo: string | null;
  projectListingId: string;
  coverLetter: string;
  proposedBudget: number;
  proposedTimeline: number;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  submittedAt: Date | null;
  proposedTeam: {
    memberId: string;
    memberName: string;
    role: string;
    allocation: number;
    hourlyRate: number | null;
  }[];
  milestones:
    | {
        title: string;
        description: string | null;
        deliverables: string[] | null;
        dueInDays: number;
        amount: number;
      }[]
    | null;
}

// =============================================================================
// SERVICE
// =============================================================================

export class GuildBiddingService {
  private log = logger.child({ service: 'GuildBiddingService' });

  /**
   * Create a guild proposal
   */
  async createProposal(
    guildId: string,
    submitterId: string,
    input: CreateGuildProposalInput
  ): Promise<GuildProposalInfo> {
    const validated = CreateGuildProposalSchema.parse(input);

    // Verify submitter has permission
    await this.requireBiddingPermission(guildId, submitterId);

    // Verify guild is active
    const guild = await db.guild.findUnique({
      where: { id: guildId },
      select: { status: true, name: true, logo: true },
    });

    if (!guild || guild.status !== 'ACTIVE') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Guild must be active to submit proposals',
      });
    }

    // Verify all team members are active guild members
    const memberIds = validated.proposedTeam.map((m) => m.memberId);
    const members = await db.guildMember.findMany({
      where: {
        guildId,
        userId: { in: memberIds },
        status: 'ACTIVE',
      },
      include: {
        user: { select: { displayName: true, firstName: true, lastName: true } },
      },
    });

    if (members.length !== memberIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All proposed team members must be active guild members',
      });
    }

    // Validate total allocation
    const totalAllocation = validated.proposedTeam.reduce((sum, m) => sum + m.allocation, 0);
    if (totalAllocation > 100) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Total team allocation cannot exceed 100%',
      });
    }

    // Check for existing proposal from this guild
    const existingProposal = await db.guildProposal.findFirst({
      where: {
        guildId,
        projectListingId: validated.projectListingId,
        status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'] },
      },
    });

    if (existingProposal) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Guild already has an active proposal for this project',
      });
    }

    // Build team data with member names
    const teamData = validated.proposedTeam.map((t) => {
      const member = members.find((m) => m.userId === t.memberId)!;
      return {
        memberId: t.memberId,
        memberName: member.user.displayName || `${member.user.firstName} ${member.user.lastName}`,
        role: t.role,
        allocation: t.allocation,
        hourlyRate: t.hourlyRate ?? null,
      };
    });

    // Create proposal
    const proposal = await db.guildProposal.create({
      data: {
        guildId,
        projectListingId: validated.projectListingId,
        submittedById: submitterId,
        coverLetter: validated.coverLetter,
        proposedBudget: validated.proposedBudget,
        proposedTimeline: validated.proposedTimeline,
        proposedTeam: teamData,
        milestones: validated.milestones ?? null,
        attachments: validated.attachments ?? [],
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    this.log.info(
      { guildId, projectListingId: validated.projectListingId, proposalId: proposal.id },
      'Guild proposal created'
    );

    return {
      id: proposal.id,
      guildId,
      guildName: guild.name,
      guildLogo: guild.logo,
      projectListingId: proposal.projectListingId,
      coverLetter: proposal.coverLetter,
      proposedBudget: Number(proposal.proposedBudget),
      proposedTimeline: proposal.proposedTimeline,
      status: proposal.status,
      submittedAt: proposal.submittedAt,
      proposedTeam: teamData,
      milestones: validated.milestones ?? null,
    };
  }

  /**
   * Get proposal by ID
   */
  async getProposal(proposalId: string): Promise<GuildProposalInfo> {
    const proposal = await db.guildProposal.findUnique({
      where: { id: proposalId },
      include: {
        guild: { select: { name: true, logo: true } },
      },
    });

    if (!proposal) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Proposal not found',
      });
    }

    return {
      id: proposal.id,
      guildId: proposal.guildId,
      guildName: proposal.guild.name,
      guildLogo: proposal.guild.logo,
      projectListingId: proposal.projectListingId,
      coverLetter: proposal.coverLetter,
      proposedBudget: Number(proposal.proposedBudget),
      proposedTimeline: proposal.proposedTimeline,
      status: proposal.status,
      submittedAt: proposal.submittedAt,
      proposedTeam: proposal.proposedTeam as GuildProposalInfo['proposedTeam'],
      milestones: proposal.milestones as GuildProposalInfo['milestones'],
    };
  }

  /**
   * List proposals for a guild
   */
  async listGuildProposals(
    guildId: string,
    options: {
      status?: ('DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN')[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ proposals: GuildProposalInfo[]; total: number }> {
    const where: Record<string, unknown> = { guildId };

    if (options.status?.length) {
      where.status = { in: options.status };
    }

    const [proposals, total] = await Promise.all([
      db.guildProposal.findMany({
        where,
        include: {
          guild: { select: { name: true, logo: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 20,
        skip: options.offset ?? 0,
      }),
      db.guildProposal.count({ where }),
    ]);

    return {
      proposals: proposals.map((p) => ({
        id: p.id,
        guildId: p.guildId,
        guildName: p.guild.name,
        guildLogo: p.guild.logo,
        projectListingId: p.projectListingId,
        coverLetter: p.coverLetter,
        proposedBudget: Number(p.proposedBudget),
        proposedTimeline: p.proposedTimeline,
        status: p.status,
        submittedAt: p.submittedAt,
        proposedTeam: p.proposedTeam as GuildProposalInfo['proposedTeam'],
        milestones: p.milestones as GuildProposalInfo['milestones'],
      })),
      total,
    };
  }

  /**
   * List proposals for a project listing
   */
  async listProjectProposals(
    projectListingId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ proposals: GuildProposalInfo[]; total: number }> {
    const where = {
      projectListingId,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] as const },
    };

    const [proposals, total] = await Promise.all([
      db.guildProposal.findMany({
        where,
        include: {
          guild: { select: { name: true, logo: true, combinedRating: true, totalReviews: true } },
        },
        orderBy: { submittedAt: 'asc' },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      db.guildProposal.count({ where }),
    ]);

    return {
      proposals: proposals.map((p) => ({
        id: p.id,
        guildId: p.guildId,
        guildName: p.guild.name,
        guildLogo: p.guild.logo,
        projectListingId: p.projectListingId,
        coverLetter: p.coverLetter,
        proposedBudget: Number(p.proposedBudget),
        proposedTimeline: p.proposedTimeline,
        status: p.status,
        submittedAt: p.submittedAt,
        proposedTeam: p.proposedTeam as GuildProposalInfo['proposedTeam'],
        milestones: p.milestones as GuildProposalInfo['milestones'],
      })),
      total,
    };
  }

  /**
   * Update proposal
   */
  async updateProposal(
    proposalId: string,
    userId: string,
    input: UpdateGuildProposalInput
  ): Promise<GuildProposalInfo> {
    const proposal = await db.guildProposal.findUnique({
      where: { id: proposalId },
      include: { guild: { select: { name: true, logo: true } } },
    });

    if (!proposal) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
    }

    await this.requireBiddingPermission(proposal.guildId, userId);

    // Can only update draft/submitted proposals
    if (!['DRAFT', 'SUBMITTED'].includes(proposal.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot update proposal in current status',
      });
    }

    const validated = UpdateGuildProposalSchema.parse(input);

    // If updating team, validate members
    let teamData = proposal.proposedTeam as GuildProposalInfo['proposedTeam'];
    if (validated.proposedTeam) {
      const memberIds = validated.proposedTeam.map((m) => m.memberId);
      const members = await db.guildMember.findMany({
        where: {
          guildId: proposal.guildId,
          userId: { in: memberIds },
          status: 'ACTIVE',
        },
        include: {
          user: { select: { displayName: true, firstName: true, lastName: true } },
        },
      });

      if (members.length !== memberIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'All proposed team members must be active guild members',
        });
      }

      teamData = validated.proposedTeam.map((t) => {
        const member = members.find((m) => m.userId === t.memberId)!;
        return {
          memberId: t.memberId,
          memberName: member.user.displayName || `${member.user.firstName} ${member.user.lastName}`,
          role: t.role,
          allocation: t.allocation,
          hourlyRate: t.hourlyRate ?? null,
        };
      });
    }

    const updated = await db.guildProposal.update({
      where: { id: proposalId },
      data: {
        coverLetter: validated.coverLetter,
        proposedBudget: validated.proposedBudget,
        proposedTimeline: validated.proposedTimeline,
        proposedTeam: teamData,
        milestones: validated.milestones,
        attachments: validated.attachments,
        status: validated.status,
      },
      include: { guild: { select: { name: true, logo: true } } },
    });

    this.log.info({ proposalId }, 'Guild proposal updated');

    return {
      id: updated.id,
      guildId: updated.guildId,
      guildName: updated.guild.name,
      guildLogo: updated.guild.logo,
      projectListingId: updated.projectListingId,
      coverLetter: updated.coverLetter,
      proposedBudget: Number(updated.proposedBudget),
      proposedTimeline: updated.proposedTimeline,
      status: updated.status,
      submittedAt: updated.submittedAt,
      proposedTeam: updated.proposedTeam as GuildProposalInfo['proposedTeam'],
      milestones: updated.milestones as GuildProposalInfo['milestones'],
    };
  }

  /**
   * Withdraw proposal
   */
  async withdrawProposal(proposalId: string, userId: string): Promise<void> {
    const proposal = await db.guildProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
    }

    await this.requireBiddingPermission(proposal.guildId, userId);

    if (['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(proposal.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot withdraw proposal in current status',
      });
    }

    await db.guildProposal.update({
      where: { id: proposalId },
      data: { status: 'WITHDRAWN' },
    });

    this.log.info({ proposalId }, 'Guild proposal withdrawn');
  }

  /**
   * Accept proposal (by client)
   */
  async acceptProposal(proposalId: string, clientId: string): Promise<GuildProposalInfo> {
    const proposal = await db.guildProposal.findUnique({
      where: { id: proposalId },
      include: { guild: { select: { name: true, logo: true } } },
    });

    if (!proposal) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
    }

    // Verify client owns the project
    // TODO: Add project listing ownership check

    if (proposal.status !== 'SUBMITTED' && proposal.status !== 'UNDER_REVIEW') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Can only accept submitted proposals',
      });
    }

    // Accept this proposal and reject others
    await db.$transaction(async (tx) => {
      await tx.guildProposal.update({
        where: { id: proposalId },
        data: { status: 'ACCEPTED' },
      });

      await tx.guildProposal.updateMany({
        where: {
          projectListingId: proposal.projectListingId,
          id: { not: proposalId },
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        },
        data: { status: 'REJECTED' },
      });
    });

    this.log.info({ proposalId, guildId: proposal.guildId }, 'Guild proposal accepted');

    return {
      id: proposal.id,
      guildId: proposal.guildId,
      guildName: proposal.guild.name,
      guildLogo: proposal.guild.logo,
      projectListingId: proposal.projectListingId,
      coverLetter: proposal.coverLetter,
      proposedBudget: Number(proposal.proposedBudget),
      proposedTimeline: proposal.proposedTimeline,
      status: 'ACCEPTED',
      submittedAt: proposal.submittedAt,
      proposedTeam: proposal.proposedTeam as GuildProposalInfo['proposedTeam'],
      milestones: proposal.milestones as GuildProposalInfo['milestones'],
    };
  }

  /**
   * Check bidding permission
   */
  private async requireBiddingPermission(guildId: string, userId: string): Promise<void> {
    const membership = await db.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not an active member of this guild',
      });
    }

    // Leaders, admins can always bid. Members need permission.
    if (membership.role === 'ASSOCIATE') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Associates cannot submit proposals',
      });
    }
  }
}

export const guildBiddingService = new GuildBiddingService();

