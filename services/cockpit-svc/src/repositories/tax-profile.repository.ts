/**
 * @module @skillancer/cockpit-svc/repositories/tax-profile
 * Tax Profile data access layer
 */

import type {
  CreateTaxProfileParams,
  UpdateTaxProfileParams,
  TaxProfileWithEstimates,
} from '../types/finance.types.js';
import type { Prisma, PrismaClient, TaxProfile } from '@skillancer/database';

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
  MARRIED_JOINT: [
    { min: 0, max: 23200, rate: 0.1 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  MARRIED_SEPARATE: [
    { min: 0, max: 11600, rate: 0.1 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 365600, rate: 0.35 },
    { min: 365600, max: Infinity, rate: 0.37 },
  ],
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
    // Generate quarterly payment dates if not provided
    const quarterlyPaymentDates =
      data.quarterlyPaymentDates ?? this.generateQuarterlyDates(data.taxYear);

    return this.prisma.taxProfile.create({
      data: {
        userId: data.userId,
        taxYear: data.taxYear,
        businessType: data.businessType,
        filingStatus: data.filingStatus,
        accountingMethod: data.accountingMethod ?? 'CASH',
        businessName: data.businessName ?? null,
        ein: data.ein ?? null,
        businessAddress: data.businessAddress ?? null,
        standardMileageRate: data.standardMileageRate ?? 0.67,
        selfEmploymentTaxRate: data.selfEmploymentTaxRate ?? SELF_EMPLOYMENT_TAX_RATE,
        estimatedTaxRate: data.estimatedTaxRate ?? null,
        quarterlyPaymentDates,
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
   * Find tax profile by user and year
   */
  async findByUserAndYear(userId: string, taxYear: number): Promise<TaxProfile | null> {
    return this.prisma.taxProfile.findFirst({
      where: { userId, taxYear },
    });
  }

  /**
   * Find all tax profiles for a user
   */
  async findByUserId(userId: string): Promise<TaxProfile[]> {
    return this.prisma.taxProfile.findMany({
      where: { userId },
      orderBy: { taxYear: 'desc' },
    });
  }

  /**
   * Get current year's tax profile
   */
  async findCurrentYear(userId: string): Promise<TaxProfile | null> {
    const currentYear = new Date().getFullYear();
    return this.findByUserAndYear(userId, currentYear);
  }

  /**
   * Get or create current year's tax profile
   */
  async getOrCreateCurrentYear(
    userId: string,
    defaults?: Partial<CreateTaxProfileParams>
  ): Promise<TaxProfile> {
    const currentYear = new Date().getFullYear();
    let profile = await this.findByUserAndYear(userId, currentYear);

    if (!profile) {
      // Copy from previous year if exists
      const previousYear = await this.findByUserAndYear(userId, currentYear - 1);

      profile = await this.create({
        userId,
        taxYear: currentYear,
        businessType: previousYear?.businessType ?? defaults?.businessType ?? 'SOLE_PROPRIETORSHIP',
        filingStatus: previousYear?.filingStatus ?? defaults?.filingStatus ?? 'SINGLE',
        accountingMethod: previousYear?.accountingMethod ?? defaults?.accountingMethod ?? 'CASH',
        businessName: previousYear?.businessName ?? defaults?.businessName,
        ein: previousYear?.ein ?? defaults?.ein,
        businessAddress: previousYear?.businessAddress ?? defaults?.businessAddress,
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
        businessAddress: data.businessAddress,
        standardMileageRate: data.standardMileageRate,
        selfEmploymentTaxRate: data.selfEmploymentTaxRate,
        estimatedTaxRate: data.estimatedTaxRate,
        quarterlyPaymentDates: data.quarterlyPaymentDates,
      },
    });
  }

  /**
   * Get tax profile with calculated estimates
   */
  async getWithEstimates(userId: string, taxYear: number): Promise<TaxProfileWithEstimates | null> {
    const profile = await this.findByUserAndYear(userId, taxYear);
    if (!profile) return null;

    // Get income and expenses for the year
    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear, 11, 31, 23, 59, 59, 999);

    const [incomeResult, expenseResult, mileageResult] = await Promise.all([
      this.prisma.financialTransaction.aggregate({
        where: {
          userId,
          transactionType: 'INCOME',
          transactionDate: { gte: startDate, lte: endDate },
          status: 'CONFIRMED',
        },
        _sum: { amount: true },
      }),
      this.prisma.financialTransaction.aggregate({
        where: {
          userId,
          transactionType: 'EXPENSE',
          isTaxDeductible: true,
          transactionDate: { gte: startDate, lte: endDate },
          status: 'CONFIRMED',
        },
        _sum: { amount: true },
      }),
      this.prisma.mileageLog.aggregate({
        where: {
          userId,
          purpose: 'BUSINESS',
          date: { gte: startDate, lte: endDate },
        },
        _sum: { deductibleAmount: true },
      }),
    ]);

    const estimatedIncome = Number(incomeResult._sum.amount) || 0;
    const estimatedExpenses = Number(expenseResult._sum.amount) || 0;
    const mileageDeduction = Number(mileageResult._sum.deductibleAmount) || 0;
    const homeOfficeDeduction = 0; // Would need separate calculation
    const otherDeductions = 0;
    const totalDeductions =
      estimatedExpenses + mileageDeduction + homeOfficeDeduction + otherDeductions;

    const netSelfEmploymentIncome = estimatedIncome - totalDeductions;
    const taxableIncome = Math.max(0, netSelfEmploymentIncome);

    // Calculate self-employment tax
    const seTaxRate = Number(profile.selfEmploymentTaxRate) || SELF_EMPLOYMENT_TAX_RATE;
    const estimatedSelfEmploymentTax = taxableIncome * seTaxRate;

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
    filingStatus: 'SINGLE' | 'MARRIED_JOINT' | 'MARRIED_SEPARATE' | 'HEAD_OF_HOUSEHOLD'
  ): Array<{ min: number; max: number; rate: number }> {
    return TAX_BRACKETS[filingStatus] || TAX_BRACKETS.SINGLE;
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
