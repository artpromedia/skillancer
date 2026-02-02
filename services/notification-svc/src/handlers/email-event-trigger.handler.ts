/**
 * Email Event Triggers
 *
 * Event listeners that trigger email notifications based on platform events.
 * Integrates with the notification service to send appropriate emails.
 *
 * Events handled:
 * - user.registered → send welcome email
 * - proposal.created → notify client
 * - proposal.accepted → notify freelancer
 * - message.received → send if user offline
 * - payment.completed → send receipt
 * - contract.milestone → send update
 */

import { Prisma } from '@prisma/client';

import { getConfig } from '../config/index.js';
import { getEmailLoggingService } from '../services/email-logging.service.js';
import { EmailService } from '../services/email.service.js';

import type { EmailNotificationInput } from '../types/notification.types.js';
import type { PrismaClient, Notification } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface EventPayload {
  eventType: EventType;
  timestamp: Date;
  data: Record<string, unknown>;
  userId: string;
  tenantId?: string;
}

export type EventType =
  | 'user.registered'
  | 'proposal.created'
  | 'proposal.accepted'
  | 'proposal.rejected'
  | 'message.received'
  | 'payment.completed'
  | 'payment.received'
  | 'contract.milestone.completed'
  | 'contract.milestone.approved'
  | 'contract.started'
  | 'contract.completed'
  | 'security.login'
  | 'security.password_changed';

export interface UserRegisteredData {
  userId: string;
  email: string;
  firstName: string;
  lastName?: string;
  userType: 'freelancer' | 'client' | 'agency';
  verificationToken?: string;
}

export interface ProposalCreatedData {
  proposalId: string;
  jobId: string;
  jobTitle: string;
  freelancerId: string;
  freelancerName: string;
  clientId: string;
  clientEmail: string;
  coverLetter: string;
  proposedRate: number;
  proposedTimeline?: string;
  freelancerRating?: number;
  freelancerJobsCompleted?: number;
}

export interface ProposalAcceptedData {
  proposalId: string;
  jobId: string;
  jobTitle: string;
  freelancerId: string;
  freelancerEmail: string;
  freelancerName: string;
  clientId: string;
  clientName: string;
  agreedRate: number;
  startDate?: string;
}

export interface MessageReceivedData {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientEmail: string;
  recipientOnline: boolean;
  preview: string;
  subject?: string;
}

export interface PaymentCompletedData {
  paymentId: string;
  contractId: string;
  contractTitle: string;
  payerId: string;
  payerEmail: string;
  payerName: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  invoiceUrl?: string;
  milestoneTitle?: string;
}

export interface ContractMilestoneData {
  milestoneId: string;
  contractId: string;
  contractTitle: string;
  milestoneTitle: string;
  milestoneNumber: number;
  totalMilestones: number;
  freelancerId: string;
  freelancerEmail: string;
  freelancerName: string;
  clientId: string;
  clientEmail: string;
  clientName: string;
  amount: number;
  currency: string;
  status: 'completed' | 'approved' | 'in_progress';
  nextMilestoneTitle?: string;
  completionPercentage: number;
}

// ============================================================================
// Event Trigger Service
// ============================================================================

export class EmailEventTrigger {
  private readonly prisma: PrismaClient;
  private readonly emailService: EmailService;
  private readonly config: ReturnType<typeof getConfig>;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.emailService = new EmailService();
    this.config = getConfig();
  }

  /**
   * Process an event and trigger appropriate email notification
   */
  async processEvent(event: EventPayload): Promise<void> {
    const loggingService = getEmailLoggingService();

    try {
      console.log(`[EmailEventTrigger] Processing event: ${event.eventType}`);

      switch (event.eventType) {
        case 'user.registered':
          await this.handleUserRegistered(event.data as unknown as UserRegisteredData);
          break;
        case 'proposal.created':
          await this.handleProposalCreated(event.data as unknown as ProposalCreatedData);
          break;
        case 'proposal.accepted':
          await this.handleProposalAccepted(event.data as unknown as ProposalAcceptedData);
          break;
        case 'message.received':
          await this.handleMessageReceived(event.data as unknown as MessageReceivedData);
          break;
        case 'payment.completed':
        case 'payment.received':
          await this.handlePaymentCompleted(event.data as unknown as PaymentCompletedData);
          break;
        case 'contract.milestone.completed':
        case 'contract.milestone.approved':
          await this.handleContractMilestone(event.data as unknown as ContractMilestoneData);
          break;
        default:
          console.log(`[EmailEventTrigger] Unhandled event type: ${event.eventType}`);
      }
    } catch (error) {
      console.error(`[EmailEventTrigger] Error processing event ${event.eventType}:`, error);
      loggingService.logEvent({
        emailId: `event-${event.eventType}-${Date.now()}`,
        event: 'dropped',
        recipient: (event.data.email as string) || 'unknown',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle user.registered event - send welcome email
   */
  private async handleUserRegistered(data: UserRegisteredData): Promise<void> {
    // Check if user has email notifications enabled (new users default to enabled)
    const canSend = await this.checkEmailPreference(data.userId, 'SYSTEM');
    if (!canSend) {
      console.log(`[EmailEventTrigger] User ${data.userId} has disabled system emails`);
      return;
    }

    const emailInput: EmailNotificationInput = {
      userId: data.userId,
      emailType: 'WELCOME',
      to: data.email,
      subject: `Welcome to Skillancer, ${data.firstName}!`,
      channels: ['EMAIL'],
      priority: 'HIGH',
      templateData: {
        firstName: data.firstName,
        lastName: data.lastName || '',
        userType: data.userType,
        verificationLink: data.verificationToken
          ? `${this.config.appBaseUrl || 'https://skillancer.com'}/verify-email?token=${data.verificationToken}`
          : undefined,
        dashboardLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard`,
        helpLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/help`,
      },
    };

    await this.sendEmail(emailInput, data.userId);
  }

  /**
   * Handle proposal.created event - notify client about new proposal
   */
  private async handleProposalCreated(data: ProposalCreatedData): Promise<void> {
    const canSend = await this.checkEmailPreference(data.clientId, 'PROPOSALS');
    if (!canSend) {
      console.log(`[EmailEventTrigger] Client ${data.clientId} has disabled proposal emails`);
      return;
    }

    const emailInput: EmailNotificationInput = {
      userId: data.clientId,
      emailType: 'PROPOSAL_RECEIVED',
      to: data.clientEmail,
      subject: `New proposal for "${data.jobTitle}"`,
      channels: ['EMAIL'],
      priority: 'NORMAL',
      templateData: {
        jobTitle: data.jobTitle,
        freelancerName: data.freelancerName,
        coverLetterPreview: data.coverLetter.slice(0, 200),
        proposedRate: data.proposedRate,
        proposedTimeline: data.proposedTimeline,
        freelancerRating: data.freelancerRating,
        freelancerJobsCompleted: data.freelancerJobsCompleted,
        viewProposalLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/proposals/${data.proposalId}`,
        jobLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/jobs/${data.jobId}`,
      },
    };

    await this.sendEmail(emailInput, data.clientId);
  }

  /**
   * Handle proposal.accepted event - notify freelancer
   */
  private async handleProposalAccepted(data: ProposalAcceptedData): Promise<void> {
    const canSend = await this.checkEmailPreference(data.freelancerId, 'PROPOSALS');
    if (!canSend) {
      console.log(
        `[EmailEventTrigger] Freelancer ${data.freelancerId} has disabled proposal emails`
      );
      return;
    }

    const emailInput: EmailNotificationInput = {
      userId: data.freelancerId,
      emailType: 'PROPOSAL_ACCEPTED',
      to: data.freelancerEmail,
      subject: `🎉 Your proposal for "${data.jobTitle}" was accepted!`,
      channels: ['EMAIL'],
      priority: 'HIGH',
      templateData: {
        freelancerName: data.freelancerName,
        jobTitle: data.jobTitle,
        clientName: data.clientName,
        agreedRate: data.agreedRate,
        startDate: data.startDate,
        contractLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/contracts`,
        messageLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/messages`,
      },
    };

    await this.sendEmail(emailInput, data.freelancerId);
  }

  /**
   * Handle message.received event - send notification if user is offline
   */
  private async handleMessageReceived(data: MessageReceivedData): Promise<void> {
    // Only send email if user is offline
    if (data.recipientOnline) {
      console.log(`[EmailEventTrigger] User ${data.recipientId} is online, skipping email`);
      return;
    }

    const canSend = await this.checkEmailPreference(data.recipientId, 'MESSAGES');
    if (!canSend) {
      console.log(`[EmailEventTrigger] User ${data.recipientId} has disabled message emails`);
      return;
    }

    // Check if we've sent a message notification recently (rate limiting)
    const recentNotification = await this.getRecentNotification(
      data.recipientId,
      'MESSAGE_RECEIVED',
      5 * 60 * 1000 // 5 minutes
    );

    if (recentNotification) {
      console.log(`[EmailEventTrigger] Recent message notification exists, skipping`);
      return;
    }

    const emailInput: EmailNotificationInput = {
      userId: data.recipientId,
      emailType: 'MESSAGE_RECEIVED',
      to: data.recipientEmail,
      subject: `New message from ${data.senderName}`,
      channels: ['EMAIL'],
      priority: 'NORMAL',
      templateData: {
        senderName: data.senderName,
        messagePreview: data.preview.slice(0, 100),
        conversationLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/messages/${data.conversationId}`,
      },
    };

    await this.sendEmail(emailInput, data.recipientId);
  }

  /**
   * Handle payment.completed event - send receipt to both parties
   */
  private async handlePaymentCompleted(data: PaymentCompletedData): Promise<void> {
    // Send receipt to payer
    const payerCanReceive = await this.checkEmailPreference(data.payerId, 'PAYMENTS');
    if (payerCanReceive) {
      const payerEmail: EmailNotificationInput = {
        userId: data.payerId,
        emailType: 'PAYMENT_SENT',
        to: data.payerEmail,
        subject: `Payment sent: ${this.formatCurrency(data.amount, data.currency)} for "${data.contractTitle}"`,
        channels: ['EMAIL'],
        priority: 'HIGH',
        templateData: {
          payerName: data.payerName,
          recipientName: data.recipientName,
          amount: data.amount,
          currency: data.currency,
          contractTitle: data.contractTitle,
          milestoneTitle: data.milestoneTitle,
          paymentMethod: data.paymentMethod,
          invoiceUrl: data.invoiceUrl,
          transactionDate: new Date().toISOString(),
          contractLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/contracts/${data.contractId}`,
        },
      };
      await this.sendEmail(payerEmail, data.payerId);
    }

    // Send notification to recipient
    const recipientCanReceive = await this.checkEmailPreference(data.recipientId, 'PAYMENTS');
    if (recipientCanReceive) {
      const recipientEmail: EmailNotificationInput = {
        userId: data.recipientId,
        emailType: 'PAYMENT_RECEIVED',
        to: data.recipientEmail,
        subject: `Payment received: ${this.formatCurrency(data.amount, data.currency)} for "${data.contractTitle}"`,
        channels: ['EMAIL'],
        priority: 'HIGH',
        templateData: {
          recipientName: data.recipientName,
          payerName: data.payerName,
          amount: data.amount,
          currency: data.currency,
          contractTitle: data.contractTitle,
          milestoneTitle: data.milestoneTitle,
          transactionDate: new Date().toISOString(),
          earningsLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/earnings`,
        },
      };
      await this.sendEmail(recipientEmail, data.recipientId);
    }
  }

  /**
   * Handle contract.milestone event - send update to both parties
   */
  private async handleContractMilestone(data: ContractMilestoneData): Promise<void> {
    const isCompleted = data.status === 'completed';
    const isApproved = data.status === 'approved';

    // Notify client about milestone completion
    if (isCompleted) {
      const clientCanReceive = await this.checkEmailPreference(data.clientId, 'CONTRACTS');
      if (clientCanReceive) {
        const clientEmail: EmailNotificationInput = {
          userId: data.clientId,
          emailType: 'MILESTONE_COMPLETED',
          to: data.clientEmail,
          subject: `Milestone completed: "${data.milestoneTitle}" - ${data.contractTitle}`,
          channels: ['EMAIL'],
          priority: 'HIGH',
          templateData: {
            clientName: data.clientName,
            freelancerName: data.freelancerName,
            contractTitle: data.contractTitle,
            milestoneTitle: data.milestoneTitle,
            milestoneNumber: data.milestoneNumber,
            totalMilestones: data.totalMilestones,
            completionPercentage: data.completionPercentage,
            amount: data.amount,
            currency: data.currency,
            reviewLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/contracts/${data.contractId}/milestones/${data.milestoneId}`,
          },
        };
        await this.sendEmail(clientEmail, data.clientId);
      }
    }

    // Notify freelancer about milestone approval
    if (isApproved) {
      const freelancerCanReceive = await this.checkEmailPreference(data.freelancerId, 'CONTRACTS');
      if (freelancerCanReceive) {
        const freelancerEmail: EmailNotificationInput = {
          userId: data.freelancerId,
          emailType: 'MILESTONE_COMPLETED',
          to: data.freelancerEmail,
          subject: `🎉 Milestone approved: "${data.milestoneTitle}" - Payment released!`,
          channels: ['EMAIL'],
          priority: 'HIGH',
          templateData: {
            freelancerName: data.freelancerName,
            clientName: data.clientName,
            contractTitle: data.contractTitle,
            milestoneTitle: data.milestoneTitle,
            milestoneNumber: data.milestoneNumber,
            totalMilestones: data.totalMilestones,
            completionPercentage: data.completionPercentage,
            amount: data.amount,
            currency: data.currency,
            nextMilestoneTitle: data.nextMilestoneTitle,
            contractLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/contracts/${data.contractId}`,
            earningsLink: `${this.config.appBaseUrl || 'https://skillancer.com'}/dashboard/earnings`,
          },
        };
        await this.sendEmail(freelancerEmail, data.freelancerId);
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Check if user has email notifications enabled for a category
   */
  private async checkEmailPreference(userId: string, notificationType: string): Promise<boolean> {
    try {
      const preference = await this.prisma.notificationPreference.findUnique({
        where: {
          userId_notificationType: {
            userId,
            notificationType: notificationType.toUpperCase(),
          },
        },
      });

      // Default to enabled if no preference exists
      return preference?.emailEnabled ?? true;
    } catch (error) {
      console.error(`[EmailEventTrigger] Error checking preference:`, error);
      return true; // Default to sending if we can't check
    }
  }

  /**
   * Check for recent notification to implement rate limiting
   */
  private async getRecentNotification(
    userId: string,
    type: string,
    withinMs: number
  ): Promise<Notification | null> {
    try {
      const cutoff = new Date(Date.now() - withinMs);
      return await this.prisma.notification.findFirst({
        where: {
          userId,
          type,
          createdAt: { gte: cutoff },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error(`[EmailEventTrigger] Error checking recent notification:`, error);
      return null;
    }
  }

  /**
   * Send email and log it
   */
  private async sendEmail(input: EmailNotificationInput, userId: string): Promise<void> {
    try {
      const result = await this.emailService.sendEmail(input);

      if (result.success) {
        console.log(`[EmailEventTrigger] Email sent successfully to ${input.to}`);
      } else {
        console.error(`[EmailEventTrigger] Failed to send email: ${result.error}`);
      }

      // Log the notification
      await this.prisma.notification.create({
        data: {
          userId,
          type: input.emailType,
          category: 'SYSTEM',
          priority: input.priority || 'NORMAL',
          title: input.subject,
          body: `Email sent to ${input.to}`,
          channels: ['EMAIL'],
          deliveryStatus: {
            email: result.success ? 'SENT' : 'FAILED',
            messageId: result.messageId,
            error: result.error,
          },
          data: (input.templateData as Prisma.InputJsonValue) ?? Prisma.DbNull,
        },
      });
    } catch (error) {
      console.error(`[EmailEventTrigger] Error sending email:`, error);
      throw error;
    }
  }

  /**
   * Format currency amount
   */
  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let emailEventTrigger: EmailEventTrigger | null = null;

export function getEmailEventTrigger(prisma?: PrismaClient): EmailEventTrigger {
  if (!emailEventTrigger && prisma) {
    emailEventTrigger = new EmailEventTrigger(prisma);
  }
  if (!emailEventTrigger) {
    throw new Error('EmailEventTrigger not initialized. Call with PrismaClient first.');
  }
  return emailEventTrigger;
}

export function initializeEmailEventTrigger(prisma: PrismaClient): EmailEventTrigger {
  emailEventTrigger = new EmailEventTrigger(prisma);
  return emailEventTrigger;
}
