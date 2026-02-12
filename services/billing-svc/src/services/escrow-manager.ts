// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/escrow-manager
 * Production-Grade Escrow Management Service
 *
 * Features:
 * - Secure fund holding with Stripe
 * - Multi-milestone escrow accounts
 * - Release conditions and approvals
 * - Dispute integration
 * - Automatic refunds on cancellation
 * - Partial releases
 * - Escrow fee handling
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { addDays } from 'date-fns';

import { billingNotifications } from './billing-notifications.js';
import { getPaymentOrchestrator } from './payment-orchestrator.js';
import { getStripe } from './stripe.service.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

export type EscrowStatus =
  | 'PENDING_DEPOSIT'
  | 'FUNDED'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'DISPUTED'
  | 'REFUNDED'
  | 'CANCELED';

export interface CreateEscrowRequest {
  contractId: string;
  clientId: string;
  freelancerId: string;
  totalAmount: number;
  currency: string;
  milestones: MilestoneConfig[];
  releaseType: 'AUTOMATIC' | 'APPROVAL_REQUIRED' | 'DUAL_APPROVAL';
  autoReleaseAfterDays?: number;
  platformFeePercent?: number;
}

export interface MilestoneConfig {
  name: string;
  description?: string;
  amount: number;
  dueDate?: Date;
  order: number;
}

export interface EscrowResult {
  success: boolean;
  escrowId: string;
  paymentUrl?: string;
  error?: string;
}

export interface ReleaseRequest {
  escrowId: string;
  milestoneId?: string;
  amount?: number;
  approvedBy: string;
  approvalType: 'CLIENT' | 'FREELANCER' | 'ADMIN' | 'SYSTEM';
  notes?: string;
}

export interface ReleaseResult {
  success: boolean;
  transferId?: string;
  amountReleased: number;
  remainingBalance: number;
  error?: string;
}

// =============================================================================
// ESCROW MANAGER CLASS
// =============================================================================

export class EscrowManager {
  private stripe: Stripe;
  private orchestrator = getPaymentOrchestrator();

  constructor() {
    this.stripe = getStripe();
  }

  /**
   * Create a new escrow account for a contract
   */
  async createEscrow(request: CreateEscrowRequest): Promise<EscrowResult> {
    logger.info(
      {
        contractId: request.contractId,
        totalAmount: request.totalAmount,
        milestoneCount: request.milestones.length,
      },
      'Creating escrow account'
    );

    try {
      // Validate milestones total matches contract amount
      const milestonesTotal = request.milestones.reduce((sum, m) => sum + m.amount, 0);
      if (milestonesTotal !== request.totalAmount) {
        throw new Error(
          `Milestone amounts (${milestonesTotal}) must equal total amount (${request.totalAmount})`
        );
      }

      // Calculate platform fee
      const platformFeePercent = request.platformFeePercent ?? 10; // Default 10%
      const platformFee = Math.round(request.totalAmount * (platformFeePercent / 100));
      const netAmount = request.totalAmount - platformFee;

      // Create escrow record
      const escrow = await prisma.escrow.create({
        data: {
          contractId: request.contractId,
          clientId: request.clientId,
          freelancerId: request.freelancerId,
          totalAmount: request.totalAmount,
          fundedAmount: 0,
          releasedAmount: 0,
          platformFee,
          netAmount,
          currency: request.currency.toUpperCase(),
          status: 'PENDING_DEPOSIT',
          releaseType: request.releaseType,
          autoReleaseAfterDays: request.autoReleaseAfterDays || null,
          milestones: {
            create: request.milestones.map((m, index) => ({
              name: m.name,
              description: m.description || null,
              amount: m.amount,
              dueDate: m.dueDate || null,
              order: m.order ?? index + 1,
              status: 'PENDING',
            })),
          },
        },
        include: {
          milestones: true,
        },
      });

      // Create Stripe PaymentIntent for funding
      const paymentResult = await this.orchestrator.createPayment({
        amount: request.totalAmount,
        currency: request.currency,
        customerId: request.clientId,
        captureMethod: 'automatic',
        confirmImmediately: false,
        description: `Escrow funding for contract ${request.contractId}`,
        metadata: {
          escrowId: escrow.id,
          contractId: request.contractId,
          type: 'escrow_funding',
        },
      });

      // Update escrow with payment reference
      await prisma.escrow.update({
        where: { id: escrow.id },
        data: {
          stripePaymentIntentId: paymentResult.stripePaymentIntentId,
        },
      });

      logger.info(
        {
          escrowId: escrow.id,
          paymentId: paymentResult.paymentId,
          milestones: escrow.milestones.length,
        },
        'Escrow created successfully'
      );

      return {
        success: true,
        escrowId: escrow.id,
        paymentUrl: paymentResult.clientSecret
          ? `/payment/confirm?client_secret=${paymentResult.clientSecret}`
          : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: errorMessage, contractId: request.contractId },
        'Failed to create escrow'
      );

      return {
        success: false,
        escrowId: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Mark escrow as funded (called by webhook)
   */
  async markFunded(escrowId: string, paymentIntentId: string): Promise<void> {
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
    });

    if (!escrow) {
      throw new Error(`Escrow ${escrowId} not found`);
    }

    if (escrow.status !== 'PENDING_DEPOSIT') {
      logger.warn(
        {
          escrowId,
          currentStatus: escrow.status,
        },
        'Escrow already funded or in invalid state'
      );
      return;
    }

    await prisma.escrow.update({
      where: { id: escrowId },
      data: {
        status: 'FUNDED',
        fundedAmount: escrow.totalAmount,
        fundedAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      },
    });

    // Activate first milestone
    await prisma.escrowMilestone.updateMany({
      where: {
        escrowId,
        order: 1,
      },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'ESCROW_FUNDED',
        resourceType: 'escrow',
        resourceId: escrowId,
        details: {
          amount: escrow.totalAmount,
          currency: escrow.currency,
          paymentIntentId,
        },
        ipAddress: 'system',
      },
    });

    logger.info(
      {
        escrowId,
        amount: escrow.totalAmount,
      },
      'Escrow funded successfully'
    );

    // Notify freelancer that escrow is funded
    await billingNotifications.notifyEscrowFunded(
      { userId: escrow.freelancerId },
      {
        contractId: escrow.contractId,
        contractTitle: escrow.contract?.title || 'Contract',
        amount: `$${(escrow.totalAmount / 100).toFixed(2)}`,
      }
    );
  }

  /**
   * Release funds from escrow
   */
  async releaseFunds(request: ReleaseRequest): Promise<ReleaseResult> {
    const escrow = await prisma.escrow.findUnique({
      where: { id: request.escrowId },
      include: {
        milestones: {
          orderBy: { order: 'asc' },
        },
        freelancer: true,
      },
    });

    if (!escrow) {
      return { success: false, amountReleased: 0, remainingBalance: 0, error: 'Escrow not found' };
    }

    if (!['FUNDED', 'PARTIALLY_RELEASED'].includes(escrow.status)) {
      return {
        success: false,
        amountReleased: 0,
        remainingBalance: 0,
        error: `Cannot release from escrow in ${escrow.status} status`,
      };
    }

    logger.info(
      {
        escrowId: request.escrowId,
        milestoneId: request.milestoneId,
        amount: request.amount,
        approvedBy: request.approvedBy,
      },
      'Processing escrow release'
    );

    try {
      let amountToRelease: number;
      let milestone: (typeof escrow.milestones)[0] | undefined;

      if (request.milestoneId) {
        // Release specific milestone
        milestone = escrow.milestones.find((m) => m.id === request.milestoneId);
        if (!milestone) {
          return {
            success: false,
            amountReleased: 0,
            remainingBalance: 0,
            error: 'Milestone not found',
          };
        }
        if (milestone.status === 'RELEASED') {
          return {
            success: false,
            amountReleased: 0,
            remainingBalance: 0,
            error: 'Milestone already released',
          };
        }
        amountToRelease = milestone.amount;
      } else if (request.amount) {
        // Release specific amount
        amountToRelease = request.amount;
      } else {
        return {
          success: false,
          amountReleased: 0,
          remainingBalance: 0,
          error: 'Must specify milestone or amount',
        };
      }

      // Check available balance
      const availableBalance = escrow.fundedAmount - escrow.releasedAmount;
      if (amountToRelease > availableBalance) {
        return {
          success: false,
          amountReleased: 0,
          remainingBalance: availableBalance,
          error: `Insufficient balance. Available: ${availableBalance}, Requested: ${amountToRelease}`,
        };
      }

      // Check release conditions
      const canRelease = await this.checkReleaseConditions(escrow, request);
      if (!canRelease.allowed) {
        return {
          success: false,
          amountReleased: 0,
          remainingBalance: availableBalance,
          error: canRelease.reason,
        };
      }

      // Calculate net amount (minus platform fee portion)
      const feeRatio = escrow.platformFee / escrow.totalAmount;
      const releaseNetAmount = Math.round(amountToRelease * (1 - feeRatio));
      const releaseFee = amountToRelease - releaseNetAmount;

      // Get freelancer's connected account
      const freelancerAccount = await prisma.stripeConnectedAccount.findFirst({
        where: { userId: escrow.freelancerId, status: 'ACTIVE' },
      });

      if (!freelancerAccount) {
        return {
          success: false,
          amountReleased: 0,
          remainingBalance: availableBalance,
          error: 'Freelancer does not have an active Stripe connected account',
        };
      }

      // Create transfer to freelancer
      const transfer = await this.stripe.transfers.create({
        amount: releaseNetAmount,
        currency: escrow.currency.toLowerCase(),
        destination: freelancerAccount.stripeAccountId,
        metadata: {
          escrowId: escrow.id,
          milestoneId: milestone?.id || '',
          contractId: escrow.contractId,
          type: 'escrow_release',
        },
      });

      // Update escrow and milestone
      const newReleasedAmount = escrow.releasedAmount + amountToRelease;
      const newStatus =
        newReleasedAmount >= escrow.fundedAmount ? 'RELEASED' : 'PARTIALLY_RELEASED';

      await prisma.$transaction([
        prisma.escrow.update({
          where: { id: escrow.id },
          data: {
            releasedAmount: newReleasedAmount,
            status: newStatus,
            lastReleaseAt: new Date(),
          },
        }),
        // Update milestone if applicable
        ...(milestone
          ? [
              prisma.escrowMilestone.update({
                where: { id: milestone.id },
                data: {
                  status: 'RELEASED',
                  releasedAt: new Date(),
                  stripeTransferId: transfer.id,
                },
              }),
            ]
          : []),
        // Create release record
        prisma.escrowRelease.create({
          data: {
            escrowId: escrow.id,
            milestoneId: milestone?.id || null,
            grossAmount: amountToRelease,
            netAmount: releaseNetAmount,
            platformFee: releaseFee,
            stripeTransferId: transfer.id,
            approvedBy: request.approvedBy,
            approvalType: request.approvalType,
            notes: request.notes || null,
          },
        }),
        // Activate next milestone if applicable
        ...(milestone
          ? [
              prisma.escrowMilestone.updateMany({
                where: {
                  escrowId: escrow.id,
                  order: milestone.order + 1,
                  status: 'PENDING',
                },
                data: {
                  status: 'ACTIVE',
                  activatedAt: new Date(),
                },
              }),
            ]
          : []),
        // Audit log
        prisma.auditLog.create({
          data: {
            action: 'ESCROW_RELEASED',
            resourceType: 'escrow',
            resourceId: escrow.id,
            userId: request.approvedBy,
            details: {
              milestoneId: milestone?.id,
              grossAmount: amountToRelease,
              netAmount: releaseNetAmount,
              fee: releaseFee,
              transferId: transfer.id,
            },
            ipAddress: 'system',
          },
        }),
      ]);

      const remainingBalance = escrow.fundedAmount - newReleasedAmount;

      logger.info(
        {
          escrowId: escrow.id,
          milestoneId: milestone?.id,
          amountReleased: amountToRelease,
          netToFreelancer: releaseNetAmount,
          remainingBalance,
          transferId: transfer.id,
        },
        'Escrow funds released successfully'
      );

      // Notify freelancer about payment release
      await billingNotifications.notifyPaymentReceived(
        { userId: escrow.freelancerId, email: escrow.freelancer?.email },
        {
          amount: `$${(releaseNetAmount / 100).toFixed(2)}`,
          description: milestone?.name || 'Milestone payment',
          contractTitle: escrow.contract?.title,
        }
      );

      return {
        success: true,
        transferId: transfer.id,
        amountReleased: amountToRelease,
        remainingBalance,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { escrowId: request.escrowId, error: errorMessage },
        'Failed to release escrow funds'
      );

      return {
        success: false,
        amountReleased: 0,
        remainingBalance: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Refund escrow to client
   */
  async refundToClient(
    escrowId: string,
    reason: string,
    refundedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
    });

    if (!escrow) {
      return { success: false, error: 'Escrow not found' };
    }

    if (!['FUNDED', 'PARTIALLY_RELEASED'].includes(escrow.status)) {
      return { success: false, error: `Cannot refund escrow in ${escrow.status} status` };
    }

    const refundableAmount = escrow.fundedAmount - escrow.releasedAmount;
    if (refundableAmount <= 0) {
      return { success: false, error: 'No funds available to refund' };
    }

    logger.info(
      {
        escrowId,
        refundableAmount,
        reason,
      },
      'Processing escrow refund'
    );

    try {
      // Refund via Stripe
      if (escrow.stripePaymentIntentId) {
        await this.stripe.refunds.create({
          payment_intent: escrow.stripePaymentIntentId,
          amount: refundableAmount,
          reason: 'requested_by_customer',
          metadata: {
            escrowId: escrow.id,
            type: 'escrow_refund',
            reason,
          },
        });
      }

      // Update escrow
      await prisma.$transaction([
        prisma.escrow.update({
          where: { id: escrowId },
          data: {
            status: 'REFUNDED',
            refundedAmount: refundableAmount,
            refundedAt: new Date(),
            refundReason: reason,
          },
        }),
        // Mark pending milestones as canceled
        prisma.escrowMilestone.updateMany({
          where: {
            escrowId,
            status: { in: ['PENDING', 'ACTIVE'] },
          },
          data: {
            status: 'CANCELED',
          },
        }),
        // Audit log
        prisma.auditLog.create({
          data: {
            action: 'ESCROW_REFUNDED',
            resourceType: 'escrow',
            resourceId: escrowId,
            userId: refundedBy,
            details: {
              amount: refundableAmount,
              reason,
            },
            ipAddress: 'system',
          },
        }),
      ]);

      logger.info(
        {
          escrowId,
          refundedAmount: refundableAmount,
        },
        'Escrow refunded successfully'
      );

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ escrowId, error: errorMessage }, 'Failed to refund escrow');
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Mark escrow as disputed
   */
  async markDisputed(escrowId: string, disputeId: string): Promise<void> {
    await prisma.escrow.update({
      where: { id: escrowId },
      data: {
        status: 'DISPUTED',
        disputeId,
        disputedAt: new Date(),
      },
    });

    logger.warn({ escrowId, disputeId }, 'Escrow marked as disputed');
  }

  /**
   * Get escrow status
   */
  async getEscrowStatus(escrowId: string) {
    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        milestones: {
          orderBy: { order: 'asc' },
        },
        releases: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!escrow) {
      return null;
    }

    return {
      id: escrow.id,
      status: escrow.status,
      totalAmount: escrow.totalAmount,
      fundedAmount: escrow.fundedAmount,
      releasedAmount: escrow.releasedAmount,
      availableBalance: escrow.fundedAmount - escrow.releasedAmount,
      platformFee: escrow.platformFee,
      currency: escrow.currency,
      milestones: escrow.milestones.map((m) => ({
        id: m.id,
        name: m.name,
        amount: m.amount,
        status: m.status,
        order: m.order,
        dueDate: m.dueDate,
      })),
      releases: escrow.releases,
      fundedAt: escrow.fundedAt,
      lastReleaseAt: escrow.lastReleaseAt,
    };
  }

  /**
   * Process auto-releases for eligible escrows
   */
  async processAutoReleases(): Promise<void> {
    logger.info('Processing auto-releases');

    const now = new Date();

    // Find escrows with auto-release enabled and milestones past due date
    const eligibleMilestones = await prisma.escrowMilestone.findMany({
      where: {
        status: 'ACTIVE',
        escrow: {
          status: { in: ['FUNDED', 'PARTIALLY_RELEASED'] },
          releaseType: 'AUTOMATIC',
        },
        OR: [
          // Due date passed
          { dueDate: { lt: now } },
          // Auto-release period passed
          {
            activatedAt: { not: null },
            escrow: {
              autoReleaseAfterDays: { not: null },
            },
          },
        ],
      },
      include: {
        escrow: true,
      },
    });

    for (const milestone of eligibleMilestones) {
      // Check if auto-release period has passed
      if (milestone.escrow.autoReleaseAfterDays && milestone.activatedAt) {
        const autoReleaseDate = addDays(
          milestone.activatedAt,
          milestone.escrow.autoReleaseAfterDays
        );
        if (now < autoReleaseDate) {
          continue; // Not yet eligible
        }
      }

      try {
        await this.releaseFunds({
          escrowId: milestone.escrowId,
          milestoneId: milestone.id,
          approvedBy: 'SYSTEM',
          approvalType: 'SYSTEM',
          notes: 'Auto-released based on schedule',
        });

        logger.info(
          {
            escrowId: milestone.escrowId,
            milestoneId: milestone.id,
          },
          'Auto-released milestone'
        );
      } catch (error) {
        logger.error(
          {
            escrowId: milestone.escrowId,
            milestoneId: milestone.id,
            error,
          },
          'Auto-release failed'
        );
      }
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async checkReleaseConditions(
    escrow: Awaited<ReturnType<typeof prisma.escrow.findUnique>>,
    request: ReleaseRequest
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!escrow) {
      return { allowed: false, reason: 'Escrow not found' };
    }

    // Check if disputed
    if (escrow.status === 'DISPUTED') {
      return { allowed: false, reason: 'Escrow is under dispute' };
    }

    // Check release type permissions
    switch (escrow.releaseType) {
      case 'AUTOMATIC':
        // System or admin can release automatically
        if (!['SYSTEM', 'ADMIN'].includes(request.approvalType)) {
          return { allowed: false, reason: 'Automatic escrow requires system or admin approval' };
        }
        break;

      case 'APPROVAL_REQUIRED':
        // Client must approve
        if (request.approvalType !== 'CLIENT' && request.approvalType !== 'ADMIN') {
          return { allowed: false, reason: 'Client approval required for release' };
        }
        break;

      case 'DUAL_APPROVAL':
        // Check if both parties have approved
        const existingApproval = await prisma.escrowApproval.findFirst({
          where: {
            escrowId: escrow.id,
            milestoneId: request.milestoneId || undefined,
            status: 'APPROVED',
          },
        });

        if (!existingApproval) {
          // First approval - record it but don't release yet
          await prisma.escrowApproval.create({
            data: {
              escrowId: escrow.id,
              milestoneId: request.milestoneId || null,
              approvedBy: request.approvedBy,
              approvalType: request.approvalType,
              status: 'APPROVED',
            },
          });
          return { allowed: false, reason: 'First approval recorded. Awaiting second approval.' };
        }

        // Ensure different approval types
        if (existingApproval.approvalType === request.approvalType) {
          return {
            allowed: false,
            reason: `Already approved by ${request.approvalType}. Awaiting other party.`,
          };
        }
        break;
    }

    return { allowed: true };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let escrowManager: EscrowManager | null = null;

export function getEscrowManager(): EscrowManager {
  if (!escrowManager) {
    escrowManager = new EscrowManager();
  }
  return escrowManager;
}
