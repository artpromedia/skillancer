/**
 * Email Templates Index
 *
 * Central export for all email templates
 */

// Base template utilities
export {
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
  type EmailContentOptions,
} from './base.js';

// Import template generators for local use in registry
import {
  generateContractMilestoneEmail,
  type ContractMilestoneEmailData,
  type MilestoneEventType,
} from './contract-milestone.js';
import { generateNewMessageEmail, type NewMessageEmailData } from './new-message.js';
import { generateNewProposalEmail, type NewProposalEmailData } from './new-proposal.js';
import { generatePaymentReceivedEmail, type PaymentReceivedEmailData } from './payment-received.js';
import {
  generateProposalAcceptedEmail,
  type ProposalAcceptedEmailData,
} from './proposal-accepted.js';
import { generateVerificationEmail, type VerificationEmailData } from './verification.js';
import { generateWelcomeEmail, type WelcomeEmailData } from './welcome.js';
import {
  digestEmailTemplate,
  type DigestEmailOptions,
  type DigestNotificationItem,
} from './digest.js';

// Re-export template generators and types
export { generateWelcomeEmail, type WelcomeEmailData };
export { generateVerificationEmail, type VerificationEmailData };
export { generateNewProposalEmail, type NewProposalEmailData };
export { generateProposalAcceptedEmail, type ProposalAcceptedEmailData };
export { generateNewMessageEmail, type NewMessageEmailData };
export { generatePaymentReceivedEmail, type PaymentReceivedEmailData };
export { generateContractMilestoneEmail, type ContractMilestoneEmailData, type MilestoneEventType };
export { digestEmailTemplate, type DigestEmailOptions, type DigestNotificationItem };

// ============================================================================
// Template Registry
// ============================================================================

export type EmailTemplateType =
  | 'welcome'
  | 'verification'
  | 'new-proposal'
  | 'proposal-accepted'
  | 'new-message'
  | 'payment-received'
  | 'contract-milestone'
  | 'password-reset'
  | 'password-changed'
  | 'two-factor-enabled'
  | 'two-factor-disabled'
  | 'account-suspended'
  | 'account-reactivated'
  | 'contract-created'
  | 'contract-signed'
  | 'contract-completed'
  | 'dispute-opened'
  | 'dispute-resolved'
  | 'review-received'
  | 'weekly-digest'
  | 'guild-invitation'
  | 'guild-notification';

/**
 * Template generator function type
 */
export type TemplateGenerator<T> = (data: T) => {
  html: string;
  text: string;
  subject: string;
};

/**
 * Registry of all available email templates
 */
export const EMAIL_TEMPLATE_GENERATORS = {
  welcome: generateWelcomeEmail,
  verification: generateVerificationEmail,
  'new-proposal': generateNewProposalEmail,
  'proposal-accepted': generateProposalAcceptedEmail,
  'new-message': generateNewMessageEmail,
  'payment-received': generatePaymentReceivedEmail,
  'contract-milestone': generateContractMilestoneEmail,
} as const;

/**
 * Check if a template exists in the registry
 */
export function hasTemplate(type: string): boolean {
  return type in EMAIL_TEMPLATE_GENERATORS;
}

/**
 * Get a template generator by type
 */
export function getTemplateGenerator<T>(
  type: keyof typeof EMAIL_TEMPLATE_GENERATORS
): TemplateGenerator<T> | undefined {
  return EMAIL_TEMPLATE_GENERATORS[type] as TemplateGenerator<T> | undefined;
}

/**
 * Generate an email from a template type and data
 */
export function generateEmail<T>(
  type: keyof typeof EMAIL_TEMPLATE_GENERATORS,
  data: T
): { html: string; text: string; subject: string } {
  const generator = EMAIL_TEMPLATE_GENERATORS[type];
  if (!generator) {
    throw new Error(`Unknown email template type: ${type}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (generator as TemplateGenerator<any>)(data);
}
