/**
 * Email Digest Template
 *
 * Template for daily and weekly digest emails that aggregate
 * unread notifications into a single consolidated email.
 */

import {
  wrapEmailContent,
  createButton,
  createDivider,
  commonStyles,
  styleToString,
  type BaseTemplateData,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

export interface DigestNotificationItem {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  createdAt: Date;
  data?: Record<string, unknown>;
}

export interface DigestEmailOptions extends BaseTemplateData {
  firstName: string;
  digestType: 'daily' | 'weekly';
  periodLabel: string;
  totalCount: number;
  categoryCounts: Record<string, number>;
  groupedNotifications: Record<string, DigestNotificationItem[]>;
  dashboardLink: string;
  preferencesLink: string;
}

// ============================================================================
// Category Configuration
// ============================================================================

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  MESSAGES: {
    label: 'Messages',
    icon: '💬',
    color: '#3B82F6', // Blue
  },
  PROPOSALS: {
    label: 'Proposals',
    icon: '📋',
    color: '#8B5CF6', // Purple
  },
  CONTRACTS: {
    label: 'Contracts',
    icon: '📄',
    color: '#10B981', // Green
  },
  PAYMENTS: {
    label: 'Payments',
    icon: '💰',
    color: '#F59E0B', // Amber
  },
  PROJECTS: {
    label: 'Projects',
    icon: '🎯',
    color: '#EC4899', // Pink
  },
  SECURITY: {
    label: 'Security',
    icon: '🔒',
    color: '#EF4444', // Red
  },
  SYSTEM: {
    label: 'System',
    icon: '⚙️',
    color: '#6B7280', // Gray
  },
  OTHER: {
    label: 'Other',
    icon: '📌',
    color: '#6B7280', // Gray
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getCategoryConfig(category: string): { label: string; icon: string; color: string } {
  return CATEGORY_CONFIG[category.toUpperCase()] || CATEGORY_CONFIG.OTHER;
}

function formatNotificationTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    return 'Just now';
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Component Builders
// ============================================================================

function buildSummaryCard(totalCount: number, categoryCounts: Record<string, number>): string {
  const categoryRows = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => {
      const config = getCategoryConfig(category);
      return `
        <tr>
          <td style="padding: 8px 12px; font-size: 14px; color: #374151;">
            <span style="margin-right: 8px;">${config.icon}</span>
            ${config.label}
          </td>
          <td style="padding: 8px 12px; text-align: right; font-size: 14px; font-weight: 600; color: ${config.color};">
            ${count}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin: 24px 0; color: white;">
      <div style="text-align: center; margin-bottom: 16px;">
        <span style="font-size: 48px; font-weight: 700;">${totalCount}</span>
        <p style="font-size: 16px; margin: 4px 0 0; opacity: 0.9;">
          notification${totalCount !== 1 ? 's' : ''} waiting for you
        </p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.95); border-radius: 8px; overflow: hidden;">
        <tbody>
          ${categoryRows}
        </tbody>
      </table>
    </div>
  `;
}

function buildNotificationItem(notification: DigestNotificationItem): string {
  const config = getCategoryConfig(notification.category);
  const timeAgo = formatNotificationTime(new Date(notification.createdAt));

  return `
    <div style="padding: 16px; border-bottom: 1px solid #E5E7EB;">
      <div style="display: flex; align-items: flex-start; gap: 12px;">
        <div style="width: 40px; height: 40px; background-color: ${config.color}15; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="font-size: 18px;">${config.icon}</span>
        </div>
        <div style="flex: 1; min-width: 0;">
          <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #111827;">
            ${truncateText(notification.title, 80)}
          </p>
          <p style="margin: 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
            ${truncateText(notification.body, 150)}
          </p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #9CA3AF;">
            ${timeAgo}
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildCategorySection(category: string, notifications: DigestNotificationItem[]): string {
  const config = getCategoryConfig(category);
  const displayNotifications = notifications.slice(0, 5);
  const remainingCount = notifications.length - displayNotifications.length;

  const notificationItems = displayNotifications.map(buildNotificationItem).join('');

  return `
    <div style="margin: 24px 0;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="font-size: 20px;">${config.icon}</span>
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">
          ${config.label}
        </h3>
        <span style="background-color: ${config.color}20; color: ${config.color}; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 9999px;">
          ${notifications.length}
        </span>
      </div>
      <div style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden;">
        ${notificationItems}
        ${
          remainingCount > 0
            ? `
          <div style="padding: 12px 16px; background-color: #F9FAFB; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #6B7280;">
              + ${remainingCount} more notification${remainingCount !== 1 ? 's' : ''}
            </p>
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

// ============================================================================
// Main Template
// ============================================================================

export function digestEmailTemplate(options: DigestEmailOptions): {
  html: string;
  text: string;
} {
  const {
    firstName,
    digestType,
    periodLabel,
    totalCount,
    categoryCounts,
    groupedNotifications,
    dashboardLink,
    preferencesLink,
    ...baseOptions
  } = options;

  const digestTypeLabel = digestType === 'daily' ? 'Daily' : 'Weekly';

  // Build category sections
  const categorySections = Object.entries(groupedNotifications)
    .sort((a, b) => b[1].length - a[1].length) // Sort by count descending
    .map(([category, notifications]) => buildCategorySection(category, notifications))
    .join('');

  const body = `
    <h1 style="${styleToString(commonStyles.heading1)}">Your ${digestTypeLabel} Update</h1>
    
    <p style="${styleToString(commonStyles.paragraph)}">Hi ${firstName},</p>
    
    <p style="${styleToString(commonStyles.paragraph)}">Here's a summary of what happened ${periodLabel}:</p>
    
    ${buildSummaryCard(totalCount, categoryCounts)}
    
    <div style="text-align: center; margin: 24px 0;">
      ${createButton('View All Notifications', dashboardLink)}
    </div>
    
    ${createDivider()}
    
    <h2 style="${styleToString(commonStyles.heading2)}">
      📬 Notification Details
    </h2>
    
    ${categorySections}
    
    ${createDivider()}
    
    <p style="${styleToString(commonStyles.paragraph)}">
      <strong>Want to change how often you receive these updates?</strong><br/>
      <a href="${preferencesLink}" style="color: #10B981; text-decoration: none;">
        Manage your notification preferences →
      </a>
    </p>
  `;

  const html = wrapEmailContent({
    ...baseOptions,
    title: `${digestTypeLabel} Digest - Skillancer`,
    body,
    previewText: `${totalCount} notification${totalCount !== 1 ? 's' : ''} waiting for you on Skillancer`,
    preferencesUrl: preferencesLink,
    unsubscribeUrl: `${preferencesLink}?unsubscribe=digest`,
  });

  // Plain text version
  const text = `
${digestTypeLabel} Update from Skillancer

Hi ${firstName},

Here's a summary of what happened ${periodLabel}:

Total Notifications: ${totalCount}

${Object.entries(categoryCounts)
  .map(([cat, count]) => `• ${getCategoryConfig(cat).label}: ${count}`)
  .join('\n')}

---

${Object.entries(groupedNotifications)
  .map(
    ([category, notifications]) =>
      `${getCategoryConfig(category).label} (${notifications.length})\n${notifications
        .slice(0, 5)
        .map((n) => `  • ${n.title}`)
        .join('\n')}`
  )
  .join('\n\n')}

---

View all notifications: ${dashboardLink}
Manage preferences: ${preferencesLink}

---

This email was sent by Skillancer.
To unsubscribe from digest emails, visit: ${preferencesLink}?unsubscribe=digest
  `.trim();

  return { html, text };
}

export default digestEmailTemplate;
