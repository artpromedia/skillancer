/**
 * Configuration for Notification Service
 */

import { z } from 'zod';

const configSchema = z.object({
  // Server
  port: z.number().default(4006),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.string().default('info'),

  // Database
  databaseUrl: z.string(),

  // Redis
  redisUrl: z.string().optional(),

  // SendGrid
  sendgridApiKey: z.string(),
  sendgridFromEmail: z.string().email(),
  sendgridFromName: z.string().default('Skillancer'),
  sendgridWebhookKey: z.string().optional(),

  // Firebase Cloud Messaging
  firebaseProjectId: z.string().optional(),
  firebasePrivateKey: z.string().optional(),
  firebaseClientEmail: z.string().optional(),

  // Rate limiting
  rateLimitMax: z.number().default(100),
  rateLimitTimeWindow: z.number().default(60000), // 1 minute

  // Batch processing
  batchSize: z.number().default(100),
  batchDelayMs: z.number().default(1000),

  // Retry settings
  maxRetries: z.number().default(3),
  retryDelayMs: z.number().default(5000),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    throw new Error('Configuration not initialized. Call validateConfig() first.');
  }
  return config;
}

export function validateConfig(): Config {
  const rawConfig = {
    port: Number.parseInt(process.env.PORT || '4006', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL,
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@skillancer.com',
    sendgridFromName: process.env.SENDGRID_FROM_NAME || 'Skillancer',
    sendgridWebhookKey: process.env.SENDGRID_WEBHOOK_KEY,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    rateLimitMax: Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    rateLimitTimeWindow: Number.parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000', 10),
    batchSize: Number.parseInt(process.env.BATCH_SIZE || '100', 10),
    batchDelayMs: Number.parseInt(process.env.BATCH_DELAY_MS || '1000', 10),
    maxRetries: Number.parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: Number.parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
  };

  config = configSchema.parse(rawConfig);
  return config;
}

// Email templates configuration
export const EMAIL_TEMPLATES: Record<string, string> = {
  WELCOME: 'd-welcome-template-id',
  EMAIL_VERIFICATION: 'd-verification-template-id',
  PASSWORD_RESET: 'd-password-reset-template-id',
  CONTRACT_INVITATION: 'd-contract-invitation-template-id',
  CONTRACT_ACCEPTED: 'd-contract-accepted-template-id',
  CONTRACT_COMPLETED: 'd-contract-completed-template-id',
  PAYMENT_RECEIVED: 'd-payment-received-template-id',
  PAYMENT_SENT: 'd-payment-sent-template-id',
  MILESTONE_COMPLETED: 'd-milestone-completed-template-id',
  MESSAGE_RECEIVED: 'd-message-received-template-id',
  PROPOSAL_RECEIVED: 'd-proposal-received-template-id',
  PROPOSAL_ACCEPTED: 'd-proposal-accepted-template-id',
  WEEKLY_DIGEST: 'd-weekly-digest-template-id',
  SECURITY_ALERT: 'd-security-alert-template-id',
  INVOICE_CREATED: 'd-invoice-created-template-id',
  EXECUTIVE_ENGAGEMENT_INVITE: 'd-executive-engagement-template-id',
  WARM_INTRODUCTION: 'd-warm-introduction-template-id',
  CERTIFICATION_PASSED: 'd-certification-passed-template-id',
};
