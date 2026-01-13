/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/**
 * @module @skillancer/market-svc/repositories/contract-milestone
 * Contract Milestone V2 data access layer
 */

import { Prisma } from '../types/prisma-shim.js';

import type {
  CreateContractMilestoneInput,
  UpdateMilestoneInput,
  MilestoneListOptions,
  MilestoneWithDetails,
  DeliverableSubmission,
} from '../types/contract.types.js';
import type { PrismaClient, MilestoneStatusV2 } from '../types/prisma-shim.js';

/**
 * Contract Milestone Repository
 *
 * Handles database operations for contract milestones V2.
 */
export class ContractMilestoneRepository {
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
  };

  /**
   * Create a milestone for a contract
   */
  async create(contractId: string, data: CreateContractMilestoneInput) {
    return this.prisma.contractMilestoneV2.create({
      data: {
        contractId,
        title: data.title,
        description: data.description ?? null,
        amount: new Prisma.Decimal(data.amount),
        dueDate: data.dueDate ?? null,
        orderIndex: data.orderIndex ?? 1,
        deliverables: data.deliverables
          ? (data.deliverables as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        status: 'PENDING',
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Create multiple milestones for a contract
   */
  async createMany(contractId: string, milestones: CreateContractMilestoneInput[]) {
    return this.prisma.contractMilestoneV2.createMany({
      data: milestones.map((m, index) => ({
        contractId,
        title: m.title,
        description: m.description ?? null,
        amount: new Prisma.Decimal(m.amount),
        dueDate: m.dueDate ?? null,
        orderIndex: m.orderIndex ?? index + 1,
        deliverables: m.deliverables ? (m.deliverables as Prisma.InputJsonValue) : Prisma.JsonNull,
        status: 'PENDING' as const,
      })),
    });
  }

  /**
   * Find milestone by ID
   */
  async findById(id: string): Promise<MilestoneWithDetails | null> {
    return this.prisma.contractMilestoneV2.findUnique({
      where: { id },
      include: this.defaultInclude,
    }) as Promise<MilestoneWithDetails | null>;
  }

  /**
   * Update milestone
   */
  async update(id: string, data: UpdateMilestoneInput) {
    const updateData: Prisma.ContractMilestoneV2UpdateInput = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ?? null;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    if (data.deliverables !== undefined)
      updateData.deliverables = data.deliverables
        ? (data.deliverables as Prisma.InputJsonValue)
        : Prisma.JsonNull;

    return this.prisma.contractMilestoneV2.update({
      where: { id },
      data: updateData,
      include: this.defaultInclude,
    });
  }

  /**
   * Update milestone status
   */
  async updateStatus(
    id: string,
    status: MilestoneStatusV2,
    additionalData?: Partial<{
      submittedAt: Date;
      submissionNote: string;
      submissionFiles: Prisma.InputJsonValue;
      approvedAt: Date;
      approvedBy: string;
      rejectedAt: Date;
      rejectionReason: string;
      rejectionCount: number;
      revisionRequestedAt: Date;
      revisionNote: string;
      paidAt: Date;
      paymentTransactionId: string;
      escrowFunded: boolean;
      escrowFundedAt: Date;
      escrowTransactionId: string;
    }>
  ) {
    return this.prisma.contractMilestoneV2.update({
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
   * Submit milestone deliverables
   */
  async submit(id: string, submissionNote?: string, deliverables?: DeliverableSubmission[]) {
    return this.prisma.contractMilestoneV2.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submissionNote: submissionNote ?? null,
        submissionFiles: deliverables
          ? (deliverables as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Approve milestone
   */
  async approve(id: string, approvedBy: string) {
    return this.prisma.contractMilestoneV2.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Reject milestone (sets to REVISION_REQUESTED with rejection info)
   */
  async reject(id: string, rejectionReason: string) {
    return this.prisma.contractMilestoneV2.update({
      where: { id },
      data: {
        status: 'REVISION_REQUESTED',
        rejectedAt: new Date(),
        rejectionReason,
        rejectionCount: { increment: 1 },
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Request revision
   */
  async requestRevision(id: string, revisionNote: string) {
    return this.prisma.contractMilestoneV2.update({
      where: { id },
      data: {
        status: 'REVISION_REQUESTED',
        revisionRequestedAt: new Date(),
        revisionNote,
        // Use rejectionCount as the counter for revisions/rejections
        rejectionCount: { increment: 1 },
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Mark milestone as paid
   */
  async markPaid(id: string, paymentTransactionId?: string) {
    return this.prisma.contractMilestoneV2.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentTransactionId: paymentTransactionId ?? null,
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Fund escrow for milestone
   */
  async fundEscrow(id: string, transactionId?: string) {
    return this.prisma.contractMilestoneV2.update({
      where: { id },
      data: {
        escrowFunded: true,
        escrowFundedAt: new Date(),
        escrowTransactionId: transactionId ?? null,
        status: 'FUNDED',
        updatedAt: new Date(),
      },
      include: this.defaultInclude,
    });
  }

  /**
   * Delete milestone
   */
  async delete(id: string) {
    return this.prisma.contractMilestoneV2.delete({
      where: { id },
    });
  }

  /**
   * List milestones for a contract
   */
  async listByContract(contractId: string, options?: MilestoneListOptions) {
    const { status } = options || {};

    const where: Prisma.ContractMilestoneV2WhereInput = { contractId };

    if (status) {
      where.status = Array.isArray(status) ? { in: status } : status;
    }

    return this.prisma.contractMilestoneV2.findMany({
      where,
      include: this.defaultInclude,
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Get milestone summary for a contract
   */
  async getSummary(contractId: string) {
    const milestones = await this.prisma.contractMilestoneV2.findMany({
      where: { contractId },
      select: {
        status: true,
        amount: true,
      },
    });

    const summary = {
      total: milestones.length,
      pending: 0,
      funded: 0,
      inProgress: 0,
      submitted: 0,
      revisionRequested: 0,
      approved: 0,
      paid: 0,
      cancelled: 0,
      disputed: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
    };

    for (const m of milestones) {
      const amount = Number(m.amount);
      summary.totalAmount += amount;

      switch (m.status) {
        case 'PENDING':
          summary.pending++;
          summary.pendingAmount += amount;
          break;
        case 'FUNDED':
          summary.funded++;
          summary.pendingAmount += amount;
          break;
        case 'IN_PROGRESS':
          summary.inProgress++;
          summary.pendingAmount += amount;
          break;
        case 'SUBMITTED':
          summary.submitted++;
          summary.pendingAmount += amount;
          break;
        case 'REVISION_REQUESTED':
          summary.revisionRequested++;
          summary.pendingAmount += amount;
          break;
        case 'APPROVED':
          summary.approved++;
          summary.pendingAmount += amount;
          break;
        case 'PAID':
          summary.paid++;
          summary.paidAmount += amount;
          break;
        case 'CANCELLED':
          summary.cancelled++;
          break;
        case 'DISPUTED':
          summary.disputed++;
          summary.pendingAmount += amount;
          break;
      }
    }

    return summary;
  }

  /**
   * Get milestones due soon
   */
  async getDueSoon(contractId: string, daysAhead: number = 7) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return this.prisma.contractMilestoneV2.findMany({
      where: {
        contractId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: this.defaultInclude,
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Get overdue milestones
   */
  async getOverdue(contractId?: string) {
    const now = new Date();

    const where: Prisma.ContractMilestoneV2WhereInput = {
      status: { in: ['PENDING', 'IN_PROGRESS', 'SUBMITTED'] },
      dueDate: {
        lt: now,
      },
    };

    if (contractId) {
      where.contractId = contractId;
    }

    return this.prisma.contractMilestoneV2.findMany({
      where,
      include: this.defaultInclude,
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Reorder milestones
   */
  async reorder(_contractId: string, milestoneOrders: { id: string; orderIndex: number }[]) {
    return this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const { id, orderIndex } of milestoneOrders) {
        const updated = await tx.contractMilestoneV2.update({
          where: { id },
          data: { orderIndex, updatedAt: new Date() },
        });
        results.push(updated);
      }
      return results;
    });
  }

  /**
   * Check if all milestones are completed
   */
  async areAllCompleted(contractId: string): Promise<boolean> {
    const milestones = await this.prisma.contractMilestoneV2.findMany({
      where: { contractId },
      select: { status: true },
    });

    return milestones.length > 0 && milestones.every((m) => m.status === 'PAID');
  }
}
