/**
 * @module @skillancer/cache/client
 * Redis client configuration and connection management
 */

import Redis, { Cluster } from 'ioredis';

import type { RedisOptions, ClusterNode, ClusterOptions } from 'ioredis';

// ============================================================================
// TYPES
// ============================================================================

export interface RedisConfig {
  /** Redis host */
  host: string;
  /** Redis port */
  port: number;
  /** Redis password */
  password?: string;
  /** Database index (0-15) */
  db?: number;
  /** Database index (0-15) - alias for db */
  database?: number;
  /** Key prefix for all operations */
  keyPrefix?: string;
  /** Enable TLS */
  tls?: boolean;
  /** Max retries per request */
  maxRetriesPerRequest?: number;
  /** Connection timeout in ms */
  connectTimeout?: number;
  /** Command timeout in ms */
  commandTimeout?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
  /** Enable read replicas */
  enableReadyCheck?: boolean;
  /** Lazy connect (don't connect until first command) */
  lazyConnect?: boolean;
}

export interface RedisClusterConfig {
  /** Cluster nodes */
  nodes: ClusterNode[];
  /** Cluster options */
  options?: ClusterOptions;
  /** Key prefix */
  keyPrefix?: string;
}

// ============================================================================
// CLIENT FACTORY
// ============================================================================

/**
 * Create a new Redis client with the given configuration
 *
 * @param config - Redis configuration
 * @returns Configured Redis client
 *
 * @example
 * ```typescript
 * const redis = createRedisClient({
 *   host: 'localhost',
 *   port: 6379,
 *   password: 'secret',
 *   keyPrefix: 'myapp:',
 * });
 * ```
 */
export function createRedisClient(config: RedisConfig): Redis {
  const options: RedisOptions = {
    host: config.host,
    port: config.port,
    db: config.db ?? config.database ?? 0,
    maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
    connectTimeout: config.connectTimeout ?? 10000,
    commandTimeout: config.commandTimeout ?? 5000,
    enableReadyCheck: config.enableReadyCheck ?? true,
    lazyConnect: config.lazyConnect ?? false,
    retryStrategy: (times: number) => {
      const baseDelay = config.retryDelayMs ?? 1000;
      if (times > 10) {
        // Stop retrying after 10 attempts
        return null;
      }
      // Exponential backoff with max 30 seconds
      return Math.min(times * baseDelay, 30000);
    },
  };

  // Only add optional properties if they have values
  if (config.password) {
    options.password = config.password;
  }
  if (config.keyPrefix) {
    options.keyPrefix = config.keyPrefix;
  }
  if (config.tls) {
    options.tls = {};
  }

  const client = new Redis(options);

  // Add event handlers
  client.on('connect', () => {
    console.log(`[Redis] Connected to ${config.host}:${config.port}`);
  });

  client.on('error', (error) => {
    console.error('[Redis] Connection error:', error.message);
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed');
  });

  return client;
}

/**
 * Create a Redis URL from configuration
 */
export function buildRedisUrl(config: RedisConfig): string {
  const auth = config.password ? `:${config.password}@` : '';
  const protocol = config.tls ? 'rediss' : 'redis';
  return `${protocol}://${auth}${config.host}:${config.port}/${config.db ?? 0}`;
}

/**
 * Create a Redis client from URL
 *
 * @param url - Redis connection URL
 * @param options - Additional options
 * @returns Configured Redis client
 *
 * @example
 * ```typescript
 * const redis = createRedisClientFromUrl('redis://localhost:6379/0');
 * ```
 */
export function createRedisClientFromUrl(
  url: string,
  options?: Partial<RedisOptions>
): Redis {
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 5000,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times: number) => {
      if (times > 10) return null;
      return Math.min(times * 1000, 30000);
    },
    ...options,
  });

  client.on('error', (error) => {
    console.error('[Redis] Connection error:', error.message);
  });

  return client;
}

/**
 * Create a Redis Cluster client
 *
 * @param config - Cluster configuration
 * @returns Configured Redis Cluster client
 *
 * @example
 * ```typescript
 * const cluster = createRedisCluster({
 *   nodes: [
 *     { host: 'node1.redis.local', port: 6379 },
 *     { host: 'node2.redis.local', port: 6379 },
 *   ],
 * });
 * ```
 */
export function createRedisCluster(config: RedisClusterConfig): Cluster {
  const clusterOptions: ClusterOptions = {
    redisOptions: {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
    },
    clusterRetryStrategy: (times: number) => {
      if (times > 10) return null;
      return Math.min(times * 1000, 30000);
    },
    ...config.options,
  };

  // Only add keyPrefix if defined
  if (config.keyPrefix) {
    clusterOptions.keyPrefix = config.keyPrefix;
  }

  const cluster = new Redis.Cluster(config.nodes, clusterOptions);

  cluster.on('error', (error: Error) => {
    console.error('[Redis Cluster] Error:', error.message);
  });

  return cluster;
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultClient: Redis | null = null;

/**
 * Get the default Redis client singleton
 *
 * Uses REDIS_URL environment variable or falls back to localhost
 *
 * @returns Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!defaultClient) {
    const url = process.env['REDIS_URL'] || 'redis://localhost:6379';
    defaultClient = createRedisClientFromUrl(url);
  }
  return defaultClient;
}

/**
 * Set a custom default Redis client
 *
 * @param client - Redis client to use as default
 */
export function setDefaultRedisClient(client: Redis): void {
  defaultClient = client;
}

/**
 * Close the default Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (defaultClient) {
    await defaultClient.quit();
    defaultClient = null;
    console.log('[Redis] Default connection closed');
  }
}

/**
 * Close a Redis client
 *
 * @param client - Redis client to close
 */
export async function closeClient(client: Redis | Cluster): Promise<void> {
  await client.quit();
}

// Re-export Redis types for convenience
export { Redis, Cluster };
export type { RedisOptions, ClusterOptions, ClusterNode };
