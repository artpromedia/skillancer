/**
 * New Message Email Template
 *
 * Sent when a user receives a new message
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

export interface NewMessageEmailData {
  recipientName: string;
  senderName: string;
  senderAvatar?: string;
  senderTitle?: string;
  messagePreview: string;
  messageUrl: string;
  conversationContext?: string; // e.g., "regarding Project X"
  unreadCount?: number;
  unsubscribeUrl?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function truncateMessage(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// ============================================================================
// Template
// ============================================================================

export function generateNewMessageEmail(data: NewMessageEmailData): {
  html: string;
  text: string;
  subject: string;
} {
  const {
    recipientName,
    senderName,
    senderTitle,
    messagePreview,
    messageUrl,
    conversationContext,
    unreadCount,
    unsubscribeUrl,
  } = data;

  const truncatedMessage = truncateMessage(messagePreview);
  const initials = getInitials(senderName);

  const body = `
    <h1 style="${styleToString(commonStyles.heading1)}">
      You have a new message 💬
    </h1>
    
    <p style="${styleToString(commonStyles.paragraph)}">
      Hi ${recipientName},
    </p>

    <p style="${styleToString(commonStyles.paragraph)}">
      <strong>${senderName}</strong>${conversationContext ? ` sent you a message ${conversationContext}` : ' sent you a message'}.
    </p>

    <div style="${styleToString({
      ...commonStyles.card,
      backgroundColor: '#F9FAFB',
      borderLeft: `4px solid ${BRAND_COLORS.primary}`,
    })}">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: top; width: 48px;">
            <div style="
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background-color: ${BRAND_COLORS.primary};
              color: white;
              font-size: 16px;
              font-weight: 600;
              line-height: 40px;
              text-align: center;
            ">${initials}</div>
          </td>
          <td style="vertical-align: top; padding-left: 12px;">
            <div style="font-weight: 600; font-size: 14px; color: ${BRAND_COLORS.text};">
              ${senderName}
              ${senderTitle ? `<span style="font-weight: normal; color: ${BRAND_COLORS.muted};"> • ${senderTitle}</span>` : ''}
            </div>
            <p style="${styleToString({
              ...commonStyles.paragraph,
              marginTop: '8px',
              marginBottom: '0',
              color: BRAND_COLORS.textSecondary,
            })}">
              "${truncatedMessage}"
            </p>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      ${createButton('View & Reply', messageUrl)}
    </div>

    ${
      unreadCount && unreadCount > 1
        ? `
    <p style="${styleToString({ ...commonStyles.paragraph, textAlign: 'center', color: BRAND_COLORS.muted })}">
      You have <strong style="color: ${BRAND_COLORS.primary};">${unreadCount}</strong> unread messages
    </p>
    `
        : ''
    }

    <hr style="${styleToString(commonStyles.divider)}" />

    <div style="${styleToString({ ...commonStyles.card, backgroundColor: BRAND_COLORS.backgroundAlt })}">
      <h4 style="${styleToString({ ...commonStyles.heading2, fontSize: '14px', marginTop: '0', marginBottom: '8px' })}">
        💡 Quick Tip
      </h4>
      <p style="${styleToString({ ...commonStyles.paragraph, fontSize: '14px', marginBottom: '0' })}">
        Respond quickly to messages - active communicators have 40% higher success rates on Skillancer.
      </p>
    </div>

    <p style="${styleToString(commonStyles.paragraph)}">
      Happy collaborating!<br>
      <strong>The Skillancer Team</strong>
    </p>
  `;

  const html = wrapEmailContent({
    title: `New message from ${senderName} - Skillancer`,
    body,
    previewText: `${senderName}: "${truncateMessage(messagePreview, 80)}"`,
    unsubscribeUrl,
  });

  const text = htmlToPlainText(html);

  const subject = conversationContext
    ? `💬 New message from ${senderName} ${conversationContext}`
    : `💬 ${senderName} sent you a message on Skillancer`;

  return { html, text, subject };
}

export default generateNewMessageEmail;
