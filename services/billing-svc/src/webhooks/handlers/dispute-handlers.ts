// @ts-nocheck
/**
 * @module @skillancer/billing-svc/webhooks/handlers/dispute-handlers
 * Charge dispute webhook handlers for Stripe
 *
 * Handles:
 * - charge.dispute.created (CRITICAL - immediate response required)
 * - charge.dispute.updated
 * - charge.dispute.closed
 */

import { prisma } from '@skillancer/database';
import { logger } from '../../lib/logger.js';

import type Stripe from 'stripe';

// =============================================================================
// TYPES
// =============================================================================

type DisputeStatus = 'NEEDS_RESPONSE' | 'UNDER_REVIEW' | 'WON' | 'LOST' | 'CLOSED';

interface DisputeEvidence {
  contractDetails?: string;
  communicationHistory?: string[];
  deliverableUrls?: string[];
  skillpodRecordings?: string[];
  clientApprovalProof?: string;
  timestamps?: Record<string, string>;
}

// =============================================================================
// DISPUTE CREATED - CRITICAL ALERT
// =============================================================================

/**
 * Handle new dispute creation - IMMEDIATE ACTION REQUIRED
 * - IMMEDIATE ALERT (Slack + Email to team)
 * - Freeze related funds
 * - Gather evidence automatically
 * - Create internal dispute ticket
 * - Deadline tracking (respond within 7 days)
 */
export async function handleDisputeCreated(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;

  // CRITICAL: Log as error for immediate visibility
  logger.error(
    {
      alertType: 'DISPUTE_CREATED',
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
      status: dispute.status,
      livemode: dispute.livemode,
      evidenceDueBy: dispute.evidence_details?.due_by,
    },
    '🚨 CRITICAL: New dispute created - immediate action required'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Get the original charge and payment details
    const payment = await tx.payment.findFirst({
      where: {
        OR: [
          { stripeChargeId: dispute.charge as string },
          { stripePaymentIntentId: dispute.payment_intent as string },
        ],
      },
      include: {
        contract: true,
        milestone: true,
      },
    });

    // 2. Create dispute record
    const disputeRecord = await tx.dispute.create({
      data: {
        stripeDisputeId: dispute.id,
        stripeChargeId: dispute.charge as string,
        stripePaymentIntentId: dispute.payment_intent as string | null,
        amount: dispute.amount,
        currency: dispute.currency.toUpperCase(),
        reason: dispute.reason,
        status: 'NEEDS_RESPONSE',
        evidenceDueBy: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        hasEvidence: dispute.evidence_details?.has_evidence || false,
        submissionCount: dispute.evidence_details?.submission_count || 0,
        paymentId: payment?.id || null,
        contractId: payment?.contractId || null,
        milestoneId: payment?.milestoneId || null,
        livemode: dispute.livemode,
        metadata: (dispute.metadata || {}) as Record<string, unknown>,
      },
    });

    // 3. Freeze related escrow funds if applicable
    if (payment?.milestoneId) {
      await tx.escrow.updateMany({
        where: { milestoneId: payment.milestoneId },
        data: {
          status: 'DISPUTED',
          disputedAt: new Date(),
        },
      });
    }

    // 4. Gather evidence automatically
    const evidence = await gatherDisputeEvidence(tx, payment, dispute);

    await tx.dispute.update({
      where: { id: disputeRecord.id },
      data: {
        gatheredEvidence: evidence as unknown as Record<string, unknown>,
      },
    });

    // 5. Create internal ticket
    await tx.supportTicket.create({
      data: {
        type: 'DISPUTE',
        priority: 'CRITICAL',
        subject: `Dispute ${dispute.id} - ${formatCurrency(dispute.amount, dispute.currency)} - ${dispute.reason}`,
        description: `A dispute has been filed for charge ${dispute.charge}.\n\nReason: ${dispute.reason}\nAmount: ${formatCurrency(dispute.amount, dispute.currency)}\nEvidence Due: ${new Date(dispute.evidence_details?.due_by! * 1000).toLocaleDateString()}\n\nImmediate action required.`,
        status: 'OPEN',
        disputeId: disputeRecord.id,
        assignedTeam: 'payments',
      },
    });

    // 6. Schedule deadline reminders
    const evidenceDueBy = dispute.evidence_details?.due_by
      ? dispute.evidence_details.due_by * 1000
      : Date.now() + 7 * 24 * 60 * 60 * 1000;

    // Reminder 5 days before
    await tx.scheduledJob.create({
      data: {
        type: 'DISPUTE_DEADLINE_REMINDER',
        scheduledAt: new Date(evidenceDueBy - 5 * 24 * 60 * 60 * 1000),
        payload: {
          disputeId: dispute.id,
          daysRemaining: 5,
          amount: dispute.amount,
          currency: dispute.currency,
        },
      },
    });

    // Reminder 2 days before
    await tx.scheduledJob.create({
      data: {
        type: 'DISPUTE_DEADLINE_REMINDER',
        scheduledAt: new Date(evidenceDueBy - 2 * 24 * 60 * 60 * 1000),
        payload: {
          disputeId: dispute.id,
          daysRemaining: 2,
          amount: dispute.amount,
          currency: dispute.currency,
        },
      },
    });

    // Final reminder 24 hours before
    await tx.scheduledJob.create({
      data: {
        type: 'DISPUTE_DEADLINE_FINAL',
        scheduledAt: new Date(evidenceDueBy - 24 * 60 * 60 * 1000),
        payload: {
          disputeId: dispute.id,
          daysRemaining: 1,
          amount: dispute.amount,
          currency: dispute.currency,
        },
      },
    });

    // 7. Audit log
    await tx.auditLog.create({
      data: {
        action: 'DISPUTE_CREATED',
        resourceType: 'dispute',
        resourceId: dispute.id,
        userId: null,
        details: {
          disputeId: dispute.id,
          chargeId: dispute.charge,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason,
          evidenceDueBy: dispute.evidence_details?.due_by,
          livemode: dispute.livemode,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 8. Send immediate alerts (outside transaction)
  await sendDisputeAlerts(dispute);

  logger.info({ disputeId: dispute.id }, 'Dispute created handler completed');
}

/**
 * Gather evidence automatically from our system
 */
async function gatherDisputeEvidence(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  payment: Awaited<ReturnType<typeof prisma.payment.findFirst>> | null,
  dispute: Stripe.Dispute
): Promise<DisputeEvidence> {
  const evidence: DisputeEvidence = {
    timestamps: {},
  };

  if (!payment) {
    logger.warn(
      { disputeId: dispute.id },
      'No payment record found for dispute evidence gathering'
    );
    return evidence;
  }

  try {
    // 1. Contract details
    if (payment.contractId) {
      const contract = await tx.contract.findUnique({
        where: { id: payment.contractId },
        include: {
          client: { select: { email: true, name: true } },
          freelancer: { select: { email: true, name: true } },
        },
      });

      if (contract) {
        evidence.contractDetails = `Contract ${contract.id} between ${contract.client?.name || 'Client'} and ${contract.freelancer?.name || 'Freelancer'}. Created: ${contract.createdAt?.toISOString()}. Value: ${contract.totalAmount}`;
        evidence.timestamps!['contractCreated'] = contract.createdAt?.toISOString() || '';
      }
    }

    // 2. Communication history
    if (payment.contractId) {
      const messages = await tx.message.findMany({
        where: { contractId: payment.contractId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          content: true,
          createdAt: true,
          sender: { select: { name: true } },
        },
      });

      evidence.communicationHistory = messages.map(
        (m) =>
          `[${m.createdAt?.toISOString()}] ${m.sender?.name || 'Unknown'}: ${m.content?.substring(0, 200)}`
      );
    }

    // 3. Deliverable URLs
    if (payment.milestoneId) {
      const deliverables = await tx.deliverable.findMany({
        where: { milestoneId: payment.milestoneId },
        select: { fileUrl: true, submittedAt: true, approvedAt: true },
      });

      evidence.deliverableUrls = deliverables.map((d) => d.fileUrl!).filter(Boolean);

      if (deliverables.some((d) => d.approvedAt)) {
        evidence.clientApprovalProof = `Deliverables approved at: ${deliverables.find((d) => d.approvedAt)?.approvedAt?.toISOString()}`;
      }
    }

    // 4. SkillPod session recordings (if applicable)
    if (payment.contractId) {
      const sessions = await tx.skillpodSession.findMany({
        where: { contractId: payment.contractId },
        select: { recordingUrl: true, startedAt: true, endedAt: true },
      });

      evidence.skillpodRecordings = sessions.map((s) => s.recordingUrl!).filter(Boolean);
    }
  } catch (error) {
    logger.error({ error, disputeId: dispute.id }, 'Error gathering dispute evidence');
  }

  return evidence;
}

/**
 * Send immediate dispute alerts
 */
async function sendDisputeAlerts(dispute: Stripe.Dispute): Promise<void> {
  const formattedAmount = formatCurrency(dispute.amount, dispute.currency);
  const dueDate = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString()
    : 'Unknown';

  // TODO: Send Slack alert
  logger.error(
    {
      channel: '#payments-alerts',
      message: `🚨 DISPUTE ALERT: ${formattedAmount} dispute filed\nReason: ${dispute.reason}\nCharge: ${dispute.charge}\nDue: ${dueDate}\nAction required immediately!`,
    },
    'Slack alert queued'
  );

  // TODO: Send email to payments team
  logger.error(
    {
      to: 'payments@skillancer.com',
      subject: `[URGENT] Dispute ${dispute.id} - ${formattedAmount}`,
      body: `A new dispute has been filed that requires immediate attention.`,
    },
    'Email alert queued'
  );

  // TODO: PagerDuty for live mode disputes
  if (dispute.livemode) {
    logger.error(
      {
        service: 'billing',
        severity: 'critical',
        summary: `Live dispute: ${formattedAmount} - ${dispute.reason}`,
      },
      'PagerDuty alert queued'
    );
  }
}

// =============================================================================
// DISPUTE UPDATED
// =============================================================================

/**
 * Handle dispute updates
 * - Track status changes
 * - Update evidence submission
 * - Notify relevant parties
 */
export async function handleDisputeUpdated(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  const previousAttributes = event.data.previous_attributes as Partial<Stripe.Dispute> | undefined;

  logger.info(
    {
      disputeId: dispute.id,
      status: dispute.status,
      previousStatus: previousAttributes?.status,
      hasEvidence: dispute.evidence_details?.has_evidence,
    },
    'Processing charge.dispute.updated'
  );

  await prisma.$transaction(async (tx) => {
    // 1. Update dispute record
    await tx.dispute.update({
      where: { stripeDisputeId: dispute.id },
      data: {
        status: mapDisputeStatus(dispute.status),
        hasEvidence: dispute.evidence_details?.has_evidence || false,
        submissionCount: dispute.evidence_details?.submission_count || 0,
        updatedAt: new Date(),
      },
    });

    // 2. Update support ticket
    const disputeRecord = await tx.dispute.findUnique({
      where: { stripeDisputeId: dispute.id },
    });

    if (disputeRecord) {
      await tx.supportTicket.updateMany({
        where: { disputeId: disputeRecord.id },
        data: {
          status: dispute.status === 'under_review' ? 'IN_PROGRESS' : 'OPEN',
          updatedAt: new Date(),
        },
      });
    }

    // 3. Audit log
    await tx.auditLog.create({
      data: {
        action: 'DISPUTE_UPDATED',
        resourceType: 'dispute',
        resourceId: dispute.id,
        userId: null,
        details: {
          disputeId: dispute.id,
          previousStatus: previousAttributes?.status,
          newStatus: dispute.status,
          hasEvidence: dispute.evidence_details?.has_evidence,
        },
        ipAddress: 'webhook',
      },
    });
  });

  // 4. Notify if status changed
  if (previousAttributes?.status && previousAttributes.status !== dispute.status) {
    await notifyDisputeStatusChange(dispute, previousAttributes.status);
  }

  logger.info({ disputeId: dispute.id }, 'Dispute updated handler completed');
}

async function notifyDisputeStatusChange(
  dispute: Stripe.Dispute,
  previousStatus: string
): Promise<void> {
  const formattedAmount = formatCurrency(dispute.amount, dispute.currency);

  logger.info(
    {
      disputeId: dispute.id,
      previousStatus,
      newStatus: dispute.status,
      amount: formattedAmount,
    },
    'Dispute status change notification queued'
  );
}

// =============================================================================
// DISPUTE CLOSED
// =============================================================================

/**
 * Handle dispute closure
 * - Handle won: Release funds
 * - Handle lost: Update records, consider platform action
 * - Metrics update
 * - Post-mortem trigger
 */
export async function handleDisputeClosed(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;

  const won = dispute.status === 'won';
  const logLevel = won ? 'info' : 'warn';

  logger[logLevel](
    {
      disputeId: dispute.id,
      status: dispute.status,
      amount: dispute.amount,
      currency: dispute.currency,
      won,
    },
    `Processing charge.dispute.closed - ${won ? 'WON' : 'LOST'}`
  );

  await prisma.$transaction(async (tx) => {
    // 1. Update dispute record
    const disputeRecord = await tx.dispute.update({
      where: { stripeDisputeId: dispute.id },
      data: {
        status: won ? 'WON' : 'LOST',
        closedAt: new Date(),
      },
    });

    // 2. Handle based on outcome
    if (won) {
      // Release frozen escrow funds
      if (disputeRecord.milestoneId) {
        await tx.escrow.updateMany({
          where: { milestoneId: disputeRecord.milestoneId },
          data: {
            status: 'HELD', // Back to held, not released yet
            disputedAt: null,
          },
        });
      }

      logger.info({ disputeId: dispute.id }, 'Dispute won - funds released back to escrow');
    } else {
      // Lost dispute - funds go to cardholder

      // Update escrow as forfeited
      if (disputeRecord.milestoneId) {
        await tx.escrow.updateMany({
          where: { milestoneId: disputeRecord.milestoneId },
          data: {
            status: 'FORFEITED',
            forfeitedAt: new Date(),
          },
        });
      }

      // Track the chargeback for analytics
      await tx.chargeback.create({
        data: {
          disputeId: disputeRecord.id,
          amount: dispute.amount,
          currency: dispute.currency.toUpperCase(),
          reason: dispute.reason,
          contractId: disputeRecord.contractId || null,
          milestoneId: disputeRecord.milestoneId || null,
        },
      });

      // Consider platform action based on pattern
      await evaluateUserAction(tx, disputeRecord);

      logger.warn(
        { disputeId: dispute.id, amount: dispute.amount },
        'Dispute lost - chargeback recorded'
      );
    }

    // 3. Close support ticket
    await tx.supportTicket.updateMany({
      where: { disputeId: disputeRecord.id },
      data: {
        status: 'CLOSED',
        resolution: won ? 'Dispute won' : 'Dispute lost',
        closedAt: new Date(),
      },
    });

    // 4. Cancel pending reminders
    await tx.scheduledJob.deleteMany({
      where: {
        type: { in: ['DISPUTE_DEADLINE_REMINDER', 'DISPUTE_DEADLINE_FINAL'] },
        payload: { path: ['disputeId'], equals: dispute.id },
      },
    });

    // 5. Schedule post-mortem
    await tx.scheduledJob.create({
      data: {
        type: 'DISPUTE_POSTMORTEM',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
        payload: {
          disputeId: dispute.id,
          outcome: won ? 'won' : 'lost',
          amount: dispute.amount,
          reason: dispute.reason,
        },
      },
    });

    // 6. Audit log
    await tx.auditLog.create({
      data: {
        action: won ? 'DISPUTE_WON' : 'DISPUTE_LOST',
        resourceType: 'dispute',
        resourceId: dispute.id,
        userId: null,
        details: {
          disputeId: dispute.id,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason,
          outcome: dispute.status,
        },
        ipAddress: 'webhook',
      },
    });

    // 7. Update metrics
    await updateDisputeMetrics(tx, won, dispute.amount);
  });

  // 8. Send outcome notification
  await sendDisputeOutcomeNotification(dispute, won);

  logger.info({ disputeId: dispute.id, won }, 'Dispute closed handler completed');
}

/**
 * Evaluate if platform action is needed for repeated disputes
 */
async function evaluateUserAction(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  disputeRecord: Awaited<ReturnType<typeof prisma.dispute.update>>
): Promise<void> {
  // Find the payment to get the client
  const payment = disputeRecord.paymentId
    ? await tx.payment.findUnique({
        where: { id: disputeRecord.paymentId },
        select: { clientId: true },
      })
    : null;

  if (!payment?.clientId) return;

  // Check for repeated chargebacks from this client
  const recentChargebacks = await tx.chargeback.count({
    where: {
      dispute: {
        payment: {
          clientId: payment.clientId,
        },
      },
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
    },
  });

  if (recentChargebacks >= 3) {
    logger.warn(
      { clientId: payment.clientId, chargebackCount: recentChargebacks },
      'Multiple chargebacks detected - flagging account'
    );

    await tx.user.update({
      where: { id: payment.clientId },
      data: {
        riskLevel: 'HIGH',
        flaggedAt: new Date(),
        flagReason: `${recentChargebacks} chargebacks in 90 days`,
      },
    });

    // Create review task
    await tx.supportTicket.create({
      data: {
        type: 'ACCOUNT_REVIEW',
        priority: 'HIGH',
        subject: `Account review needed: ${recentChargebacks} chargebacks`,
        description: `User has ${recentChargebacks} chargebacks in the last 90 days. Review for potential suspension.`,
        status: 'OPEN',
        assignedTeam: 'trust-safety',
      },
    });
  }
}

async function updateDisputeMetrics(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  won: boolean,
  amount: number
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await tx.dailyMetric.upsert({
    where: {
      date_metricType: {
        date: today,
        metricType: 'DISPUTES',
      },
    },
    create: {
      date: today,
      metricType: 'DISPUTES',
      value: 1,
      metadata: {
        won: won ? 1 : 0,
        lost: won ? 0 : 1,
        totalAmount: won ? 0 : amount,
      },
    },
    update: {
      value: { increment: 1 },
      // Note: Would need JSON operations for metadata updates
    },
  });
}

async function sendDisputeOutcomeNotification(
  dispute: Stripe.Dispute,
  won: boolean
): Promise<void> {
  const formattedAmount = formatCurrency(dispute.amount, dispute.currency);

  logger.info(
    {
      outcome: won ? 'WON' : 'LOST',
      amount: formattedAmount,
      reason: dispute.reason,
    },
    `Dispute outcome notification: ${won ? '✅ Won' : '❌ Lost'}`
  );

  // TODO: Send to appropriate channels
}

// =============================================================================
// HELPERS
// =============================================================================

function mapDisputeStatus(status: string): DisputeStatus {
  const statusMap: Record<string, DisputeStatus> = {
    needs_response: 'NEEDS_RESPONSE',
    under_review: 'UNDER_REVIEW',
    won: 'WON',
    lost: 'LOST',
    charge_refunded: 'CLOSED',
    warning_needs_response: 'NEEDS_RESPONSE',
    warning_under_review: 'UNDER_REVIEW',
    warning_closed: 'CLOSED',
  };

  return statusMap[status] || 'NEEDS_RESPONSE';
}

function formatCurrency(amount: number, currency: string): string {
  return (amount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
}

