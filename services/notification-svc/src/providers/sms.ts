/**
 * Notification Service - SMS Provider
 * Multi-provider SMS delivery
 */

export interface SMSConfig {
  provider: 'twilio' | 'nexmo' | 'aws_sns';
  accountSid?: string;
  authToken?: string;
  fromNumber: string;
  region?: string;
}

export interface SMSMessage {
  to: string;
  body: string;
  mediaUrl?: string[];
  priority?: 'high' | 'normal' | 'low';
  validityPeriod?: number; // in seconds
  trackDelivery?: boolean;
}

export interface SMSResult {
  id: string;
  success: boolean;
  messageId?: string;
  provider: string;
  to: string;
  sentAt?: Date;
  error?: string;
  cost?: number;
  segments?: number;
}

export interface SMSDeliveryStatus {
  messageId: string;
  to: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  timestamp: Date;
  errorCode?: string;
  errorMessage?: string;
}

const DEFAULT_CONFIG: SMSConfig = {
  provider: 'twilio',
  fromNumber: '+1XXXXXXXXXX',
};

// In-memory tracking
const smsLog: SMSResult[] = [];
const deliveryStatuses: Map<string, SMSDeliveryStatus> = new Map();

export class SMSProvider {
  private config: SMSConfig;

  constructor(customConfig?: Partial<SMSConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig };
  }

  /**
   * Send an SMS
   */
  async send(message: SMSMessage): Promise<SMSResult> {
    const id = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate phone number
    if (!this.isValidPhoneNumber(message.to)) {
      return {
        id,
        success: false,
        provider: this.config.provider,
        to: message.to,
        error: 'Invalid phone number',
      };
    }

    // Check message length and calculate segments
    const segments = Math.ceil(message.body.length / 160);

    try {
      const messageId = await this.sendViaProvider(message);

      const result: SMSResult = {
        id,
        success: true,
        messageId,
        provider: this.config.provider,
        to: message.to,
        sentAt: new Date(),
        segments,
        cost: segments * 0.0075, // Approximate cost
      };

      smsLog.push(result);

      // Initialize delivery tracking
      deliveryStatuses.set(messageId, {
        messageId,
        to: message.to,
        status: 'sent',
        timestamp: new Date(),
      });

      console.log(`[SMS] Sent ${id} to ${message.to}`);

      return result;
    } catch (error) {
      const result: SMSResult = {
        id,
        success: false,
        provider: this.config.provider,
        to: message.to,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      smsLog.push(result);
      return result;
    }
  }

  /**
   * Send OTP/verification code
   */
  async sendOTP(to: string, code: string, expireMinutes: number = 10): Promise<SMSResult> {
    const body = `Your Skillancer verification code is: ${code}. This code expires in ${expireMinutes} minutes. Never share this code with anyone.`;
    return this.send({ to, body, priority: 'high' });
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(to: string, alertType: string, details?: string): Promise<SMSResult> {
    const body = `[Skillancer Security Alert] ${alertType}${details ? `: ${details}` : ''}. If this wasn't you, secure your account immediately.`;
    return this.send({ to, body, priority: 'high' });
  }

  /**
   * Send bulk SMS
   */
  async sendBulk(messages: SMSMessage[]): Promise<SMSResult[]> {
    // Process in batches of 50
    const batchSize = 50;
    const results: SMSResult[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (msg) => this.send(msg)));
      results.push(...batchResults);

      // Rate limiting delay between batches
      if (i + batchSize < messages.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get delivery status
   */
  async getDeliveryStatus(messageId: string): Promise<SMSDeliveryStatus | null> {
    return deliveryStatuses.get(messageId) || null;
  }

  /**
   * Handle delivery callback (webhook)
   */
  async handleDeliveryCallback(data: {
    messageId: string;
    status: SMSDeliveryStatus['status'];
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    const existing = deliveryStatuses.get(data.messageId);
    if (existing) {
      existing.status = data.status;
      existing.timestamp = new Date();
      existing.errorCode = data.errorCode;
      existing.errorMessage = data.errorMessage;
      deliveryStatuses.set(data.messageId, existing);
    }
  }

  /**
   * Get SMS metrics
   */
  async getMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    sent: number;
    delivered: number;
    failed: number;
    totalCost: number;
    totalSegments: number;
    deliveryRate: number;
  }> {
    const inRange = smsLog.filter((s) => s.sentAt && s.sentAt >= startDate && s.sentAt <= endDate);

    let totalCost = 0;
    let totalSegments = 0;
    let delivered = 0;
    let failed = 0;

    for (const sms of inRange) {
      if (sms.success) {
        totalCost += sms.cost || 0;
        totalSegments += sms.segments || 1;

        // Check delivery status
        const status = sms.messageId ? deliveryStatuses.get(sms.messageId) : null;
        if (status?.status === 'delivered') {
          delivered++;
        } else if (status?.status === 'failed' || status?.status === 'undelivered') {
          failed++;
        }
      } else {
        failed++;
      }
    }

    return {
      sent: inRange.length,
      delivered,
      failed,
      totalCost,
      totalSegments,
      deliveryRate: inRange.length > 0 ? (delivered / inRange.length) * 100 : 0,
    };
  }

  // Private helpers

  private async sendViaProvider(message: SMSMessage): Promise<string> {
    // Simulate provider-specific sending
    await new Promise((resolve) => setTimeout(resolve, 30));
    return `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Basic E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone.replace(/\s/g, ''));
  }
}

export const smsProvider = new SMSProvider();
