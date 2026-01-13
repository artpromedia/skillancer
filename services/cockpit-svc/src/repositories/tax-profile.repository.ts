/**
 * @module @skillancer/cockpit-svc/repositories/tax-profile
 * Tax Profile data access layer
 */

import type {
  CreateTaxProfileParams,
  UpdateTaxProfileParams,
  TaxProfileWithEstimates,
} from '../types/finance.types.js';
import type { TaxProfile } from '../types/prisma-shim.js';
import type { Prisma, PrismaClient } from '../types/prisma-shim.js';

// 2024 Self-employment tax rate
export const SELF_EMPLOYMENT_TAX_RATE = 0.153; // 15.3%
export const SE_TAX_DEDUCTIBLE_RATE = 0.5; // Can deduct 50% of SE tax

// 2024 Federal tax brackets (simplified for estimation)
export const TAX_BRACKETS = {
  SINGLE: [
    { min: 0, max: 11600, rate: 0.1 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  MARRIED_FILING_JOINTLY: [
    { min: 0, max: 23200, rate: 0.1 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  MARRIED_FILING_SEPARATELY: [
    { min: 0, max: 11600, rate: 0.1 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 365600, rate: 0.35 },
    { min: 365600, max: Infinity, rate: 0.37 },
  ] as const,
  HEAD_OF_HOUSEHOLD: [
    { min: 0, max: 16550, rate: 0.1 },
    { min: 16550, max: 63100, rate: 0.12 },
    { min: 63100, max: 100500, rate: 0.22 },
    { min: 100500, max: 191950, rate: 0.24 },
    { min: 191950, max: 243700, rate: 0.32 },
    { min: 243700, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
} as const;

// 2024 Quarterly payment due dates
export const QUARTERLY_DUE_DATES = {
  Q1: { month: 3, day: 15 }, // April 15
  Q2: { month: 5, day: 15 }, // June 15
  Q3: { month: 8, day: 15 }, // September 15
  Q4: { month: 0, day: 15, nextYear: true }, // January 15 (next year)
} as const;

export class TaxProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new tax profile
   */
  async create(data: CreateTaxProfileParams): Promise<TaxProfile> {
    return this.prisma.taxProfile.create({
      data: {
        userId: data.userId,
        businessType: data.businessType,
        filingStatus: data.filingStatus,
        accountingMethod: data.accountingMethod ?? 'CASH',
        businessName: data.businessName ?? null,
        ein: data.ein ?? null,
        estimatedTaxRate: data.estimatedTaxRate ?? null,
      },
    });
  }

  /**
   * Find tax profile by ID
   */
  async findById(id: string): Promise<TaxProfile | null> {
    return this.prisma.taxProfile.findUnique({
      where: { id },
    });
  }

  /**
   * Find tax profile by user
   */
  async findByUser(userId: string): Promise<TaxProfile | null> {
    return this.prisma.taxProfile.findUnique({
      where: { userId },
    });
  }

  /**
   * Get current tax profile for user
   */
  async findCurrentProfile(userId: string): Promise<TaxProfile | null> {
    return this.findByUser(userId);
  }

  /**
   * Get or create tax profile for user
   */
  async getOrCreate(
    userId: string,
    defaults?: Partial<CreateTaxProfileParams>
  ): Promise<TaxProfile> {
    let profile = await this.findByUser(userId);

    if (!profile) {
      profile = await this.create({
        userId,
        businessType: defaults?.businessType ?? 'SOLE_PROPRIETOR',
        filingStatus: defaults?.filingStatus ?? 'SINGLE',
        accountingMethod: defaults?.accountingMethod ?? 'CASH',
        businessName: defaults?.businessName,
        ein: defaults?.ein,
      });
    }

    return profile;
  }

  /**
   * Update a tax profile
   */
  async update(id: string, data: UpdateTaxProfileParams): Promise<TaxProfile> {
    return this.prisma.taxProfile.update({
      where: { id },
      data: {
        businessType: data.businessType,
        filingStatus: data.filingStatus,
        accountingMethod: data.accountingMethod,
        businessName: data.businessName,
        ein: data.ein,
        estimatedTaxRate: data.estimatedTaxRate,
      },
    });
  }

  /**
   * Get tax profile with calculated estimates for a given year
   */
  async getWithEstimates(userId: string, taxYear: number): Promise<TaxProfileWithEstimates | null> {
    const profile = await this.findByUser(userId);
    if (!profile) return null;

    // Get income and expenses for the year
    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear, 11, 31, 23, 59, 59, 999);

    const [incomeResult, expenseResult, mileageResult] = await Promise.all([
      this.prisma.financialTransaction.aggregate({
        where: {
          userId,
          type: 'INCOME',
          date: { gte: startDate, lte: endDate },
          status: 'CONFIRMED',
        },
        _sum: { amount: true },
      }),
      this.prisma.financialTransaction.aggregate({
        where: {
          userId,
          type: 'EXPENSE',
          isDeductible: true,
          date: { gte: startDate, lte: endDate },
          status: 'CONFIRMED',
        },
        _sum: { amount: true },
      }),
      this.prisma.mileageLog.aggregate({
        where: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
        _sum: { deductionAmount: true },
      }),
    ]);

    const estimatedIncome = Number(incomeResult._sum?.amount) || 0;
    const estimatedExpenses = Number(expenseResult._sum?.amount) || 0;
    const mileageDeduction = Number(mileageResult._sum?.deductionAmount) || 0;
    const homeOfficeDeduction = 0; // Would need separate calculation
    const otherDeductions = 0;
    const totalDeductions =
      estimatedExpenses + mileageDeduction + homeOfficeDeduction + otherDeductions;

    const netSelfEmploymentIncome = estimatedIncome - totalDeductions;
    const taxableIncome = Math.max(0, netSelfEmploymentIncome);

    // Calculate self-employment tax
    const estimatedSelfEmploymentTax = taxableIncome * SELF_EMPLOYMENT_TAX_RATE;

    // Calculate income tax (simplified)
    const brackets = this.getTaxBrackets(profile.filingStatus);
    const estimatedIncomeTax = this.calculateIncomeTax(
      taxableIncome - estimatedSelfEmploymentTax * SE_TAX_DEDUCTIBLE_RATE,
      brackets
    );

    const totalEstimatedTax = estimatedSelfEmploymentTax + estimatedIncomeTax;
    const estimatedQuarterlyPayment = totalEstimatedTax / 4;

    return {
      ...profile,
      estimatedIncome,
      estimatedExpenses,
      estimatedDeductions: totalDeductions,
      estimatedTaxableIncome: taxableIncome,
      estimatedSelfEmploymentTax,
      estimatedIncomeTax,
      estimatedTotalTax: totalEstimatedTax,
      estimatedQuarterlyPayment,
    };
  }

  /**
   * Delete a tax profile
   */
  async delete(id: string): Promise<void> {
    await this.prisma.taxProfile.delete({
      where: { id },
    });
  }

  /**
   * Generate quarterly payment due dates for a tax year
   */
  private generateQuarterlyDates(taxYear: number): Date[] {
    return [
      new Date(taxYear, QUARTERLY_DUE_DATES.Q1.month, QUARTERLY_DUE_DATES.Q1.day),
      new Date(taxYear, QUARTERLY_DUE_DATES.Q2.month, QUARTERLY_DUE_DATES.Q2.day),
      new Date(taxYear, QUARTERLY_DUE_DATES.Q3.month, QUARTERLY_DUE_DATES.Q3.day),
      new Date(
        QUARTERLY_DUE_DATES.Q4.nextYear ? taxYear + 1 : taxYear,
        QUARTERLY_DUE_DATES.Q4.month,
        QUARTERLY_DUE_DATES.Q4.day
      ),
    ];
  }

  /**
   * Get tax brackets for filing status
   */
  private getTaxBrackets(
    filingStatus:
      | 'SINGLE'
      | 'MARRIED_FILING_JOINTLY'
      | 'MARRIED_FILING_SEPARATELY'
      | 'HEAD_OF_HOUSEHOLD'
      | 'QUALIFYING_WIDOW'
  ): Array<{ min: number; max: number; rate: number }> {
    const brackets = TAX_BRACKETS[filingStatus as keyof typeof TAX_BRACKETS];
    return [...(brackets || TAX_BRACKETS.SINGLE)];
  }

  /**
   * Calculate income tax using brackets
   */
  private calculateIncomeTax(
    income: number,
    brackets: Array<{ min: number; max: number; rate: number }>
  ): number {
    let tax = 0;
    let remainingIncome = income;

    for (const bracket of brackets) {
      if (remainingIncome <= 0) break;

      const bracketWidth = bracket.max - bracket.min;
      const taxableInBracket = Math.min(remainingIncome, bracketWidth);

      tax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }

    return tax;
  }
}
