// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/cache/smart-cache
 * Smart Cache Service
 *
 * Intelligent caching with:
 * - Widget-level caching
 * - Stale-while-revalidate
 * - Request deduplication
 * - Cache warming
 */

import { createClient, type RedisClientType } from 'redis';
import crypto from 'crypto';
import { logger } from '@skillancer/logger';

export interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  staleAt: number;
  metadata?: Record<string, unknown>;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  staleTime?: number; // Time before stale in seconds
  tags?: string[]; // Tags for grouped invalidation
}

type InFlightRequest = Promise<unknown>;

export class SmartCacheService {
  private redis: RedisClientType | null = null;
  private inFlightRequests: Map<string, InFlightRequest> = new Map();
  private localCache: Map<string, CacheEntry> = new Map();

  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly DEFAULT_STALE_TIME = 60; // 1 minute before stale
  private readonly LOCAL_CACHE_MAX_SIZE = 1000;

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (process.env.REDIS_URL) {
      this.redis = createClient({ url: process.env.REDIS_URL });
      await this.redis.connect();
      logger.info('Smart cache connected to Redis');
    } else {
      logger.info('Smart cache using in-memory storage');
    }
  }

  // ==================== Widget Caching ====================

  /**
   * Get widget data from cache
   */
  async getWidget<T>(
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<{ data: T; isStale: boolean } | null> {
    const key = this.buildWidgetKey(integrationId, widgetId, params);
    return this.get<T>(key);
  }

  /**
   * Set widget data in cache
   */
  async setWidget<T>(
    integrationId: string,
    widgetId: string,
    data: T,
    params?: Record<string, unknown>,
    options?: CacheOptions
  ): Promise<void> {
    const key = this.buildWidgetKey(integrationId, widgetId, params);
    const tags = [`integration:${integrationId}`, `widget:${widgetId}`, ...(options?.tags || [])];
    await this.set(key, data, { ...options, tags });
  }

  /**
   * Invalidate widget cache
   */
  async invalidateWidget(integrationId: string, widgetId: string): Promise<void> {
    const pattern = `widget:${integrationId}:${widgetId}:*`;
    await this.invalidateByPattern(pattern);
  }

  /**
   * Invalidate all caches for integration
   */
  async invalidateIntegration(integrationId: string): Promise<void> {
    await this.invalidateByTag(`integration:${integrationId}`);
  }

  // ==================== Request Deduplication ====================

  /**
   * Get or fetch with deduplication
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached && !cached.isStale) {
      return cached.data;
    }

    // Check for in-flight request
    const inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      logger.debug('Deduplicating request', { key });
      return inFlight as Promise<T>;
    }

    // If stale, return stale data and refresh in background
    if (cached?.isStale) {
      this.refreshInBackground(key, fetcher, options);
      return cached.data;
    }

    // Fetch new data
    const fetchPromise = this.fetchAndCache(key, fetcher, options);
    this.inFlightRequests.set(key, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlightRequests.delete(key);
    }
  }

  /**
   * Fetch and cache data
   */
  private async fetchAndCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Refresh cache in background
   */
  private refreshInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): void {
    // Don't duplicate background refresh
    if (this.inFlightRequests.has(key)) return;

    const refreshPromise = this.fetchAndCache(key, fetcher, options);
    this.inFlightRequests.set(key, refreshPromise);

    refreshPromise
      .then(() => logger.debug('Background refresh complete', { key }))
      .catch((error) => logger.warn('Background refresh failed', { key, error }))
      .finally(() => this.inFlightRequests.delete(key));
  }

  // ==================== Cache Warming ====================

  /**
   * Warm cache for integration
   */
  async warmIntegrationCache(
    integrationId: string,
    widgetIds: string[],
    fetcher: (widgetId: string) => Promise<unknown>
  ): Promise<void> {
    logger.info('Warming cache for integration', { integrationId, widgets: widgetIds.length });

    const promises = widgetIds.map(async (widgetId) => {
      const key = this.buildWidgetKey(integrationId, widgetId);
      try {
        const data = await fetcher(widgetId);
        await this.set(key, data, { tags: [`integration:${integrationId}`] });
      } catch (error) {
        logger.warn('Failed to warm cache for widget', { widgetId, error });
      }
    });

    await Promise.all(promises);
    logger.info('Cache warming complete', { integrationId });
  }

  /**
   * Warm cache for workspace
   */
  async warmWorkspaceCache(
    workspaceId: string,
    integrations: Array<{ id: string; widgetIds: string[] }>,
    fetcher: (integrationId: string, widgetId: string) => Promise<unknown>
  ): Promise<void> {
    for (const integration of integrations) {
      await this.warmIntegrationCache(integration.id, integration.widgetIds, (widgetId) =>
        fetcher(integration.id, widgetId)
      );
    }
  }

  // ==================== Core Methods ====================

  /**
   * Get from cache
   */
  async get<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
    try {
      let entry: CacheEntry<T> | null = null;

      if (this.redis) {
        const raw = await this.redis.get(key);
        if (raw) {
          entry = JSON.parse(raw) as CacheEntry<T>;
        }
      } else {
        entry = (this.localCache.get(key) as CacheEntry<T> | undefined) || null;
      }

      if (!entry) return null;

      const now = Date.now();

      // Check if expired
      if (now > entry.expiresAt) {
        await this.delete(key);
        return null;
      }

      // Check if stale
      const isStale = now > entry.staleAt;

      return { data: entry.data, isStale };
    } catch (error) {
      logger.warn('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set in cache
   */
  async set<T>(key: string, data: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.DEFAULT_TTL;
      const staleTime = options?.staleTime || this.DEFAULT_STALE_TIME;
      const now = Date.now();

      const entry: CacheEntry<T> = {
        data,
        cachedAt: now,
        expiresAt: now + ttl * 1000,
        staleAt: now + staleTime * 1000,
        metadata: { tags: options?.tags },
      };

      if (this.redis) {
        await this.redis.setEx(key, ttl, JSON.stringify(entry));

        // Store tags for invalidation
        if (options?.tags) {
          for (const tag of options.tags) {
            await this.redis.sAdd(`tag:${tag}`, key);
          }
        }
      } else {
        this.localCache.set(key, entry);
        this.pruneLocalCache();
      }
    } catch (error) {
      logger.warn('Cache set error', { key, error });
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
    } else {
      this.localCache.delete(key);
    }
  }

  /**
   * Invalidate by pattern
   */
  async invalidateByPattern(pattern: string): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } else {
      const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
      for (const key of this.localCache.keys()) {
        if (regex.test(key)) {
          this.localCache.delete(key);
        }
      }
    }
  }

  /**
   * Invalidate by tag
   */
  async invalidateByTag(tag: string): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.sMembers(`tag:${tag}`);
      if (keys.length > 0) {
        await this.redis.del(keys);
        await this.redis.del(`tag:${tag}`);
      }
    } else {
      for (const [key, entry] of this.localCache.entries()) {
        const tags = entry.metadata?.tags as string[] | undefined;
        if (tags?.includes(tag)) {
          this.localCache.delete(key);
        }
      }
    }
  }

  // ==================== Helpers ====================

  private buildWidgetKey(
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>
  ): string {
    const paramsHash = params
      ? crypto.createHash('md5').update(JSON.stringify(params)).digest('hex').slice(0, 8)
      : 'default';
    return `widget:${integrationId}:${widgetId}:${paramsHash}`;
  }

  private pruneLocalCache(): void {
    if (this.localCache.size > this.LOCAL_CACHE_MAX_SIZE) {
      const entriesToDelete = this.localCache.size - this.LOCAL_CACHE_MAX_SIZE + 100;
      const keys = Array.from(this.localCache.keys()).slice(0, entriesToDelete);
      keys.forEach((key) => this.localCache.delete(key));
    }
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{ size: number; hitRate?: number }> {
    const size = this.redis ? await this.redis.dbSize() : this.localCache.size;
    return { size };
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// Singleton instance
export const smartCache = new SmartCacheService();
