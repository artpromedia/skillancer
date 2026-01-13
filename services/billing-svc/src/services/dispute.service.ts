// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/services/dispute
 * Dispute management service for escrow-based contracts
 */

import { createLogger } from '../lib/logger.js';

const logger = createLogger({ serviceName: 'dispute-service' });

import { getEscrowService } from './escrow.service.js';
import { getFeeCalculatorService } from './fee-calculator.service.js';
import { getMilestoneService } from './milestone.service.js';
import { BillingError } from '../errors/index.js';
import {
  getDisputeRepository,
  getContractRepository,
  getEscrowRepository,
} from '../repositories/escrow.repository.js';

import type {
  CreateDisputeParams,
  RespondToDisputeParams,
  ResolveDisputeParams,
  EscalateDisputeParams,
  AcceptResolutionParams,
  DisputeWithMessages,
  EscrowTransactionSummary,
  DisputeRole,
} from '../types/escrow.types.js';

// =============================================================================
// DISPUTE SERVICE CLASS
// =============================================================================

export class DisputeService {
  private get disputeRepository() {
    return getDisputeRepository();
  }

  private get contractRepository() {
    return getContractRepository();
  }

  private get escrowRepository() {
    return getEscrowRepository();
  }

  private get escrowService() {
    return getEscrowService();
  }

  private get milestoneService() {
    return getMilestoneService();
  }

  private get feeCalculator() {
    return getFeeCalculatorService();
  }

  // ===========================================================================
  // CREATE DISPUTE
  // ===========================================================================

  /**
   * Create a new dispute
   */
  async createDispute(params: CreateDisputeParams): Promise<DisputeWithMessages> {
    logger.info({ params }, '[DisputeService] Creating dispute');

    // Validate contract
    const contract = await this.contractRepository.findById(params.contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Validate user is party to contract
    if (contract.clientId !== params.raisedBy && contract.freelancerId !== params.raisedBy) {
      throw new BillingError('Not authorized to raise dispute', 'NOT_AUTHORIZED');
    }

    // Check for existing active dispute
    const existingDispute = await this.disputeRepository.findActiveByContract(params.contractId);
    if (existingDispute) {
      throw new BillingError(
        'An active dispute already exists for this contract',
        'DISPUTE_EXISTS'
      );
    }

    // Validate disputed amount against escrow balance
    const escrowBalance = await this.escrowRepository.getBalance(params.contractId);
    if (escrowBalance) {
      const availableBalance =
        Number(escrowBalance.currentBalance) - Number(escrowBalance.frozenAmount);
      if (params.disputedAmount > availableBalance) {
        throw new BillingError(
          `Disputed amount exceeds available escrow balance (${availableBalance})`,
          'INVALID_DISPUTED_AMOUNT'
        );
      }
    }

    // Create dispute
    const dispute = await this.disputeRepository.create({
      contractId: params.contractId,
      milestoneId: params.milestoneId,
      raisedBy: params.raisedBy,
      reason: params.reason,
      description: params.description,
      evidenceUrls: params.evidenceUrls,
      disputedAmount: params.disputedAmount,
      currency: contract.currency,
      respondBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Freeze escrow
    await this.escrowService.freezeEscrow({
      contractId: params.contractId,
      disputeId: dispute.id,
      amount: params.disputedAmount,
    });

    // Mark milestone as disputed if applicable
    if (params.milestoneId) {
      await this.milestoneService.markAsDisputed(params.milestoneId);
    }

    // Add initial message
    const senderRole = contract.clientId === params.raisedBy ? 'CLIENT' : 'FREELANCER';
    await this.disputeRepository.addMessage({
      disputeId: dispute.id,
      senderId: params.raisedBy,
      senderRole,
      message: params.description,
      attachmentUrls: params.evidenceUrls,
    });

    // Fetch with messages
    const result = await this.disputeRepository.findById(dispute.id);
    logger.info({ disputeId: dispute.id }, '[DisputeService] Dispute created');

    return result as DisputeWithMessages;
  }

  // ===========================================================================
  // RESPOND TO DISPUTE
  // ===========================================================================

  /**
   * Respond to a dispute
   */
  async respondToDispute(params: RespondToDisputeParams): Promise<DisputeWithMessages> {
    logger.info({ params }, '[DisputeService] Responding to dispute');

    const dispute = await this.disputeRepository.findById(params.disputeId);
    if (!dispute) {
      throw new BillingError('Dispute not found', 'DISPUTE_NOT_FOUND');
    }

    // Validate user is party to contract
    if (
      dispute.contract.clientId !== params.responderId &&
      dispute.contract.freelancerId !== params.responderId
    ) {
      throw new BillingError('Not authorized to respond to dispute', 'NOT_AUTHORIZED');
    }

    // Cannot respond if already resolved
    if (['RESOLVED', 'CLOSED'].includes(dispute.status)) {
      throw new BillingError('Dispute is already resolved', 'DISPUTE_RESOLVED');
    }

    // Determine sender role
    let senderRole: DisputeRole = 'CLIENT';
    if (dispute.contract.freelancerId === params.responderId) {
      senderRole = 'FREELANCER';
    }

    // Add message
    await this.disputeRepository.addMessage({
      disputeId: params.disputeId,
      senderId: params.responderId,
      senderRole,
      message: params.message,
      attachmentUrls: params.attachmentUrls,
      proposedResolution: params.proposedResolution?.type,
      proposedClientAmount: params.proposedResolution?.clientAmount,
      proposedFreelancerAmount: params.proposedResolution?.freelancerAmount,
    });

    // Update dispute status if first response
    if (dispute.status === 'OPEN') {
      await this.disputeRepository.update(params.disputeId, {
        status: 'RESPONDED',
        respondedAt: new Date(),
      });
    }

    const result = await this.disputeRepository.findById(params.disputeId);
    logger.info({ disputeId: params.disputeId }, '[DisputeService] Response added');

    return result as DisputeWithMessages;
  }

  // ===========================================================================
  // ACCEPT PROPOSED RESOLUTION
  // ===========================================================================

  /**
   * Accept a proposed resolution from the other party
   */
  async acceptResolution(params: AcceptResolutionParams): Promise<{
    dispute: DisputeWithMessages;
    transactions: EscrowTransactionSummary[];
  }> {
    logger.info({ params }, '[DisputeService] Accepting proposed resolution');

    const dispute = await this.disputeRepository.findById(params.disputeId);
    if (!dispute) {
      throw new BillingError('Dispute not found', 'DISPUTE_NOT_FOUND');
    }

    // Validate user is party to contract
    if (
      dispute.contract.clientId !== params.userId &&
      dispute.contract.freelancerId !== params.userId
    ) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    // Find the message with proposed resolution
    const message = await this.disputeRepository.findMessageById(params.messageId);
    if (!message || !message.proposedResolution) {
      throw new BillingError('Resolution proposal not found', 'PROPOSAL_NOT_FOUND');
    }

    // Cannot accept your own proposal
    if (message.senderId === params.userId) {
      throw new BillingError('Cannot accept your own proposal', 'CANNOT_ACCEPT_OWN');
    }

    // Resolve the dispute with the proposed amounts
    return this.resolveDispute({
      disputeId: params.disputeId,
      resolution: message.proposedResolution as never,
      clientRefundAmount: message.proposedClientAmount
        ? Number(message.proposedClientAmount)
        : undefined,
      freelancerPayoutAmount: message.proposedFreelancerAmount
        ? Number(message.proposedFreelancerAmount)
        : undefined,
      resolvedBy: params.userId,
      resolutionNotes: `Accepted proposal from ${message.senderRole.toLowerCase()}`,
    });
  }

  // ===========================================================================
  // ESCALATE DISPUTE
  // ===========================================================================

  /**
   * Escalate dispute to Skillancer mediation
   */
  async escalateDispute(params: EscalateDisputeParams): Promise<DisputeWithMessages> {
    logger.info({ params }, '[DisputeService] Escalating dispute');

    const dispute = await this.disputeRepository.findById(params.disputeId);
    if (!dispute) {
      throw new BillingError('Dispute not found', 'DISPUTE_NOT_FOUND');
    }

    // Validate user is party to contract
    if (
      dispute.contract.clientId !== params.userId &&
      dispute.contract.freelancerId !== params.userId
    ) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    // Can only escalate after response or 48 hours
    const hoursSinceCreation = (Date.now() - dispute.createdAt.getTime()) / (1000 * 60 * 60);
    if (dispute.status === 'OPEN' && hoursSinceCreation < 48) {
      throw new BillingError(
        'Can only escalate after 48 hours or after receiving a response',
        'TOO_EARLY_TO_ESCALATE'
      );
    }

    // Already escalated or resolved
    if (['ESCALATED', 'RESOLVED', 'CLOSED'].includes(dispute.status)) {
      throw new BillingError('Cannot escalate this dispute', 'INVALID_STATUS');
    }

    // Add system message
    await this.disputeRepository.addMessage({
      disputeId: params.disputeId,
      senderId: params.userId,
      senderRole: 'SYSTEM',
      message: `Dispute escalated to Skillancer mediation. Reason: ${params.reason}`,
    });

    // Update status
    await this.disputeRepository.update(params.disputeId, {
      status: 'ESCALATED',
      escalatedAt: new Date(),
    });

    const result = await this.disputeRepository.findById(params.disputeId);
    logger.info({ disputeId: params.disputeId }, '[DisputeService] Dispute escalated');

    return result as DisputeWithMessages;
  }

  // ===========================================================================
  // RESOLVE DISPUTE (Admin or automatic)
  // ===========================================================================

  /**
   * Resolve dispute with final decision
   */
  async resolveDispute(params: ResolveDisputeParams): Promise<{
    dispute: DisputeWithMessages;
    transactions: EscrowTransactionSummary[];
  }> {
    logger.info({ params }, '[DisputeService] Resolving dispute');

    const dispute = await this.disputeRepository.findById(params.disputeId);
    if (!dispute) {
      throw new BillingError('Dispute not found', 'DISPUTE_NOT_FOUND');
    }

    // Already resolved
    if (['RESOLVED', 'CLOSED'].includes(dispute.status)) {
      throw new BillingError('Dispute is already resolved', 'ALREADY_RESOLVED');
    }

    const contract = await this.contractRepository.findById(dispute.contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    const transactions: EscrowTransactionSummary[] = [];
    const disputedAmount = Number(dispute.disputedAmount);

    // Process based on resolution type
    switch (params.resolution) {
      case 'FULL_REFUND': {
        // Refund entire disputed amount to client
        const refundResult = await this.escrowService.refundEscrow({
          contractId: dispute.contractId,
          milestoneId: dispute.milestoneId ?? undefined,
          amount: disputedAmount,
          reason: `Dispute resolution: ${params.resolutionNotes}`,
          initiatedBy: params.resolvedBy,
        });
        transactions.push(refundResult.transaction);
        break;
      }

      case 'FULL_RELEASE': {
        // Release entire disputed amount to freelancer
        const releaseResult = await this.escrowService.releaseEscrow({
          contractId: dispute.contractId,
          milestoneId: dispute.milestoneId ?? undefined,
          amount: disputedAmount,
          clientUserId: contract.clientId,
        });
        transactions.push(releaseResult.transaction);
        break;
      }

      case 'SPLIT':
      case 'PARTIAL_REFUND':
      case 'PARTIAL_RELEASE': {
        // Validate amounts provided
        const clientRefund = params.clientRefundAmount ?? 0;
        const freelancerPayout = params.freelancerPayoutAmount ?? 0;

        // Calculate platform fee on freelancer portion
        const fees = this.feeCalculator.calculateCustomSplit({
          totalAmount: disputedAmount,
          clientRefundAmount: clientRefund,
          platformFeePercent: Number(contract.platformFeePercent),
        });

        // Validate amounts add up (roughly - fees are taken from freelancer portion)
        if (Math.abs(clientRefund + freelancerPayout + fees.platformFee - disputedAmount) > 0.01) {
          // Allow for small rounding differences
          logger.warn(
            {
              clientRefund,
              freelancerPayout,
              platformFee: fees.platformFee,
              disputedAmount,
            },
            '[DisputeService] Split amounts do not match disputed amount'
          );
        }

        // Process refund if any
        if (clientRefund > 0) {
          const refundResult = await this.escrowService.refundEscrow({
            contractId: dispute.contractId,
            amount: clientRefund,
            reason: 'Partial refund from dispute resolution',
            initiatedBy: params.resolvedBy,
          });
          transactions.push(refundResult.transaction);
        }

        // Process release if any
        if (freelancerPayout > 0) {
          // First unfreeze the amount to be released
          await this.escrowService.unfreezeEscrow({
            contractId: dispute.contractId,
            amount: freelancerPayout + fees.platformFee,
          });

          const releaseResult = await this.escrowService.releaseEscrow({
            contractId: dispute.contractId,
            amount: freelancerPayout + fees.platformFee, // Gross amount (fee will be deducted)
            clientUserId: contract.clientId,
          });
          transactions.push(releaseResult.transaction);
        }
        break;
      }

      case 'CANCELLED': {
        // Cancel without any fund movement - just unfreeze
        await this.escrowService.unfreezeEscrow({
          contractId: dispute.contractId,
        });
        break;
      }
    }

    // Unfreeze any remaining frozen amount
    await this.escrowService.unfreezeEscrow({
      contractId: dispute.contractId,
    });

    // Update dispute
    await this.disputeRepository.update(params.disputeId, {
      status: 'RESOLVED',
      resolution: params.resolution,
      clientRefundAmount: params.clientRefundAmount,
      freelancerPayoutAmount: params.freelancerPayoutAmount,
      resolvedBy: params.resolvedBy,
      resolutionNotes: params.resolutionNotes,
      resolvedAt: new Date(),
    });

    // Add resolution message
    await this.disputeRepository.addMessage({
      disputeId: params.disputeId,
      senderId: params.resolvedBy,
      senderRole: 'MEDIATOR',
      message: `Dispute resolved: ${params.resolution}. ${params.resolutionNotes}`,
    });

    // Update contract status back to active if not completed
    const escrowBalance = await this.escrowRepository.getBalance(dispute.contractId);
    if (escrowBalance && Number(escrowBalance.currentBalance) > 0) {
      await this.contractRepository.update(dispute.contractId, {
        status: 'ACTIVE',
      });
    }

    const result = await this.disputeRepository.findById(params.disputeId);
    logger.info(
      { disputeId: params.disputeId, resolution: params.resolution },
      '[DisputeService] Dispute resolved'
    );

    return {
      dispute: result as DisputeWithMessages,
      transactions,
    };
  }

  // ===========================================================================
  // QUERY METHODS
  // ===========================================================================

  /**
   * Get dispute by ID
   */
  async getDispute(disputeId: string, userId: string): Promise<DisputeWithMessages> {
    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new BillingError('Dispute not found', 'DISPUTE_NOT_FOUND');
    }

    // Validate user has access
    if (
      dispute.contract.clientId !== userId &&
      dispute.contract.freelancerId !== userId &&
      dispute.raisedBy !== userId
    ) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    return dispute as DisputeWithMessages;
  }

  /**
   * Alias for createDispute - raise a new dispute
   */
  async raiseDispute(params: CreateDisputeParams): Promise<DisputeWithMessages> {
    return this.createDispute(params);
  }

  /**
   * Alias for getDispute - get dispute by ID
   */
  async getDisputeById(disputeId: string, userId: string): Promise<DisputeWithMessages> {
    return this.getDispute(disputeId, userId);
  }

  /**
   * Get all disputes for a contract
   */
  async getContractDisputes(contractId: string, userId: string) {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Validate access
    if (contract.clientId !== userId && contract.freelancerId !== userId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    return this.disputeRepository.findByContract(contractId);
  }

  /**
   * Get disputes for a user
   */
  async getUserDisputes(userId: string, status?: string) {
    return this.disputeRepository.findByUser(userId, status);
  }

  /**
   * Get active dispute for a contract
   */
  async getActiveDisputeByContract(contractId: string) {
    return this.disputeRepository.findActiveByContract(contractId);
  }

  /**
   * Close a resolved dispute
   */
  async closeDispute(disputeId: string, adminUserId: string): Promise<DisputeWithMessages> {
    logger.info({ disputeId, adminUserId }, '[DisputeService] Closing dispute');

    const dispute = await this.disputeRepository.findById(disputeId);
    if (!dispute) {
      throw new BillingError('Dispute not found', 'DISPUTE_NOT_FOUND');
    }

    if (dispute.status !== 'RESOLVED') {
      throw new BillingError('Can only close resolved disputes', 'INVALID_STATUS');
    }

    await this.disputeRepository.update(disputeId, {
      status: 'CLOSED',
    });

    const result = await this.disputeRepository.findById(disputeId);
    logger.info({ disputeId }, '[DisputeService] Dispute closed');

    return result as DisputeWithMessages;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let disputeServiceInstance: DisputeService | null = null;

export function getDisputeService(): DisputeService {
  disputeServiceInstance ??= new DisputeService();
  return disputeServiceInstance;
}

export function resetDisputeService(): void {
  disputeServiceInstance = null;
}
