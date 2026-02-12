
import type { FinancingStatus ,
  InvoiceFinancingCreateInput,
  InvoiceFinancingUpdateInput,
  FinancingEligibility,
} from '../types/financial.types.js';
import type { PrismaClient } from '@prisma/client';

export class InvoiceFinancingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check financing eligibility for an invoice
   */
  async checkEligibility(userId: string, invoiceAmount: number): Promise<FinancingEligibility> {
    // Get user's history and calculate risk score
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        invoiceFinancingRequests: {
          where: { status: { in: ['REPAID', 'FUNDED', 'PARTIALLY_REPAID'] } },
        },
      },
    });

    if (!user) {
      return {
        eligible: false,
        maxAmount: 0,
        estimatedFeePercentage: 0,
        reasons: ['User not found'],
      };
    }

    const reasons: string[] = [];

    // Check if user has any defaulted loans
    const defaultedLoans = await this.prisma.invoiceFinancing.count({
      where: { userId, status: 'DEFAULTED' },
    });

    if (defaultedLoans > 0) {
      return {
        eligible: false,
        maxAmount: 0,
        estimatedFeePercentage: 0,
        reasons: ['Previous financing default on record'],
      };
    }

    // Check outstanding financing
    const outstandingFinancing = await this.prisma.invoiceFinancing.aggregate({
      where: {
        userId,
        status: { in: ['FUNDED', 'PARTIALLY_REPAID'] },
      },
      _sum: { approvedAmount: true },
    });

    const outstandingAmount = Number(outstandingFinancing._sum.approvedAmount || 0);
    const maxTotalFinancing = 50000; // Maximum total outstanding financing

    if (outstandingAmount >= maxTotalFinancing) {
      return {
        eligible: false,
        maxAmount: 0,
        estimatedFeePercentage: 0,
        reasons: ['Maximum outstanding financing limit reached'],
      };
    }

    // Calculate eligibility based on history
    const successfulFinancings = user.invoiceFinancingRequests.filter(
      (f: { status: string }) => f.status === 'REPAID'
    ).length;

    // Base maximum is 80% of invoice, up to remaining limit
    let maxPercentage = 0.8;
    let feePercentage = 3.5; // Base fee

    // Reward good history
    if (successfulFinancings >= 5) {
      maxPercentage = 0.9;
      feePercentage = 2.5;
    } else if (successfulFinancings >= 2) {
      maxPercentage = 0.85;
      feePercentage = 3.0;
    }

    const maxAmount = Math.min(
      invoiceAmount * maxPercentage,
      maxTotalFinancing - outstandingAmount
    );

    const result: FinancingEligibility = {
      eligible: maxAmount > 0,
      maxAmount,
      estimatedFeePercentage: feePercentage,
    };
    if (maxAmount <= 0) {
      result.reasons = ['Invoice amount exceeds available financing limit'];
    }
    return result;
  }

  /**
   * Request invoice financing
   */
  async requestFinancing(input: InvoiceFinancingCreateInput) {
    // Check eligibility first
    const eligibility = await this.checkEligibility(input.userId, input.invoiceAmount);

    if (!eligibility.eligible) {
      throw new Error(eligibility.reasons?.join(', ') || 'Not eligible for financing');
    }

    const requestedAmount = input.requestedAmount || input.invoiceAmount * 0.8;

    if (requestedAmount > eligibility.maxAmount) {
      throw new Error(`Maximum eligible amount is ${eligibility.maxAmount}`);
    }

    const financing = await this.prisma.invoiceFinancing.create({
      data: {
        userId: input.userId,
        invoiceId: input.invoiceId,
        invoiceAmount: input.invoiceAmount,
        currency: input.currency || 'USD',
        clientName: input.clientName,
        invoiceDueDate: input.invoiceDueDate,
        requestedAmount,
        feePercentage: eligibility.estimatedFeePercentage,
        status: 'PENDING_REVIEW',
        supportingDocuments: input.supportingDocuments || [],
      },
    });

    return financing;
  }

  /**
   * Get financing request by ID
   */
  async getFinancingById(id: string) {
    const financing = await this.prisma.invoiceFinancing.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return financing;
  }

  /**
   * Get financing requests for a user
   */
  async getUserFinancings(userId: string, status?: FinancingStatus, page = 1, limit = 20) {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const [financings, total] = await Promise.all([
      this.prisma.invoiceFinancing.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoiceFinancing.count({ where }),
    ]);

    return {
      financings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approve financing request (admin)
   */
  async approveFinancing(id: string, approvedAmount: number, feePercentage?: number) {
    const financing = await this.prisma.invoiceFinancing.findUnique({
      where: { id },
    });

    if (!financing) {
      throw new Error('Financing request not found');
    }

    if (financing.status !== 'PENDING_REVIEW') {
      throw new Error('Financing request is not pending review');
    }

    const effectiveFeePercentage = feePercentage || Number(financing.feePercentage || 0);
    const feeAmount = approvedAmount * (effectiveFeePercentage / 100);

    const updatedFinancing = await this.prisma.invoiceFinancing.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAmount,
        feePercentage: effectiveFeePercentage,
        feeAmount,
      },
    });

    return updatedFinancing;
  }

  /**
   * Reject financing request (admin)
   */
  async rejectFinancing(id: string, reason: string) {
    const financing = await this.prisma.invoiceFinancing.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: reason,
      },
    });

    return financing;
  }

  /**
   * Mark financing as funded (after funds transferred)
   */
  async markFunded(id: string) {
    const financing = await this.prisma.invoiceFinancing.findUnique({
      where: { id },
    });

    if (!financing) {
      throw new Error('Financing request not found');
    }

    if (financing.status !== 'APPROVED') {
      throw new Error('Financing must be approved before funding');
    }

    const updatedFinancing = await this.prisma.invoiceFinancing.update({
      where: { id },
      data: {
        status: 'FUNDED',
        fundedAt: new Date(),
      },
    });

    return updatedFinancing;
  }

  /**
   * Record repayment
   */
  async recordRepayment(id: string, amount: number) {
    const financing = await this.prisma.invoiceFinancing.findUnique({
      where: { id },
    });

    if (!financing) {
      throw new Error('Financing request not found');
    }

    if (!['FUNDED', 'PARTIALLY_REPAID'].includes(financing.status)) {
      throw new Error('Financing is not in a repayable state');
    }

    const newRepaidAmount = Number(financing.repaidAmount || 0) + amount;
    const totalOwed = Number(financing.approvedAmount) + Number(financing.feeAmount || 0);

    const isFullyRepaid = newRepaidAmount >= totalOwed;

    const updatedFinancing = await this.prisma.invoiceFinancing.update({
      where: { id },
      data: {
        repaidAmount: newRepaidAmount,
        status: isFullyRepaid ? 'REPAID' : 'PARTIALLY_REPAID',
        repaidAt: isFullyRepaid ? new Date() : undefined,
      },
    });

    return updatedFinancing;
  }

  /**
   * Mark financing as defaulted
   */
  async markDefaulted(id: string, reason: string) {
    const financing = await this.prisma.invoiceFinancing.update({
      where: { id },
      data: {
        status: 'DEFAULTED',
        notes: reason,
      },
    });

    return financing;
  }

  /**
   * Get financing statistics for user
   */
  async getUserFinancingStats(userId: string) {
    const [total, repaid, outstanding, totalFunded, totalFees] = await Promise.all([
      this.prisma.invoiceFinancing.count({ where: { userId } }),
      this.prisma.invoiceFinancing.count({ where: { userId, status: 'REPAID' } }),
      this.prisma.invoiceFinancing.count({
        where: { userId, status: { in: ['FUNDED', 'PARTIALLY_REPAID'] } },
      }),
      this.prisma.invoiceFinancing.aggregate({
        where: { userId, status: { in: ['FUNDED', 'PARTIALLY_REPAID', 'REPAID'] } },
        _sum: { approvedAmount: true },
      }),
      this.prisma.invoiceFinancing.aggregate({
        where: { userId, status: { in: ['FUNDED', 'PARTIALLY_REPAID', 'REPAID'] } },
        _sum: { feeAmount: true },
      }),
    ]);

    return {
      totalRequests: total,
      repaidCount: repaid,
      outstandingCount: outstanding,
      totalFunded: totalFunded._sum.approvedAmount || 0,
      totalFeesPaid: totalFees._sum.feeAmount || 0,
    };
  }

  /**
   * Get pending financing requests (admin)
   */
  async getPendingRequests(page = 1, limit = 20) {
    const [financings, total] = await Promise.all([
      this.prisma.invoiceFinancing.findMany({
        where: { status: 'PENDING_REVIEW' },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.invoiceFinancing.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);

    return {
      financings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
