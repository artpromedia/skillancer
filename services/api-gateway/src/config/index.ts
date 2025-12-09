/**
 * @module @skillancer/api-gateway/config
 * Configuration management with Zod validation
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

const configSchema = z.object({
  env: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  service: z.object({
    name: z.string().default('api-gateway'),
    version: z.string().default('0.0.1'),
  }),
  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.coerce.number().default(4000),
    logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  }),
  logging: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    pretty: z.coerce.boolean().default(false),
  }),
  jwt: z
    .object({
      secret: z.string().min(32),
      expiresIn: z.string().default('1h'),
    })
    .optional(),
  features: z.object({
    swagger: z.coerce.boolean().default(true),
    metrics: z.coerce.boolean().default(true),
  }),
  rateLimit: z.object({
    global: z.object({
      max: z.coerce.number().default(100),
      timeWindow: z.string().default('1 minute'),
    }),
  }),
  cors: z.object({
    origins: z.string().default(''),
  }),
  services: z.object({
    auth: z.string().url().default('http://localhost:3001'),
    market: z.string().url().default('http://localhost:3002'),
    skillpod: z.string().url().default('http://localhost:3003'),
    cockpit: z.string().url().default('http://localhost:3004'),
    billing: z.string().url().default('http://localhost:3005'),
    notification: z.string().url().default('http://localhost:3006'),
  }),
  circuitBreaker: z.object({
    timeout: z.coerce.number().default(30000),
    errorThresholdPercentage: z.coerce.number().default(50),
    resetTimeout: z.coerce.number().default(30000),
    volumeThreshold: z.coerce.number().default(10),
  }),
  redis: z
    .object({
      host: z.string().default('localhost'),
      port: z.coerce.number().default(6379),
      password: z.string().optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof configSchema>;
export type GatewayConfig = Config;

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

let cachedConfig: Config | null = null;

/**
 * Load and validate configuration from environment variables
 */
export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = process.env.NODE_ENV || 'development';

  const rawConfig = {
    env,
    service: {
      name: process.env.SERVICE_NAME || 'api-gateway',
      version: process.env.SERVICE_VERSION || '0.0.1',
    },
    server: {
      host: process.env.HOST || '0.0.0.0',
      port: process.env.PORT || 4000,
      logLevel: process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info'),
    },
    logging: {
      level: process.env.LOG_LEVEL || (env === 'development' ? 'debug' : 'info'),
      pretty: process.env.LOG_PRETTY || env === 'development',
    },
    jwt: process.env.JWT_SECRET
      ? {
          secret: process.env.JWT_SECRET,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        }
      : undefined,
    features: {
      swagger: process.env.ENABLE_SWAGGER ?? env !== 'production',
      metrics: process.env.ENABLE_METRICS ?? true,
    },
    rateLimit: {
      global: {
        max: process.env.RATE_LIMIT_MAX || 100,
        timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
      },
    },
    cors: {
      origins: process.env.CORS_ORIGINS || '',
    },
    services: {
      auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
      market: process.env.MARKET_SERVICE_URL || 'http://localhost:3002',
      skillpod: process.env.SKILLPOD_SERVICE_URL || 'http://localhost:3003',
      cockpit: process.env.COCKPIT_SERVICE_URL || 'http://localhost:3004',
      billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3005',
      notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006',
    },
    circuitBreaker: {
      timeout: process.env.CIRCUIT_BREAKER_TIMEOUT || 30000,
      errorThresholdPercentage: process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || 50,
      resetTimeout: process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || 30000,
      volumeThreshold: process.env.CIRCUIT_BREAKER_VOLUME_THRESHOLD || 10,
    },
    redis: process.env.REDIS_HOST
      ? {
          host: process.env.REDIS_HOST,
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
        }
      : undefined,
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error('❌ Invalid configuration:');
    console.error(result.error.format());
    throw new Error('Invalid configuration');
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Clear cached configuration (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Validate configuration without caching
 */
export function validateConfig(config: unknown): Config {
  return configSchema.parse(config);
}
