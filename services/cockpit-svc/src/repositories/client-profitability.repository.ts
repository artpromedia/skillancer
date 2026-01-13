// @ts-nocheck
/**
 * Client Profitability Repository
 *
 * Repository for managing client profitability reports.
 */

import {
  type PrismaClient,
  Prisma,
  type ClientProfitabilityReport,
  FinancialReportStatus,
} from '../types/prisma-shim.js';
import { logger } from '@skillancer/logger';

import type { PaginationOptions, PaginatedResult } from '../types/unified-financial.types';

export interface CreateClientProfitabilityInput {
  userId: string;
  clientId: string;
  periodStart: Date;
  periodEnd: Date;
  baseCurrency: string;
  totalRevenue: number;
  revenueBySource: Record<string, number>;
  directCosts: number;
  allocatedOverhead: number;
  totalCosts: number;
  totalHours: number;
  billableHours: number;
  effectiveHourlyRate: number;
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  projectCount: number;
  activeProjects: number;
  completedProjects: number;
  invoiceCount: number;
  paidInvoices: number;
  outstandingAmount: number;
}

export interface ClientProfitabilityFilters {
  userId: string;
  clientId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  minProfitMargin?: number;
  maxProfitMargin?: number;
  status?: FinancialReportStatus;
}

export class ClientProfitabilityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new client profitability report
   */
  async create(input: CreateClientProfitabilityInput): Promise<ClientProfitabilityReport> {
    try {
      return await this.prisma.clientProfitabilityReport.create({
        data: {
          userId: input.userId,
          clientId: input.clientId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          baseCurrency: input.baseCurrency,
          totalRevenue: new Prisma.Decimal(input.totalRevenue),
          revenueBySource: input.revenueBySource as unknown as Prisma.JsonValue,
          directCosts: new Prisma.Decimal(input.directCosts),
          allocatedOverhead: new Prisma.Decimal(input.allocatedOverhead),
          totalCosts: new Prisma.Decimal(input.totalCosts),
          totalHours: new Prisma.Decimal(input.totalHours),
          billableHours: new Prisma.Decimal(input.billableHours),
          effectiveHourlyRate: new Prisma.Decimal(input.effectiveHourlyRate),
          grossProfit: new Prisma.Decimal(input.grossProfit),
          grossMargin: new Prisma.Decimal(input.grossMargin),
          netProfit: new Prisma.Decimal(input.netProfit),
          netMargin: new Prisma.Decimal(input.netMargin),
          projectCount: input.projectCount,
          activeProjects: input.activeProjects,
          completedProjects: input.completedProjects,
          invoiceCount: input.invoiceCount,
          paidInvoices: input.paidInvoices,
          outstandingAmount: new Prisma.Decimal(input.outstandingAmount),
          status: FinancialReportStatus.COMPLETED,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to create client profitability report', { error, input });
      throw error;
    }
  }

  /**
   * Find report by ID
   */
  async findById(id: string): Promise<ClientProfitabilityReport | null> {
    return this.prisma.clientProfitabilityReport.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });
  }

  /**
   * Find latest report for a client
   */
  async findLatestForClient(
    userId: string,
    clientId: string
  ): Promise<ClientProfitabilityReport | null> {
    return this.prisma.clientProfitabilityReport.findFirst({
      where: {
        userId,
        clientId,
        status: FinancialReportStatus.COMPLETED,
      },
      orderBy: { periodEnd: 'desc' },
      include: {
        client: true,
      },
    });
  }

  /**
   * Find reports with filters and pagination
   */
  async findMany(
    filters: ClientProfitabilityFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<ClientProfitabilityReport>> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.clientProfitabilityReport.findMany({
        where,
        orderBy: {
          [pagination.sortBy ?? 'netProfit']: pagination.sortOrder ?? 'desc',
        },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        include: {
          client: true,
        },
      }),
      this.prisma.clientProfitabilityReport.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.pageSize);

    return {
      data,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrevious: pagination.page > 1,
    };
  }

  /**
   * Get top clients by profitability
   */
  async getTopClients(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    limit: number = 10
  ): Promise<ClientProfitabilityReport[]> {
    return this.prisma.clientProfitabilityReport.findMany({
      where: {
        userId,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
        status: FinancialReportStatus.COMPLETED,
      },
      orderBy: { netProfit: 'desc' },
      take: limit,
      include: {
        client: true,
      },
    });
  }

  /**
   * Get clients by margin category
   */
  async getClientsByMarginCategory(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    highMargin: ClientProfitabilityReport[];
    mediumMargin: ClientProfitabilityReport[];
    lowMargin: ClientProfitabilityReport[];
    negative: ClientProfitabilityReport[];
  }> {
    const reports = await this.prisma.clientProfitabilityReport.findMany({
      where: {
        userId,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
        status: FinancialReportStatus.COMPLETED,
      },
      include: {
        client: true,
      },
    });

    return {
      highMargin: reports.filter((r) => r.netMargin.toNumber() >= 50),
      mediumMargin: reports.filter(
        (r) => r.netMargin.toNumber() >= 25 && r.netMargin.toNumber() < 50
      ),
      lowMargin: reports.filter((r) => r.netMargin.toNumber() >= 0 && r.netMargin.toNumber() < 25),
      negative: reports.filter((r) => r.netMargin.toNumber() < 0),
    };
  }

  /**
   * Get aggregate client metrics
   */
  async getAggregateMetrics(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    totalClients: number;
    totalRevenue: number;
    totalProfit: number;
    averageMargin: number;
    totalHours: number;
    averageHourlyRate: number;
  }> {
    const result = await this.prisma.clientProfitabilityReport.aggregate({
      where: {
        userId,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
        status: FinancialReportStatus.COMPLETED,
      },
      _count: true,
      _sum: {
        totalRevenue: true,
        netProfit: true,
        totalHours: true,
      },
      _avg: {
        netMargin: true,
        effectiveHourlyRate: true,
      },
    });

    return {
      totalClients: result._count,
      totalRevenue: result._sum.totalRevenue?.toNumber() ?? 0,
      totalProfit: result._sum.netProfit?.toNumber() ?? 0,
      averageMargin: result._avg.netMargin?.toNumber() ?? 0,
      totalHours: result._sum.totalHours?.toNumber() ?? 0,
      averageHourlyRate: result._avg.effectiveHourlyRate?.toNumber() ?? 0,
    };
  }

  /**
   * Build where clause from filters
   */
  private buildWhereClause(
    filters: ClientProfitabilityFilters
  ): Prisma.ClientProfitabilityReportWhereInput {
    const where: Prisma.ClientProfitabilityReportWhereInput = {
      userId: filters.userId,
    };

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.periodStart) {
      where.periodStart = { gte: filters.periodStart };
    }

    if (filters.periodEnd) {
      where.periodEnd = { lte: filters.periodEnd };
    }

    if (filters.minProfitMargin !== undefined) {
      where.netMargin = { gte: new Prisma.Decimal(filters.minProfitMargin) };
    }

    if (filters.maxProfitMargin !== undefined) {
      where.netMargin = {
        ...((where.netMargin as Prisma.DecimalFilter) ?? {}),
        lte: new Prisma.Decimal(filters.maxProfitMargin),
      };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return where;
  }
}

