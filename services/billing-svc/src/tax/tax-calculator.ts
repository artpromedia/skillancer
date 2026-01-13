/**
 * Tax Calculator Service
 * Estimate federal, state, and self-employment taxes
 * Sprint M5: Freelancer Financial Services
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TaxEstimate {
  year: number;
  grossIncome: number;
  deductions: TaxDeductions;
  taxableIncome: number;
  federalTax: number;
  selfEmploymentTax: number;
  stateTax: number;
  totalTax: number;
  effectiveRate: number;
  quarterlyPayment: number;
  breakdown: TaxBreakdown;
}

export interface TaxDeductions {
  standardDeduction: number;
  selfEmploymentDeduction: number;
  businessExpenses: number;
  retirementContributions: number;
  healthInsurance: number;
  homeOffice: number;
  other: number;
  total: number;
}

export interface TaxBreakdown {
  federal: FederalTaxBreakdown;
  selfEmployment: SelfEmploymentBreakdown;
  state?: StateTaxBreakdown;
}

export interface FederalTaxBreakdown {
  taxableIncome: number;
  brackets: Array<{ bracket: string; income: number; rate: number; tax: number }>;
  totalTax: number;
  marginalRate: number;
}

export interface SelfEmploymentBreakdown {
  netEarnings: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  totalTax: number;
  deduction: number;
}

export interface StateTaxBreakdown {
  state: string;
  taxableIncome: number;
  rate: number;
  tax: number;
}

export interface TaxScenario {
  name: string;
  income: number;
  deductions: Partial<TaxDeductions>;
  estimate: TaxEstimate;
}

export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household';

// ============================================================================
// 2024 TAX BRACKETS (US FEDERAL)
// ============================================================================

const FEDERAL_BRACKETS_2024: Record<FilingStatus, Array<{ limit: number; rate: number }>> = {
  single: [
    { limit: 11600, rate: 0.1 },
    { limit: 47150, rate: 0.12 },
    { limit: 100525, rate: 0.22 },
    { limit: 191950, rate: 0.24 },
    { limit: 243725, rate: 0.32 },
    { limit: 609350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married_filing_jointly: [
    { limit: 23200, rate: 0.1 },
    { limit: 94300, rate: 0.12 },
    { limit: 201050, rate: 0.22 },
    { limit: 383900, rate: 0.24 },
    { limit: 487450, rate: 0.32 },
    { limit: 731200, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married_filing_separately: [
    { limit: 11600, rate: 0.1 },
    { limit: 47150, rate: 0.12 },
    { limit: 100525, rate: 0.22 },
    { limit: 191950, rate: 0.24 },
    { limit: 243725, rate: 0.32 },
    { limit: 365600, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { limit: 16550, rate: 0.1 },
    { limit: 63100, rate: 0.12 },
    { limit: 100500, rate: 0.22 },
    { limit: 191950, rate: 0.24 },
    { limit: 243700, rate: 0.32 },
    { limit: 609350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION_2024: Record<FilingStatus, number> = {
  single: 14600,
  married_filing_jointly: 29200,
  married_filing_separately: 14600,
  head_of_household: 21900,
};

// ============================================================================
// SELF-EMPLOYMENT TAX CONSTANTS
// ============================================================================

const SE_TAX = {
  socialSecurityRate: 0.124, // 12.4%
  socialSecurityWageBase: 168600, // 2024
  medicareRate: 0.029, // 2.9%
  additionalMedicareThreshold: 200000, // For single
  additionalMedicareRate: 0.009, // 0.9%
  netEarningsMultiplier: 0.9235, // 92.35% of net self-employment income
};

// ============================================================================
// STATE TAX RATES (SIMPLIFIED)
// ============================================================================

const STATE_TAX_RATES: Record<string, { rate: number; type: 'flat' | 'progressive' }> = {
  AL: { rate: 0.05, type: 'flat' },
  AK: { rate: 0, type: 'flat' }, // No state income tax
  AZ: { rate: 0.025, type: 'flat' },
  AR: { rate: 0.047, type: 'flat' },
  CA: { rate: 0.0925, type: 'progressive' }, // Simplified
  CO: { rate: 0.044, type: 'flat' },
  CT: { rate: 0.05, type: 'progressive' },
  DE: { rate: 0.066, type: 'progressive' },
  FL: { rate: 0, type: 'flat' }, // No state income tax
  GA: { rate: 0.0549, type: 'flat' },
  HI: { rate: 0.0825, type: 'progressive' },
  ID: { rate: 0.058, type: 'flat' },
  IL: { rate: 0.0495, type: 'flat' },
  IN: { rate: 0.0305, type: 'flat' },
  IA: { rate: 0.038, type: 'flat' },
  KS: { rate: 0.057, type: 'progressive' },
  KY: { rate: 0.04, type: 'flat' },
  LA: { rate: 0.0425, type: 'progressive' },
  ME: { rate: 0.0715, type: 'progressive' },
  MD: { rate: 0.0575, type: 'progressive' },
  MA: { rate: 0.05, type: 'flat' },
  MI: { rate: 0.0405, type: 'flat' },
  MN: { rate: 0.0985, type: 'progressive' },
  MS: { rate: 0.05, type: 'flat' },
  MO: { rate: 0.048, type: 'flat' },
  MT: { rate: 0.059, type: 'flat' },
  NE: { rate: 0.0584, type: 'progressive' },
  NV: { rate: 0, type: 'flat' }, // No state income tax
  NH: { rate: 0, type: 'flat' }, // No wage income tax
  NJ: { rate: 0.0897, type: 'progressive' },
  NM: { rate: 0.049, type: 'progressive' },
  NY: { rate: 0.0685, type: 'progressive' },
  NC: { rate: 0.0475, type: 'flat' },
  ND: { rate: 0.0225, type: 'flat' },
  OH: { rate: 0.035, type: 'flat' },
  OK: { rate: 0.0475, type: 'flat' },
  OR: { rate: 0.0875, type: 'progressive' },
  PA: { rate: 0.0307, type: 'flat' },
  RI: { rate: 0.0599, type: 'progressive' },
  SC: { rate: 0.064, type: 'progressive' },
  SD: { rate: 0, type: 'flat' }, // No state income tax
  TN: { rate: 0, type: 'flat' }, // No wage income tax
  TX: { rate: 0, type: 'flat' }, // No state income tax
  UT: { rate: 0.0465, type: 'flat' },
  VT: { rate: 0.0875, type: 'progressive' },
  VA: { rate: 0.0575, type: 'progressive' },
  WA: { rate: 0, type: 'flat' }, // No state income tax
  WV: { rate: 0.0512, type: 'flat' },
  WI: { rate: 0.0765, type: 'progressive' },
  WY: { rate: 0, type: 'flat' }, // No state income tax
  DC: { rate: 0.0975, type: 'progressive' },
};

// ============================================================================
// TAX CALCULATOR SERVICE
// ============================================================================

export class TaxCalculator {
  // ==========================================================================
  // MAIN CALCULATION
  // ==========================================================================

  /**
   * Calculate comprehensive tax estimate
   */
  async calculateEstimate(
    userId: string,
    options: {
      year?: number;
      filingStatus?: FilingStatus;
      state?: string;
      additionalIncome?: number;
      additionalDeductions?: Partial<TaxDeductions>;
    } = {}
  ): Promise<TaxEstimate> {
    const year = options.year || new Date().getFullYear();
    const filingStatus = options.filingStatus || 'single';
    const state = options.state || (await this.getUserState(userId));

    // Get income from platform
    const platformIncome = await this.getPlatformIncome(userId, year);
    const grossIncome = platformIncome + (options.additionalIncome || 0);

    // Calculate deductions
    const deductions = await this.calculateDeductions(
      userId,
      year,
      filingStatus,
      options.additionalDeductions
    );

    // Calculate self-employment tax first (affects federal calculation)
    const seBreakdown = this.calculateSelfEmploymentTax(grossIncome - deductions.businessExpenses);

    // Adjusted gross income
    const agi =
      grossIncome -
      deductions.businessExpenses -
      seBreakdown.deduction -
      deductions.retirementContributions -
      deductions.healthInsurance;

    // Taxable income after standard/itemized deduction
    const taxableIncome = Math.max(0, agi - deductions.standardDeduction);

    // Calculate federal tax
    const federalBreakdown = this.calculateFederalTax(taxableIncome, filingStatus);

    // Calculate state tax
    const stateBreakdown = this.calculateStateTax(taxableIncome, state);

    // Total tax
    const totalTax = federalBreakdown.totalTax + seBreakdown.totalTax + (stateBreakdown?.tax || 0);
    const effectiveRate = grossIncome > 0 ? (totalTax / grossIncome) * 100 : 0;
    const quarterlyPayment = totalTax / 4;

    const estimate: TaxEstimate = {
      year,
      grossIncome,
      deductions,
      taxableIncome,
      federalTax: federalBreakdown.totalTax,
      selfEmploymentTax: seBreakdown.totalTax,
      stateTax: stateBreakdown?.tax || 0,
      totalTax,
      effectiveRate,
      quarterlyPayment,
      breakdown: {
        federal: federalBreakdown,
        selfEmployment: seBreakdown,
        state: stateBreakdown,
      },
    };

    // Store the estimate
    await this.storeEstimate(userId, estimate);

    return estimate;
  }

  // ==========================================================================
  // COMPONENT CALCULATIONS
  // ==========================================================================

  /**
   * Calculate federal income tax
   */
  private calculateFederalTax(
    taxableIncome: number,
    filingStatus: FilingStatus
  ): FederalTaxBreakdown {
    const brackets = FEDERAL_BRACKETS_2024[filingStatus];
    const bracketBreakdown: FederalTaxBreakdown['brackets'] = [];

    let remainingIncome = taxableIncome;
    let totalTax = 0;
    let previousLimit = 0;
    let marginalRate = 0.1;

    for (const bracket of brackets) {
      if (remainingIncome <= 0) break;

      const incomeInBracket = Math.min(remainingIncome, bracket.limit - previousLimit);
      const taxInBracket = incomeInBracket * bracket.rate;

      bracketBreakdown.push({
        bracket: `$${previousLimit.toLocaleString()} - $${bracket.limit === Infinity ? '∞' : bracket.limit.toLocaleString()}`,
        income: incomeInBracket,
        rate: bracket.rate * 100,
        tax: taxInBracket,
      });

      totalTax += taxInBracket;
      remainingIncome -= incomeInBracket;
      previousLimit = bracket.limit;
      marginalRate = bracket.rate;
    }

    return {
      taxableIncome,
      brackets: bracketBreakdown,
      totalTax,
      marginalRate: marginalRate * 100,
    };
  }

  /**
   * Calculate self-employment tax
   */
  private calculateSelfEmploymentTax(netIncome: number): SelfEmploymentBreakdown {
    if (netIncome <= 0) {
      return {
        netEarnings: 0,
        socialSecurity: 0,
        medicare: 0,
        additionalMedicare: 0,
        totalTax: 0,
        deduction: 0,
      };
    }

    const netEarnings = netIncome * SE_TAX.netEarningsMultiplier;

    // Social Security tax (capped at wage base)
    const ssWages = Math.min(netEarnings, SE_TAX.socialSecurityWageBase);
    const socialSecurity = ssWages * SE_TAX.socialSecurityRate;

    // Medicare tax (no cap)
    const medicare = netEarnings * SE_TAX.medicareRate;

    // Additional Medicare tax on high earners
    const additionalMedicare =
      netEarnings > SE_TAX.additionalMedicareThreshold
        ? (netEarnings - SE_TAX.additionalMedicareThreshold) * SE_TAX.additionalMedicareRate
        : 0;

    const totalTax = socialSecurity + medicare + additionalMedicare;
    const deduction = totalTax / 2; // Half of SE tax is deductible

    return {
      netEarnings,
      socialSecurity,
      medicare,
      additionalMedicare,
      totalTax,
      deduction,
    };
  }

  /**
   * Calculate state tax
   */
  private calculateStateTax(taxableIncome: number, state?: string): StateTaxBreakdown | undefined {
    if (!state) return undefined;

    const stateData = STATE_TAX_RATES[state.toUpperCase()];
    if (!stateData || stateData.rate === 0) {
      return { state, taxableIncome, rate: 0, tax: 0 };
    }

    // For simplicity, using flat rate or top rate for progressive states
    const tax = taxableIncome * stateData.rate;

    return {
      state,
      taxableIncome,
      rate: stateData.rate * 100,
      tax,
    };
  }

  /**
   * Calculate deductions
   */
  private async calculateDeductions(
    userId: string,
    year: number,
    filingStatus: FilingStatus,
    additional?: Partial<TaxDeductions>
  ): Promise<TaxDeductions> {
    const standardDeduction = STANDARD_DEDUCTION_2024[filingStatus];

    // Get business expenses from transactions
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const businessExpenses = await prisma.cardTransaction.aggregate({
      where: {
        userId,
        isBusinessExpense: true,
        status: 'captured',
        createdAt: { gte: yearStart, lte: yearEnd },
      },
      _sum: { amount: true },
    });

    const deductions: TaxDeductions = {
      standardDeduction,
      selfEmploymentDeduction: 0, // Calculated later
      businessExpenses: (businessExpenses._sum.amount || 0) / 100,
      retirementContributions: additional?.retirementContributions || 0,
      healthInsurance: additional?.healthInsurance || 0,
      homeOffice: additional?.homeOffice || 0,
      other: additional?.other || 0,
      total: 0,
    };

    deductions.total =
      deductions.standardDeduction +
      deductions.businessExpenses +
      deductions.retirementContributions +
      deductions.healthInsurance +
      deductions.homeOffice +
      deductions.other;

    return deductions;
  }

  // ==========================================================================
  // SCENARIOS & PLANNING
  // ==========================================================================

  /**
   * Compare different tax scenarios
   */
  async compareScenarios(
    userId: string,
    scenarios: Array<{
      name: string;
      income: number;
      deductions?: Partial<TaxDeductions>;
      filingStatus?: FilingStatus;
    }>
  ): Promise<TaxScenario[]> {
    const results: TaxScenario[] = [];

    for (const scenario of scenarios) {
      const estimate = await this.calculateEstimate(userId, {
        additionalIncome:
          scenario.income - (await this.getPlatformIncome(userId, new Date().getFullYear())),
        additionalDeductions: scenario.deductions,
        filingStatus: scenario.filingStatus,
      });

      results.push({
        name: scenario.name,
        income: scenario.income,
        deductions: scenario.deductions || {},
        estimate,
      });
    }

    return results;
  }

  /**
   * Calculate impact of additional deduction
   */
  async calculateDeductionImpact(
    userId: string,
    deductionType: keyof TaxDeductions,
    amount: number
  ): Promise<{ taxSavings: number; effectiveValue: number }> {
    const baseEstimate = await this.calculateEstimate(userId);
    const withDeduction = await this.calculateEstimate(userId, {
      additionalDeductions: { [deductionType]: amount },
    });

    const taxSavings = baseEstimate.totalTax - withDeduction.totalTax;
    const effectiveValue = amount - taxSavings;

    return { taxSavings, effectiveValue };
  }

  /**
   * Calculate retirement contribution benefit
   */
  async calculateRetirementBenefit(
    userId: string,
    contributionAmount: number,
    accountType: 'traditional_ira' | 'sep_ira' | 'solo_401k'
  ): Promise<{
    taxSavings: number;
    maxContribution: number;
    recommendedContribution: number;
  }> {
    const income = await this.getPlatformIncome(userId, new Date().getFullYear());

    // Calculate max contribution limits
    let maxContribution = 0;
    switch (accountType) {
      case 'traditional_ira':
        maxContribution = 7000; // 2024 limit
        break;
      case 'sep_ira':
        maxContribution = Math.min(69000, income * 0.25); // 2024 limit
        break;
      case 'solo_401k':
        maxContribution = Math.min(69000, income * 0.25 + 23000); // 2024 limit
        break;
    }

    const actualContribution = Math.min(contributionAmount, maxContribution);
    const impact = await this.calculateDeductionImpact(
      userId,
      'retirementContributions',
      actualContribution
    );

    return {
      taxSavings: impact.taxSavings,
      maxContribution,
      recommendedContribution: Math.min(maxContribution, income * 0.15), // 15% of income
    };
  }

  // ==========================================================================
  // QUARTERLY ESTIMATES
  // ==========================================================================

  /**
   * Get quarterly payment schedule
   */
  async getQuarterlySchedule(
    userId: string,
    year?: number
  ): Promise<
    Array<{
      quarter: number;
      dueDate: Date;
      amount: number;
      status: 'paid' | 'due' | 'overdue' | 'upcoming';
      paidAmount?: number;
      paidDate?: Date;
    }>
  > {
    const targetYear = year || new Date().getFullYear();
    const estimate = await this.calculateEstimate(userId, { year: targetYear });
    const quarterlyAmount = estimate.quarterlyPayment;

    const schedule = [];
    const now = new Date();

    const dueDates = [
      new Date(targetYear, 3, 15), // Q1 - April 15
      new Date(targetYear, 5, 15), // Q2 - June 15
      new Date(targetYear, 8, 15), // Q3 - September 15
      new Date(targetYear + 1, 0, 15), // Q4 - January 15 next year
    ];

    for (let q = 1; q <= 4; q++) {
      const dueDate = dueDates[q - 1];

      // Check if payment was made
      const payment = await prisma.quarterlyTaxPayment.findFirst({
        where: { userId, quarter: q, year: targetYear },
      });

      let status: 'paid' | 'due' | 'overdue' | 'upcoming';
      if (payment) {
        status = 'paid';
      } else if (now > dueDate) {
        status = 'overdue';
      } else if (now.getTime() > dueDate.getTime() - 30 * 24 * 60 * 60 * 1000) {
        status = 'due';
      } else {
        status = 'upcoming';
      }

      schedule.push({
        quarter: q,
        dueDate,
        amount: quarterlyAmount,
        status,
        paidAmount: payment?.amount?.toNumber(),
        paidDate: payment?.paidAt,
      });
    }

    return schedule;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async getPlatformIncome(userId: string, year: number): Promise<number> {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const income = await prisma.treasuryTransaction.aggregate({
      where: {
        userId,
        type: 'inbound',
        createdAt: { gte: yearStart, lte: yearEnd },
      },
      _sum: { amount: true },
    });

    return (income._sum.amount?.toNumber() || 0) / 100;
  }

  private async getUserState(userId: string): Promise<string | undefined> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    return user?.profile?.state;
  }

  private async storeEstimate(userId: string, estimate: TaxEstimate): Promise<void> {
    await prisma.taxEstimate.upsert({
      where: {
        userId_year: { userId, year: estimate.year },
      },
      create: {
        userId,
        year: estimate.year,
        grossIncome: estimate.grossIncome,
        totalDeductions: estimate.deductions.total,
        federalTax: estimate.federalTax,
        selfEmploymentTax: estimate.selfEmploymentTax,
        stateTax: estimate.stateTax,
        totalTax: estimate.totalTax,
        effectiveRate: estimate.effectiveRate,
        calculatedAt: new Date(),
      },
      update: {
        grossIncome: estimate.grossIncome,
        totalDeductions: estimate.deductions.total,
        federalTax: estimate.federalTax,
        selfEmploymentTax: estimate.selfEmploymentTax,
        stateTax: estimate.stateTax,
        totalTax: estimate.totalTax,
        effectiveRate: estimate.effectiveRate,
        calculatedAt: new Date(),
      },
    });
  }
}

// Singleton instance
let taxCalculatorInstance: TaxCalculator | null = null;

export function getTaxCalculator(): TaxCalculator {
  if (!taxCalculatorInstance) {
    taxCalculatorInstance = new TaxCalculator();
  }
  return taxCalculatorInstance;
}
