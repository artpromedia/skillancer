/**
 * @module @skillancer/auth-svc/config
 * Configuration management for auth service
 */

import { z } from 'zod';

// =============================================================================
// SCHEMA
// =============================================================================

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(4001),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'test', 'staging', 'production']).default('development'),

  // Database
  databaseUrl: z.string(),

  // Redis
  redisUrl: z.string(),

  // JWT
  jwt: z.object({
    secret: z.string().min(32),
    accessTokenExpiresIn: z.string().default('1h'),
    refreshTokenExpiresIn: z.string().default('7d'),
    issuer: z.string().default('skillancer'),
    audience: z.string().default('skillancer-api'),
  }),

  // OAuth
  oauth: z.object({
    google: z.object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      callbackUrl: z.string().optional(),
    }),
    microsoft: z.object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      tenantId: z.string().default('common'),
      callbackUrl: z.string().optional(),
    }),
    apple: z.object({
      clientId: z.string().optional(),
      teamId: z.string().optional(),
      keyId: z.string().optional(),
      privateKey: z.string().optional(),
      callbackUrl: z.string().optional(),
    }),
    facebook: z.object({
      appId: z.string().optional(),
      appSecret: z.string().optional(),
      callbackUrl: z.string().optional(),
    }),
    linkedin: z.object({
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      callbackUrl: z.string().optional(),
    }),
  }),

  // URLs
  appUrl: z.string().default('http://localhost:3000'),
  apiUrl: z.string().default('http://localhost:4001'),

  // Email
  email: z.object({
    from: z.string().default('noreply@skillancer.com'),
    fromName: z.string().default('Skillancer'),
  }),

  // Security
  security: z.object({
    bcryptRounds: z.coerce.number().default(12),
    maxLoginAttempts: z.coerce.number().default(5),
    lockoutDuration: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
    sessionTtl: z.coerce.number().default(24 * 60 * 60), // 24 hours in seconds
    emailVerificationTtl: z.coerce.number().default(24 * 60 * 60 * 1000), // 24 hours
    passwordResetTtl: z.coerce.number().default(60 * 60 * 1000), // 1 hour
  }),

  // Rate limiting
  rateLimit: z.object({
    login: z.object({
      maxAttempts: z.coerce.number().default(5),
      windowMs: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
    }),
    registration: z.object({
      maxAttempts: z.coerce.number().default(3),
      windowMs: z.coerce.number().default(60 * 60 * 1000), // 1 hour
    }),
    passwordReset: z.object({
      maxAttempts: z.coerce.number().default(3),
      windowMs: z.coerce.number().default(60 * 60 * 1000), // 1 hour
    }),
    mfa: z.object({
      totpMaxAttempts: z.coerce.number().default(5), // Per challenge
      smsMaxRequests: z.coerce.number().default(3), // Per hour per phone
      emailMaxRequests: z.coerce.number().default(5), // Per hour per email
      recoveryMaxAttempts: z.coerce.number().default(3), // Then lockout
      windowMs: z.coerce.number().default(60 * 60 * 1000), // 1 hour
    }),
  }),

  // Multi-Factor Authentication
  mfa: z.object({
    issuer: z.string().default('Skillancer'),
    encryptionKey: z.string().min(32).optional(),
    totpWindow: z.coerce.number().default(1), // Time steps to allow (30 sec each)
    challengeTtl: z.coerce.number().default(5 * 60 * 1000), // 5 minutes
    recoveryCodeCount: z.coerce.number().default(10),
    stepUpAuthTtl: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
    smsCodeLength: z.coerce.number().default(6),
    emailCodeLength: z.coerce.number().default(6),
    smsCodeTtl: z.coerce.number().default(5 * 60 * 1000), // 5 minutes
    emailCodeTtl: z.coerce.number().default(10 * 60 * 1000), // 10 minutes
  }),

  // SMS (Twilio)
  sms: z.object({
    provider: z.enum(['twilio', 'mock']).default('mock'),
    twilioAccountSid: z.string().optional(),
    twilioAuthToken: z.string().optional(),
    twilioPhoneNumber: z.string().optional(),
  }),

  // Storage (S3)
  storage: z.object({
    s3Bucket: z.string().default('skillancer-uploads'),
    s3Region: z.string().default('us-east-1'),
    s3Endpoint: z.string().optional(), // For LocalStack or MinIO
    s3AccessKeyId: z.string().optional(),
    s3SecretAccessKey: z.string().optional(),
    s3ForcePathStyle: z.boolean().default(false),
    s3CdnUrl: z.string().optional(), // CloudFront or CDN URL
  }),

  // Profile
  profile: z.object({
    maxAvatarSize: z.coerce.number().default(10 * 1024 * 1024), // 10MB
    maxSkills: z.coerce.number().default(50),
    publicProfileCacheTtl: z.coerce.number().default(5 * 60), // 5 minutes
  }),

  // Logging
  logging: z.object({
    level: z.string().default('info'),
    pretty: z.boolean().default(false),
  }),

  // Identity Verification (Persona)
  persona: z.object({
    apiKey: z.string().optional(),
    apiVersion: z.string().default('2023-01-05'),
    baseUrl: z.string().default('https://withpersona.com/api/v1'),
    webhookSecret: z.string().optional(),
    templates: z.object({
      basic: z.string().optional(), // Government ID verification
      enhanced: z.string().optional(), // ID + Selfie verification
      premium: z.string().optional(), // ID + Selfie + Address
    }),
    badgeValidityDays: z.coerce.number().default(365), // Badge expires after 1 year
    inquiryExpiryHours: z.coerce.number().default(48), // Inquiry expires after 48 hours
  }),
});

export type Config = z.infer<typeof configSchema>;

// =============================================================================
// CONFIG SINGLETON
// =============================================================================

let cachedConfig: Config | null = null;

/**
 * Load configuration from environment variables
 */
export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = process.env;

  const rawConfig = {
    port: env['PORT'] ?? env['AUTH_SVC_PORT'] ?? 4001,
    host: env['HOST'] ?? '0.0.0.0',
    nodeEnv: env['NODE_ENV'] ?? 'development',

    databaseUrl: env['DATABASE_URL'],
    redisUrl: env['REDIS_URL'],

    jwt: {
      secret: env['JWT_SECRET'],
      accessTokenExpiresIn: env['JWT_ACCESS_TOKEN_EXPIRES_IN'] ?? '1h',
      refreshTokenExpiresIn: env['JWT_REFRESH_TOKEN_EXPIRES_IN'] ?? '7d',
      issuer: env['JWT_ISSUER'] ?? 'skillancer',
      audience: env['JWT_AUDIENCE'] ?? 'skillancer-api',
    },

    oauth: {
      google: {
        clientId: env['GOOGLE_CLIENT_ID'],
        clientSecret: env['GOOGLE_CLIENT_SECRET'],
        callbackUrl:
          env['GOOGLE_CALLBACK_URL'] ??
          `${env['API_URL'] ?? 'http://localhost:4001'}/auth/oauth/google/callback`,
      },
      microsoft: {
        clientId: env['MICROSOFT_CLIENT_ID'],
        clientSecret: env['MICROSOFT_CLIENT_SECRET'],
        tenantId: env['MICROSOFT_TENANT_ID'] ?? 'common',
        callbackUrl:
          env['MICROSOFT_CALLBACK_URL'] ??
          `${env['API_URL'] ?? 'http://localhost:4001'}/auth/oauth/microsoft/callback`,
      },
      apple: {
        clientId: env['APPLE_CLIENT_ID'],
        teamId: env['APPLE_TEAM_ID'],
        keyId: env['APPLE_KEY_ID'],
        privateKey: env['APPLE_PRIVATE_KEY'],
        callbackUrl:
          env['APPLE_CALLBACK_URL'] ??
          `${env['API_URL'] ?? 'http://localhost:4001'}/auth/oauth/apple/callback`,
      },
      facebook: {
        appId: env['FACEBOOK_APP_ID'],
        appSecret: env['FACEBOOK_APP_SECRET'],
        callbackUrl:
          env['FACEBOOK_CALLBACK_URL'] ??
          `${env['API_URL'] ?? 'http://localhost:4001'}/auth/oauth/facebook/callback`,
      },
      linkedin: {
        clientId: env['LINKEDIN_CLIENT_ID'],
        clientSecret: env['LINKEDIN_CLIENT_SECRET'],
        callbackUrl:
          env['LINKEDIN_CALLBACK_URL'] ??
          `${env['API_URL'] ?? 'http://localhost:4001'}/auth/oauth/linkedin/callback`,
      },
    },

    appUrl: env['APP_URL'] ?? 'http://localhost:3000',
    apiUrl: env['API_URL'] ?? 'http://localhost:4001',

    email: {
      from: env['EMAIL_FROM'] ?? 'noreply@skillancer.com',
      fromName: env['EMAIL_FROM_NAME'] ?? 'Skillancer',
    },

    security: {
      bcryptRounds: env['BCRYPT_ROUNDS'] ?? 12,
      maxLoginAttempts: env['MAX_LOGIN_ATTEMPTS'] ?? 5,
      lockoutDuration: env['LOCKOUT_DURATION_MS'] ?? 15 * 60 * 1000,
      sessionTtl: env['SESSION_TTL_SECONDS'] ?? 24 * 60 * 60,
      emailVerificationTtl: env['EMAIL_VERIFICATION_TTL_MS'] ?? 24 * 60 * 60 * 1000,
      passwordResetTtl: env['PASSWORD_RESET_TTL_MS'] ?? 60 * 60 * 1000,
    },

    rateLimit: {
      login: {
        maxAttempts: env['RATE_LIMIT_LOGIN_MAX'] ?? 5,
        windowMs: env['RATE_LIMIT_LOGIN_WINDOW_MS'] ?? 15 * 60 * 1000,
      },
      registration: {
        maxAttempts: env['RATE_LIMIT_REGISTRATION_MAX'] ?? 3,
        windowMs: env['RATE_LIMIT_REGISTRATION_WINDOW_MS'] ?? 60 * 60 * 1000,
      },
      passwordReset: {
        maxAttempts: env['RATE_LIMIT_PASSWORD_RESET_MAX'] ?? 3,
        windowMs: env['RATE_LIMIT_PASSWORD_RESET_WINDOW_MS'] ?? 60 * 60 * 1000,
      },
      mfa: {
        totpMaxAttempts: env['MFA_TOTP_MAX_ATTEMPTS'] ?? 5,
        smsMaxRequests: env['MFA_SMS_MAX_REQUESTS'] ?? 3,
        emailMaxRequests: env['MFA_EMAIL_MAX_REQUESTS'] ?? 5,
        recoveryMaxAttempts: env['MFA_RECOVERY_MAX_ATTEMPTS'] ?? 3,
        windowMs: env['MFA_RATE_LIMIT_WINDOW_MS'] ?? 60 * 60 * 1000,
      },
    },

    mfa: {
      issuer: env['MFA_ISSUER'] ?? 'Skillancer',
      encryptionKey: env['MFA_ENCRYPTION_KEY'],
      totpWindow: env['MFA_TOTP_WINDOW'] ?? 1,
      challengeTtl: env['MFA_CHALLENGE_TTL_MS'] ?? 5 * 60 * 1000,
      recoveryCodeCount: env['MFA_RECOVERY_CODE_COUNT'] ?? 10,
      stepUpAuthTtl: env['MFA_STEP_UP_AUTH_TTL_MS'] ?? 15 * 60 * 1000,
      smsCodeLength: env['MFA_SMS_CODE_LENGTH'] ?? 6,
      emailCodeLength: env['MFA_EMAIL_CODE_LENGTH'] ?? 6,
      smsCodeTtl: env['MFA_SMS_CODE_TTL_MS'] ?? 5 * 60 * 1000,
      emailCodeTtl: env['MFA_EMAIL_CODE_TTL_MS'] ?? 10 * 60 * 1000,
    },

    sms: {
      provider: env['SMS_PROVIDER'] ?? 'mock',
      twilioAccountSid: env['TWILIO_ACCOUNT_SID'],
      twilioAuthToken: env['TWILIO_AUTH_TOKEN'],
      twilioPhoneNumber: env['TWILIO_PHONE_NUMBER'],
    },

    storage: {
      s3Bucket: env['S3_BUCKET'] ?? 'skillancer-uploads',
      s3Region: env['S3_REGION'] ?? env['AWS_REGION'] ?? 'us-east-1',
      s3Endpoint: env['S3_ENDPOINT'], // For LocalStack: http://localhost:4566
      s3AccessKeyId: env['S3_ACCESS_KEY_ID'] ?? env['AWS_ACCESS_KEY_ID'],
      s3SecretAccessKey: env['S3_SECRET_ACCESS_KEY'] ?? env['AWS_SECRET_ACCESS_KEY'],
      s3ForcePathStyle: env['S3_FORCE_PATH_STYLE'] === 'true',
      s3CdnUrl: env['S3_CDN_URL'],
    },

    profile: {
      maxAvatarSize: env['PROFILE_MAX_AVATAR_SIZE'] ?? 10 * 1024 * 1024,
      maxSkills: env['PROFILE_MAX_SKILLS'] ?? 50,
      publicProfileCacheTtl: env['PROFILE_CACHE_TTL'] ?? 5 * 60,
    },

    logging: {
      level: env['LOG_LEVEL'] ?? 'info',
      pretty: env['NODE_ENV'] === 'development',
    },

    persona: {
      apiKey: env['PERSONA_API_KEY'],
      apiVersion: env['PERSONA_API_VERSION'] ?? '2023-01-05',
      baseUrl: env['PERSONA_BASE_URL'] ?? 'https://withpersona.com/api/v1',
      webhookSecret: env['PERSONA_WEBHOOK_SECRET'],
      templates: {
        basic: env['PERSONA_TEMPLATE_BASIC'],
        enhanced: env['PERSONA_TEMPLATE_ENHANCED'],
        premium: env['PERSONA_TEMPLATE_PREMIUM'],
      },
      badgeValidityDays: env['PERSONA_BADGE_VALIDITY_DAYS'] ?? 365,
      inquiryExpiryHours: env['PERSONA_INQUIRY_EXPIRY_HOURS'] ?? 48,
    },
  };

  cachedConfig = configSchema.parse(rawConfig);
  return cachedConfig;
}

/**
 * Clear config cache (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Validate config and throw if invalid
 */
export function validateConfig(): void {
  getConfig();
}

export { configSchema };
