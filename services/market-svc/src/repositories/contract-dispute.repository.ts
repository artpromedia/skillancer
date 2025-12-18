/**
 * @module @skillancer/market-svc/repositories/contract-dispute
 * Contract Dispute data access layer
 */

import { Prisma } from '@skillancer/database';

import type {
  CreateDisputeInput,
  DisputeListOptions,
  DisputeWithDetails,
} from '../types/contract.types.js';
import type {
  PrismaClient,
  ContractDisputeStatus,
  ContractDisputeReason,
  ContractDisputeResolution,
} from '@skillancer/database';

/**
 * Contract Dispute Repository
 *
 * Handles database operations for contract disputes.
 */
export class ContractDisputeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly defaultInclude = {
    contract: {
      select: {
        id: true,
        title: true,
        contractNumber: true,
        clientUserId: true,
        freelancerUserId: true,
      },
    },
    raiser: {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    },
    messages: {
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' as const },
    },
  };

  /**
   * Create a dispute
   */
  async create(data: CreateDisputeInput) {
    return this.prisma.contractDispute.create({
      data: {
        contractId: data.contractId,
        raisedBy: data.raisedById,
        reason: data.reason,
        description: data.description,
        evidenceUrls: data.evidenceUrls ?? [],
        disputedAmount: new Prisma.Decimal(data.disputedAmount),
        currency: data.currency ?? 'USD',
        milestoneId: data.milestoneId ?? null,
        timeEntryId: data.timeEntryId ?? null,
        status: 'OPEN',
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Find dispute by ID
   */
  async findById(id: string): Promise<DisputeWithDetails | null> {
    return this.prisma.contractDispute.findUnique({
      where: { id },
      include: this.defaultInclude,
    }) as Promise<DisputeWithDetails | null>;
  }

  /**
   * Update dispute status
   */
  async updateStatus(id: string, status: ContractDisputeStatus) {
    return this.prisma.contractDispute.update({
      where: { id },
      data: { status },
      include: this.defaultInclude,
    });
  }

  /**
   * Respond to dispute
   */
  async respond(
    id: string,
    respondentUserId: string,
    response: string,
    responseEvidence?: string[]
  ) {
    return this.prisma.contractDispute.update({
      where: { id },
      data: {
        status: 'UNDER_REVIEW',
        respondentUserId,
        respondedAt: new Date(),
        response,
        responseEvidence: responseEvidence ?? [],
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Escalate dispute
   */
  async escalate(id: string) {
    return this.prisma.contractDispute.update({
      where: { id },
      data: {
        status: 'ESCALATED',
        escalatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Resolve dispute
   */
  async resolve(
    id: string,
    resolvedBy: string,
    resolution: ContractDisputeResolution,
    resolutionNotes: string,
    clientRefundAmount?: number,
    freelancerPayoutAmount?: number
  ) {
    return this.prisma.contractDispute.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedBy,
        resolvedAt: new Date(),
        resolution,
        resolutionNotes,
        clientRefundAmount:
          clientRefundAmount != null ? new Prisma.Decimal(clientRefundAmount) : null,
        freelancerPayoutAmount:
          freelancerPayoutAmount != null ? new Prisma.Decimal(freelancerPayoutAmount) : null,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Close dispute
   */
  async close(id: string) {
    return this.prisma.contractDispute.update({
      where: { id },
      data: { status: 'CLOSED' },
      include: this.defaultInclude,
    });
  }

  /**
   * Add message to dispute
   */
  async addMessage(
    disputeId: string,
    senderId: string,
    senderType: 'CLIENT' | 'FREELANCER' | 'MEDIATOR' | 'SYSTEM',
    content: string,
    attachments?: string[]
  ) {
    return this.prisma.contractDisputeMessage.create({
      data: {
        disputeId,
        senderId,
        senderType,
        content,
        attachments: attachments ?? [],
      },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * List disputes with filters
   */
  async list(options: DisputeListOptions): Promise<{
    data: DisputeWithDetails[];
    total: number;
  }> {
    const { contractId, raisedById, status, page = 1, limit = 20 } = options;

    const where: Prisma.ContractDisputeWhereInput = {};

    if (contractId) where.contractId = contractId;
    if (raisedById) where.raisedBy = raisedById;

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const [data, total] = await Promise.all([
      this.prisma.contractDispute.findMany({
        where,
        include: this.defaultInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contractDispute.count({ where }),
    ]);

    return { data: data as DisputeWithDetails[], total };
  }

  /**
   * Get active disputes for a contract
   */
  async getActive(contractId: string): Promise<DisputeWithDetails[]> {
    return this.prisma.contractDispute.findMany({
      where: {
        contractId,
        status: { in: ['OPEN', 'PENDING_RESPONSE', 'UNDER_REVIEW', 'ESCALATED'] },
      },
      include: this.defaultInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<DisputeWithDetails[]>;
  }

  /**
   * Check if contract has active dispute
   */
  async hasActiveDispute(contractId: string): Promise<boolean> {
    const count = await this.prisma.contractDispute.count({
      where: {
        contractId,
        status: { in: ['OPEN', 'PENDING_RESPONSE', 'UNDER_REVIEW', 'ESCALATED'] },
      },
    });
    return count > 0;
  }

  /**
   * Get disputes requiring attention (for admin)
   */
  async getRequiringAttention(): Promise<DisputeWithDetails[]> {
    return this.prisma.contractDispute.findMany({
      where: {
        status: 'ESCALATED',
      },
      include: this.defaultInclude,
      orderBy: { escalatedAt: 'asc' },
    }) as Promise<DisputeWithDetails[]>;
  }

  /**
   * Get dispute statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date) {
    const where: Prisma.ContractDisputeWhereInput = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, byStatus, byReason, byResolution] = await Promise.all([
      this.prisma.contractDispute.count({ where }),
      this.prisma.contractDispute.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.contractDispute.groupBy({
        by: ['reason'],
        where,
        _count: true,
      }),
      this.prisma.contractDispute.groupBy({
        by: ['resolution'],
        where: { ...where, resolution: { not: null } },
        _count: true,
      }),
    ]);

    const statusCounts: Partial<Record<ContractDisputeStatus, number>> = {};
    for (const s of byStatus) {
      statusCounts[s.status] = s._count;
    }

    const reasonCounts: Partial<Record<ContractDisputeReason, number>> = {};
    for (const r of byReason) {
      reasonCounts[r.reason] = r._count;
    }

    const resolutionCounts: Partial<Record<ContractDisputeResolution, number>> = {};
    for (const r of byResolution) {
      if (r.resolution) {
        resolutionCounts[r.resolution] = r._count;
      }
    }

    return {
      total,
      byStatus: statusCounts,
      byReason: reasonCounts,
      byResolution: resolutionCounts,
    };
  }

  /**
   * Get disputes for a user (either as raiser or party to contract)
   */
  async getForUser(userId: string, status?: ContractDisputeStatus | ContractDisputeStatus[]) {
    const where: Prisma.ContractDisputeWhereInput = {
      OR: [
        { raisedBy: userId },
        { contract: { client: { id: userId } } },
        { contract: { freelancer: { id: userId } } },
      ],
    };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    return this.prisma.contractDispute.findMany({
      where,
      include: this.defaultInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<DisputeWithDetails[]>;
  }
}
