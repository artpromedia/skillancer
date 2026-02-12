// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/market-contract-link
 * Market Contract Link data access layer
 */

import type {
  Prisma,
  PrismaClient,
  MarketContractLink,
  MarketContractType,
  MarketContractLinkStatus,
  MarketContractSyncStatus,
} from '../types/prisma-shim.js';

export interface CreateContractLinkParams {
  freelancerUserId: string;
  marketContractId: string;
  marketJobId?: string | null;
  marketClientId: string;
  projectId?: string | null;
  clientId?: string | null;
  contractTitle: string;
  contractType: MarketContractType;
  contractStatus: MarketContractLinkStatus;
  currency?: string;
  hourlyRate?: number | null;
  fixedPrice?: number | null;
  budgetCap?: number | null;
  startDate: Date;
  endDate?: Date | null;
  lastSyncedAt: Date;
  autoCreateProject?: boolean;
  autoSyncTime?: boolean;
  autoRecordPayments?: boolean;
}

export interface UpdateContractLinkParams {
  projectId?: string | null;
  clientId?: string | null;
  contractTitle?: string;
  contractStatus?: MarketContractLinkStatus;
  hourlyRate?: number | null;
  fixedPrice?: number | null;
  budgetCap?: number | null;
  startDate?: Date;
  endDate?: Date | null;
  lastSyncedAt?: Date;
  syncStatus?: MarketContractSyncStatus;
  syncError?: string | null;
  autoCreateProject?: boolean;
  autoSyncTime?: boolean;
  autoRecordPayments?: boolean;
}

export interface ContractLinkFilters {
  freelancerUserId?: string;
  contractStatus?: MarketContractLinkStatus;
  syncStatus?: MarketContractSyncStatus;
  projectId?: string;
  clientId?: string;
}

export class MarketContractLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new contract link
   */
  async create(data: CreateContractLinkParams): Promise<MarketContractLink> {
    return this.prisma.marketContractLink.create({
      data: {
        freelancerUserId: data.freelancerUserId,
        marketContractId: data.marketContractId,
        marketJobId: data.marketJobId ?? null,
        marketClientId: data.marketClientId,
        projectId: data.projectId ?? null,
        clientId: data.clientId ?? null,
        contractTitle: data.contractTitle,
        contractType: data.contractType,
        contractStatus: data.contractStatus,
        currency: data.currency ?? 'USD',
        hourlyRate: data.hourlyRate ?? null,
        fixedPrice: data.fixedPrice ?? null,
        budgetCap: data.budgetCap ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        lastSyncedAt: data.lastSyncedAt,
        autoCreateProject: data.autoCreateProject ?? true,
        autoSyncTime: data.autoSyncTime ?? true,
        autoRecordPayments: data.autoRecordPayments ?? true,
      },
    });
  }

  /**
   * Find a contract link by ID
   */
  async findById(id: string): Promise<MarketContractLink | null> {
    return this.prisma.marketContractLink.findUnique({
      where: { id },
    });
  }

  /**
   * Find a contract link by Market contract ID
   */
  async findByMarketId(marketContractId: string): Promise<MarketContractLink | null> {
    return this.prisma.marketContractLink.findUnique({
      where: { marketContractId },
    });
  }

  /**
   * Find contract link by Market ID with full details
   */
  async findByMarketIdWithDetails(marketContractId: string) {
    return this.prisma.marketContractLink.findUnique({
      where: { marketContractId },
      include: {
        project: true,
        client: true,
        milestoneLinks: {
          include: {
            projectMilestone: true,
          },
        },
        timeLinks: {
          include: {
            timeEntry: true,
          },
          orderBy: { date: 'desc' },
          take: 50,
        },
        paymentLinks: {
          include: {
            transaction: true,
          },
          orderBy: { paidAt: 'desc' },
        },
      },
    });
  }

  /**
   * Find contract links by freelancer
   */
  async findByFreelancer(
    freelancerUserId: string,
    filters?: ContractLinkFilters,
    options?: { limit?: number; offset?: number }
  ) {
    const where: Prisma.MarketContractLinkWhereInput = {
      freelancerUserId,
      ...this.buildFilters(filters),
    };

    const [links, total] = await Promise.all([
      this.prisma.marketContractLink.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
              avatarUrl: true,
            },
          },
          milestoneLinks: {
            select: {
              id: true,
              status: true,
            },
          },
          paymentLinks: {
            where: {
              status: 'COMPLETED',
            },
            select: {
              netAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      this.prisma.marketContractLink.count({ where }),
    ]);

    return { links, total };
  }

  /**
   * Update a contract link
   */
  async update(id: string, data: UpdateContractLinkParams): Promise<MarketContractLink> {
    return this.prisma.marketContractLink.update({
      where: { id },
      data: {
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.clientId !== undefined && { clientId: data.clientId }),
        ...(data.contractTitle && { contractTitle: data.contractTitle }),
        ...(data.contractStatus && { contractStatus: data.contractStatus }),
        ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
        ...(data.fixedPrice !== undefined && { fixedPrice: data.fixedPrice }),
        ...(data.budgetCap !== undefined && { budgetCap: data.budgetCap }),
        ...(data.startDate && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.lastSyncedAt && { lastSyncedAt: data.lastSyncedAt }),
        ...(data.syncStatus && { syncStatus: data.syncStatus }),
        ...(data.syncError !== undefined && { syncError: data.syncError }),
        ...(data.autoCreateProject !== undefined && { autoCreateProject: data.autoCreateProject }),
        ...(data.autoSyncTime !== undefined && { autoSyncTime: data.autoSyncTime }),
        ...(data.autoRecordPayments !== undefined && {
          autoRecordPayments: data.autoRecordPayments,
        }),
      },
    });
  }

  /**
   * Delete a contract link
   */
  async delete(id: string): Promise<void> {
    await this.prisma.marketContractLink.delete({
      where: { id },
    });
  }

  /**
   * Get contracts with sync errors
   */
  async findWithSyncErrors(freelancerUserId: string): Promise<MarketContractLink[]> {
    return this.prisma.marketContractLink.findMany({
      where: {
        freelancerUserId,
        syncStatus: 'ERROR',
      },
      orderBy: { lastSyncedAt: 'desc' },
    });
  }

  /**
   * Get active contract count
   */
  async countActive(freelancerUserId: string): Promise<number> {
    return this.prisma.marketContractLink.count({
      where: {
        freelancerUserId,
        contractStatus: 'ACTIVE',
      },
    });
  }

  /**
   * Build filter conditions
   */
  private buildFilters(filters?: ContractLinkFilters): Prisma.MarketContractLinkWhereInput {
    if (!filters) return {};

    const where: Prisma.MarketContractLinkWhereInput = {};

    if (filters.contractStatus) {
      where.contractStatus = filters.contractStatus;
    }

    if (filters.syncStatus) {
      where.syncStatus = filters.syncStatus;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    return where;
  }
}
