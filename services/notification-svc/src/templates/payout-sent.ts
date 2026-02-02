/**
 * Payout Sent Email Template
 *
 * Sent to freelancers when their payout has been initiated.
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

export interface PayoutSentEmailData {
  freelancerName: string;
  payoutAmount: number;
  payoutCurrency?: string;
  netAmount: number;
  payoutFee: number;
  payoutMethod: 'bank_transfer' | 'instant' | 'debit_card' | 'paypal' | 'wise';
  payoutType: 'standard' | 'instant' | 'scheduled';
  destinationType: 'bank' | 'card';
  destinationLast4: string;
  bankName?: string;
  estimatedArrival: Date;
  transactionId: string;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getMethodDisplayName(method: string): string {
  const names: Record<string, string> = {
    bank_transfer: 'Bank Transfer',
    instant: 'Instant Transfer',
    debit_card: 'Debit Card',
    paypal: 'PayPal',
    wise: 'Wise',
  };
  return names[method] || 'Bank Transfer';
}

function getPayoutTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    standard: 'Standard Payout',
    instant: 'Instant Payout',
    scheduled: 'Scheduled Payout',
  };
  return labels[type] || 'Payout';
}

// ============================================================================
// Template
// ============================================================================

export function generatePayoutSentEmail(data: PayoutSentEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    freelancerName,
    payoutAmount,
    payoutCurrency = 'USD',
    netAmount,
    payoutFee,
    payoutMethod,
    payoutType,
    destinationType,
    destinationLast4,
    bankName,
    estimatedArrival,
    transactionId,
    dashboardUrl,
    unsubscribeUrl,
  } = data;

  const formattedArrival = new Date(estimatedArrival).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const isInstant = payoutType === 'instant';
  const methodName = getMethodDisplayName(payoutMethod);
  const typeLabel = getPayoutTypeLabel(payoutType);

  const body = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="
        display: inline-block;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-color: ${isInstant ? '#EEF2FF' : '#ECFDF5'};
        line-height: 80px;
        font-size: 40px;
      ">${isInstant ? '⚡' : '🚀'}</div>
    </div>

    <h1 style="${styleToString({ ...commonStyles.heading1, textAlign: 'center' })}">
      Your Payout is On Its Way!
    </h1>
    
    <p style="${styleToString({ ...commonStyles.paragraph, textAlign: 'center', fontSize: '18px' })}">
      Hi ${freelancerName}, your ${typeLabel.toLowerCase()} has been initiated.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <span style="
        font-size: 48px;
        font-weight: 700;
        color: ${BRAND_COLORS.success};
      ">${formatCurrency(netAmount, payoutCurrency)}</span>
    </div>

    ${createCard(`
      <h3 style="${styleToString({ ...commonStyles.heading2, marginTop: '0', marginBottom: '16px' })}">
        ${isInstant ? '⚡' : '📤'} ${typeLabel} Details
      </h3>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Method
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right; font-weight: 500;">
            ${methodName}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Destination
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${bankName || (destinationType === 'bank' ? 'Bank Account' : 'Debit Card')} ••••${destinationLast4}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Gross Amount
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${formatCurrency(payoutAmount, payoutCurrency)}
          </td>
        </tr>
        ${
          payoutFee > 0
            ? `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Payout Fee
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right; color: ${BRAND_COLORS.error};">
            -${formatCurrency(payoutFee, payoutCurrency)}
          </td>
        </tr>
        `
            : ''
        }
        <tr>
          <td style="padding: 12px 0; font-weight: 600;">
            Amount to Receive
          </td>
          <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: ${BRAND_COLORS.success};">
            ${formatCurrency(netAmount, payoutCurrency)}
          </td>
        </tr>
      </table>

      <div style="margin-top: 16px; padding: 12px; border-radius: 8px; background-color: ${isInstant ? '#EEF2FF' : '#F0FDF4'};">
        <p style="margin: 0; font-size: 14px; color: ${isInstant ? '#4F46E5' : '#15803D'};">
          <strong>⏱️ Estimated Arrival:</strong> ${isInstant ? 'Within 30 minutes' : formattedArrival}
        </p>
      </div>

      <div style="margin-top: 12px; font-size: 12px; color: ${BRAND_COLORS.muted};">
        <strong>Transaction ID:</strong> ${transactionId}
      </div>
    `)}

    <div style="text-align: center; margin: 32px 0;">
      ${createButton('View Payout Status', dashboardUrl)}
    </div>

    <hr style="${styleToString(commonStyles.divider)}" />

    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#F0F9FF', borderColor: '#3B82F6' })}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0', marginBottom: '8px', color: '#1D4ED8' })}">
        💡 What Happens Next?
      </h4>
      <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', marginBottom: '0' })}">
        ${
          isInstant
            ? "Your instant payout is being processed and should arrive within 30 minutes. You'll receive another email once the funds have been deposited."
            : "Your payout is being processed by our banking partner. It typically takes 2-5 business days depending on your bank. You'll receive an email once the funds arrive."
        }
      </p>
    </div>

    <p style="${styleToString(commonStyles.paragraph)}">
      Questions about your payout? <a href="${dashboardUrl}" style="color: ${BRAND_COLORS.primary};">Visit your dashboard</a> 
      or contact our support team.
    </p>

    <p style="${styleToString(commonStyles.paragraph)}">
      Keep up the great work!<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: 'Payout Initiated! - Skillancer',
    body,
    previewText: `Your ${formatCurrency(netAmount, payoutCurrency)} payout is on its way!`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = `${isInstant ? '⚡' : '🚀'} Your ${formatCurrency(netAmount, payoutCurrency)} payout is on its way!`;

  return { html, text, subject };
}

export default generatePayoutSentEmail;
