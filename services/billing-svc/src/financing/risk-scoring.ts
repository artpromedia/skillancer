// @ts-nocheck
/**
 * Invoice Financing Risk Scoring
 * Multi-factor risk assessment for invoice advances
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ serviceName: 'risk-scoring' });

// ============================================================================
// TYPES
// ============================================================================

export interface RiskScore {
  score: number; // 0-100 (higher = lower risk)
  approved: boolean;
  maxAdvancePercent: number; // 70-90%
  feeRate: number; // 0.02-0.05
  factors: RiskFactor[];
  explanation: string;
}

export interface RiskFactor {
  category: 'client' | 'freelancer' | 'invoice';
  name: string;
  score: number;
  weight: number;
  details: string;
}

export interface ClientRiskData {
  clientId: string;
  timeOnPlatformDays: number;
  totalSpend: number;
  invoicesPaid: number;
  invoicesLate: number;
  averagePaymentDays: number;
  disputeCount: number;
  currentOutstandingInvoices: number;
  currentOutstandingAmount: number;
}

export interface FreelancerRiskData {
  freelancerId: string;
  timeOnPlatformDays: number;
  completedContracts: number;
  disputeCount: number;
  previousAdvances: number;
  advancesRepaidOnTime: number;
  advancesDefaulted: number;
  averageContractValue: number;
}

export interface InvoiceRiskData {
  invoiceId: string;
  amount: number;
  ageDays: number;
  isMilestone: boolean;
  contractValue: number;
  contractProgress: number; // 0-100%
  clientPaymentTerms: number; // days
}

interface Invoice {
  id: string;
  freelancerId: string;
  clientId: string;
  contractId: string;
  amount: number;
  createdAt: Date;
  milestoneId?: string;
}

// ============================================================================
// SCORING THRESHOLDS
// ============================================================================

const THRESHOLDS = {
  minApprovalScore: 50,
  excellentScore: 80,
  goodScore: 65,
  moderateScore: 50,
};

const ADVANCE_PERCENT_BY_SCORE: Record<string, number> = {
  excellent: 90,
  good: 85,
  moderate: 80,
  minimum: 70,
};

const FEE_RATE_BY_SCORE: Record<string, number> = {
  excellent: 0.02, // 2%
  good: 0.03, // 3%
  moderate: 0.04, // 4%
  minimum: 0.05, // 5%
};

// ============================================================================
// RISK SCORING SERVICE
// ============================================================================

class RiskScoringService {
  // --------------------------------------------------------------------------
  // MAIN SCORING
  // --------------------------------------------------------------------------

  async scoreInvoice(invoice: Invoice, freelancerId: string): Promise<RiskScore> {
    logger.info('Scoring invoice', { invoiceId: invoice.id, freelancerId });

    const clientData = await this.getClientRiskData(invoice.clientId);
    const freelancerData = await this.getFreelancerRiskData(freelancerId);
    const invoiceData = await this.getInvoiceRiskData(invoice);

    const factors: RiskFactor[] = [];

    // Score each category
    const clientFactors = this.scoreClient(clientData);
    const freelancerFactors = this.scoreFreelancer(freelancerData);
    const invoiceFactors = this.scoreInvoiceData(invoiceData);

    factors.push(...clientFactors, ...freelancerFactors, ...invoiceFactors);

    // Calculate weighted score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    const score = Math.round(weightedScore / totalWeight);

    // Determine approval and terms
    const approved = score >= THRESHOLDS.minApprovalScore;
    const { advancePercent, feeRate } = this.getTermsByScore(score);

    const explanation = this.generateExplanation(score, factors);

    metrics.histogram('risk.score', score);
    metrics.increment('risk.decision', { approved: String(approved) });

    return {
      score,
      approved,
      maxAdvancePercent: advancePercent,
      feeRate,
      factors,
      explanation,
    };
  }

  // --------------------------------------------------------------------------
  // CLIENT SCORING
  // --------------------------------------------------------------------------

  private scoreClient(data: ClientRiskData): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Payment history (most important)
    const paymentRate =
      data.invoicesPaid > 0
        ? ((data.invoicesPaid - data.invoicesLate) / data.invoicesPaid) * 100
        : 0;
    factors.push({
      category: 'client',
      name: 'payment_history',
      score: Math.min(100, paymentRate),
      weight: 30,
      details: `${data.invoicesPaid} invoices paid, ${data.invoicesLate} late`,
    });

    // Time on platform
    let tenureScore = 0;
    if (data.timeOnPlatformDays > 365) tenureScore = 100;
    else if (data.timeOnPlatformDays > 180) tenureScore = 80;
    else if (data.timeOnPlatformDays > 90) tenureScore = 60;
    else if (data.timeOnPlatformDays > 30) tenureScore = 40;
    else tenureScore = 20;

    factors.push({
      category: 'client',
      name: 'platform_tenure',
      score: tenureScore,
      weight: 10,
      details: `${data.timeOnPlatformDays} days on platform`,
    });

    // Total spend
    let spendScore = 0;
    if (data.totalSpend > 50000) spendScore = 100;
    else if (data.totalSpend > 20000) spendScore = 85;
    else if (data.totalSpend > 5000) spendScore = 70;
    else if (data.totalSpend > 1000) spendScore = 50;
    else spendScore = 30;

    factors.push({
      category: 'client',
      name: 'total_spend',
      score: spendScore,
      weight: 15,
      details: `$${data.totalSpend.toLocaleString()} total spend`,
    });

    // Dispute history
    const disputeScore = Math.max(0, 100 - data.disputeCount * 25);
    factors.push({
      category: 'client',
      name: 'dispute_history',
      score: disputeScore,
      weight: 10,
      details: `${data.disputeCount} disputes`,
    });

    // Outstanding invoices concentration
    let outstandingScore = 100;
    if (data.currentOutstandingAmount > 20000) outstandingScore = 50;
    else if (data.currentOutstandingAmount > 10000) outstandingScore = 70;
    else if (data.currentOutstandingAmount > 5000) outstandingScore = 85;

    factors.push({
      category: 'client',
      name: 'outstanding_exposure',
      score: outstandingScore,
      weight: 5,
      details: `$${data.currentOutstandingAmount.toLocaleString()} outstanding`,
    });

    return factors;
  }

  // --------------------------------------------------------------------------
  // FREELANCER SCORING
  // --------------------------------------------------------------------------

  private scoreFreelancer(data: FreelancerRiskData): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Platform tenure
    let tenureScore = 0;
    if (data.timeOnPlatformDays > 365) tenureScore = 100;
    else if (data.timeOnPlatformDays > 180) tenureScore = 80;
    else if (data.timeOnPlatformDays > 90) tenureScore = 60;
    else if (data.timeOnPlatformDays > 30) tenureScore = 40;
    else tenureScore = 20;

    factors.push({
      category: 'freelancer',
      name: 'platform_tenure',
      score: tenureScore,
      weight: 5,
      details: `${data.timeOnPlatformDays} days on platform`,
    });

    // Completion rate
    let completionScore = data.completedContracts > 0 ? 80 : 50;
    if (data.completedContracts > 10) completionScore = 100;
    else if (data.completedContracts > 5) completionScore = 90;

    factors.push({
      category: 'freelancer',
      name: 'completion_history',
      score: completionScore,
      weight: 5,
      details: `${data.completedContracts} completed contracts`,
    });

    // Previous financing repayment
    if (data.previousAdvances > 0) {
      const repaymentRate = (data.advancesRepaidOnTime / data.previousAdvances) * 100;
      const defaultPenalty = data.advancesDefaulted * 30;

      factors.push({
        category: 'freelancer',
        name: 'financing_history',
        score: Math.max(0, repaymentRate - defaultPenalty),
        weight: 15,
        details: `${data.advancesRepaidOnTime}/${data.previousAdvances} repaid on time`,
      });
    }

    // Dispute history
    const disputeScore = Math.max(0, 100 - data.disputeCount * 20);
    factors.push({
      category: 'freelancer',
      name: 'dispute_history',
      score: disputeScore,
      weight: 5,
      details: `${data.disputeCount} disputes`,
    });

    return factors;
  }

  // --------------------------------------------------------------------------
  // INVOICE SCORING
  // --------------------------------------------------------------------------

  private scoreInvoiceData(data: InvoiceRiskData): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Invoice age
    let ageScore = 100;
    if (data.ageDays > 25) ageScore = 60;
    else if (data.ageDays > 20) ageScore = 75;
    else if (data.ageDays > 14) ageScore = 85;
    else if (data.ageDays > 7) ageScore = 95;

    factors.push({
      category: 'invoice',
      name: 'invoice_age',
      score: ageScore,
      weight: 5,
      details: `${data.ageDays} days old`,
    });

    // Amount relative to typical
    let amountScore = 85;
    if (data.amount > 25000) amountScore = 70;
    else if (data.amount > 10000) amountScore = 80;
    else if (data.amount < 500) amountScore = 90;

    factors.push({
      category: 'invoice',
      name: 'invoice_amount',
      score: amountScore,
      weight: 5,
      details: `$${data.amount.toLocaleString()}`,
    });

    // Milestone vs final
    factors.push({
      category: 'invoice',
      name: 'payment_type',
      score: data.isMilestone ? 95 : 85, // Milestones slightly lower risk
      weight: 5,
      details: data.isMilestone ? 'Milestone payment' : 'Final payment',
    });

    return factors;
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  private getTermsByScore(score: number): { advancePercent: number; feeRate: number } {
    if (score >= THRESHOLDS.excellentScore) {
      return {
        advancePercent: ADVANCE_PERCENT_BY_SCORE.excellent,
        feeRate: FEE_RATE_BY_SCORE.excellent,
      };
    } else if (score >= THRESHOLDS.goodScore) {
      return {
        advancePercent: ADVANCE_PERCENT_BY_SCORE.good,
        feeRate: FEE_RATE_BY_SCORE.good,
      };
    } else if (score >= THRESHOLDS.moderateScore) {
      return {
        advancePercent: ADVANCE_PERCENT_BY_SCORE.moderate,
        feeRate: FEE_RATE_BY_SCORE.moderate,
      };
    }
    return {
      advancePercent: ADVANCE_PERCENT_BY_SCORE.minimum,
      feeRate: FEE_RATE_BY_SCORE.minimum,
    };
  }

  private generateExplanation(score: number, factors: RiskFactor[]): string {
    if (score >= THRESHOLDS.excellentScore) {
      return 'Excellent risk profile. Best available terms.';
    } else if (score >= THRESHOLDS.goodScore) {
      return 'Good risk profile. Favorable terms available.';
    } else if (score >= THRESHOLDS.moderateScore) {
      return 'Moderate risk profile. Standard terms apply.';
    }
    return 'Risk profile does not meet minimum criteria.';
  }

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  private async getClientRiskData(clientId: string): Promise<ClientRiskData> {
    // In production, aggregate from database
    return {
      clientId,
      timeOnPlatformDays: 180,
      totalSpend: 15000,
      invoicesPaid: 12,
      invoicesLate: 1,
      averagePaymentDays: 14,
      disputeCount: 0,
      currentOutstandingInvoices: 2,
      currentOutstandingAmount: 3500,
    };
  }

  private async getFreelancerRiskData(freelancerId: string): Promise<FreelancerRiskData> {
    // In production, aggregate from database
    return {
      freelancerId,
      timeOnPlatformDays: 365,
      completedContracts: 25,
      disputeCount: 0,
      previousAdvances: 3,
      advancesRepaidOnTime: 3,
      advancesDefaulted: 0,
      averageContractValue: 2500,
    };
  }

  private async getInvoiceRiskData(invoice: Invoice): Promise<InvoiceRiskData> {
    const ageDays = Math.floor(
      (Date.now() - new Date(invoice.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      invoiceId: invoice.id,
      amount: invoice.amount,
      ageDays,
      isMilestone: !!invoice.milestoneId,
      contractValue: 5000,
      contractProgress: 60,
      clientPaymentTerms: 30,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let riskService: RiskScoringService | null = null;

export function getRiskScoringService(): RiskScoringService {
  if (!riskService) {
    riskService = new RiskScoringService();
  }
  return riskService;
}

