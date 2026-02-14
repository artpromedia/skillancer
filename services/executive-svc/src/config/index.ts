/**
 * Executive Service Configuration
 */

import { z } from 'zod';

const configSchema = z.object({
  // Server
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3007),
  host: z.string().default('0.0.0.0'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // API
  apiBaseUrl: z.string().default('http://localhost:3007'),
  corsOrigins: z
    .string()
    .transform((val) => val.split(','))
    .default('http://localhost:3000'),

  // Auth - Required in production, optional with dev defaults for development
  jwtSecret: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .default('dev-jwt-secret-change-in-production-00000'),
  cookieSecret: z
    .string()
    .min(32, 'COOKIE_SECRET must be at least 32 characters')
    .default('dev-cookie-secret-change-in-production-0'),

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

  // Vetting Configuration
  vettingInterviewScheduleDeadlineDays: z.coerce.number().default(7),
  vettingReferenceDeadlineDays: z.coerce.number().default(14),
  vettingAutoWithdrawDays: z.coerce.number().default(30),
  vettingReapplyWaitMonths: z.coerce.number().default(6),
  vettingMinScreeningScore: z.coerce.number().default(40),
  vettingAutoAdvanceScore: z.coerce.number().default(70),
  vettingReferencesRequired: z.coerce.number().default(3),

  // Reference Token - Required in production
  referenceTokenSecret: z
    .string()
    .min(32, 'REFERENCE_TOKEN_SECRET must be at least 32 characters')
    .default('dev-ref-token-secret-change-in-prod-000'),
  referenceTokenExpiryDays: z.coerce.number().default(14),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    // NOTE: Do NOT use EXECUTIVE_SVC_PORT - Kubernetes auto-injects it as
    // "tcp://10.43.x.x:3007" (service discovery), which breaks z.coerce.number()
    const rawPort = process.env.PORT;
    config = configSchema.parse({
      nodeEnv: process.env.NODE_ENV,
      port: rawPort || undefined, // pass undefined so z.coerce.number().default(3007) applies
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
