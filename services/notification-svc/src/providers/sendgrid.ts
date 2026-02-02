/**
 * SendGrid Email Provider
 *
 * Enterprise-grade email sending with:
 * - Error handling and retry logic
 * - Rate limiting
 * - Delivery tracking
 * - Template support
 */

import sgMail from '@sendgrid/mail';
import { logger } from '@skillancer/logger';

import { getConfig } from '../config/index.js';

import type { MailDataRequired, ResponseError } from '@sendgrid/mail';

// ============================================================================
// Types
// ============================================================================

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  webhookKey?: string;
  sandboxMode?: boolean;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendGridAttachment {
  filename: string;
  content: string; // Base64 encoded
  type: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  replyTo?: EmailRecipient;
  attachments?: SendGridAttachment[];
  categories?: string[];
  customArgs?: Record<string, string>;
  sendAt?: number; // Unix timestamp for scheduled sending
  headers?: Record<string, string>;
  trackingSettings?: {
    clickTracking?: boolean;
    openTracking?: boolean;
    subscriptionTracking?: boolean;
  };
  asm?: {
    groupId: number;
    groupsToDisplay?: number[];
  };
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  statusCode?: number;
  error?: {
    code: string;
    message: string;
    field?: string;
  };
  timestamp: Date;
}

export interface BulkEmailResult {
  totalSent: number;
  totalFailed: number;
  results: SendEmailResult[];
}

// ============================================================================
// Error Codes
// ============================================================================

export const SENDGRID_ERROR_CODES = {
  INVALID_API_KEY: 'SG001',
  RATE_LIMITED: 'SG002',
  INVALID_RECIPIENT: 'SG003',
  TEMPLATE_NOT_FOUND: 'SG004',
  CONTENT_ERROR: 'SG005',
  ATTACHMENT_ERROR: 'SG006',
  NETWORK_ERROR: 'SG007',
  UNKNOWN_ERROR: 'SG999',
} as const;

// ============================================================================
// SendGrid Provider Class
// ============================================================================

export class SendGridProvider {
  private initialized = false;
  private config: SendGridConfig | null = null;
  private rateLimitRemaining = 100;
  private rateLimitResetTime: Date | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the SendGrid client
   */
  private initialize(): void {
    try {
      const appConfig = getConfig();
      this.config = {
        apiKey: appConfig.sendgridApiKey,
        fromEmail: appConfig.sendgridFromEmail,
        fromName: appConfig.sendgridFromName,
        webhookKey: appConfig.sendgridWebhookKey,
        sandboxMode: appConfig.nodeEnv === 'test',
      };
      sgMail.setApiKey(this.config.apiKey);
      this.initialized = true;
      logger.info('SendGrid provider initialized');
    } catch {
      // Config not ready yet - will initialize on first use
      logger.warn('SendGrid provider initialization deferred - config not ready');
    }
  }

  /**
   * Ensure the provider is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      this.initialize();
      if (!this.initialized || !this.config) {
        throw new Error('SendGrid provider not initialized');
      }
    }
  }

  /**
   * Check if rate limited
   */
  private isRateLimited(): boolean {
    if (this.rateLimitRemaining <= 0 && this.rateLimitResetTime) {
      return new Date() < this.rateLimitResetTime;
    }
    return false;
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimits(headers: Record<string, string>): void {
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];

    if (remaining) {
      this.rateLimitRemaining = Number.parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitResetTime = new Date(Number.parseInt(reset, 10) * 1000);
    }
  }

  /**
   * Parse SendGrid error response
   */
  private parseError(error: unknown): SendEmailResult['error'] {
    const sgError = error as ResponseError;

    if (sgError.response?.body) {
      const body = sgError.response.body as {
        errors?: Array<{ message: string; field?: string }>;
      };
      if (body.errors?.[0]) {
        return {
          code: this.getErrorCode(sgError.code),
          message: body.errors[0].message,
          field: body.errors[0].field,
        };
      }
    }

    const nodeErrorCode = (sgError as unknown as { code?: string }).code;
    if (nodeErrorCode === 'ENOTFOUND' || nodeErrorCode === 'ECONNREFUSED') {
      return {
        code: SENDGRID_ERROR_CODES.NETWORK_ERROR,
        message: 'Network error - unable to connect to SendGrid',
      };
    }

    return {
      code: SENDGRID_ERROR_CODES.UNKNOWN_ERROR,
      message: sgError.message || 'Unknown error occurred',
    };
  }

  /**
   * Map error code to internal code
   */
  private getErrorCode(statusCode?: number | string): string {
    const code = typeof statusCode === 'string' ? Number.parseInt(statusCode, 10) : statusCode;
    if (code === 401 || code === 403) {
      return SENDGRID_ERROR_CODES.INVALID_API_KEY;
    }
    if (code === 429) {
      return SENDGRID_ERROR_CODES.RATE_LIMITED;
    }
    if (code === 400) {
      return SENDGRID_ERROR_CODES.CONTENT_ERROR;
    }
    return SENDGRID_ERROR_CODES.UNKNOWN_ERROR;
  }

  /**
   * Build base mail data with recipients and sender
   */
  private buildBaseMailData(options: SendEmailOptions): Record<string, unknown> {
    const toRecipients = Array.isArray(options.to) ? options.to : [options.to];

    return {
      to: toRecipients.map((r) => ({ email: r.email, name: r.name })),
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName,
      },
      subject: options.subject,
    };
  }

  /**
   * Add content (template or HTML/text) to mail data
   */
  private addContent(mailData: Record<string, unknown>, options: SendEmailOptions): void {
    if (options.templateId) {
      mailData.templateId = options.templateId;
      if (options.dynamicTemplateData) {
        mailData.dynamicTemplateData = options.dynamicTemplateData;
      }
    } else {
      if (options.html) mailData.html = options.html;
      if (options.text) mailData.text = options.text;
      if (!mailData.html && !mailData.text) mailData.text = '';
    }
  }

  /**
   * Add optional recipients (CC, BCC, ReplyTo)
   */
  private addOptionalRecipients(
    mailData: Record<string, unknown>,
    options: SendEmailOptions
  ): void {
    if (options.cc?.length) {
      mailData.cc = options.cc.map((r) => ({ email: r.email, name: r.name }));
    }
    if (options.bcc?.length) {
      mailData.bcc = options.bcc.map((r) => ({ email: r.email, name: r.name }));
    }
    if (options.replyTo) {
      mailData.replyTo = { email: options.replyTo.email, name: options.replyTo.name };
    }
  }

  /**
   * Add attachments to mail data
   */
  private addAttachments(mailData: Record<string, unknown>, options: SendEmailOptions): void {
    if (options.attachments?.length) {
      mailData.attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        type: att.type,
        disposition: att.disposition || 'attachment',
        contentId: att.contentId,
      }));
    }
  }

  /**
   * Add tracking and metadata settings
   */
  private addTrackingAndMetadata(
    mailData: Record<string, unknown>,
    options: SendEmailOptions
  ): void {
    if (options.categories?.length) mailData.categories = options.categories;
    if (options.customArgs) mailData.customArgs = options.customArgs;
    if (options.sendAt) mailData.sendAt = options.sendAt;
    if (options.headers) mailData.headers = options.headers;

    if (options.trackingSettings) {
      mailData.trackingSettings = {
        clickTracking: options.trackingSettings.clickTracking
          ? { enable: true, enableText: true }
          : { enable: false },
        openTracking: options.trackingSettings.openTracking ? { enable: true } : { enable: false },
        subscriptionTracking: options.trackingSettings.subscriptionTracking
          ? { enable: true }
          : { enable: false },
      };
    }

    if (options.asm) {
      mailData.asm = {
        groupId: options.asm.groupId,
        groupsToDisplay: options.asm.groupsToDisplay,
      };
    }
  }

  /**
   * Build mail data from options
   */
  private buildMailData(options: SendEmailOptions): MailDataRequired {
    this.ensureInitialized();

    const mailData = this.buildBaseMailData(options);
    this.addContent(mailData, options);
    this.addOptionalRecipients(mailData, options);
    this.addAttachments(mailData, options);
    this.addTrackingAndMetadata(mailData, options);

    // Sandbox mode for testing
    if (this.config.sandboxMode) {
      mailData.mailSettings = { sandboxMode: { enable: true } };
    }

    return mailData as unknown as MailDataRequired;
  }

  /**
   * Send a single email
   */
  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    this.ensureInitialized();

    const timestamp = new Date();

    // Check rate limiting
    if (this.isRateLimited()) {
      logger.warn('SendGrid rate limit exceeded, request queued');
      return {
        success: false,
        error: {
          code: SENDGRID_ERROR_CODES.RATE_LIMITED,
          message: 'Rate limit exceeded. Please try again later.',
        },
        timestamp,
      };
    }

    try {
      const mailData = this.buildMailData(options);
      const [response] = await sgMail.send(mailData);

      // Update rate limits from response
      this.updateRateLimits(response.headers as unknown as Record<string, string>);

      const messageId = response.headers['x-message-id'] as string;

      logger.info(
        {
          messageId,
          to: Array.isArray(options.to) ? options.to.map((r) => r.email) : [options.to.email],
          subject: options.subject,
          templateId: options.templateId,
        },
        'Email sent successfully'
      );

      return {
        success: true,
        messageId,
        statusCode: response.statusCode,
        timestamp,
      };
    } catch (error) {
      const parsedError = this.parseError(error);

      logger.error(
        {
          error: parsedError,
          to: Array.isArray(options.to) ? options.to.map((r) => r.email) : [options.to.email],
          subject: options.subject,
        },
        'Failed to send email'
      );

      return {
        success: false,
        error: parsedError,
        timestamp,
      };
    }
  }

  /**
   * Send multiple emails in bulk
   */
  async sendBulk(emailOptions: SendEmailOptions[]): Promise<BulkEmailResult> {
    this.ensureInitialized();

    const results: SendEmailResult[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    // SendGrid recommends batches of 1000
    const batchSize = 1000;
    const batches: SendEmailOptions[][] = [];

    for (let i = 0; i < emailOptions.length; i += batchSize) {
      batches.push(emailOptions.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      try {
        const mailDataArray = batch.map((opts) => this.buildMailData(opts));
        const responses = await sgMail.send(mailDataArray);

        // Process responses
        for (const response of responses) {
          // Handle response being either array or single ClientResponse
          const clientResponse = Array.isArray(response) ? response[0] : response;
          const respHeaders =
            (clientResponse as { headers?: Record<string, string> }).headers || {};
          const respStatusCode = (clientResponse as { statusCode?: number }).statusCode;
          const messageId = respHeaders['x-message-id'];

          results.push({
            success: true,
            messageId,
            statusCode: respStatusCode,
            timestamp: new Date(),
          });
          totalSent++;
        }
      } catch (error) {
        const parsedError = this.parseError(error);

        // Mark all in batch as failed
        for (const _ of batch) {
          results.push({
            success: false,
            error: parsedError,
            timestamp: new Date(),
          });
          totalFailed++;
        }

        logger.error(
          {
            error: parsedError,
            batchSize: batch.length,
          },
          'Bulk email batch failed'
        );
      }
    }

    logger.info({ totalSent, totalFailed }, 'Bulk email completed');

    return {
      totalSent,
      totalFailed,
      results,
    };
  }

  /**
   * Send email with retry logic
   */
  async sendWithRetry(
    options: SendEmailOptions,
    maxRetries = 3,
    delayMs = 1000
  ): Promise<SendEmailResult> {
    let lastError: SendEmailResult['error'];
    let attempt = 0;

    while (attempt < maxRetries) {
      const result = await this.send(options);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Don't retry on permanent failures
      if (
        result.error?.code === SENDGRID_ERROR_CODES.INVALID_API_KEY ||
        result.error?.code === SENDGRID_ERROR_CODES.INVALID_RECIPIENT ||
        result.error?.code === SENDGRID_ERROR_CODES.CONTENT_ERROR
      ) {
        return result;
      }

      attempt++;
      logger.warn(
        {
          error: result.error,
          retriesRemaining: maxRetries - attempt,
        },
        `Email send attempt ${attempt} failed, retrying...`
      );

      // Exponential backoff
      await this.delay(delayMs * Math.pow(2, attempt - 1));
    }

    return {
      success: false,
      error: lastError || {
        code: SENDGRID_ERROR_CODES.UNKNOWN_ERROR,
        message: `Failed after ${maxRetries} attempts`,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Validate email address
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get provider stats
   */
  getStats(): {
    initialized: boolean;
    rateLimitRemaining: number;
    rateLimitResetTime: Date | null;
  } {
    return {
      initialized: this.initialized,
      rateLimitRemaining: this.rateLimitRemaining,
      rateLimitResetTime: this.rateLimitResetTime,
    };
  }

  /**
   * Delay helper
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let providerInstance: SendGridProvider | null = null;

export function getSendGridProvider(): SendGridProvider {
  if (!providerInstance) {
    providerInstance = new SendGridProvider();
  }
  return providerInstance;
}

export default SendGridProvider;
