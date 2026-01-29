/**
 * @module @skillancer/cache/repository-cache
 * Repository-level caching layer for common data patterns
 *
 * Features:
 * - Entity caching with automatic invalidation
 * - List caching with pagination support
 * - Cache-aside pattern implementation
 * - Batch caching for performance
 *
 * @example
 * ```typescript
 * import { createRepositoryCache } from '@skillancer/cache';
 *
 * const userCache = createRepositoryCache<User>({
 *   namespace: 'users',
 *   ttl: 300,
 *   redis: redisClient,
 * });
 *
 * // Get or fetch user
 * const user = await userCache.getOrFetch('user123', () => db.user.findUnique({ where: { id: 'user123' } }));
 *
 * // Invalidate on update
 * await userCache.invalidate('user123');
 * ```
 */

import type Redis from 'ioredis';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface RepositoryCacheConfig {
  /** Redis client instance */
  redis: Redis;
  /** Cache namespace */
  namespace: string;
  /** Default TTL in seconds */
  ttl: number;
  /** Enable compression for large objects */
  enableCompression?: boolean;
  /** Compression threshold in bytes */
  compressionThreshold?: number;
  /** Serialize function */
  serialize?: (value: unknown) => string;
  /** Deserialize function */
  deserialize?: <T>(value: string) => T;
}

export interface ListCacheOptions {
  /** Page number */
  page?: number;
  /** Page size */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Filter hash for cache key */
  filterHash?: string;
}

export interface CachedList<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  cachedAt: Date;
}

// =============================================================================
// REPOSITORY CACHE
// =============================================================================

export class RepositoryCache<T> {
  private redis: Redis;
  private namespace: string;
  private ttl: number;
  private serialize: (value: unknown) => string;
  private deserialize: <V>(value: string) => V;

  constructor(config: RepositoryCacheConfig) {
    this.redis = config.redis;
    this.namespace = config.namespace;
    this.ttl = config.ttl;
    this.serialize = config.serialize ?? JSON.stringify;
    this.deserialize = config.deserialize ?? JSON.parse;
  }

  // ===========================================================================
  // KEY BUILDERS
  // ===========================================================================

  private entityKey(id: string): string {
    return `${this.namespace}:entity:${id}`;
  }

  private listKey(options: ListCacheOptions): string {
    const parts = [
      this.namespace,
      'list',
      options.page ?? 1,
      options.pageSize ?? 20,
      options.sortBy ?? 'default',
      options.sortOrder ?? 'asc',
      options.filterHash ?? 'none',
    ];
    return parts.join(':');
  }

  private patternKey(pattern: string): string {
    return `${this.namespace}:${pattern}`;
  }

  // ===========================================================================
  // ENTITY OPERATIONS
  // ===========================================================================

  /**
   * Get entity from cache
   */
  async get(id: string): Promise<T | null> {
    const key = this.entityKey(id);
    const cached = await this.redis.get(key);

    if (!cached) return null;

    try {
      return this.deserialize<T>(cached);
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  /**
   * Set entity in cache
   */
  async set(id: string, value: T, ttl?: number): Promise<void> {
    const key = this.entityKey(id);
    const serialized = this.serialize(value);
    await this.redis.setex(key, ttl ?? this.ttl, serialized);
  }

  /**
   * Get or fetch entity (cache-aside pattern)
   */
  async getOrFetch(id: string, fetcher: () => Promise<T | null>, ttl?: number): Promise<T | null> {
    // Try cache first
    const cached = await this.get(id);
    if (cached !== null) return cached;

    // Fetch from source
    const value = await fetcher();
    if (value === null) return null;

    // Cache the result
    await this.set(id, value, ttl);
    return value;
  }

  /**
   * Invalidate entity cache
   */
  async invalidate(id: string): Promise<void> {
    const key = this.entityKey(id);
    await this.redis.del(key);
  }

  /**
   * Batch get entities
   */
  async getMany(ids: string[]): Promise<Map<string, T>> {
    if (ids.length === 0) return new Map();

    const keys = ids.map((id) => this.entityKey(id));
    const values = await this.redis.mget(...keys);

    const result = new Map<string, T>();
    for (let i = 0; i < ids.length; i++) {
      const value = values[i];
      if (value) {
        try {
          result.set(ids[i], this.deserialize<T>(value));
        } catch {
          // Skip invalid entries
        }
      }
    }

    return result;
  }

  /**
   * Batch set entities
   */
  async setMany(items: Map<string, T>, ttl?: number): Promise<void> {
    if (items.size === 0) return;

    const pipeline = this.redis.pipeline();
    const effectiveTtl = ttl ?? this.ttl;

    for (const [id, value] of items) {
      const key = this.entityKey(id);
      const serialized = this.serialize(value);
      pipeline.setex(key, effectiveTtl, serialized);
    }

    await pipeline.exec();
  }

  /**
   * Get or fetch many entities with batching
   */
  async getOrFetchMany(
    ids: string[],
    fetcher: (missingIds: string[]) => Promise<Map<string, T>>,
    ttl?: number
  ): Promise<Map<string, T>> {
    // Get cached items
    const cached = await this.getMany(ids);

    // Find missing IDs
    const missingIds = ids.filter((id) => !cached.has(id));

    if (missingIds.length === 0) {
      return cached;
    }

    // Fetch missing items
    const fetched = await fetcher(missingIds);

    // Cache fetched items
    await this.setMany(fetched, ttl);

    // Merge results
    for (const [id, value] of fetched) {
      cached.set(id, value);
    }

    return cached;
  }

  // ===========================================================================
  // LIST OPERATIONS
  // ===========================================================================

  /**
   * Get list from cache
   */
  async getList(options: ListCacheOptions = {}): Promise<CachedList<T> | null> {
    const key = this.listKey(options);
    const cached = await this.redis.get(key);

    if (!cached) return null;

    try {
      return this.deserialize<CachedList<T>>(cached);
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  /**
   * Set list in cache
   */
  async setList(
    items: T[],
    total: number,
    options: ListCacheOptions = {},
    ttl?: number
  ): Promise<void> {
    const key = this.listKey(options);
    const cached: CachedList<T> = {
      items,
      total,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 20,
      cachedAt: new Date(),
    };

    await this.redis.setex(key, ttl ?? this.ttl, this.serialize(cached));
  }

  /**
   * Get or fetch list
   */
  async getOrFetchList(
    options: ListCacheOptions,
    fetcher: () => Promise<{ items: T[]; total: number }>,
    ttl?: number
  ): Promise<CachedList<T>> {
    const cached = await this.getList(options);
    if (cached) return cached;

    const { items, total } = await fetcher();
    await this.setList(items, total, options, ttl);

    return {
      items,
      total,
      page: options.page ?? 1,
      pageSize: options.pageSize ?? 20,
      cachedAt: new Date(),
    };
  }

  /**
   * Invalidate all list caches
   */
  async invalidateLists(): Promise<void> {
    const pattern = `${this.namespace}:list:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ===========================================================================
  // BULK OPERATIONS
  // ===========================================================================

  /**
   * Invalidate all caches for this namespace
   */
  async invalidateAll(): Promise<void> {
    const pattern = `${this.namespace}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    entityCount: number;
    listCount: number;
    memoryUsage: number;
  }> {
    const entityPattern = `${this.namespace}:entity:*`;
    const listPattern = `${this.namespace}:list:*`;

    const [entityKeys, listKeys] = await Promise.all([
      this.redis.keys(entityPattern),
      this.redis.keys(listPattern),
    ]);

    // Get memory usage (approximate)
    let memoryUsage = 0;
    const allKeys = [...entityKeys, ...listKeys];
    if (allKeys.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const key of allKeys.slice(0, 100)) {
        pipeline.memory('USAGE', key);
      }
      const results = await pipeline.exec();
      if (results) {
        for (const [, usage] of results) {
          if (typeof usage === 'number') {
            memoryUsage += usage;
          }
        }
      }
    }

    return {
      entityCount: entityKeys.length,
      listCount: listKeys.length,
      memoryUsage,
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a repository cache instance
 */
export function createRepositoryCache<T>(config: RepositoryCacheConfig): RepositoryCache<T> {
  return new RepositoryCache<T>(config);
}

// =============================================================================
// CACHE KEY HELPERS
// =============================================================================

/**
 * Generate a hash from filter object for cache key
 */
export function hashFilters(filters: Record<string, unknown>): string {
  const sorted = JSON.stringify(
    Object.keys(filters)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: filters[key] }), {})
  );
  return crypto.createHash('md5').update(sorted).digest('hex').substring(0, 8);
}

/**
 * Create a compound cache key
 */
export function compoundKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

export default {
  RepositoryCache,
  createRepositoryCache,
  hashFilters,
  compoundKey,
};
