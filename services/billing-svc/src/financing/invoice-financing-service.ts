// @ts-nocheck
/**
 * Invoice Financing Service
 * Advance payments for unpaid invoices
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';
import Stripe from 'stripe';

import { getAdvanceManager } from './advance-manager.js';
import { getFinancingLimitsService } from './financing-limits.js';
import { getRiskScoringService, type RiskScore } from './risk-scoring.js';

const logger = createLogger({ serviceName: 'invoice-financing' });

// ============================================================================
// TYPES
// ============================================================================

export interface Invoice {
  id: string;
  freelancerId: string;
  clientId: string;
  contractId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue';
  dueDate: Date;
  createdAt: Date;
  description?: string;
  milestoneId?: string;
}

export interface FinancingEligibility {
  eligible: boolean;
  reasons: string[];
  maxAdvancePercent: number;
  feeRate: number;
  maxAdvanceAmount: number;
  riskScore?: RiskScore;
}

export interface AdvanceRequest {
  invoiceId: string;
  requestedAmount: number;
  advancePercent: number;
}

export interface Advance {
  id: string;
  invoiceId: string;
  freelancerId: string;
  clientId: string;
  originalInvoiceAmount: number;
  advanceAmount: number;
  feeAmount: number;
  totalOwed: number;
  advancePercent: number;
  feeRate: number;
  status: 'pending' | 'funded' | 'partially_repaid' | 'repaid' | 'defaulted';
  amountRepaid: number;
  fundedAt?: Date;
  repaidAt?: Date;
  expectedRepaymentDate: Date;
  createdAt: Date;
}

export interface FinancingConfig {
  minInvoiceAmount: number;
  maxInvoiceAmount: number;
  maxInvoiceAgeDays: number;
  minAdvancePercent: number;
  maxAdvancePercent: number;
  baseFeeRate: number;
  maxFeeRate: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: FinancingConfig = {
  minInvoiceAmount: 100,
  maxInvoiceAmount: 50000,
  maxInvoiceAgeDays: 30,
  minAdvancePercent: 70,
  maxAdvancePercent: 90,
  baseFeeRate: 0.02, // 2%
  maxFeeRate: 0.05, // 5%
};

// ============================================================================
// INVOICE FINANCING SERVICE
// ============================================================================

class InvoiceFinancingService {
  private stripe: Stripe;
  private config: FinancingConfig;

  constructor(config: Partial<FinancingConfig> = {}) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // ELIGIBILITY
  // --------------------------------------------------------------------------

  async checkEligibility(invoice: Invoice, freelancerId: string): Promise<FinancingEligibility> {
    logger.info('Checking financing eligibility', {
      invoiceId: invoice.id,
      freelancerId,
      amount: invoice.amount,
    });

    const reasons: string[] = [];

    // Basic invoice checks
    if (invoice.amount < this.config.minInvoiceAmount) {
      reasons.push(`Invoice amount below minimum ($${this.config.minInvoiceAmount})`);
    }

    if (invoice.amount > this.config.maxInvoiceAmount) {
      reasons.push(`Invoice amount above maximum ($${this.config.maxInvoiceAmount})`);
    }

    if (invoice.status === 'paid') {
      reasons.push('Invoice already paid');
    }

    const invoiceAgeDays = this.getInvoiceAgeDays(invoice);
    if (invoiceAgeDays > this.config.maxInvoiceAgeDays) {
      reasons.push(
        `Invoice too old (${invoiceAgeDays} days, max ${this.config.maxInvoiceAgeDays})`
      );
    }

    // Check if already financed
    const existingAdvance = await this.getAdvanceForInvoice(invoice.id);
    if (existingAdvance) {
      reasons.push('Invoice already has an active advance');
    }

    // Check freelancer standing
    const freelancerStatus = await this.checkFreelancerStanding(freelancerId);
    if (!freelancerStatus.inGoodStanding) {
      reasons.push(freelancerStatus.reason || 'Freelancer not in good standing');
    }

    // Check client verification
    const clientVerified = await this.isClientVerified(invoice.clientId);
    if (!clientVerified) {
      reasons.push('Client not verified');
    }

    // Check financing limits
    const limitsService = getFinancingLimitsService();
    const limitsCheck = await limitsService.checkUserLimits(freelancerId, invoice.amount);
    if (!limitsCheck.allowed) {
      reasons.push(limitsCheck.reason || 'Financing limit exceeded');
    }

    if (reasons.length > 0) {
      metrics.increment('financing.eligibility.denied', { reason: reasons[0] });
      return {
        eligible: false,
        reasons,
        maxAdvancePercent: 0,
        feeRate: 0,
        maxAdvanceAmount: 0,
      };
    }

    // Get risk score
    const riskService = getRiskScoringService();
    const riskScore = await riskService.scoreInvoice(invoice, freelancerId);

    if (!riskScore.approved) {
      metrics.increment('financing.eligibility.denied', { reason: 'risk_score' });
      return {
        eligible: false,
        reasons: ['Does not meet risk criteria'],
        maxAdvancePercent: 0,
        feeRate: 0,
        maxAdvanceAmount: 0,
        riskScore,
      };
    }

    const maxAdvanceAmount = Math.floor(invoice.amount * (riskScore.maxAdvancePercent / 100));

    metrics.increment('financing.eligibility.approved');

    return {
      eligible: true,
      reasons: [],
      maxAdvancePercent: riskScore.maxAdvancePercent,
      feeRate: riskScore.feeRate,
      maxAdvanceAmount,
      riskScore,
    };
  }

  async getEligibleInvoices(freelancerId: string): Promise<
    Array<{
      invoice: Invoice;
      eligibility: FinancingEligibility;
    }>
  > {
    logger.info('Getting eligible invoices', { freelancerId });

    // In production, fetch from database
    const invoices = await this.getUnpaidInvoices(freelancerId);
    const results: Array<{ invoice: Invoice; eligibility: FinancingEligibility }> = [];

    for (const invoice of invoices) {
      const eligibility = await this.checkEligibility(invoice, freelancerId);
      if (eligibility.eligible) {
        results.push({ invoice, eligibility });
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // ADVANCE REQUEST
  // --------------------------------------------------------------------------

  async requestAdvance(
    freelancerId: string,
    request: AdvanceRequest
  ): Promise<{
    success: boolean;
    advance?: Advance;
    error?: string;
  }> {
    logger.info('Processing advance request', {
      freelancerId,
      invoiceId: request.invoiceId,
      requestedAmount: request.requestedAmount,
    });

    try {
      // Get invoice
      const invoice = await this.getInvoice(request.invoiceId);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      // Verify ownership
      if (invoice.freelancerId !== freelancerId) {
        return { success: false, error: 'Unauthorized' };
      }

      // Check eligibility
      const eligibility = await this.checkEligibility(invoice, freelancerId);
      if (!eligibility.eligible) {
        return { success: false, error: eligibility.reasons.join(', ') };
      }

      // Validate requested amount
      if (request.requestedAmount > eligibility.maxAdvanceAmount) {
        return {
          success: false,
          error: `Requested amount exceeds maximum ($${eligibility.maxAdvanceAmount})`,
        };
      }

      // Calculate fee
      const feeAmount = Math.round(request.requestedAmount * eligibility.feeRate * 100) / 100;
      const totalOwed = request.requestedAmount + feeAmount;

      // Create advance record
      const advanceManager = getAdvanceManager();
      const advance = await advanceManager.createAdvance({
        invoiceId: invoice.id,
        freelancerId,
        clientId: invoice.clientId,
        originalInvoiceAmount: invoice.amount,
        advanceAmount: request.requestedAmount,
        feeAmount,
        totalOwed,
        advancePercent: request.advancePercent,
        feeRate: eligibility.feeRate,
        expectedRepaymentDate: invoice.dueDate,
      });

      // Fund the advance
      await this.fundAdvance(advance, freelancerId);

      metrics.increment('financing.advance.created');
      metrics.histogram('financing.advance.amount', request.requestedAmount);

      return { success: true, advance };
    } catch (error) {
      logger.error('Failed to process advance request', { freelancerId, error });
      metrics.increment('financing.advance.failed');
      return { success: false, error: 'Failed to process advance request' };
    }
  }

  private async fundAdvance(advance: Advance, freelancerId: string): Promise<void> {
    logger.info('Funding advance', { advanceId: advance.id, amount: advance.advanceAmount });

    // In production, transfer funds via Stripe Treasury
    // await this.stripe.treasury.outboundTransfers.create({...});

    const advanceManager = getAdvanceManager();
    await advanceManager.markAsFunded(advance.id);
  }

  // --------------------------------------------------------------------------
  // REPAYMENT
  // --------------------------------------------------------------------------

  async processRepayment(
    invoiceId: string,
    paymentAmount: number
  ): Promise<{
    advanceRepaid: boolean;
    amountDeducted: number;
    remainingToFreelancer: number;
  }> {
    logger.info('Processing repayment', { invoiceId, paymentAmount });

    const advanceManager = getAdvanceManager();
    const advance = await advanceManager.getAdvanceByInvoice(invoiceId);

    if (!advance || advance.status === 'repaid') {
      return {
        advanceRepaid: false,
        amountDeducted: 0,
        remainingToFreelancer: paymentAmount,
      };
    }

    const remainingOwed = advance.totalOwed - advance.amountRepaid;
    const amountToDeduct = Math.min(paymentAmount, remainingOwed);
    const remainingToFreelancer = paymentAmount - amountToDeduct;

    await advanceManager.recordRepayment(advance.id, amountToDeduct);

    const isFullyRepaid = advance.amountRepaid + amountToDeduct >= advance.totalOwed;

    if (isFullyRepaid) {
      await advanceManager.markAsRepaid(advance.id);
      metrics.increment('financing.advance.repaid');
    }

    metrics.histogram('financing.repayment.amount', amountToDeduct);

    return {
      advanceRepaid: isFullyRepaid,
      amountDeducted: amountToDeduct,
      remainingToFreelancer,
    };
  }

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  async getActiveAdvances(freelancerId: string): Promise<Advance[]> {
    const advanceManager = getAdvanceManager();
    return advanceManager.getActiveAdvances(freelancerId);
  }

  async getAdvanceHistory(
    freelancerId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ advances: Advance[]; total: number }> {
    const advanceManager = getAdvanceManager();
    return advanceManager.getHistory(freelancerId, options);
  }

  async getAdvanceDetails(advanceId: string): Promise<Advance | null> {
    const advanceManager = getAdvanceManager();
    return advanceManager.getAdvance(advanceId);
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private getInvoiceAgeDays(invoice: Invoice): number {
    const now = new Date();
    const created = new Date(invoice.createdAt);
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async getAdvanceForInvoice(invoiceId: string): Promise<Advance | null> {
    const advanceManager = getAdvanceManager();
    return advanceManager.getAdvanceByInvoice(invoiceId);
  }

  private async checkFreelancerStanding(
    freelancerId: string
  ): Promise<{ inGoodStanding: boolean; reason?: string }> {
    // In production, check:
    // - Account status
    // - Previous financing repayment history
    // - Dispute history
    // - Platform tenure
    return { inGoodStanding: true };
  }

  private async isClientVerified(clientId: string): Promise<boolean> {
    // In production, check client's verification status and payment history
    return true;
  }

  private async getUnpaidInvoices(freelancerId: string): Promise<Invoice[]> {
    // In production, query database
    return [];
  }

  private async getInvoice(invoiceId: string): Promise<Invoice | null> {
    // In production, query database
    return null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let financingService: InvoiceFinancingService | null = null;

export function getInvoiceFinancingService(): InvoiceFinancingService {
  if (!financingService) {
    financingService = new InvoiceFinancingService();
  }
  return financingService;
}

