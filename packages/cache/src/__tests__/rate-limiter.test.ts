import Redis from 'ioredis-mock';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let redis: InstanceType<typeof Redis>;
  let limiter: RateLimiter;

  const testConfig = {
    windowMs: 60000, // 1 minute
    maxRequests: 5,
  };

  beforeEach(() => {
    redis = new Redis();
    limiter = new RateLimiter(redis as unknown as import('ioredis').Redis, 'test:ratelimit');
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  describe('consume', () => {
    it('should allow requests within limit', async () => {
      const result = await limiter.consume('user1', testConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should track consumption correctly', async () => {
      // Consume 3 requests
      await limiter.consume('user1', testConfig);
      await limiter.consume('user1', testConfig);
      const result = await limiter.consume('user1', testConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should block when limit exceeded', async () => {
      // Consume all 5 requests
      for (let i = 0; i < 5; i++) {
        await limiter.consume('user1', testConfig);
      }

      // Next request should be blocked
      const result = await limiter.consume('user1', testConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should isolate different keys', async () => {
      await limiter.consume('user1', testConfig);
      await limiter.consume('user1', testConfig);
      await limiter.consume('user1', testConfig);

      const result = await limiter.consume('user2', testConfig);

      expect(result.remaining).toBe(4);
    });
  });

  describe('check', () => {
    it('should return current state without consuming', async () => {
      await limiter.consume('user1', testConfig);
      await limiter.consume('user1', testConfig);

      const result = await limiter.check('user1', testConfig);

      expect(result.remaining).toBe(3);
      expect(result.current).toBe(2);
    });

    it('should return full limit for new key', async () => {
      const result = await limiter.check('newuser', testConfig);

      expect(result.remaining).toBe(5);
      expect(result.allowed).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset consumption for a key', async () => {
      await limiter.consume('user1', testConfig);
      await limiter.consume('user1', testConfig);
      await limiter.consume('user1', testConfig);
      await limiter.consume('user1', testConfig);

      await limiter.reset('user1');
      const result = await limiter.check('user1', testConfig);

      expect(result.remaining).toBe(5);
    });
  });

  describe('getInfo', () => {
    it('should return rate limit info', async () => {
      await limiter.consume('user1', testConfig);
      await limiter.consume('user1', testConfig);

      const info = await limiter.getInfo('user1', testConfig);

      expect(info.limit).toBe(5);
      expect(info.remaining).toBe(3);
      expect(info.resetAt).toBeDefined();
    });
  });
});
