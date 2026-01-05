/**
 * @module @skillancer/admin/services/ops
 * Cache management service for Redis
 */

import type { Redis } from 'ioredis';

export interface CacheStats {
  memoryUsed: string;
  memoryPeak: string;
  connectedClients: number;
  totalKeys: number;
  hitRate: number;
  evictedKeys: number;
  expiredKeys: number;
  opsPerSecond: number;
  uptime: number;
}

export interface CacheKey {
  key: string;
  type: string;
  ttl: number;
  size: number;
  encoding: string;
}

export interface CacheGroup {
  name: string;
  pattern: string;
  keyCount: number;
  totalSize: number;
  description: string;
}

export interface MemoryAnalysis {
  totalMemory: string;
  usedMemory: string;
  peakMemory: string;
  fragmentationRatio: number;
  memoryByType: Record<string, number>;
  largestKeys: { key: string; size: number; type: string }[];
}

export interface PatternAnalysis {
  pattern: string;
  keyCount: number;
  avgTTL: number;
  totalSize: number;
}

export interface SlowLogEntry {
  id: number;
  timestamp: Date;
  duration: number;
  command: string[];
  clientAddress: string;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export class CacheManagementService {
  private cacheGroups: CacheGroup[] = [
    {
      name: 'sessions',
      pattern: 'session:*',
      keyCount: 0,
      totalSize: 0,
      description: 'User sessions',
    },
    { name: 'users', pattern: 'user:*', keyCount: 0, totalSize: 0, description: 'User cache' },
    { name: 'courses', pattern: 'course:*', keyCount: 0, totalSize: 0, description: 'Course data' },
    { name: 'jobs', pattern: 'job:*', keyCount: 0, totalSize: 0, description: 'Job listings' },
    {
      name: 'search',
      pattern: 'search:*',
      keyCount: 0,
      totalSize: 0,
      description: 'Search results',
    },
    {
      name: 'features',
      pattern: 'feature:*',
      keyCount: 0,
      totalSize: 0,
      description: 'Feature flags',
    },
    {
      name: 'settings',
      pattern: 'setting:*',
      keyCount: 0,
      totalSize: 0,
      description: 'System settings',
    },
    {
      name: 'ratelimit',
      pattern: 'ratelimit:*',
      keyCount: 0,
      totalSize: 0,
      description: 'Rate limiting',
    },
  ];

  constructor(
    private redis: Redis,
    private logger: Logger
  ) {}

  async getCacheStats(): Promise<CacheStats> {
    const info = await this.redis.info();
    const parsed = this.parseRedisInfo(info);

    const keyspace = parsed['db0'] || '';
    const keysMatch = keyspace.match(/keys=(\d+)/);
    const totalKeys = keysMatch ? Number.parseInt(keysMatch[1]) : 0;

    const hits = Number.parseInt(parsed['keyspace_hits'] || '0');
    const misses = Number.parseInt(parsed['keyspace_misses'] || '0');
    const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;

    return {
      memoryUsed: parsed['used_memory_human'] || '0B',
      memoryPeak: parsed['used_memory_peak_human'] || '0B',
      connectedClients: Number.parseInt(parsed['connected_clients'] || '0'),
      totalKeys,
      hitRate,
      evictedKeys: Number.parseInt(parsed['evicted_keys'] || '0'),
      expiredKeys: Number.parseInt(parsed['expired_keys'] || '0'),
      opsPerSecond: Number.parseInt(parsed['instantaneous_ops_per_sec'] || '0'),
      uptime: Number.parseInt(parsed['uptime_in_seconds'] || '0'),
    };
  }

  async scanKeys(
    pattern: string,
    count: number = 100,
    cursor: string = '0'
  ): Promise<{ keys: CacheKey[]; nextCursor: string; hasMore: boolean }> {
    const [nextCursor, matchedKeys] = await this.redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      count
    );

    const keys: CacheKey[] = await Promise.all(
      matchedKeys.slice(0, 100).map(async (key) => {
        const [type, ttl, encoding] = await Promise.all([
          this.redis.type(key),
          this.redis.ttl(key),
          this.redis.object('ENCODING', key).catch(() => 'unknown'),
        ]);

        let size = 0;
        try {
          size = ((await this.redis.memory('USAGE', key)) as number) || 0;
        } catch {
          // Memory command might not be available
        }

        return {
          key,
          type,
          ttl,
          size,
          encoding: encoding as string,
        };
      })
    );

    return {
      keys,
      nextCursor,
      hasMore: nextCursor !== '0',
    };
  }

  async getKeyValue(
    key: string
  ): Promise<{ type: string; value: unknown; ttl: number; size: number }> {
    const type = await this.redis.type(key);
    const ttl = await this.redis.ttl(key);

    let value: unknown;
    switch (type) {
      case 'string':
        value = await this.redis.get(key);
        try {
          value = JSON.parse(value as string);
        } catch {
          // Keep as string
        }
        break;
      case 'hash':
        value = await this.redis.hgetall(key);
        break;
      case 'list':
        value = await this.redis.lrange(key, 0, 100);
        break;
      case 'set':
        value = await this.redis.smembers(key);
        break;
      case 'zset':
        value = await this.redis.zrange(key, 0, 100, 'WITHSCORES');
        break;
      default:
        value = null;
    }

    let size = 0;
    try {
      size = ((await this.redis.memory('USAGE', key)) as number) || 0;
    } catch {
      // Memory command might not be available
    }

    return { type, value, ttl, size };
  }

  async deleteKey(key: string): Promise<void> {
    await this.redis.del(key);
    this.logger.info('Cache key deleted', { key });
  }

  async invalidateByPattern(pattern: string): Promise<{ deletedCount: number; keys: string[] }> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, matchedKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        1000
      );
      cursor = nextCursor;
      keys.push(...matchedKeys);
    } while (cursor !== '0');

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    this.logger.warn('Cache invalidated by pattern', { pattern, count: keys.length });

    return { deletedCount: keys.length, keys: keys.slice(0, 100) };
  }

  async getCacheGroups(): Promise<CacheGroup[]> {
    const groups = await Promise.all(
      this.cacheGroups.map(async (group) => {
        let cursor = '0';
        let keyCount = 0;
        let totalSize = 0;

        do {
          const [nextCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH',
            group.pattern,
            'COUNT',
            1000
          );
          cursor = nextCursor;
          keyCount += keys.length;

          // Sample size from first 10 keys
          if (totalSize === 0 && keys.length > 0) {
            for (const key of keys.slice(0, 10)) {
              try {
                const size = ((await this.redis.memory('USAGE', key)) as number) || 0;
                totalSize += size;
              } catch {
                // Memory command might not be available
              }
            }
            totalSize = Math.round((totalSize / Math.min(keys.length, 10)) * keyCount);
          }
        } while (cursor !== '0');

        return {
          ...group,
          keyCount,
          totalSize,
        };
      })
    );

    return groups;
  }

  async invalidateCacheGroup(groupName: string): Promise<{ deletedCount: number }> {
    const group = this.cacheGroups.find((g) => g.name === groupName);
    if (!group) {
      throw new Error(`Cache group ${groupName} not found`);
    }

    const result = await this.invalidateByPattern(group.pattern);
    return { deletedCount: result.deletedCount };
  }

  async getMemoryAnalysis(): Promise<MemoryAnalysis> {
    const info = await this.redis.info('memory');
    const parsed = this.parseRedisInfo(info);

    // Get largest keys by sampling
    const largestKeys: { key: string; size: number; type: string }[] = [];
    let cursor = '0';
    const sampleSize = 1000;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys.slice(0, sampleSize - largestKeys.length)) {
        try {
          const [size, type] = await Promise.all([
            this.redis.memory('USAGE', key) as Promise<number>,
            this.redis.type(key),
          ]);

          largestKeys.push({ key, size: size || 0, type });
        } catch {
          // Skip keys that can't be measured
        }
      }

      if (largestKeys.length >= sampleSize) break;
    } while (cursor !== '0');

    largestKeys.sort((a, b) => b.size - a.size);

    return {
      totalMemory: parsed['total_system_memory_human'] || 'unknown',
      usedMemory: parsed['used_memory_human'] || '0B',
      peakMemory: parsed['used_memory_peak_human'] || '0B',
      fragmentationRatio: parseFloat(parsed['mem_fragmentation_ratio'] || '1'),
      memoryByType: {},
      largestKeys: largestKeys.slice(0, 20),
    };
  }

  async analyzePatterns(): Promise<PatternAnalysis[]> {
    const patterns = new Map<string, { count: number; totalTTL: number; totalSize: number }>();

    let cursor = '0';
    const sampleSize = 5000;
    let sampled = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'COUNT', 100);
      cursor = nextCursor;

      for (const key of keys) {
        if (sampled >= sampleSize) break;

        const pattern = this.extractPattern(key);
        const ttl = await this.redis.ttl(key);

        let size = 0;
        try {
          size = ((await this.redis.memory('USAGE', key)) as number) || 0;
        } catch {
          // Skip
        }

        const existing = patterns.get(pattern) || { count: 0, totalTTL: 0, totalSize: 0 };
        patterns.set(pattern, {
          count: existing.count + 1,
          totalTTL: existing.totalTTL + (ttl > 0 ? ttl : 0),
          totalSize: existing.totalSize + size,
        });

        sampled++;
      }

      if (sampled >= sampleSize) break;
    } while (cursor !== '0');

    return Array.from(patterns.entries())
      .map(([pattern, data]) => ({
        pattern,
        keyCount: data.count,
        avgTTL: data.count > 0 ? Math.round(data.totalTTL / data.count) : 0,
        totalSize: data.totalSize,
      }))
      .sort((a, b) => b.keyCount - a.keyCount)
      .slice(0, 50);
  }

  async getSlowLog(count: number = 50): Promise<SlowLogEntry[]> {
    const slowlog = await this.redis.slowlog('GET', count);

    return (slowlog as any[]).map((entry: any[]) => ({
      id: entry[0],
      timestamp: new Date(entry[1] * 1000),
      duration: entry[2], // microseconds
      command: entry[3],
      clientAddress: entry[4] || 'unknown',
    }));
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line.startsWith('#') || !line.includes(':')) continue;
      const [key, value] = line.split(':');
      result[key] = value;
    }

    return result;
  }

  private extractPattern(key: string): string {
    // Extract pattern by replacing IDs with *
    return key
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '*') // UUIDs
      .replace(/\d{10,}/g, '*') // Timestamps
      .replace(/\d+/g, '*'); // Numbers
  }
}
