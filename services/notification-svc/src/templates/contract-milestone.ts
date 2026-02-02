/**
 * Contract Milestone Email Template
 *
 * Sent when milestone events occur (created, completed, approved, etc.)
 */

import {
  wrapEmailContent,
  htmlToPlainText,
  commonStyles,
  styleToString,
  createButton,
  createCard,
  BRAND_COLORS,
  formatCurrency,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

export type MilestoneEventType =
  | 'created'
  | 'funded'
  | 'submitted'
  | 'approved'
  | 'revision_requested'
  | 'cancelled';

export interface ContractMilestoneEmailData {
  recipientName: string;
  recipientRole: 'client' | 'freelancer';
  eventType: MilestoneEventType;
  milestoneName: string;
  milestoneNumber: number;
  totalMilestones: number;
  projectTitle: string;
  clientName: string;
  freelancerName: string;
  milestoneAmount: number;
  milestoneCurrency?: string;
  dueDate?: Date;
  submissionNote?: string;
  revisionNote?: string;
  milestoneUrl: string;
  projectUrl?: string;
  unsubscribeUrl?: string;
}

// ============================================================================
// Helpers
// ============================================================================

interface EventConfig {
  emoji: string;
  title: string;
  getMessage: (data: ContractMilestoneEmailData) => string;
  ctaText: string;
  statusColor: string;
}

function getEventConfig(eventType: MilestoneEventType, recipientRole: string): EventConfig {
  const isClient = recipientRole === 'client';

  const configs: Record<MilestoneEventType, EventConfig> = {
    created: {
      emoji: '📋',
      title: 'New Milestone Created',
      getMessage: (data) =>
        isClient
          ? `You've created a new milestone for your project with ${data.freelancerName}.`
          : `${data.clientName} has created a new milestone for your project.`,
      ctaText: 'View Milestone',
      statusColor: BRAND_COLORS.primary,
    },
    funded: {
      emoji: '💰',
      title: 'Milestone Funded',
      getMessage: (data) =>
        isClient
          ? `You've funded the milestone. ${data.freelancerName} can now start working on it.`
          : `Great news! ${data.clientName} has funded this milestone. You can start working now!`,
      ctaText: isClient ? 'View Milestone' : 'Start Working',
      statusColor: BRAND_COLORS.success,
    },
    submitted: {
      emoji: '✅',
      title: 'Milestone Submitted for Review',
      getMessage: (data) =>
        isClient
          ? `${data.freelancerName} has submitted this milestone for your review.`
          : `You've submitted this milestone for review. Waiting for ${data.clientName}'s approval.`,
      ctaText: isClient ? 'Review Submission' : 'View Submission',
      statusColor: '#F59E0B',
    },
    approved: {
      emoji: '🎉',
      title: 'Milestone Approved!',
      getMessage: (data) =>
        isClient
          ? `You've approved this milestone. Payment will be released to ${data.freelancerName}.`
          : `Congratulations! ${data.clientName} has approved your work. Payment is on its way!`,
      ctaText: 'View Details',
      statusColor: BRAND_COLORS.success,
    },
    revision_requested: {
      emoji: '🔄',
      title: 'Revision Requested',
      getMessage: (data) =>
        isClient
          ? `You've requested revisions for this milestone from ${data.freelancerName}.`
          : `${data.clientName} has requested some revisions for this milestone.`,
      ctaText: isClient ? 'View Milestone' : 'View Feedback',
      statusColor: '#F59E0B',
    },
    cancelled: {
      emoji: '❌',
      title: 'Milestone Cancelled',
      getMessage: (data) =>
        `The milestone has been cancelled. Any escrowed funds will be handled according to your contract terms.`,
      ctaText: 'View Project',
      statusColor: BRAND_COLORS.error,
    },
  };

  return configs[eventType];
}

function getMilestoneStatusBadge(eventType: MilestoneEventType): {
  label: string;
  bgColor: string;
  textColor: string;
} {
  const badges: Record<MilestoneEventType, { label: string; bgColor: string; textColor: string }> =
    {
      created: { label: 'Created', bgColor: '#EFF6FF', textColor: '#1D4ED8' },
      funded: { label: 'Funded', bgColor: '#ECFDF5', textColor: '#059669' },
      submitted: { label: 'Under Review', bgColor: '#FEF3C7', textColor: '#D97706' },
      approved: { label: 'Approved', bgColor: '#ECFDF5', textColor: '#059669' },
      revision_requested: { label: 'Revision Needed', bgColor: '#FEF3C7', textColor: '#D97706' },
      cancelled: { label: 'Cancelled', bgColor: '#FEE2E2', textColor: '#DC2626' },
    };
  return badges[eventType];
}

function getTipsSection(eventType: MilestoneEventType, recipientRole: string): string {
  if (eventType === 'submitted' && recipientRole === 'client') {
    return `
    <div style="${styleToString(commonStyles.card)}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0', marginBottom: '8px' })}">
        💡 Review Tips
      </h4>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
        <li style="margin-bottom: 4px;">Review the deliverables against your requirements</li>
        <li style="margin-bottom: 4px;">Test functionality if applicable</li>
        <li style="margin-bottom: 4px;">Provide clear feedback if revisions are needed</li>
        <li>Approve within 14 days to release payment automatically</li>
      </ul>
    </div>
    `;
  }

  if (eventType === 'revision_requested' && recipientRole === 'freelancer') {
    return `
    <div style="${styleToString(commonStyles.card)}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0', marginBottom: '8px' })}">
        💡 Revision Tips
      </h4>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
        <li style="margin-bottom: 4px;">Review the feedback carefully</li>
        <li style="margin-bottom: 4px;">Ask questions if anything is unclear</li>
        <li style="margin-bottom: 4px;">Make the requested changes</li>
        <li>Re-submit when ready for another review</li>
      </ul>
    </div>
    `;
  }

  return '';
}

// ============================================================================
// Template
// ============================================================================

export function generateContractMilestoneEmail(data: ContractMilestoneEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    recipientName,
    recipientRole,
    eventType,
    milestoneName,
    milestoneNumber,
    totalMilestones,
    projectTitle,
    clientName,
    freelancerName,
    milestoneAmount,
    milestoneCurrency = 'USD',
    dueDate,
    submissionNote,
    revisionNote,
    milestoneUrl,
    projectUrl,
    unsubscribeUrl,
  } = data;

  const config = getEventConfig(eventType, recipientRole);
  const statusBadge = getMilestoneStatusBadge(eventType);
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const progressPercent = Math.round((milestoneNumber / totalMilestones) * 100);

  const body = `
    <h1 style="${styleToString(commonStyles.heading1)}">
      ${config.emoji} ${config.title}
    </h1>
    
    <p style="${styleToString(commonStyles.paragraph)}">
      Hi ${recipientName},
    </p>

    <p style="${styleToString(commonStyles.paragraph)}">
      ${config.getMessage(data)}
    </p>

    ${createCard(`
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
        <div>
          <h3 style="${styleToString({ ...commonStyles.heading2, marginTop: '0', marginBottom: '4px' })}">
            ${milestoneName}
          </h3>
          <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', color: BRAND_COLORS.muted, marginBottom: '0' })}">
            Milestone ${milestoneNumber} of ${totalMilestones} • ${projectTitle}
          </p>
        </div>
        <span style="
          display: inline-block;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
          background-color: ${statusBadge.bgColor};
          color: ${statusBadge.textColor};
          border-radius: 9999px;
        ">${statusBadge.label}</span>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom: 16px;">
        <div style="
          height: 8px;
          background-color: ${BRAND_COLORS.backgroundAlt};
          border-radius: 4px;
          overflow: hidden;
        ">
          <div style="
            width: ${progressPercent}%;
            height: 100%;
            background-color: ${BRAND_COLORS.primary};
            border-radius: 4px;
          "></div>
        </div>
        <p style="font-size: 12px; color: ${BRAND_COLORS.muted}; margin-top: 4px; margin-bottom: 0;">
          Project progress: ${milestoneNumber}/${totalMilestones} milestones
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Amount
          </td>
          <td style="padding: 8px 0; border-top: 1px solid ${BRAND_COLORS.border}; text-align: right; font-weight: 600; color: ${BRAND_COLORS.success};">
            ${formatCurrency(milestoneAmount, milestoneCurrency)}
          </td>
        </tr>
        ${
          formattedDueDate
            ? `
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Due Date
          </td>
          <td style="padding: 8px 0; border-top: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${formattedDueDate}
          </td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            ${recipientRole === 'client' ? 'Freelancer' : 'Client'}
          </td>
          <td style="padding: 8px 0; border-top: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${recipientRole === 'client' ? freelancerName : clientName}
          </td>
        </tr>
      </table>
    `)}

    ${
      submissionNote && eventType === 'submitted'
        ? `
    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#F9FAFB', marginTop: '16px' })}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0', marginBottom: '8px' })}">
        📝 Submission Note
      </h4>
      <p style="${styleToString({ ...commonStyles.paragraph, marginBottom: '0', fontStyle: 'italic' })}">
        "${submissionNote}"
      </p>
    </div>
    `
        : ''
    }

    ${
      revisionNote && eventType === 'revision_requested'
        ? `
    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#FEF3C7', borderColor: '#F59E0B', marginTop: '16px' })}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0', marginBottom: '8px' })}">
        📝 Revision Feedback
      </h4>
      <p style="${styleToString({ ...commonStyles.paragraph, marginBottom: '0' })}">
        "${revisionNote}"
      </p>
    </div>
    `
        : ''
    }

    <div style="text-align: center; margin: 32px 0;">
      ${createButton(config.ctaText, milestoneUrl)}
    </div>

    ${
      projectUrl
        ? `
    <p style="${styleToString({ ...commonStyles.paragraph, textAlign: 'center' })}">
      <a href="${projectUrl}" style="color: ${BRAND_COLORS.primary};">
        View full project →
      </a>
    </p>
    `
        : ''
    }

    <hr style="${styleToString(commonStyles.divider)}" />

    ${getTipsSection(eventType, recipientRole)}

    <p style="${styleToString(commonStyles.paragraph)}">
      Best regards,<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: `${config.title} - Skillancer`,
    body,
    previewText: `${milestoneName} - ${statusBadge.label}`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = `${config.emoji} ${config.title}: "${milestoneName}" - ${projectTitle}`;

  return { html, text, subject };
}

export default generateContractMilestoneEmail;
