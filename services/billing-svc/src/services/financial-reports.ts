// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/financial-reports
 * Financial Reporting Service
 *
 * Features:
 * - Revenue reporting
 * - Platform fee tracking
 * - Freelancer earnings reports
 * - Client spending reports
 * - Reconciliation reports
 * - Export to CSV/PDF
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  format,
  eachMonthOfInterval,
  subMonths,
} from 'date-fns';

// =============================================================================
// TYPES
// =============================================================================

export type ReportPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';

export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
  period: ReportPeriod;
}

export interface RevenueReport {
  period: ReportDateRange;
  summary: {
    grossRevenue: number;
    platformFees: number;
    refunds: number;
    chargebacks: number;
    netRevenue: number;
    currency: string;
  };
  breakdown: {
    byPaymentType: Record<string, number>;
    bySubscriptionTier: Record<string, number>;
    byMonth: MonthlyRevenue[];
  };
  metrics: {
    transactionCount: number;
    averageTransactionValue: number;
    refundRate: number;
    chargebackRate: number;
  };
  generatedAt: Date;
}

export interface MonthlyRevenue {
  month: string;
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  transactionCount: number;
}

export interface FreelancerEarningsReport {
  freelancerId: string;
  freelancerName: string;
  period: ReportDateRange;
  summary: {
    grossEarnings: number;
    platformFees: number;
    netEarnings: number;
    totalPayouts: number;
    pendingBalance: number;
    currency: string;
  };
  transactions: EarningTransaction[];
  payouts: PayoutSummary[];
}

export interface EarningTransaction {
  id: string;
  date: Date;
  type: 'MILESTONE' | 'PROJECT' | 'BONUS' | 'REFUND';
  description: string;
  grossAmount: number;
  fee: number;
  netAmount: number;
  clientName?: string;
}

export interface PayoutSummary {
  id: string;
  date: Date;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  method: string;
}

export interface ClientSpendingReport {
  clientId: string;
  clientName: string;
  period: ReportDateRange;
  summary: {
    totalSpent: number;
    projectPayments: number;
    subscriptionPayments: number;
    refundsReceived: number;
    currency: string;
  };
  transactions: SpendingTransaction[];
  byFreelancer: FreelancerSpending[];
}

export interface SpendingTransaction {
  id: string;
  date: Date;
  type: string;
  description: string;
  amount: number;
  status: string;
}

export interface FreelancerSpending {
  freelancerId: string;
  freelancerName: string;
  totalPaid: number;
  projectCount: number;
}

export interface PlatformFinancialSummary {
  period: ReportDateRange;
  revenue: {
    gross: number;
    platformFees: number;
    subscriptionRevenue: number;
    marketplaceCommissions: number;
    otherRevenue: number;
    totalRevenue: number;
  };
  costs: {
    paymentProcessingFees: number;
    refunds: number;
    chargebacks: number;
    payouts: number;
    totalCosts: number;
  };
  netIncome: number;
  metrics: {
    gmv: number; // Gross Merchandise Value
    takeRate: number;
    activeFreelancers: number;
    activeClients: number;
    newFreelancers: number;
    newClients: number;
  };
}

// =============================================================================
// FINANCIAL REPORTS SERVICE CLASS
// =============================================================================

export class FinancialReportsService {
  /**
   * Generate revenue report
   */
  async generateRevenueReport(range: ReportDateRange): Promise<RevenueReport> {
    logger.info({ range }, 'Generating revenue report');

    const { startDate, endDate } = range;

    // Get all successful payments
    const payments = await prisma.payment.aggregate({
      where: {
        status: 'SUCCEEDED',
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Get platform fees (from escrow releases)
    const platformFees = await prisma.escrowRelease.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        platformFee: true,
      },
    });

    // Get refunds
    const refunds = await prisma.refund.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Get chargebacks
    const chargebacks = await prisma.dispute.aggregate({
      where: {
        status: { in: ['LOST', 'CLOSED'] },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Get subscription revenue
    const subscriptionRevenue = await prisma.subscriptionPayment.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Get monthly breakdown
    const monthlyBreakdown = await this.getMonthlyRevenue(startDate, endDate);

    // Get by payment type
    const byPaymentType = await this.getRevenueByType(startDate, endDate);

    // Get by subscription tier
    const bySubscriptionTier = await this.getRevenueBySubscriptionTier(startDate, endDate);

    const grossRevenue = payments._sum.amount || 0;
    const refundAmount = refunds._sum.amount || 0;
    const chargebackAmount = chargebacks._sum.amount || 0;
    const fees = platformFees._sum.platformFee || 0;
    const transactionCount = payments._count || 0;

    const report: RevenueReport = {
      period: range,
      summary: {
        grossRevenue,
        platformFees: fees,
        refunds: refundAmount,
        chargebacks: chargebackAmount,
        netRevenue: grossRevenue - refundAmount - chargebackAmount,
        currency: 'USD',
      },
      breakdown: {
        byPaymentType,
        bySubscriptionTier,
        byMonth: monthlyBreakdown,
      },
      metrics: {
        transactionCount,
        averageTransactionValue:
          transactionCount > 0 ? Math.round(grossRevenue / transactionCount) : 0,
        refundRate: grossRevenue > 0 ? (refundAmount / grossRevenue) * 100 : 0,
        chargebackRate: grossRevenue > 0 ? (chargebackAmount / grossRevenue) * 100 : 0,
      },
      generatedAt: new Date(),
    };

    // Store report
    await this.storeReport('REVENUE', report);

    return report;
  }

  /**
   * Generate freelancer earnings report
   */
  async generateFreelancerEarningsReport(
    freelancerId: string,
    range: ReportDateRange
  ): Promise<FreelancerEarningsReport> {
    const { startDate, endDate } = range;

    const freelancer = await prisma.user.findUnique({
      where: { id: freelancerId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!freelancer) {
      throw new Error('Freelancer not found');
    }

    // Get earnings from escrow releases
    const releases = await prisma.escrowRelease.findMany({
      where: {
        escrow: { freelancerId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        escrow: {
          include: {
            contract: true,
          },
        },
        milestone: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get payouts
    const payouts = await prisma.payout.findMany({
      where: {
        userId: freelancerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get current balance
    const pendingBalance = await prisma.escrowMilestone.aggregate({
      where: {
        escrow: {
          freelancerId,
          status: { in: ['FUNDED', 'PARTIALLY_RELEASED'] },
        },
        status: { in: ['PENDING', 'ACTIVE', 'WORK_SUBMITTED'] },
      },
      _sum: { amount: true },
    });

    // Calculate totals
    const grossEarnings = releases.reduce((sum, r) => sum + r.grossAmount, 0);
    const totalFees = releases.reduce((sum, r) => sum + r.platformFee, 0);
    const netEarnings = releases.reduce((sum, r) => sum + r.netAmount, 0);
    const totalPayouts = payouts
      .filter((p) => p.status === 'SUCCEEDED')
      .reduce((sum, p) => sum + p.netAmount, 0);

    const transactions: EarningTransaction[] = releases.map((r) => ({
      id: r.id,
      date: r.createdAt,
      type: 'MILESTONE' as const,
      description: r.milestone?.name || 'Project payment',
      grossAmount: r.grossAmount,
      fee: r.platformFee,
      netAmount: r.netAmount,
      clientName: undefined, // Would need to join with client
    }));

    const payoutSummaries: PayoutSummary[] = payouts.map((p) => ({
      id: p.id,
      date: p.createdAt,
      amount: p.amount,
      fee: p.fee,
      netAmount: p.netAmount,
      status: p.status,
      method: p.method,
    }));

    return {
      freelancerId,
      freelancerName: `${freelancer.firstName} ${freelancer.lastName}`,
      period: range,
      summary: {
        grossEarnings,
        platformFees: totalFees,
        netEarnings,
        totalPayouts,
        pendingBalance: pendingBalance._sum.amount || 0,
        currency: 'USD',
      },
      transactions,
      payouts: payoutSummaries,
    };
  }

  /**
   * Generate client spending report
   */
  async generateClientSpendingReport(
    clientId: string,
    range: ReportDateRange
  ): Promise<ClientSpendingReport> {
    const { startDate, endDate } = range;

    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true, firstName: true, lastName: true, companyName: true },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Get payments
    const payments = await prisma.payment.findMany({
      where: {
        userId: clientId,
        status: 'SUCCEEDED',
        paidAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    // Get subscription payments
    const subscriptionPayments = await prisma.subscriptionPayment.aggregate({
      where: {
        userId: clientId,
        status: 'SUCCEEDED',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    // Get refunds received
    const refunds = await prisma.refund.aggregate({
      where: {
        payment: { userId: clientId },
        status: 'SUCCEEDED',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { amount: true },
    });

    // Get spending by freelancer
    const byFreelancer = await prisma.escrowRelease.groupBy({
      by: ['escrow'],
      where: {
        escrow: { clientId },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { grossAmount: true },
      _count: true,
    });

    const projectPayments = payments.reduce((sum, p) => sum + p.amount, 0);
    const subPayments = subscriptionPayments._sum.amount || 0;
    const refundsReceived = refunds._sum.amount || 0;

    const transactions: SpendingTransaction[] = payments.map((p) => ({
      id: p.id,
      date: p.paidAt || p.createdAt,
      type: (p.metadata?.type as string) || 'PROJECT',
      description: p.description || 'Payment',
      amount: p.amount,
      status: p.status,
    }));

    return {
      clientId,
      clientName: client.companyName || `${client.firstName} ${client.lastName}`,
      period: range,
      summary: {
        totalSpent: projectPayments + subPayments - refundsReceived,
        projectPayments,
        subscriptionPayments: subPayments,
        refundsReceived,
        currency: 'USD',
      },
      transactions,
      byFreelancer: [], // Would need additional query to resolve freelancer names
    };
  }

  /**
   * Generate platform financial summary
   */
  async generatePlatformSummary(range: ReportDateRange): Promise<PlatformFinancialSummary> {
    const { startDate, endDate } = range;

    // Revenue
    const payments = await prisma.payment.aggregate({
      where: {
        status: 'SUCCEEDED',
        paidAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    const platformFees = await prisma.escrowRelease.aggregate({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { platformFee: true },
    });

    const subscriptions = await prisma.subscriptionPayment.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    // Costs
    const refunds = await prisma.refund.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    const chargebacks = await prisma.dispute.aggregate({
      where: {
        status: 'LOST',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    const payoutTotal = await prisma.payout.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { netAmount: true },
    });

    // Metrics
    const activeFreelancers = await prisma.user.count({
      where: {
        role: 'FREELANCER',
        escrows: {
          some: {
            createdAt: { gte: startDate, lte: endDate },
          },
        },
      },
    });

    const activeClients = await prisma.user.count({
      where: {
        role: 'CLIENT',
        payments: {
          some: {
            createdAt: { gte: startDate, lte: endDate },
          },
        },
      },
    });

    const gross = payments._sum.amount || 0;
    const fees = platformFees._sum.platformFee || 0;
    const subs = subscriptions._sum.amount || 0;
    const refundAmount = refunds._sum.amount || 0;
    const chargebackAmount = chargebacks._sum.amount || 0;
    const payoutsAmount = payoutTotal._sum.netAmount || 0;

    // Estimate processing fees (2.9% + $0.30 per transaction)
    const transactionCount = await prisma.payment.count({
      where: {
        status: 'SUCCEEDED',
        paidAt: { gte: startDate, lte: endDate },
      },
    });
    const processingFees = Math.round(gross * 0.029) + transactionCount * 30;

    const totalRevenue = fees + subs;
    const totalCosts = processingFees + refundAmount + chargebackAmount;

    return {
      period: range,
      revenue: {
        gross,
        platformFees: fees,
        subscriptionRevenue: subs,
        marketplaceCommissions: fees,
        otherRevenue: 0,
        totalRevenue,
      },
      costs: {
        paymentProcessingFees: processingFees,
        refunds: refundAmount,
        chargebacks: chargebackAmount,
        payouts: payoutsAmount,
        totalCosts,
      },
      netIncome: totalRevenue - totalCosts,
      metrics: {
        gmv: gross,
        takeRate: gross > 0 ? (fees / gross) * 100 : 0,
        activeFreelancers,
        activeClients,
        newFreelancers: 0, // Would need separate query
        newClients: 0,
      },
    };
  }

  /**
   * Export report to CSV
   */
  async exportToCSV(reportType: string, data: unknown): Promise<string> {
    // Basic CSV export implementation
    const records = Array.isArray(data) ? data : [data];

    if (records.length === 0) {
      return '';
    }

    const headers = Object.keys(records[0] as Record<string, unknown>);
    const csvRows = [headers.join(',')];

    for (const record of records) {
      const values = headers.map((header) => {
        const value = (record as Record<string, unknown>)[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).replace(/,/g, ';');
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async getMonthlyRevenue(startDate: Date, endDate: Date): Promise<MonthlyRevenue[]> {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    const results: MonthlyRevenue[] = [];

    for (const month of months) {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const payments = await prisma.payment.aggregate({
        where: {
          status: 'SUCCEEDED',
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
        _count: true,
      });

      const fees = await prisma.escrowRelease.aggregate({
        where: {
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { platformFee: true },
      });

      results.push({
        month: format(month, 'yyyy-MM'),
        grossRevenue: payments._sum.amount || 0,
        platformFees: fees._sum.platformFee || 0,
        netRevenue: (payments._sum.amount || 0) - (fees._sum.platformFee || 0),
        transactionCount: payments._count || 0,
      });
    }

    return results;
  }

  private async getRevenueByType(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    const types: Record<string, number> = {
      ESCROW: 0,
      SUBSCRIPTION: 0,
      DIRECT: 0,
    };

    // Escrow payments
    const escrowPayments = await prisma.payment.aggregate({
      where: {
        status: 'SUCCEEDED',
        paidAt: { gte: startDate, lte: endDate },
        metadata: { path: ['type'], equals: 'escrow_funding' },
      },
      _sum: { amount: true },
    });
    types.ESCROW = escrowPayments._sum.amount || 0;

    // Subscription payments
    const subPayments = await prisma.subscriptionPayment.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });
    types.SUBSCRIPTION = subPayments._sum.amount || 0;

    return types;
  }

  private async getRevenueBySubscriptionTier(
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    const tiers: Record<string, number> = {};

    const byTier = await prisma.subscriptionPayment.groupBy({
      by: ['tier'],
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    for (const entry of byTier) {
      tiers[entry.tier || 'UNKNOWN'] = entry._sum.amount || 0;
    }

    return tiers;
  }

  private async storeReport(type: string, data: unknown): Promise<void> {
    await prisma.financialReport.create({
      data: {
        type,
        data: data as Record<string, unknown>,
        generatedAt: new Date(),
      },
    });
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let reportsService: FinancialReportsService | null = null;

export function getFinancialReportsService(): FinancialReportsService {
  if (!reportsService) {
    reportsService = new FinancialReportsService();
  }
  return reportsService;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getDateRangeForPeriod(period: ReportPeriod, date = new Date()): ReportDateRange {
  switch (period) {
    case 'MONTHLY':
      return {
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
        period,
      };
    case 'QUARTERLY':
      return {
        startDate: startOfQuarter(date),
        endDate: endOfQuarter(date),
        period,
      };
    case 'YEARLY':
      return {
        startDate: startOfYear(date),
        endDate: endOfYear(date),
        period,
      };
    default:
      return {
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
        period: 'MONTHLY',
      };
  }
}
