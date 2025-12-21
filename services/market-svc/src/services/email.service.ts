/**
 * @module @skillancer/market-svc/services/email
 * Email service for sending transactional emails
 */

import type { SendEmailParams, EmailServiceConfig } from '../types/notification.types.js';
import type { Logger } from '@skillancer/logger';

export interface EmailService {
  send(params: SendEmailParams): Promise<{ messageId: string }>;
  sendBatch(emails: SendEmailParams[]): Promise<{ sent: number; failed: number }>;
}

export interface EmailServiceDependencies {
  logger: Logger;
  config: EmailServiceConfig;
}

export function createEmailService(deps: EmailServiceDependencies): EmailService {
  const { logger, config } = deps;

  function sendViaSendGrid(params: SendEmailParams): { messageId: string } {
    // In production, integrate with @sendgrid/mail
    // See: https://github.com/sendgrid/sendgrid-nodejs
    logger.info({
      msg: 'Sending email via SendGrid',
      to: params.to,
      subject: params.subject,
      category: params.category,
      type: params.notificationType,
    });

    return { messageId: `sg-${Date.now()}-${Math.random().toString(36).substring(7)}` };
  }

  function sendViaSES(params: SendEmailParams): { messageId: string } {
    // In production, integrate with @aws-sdk/client-ses
    // See: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/ses-examples.html
    logger.info({
      msg: 'Sending email via AWS SES',
      to: params.to,
      subject: params.subject,
      category: params.category,
      type: params.notificationType,
    });

    return { messageId: `ses-${Date.now()}-${Math.random().toString(36).substring(7)}` };
  }

  return {
    async send(params: SendEmailParams): Promise<{ messageId: string }> {
      try {
        if (config.provider === 'sendgrid') {
          return await Promise.resolve(sendViaSendGrid(params));
        } else if (config.provider === 'ses') {
          return await Promise.resolve(sendViaSES(params));
        } else {
          logger.warn({
            msg: 'Unknown email provider, email not sent',
            provider: config.provider,
          });
          return { messageId: `mock-${Date.now()}` };
        }
      } catch (error) {
        logger.error({
          msg: 'Failed to send email',
          to: params.to,
          subject: params.subject,
          error,
        });
        throw error;
      }
    },

    async sendBatch(emails: SendEmailParams[]): Promise<{ sent: number; failed: number }> {
      let sent = 0;
      let failed = 0;

      for (const email of emails) {
        try {
          await this.send(email);
          sent++;
        } catch {
          failed++;
        }
      }

      logger.info({
        msg: 'Batch email send complete',
        sent,
        failed,
        total: emails.length,
      });

      return { sent, failed };
    },
  };
}
