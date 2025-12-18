/**
 * @module @skillancer/market-svc/repositories/escrow
 * Escrow Account and Transaction data access layer for ContractV2
 */

import { Prisma } from '@skillancer/database';

import type {
  PrismaClient,
  EscrowAccountStatusV2,
  EscrowTransactionTypeV2,
  EscrowTransactionStatusV2,
} from '@skillancer/database';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateEscrowAccountInput {
  contractId: string;
  clientUserId: string;
  freelancerUserId: string;
  currency?: string;
}

export interface CreateEscrowTransactionInput {
  escrowAccountId: string;
  contractId: string;
  transactionType: EscrowTransactionTypeV2;
  amount: number;
  milestoneId?: string | undefined;
  invoiceId?: string;
  disputeId?: string;
  platformFee?: number;
  processingFee?: number;
  netAmount?: number;
  currency?: string;
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  stripeRefundId?: string;
  stripeChargeId?: string;
  description?: string;
  metadata?: Prisma.JsonValue;
}

export interface UpdateEscrowTransactionInput {
  status?: EscrowTransactionStatusV2;
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  stripeRefundId?: string;
  stripeChargeId?: string;
  failureCode?: string;
  failureMessage?: string;
  processedAt?: Date;
}

export interface UpdateEscrowBalanceInput {
  balance?: { increment?: number; decrement?: number };
  pendingBalance?: { increment?: number; decrement?: number };
  releasedBalance?: { increment?: number; decrement?: number };
  refundedBalance?: { increment?: number; decrement?: number };
  disputedBalance?: { increment?: number; decrement?: number };
  status?: EscrowAccountStatusV2;
}

export interface EscrowAccountWithDetails {
  id: string;
  contractId: string;
  clientUserId: string;
  freelancerUserId: string;
  balance: Prisma.Decimal;
  pendingBalance: Prisma.Decimal;
  releasedBalance: Prisma.Decimal;
  refundedBalance: Prisma.Decimal;
  disputedBalance: Prisma.Decimal;
  currency: string;
  status: EscrowAccountStatusV2;
  createdAt: Date;
  updatedAt: Date;
  contract: {
    id: string;
    title: string;
    contractNumber: string;
    status: string;
  };
  transactions?: Array<{
    id: string;
    transactionType: EscrowTransactionTypeV2;
    status: EscrowTransactionStatusV2;
    amount: Prisma.Decimal;
    createdAt: Date;
  }>;
}

export interface EscrowTransactionWithDetails {
  id: string;
  escrowAccountId: string;
  contractId: string;
  transactionType: EscrowTransactionTypeV2;
  status: EscrowTransactionStatusV2;
  milestoneId: string | null;
  invoiceId: string | null;
  disputeId: string | null;
  amount: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  processingFee: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  currency: string;
  stripePaymentIntentId: string | null;
  stripeTransferId: string | null;
  stripeRefundId: string | null;
  description: string | null;
  processedAt: Date | null;
  createdAt: Date;
  milestone?: {
    id: string;
    title: string;
    amount: Prisma.Decimal;
  } | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    total: Prisma.Decimal;
  } | null;
}

// =============================================================================
// ESCROW REPOSITORY CLASS
// =============================================================================

/**
 * Escrow Repository
 *
 * Handles database operations for escrow accounts and transactions.
 */
export class EscrowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ===========================================================================
  // ESCROW ACCOUNT OPERATIONS
  // ===========================================================================

  /**
   * Create a new escrow account for a contract
   */
  async createAccount(data: CreateEscrowAccountInput) {
    return this.prisma.escrowAccountV2.create({
      data: {
        contractId: data.contractId,
        clientUserId: data.clientUserId,
        freelancerUserId: data.freelancerUserId,
        currency: data.currency ?? 'USD',
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Get or create escrow account for a contract
   */
  async getOrCreateAccount(data: CreateEscrowAccountInput) {
    const existing = await this.prisma.escrowAccountV2.findUnique({
      where: { contractId: data.contractId },
    });

    if (existing) {
      return existing;
    }

    return this.createAccount(data);
  }

  /**
   * Find escrow account by ID
   */
  async findAccountById(id: string): Promise<EscrowAccountWithDetails | null> {
    return this.prisma.escrowAccountV2.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            id: true,
            title: true,
            contractNumber: true,
            status: true,
          },
        },
        transactions: {
          select: {
            id: true,
            transactionType: true,
            status: true,
            amount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    }) as Promise<EscrowAccountWithDetails | null>;
  }

  /**
   * Find escrow account by contract ID
   */
  async findAccountByContractId(contractId: string): Promise<EscrowAccountWithDetails | null> {
    return this.prisma.escrowAccountV2.findUnique({
      where: { contractId },
      include: {
        contract: {
          select: {
            id: true,
            title: true,
            contractNumber: true,
            status: true,
          },
        },
        transactions: {
          select: {
            id: true,
            transactionType: true,
            status: true,
            amount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    }) as Promise<EscrowAccountWithDetails | null>;
  }

  /**
   * Update escrow account balance
   */
  async updateAccountBalance(contractId: string, data: UpdateEscrowBalanceInput) {
    const updateData: Prisma.EscrowAccountV2UpdateInput = {
      updatedAt: new Date(),
    };

    if (data.balance) {
      if (data.balance.increment) {
        updateData.balance = { increment: new Prisma.Decimal(data.balance.increment) };
      } else if (data.balance.decrement) {
        updateData.balance = { decrement: new Prisma.Decimal(data.balance.decrement) };
      }
    }

    if (data.pendingBalance) {
      if (data.pendingBalance.increment) {
        updateData.pendingBalance = {
          increment: new Prisma.Decimal(data.pendingBalance.increment),
        };
      } else if (data.pendingBalance.decrement) {
        updateData.pendingBalance = {
          decrement: new Prisma.Decimal(data.pendingBalance.decrement),
        };
      }
    }

    if (data.releasedBalance) {
      if (data.releasedBalance.increment) {
        updateData.releasedBalance = {
          increment: new Prisma.Decimal(data.releasedBalance.increment),
        };
      } else if (data.releasedBalance.decrement) {
        updateData.releasedBalance = {
          decrement: new Prisma.Decimal(data.releasedBalance.decrement),
        };
      }
    }

    if (data.refundedBalance) {
      if (data.refundedBalance.increment) {
        updateData.refundedBalance = {
          increment: new Prisma.Decimal(data.refundedBalance.increment),
        };
      } else if (data.refundedBalance.decrement) {
        updateData.refundedBalance = {
          decrement: new Prisma.Decimal(data.refundedBalance.decrement),
        };
      }
    }

    if (data.disputedBalance) {
      if (data.disputedBalance.increment) {
        updateData.disputedBalance = {
          increment: new Prisma.Decimal(data.disputedBalance.increment),
        };
      } else if (data.disputedBalance.decrement) {
        updateData.disputedBalance = {
          decrement: new Prisma.Decimal(data.disputedBalance.decrement),
        };
      }
    }

    if (data.status) {
      updateData.status = data.status;
    }

    return this.prisma.escrowAccountV2.update({
      where: { contractId },
      data: updateData,
    });
  }

  /**
   * Update escrow account status
   */
  async updateAccountStatus(contractId: string, status: EscrowAccountStatusV2) {
    return this.prisma.escrowAccountV2.update({
      where: { contractId },
      data: { status, updatedAt: new Date() },
    });
  }

  // ===========================================================================
  // ESCROW TRANSACTION OPERATIONS
  // ===========================================================================

  /**
   * Create a new escrow transaction
   */
  async createTransaction(data: CreateEscrowTransactionInput) {
    return this.prisma.escrowTransactionV2.create({
      data: {
        escrowAccountId: data.escrowAccountId,
        contractId: data.contractId,
        transactionType: data.transactionType,
        status: 'PENDING',
        amount: new Prisma.Decimal(data.amount),
        milestoneId: data.milestoneId ?? null,
        invoiceId: data.invoiceId ?? null,
        disputeId: data.disputeId ?? null,
        platformFee: new Prisma.Decimal(data.platformFee ?? 0),
        processingFee: new Prisma.Decimal(data.processingFee ?? 0),
        netAmount: new Prisma.Decimal(data.netAmount ?? data.amount),
        currency: data.currency ?? 'USD',
        stripePaymentIntentId: data.stripePaymentIntentId ?? null,
        stripeTransferId: data.stripeTransferId ?? null,
        stripeRefundId: data.stripeRefundId ?? null,
        stripeChargeId: data.stripeChargeId ?? null,
        description: data.description ?? null,
        metadata: data.metadata ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Find escrow transaction by ID
   */
  async findTransactionById(id: string): Promise<EscrowTransactionWithDetails | null> {
    return this.prisma.escrowTransactionV2.findUnique({
      where: { id },
      include: {
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
          },
        },
      },
    }) as Promise<EscrowTransactionWithDetails | null>;
  }

  /**
   * Find transaction by Stripe payment intent ID
   */
  async findTransactionByPaymentIntentId(
    paymentIntentId: string
  ): Promise<EscrowTransactionWithDetails | null> {
    return this.prisma.escrowTransactionV2.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: {
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
          },
        },
      },
    }) as Promise<EscrowTransactionWithDetails | null>;
  }

  /**
   * Update escrow transaction
   */
  async updateTransaction(id: string, data: UpdateEscrowTransactionInput) {
    // Build update data object, only including fields that are provided
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.status !== undefined) updateData.status = data.status;
    if (data.stripePaymentIntentId !== undefined)
      updateData.stripePaymentIntentId = data.stripePaymentIntentId;
    if (data.stripeTransferId !== undefined) updateData.stripeTransferId = data.stripeTransferId;
    if (data.stripeRefundId !== undefined) updateData.stripeRefundId = data.stripeRefundId;
    if (data.stripeChargeId !== undefined) updateData.stripeChargeId = data.stripeChargeId;
    if (data.failureCode !== undefined) updateData.failureCode = data.failureCode;
    if (data.failureMessage !== undefined) updateData.failureMessage = data.failureMessage;
    if (data.processedAt !== undefined) updateData.processedAt = data.processedAt;

    return this.prisma.escrowTransactionV2.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Get transactions for a contract
   */
  async getTransactionsByContractId(
    contractId: string,
    options?: { limit?: number; offset?: number }
  ) {
    return this.prisma.escrowTransactionV2.findMany({
      where: { contractId },
      include: {
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  /**
   * Get transactions for a milestone
   */
  async getTransactionsByMilestoneId(milestoneId: string) {
    return this.prisma.escrowTransactionV2.findMany({
      where: { milestoneId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get pending release transactions for a contract
   */
  async getPendingReleaseTransactions(contractId: string) {
    return this.prisma.escrowTransactionV2.findMany({
      where: {
        contractId,
        transactionType: 'RELEASE',
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find funding transaction for a milestone
   */
  async findMilestoneFundingTransaction(milestoneId: string) {
    return this.prisma.escrowTransactionV2.findFirst({
      where: {
        milestoneId,
        transactionType: 'FUND',
        status: { in: ['COMPLETED', 'CAPTURED'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get total funded amount for a contract
   */
  async getTotalFundedAmount(contractId: string): Promise<number> {
    const result = await this.prisma.escrowTransactionV2.aggregate({
      where: {
        contractId,
        transactionType: 'FUND',
        status: { in: ['COMPLETED', 'CAPTURED'] },
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /**
   * Get total released amount for a contract
   */
  async getTotalReleasedAmount(contractId: string): Promise<number> {
    const result = await this.prisma.escrowTransactionV2.aggregate({
      where: {
        contractId,
        transactionType: { in: ['RELEASE', 'PARTIAL_RELEASE'] },
        status: 'COMPLETED',
      },
      _sum: { netAmount: true },
    });
    return Number(result._sum.netAmount ?? 0);
  }

  /**
   * Get transaction statistics for a contract
   */
  async getContractEscrowStats(contractId: string) {
    const [totalFunded, totalReleased, totalRefunded, pendingTransactions] = await Promise.all([
      this.getTotalFundedAmount(contractId),
      this.getTotalReleasedAmount(contractId),
      this.prisma.escrowTransactionV2.aggregate({
        where: {
          contractId,
          transactionType: { in: ['REFUND', 'PARTIAL_REFUND'] },
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      }),
      this.prisma.escrowTransactionV2.count({
        where: {
          contractId,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      }),
    ]);

    return {
      totalFunded,
      totalReleased,
      totalRefunded: Number(totalRefunded._sum.amount ?? 0),
      currentBalance: totalFunded - totalReleased - Number(totalRefunded._sum.amount ?? 0),
      pendingTransactions,
    };
  }
}
