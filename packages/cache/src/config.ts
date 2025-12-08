/**
 * @module @skillancer/cache/config
 * Redis configuration utilities
 */

import type { RedisConfig } from './client';

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

/**
 * Get Redis configuration from environment variables
 *
 * Environment variables:
 * - REDIS_URL: Full Redis URL (redis://user:pass@host:port/db)
 * - REDIS_HOST: Redis host (default: localhost)
 * - REDIS_PORT: Redis port (default: 6379)
 * - REDIS_PASSWORD: Redis password
 * - REDIS_DATABASE: Redis database number (default: 0)
 * - REDIS_TLS: Enable TLS (true/false)
 * - REDIS_KEY_PREFIX: Key prefix for all cache keys
 * - REDIS_CONNECT_TIMEOUT: Connection timeout in ms
 * - REDIS_COMMAND_TIMEOUT: Command timeout in ms
 * - REDIS_MAX_RETRIES: Maximum reconnection attempts
 * - REDIS_RETRY_DELAY: Initial retry delay in ms
 *
 * @param env - Environment variables object (defaults to process.env)
 * @returns Redis configuration
 *
 * @example
 * ```typescript
 * import { getRedisConfigFromEnv, createRedisClient } from '@skillancer/cache';
 *
 * const config = getRedisConfigFromEnv();
 * const redis = createRedisClient(config);
 * ```
 */
export function getRedisConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): RedisConfig {
  // If REDIS_URL is provided, parse it
  if (env.REDIS_URL) {
    return parseRedisUrl(env.REDIS_URL, env);
  }

  const config: RedisConfig = {
    host: env.REDIS_HOST || 'localhost',
    port: parseInt(env.REDIS_PORT || '6379', 10),
    database: parseInt(env.REDIS_DATABASE || '0', 10),
    tls: env.REDIS_TLS === 'true',
  };

  // Only add optional properties if they have values
  if (env.REDIS_PASSWORD) {
    config.password = env.REDIS_PASSWORD;
  }
  if (env.REDIS_KEY_PREFIX) {
    config.keyPrefix = env.REDIS_KEY_PREFIX;
  }
  if (env.REDIS_CONNECT_TIMEOUT) {
    config.connectTimeout = parseInt(env.REDIS_CONNECT_TIMEOUT, 10);
  }
  if (env.REDIS_COMMAND_TIMEOUT) {
    config.commandTimeout = parseInt(env.REDIS_COMMAND_TIMEOUT, 10);
  }
  if (env.REDIS_MAX_RETRIES) {
    config.maxRetriesPerRequest = parseInt(env.REDIS_MAX_RETRIES, 10);
  }
  if (env.REDIS_RETRY_DELAY) {
    config.retryDelayMs = parseInt(env.REDIS_RETRY_DELAY, 10);
  }

  return config;
}

/**
 * Parse Redis URL into configuration
 *
 * Supports formats:
 * - redis://host:port
 * - redis://user:password@host:port
 * - redis://host:port/database
 * - rediss://... (TLS)
 *
 * @param url - Redis URL
 * @param env - Additional environment overrides
 * @returns Redis configuration
 */
export function parseRedisUrl(
  url: string,
  env: Record<string, string | undefined> = {}
): RedisConfig {
  const parsed = new URL(url);

  const config: RedisConfig = {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10),
    database: parsed.pathname
      ? parseInt(parsed.pathname.slice(1), 10) || 0
      : 0,
    tls: parsed.protocol === 'rediss:',
  };

  // Only add password if present
  if (parsed.password) {
    config.password = parsed.password;
  }

  // Override with environment variables if provided
  if (env.REDIS_KEY_PREFIX) {
    config.keyPrefix = env.REDIS_KEY_PREFIX;
  }
  if (env.REDIS_CONNECT_TIMEOUT) {
    config.connectTimeout = parseInt(env.REDIS_CONNECT_TIMEOUT, 10);
  }
  if (env.REDIS_COMMAND_TIMEOUT) {
    config.commandTimeout = parseInt(env.REDIS_COMMAND_TIMEOUT, 10);
  }

  return config;
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Default development configuration
 */
export const developmentConfig: RedisConfig = {
  host: 'localhost',
  port: 6379,
  database: 0,
  keyPrefix: 'dev:',
  maxRetriesPerRequest: 3,
  retryDelayMs: 100,
};

/**
 * Default test configuration
 */
export const testConfig: RedisConfig = {
  host: 'localhost',
  port: 6379,
  database: 1, // Use separate database for tests
  keyPrefix: 'test:',
  maxRetriesPerRequest: 1,
  retryDelayMs: 50,
};

/**
 * Default production configuration (requires environment variables)
 */
export const productionConfig: RedisConfig = {
  ...getRedisConfigFromEnv(),
  maxRetriesPerRequest: 5,
  retryDelayMs: 200,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

/**
 * Get configuration for current environment
 *
 * @param nodeEnv - Node environment (defaults to process.env.NODE_ENV)
 * @returns Appropriate Redis configuration
 */
export function getConfigForEnvironment(
  nodeEnv: string = process.env.NODE_ENV || 'development'
): RedisConfig {
  switch (nodeEnv) {
    case 'production':
      return getRedisConfigFromEnv();
    case 'test':
      return testConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

// ============================================================================
// CLUSTER CONFIGURATION
// ============================================================================

export interface ClusterNode {
  host: string;
  port: number;
}

/**
 * Get Redis cluster configuration from environment
 *
 * Environment variables:
 * - REDIS_CLUSTER_NODES: Comma-separated list of nodes (host:port,host:port)
 * - REDIS_CLUSTER_PASSWORD: Cluster password
 * - REDIS_CLUSTER_TLS: Enable TLS for cluster
 *
 * @param env - Environment variables
 * @returns Cluster nodes and options
 */
export function getClusterConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): {
  nodes: ClusterNode[];
  password?: string;
  tls?: boolean;
  keyPrefix?: string;
} {
  const nodesString = env.REDIS_CLUSTER_NODES || '';

  const nodes = nodesString
    .split(',')
    .filter(Boolean)
    .map((node) => {
      const [host, port] = node.trim().split(':');
      return {
        host: host || 'localhost',
        port: parseInt(port || '6379', 10),
      };
    });

  // Default to single node if no cluster nodes specified
  if (nodes.length === 0) {
    nodes.push({
      host: env.REDIS_HOST || 'localhost',
      port: parseInt(env.REDIS_PORT || '6379', 10),
    });
  }

  const result: {
    nodes: ClusterNode[];
    password?: string;
    tls?: boolean;
    keyPrefix?: string;
  } = {
    nodes,
    tls: env.REDIS_CLUSTER_TLS === 'true' || env.REDIS_TLS === 'true',
  };

  const password = env.REDIS_CLUSTER_PASSWORD || env.REDIS_PASSWORD;
  if (password) {
    result.password = password;
  }
  if (env.REDIS_KEY_PREFIX) {
    result.keyPrefix = env.REDIS_KEY_PREFIX;
  }

  return result;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Redis configuration
 *
 * @param config - Redis configuration to validate
 * @returns Validation result
 */
export function validateConfig(config: RedisConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.host) {
    errors.push('Host is required');
  }

  // Port validation
  if (config.port !== undefined) {
    if (config.port < 1 || config.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }
  }

  // Database validation
  if (config.database !== undefined) {
    if (config.database < 0 || config.database > 15) {
      errors.push('Database must be between 0 and 15');
    }
  }

  // Timeout validations
  if (config.connectTimeout !== undefined && config.connectTimeout < 0) {
    errors.push('Connect timeout must be non-negative');
  }
  if (config.commandTimeout !== undefined && config.commandTimeout < 0) {
    errors.push('Command timeout must be non-negative');
  }

  // Warnings
  if (!config.password) {
    warnings.push('No password configured - Redis connection is not authenticated');
  }

  if (!config.tls) {
    warnings.push('TLS is disabled - connection is not encrypted');
  }

  if (!config.keyPrefix) {
    warnings.push('No key prefix configured - consider using one to avoid key collisions');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a connection string from configuration
 *
 * @param config - Redis configuration
 * @returns Redis connection URL
 */
export function configToUrl(config: RedisConfig): string {
  const protocol = config.tls ? 'rediss' : 'redis';
  const auth = config.password ? `:${config.password}@` : '';
  const db = config.database ? `/${config.database}` : '';

  return `${protocol}://${auth}${config.host}:${config.port || 6379}${db}`;
}

/**
 * Merge configurations with defaults
 *
 * @param config - User configuration
 * @param defaults - Default configuration
 * @returns Merged configuration
 */
export function mergeConfig(
  config: Partial<RedisConfig>,
  defaults: RedisConfig = developmentConfig
): RedisConfig {
  return {
    ...defaults,
    ...config,
  };
}
