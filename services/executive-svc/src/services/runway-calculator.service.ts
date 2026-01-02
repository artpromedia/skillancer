/**
 * @module @skillancer/executive-svc/services/runway-calculator
 * Runway Calculator Service for CFO Tool Suite
 *
 * Specialized runway and burn rate calculations:
 * - Current runway calculation
 * - Burn rate (gross and net)
 * - Runway scenarios (hiring, fundraising)
 * - Zero cash date projection
 */

import type { PrismaClient } from '@skillancer/database';

export interface RunwayInput {
  currentCash: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  revenueGrowthRate?: number; // Monthly percentage
  expenseGrowthRate?: number; // Monthly percentage
}

export interface BurnRateResult {
  grossBurn: number; // Total monthly expenses
  netBurn: number; // Expenses - Revenue
  burnMultiple?: number; // Net new ARR / Burn
}

export interface RunwayResult {
  months: number;
  zeroCashDate: Date | null;
  burnRate: BurnRateResult;
  monthByMonth: MonthlyProjection[];
}

export interface MonthlyProjection {
  month: number;
  date: Date;
  startingCash: number;
  revenue: number;
  expenses: number;
  netBurn: number;
  endingCash: number;
}

export interface RunwayScenario {
  name: string;
  description: string;
  adjustments: {
    additionalCash?: number;
    additionalRevenue?: number;
    additionalExpenses?: number;
    hiringPlan?: HiringPlanItem[];
  };
  result: RunwayResult;
}

export interface HiringPlanItem {
  role: string;
  monthlyCost: number;
  startMonth: number;
}

export class RunwayCalculatorService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Calculate runway based on current financials
   */
  calculateRunway(input: RunwayInput): RunwayResult {
    const maxMonths = 60; // 5 year max projection
    const projections: MonthlyProjection[] = [];

    let cash = input.currentCash;
    let revenue = input.monthlyRevenue;
    let expenses = input.monthlyExpenses;
    let zeroCashDate: Date | null = null;

    const revenueGrowth = input.revenueGrowthRate ?? 0;
    const expenseGrowth = input.expenseGrowthRate ?? 0;

    for (let month = 1; month <= maxMonths; month++) {
      const date = new Date();
      date.setMonth(date.getMonth() + month);

      // Apply growth rates after first month
      if (month > 1) {
        revenue *= 1 + revenueGrowth;
        expenses *= 1 + expenseGrowth;
      }

      const netBurn = expenses - revenue;
      const endingCash = cash - netBurn;

      projections.push({
        month,
        date,
        startingCash: cash,
        revenue: Math.round(revenue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        netBurn: Math.round(netBurn * 100) / 100,
        endingCash: Math.round(endingCash * 100) / 100,
      });

      if (endingCash <= 0 && !zeroCashDate) {
        zeroCashDate = date;
      }

      cash = endingCash;

      // Stop if cash is depleted
      if (cash <= 0) break;
    }

    const runwayMonths = zeroCashDate
      ? projections.filter((p) => p.endingCash > 0).length
      : maxMonths;

    return {
      months: runwayMonths,
      zeroCashDate,
      burnRate: this.calculateBurnRate(input),
      monthByMonth: projections,
    };
  }

  /**
   * Calculate burn rate metrics
   */
  calculateBurnRate(input: RunwayInput): BurnRateResult {
    const grossBurn = input.monthlyExpenses;
    const netBurn = input.monthlyExpenses - input.monthlyRevenue;

    // Burn multiple = Net New ARR / Net Burn (if applicable)
    // For simplicity, we assume monthly revenue * 12 as ARR proxy
    const burnMultiple =
      netBurn > 0
        ? (input.monthlyRevenue * 12 * (input.revenueGrowthRate || 0)) / (netBurn * 12)
        : undefined;

    return {
      grossBurn: Math.round(grossBurn * 100) / 100,
      netBurn: Math.round(netBurn * 100) / 100,
      burnMultiple: burnMultiple ? Math.round(burnMultiple * 100) / 100 : undefined,
    };
  }

  /**
   * Simple runway calculation (months of runway)
   */
  simpleRunway(currentCash: number, monthlyBurn: number): number {
    if (monthlyBurn <= 0) return Infinity;
    return Math.round((currentCash / monthlyBurn) * 10) / 10;
  }

  /**
   * Generate runway scenarios
   */
  generateScenarios(baseInput: RunwayInput): RunwayScenario[] {
    const scenarios: RunwayScenario[] = [];

    // Base case
    scenarios.push({
      name: 'Current State',
      description: 'Runway based on current burn rate',
      adjustments: {},
      result: this.calculateRunway(baseInput),
    });

    // Scenario: Raise $1M
    scenarios.push({
      name: 'Raise $1M',
      description: 'Runway if $1M seed round closes',
      adjustments: { additionalCash: 1000000 },
      result: this.calculateRunway({
        ...baseInput,
        currentCash: baseInput.currentCash + 1000000,
      }),
    });

    // Scenario: Raise $3M
    scenarios.push({
      name: 'Raise $3M',
      description: 'Runway if $3M Series A closes',
      adjustments: { additionalCash: 3000000 },
      result: this.calculateRunway({
        ...baseInput,
        currentCash: baseInput.currentCash + 3000000,
      }),
    });

    // Scenario: 20% expense cut
    const reducedExpenses = baseInput.monthlyExpenses * 0.8;
    scenarios.push({
      name: 'Cost Reduction (20%)',
      description: 'Runway with 20% expense reduction',
      adjustments: { additionalExpenses: -(baseInput.monthlyExpenses * 0.2) },
      result: this.calculateRunway({
        ...baseInput,
        monthlyExpenses: reducedExpenses,
      }),
    });

    // Scenario: Double revenue growth
    scenarios.push({
      name: 'Accelerated Growth',
      description: 'Runway with 2x revenue growth rate',
      adjustments: {
        additionalRevenue: baseInput.monthlyRevenue * (baseInput.revenueGrowthRate || 0.05),
      },
      result: this.calculateRunway({
        ...baseInput,
        revenueGrowthRate: (baseInput.revenueGrowthRate || 0.05) * 2,
      }),
    });

    return scenarios;
  }

  /**
   * Calculate runway with hiring plan
   */
  calculateWithHiring(baseInput: RunwayInput, hiringPlan: HiringPlanItem[]): RunwayResult {
    const maxMonths = 60;
    const projections: MonthlyProjection[] = [];

    let cash = baseInput.currentCash;
    let revenue = baseInput.monthlyRevenue;
    let baseExpenses = baseInput.monthlyExpenses;
    let zeroCashDate: Date | null = null;

    const revenueGrowth = baseInput.revenueGrowthRate ?? 0;

    for (let month = 1; month <= maxMonths; month++) {
      const date = new Date();
      date.setMonth(date.getMonth() + month);

      // Apply revenue growth after first month
      if (month > 1) {
        revenue *= 1 + revenueGrowth;
      }

      // Calculate expenses with hiring plan
      const hiringCosts = hiringPlan
        .filter((h) => month >= h.startMonth)
        .reduce((sum, h) => sum + h.monthlyCost, 0);
      const expenses = baseExpenses + hiringCosts;

      const netBurn = expenses - revenue;
      const endingCash = cash - netBurn;

      projections.push({
        month,
        date,
        startingCash: cash,
        revenue: Math.round(revenue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        netBurn: Math.round(netBurn * 100) / 100,
        endingCash: Math.round(endingCash * 100) / 100,
      });

      if (endingCash <= 0 && !zeroCashDate) {
        zeroCashDate = date;
      }

      cash = endingCash;
      if (cash <= 0) break;
    }

    const runwayMonths = zeroCashDate
      ? projections.filter((p) => p.endingCash > 0).length
      : maxMonths;

    return {
      months: runwayMonths,
      zeroCashDate,
      burnRate: {
        grossBurn: projections[projections.length - 1]?.expenses || baseInput.monthlyExpenses,
        netBurn: projections[projections.length - 1]?.netBurn || 0,
      },
      monthByMonth: projections,
    };
  }

  /**
   * Find optimal hiring timeline to maintain X months runway
   */
  findOptimalHiring(
    baseInput: RunwayInput,
    targetRunwayMonths: number,
    plannedHires: Omit<HiringPlanItem, 'startMonth'>[]
  ): HiringPlanItem[] {
    const optimalPlan: HiringPlanItem[] = [];
    let currentInput = { ...baseInput };

    for (const hire of plannedHires) {
      // Binary search for optimal start month
      let low = 1;
      let high = 24; // Max 2 years out
      let optimalMonth = high;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const testPlan = [...optimalPlan, { ...hire, startMonth: mid }];
        const result = this.calculateWithHiring(currentInput, testPlan);

        if (result.months >= targetRunwayMonths) {
          optimalMonth = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      optimalPlan.push({ ...hire, startMonth: optimalMonth });
    }

    return optimalPlan;
  }

  /**
   * Calculate "default alive" metric
   * (From Paul Graham's essay - will company become profitable before running out of money?)
   */
  isDefaultAlive(input: RunwayInput): {
    isAlive: boolean;
    monthsToBreakeven: number | null;
    breakEvenDate: Date | null;
  } {
    const maxMonths = 60;
    let revenue = input.monthlyRevenue;
    let expenses = input.monthlyExpenses;
    let cash = input.currentCash;

    const revenueGrowth = input.revenueGrowthRate ?? 0;
    const expenseGrowth = input.expenseGrowthRate ?? 0;

    for (let month = 1; month <= maxMonths; month++) {
      revenue *= 1 + revenueGrowth;
      expenses *= 1 + expenseGrowth;

      const netBurn = expenses - revenue;
      cash -= netBurn;

      // Check if profitable
      if (revenue >= expenses) {
        const date = new Date();
        date.setMonth(date.getMonth() + month);
        return {
          isAlive: cash > 0,
          monthsToBreakeven: month,
          breakEvenDate: date,
        };
      }

      // Check if out of cash
      if (cash <= 0) {
        return {
          isAlive: false,
          monthsToBreakeven: null,
          breakEvenDate: null,
        };
      }
    }

    return {
      isAlive: cash > 0,
      monthsToBreakeven: null,
      breakEvenDate: null,
    };
  }

  /**
   * Get runway data for engagement from stored forecasts
   */
  async getEngagementRunway(engagementId: string): Promise<RunwayResult | null> {
    const forecast = await this.prisma.cashFlowForecast.findFirst({
      where: { engagementId },
      orderBy: { createdAt: 'desc' },
    });

    if (!forecast) return null;

    // Convert stored forecast to runway result
    const projections = forecast.weeklyProjections as unknown as MonthlyProjection[];
    return {
      months: forecast.runwayMonths,
      zeroCashDate: forecast.zeroCashDate,
      burnRate: {
        grossBurn: 0, // Would need to calculate from stored data
        netBurn: 0,
      },
      monthByMonth: projections,
    };
  }
}

export const createRunwayCalculatorService = (prisma: PrismaClient) =>
  new RunwayCalculatorService(prisma);
