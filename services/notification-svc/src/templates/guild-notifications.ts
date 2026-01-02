/**
 * Guild Notification Templates
 * Sprint M8: Guild & Agency Accounts
 *
 * Notification templates for guild events
 */

import { logger } from '@skillancer/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface NotificationData {
  type: string;
  recipientId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  data: Record<string, unknown>;
  channels: ('email' | 'push' | 'in-app')[];
}

export interface GuildNotificationContext {
  guildId: string;
  guildName: string;
  guildLogo?: string;
}

// =============================================================================
// TEMPLATES
// =============================================================================

export const GuildNotificationTemplates = {
  // ==========================================================================
  // MEMBERSHIP
  // ==========================================================================

  /**
   * Invitation to join guild
   */
  memberInvitation: (
    context: GuildNotificationContext,
    data: {
      inviteeEmail: string;
      inviterName: string;
      role: string;
      message?: string;
      inviteLink: string;
      expiresAt: Date;
    }
  ): NotificationData => ({
    type: 'guild.member.invitation',
    recipientId: '',
    recipientEmail: data.inviteeEmail,
    subject: `You've been invited to join ${context.guildName}`,
    body: `
      <h2>You're invited to join ${context.guildName}!</h2>
      <p><strong>${data.inviterName}</strong> has invited you to join their guild as a <strong>${data.role}</strong>.</p>
      ${data.message ? `<p><em>"${data.message}"</em></p>` : ''}
      <p>This invitation expires on ${data.expiresAt.toLocaleDateString()}.</p>
      <a href="${data.inviteLink}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:white;text-decoration:none;border-radius:6px;">
        Accept Invitation
      </a>
    `,
    data: { guildId: context.guildId, inviterName: data.inviterName, role: data.role },
    channels: ['email', 'in-app'],
  }),

  /**
   * Member joined guild
   */
  memberJoined: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      newMemberName: string;
      newMemberRole: string;
    }
  ): NotificationData => ({
    type: 'guild.member.joined',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `${data.newMemberName} joined ${context.guildName}`,
    body: `
      <p><strong>${data.newMemberName}</strong> has joined ${context.guildName} as a <strong>${data.newMemberRole}</strong>.</p>
      <p>Welcome them to the team!</p>
    `,
    data: { guildId: context.guildId, newMemberName: data.newMemberName },
    channels: ['in-app', 'push'],
  }),

  /**
   * Member left guild
   */
  memberLeft: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      memberName: string;
      reason?: string;
    }
  ): NotificationData => ({
    type: 'guild.member.left',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `${data.memberName} left ${context.guildName}`,
    body: `
      <p><strong>${data.memberName}</strong> has left ${context.guildName}.</p>
      ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
    `,
    data: { guildId: context.guildId, memberName: data.memberName },
    channels: ['in-app'],
  }),

  /**
   * Role updated
   */
  roleUpdated: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      oldRole: string;
      newRole: string;
      updatedBy: string;
    }
  ): NotificationData => ({
    type: 'guild.member.role_updated',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `Your role in ${context.guildName} has been updated`,
    body: `
      <p>Your role in <strong>${context.guildName}</strong> has been changed from <strong>${data.oldRole}</strong> to <strong>${data.newRole}</strong> by ${data.updatedBy}.</p>
    `,
    data: { guildId: context.guildId, oldRole: data.oldRole, newRole: data.newRole },
    channels: ['email', 'in-app', 'push'],
  }),

  // ==========================================================================
  // PROPOSALS
  // ==========================================================================

  /**
   * New proposal submitted
   */
  proposalSubmitted: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      projectName: string;
      proposedBudget: number;
      proposedTeamSize: number;
    }
  ): NotificationData => ({
    type: 'guild.proposal.submitted',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `New proposal submitted for ${context.guildName}`,
    body: `
      <p>A proposal has been submitted for project <strong>${data.projectName}</strong>.</p>
      <ul>
        <li>Proposed Budget: $${data.proposedBudget.toLocaleString()}</li>
        <li>Team Size: ${data.proposedTeamSize} members</li>
      </ul>
    `,
    data: { guildId: context.guildId, projectName: data.projectName },
    channels: ['in-app'],
  }),

  /**
   * Proposal accepted
   */
  proposalAccepted: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      projectName: string;
      clientName: string;
      budget: number;
      startDate?: Date;
    }
  ): NotificationData => ({
    type: 'guild.proposal.accepted',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `🎉 Proposal accepted! ${context.guildName} won "${data.projectName}"`,
    body: `
      <h2>Congratulations!</h2>
      <p>Your proposal for <strong>${data.projectName}</strong> has been accepted by ${data.clientName}.</p>
      <ul>
        <li>Budget: $${data.budget.toLocaleString()}</li>
        ${data.startDate ? `<li>Expected Start: ${data.startDate.toLocaleDateString()}</li>` : ''}
      </ul>
      <p>Get ready to start this exciting project!</p>
    `,
    data: { guildId: context.guildId, projectName: data.projectName, budget: data.budget },
    channels: ['email', 'in-app', 'push'],
  }),

  /**
   * Proposal rejected
   */
  proposalRejected: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      projectName: string;
      reason?: string;
    }
  ): NotificationData => ({
    type: 'guild.proposal.rejected',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `Proposal update for "${data.projectName}"`,
    body: `
      <p>Unfortunately, your proposal for <strong>${data.projectName}</strong> was not selected.</p>
      ${data.reason ? `<p>Feedback: ${data.reason}</p>` : ''}
      <p>Keep submitting proposals - your next big project is just around the corner!</p>
    `,
    data: { guildId: context.guildId, projectName: data.projectName },
    channels: ['in-app'],
  }),

  // ==========================================================================
  // PROJECTS
  // ==========================================================================

  /**
   * Project assigned
   */
  projectAssigned: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      projectName: string;
      role: string;
      allocation: number;
      projectLink: string;
    }
  ): NotificationData => ({
    type: 'guild.project.assigned',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `You've been assigned to "${data.projectName}"`,
    body: `
      <p>You've been assigned to project <strong>${data.projectName}</strong> in ${context.guildName}.</p>
      <ul>
        <li>Role: ${data.role}</li>
        <li>Allocation: ${data.allocation}%</li>
      </ul>
      <a href="${data.projectLink}">View Project Details</a>
    `,
    data: { guildId: context.guildId, projectName: data.projectName, role: data.role },
    channels: ['email', 'in-app', 'push'],
  }),

  /**
   * Project completed
   */
  projectCompleted: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      projectName: string;
      totalEarned: number;
      memberEarned: number;
    }
  ): NotificationData => ({
    type: 'guild.project.completed',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `🎉 Project "${data.projectName}" completed!`,
    body: `
      <h2>Project Complete!</h2>
      <p>Great work! <strong>${data.projectName}</strong> has been completed.</p>
      <ul>
        <li>Total Project Value: $${data.totalEarned.toLocaleString()}</li>
        <li>Your Share: $${data.memberEarned.toLocaleString()}</li>
      </ul>
    `,
    data: { guildId: context.guildId, projectName: data.projectName, earned: data.memberEarned },
    channels: ['email', 'in-app', 'push'],
  }),

  // ==========================================================================
  // FINANCES
  // ==========================================================================

  /**
   * Payout received
   */
  payoutReceived: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      amount: number;
      projectName: string;
      transactionId: string;
    }
  ): NotificationData => ({
    type: 'guild.finance.payout',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `💰 Payout of $${data.amount.toLocaleString()} received`,
    body: `
      <p>You've received a payout of <strong>$${data.amount.toLocaleString()}</strong> from ${context.guildName}.</p>
      <p>Project: ${data.projectName}</p>
      <p>Transaction ID: ${data.transactionId}</p>
    `,
    data: { guildId: context.guildId, amount: data.amount, transactionId: data.transactionId },
    channels: ['email', 'in-app', 'push'],
  }),

  /**
   * Revenue split pending approval
   */
  revenueSplitPending: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      projectName: string;
      totalAmount: number;
      memberAmount: number;
      splitLink: string;
    }
  ): NotificationData => ({
    type: 'guild.finance.split_pending',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `Revenue split pending for "${data.projectName}"`,
    body: `
      <p>A revenue split is pending approval for <strong>${data.projectName}</strong>.</p>
      <ul>
        <li>Total Amount: $${data.totalAmount.toLocaleString()}</li>
        <li>Your Share: $${data.memberAmount.toLocaleString()}</li>
      </ul>
      <a href="${data.splitLink}">Review Split Details</a>
    `,
    data: { guildId: context.guildId, projectName: data.projectName, amount: data.memberAmount },
    channels: ['email', 'in-app'],
  }),

  /**
   * Split disputed
   */
  splitDisputed: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      projectName: string;
      disputedBy: string;
      reason: string;
    }
  ): NotificationData => ({
    type: 'guild.finance.split_disputed',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `⚠️ Revenue split disputed for "${data.projectName}"`,
    body: `
      <p>A revenue split for <strong>${data.projectName}</strong> has been disputed by ${data.disputedBy}.</p>
      <p>Reason: ${data.reason}</p>
      <p>Please review and resolve this dispute.</p>
    `,
    data: { guildId: context.guildId, projectName: data.projectName, disputedBy: data.disputedBy },
    channels: ['email', 'in-app', 'push'],
  }),

  // ==========================================================================
  // GUILD EVENTS
  // ==========================================================================

  /**
   * Guild verified
   */
  guildVerified: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      verificationLevel: number;
    }
  ): NotificationData => ({
    type: 'guild.verified',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: `✅ ${context.guildName} has been verified!`,
    body: `
      <h2>Verification Complete!</h2>
      <p><strong>${context.guildName}</strong> has achieved Level ${data.verificationLevel} verification.</p>
      <p>This will improve your visibility and credibility with clients.</p>
    `,
    data: { guildId: context.guildId, verificationLevel: data.verificationLevel },
    channels: ['email', 'in-app', 'push'],
  }),

  /**
   * Leadership transferred
   */
  leadershipTransferred: (
    context: GuildNotificationContext,
    data: {
      recipientId: string;
      recipientEmail: string;
      previousLeader: string;
      newLeader: string;
      isNewLeader: boolean;
    }
  ): NotificationData => ({
    type: 'guild.leadership_transferred',
    recipientId: data.recipientId,
    recipientEmail: data.recipientEmail,
    subject: data.isNewLeader
      ? `You are now the leader of ${context.guildName}`
      : `Leadership change in ${context.guildName}`,
    body: data.isNewLeader
      ? `
        <h2>Congratulations!</h2>
        <p>You are now the leader of <strong>${context.guildName}</strong>.</p>
        <p>${data.previousLeader} has transferred leadership to you.</p>
        <p>You now have full administrative access to manage the guild.</p>
      `
      : `
        <p>Leadership of <strong>${context.guildName}</strong> has been transferred from ${data.previousLeader} to ${data.newLeader}.</p>
      `,
    data: { guildId: context.guildId, newLeader: data.newLeader },
    channels: data.isNewLeader ? ['email', 'in-app', 'push'] : ['in-app'],
  }),
};

export default GuildNotificationTemplates;
