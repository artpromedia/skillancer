/**
 * SMS Service using Twilio
 * Handles SMS notifications with delivery tracking
 */

import Twilio from 'twilio';
import { getConfig } from '../config/index.js';
import { createLogger } from '@skillancer/logger';

// Twilio message options interface
interface TwilioMessageOptions {
  to: string;
  from: string;
  body: string;
  mediaUrl?: string[];
  statusCallback?: string;
}

const logger = createLogger({ name: 'SmsService' });

export interface SMSNotificationInput {
  userId: string;
  to: string;
  body: string;
  mediaUrl?: string[];
  statusCallback?: string;
  metadata?: Record<string, unknown>;
}

export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  segments?: number;
  price?: string;
  priceUnit?: string;
}

export interface SMSDeliveryStatus {
  messageId: string;
  to: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

export class SmsService {
  private client: Twilio.Twilio | null = null;
  private initialized = false;
  private fromNumber: string = '';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      const config = getConfig();

      if (config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber) {
        this.client = Twilio(config.twilioAccountSid, config.twilioAuthToken);
        this.fromNumber = config.twilioPhoneNumber;
        this.initialized = true;
        logger.info('Twilio SMS service initialized successfully');
      } else {
        logger.warn('Twilio SMS service not configured - missing credentials');
      }
    } catch (error) {
      // Config not ready yet, will initialize on first use
      logger.debug('Twilio initialization deferred - config not ready');
    }
  }

  private ensureInitialized(): boolean {
    if (!this.initialized) {
      this.initialize();
    }
    return this.initialized;
  }

  /**
   * Send an SMS message
   */
  async sendSMS(input: SMSNotificationInput): Promise<SMSSendResult> {
    if (!this.ensureInitialized() || !this.client) {
      logger.error('SMS send failed - Twilio not configured');
      return {
        success: false,
        error: 'Twilio SMS service not configured',
      };
    }

    // Validate phone number format (E.164)
    if (!this.isValidPhoneNumber(input.to)) {
      logger.warn({ to: input.to }, 'Invalid phone number format');
      return {
        success: false,
        error: 'Invalid phone number format. Please use E.164 format (e.g., +1234567890)',
      };
    }

    try {
      const config = getConfig();
      const messageOptions: TwilioMessageOptions = {
        to: input.to,
        from: this.fromNumber,
        body: input.body,
      };

      // Add media URLs if provided (for MMS)
      if (input.mediaUrl?.length) {
        messageOptions.mediaUrl = input.mediaUrl;
      }

      // Add status callback if configured
      if (input.statusCallback || config.twilioWebhookUrl) {
        messageOptions.statusCallback = input.statusCallback || config.twilioWebhookUrl;
      }

      const message = await this.client.messages.create(messageOptions);

      logger.info(
        {
          messageId: message.sid,
          to: input.to,
          status: message.status,
          userId: input.userId,
        },
        'SMS sent successfully'
      );

      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        segments: message.numSegments ? parseInt(message.numSegments, 10) : 1,
        price: message.price || undefined,
        priceUnit: message.priceUnit || undefined,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown Twilio error';
      const errorCode = error.code || 'UNKNOWN';

      logger.error(
        {
          error: errorMessage,
          code: errorCode,
          to: input.to,
          userId: input.userId,
        },
        'SMS send failed'
      );

      return {
        success: false,
        error: `Twilio error (${errorCode}): ${errorMessage}`,
      };
    }
  }

  /**
   * Send OTP/verification code via SMS
   */
  async sendOTP(
    userId: string,
    to: string,
    code: string,
    expiryMinutes: number = 10
  ): Promise<SMSSendResult> {
    const body = `Your Skillancer verification code is: ${code}. This code expires in ${expiryMinutes} minutes. Never share this code with anyone.`;

    return this.sendSMS({
      userId,
      to,
      body,
      metadata: { type: 'otp', expiryMinutes },
    });
  }

  /**
   * Send security alert via SMS
   */
  async sendSecurityAlert(
    userId: string,
    to: string,
    alertType: string,
    details?: string
  ): Promise<SMSSendResult> {
    const body = `[Skillancer Security Alert] ${alertType}${details ? `: ${details}` : ''}. If this wasn't you, secure your account immediately at https://skillancer.com/security`;

    return this.sendSMS({
      userId,
      to,
      body,
      metadata: { type: 'security_alert', alertType },
    });
  }

  /**
   * Send payment notification via SMS
   */
  async sendPaymentNotification(
    userId: string,
    to: string,
    amount: number,
    currency: string,
    type: 'received' | 'sent'
  ): Promise<SMSSendResult> {
    const body =
      type === 'received'
        ? `Skillancer: You received a payment of ${currency}${amount.toFixed(2)}. View details at https://skillancer.com/payments`
        : `Skillancer: Your payment of ${currency}${amount.toFixed(2)} was sent successfully. View details at https://skillancer.com/payments`;

    return this.sendSMS({
      userId,
      to,
      body,
      metadata: { type: 'payment', amount, currency, paymentType: type },
    });
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(inputs: SMSNotificationInput[]): Promise<SMSSendResult[]> {
    const results: SMSSendResult[] = [];
    const batchSize = 50; // Twilio rate limit consideration

    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((input) => this.sendSMS(input)));
      results.push(...batchResults);

      // Rate limiting delay between batches
      if (i + batchSize < inputs.length) {
        await this.delay(1000);
      }
    }

    logger.info(
      {
        total: inputs.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
      'Bulk SMS operation completed'
    );

    return results;
  }

  /**
   * Get message delivery status
   */
  async getMessageStatus(messageId: string): Promise<SMSDeliveryStatus | null> {
    if (!this.ensureInitialized() || !this.client) {
      return null;
    }

    try {
      const message = await this.client.messages(messageId).fetch();

      return {
        messageId: message.sid,
        to: message.to,
        status: this.mapTwilioStatus(message.status),
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
        timestamp: message.dateUpdated || new Date(),
      };
    } catch (error: any) {
      logger.error({ error: error.message, messageId }, 'Failed to fetch message status');
      return null;
    }
  }

  /**
   * Handle Twilio webhook callback for delivery status
   */
  async handleDeliveryCallback(data: {
    MessageSid: string;
    MessageStatus: string;
    To?: string;
    ErrorCode?: string;
    ErrorMessage?: string;
  }): Promise<SMSDeliveryStatus> {
    const status: SMSDeliveryStatus = {
      messageId: data.MessageSid,
      to: data.To || '',
      status: this.mapTwilioStatus(data.MessageStatus),
      errorCode: data.ErrorCode,
      errorMessage: data.ErrorMessage,
      timestamp: new Date(),
    };

    logger.info(
      {
        messageId: status.messageId,
        status: status.status,
        errorCode: status.errorCode,
      },
      'SMS delivery status updated'
    );

    return status;
  }

  /**
   * Validate Twilio webhook signature
   */
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    if (!this.ensureInitialized()) {
      return false;
    }

    try {
      const config = getConfig();
      return Twilio.validateRequest(
        config.twilioAuthToken || '',
        signature,
        url,
        params
      );
    } catch (error: any) {
      logger.error({ error: error.message }, 'Webhook signature validation failed');
      return false;
    }
  }

  /**
   * Check if service is configured and ready
   */
  isConfigured(): boolean {
    return this.initialized;
  }

  /**
   * Get service health status
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.ensureInitialized() || !this.client) {
      return {
        healthy: false,
        message: 'Twilio SMS service not configured',
      };
    }

    try {
      // Verify account credentials by fetching account info
      const config = getConfig();
      const account = await this.client.api.accounts(config.twilioAccountSid!).fetch();

      return {
        healthy: account.status === 'active',
        message: `Twilio account status: ${account.status}`,
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: `Twilio health check failed: ${error.message}`,
      };
    }
  }

  // Private helper methods

  private isValidPhoneNumber(phone: string): boolean {
    // E.164 format validation: +[country code][number]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone.replace(/\s/g, ''));
  }

  private mapTwilioStatus(
    twilioStatus: string
  ): SMSDeliveryStatus['status'] {
    const statusMap: Record<string, SMSDeliveryStatus['status']> = {
      queued: 'queued',
      sending: 'sending',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'undelivered',
      failed: 'failed',
      receiving: 'queued',
      received: 'delivered',
      accepted: 'queued',
      scheduled: 'queued',
      read: 'delivered',
      partially_delivered: 'delivered',
      canceled: 'failed',
    };

    return statusMap[twilioStatus] || 'queued';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
