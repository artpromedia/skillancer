// @ts-nocheck - Known type issues pending refactor
/**
 * @module @skillancer/billing-svc/services/milestone
 * Milestone management service for escrow-based contracts
 */

import { createLogger } from '@skillancer/logger';

const logger = createLogger({ serviceName: 'milestone-service' });

import { getEscrowService } from './escrow.service.js';
import { BillingError } from '../errors/index.js';
import {
  getMilestoneRepository,
  getContractRepository,
} from '../repositories/escrow.repository.js';

import type {
  CreateMilestoneParams,
  UpdateMilestoneParams,
  SubmitMilestoneParams,
  ApproveMilestoneParams,
  RequestRevisionParams,
  MilestoneWithContract,
} from '../types/escrow.types.js';

// =============================================================================
// MILESTONE SERVICE CLASS
// =============================================================================

export class MilestoneService {
  private get milestoneRepository() {
    return getMilestoneRepository();
  }

  private get contractRepository() {
    return getContractRepository();
  }

  private get escrowService() {
    return getEscrowService();
  }

  // ===========================================================================
  // MILESTONE CRUD
  // ===========================================================================

  /**
   * Create a new milestone
   */
  async createMilestone(params: CreateMilestoneParams): Promise<MilestoneWithContract> {
    logger.info({ params }, '[MilestoneService] Creating milestone');

    // Validate contract exists
    const contract = await this.contractRepository.findById(params.contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Can only add milestones to pending or active contracts
    if (!['PENDING', 'PENDING_FUNDING', 'ACTIVE'].includes(contract.status)) {
      throw new BillingError('Cannot add milestones to this contract', 'INVALID_CONTRACT_STATUS');
    }

    const milestone = await this.milestoneRepository.create({
      contractId: params.contractId,
      title: params.title,
      description: params.description,
      amount: params.amount,
      dueDate: params.dueDate,
      sortOrder: params.sortOrder,
      maxRevisions: params.maxRevisions,
    });

    // Re-fetch with contract
    const result = await this.milestoneRepository.findById(milestone.id);
    if (!result) {
      throw new BillingError('Failed to create milestone', 'CREATE_FAILED');
    }

    logger.info({ milestoneId: milestone.id }, '[MilestoneService] Milestone created');
    return result as MilestoneWithContract;
  }

  /**
   * Update milestone details
   */
  async updateMilestone(
    milestoneId: string,
    userId: string,
    params: UpdateMilestoneParams
  ): Promise<MilestoneWithContract> {
    logger.info({ milestoneId, params }, '[MilestoneService] Updating milestone');

    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Only client or freelancer can update
    if (milestone.contract.clientId !== userId && milestone.contract.freelancerId !== userId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    // Can only update pending milestones
    if (milestone.status !== 'PENDING') {
      throw new BillingError('Can only update pending milestones', 'INVALID_MILESTONE_STATUS');
    }

    await this.milestoneRepository.update(milestoneId, {
      title: params.title,
      description: params.description,
      amount: params.amount,
      dueDate: params.dueDate,
      maxRevisions: params.maxRevisions,
    });

    const result = await this.milestoneRepository.findById(milestoneId);
    logger.info({ milestoneId }, '[MilestoneService] Milestone updated');
    return result as MilestoneWithContract;
  }

  /**
   * Delete a milestone
   */
  async deleteMilestone(milestoneId: string, userId: string): Promise<void> {
    logger.info({ milestoneId }, '[MilestoneService] Deleting milestone');

    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Only client can delete
    if (milestone.contract.clientId !== userId) {
      throw new BillingError('Only client can delete milestones', 'NOT_AUTHORIZED');
    }

    // Can only delete pending unfunded milestones
    if (milestone.status !== 'PENDING' || milestone.escrowFunded) {
      throw new BillingError(
        'Can only delete pending unfunded milestones',
        'INVALID_MILESTONE_STATUS'
      );
    }

    await this.milestoneRepository.delete(milestoneId);
    logger.info({ milestoneId }, '[MilestoneService] Milestone deleted');
  }

  /**
   * Get milestone by ID
   */
  async getMilestone(milestoneId: string, userId: string): Promise<MilestoneWithContract> {
    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Validate access
    if (milestone.contract.clientId !== userId && milestone.contract.freelancerId !== userId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    return milestone as MilestoneWithContract;
  }

  /**
   * Get milestone status (alias for getMilestone)
   */
  async getMilestoneStatus(milestoneId: string, userId: string): Promise<MilestoneWithContract> {
    return this.getMilestone(milestoneId, userId);
  }

  /**
   * Get all milestones for a contract
   */
  async getMilestonesByContract(contractId: string, userId: string) {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new BillingError('Contract not found', 'CONTRACT_NOT_FOUND');
    }

    // Validate access
    if (contract.clientId !== userId && contract.freelancerId !== userId) {
      throw new BillingError('Not authorized', 'NOT_AUTHORIZED');
    }

    return this.milestoneRepository.findByContractId(contractId);
  }

  // ===========================================================================
  // MILESTONE WORKFLOW
  // ===========================================================================

  /**
   * Start working on a milestone (freelancer)
   */
  async startMilestone(
    milestoneId: string,
    freelancerUserId: string
  ): Promise<MilestoneWithContract> {
    logger.info({ milestoneId }, '[MilestoneService] Starting milestone');

    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Validate freelancer
    if (milestone.contract.freelancerId !== freelancerUserId) {
      throw new BillingError('Only freelancer can start milestone', 'NOT_AUTHORIZED');
    }

    // Must be pending
    if (milestone.status !== 'PENDING') {
      throw new BillingError('Milestone is not pending', 'INVALID_MILESTONE_STATUS');
    }

    // Must be funded
    if (!milestone.escrowFunded) {
      throw new BillingError('Escrow must be funded before starting', 'ESCROW_NOT_FUNDED');
    }

    await this.milestoneRepository.update(milestoneId, {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });

    const result = await this.milestoneRepository.findById(milestoneId);
    logger.info({ milestoneId }, '[MilestoneService] Milestone started');
    return result as MilestoneWithContract;
  }

  /**
   * Submit milestone for review (freelancer)
   */
  async submitMilestone(params: SubmitMilestoneParams): Promise<MilestoneWithContract> {
    logger.info({ params }, '[MilestoneService] Submitting milestone');

    const milestone = await this.milestoneRepository.findById(params.milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Validate freelancer
    if (milestone.contract.freelancerId !== params.freelancerUserId) {
      throw new BillingError('Only freelancer can submit milestone', 'NOT_AUTHORIZED');
    }

    // Must be in progress or revision requested
    if (!['IN_PROGRESS', 'REVISION_REQUESTED'].includes(milestone.status)) {
      throw new BillingError('Milestone must be in progress to submit', 'INVALID_MILESTONE_STATUS');
    }

    // Must have escrow funded
    if (!milestone.escrowFunded) {
      throw new BillingError('Escrow must be funded before submitting', 'ESCROW_NOT_FUNDED');
    }

    await this.milestoneRepository.update(params.milestoneId, {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      deliverables: params.deliverables,
      deliverableUrls: params.deliverableUrls ?? [],
    });

    const result = await this.milestoneRepository.findById(params.milestoneId);
    logger.info({ milestoneId: params.milestoneId }, '[MilestoneService] Milestone submitted');
    return result as MilestoneWithContract;
  }

  /**
   * Approve milestone (client)
   */
  async approveMilestone(params: ApproveMilestoneParams): Promise<MilestoneWithContract> {
    logger.info({ params }, '[MilestoneService] Approving milestone');

    const milestone = await this.milestoneRepository.findById(params.milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Validate client
    if (milestone.contract.clientId !== params.clientUserId) {
      throw new BillingError('Only client can approve milestone', 'NOT_AUTHORIZED');
    }

    // Must be submitted
    if (milestone.status !== 'SUBMITTED') {
      throw new BillingError('Milestone must be submitted to approve', 'INVALID_MILESTONE_STATUS');
    }

    await this.milestoneRepository.update(params.milestoneId, {
      status: 'APPROVED',
      approvedAt: new Date(),
    });

    const result = await this.milestoneRepository.findById(params.milestoneId);
    logger.info({ milestoneId: params.milestoneId }, '[MilestoneService] Milestone approved');
    return result as MilestoneWithContract;
  }

  /**
   * Request revision (client)
   */
  async requestRevision(params: RequestRevisionParams): Promise<MilestoneWithContract> {
    logger.info({ params }, '[MilestoneService] Requesting revision');

    const milestone = await this.milestoneRepository.findById(params.milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Validate client
    if (milestone.contract.clientId !== params.clientUserId) {
      throw new BillingError('Only client can request revision', 'NOT_AUTHORIZED');
    }

    // Must be submitted
    if (milestone.status !== 'SUBMITTED') {
      throw new BillingError(
        'Milestone must be submitted to request revision',
        'INVALID_MILESTONE_STATUS'
      );
    }

    // Check max revisions
    if (milestone.revisionCount >= milestone.maxRevisions) {
      throw new BillingError(
        `Maximum revisions (${milestone.maxRevisions}) reached. Please approve or raise a dispute.`,
        'MAX_REVISIONS_REACHED'
      );
    }

    await this.milestoneRepository.update(params.milestoneId, {
      status: 'REVISION_REQUESTED',
      revisionCount: { increment: 1 },
      // Store feedback in deliverables for now (could add a separate field)
      deliverables: `REVISION REQUESTED: ${params.feedback}\n\n${milestone.deliverables ?? ''}`,
    });

    const result = await this.milestoneRepository.findById(params.milestoneId);
    logger.info(
      { milestoneId: params.milestoneId, revisionCount: milestone.revisionCount + 1 },
      '[MilestoneService] Revision requested'
    );
    return result as MilestoneWithContract;
  }

  /**
   * Auto-approve milestone (called by scheduled job)
   */
  async autoApprove(milestoneId: string, reason: string): Promise<MilestoneWithContract> {
    logger.info({ milestoneId, reason }, '[MilestoneService] Auto-approving milestone');

    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Must be submitted
    if (milestone.status !== 'SUBMITTED') {
      throw new BillingError(
        'Milestone must be submitted to auto-approve',
        'INVALID_MILESTONE_STATUS'
      );
    }

    await this.milestoneRepository.update(milestoneId, {
      status: 'APPROVED',
      approvedAt: new Date(),
      deliverables: `${milestone.deliverables ?? ''}\n\n[AUTO-APPROVED: ${reason}]`,
    });

    const result = await this.milestoneRepository.findById(milestoneId);
    logger.info({ milestoneId }, '[MilestoneService] Milestone auto-approved');
    return result as MilestoneWithContract;
  }

  /**
   * Approve and release milestone in one action
   */
  async approveAndRelease(params: ApproveMilestoneParams): Promise<{
    milestone: MilestoneWithContract;
    transaction: unknown;
  }> {
    logger.info({ params }, '[MilestoneService] Approving and releasing milestone');

    // First approve
    const milestone = await this.approveMilestone(params);

    // Then release escrow
    const releaseResult = await this.escrowService.releaseEscrow({
      contractId: milestone.contractId,
      milestoneId: params.milestoneId,
      clientUserId: params.clientUserId,
    });

    // Re-fetch milestone with updated status
    const result = await this.milestoneRepository.findById(params.milestoneId);

    logger.info(
      { milestoneId: params.milestoneId },
      '[MilestoneService] Milestone approved and released'
    );

    return {
      milestone: result as MilestoneWithContract,
      transaction: releaseResult.transaction,
    };
  }

  /**
   * Get all milestones for a contract
   * Alias for getMilestonesByContract
   */
  async getContractMilestones(contractId: string, userId: string) {
    return this.getMilestonesByContract(contractId, userId);
  }

  /**
   * Release milestone funds (client only)
   */
  async releaseMilestone(milestoneId: string, clientUserId: string) {
    logger.info({ milestoneId }, '[MilestoneService] Releasing milestone funds');

    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Validate client
    if (milestone.contract.clientId !== clientUserId) {
      throw new BillingError('Only client can release milestone funds', 'NOT_AUTHORIZED');
    }

    // Must be approved
    if (milestone.status !== 'APPROVED') {
      throw new BillingError(
        'Milestone must be approved before releasing funds',
        'INVALID_MILESTONE_STATUS'
      );
    }

    // Must have escrow funded
    if (!milestone.escrowFunded) {
      throw new BillingError('Escrow not funded for this milestone', 'ESCROW_NOT_FUNDED');
    }

    // Release escrow
    const releaseResult = await this.escrowService.releaseEscrow({
      contractId: milestone.contractId,
      milestoneId,
      clientUserId,
    });

    // Update milestone status
    await this.milestoneRepository.update(milestoneId, {
      status: 'RELEASED',
      escrowReleasedAt: new Date(),
    });

    const result = await this.milestoneRepository.findById(milestoneId);
    logger.info({ milestoneId }, '[MilestoneService] Milestone funds released');

    return {
      milestone: result as MilestoneWithContract,
      transaction: releaseResult.transaction,
    };
  }

  /**
   * Fund a milestone
   */
  async fundMilestone(milestoneId: string, paymentMethodId: string, clientUserId: string) {
    logger.info({ milestoneId }, '[MilestoneService] Funding milestone');

    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Only client can fund
    if (milestone.contract.clientId !== clientUserId) {
      throw new BillingError('Only client can fund milestones', 'NOT_AUTHORIZED');
    }

    // Cannot fund already funded milestones
    if (milestone.escrowFunded) {
      throw new BillingError('Milestone already funded', 'ALREADY_FUNDED');
    }

    // Fund escrow
    const result = await this.escrowService.fundEscrow({
      contractId: milestone.contractId,
      milestoneId,
      amount: Number(milestone.amount),
      paymentMethodId,
      clientUserId,
    });

    // Update milestone as funded
    await this.milestoneRepository.update(milestoneId, {
      escrowFunded: true,
      escrowFundedAt: new Date(),
      status: 'IN_PROGRESS',
    });

    // Update contract status if needed
    const contract = await this.contractRepository.findById(milestone.contractId);
    if (contract && contract.status === 'PENDING_FUNDING') {
      await this.contractRepository.update(milestone.contractId, {
        status: 'ACTIVE',
      });
    }

    logger.info({ milestoneId }, '[MilestoneService] Milestone funded');
    return result;
  }

  /**
   * Mark milestone as disputed
   */
  async markAsDisputed(milestoneId: string): Promise<void> {
    logger.info({ milestoneId }, '[MilestoneService] Marking milestone as disputed');

    await this.milestoneRepository.update(milestoneId, {
      status: 'DISPUTED',
    });

    logger.info({ milestoneId }, '[MilestoneService] Milestone marked as disputed');
  }

  /**
   * Cancel milestone
   */
  async cancelMilestone(milestoneId: string, userId: string): Promise<MilestoneWithContract> {
    logger.info({ milestoneId }, '[MilestoneService] Cancelling milestone');

    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone) {
      throw new BillingError('Milestone not found', 'MILESTONE_NOT_FOUND');
    }

    // Only client can cancel
    if (milestone.contract.clientId !== userId) {
      throw new BillingError('Only client can cancel milestone', 'NOT_AUTHORIZED');
    }

    // Cannot cancel released or disputed milestones
    if (['RELEASED', 'PAID', 'DISPUTED'].includes(milestone.status)) {
      throw new BillingError('Cannot cancel this milestone', 'INVALID_MILESTONE_STATUS');
    }

    // If funded, need to refund
    if (milestone.escrowFunded && !milestone.escrowReleasedAt) {
      await this.escrowService.refundEscrow({
        contractId: milestone.contractId,
        milestoneId,
        reason: 'Milestone cancelled',
        initiatedBy: userId,
      });
    }

    await this.milestoneRepository.update(milestoneId, {
      status: 'CANCELLED',
    });

    const result = await this.milestoneRepository.findById(milestoneId);
    logger.info({ milestoneId }, '[MilestoneService] Milestone cancelled');
    return result as MilestoneWithContract;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let milestoneServiceInstance: MilestoneService | null = null;

export function getMilestoneService(): MilestoneService {
  milestoneServiceInstance ??= new MilestoneService();
  return milestoneServiceInstance;
}

export function resetMilestoneService(): void {
  milestoneServiceInstance = null;
}
