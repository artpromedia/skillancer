/**
 * Email Template Base Components
 *
 * Shared components and utilities for email templates.
 * Uses inline styles for maximum email client compatibility.
 */

// ============================================================================
// Types
// ============================================================================

export interface EmailStyles {
  [key: string]: string | number;
}

export interface BaseTemplateData {
  previewText?: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  supportEmail?: string;
  companyAddress?: string;
  year?: number;
}

// ============================================================================
// Brand Colors
// ============================================================================

export const BRAND_COLORS = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  secondary: '#10B981',
  accent: '#8B5CF6',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  text: '#1F2937',
  textMuted: '#6B7280',
  textSecondary: '#6B7280',
  muted: '#9CA3AF',
  background: '#F9FAFB',
  backgroundAlt: '#F3F4F6',
  white: '#FFFFFF',
  border: '#E5E7EB',
  footer: '#9CA3AF',
} as const;

// ============================================================================
// Common Styles
// ============================================================================

export const commonStyles = {
  // Container
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: BRAND_COLORS.white,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },

  // Wrapper
  wrapper: {
    backgroundColor: BRAND_COLORS.background,
    padding: '40px 20px',
  },

  // Header
  header: {
    backgroundColor: BRAND_COLORS.primary,
    padding: '24px',
    textAlign: 'center' as const,
  },

  logo: {
    width: '150px',
    height: 'auto',
  },

  // Body
  body: {
    padding: '32px 24px',
    backgroundColor: BRAND_COLORS.white,
  },

  // Typography
  heading1: {
    fontSize: '24px',
    fontWeight: '700',
    color: BRAND_COLORS.text,
    marginBottom: '16px',
    lineHeight: '1.3',
  },

  heading2: {
    fontSize: '20px',
    fontWeight: '600',
    color: BRAND_COLORS.text,
    marginBottom: '12px',
    lineHeight: '1.3',
  },

  paragraph: {
    fontSize: '16px',
    color: BRAND_COLORS.text,
    lineHeight: '1.6',
    marginBottom: '16px',
  },

  smallText: {
    fontSize: '14px',
    color: BRAND_COLORS.textMuted,
    lineHeight: '1.5',
  },

  // Buttons
  button: {
    display: 'inline-block',
    backgroundColor: BRAND_COLORS.primary,
    color: BRAND_COLORS.white,
    padding: '14px 28px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '16px',
    textAlign: 'center' as const,
  },

  buttonSecondary: {
    display: 'inline-block',
    backgroundColor: 'transparent',
    color: BRAND_COLORS.primary,
    padding: '12px 24px',
    borderRadius: '8px',
    border: `2px solid ${BRAND_COLORS.primary}`,
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '14px',
    textAlign: 'center' as const,
  },

  // Cards
  card: {
    backgroundColor: BRAND_COLORS.background,
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px',
    border: `1px solid ${BRAND_COLORS.border}`,
  },

  // Divider
  divider: {
    borderTop: `1px solid ${BRAND_COLORS.border}`,
    margin: '24px 0',
  },

  // Footer
  footer: {
    backgroundColor: BRAND_COLORS.background,
    padding: '24px',
    textAlign: 'center' as const,
  },

  footerText: {
    fontSize: '12px',
    color: BRAND_COLORS.footer,
    lineHeight: '1.5',
    marginBottom: '8px',
  },

  footerLink: {
    color: BRAND_COLORS.footer,
    textDecoration: 'underline',
  },

  // Utility
  center: {
    textAlign: 'center' as const,
  },

  mb16: {
    marginBottom: '16px',
  },

  mb24: {
    marginBottom: '24px',
  },

  mt16: {
    marginTop: '16px',
  },

  mt24: {
    marginTop: '24px',
  },
};

// ============================================================================
// Style Helpers
// ============================================================================

/**
 * Convert style object to inline CSS string
 */
export function styleToString(style: EmailStyles): string {
  return Object.entries(style)
    .map(([key, value]) => {
      const cssKey = key.replaceAll(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');
}

/**
 * Merge multiple style objects
 */
export function mergeStyles(...styles: EmailStyles[]): EmailStyles {
  return Object.assign({}, ...styles);
}

// ============================================================================
// HTML Builders
// ============================================================================

/**
 * Create a button HTML
 */
export function createButton(
  text: string,
  url: string,
  variant: 'primary' | 'secondary' = 'primary'
): string {
  const style = variant === 'primary' ? commonStyles.button : commonStyles.buttonSecondary;
  return `<a href="${url}" style="${styleToString(style)}" target="_blank">${text}</a>`;
}

/**
 * Create a card HTML
 */
export function createCard(content: string, title?: string): string {
  const titleHtml = title
    ? `<h3 style="${styleToString(commonStyles.heading2)}">${title}</h3>`
    : '';
  return `
    <div style="${styleToString(commonStyles.card)}">
      ${titleHtml}
      ${content}
    </div>
  `;
}

/**
 * Create info row (label: value)
 */
export function createInfoRow(label: string, value: string): string {
  return `
    <p style="${styleToString(commonStyles.paragraph)}">
      <strong>${label}:</strong> ${value}
    </p>
  `;
}

/**
 * Create a divider
 */
export function createDivider(): string {
  return `<hr style="${styleToString(commonStyles.divider)}" />`;
}

// ============================================================================
// Template Wrapper
// ============================================================================

export interface WrapperOptions extends BaseTemplateData {
  title: string;
  body: string;
  showLogo?: boolean;
}

/**
 * Wrap email content in standard template structure
 */
export function wrapEmailContent(options: WrapperOptions): string {
  const {
    title,
    body,
    previewText,
    unsubscribeUrl = 'https://skillancer.com/email/unsubscribe',
    preferencesUrl = 'https://skillancer.com/settings/notifications',
    supportEmail = 'support@skillancer.com',
    companyAddress = 'Skillancer Inc., 123 Tech Street, San Francisco, CA 94105',
    year = new Date().getFullYear(),
    showLogo = true,
  } = options;

  const previewTextHtml = previewText
    ? `<span style="display: none; max-height: 0; overflow: hidden;">${previewText}</span>`
    : '';

  const logoHtml = showLogo
    ? `
      <div style="${styleToString(commonStyles.header)}">
        <img 
          src="https://skillancer.com/logo-white.png" 
          alt="Skillancer" 
          width="150" 
          style="${styleToString(commonStyles.logo)}"
        />
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; ${styleToString(commonStyles.wrapper)}">
  ${previewTextHtml}
  
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="${styleToString(commonStyles.container)}; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td>
              ${logoHtml}
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="${styleToString(commonStyles.body)}">
              ${body}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="${styleToString(commonStyles.footer)}">
              <p style="${styleToString(commonStyles.footerText)}">
                You received this email because you have an account on Skillancer.
              </p>
              <p style="${styleToString(commonStyles.footerText)}">
                <a href="${preferencesUrl}" style="${styleToString(commonStyles.footerLink)}">Email Preferences</a>
                &nbsp;|&nbsp;
                <a href="${unsubscribeUrl}" style="${styleToString(commonStyles.footerLink)}">Unsubscribe</a>
                &nbsp;|&nbsp;
                <a href="mailto:${supportEmail}" style="${styleToString(commonStyles.footerLink)}">Contact Support</a>
              </p>
              <p style="${styleToString(commonStyles.footerText)}">
                ${companyAddress}
              </p>
              <p style="${styleToString(commonStyles.footerText)}">
                © ${year} Skillancer. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Strip HTML for plain text version
 */
export function htmlToPlainText(html: string): string {
  return (
    html
      // Remove script and style tags with content
      .replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replaceAll(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Replace common block elements with newlines
      .replaceAll(/<\/?(div|p|br|h[1-6]|table|tr|td|li|ul|ol)[^>]*>/gi, '\n')
      // Remove remaining HTML tags
      .replaceAll(/<[^>]+>/g, '')
      // Decode HTML entities
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      // Clean up whitespace
      .replaceAll(/\n{3,}/g, '\n\n')
      .replaceAll(/[ \t]+/g, ' ')
      .trim()
  );
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date for display in emails
 */
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'relative' = 'short',
  locale = 'en-US'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (format === 'relative') {
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  const options: Intl.DateTimeFormatOptions =
    format === 'long'
      ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };

  return dateObj.toLocaleDateString(locale, options);
}

// ============================================================================
// Types for External Use
// ============================================================================

export interface EmailContentOptions {
  previewText?: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  supportEmail?: string;
  companyAddress?: string;
  year?: number;
}

export default {
  BRAND_COLORS,
  commonStyles,
  styleToString,
  mergeStyles,
  createButton,
  createCard,
  createInfoRow,
  createDivider,
  wrapEmailContent,
  htmlToPlainText,
  formatCurrency,
  formatDate,
};
