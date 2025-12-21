/**
 * @module @skillancer/cockpit-svc/services/financial-reports
 * Financial Reports Service - Profit/Loss, Cash Flow, Tax Reports
 */

import { FinanceError, FinanceErrorCode } from '../errors/finance.errors.js';
import {
  FinancialTransactionRepository,
  MileageLogRepository,
  TaxProfileRepository,
} from '../repositories/index.js';

import type {
  ReportFilters,
  ProfitLossReport,
  CashFlowReport,
  TaxReport,
  ExpenseBreakdownReport,
  IncomeSourcesReport,
} from '../types/finance.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

export class FinancialReportsService {
  private readonly transactionRepository: FinancialTransactionRepository;
  private readonly mileageRepository: MileageLogRepository;
  private readonly taxProfileRepository: TaxProfileRepository;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger
  ) {
    this.transactionRepository = new FinancialTransactionRepository(prisma);
    this.mileageRepository = new MileageLogRepository(prisma);
    this.taxProfileRepository = new TaxProfileRepository(prisma);
  }

  /**
   * Generate Profit & Loss report
   */
  async generateProfitLossReport(filters: ReportFilters): Promise<ProfitLossReport> {
    this.validateDateRange(filters.startDate, filters.endDate);

    const { userId, startDate, endDate } = filters;

    // Get income by category
    const incomeByCategory = await this.transactionRepository.getAggregatesByCategory(
      userId,
      startDate,
      endDate,
      'INCOME'
    );

    // Get income by client
    const incomeByClient = await this.transactionRepository.getAggregatesByClient(
      userId,
      startDate,
      endDate
    );

    // Get expenses by category
    const expensesByCategory = await this.transactionRepository.getAggregatesByCategory(
      userId,
      startDate,
      endDate,
      'EXPENSE'
    );

    // Get income by project
    const incomeByProject = await this.getIncomeByProject(userId, startDate, endDate);

    // Calculate totals
    const totalIncome = incomeByCategory.reduce((sum, c) => sum + c.total, 0);
    const totalExpenses = expensesByCategory.reduce((sum, c) => sum + c.total, 0);
    const grossProfit = totalIncome;
    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    // Generate comparison if requested
    let comparison: ProfitLossReport['comparison'];
    if (filters.compareWithPreviousPeriod) {
      comparison = await this.generatePeriodComparison(userId, startDate, endDate);
    }

    this.logger.info({ userId, startDate, endDate }, 'P&L report generated');

    return {
      period: { start: startDate, end: endDate },
      income: {
        total: totalIncome,
        byCategory: incomeByCategory.map((c) => ({
          categoryId: c.categoryId ?? 'uncategorized',
          name: c.categoryName ?? 'Uncategorized',
          amount: c.total,
        })),
        byClient: incomeByClient.map((c) => ({
          clientId: c.clientId ?? 'no-client',
          name: c.clientName ?? 'No Client',
          amount: c.total,
        })),
        byProject: incomeByProject,
      },
      expenses: {
        total: totalExpenses,
        byCategory: expensesByCategory.map((c) => ({
          categoryId: c.categoryId ?? 'uncategorized',
          name: c.categoryName ?? 'Uncategorized',
          amount: c.total,
        })),
      },
      grossProfit,
      netProfit,
      profitMargin,
      comparison,
    };
  }

  /**
   * Generate Cash Flow report
   */
  async generateCashFlowReport(filters: ReportFilters): Promise<CashFlowReport> {
    this.validateDateRange(filters.startDate, filters.endDate);

    const { userId, startDate, endDate } = filters;

    // Get all confirmed transactions in period
    const transactions = await this.prisma.financialTransaction.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      orderBy: { date: 'asc' },
      select: {
        type: true,
        amount: true,
        date: true,
      },
    });

    // Calculate opening balance (sum of all transactions before start date)
    const openingBalanceResult = await this.prisma.financialTransaction.groupBy({
      by: ['type'],
      where: {
        userId,
        date: { lt: startDate },
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
    });

    let openingBalance = 0;
    for (const r of openingBalanceResult) {
      const amount = Number(r._sum?.amount) || 0;
      openingBalance += r.type === 'INCOME' ? amount : -amount;
    }

    // Build daily breakdown
    const dailyMap = new Map<string, { inflow: number; outflow: number }>();
    const inflows: CashFlowReport['inflows'] = [];
    const outflows: CashFlowReport['outflows'] = [];
    let runningBalance = openingBalance;

    for (const t of transactions) {
      const dateKey = t.date.toISOString().split('T')[0]!;
      const amount = Number(t.amount);

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { inflow: 0, outflow: 0 });
      }

      const day = dailyMap.get(dateKey)!;

      if (t.type === 'INCOME') {
        day.inflow += amount;
        runningBalance += amount;
        inflows.push({
          date: t.date,
          amount,
          runningBalance,
        });
      } else {
        day.outflow += amount;
        runningBalance -= amount;
        outflows.push({
          date: t.date,
          amount,
          runningBalance,
        });
      }
    }

    // Convert daily map to array
    const dailyBreakdown: CashFlowReport['dailyBreakdown'] = [];
    let balance = openingBalance;

    const dates = Array.from(dailyMap.keys()).sort();
    for (const dateKey of dates) {
      const day = dailyMap.get(dateKey)!;
      const netFlow = day.inflow - day.outflow;
      balance += netFlow;

      dailyBreakdown.push({
        date: new Date(dateKey),
        inflow: day.inflow,
        outflow: day.outflow,
        netFlow,
        balance,
      });
    }

    const closingBalance = runningBalance;
    const netCashFlow = closingBalance - openingBalance;

    this.logger.info({ userId, startDate, endDate }, 'Cash flow report generated');

    return {
      period: { start: startDate, end: endDate },
      openingBalance,
      closingBalance,
      netCashFlow,
      inflows,
      outflows,
      dailyBreakdown,
    };
  }

  /**
   * Generate Tax Report for a tax year
   */
  async generateTaxReport(userId: string, taxYear: number): Promise<TaxReport> {
    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear, 11, 31, 23, 59, 59, 999);

    // Get tax profile
    const taxProfile = await this.taxProfileRepository.getWithEstimates(userId, taxYear);

    // Get gross income
    const incomeResult = await this.prisma.financialTransaction.aggregate({
      where: {
        userId,
        type: 'INCOME',
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
    });
    const grossIncome = Number(incomeResult._sum?.amount) || 0;

    // Get all expenses
    const expenseResult = await this.prisma.financialTransaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
    });
    const totalExpenses = Number(expenseResult._sum?.amount) || 0;

    // Get tax deductible expenses by category
    const taxDeductible = await this.transactionRepository.getTaxDeductibleExpenses(
      userId,
      taxYear
    );

    // Get mileage deduction
    const mileageSummary = await this.mileageRepository.getTaxYearSummary(userId, taxYear);
    const mileageDeduction = mileageSummary.estimatedDeduction;

    // Calculate totals
    const homeOfficeDeduction = 0; // Would need separate calculation
    const otherDeductions = 0;
    const totalDeductions =
      taxDeductible.total + mileageDeduction + homeOfficeDeduction + otherDeductions;

    const netSelfEmploymentIncome = grossIncome - totalDeductions;
    const taxableIncome = Math.max(0, netSelfEmploymentIncome);

    // Calculate estimated taxes (standard self-employment tax rate is 15.3%)
    const seTaxRate = 0.153;
    const estimatedSelfEmploymentTax =
      taxProfile?.estimatedSelfEmploymentTax ?? taxableIncome * seTaxRate;

    // Simplified income tax estimate (would need more complex calculation)
    const estimatedIncomeTax = taxProfile?.estimatedIncomeTax ?? taxableIncome * 0.22;
    const totalEstimatedTax = estimatedSelfEmploymentTax + Number(estimatedIncomeTax);

    // Generate quarterly payment schedule
    const quarterlyPayments = this.generateQuarterlyPaymentSchedule(taxYear, totalEstimatedTax);

    // Generate Schedule C data
    const scheduleCData = await this.generateScheduleCData(
      userId,
      taxYear,
      grossIncome,
      taxDeductible
    );

    this.logger.info({ userId, taxYear }, 'Tax report generated');

    return {
      taxYear,
      grossIncome,
      totalExpenses,
      taxDeductibleExpenses: taxDeductible.total,
      netSelfEmploymentIncome,
      mileageDeduction,
      homeOfficeDeduction,
      otherDeductions,
      totalDeductions,
      taxableIncome,
      estimatedSelfEmploymentTax,
      estimatedIncomeTax: Number(estimatedIncomeTax),
      totalEstimatedTax,
      quarterlyPayments,
      scheduleCData,
    };
  }

  /**
   * Generate Expense Breakdown report
   */
  async generateExpenseBreakdown(filters: ReportFilters): Promise<ExpenseBreakdownReport> {
    this.validateDateRange(filters.startDate, filters.endDate);

    const { userId, startDate, endDate } = filters;

    // Get expenses by category
    const expensesByCategory = await this.transactionRepository.getAggregatesByCategory(
      userId,
      startDate,
      endDate,
      'EXPENSE'
    );

    // Get category details for IRS info
    const categoryIds = expensesByCategory
      .map((e) => e.categoryId)
      .filter((id): id is string => id !== null);

    const categories = await this.prisma.transactionCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, irsCategory: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const totalExpenses = expensesByCategory.reduce((sum, c) => sum + c.total, 0);

    // Calculate previous period for trend
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);

    const prevExpenses = await this.transactionRepository.getAggregatesByCategory(
      userId,
      prevStartDate,
      prevEndDate,
      'EXPENSE'
    );

    const prevMap = new Map(prevExpenses.map((e) => [e.categoryId, e.total]));

    // Build category breakdown with trends
    const categoryBreakdown = expensesByCategory.map((e) => {
      const cat = e.categoryId ? categoryMap.get(e.categoryId) : null;
      const prevAmount = e.categoryId ? (prevMap.get(e.categoryId) ?? 0) : 0;
      const trend = prevAmount > 0 ? ((e.total - prevAmount) / prevAmount) * 100 : 0;

      return {
        categoryId: e.categoryId ?? 'uncategorized',
        name: e.categoryName ?? 'Uncategorized',
        amount: e.total,
        percentage: totalExpenses > 0 ? (e.total / totalExpenses) * 100 : 0,
        transactionCount: e.count,
        trend,
        irsCategory: cat?.irsCategory ?? undefined,
      };
    });

    // Get top vendors
    const topVendors = await this.getTopVendors(userId, startDate, endDate, 10);

    // Calculate tax deductible totals
    const taxDeductibleResult = await this.prisma.financialTransaction.aggregate({
      where: {
        userId,
        type: 'EXPENSE',
        isDeductible: true,
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
    });

    const taxDeductibleTotal = Number(taxDeductibleResult._sum?.amount) || 0;
    const taxDeductiblePercentage =
      totalExpenses > 0 ? (taxDeductibleTotal / totalExpenses) * 100 : 0;

    this.logger.info({ userId, startDate, endDate }, 'Expense breakdown generated');

    return {
      period: { start: startDate, end: endDate },
      totalExpenses,
      categories: categoryBreakdown,
      topVendors,
      taxDeductibleTotal,
      taxDeductiblePercentage,
    };
  }

  /**
   * Generate Income Sources report
   */
  async generateIncomeSources(filters: ReportFilters): Promise<IncomeSourcesReport> {
    this.validateDateRange(filters.startDate, filters.endDate);

    const { userId, startDate, endDate } = filters;

    // Get income by client
    const incomeByClient = await this.transactionRepository.getAggregatesByClient(
      userId,
      startDate,
      endDate
    );

    // Get income by project
    const incomeByProject = await this.getIncomeByProject(userId, startDate, endDate);

    // Get income by source
    const incomeBySource = await this.prisma.financialTransaction.groupBy({
      by: ['source'],
      where: {
        userId,
        type: 'INCOME',
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const totalIncome = incomeByClient.reduce((sum, c) => sum + c.total, 0);

    // Build client breakdown
    const byClient = incomeByClient.map((c) => ({
      clientId: c.clientId ?? 'no-client',
      name: c.clientName ?? 'No Client',
      amount: c.total,
      percentage: totalIncome > 0 ? (c.total / totalIncome) * 100 : 0,
      transactionCount: c.count,
      invoicedAmount: c.total, // Would need invoice data
      receivedAmount: c.total,
    }));

    // Build source breakdown
    const bySource = incomeBySource.map((s) => ({
      source: s.source,
      amount: Number(s._sum?.amount) || 0,
      percentage: totalIncome > 0 ? ((Number(s._sum?.amount) || 0) / totalIncome) * 100 : 0,
      transactionCount: s._count.id,
    }));

    // Receivables aging would need invoice data
    const receivablesAging = {
      current: 0,
      days30: 0,
      days60: 0,
      days90Plus: 0,
    };

    this.logger.info({ userId, startDate, endDate }, 'Income sources report generated');

    return {
      period: { start: startDate, end: endDate },
      totalIncome,
      byClient,
      byProject: incomeByProject,
      bySource,
      receivablesAging,
    };
  }

  /**
   * Validate date range
   */
  private validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate > endDate) {
      throw new FinanceError(FinanceErrorCode.INVALID_DATE_RANGE);
    }
  }

  /**
   * Get income by project
   */
  private async getIncomeByProject(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      projectId: string;
      name: string;
      clientName: string;
      amount: number;
      percentage: number;
    }>
  > {
    const results = await this.prisma.financialTransaction.groupBy({
      by: ['projectId'],
      where: {
        userId,
        type: 'INCOME',
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
        projectId: { not: null },
      },
      _sum: { amount: true },
    });

    const projectIds = results.map((r) => r.projectId).filter((id): id is string => id !== null);

    const projects = await this.prisma.cockpitProject.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        name: true,
        client: { select: { companyName: true, firstName: true, lastName: true } },
      },
    });

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const total = results.reduce((sum, r) => sum + (Number(r._sum?.amount) || 0), 0);

    return results.map((r) => {
      const project = r.projectId ? projectMap.get(r.projectId) : null;
      const amount = Number(r._sum?.amount) || 0;

      return {
        projectId: r.projectId ?? 'no-project',
        name: project?.name ?? 'Unknown Project',
        clientName: project?.client
          ? project.client.companyName ||
            `${project.client.firstName} ${project.client.lastName}`.trim()
          : 'No Client',
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      };
    });
  }

  /**
   * Get top vendors by spend
   */
  private async getTopVendors(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<Array<{ vendor: string; amount: number; transactionCount: number }>> {
    const results = await this.prisma.financialTransaction.groupBy({
      by: ['vendor'],
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: startDate, lte: endDate },
        status: 'CONFIRMED',
        vendor: { not: null },
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    return results.map((r) => ({
      vendor: r.vendor ?? 'Unknown',
      amount: Number(r._sum?.amount) || 0,
      transactionCount: r._count.id,
    }));
  }

  /**
   * Generate period comparison for P&L
   */
  private async generatePeriodComparison(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProfitLossReport['comparison']> {
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);

    const prevAggregates = await this.transactionRepository.getAggregates(
      userId,
      prevStartDate,
      prevEndDate
    );

    const currentAggregates = await this.transactionRepository.getAggregates(
      userId,
      startDate,
      endDate
    );

    const prevNetProfit = prevAggregates.totalIncome - prevAggregates.totalExpenses;
    const currentNetProfit = currentAggregates.totalIncome - currentAggregates.totalExpenses;

    return {
      previousPeriod: {
        income: prevAggregates.totalIncome,
        expenses: prevAggregates.totalExpenses,
        netProfit: prevNetProfit,
      },
      incomeChange:
        prevAggregates.totalIncome > 0
          ? ((currentAggregates.totalIncome - prevAggregates.totalIncome) /
              prevAggregates.totalIncome) *
            100
          : 0,
      expensesChange:
        prevAggregates.totalExpenses > 0
          ? ((currentAggregates.totalExpenses - prevAggregates.totalExpenses) /
              prevAggregates.totalExpenses) *
            100
          : 0,
      profitChange:
        prevNetProfit !== 0
          ? ((currentNetProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100
          : 0,
    };
  }

  /**
   * Generate Schedule C data
   */
  private async generateScheduleCData(
    userId: string,
    taxYear: number,
    grossReceipts: number,
    taxDeductible: { total: number; byCategory: Array<{ scheduleC: string | null; total: number }> }
  ): Promise<TaxReport['scheduleCData']> {
    // Map categories to Schedule C lines
    const lineMap = new Map<string, number>();

    for (const cat of taxDeductible.byCategory) {
      if (cat.scheduleC) {
        const existing = lineMap.get(cat.scheduleC) ?? 0;
        lineMap.set(cat.scheduleC, existing + cat.total);
      }
    }

    const expenses = Array.from(lineMap.entries()).map(([line, amount]) => ({
      lineNumber: line.replace('Line ', ''),
      description: this.getScheduleCLineDescription(line),
      amount,
    }));

    const costOfGoodsSold = 0; // Would need inventory tracking
    const grossProfit = grossReceipts - costOfGoodsSold;
    const totalExpenses = taxDeductible.total;
    const netProfit = grossProfit - totalExpenses;

    return {
      grossReceipts,
      costOfGoodsSold,
      grossProfit,
      expenses,
      netProfit,
    };
  }

  /**
   * Get Schedule C line description
   */
  private getScheduleCLineDescription(line: string): string {
    const descriptions: Record<string, string> = {
      'Line 8': 'Advertising',
      'Line 9': 'Car and truck expenses',
      'Line 10': 'Commissions and fees',
      'Line 11': 'Contract labor',
      'Line 13': 'Depreciation',
      'Line 15': 'Insurance',
      'Line 16': 'Interest',
      'Line 17': 'Legal and professional services',
      'Line 18': 'Office expense',
      'Line 20': 'Rent or lease',
      'Line 21': 'Repairs and maintenance',
      'Line 22': 'Supplies',
      'Line 23': 'Taxes and licenses',
      'Line 24a': 'Travel',
      'Line 24b': 'Meals',
      'Line 25': 'Utilities',
      'Line 27a': 'Other expenses',
      'Line 30': 'Expenses for business use of your home',
    };

    return descriptions[line] ?? 'Other';
  }

  /**
   * Generate quarterly payment schedule
   */
  private generateQuarterlyPaymentSchedule(
    taxYear: number,
    totalTax: number
  ): TaxReport['quarterlyPayments'] {
    const now = new Date();
    const quarterlyAmount = totalTax / 4;

    const dates = [
      new Date(taxYear, 3, 15), // April 15
      new Date(taxYear, 5, 15), // June 15
      new Date(taxYear, 8, 15), // September 15
      new Date(taxYear + 1, 0, 15), // January 15 (next year)
    ];

    return dates.map((dueDate, index) => ({
      quarter: index + 1,
      dueDate,
      estimatedAmount: quarterlyAmount,
      paidAmount: 0, // Would need payment tracking
      status: dueDate < now ? 'OVERDUE' : 'PENDING',
    }));
  }
}
