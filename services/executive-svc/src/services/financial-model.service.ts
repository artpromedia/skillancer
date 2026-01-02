/**
 * @module @skillancer/executive-svc/services/financial-model
 * Financial Model Service for CFO Tool Suite
 *
 * Core financial modeling capabilities:
 * - Cash flow forecasting with assumptions
 * - Revenue and expense projections
 * - Scenario analysis (base, optimistic, pessimistic)
 * - Sensitivity analysis
 */

import type { Prisma, PrismaClient } from '@skillancer/database';

export interface ForecastAssumptions {
  revenue: {
    monthlyGrowthRate: number;
    seasonality?: Record<number, number>; // Month -> multiplier
    churnRate?: number;
    arpu?: number;
  };
  expenses: {
    fixed: ExpenseItem[];
    variable: ExpenseItem[];
    growthRate?: number;
  };
}

export interface ExpenseItem {
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  category: string;
  startDate?: Date;
  endDate?: Date;
}

export interface OneTimeItem {
  name: string;
  amount: number;
  date: Date;
  type: 'inflow' | 'outflow';
  category: string;
  probability?: number;
}

export interface WeeklyProjection {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  startingCash: number;
  revenue: number;
  expenses: number;
  oneTimeItems: number;
  netCashFlow: number;
  endingCash: number;
}

export interface ForecastScenario {
  name: string;
  description: string;
  assumptions: ForecastAssumptions;
  projections: WeeklyProjection[];
  runwayMonths: number;
  zeroCashDate?: Date;
}

export interface ForecastResult {
  baseCase: ForecastScenario;
  optimistic?: ForecastScenario;
  pessimistic?: ForecastScenario;
}

export class FinancialModelService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new cash flow forecast
   */
  async createForecast(input: {
    engagementId: string;
    startingCash: number;
    startDate: Date;
    weeks?: number;
    revenueAssumptions: ForecastAssumptions['revenue'];
    expenseAssumptions: ForecastAssumptions['expenses'];
    oneTimeItems?: OneTimeItem[];
    includeScenarios?: boolean;
  }): Promise<ForecastResult> {
    const weeks = input.weeks || 52; // Default to 1 year

    const baseAssumptions: ForecastAssumptions = {
      revenue: input.revenueAssumptions,
      expenses: input.expenseAssumptions,
    };

    // Generate base case
    const baseCase = this.generateScenario(
      'Base Case',
      'Expected scenario based on current assumptions',
      input.startingCash,
      input.startDate,
      weeks,
      baseAssumptions,
      input.oneTimeItems || []
    );

    let optimistic: ForecastScenario | undefined;
    let pessimistic: ForecastScenario | undefined;

    if (input.includeScenarios) {
      // Optimistic: 50% higher growth, 10% lower expenses
      const optimisticAssumptions: ForecastAssumptions = {
        revenue: {
          ...baseAssumptions.revenue,
          monthlyGrowthRate: baseAssumptions.revenue.monthlyGrowthRate * 1.5,
        },
        expenses: {
          ...baseAssumptions.expenses,
          fixed: baseAssumptions.expenses.fixed.map((e) => ({
            ...e,
            amount: e.amount * 0.9,
          })),
        },
      };
      optimistic = this.generateScenario(
        'Optimistic',
        'Best case with higher growth and lower expenses',
        input.startingCash,
        input.startDate,
        weeks,
        optimisticAssumptions,
        input.oneTimeItems || []
      );

      // Pessimistic: 50% lower growth, 20% higher expenses
      const pessimisticAssumptions: ForecastAssumptions = {
        revenue: {
          ...baseAssumptions.revenue,
          monthlyGrowthRate: baseAssumptions.revenue.monthlyGrowthRate * 0.5,
        },
        expenses: {
          ...baseAssumptions.expenses,
          fixed: baseAssumptions.expenses.fixed.map((e) => ({
            ...e,
            amount: e.amount * 1.2,
          })),
        },
      };
      pessimistic = this.generateScenario(
        'Pessimistic',
        'Worst case with lower growth and higher expenses',
        input.startingCash,
        input.startDate,
        weeks,
        pessimisticAssumptions,
        input.oneTimeItems || []
      );
    }

    // Save to database
    await this.saveForecast(input.engagementId, {
      baseCase,
      optimistic,
      pessimistic,
    });

    return { baseCase, optimistic, pessimistic };
  }

  /**
   * Generate a forecast scenario
   */
  private generateScenario(
    name: string,
    description: string,
    startingCash: number,
    startDate: Date,
    weeks: number,
    assumptions: ForecastAssumptions,
    oneTimeItems: OneTimeItem[]
  ): ForecastScenario {
    const projections: WeeklyProjection[] = [];
    let currentCash = startingCash;
    let currentRevenue = this.calculateInitialWeeklyRevenue(assumptions.revenue);
    let zeroCashDate: Date | undefined;

    for (let week = 1; week <= weeks; week++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Apply growth
      if (week > 1 && week % 4 === 1) {
        // Monthly growth applied at start of each month
        currentRevenue *= 1 + assumptions.revenue.monthlyGrowthRate;
      }

      // Apply seasonality
      const month = weekStart.getMonth() + 1;
      const seasonalMultiplier = assumptions.revenue.seasonality?.[month] || 1;
      const weekRevenue = currentRevenue * seasonalMultiplier;

      // Calculate expenses
      const weekExpenses = this.calculateWeeklyExpenses(assumptions.expenses, weekStart);

      // One-time items for this week
      const weekOneTimeItems = oneTimeItems.filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= weekStart && itemDate <= weekEnd;
      });
      const oneTimeNet = weekOneTimeItems.reduce((sum, item) => {
        const amount = item.amount * (item.probability || 1);
        return sum + (item.type === 'inflow' ? amount : -amount);
      }, 0);

      const netCashFlow = weekRevenue - weekExpenses + oneTimeNet;
      const endingCash = currentCash + netCashFlow;

      // Check for zero cash
      if (endingCash <= 0 && !zeroCashDate) {
        zeroCashDate = weekEnd;
      }

      projections.push({
        weekNumber: week,
        startDate: weekStart,
        endDate: weekEnd,
        startingCash: currentCash,
        revenue: Math.round(weekRevenue * 100) / 100,
        expenses: Math.round(weekExpenses * 100) / 100,
        oneTimeItems: Math.round(oneTimeNet * 100) / 100,
        netCashFlow: Math.round(netCashFlow * 100) / 100,
        endingCash: Math.round(endingCash * 100) / 100,
      });

      currentCash = endingCash;
    }

    // Calculate runway in months
    const lastPositiveWeek = projections.findIndex((p) => p.endingCash <= 0);
    const runwayWeeks = lastPositiveWeek === -1 ? weeks : lastPositiveWeek;
    const runwayMonths = Math.round((runwayWeeks / 4) * 10) / 10;

    return {
      name,
      description,
      assumptions,
      projections,
      runwayMonths,
      zeroCashDate,
    };
  }

  /**
   * Calculate initial weekly revenue based on assumptions
   */
  private calculateInitialWeeklyRevenue(revenue: ForecastAssumptions['revenue']): number {
    if (revenue.arpu && revenue.churnRate !== undefined) {
      // SaaS model: customers * ARPU
      return revenue.arpu / 4; // Assuming monthly ARPU, convert to weekly
    }
    // Default: use a placeholder or fetch from historical data
    return 0;
  }

  /**
   * Calculate weekly expenses
   */
  private calculateWeeklyExpenses(
    expenses: ForecastAssumptions['expenses'],
    weekDate: Date
  ): number {
    let total = 0;

    for (const expense of expenses.fixed) {
      if (expense.startDate && weekDate < expense.startDate) continue;
      if (expense.endDate && weekDate > expense.endDate) continue;

      switch (expense.frequency) {
        case 'weekly':
          total += expense.amount;
          break;
        case 'monthly':
          total += expense.amount / 4;
          break;
        case 'quarterly':
          total += expense.amount / 13;
          break;
        case 'annual':
          total += expense.amount / 52;
          break;
      }
    }

    for (const expense of expenses.variable) {
      if (expense.startDate && weekDate < expense.startDate) continue;
      if (expense.endDate && weekDate > expense.endDate) continue;

      switch (expense.frequency) {
        case 'weekly':
          total += expense.amount;
          break;
        case 'monthly':
          total += expense.amount / 4;
          break;
        case 'quarterly':
          total += expense.amount / 13;
          break;
        case 'annual':
          total += expense.amount / 52;
          break;
      }
    }

    return total;
  }

  /**
   * Save forecast to database
   */
  private async saveForecast(engagementId: string, result: ForecastResult): Promise<void> {
    const scenarios: Prisma.JsonValue[] = [];
    if (result.baseCase) scenarios.push(result.baseCase as unknown as Prisma.JsonValue);
    if (result.optimistic) scenarios.push(result.optimistic as unknown as Prisma.JsonValue);
    if (result.pessimistic) scenarios.push(result.pessimistic as unknown as Prisma.JsonValue);

    await this.prisma.cashFlowForecast.create({
      data: {
        engagementId,
        startingCash: result.baseCase.projections[0]?.startingCash || 0,
        startDate: result.baseCase.projections[0]?.startDate || new Date(),
        revenueAssumptions: result.baseCase.assumptions.revenue as unknown as Prisma.JsonValue,
        expenseAssumptions: result.baseCase.assumptions.expenses as unknown as Prisma.JsonValue,
        oneTimeItems: [],
        weeklyProjections: result.baseCase.projections as unknown as Prisma.JsonValue[],
        runwayMonths: result.baseCase.runwayMonths,
        zeroCashDate: result.baseCase.zeroCashDate,
        scenarios,
      },
    });
  }

  /**
   * Get forecasts for an engagement
   */
  async getForecasts(engagementId: string): Promise<unknown[]> {
    return this.prisma.cashFlowForecast.findMany({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get latest forecast
   */
  async getLatestForecast(engagementId: string): Promise<unknown | null> {
    return this.prisma.cashFlowForecast.findFirst({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Run sensitivity analysis
   */
  async runSensitivityAnalysis(input: {
    engagementId: string;
    baseAssumptions: ForecastAssumptions;
    startingCash: number;
    weeks: number;
    variable: 'revenueGrowth' | 'expenses' | 'churn';
    range: { min: number; max: number; step: number };
  }): Promise<SensitivityResult[]> {
    const results: SensitivityResult[] = [];

    for (let value = input.range.min; value <= input.range.max; value += input.range.step) {
      const assumptions = JSON.parse(JSON.stringify(input.baseAssumptions)) as ForecastAssumptions;

      switch (input.variable) {
        case 'revenueGrowth':
          assumptions.revenue.monthlyGrowthRate = value;
          break;
        case 'expenses':
          assumptions.expenses.fixed = assumptions.expenses.fixed.map((e) => ({
            ...e,
            amount: e.amount * (1 + value),
          }));
          break;
        case 'churn':
          assumptions.revenue.churnRate = value;
          break;
      }

      const scenario = this.generateScenario(
        `${input.variable}: ${value}`,
        '',
        input.startingCash,
        new Date(),
        input.weeks,
        assumptions,
        []
      );

      results.push({
        variable: input.variable,
        value,
        runwayMonths: scenario.runwayMonths,
        endingCash: scenario.projections[scenario.projections.length - 1]?.endingCash || 0,
        zeroCashDate: scenario.zeroCashDate,
      });
    }

    return results;
  }
}

export interface SensitivityResult {
  variable: string;
  value: number;
  runwayMonths: number;
  endingCash: number;
  zeroCashDate?: Date;
}

export const createFinancialModelService = (prisma: PrismaClient) =>
  new FinancialModelService(prisma);
