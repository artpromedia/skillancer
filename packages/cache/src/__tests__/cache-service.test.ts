import Redis from 'ioredis-mock';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { CacheService } from '../cache-service';

describe('CacheService', () => {
  let redis: InstanceType<typeof Redis>;
  let cache: CacheService;

  beforeEach(() => {
    redis = new Redis();
    cache = new CacheService(redis as unknown as import('ioredis').Redis, 'test');
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  describe('get/set', () => {
    it('should set and get a value', async () => {
      await cache.set('key1', { foo: 'bar' });
      const result = await cache.get('key1');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should set with TTL', async () => {
      await cache.set('key2', 'value', { ttl: 60 });
      const result = await cache.get('key2');
      expect(result).toBe('value');
    });

    it('should handle complex objects', async () => {
      const data = {
        user: { id: '1', name: 'Test' },
        items: [1, 2, 3],
        nested: { deep: { value: true } },
      };
      await cache.set('complex', data);
      const result = await cache.get('complex');
      expect(result).toEqual(data);
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      await cache.set('toDelete', 'value');
      const deleted = await cache.delete('toDelete');
      expect(deleted).toBe(true);

      const result = await cache.get('toDelete');
      expect(result).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await cache.set('exists', 'value');
      const exists = await cache.exists('exists');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await cache.exists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('tags', () => {
    it('should set cache with tags', async () => {
      await cache.set('tagged1', 'value1', { tags: ['users', 'admin'] });
      await cache.set('tagged2', 'value2', { tags: ['users'] });

      const result1 = await cache.get('tagged1');
      const result2 = await cache.get('tagged2');

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('should delete by tag', async () => {
      await cache.set('tagged1', 'value1', { tags: ['users'] });
      await cache.set('tagged2', 'value2', { tags: ['users'] });
      await cache.set('tagged3', 'value3', { tags: ['other'] });

      await cache.deleteByTag('users');

      const result1 = await cache.get('tagged1');
      const result2 = await cache.get('tagged2');
      const result3 = await cache.get('tagged3');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBe('value3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      await cache.set('cached', 'original');
      const factory = vi.fn().mockResolvedValue('new');

      const result = await cache.getOrSet('cached', factory);

      expect(result).toBe('original');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factory = vi.fn().mockResolvedValue('computed');

      const result = await cache.getOrSet('notcached', factory, { ttl: 60 });

      expect(result).toBe('computed');
      expect(factory).toHaveBeenCalledOnce();

      // Verify it was cached
      const cached = await cache.get('notcached');
      expect(cached).toBe('computed');
    });
  });

  describe('increment/decrement', () => {
    it('should increment value', async () => {
      const result1 = await cache.increment('counter');
      expect(result1).toBe(1);

      const result2 = await cache.increment('counter');
      expect(result2).toBe(2);

      const result3 = await cache.increment('counter', 5);
      expect(result3).toBe(7);
    });

    it('should decrement value', async () => {
      await cache.increment('counter', 10);

      const result1 = await cache.decrement('counter');
      expect(result1).toBe(9);

      const result2 = await cache.decrement('counter', 4);
      expect(result2).toBe(5);
    });
  });

  describe('hash operations', () => {
    it('should set and get hash field', async () => {
      await cache.hset('hash', 'field1', { value: 1 });
      const result = await cache.hget('hash', 'field1');
      expect(result).toEqual({ value: 1 });
    });

    it('should get all hash fields', async () => {
      await cache.hset('hash', 'field1', 'value1');
      await cache.hset('hash', 'field2', 'value2');

      const result = await cache.hgetall<string>('hash');
      expect(result).toEqual({
        field1: 'value1',
        field2: 'value2',
      });
    });

    it('should delete hash field', async () => {
      await cache.hset('hash', 'field1', 'value1');
      await cache.hset('hash', 'field2', 'value2');

      await cache.hdel('hash', 'field1');

      const result1 = await cache.hget('hash', 'field1');
      const result2 = await cache.hget('hash', 'field2');

      expect(result1).toBeNull();
      expect(result2).toBe('value2');
    });
  });

  describe('flush', () => {
    it('should clear all cache', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.flush();

      const result1 = await cache.get('key1');
      const result2 = await cache.get('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });
});
