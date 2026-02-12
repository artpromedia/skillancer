/**
 * @module @skillancer/billing-svc/services/billing-notifications
 * Billing-specific notification helpers using the notification service client
 */

import { notificationClient } from '@skillancer/service-client';
import { logger } from '../lib/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface NotificationContext {
  userId: string;
  email?: string;
}

export interface PaymentNotificationData {
  amount: string;
  currency?: string;
  description?: string;
  invoiceNumber?: string;
  contractTitle?: string;
}

export interface EscrowNotificationData {
  contractId: string;
  contractTitle: string;
  milestoneId?: string;
  milestoneName?: string;
  amount: string;
  currency?: string;
}

export interface DisputeNotificationData {
  disputeId: string;
  contractId: string;
  contractTitle: string;
  reason: string;
  amount?: string;
}

// ============================================================================
// Billing Notification Service
// ============================================================================

class BillingNotificationService {
  /**
   * Notify freelancer that escrow has been funded
   */
  async notifyEscrowFunded(
    freelancer: NotificationContext,
    data: EscrowNotificationData
  ): Promise<void> {
    try {
      await notificationClient.sendNotification({
        userId: freelancer.userId,
        type: 'payment_received',
        title: 'Escrow Funded',
        message: `Escrow of ${data.amount} has been funded for "${data.contractTitle}"`,
        channels: ['in_app', 'email', 'push'],
        data: {
          contractId: data.contractId,
          milestoneName: data.milestoneName,
          amount: data.amount,
        },
      });

      logger.info(
        { userId: freelancer.userId, contractId: data.contractId },
        'Escrow funded notification sent'
      );
    } catch (error) {
      logger.error(
        { userId: freelancer.userId, error },
        'Failed to send escrow funded notification'
      );
    }
  }

  /**
   * Notify client about milestone submission for review
   */
  async notifyMilestoneSubmitted(
    client: NotificationContext,
    data: EscrowNotificationData
  ): Promise<void> {
    try {
      await notificationClient.sendNotification({
        userId: client.userId,
        type: 'milestone_approved',
        title: 'Milestone Ready for Review',
        message: `Milestone "${data.milestoneName}" is ready for your review`,
        channels: ['in_app', 'email', 'push'],
        data: {
          contractId: data.contractId,
          milestoneId: data.milestoneId,
          milestoneName: data.milestoneName,
        },
      });

      logger.info(
        { userId: client.userId, contractId: data.contractId, milestoneId: data.milestoneId },
        'Milestone submitted notification sent'
      );
    } catch (error) {
      logger.error(
        { userId: client.userId, error },
        'Failed to send milestone submitted notification'
      );
    }
  }

  /**
   * Notify freelancer that milestone has been approved
   */
  async notifyMilestoneApproved(
    freelancer: NotificationContext,
    data: EscrowNotificationData
  ): Promise<void> {
    try {
      await notificationClient.sendNotification({
        userId: freelancer.userId,
        type: 'milestone_approved',
        title: 'Milestone Approved',
        message: `Your milestone "${data.milestoneName}" has been approved. Payment of ${data.amount} is being processed.`,
        channels: ['in_app', 'email', 'push'],
        data: {
          contractId: data.contractId,
          milestoneId: data.milestoneId,
          amount: data.amount,
        },
      });

      logger.info(
        { userId: freelancer.userId, milestoneId: data.milestoneId },
        'Milestone approved notification sent'
      );
    } catch (error) {
      logger.error(
        { userId: freelancer.userId, error },
        'Failed to send milestone approved notification'
      );
    }
  }

  /**
   * Notify freelancer that milestone has been rejected
   */
  async notifyMilestoneRejected(
    freelancer: NotificationContext,
    data: EscrowNotificationData & { reason?: string }
  ): Promise<void> {
    try {
      await notificationClient.sendNotification({
        userId: freelancer.userId,
        type: 'milestone_rejected',
        title: 'Milestone Needs Revision',
        message: `Your milestone "${data.milestoneName}" needs revision.${data.reason ? ` Reason: ${data.reason}` : ''}`,
        channels: ['in_app', 'email', 'push'],
        data: {
          contractId: data.contractId,
          milestoneId: data.milestoneId,
          reason: data.reason,
        },
      });

      logger.info(
        { userId: freelancer.userId, milestoneId: data.milestoneId },
        'Milestone rejected notification sent'
      );
    } catch (error) {
      logger.error(
        { userId: freelancer.userId, error },
        'Failed to send milestone rejected notification'
      );
    }
  }

  /**
   * Notify about auto-approved milestone
   */
  async notifyMilestoneAutoApproved(
    client: NotificationContext,
    freelancer: NotificationContext,
    data: EscrowNotificationData
  ): Promise<void> {
    try {
      // Notify client
      await notificationClient.sendNotification({
        userId: client.userId,
        type: 'milestone_approved',
        title: 'Milestone Auto-Approved',
        message: `Milestone "${data.milestoneName}" was automatically approved after the review period expired.`,
        channels: ['in_app', 'email'],
        data: {
          contractId: data.contractId,
          milestoneId: data.milestoneId,
        },
      });

      // Notify freelancer
      await notificationClient.sendNotification({
        userId: freelancer.userId,
        type: 'milestone_approved',
        title: 'Milestone Auto-Approved',
        message: `Your milestone "${data.milestoneName}" has been auto-approved. Payment of ${data.amount} is being processed.`,
        channels: ['in_app', 'email', 'push'],
        data: {
          contractId: data.contractId,
          milestoneId: data.milestoneId,
          amount: data.amount,
        },
      });

      logger.info(
        { clientId: client.userId, freelancerId: freelancer.userId, milestoneId: data.milestoneId },
        'Milestone auto-approved notifications sent'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to send milestone auto-approved notification');
    }
  }

  /**
   * Notify about payment received
   */
  async notifyPaymentReceived(
    user: NotificationContext,
    data: PaymentNotificationData
  ): Promise<void> {
    try {
      await notificationClient.sendNotification({
        userId: user.userId,
        type: 'payment_received',
        title: 'Payment Received',
        message: `You received a payment of ${data.amount}${data.description ? ` for ${data.description}` : ''}`,
        channels: ['in_app', 'email', 'push'],
        data: {
          amount: data.amount,
          description: data.description,
        },
      });

      if (user.email) {
        await notificationClient.sendPaymentReceived(user.userId, user.email, {
          amount: data.amount,
          description: data.description || 'Payment',
          date: new Date().toISOString(),
        });
      }

      logger.info(
        { userId: user.userId, amount: data.amount },
        'Payment received notification sent'
      );
    } catch (error) {
      logger.error({ userId: user.userId, error }, 'Failed to send payment received notification');
    }
  }

  /**
   * Notify about payment failure
   */
  async notifyPaymentFailed(
    user: NotificationContext,
    data: PaymentNotificationData & { reason?: string }
  ): Promise<void> {
    try {
      await notificationClient.sendNotification({
        userId: user.userId,
        type: 'account_update',
        title: 'Payment Failed',
        message: `Your payment of ${data.amount} failed.${data.reason ? ` Reason: ${data.reason}` : ''} Please update your payment method.`,
        channels: ['in_app', 'email', 'push'],
        data: {
          amount: data.amount,
          reason: data.reason,
        },
      });

      logger.info({ userId: user.userId, amount: data.amount }, 'Payment failed notification sent');
    } catch (error) {
      logger.error({ userId: user.userId, error }, 'Failed to send payment failed notification');
    }
  }

  /**
   * Notify about dispute opened
   */
  async notifyDisputeOpened(
    parties: { client: NotificationContext; freelancer: NotificationContext },
    data: DisputeNotificationData
  ): Promise<void> {
    try {
      // Notify both parties
      await notificationClient.sendBulkNotification({
        userIds: [parties.client.userId, parties.freelancer.userId],
        type: 'system',
        title: 'Dispute Opened',
        message: `A dispute has been opened for "${data.contractTitle}". Our support team will review the case.`,
        channels: ['in_app', 'email'],
        data: {
          disputeId: data.disputeId,
          contractId: data.contractId,
          reason: data.reason,
        },
      });

      logger.info(
        { disputeId: data.disputeId, contractId: data.contractId },
        'Dispute opened notifications sent'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to send dispute opened notification');
    }
  }

  /**
   * Notify about dispute resolved
   */
  async notifyDisputeResolved(
    parties: { client: NotificationContext; freelancer: NotificationContext },
    data: DisputeNotificationData & { resolution: string }
  ): Promise<void> {
    try {
      await notificationClient.sendBulkNotification({
        userIds: [parties.client.userId, parties.freelancer.userId],
        type: 'system',
        title: 'Dispute Resolved',
        message: `The dispute for "${data.contractTitle}" has been resolved.`,
        channels: ['in_app', 'email'],
        data: {
          disputeId: data.disputeId,
          contractId: data.contractId,
          resolution: data.resolution,
        },
      });

      logger.info(
        { disputeId: data.disputeId, contractId: data.contractId },
        'Dispute resolved notifications sent'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to send dispute resolved notification');
    }
  }

  /**
   * Notify about card expiring soon
   */
  async notifyCardExpiring(
    user: NotificationContext,
    data: { last4: string; expiryMonth: number; expiryYear: number; daysUntilExpiry: number }
  ): Promise<void> {
    try {
      await notificationClient.sendNotification({
        userId: user.userId,
        type: 'account_update',
        title: 'Card Expiring Soon',
        message: `Your card ending in ${data.last4} expires in ${data.daysUntilExpiry} days. Please update your payment method.`,
        channels: ['in_app', 'email'],
        data: {
          last4: data.last4,
          expiryMonth: data.expiryMonth,
          expiryYear: data.expiryYear,
        },
      });

      logger.info({ userId: user.userId, last4: data.last4 }, 'Card expiring notification sent');
    } catch (error) {
      logger.error({ userId: user.userId, error }, 'Failed to send card expiring notification');
    }
  }

  /**
   * Notify about card auto-updated
   */
  async notifyCardAutoUpdated(
    user: NotificationContext,
    data: { oldLast4: string; newLast4: string }
  ): Promise<void> {
    try {
      await notificationClient.sendNotification({
        userId: user.userId,
        type: 'account_update',
        title: 'Card Updated Automatically',
        message: `Your card ending in ${data.oldLast4} has been automatically updated to ${data.newLast4} by your bank.`,
        channels: ['in_app', 'email'],
        data: {
          oldLast4: data.oldLast4,
          newLast4: data.newLast4,
        },
      });

      logger.info({ userId: user.userId }, 'Card auto-updated notification sent');
    } catch (error) {
      logger.error({ userId: user.userId, error }, 'Failed to send card auto-updated notification');
    }
  }

  /**
   * Send security alert for suspicious billing activity
   */
  async sendSecurityAlert(
    user: NotificationContext,
    data: { alertType: string; description: string; ipAddress?: string }
  ): Promise<void> {
    try {
      if (user.email) {
        await notificationClient.sendSecurityAlert(user.userId, user.email, {
          alertType: data.alertType,
          description: data.description,
          ipAddress: data.ipAddress,
          timestamp: new Date().toISOString(),
        });
      }

      await notificationClient.sendNotification({
        userId: user.userId,
        type: 'system',
        title: 'Security Alert',
        message: data.description,
        channels: ['in_app', 'push'],
        data: {
          alertType: data.alertType,
        },
      });

      logger.warn({ userId: user.userId, alertType: data.alertType }, 'Security alert sent');
    } catch (error) {
      logger.error({ userId: user.userId, error }, 'Failed to send security alert');
    }
  }

  /**
   * Alert operations team about critical issues
   */
  async alertOpsTeam(data: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    // In production, this would alert to Slack, PagerDuty, etc.
    // For now, log with high visibility
    const logMethod = data.severity === 'critical' ? 'error' : 'warn';
    logger[logMethod](
      { message: data.message, context: data.context, timestamp: new Date().toISOString() },
      `[OPS ALERT - ${data.severity.toUpperCase()}] ${data.title}`
    );

    // TODO: Integrate with actual alerting services
    // - Slack webhook for non-critical
    // - PagerDuty for critical
    // - Email to ops@skillancer.com
  }
}

// Export singleton instance
export const billingNotifications = new BillingNotificationService();
