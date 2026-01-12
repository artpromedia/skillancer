/**
 * Executive Service Configuration
 */

import { z } from 'zod';

const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3008),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // API
  apiBaseUrl: z.string().default('http://localhost:3008'),
  corsOrigins: z.string().transform((val) => val.split(',')).default('http://localhost:3000'),

  // Auth - Required in production, optional with dev defaults for development
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  cookieSecret: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),

  // Database
  databaseUrl: z.string().default('postgresql://postgres:postgres@localhost:5432/skillancer'),

  // Service URLs
  authServiceUrl: z.string().default('http://localhost:3001'),
  notificationServiceUrl: z.string().default('http://localhost:3004'),
  billingServiceUrl: z.string().default('http://localhost:3005'),

  // External Integrations
  checkrApiKey: z.string().optional(),
  checkrWebhookSecret: z.string().optional(),
  checkrEnvironment: z.enum(['sandbox', 'production']).default('sandbox'),

  linkedinClientId: z.string().optional(),
  linkedinClientSecret: z.string().optional(),
  linkedinRedirectUri: z.string().default('http://localhost:3000/api/auth/linkedin/callback'),

  calendlyApiKey: z.string().optional(),
  calendlyWebhookSecret: z.string().optional(),

  // Document Export - Notion
  notionIntegrationToken: z.string().optional(),
  notionDefaultParentPageId: z.string().optional(),

  // Document Export - Confluence
  confluenceBaseUrl: z.string().optional(),
  confluenceUserEmail: z.string().optional(),
  confluenceApiToken: z.string().optional(),
  confluenceDefaultSpaceKey: z.string().optional(),

  // Vetting Configuration
  vettingInterviewScheduleDeadlineDays: z.coerce.number().default(7),
  vettingReferenceDeadlineDays: z.coerce.number().default(14),
  vettingAutoWithdrawDays: z.coerce.number().default(30),
  vettingReapplyWaitMonths: z.coerce.number().default(6),
  vettingMinScreeningScore: z.coerce.number().default(40),
  vettingAutoAdvanceScore: z.coerce.number().default(70),
  vettingReferencesRequired: z.coerce.number().default(3),

  // Reference Token - Required in production
  referenceTokenSecret: z.string().min(32, 'REFERENCE_TOKEN_SECRET must be at least 32 characters'),
  referenceTokenExpiryDays: z.coerce.number().default(14),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = configSchema.parse({
      nodeEnv: process.env.NODE_ENV,
      port: process.env.EXECUTIVE_SVC_PORT || process.env.PORT,
      host: process.env.HOST,
      logLevel: process.env.LOG_LEVEL,
      apiBaseUrl: process.env.EXECUTIVE_SVC_API_BASE_URL || process.env.API_BASE_URL,
      corsOrigins: process.env.CORS_ORIGINS,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
      databaseUrl: process.env.DATABASE_URL,
      authServiceUrl: process.env.AUTH_SERVICE_URL,
      notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL,
      billingServiceUrl: process.env.BILLING_SERVICE_URL,
      checkrApiKey: process.env.CHECKR_API_KEY,
      checkrWebhookSecret: process.env.CHECKR_WEBHOOK_SECRET,
      checkrEnvironment: process.env.CHECKR_ENVIRONMENT,
      linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
      linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      linkedinRedirectUri: process.env.LINKEDIN_REDIRECT_URI,
      calendlyApiKey: process.env.CALENDLY_API_KEY,
      calendlyWebhookSecret: process.env.CALENDLY_WEBHOOK_SECRET,
      notionIntegrationToken: process.env.NOTION_INTEGRATION_TOKEN,
      notionDefaultParentPageId: process.env.NOTION_DEFAULT_PARENT_PAGE_ID,
      confluenceBaseUrl: process.env.CONFLUENCE_BASE_URL,
      confluenceUserEmail: process.env.CONFLUENCE_USER_EMAIL,
      confluenceApiToken: process.env.CONFLUENCE_API_TOKEN,
      confluenceDefaultSpaceKey: process.env.CONFLUENCE_DEFAULT_SPACE_KEY,
      vettingInterviewScheduleDeadlineDays: process.env.VETTING_INTERVIEW_SCHEDULE_DEADLINE_DAYS,
      vettingReferenceDeadlineDays: process.env.VETTING_REFERENCE_DEADLINE_DAYS,
      vettingAutoWithdrawDays: process.env.VETTING_AUTO_WITHDRAW_DAYS,
      vettingReapplyWaitMonths: process.env.VETTING_REAPPLY_WAIT_MONTHS,
      vettingMinScreeningScore: process.env.VETTING_MIN_SCREENING_SCORE,
      vettingAutoAdvanceScore: process.env.VETTING_AUTO_ADVANCE_SCORE,
      vettingReferencesRequired: process.env.VETTING_REFERENCES_REQUIRED,
      referenceTokenSecret: process.env.REFERENCE_TOKEN_SECRET,
      referenceTokenExpiryDays: process.env.REFERENCE_TOKEN_EXPIRY_DAYS,
    });
  }
  return config;
}

export function resetConfig(): void {
  config = null;
}
