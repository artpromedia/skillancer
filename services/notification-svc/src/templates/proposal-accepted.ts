/**
 * Proposal Accepted Email Template
 *
 * Sent to freelancers when their proposal is accepted
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

export interface ProposalAcceptedEmailData {
  freelancerName: string;
  clientName: string;
  clientCompany?: string;
  projectTitle: string;
  projectId: string;
  contractAmount: number;
  contractCurrency?: string;
  contractType: 'fixed' | 'hourly';
  projectDuration?: string;
  startDate?: Date;
  contractUrl: string;
  projectChatUrl?: string;
  unsubscribeUrl?: string;
}

// ============================================================================
// Template
// ============================================================================

export function generateProposalAcceptedEmail(data: ProposalAcceptedEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    freelancerName,
    clientName,
    clientCompany,
    projectTitle,
    contractAmount,
    contractCurrency = 'USD',
    contractType,
    projectDuration,
    startDate,
    contractUrl,
    projectChatUrl,
    unsubscribeUrl,
  } = data;

  const clientDisplay = clientCompany ? `${clientName} at ${clientCompany}` : clientName;
  const rateLabel = contractType === 'hourly' ? 'Hourly Rate' : 'Fixed Price';
  const formattedStartDate = startDate
    ? new Date(startDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'To be discussed';

  const body = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
      <h1 style="${styleToString({ ...commonStyles.heading1, color: BRAND_COLORS.success })}">
        Congratulations, ${freelancerName}!
      </h1>
    </div>
    
    <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '18px', textAlign: 'center' })}">
      Your proposal has been <strong>accepted</strong>!
    </p>

    <p style="${styleToString(commonStyles.paragraph)}">
      <strong>${clientDisplay}</strong> has chosen you to work on their project. 
      This is a great opportunity to showcase your skills and build your reputation on Skillancer!
    </p>

    ${createCard(`
      <h3 style="${styleToString({ ...commonStyles.heading2, marginTop: '0', color: BRAND_COLORS.primary })}">
        📋 Contract Details
      </h3>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
            <strong style="color: ${BRAND_COLORS.muted};">Project</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            <strong>${projectTitle}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
            <strong style="color: ${BRAND_COLORS.muted};">Client</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${clientDisplay}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
            <strong style="color: ${BRAND_COLORS.muted};">${rateLabel}</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            <strong style="color: ${BRAND_COLORS.success};">${formatCurrency(contractAmount, contractCurrency)}${contractType === 'hourly' ? '/hr' : ''}</strong>
          </td>
        </tr>
        ${
          projectDuration
            ? `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border};">
            <strong style="color: ${BRAND_COLORS.muted};">Duration</strong>
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${projectDuration}
          </td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: ${BRAND_COLORS.muted};">Start Date</strong>
          </td>
          <td style="padding: 8px 0; text-align: right;">
            ${formattedStartDate}
          </td>
        </tr>
      </table>
    `)}

    <div style="text-align: center; margin: 32px 0;">
      ${createButton('View Contract', contractUrl)}
    </div>

    ${
      projectChatUrl
        ? `
    <p style="${styleToString({ ...commonStyles.paragraph, textAlign: 'center' })}">
      <a href="${projectChatUrl}" style="color: ${BRAND_COLORS.primary};">
        💬 Start a conversation with ${clientName} →
      </a>
    </p>
    `
        : ''
    }

    <hr style="${styleToString(commonStyles.divider)}" />

    <h3 style="${styleToString(commonStyles.heading2)}">
      📌 Next Steps
    </h3>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding: 12px 0; vertical-align: top; width: 32px;">
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: ${BRAND_COLORS.primary};
            color: white;
            font-size: 14px;
            font-weight: 600;
            line-height: 24px;
            text-align: center;
          ">1</div>
        </td>
        <td style="padding: 12px 0; padding-left: 12px;">
          <strong>Review and sign the contract</strong>
          <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', marginTop: '4px', marginBottom: '0' })}">
            Read through the terms and digitally sign to formalize the agreement.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; vertical-align: top; width: 32px;">
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: ${BRAND_COLORS.primary};
            color: white;
            font-size: 14px;
            font-weight: 600;
            line-height: 24px;
            text-align: center;
          ">2</div>
        </td>
        <td style="padding: 12px 0; padding-left: 12px;">
          <strong>Connect with your client</strong>
          <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', marginTop: '4px', marginBottom: '0' })}">
            Introduce yourself and clarify any questions about the project scope.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; vertical-align: top; width: 32px;">
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: ${BRAND_COLORS.primary};
            color: white;
            font-size: 14px;
            font-weight: 600;
            line-height: 24px;
            text-align: center;
          ">3</div>
        </td>
        <td style="padding: 12px 0; padding-left: 12px;">
          <strong>Set up milestones</strong>
          <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', marginTop: '4px', marginBottom: '0' })}">
            Break down the project into deliverables for clear progress tracking.
          </p>
        </td>
      </tr>
    </table>

    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#ECFDF5', borderColor: BRAND_COLORS.success })}">
      <p style="${styleToString({ ...commonStyles.paragraph, marginBottom: '0' })}">
        <strong>💡 Pro Tip:</strong> Maintain regular communication with your client. 
        Send weekly updates to build trust and ensure the project stays on track.
      </p>
    </div>

    <p style="${styleToString(commonStyles.paragraph)}">
      Good luck with your new project!<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: 'Proposal Accepted! - Skillancer',
    body,
    previewText: `Congratulations! Your proposal for "${projectTitle}" has been accepted by ${clientName}`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = `🎉 Your proposal for "${projectTitle}" has been accepted!`;

  return { html, text, subject };
}

export default generateProposalAcceptedEmail;
