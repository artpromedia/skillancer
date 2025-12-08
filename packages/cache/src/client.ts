import Redis from 'ioredis';

let redis: Redis | null = null;

/**
 * Get Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env['REDIS_URL'] || 'redis://localhost:6379';
    redis = new Redis(url);
  }
  return redis;
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
