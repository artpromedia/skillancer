/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/contract
 * Contract V2 data access layer
 */

import { Prisma } from '@skillancer/database';

import type {
  ContractListOptions,
  ContractWithDetails,
  ContractSummary,
  CreateContractInput,
  UpdateContractInput,
} from '../types/contract.types.js';
import type {
  PrismaClient,
  ContractStatusV2,
  TerminationType,
  ContractDisputeStatus,
  AmendmentStatus,
} from '@skillancer/database';

/**
 * Contract Repository
 *
 * Handles database operations for contracts V2.
 */
export class ContractRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly defaultInclude = {
    client: {
      select: {
        id: true,
        displayName: true,
        email: true,
        avatarUrl: true,
      },
    },
    freelancer: {
      select: {
        id: true,
        displayName: true,
        email: true,
        avatarUrl: true,
      },
    },
    job: {
      select: {
        id: true,
        title: true,
        status: true,
      },
    },
    tenant: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
    milestones: {
      orderBy: { orderIndex: 'asc' as const },
    },
    _count: {
      select: {
        timeEntries: true,
        amendments: true,
        activities: true,
        invoices: true,
        disputes: true,
      },
    },
  };

  /**
   * Generate a unique contract number
   */
  async generateContractNumber(tenantId?: string | null): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SKL-${year}`;

    // Get the last contract number for this tenant and year
    const lastContract = await this.prisma.contractV2.findFirst({
      where: {
        tenantId: tenantId ?? null,
        contractNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        contractNumber: 'desc',
      },
      select: {
        contractNumber: true,
      },
    });

    let nextNumber = 1;
    if (lastContract?.contractNumber) {
      const regex = /-(\d+)$/;
      const match = regex.exec(lastContract.contractNumber);
      if (match?.[1]) {
        nextNumber = Number.parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
  }

  /**
   * Create a new contract
   */
  async create(data: CreateContractInput & { contractNumber: string }) {
    const { milestones, hourlyRate, fixedAmount, retainerAmount, ...contractData } = data;

    return this.prisma.contractV2.create({
      data: {
        contractNumber: contractData.contractNumber,
        tenantId: contractData.tenantId ?? null,
        clientUserId: contractData.clientUserId,
        freelancerUserId: contractData.freelancerUserId,
        projectId: contractData.projectId ?? null,
        bidId: contractData.bidId ?? null,
        serviceOrderId: contractData.serviceOrderId ?? null,
        sourceType: contractData.sourceType,
        contractType: contractData.contractType,
        rateType: contractData.rateType,
        title: contractData.title,
        description: contractData.description ?? null,
        scope: contractData.scope,
        hourlyRate: hourlyRate ? new Prisma.Decimal(hourlyRate) : null,
        weeklyHourLimit: contractData.weeklyHoursMax ?? null,
        fixedAmount: fixedAmount ? new Prisma.Decimal(fixedAmount) : null,
        retainerAmount: retainerAmount ? new Prisma.Decimal(retainerAmount) : null,
        currency: contractData.currency ?? 'USD',
        startDate: contractData.startDate,
        endDate: contractData.endDate ?? null,
        estimatedDurationDays: contractData.estimatedDurationDays ?? null,
        ...(contractData.paymentTermsDays !== undefined && {
          paymentTermsDays: contractData.paymentTermsDays,
        }),
        ...(contractData.noticePeriodDays !== undefined && {
          noticePeriodDays: contractData.noticePeriodDays,
        }),
        includesNda: contractData.includesNda ?? false,
        includesIpAssignment: contractData.includesIpAssignment ?? false,
        includesNonCompete: contractData.includesNonCompete ?? false,
        customTerms: contractData.customTerms ?? null,
        complianceRequirements: contractData.complianceRequirements ?? [],
        skillpodRequired: contractData.skillpodRequired ?? false,
        skillpodPodId: contractData.skillpodPodId ?? null,
        status: 'DRAFT',
        documentVersion: 1,
        ...(milestones && milestones.length > 0
          ? {
              milestones: {
                create: milestones.map((m, index) => ({
                  title: m.title,
                  description: m.description ?? null,
                  amount: new Prisma.Decimal(m.amount),
                  dueDate: m.dueDate ?? null,
                  orderIndex: m.orderIndex ?? index + 1,
                  deliverables: m.deliverables
                    ? (m.deliverables as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
                  status: 'PENDING' as const,
                })),
              },
            }
          : {}),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Find contract by ID
   */
  async findById(id: string): Promise<ContractWithDetails | null> {
    return this.prisma.contractV2.findUnique({
      where: { id },
      include: this.defaultInclude,
    }) as Promise<ContractWithDetails | null>;
  }

  /**
   * Find contract by contract number
   */
  async findByContractNumber(contractNumber: string): Promise<ContractWithDetails | null> {
    return this.prisma.contractV2.findUnique({
      where: { contractNumber },
      include: this.defaultInclude,
    }) as Promise<ContractWithDetails | null>;
  }

  /**
   * Update contract
   */
  async update(id: string, data: UpdateContractInput) {
    return this.prisma.contractV2.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Update contract status
   */
  async updateStatus(
    id: string,
    status: ContractStatusV2,
    additionalData?: Partial<{
      clientSignedAt: Date;
      freelancerSignedAt: Date;
      activatedAt: Date;
      pausedAt: Date;
      completedAt: Date;
      terminatedAt: Date;
      terminationType: TerminationType;
      terminationReason: string;
    }>
  ) {
    return this.prisma.contractV2.update({
      where: { id },
      data: {
        status,
        ...additionalData,
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Update contract financials
   */
  async updateFinancials(
    id: string,
    updates: {
      totalBilled?: number;
      totalPaid?: number;
      totalInEscrow?: number;
      totalDisputed?: number;
    }
  ) {
    const data: Prisma.ContractV2UpdateInput = {
      updatedAt: new Date(),
    };

    if (updates.totalBilled !== undefined) {
      data.totalBilled = new Prisma.Decimal(updates.totalBilled);
    }
    if (updates.totalPaid !== undefined) {
      data.totalPaid = new Prisma.Decimal(updates.totalPaid);
    }
    if (updates.totalInEscrow !== undefined) {
      data.totalInEscrow = new Prisma.Decimal(updates.totalInEscrow);
    }
    if (updates.totalDisputed !== undefined) {
      data.totalDisputed = new Prisma.Decimal(updates.totalDisputed);
    }

    return this.prisma.contractV2.update({
      where: { id },
      data,
      include: this.defaultInclude,
    });
  }

  /**
   * Increment contract document version
   */
  async incrementVersion(id: string) {
    return this.prisma.contractV2.update({
      where: { id },
      data: {
        documentVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Build date range filter
   */
  private buildDateRangeFilter(
    from: Date | undefined,
    to: Date | undefined
  ): { gte?: Date; lte?: Date } | undefined {
    if (!from && !to) return undefined;
    const filter: { gte?: Date; lte?: Date } = {};
    if (from) filter.gte = from;
    if (to) filter.lte = to;
    return filter;
  }

  /**
   * Build dispute filter
   */
  private buildDisputeFilter(
    hasActiveDispute: boolean | undefined
  ): Prisma.ContractV2WhereInput['disputes'] {
    if (hasActiveDispute === undefined) return undefined;
    const activeStatuses: ContractDisputeStatus[] = ['OPEN', 'UNDER_REVIEW', 'ESCALATED'];
    return hasActiveDispute
      ? { some: { status: { in: activeStatuses } } }
      : { none: { status: { in: activeStatuses } } };
  }

  /**
   * Build amendment filter
   */
  private buildAmendmentFilter(
    hasPendingAmendments: boolean | undefined
  ): Prisma.ContractV2WhereInput['amendments'] {
    if (hasPendingAmendments === undefined) return undefined;
    const pendingStatuses: AmendmentStatus[] = ['PROPOSED', 'PENDING_CLIENT', 'PENDING_FREELANCER'];
    return hasPendingAmendments
      ? { some: { status: { in: pendingStatuses } } }
      : { none: { status: { in: pendingStatuses } } };
  }

  /**
   * Build basic filters for the where clause
   */
  private buildBasicFilters(options: {
    tenantId: string | undefined;
    clientId: string | undefined;
    freelancerId: string | undefined;
    userId: string | undefined;
    jobId: string | undefined;
  }): Prisma.ContractV2WhereInput {
    const where: Prisma.ContractV2WhereInput = {};
    if (options.tenantId) where.tenantId = options.tenantId;
    if (options.clientId) where.clientUserId = options.clientId;
    if (options.freelancerId) where.freelancerUserId = options.freelancerId;
    if (options.userId)
      where.OR = [{ clientUserId: options.userId }, { freelancerUserId: options.userId }];
    if (options.jobId) where.projectId = options.jobId;
    return where;
  }

  /**
   * Build enum filters for status, contractType, rateType
   */
  private applyEnumFilters(
    where: Prisma.ContractV2WhereInput,
    options: {
      status?: ContractListOptions['status'];
      contractType?: ContractListOptions['contractType'];
      rateType?: ContractListOptions['rateType'];
    }
  ): void {
    if (options.status) {
      where.status = Array.isArray(options.status) ? { in: options.status } : options.status;
    }
    if (options.contractType) {
      where.contractType = Array.isArray(options.contractType)
        ? { in: options.contractType }
        : options.contractType;
    }
    if (options.rateType) {
      where.rateType = Array.isArray(options.rateType)
        ? { in: options.rateType }
        : options.rateType;
    }
  }

  /**
   * List contracts with filters and pagination
   */
  async list(options: ContractListOptions): Promise<{
    data: ContractWithDetails[];
    total: number;
  }> {
    const {
      tenantId,
      clientId,
      freelancerId,
      userId,
      jobId,
      status,
      contractType,
      rateType,
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
      hasActiveDispute,
      hasPendingAmendments,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = options;

    // Build where clause
    const where = this.buildBasicFilters({ tenantId, clientId, freelancerId, userId, jobId });
    this.applyEnumFilters(where, { status, contractType, rateType });

    // Apply date range filters
    const startDateFilter = this.buildDateRangeFilter(startDateFrom, startDateTo);
    const endDateFilter = this.buildDateRangeFilter(endDateFrom, endDateTo);
    if (startDateFilter) where.startDate = startDateFilter;
    if (endDateFilter) where.endDate = endDateFilter;

    // Apply relation filters
    const disputeFilter = this.buildDisputeFilter(hasActiveDispute);
    const amendmentFilter = this.buildAmendmentFilter(hasPendingAmendments);
    if (disputeFilter) where.disputes = disputeFilter;
    if (amendmentFilter) where.amendments = amendmentFilter;

    // Apply search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.ContractV2OrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.contractV2.findMany({
        where,
        include: this.defaultInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contractV2.count({ where }),
    ]);

    return { data: data as ContractWithDetails[], total };
  }

  /**
   * Get contract summaries for dashboard
   */
  async getSummaries(userId: string, role: 'client' | 'freelancer'): Promise<ContractSummary[]> {
    const where: Prisma.ContractV2WhereInput =
      role === 'client' ? { clientUserId: userId } : { freelancerUserId: userId };

    const contracts = await this.prisma.contractV2.findMany({
      where,
      include: {
        client: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        freelancer: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        milestones: {
          select: { status: true },
        },
        disputes: {
          where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] } },
          select: { id: true },
        },
        amendments: {
          where: { status: { in: ['PROPOSED', 'PENDING_CLIENT', 'PENDING_FREELANCER'] } },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return contracts.map((c) => {
      const totalMilestones = c.milestones.length;
      const completedMilestones = c.milestones.filter((m) => m.status === 'PAID').length;

      const now = new Date();
      const daysRemaining = c.endDate
        ? Math.ceil((c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: c.id,
        title: c.title,
        contractNumber: c.contractNumber,
        status: c.status,
        contractType: c.contractType,
        rateType: c.rateType,
        totalBilled: Number(c.totalBilled),
        totalPaid: Number(c.totalPaid),
        totalInEscrow: Number(c.totalInEscrow),
        startDate: c.startDate,
        endDate: c.endDate,
        client: c.client,
        freelancer: c.freelancer,
        progressPercent:
          totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
        daysRemaining: daysRemaining !== null && daysRemaining > 0 ? daysRemaining : null,
        hasActiveDispute: c.disputes.length > 0,
        pendingAmendments: c.amendments.length,
      };
    });
  }

  /**
   * Get contracts ending soon
   */
  async getEndingSoon(daysAhead: number = 7): Promise<ContractWithDetails[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return this.prisma.contractV2.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: this.defaultInclude,
    }) as Promise<ContractWithDetails[]>;
  }

  /**
   * Get contracts by tenant for analytics
   */
  async getByTenantForAnalytics(tenantId: string, startDate: Date, endDate: Date) {
    return this.prisma.contractV2.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        status: true,
        contractType: true,
        rateType: true,
        totalBilled: true,
        totalPaid: true,
        totalInEscrow: true,
        startDate: true,
        endDate: true,
        completedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Check if user is party to contract
   */
  async isPartyToContract(contractId: string, userId: string): Promise<boolean> {
    const contract = await this.prisma.contractV2.findUnique({
      where: { id: contractId },
      select: { clientUserId: true, freelancerUserId: true },
    });

    if (!contract) return false;
    return contract.clientUserId === userId || contract.freelancerUserId === userId;
  }

  /**
   * Get contract parties
   */
  async getParties(contractId: string): Promise<{
    clientUserId: string;
    freelancerUserId: string;
    tenantId: string | null;
  } | null> {
    return this.prisma.contractV2.findUnique({
      where: { id: contractId },
      select: { clientUserId: true, freelancerUserId: true, tenantId: true },
    });
  }

  /**
   * Calculate total contract value
   */
  calculateTotalValue(data: {
    rateType: string;
    hourlyRate?: number | null;
    weeklyHoursMax?: number | null;
    fixedAmount?: number | null;
    retainerAmount?: number | null;
    milestones?: { amount: number }[];
    durationWeeks?: number;
  }): number {
    switch (data.rateType) {
      case 'HOURLY': {
        // Estimate based on weekly hours and duration
        const weeklyHours = data.weeklyHoursMax || 40;
        const weeks = data.durationWeeks || 4;
        return (data.hourlyRate || 0) * weeklyHours * weeks;
      }
      case 'FIXED':
        return data.fixedAmount || 0;
      case 'MILESTONE':
        return (data.milestones || []).reduce((sum, m) => sum + m.amount, 0);
      case 'RETAINER': {
        const months = data.durationWeeks ? Math.ceil(data.durationWeeks / 4) : 1;
        return (data.retainerAmount || 0) * months;
      }
      default:
        return 0;
    }
  }
}
