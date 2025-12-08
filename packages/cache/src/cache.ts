import { getRedisClient } from './client';

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
}

/**
 * Get value from cache
 */
export async function get<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  const value = await redis.get(key);
  if (!value) return null;
  return JSON.parse(value) as T;
}

/**
 * Set value in cache
 */
export async function set<T>(
  key: string,
  value: T,
  options?: CacheOptions
): Promise<void> {
  const redis = getRedisClient();
  const serialized = JSON.stringify(value);

  if (options?.ttl) {
    await redis.setex(key, options.ttl, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

/**
 * Delete value from cache
 */
export async function del(key: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(key);
}

/**
 * Get or set value in cache (cache-aside pattern)
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  const cached = await get<T>(key);
  if (cached !== null) return cached;

  const value = await fetcher();
  await set(key, value, options);
  return value;
}

/**
 * Create a namespaced cache key
 */
export function createCacheKey(...parts: string[]): string {
  return parts.join(':');
}

/**
 * Invalidate all keys matching a pattern
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  const redis = getRedisClient();
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
