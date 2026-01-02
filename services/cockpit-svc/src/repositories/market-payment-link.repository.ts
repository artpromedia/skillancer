// @ts-nocheck
/**
 * @module @skillancer/cockpit-svc/repositories/market-payment-link
 * Market Payment Link data access layer
 */

import type {
  PrismaClient,
  MarketPaymentLink,
  MarketPaymentLinkType,
  MarketPaymentLinkStatus,
} from '@skillancer/database';

export interface CreatePaymentLinkParams {
  contractLinkId: string;
  marketPaymentId: string;
  marketInvoiceId?: string | null;
  transactionId?: string | null;
  invoicePaymentId?: string | null;
  paymentType: MarketPaymentLinkType;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: MarketPaymentLinkStatus;
  paidAt?: Date | null;
  milestoneLinkId?: string | null;
  lastSyncedAt: Date;
}

export interface UpdatePaymentLinkParams {
  transactionId?: string | null;
  invoicePaymentId?: string | null;
  status?: MarketPaymentLinkStatus;
  paidAt?: Date | null;
  lastSyncedAt?: Date;
}

export class MarketPaymentLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new payment link
   */
  async create(data: CreatePaymentLinkParams): Promise<MarketPaymentLink> {
    return this.prisma.marketPaymentLink.create({
      data: {
        contractLinkId: data.contractLinkId,
        marketPaymentId: data.marketPaymentId,
        marketInvoiceId: data.marketInvoiceId ?? null,
        transactionId: data.transactionId ?? null,
        invoicePaymentId: data.invoicePaymentId ?? null,
        paymentType: data.paymentType,
        grossAmount: data.grossAmount,
        platformFee: data.platformFee,
        netAmount: data.netAmount,
        currency: data.currency,
        status: data.status,
        paidAt: data.paidAt ?? null,
        milestoneLinkId: data.milestoneLinkId ?? null,
        lastSyncedAt: data.lastSyncedAt,
      },
    });
  }

  /**
   * Find a payment link by ID
   */
  async findById(id: string): Promise<MarketPaymentLink | null> {
    return this.prisma.marketPaymentLink.findUnique({
      where: { id },
    });
  }

  /**
   * Find a payment link by Market payment ID
   */
  async findByMarketId(marketPaymentId: string): Promise<MarketPaymentLink | null> {
    return this.prisma.marketPaymentLink.findUnique({
      where: { marketPaymentId },
    });
  }

  /**
   * Find all payment links for a contract
   */
  async findByContractLink(
    contractLinkId: string,
    options?: { limit?: number; offset?: number; status?: MarketPaymentLinkStatus }
  ): Promise<MarketPaymentLink[]> {
    return this.prisma.marketPaymentLink.findMany({
      where: {
        contractLinkId,
        ...(options?.status && { status: options.status }),
      },
      orderBy: { paidAt: 'desc' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Find payment links with transaction details
   */
  async findByContractLinkWithDetails(contractLinkId: string) {
    return this.prisma.marketPaymentLink.findMany({
      where: { contractLinkId },
      include: {
        transaction: true,
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  /**
   * Update a payment link
   */
  async update(id: string, data: UpdatePaymentLinkParams): Promise<MarketPaymentLink> {
    return this.prisma.marketPaymentLink.update({
      where: { id },
      data: {
        ...(data.transactionId !== undefined && { transactionId: data.transactionId }),
        ...(data.invoicePaymentId !== undefined && { invoicePaymentId: data.invoicePaymentId }),
        ...(data.status && { status: data.status }),
        ...(data.paidAt !== undefined && { paidAt: data.paidAt }),
        ...(data.lastSyncedAt && { lastSyncedAt: data.lastSyncedAt }),
      },
    });
  }

  /**
   * Delete a payment link
   */
  async delete(id: string): Promise<void> {
    await this.prisma.marketPaymentLink.delete({
      where: { id },
    });
  }

  /**
   * Get payment summary for a contract
   */
  async getPaymentSummary(contractLinkId: string): Promise<{
    totalGross: number;
    totalFees: number;
    totalNet: number;
    pendingAmount: number;
    paymentCount: number;
  }> {
    const payments = await this.prisma.marketPaymentLink.findMany({
      where: { contractLinkId },
      select: {
        grossAmount: true,
        platformFee: true,
        netAmount: true,
        status: true,
      },
    });

    const completed = payments.filter((p) => p.status === 'COMPLETED');
    const pending = payments.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING');

    return {
      totalGross: completed.reduce((sum, p) => sum + Number(p.grossAmount), 0),
      totalFees: completed.reduce((sum, p) => sum + Number(p.platformFee), 0),
      totalNet: completed.reduce((sum, p) => sum + Number(p.netAmount), 0),
      pendingAmount: pending.reduce((sum, p) => sum + Number(p.netAmount), 0),
      paymentCount: completed.length,
    };
  }

  /**
   * Get payments within a date range
   */
  async findByDateRange(
    contractLinkId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MarketPaymentLink[]> {
    return this.prisma.marketPaymentLink.findMany({
      where: {
        contractLinkId,
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
        status: 'COMPLETED',
      },
      orderBy: { paidAt: 'asc' },
    });
  }

  /**
   * Get total earnings for a freelancer from Market
   */
  async getTotalEarnings(
    freelancerUserId: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<{ total: number; fees: number; net: number }> {
    const result = await this.prisma.marketPaymentLink.aggregate({
      where: {
        contractLink: {
          freelancerUserId,
        },
        status: 'COMPLETED',
        ...(dateRange && {
          paidAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        }),
      },
      _sum: {
        grossAmount: true,
        platformFee: true,
        netAmount: true,
      },
    });

    return {
      total: Number(result._sum.grossAmount ?? 0),
      fees: Number(result._sum.platformFee ?? 0),
      net: Number(result._sum.netAmount ?? 0),
    };
  }
}

