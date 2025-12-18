/**
 * @module @skillancer/market-svc/repositories/contract-amendment
 * Contract Amendment data access layer
 */

import type {
  CreateAmendmentInput,
  AmendmentListOptions,
  AmendmentWithDetails,
} from '../types/contract.types.js';
import type { PrismaClient, Prisma, AmendmentStatus } from '@skillancer/database';

/**
 * Contract Amendment Repository
 *
 * Handles database operations for contract amendments.
 */
export class ContractAmendmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly defaultInclude = {
    contract: {
      select: {
        id: true,
        title: true,
        contractNumber: true,
        clientId: true,
        freelancerId: true,
      },
    },
    proposer: {
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    },
  };

  /**
   * Generate next amendment number for a contract
   */
  async generateAmendmentNumber(contractId: string): Promise<number> {
    const count = await this.prisma.contractAmendment.count({
      where: { contractId },
    });
    return count + 1;
  }

  /**
   * Create an amendment
   */
  async create(data: CreateAmendmentInput) {
    const amendmentNumber = await this.generateAmendmentNumber(data.contractId);

    return this.prisma.contractAmendment.create({
      data: {
        contractId: data.contractId,
        amendmentNumber,
        proposedBy: data.proposedById,
        proposedAt: new Date(),
        title: data.title,
        description: data.description,
        reason: data.reason,
        changes: data.changes as unknown as Prisma.InputJsonValue,
        documentUrl: data.documentUrl ?? null,
        status: 'PROPOSED',
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Find amendment by ID
   */
  async findById(id: string): Promise<AmendmentWithDetails | null> {
    return this.prisma.contractAmendment.findUnique({
      where: { id },
      include: this.defaultInclude,
    }) as Promise<AmendmentWithDetails | null>;
  }

  /**
   * Update amendment status
   */
  async updateStatus(id: string, status: AmendmentStatus) {
    return this.prisma.contractAmendment.update({
      where: { id },
      data: { status },
      include: this.defaultInclude,
    });
  }

  /**
   * Approve amendment by client
   */
  async approveByClient(id: string, response?: string) {
    const amendment = await this.findById(id);
    if (!amendment) {
      throw new Error('Amendment not found');
    }

    const isFullyApproved = amendment.freelancerApprovedAt !== null;
    const newStatus: AmendmentStatus = isFullyApproved ? 'APPROVED' : 'PENDING_FREELANCER';

    return this.prisma.contractAmendment.update({
      where: { id },
      data: {
        clientApprovedAt: new Date(),
        clientResponse: response ?? null,
        status: newStatus,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Approve amendment by freelancer
   */
  async approveByFreelancer(id: string, response?: string) {
    const amendment = await this.findById(id);
    if (!amendment) {
      throw new Error('Amendment not found');
    }

    const isFullyApproved = amendment.clientApprovedAt !== null;
    const newStatus: AmendmentStatus = isFullyApproved ? 'APPROVED' : 'PENDING_CLIENT';

    return this.prisma.contractAmendment.update({
      where: { id },
      data: {
        freelancerApprovedAt: new Date(),
        freelancerResponse: response ?? null,
        status: newStatus,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Reject amendment by client
   */
  async rejectByClient(id: string, response: string) {
    return this.prisma.contractAmendment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        clientRejectedAt: new Date(),
        clientResponse: response,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Reject amendment by freelancer
   */
  async rejectByFreelancer(id: string, response: string) {
    return this.prisma.contractAmendment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        freelancerRejectedAt: new Date(),
        freelancerResponse: response,
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Withdraw amendment (by proposer)
   */
  async withdraw(id: string) {
    return this.prisma.contractAmendment.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
      include: this.defaultInclude,
    });
  }

  /**
   * Mark amendment as effective
   */
  async markEffective(id: string) {
    return this.prisma.contractAmendment.update({
      where: { id },
      data: { effectiveAt: new Date() },
      include: this.defaultInclude,
    });
  }

  /**
   * List amendments for a contract
   */
  async list(options: AmendmentListOptions): Promise<{
    data: AmendmentWithDetails[];
    total: number;
  }> {
    const { contractId, proposedById, status, page = 1, limit = 20 } = options;

    const where: Prisma.ContractAmendmentWhereInput = {};

    if (contractId) where.contractId = contractId;
    if (proposedById) where.proposedBy = proposedById;
    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    const [data, total] = await Promise.all([
      this.prisma.contractAmendment.findMany({
        where,
        include: this.defaultInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contractAmendment.count({ where }),
    ]);

    return { data: data as AmendmentWithDetails[], total };
  }

  /**
   * Get pending amendments for a contract
   */
  async getPending(contractId: string): Promise<AmendmentWithDetails[]> {
    return this.prisma.contractAmendment.findMany({
      where: {
        contractId,
        status: { in: ['PROPOSED', 'PENDING_CLIENT', 'PENDING_FREELANCER'] },
      },
      include: this.defaultInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<AmendmentWithDetails[]>;
  }

  /**
   * Get approved amendments awaiting effectiveness
   */
  async getApprovedAwaitingEffective(contractId: string): Promise<AmendmentWithDetails[]> {
    return this.prisma.contractAmendment.findMany({
      where: {
        contractId,
        status: 'APPROVED',
        effectiveAt: null,
      },
      include: this.defaultInclude,
      orderBy: { createdAt: 'asc' },
    }) as Promise<AmendmentWithDetails[]>;
  }

  /**
   * Get amendment history for a contract
   */
  async getHistory(contractId: string): Promise<AmendmentWithDetails[]> {
    return this.prisma.contractAmendment.findMany({
      where: {
        contractId,
        status: { in: ['APPROVED', 'REJECTED', 'WITHDRAWN'] },
      },
      include: this.defaultInclude,
      orderBy: { updatedAt: 'desc' },
    }) as Promise<AmendmentWithDetails[]>;
  }

  /**
   * Check if there are pending amendments for a contract
   */
  async hasPending(contractId: string): Promise<boolean> {
    const count = await this.prisma.contractAmendment.count({
      where: {
        contractId,
        status: { in: ['PROPOSED', 'PENDING_CLIENT', 'PENDING_FREELANCER'] },
      },
    });
    return count > 0;
  }

  /**
   * Count amendments by status for a contract
   */
  async countByStatus(contractId: string): Promise<Record<AmendmentStatus, number>> {
    const counts = await this.prisma.contractAmendment.groupBy({
      by: ['status'],
      where: { contractId },
      _count: true,
    });

    const result: Partial<Record<AmendmentStatus, number>> = {};
    for (const count of counts) {
      result[count.status] = count._count;
    }

    return result as Record<AmendmentStatus, number>;
  }

  /**
   * Delete amendment (for drafts only)
   */
  async delete(id: string) {
    return this.prisma.contractAmendment.delete({
      where: { id },
    });
  }
}
