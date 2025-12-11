/**
 * @module @skillancer/auth-svc/services/sms
 * SMS service for sending verification codes via Twilio
 */

import { createLogger } from '@skillancer/logger';

import { getConfig } from '../config/index.js';

const logger = createLogger({ serviceName: 'sms-service' });

// =============================================================================
// TYPES
// =============================================================================

export interface SmsService {
  /**
   * Send an SMS message
   */
  sendMessage(phoneNumber: string, message: string): Promise<SmsResult>;

  /**
   * Send a verification code
   */
  sendVerificationCode(phoneNumber: string, code: string): Promise<SmsResult>;

  /**
   * Check if the service is configured and available
   */
  isConfigured(): boolean;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =============================================================================
// TWILIO SMS SERVICE
// =============================================================================

/**
 * Production SMS service using Twilio
 */
export class TwilioSmsService implements SmsService {
  private client: Awaited<ReturnType<typeof import('twilio')>> | null = null;
  private readonly config = getConfig();

  /**
   * Get or create Twilio client (lazy initialization)
   */
  private async getClient(): Promise<Awaited<ReturnType<typeof import('twilio')>>> {
    if (this.client) {
      return this.client;
    }

    const { twilioAccountSid, twilioAuthToken } = this.config.sms;

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error('Twilio credentials not configured');
    }

    // Dynamic import to avoid loading twilio in dev mode
    const twilio = await import('twilio');
    this.client = twilio.default(twilioAccountSid, twilioAuthToken);

    return this.client;
  }

  /**
   * Check if Twilio is configured
   */
  isConfigured(): boolean {
    const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = this.config.sms;
    return !!(twilioAccountSid && twilioAuthToken && twilioPhoneNumber);
  }

  /**
   * Send an SMS message via Twilio
   */
  async sendMessage(phoneNumber: string, message: string): Promise<SmsResult> {
    if (!this.isConfigured()) {
      logger.warn('Twilio SMS not configured, skipping send');
      return { success: false, error: 'SMS service not configured' };
    }

    const fromNumber = this.config.sms.twilioPhoneNumber;
    if (!fromNumber) {
      logger.warn('Twilio phone number not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const client = await this.getClient();
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

      const result = await client.messages.create({
        body: message,
        from: fromNumber,
        to: normalizedPhone,
      });

      logger.info(
        {
          messageId: result.sid,
          to: this.maskPhoneNumber(normalizedPhone),
          status: result.status,
        },
        'SMS sent successfully'
      );

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error, phoneNumber: this.maskPhoneNumber(phoneNumber) }, 'Failed to send SMS');

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send a verification code via SMS
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<SmsResult> {
    const message = `Your Skillancer verification code is: ${code}. This code expires in 5 minutes. Do not share this code with anyone.`;
    return this.sendMessage(phoneNumber, message);
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      // Assume US number if no country code
      if (normalized.length === 10) {
        normalized = '+1' + normalized;
      } else if (normalized.length === 11 && normalized.startsWith('1')) {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Mask phone number for logging
   */
  private maskPhoneNumber(phone: string): string {
    if (phone.length < 4) return '****';
    return '***' + phone.slice(-4);
  }
}

// =============================================================================
// MOCK SMS SERVICE (for development/testing)
// =============================================================================

/**
 * Mock SMS service for development and testing
 */
export class MockSmsService implements SmsService {
  private readonly sentMessages: Array<{
    phoneNumber: string;
    message: string;
    timestamp: Date;
  }> = [];

  /**
   * Check if configured (always true for mock)
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Mock send message - logs to console
   */
  sendMessage(phoneNumber: string, message: string): SmsResult {
    const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    this.sentMessages.push({
      phoneNumber,
      message,
      timestamp: new Date(),
    });

    logger.info(
      {
        messageId,
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        message: message.substring(0, 50) + '...',
      },
      '[MOCK SMS] Message sent'
    );

    console.log('\n📱 [MOCK SMS]');
    console.log(`   To: ${phoneNumber}`);
    console.log(`   Message: ${message}`);
    console.log(`   ID: ${messageId}\n`);

    return {
      success: true,
      messageId,
    };
  }

  /**
   * Mock send verification code
   */
  async sendVerificationCode(phoneNumber: string, code: string): Promise<SmsResult> {
    const message = `Your Skillancer verification code is: ${code}. This code expires in 5 minutes.`;

    // Extra prominent logging for dev mode
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    📱 MFA CODE                          ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Phone: ${phoneNumber.padEnd(47)}║`);
    console.log(`║  Code:  ${code.padEnd(47)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\n');

    return this.sendMessage(phoneNumber, message);
  }

  /**
   * Get all sent messages (for testing)
   */
  getSentMessages(): Array<{ phoneNumber: string; message: string; timestamp: Date }> {
    return [...this.sentMessages];
  }

  /**
   * Clear sent messages (for testing)
   */
  clearMessages(): void {
    this.sentMessages.length = 0;
  }

  /**
   * Get the last verification code sent to a number (for testing)
   */
  getLastCodeForNumber(phoneNumber: string): string | null {
    const messages = this.sentMessages.filter((m) => m.phoneNumber === phoneNumber);
    if (messages.length === 0) return null;

    const lastMessage = messages[messages.length - 1];
    const match = lastMessage?.message.match(/code is: (\d{6})/);
    return match ? (match[1] ?? null) : null;
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length < 4) return '****';
    return '***' + phone.slice(-4);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let smsServiceInstance: SmsService | null = null;

/**
 * Get SMS service instance based on configuration
 */
export function getSmsService(): SmsService {
  if (smsServiceInstance) {
    return smsServiceInstance;
  }

  const config = getConfig();

  if (config.sms.provider === 'twilio' && config.sms.twilioAccountSid) {
    smsServiceInstance = new TwilioSmsService();
  } else {
    smsServiceInstance = new MockSmsService();
  }

  return smsServiceInstance;
}

/**
 * Initialize SMS service with a specific implementation
 */
export function initializeSmsService(service: SmsService): void {
  smsServiceInstance = service;
}

/**
 * Reset SMS service (for testing)
 */
export function resetSmsService(): void {
  smsServiceInstance = null;
}
