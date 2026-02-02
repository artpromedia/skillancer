/**
 * Payout Arrived Email Template
 *
 * Sent to freelancers when their payout has been deposited.
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

export interface PayoutArrivedEmailData {
  freelancerName: string;
  payoutAmount: number;
  payoutCurrency?: string;
  destinationType: 'bank' | 'card';
  destinationLast4: string;
  bankName?: string;
  transactionId: string;
  arrivedAt: Date;
  dashboardUrl: string;
  unsubscribeUrl?: string;
}

// ============================================================================
// Template
// ============================================================================

export function generatePayoutArrivedEmail(data: PayoutArrivedEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    freelancerName,
    payoutAmount,
    payoutCurrency = 'USD',
    destinationType,
    destinationLast4,
    bankName,
    transactionId,
    arrivedAt,
    dashboardUrl,
    unsubscribeUrl,
  } = data;

  const formattedDate = new Date(arrivedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

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
      ">✅</div>
    </div>

    <h1 style="${styleToString({ ...commonStyles.heading1, textAlign: 'center' })}">
      Payout Arrived!
    </h1>
    
    <p style="${styleToString({ ...commonStyles.paragraph, textAlign: 'center', fontSize: '18px' })}">
      Great news, ${freelancerName}! Your funds have been deposited.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <span style="
        font-size: 48px;
        font-weight: 700;
        color: ${BRAND_COLORS.success};
      ">${formatCurrency(payoutAmount, payoutCurrency)}</span>
    </div>

    ${createCard(`
      <h3 style="${styleToString({ ...commonStyles.heading2, marginTop: '0', marginBottom: '16px' })}">
        ✅ Deposit Confirmed
      </h3>
      
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Amount Deposited
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right; font-weight: 600; color: ${BRAND_COLORS.success};">
            ${formatCurrency(payoutAmount, payoutCurrency)}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Deposited To
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${bankName || (destinationType === 'bank' ? 'Bank Account' : 'Debit Card')} ••••${destinationLast4}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Arrived On
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right;">
            ${formattedDate}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: ${BRAND_COLORS.muted};">
            Transaction ID
          </td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">
            ${transactionId}
          </td>
        </tr>
      </table>
    `)}

    <div style="text-align: center; margin: 32px 0;">
      ${createButton('View Earnings Dashboard', dashboardUrl)}
    </div>

    <hr style="${styleToString(commonStyles.divider)}" />

    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#F0F9FF', borderColor: '#3B82F6' })}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0', marginBottom: '8px', color: '#1D4ED8' })}">
        🎉 Keep Growing Your Earnings!
      </h4>
      <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', marginBottom: '0' })}">
        Complete more projects and build your reputation on Skillancer. 
        Your skills are in demand - check out new opportunities that match your profile!
      </p>
    </div>

    <p style="${styleToString(commonStyles.paragraph)}">
      Thank you for being part of Skillancer!<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: 'Payout Arrived! - Skillancer',
    body,
    previewText: `Your ${formatCurrency(payoutAmount, payoutCurrency)} has been deposited!`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = `✅ Your ${formatCurrency(payoutAmount, payoutCurrency)} payout has arrived!`;

  return { html, text, subject };
}

export default generatePayoutArrivedEmail;
