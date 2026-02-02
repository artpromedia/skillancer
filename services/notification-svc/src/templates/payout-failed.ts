/**
 * Payout Failed Email Template
 *
 * Sent to freelancers when their payout has failed.
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

export interface PayoutFailedEmailData {
  freelancerName: string;
  payoutAmount: number;
  payoutCurrency?: string;
  failureReason: string;
  failureCode?: string;
  destinationType: 'bank' | 'card';
  destinationLast4: string;
  bankName?: string;
  transactionId: string;
  canRetry: boolean;
  suggestedAction?: string;
  retryUrl: string;
  settingsUrl: string;
  supportUrl: string;
  unsubscribeUrl?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getFailureExplanation(code: string | undefined): string {
  const explanations: Record<string, string> = {
    insufficient_funds: 'There were insufficient funds to complete the payout.',
    account_closed: 'The destination bank account appears to be closed.',
    invalid_account: 'The bank account information could not be verified.',
    no_account: 'No valid payout destination was found on your account.',
    declined: 'The receiving bank declined the transfer.',
    could_not_process: 'The bank could not process this transfer at this time.',
    bank_account_restricted: 'The receiving bank account has restrictions.',
    invalid_currency: 'The payout currency is not supported for your account.',
    network_error: 'A temporary network error occurred during processing.',
  };
  return explanations[code ?? ''] || 'An unexpected error occurred during processing.';
}

function getSuggestedFix(code: string | undefined): string {
  const suggestions: Record<string, string> = {
    insufficient_funds: 'Please wait for more funds to become available and try again.',
    account_closed: 'Please update your payout method to an active account.',
    invalid_account: 'Please verify your bank account details are correct.',
    no_account: 'Please add a payout method in your payment settings.',
    declined: 'Contact your bank to ensure they can receive transfers.',
    could_not_process: 'Please try again later or use a different payout method.',
    bank_account_restricted: 'Contact your bank about any account restrictions.',
    invalid_currency: 'Update your payout currency in settings.',
    network_error: 'Please retry the payout. The issue is temporary.',
  };
  return suggestions[code ?? ''] || 'Please check your payout settings or contact support.';
}

// ============================================================================
// Template
// ============================================================================

export function generatePayoutFailedEmail(data: PayoutFailedEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    freelancerName,
    payoutAmount,
    payoutCurrency = 'USD',
    failureReason,
    failureCode,
    destinationType,
    destinationLast4,
    bankName,
    transactionId,
    canRetry,
    suggestedAction,
    retryUrl,
    settingsUrl,
    supportUrl,
    unsubscribeUrl,
  } = data;

  const explanation = getFailureExplanation(failureCode);
  const suggestedFix = suggestedAction || getSuggestedFix(failureCode);

  const body = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="
        display: inline-block;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-color: #FEF2F2;
        line-height: 80px;
        font-size: 40px;
      ">⚠️</div>
    </div>

    <h1 style="${styleToString({ ...commonStyles.heading1, textAlign: 'center', color: BRAND_COLORS.error })}">
      Payout Failed
    </h1>
    
    <p style="${styleToString({ ...commonStyles.paragraph, textAlign: 'center', fontSize: '16px' })}">
      Hi ${freelancerName}, unfortunately your payout of 
      <strong>${formatCurrency(payoutAmount, payoutCurrency)}</strong> could not be completed.
    </p>

    ${createCard(`
      <h3 style="${styleToString({ ...commonStyles.heading2, marginTop: '0', marginBottom: '16px', color: BRAND_COLORS.error })}">
        ❌ What Happened
      </h3>
      
      <div style="padding: 16px; background-color: #FEF2F2; border-radius: 8px; margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #991B1B;">
          ${failureReason}
        </p>
        <p style="margin: 0; font-size: 14px; color: #7F1D1D;">
          ${explanation}
        </p>
        ${
          failureCode
            ? `
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #9CA3AF;">
          Error code: ${failureCode}
        </p>
        `
            : ''
        }
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.muted};">
            Payout Amount
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid ${BRAND_COLORS.border}; text-align: right; font-weight: 500;">
            ${formatCurrency(payoutAmount, payoutCurrency)}
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
          <td style="padding: 8px 0; color: ${BRAND_COLORS.muted};">
            Transaction ID
          </td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace;">
            ${transactionId}
          </td>
        </tr>
      </table>

      <div style="margin-top: 16px; padding: 12px; background-color: #FFF7ED; border-radius: 8px; border-left: 4px solid #F97316;">
        <p style="margin: 0; font-size: 14px; color: #9A3412;">
          <strong>💡 Suggested Action:</strong><br>
          ${suggestedFix}
        </p>
      </div>
    `)}

    <div style="margin-top: 24px; padding: 16px; background-color: #F0FDF4; border-radius: 8px; border: 1px solid #BBF7D0;">
      <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #15803D;">
        ✅ Your Balance is Safe
      </h4>
      <p style="margin: 0; font-size: 14px; color: #166534;">
        Don't worry - the payout amount has been returned to your available balance. 
        You can retry the payout at any time.
      </p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      ${canRetry ? createButton('Retry Payout', retryUrl) : createButton('Update Payment Settings', settingsUrl)}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
      <tr>
        <td style="text-align: center; padding: 0 8px;">
          <a href="${settingsUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            color: ${BRAND_COLORS.textSecondary};
            background-color: ${BRAND_COLORS.backgroundAlt};
            border: 1px solid ${BRAND_COLORS.border};
            border-radius: 6px;
            text-decoration: none;
          ">Update Settings</a>
        </td>
        <td style="text-align: center; padding: 0 8px;">
          <a href="${supportUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 500;
            color: ${BRAND_COLORS.textSecondary};
            background-color: ${BRAND_COLORS.backgroundAlt};
            border: 1px solid ${BRAND_COLORS.border};
            border-radius: 6px;
            text-decoration: none;
          ">Contact Support</a>
        </td>
      </tr>
    </table>

    <hr style="${styleToString(commonStyles.divider)}" />

    <p style="${styleToString(commonStyles.paragraph)}">
      If you continue to experience issues, please don't hesitate to 
      <a href="${supportUrl}" style="color: ${BRAND_COLORS.primary};">contact our support team</a>.
      We're here to help!
    </p>

    <p style="${styleToString(commonStyles.paragraph)}">
      Best regards,<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: 'Payout Failed - Skillancer',
    body,
    previewText: `Your ${formatCurrency(payoutAmount, payoutCurrency)} payout could not be completed`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = `⚠️ Action Required: Your payout of ${formatCurrency(payoutAmount, payoutCurrency)} failed`;

  return { html, text, subject };
}

export default generatePayoutFailedEmail;
