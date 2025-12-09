/**
 * @module @skillancer/service-template/config
 * Environment configuration with Zod validation
 */

import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

const envSchema = z.enum(['development', 'test', 'production']).default('development');

const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info');

const configSchema = z.object({
  // Environment
  env: envSchema,

  // Service info
  service: z.object({
    name: z.string().default('service'),
    version: z.string().default('0.0.1'),
  }),

  // Server
  server: z.object({
    port: z.coerce.number().int().positive().default(3000),
    host: z.string().default('0.0.0.0'),
  }),

  // Logging
  logging: z.object({
    level: logLevelSchema,
    pretty: z.coerce.boolean().default(false),
  }),

  // Database (optional)
  database: z
    .object({
      url: z.string().url().optional(),
      poolMin: z.coerce.number().int().nonnegative().default(2),
      poolMax: z.coerce.number().int().positive().default(10),
    })
    .optional(),

  // Redis (optional)
  redis: z
    .object({
      url: z.string().optional(),
    })
    .optional(),

  // JWT (optional)
  jwt: z
    .object({
      secret: z.string().min(32).optional(),
      expiresIn: z.string().default('7d'),
    })
    .optional(),

  // CORS
  cors: z.object({
    origin: z.union([z.string(), z.array(z.string()), z.boolean()]).default('*'),
    credentials: z.coerce.boolean().default(true),
  }),

  // Rate limiting
  rateLimit: z.object({
    max: z.coerce.number().int().positive().default(100),
    windowMs: z.coerce.number().int().positive().default(60000),
  }),

  // Feature flags
  features: z.object({
    swagger: z.coerce.boolean().default(true),
    metrics: z.coerce.boolean().default(true),
  }),

  // External services (optional)
  services: z.record(z.string(), z.string().url()).optional(),
});

// ============================================================================
// TYPES
// ============================================================================

export type Config = z.infer<typeof configSchema>;
export type Environment = z.infer<typeof envSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

// ============================================================================
// CONFIGURATION
// ============================================================================

let cachedConfig: Config | null = null;

/**
 * Load environment variables from .env file
 */
export function loadEnv(): void {
  dotenvConfig();
}

/**
 * Build configuration object from environment variables
 */
function buildConfigFromEnv(): Record<string, unknown> {
  return {
    env: process.env.NODE_ENV,
    service: {
      name: process.env.SERVICE_NAME,
      version: process.env.SERVICE_VERSION,
    },
    server: {
      port: process.env.PORT,
      host: process.env.HOST,
    },
    logging: {
      level: process.env.LOG_LEVEL,
      pretty: process.env.LOG_PRETTY || process.env.NODE_ENV === 'development',
    },
    database: process.env.DATABASE_URL
      ? {
          url: process.env.DATABASE_URL,
          poolMin: process.env.DB_POOL_MIN,
          poolMax: process.env.DB_POOL_MAX,
        }
      : undefined,
    redis: process.env.REDIS_URL
      ? {
          url: process.env.REDIS_URL,
        }
      : undefined,
    jwt: process.env.JWT_SECRET
      ? {
          secret: process.env.JWT_SECRET,
          expiresIn: process.env.JWT_EXPIRES_IN,
        }
      : undefined,
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: process.env.CORS_CREDENTIALS,
    },
    rateLimit: {
      max: process.env.RATE_LIMIT_MAX,
      windowMs: process.env.RATE_LIMIT_WINDOW,
    },
    features: {
      swagger: process.env.ENABLE_SWAGGER ?? true,
      metrics: process.env.ENABLE_METRICS ?? true,
    },
    services: parseServicesFromEnv(),
  };
}

/**
 * Parse service URLs from environment variables
 * Format: SERVICE_<NAME>_URL=https://...
 */
function parseServicesFromEnv(): Record<string, string> | undefined {
  const services: Record<string, string> = {};
  const prefix = 'SERVICE_';
  const suffix = '_URL';

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(prefix) && key.endsWith(suffix) && value) {
      const serviceName = key.slice(prefix.length, -suffix.length).toLowerCase();
      services[serviceName] = value;
    }
  }

  return Object.keys(services).length > 0 ? services : undefined;
}

/**
 * Get validated configuration
 * Caches the result for subsequent calls
 */
export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  loadEnv();
  const rawConfig = buildConfigFromEnv();
  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

/**
 * Clear the configuration cache
 * Useful for testing or hot-reloading
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Validate configuration without caching
 */
export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const result = configSchema.safeParse(config);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`),
  };
}

// Export schema for external validation
export { configSchema };
