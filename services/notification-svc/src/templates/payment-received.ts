/**
 * Payment Received Email Template
 *
 * Sent to freelancers when they receive a payment
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

export interface PaymentReceivedEmailData {
  freelancerName: string;
  clientName: string;
  projectTitle: string;
  paymentAmount: number;
  paymentCurrency?: string;
  paymentType: 'milestone' | 'hourly' | 'bonus' | 'refund' | 'full';
  milestoneName?: string;
  hoursWorked?: number;
  hourlyRate?: number;
  platformFee?: number;
  netAmount: number;
  transactionId: string;
  paymentDate: Date;
  walletUrl: string;
  withdrawUrl?: string;
  invoiceUrl?: string;
  unsubscribeUrl?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getPaymentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    milestone: 'Milestone Payment',
    hourly: 'Hourly Payment',
    bonus: 'Bonus Payment',
    refund: 'Refund',
    full: 'Full Payment',
  };
  return labels[type] || 'Payment';
}

function getPaymentEmoji(type: string): string {
  const emojis: Record<string, string> = {
    milestone: '🎯',
    hourly: '⏰',
    bonus: '🎁',
    refund: '↩️',
    full: '✅',
  };
  return emojis[type] || '💰';
}

// ============================================================================
// Template
// ============================================================================

export function generatePaymentReceivedEmail(data: PaymentReceivedEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    freelancerName,
    clientName,
    projectTitle,
    paymentAmount,
    paymentCurrency = 'USD',
    paymentType,
    milestoneName,
    hoursWorked,
    hourlyRate,
    platformFee,
    netAmount,
    transactionId,
    paymentDate,
    walletUrl,
    withdrawUrl,
    invoiceUrl,
    unsubscribeUrl,
  } = data;

  const formattedDate = new Date(paymentDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const paymentTypeLabel = getPaymentTypeLabel(paymentType);
  const paymentEmoji = getPaymentEmoji(paymentType);

  const body = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="
        display: inline-block;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-color: #ECFDF5;
        line-height: 80px;
        font-size: 40px;
      ">💰</div>
    </div>

    <h1 style="${styleToString({ ...commonStyles.heading1, textAlign: 'center' })}">
      Payment Received!
    </h1>
    
    <p style="${styleToString({ ...commonStyles.paragraph, textAlign: 'center', fontSize: '18px' })}">
      Hi ${freelancerName}, you've received a payment of
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <span style="
        font-size: 48px;
        font-weight: 700;
        color: ${BRAND_COLORS.success};
      ">${formatCurrency(netAmount, paymentCurrency)}</span>
    </div>

    ${createCard(`
      <h3 style="${styleToString({ ...commonStyles.heading2, marginTop: '0', marginBottom: '16px' })}">
        ${paymentEmoji} ${paymentTypeLabel} Details
      </h3>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Project
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right; font-weight: 500;">
            ${projectTitle}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Client
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${clientName}
          </td>
        </tr>
        ${
          milestoneName
            ? `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Milestone
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${milestoneName}
          </td>
        </tr>
        `
            : ''
        }
        ${
          hoursWorked
            ? `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Hours Worked
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${hoursWorked} hrs @ ${formatCurrency(hourlyRate || 0, paymentCurrency)}/hr
          </td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Gross Amount
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${formatCurrency(paymentAmount, paymentCurrency)}
          </td>
        </tr>
        ${
          platformFee
            ? `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Platform Fee
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right; color: ${BRAND_COLORS.error};">
            -${formatCurrency(platformFee, paymentCurrency)}
          </td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="padding: 12px 0; font-weight: 600;">
            Net Amount
          </td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: ${BRAND_COLORS.success};">
            ${formatCurrency(netAmount, paymentCurrency)}
          </td>
        </tr>
      </table>

      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid ${BRAND_COLORS.border}; font-size: 12px; color: ${BRAND_COLORS.muted};">
        <strong>Transaction ID:</strong> ${transactionId}<br>
        <strong>Date:</strong> ${formattedDate}
      </div>
    `)}

    <div style="text-align: center; margin: 32px 0;">
      ${createButton('View Wallet', walletUrl)}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
      <tr>
        <td style="text-align: center; padding: 0 8px;">
          ${
            withdrawUrl
              ? `
          <a href="${withdrawUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            color: ${BRAND_COLORS.primary};
            background-color: white;
            border: 1px solid ${BRAND_COLORS.primary};
            border-radius: 6px;
            text-decoration: none;
          ">Withdraw Funds</a>
          `
              : ''
          }
        </td>
        <td style="text-align: center; padding: 0 8px;">
          ${
            invoiceUrl
              ? `
          <a href="${invoiceUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            color: ${BRAND_COLORS.textSecondary};
            background-color: ${BRAND_COLORS.backgroundAlt};
            border: 1px solid ${BRAND_COLORS.border};
            border-radius: 6px;
            text-decoration: none;
          ">Download Invoice</a>
          `
              : ''
          }
        </td>
      </tr>
    </table>

    <hr style="${styleToString(commonStyles.divider)}" />

    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#EFF6FF', borderColor: '#3B82F6' })}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0', marginBottom: '8px', color: '#1D4ED8' })}">
        💡 About Your Earnings
      </h4>
      <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', marginBottom: '0' })}">
        Your payment is now available in your Skillancer Wallet. You can withdraw funds 
        to your bank account or keep them for future platform fees.
      </p>
    </div>

    <p style="${styleToString(commonStyles.paragraph)}">
      Keep up the great work!<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: 'Payment Received! - Skillancer',
    body,
    previewText: `You received ${formatCurrency(netAmount, paymentCurrency)} for "${projectTitle}"`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = `💰 You received ${formatCurrency(netAmount, paymentCurrency)} for "${projectTitle}"`;

  return { html, text, subject };
}

export default generatePaymentReceivedEmail;
