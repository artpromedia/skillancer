/**
 * Email Verification Template
 *
 * Sent when user needs to verify their email address
 */

import {
  wrapEmailContent,
  htmlToPlainText,
  commonStyles,
  styleToString,
  createButton,
  BRAND_COLORS,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

export interface VerificationEmailData {
  userName: string;
  userEmail: string;
  verificationUrl: string;
  verificationCode?: string;
  expiresInHours?: number;
  unsubscribeUrl?: string;
}

// ============================================================================
// Template
// ============================================================================

export function generateVerificationEmail(data: VerificationEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    userName,
    userEmail,
    verificationUrl,
    verificationCode,
    expiresInHours = 24,
    unsubscribeUrl,
  } = data;

  const body = `
    <h1 style="${styleToString(commonStyles.heading1)}">
      Verify Your Email Address
    </h1>
    
    <p style="${styleToString(commonStyles.paragraph)}">
      Hi ${userName},
    </p>

    <p style="${styleToString(commonStyles.paragraph)}">
      Please verify your email address (<strong>${userEmail}</strong>) to complete your Skillancer account setup.
    </p>

    <div style="text-align: center; margin: 32px 0;">
      ${createButton('Verify Email Address', verificationUrl)}
    </div>

    ${
      verificationCode
        ? `
    <div style="${styleToString(commonStyles.card)}">
      <p style="${styleToString({ ...commonStyles.paragraph, marginBottom: '8px' })}">
        <strong>Or enter this verification code:</strong>
      </p>
      <div style="text-align: center;">
        <span style="
          font-size: 32px;
          font-weight: 700;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
          letter-spacing: 8px;
          color: ${BRAND_COLORS.primary};
          padding: 16px 24px;
          background-color: ${BRAND_COLORS.backgroundAlt};
          border-radius: 8px;
          display: inline-block;
        ">${verificationCode}</span>
      </div>
    </div>
    `
        : ''
    }

    <p style="${styleToString({ ...commonStyles.paragraph, color: BRAND_COLORS.muted, fontSize: '14px' })}">
      ⏰ This link will expire in <strong>${expiresInHours} hours</strong>.
    </p>

    <hr style="${styleToString(commonStyles.divider)}" />

    <div style="${styleToString({ ...commonStyles.card, backgroundColor: '#FEF3C7', borderColor: '#F59E0B' })}">
      <p style="${styleToString({ ...commonStyles.paragraph, marginBottom: '0' })}">
        <strong>🔒 Security Notice</strong><br>
        If you didn't create a Skillancer account, please ignore this email. 
        Someone may have entered your email address by mistake.
      </p>
    </div>

    <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', color: BRAND_COLORS.muted })}">
      Button not working? Copy and paste this link into your browser:
      <br>
      <a href="${verificationUrl}" style="color: ${BRAND_COLORS.primary}; word-break: break-all;">
        ${verificationUrl}
      </a>
    </p>

    <p style="${styleToString(commonStyles.paragraph)}">
      Thanks,<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: 'Verify Your Email - Skillancer',
    body,
    previewText: `Verify your email address to complete your Skillancer account setup`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);
  const subject = 'Verify your email address for Skillancer';

  return { html, text, subject };
}

export default generateVerificationEmail;
