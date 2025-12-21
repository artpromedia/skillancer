/**
 * @module @skillancer/market-svc/services/sms
 * SMS notification service using Twilio
 */

import type { SendSmsParams, SmsServiceConfig } from '../types/notification.types.js';
import type { Logger } from '@skillancer/logger';

export interface SmsService {
  send(params: SendSmsParams): Promise<{ messageId: string }>;
  sendBatch(messages: SendSmsParams[]): Promise<{ sent: number; failed: number }>;
}

export interface SmsServiceDependencies {
  logger: Logger;
  config: SmsServiceConfig;
}

export function createSmsService(deps: SmsServiceDependencies): SmsService {
  const { logger } = deps;

  function sendViaTwilio(params: SendSmsParams): { messageId: string } {
    // In production, integrate with Twilio SDK
    logger.info({
      msg: 'Sending SMS via Twilio',
      to: params.to,
      messageLength: params.message.length,
    });

    // FUTURE: Implement with actual Twilio SDK
    // See: https://www.twilio.com/docs/sms/send-messages

    return { messageId: `twilio-${Date.now()}-${Math.random().toString(36).substring(7)}` };
  }

  return {
    async send(params: SendSmsParams): Promise<{ messageId: string }> {
      // Validate phone number format (E.164)
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      if (!e164Regex.test(params.to)) {
        logger.warn({
          msg: 'Invalid phone number format',
          to: params.to,
        });
        throw new Error('Invalid phone number format. Must be E.164 format.');
      }

      // Truncate message if too long (SMS limit is 160 chars for single message)
      const message =
        params.message.length > 1600 ? params.message.substring(0, 1597) + '...' : params.message;

      try {
        const result = sendViaTwilio({
          ...params,
          message,
        });

        logger.info({
          msg: 'SMS sent successfully',
          to: params.to,
          messageId: result.messageId,
        });

        return await Promise.resolve(result);
      } catch (error) {
        logger.error({
          msg: 'Failed to send SMS',
          to: params.to,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },

    async sendBatch(messages: SendSmsParams[]): Promise<{ sent: number; failed: number }> {
      let sent = 0;
      let failed = 0;

      // SMS should be rate limited - send sequentially with small delays
      for (const sms of messages) {
        try {
          await this.send(sms);
          sent++;
          // Small delay between messages to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch {
          failed++;
        }
      }

      logger.info({
        msg: 'Batch SMS send complete',
        sent,
        failed,
        total: messages.length,
      });

      return { sent, failed };
    },
  };
}
