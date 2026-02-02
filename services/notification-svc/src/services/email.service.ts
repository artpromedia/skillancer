/**
 * Email Service using SendGrid
 */

import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';
import { getConfig, EMAIL_TEMPLATES } from '../config/index.js';
import type {
  EmailNotificationInput,
  EmailSendResult,
  EmailType,
} from '../types/notification.types.js';

export class EmailService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      const config = getConfig();
      sgMail.setApiKey(config.sendgridApiKey);
      this.initialized = true;
    } catch {
      // Config not ready yet, will initialize on first use
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      const config = getConfig();
      sgMail.setApiKey(config.sendgridApiKey);
      this.initialized = true;
    }
  }

  /**
   * Send a single email
   */
  async sendEmail(input: EmailNotificationInput): Promise<EmailSendResult> {
    this.ensureInitialized();
    const config = getConfig();

    try {
      const message: MailDataRequired = {
        to: input.to,
        from: {
          email: config.sendgridFromEmail,
          name: config.sendgridFromName,
        },
        subject: input.subject,
        replyTo: input.replyTo,
        cc: input.cc,
        bcc: input.bcc,
        // Default text content to satisfy MailDataRequired
        text: input.textContent || ' ',
      };

      // Use template or raw content
      if (input.templateId) {
        message.templateId = input.templateId;
        message.dynamicTemplateData = input.templateData;
      } else if (input.htmlContent) {
        message.html = input.htmlContent;
        message.text = input.textContent || this.stripHtml(input.htmlContent);
      } else if (input.textContent) {
        message.text = input.textContent;
      }

      // Add attachments if provided
      if (input.attachments?.length) {
        message.attachments = input.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          type: att.contentType,
          disposition: 'attachment',
        }));
      }

      const [response] = await sgMail.send(message);

      return {
        success: response.statusCode >= 200 && response.statusCode < 300,
        messageId: response.headers['x-message-id'] as string,
      };
    } catch (error: any) {
      console.error('SendGrid error:', error.response?.body || error.message);
      return {
        success: false,
        error: error.response?.body?.errors?.[0]?.message || error.message,
      };
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(inputs: EmailNotificationInput[]): Promise<EmailSendResult[]> {
    this.ensureInitialized();
    const config = getConfig();

    const messages: MailDataRequired[] = inputs.map((input) => ({
      to: input.to,
      from: {
        email: config.sendgridFromEmail,
        name: config.sendgridFromName,
      },
      subject: input.subject,
      templateId: input.templateId,
      dynamicTemplateData: input.templateData,
      html: input.htmlContent,
      text: input.textContent,
    }));

    try {
      const responses = await sgMail.send(messages);
      return responses.map((response) => ({
        success: true,
        messageId: response[0].headers['x-message-id'] as string,
      }));
    } catch (error: any) {
      console.error('SendGrid bulk error:', error.response?.body || error.message);
      return inputs.map(() => ({
        success: false,
        error: error.response?.body?.errors?.[0]?.message || error.message,
      }));
    }
  }

  /**
   * Send templated email by type
   */
  async sendTemplatedEmail(
    to: string,
    emailType: EmailType,
    templateData: Record<string, unknown>,
    options?: {
      userId?: string;
      tenantId?: string;
      subject?: string;
      replyTo?: string;
    }
  ): Promise<EmailSendResult> {
    const templateId = EMAIL_TEMPLATES[emailType];

    if (!templateId) {
      console.warn(`No template found for email type: ${emailType}, using fallback`);
      return this.sendFallbackEmail(to, emailType, templateData, options);
    }

    const input: EmailNotificationInput = {
      userId: options?.userId || '',
      channels: ['EMAIL'],
      emailType,
      to,
      subject: options?.subject || this.getDefaultSubject(emailType),
      templateId,
      templateData,
      replyTo: options?.replyTo,
    };

    return this.sendEmail(input);
  }

  /**
   * Send fallback email when template is not available
   */
  private async sendFallbackEmail(
    to: string,
    emailType: EmailType,
    data: Record<string, unknown>,
    options?: { userId?: string; subject?: string; replyTo?: string }
  ): Promise<EmailSendResult> {
    const content = this.generateFallbackContent(emailType, data);

    const input: EmailNotificationInput = {
      userId: options?.userId || '',
      channels: ['EMAIL'],
      emailType,
      to,
      subject: options?.subject || this.getDefaultSubject(emailType),
      htmlContent: content.html,
      textContent: content.text,
      replyTo: options?.replyTo,
    };

    return this.sendEmail(input);
  }

  /**
   * Get default subject for email type
   */
  private getDefaultSubject(emailType: EmailType): string {
    const subjects: Record<EmailType, string> = {
      WELCOME: 'Welcome to Skillancer!',
      EMAIL_VERIFICATION: 'Verify your email address',
      PASSWORD_RESET: 'Reset your password',
      CONTRACT_INVITATION: 'You have a new contract invitation',
      CONTRACT_ACCEPTED: 'Contract accepted!',
      CONTRACT_COMPLETED: 'Contract completed successfully',
      PAYMENT_RECEIVED: 'Payment received',
      PAYMENT_SENT: 'Payment sent',
      MILESTONE_COMPLETED: 'Milestone completed',
      MESSAGE_RECEIVED: 'New message received',
      PROPOSAL_RECEIVED: 'New proposal received',
      PROPOSAL_ACCEPTED: 'Your proposal was accepted!',
      PROPOSAL_REJECTED: 'Proposal update',
      PROFILE_VIEWED: 'Someone viewed your profile',
      WEEKLY_DIGEST: 'Your weekly Skillancer digest',
      SECURITY_ALERT: 'Security alert for your account',
      ACCOUNT_SUSPENDED: 'Account status update',
      INVOICE_CREATED: 'New invoice created',
      INVOICE_PAID: 'Invoice paid',
      EXECUTIVE_ENGAGEMENT_INVITE: 'Executive engagement invitation',
      WARM_INTRODUCTION: 'You have a new introduction',
      CERTIFICATION_PASSED: 'Congratulations on your certification!',
      CERTIFICATION_EXPIRING: 'Your certification is expiring soon',
    };

    return subjects[emailType] || 'Notification from Skillancer';
  }

  /**
   * Generate fallback content for emails
   */
  private generateFallbackContent(
    emailType: EmailType,
    data: Record<string, unknown>
  ): { html: string; text: string } {
    const userName = (data.userName as string) || 'there';
    const actionUrl = data.actionUrl as string;

    let content = '';

    switch (emailType) {
      case 'WELCOME':
        content = `Hi ${userName},\n\nWelcome to Skillancer! We're excited to have you on board.\n\nGet started by completing your profile and exploring opportunities.\n\nBest regards,\nThe Skillancer Team`;
        break;
      case 'EMAIL_VERIFICATION':
        content = `Hi ${userName},\n\nPlease verify your email by clicking the link below:\n\n${actionUrl}\n\nThis link expires in 24 hours.\n\nBest regards,\nThe Skillancer Team`;
        break;
      case 'PASSWORD_RESET':
        content = `Hi ${userName},\n\nWe received a request to reset your password. Click the link below:\n\n${actionUrl}\n\nThis link expires in 1 hour. If you didn't request this, please ignore this email.\n\nBest regards,\nThe Skillancer Team`;
        break;
      default:
        content = `Hi ${userName},\n\n${JSON.stringify(data, null, 2)}\n\nBest regards,\nThe Skillancer Team`;
    }

    const html = content
      .split('\n')
      .map((line) => (line.startsWith('http') ? `<a href="${line}">${line}</a>` : line))
      .join('<br>');

    return { html: `<p>${html}</p>`, text: content };
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replaceAll(/<[^>]*>/g, '')
      .replaceAll(/\s+/g, ' ')
      .trim();
  }

  /**
   * Validate email address format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
