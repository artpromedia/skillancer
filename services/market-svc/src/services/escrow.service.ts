/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/**
 * @module @skillancer/market-svc/services/escrow
 * Escrow management service for ContractV2 marketplace transactions
 */

import { Prisma } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';

import { getStripeService } from './stripe.service.js';
import { ContractActivityRepository } from '../repositories/contract-activity.repository.js';
import { ContractMilestoneRepository } from '../repositories/contract-milestone.repository.js';
import { ContractRepository } from '../repositories/contract.repository.js';
import { EscrowRepository } from '../repositories/escrow.repository.js';

import type {
  FundEscrowParams,
  ReleaseEscrowParams,
  RefundEscrowParams,
  FreezeEscrowParams,
  UnfreezeEscrowParams,
  ResolveDisputeParams,
  EscrowAccountSummary,
  EscrowTransactionSummary,
  FundEscrowResult,
  ReleaseEscrowResult,
  RefundEscrowResult,
  FeePreview,
} from '../types/contract.types.js';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'escrow-service' });

// =============================================================================
// ERROR CLASSES
// =============================================================================

export class EscrowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'EscrowError';
  }
}

export const EscrowErrorCodes = {
  CONTRACT_NOT_FOUND: 'CONTRACT_NOT_FOUND',
  ESCROW_ACCOUNT_NOT_FOUND: 'ESCROW_ACCOUNT_NOT_FOUND',
  MILESTONE_NOT_FOUND: 'MILESTONE_NOT_FOUND',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  ALREADY_FUNDED: 'ALREADY_FUNDED',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  INVALID_STATE: 'INVALID_STATE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  TRANSFER_FAILED: 'TRANSFER_FAILED',
  REFUND_FAILED: 'REFUND_FAILED',
} as const;

// =============================================================================
// ESCROW SERVICE CLASS
// =============================================================================

export class EscrowService {
  private readonly escrowRepository: EscrowRepository;
  private readonly milestoneRepository: ContractMilestoneRepository;
  private readonly contractRepository: ContractRepository;
  private readonly activityRepository: ContractActivityRepository;
  private readonly logger: Logger;

  constructor(private readonly prisma: PrismaClient) {
    this.escrowRepository = new EscrowRepository(prisma);
    this.milestoneRepository = new ContractMilestoneRepository(prisma);
    this.contractRepository = new ContractRepository(prisma);
    this.activityRepository = new ContractActivityRepository(prisma);
    this.logger = logger;
  }

  private get stripeService() {
    return getStripeService();
  }

  // ===========================================================================
  // FEE CALCULATION
  // ===========================================================================

  /**
   * Get fee preview for funding escrow
   */
  async getFeesPreview(contractId: string, amount: number): Promise<FeePreview> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new EscrowError('Contract not found', EscrowErrorCodes.CONTRACT_NOT_FOUND, 404);
    }

    const fees = this.stripeService.calculateFees(amount);

    return {
      ...fees,
      platformFeePercent: 10, // FUTURE: Make configurable per contract
      processingFeePercent: 2.9,
      breakdown: [
        { label: 'Subtotal', amount: fees.grossAmount },
        { label: 'Platform Fee (10%)', amount: fees.platformFee, description: 'Service fee' },
        { label: 'Processing Fee', amount: fees.processingFee, description: 'Payment processing' },
        { label: 'Total Charge', amount: fees.totalCharge },
        { label: 'Freelancer Receives', amount: fees.netAmount },
      ],
    };
  }

  // ===========================================================================
  // FUND ESCROW
  // ===========================================================================

  /**
   * Validate contract exists and user is authorized as client
   */
  private async validateContractForFunding(
    contractId: string,
    clientUserId: string
  ): Promise<NonNullable<Awaited<ReturnType<ContractRepository['findById']>>>> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new EscrowError('Contract not found', EscrowErrorCodes.CONTRACT_NOT_FOUND, 404);
    }
    if (contract.clientUserId !== clientUserId) {
      throw new EscrowError(
        'Only the client can fund escrow',
        EscrowErrorCodes.NOT_AUTHORIZED,
        403
      );
    }
    return contract;
  }

  /**
   * Validate milestone for funding if provided
   */
  private async validateMilestoneForFunding(
    milestoneId: string | undefined,
    contractId: string,
    amount: number
  ): Promise<Awaited<ReturnType<ContractMilestoneRepository['findById']>>> {
    if (!milestoneId) {
      return null;
    }

    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (milestone?.contractId !== contractId) {
      throw new EscrowError('Milestone not found', EscrowErrorCodes.MILESTONE_NOT_FOUND, 404);
    }
    if (milestone.escrowFunded) {
      throw new EscrowError('Milestone is already funded', EscrowErrorCodes.ALREADY_FUNDED, 400);
    }
    if (amount !== Number(milestone.amount)) {
      throw new EscrowError(
        `Amount must match milestone amount: ${milestone.amount}`,
        EscrowErrorCodes.INVALID_AMOUNT,
        400
      );
    }
    return milestone;
  }

  /**
   * Determine transaction status from payment intent
   */
  private determineTransactionStatus(paymentIntentStatus: string): {
    status: 'PENDING' | 'PROCESSING' | 'REQUIRES_CAPTURE';
    requiresAction: boolean;
  } {
    if (paymentIntentStatus === 'requires_capture') {
      return { status: 'REQUIRES_CAPTURE', requiresAction: false };
    }
    if (paymentIntentStatus === 'requires_action') {
      return { status: 'PROCESSING', requiresAction: true };
    }
    return { status: 'PENDING', requiresAction: false };
  }

  /**
   * Fund escrow for a contract or milestone
   */
  async fundEscrow(params: FundEscrowParams): Promise<FundEscrowResult> {
    this.logger.info({ params }, '[EscrowService] Funding escrow');

    // Validate contract and authorization
    const contract = await this.validateContractForFunding(params.contractId, params.clientUserId);

    // Validate milestone if provided
    const milestone = await this.validateMilestoneForFunding(
      params.milestoneId,
      params.contractId,
      params.amount
    );

    // Calculate fees
    const fees = this.stripeService.calculateFees(params.amount);

    // Get or create escrow account
    const escrowAccount = await this.escrowRepository.getOrCreateAccount({
      contractId: params.contractId,
      clientUserId: contract.clientUserId,
      freelancerUserId: contract.freelancerUserId,
      currency: contract.currency,
    });

    // Get or create Stripe customer
    const { stripeCustomerId } = await this.stripeService.getOrCreateCustomer(params.clientUserId);

    // Create payment intent with manual capture
    let paymentIntent;
    try {
      paymentIntent = await this.stripeService.createPaymentIntent({
        amount: fees.totalCharge,
        currency: contract.currency,
        customerId: stripeCustomerId,
        paymentMethodId: params.paymentMethodId,
        captureMethod: 'manual',
        description: milestone
          ? `Escrow funding for contract: ${contract.title} - Milestone: ${milestone.title}`
          : `Escrow funding for contract: ${contract.title}`,
        metadata: {
          contract_id: params.contractId,
          milestone_id: params.milestoneId ?? '',
          escrow_account_id: escrowAccount.id,
          type: 'escrow_fund',
          gross_amount: params.amount.toString(),
          platform_fee: fees.platformFee.toString(),
        },
        idempotencyKey: params.idempotencyKey,
      });
    } catch (error) {
      this.logger.error({ error }, '[EscrowService] Failed to create payment intent');
      throw new EscrowError('Failed to process payment', EscrowErrorCodes.PAYMENT_FAILED, 502);
    }

    // Determine transaction status based on payment intent
    const { status: transactionStatus, requiresAction } = this.determineTransactionStatus(
      paymentIntent.status
    );

    // Create escrow transaction
    const transaction = await this.escrowRepository.createTransaction({
      escrowAccountId: escrowAccount.id,
      contractId: params.contractId,
      transactionType: 'FUND',
      amount: params.amount,
      milestoneId: params.milestoneId,
      platformFee: fees.platformFee,
      processingFee: fees.processingFee,
      netAmount: fees.netAmount,
      currency: contract.currency,
      stripePaymentIntentId: paymentIntent.id,
      description: milestone
        ? `Escrow funding for milestone: ${milestone.title}`
        : 'Escrow funding',
      metadata: {
        totalCharge: fees.totalCharge,
        paymentIntentStatus: paymentIntent.status,
      },
    });

    // Update transaction status
    await this.escrowRepository.updateTransaction(transaction.id, {
      status: transactionStatus,
    });

    // If payment is ready to be captured, update balances immediately
    if (transactionStatus === 'REQUIRES_CAPTURE') {
      await this.handleFundingCaptureReady(
        escrowAccount.id,
        params.contractId,
        params.amount,
        params.milestoneId
      );
    }

    // Log activity
    await this.activityRepository.log({
      contractId: params.contractId,
      actorUserId: params.clientUserId,
      activityType: params.milestoneId ? 'MILESTONE_FUNDED' : 'CONTRACT_CREATED',
      description: `Escrow funded: $${params.amount}`,
      metadata: {
        transactionId: transaction.id,
        amount: params.amount,
        milestoneId: params.milestoneId,
      },
    });

    this.logger.info(
      { transactionId: transaction.id, status: transactionStatus },
      '[EscrowService] Escrow funding transaction created'
    );

    // Get updated escrow account
    const updatedAccount = await this.escrowRepository.findAccountByContractId(params.contractId);
    const clientSecret = requiresAction ? (paymentIntent.client_secret ?? undefined) : undefined;

    return {
      transaction: this.mapTransactionToSummary(transaction),
      ...(clientSecret && { clientSecret }),
      requiresAction,
      escrowAccount: this.mapAccountToSummary(updatedAccount!, contract),
    };
  }

  /**
   * Handle funding capture ready (payment authorized)
   */
  private async handleFundingCaptureReady(
    escrowAccountId: string,
    contractId: string,
    amount: number,
    milestoneId?: string
  ): Promise<void> {
    // Update escrow balance
    await this.escrowRepository.updateAccountBalance(contractId, {
      balance: { increment: amount },
      pendingBalance: { increment: amount },
    });

    // Update milestone if applicable
    if (milestoneId) {
      await this.milestoneRepository.updateStatus(milestoneId, 'FUNDED', {
        escrowFunded: true,
        escrowFundedAt: new Date(),
      });
    }

    // Update contract status if needed
    const contract = await this.contractRepository.findById(contractId);
    if (contract?.status === 'DRAFT') {
      await this.prisma.contractV2.update({
        where: { id: contractId },
        data: { status: 'ACTIVE', updatedAt: new Date() },
      });
    }
  }

  // ===========================================================================
  // RELEASE ESCROW
  // ===========================================================================

  /**
   * Release escrow funds to freelancer
   */
  async releaseEscrow(params: ReleaseEscrowParams): Promise<ReleaseEscrowResult> {
    this.logger.info({ params }, '[EscrowService] Releasing escrow');

    // Validate contract
    const contract = await this.contractRepository.findById(params.contractId);
    if (!contract) {
      throw new EscrowError('Contract not found', EscrowErrorCodes.CONTRACT_NOT_FOUND, 404);
    }

    // Verify caller is the client
    if (contract.clientUserId !== params.clientUserId) {
      throw new EscrowError(
        'Only the client can release escrow',
        EscrowErrorCodes.NOT_AUTHORIZED,
        403
      );
    }

    // Get escrow account
    const escrowAccount = await this.escrowRepository.findAccountByContractId(params.contractId);
    if (!escrowAccount) {
      throw new EscrowError(
        'Escrow account not found',
        EscrowErrorCodes.ESCROW_ACCOUNT_NOT_FOUND,
        404
      );
    }

    // Determine amount to release
    let releaseAmount = params.amount;
    let milestone = null;

    if (params.milestoneId) {
      milestone = await this.milestoneRepository.findById(params.milestoneId);
      if (!milestone || milestone.contractId !== params.contractId) {
        throw new EscrowError('Milestone not found', EscrowErrorCodes.MILESTONE_NOT_FOUND, 404);
      }

      // Validate milestone is approved
      if (milestone.status !== 'APPROVED') {
        throw new EscrowError(
          'Milestone must be approved before release',
          EscrowErrorCodes.INVALID_STATE,
          400
        );
      }

      releaseAmount = Number(milestone.amount);
    }

    if (!releaseAmount) {
      throw new EscrowError('Release amount is required', EscrowErrorCodes.INVALID_AMOUNT, 400);
    }

    // Check sufficient balance
    const availableBalance = Number(escrowAccount.balance) - Number(escrowAccount.disputedBalance);
    if (releaseAmount > availableBalance) {
      throw new EscrowError(
        'Insufficient escrow balance',
        EscrowErrorCodes.INSUFFICIENT_BALANCE,
        400
      );
    }

    // Calculate fees for release
    const fees = this.stripeService.calculateFees(releaseAmount);

    // Create release transaction
    const transaction = await this.escrowRepository.createTransaction({
      escrowAccountId: escrowAccount.id,
      contractId: params.contractId,
      transactionType: 'RELEASE',
      amount: releaseAmount,
      milestoneId: params.milestoneId,
      platformFee: fees.platformFee,
      processingFee: 0, // No processing fee on release
      netAmount: fees.netAmount,
      currency: contract.currency,
      description:
        params.notes ??
        (milestone ? `Escrow release for milestone: ${milestone.title}` : 'Escrow release'),
    });

    // Update escrow balance
    await this.escrowRepository.updateAccountBalance(params.contractId, {
      balance: { decrement: releaseAmount },
      pendingBalance: { decrement: releaseAmount },
      releasedBalance: { increment: fees.netAmount },
    });

    // Update milestone status
    if (params.milestoneId && milestone) {
      await this.milestoneRepository.updateStatus(params.milestoneId, 'PAID', {
        paidAt: new Date(),
        paymentTransactionId: transaction.id,
      });
    }

    // Mark transaction as completed (payout will be scheduled separately)
    await this.escrowRepository.updateTransaction(transaction.id, {
      status: 'COMPLETED',
      processedAt: new Date(),
    });

    // Update contract totals
    await this.prisma.contractV2.update({
      where: { id: params.contractId },
      data: {
        totalPaid: { increment: new Prisma.Decimal(fees.netAmount) },
        totalInEscrow: { decrement: new Prisma.Decimal(releaseAmount) },
        updatedAt: new Date(),
      },
    });

    // Log activity
    await this.activityRepository.log({
      contractId: params.contractId,
      actorUserId: params.clientUserId,
      activityType: params.milestoneId ? 'MILESTONE_PAID' : 'INVOICE_PAID',
      description: `Escrow released: $${fees.netAmount} to freelancer`,
      metadata: {
        transactionId: transaction.id,
        amount: fees.netAmount,
        milestoneId: params.milestoneId,
      },
    });

    this.logger.info(
      { transactionId: transaction.id, amount: fees.netAmount },
      '[EscrowService] Escrow released'
    );

    // Get updated escrow account
    const updatedAccount = await this.escrowRepository.findAccountByContractId(params.contractId);

    return {
      transaction: this.mapTransactionToSummary(transaction),
      escrowAccount: this.mapAccountToSummary(updatedAccount!, contract),
      payoutScheduled: true, // Payout worker will pick this up
    };
  }

  // ===========================================================================
  // REFUND ESCROW
  // ===========================================================================

  /**
   * Refund escrow funds to client
   */
  async refundEscrow(params: RefundEscrowParams): Promise<RefundEscrowResult> {
    this.logger.info({ params }, '[EscrowService] Refunding escrow');

    // Validate contract
    const contract = await this.contractRepository.findById(params.contractId);
    if (!contract) {
      throw new EscrowError('Contract not found', EscrowErrorCodes.CONTRACT_NOT_FOUND, 404);
    }

    // Get escrow account
    const escrowAccount = await this.escrowRepository.findAccountByContractId(params.contractId);
    if (!escrowAccount) {
      throw new EscrowError(
        'Escrow account not found',
        EscrowErrorCodes.ESCROW_ACCOUNT_NOT_FOUND,
        404
      );
    }

    // Determine amount to refund
    let refundAmount = params.amount;
    let milestone = null;

    if (params.milestoneId) {
      milestone = await this.milestoneRepository.findById(params.milestoneId);
      if (!milestone) {
        throw new EscrowError('Milestone not found', EscrowErrorCodes.MILESTONE_NOT_FOUND, 404);
      }
      refundAmount = Number(milestone.amount);
    }

    if (!refundAmount) {
      refundAmount = Number(escrowAccount.balance);
    }

    // Check sufficient balance
    if (refundAmount > Number(escrowAccount.balance)) {
      throw new EscrowError(
        'Insufficient escrow balance for refund',
        EscrowErrorCodes.INSUFFICIENT_BALANCE,
        400
      );
    }

    // Find the original funding transaction
    const fundingTransaction = params.milestoneId
      ? await this.escrowRepository.findMilestoneFundingTransaction(params.milestoneId)
      : null;

    let stripeRefundId: string | undefined;

    // Create Stripe refund if we have a payment intent
    if (fundingTransaction?.stripePaymentIntentId) {
      try {
        const refund = await this.stripeService.createRefund({
          paymentIntentId: fundingTransaction.stripePaymentIntentId,
          amount: refundAmount,
          reason: 'requested_by_customer',
          metadata: {
            contract_id: params.contractId,
            milestone_id: params.milestoneId ?? '',
            reason: params.reason,
          },
        });
        stripeRefundId = refund.id;
      } catch (error) {
        this.logger.error({ error }, '[EscrowService] Failed to create Stripe refund');
        throw new EscrowError('Failed to process refund', EscrowErrorCodes.REFUND_FAILED, 502);
      }
    }

    // Create refund transaction
    const transaction = await this.escrowRepository.createTransaction({
      escrowAccountId: escrowAccount.id,
      contractId: params.contractId,
      transactionType: 'REFUND',
      amount: refundAmount,
      ...(params.milestoneId && { milestoneId: params.milestoneId }),
      currency: contract.currency,
      ...(stripeRefundId && { stripeRefundId }),
      description: `Refund: ${params.reason}`,
    });

    // Update escrow balance
    await this.escrowRepository.updateAccountBalance(params.contractId, {
      balance: { decrement: refundAmount },
      pendingBalance: { decrement: refundAmount },
      refundedBalance: { increment: refundAmount },
    });

    // Update milestone status if applicable
    if (params.milestoneId) {
      await this.milestoneRepository.updateStatus(params.milestoneId, 'CANCELLED');
    }

    // Mark transaction as completed
    await this.escrowRepository.updateTransaction(transaction.id, {
      status: 'COMPLETED',
      processedAt: new Date(),
    });

    // Update contract totals
    await this.prisma.contractV2.update({
      where: { id: params.contractId },
      data: {
        totalInEscrow: { decrement: new Prisma.Decimal(refundAmount) },
        updatedAt: new Date(),
      },
    });

    // Log activity
    await this.activityRepository.log({
      contractId: params.contractId,
      actorUserId: params.initiatedBy,
      activityType: 'MILESTONE_CANCELLED',
      description: `Escrow refunded: $${refundAmount} - ${params.reason}`,
      metadata: {
        transactionId: transaction.id,
        amount: refundAmount,
        reason: params.reason,
      },
    });

    this.logger.info(
      { transactionId: transaction.id, amount: refundAmount, stripeRefundId },
      '[EscrowService] Escrow refunded'
    );

    // Get updated escrow account
    const updatedAccount = await this.escrowRepository.findAccountByContractId(params.contractId);

    return {
      transaction: this.mapTransactionToSummary(transaction),
      escrowAccount: this.mapAccountToSummary(updatedAccount!, contract),
      ...(stripeRefundId && { stripeRefundId }),
    };
  }

  // ===========================================================================
  // DISPUTE HANDLING
  // ===========================================================================

  /**
   * Freeze escrow for a dispute
   */
  async freezeEscrow(params: FreezeEscrowParams): Promise<EscrowAccountSummary> {
    this.logger.info({ params }, '[EscrowService] Freezing escrow for dispute');

    // Get escrow account
    const escrowAccount = await this.escrowRepository.findAccountByContractId(params.contractId);
    if (!escrowAccount) {
      throw new EscrowError(
        'Escrow account not found',
        EscrowErrorCodes.ESCROW_ACCOUNT_NOT_FOUND,
        404
      );
    }

    const freezeAmount = params.amount ?? Number(escrowAccount.balance);

    // Create hold transaction
    await this.escrowRepository.createTransaction({
      escrowAccountId: escrowAccount.id,
      contractId: params.contractId,
      transactionType: 'HOLD',
      amount: freezeAmount,
      disputeId: params.disputeId,
      currency: escrowAccount.currency,
      description: `Funds held for dispute: ${params.disputeId}`,
    });

    // Update escrow balance
    await this.escrowRepository.updateAccountBalance(params.contractId, {
      disputedBalance: { increment: freezeAmount },
      status: 'DISPUTED',
    });

    // Get updated account
    const updatedAccount = await this.escrowRepository.findAccountByContractId(params.contractId);
    const contract = await this.contractRepository.findById(params.contractId);

    return this.mapAccountToSummary(updatedAccount!, contract!);
  }

  /**
   * Unfreeze escrow after dispute resolution
   */
  async unfreezeEscrow(params: UnfreezeEscrowParams): Promise<EscrowAccountSummary> {
    this.logger.info({ params }, '[EscrowService] Unfreezing escrow');

    // Get escrow account
    const escrowAccount = await this.escrowRepository.findAccountByContractId(params.contractId);
    if (!escrowAccount) {
      throw new EscrowError(
        'Escrow account not found',
        EscrowErrorCodes.ESCROW_ACCOUNT_NOT_FOUND,
        404
      );
    }

    const unfreezeAmount = params.amount ?? Number(escrowAccount.disputedBalance);

    // Create unhold transaction
    await this.escrowRepository.createTransaction({
      escrowAccountId: escrowAccount.id,
      contractId: params.contractId,
      transactionType: 'UNHOLD',
      amount: unfreezeAmount,
      disputeId: params.disputeId,
      currency: escrowAccount.currency,
      description: `Funds released from dispute: ${params.disputeId}`,
    });

    // Update escrow balance
    await this.escrowRepository.updateAccountBalance(params.contractId, {
      disputedBalance: { decrement: unfreezeAmount },
      status: Number(escrowAccount.disputedBalance) - unfreezeAmount <= 0 ? 'ACTIVE' : 'DISPUTED',
    });

    // Get updated account
    const updatedAccount = await this.escrowRepository.findAccountByContractId(params.contractId);
    const contract = await this.contractRepository.findById(params.contractId);

    return this.mapAccountToSummary(updatedAccount!, contract!);
  }

  /**
   * Resolve a dispute with fund distribution
   */
  async resolveDispute(params: ResolveDisputeParams): Promise<{
    refundTransaction?: EscrowTransactionSummary;
    releaseTransaction?: EscrowTransactionSummary;
    escrowAccount: EscrowAccountSummary;
  }> {
    this.logger.info({ params }, '[EscrowService] Resolving dispute');

    // Get dispute
    const dispute = await this.prisma.contractDispute.findUnique({
      where: { id: params.disputeId },
      include: { contract: true },
    });

    if (!dispute) {
      throw new EscrowError('Dispute not found', 'DISPUTE_NOT_FOUND', 404);
    }

    let refundTransaction: EscrowTransactionSummary | undefined;
    let releaseTransaction: EscrowTransactionSummary | undefined;

    // Handle refund to client
    if (params.clientRefundAmount && params.clientRefundAmount > 0) {
      const result = await this.refundEscrow({
        contractId: dispute.contractId,
        initiatedBy: params.resolvedBy,
        amount: params.clientRefundAmount,
        reason: `Dispute resolution: ${params.resolutionNotes ?? params.resolution}`,
      });
      refundTransaction = result.transaction;
    }

    // Handle payout to freelancer
    if (params.freelancerPayoutAmount && params.freelancerPayoutAmount > 0) {
      const result = await this.releaseEscrow({
        contractId: dispute.contractId,
        clientUserId: dispute.contract.clientUserId,
        amount: params.freelancerPayoutAmount,
        notes: `Dispute resolution: ${params.resolutionNotes ?? params.resolution}`,
      });
      releaseTransaction = result.transaction;
    }

    // Unfreeze any remaining disputed balance
    await this.unfreezeEscrow({
      contractId: dispute.contractId,
      disputeId: params.disputeId,
    });

    // Update dispute
    await this.prisma.contractDispute.update({
      where: { id: params.disputeId },
      data: {
        status: 'RESOLVED',
        resolution: params.resolution,
        resolvedBy: params.resolvedBy,
        resolvedAt: new Date(),
        resolutionNotes: params.resolutionNotes ?? null,
        clientRefundAmount: params.clientRefundAmount
          ? new Prisma.Decimal(params.clientRefundAmount)
          : null,
        freelancerPayoutAmount: params.freelancerPayoutAmount
          ? new Prisma.Decimal(params.freelancerPayoutAmount)
          : null,
        updatedAt: new Date(),
      },
    });

    // Get updated escrow account
    const updatedAccount = await this.escrowRepository.findAccountByContractId(dispute.contractId);
    const contract = await this.contractRepository.findById(dispute.contractId);

    return {
      ...(refundTransaction && { refundTransaction }),
      ...(releaseTransaction && { releaseTransaction }),
      escrowAccount: this.mapAccountToSummary(updatedAccount!, contract!),
    };
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get escrow account summary for a contract
   */
  async getEscrowSummary(contractId: string): Promise<EscrowAccountSummary | null> {
    const escrowAccount = await this.escrowRepository.findAccountByContractId(contractId);
    if (!escrowAccount) {
      return null;
    }

    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      return null;
    }

    return this.mapAccountToSummary(escrowAccount, contract);
  }

  /**
   * Get escrow transactions for a contract
   */
  async getTransactions(
    contractId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<EscrowTransactionSummary[]> {
    const transactions = await this.escrowRepository.getTransactionsByContractId(
      contractId,
      options
    );
    return transactions.map((t) => this.mapTransactionToSummary(t));
  }

  /**
   * Get escrow statistics for a contract
   */
  async getEscrowStats(contractId: string) {
    return this.escrowRepository.getContractEscrowStats(contractId);
  }

  // ===========================================================================
  // WEBHOOK HANDLERS
  // ===========================================================================

  /**
   * Handle Stripe payment intent succeeded
   */
  async handlePaymentIntentSucceeded(paymentIntentId: string): Promise<void> {
    const transaction =
      await this.escrowRepository.findTransactionByPaymentIntentId(paymentIntentId);

    if (transaction?.transactionType !== 'FUND') {
      this.logger.warn({ paymentIntentId }, 'Payment intent not found or not a fund transaction');
      return;
    }

    // Capture the payment
    try {
      await this.stripeService.capturePaymentIntent({ paymentIntentId });

      // Update transaction status
      await this.escrowRepository.updateTransaction(transaction.id, {
        status: 'CAPTURED',
        processedAt: new Date(),
      });

      // Update escrow balance if not already done
      if (transaction.status === 'PROCESSING') {
        await this.handleFundingCaptureReady(
          transaction.escrowAccountId,
          transaction.contractId,
          Number(transaction.amount),
          transaction.milestoneId ?? undefined
        );
      }

      this.logger.info({ transactionId: transaction.id }, 'Payment captured successfully');
    } catch (error) {
      this.logger.error({ error, transactionId: transaction.id }, 'Failed to capture payment');
      throw error;
    }
  }

  /**
   * Handle Stripe payment intent failed
   */
  async handlePaymentIntentFailed(
    paymentIntentId: string,
    failureCode?: string,
    failureMessage?: string
  ): Promise<void> {
    const transaction =
      await this.escrowRepository.findTransactionByPaymentIntentId(paymentIntentId);

    if (!transaction) {
      this.logger.warn({ paymentIntentId }, 'Payment intent not found');
      return;
    }

    // Update transaction as failed
    await this.escrowRepository.updateTransaction(transaction.id, {
      status: 'FAILED',
      ...(failureCode && { failureCode }),
      ...(failureMessage && { failureMessage }),
    });

    this.logger.info(
      { transactionId: transaction.id, failureCode },
      'Payment intent failed, transaction updated'
    );
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapTransactionToSummary(transaction: any): EscrowTransactionSummary {
    return {
      id: transaction.id,
      transactionType: transaction.transactionType,
      status: transaction.status,
      amount: Number(transaction.amount),
      platformFee: Number(transaction.platformFee),
      processingFee: Number(transaction.processingFee),
      netAmount: Number(transaction.netAmount),
      currency: transaction.currency,
      milestoneId: transaction.milestoneId,
      milestoneTitle: transaction.milestone?.title,
      invoiceId: transaction.invoiceId,
      invoiceNumber: transaction.invoice?.invoiceNumber,
      description: transaction.description,
      stripePaymentIntentId: transaction.stripePaymentIntentId,
      createdAt: transaction.createdAt,
      processedAt: transaction.processedAt,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapAccountToSummary(account: any, contract: any): EscrowAccountSummary {
    return {
      id: account.id,
      contractId: account.contractId,
      balance: Number(account.balance),
      pendingBalance: Number(account.pendingBalance),
      releasedBalance: Number(account.releasedBalance),
      refundedBalance: Number(account.refundedBalance),
      disputedBalance: Number(account.disputedBalance),
      availableBalance: Number(account.balance) - Number(account.disputedBalance),
      currency: account.currency,
      status: account.status,
      contract: {
        id: contract.id,
        title: contract.title,
        contractNumber: contract.contractNumber,
        status: contract.status,
        clientUserId: contract.clientUserId,
        freelancerUserId: contract.freelancerUserId,
      },
    };
  }
}
