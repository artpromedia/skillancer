/**
 * @module @skillancer/cache/decorators
 * TypeScript decorators for caching
 */

import type { CacheService, CacheOptions } from './cache-service';

// ============================================================================
// TYPES
// ============================================================================

export type KeyGenerator = (...args: unknown[]) => string;

export interface CacheableOptions {
  /** Cache key or function to generate key from method arguments */
  key: string | KeyGenerator;
  /** Time to live in seconds */
  ttl?: number;
  /** Tags for cache invalidation */
  tags?: string[];
  /** Condition function - only cache if returns true */
  condition?: (...args: unknown[]) => boolean;
  /** Unless function - don't cache if returns true */
  unless?: (result: unknown) => boolean;
}

export interface CacheEvictOptions {
  /** Cache key or function to generate key from method arguments */
  key?: string | KeyGenerator;
  /** Tags to evict */
  tags?: string[];
  /** Evict all entries in the cache */
  allEntries?: boolean;
  /** Evict before method execution (default: after) */
  beforeInvocation?: boolean;
}

export interface CachePutOptions {
  /** Cache key or function to generate key from method arguments */
  key: string | KeyGenerator;
  /** Time to live in seconds */
  ttl?: number;
  /** Tags for cache invalidation */
  tags?: string[];
}

// ============================================================================
// CACHE INSTANCE MANAGEMENT
// ============================================================================

let defaultCacheService: CacheService | null = null;

/**
 * Set the default cache service for decorators
 *
 * @param cache - CacheService instance to use
 *
 * @example
 * ```typescript
 * import { setDefaultCacheService, CacheService } from '@skillancer/cache';
 * import { getRedisClient } from '@skillancer/cache';
 *
 * const cache = new CacheService(getRedisClient(), 'myapp');
 * setDefaultCacheService(cache);
 * ```
 */
export function setDefaultCacheService(cache: CacheService): void {
  defaultCacheService = cache;
}

/**
 * Get the default cache service
 */
export function getDefaultCacheService(): CacheService | null {
  return defaultCacheService;
}

/**
 * Ensure cache service is available
 */
function requireCacheService(): CacheService {
  if (!defaultCacheService) {
    throw new Error(
      'Cache service not initialized. Call setDefaultCacheService() first.'
    );
  }
  return defaultCacheService;
}

// ============================================================================
// DECORATORS
// ============================================================================

/**
 * Method decorator for caching method results
 *
 * Caches the return value of the method. If the value exists in cache,
 * returns it directly without calling the method.
 *
 * @param options - Caching options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class UserService {
 *   @Cacheable({
 *     key: (id: string) => `user:${id}`,
 *     ttl: 3600,
 *     tags: ['users']
 *   })
 *   async getUser(id: string): Promise<User> {
 *     return this.userRepository.findById(id);
 *   }
 *
 *   @Cacheable({
 *     key: 'users:all',
 *     ttl: 300,
 *     condition: (includeInactive) => !includeInactive
 *   })
 *   async getAllUsers(includeInactive = false): Promise<User[]> {
 *     return this.userRepository.findAll({ includeInactive });
 *   }
 * }
 * ```
 */
export function Cacheable(options: CacheableOptions): MethodDecorator {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = requireCacheService();

      // Check condition
      if (options.condition && !options.condition(...args)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return originalMethod.apply(this, args);
      }

      // Generate cache key
      const key = resolveKey(options.key, args);

      // Try to get from cache
      const cached = await cache.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await originalMethod.apply(this, args);

      // Check unless condition
      if (options.unless && options.unless(result)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result;
      }

      // Store in cache
      const cacheOptions: CacheOptions = {};
      if (options.ttl !== undefined) {
        cacheOptions.ttl = options.ttl;
      }
      if (options.tags !== undefined) {
        cacheOptions.tags = options.tags;
      }
      await cache.set(key, result, cacheOptions);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    };

    return descriptor;
  };
}

/**
 * Method decorator for cache eviction
 *
 * Evicts cache entries when the method is called.
 * Can evict by key, tags, or all entries.
 *
 * @param options - Eviction options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class UserService {
 *   @CacheEvict({
 *     key: (id: string) => `user:${id}`,
 *     tags: ['users']
 *   })
 *   async updateUser(id: string, data: UpdateUserDto): Promise<User> {
 *     return this.userRepository.update(id, data);
 *   }
 *
 *   @CacheEvict({
 *     tags: ['users'],
 *     allEntries: true
 *   })
 *   async importUsers(data: ImportData): Promise<void> {
 *     await this.userRepository.bulkImport(data);
 *   }
 * }
 * ```
 */
export function CacheEvict(options: CacheEvictOptions): MethodDecorator {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = requireCacheService();

      // Evict before invocation
      if (options.beforeInvocation) {
        await performEviction(cache, options, args);
      }

      // Execute method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await originalMethod.apply(this, args);

      // Evict after invocation (default)
      if (!options.beforeInvocation) {
        await performEviction(cache, options, args);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    };

    return descriptor;
  };
}

/**
 * Method decorator that always updates the cache
 *
 * Unlike @Cacheable, this always executes the method and updates the cache.
 * Useful for methods that should always refresh the cached value.
 *
 * @param options - Cache put options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class UserService {
 *   @CachePut({
 *     key: (id: string) => `user:${id}`,
 *     ttl: 3600
 *   })
 *   async refreshUser(id: string): Promise<User> {
 *     return this.userRepository.findById(id);
 *   }
 * }
 * ```
 */
export function CachePut(options: CachePutOptions): MethodDecorator {
  return function (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = requireCacheService();

      // Execute method
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await originalMethod.apply(this, args);

      // Generate cache key
      const key = resolveKey(options.key, args);

      // Store in cache
      const cacheOptions: CacheOptions = {};
      if (options.ttl !== undefined) {
        cacheOptions.ttl = options.ttl;
      }
      if (options.tags !== undefined) {
        cacheOptions.tags = options.tags;
      }
      await cache.set(key, result, cacheOptions);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return result;
    };

    return descriptor;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve cache key from string or generator function
 */
function resolveKey(key: string | KeyGenerator, args: unknown[]): string {
  if (typeof key === 'function') {
    return key(...args);
  }
  return key;
}

/**
 * Perform cache eviction based on options
 */
async function performEviction(
  cache: CacheService,
  options: CacheEvictOptions,
  args: unknown[]
): Promise<void> {
  // Evict all entries
  if (options.allEntries) {
    await cache.flush();
    return;
  }

  // Evict by tags
  if (options.tags && options.tags.length > 0) {
    for (const tag of options.tags) {
      await cache.deleteByTag(tag);
    }
  }

  // Evict by key
  if (options.key) {
    const key = resolveKey(options.key, args);
    await cache.delete(key);
  }
}

// ============================================================================
// FUNCTIONAL ALTERNATIVES
// ============================================================================

/**
 * Wrap a function with caching (functional alternative to @Cacheable)
 *
 * @param fn - Function to wrap
 * @param options - Caching options
 * @returns Wrapped function with caching
 *
 * @example
 * ```typescript
 * const getUser = withCache(
 *   async (id: string) => userRepository.findById(id),
 *   {
 *     key: (id) => `user:${id}`,
 *     ttl: 3600
 *   }
 * );
 *
 * const user = await getUser('123');
 * ```
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: CacheableOptions
): T {
  const wrapped = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const cache = requireCacheService();

    // Check condition
    if (options.condition && !options.condition(...args)) {
      return fn(...args) as ReturnType<T>;
    }

    // Generate cache key
    const key = resolveKey(options.key, args);

    // Try to get from cache
    const cached = await cache.get<ReturnType<T>>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn(...args);

    // Check unless condition
    if (options.unless && options.unless(result)) {
      return result as ReturnType<T>;
    }

    // Store in cache
    const cacheOptions: CacheOptions = {};
    if (options.ttl !== undefined) {
      cacheOptions.ttl = options.ttl;
    }
    if (options.tags !== undefined) {
      cacheOptions.tags = options.tags;
    }
    await cache.set(key, result, cacheOptions);

    return result as ReturnType<T>;
  };

  return wrapped as T;
}

/**
 * Create a cached version of an async function with automatic key generation
 *
 * @param namespace - Cache namespace
 * @param fn - Function to wrap
 * @param options - Caching options (without key)
 * @returns Wrapped function with caching
 *
 * @example
 * ```typescript
 * const cachedFetch = createCachedFunction(
 *   'api',
 *   async (url: string) => fetch(url).then(r => r.json()),
 *   { ttl: 300 }
 * );
 *
 * const data = await cachedFetch('https://api.example.com/data');
 * ```
 */
export function createCachedFunction<
  T extends (...args: unknown[]) => Promise<unknown>
>(
  namespace: string,
  fn: T,
  options: Omit<CacheableOptions, 'key'>
): T {
  return withCache(fn, {
    ...options,
    key: (...args) => {
      const argsKey = args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(':');
      return `${namespace}:${argsKey}`;
    },
  });
}
