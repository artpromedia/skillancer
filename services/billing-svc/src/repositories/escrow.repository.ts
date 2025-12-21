// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/repositories/escrow
 * Repository for escrow-related database operations
 */

import { prisma } from '@skillancer/database';

import type {
  EscrowTransactionType,
  EscrowTransactionStatus,
  EscrowBalanceStatus,
} from '../types/escrow.types.js';
import type { Prisma } from '@skillancer/database';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateEscrowTransactionData {
  contractId: string;
  milestoneId?: string;
  type: EscrowTransactionType;
  status: EscrowTransactionStatus;
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  currency: string;
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  stripeChargeId?: string;
  stripeRefundId?: string;
  fromUserId: string;
  toUserId?: string;
  description?: string;
  metadata?: Prisma.JsonValue;
  processedAt?: Date;
}

export interface UpdateEscrowTransactionData {
  status?: EscrowTransactionStatus;
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  stripeChargeId?: string;
  stripeRefundId?: string;
  failureCode?: string;
  failureMessage?: string;
  processedAt?: Date;
}

export interface UpdateEscrowBalanceData {
  totalFunded?: { increment: number } | { decrement: number };
  totalReleased?: { increment: number } | { decrement: number };
  totalRefunded?: { increment: number } | { decrement: number };
  currentBalance?: { increment: number } | { decrement: number };
  frozenAmount?: { increment: number } | { decrement: number };
  status?: EscrowBalanceStatus;
}

// =============================================================================
// ESCROW REPOSITORY CLASS
// =============================================================================

export class EscrowRepository {
  // ===========================================================================
  // ESCROW TRANSACTIONS
  // ===========================================================================

  /**
   * Create a new escrow transaction
   */
  async createTransaction(data: CreateEscrowTransactionData) {
    return prisma.escrowTransaction.create({
      data: {
        contractId: data.contractId,
        milestoneId: data.milestoneId,
        type: data.type,
        status: data.status,
        grossAmount: data.grossAmount,
        platformFee: data.platformFee,
        processingFee: data.processingFee,
        netAmount: data.netAmount,
        currency: data.currency,
        stripePaymentIntentId: data.stripePaymentIntentId,
        stripeTransferId: data.stripeTransferId,
        stripeChargeId: data.stripeChargeId,
        stripeRefundId: data.stripeRefundId,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        description: data.description,
        metadata: data.metadata ?? undefined,
        processedAt: data.processedAt,
      },
    });
  }

  /**
   * Update an escrow transaction
   */
  async updateTransaction(id: string, data: UpdateEscrowTransactionData) {
    return prisma.escrowTransaction.update({
      where: { id },
      data: {
        status: data.status,
        stripePaymentIntentId: data.stripePaymentIntentId,
        stripeTransferId: data.stripeTransferId,
        stripeChargeId: data.stripeChargeId,
        stripeRefundId: data.stripeRefundId,
        failureCode: data.failureCode,
        failureMessage: data.failureMessage,
        processedAt: data.processedAt,
      },
    });
  }

  /**
   * Find escrow transaction by ID
   */
  async findTransactionById(id: string) {
    return prisma.escrowTransaction.findUnique({
      where: { id },
      include: {
        contract: true,
        milestone: true,
      },
    });
  }

  /**
   * Find escrow transaction by Stripe payment intent ID
   */
  async findTransactionByPaymentIntentId(paymentIntentId: string) {
    return prisma.escrowTransaction.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: {
        contract: true,
        milestone: true,
      },
    });
  }

  /**
   * Find funding transaction for a contract/milestone
   */
  async findFundingTransaction(contractId: string, milestoneId?: string) {
    return prisma.escrowTransaction.findFirst({
      where: {
        contractId,
        milestoneId: milestoneId ?? null,
        type: 'FUND',
        status: { in: ['COMPLETED', 'REQUIRES_CAPTURE'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all transactions for a contract
   */
  async getTransactionsByContract(contractId: string, limit?: number) {
    return prisma.escrowTransaction.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        milestone: {
          select: { id: true, title: true },
        },
      },
    });
  }

  /**
   * Get transactions for a milestone
   */
  async getTransactionsByMilestone(milestoneId: string) {
    return prisma.escrowTransaction.findMany({
      where: { milestoneId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ===========================================================================
  // ESCROW BALANCE
  // ===========================================================================

  /**
   * Get or create escrow balance for a contract
   */
  async getOrCreateBalance(contractId: string, currency = 'USD') {
    const existing = await prisma.escrowBalance.findUnique({
      where: { contractId },
    });

    if (existing) {
      return existing;
    }

    return prisma.escrowBalance.create({
      data: {
        contractId,
        currency,
        totalFunded: 0,
        totalReleased: 0,
        totalRefunded: 0,
        currentBalance: 0,
        frozenAmount: 0,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Get escrow balance for a contract
   */
  async getBalance(contractId: string) {
    return prisma.escrowBalance.findUnique({
      where: { contractId },
    });
  }

  /**
   * Update escrow balance
   */
  async updateBalance(contractId: string, data: UpdateEscrowBalanceData) {
    // Build update object with proper Prisma increment/decrement
    const updateData: Prisma.EscrowBalanceUpdateInput = {};

    if (data.totalFunded) {
      updateData.totalFunded = data.totalFunded;
    }
    if (data.totalReleased) {
      updateData.totalReleased = data.totalReleased;
    }
    if (data.totalRefunded) {
      updateData.totalRefunded = data.totalRefunded;
    }
    if (data.currentBalance) {
      updateData.currentBalance = data.currentBalance;
    }
    if (data.frozenAmount) {
      updateData.frozenAmount = data.frozenAmount;
    }
    if (data.status) {
      updateData.status = data.status;
    }

    return prisma.escrowBalance.update({
      where: { contractId },
      data: updateData,
    });
  }

  /**
   * Freeze escrow balance (for disputes)
   */
  async freezeBalance(contractId: string, amount?: number) {
    const balance = await this.getBalance(contractId);
    if (!balance) {
      throw new Error('Escrow balance not found');
    }

    const freezeAmount = amount ?? Number(balance.currentBalance);

    return prisma.escrowBalance.update({
      where: { contractId },
      data: {
        frozenAmount: { increment: freezeAmount },
        status: 'FROZEN',
      },
    });
  }

  /**
   * Unfreeze escrow balance
   */
  async unfreezeBalance(contractId: string, amount?: number) {
    const balance = await this.getBalance(contractId);
    if (!balance) {
      throw new Error('Escrow balance not found');
    }

    const unfreezeAmount = amount ?? Number(balance.frozenAmount);
    const newFrozenAmount = Math.max(0, Number(balance.frozenAmount) - unfreezeAmount);

    return prisma.escrowBalance.update({
      where: { contractId },
      data: {
        frozenAmount: { decrement: unfreezeAmount },
        status: newFrozenAmount > 0 ? 'FROZEN' : 'ACTIVE',
      },
    });
  }

  /**
   * Close escrow balance
   */
  async closeBalance(contractId: string) {
    return prisma.escrowBalance.update({
      where: { contractId },
      data: { status: 'CLOSED' },
    });
  }
}

// =============================================================================
// MILESTONE REPOSITORY CLASS
// =============================================================================

export class MilestoneRepository {
  /**
   * Find milestone by ID with contract
   */
  async findById(id: string) {
    return prisma.milestone.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
            status: true,
            platformFeePercent: true,
            secureModeFeePercent: true,
            secureMode: true,
            currency: true,
          },
        },
      },
    });
  }

  /**
   * Find milestones by contract ID
   */
  async findByContractId(contractId: string) {
    return prisma.milestone.findMany({
      where: { contractId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Find milestones pending approval for auto-approve job
   */
  async findPendingApproval(params: { submittedBefore: Date }) {
    return prisma.milestone.findMany({
      where: {
        status: 'SUBMITTED',
        submittedAt: { lte: params.submittedBefore },
      },
      include: {
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Create milestone
   */
  async create(data: {
    contractId: string;
    title: string;
    description?: string;
    amount: number;
    dueDate?: Date;
    sortOrder?: number;
    maxRevisions?: number;
  }) {
    // Get current max sort order if not provided
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxOrder = await prisma.milestone.aggregate({
        where: { contractId: data.contractId },
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    }

    return prisma.milestone.create({
      data: {
        contractId: data.contractId,
        title: data.title,
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        sortOrder,
        maxRevisions: data.maxRevisions ?? 2,
      },
    });
  }

  /**
   * Update milestone
   */
  async update(id: string, data: Prisma.MilestoneUpdateInput) {
    return prisma.milestone.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete milestone
   */
  async delete(id: string) {
    return prisma.milestone.delete({
      where: { id },
    });
  }
}

// =============================================================================
// DISPUTE REPOSITORY CLASS
// =============================================================================

export class DisputeRepository {
  /**
   * Find dispute by ID with messages
   */
  async findById(id: string) {
    return prisma.dispute.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Find active dispute for contract
   */
  async findActiveByContract(contractId: string) {
    return prisma.dispute.findFirst({
      where: {
        contractId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  /**
   * Find all disputes for a contract
   */
  async findByContract(contractId: string) {
    return prisma.dispute.findMany({
      where: { contractId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find disputes by user (as client or freelancer)
   */
  async findByUser(userId: string, status?: string) {
    return prisma.dispute.findMany({
      where: {
        contract: {
          OR: [{ clientId: userId }, { freelancerId: userId }],
        },
        ...(status ? { status: status as never } : {}),
      },
      include: {
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find disputes that need escalation reminder
   */
  async findPendingEscalation(respondByBefore: Date) {
    return prisma.dispute.findMany({
      where: {
        status: 'OPEN',
        respondBy: { lte: respondByBefore },
        respondedAt: null,
      },
      include: {
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Create dispute
   */
  async create(data: {
    contractId: string;
    milestoneId?: string;
    raisedBy: string;
    reason: string;
    description: string;
    evidenceUrls?: string[];
    disputedAmount: number;
    currency?: string;
    respondBy?: Date;
  }) {
    return prisma.dispute.create({
      data: {
        contractId: data.contractId,
        milestoneId: data.milestoneId,
        raisedBy: data.raisedBy,
        reason: data.reason as never,
        description: data.description,
        evidenceUrls: data.evidenceUrls ?? [],
        disputedAmount: data.disputedAmount,
        currency: data.currency ?? 'USD',
        respondBy: data.respondBy ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'OPEN',
      },
      include: {
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Update dispute
   */
  async update(id: string, data: Prisma.DisputeUpdateInput) {
    return prisma.dispute.update({
      where: { id },
      data,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Add message to dispute
   */
  async addMessage(data: {
    disputeId: string;
    senderId: string;
    senderRole: string;
    message: string;
    attachmentUrls?: string[];
    proposedResolution?: string;
    proposedClientAmount?: number;
    proposedFreelancerAmount?: number;
  }) {
    return prisma.disputeMessage.create({
      data: {
        disputeId: data.disputeId,
        senderId: data.senderId,
        senderRole: data.senderRole as never,
        message: data.message,
        attachmentUrls: data.attachmentUrls ?? [],
        proposedResolution: data.proposedResolution as never | undefined,
        proposedClientAmount: data.proposedClientAmount,
        proposedFreelancerAmount: data.proposedFreelancerAmount,
      },
    });
  }

  /**
   * Find message by ID
   */
  async findMessageById(id: string) {
    return prisma.disputeMessage.findUnique({
      where: { id },
    });
  }
}

// =============================================================================
// TIME LOG REPOSITORY CLASS
// =============================================================================

export class TimeLogRepository {
  /**
   * Find time log by ID
   */
  async findById(id: string) {
    return prisma.timeLog.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            id: true,
            clientId: true,
            freelancerId: true,
            title: true,
            agreedRate: true,
          },
        },
      },
    });
  }

  /**
   * Find time logs by contract
   */
  async findByContract(contractId: string, status?: string) {
    return prisma.timeLog.findMany({
      where: {
        contractId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { startTime: 'desc' },
    });
  }

  /**
   * Find pending time logs for a contract
   */
  async findPendingByContract(contractId: string) {
    return prisma.timeLog.findMany({
      where: {
        contractId,
        status: 'PENDING',
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Find approved unbilled time logs for billing
   */
  async findApprovedUnbilled(contractId: string) {
    return prisma.timeLog.findMany({
      where: {
        contractId,
        status: 'APPROVED',
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Create time log
   */
  async create(data: {
    contractId: string;
    description?: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    hourlyRate: number;
    amount?: number;
    skillpodSessionId?: string;
    isVerified?: boolean;
  }) {
    return prisma.timeLog.create({
      data: {
        contractId: data.contractId,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        hourlyRate: data.hourlyRate,
        amount: data.amount,
        skillpodSessionId: data.skillpodSessionId,
        isVerified: data.isVerified ?? false,
        status: 'PENDING',
      },
    });
  }

  /**
   * Update time log
   */
  async update(id: string, data: Prisma.TimeLogUpdateInput) {
    return prisma.timeLog.update({
      where: { id },
      data,
    });
  }

  /**
   * Mark time logs as billed
   */
  async markAsBilled(ids: string[]) {
    return prisma.timeLog.updateMany({
      where: { id: { in: ids } },
      data: { status: 'BILLED' },
    });
  }

  /**
   * Get time log summary for contract
   */
  async getSummary(contractId: string) {
    const logs = await prisma.timeLog.findMany({
      where: { contractId },
    });

    const summary = {
      totalMinutes: 0,
      totalAmount: 0,
      pendingMinutes: 0,
      pendingAmount: 0,
      approvedMinutes: 0,
      approvedAmount: 0,
      billedMinutes: 0,
      billedAmount: 0,
    };

    for (const log of logs) {
      const minutes = log.duration ?? 0;
      const amount = Number(log.amount ?? 0);

      summary.totalMinutes += minutes;
      summary.totalAmount += amount;

      switch (log.status) {
        case 'PENDING':
          summary.pendingMinutes += minutes;
          summary.pendingAmount += amount;
          break;
        case 'APPROVED':
          summary.approvedMinutes += minutes;
          summary.approvedAmount += amount;
          break;
        case 'BILLED':
          summary.billedMinutes += minutes;
          summary.billedAmount += amount;
          break;
      }
    }

    return summary;
  }
}

// =============================================================================
// CONTRACT REPOSITORY CLASS
// =============================================================================

export class ContractRepository {
  /**
   * Find contract by ID
   */
  async findById(id: string) {
    return prisma.contract.findUnique({
      where: { id },
      include: {
        client: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        freelancer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        milestones: {
          orderBy: { sortOrder: 'asc' },
        },
        escrowBalance: true,
      },
    });
  }

  /**
   * Update contract
   */
  async update(id: string, data: Prisma.ContractUpdateInput) {
    return prisma.contract.update({
      where: { id },
      data,
    });
  }

  /**
   * Check if all milestones are released
   */
  async areAllMilestonesReleased(contractId: string): Promise<boolean> {
    const milestones = await prisma.milestone.findMany({
      where: { contractId },
      select: { status: true },
    });

    if (milestones.length === 0) {
      return false;
    }

    return milestones.every((m) => m.status === 'RELEASED' || m.status === 'PAID');
  }
}

// =============================================================================
// SINGLETON INSTANCES
// =============================================================================

let escrowRepositoryInstance: EscrowRepository | null = null;
let milestoneRepositoryInstance: MilestoneRepository | null = null;
let disputeRepositoryInstance: DisputeRepository | null = null;
let timeLogRepositoryInstance: TimeLogRepository | null = null;
let contractRepositoryInstance: ContractRepository | null = null;

export function getEscrowRepository(): EscrowRepository {
  escrowRepositoryInstance ??= new EscrowRepository();
  return escrowRepositoryInstance;
}

export function getMilestoneRepository(): MilestoneRepository {
  milestoneRepositoryInstance ??= new MilestoneRepository();
  return milestoneRepositoryInstance;
}

export function getDisputeRepository(): DisputeRepository {
  disputeRepositoryInstance ??= new DisputeRepository();
  return disputeRepositoryInstance;
}

export function getTimeLogRepository(): TimeLogRepository {
  timeLogRepositoryInstance ??= new TimeLogRepository();
  return timeLogRepositoryInstance;
}

export function getContractRepository(): ContractRepository {
  contractRepositoryInstance ??= new ContractRepository();
  return contractRepositoryInstance;
}

export function resetRepositories(): void {
  escrowRepositoryInstance = null;
  milestoneRepositoryInstance = null;
  disputeRepositoryInstance = null;
  timeLogRepositoryInstance = null;
  contractRepositoryInstance = null;
}
