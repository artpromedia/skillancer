// @ts-nocheck
/**
 * Financing Repayment Job
 * Auto-deduct advance repayments when clients pay invoices
 * Sprint M6: Invoice Financing & Advanced Tax Tools
 */

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ serviceName: 'financing-repayment-job' });

// ============================================================================
// TYPES
// ============================================================================

interface PaymentEvent {
  paymentId: string;
  invoiceId: string;
  amount: number;
  freelancerId: string;
  clientId: string;
  paidAt: Date;
}

interface RepaymentResult {
  advanceId: string;
  repaymentAmount: number;
  feeDeducted: number;
  remainingBalance: number;
  status: 'full' | 'partial' | 'overpayment';
}

// ============================================================================
// JOB HANDLER
// ============================================================================

export class FinancingRepaymentJob {
  /**
   * Process a client payment and handle advance repayment
   */
  async processPayment(event: PaymentEvent): Promise<RepaymentResult[]> {
    const { paymentId, invoiceId, amount, freelancerId } = event;
    logger.info('Processing payment for advance repayment', { paymentId, invoiceId, amount });

    const results: RepaymentResult[] = [];

    try {
      // Find outstanding advances for this invoice
      const advances = await this.getOutstandingAdvancesForInvoice(invoiceId);

      if (advances.length === 0) {
        logger.info('No outstanding advances for invoice', { invoiceId });
        return results;
      }

      let remainingPayment = amount;

      for (const advance of advances) {
        if (remainingPayment <= 0) break;

        const repaymentNeeded = advance.outstandingAmount + advance.outstandingFee;
        const repaymentAmount = Math.min(remainingPayment, repaymentNeeded);

        // Calculate fee portion
        const feeRatio = advance.outstandingFee / repaymentNeeded;
        const feeDeducted = repaymentAmount * feeRatio;
        const principalRepaid = repaymentAmount - feeDeducted;

        // Update advance record
        await this.recordRepayment({
          advanceId: advance.id,
          paymentId,
          principalRepaid,
          feeDeducted,
          totalRepaid: repaymentAmount,
        });

        const newOutstanding = repaymentNeeded - repaymentAmount;
        const status = newOutstanding <= 0 ? 'full' : 'partial';

        if (status === 'full') {
          await this.markAdvanceRepaid(advance.id);
        }

        results.push({
          advanceId: advance.id,
          repaymentAmount,
          feeDeducted,
          remainingBalance: Math.max(0, newOutstanding),
          status,
        });

        remainingPayment -= repaymentAmount;

        metrics.increment('financing.repayment.processed', { status });
        logger.info('Processed advance repayment', {
          advanceId: advance.id,
          repaymentAmount,
          status,
        });
      }

      // If there's remaining payment after all advances, credit to freelancer
      if (remainingPayment > 0) {
        await this.creditRemainderToFreelancer(freelancerId, remainingPayment, paymentId);
        logger.info('Credited remainder to freelancer', {
          freelancerId,
          amount: remainingPayment,
        });
      }

      // Send notification
      await this.notifyFreelancer(freelancerId, results);

      return results;
    } catch (error) {
      logger.error('Failed to process repayment', { paymentId, error });
      metrics.increment('financing.repayment.error');
      throw error;
    }
  }

  /**
   * Handle partial payments
   */
  async handlePartialPayment(
    invoiceId: string,
    partialAmount: number,
    paymentId: string
  ): Promise<void> {
    logger.info('Handling partial payment', { invoiceId, partialAmount });

    const advances = await this.getOutstandingAdvancesForInvoice(invoiceId);

    if (advances.length === 0) return;

    // Apply partial payment proportionally
    const totalOutstanding = advances.reduce((sum, a) => sum + a.outstandingAmount, 0);

    for (const advance of advances) {
      const proportion = advance.outstandingAmount / totalOutstanding;
      const partialRepayment = partialAmount * proportion;

      await this.recordRepayment({
        advanceId: advance.id,
        paymentId,
        principalRepaid: partialRepayment,
        feeDeducted: 0, // Fees applied on full repayment
        totalRepaid: partialRepayment,
      });
    }
  }

  /**
   * Handle overpayment (client paid more than invoice)
   */
  private async creditRemainderToFreelancer(
    freelancerId: string,
    amount: number,
    paymentId: string
  ): Promise<void> {
    // In production, credit to freelancer's treasury account
    logger.info('Crediting remainder to freelancer', { freelancerId, amount, paymentId });
  }

  // --------------------------------------------------------------------------
  // DATABASE OPERATIONS (stubs - implement with Prisma)
  // --------------------------------------------------------------------------

  private async getOutstandingAdvancesForInvoice(invoiceId: string): Promise<
    Array<{
      id: string;
      outstandingAmount: number;
      outstandingFee: number;
    }>
  > {
    // In production: query database for advances linked to this invoice
    return [];
  }

  private async recordRepayment(params: {
    advanceId: string;
    paymentId: string;
    principalRepaid: number;
    feeDeducted: number;
    totalRepaid: number;
  }): Promise<void> {
    // In production: create AdvanceRepayment record
    logger.info('Recording repayment', params);
  }

  private async markAdvanceRepaid(advanceId: string): Promise<void> {
    // In production: update advance status to 'repaid'
    logger.info('Marking advance as repaid', { advanceId });
  }

  private async notifyFreelancer(freelancerId: string, results: RepaymentResult[]): Promise<void> {
    // In production: send notification via notification service
    const totalRepaid = results.reduce((sum, r) => sum + r.repaymentAmount, 0);
    logger.info('Notifying freelancer of repayment', { freelancerId, totalRepaid });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let job: FinancingRepaymentJob | null = null;

export function getFinancingRepaymentJob(): FinancingRepaymentJob {
  if (!job) {
    job = new FinancingRepaymentJob();
  }
  return job;
}

