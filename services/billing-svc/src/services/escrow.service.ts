/**
 * @module @skillancer/billing-svc/services/escrow
 * Escrow management service for marketplace transactions
 */

import { createLogger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'escrow-service' });

import { getFeeCalculatorService } from './fee-calculator.service.js';
import { getStripeService } from './stripe.service.js';
import { BillingError, StripeError } from '../errors/index.js';
import {
  getEscrowRepository,
  getMilestoneRepository,
  getContractRepository,
} from '../repositories/escrow.repository.js';

import type {
  FundEscrowParams,
  ReleaseEscrowParams,
  RefundEscrowParams,
  FreezeEscrowParams,
  UnfreezeEscrowParams,
  EscrowSummary,
  EscrowTransactionSummary,
  FeePreview,
} from '../types/escrow.types.js';

// =============================================================================
// ESCROW SERVICE CLASS
// =============================================================================

export class EscrowService {
  private get feeCalculator() {
    return getFeeCalculatorService();
  }

  private get stripeService() {
    return getStripeService();
  }

  private get escrowRepository() {
    return getEscrowRepository();
  }

  private get milestoneRepository() {
    return getMilestoneRepository();
  }

  private get contractRepository() {
    return getContractRepository();
  }

  // ===========================================================================
  // FEE PREVIEW
  // ===========================================================================

  /**
   * Get fee preview for funding escrow
   */
  async getFeesPreview(params: { amount: number; contractId: string }): Promise<FeePreview> {
    const contract = await this.contractRepository.findById(params.contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    return this.feeCalculator.getFeesPreview({
      amount: params.amount,
      platformFeePercent: Number(contract.platformFeePercent),
      secureMode: contract.secureMode,
      secureModeFeePercent: contract.secureModeFeePercent
        ? Number(contract.secureModeFeePercent)
        : undefined,
    });
  }

  // ===========================================================================
  // FUND ESCROW
  // ===========================================================================

  /**
   * Fund escrow for a contract or milestone
   */
  async fundEscrow(params: FundEscrowParams): Promise<{
    transaction: EscrowTransactionSummary;
    clientSecret?: string;
  }> {
    logger.info({ params }, '[EscrowService] Funding escrow');

    // Validate contract
    const contract = await this.validateContractForFunding(params.contractId, params.clientUserId);

    // Calculate fees
    const fees = this.feeCalculator.calculateEscrowFees({
      amount: params.amount,
      platformFeePercent: Number(contract.platformFeePercent),
      secureMode: contract.secureMode,
      secureModeFeePercent: contract.secureModeFeePercent
        ? Number(contract.secureModeFeePercent)
        : undefined,
    });

    // Get or create Stripe customer
    const customer = await this.stripeService.getOrCreateCustomer(params.clientUserId);

    // Create payment intent with manual capture (hold funds)
    let paymentIntent;
    try {
      paymentIntent = await this.stripeService.createPaymentIntent({
        amount: Math.round(fees.totalCharge * 100), // Stripe uses cents
        currency: contract.currency.toLowerCase(),
        customerId: customer.stripeCustomerId,
        paymentMethodId: params.paymentMethodId,
        captureMethod: 'manual', // Hold funds, don't capture yet
        description: `Escrow funding for contract: ${contract.title}`,
        metadata: {
          contract_id: params.contractId,
          milestone_id: params.milestoneId ?? '',
          type: 'escrow_fund',
          gross_amount: params.amount.toString(),
          platform_fee: fees.platformFee.toString(),
        },
      });
    } catch (error) {
      logger.error({ error }, '[EscrowService] Failed to create payment intent');
      throw new StripeError(
        'Failed to process payment',
        (error as Error).message,
        'payment_intent_creation_failed'
      );
    }

    // Determine transaction status based on payment intent
    let transactionStatus: 'PENDING' | 'PROCESSING' | 'REQUIRES_CAPTURE' | 'COMPLETED' = 'PENDING';
    if (paymentIntent.status === 'requires_capture') {
      transactionStatus = 'REQUIRES_CAPTURE';
    } else if (paymentIntent.status === 'requires_action') {
      transactionStatus = 'PROCESSING';
    }

    // Ensure escrow balance exists
    await this.escrowRepository.getOrCreateBalance(params.contractId, contract.currency);

    // Create escrow transaction record
    const transaction = await this.escrowRepository.createTransaction({
      contractId: params.contractId,
      milestoneId: params.milestoneId,
      type: 'FUND',
      status: transactionStatus,
      grossAmount: params.amount,
      platformFee: fees.platformFee,
      processingFee: fees.processingFee,
      netAmount: fees.netAmount,
      currency: contract.currency,
      stripePaymentIntentId: paymentIntent.id,
      fromUserId: params.clientUserId,
      description: `Escrow funding${params.milestoneId ? ' for milestone' : ''}`,
      metadata: {
        totalCharge: fees.totalCharge,
        secureModeAmount: fees.secureModeAmount,
      },
    });

    // If payment is ready to be captured, update balance immediately
    if (transactionStatus === 'REQUIRES_CAPTURE') {
      await this.escrowRepository.updateBalance(params.contractId, {
        totalFunded: { increment: params.amount },
        currentBalance: { increment: params.amount },
      });

      // Update milestone if applicable
      if (params.milestoneId) {
        await this.milestoneRepository.update(params.milestoneId, {
          escrowFunded: true,
          escrowFundedAt: new Date(),
        });
      }

      // Update contract status if needed
      if (contract.status === 'PENDING' || contract.status === 'PENDING_FUNDING') {
        await this.contractRepository.update(params.contractId, {
          status: 'ACTIVE',
          startDate: new Date(),
        });
      }
    }

    logger.info(
      { transactionId: transaction.id, status: transactionStatus },
      '[EscrowService] Escrow funding transaction created'
    );

    return {
      transaction: this.mapTransactionToSummary(transaction),
      clientSecret:
        paymentIntent.status === 'requires_action' ? paymentIntent.client_secret : undefined,
    };
  }

  /**
   * Complete escrow funding after payment confirmation
   * Called by webhook handler when payment is confirmed
   */
  async completeFunding(paymentIntentId: string): Promise<void> {
    logger.info({ paymentIntentId }, '[EscrowService] Completing escrow funding');

    const transaction =
      await this.escrowRepository.findTransactionByPaymentIntentId(paymentIntentId);

    if (!transaction) {
      logger.warn({ paymentIntentId }, '[EscrowService] Transaction not found for payment intent');
      return;
    }

    if (transaction.status === 'COMPLETED') {
      logger.info(
        { transactionId: transaction.id },
        '[EscrowService] Transaction already completed'
      );
      return;
    }

    // Update transaction status
    await this.escrowRepository.updateTransaction(transaction.id, {
      status: 'REQUIRES_CAPTURE',
      processedAt: new Date(),
    });

    // Update escrow balance
    await this.escrowRepository.updateBalance(transaction.contractId, {
      totalFunded: { increment: Number(transaction.grossAmount) },
      currentBalance: { increment: Number(transaction.grossAmount) },
    });

    // Update milestone if applicable
    if (transaction.milestoneId) {
      await this.milestoneRepository.update(transaction.milestoneId, {
        escrowFunded: true,
        escrowFundedAt: new Date(),
      });
    }

    // Update contract status if needed
    const contract = await this.contractRepository.findById(transaction.contractId);
    if (contract && (contract.status === 'PENDING' || contract.status === 'PENDING_FUNDING')) {
      await this.contractRepository.update(transaction.contractId, {
        status: 'ACTIVE',
        startDate: new Date(),
      });
    }

    logger.info({ transactionId: transaction.id }, '[EscrowService] Escrow funding completed');
  }

  // ===========================================================================
  // RELEASE ESCROW
  // ===========================================================================

  /**
   * Release escrow funds to freelancer
   */
  async releaseEscrow(params: ReleaseEscrowParams): Promise<{
    transaction: EscrowTransactionSummary;
  }> {
    logger.info({ params }, '[EscrowService] Releasing escrow');

    // Validate contract
    const contract = await this.validateContractForRelease(params.contractId, params.clientUserId);

    // Get escrow balance
    const escrowBalance = await this.escrowRepository.getBalance(params.contractId);
    if (!escrowBalance) {
      throw new BillingError('Escrow balance not found', 'ESCROW_NOT_FOUND');
    }

    // Determine release amount
    let releaseAmount: number;
    if (params.milestoneId) {
      const milestone = await this.milestoneRepository.findById(params.milestoneId);
      if (!milestone) {
        throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
      }
      if (milestone.status !== 'APPROVED') {
        throw new BillingError(
          'Milestone must be approved before release',
          'MILESTONE_NOT_APPROVED'
        );
      }
      releaseAmount = Number(milestone.amount);
    } else if (params.amount) {
      releaseAmount = params.amount;
    } else {
      throw new BillingError(
        'Either milestoneId or amount must be provided',
        'INVALID_RELEASE_PARAMS'
      );
    }

    // Validate sufficient balance
    const availableBalance =
      Number(escrowBalance.currentBalance) - Number(escrowBalance.frozenAmount);
    if (releaseAmount > availableBalance) {
      throw new BillingError(
        `Insufficient escrow balance. Available: ${availableBalance}, Requested: ${releaseAmount}`,
        'INSUFFICIENT_BALANCE'
      );
    }

    // Calculate fees for this release
    const fees = this.feeCalculator.calculateReleaseFees({
      amount: releaseAmount,
      platformFeePercent: Number(contract.platformFeePercent),
      secureMode: contract.secureMode,
      secureModeFeePercent: contract.secureModeFeePercent
        ? Number(contract.secureModeFeePercent)
        : undefined,
    });

    // Get freelancer's payout account
    const payoutAccount = await this.stripeService.getPayoutAccount(contract.freelancerId);
    if (!payoutAccount || payoutAccount.status !== 'ACTIVE') {
      throw new BillingError(
        'Freelancer does not have an active payout account',
        'NO_PAYOUT_ACCOUNT'
      );
    }

    // Find the original funding transaction to capture
    const fundingTransaction = await this.escrowRepository.findFundingTransaction(
      params.contractId,
      params.milestoneId
    );

    // Capture the held funds if not already captured
    if (
      fundingTransaction?.stripePaymentIntentId &&
      fundingTransaction.status === 'REQUIRES_CAPTURE'
    ) {
      try {
        await this.stripeService.capturePaymentIntent(
          fundingTransaction.stripePaymentIntentId,
          Math.round(releaseAmount * 100)
        );

        // Update funding transaction status
        await this.escrowRepository.updateTransaction(fundingTransaction.id, {
          status: 'COMPLETED',
          processedAt: new Date(),
        });
      } catch (error) {
        logger.error({ error }, '[EscrowService] Failed to capture payment');
        throw new StripeError(
          'Failed to capture payment',
          (error as Error).message,
          'capture_failed'
        );
      }
    }

    // Transfer to freelancer's connected account
    let transfer;
    try {
      transfer = await this.stripeService.createTransfer({
        amount: Math.round(fees.netAmount * 100), // Stripe uses cents
        currency: contract.currency.toLowerCase(),
        destinationAccountId: payoutAccount.stripeConnectAccountId,
        description: `Payment for contract: ${contract.title}`,
        metadata: {
          contract_id: params.contractId,
          milestone_id: params.milestoneId ?? '',
          type: 'escrow_release',
        },
      });
    } catch (error) {
      logger.error({ error }, '[EscrowService] Failed to transfer to freelancer');
      throw new StripeError(
        'Failed to transfer funds to freelancer',
        (error as Error).message,
        'transfer_failed'
      );
    }

    // Create release transaction
    const transaction = await this.escrowRepository.createTransaction({
      contractId: params.contractId,
      milestoneId: params.milestoneId,
      type: 'RELEASE',
      status: 'COMPLETED',
      grossAmount: releaseAmount,
      platformFee: fees.platformFee,
      processingFee: fees.processingFee,
      netAmount: fees.netAmount,
      currency: contract.currency,
      stripeTransferId: transfer.id,
      fromUserId: params.clientUserId,
      toUserId: contract.freelancerId,
      description: 'Escrow release to freelancer',
      processedAt: new Date(),
    });

    // Update escrow balance
    await this.escrowRepository.updateBalance(params.contractId, {
      totalReleased: { increment: releaseAmount },
      currentBalance: { decrement: releaseAmount },
    });

    // Update milestone status
    if (params.milestoneId) {
      await this.milestoneRepository.update(params.milestoneId, {
        status: 'RELEASED',
        escrowReleasedAt: new Date(),
      });
    }

    // Check if contract is complete
    await this.checkContractCompletion(params.contractId);

    logger.info(
      { transactionId: transaction.id, netAmount: fees.netAmount },
      '[EscrowService] Escrow released to freelancer'
    );

    return {
      transaction: this.mapTransactionToSummary(transaction),
    };
  }

  // ===========================================================================
  // REFUND ESCROW
  // ===========================================================================

  /**
   * Refund escrow to client
   */
  async refundEscrow(params: RefundEscrowParams): Promise<{
    transaction: EscrowTransactionSummary;
  }> {
    logger.info({ params }, '[EscrowService] Refunding escrow');

    // Get contract
    const contract = await this.contractRepository.findById(params.contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Get escrow balance
    const escrowBalance = await this.escrowRepository.getBalance(params.contractId);
    if (!escrowBalance) {
      throw new BillingError('Escrow balance not found', 'ESCROW_NOT_FOUND');
    }

    // Determine refund amount
    const refundAmount = params.amount ?? Number(escrowBalance.currentBalance);

    // Validate sufficient balance
    const availableBalance =
      Number(escrowBalance.currentBalance) - Number(escrowBalance.frozenAmount);
    if (refundAmount > availableBalance) {
      throw new BillingError(
        `Insufficient available balance for refund. Available: ${availableBalance}`,
        'INSUFFICIENT_BALANCE'
      );
    }

    // Find original funding transaction
    const fundingTransaction = await this.escrowRepository.findFundingTransaction(
      params.contractId,
      params.milestoneId
    );

    // Cancel or refund based on capture status
    if (fundingTransaction?.stripePaymentIntentId) {
      try {
        if (fundingTransaction.status === 'REQUIRES_CAPTURE') {
          // Cancel the uncaptured payment intent (releases the hold)
          await this.stripeService.cancelPaymentIntent(fundingTransaction.stripePaymentIntentId);
        } else if (fundingTransaction.status === 'COMPLETED') {
          // Create a refund for captured payment
          await this.stripeService.createRefund({
            paymentIntentId: fundingTransaction.stripePaymentIntentId,
            amount: Math.round(refundAmount * 100),
            reason: params.reason,
          });
        }
      } catch (error) {
        logger.error({ error }, '[EscrowService] Failed to process refund');
        throw new StripeError(
          'Failed to process refund',
          (error as Error).message,
          'refund_failed'
        );
      }
    }

    // Create refund transaction
    const transaction = await this.escrowRepository.createTransaction({
      contractId: params.contractId,
      milestoneId: params.milestoneId,
      type: 'REFUND',
      status: 'COMPLETED',
      grossAmount: refundAmount,
      platformFee: 0,
      processingFee: 0,
      netAmount: refundAmount,
      currency: contract.currency,
      fromUserId: contract.freelancerId,
      toUserId: contract.clientId,
      description: `Escrow refund: ${params.reason}`,
      processedAt: new Date(),
    });

    // Update escrow balance
    await this.escrowRepository.updateBalance(params.contractId, {
      totalRefunded: { increment: refundAmount },
      currentBalance: { decrement: refundAmount },
    });

    // Update funding transaction status
    if (fundingTransaction) {
      await this.escrowRepository.updateTransaction(fundingTransaction.id, {
        status: 'CANCELLED',
      });
    }

    logger.info(
      { transactionId: transaction.id, refundAmount },
      '[EscrowService] Escrow refunded to client'
    );

    return {
      transaction: this.mapTransactionToSummary(transaction),
    };
  }

  // ===========================================================================
  // FREEZE/UNFREEZE ESCROW
  // ===========================================================================

  /**
   * Freeze escrow for dispute
   */
  async freezeEscrow(params: FreezeEscrowParams): Promise<void> {
    logger.info({ params }, '[EscrowService] Freezing escrow');

    const escrowBalance = await this.escrowRepository.getBalance(params.contractId);
    if (!escrowBalance) {
      throw new BillingError('Escrow balance not found', 'ESCROW_NOT_FOUND');
    }

    await this.escrowRepository.freezeBalance(params.contractId, params.amount);

    // Update contract status
    await this.contractRepository.update(params.contractId, {
      status: 'DISPUTED',
    });

    logger.info({ contractId: params.contractId }, '[EscrowService] Escrow frozen');
  }

  /**
   * Unfreeze escrow after dispute resolution
   */
  async unfreezeEscrow(params: UnfreezeEscrowParams): Promise<void> {
    logger.info({ params }, '[EscrowService] Unfreezing escrow');

    await this.escrowRepository.unfreezeBalance(params.contractId, params.amount);

    logger.info({ contractId: params.contractId }, '[EscrowService] Escrow unfrozen');
  }

  // ===========================================================================
  // ESCROW SUMMARY
  // ===========================================================================

  /**
   * Get escrow summary for a contract
   */
  async getEscrowSummary(contractId: string, userId: string): Promise<EscrowSummary> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Validate user is party to contract
    if (contract.clientId !== userId && contract.freelancerId !== userId) {
      throw new BillingError('Not authorized to view this contract', 'NOT_AUTHORIZED');
    }

    const balance = await this.escrowRepository.getOrCreateBalance(contractId, contract.currency);
    const transactions = await this.escrowRepository.getTransactionsByContract(contractId, 10);
    const milestones = await this.milestoneRepository.findByContractId(contractId);

    return {
      contract: {
        id: contract.id,
        title: contract.title,
        totalAmount: Number(contract.totalAmount ?? 0),
        currency: contract.currency,
        status: contract.status as never,
      },
      balance: {
        totalFunded: Number(balance.totalFunded),
        totalReleased: Number(balance.totalReleased),
        totalRefunded: Number(balance.totalRefunded),
        currentBalance: Number(balance.currentBalance),
        frozenAmount: Number(balance.frozenAmount),
        availableBalance: Number(balance.currentBalance) - Number(balance.frozenAmount),
      },
      milestones: milestones.map((m) => ({
        id: m.id,
        title: m.title,
        amount: Number(m.amount),
        status: m.status as never,
        escrowFunded: m.escrowFunded,
      })),
      recentTransactions: transactions.map((t) => this.mapTransactionToSummary(t)),
    };
  }

  /**
   * Get transactions for a contract
   */
  async getTransactions(contractId: string, limit?: number) {
    const transactions = await this.escrowRepository.getTransactionsByContract(contractId, limit);
    return transactions.map((t) => this.mapTransactionToSummary(t));
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Validate contract for funding
   */
  private async validateContractForFunding(contractId: string, clientUserId: string) {
    const contract = await this.contractRepository.findById(contractId);

    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    if (contract.clientId !== clientUserId) {
      throw new BillingError('Only the client can fund escrow', 'NOT_AUTHORIZED');
    }

    if (contract.status === 'COMPLETED' || contract.status === 'CANCELLED') {
      throw new BillingError(
        'Cannot fund escrow for completed or cancelled contract',
        'INVALID_CONTRACT_STATUS'
      );
    }

    return contract;
  }

  /**
   * Validate contract for release
   */
  private async validateContractForRelease(contractId: string, clientUserId: string) {
    const contract = await this.contractRepository.findById(contractId);

    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    if (contract.clientId !== clientUserId) {
      throw new BillingError('Only the client can release escrow', 'NOT_AUTHORIZED');
    }

    if (contract.status === 'DISPUTED') {
      throw new BillingError(
        'Cannot release escrow while contract is disputed',
        'CONTRACT_DISPUTED'
      );
    }

    return contract;
  }

  /**
   * Check if contract is complete and update status
   */
  private async checkContractCompletion(contractId: string): Promise<void> {
    const allReleased = await this.contractRepository.areAllMilestonesReleased(contractId);

    if (allReleased) {
      const balance = await this.escrowRepository.getBalance(contractId);

      // If all milestones released and no remaining balance, complete contract
      if (balance && Number(balance.currentBalance) === 0) {
        await this.contractRepository.update(contractId, {
          status: 'COMPLETED',
          completedAt: new Date(),
        });

        await this.escrowRepository.closeBalance(contractId);

        logger.info({ contractId }, '[EscrowService] Contract completed');
      }
    }
  }

  /**
   * Map transaction to summary
   */
  private mapTransactionToSummary(transaction: {
    id: string;
    type: string;
    status: string;
    grossAmount: unknown;
    platformFee: unknown;
    processingFee: unknown;
    netAmount: unknown;
    currency: string;
    description: string | null;
    createdAt: Date;
    processedAt: Date | null;
  }): EscrowTransactionSummary {
    return {
      id: transaction.id,
      type: transaction.type as never,
      status: transaction.status as never,
      grossAmount: Number(transaction.grossAmount),
      platformFee: Number(transaction.platformFee),
      processingFee: Number(transaction.processingFee),
      netAmount: Number(transaction.netAmount),
      currency: transaction.currency,
      description: transaction.description ?? undefined,
      createdAt: transaction.createdAt,
      processedAt: transaction.processedAt ?? undefined,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let escrowServiceInstance: EscrowService | null = null;

export function getEscrowService(): EscrowService {
  escrowServiceInstance ??= new EscrowService();
  return escrowServiceInstance;
}

export function resetEscrowService(): void {
  escrowServiceInstance = null;
}
