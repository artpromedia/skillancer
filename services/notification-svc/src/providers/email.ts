/**
 * Notification Service - Email Provider
 * SOC 2 compliant email delivery with tracking
 */

import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';
import { createLogger } from '@skillancer/logger';

// Extended mail data interface for building messages
interface SendGridMailData {
  to: string[];
  from: { email: string; name: string };
  subject: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  templateId?: string;
  dynamicTemplateData?: Record<string, string>;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
    disposition: string;
    contentId?: string;
  }>;
  headers?: Record<string, string>;
  categories?: string[];
  customArgs?: Record<string, string>;
  trackingSettings?: {
    clickTracking: { enable: boolean };
    openTracking: { enable: boolean };
  };
}

const logger = createLogger({ name: 'EmailProvider' });

export interface EmailConfig {
  provider: 'sendgrid' | 'ses' | 'mailgun' | 'smtp';
  apiKey?: string;
  region?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType: string;
  contentId?: string; // For inline attachments
}

export interface EmailResult {
  id: string;
  success: boolean;
  messageId?: string;
  provider: string;
  sentAt?: Date;
  error?: string;
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
  };
}

export interface EmailDeliveryStatus {
  id: string;
  messageId: string;
  recipient: string;
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'spam';
  timestamp: Date;
  details?: string;
  userAgent?: string;
  ipAddress?: string;
}

const DEFAULT_CONFIG: EmailConfig = {
  provider: 'sendgrid',
  fromEmail: process.env.SENDGRID_FROM_EMAIL || 'no-reply@skillancer.com',
  fromName: process.env.SENDGRID_FROM_NAME || 'Skillancer',
  replyTo: 'support@skillancer.com',
  trackOpens: true,
  trackClicks: true,
};

// In-memory tracking
const deliveryLog: EmailDeliveryStatus[] = [];
const sentEmails: Map<string, EmailResult> = new Map();

export class EmailProvider {
  private config: EmailConfig;
  private initialized = false;

  constructor(customConfig?: Partial<EmailConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
    this.initialize();
  }

  private initialize(): void {
    const apiKey = this.config.apiKey || process.env.SENDGRID_API_KEY;
    if (apiKey && this.config.provider === 'sendgrid') {
      sgMail.setApiKey(apiKey);
      this.initialized = true;
      logger.info('SendGrid email provider initialized');
    } else {
      logger.warn('Email provider not fully configured - SendGrid API key missing');
    }
  }

  /**
   * Send an email
   */
  async send(message: EmailMessage): Promise<EmailResult> {
    const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const recipients = this.normalizeRecipients(message);

    // Validate email addresses
    for (const email of [...recipients.to, ...recipients.cc, ...recipients.bcc]) {
      if (!this.isValidEmail(email)) {
        return {
          id,
          success: false,
          provider: this.config.provider,
          error: `Invalid email address: ${email}`,
          recipients,
        };
      }
    }

    try {
      // In production, call actual email provider
      const messageId = await this.sendViaProvider(message);

      const result: EmailResult = {
        id,
        success: true,
        messageId,
        provider: this.config.provider,
        sentAt: new Date(),
        recipients,
      };

      sentEmails.set(id, result);

      // Log delivery
      for (const email of recipients.to) {
        this.logDelivery(id, messageId, email, 'sent');
      }

      logger.info(
        { emailId: id, recipients: recipients.to, messageId },
        `Email sent successfully to ${recipients.to.join(', ')}`
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result: EmailResult = {
        id,
        success: false,
        provider: this.config.provider,
        error: errorMessage,
        recipients,
      };

      logger.error(
        { emailId: id, recipients: recipients.to, error: errorMessage },
        'Email send failed'
      );

      sentEmails.set(id, result);
      return result;
    }
  }

  /**
   * Send a templated email
   */
  async sendTemplate(
    templateId: string,
    to: string | string[],
    data: Record<string, unknown>,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      subject?: string;
    }
  ): Promise<EmailResult> {
    // Get template (in production, fetch from database)
    const template = EMAIL_TEMPLATES[templateId];
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Render template
    const html = this.renderTemplate(template.html, data);
    const text = template.text ? this.renderTemplate(template.text, data) : undefined;
    const subject = options?.subject || this.renderTemplate(template.subject, data);

    return this.send({
      to,
      cc: options?.cc,
      bcc: options?.bcc,
      subject,
      html,
      text,
      templateId,
      templateData: data,
      tags: [templateId],
    });
  }

  /**
   * Send bulk emails
   */
  async sendBulk(messages: EmailMessage[]): Promise<EmailResult[]> {
    // Process in batches of 100
    const batchSize = 100;
    const results: EmailResult[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (msg) => this.send(msg)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get delivery status
   */
  async getDeliveryStatus(emailId: string): Promise<EmailDeliveryStatus[]> {
    return deliveryLog.filter((d) => d.id === emailId);
  }

  /**
   * Get email metrics
   */
  async getMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  }> {
    const inRange = deliveryLog.filter((d) => d.timestamp >= startDate && d.timestamp <= endDate);

    const counts: Record<string, number> = {};
    for (const d of inRange) {
      counts[d.status] = (counts[d.status] || 0) + 1;
    }

    const sent = counts['sent'] || 0;
    const delivered = counts['delivered'] || 0;

    return {
      sent,
      delivered,
      opened: counts['opened'] || 0,
      clicked: counts['clicked'] || 0,
      bounced: counts['bounced'] || 0,
      failed: counts['failed'] || 0,
      openRate: delivered > 0 ? ((counts['opened'] || 0) / delivered) * 100 : 0,
      clickRate: delivered > 0 ? ((counts['clicked'] || 0) / delivered) * 100 : 0,
      bounceRate: sent > 0 ? ((counts['bounced'] || 0) / sent) * 100 : 0,
    };
  }

  // Private helpers

  private async sendViaProvider(message: EmailMessage): Promise<string> {
    if (!this.initialized || this.config.provider !== 'sendgrid') {
      // Fallback to mock for non-SendGrid or uninitialized providers
      logger.warn('Using mock email provider - SendGrid not initialized');
      await new Promise((resolve) => setTimeout(resolve, 50));
      return `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Build SendGrid message
    const sgMessage: SendGridMailData = {
      to: Array.isArray(message.to) ? message.to : [message.to],
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName,
      },
      subject: message.subject,
      replyTo: this.config.replyTo,
      trackingSettings: {
        clickTracking: { enable: this.config.trackClicks },
        openTracking: { enable: this.config.trackOpens },
      },
    };

    // Add CC/BCC if provided
    if (message.cc) {
      sgMessage.cc = Array.isArray(message.cc) ? message.cc : [message.cc];
    }
    if (message.bcc) {
      sgMessage.bcc = Array.isArray(message.bcc) ? message.bcc : [message.bcc];
    }

    // Use template or raw content
    if (message.templateId) {
      sgMessage.templateId = message.templateId;
      sgMessage.dynamicTemplateData = message.templateData as Record<string, string>;
    } else if (message.html) {
      sgMessage.html = message.html;
      sgMessage.text = message.text || this.stripHtml(message.html);
    } else if (message.text) {
      sgMessage.text = message.text;
    } else {
      // Default fallback content if nothing else is provided
      sgMessage.text = 'This is a notification from Skillancer.';
    }

    // Add attachments if provided
    if (message.attachments?.length) {
      sgMessage.attachments = message.attachments.map((att) => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
        type: att.contentType,
        disposition: att.contentId ? 'inline' : 'attachment',
        contentId: att.contentId,
      }));
    }

    // Add custom headers
    if (message.headers) {
      sgMessage.headers = message.headers;
    }

    // Add categories/tags for tracking
    if (message.tags?.length) {
      sgMessage.categories = message.tags;
    }

    // Add custom args for metadata tracking
    if (message.metadata) {
      sgMessage.customArgs = message.metadata;
    }

    try {
      const [response] = await sgMail.send(sgMessage as MailDataRequired);
      const messageId = response.headers['x-message-id'] as string;

      logger.info(
        {
          messageId,
          to: sgMessage.to,
          subject: message.subject,
          statusCode: response.statusCode,
        },
        'Email sent via SendGrid'
      );

      return messageId;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          response: error.response?.body,
          to: sgMessage.to,
        },
        'SendGrid email send failed'
      );
      throw new Error(error.response?.body?.errors?.[0]?.message || error.message);
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeRecipients(message: EmailMessage): {
    to: string[];
    cc: string[];
    bcc: string[];
  } {
    return {
      to: Array.isArray(message.to) ? message.to : [message.to],
      cc: message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]) : [],
      bcc: message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]) : [],
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private renderTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  private logDelivery(
    id: string,
    messageId: string,
    recipient: string,
    status: EmailDeliveryStatus['status'],
    details?: string
  ): void {
    deliveryLog.push({
      id,
      messageId,
      recipient,
      status,
      timestamp: new Date(),
      details,
    });
  }

  /**
   * Check if the email provider is configured and ready
   */
  isConfigured(): boolean {
    return this.initialized;
  }

  /**
   * Get the current provider type
   */
  getProvider(): string {
    return this.config.provider;
  }
}

// Email templates
const EMAIL_TEMPLATES: Record<string, { subject: string; html: string; text?: string }> = {
  welcome: {
    subject: 'Welcome to Skillancer, {{name}}!',
    html: `
      <h1>Welcome to Skillancer!</h1>
      <p>Hi {{name}},</p>
      <p>Thank you for joining Skillancer, the modern freelance marketplace.</p>
      <p>Get started by completing your profile and exploring opportunities.</p>
      <a href="{{dashboardUrl}}">Go to Dashboard</a>
    `,
    text: 'Welcome to Skillancer! Get started at {{dashboardUrl}}',
  },
  'password-reset': {
    subject: 'Reset Your Skillancer Password',
    html: `
      <h1>Password Reset Request</h1>
      <p>Hi {{name}},</p>
      <p>We received a request to reset your password. Click the link below to create a new password:</p>
      <a href="{{resetUrl}}">Reset Password</a>
      <p>This link expires in {{expiryMinutes}} minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  },
  invoice: {
    subject: 'Invoice #{{invoiceNumber}} from Skillancer',
    html: `
      <h1>Invoice #{{invoiceNumber}}</h1>
      <p>Amount: $\{{amount}}</p>
      <p>Due Date: {{dueDate}}</p>
      <a href="{{paymentUrl}}">Pay Now</a>
    `,
  },
  'project-invitation': {
    subject: "You've been invited to {{projectName}}",
    html: `
      <h1>Project Invitation</h1>
      <p>Hi {{name}},</p>
      <p>{{inviterName}} has invited you to join the project "{{projectName}}".</p>
      <a href="{{acceptUrl}}">Accept Invitation</a>
    `,
  },
  'security-alert': {
    subject: '⚠️ Security Alert: {{alertType}}',
    html: `
      <h1>Security Alert</h1>
      <p>We detected unusual activity on your account:</p>
      <p><strong>{{alertType}}</strong></p>
      <p>Time: {{timestamp}}</p>
      <p>Location: {{location}}</p>
      <p>If this wasn't you, please secure your account immediately:</p>
      <a href="{{securityUrl}}">Review Security Settings</a>
    `,
  },
  'incident-notification': {
    subject: '🔔 Incident Alert: {{incidentTitle}}',
    html: `
      <h1>Incident Notification</h1>
      <p>Incident ID: {{incidentId}}</p>
      <p>Severity: {{severity}}</p>
      <p>Status: {{status}}</p>
      <p>{{description}}</p>
      <a href="{{incidentUrl}}">View Details</a>
    `,
  },
};

export const emailProvider = new EmailProvider();
