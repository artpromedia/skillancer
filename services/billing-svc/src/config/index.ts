/**
 * @module @skillancer/billing-svc/config
 * Configuration management for billing service
 */

import { z } from 'zod';

// =============================================================================
// SCHEMA
// =============================================================================

const configSchema = z.object({
  // App settings
  app: z.object({
    port: z.coerce.number().default(4002),
    host: z.string().default('0.0.0.0'),
    nodeEnv: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    logLevel: z.string().default('info'),
    corsOrigins: z.array(z.string()).default(['http://localhost:3000']),
  }),

  // Database
  databaseUrl: z.string(),

  // Redis
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
  }),

  // Stripe
  stripe: z.object({
    secretKey: z.string(),
    webhookSecret: z.string(),
    apiVersion: z.string().default('2024-11-20.acacia'),
  }),

  // Payment settings
  payment: z.object({
    // Card expiration warning (days before expiry)
    expirationWarningDays: z.coerce.number().default(30),
    // Max payment methods per user
    maxPaymentMethodsPerUser: z.coerce.number().default(10),
    // Supported currencies
    supportedCurrencies: z.array(z.string()).default(['USD', 'EUR', 'GBP']),
    // Default currency
    defaultCurrency: z.string().default('USD'),
  }),

  // Rate limiting
  rateLimit: z.object({
    paymentMethods: z.object({
      maxRequests: z.coerce.number().default(20),
      windowMs: z.coerce.number().default(60 * 1000), // 1 minute
    }),
    webhooks: z.object({
      maxRequests: z.coerce.number().default(100),
      windowMs: z.coerce.number().default(60 * 1000), // 1 minute
    }),
  }),

  // URLs
  appUrl: z.string().default('http://localhost:3000'),
  apiUrl: z.string().default('http://localhost:4002'),

  // Notification service
  notificationServiceUrl: z.string().default('http://localhost:4005'),
});

// =============================================================================
// CONFIG TYPE
// =============================================================================

export type Config = z.infer<typeof configSchema>;

// =============================================================================
// CONFIG SINGLETON
// =============================================================================

let configInstance: Config | null = null;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  if (configInstance) {
    return configInstance;
  }

  const rawConfig = {
    app: {
      port: process.env.PORT,
      host: process.env.HOST,
      nodeEnv: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL,
      corsOrigins: process.env.CORS_ORIGINS?.split(','),
    },
    databaseUrl: process.env.DATABASE_URL,
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
    },

    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      apiVersion: process.env.STRIPE_API_VERSION,
    },

    payment: {
      expirationWarningDays: process.env.PAYMENT_EXPIRATION_WARNING_DAYS,
      maxPaymentMethodsPerUser: process.env.PAYMENT_MAX_METHODS_PER_USER,
      supportedCurrencies: process.env.PAYMENT_SUPPORTED_CURRENCIES?.split(','),
      defaultCurrency: process.env.PAYMENT_DEFAULT_CURRENCY,
    },

    rateLimit: {
      paymentMethods: {
        maxRequests: process.env.RATE_LIMIT_PAYMENT_METHODS_MAX,
        windowMs: process.env.RATE_LIMIT_PAYMENT_METHODS_WINDOW,
      },
      webhooks: {
        maxRequests: process.env.RATE_LIMIT_WEBHOOKS_MAX,
        windowMs: process.env.RATE_LIMIT_WEBHOOKS_WINDOW,
      },
    },

    appUrl: process.env.APP_URL,
    apiUrl: process.env.API_URL,
    notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL,
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid configuration');
  }

  configInstance = result.data;
  return configInstance;
}

/**
 * Get the current configuration (must be loaded first)
 */
export function getConfig(): Config {
  if (!configInstance) {
    return loadConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

// Export config as a convenience (lazy loaded)
export const config = new Proxy({} as Config, {
  get(_target, prop) {
    const cfg = getConfig();
    return cfg[prop as keyof Config];
  },
});
