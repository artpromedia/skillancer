/**
 * Push Notification Triggers
 * Event-based push notification dispatching
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { PushNotificationService } from './push-notification.service.js';

import type { PrismaClient } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface TriggerContext {
  userId: string;
  tenantId?: string;
  actorId?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageTriggerData extends TriggerContext {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messagePreview: string;
  projectTitle?: string;
}

export interface ProposalTriggerData extends TriggerContext {
  proposalId: string;
  projectId: string;
  projectTitle: string;
  freelancerName: string;
  bidAmount?: number;
  currency?: string;
  action: 'submitted' | 'accepted' | 'rejected' | 'withdrawn' | 'updated';
}

export interface PaymentTriggerData extends TriggerContext {
  paymentId: string;
  amount: number;
  currency: string;
  description?: string;
  projectTitle?: string;
  action: 'received' | 'sent' | 'released' | 'refunded' | 'failed';
}

export interface ContractTriggerData extends TriggerContext {
  contractId: string;
  projectTitle: string;
  clientName?: string;
  freelancerName?: string;
  action: 'created' | 'started' | 'completed' | 'cancelled' | 'disputed';
}

export interface MilestoneTriggerData extends TriggerContext {
  milestoneId: string;
  milestoneTitle: string;
  projectTitle: string;
  amount?: number;
  currency?: string;
  action: 'created' | 'submitted' | 'approved' | 'rejected' | 'paid';
}

export interface ReviewTriggerData extends TriggerContext {
  reviewId: string;
  projectTitle: string;
  reviewerName: string;
  rating: number;
}

export interface SecurityTriggerData extends TriggerContext {
  eventType: 'login' | 'password_change' | 'two_factor' | 'suspicious_activity' | 'session_expired';
  ipAddress?: string;
  location?: string;
  device?: string;
  timestamp: Date;
}

export interface InviteTriggerData extends TriggerContext {
  inviteId: string;
  inviterName: string;
  projectTitle?: string;
  teamName?: string;
  type: 'project' | 'team' | 'organization';
}

export interface TriggerResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

// =============================================================================
// Push Triggers Service
// =============================================================================

export class PushTriggersService {
  private readonly pushService: PushNotificationService;

  constructor(private readonly prisma: PrismaClient) {
    this.pushService = new PushNotificationService(prisma);
  }

  // ===========================================================================
  // Message Triggers
  // ===========================================================================

  /**
   * Trigger: New message received
   */
  async onNewMessage(data: MessageTriggerData): Promise<TriggerResult> {
    return this.pushService.sendNewMessageNotification(data.userId, {
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      messagePreview: data.messagePreview,
      conversationId: data.conversationId,
      projectTitle: data.projectTitle,
    });
  }

  /**
   * Trigger: Message read receipt
   */
  async onMessageRead(data: {
    userId: string;
    conversationId: string;
    readerName: string;
  }): Promise<TriggerResult> {
    // Usually we don't send push for read receipts, but can be enabled
    return { success: true };
  }

  // ===========================================================================
  // Proposal Triggers
  // ===========================================================================

  /**
   * Trigger: New proposal submitted (to client)
   */
  async onProposalSubmitted(data: ProposalTriggerData): Promise<TriggerResult> {
    return this.pushService.sendProposalNotification(data.userId, {
      proposalId: data.proposalId,
      projectTitle: data.projectTitle,
      freelancerName: data.freelancerName,
      bidAmount: data.bidAmount,
      currency: data.currency,
      status: 'submitted',
    });
  }

  /**
   * Trigger: Proposal accepted (to freelancer)
   */
  async onProposalAccepted(data: ProposalTriggerData): Promise<TriggerResult> {
    return this.pushService.sendProposalNotification(data.userId, {
      proposalId: data.proposalId,
      projectTitle: data.projectTitle,
      freelancerName: data.freelancerName,
      status: 'accepted',
    });
  }

  /**
   * Trigger: Proposal rejected (to freelancer)
   */
  async onProposalRejected(data: ProposalTriggerData): Promise<TriggerResult> {
    return this.pushService.sendProposalNotification(data.userId, {
      proposalId: data.proposalId,
      projectTitle: data.projectTitle,
      freelancerName: data.freelancerName,
      status: 'rejected',
    });
  }

  /**
   * Trigger: Proposal updated
   */
  async onProposalUpdated(data: ProposalTriggerData): Promise<TriggerResult> {
    return this.pushService.sendProposalNotification(data.userId, {
      proposalId: data.proposalId,
      projectTitle: data.projectTitle,
      freelancerName: data.freelancerName,
      bidAmount: data.bidAmount,
      currency: data.currency,
      status: 'updated',
    });
  }

  // ===========================================================================
  // Payment Triggers
  // ===========================================================================

  /**
   * Trigger: Payment received
   */
  async onPaymentReceived(data: PaymentTriggerData): Promise<TriggerResult> {
    return this.pushService.sendPaymentNotification(data.userId, {
      amount: data.amount,
      currency: data.currency,
      description: data.description || data.projectTitle || 'Payment',
      type: 'received',
    });
  }

  /**
   * Trigger: Payment sent
   */
  async onPaymentSent(data: PaymentTriggerData): Promise<TriggerResult> {
    return this.pushService.sendPaymentNotification(data.userId, {
      amount: data.amount,
      currency: data.currency,
      description: data.description || data.projectTitle || 'Payment',
      type: 'sent',
    });
  }

  /**
   * Trigger: Escrow released
   */
  async onEscrowReleased(data: PaymentTriggerData): Promise<TriggerResult> {
    return this.pushService.sendPaymentNotification(data.userId, {
      amount: data.amount,
      currency: data.currency,
      description: data.description || data.projectTitle || 'Escrow Release',
      type: 'released',
    });
  }

  /**
   * Trigger: Payment failed
   */
  async onPaymentFailed(data: PaymentTriggerData): Promise<TriggerResult> {
    return this.pushService.sendPaymentNotification(data.userId, {
      amount: data.amount,
      currency: data.currency,
      description: data.description || 'Payment failed',
      type: 'failed',
    });
  }

  // ===========================================================================
  // Contract Triggers
  // ===========================================================================

  /**
   * Trigger: Contract created
   */
  async onContractCreated(data: ContractTriggerData): Promise<TriggerResult> {
    return this.pushService.sendContractNotification(data.userId, {
      contractId: data.contractId,
      projectTitle: data.projectTitle,
      otherPartyName: data.clientName || data.freelancerName || 'Client',
      action: 'created',
    });
  }

  /**
   * Trigger: Contract started
   */
  async onContractStarted(data: ContractTriggerData): Promise<TriggerResult> {
    return this.pushService.sendContractNotification(data.userId, {
      contractId: data.contractId,
      projectTitle: data.projectTitle,
      otherPartyName: data.clientName || data.freelancerName || 'Client',
      action: 'started',
    });
  }

  /**
   * Trigger: Contract completed
   */
  async onContractCompleted(data: ContractTriggerData): Promise<TriggerResult> {
    return this.pushService.sendContractNotification(data.userId, {
      contractId: data.contractId,
      projectTitle: data.projectTitle,
      otherPartyName: data.clientName || data.freelancerName || 'Client',
      action: 'completed',
    });
  }

  /**
   * Trigger: Contract cancelled
   */
  async onContractCancelled(data: ContractTriggerData): Promise<TriggerResult> {
    return this.pushService.sendContractNotification(data.userId, {
      contractId: data.contractId,
      projectTitle: data.projectTitle,
      otherPartyName: data.clientName || data.freelancerName || 'Client',
      action: 'cancelled',
    });
  }

  /**
   * Trigger: Contract disputed
   */
  async onContractDisputed(data: ContractTriggerData): Promise<TriggerResult> {
    return this.pushService.sendContractNotification(data.userId, {
      contractId: data.contractId,
      projectTitle: data.projectTitle,
      otherPartyName: data.clientName || data.freelancerName || 'Client',
      action: 'disputed',
    });
  }

  // ===========================================================================
  // Milestone Triggers
  // ===========================================================================

  /**
   * Trigger: Milestone submitted for review
   */
  async onMilestoneSubmitted(data: MilestoneTriggerData): Promise<TriggerResult> {
    return this.pushService.sendToUser(data.userId, {
      title: 'Milestone Submitted',
      body: `Milestone "${data.milestoneTitle}" has been submitted for review`,
      type: 'milestone',
      data: {
        action: 'milestone_submitted',
        milestoneId: data.milestoneId,
        projectTitle: data.projectTitle,
      },
      deepLink: `/projects/milestones/${data.milestoneId}`,
    });
  }

  /**
   * Trigger: Milestone approved
   */
  async onMilestoneApproved(data: MilestoneTriggerData): Promise<TriggerResult> {
    const amountText =
      data.amount && data.currency ? ` (${this.formatCurrency(data.amount, data.currency)})` : '';

    return this.pushService.sendToUser(data.userId, {
      title: 'Milestone Approved! 🎉',
      body: `"${data.milestoneTitle}" has been approved${amountText}`,
      type: 'milestone',
      data: {
        action: 'milestone_approved',
        milestoneId: data.milestoneId,
        projectTitle: data.projectTitle,
        amount: data.amount,
        currency: data.currency,
      },
      deepLink: `/projects/milestones/${data.milestoneId}`,
    });
  }

  /**
   * Trigger: Milestone rejected
   */
  async onMilestoneRejected(data: MilestoneTriggerData): Promise<TriggerResult> {
    return this.pushService.sendToUser(data.userId, {
      title: 'Milestone Needs Revision',
      body: `"${data.milestoneTitle}" requires changes`,
      type: 'milestone',
      data: {
        action: 'milestone_rejected',
        milestoneId: data.milestoneId,
        projectTitle: data.projectTitle,
      },
      deepLink: `/projects/milestones/${data.milestoneId}`,
    });
  }

  /**
   * Trigger: Milestone paid
   */
  async onMilestonePaid(data: MilestoneTriggerData): Promise<TriggerResult> {
    const amountText =
      data.amount && data.currency ? ` - ${this.formatCurrency(data.amount, data.currency)}` : '';

    return this.pushService.sendToUser(data.userId, {
      title: 'Payment Received! 💰',
      body: `Payment for "${data.milestoneTitle}"${amountText}`,
      type: 'payment',
      data: {
        action: 'milestone_paid',
        milestoneId: data.milestoneId,
        projectTitle: data.projectTitle,
        amount: data.amount,
        currency: data.currency,
      },
      deepLink: `/payments`,
    });
  }

  // ===========================================================================
  // Review Triggers
  // ===========================================================================

  /**
   * Trigger: New review received
   */
  async onReviewReceived(data: ReviewTriggerData): Promise<TriggerResult> {
    const stars = '⭐'.repeat(Math.min(data.rating, 5));

    return this.pushService.sendToUser(data.userId, {
      title: 'New Review Received!',
      body: `${data.reviewerName} left you a ${data.rating}-star review ${stars}`,
      type: 'review',
      data: {
        action: 'review_received',
        reviewId: data.reviewId,
        projectTitle: data.projectTitle,
        rating: data.rating,
      },
      deepLink: `/profile/reviews`,
    });
  }

  // ===========================================================================
  // Security Triggers
  // ===========================================================================

  /**
   * Trigger: New login detected
   */
  async onNewLogin(data: SecurityTriggerData): Promise<TriggerResult> {
    return this.pushService.sendSecurityAlert(data.userId, {
      eventType: 'new_login',
      ipAddress: data.ipAddress,
      location: data.location,
      device: data.device,
      timestamp: data.timestamp,
    });
  }

  /**
   * Trigger: Password changed
   */
  async onPasswordChanged(data: SecurityTriggerData): Promise<TriggerResult> {
    return this.pushService.sendSecurityAlert(data.userId, {
      eventType: 'password_change',
      timestamp: data.timestamp,
    });
  }

  /**
   * Trigger: Two-factor authentication enabled/disabled
   */
  async onTwoFactorChanged(
    data: SecurityTriggerData & { enabled: boolean }
  ): Promise<TriggerResult> {
    return this.pushService.sendToUser(data.userId, {
      title: 'Two-Factor Authentication Updated',
      body: data.enabled
        ? 'Two-factor authentication has been enabled on your account'
        : 'Two-factor authentication has been disabled on your account',
      type: 'security',
      priority: 'high',
      data: {
        action: 'two_factor_changed',
        enabled: data.enabled,
        timestamp: data.timestamp.toISOString(),
      },
      deepLink: '/settings/security',
    });
  }

  /**
   * Trigger: Suspicious activity detected
   */
  async onSuspiciousActivity(data: SecurityTriggerData): Promise<TriggerResult> {
    return this.pushService.sendSecurityAlert(data.userId, {
      eventType: 'suspicious_activity',
      ipAddress: data.ipAddress,
      location: data.location,
      device: data.device,
      timestamp: data.timestamp,
    });
  }

  // ===========================================================================
  // Invite Triggers
  // ===========================================================================

  /**
   * Trigger: Project invite received
   */
  async onProjectInvite(data: InviteTriggerData): Promise<TriggerResult> {
    return this.pushService.sendToUser(data.userId, {
      title: 'New Project Invitation',
      body: `${data.inviterName} invited you to join "${data.projectTitle}"`,
      type: 'invite',
      data: {
        action: 'project_invite',
        inviteId: data.inviteId,
        projectTitle: data.projectTitle,
        inviterName: data.inviterName,
      },
      actionButtons: [
        { action: 'accept', title: 'Accept' },
        { action: 'decline', title: 'Decline' },
      ],
      deepLink: `/invites/${data.inviteId}`,
    });
  }

  /**
   * Trigger: Team invite received
   */
  async onTeamInvite(data: InviteTriggerData): Promise<TriggerResult> {
    return this.pushService.sendToUser(data.userId, {
      title: 'Team Invitation',
      body: `${data.inviterName} invited you to join "${data.teamName}"`,
      type: 'invite',
      data: {
        action: 'team_invite',
        inviteId: data.inviteId,
        teamName: data.teamName,
        inviterName: data.inviterName,
      },
      actionButtons: [
        { action: 'accept', title: 'Accept' },
        { action: 'decline', title: 'Decline' },
      ],
      deepLink: `/invites/${data.inviteId}`,
    });
  }

  // ===========================================================================
  // Broadcast Triggers
  // ===========================================================================

  /**
   * Trigger: System-wide announcement
   */
  async broadcastAnnouncement(data: {
    title: string;
    body: string;
    link?: string;
    imageUrl?: string;
  }): Promise<TriggerResult> {
    return this.pushService.sendToTopic('announcements', {
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl,
      data: {
        action: 'announcement',
        link: data.link,
      },
      deepLink: data.link,
    });
  }

  /**
   * Trigger: Feature announcement
   */
  async broadcastNewFeature(data: {
    featureName: string;
    description: string;
    learnMoreLink?: string;
  }): Promise<TriggerResult> {
    return this.pushService.sendToTopic('feature-updates', {
      title: `New Feature: ${data.featureName}`,
      body: data.description,
      data: {
        action: 'new_feature',
        featureName: data.featureName,
        link: data.learnMoreLink,
      },
      deepLink: data.learnMoreLink || '/changelog',
    });
  }

  /**
   * Trigger: Maintenance notification
   */
  async broadcastMaintenance(data: {
    startTime: Date;
    endTime?: Date;
    message?: string;
  }): Promise<TriggerResult> {
    const duration = data.endTime ? ` until ${data.endTime.toLocaleTimeString()}` : '';

    return this.pushService.sendToTopic('system-alerts', {
      title: 'Scheduled Maintenance',
      body:
        data.message ||
        `System maintenance starting at ${data.startTime.toLocaleTimeString()}${duration}`,
      priority: 'high',
      data: {
        action: 'maintenance',
        startTime: data.startTime.toISOString(),
        endTime: data.endTime?.toISOString(),
      },
      deepLink: '/status',
    });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Format currency amount
   */
  private formatCurrency(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }

  /**
   * Batch trigger notifications for multiple users
   */
  async batchTrigger<T extends TriggerContext>(
    users: string[],
    triggerFn: (userId: string) => Promise<TriggerResult>,
    _options?: { concurrency?: number }
  ): Promise<Map<string, TriggerResult>> {
    const results = new Map<string, TriggerResult>();

    // Process in batches to avoid overwhelming the system
    const batchSize = _options?.concurrency || 10;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (userId) => {
          try {
            const result = await triggerFn(userId);
            return { userId, result };
          } catch (error) {
            return {
              userId,
              result: {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            };
          }
        })
      );

      batchResults.forEach(({ userId, result }) => {
        results.set(userId, result);
      });
    }

    return results;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let pushTriggersInstance: PushTriggersService | null = null;

export function getPushTriggersService(prisma: PrismaClient): PushTriggersService {
  if (!pushTriggersInstance) {
    pushTriggersInstance = new PushTriggersService(prisma);
  }
  return pushTriggersInstance;
}

export default PushTriggersService;
