/**
 * @module @skillancer/cache/health
 * Redis health check utilities
 */

import type { Redis } from 'ioredis';

// ============================================================================
// TYPES
// ============================================================================

export interface HealthStatus {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Latency in milliseconds */
  latency: number;
  /** Connection status */
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  /** Error message if unhealthy */
  error?: string;
  /** Additional details */
  details?: {
    /** Redis server version */
    version?: string;
    /** Memory usage in bytes */
    usedMemory?: number;
    /** Memory usage human readable */
    usedMemoryHuman?: string;
    /** Number of connected clients */
    connectedClients?: number;
    /** Uptime in seconds */
    uptimeSeconds?: number;
    /** Redis role (master/slave) */
    role?: string;
    /** Number of keys */
    totalKeys?: number;
  };
}

export interface HealthCheckOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Include detailed server info (default: false) */
  includeDetails?: boolean;
}

// ============================================================================
// HEALTH CHECK FUNCTIONS
// ============================================================================

/**
 * Check Redis connection health
 *
 * @param redis - Redis client instance
 * @param options - Health check options
 * @returns Health status
 *
 * @example
 * ```typescript
 * import { checkRedisHealth, getRedisClient } from '@skillancer/cache';
 *
 * const redis = getRedisClient();
 * const health = await checkRedisHealth(redis);
 *
 * if (!health.healthy) {
 *   console.error('Redis unhealthy:', health.error);
 * }
 * ```
 */
export async function checkRedisHealth(
  redis: Redis,
  options: HealthCheckOptions = {}
): Promise<HealthStatus> {
  const { timeout = 5000, includeDetails = false } = options;
  const startTime = Date.now();

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeout}ms`));
      }, timeout);
    });

    // Ping the server with timeout
    const pingPromise = redis.ping();
    const pingResult = await Promise.race([pingPromise, timeoutPromise]);

    const latency = Date.now() - startTime;

    if (pingResult !== 'PONG') {
      return {
        healthy: false,
        latency,
        status: 'error',
        error: `Unexpected ping response: ${String(pingResult)}`,
      };
    }

    const healthStatus: HealthStatus = {
      healthy: true,
      latency,
      status: 'connected',
    };

    // Get detailed info if requested
    if (includeDetails) {
      try {
        const info = await redis.info();
        healthStatus.details = parseRedisInfo(info);
      } catch {
        // Details are optional, don't fail health check
      }
    }

    return healthStatus;
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      status: getConnectionStatus(redis),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Perform a quick health check (just ping)
 *
 * @param redis - Redis client instance
 * @param timeout - Timeout in milliseconds
 * @returns True if healthy
 */
export async function isRedisHealthy(
  redis: Redis,
  timeout = 2000
): Promise<boolean> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeout);
    });

    const result = await Promise.race([redis.ping(), timeoutPromise]);
    return result === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Wait for Redis to become available
 *
 * @param redis - Redis client instance
 * @param options - Wait options
 * @returns True if connected within timeout
 *
 * @example
 * ```typescript
 * const redis = createRedisClient(config);
 *
 * const ready = await waitForRedis(redis, {
 *   maxWait: 30000,
 *   checkInterval: 1000,
 *   onRetry: (attempt) => console.log(`Waiting for Redis... attempt ${attempt}`)
 * });
 *
 * if (!ready) {
 *   throw new Error('Failed to connect to Redis');
 * }
 * ```
 */
export async function waitForRedis(
  redis: Redis,
  options: {
    /** Maximum wait time in ms (default: 30000) */
    maxWait?: number;
    /** Check interval in ms (default: 1000) */
    checkInterval?: number;
    /** Callback on each retry */
    onRetry?: (attempt: number) => void;
  } = {}
): Promise<boolean> {
  const { maxWait = 30000, checkInterval = 1000, onRetry } = options;
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < maxWait) {
    attempt++;

    if (await isRedisHealthy(redis, checkInterval)) {
      return true;
    }

    onRetry?.(attempt);

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  return false;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get connection status from Redis client
 */
function getConnectionStatus(
  redis: Redis
): 'connected' | 'connecting' | 'disconnected' | 'error' {
  const status = redis.status;

  switch (status) {
    case 'ready':
    case 'connect':
      return 'connected';
    case 'connecting':
    case 'reconnecting':
      return 'connecting';
    case 'close':
    case 'end':
      return 'disconnected';
    default:
      return 'error';
  }
}

/**
 * Parse Redis INFO command output
 */
function parseRedisInfo(
  info: string
): NonNullable<HealthStatus['details']> {
  const lines = info.split('\r\n');
  const parsed: Record<string, string> = {};

  for (const line of lines) {
    const [key, value] = line.split(':');
    if (key && value) {
      parsed[key.trim()] = value.trim();
    }
  }

  // Get total keys from all databases
  let totalKeys = 0;
  for (let i = 0; i < 16; i++) {
    const dbInfo = parsed[`db${i}`];
    if (dbInfo) {
      const match = dbInfo.match(/keys=(\d+)/);
      if (match && match[1]) {
        totalKeys += parseInt(match[1], 10);
      }
    }
  }

  // Build result object with only defined values
  const result: NonNullable<HealthStatus['details']> = {};

  if (parsed['redis_version']) {
    result.version = parsed['redis_version'];
  }
  if (parsed['used_memory']) {
    result.usedMemory = parseInt(parsed['used_memory'], 10);
  }
  if (parsed['used_memory_human']) {
    result.usedMemoryHuman = parsed['used_memory_human'];
  }
  if (parsed['connected_clients']) {
    result.connectedClients = parseInt(parsed['connected_clients'], 10);
  }
  if (parsed['uptime_in_seconds']) {
    result.uptimeSeconds = parseInt(parsed['uptime_in_seconds'], 10);
  }
  if (parsed['role']) {
    result.role = parsed['role'];
  }
  if (totalKeys > 0) {
    result.totalKeys = totalKeys;
  }

  return result;
}

// ============================================================================
// HEALTH CHECK MIDDLEWARE
// ============================================================================

export interface HealthCheckMiddlewareOptions {
  /** Redis client */
  redis: Redis;
  /** Path for health check endpoint */
  path?: string;
  /** Include detailed info */
  includeDetails?: boolean;
  /** Custom health check timeout */
  timeout?: number;
}

/**
 * Create health check response for HTTP endpoints
 *
 * @param redis - Redis client
 * @param options - Health check options
 * @returns Health response object
 *
 * @example
 * ```typescript
 * // Express route
 * app.get('/health/redis', async (req, res) => {
 *   const health = await createHealthResponse(redis, { includeDetails: true });
 *   res.status(health.healthy ? 200 : 503).json(health);
 * });
 * ```
 */
export async function createHealthResponse(
  redis: Redis,
  options: HealthCheckOptions = {}
): Promise<{
  service: string;
  status: string;
  timestamp: string;
  data: HealthStatus;
}> {
  const health = await checkRedisHealth(redis, options);

  return {
    service: 'redis',
    status: health.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    data: health,
  };
}
