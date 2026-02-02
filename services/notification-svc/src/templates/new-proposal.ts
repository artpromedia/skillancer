/**
 * New Proposal Email Template
 *
 * Sent to clients when a freelancer submits a proposal
 */

import {
  wrapEmailContent,
  htmlToPlainText,
  commonStyles,
  styleToString,
  createButton,
  createCard,
  createInfoRow,
  BRAND_COLORS,
  formatCurrency,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

export interface NewProposalEmailData {
  clientName: string;
  projectTitle: string;
  projectId: string;
  freelancerName: string;
  freelancerTitle?: string;
  freelancerAvatar?: string;
  freelancerRating?: number;
  freelancerCompletedJobs?: number;
  proposalAmount: number;
  proposalCurrency?: string;
  proposalDuration?: string;
  proposalCoverLetter: string;
  proposalUrl: string;
  viewAllProposalsUrl?: string;
  unsubscribeUrl?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function renderStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  let stars = '';

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars += '★';
    } else if (i === fullStars && hasHalfStar) {
      stars += '☆';
    } else {
      stars += '☆';
    }
  }

  return stars;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

function renderFreelancerStats(rating?: number, completedJobs?: number): string {
  if (!rating) return '';

  const jobsText = completedJobs
    ? `<span style="color: ${BRAND_COLORS.muted};"> • ${completedJobs} jobs completed</span>`
    : '';

  return `
    <div style="font-size: 14px; color: #F59E0B; margin-top: 4px;">
      ${renderStars(rating)} ${rating.toFixed(1)}${jobsText}
    </div>
  `;
}

// ============================================================================
// Template
// ============================================================================

export function generateNewProposalEmail(data: NewProposalEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    clientName,
    projectTitle,
    freelancerName,
    freelancerTitle = 'Freelancer',
    freelancerRating,
    freelancerCompletedJobs,
    proposalAmount,
    proposalCurrency = 'USD',
    proposalDuration,
    proposalCoverLetter,
    proposalUrl,
    viewAllProposalsUrl,
    unsubscribeUrl,
  } = data;

  const truncatedCoverLetter = truncateText(proposalCoverLetter, 300);

  const body = `
    <h1 style="${styleToString(commonStyles.heading1)}">
      New Proposal Received 📬
    </h1>
    
    <p style="${styleToString(commonStyles.paragraph)}">
      Hi ${clientName},
    </p>

    <p style="${styleToString(commonStyles.paragraph)}">
      Great news! You've received a new proposal for your project:
    </p>

    <div style="${styleToString({ ...commonStyles.card, backgroundColor: BRAND_COLORS.backgroundAlt })}">
      <h3 style="${styleToString({ ...commonStyles.heading2, marginTop: '0', marginBottom: '8px' })}">
        ${projectTitle}
      </h3>
    </div>

    ${createCard(`
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align: top;">
                  <div style="
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background-color: ${BRAND_COLORS.primary};
                    color: white;
                    font-size: 20px;
                    font-weight: 600;
                    line-height: 48px;
                    text-align: center;
                    margin-right: 12px;
                  ">${freelancerName.charAt(0).toUpperCase()}</div>
                </td>
                <td style="vertical-align: top; padding-left: 12px;">
                  <div style="font-weight: 600; font-size: 16px; color: ${BRAND_COLORS.text};">
                    ${freelancerName}
                  </div>
                  <div style="font-size: 14px; color: ${BRAND_COLORS.muted};">
                    ${freelancerTitle}
                  </div>
                  ${renderFreelancerStats(freelancerRating, freelancerCompletedJobs)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            ${createInfoRow('💰 Proposed Rate', formatCurrency(proposalAmount, proposalCurrency))}
            ${proposalDuration ? createInfoRow('⏱️ Duration', proposalDuration) : ''}
          </td>
        </tr>
      </table>
    `)}

    <h3 style="${styleToString(commonStyles.heading2)}">
      Cover Letter Preview
    </h3>
    
    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#F9FAFB' })}">
      <p style="${styleToString({ ...commonStyles.paragraph, marginBottom: '0', fontStyle: 'italic' })}">
        "${truncatedCoverLetter}"
      </p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      ${createButton('View Full Proposal', proposalUrl)}
    </div>

    ${
      viewAllProposalsUrl
        ? `
    <p style="${styleToString({ ...commonStyles.paragraph, textAlign: 'center' })}">
      <a href="${viewAllProposalsUrl}" style="color: ${BRAND_COLORS.primary};">
        View all proposals for this project →
      </a>
    </p>
    `
        : ''
    }

    <hr style="${styleToString(commonStyles.divider)}" />

    <div style="${styleToString(commonStyles.card)}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0' })}">
        💡 Tips for Evaluating Proposals
      </h4>
      <ul style="margin: 0; padding-left: 20px;">
        <li style="${styleToString({ ...commonStyles.paragraph, marginBottom: '4px' })}">
          Review the freelancer's portfolio and past work
        </li>
        <li style="${styleToString({ ...commonStyles.paragraph, marginBottom: '4px' })}">
          Check their ratings and reviews from other clients
        </li>
        <li style="${styleToString({ ...commonStyles.paragraph, marginBottom: '4px' })}">
          Ask clarifying questions before making a decision
        </li>
        <li style="${styleToString({ ...commonStyles.paragraph, marginBottom: '0' })}">
          Use our secure escrow for safe payments
        </li>
      </ul>
    </div>

    <p style="${styleToString(commonStyles.paragraph)}">
      Happy hiring!<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: 'New Proposal Received - Skillancer',
    body,
    previewText: `${freelancerName} submitted a proposal for "${projectTitle}"`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = `📬 New proposal from ${freelancerName} for "${truncateText(projectTitle, 40)}"`;

  return { html, text, subject };
}

export default generateNewProposalEmail;
