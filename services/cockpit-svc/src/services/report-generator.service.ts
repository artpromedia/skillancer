// @ts-nocheck
/**
 * Report Generator Service
 * Generates P&L, cash flow, tax summary, and other financial reports
 */

import {
  type PrismaClient,
  FinancialPeriodType,
  FinancialReportType,
  UnifiedTransactionType,
} from '@skillancer/database';
import { logger } from '@skillancer/logger';

import { FinancialSummaryRepository } from '../repositories/financial-summary.repository';
import { UnifiedTransactionRepository } from '../repositories/unified-transaction.repository';

import type {
  ReportParameters,
  ProfitLossReportData,
  TaxSummaryReportData,
} from '../types/unified-financial.types';

export class ReportGeneratorService {
  private txRepo: UnifiedTransactionRepository;
  private summaryRepo: FinancialSummaryRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.txRepo = new UnifiedTransactionRepository(prisma);
    this.summaryRepo = new FinancialSummaryRepository(prisma);
  }

  /**
   * Generate Profit & Loss report
   */
  async generateProfitLoss(params: ReportParameters): Promise<ProfitLossReportData> {
    const { userId, startDate, endDate, baseCurrency } = params;

    const [bySource, byCategory, monthlyTrend] = await Promise.all([
      this.txRepo.getAggregatesBySource(userId, startDate, endDate),
      this.txRepo.getAggregatesByCategory(userId, startDate, endDate),
      this.txRepo.getMonthlyTotals(userId, startDate, endDate),
    ]);

    const totalIncome = bySource.reduce((sum, s) => sum + s.totalIncome, 0);
    const totalExpenses = bySource.reduce((sum, s) => sum + s.totalExpense, 0);
    const netProfit = totalIncome - totalExpenses;

    const incomeBySource: Record<string, number> = {};
    bySource.forEach((s) => {
      incomeBySource[s.source] = s.totalIncome;
    });

    return {
      period: { start: startDate, end: endDate, type: params.periodType },
      currency: baseCurrency,
      totalIncome,
      totalExpenses,
      netProfit,
      profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
      incomeBySource: incomeBySource as any,
      incomeByClient: [],
      incomeByCategory: byCategory
        .filter((c) => c.total > 0)
        .map((c) => ({
          category: c.category,
          amount: c.total,
          percentage: (c.total / totalIncome) * 100,
        })),
      expensesByCategory: byCategory
        .filter((c) => c.total < 0)
        .map((c) => ({
          category: c.category,
          irsCategory: undefined,
          amount: Math.abs(c.total),
          percentage: (Math.abs(c.total) / totalExpenses) * 100,
          taxDeductible: false,
        })),
      monthlyBreakdown: monthlyTrend.map((m) => ({
        month: m.month,
        income: m.income,
        expenses: m.expense,
        netProfit: m.net,
      })),
    };
  }

  /**
   * Generate Tax Summary report
   */
  async generateTaxSummary(
    userId: string,
    taxYear: number,
    currency = 'USD'
  ): Promise<TaxSummaryReportData> {
    const summary = await this.txRepo.getTaxYearSummary(userId, taxYear);

    const netSEIncome = summary.grossIncome - summary.deductibleExpenses;
    const seTax = netSEIncome * 0.153;

    return {
      taxYear,
      currency,
      userId,
      grossIncome: summary.grossIncome,
      incomeBySource: {} as any,
      form1099Income: summary.grossIncome,
      totalDeductions: summary.deductibleExpenses,
      deductionsByCategory: summary.byIrsCategory.map((c) => ({
        irsCategory: c.category,
        description: c.category,
        amount: c.amount,
      })),
      netSelfEmploymentIncome: netSEIncome,
      selfEmploymentTax: seTax,
      deductibleSEtax: seTax / 2,
      quarterlyPayments: [1, 2, 3, 4].map((q) => ({
        quarter: q as 1 | 2 | 3 | 4,
        dueDate: new Date(taxYear, q === 1 ? 3 : q === 2 ? 5 : q === 3 ? 8 : 0, 15),
        estimatedAmount: (netSEIncome * 0.25 + seTax) / 4,
        paidAmount: 0,
      })),
      taxableIncome: netSEIncome,
      estimatedTaxLiability: netSEIncome * 0.25 + seTax,
      effectiveTaxRate:
        netSEIncome > 0 ? ((netSEIncome * 0.25 + seTax) / summary.grossIncome) * 100 : 0,
    };
  }

  /**
   * Save generated report
   */
  async saveReport(params: ReportParameters, data: any): Promise<string> {
    const report = await this.summaryRepo.create({
      userId: params.userId,
      periodType: params.periodType,
      periodStart: params.startDate,
      periodEnd: params.endDate,
      baseCurrency: params.baseCurrency,
      totalIncome: data.totalIncome ?? 0,
      totalExpenses: data.totalExpenses ?? 0,
      netProfit: data.netProfit ?? 0,
      profitMargin: data.profitMargin ?? 0,
      incomeBySource: data.incomeBySource ?? {},
      expensesByCategory: data.expensesByCategory ?? [],
      incomeByClient: data.incomeByClient ?? [],
      incomeByProject: [],
      transactionCount: 0,
    });

    logger.info('Report saved', { reportId: report.id, type: params.reportType });
    return report.id;
  }
}

