// @ts-nocheck - Module resolution handled at build time
/**
 * Integration Cache Service
 *
 * Caching layer for integration data with TTL management
 */

import { createHash } from 'crypto';
import Redis from 'ioredis';
import { logger } from '@skillancer/logger';

import { getConfig } from '../config/index.js';

// Redis client singleton
let redisClient: Redis | null = null;
let isConnected = false;

function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const config = getConfig();
  const redisUrl = config.redis?.url || process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required for cache service');
  }

  redisClient = new Redis(redisUrl, {
    keyPrefix: config.redis?.keyPrefix || 'integration-hub:',
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('Redis connection failed after 10 retries');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis connection retry ${times}, waiting ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  redisClient.on('connect', () => {
    isConnected = true;
    logger.info('Redis connected successfully');
  });

  redisClient.on('error', (error: Error) => {
    isConnected = false;
    logger.error('Redis connection error', { error: error.message });
  });

  redisClient.on('close', () => {
    isConnected = false;
    logger.warn('Redis connection closed');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  return redisClient;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info('Redis connection closed gracefully');
  }
}

// Cache configuration
interface CacheConfig {
  defaultTTL: number;
  widgetTTL: number;
  tokenTTL: number;
  maxCacheSize: number;
}

// Cache entry metadata
interface CacheMetadata {
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessedAt: number;
}

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class CacheService {
  private readonly config: CacheConfig = {
    defaultTTL: 300, // 5 minutes
    widgetTTL: 60, // 1 minute for widget data
    tokenTTL: 3600, // 1 hour for tokens
    maxCacheSize: 10000, // Max entries per integration
  };

  private stats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Get cached data
   */
  async get<T>(
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<T | null> {
    const key = this.generateCacheKey(integrationId, widgetId, params);
    const redis = getRedisClient();

    try {
      const cached = await redis.get(key);
      if (cached) {
        this.stats.hits++;

        // Update access metadata
        await this.updateAccessMetadata(key);

        const data = JSON.parse(cached);
        logger.debug('Cache hit', { key, integrationId, widgetId });
        return data as T;
      }

      this.stats.misses++;
      logger.debug('Cache miss', { key, integrationId, widgetId });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set(
    integrationId: string,
    widgetId: string,
    params: Record<string, unknown> | undefined,
    data: unknown,
    ttl?: number
  ): Promise<void> {
    const key = this.generateCacheKey(integrationId, widgetId, params);
    const effectiveTTL = ttl || this.config.widgetTTL;
    const redis = getRedisClient();

    try {
      const serialized = JSON.stringify(data);
      await redis.set(key, serialized, 'EX', effectiveTTL);

      // Store metadata
      await this.storeMetadata(key, effectiveTTL);

      logger.debug('Cache set', { key, integrationId, widgetId, ttl: effectiveTTL });
    } catch (error) {
      logger.error('Cache set error', { key, error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Invalidate cache for a widget
   */
  async invalidate(integrationId: string, widgetId?: string): Promise<number> {
    const redis = getRedisClient();

    try {
      let pattern: string;
      if (widgetId) {
        pattern = `integration:${integrationId}:widget:${widgetId}:*`;
      } else {
        pattern = `integration:${integrationId}:*`;
      }

      // Use SCAN for production-safe key retrieval (avoids blocking)
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');

      if (keys.length > 0) {
        // Delete in batches to avoid blocking
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await redis.del(...batch);
        }
        logger.info('Cache invalidated', { integrationId, widgetId, keysDeleted: keys.length });
      }

      return keys.length;
    } catch (error) {
      logger.error('Cache invalidate error', { integrationId, widgetId, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Invalidate all caches for a workspace
   */
  async invalidateWorkspace(workspaceId: string): Promise<number> {
    const redis = getRedisClient();

    try {
      const pattern = `workspace:${workspaceId}:*`;

      // Use SCAN for production-safe key retrieval
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');

      if (keys.length > 0) {
        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await redis.del(...batch);
        }
      }
      return keys.length;
    } catch (error) {
      logger.error('Workspace cache invalidate error', { workspaceId, error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Warm cache by pre-fetching widget data
   */
  async warmCache(
    integrationId: string,
    widgetDataFetcher: (widgetId: string) => Promise<unknown>,
    widgetIds: string[]
  ): Promise<void> {
    logger.info('Warming cache', { integrationId, widgetCount: widgetIds.length });

    const results = await Promise.allSettled(
      widgetIds.map(async (widgetId) => {
        try {
          const data = await widgetDataFetcher(widgetId);
          await this.set(integrationId, widgetId, undefined, data);
          return { widgetId, success: true };
        } catch (error) {
          return { widgetId, success: false, error };
        }
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;

    logger.info('Cache warming complete', {
      integrationId,
      succeeded,
      failed: widgetIds.length - succeeded,
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: await this.getCacheSize(),
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    integrationId: string,
    widgetId: string,
    params: Record<string, unknown> | undefined,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(integrationId, widgetId, params);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fetcher();

    // Store in cache
    await this.set(integrationId, widgetId, params, data, ttl);

    return data;
  }

  /**
   * Check if data exists in cache
   */
  async exists(
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<boolean> {
    const key = this.generateCacheKey(integrationId, widgetId, params);
    const redis = getRedisClient();

    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Get TTL for cached data
   */
  async getTTL(
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<number> {
    const key = this.generateCacheKey(integrationId, widgetId, params);
    const redis = getRedisClient();

    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error('Cache getTTL error', { key, error: error instanceof Error ? error.message : String(error) });
      return -1;
    }
  }

  /**
   * Extend TTL for cached data
   */
  async extendTTL(
    integrationId: string,
    widgetId: string,
    params: Record<string, unknown> | undefined,
    additionalSeconds: number
  ): Promise<boolean> {
    const key = this.generateCacheKey(integrationId, widgetId, params);
    const redis = getRedisClient();

    try {
      const currentTTL = await redis.ttl(key);

      if (currentTTL > 0) {
        await redis.expire(key, currentTTL + additionalSeconds);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Cache extendTTL error', { key, error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Clear all integration caches
   */
  async clearAll(): Promise<void> {
    const redis = getRedisClient();

    try {
      const pattern = 'integration:*';

      // Use SCAN for production-safe key retrieval
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');

      if (keys.length > 0) {
        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await redis.del(...batch);
        }
      }
      this.stats = { hits: 0, misses: 0 };
      logger.info('All integration caches cleared', { keysDeleted: keys.length });
    } catch (error) {
      logger.error('Cache clearAll error', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // Private helper methods

  private generateCacheKey(
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>
  ): string {
    const paramsHash = params ? this.hashParams(params) : 'default';
    return `integration:${integrationId}:widget:${widgetId}:${paramsHash}`;
  }

  private hashParams(params: Record<string, unknown>): string {
    const sorted = JSON.stringify(params, Object.keys(params).sort());
    return createHash('md5').update(sorted).digest('hex').substring(0, 12);
  }

  private async storeMetadata(key: string, ttl: number): Promise<void> {
    const redis = getRedisClient();

    try {
      const metadataKey = `${key}:meta`;
      const metadata: CacheMetadata = {
        createdAt: Date.now(),
        expiresAt: Date.now() + ttl * 1000,
        hitCount: 0,
        lastAccessedAt: Date.now(),
      };
      await redis.set(metadataKey, JSON.stringify(metadata), 'EX', ttl);
    } catch (error) {
      logger.error('Cache storeMetadata error', { key, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async updateAccessMetadata(key: string): Promise<void> {
    const redis = getRedisClient();

    try {
      const metadataKey = `${key}:meta`;
      const metadataStr = await redis.get(metadataKey);
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr) as CacheMetadata;
        metadata.hitCount++;
        metadata.lastAccessedAt = Date.now();
        const ttl = await redis.ttl(metadataKey);
        if (ttl > 0) {
          await redis.set(metadataKey, JSON.stringify(metadata), 'EX', ttl);
        }
      }
    } catch (error) {
      logger.error('Cache updateAccessMetadata error', { key, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async getCacheSize(): Promise<number> {
    const redis = getRedisClient();

    try {
      const pattern = 'integration:*';

      // Use SCAN for production-safe key retrieval
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keys.push(...batch);
      } while (cursor !== '0');

      // Filter out metadata keys
      return keys.filter((k) => !k.endsWith(':meta')).length;
    } catch (error) {
      logger.error('Cache getCacheSize error', { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }
}

export const cacheService = new CacheService();
