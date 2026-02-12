// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/market-time-link
 * Market Time Link data access layer
 */

import type {
  PrismaClient,
  MarketTimeLink,
  MarketTimeLinkStatus,
  MarketTimeSource,
} from '../types/prisma-shim.js';

export interface CreateTimeLinkParams {
  contractLinkId: string;
  marketTimeLogId: string;
  timeEntryId?: string | null;
  source?: MarketTimeSource;
  date: Date;
  hours: number;
  description?: string | null;
  amount: number;
  status: MarketTimeLinkStatus;
  lastSyncedAt: Date;
}

export interface UpdateTimeLinkParams {
  timeEntryId?: string | null;
  hours?: number;
  description?: string | null;
  amount?: number;
  status?: MarketTimeLinkStatus;
  lastSyncedAt?: Date;
}

export class MarketTimeLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new time link
   */
  async create(data: CreateTimeLinkParams): Promise<MarketTimeLink> {
    return this.prisma.marketTimeLink.create({
      data: {
        contractLinkId: data.contractLinkId,
        marketTimeLogId: data.marketTimeLogId,
        timeEntryId: data.timeEntryId ?? null,
        source: data.source ?? 'MARKET',
        date: data.date,
        hours: data.hours,
        description: data.description ?? null,
        amount: data.amount,
        status: data.status,
        lastSyncedAt: data.lastSyncedAt,
      },
    });
  }

  /**
   * Find a time link by ID
   */
  async findById(id: string): Promise<MarketTimeLink | null> {
    return this.prisma.marketTimeLink.findUnique({
      where: { id },
    });
  }

  /**
   * Find a time link by Market time log ID
   */
  async findByMarketId(marketTimeLogId: string): Promise<MarketTimeLink | null> {
    return this.prisma.marketTimeLink.findUnique({
      where: { marketTimeLogId },
    });
  }

  /**
   * Find a time link by Cockpit time entry ID
   */
  async findByTimeEntryId(timeEntryId: string): Promise<MarketTimeLink | null> {
    return this.prisma.marketTimeLink.findUnique({
      where: { timeEntryId },
    });
  }

  /**
   * Find all time links for a contract
   */
  async findByContractLink(
    contractLinkId: string,
    options?: { limit?: number; offset?: number; startDate?: Date; endDate?: Date }
  ): Promise<MarketTimeLink[]> {
    return this.prisma.marketTimeLink.findMany({
      where: {
        contractLinkId,
        ...(options?.startDate && {
          date: {
            gte: options.startDate,
            ...(options.endDate && { lte: options.endDate }),
          },
        }),
      },
      orderBy: { date: 'desc' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Find time links with time entry details
   */
  async findByContractLinkWithDetails(contractLinkId: string) {
    return this.prisma.marketTimeLink.findMany({
      where: { contractLinkId },
      include: {
        timeEntry: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Update a time link
   */
  async update(id: string, data: UpdateTimeLinkParams): Promise<MarketTimeLink> {
    return this.prisma.marketTimeLink.update({
      where: { id },
      data: {
        ...(data.timeEntryId !== undefined && { timeEntryId: data.timeEntryId }),
        ...(data.hours !== undefined && { hours: data.hours }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.status && { status: data.status }),
        ...(data.lastSyncedAt && { lastSyncedAt: data.lastSyncedAt }),
      },
    });
  }

  /**
   * Delete a time link
   */
  async delete(id: string): Promise<void> {
    await this.prisma.marketTimeLink.delete({
      where: { id },
    });
  }

  /**
   * Get time summary for a contract
   */
  async getTimeSummary(
    contractLinkId: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<{ totalHours: number; totalAmount: number; entries: number }> {
    const where = {
      contractLinkId,
      ...(dateRange && {
        date: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      }),
    };

    const result = await this.prisma.marketTimeLink.aggregate({
      where,
      _sum: {
        hours: true,
        amount: true,
      },
      _count: true,
    });

    return {
      totalHours: Number(result._sum.hours ?? 0),
      totalAmount: Number(result._sum.amount ?? 0),
      entries: result._count,
    };
  }

  /**
   * Get unsynced time links (Cockpit entries not pushed to Market)
   */
  async findUnsyncedFromCockpit(contractLinkId: string): Promise<MarketTimeLink[]> {
    return this.prisma.marketTimeLink.findMany({
      where: {
        contractLinkId,
        source: 'COCKPIT',
        marketTimeLogId: {
          startsWith: 'pending_',
        },
      },
    });
  }
}
