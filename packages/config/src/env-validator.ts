/**
 * @module @skillancer/config/env-validator
 * Environment variable validation and documentation
 *
 * Validates required environment variables and provides helpful error messages
 *
 * @example
 * ```typescript
 * import { validateEnv, envSchema } from '@skillancer/config';
 *
 * // Validate on startup
 * const config = validateEnv(envSchema);
 * ```
 */

import { z } from 'zod';

// =============================================================================
// ENVIRONMENT SCHEMAS
// =============================================================================

/**
 * Database configuration schema
 */
export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url().describe('PostgreSQL connection string (required)'),
  DATABASE_POOL_MIN: z
    .string()
    .transform(Number)
    .default('2')
    .describe('Minimum database pool connections'),
  DATABASE_POOL_MAX: z
    .string()
    .transform(Number)
    .default('10')
    .describe('Maximum database pool connections'),
});

/**
 * Redis configuration schema
 */
export const redisEnvSchema = z.object({
  REDIS_URL: z.string().url().optional().describe('Redis connection URL'),
  REDIS_HOST: z.string().default('localhost').describe('Redis host'),
  REDIS_PORT: z.string().transform(Number).default('6379').describe('Redis port'),
  REDIS_PASSWORD: z.string().optional().describe('Redis password (if required)'),
});

/**
 * Authentication configuration schema
 */
export const authEnvSchema = z.object({
  JWT_SECRET: z.string().min(32).describe('JWT signing secret (min 32 chars)'),
  JWT_EXPIRY: z.string().default('15m').describe('JWT token expiry (e.g., 15m, 1h, 7d)'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d').describe('Refresh token expiry'),
  SESSION_SECRET: z.string().min(32).describe('Session encryption secret'),
});

/**
 * OAuth providers schema
 */
export const oauthEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().optional().describe('Google OAuth client ID'),
  GOOGLE_CLIENT_SECRET: z.string().optional().describe('Google OAuth client secret'),
  GITHUB_CLIENT_ID: z.string().optional().describe('GitHub OAuth client ID'),
  GITHUB_CLIENT_SECRET: z.string().optional().describe('GitHub OAuth client secret'),
  LINKEDIN_CLIENT_ID: z.string().optional().describe('LinkedIn OAuth client ID'),
  LINKEDIN_CLIENT_SECRET: z.string().optional().describe('LinkedIn OAuth client secret'),
});

/**
 * Payment providers schema
 */
export const paymentEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').describe('Stripe secret key'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').describe('Stripe webhook signing secret'),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').describe('Stripe publishable key'),
});

/**
 * Email configuration schema
 */
export const emailEnvSchema = z.object({
  SMTP_HOST: z.string().describe('SMTP server host'),
  SMTP_PORT: z.string().transform(Number).default('587').describe('SMTP server port'),
  SMTP_USER: z.string().describe('SMTP username'),
  SMTP_PASSWORD: z.string().describe('SMTP password'),
  EMAIL_FROM: z.string().email().describe('Default sender email address'),
});

/**
 * AWS configuration schema
 */
export const awsEnvSchema = z.object({
  AWS_REGION: z.string().default('us-east-1').describe('AWS region'),
  AWS_ACCESS_KEY_ID: z.string().optional().describe('AWS access key (optional if using IAM roles)'),
  AWS_SECRET_ACCESS_KEY: z
    .string()
    .optional()
    .describe('AWS secret key (optional if using IAM roles)'),
  S3_BUCKET: z.string().describe('S3 bucket for file uploads'),
});

/**
 * Monitoring configuration schema
 */
export const monitoringEnvSchema = z.object({
  SENTRY_DSN: z.string().url().optional().describe('Sentry DSN for error tracking'),
  DATADOG_API_KEY: z.string().optional().describe('Datadog API key for metrics'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info').describe('Logging level'),
});

/**
 * Application configuration schema
 */
export const appEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development')
    .describe('Environment name'),
  PORT: z.string().transform(Number).default('3000').describe('Application port'),
  HOST: z.string().default('0.0.0.0').describe('Application host'),
  API_URL: z.string().url().describe('Public API URL'),
  WEB_URL: z.string().url().describe('Public web app URL'),
  CORS_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((o) => o.trim()))
    .describe('Allowed CORS origins (comma-separated)'),
});

/**
 * Security configuration schema
 */
export const securityEnvSchema = z.object({
  CSRF_SECRET: z.string().min(32).optional().describe('CSRF token secret'),
  ENCRYPTION_KEY: z.string().length(64).optional().describe('Data encryption key (hex, 32 bytes)'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100').describe('Max requests per window'),
  RATE_LIMIT_WINDOW: z
    .string()
    .transform(Number)
    .default('60000')
    .describe('Rate limit window in ms'),
});

// =============================================================================
// COMBINED SCHEMAS BY ENVIRONMENT
// =============================================================================

/**
 * Development environment schema (relaxed)
 */
export const developmentEnvSchema = appEnvSchema
  .merge(databaseEnvSchema.partial())
  .merge(redisEnvSchema.partial())
  .merge(authEnvSchema.partial())
  .merge(monitoringEnvSchema.partial());

/**
 * Production environment schema (strict)
 */
export const productionEnvSchema = appEnvSchema
  .merge(databaseEnvSchema)
  .merge(redisEnvSchema)
  .merge(authEnvSchema)
  .merge(oauthEnvSchema.partial())
  .merge(paymentEnvSchema)
  .merge(emailEnvSchema)
  .merge(awsEnvSchema)
  .merge(monitoringEnvSchema)
  .merge(securityEnvSchema);

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    key: string;
    message: string;
    expected?: string;
  }>;
  warnings: Array<{
    key: string;
    message: string;
  }>;
  config?: Record<string, unknown>;
}

/**
 * Validate environment variables against a schema
 */
export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): ValidationResult {
  const result = schema.safeParse(env);

  if (result.success) {
    return {
      valid: true,
      errors: [],
      warnings: [],
      config: result.data,
    };
  }

  const errors = result.error.issues.map((issue) => ({
    key: issue.path.join('.'),
    message: issue.message,
    expected: 'code' in issue ? issue.code : undefined,
  }));

  return {
    valid: false,
    errors,
    warnings: [],
  };
}

/**
 * Validate environment and throw on error
 */
export function validateEnvOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  const result = validateEnv(schema, env);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `  - ${e.key}: ${e.message}`).join('\n');

    throw new Error(
      `Environment validation failed:\n${errorMessages}\n\n` +
        'Please check your environment variables and .env file.'
    );
  }

  return result.config as z.infer<T>;
}

/**
 * Get schema for current environment
 */
export function getEnvSchemaForEnvironment(
  env: string = process.env.NODE_ENV || 'development'
): z.ZodTypeAny {
  switch (env) {
    case 'production':
    case 'staging':
      return productionEnvSchema;
    case 'test':
      return developmentEnvSchema;
    default:
      return developmentEnvSchema;
  }
}

// =============================================================================
// DOCUMENTATION GENERATOR
// =============================================================================

interface EnvDocEntry {
  key: string;
  description: string;
  required: boolean;
  default?: string;
  example?: string;
}

/**
 * Generate environment variable documentation
 */
export function generateEnvDocs(schema: z.ZodTypeAny): EnvDocEntry[] {
  const docs: EnvDocEntry[] = [];

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;

    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodTypeAny;
      const description = zodValue.description || '';
      const isOptional = zodValue.isOptional();

      let defaultValue: string | undefined;
      if ('_def' in zodValue && 'defaultValue' in (zodValue._def as any)) {
        defaultValue = String((zodValue._def as any).defaultValue());
      }

      docs.push({
        key,
        description,
        required: !isOptional && !defaultValue,
        default: defaultValue,
      });
    }
  }

  return docs;
}

/**
 * Generate .env.example content
 */
export function generateEnvExample(docs: EnvDocEntry[]): string {
  const lines: string[] = [
    '# Skillancer Environment Configuration',
    '# Copy this file to .env and fill in the values',
    '',
  ];

  let currentSection = '';

  for (const entry of docs) {
    // Detect section from key prefix
    const section = entry.key.split('_')[0];
    if (section !== currentSection) {
      currentSection = section;
      lines.push('', `# ${section.toUpperCase()}`);
    }

    lines.push(`# ${entry.description}`);
    if (entry.required) {
      lines.push(`# Required`);
    }
    if (entry.default) {
      lines.push(`${entry.key}=${entry.default}`);
    } else {
      lines.push(`${entry.key}=`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// QUICK VALIDATION
// =============================================================================

/**
 * Quick check for critical environment variables
 */
export function checkCriticalEnv(): {
  ready: boolean;
  missing: string[];
  warnings: string[];
} {
  const critical = ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'];

  const recommended = ['REDIS_URL', 'SENTRY_DSN', 'STRIPE_SECRET_KEY'];

  const missing = critical.filter((key) => !process.env[key]);
  const warnings = recommended.filter((key) => !process.env[key]);

  return {
    ready: missing.length === 0,
    missing,
    warnings,
  };
}

export default {
  validateEnv,
  validateEnvOrThrow,
  getEnvSchemaForEnvironment,
  generateEnvDocs,
  generateEnvExample,
  checkCriticalEnv,
  // Schemas
  databaseEnvSchema,
  redisEnvSchema,
  authEnvSchema,
  oauthEnvSchema,
  paymentEnvSchema,
  emailEnvSchema,
  awsEnvSchema,
  monitoringEnvSchema,
  appEnvSchema,
  securityEnvSchema,
  developmentEnvSchema,
  productionEnvSchema,
};
