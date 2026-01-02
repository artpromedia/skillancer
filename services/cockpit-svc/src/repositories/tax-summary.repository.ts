// @ts-nocheck
/**
 * Tax Summary Repository
 *
 * Repository for managing tax year summary reports.
 */

import {
  type PrismaClient,
  Prisma,
  type TaxSummaryReport,
  FinancialReportStatus,
  type UnifiedTransactionSource,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import type { PaginationOptions, PaginatedResult } from '../types/unified-financial.types';

export interface CreateTaxSummaryInput {
  userId: string;
  taxYear: number;
  baseCurrency: string;
  grossIncome: number;
  incomeBySource: Record<UnifiedTransactionSource, number>;
  form1099Income: number;
  totalDeductions: number;
  deductionsByCategory: Array<{
    irsCategory: string;
    description: string;
    amount: number;
    scheduleC_Line?: string;
  }>;
  homeOfficeDeduction: number;
  mileageDeduction: number;
  netSelfEmploymentIncome: number;
  selfEmploymentTax: number;
  estimatedQuarterlyPayments: Array<{
    quarter: 1 | 2 | 3 | 4;
    dueDate: Date;
    estimatedAmount: number;
    paidAmount: number;
    paidDate?: Date;
  }>;
  taxableIncome: number;
  estimatedTaxLiability: number;
  effectiveTaxRate: number;
}

export interface TaxSummaryFilters {
  userId: string;
  taxYear?: number;
  taxYearFrom?: number;
  taxYearTo?: number;
  status?: FinancialReportStatus;
}

export class TaxSummaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new tax summary report
   */
  async create(input: CreateTaxSummaryInput): Promise<TaxSummaryReport> {
    try {
      return await this.prisma.taxSummaryReport.create({
        data: {
          userId: input.userId,
          taxYear: input.taxYear,
          baseCurrency: input.baseCurrency,
          grossIncome: new Prisma.Decimal(input.grossIncome),
          incomeBySource: input.incomeBySource as unknown as Prisma.JsonValue,
          form1099Income: new Prisma.Decimal(input.form1099Income),
          totalDeductions: new Prisma.Decimal(input.totalDeductions),
          deductionsByCategory: input.deductionsByCategory as unknown as Prisma.JsonValue,
          homeOfficeDeduction: new Prisma.Decimal(input.homeOfficeDeduction),
          mileageDeduction: new Prisma.Decimal(input.mileageDeduction),
          netSelfEmploymentIncome: new Prisma.Decimal(input.netSelfEmploymentIncome),
          selfEmploymentTax: new Prisma.Decimal(input.selfEmploymentTax),
          estimatedQuarterlyPayments:
            input.estimatedQuarterlyPayments as unknown as Prisma.JsonValue,
          taxableIncome: new Prisma.Decimal(input.taxableIncome),
          estimatedTaxLiability: new Prisma.Decimal(input.estimatedTaxLiability),
          effectiveTaxRate: new Prisma.Decimal(input.effectiveTaxRate),
          status: FinancialReportStatus.COMPLETED,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to create tax summary report', { error, input });
      throw error;
    }
  }

  /**
   * Find report by ID
   */
  async findById(id: string): Promise<TaxSummaryReport | null> {
    return this.prisma.taxSummaryReport.findUnique({
      where: { id },
    });
  }

  /**
   * Find report for a specific tax year
   */
  async findByTaxYear(userId: string, taxYear: number): Promise<TaxSummaryReport | null> {
    return this.prisma.taxSummaryReport.findFirst({
      where: {
        userId,
        taxYear,
        status: FinancialReportStatus.COMPLETED,
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  /**
   * Find reports with filters and pagination
   */
  async findMany(
    filters: TaxSummaryFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<TaxSummaryReport>> {
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.taxSummaryReport.findMany({
        where,
        orderBy: {
          [pagination.sortBy ?? 'taxYear']: pagination.sortOrder ?? 'desc',
        },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.taxSummaryReport.count({ where }),
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
   * Get all tax years for a user
   */
  async getTaxYears(userId: string): Promise<number[]> {
    const reports = await this.prisma.taxSummaryReport.findMany({
      where: {
        userId,
        status: FinancialReportStatus.COMPLETED,
      },
      select: { taxYear: true },
      distinct: ['taxYear'],
      orderBy: { taxYear: 'desc' },
    });

    return reports.map((r) => r.taxYear);
  }

  /**
   * Get multi-year comparison
   */
  async getMultiYearComparison(
    userId: string,
    startYear: number,
    endYear: number
  ): Promise<TaxSummaryReport[]> {
    return this.prisma.taxSummaryReport.findMany({
      where: {
        userId,
        taxYear: { gte: startYear, lte: endYear },
        status: FinancialReportStatus.COMPLETED,
      },
      orderBy: { taxYear: 'asc' },
    });
  }

  /**
   * Update quarterly payment status
   */
  async updateQuarterlyPayment(
    id: string,
    quarter: 1 | 2 | 3 | 4,
    paidAmount: number,
    paidDate: Date
  ): Promise<TaxSummaryReport> {
    const report = await this.findById(id);
    if (!report) {
      throw new Error('Tax summary report not found');
    }

    const payments = report.estimatedQuarterlyPayments as Array<{
      quarter: number;
      dueDate: string;
      estimatedAmount: number;
      paidAmount: number;
      paidDate?: string;
    }>;

    const updatedPayments = payments.map((p) =>
      p.quarter === quarter ? { ...p, paidAmount, paidDate: paidDate.toISOString() } : p
    );

    return this.prisma.taxSummaryReport.update({
      where: { id },
      data: {
        estimatedQuarterlyPayments: updatedPayments as unknown as Prisma.JsonValue,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get quarterly payment reminders
   */
  async getUpcomingQuarterlyPayments(
    userId: string,
    daysAhead: number = 30
  ): Promise<
    Array<{
      taxYear: number;
      quarter: number;
      dueDate: Date;
      estimatedAmount: number;
      paidAmount: number;
    }>
  > {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    const currentYear = new Date().getFullYear();
    const reports = await this.prisma.taxSummaryReport.findMany({
      where: {
        userId,
        taxYear: { gte: currentYear - 1, lte: currentYear },
        status: FinancialReportStatus.COMPLETED,
      },
    });

    const upcomingPayments: Array<{
      taxYear: number;
      quarter: number;
      dueDate: Date;
      estimatedAmount: number;
      paidAmount: number;
    }> = [];

    for (const report of reports) {
      const payments = report.estimatedQuarterlyPayments as Array<{
        quarter: number;
        dueDate: string;
        estimatedAmount: number;
        paidAmount: number;
      }>;

      for (const payment of payments) {
        const dueDate = new Date(payment.dueDate);
        if (
          dueDate > new Date() &&
          dueDate <= cutoffDate &&
          payment.paidAmount < payment.estimatedAmount
        ) {
          upcomingPayments.push({
            taxYear: report.taxYear,
            quarter: payment.quarter,
            dueDate,
            estimatedAmount: payment.estimatedAmount,
            paidAmount: payment.paidAmount,
          });
        }
      }
    }

    return upcomingPayments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Calculate deduction summary
   */
  async getDeductionSummary(
    userId: string,
    taxYear: number
  ): Promise<{
    totalDeductions: number;
    byCategory: Array<{ category: string; amount: number; percentage: number }>;
    homeOffice: number;
    mileage: number;
    other: number;
  } | null> {
    const report = await this.findByTaxYear(userId, taxYear);
    if (!report) {
      return null;
    }

    const deductions = report.deductionsByCategory as Array<{
      irsCategory: string;
      amount: number;
    }>;

    const totalDeductions = report.totalDeductions.toNumber();
    const byCategory = deductions.map((d) => ({
      category: d.irsCategory,
      amount: d.amount,
      percentage: totalDeductions > 0 ? (d.amount / totalDeductions) * 100 : 0,
    }));

    return {
      totalDeductions,
      byCategory,
      homeOffice: report.homeOfficeDeduction.toNumber(),
      mileage: report.mileageDeduction.toNumber(),
      other:
        totalDeductions -
        report.homeOfficeDeduction.toNumber() -
        report.mileageDeduction.toNumber(),
    };
  }

  /**
   * Build where clause from filters
   */
  private buildWhereClause(filters: TaxSummaryFilters): Prisma.TaxSummaryReportWhereInput {
    const where: Prisma.TaxSummaryReportWhereInput = {
      userId: filters.userId,
    };

    if (filters.taxYear !== undefined) {
      where.taxYear = filters.taxYear;
    } else {
      if (filters.taxYearFrom !== undefined || filters.taxYearTo !== undefined) {
        where.taxYear = {};
        if (filters.taxYearFrom !== undefined) {
          where.taxYear.gte = filters.taxYearFrom;
        }
        if (filters.taxYearTo !== undefined) {
          where.taxYear.lte = filters.taxYearTo;
        }
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return where;
  }
}

