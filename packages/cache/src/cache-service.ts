/**
 * @module @skillancer/cache/cache-service
 * High-level cache service with advanced features
 */

import type Redis from 'ioredis';

// ============================================================================
// TYPES
// ============================================================================

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Tags for cache invalidation */
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

/**
 * Advanced cache service with namespace support, tag-based invalidation,
 * and atomic operations.
 *
 * @example
 * ```typescript
 * import { CacheService } from '@skillancer/cache';
 * import { getRedisClient } from '@skillancer/cache';
 *
 * const cache = new CacheService(getRedisClient(), 'myapp');
 *
 * // Basic operations
 * await cache.set('user:123', { name: 'John' }, { ttl: 3600 });
 * const user = await cache.get<User>('user:123');
 *
 * // Cache-aside pattern
 * const data = await cache.getOrSet('expensive:query', async () => {
 *   return await fetchFromDatabase();
 * }, { ttl: 300, tags: ['users'] });
 *
 * // Tag-based invalidation
 * await cache.deleteByTag('users');
 * ```
 */
export class CacheService {
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly redis: Redis,
    private readonly namespace: string = 'skillancer'
  ) {}

  // ==========================================================================
  // BASIC OPERATIONS
  // ==========================================================================

  /**
   * Get a value from cache
   *
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const value = await this.redis.get(fullKey);

    if (value === null) {
      this.misses++;
      return null;
    }

    this.hits++;
    return this.deserialize<T>(value);
  }

  /**
   * Set a value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options (ttl, tags)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key);
    const serialized = this.serialize(value);

    if (options?.ttl) {
      await this.redis.setex(fullKey, options.ttl, serialized);
    } else {
      await this.redis.set(fullKey, serialized);
    }

    // Store tag associations
    if (options?.tags && options.tags.length > 0) {
      await this.addKeyToTags(fullKey, options.tags);
    }
  }

  /**
   * Delete a value from cache
   *
   * @param key - Cache key
   * @returns true if key was deleted
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const result = await this.redis.del(fullKey);
    return result > 0;
  }

  /**
   * Check if a key exists in cache
   *
   * @param key - Cache key
   * @returns true if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const result = await this.redis.exists(fullKey);
    return result > 0;
  }

  /**
   * Get time-to-live for a key
   *
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if not found
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.buildKey(key);
    return this.redis.ttl(fullKey);
  }

  /**
   * Set expiration on an existing key
   *
   * @param key - Cache key
   * @param seconds - TTL in seconds
   * @returns true if timeout was set
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const result = await this.redis.expire(fullKey, seconds);
    return result === 1;
  }

  // ==========================================================================
  // PATTERN OPERATIONS
  // ==========================================================================

  /**
   * Delete all keys matching a pattern
   *
   * @param pattern - Glob-style pattern (e.g., 'user:*')
   * @returns Number of keys deleted
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern);
    const keys = await this.scanKeys(fullPattern);

    if (keys.length === 0) return 0;

    return this.redis.del(...keys);
  }

  /**
   * Get all keys matching a pattern
   *
   * @param pattern - Glob-style pattern
   * @returns Array of matching keys (without namespace prefix)
   */
  async keys(pattern: string): Promise<string[]> {
    const fullPattern = this.buildKey(pattern);
    const keys = await this.scanKeys(fullPattern);
    const prefix = `${this.namespace}:`;
    return keys.map((k) => k.replace(prefix, ''));
  }

  /**
   * Scan keys matching a pattern (memory-efficient)
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  // ==========================================================================
  // TAG-BASED INVALIDATION
  // ==========================================================================

  /**
   * Delete all keys associated with a tag
   *
   * @param tag - Tag name
   * @returns Number of keys deleted
   */
  async deleteByTag(tag: string): Promise<number> {
    const tagKey = this.buildTagKey(tag);
    const members = await this.redis.smembers(tagKey);

    if (members.length === 0) return 0;

    // Delete all tagged keys and the tag set
    const pipeline = this.redis.pipeline();
    for (const member of members) {
      pipeline.del(member);
    }
    pipeline.del(tagKey);
    await pipeline.exec();

    return members.length;
  }

  /**
   * Get all keys associated with a tag
   *
   * @param tag - Tag name
   * @returns Array of keys
   */
  async getKeysByTag(tag: string): Promise<string[]> {
    const tagKey = this.buildTagKey(tag);
    return this.redis.smembers(tagKey);
  }

  /**
   * Add a key to multiple tags
   */
  private async addKeyToTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const tag of tags) {
      const tagKey = this.buildTagKey(tag);
      pipeline.sadd(tagKey, key);
    }
    await pipeline.exec();
  }

  // ==========================================================================
  // ATOMIC OPERATIONS
  // ==========================================================================

  /**
   * Increment a numeric value
   *
   * @param key - Cache key
   * @param delta - Amount to increment (default: 1)
   * @returns New value after increment
   */
  async increment(key: string, delta: number = 1): Promise<number> {
    const fullKey = this.buildKey(key);
    if (delta === 1) {
      return this.redis.incr(fullKey);
    }
    return this.redis.incrby(fullKey, delta);
  }

  /**
   * Decrement a numeric value
   *
   * @param key - Cache key
   * @param delta - Amount to decrement (default: 1)
   * @returns New value after decrement
   */
  async decrement(key: string, delta: number = 1): Promise<number> {
    const fullKey = this.buildKey(key);
    if (delta === 1) {
      return this.redis.decr(fullKey);
    }
    return this.redis.decrby(fullKey, delta);
  }

  /**
   * Increment a floating point value
   *
   * @param key - Cache key
   * @param delta - Amount to increment
   * @returns New value after increment
   */
  async incrementFloat(key: string, delta: number): Promise<number> {
    const fullKey = this.buildKey(key);
    const result = await this.redis.incrbyfloat(fullKey, delta);
    return parseFloat(result);
  }

  // ==========================================================================
  // HASH OPERATIONS
  // ==========================================================================

  /**
   * Get a field from a hash
   *
   * @param key - Hash key
   * @param field - Field name
   * @returns Field value or null
   */
  async hget<T>(key: string, field: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const value = await this.redis.hget(fullKey, field);
    if (value === null) return null;
    return this.deserialize<T>(value);
  }

  /**
   * Set a field in a hash
   *
   * @param key - Hash key
   * @param field - Field name
   * @param value - Field value
   */
  async hset<T>(key: string, field: string, value: T): Promise<void> {
    const fullKey = this.buildKey(key);
    await this.redis.hset(fullKey, field, this.serialize(value));
  }

  /**
   * Get all fields from a hash
   *
   * @param key - Hash key
   * @returns Object with all fields
   */
  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const fullKey = this.buildKey(key);
    const result = await this.redis.hgetall(fullKey);

    const parsed: Record<string, T> = {};
    for (const [field, value] of Object.entries(result)) {
      parsed[field] = this.deserialize<T>(value);
    }
    return parsed;
  }

  /**
   * Delete a field from a hash
   *
   * @param key - Hash key
   * @param field - Field name
   * @returns true if field was deleted
   */
  async hdel(key: string, field: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const result = await this.redis.hdel(fullKey, field);
    return result > 0;
  }

  /**
   * Check if a field exists in a hash
   *
   * @param key - Hash key
   * @param field - Field name
   * @returns true if field exists
   */
  async hexists(key: string, field: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const result = await this.redis.hexists(fullKey, field);
    return result === 1;
  }

  // ==========================================================================
  // LIST OPERATIONS
  // ==========================================================================

  /**
   * Push value to the end of a list
   */
  async lpush<T>(key: string, value: T): Promise<number> {
    const fullKey = this.buildKey(key);
    return this.redis.lpush(fullKey, this.serialize(value));
  }

  /**
   * Push value to the beginning of a list
   */
  async rpush<T>(key: string, value: T): Promise<number> {
    const fullKey = this.buildKey(key);
    return this.redis.rpush(fullKey, this.serialize(value));
  }

  /**
   * Get a range of elements from a list
   */
  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const fullKey = this.buildKey(key);
    const values = await this.redis.lrange(fullKey, start, stop);
    return values.map((v) => this.deserialize<T>(v));
  }

  /**
   * Get the length of a list
   */
  async llen(key: string): Promise<number> {
    const fullKey = this.buildKey(key);
    return this.redis.llen(fullKey);
  }

  // ==========================================================================
  // SET OPERATIONS
  // ==========================================================================

  /**
   * Add members to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    const fullKey = this.buildKey(key);
    return this.redis.sadd(fullKey, ...members);
  }

  /**
   * Remove members from a set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    const fullKey = this.buildKey(key);
    return this.redis.srem(fullKey, ...members);
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    const fullKey = this.buildKey(key);
    return this.redis.smembers(fullKey);
  }

  /**
   * Check if a member exists in a set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const result = await this.redis.sismember(fullKey, member);
    return result === 1;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get or set pattern (cache-aside)
   *
   * If the key exists, returns the cached value.
   * If not, calls the factory function, caches the result, and returns it.
   *
   * @param key - Cache key
   * @param factory - Function to generate value if not cached
   * @param options - Cache options
   * @returns Cached or newly generated value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Get multiple values at once
   *
   * @param keys - Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    const fullKeys = keys.map((k) => this.buildKey(k));
    const values = await this.redis.mget(...fullKeys);

    return values.map((v) => (v === null ? null : this.deserialize<T>(v)));
  }

  /**
   * Set multiple values at once
   *
   * @param entries - Object with key-value pairs
   * @param options - Cache options (ttl applies to all keys)
   */
  async mset<T>(
    entries: Record<string, T>,
    options?: CacheOptions
  ): Promise<void> {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(entries)) {
      pairs.push(this.buildKey(key), this.serialize(value));
    }

    if (options?.ttl) {
      // Use pipeline for TTL
      const pipeline = this.redis.pipeline();
      for (const [key, value] of Object.entries(entries)) {
        pipeline.setex(this.buildKey(key), options.ttl, this.serialize(value));
      }
      await pipeline.exec();
    } else {
      await this.redis.mset(...pairs);
    }
  }

  /**
   * Flush all keys in the current namespace
   *
   * ⚠️ Use with caution!
   */
  async flush(): Promise<number> {
    return this.deletePattern('*');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Build a namespaced cache key
   */
  private buildKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Build a tag key
   */
  private buildTagKey(tag: string): string {
    return `${this.namespace}:_tags:${tag}`;
  }

  /**
   * Serialize a value for storage
   */
  private serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize a stored value
   */
  private deserialize<T>(value: string): T {
    return JSON.parse(value) as T;
  }
}
