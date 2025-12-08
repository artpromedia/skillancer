/**
 * @module @skillancer/cache
 *
 * Redis cache utilities for Skillancer platform
 *
 * @example
 * ```typescript
 * import {
 *   createRedisClient,
 *   CacheService,
 *   SessionStore,
 *   RateLimiter,
 *   CacheKeys
 * } from '@skillancer/cache';
 *
 * // Create Redis client
 * const redis = createRedisClient({
 *   host: 'localhost',
 *   port: 6379
 * });
 *
 * // Create cache service
 * const cache = new CacheService(redis, 'myapp');
 *
 * // Create session store
 * const sessions = new SessionStore(redis);
 *
 * // Create rate limiter
 * const limiter = new RateLimiter(redis, {
 *   keyPrefix: 'ratelimit:api',
 *   points: 100,
 *   duration: 60
 * });
 * ```
 */

// Client
export {
  createRedisClient,
  createRedisCluster,
  createRedisClientFromUrl,
  buildRedisUrl,
  getRedisClient,
  setDefaultRedisClient,
  closeRedisConnection,
  closeClient,
  type RedisConfig,
  type RedisClusterConfig,
  Redis,
  Cluster,
} from './client';

// Cache Service
export {
  CacheService,
  type CacheOptions,
} from './cache-service';

// Session Store
export {
  SessionStore,
  type SessionData,
  type SessionStoreOptions,
  type SessionInfo,
  type DeviceInfo,
} from './session-store';

// Rate Limiter
export {
  RateLimiter,
  rateLimitKeyByIp,
  rateLimitKeyByUser,
  rateLimitKeyByUserEndpoint,
  rateLimitKeyByApiKey,
  type RateLimitConfig,
  type RateLimitResult,
  type RateLimitInfo,
} from './rate-limiter';

// Cache Keys
export { CacheKeys, CacheTags } from './keys';

// Health
export {
  checkRedisHealth,
  isRedisHealthy,
  waitForRedis,
  createHealthResponse,
  type HealthStatus,
  type HealthCheckOptions,
  type HealthCheckMiddlewareOptions,
} from './health';

// Configuration
export {
  getRedisConfigFromEnv,
  parseRedisUrl,
  getConfigForEnvironment,
  getClusterConfigFromEnv,
  validateConfig,
  configToUrl,
  mergeConfig,
  developmentConfig,
  testConfig,
  productionConfig,
  type ClusterNode,
  type ConfigValidationResult,
} from './config';
