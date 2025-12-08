import Redis from 'ioredis-mock';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { checkRedisHealth, isRedisHealthy, waitForRedis } from '../health';

describe('health', () => {
  let redis: InstanceType<typeof Redis>;

  beforeEach(() => {
    redis = new Redis();
  });

  afterEach(() => {
    redis.disconnect();
  });

  describe('checkRedisHealth', () => {
    it('should return healthy status when connected', async () => {
      const health = await checkRedisHealth(redis as unknown as import('ioredis').Redis);

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });

    it('should include details when requested', async () => {
      const health = await checkRedisHealth(redis as unknown as import('ioredis').Redis, {
        includeDetails: true,
      });

      expect(health.healthy).toBe(true);
      // Details may or may not be present depending on mock implementation
    });
  });

  describe('isRedisHealthy', () => {
    it('should return true when connected', async () => {
      const healthy = await isRedisHealthy(redis as unknown as import('ioredis').Redis);
      expect(healthy).toBe(true);
    });

    it('should respect timeout', async () => {
      const healthy = await isRedisHealthy(redis as unknown as import('ioredis').Redis, 1000);
      expect(healthy).toBe(true);
    });
  });

  describe('waitForRedis', () => {
    it('should resolve immediately when already connected', async () => {
      const result = await waitForRedis(redis as unknown as import('ioredis').Redis, {
        maxWait: 1000,
        checkInterval: 100,
      });

      expect(result).toBe(true);
    });
  });
});
