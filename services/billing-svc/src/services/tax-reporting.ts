// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/tax-reporting
 * Tax Reporting Service
 *
 * Features:
 * - 1099-K / 1099-NEC generation for US freelancers
 * - VAT handling for EU transactions
 * - Withholding tax calculations
 * - Tax document storage
 * - IRS/Tax authority reporting
 */

import { createAuditLog } from '@skillancer/audit-client';
import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { startOfYear, endOfYear, format, getYear } from 'date-fns';
import Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export type TaxFormType = '1099-K' | '1099-NEC' | 'W-9' | 'W-8BEN' | 'W-8BEN-E';
export type TaxStatus = 'PENDING' | 'GENERATED' | 'SENT' | 'FILED' | 'CORRECTED' | 'VOID';

export interface TaxProfile {
  userId: string;
  taxIdType: 'SSN' | 'EIN' | 'ITIN' | 'VAT' | 'OTHER';
  taxIdHash: string; // Hashed, not stored in plain text
  taxIdLast4: string; // Last 4 for display
  businessName?: string;
  businessType?: 'INDIVIDUAL' | 'SOLE_PROPRIETOR' | 'LLC' | 'CORPORATION' | 'PARTNERSHIP';
  address: TaxAddress;
  isUSPerson: boolean;
  formType: TaxFormType;
  withholdingRate: number;
  vatNumber?: string;
  vatCountry?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Tax1099Data {
  recipientId: string;
  recipientName: string;
  recipientTinLast4: string;
  payerName: string;
  payerTin: string;
  payerAddress: TaxAddress;
  taxYear: number;
  formType: '1099-K' | '1099-NEC';
  amounts: {
    grossAmount: number; // 1099-K: Box 1a
    cardNotPresentTransactions?: number; // 1099-K: Box 1b
    numberOfTransactions?: number; // 1099-K: Box 3
    federalIncomeTaxWithheld?: number; // 1099-K: Box 4
    nonemployeeCompensation?: number; // 1099-NEC: Box 1
  };
  stateInfo?: {
    stateCode: string;
    stateIdNumber: string;
    stateIncome: number;
    stateTaxWithheld: number;
  };
  status: TaxStatus;
  generatedAt?: Date;
  filedAt?: Date;
}

export interface VATReport {
  periodStart: Date;
  periodEnd: Date;
  country: string;
  vatNumber: string;
  transactions: VATTransaction[];
  summary: {
    totalSales: number;
    totalVATCollected: number;
    totalVATRemitted: number;
    netVATDue: number;
  };
}

export interface VATTransaction {
  invoiceId: string;
  date: Date;
  customerId: string;
  customerCountry: string;
  customerVatNumber?: string;
  amount: number;
  vatRate: number;
  vatAmount: number;
  reverseCharge: boolean;
}

export interface WithholdingCalculation {
  grossAmount: number;
  withholdingRate: number;
  withholdingAmount: number;
  netAmount: number;
  reason?: string;
}

// 1099-K thresholds (2024 IRS rules)
const THRESHOLD_1099K_AMOUNT = 60000; // $600 starting 2024 (phased from $20,000)
const THRESHOLD_1099K_TRANSACTIONS = 200; // May be reduced

// VAT rates by country
const EU_VAT_RATES: Record<string, number> = {
  AT: 20, // Austria
  BE: 21, // Belgium
  BG: 20, // Bulgaria
  HR: 25, // Croatia
  CY: 19, // Cyprus
  CZ: 21, // Czech Republic
  DK: 25, // Denmark
  EE: 22, // Estonia
  FI: 24, // Finland
  FR: 20, // France
  DE: 19, // Germany
  GR: 24, // Greece
  HU: 27, // Hungary
  IE: 23, // Ireland
  IT: 22, // Italy
  LV: 21, // Latvia
  LT: 21, // Lithuania
  LU: 17, // Luxembourg
  MT: 18, // Malta
  NL: 21, // Netherlands
  PL: 23, // Poland
  PT: 23, // Portugal
  RO: 19, // Romania
  SK: 20, // Slovakia
  SI: 22, // Slovenia
  ES: 21, // Spain
  SE: 25, // Sweden
};

// =============================================================================
// TAX REPORTING SERVICE CLASS
// =============================================================================

export class TaxReportingService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-11-20.acacia',
    });
  }

  // ==========================================================================
  // TAX PROFILE MANAGEMENT
  // ==========================================================================

  /**
   * Create or update tax profile
   */
  async upsertTaxProfile(userId: string, data: Partial<TaxProfile>): Promise<TaxProfile> {
    logger.info({ userId }, 'Upserting tax profile');

    // Never store full tax IDs - only hash and last 4
    const profile = await prisma.taxProfile.upsert({
      where: { userId },
      create: {
        userId,
        taxIdType: data.taxIdType!,
        taxIdHash: data.taxIdHash!,
        taxIdLast4: data.taxIdLast4!,
        businessName: data.businessName,
        businessType: data.businessType,
        address: data.address as Record<string, unknown>,
        isUSPerson: data.isUSPerson!,
        formType: data.formType!,
        withholdingRate: data.withholdingRate ?? 0,
        vatNumber: data.vatNumber,
        vatCountry: data.vatCountry,
      },
      update: {
        taxIdType: data.taxIdType,
        taxIdHash: data.taxIdHash,
        taxIdLast4: data.taxIdLast4,
        businessName: data.businessName,
        businessType: data.businessType,
        address: data.address as Record<string, unknown>,
        isUSPerson: data.isUSPerson,
        formType: data.formType,
        withholdingRate: data.withholdingRate,
        vatNumber: data.vatNumber,
        vatCountry: data.vatCountry,
        updatedAt: new Date(),
      },
    });

    await createAuditLog({
      action: 'TAX_PROFILE_UPDATE',
      resourceType: 'tax_profile',
      resourceId: userId,
      userId,
      metadata: { taxIdType: data.taxIdType, formType: data.formType },
    });

    return profile as unknown as TaxProfile;
  }

  /**
   * Get tax profile
   */
  async getTaxProfile(userId: string): Promise<TaxProfile | null> {
    const profile = await prisma.taxProfile.findUnique({
      where: { userId },
    });
    return profile as unknown as TaxProfile | null;
  }

  // ==========================================================================
  // 1099 GENERATION
  // ==========================================================================

  /**
   * Identify freelancers requiring 1099 forms
   */
  async identifyFreelancersRequiring1099(taxYear: number): Promise<Tax1099Data[]> {
    const yearStart = startOfYear(new Date(taxYear, 0, 1));
    const yearEnd = endOfYear(new Date(taxYear, 0, 1));

    logger.info({ taxYear }, 'Identifying freelancers requiring 1099 forms');

    // Get all US-based freelancers with earnings
    const freelancerEarnings = await prisma.$queryRaw<
      Array<{
        freelancerId: string;
        totalEarnings: number;
        transactionCount: number;
        firstName: string;
        lastName: string;
        taxIdLast4: string;
      }>
    >`
      SELECT 
        e.freelancer_id as "freelancerId",
        SUM(er.gross_amount) as "totalEarnings",
        COUNT(DISTINCT er.id) as "transactionCount",
        u.first_name as "firstName",
        u.last_name as "lastName",
        COALESCE(tp.tax_id_last4, '') as "taxIdLast4"
      FROM escrow_releases er
      JOIN escrows e ON er.escrow_id = e.id
      JOIN users u ON e.freelancer_id = u.id
      LEFT JOIN tax_profiles tp ON u.id = tp.user_id
      WHERE er.created_at >= ${yearStart}
        AND er.created_at <= ${yearEnd}
        AND tp.is_us_person = true
      GROUP BY e.freelancer_id, u.first_name, u.last_name, tp.tax_id_last4
      HAVING SUM(er.gross_amount) >= ${THRESHOLD_1099K_AMOUNT * 100}
        OR COUNT(DISTINCT er.id) >= ${THRESHOLD_1099K_TRANSACTIONS}
    `;

    const forms: Tax1099Data[] = [];

    for (const freelancer of freelancerEarnings) {
      forms.push({
        recipientId: freelancer.freelancerId,
        recipientName: `${freelancer.firstName} ${freelancer.lastName}`,
        recipientTinLast4: freelancer.taxIdLast4,
        payerName: 'Skillancer Inc.',
        payerTin: process.env.COMPANY_TIN || '',
        payerAddress: {
          line1: '123 Business Street',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94102',
          country: 'US',
        },
        taxYear,
        formType: '1099-K', // Platform payments are 1099-K
        amounts: {
          grossAmount: freelancer.totalEarnings,
          numberOfTransactions: Number(freelancer.transactionCount),
        },
        status: 'PENDING',
      });
    }

    return forms;
  }

  /**
   * Generate 1099 form
   */
  async generate1099(data: Tax1099Data): Promise<Tax1099Data> {
    logger.info({ recipientId: data.recipientId, taxYear: data.taxYear }, 'Generating 1099 form');

    // Store the generated form
    const form = await prisma.taxForm.create({
      data: {
        userId: data.recipientId,
        taxYear: data.taxYear,
        formType: data.formType,
        data: data as unknown as Record<string, unknown>,
        status: 'GENERATED',
        generatedAt: new Date(),
      },
    });

    await createAuditLog({
      action: 'TAX_FORM_GENERATED',
      resourceType: 'tax_form',
      resourceId: form.id,
      userId: data.recipientId,
      metadata: {
        formType: data.formType,
        taxYear: data.taxYear,
        grossAmount: data.amounts.grossAmount,
      },
    });

    return {
      ...data,
      status: 'GENERATED',
      generatedAt: new Date(),
    };
  }

  /**
   * Batch generate all 1099 forms for a tax year
   */
  async batchGenerate1099s(taxYear: number): Promise<{ generated: number; errors: number }> {
    const candidates = await this.identifyFreelancersRequiring1099(taxYear);
    let generated = 0;
    let errors = 0;

    for (const candidate of candidates) {
      try {
        await this.generate1099(candidate);
        generated++;
      } catch (error) {
        logger.error({ error, recipientId: candidate.recipientId }, 'Failed to generate 1099');
        errors++;
      }
    }

    logger.info({ taxYear, generated, errors }, '1099 batch generation complete');

    return { generated, errors };
  }

  // ==========================================================================
  // VAT HANDLING
  // ==========================================================================

  /**
   * Calculate VAT for transaction
   */
  calculateVAT(
    amount: number,
    sellerCountry: string,
    buyerCountry: string,
    buyerVatNumber?: string
  ): { vatRate: number; vatAmount: number; reverseCharge: boolean } {
    // B2B with valid VAT number - reverse charge applies
    if (buyerVatNumber && EU_VAT_RATES[buyerCountry] && sellerCountry !== buyerCountry) {
      return {
        vatRate: 0,
        vatAmount: 0,
        reverseCharge: true,
      };
    }

    // B2C or same country - charge destination country VAT
    const vatRate = EU_VAT_RATES[buyerCountry] || 0;
    const vatAmount = Math.round((amount * vatRate) / 100);

    return {
      vatRate,
      vatAmount,
      reverseCharge: false,
    };
  }

  /**
   * Validate VAT number via VIES
   */
  async validateVATNumber(vatNumber: string, countryCode: string): Promise<boolean> {
    // In production, this would call the VIES API
    // https://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl

    // Basic format validation
    const vatPatterns: Record<string, RegExp> = {
      AT: /^ATU\d{8}$/,
      BE: /^BE0\d{9}$/,
      DE: /^DE\d{9}$/,
      FR: /^FR[A-Z0-9]{2}\d{9}$/,
      GB: /^GB(\d{9}|\d{12}|(GD|HA)\d{3})$/,
      // Add more patterns as needed
    };

    const pattern = vatPatterns[countryCode];
    if (!pattern) return true; // Allow unknown formats

    const fullVatNumber = vatNumber.startsWith(countryCode)
      ? vatNumber
      : `${countryCode}${vatNumber}`;
    return pattern.test(fullVatNumber);
  }

  /**
   * Generate VAT report for a period
   */
  async generateVATReport(
    periodStart: Date,
    periodEnd: Date,
    vatCountry: string
  ): Promise<VATReport> {
    logger.info({ periodStart, periodEnd, vatCountry }, 'Generating VAT report');

    // Get all transactions for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'PAID',
        paidAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        vatCountry,
      },
      include: {
        user: true,
      },
    });

    const transactions: VATTransaction[] = invoices.map((invoice) => ({
      invoiceId: invoice.id,
      date: invoice.paidAt!,
      customerId: invoice.userId,
      customerCountry: (invoice.metadata as Record<string, string>)?.customerCountry || 'US',
      customerVatNumber: (invoice.metadata as Record<string, string>)?.customerVatNumber,
      amount: invoice.amount,
      vatRate: invoice.vatRate || 0,
      vatAmount: invoice.vatAmount || 0,
      reverseCharge: invoice.reverseCharge || false,
    }));

    const summary = {
      totalSales: transactions.reduce((sum, t) => sum + t.amount, 0),
      totalVATCollected: transactions
        .filter((t) => !t.reverseCharge)
        .reduce((sum, t) => sum + t.vatAmount, 0),
      totalVATRemitted: 0, // Would be calculated from purchases
      netVATDue: 0,
    };
    summary.netVATDue = summary.totalVATCollected - summary.totalVATRemitted;

    return {
      periodStart,
      periodEnd,
      country: vatCountry,
      vatNumber: process.env.COMPANY_VAT_NUMBER || '',
      transactions,
      summary,
    };
  }

  // ==========================================================================
  // WITHHOLDING TAX
  // ==========================================================================

  /**
   * Calculate withholding tax
   */
  calculateWithholding(grossAmount: number, taxProfile: TaxProfile | null): WithholdingCalculation {
    // No withholding for US persons with valid W-9
    if (taxProfile?.isUSPerson && taxProfile.taxIdHash) {
      return {
        grossAmount,
        withholdingRate: 0,
        withholdingAmount: 0,
        netAmount: grossAmount,
      };
    }

    // Backup withholding for missing TIN (24%)
    if (!taxProfile?.taxIdHash) {
      const withholdingAmount = Math.round(grossAmount * 0.24);
      return {
        grossAmount,
        withholdingRate: 24,
        withholdingAmount,
        netAmount: grossAmount - withholdingAmount,
        reason: 'BACKUP_WITHHOLDING_MISSING_TIN',
      };
    }

    // Non-US person - use W-8 rate (typically 30% unless treaty)
    if (!taxProfile.isUSPerson) {
      const withholdingRate = taxProfile.withholdingRate || 30;
      const withholdingAmount = Math.round((grossAmount * withholdingRate) / 100);
      return {
        grossAmount,
        withholdingRate,
        withholdingAmount,
        netAmount: grossAmount - withholdingAmount,
        reason: 'FOREIGN_WITHHOLDING',
      };
    }

    return {
      grossAmount,
      withholdingRate: 0,
      withholdingAmount: 0,
      netAmount: grossAmount,
    };
  }

  /**
   * Apply withholding to payout
   */
  async applyWithholdingToPayout(
    payoutId: string,
    userId: string
  ): Promise<WithholdingCalculation> {
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new Error('Payout not found');
    }

    const taxProfile = await this.getTaxProfile(userId);
    const withholding = this.calculateWithholding(payout.amount, taxProfile);

    if (withholding.withholdingAmount > 0) {
      // Record the withholding
      await prisma.taxWithholding.create({
        data: {
          userId,
          payoutId,
          grossAmount: withholding.grossAmount,
          withholdingRate: withholding.withholdingRate,
          withholdingAmount: withholding.withholdingAmount,
          netAmount: withholding.netAmount,
          reason: withholding.reason,
          taxYear: getYear(new Date()),
        },
      });

      await createAuditLog({
        action: 'TAX_WITHHOLDING_APPLIED',
        resourceType: 'payout',
        resourceId: payoutId,
        userId,
        metadata: {
          withholdingRate: withholding.withholdingRate,
          withholdingAmount: withholding.withholdingAmount,
          reason: withholding.reason,
        },
      });
    }

    return withholding;
  }

  // ==========================================================================
  // TAX DOCUMENT MANAGEMENT
  // ==========================================================================

  /**
   * Get tax documents for user
   */
  async getUserTaxDocuments(
    userId: string,
    taxYear?: number
  ): Promise<
    Array<{
      id: string;
      formType: string;
      taxYear: number;
      status: TaxStatus;
      downloadUrl?: string;
    }>
  > {
    const forms = await prisma.taxForm.findMany({
      where: {
        userId,
        ...(taxYear && { taxYear }),
      },
      orderBy: { taxYear: 'desc' },
    });

    return forms.map((form) => ({
      id: form.id,
      formType: form.formType,
      taxYear: form.taxYear,
      status: form.status as TaxStatus,
      downloadUrl:
        form.status === 'GENERATED' ? `/api/tax/documents/${form.id}/download` : undefined,
    }));
  }

  /**
   * Get annual tax summary for user
   */
  async getAnnualTaxSummary(
    userId: string,
    taxYear: number
  ): Promise<{
    totalEarnings: number;
    totalWithholding: number;
    netPayouts: number;
    forms: Array<{ formType: string; status: TaxStatus }>;
  }> {
    const yearStart = startOfYear(new Date(taxYear, 0, 1));
    const yearEnd = endOfYear(new Date(taxYear, 0, 1));

    const earnings = await prisma.escrowRelease.aggregate({
      where: {
        escrow: { freelancerId: userId },
        createdAt: { gte: yearStart, lte: yearEnd },
      },
      _sum: { grossAmount: true },
    });

    const withholding = await prisma.taxWithholding.aggregate({
      where: {
        userId,
        taxYear,
      },
      _sum: { withholdingAmount: true },
    });

    const payouts = await prisma.payout.aggregate({
      where: {
        userId,
        status: 'SUCCEEDED',
        createdAt: { gte: yearStart, lte: yearEnd },
      },
      _sum: { netAmount: true },
    });

    const forms = await prisma.taxForm.findMany({
      where: { userId, taxYear },
      select: { formType: true, status: true },
    });

    return {
      totalEarnings: earnings._sum.grossAmount || 0,
      totalWithholding: withholding._sum.withholdingAmount || 0,
      netPayouts: payouts._sum.netAmount || 0,
      forms: forms.map((f) => ({ formType: f.formType, status: f.status as TaxStatus })),
    };
  }

  // ==========================================================================
  // STRIPE TAX INTEGRATION
  // ==========================================================================

  /**
   * Enable Stripe Tax for automatic tax calculation
   */
  async configureStripeTax(customerId: string, address: TaxAddress): Promise<void> {
    await this.stripe.customers.update(customerId, {
      address: {
        line1: address.line1,
        line2: address.line2 || '',
        city: address.city,
        state: address.state,
        postal_code: address.postalCode,
        country: address.country,
      },
      tax: {
        validate_location: 'deferred',
      },
    });
  }

  /**
   * Get tax calculations from Stripe
   */
  async getStripeTaxCalculation(
    paymentIntentId: string
  ): Promise<{
    taxAmount: number;
    taxBreakdown: Array<{ jurisdiction: string; amount: number; rate: number }>;
  }> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['invoice.tax_breakdown'],
    });

    // Would parse tax breakdown from Stripe Tax
    return {
      taxAmount: 0,
      taxBreakdown: [],
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let taxService: TaxReportingService | null = null;

export function getTaxReportingService(): TaxReportingService {
  if (!taxService) {
    taxService = new TaxReportingService();
  }
  return taxService;
}

// =============================================================================
// SCHEDULED JOBS
// =============================================================================

/**
 * Schedule annual 1099 generation (runs January 15th)
 */
export async function scheduleAnnual1099Generation(): Promise<void> {
  const previousYear = getYear(new Date()) - 1;
  const taxService = getTaxReportingService();
  await taxService.batchGenerate1099s(previousYear);
}

