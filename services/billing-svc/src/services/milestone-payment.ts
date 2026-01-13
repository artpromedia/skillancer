// @ts-nocheck
/**
 * @module @skillancer/billing-svc/services/milestone-payment
 * Milestone Payment Processing Service
 *
 * Features:
 * - Milestone payment orchestration
 * - Delivery confirmation workflow
 * - Revision handling
 * - Time-boxed approval (auto-approve after X days)
 * - Integration with escrow
 * - Milestone completion tracking
 */

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';
import { addDays, differenceInDays } from 'date-fns';

import { billingNotifications } from './billing-notifications.js';
import { getEscrowManager } from './escrow-manager.js';

// =============================================================================
// TYPES
// =============================================================================

export type MilestonePaymentStatus =
  | 'PENDING_WORK'
  | 'WORK_SUBMITTED'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'PAYMENT_PROCESSING'
  | 'PAID'
  | 'DISPUTED'
  | 'CANCELED';

export interface SubmitDeliveryRequest {
  milestoneId: string;
  freelancerId: string;
  deliveryNotes?: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  hoursWorked?: number;
}

export interface ReviewDeliveryRequest {
  milestoneId: string;
  clientId: string;
  action: 'APPROVE' | 'REQUEST_REVISION' | 'DISPUTE';
  feedback?: string;
  revisionNotes?: string;
  rating?: number;
}

export interface MilestonePaymentResult {
  success: boolean;
  milestoneId: string;
  status: MilestonePaymentStatus;
  message: string;
  paymentDetails?: {
    transferId: string;
    amount: number;
    netAmount: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const AUTO_APPROVE_DAYS = 7; // Auto-approve after 7 days of no response
const MAX_REVISIONS = 3;

// =============================================================================
// MILESTONE PAYMENT SERVICE CLASS
// =============================================================================

export class MilestonePaymentService {
  private escrowManager = getEscrowManager();

  /**
   * Submit milestone delivery for review
   */
  async submitDelivery(request: SubmitDeliveryRequest): Promise<MilestonePaymentResult> {
    const milestone = await prisma.escrowMilestone.findUnique({
      where: { id: request.milestoneId },
      include: {
        escrow: true,
        deliveries: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!milestone) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: 'PENDING_WORK',
        message: 'Milestone not found',
      };
    }

    // Verify freelancer owns this milestone
    if (milestone.escrow.freelancerId !== request.freelancerId) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: milestone.status as MilestonePaymentStatus,
        message: 'Unauthorized: Not your milestone',
      };
    }

    // Check milestone status
    if (!['ACTIVE', 'REVISION_REQUESTED'].includes(milestone.status)) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: milestone.status as MilestonePaymentStatus,
        message: `Cannot submit delivery for milestone in ${milestone.status} status`,
      };
    }

    // Check revision limit
    const revisionCount = milestone.deliveries.filter((d) => d.type === 'REVISION').length;
    if (milestone.status === 'REVISION_REQUESTED' && revisionCount >= MAX_REVISIONS) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: milestone.status as MilestonePaymentStatus,
        message: `Maximum revisions (${MAX_REVISIONS}) reached. Please contact support.`,
      };
    }

    logger.info(
      {
        milestoneId: request.milestoneId,
        isRevision: milestone.status === 'REVISION_REQUESTED',
        revisionCount,
      },
      'Submitting milestone delivery'
    );

    try {
      // Create delivery record
      const delivery = await prisma.milestoneDelivery.create({
        data: {
          milestoneId: milestone.id,
          type: milestone.status === 'REVISION_REQUESTED' ? 'REVISION' : 'INITIAL',
          notes: request.deliveryNotes || null,
          attachments: request.attachments as unknown as Record<string, unknown>[],
          hoursWorked: request.hoursWorked || null,
          submittedAt: new Date(),
          status: 'PENDING_REVIEW',
        },
      });

      // Calculate auto-approve deadline
      const autoApproveAt = addDays(new Date(), AUTO_APPROVE_DAYS);

      // Update milestone status
      await prisma.escrowMilestone.update({
        where: { id: milestone.id },
        data: {
          status: 'WORK_SUBMITTED',
          lastDeliveryAt: new Date(),
          autoApproveAt,
          currentDeliveryId: delivery.id,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'MILESTONE_DELIVERY_SUBMITTED',
          resourceType: 'milestone',
          resourceId: milestone.id,
          userId: request.freelancerId,
          details: {
            deliveryId: delivery.id,
            isRevision: milestone.status === 'REVISION_REQUESTED',
            attachmentCount: request.attachments?.length || 0,
          },
          ipAddress: 'system',
        },
      });

      // Notify client that milestone is ready for review
      await billingNotifications.notifyMilestoneSubmitted(
        { userId: milestone.escrow.clientId },
        {
          contractId: milestone.escrow.contractId,
          contractTitle: milestone.escrow.contract?.title || 'Contract',
          milestoneId: milestone.id,
          milestoneName: milestone.name,
          amount: `$${(milestone.amount / 100).toFixed(2)}`,
        }
      );

      logger.info(
        {
          milestoneId: milestone.id,
          deliveryId: delivery.id,
          autoApproveAt,
        },
        'Delivery submitted successfully'
      );

      return {
        success: true,
        milestoneId: milestone.id,
        status: 'WORK_SUBMITTED',
        message: `Delivery submitted. Client has ${AUTO_APPROVE_DAYS} days to review.`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { milestoneId: request.milestoneId, error: errorMessage },
        'Failed to submit delivery'
      );

      return {
        success: false,
        milestoneId: request.milestoneId,
        status: milestone.status as MilestonePaymentStatus,
        message: errorMessage,
      };
    }
  }

  /**
   * Client reviews and approves/rejects delivery
   */
  async reviewDelivery(request: ReviewDeliveryRequest): Promise<MilestonePaymentResult> {
    const milestone = await prisma.escrowMilestone.findUnique({
      where: { id: request.milestoneId },
      include: {
        escrow: true,
        deliveries: {
          where: { status: 'PENDING_REVIEW' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!milestone) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: 'PENDING_WORK',
        message: 'Milestone not found',
      };
    }

    // Verify client owns this milestone
    if (milestone.escrow.clientId !== request.clientId) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: milestone.status as MilestonePaymentStatus,
        message: 'Unauthorized: Not your contract',
      };
    }

    // Check milestone is in reviewable state
    if (milestone.status !== 'WORK_SUBMITTED') {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: milestone.status as MilestonePaymentStatus,
        message: `Cannot review milestone in ${milestone.status} status`,
      };
    }

    const delivery = milestone.deliveries[0];
    if (!delivery) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: milestone.status as MilestonePaymentStatus,
        message: 'No pending delivery to review',
      };
    }

    logger.info(
      {
        milestoneId: request.milestoneId,
        action: request.action,
        clientId: request.clientId,
      },
      'Processing delivery review'
    );

    try {
      switch (request.action) {
        case 'APPROVE':
          return await this.approveDelivery(milestone, delivery, request);

        case 'REQUEST_REVISION':
          return await this.requestRevision(milestone, delivery, request);

        case 'DISPUTE':
          return await this.disputeMilestone(milestone, delivery, request);

        default:
          return {
            success: false,
            milestoneId: request.milestoneId,
            status: milestone.status as MilestonePaymentStatus,
            message: 'Invalid action',
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { milestoneId: request.milestoneId, error: errorMessage },
        'Failed to process review'
      );

      return {
        success: false,
        milestoneId: request.milestoneId,
        status: milestone.status as MilestonePaymentStatus,
        message: errorMessage,
      };
    }
  }

  /**
   * Process auto-approvals for overdue reviews
   */
  async processAutoApprovals(): Promise<void> {
    logger.info('Processing milestone auto-approvals');

    const now = new Date();

    const overduedeliveries = await prisma.escrowMilestone.findMany({
      where: {
        status: 'WORK_SUBMITTED',
        autoApproveAt: {
          lt: now,
        },
      },
      include: {
        escrow: true,
        deliveries: {
          where: { status: 'PENDING_REVIEW' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    logger.info({ count: overduedeliveries.length }, 'Found overdue milestones for auto-approval');

    for (const milestone of overduedeliveries) {
      const delivery = milestone.deliveries[0];
      if (!delivery) continue;

      try {
        await this.approveDelivery(milestone, delivery, {
          milestoneId: milestone.id,
          clientId: 'SYSTEM',
          action: 'APPROVE',
          feedback: 'Auto-approved after review period expired',
        });

        logger.info(
          {
            milestoneId: milestone.id,
            daysOverdue: differenceInDays(now, milestone.autoApproveAt!),
          },
          'Milestone auto-approved'
        );
      } catch (error) {
        logger.error({ milestoneId: milestone.id, error }, 'Auto-approval failed');
      }
    }
  }

  /**
   * Get milestone payment status
   */
  async getMilestoneStatus(milestoneId: string) {
    const milestone = await prisma.escrowMilestone.findUnique({
      where: { id: milestoneId },
      include: {
        escrow: {
          select: {
            id: true,
            contractId: true,
            clientId: true,
            freelancerId: true,
            currency: true,
            platformFee: true,
            totalAmount: true,
          },
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!milestone) {
      return null;
    }

    const totalRevisions = milestone.deliveries.filter((d) => d.type === 'REVISION').length;
    const remainingRevisions = MAX_REVISIONS - totalRevisions;

    return {
      id: milestone.id,
      name: milestone.name,
      description: milestone.description,
      amount: milestone.amount,
      status: milestone.status,
      order: milestone.order,
      dueDate: milestone.dueDate,
      activatedAt: milestone.activatedAt,
      releasedAt: milestone.releasedAt,
      autoApproveAt: milestone.autoApproveAt,
      deliveries: milestone.deliveries.map((d) => ({
        id: d.id,
        type: d.type,
        notes: d.notes,
        attachments: d.attachments,
        hoursWorked: d.hoursWorked,
        submittedAt: d.submittedAt,
        status: d.status,
      })),
      reviews: milestone.reviews,
      revisionStats: {
        total: totalRevisions,
        remaining: remainingRevisions,
        maxAllowed: MAX_REVISIONS,
      },
      escrow: milestone.escrow,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async approveDelivery(
    milestone: Awaited<ReturnType<typeof prisma.escrowMilestone.findUnique>> & {
      escrow: Record<string, unknown>;
    },
    delivery: Awaited<ReturnType<typeof prisma.milestoneDelivery.findFirst>>,
    request: ReviewDeliveryRequest
  ): Promise<MilestonePaymentResult> {
    if (!milestone || !delivery) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: 'PENDING_WORK',
        message: 'Invalid milestone or delivery',
      };
    }

    // Update delivery status
    await prisma.milestoneDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });

    // Create review record
    await prisma.milestoneReview.create({
      data: {
        milestoneId: milestone.id,
        deliveryId: delivery.id,
        reviewerId: request.clientId,
        action: 'APPROVED',
        feedback: request.feedback || null,
        rating: request.rating || null,
      },
    });

    // Update milestone status
    await prisma.escrowMilestone.update({
      where: { id: milestone.id },
      data: {
        status: 'PAYMENT_PROCESSING',
        approvedAt: new Date(),
        autoApproveAt: null,
      },
    });

    // Release funds from escrow
    const releaseResult = await this.escrowManager.releaseFunds({
      escrowId: milestone.escrowId,
      milestoneId: milestone.id,
      approvedBy: request.clientId,
      approvalType: request.clientId === 'SYSTEM' ? 'SYSTEM' : 'CLIENT',
      notes: request.feedback,
    });

    if (releaseResult.success) {
      // Update milestone to PAID
      await prisma.escrowMilestone.update({
        where: { id: milestone.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          stripeTransferId: releaseResult.transferId,
        },
      });

      // Notify freelancer about milestone approval
      await billingNotifications.notifyMilestoneApproved(
        { userId: milestone.escrow.freelancerId },
        {
          contractId: milestone.escrow.contractId,
          contractTitle: milestone.escrow.contract?.title || 'Contract',
          milestoneId: milestone.id,
          milestoneName: milestone.name,
          amount: `$${(releaseResult.amountReleased / 100).toFixed(2)}`,
        }
      );

      logger.info(
        {
          milestoneId: milestone.id,
          amountReleased: releaseResult.amountReleased,
          transferId: releaseResult.transferId,
        },
        'Milestone approved and paid'
      );

      return {
        success: true,
        milestoneId: milestone.id,
        status: 'PAID',
        message: 'Milestone approved and payment released',
        paymentDetails: {
          transferId: releaseResult.transferId!,
          amount: releaseResult.amountReleased,
          netAmount: releaseResult.amountReleased, // Already net after platform fee
        },
      };
    } else {
      // Payment failed - revert milestone status
      await prisma.escrowMilestone.update({
        where: { id: milestone.id },
        data: {
          status: 'APPROVED', // Approved but not paid yet
        },
      });

      logger.error(
        {
          milestoneId: milestone.id,
          error: releaseResult.error,
        },
        'Milestone approved but payment release failed'
      );

      return {
        success: false,
        milestoneId: milestone.id,
        status: 'APPROVED',
        message: `Milestone approved but payment failed: ${releaseResult.error}`,
      };
    }
  }

  private async requestRevision(
    milestone: Awaited<ReturnType<typeof prisma.escrowMilestone.findUnique>>,
    delivery: Awaited<ReturnType<typeof prisma.milestoneDelivery.findFirst>>,
    request: ReviewDeliveryRequest
  ): Promise<MilestonePaymentResult> {
    if (!milestone || !delivery) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: 'PENDING_WORK',
        message: 'Invalid milestone or delivery',
      };
    }

    // Check revision limit
    const revisionCount = await prisma.milestoneDelivery.count({
      where: {
        milestoneId: milestone.id,
        type: 'REVISION',
      },
    });

    if (revisionCount >= MAX_REVISIONS) {
      return {
        success: false,
        milestoneId: milestone.id,
        status: milestone.status as MilestonePaymentStatus,
        message: `Maximum revisions (${MAX_REVISIONS}) reached. Consider disputing instead.`,
      };
    }

    // Update delivery status
    await prisma.milestoneDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'REVISION_REQUESTED',
        reviewedAt: new Date(),
      },
    });

    // Create review record
    await prisma.milestoneReview.create({
      data: {
        milestoneId: milestone.id,
        deliveryId: delivery.id,
        reviewerId: request.clientId,
        action: 'REVISION_REQUESTED',
        feedback: request.revisionNotes || request.feedback || null,
      },
    });

    // Update milestone status
    await prisma.escrowMilestone.update({
      where: { id: milestone.id },
      data: {
        status: 'REVISION_REQUESTED',
        autoApproveAt: null,
      },
    });

    logger.info(
      {
        milestoneId: milestone.id,
        revisionNumber: revisionCount + 1,
      },
      'Revision requested'
    );

    // Notify freelancer about revision request
    await billingNotifications.notifyMilestoneRejected(
      { userId: milestone.escrow.freelancerId },
      {
        contractId: milestone.escrow.contractId,
        contractTitle: milestone.escrow.contract?.title || 'Contract',
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        amount: `$${(milestone.amount / 100).toFixed(2)}`,
        reason: request.revisionNotes,
      }
    );

    return {
      success: true,
      milestoneId: milestone.id,
      status: 'REVISION_REQUESTED',
      message: `Revision requested. ${MAX_REVISIONS - revisionCount - 1} revisions remaining.`,
    };
  }

  private async disputeMilestone(
    milestone: Awaited<ReturnType<typeof prisma.escrowMilestone.findUnique>> & {
      escrow: { id: string };
    },
    delivery: Awaited<ReturnType<typeof prisma.milestoneDelivery.findFirst>>,
    request: ReviewDeliveryRequest
  ): Promise<MilestonePaymentResult> {
    if (!milestone || !delivery) {
      return {
        success: false,
        milestoneId: request.milestoneId,
        status: 'PENDING_WORK',
        message: 'Invalid milestone or delivery',
      };
    }

    // Update delivery status
    await prisma.milestoneDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'DISPUTED',
        reviewedAt: new Date(),
      },
    });

    // Create dispute record
    const dispute = await prisma.milestoneDispute.create({
      data: {
        milestoneId: milestone.id,
        deliveryId: delivery.id,
        raisedBy: request.clientId,
        reason: request.feedback || 'Work quality dispute',
        status: 'OPEN',
      },
    });

    // Update milestone and escrow
    await prisma.$transaction([
      prisma.escrowMilestone.update({
        where: { id: milestone.id },
        data: {
          status: 'DISPUTED',
          autoApproveAt: null,
        },
      }),
      // Mark escrow as disputed too
      prisma.escrow.update({
        where: { id: milestone.escrow.id },
        data: {
          status: 'DISPUTED',
          disputeId: dispute.id,
          disputedAt: new Date(),
        },
      }),
    ]);

    logger.warn(
      {
        milestoneId: milestone.id,
        disputeId: dispute.id,
      },
      'Milestone disputed'
    );

    // Notify both parties about dispute
    await billingNotifications.notifyDisputeOpened(
      {
        client: { userId: milestone.escrow.clientId },
        freelancer: { userId: milestone.escrow.freelancerId },
      },
      {
        disputeId: dispute.id,
        contractId: milestone.escrow.contractId,
        contractTitle: milestone.escrow.contract?.title || 'Contract',
        reason: request.disputeReason || 'Disputed',
        amount: `$${(milestone.amount / 100).toFixed(2)}`,
      }
    );

    return {
      success: true,
      milestoneId: milestone.id,
      status: 'DISPUTED',
      message: 'Dispute created. Our team will review and contact both parties.',
    };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let milestoneService: MilestonePaymentService | null = null;

export function getMilestonePaymentService(): MilestonePaymentService {
  if (!milestoneService) {
    milestoneService = new MilestonePaymentService();
  }
  return milestoneService;
}

