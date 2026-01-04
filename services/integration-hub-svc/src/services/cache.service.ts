// @ts-nocheck
/**
 * Integration Cache Service
 *
 * Caching layer for integration data with TTL management
 */

import { createHash } from 'crypto';
import { logger } from '@skillancer/logger';

// Stub redis client - TODO: Replace with actual cache package
const redis = {
  get: async (key: string) => null,
  set: async (key: string, value: string, mode?: string, ttl?: number) => 'OK',
  del: async (...keys: string[]) => 1,
  exists: async (key: string) => 0,
  keys: async (pattern: string) => [] as string[],
  expire: async (key: string, ttl: number) => 1,
  sadd: async (key: string, ...members: string[]) => 1,
  smembers: async (key: string) => [] as string[],
  hset: async (key: string, field: string, value: string) => 1,
  hget: async (key: string, field: string) => null as string | null,
  hgetall: async (key: string) => ({}) as Record<string, string>,
};

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
      logger.error('Cache get error', { key, error });
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

    try {
      const serialized = JSON.stringify(data);
      await redis.set(key, serialized, 'EX', effectiveTTL);

      // Store metadata
      await this.storeMetadata(key, effectiveTTL);

      logger.debug('Cache set', { key, integrationId, widgetId, ttl: effectiveTTL });
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  /**
   * Invalidate cache for a widget
   */
  async invalidate(integrationId: string, widgetId?: string): Promise<number> {
    try {
      let pattern: string;
      if (widgetId) {
        pattern = `integration:${integrationId}:widget:${widgetId}:*`;
      } else {
        pattern = `integration:${integrationId}:*`;
      }

      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info('Cache invalidated', { integrationId, widgetId, keysDeleted: keys.length });
      }

      return keys.length;
    } catch (error) {
      logger.error('Cache invalidate error', { integrationId, widgetId, error });
      return 0;
    }
  }

  /**
   * Invalidate all caches for a workspace
   */
  async invalidateWorkspace(workspaceId: string): Promise<number> {
    try {
      const pattern = `workspace:${workspaceId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      logger.error('Workspace cache invalidate error', { workspaceId, error });
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
    const result = await redis.exists(key);
    return result === 1;
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
    return redis.ttl(key);
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
    const currentTTL = await redis.ttl(key);

    if (currentTTL > 0) {
      await redis.expire(key, currentTTL + additionalSeconds);
      return true;
    }

    return false;
  }

  /**
   * Clear all integration caches
   */
  async clearAll(): Promise<void> {
    const pattern = 'integration:*';
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    this.stats = { hits: 0, misses: 0 };
    logger.info('All integration caches cleared', { keysDeleted: keys.length });
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
    const metadataKey = `${key}:meta`;
    const metadata: CacheMetadata = {
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl * 1000,
      hitCount: 0,
      lastAccessedAt: Date.now(),
    };
    await redis.set(metadataKey, JSON.stringify(metadata), 'EX', ttl);
  }

  private async updateAccessMetadata(key: string): Promise<void> {
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
  }

  private async getCacheSize(): Promise<number> {
    const pattern = 'integration:*';
    const keys = await redis.keys(pattern);
    // Filter out metadata keys
    return keys.filter((k) => !k.endsWith(':meta')).length;
  }
}

export const cacheService = new CacheService();
