// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/market-milestone-link
 * Market Milestone Link data access layer
 */

import type {
  PrismaClient,
  MarketMilestoneLink,
  MarketMilestoneLinkStatus,
} from '../types/prisma-shim.js';

export interface CreateMilestoneLinkParams {
  contractLinkId: string;
  marketMilestoneId: string;
  projectMilestoneId?: string | null;
  title: string;
  amount: number;
  status: MarketMilestoneLinkStatus;
  dueDate?: Date | null;
  lastSyncedAt: Date;
}

export interface UpdateMilestoneLinkParams {
  projectMilestoneId?: string | null;
  title?: string;
  amount?: number;
  status?: MarketMilestoneLinkStatus;
  dueDate?: Date | null;
  lastSyncedAt?: Date;
}

export class MarketMilestoneLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new milestone link
   */
  async create(data: CreateMilestoneLinkParams): Promise<MarketMilestoneLink> {
    return this.prisma.marketMilestoneLink.create({
      data: {
        contractLinkId: data.contractLinkId,
        marketMilestoneId: data.marketMilestoneId,
        projectMilestoneId: data.projectMilestoneId ?? null,
        title: data.title,
        amount: data.amount,
        status: data.status,
        dueDate: data.dueDate ?? null,
        lastSyncedAt: data.lastSyncedAt,
      },
    });
  }

  /**
   * Find a milestone link by ID
   */
  async findById(id: string): Promise<MarketMilestoneLink | null> {
    return this.prisma.marketMilestoneLink.findUnique({
      where: { id },
    });
  }

  /**
   * Find a milestone link by Market milestone ID within a contract
   */
  async findByMarketId(
    contractLinkId: string,
    marketMilestoneId: string
  ): Promise<MarketMilestoneLink | null> {
    return this.prisma.marketMilestoneLink.findUnique({
      where: {
        contractLinkId_marketMilestoneId: {
          contractLinkId,
          marketMilestoneId,
        },
      },
    });
  }

  /**
   * Find a milestone link by project milestone ID
   */
  async findByProjectMilestoneId(
    projectMilestoneId: string
  ): Promise<(MarketMilestoneLink & { contractLink: { marketContractId: string } }) | null> {
    return this.prisma.marketMilestoneLink.findFirst({
      where: { projectMilestoneId },
      include: {
        contractLink: {
          select: {
            marketContractId: true,
          },
        },
      },
    });
  }

  /**
   * Find all milestone links for a contract
   */
  async findByContractLink(contractLinkId: string): Promise<MarketMilestoneLink[]> {
    return this.prisma.marketMilestoneLink.findMany({
      where: { contractLinkId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find milestone links with project milestones
   */
  async findByContractLinkWithDetails(contractLinkId: string) {
    return this.prisma.marketMilestoneLink.findMany({
      where: { contractLinkId },
      include: {
        projectMilestone: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update a milestone link
   */
  async update(id: string, data: UpdateMilestoneLinkParams): Promise<MarketMilestoneLink> {
    return this.prisma.marketMilestoneLink.update({
      where: { id },
      data: {
        ...(data.projectMilestoneId !== undefined && {
          projectMilestoneId: data.projectMilestoneId,
        }),
        ...(data.title && { title: data.title }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.status && { status: data.status }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.lastSyncedAt && { lastSyncedAt: data.lastSyncedAt }),
      },
    });
  }

  /**
   * Delete a milestone link
   */
  async delete(id: string): Promise<void> {
    await this.prisma.marketMilestoneLink.delete({
      where: { id },
    });
  }

  /**
   * Count completed milestones for a contract
   */
  async countByStatus(contractLinkId: string, status: MarketMilestoneLinkStatus): Promise<number> {
    return this.prisma.marketMilestoneLink.count({
      where: {
        contractLinkId,
        status,
      },
    });
  }

  /**
   * Get milestone summary for a contract
   */
  async getMilestoneSummary(
    contractLinkId: string
  ): Promise<{ total: number; completed: number; pending: number; amount: number }> {
    const milestones = await this.prisma.marketMilestoneLink.findMany({
      where: { contractLinkId },
      select: {
        status: true,
        amount: true,
      },
    });

    return {
      total: milestones.length,
      completed: milestones.filter((m) => m.status === 'APPROVED' || m.status === 'PAID').length,
      pending: milestones.filter((m) => m.status === 'PENDING' || m.status === 'IN_PROGRESS')
        .length,
      amount: milestones.reduce((sum, m) => sum + Number(m.amount), 0),
    };
  }
}
