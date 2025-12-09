/**
 * @module @skillancer/service-template/tests/http
 * HTTP utilities tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  withRetry,
  createCircuitBreaker,
  sleep,
  timeout,
  buildQueryString,
  parseQueryString,
} from '../utils/http.js';

describe('HTTP Utilities', () => {
  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = withRetry(fn, { maxRetries: 3, initialDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      const promise = withRetry(fn, { maxRetries: 2, initialDelay: 100 });

      // Run timers and catch rejection together
      const timerPromise = vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('always fails');
      await timerPromise;
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should respect retryOn predicate', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('do not retry'));

      const promise = withRetry(fn, {
        maxRetries: 3,
        retryOn: () => false,
      });

      // The predicate returns false, so no retries and rejection happens immediately
      await expect(promise).rejects.toThrow('do not retry');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('createCircuitBreaker', () => {
    it('should allow requests when closed', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3 });

      expect(breaker.getState()).toBe('closed');

      const result = await breaker.execute(async () => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should open after failure threshold', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 2 });

      // Fail twice
      await expect(
        breaker.execute(async () => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
      await expect(
        breaker.execute(async () => Promise.reject(new Error('fail')))
      ).rejects.toThrow();

      expect(breaker.getState()).toBe('open');

      // Should reject without calling function
      await expect(breaker.execute(async () => Promise.resolve('success'))).rejects.toThrow(
        'Circuit breaker is open'
      );
    });

    it('should reset after timeout', async () => {
      vi.useFakeTimers();

      const breaker = createCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000,
      });

      // Trip the breaker
      await expect(
        breaker.execute(async () => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      // Wait for reset timeout
      vi.advanceTimersByTime(1000);

      // Should be half-open and allow request
      const result = await breaker.execute(async () => Promise.resolve('success'));
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');

      vi.useRealTimers();
    });

    it('should reset state manually', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 1 });

      await expect(
        breaker.execute(async () => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
      expect(breaker.getState()).toBe('open');

      breaker.reset();
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      vi.useFakeTimers();

      let resolved = false;
      const promise = sleep(1000).then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);

      vi.advanceTimersByTime(1000);
      await promise;

      expect(resolved).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve if promise completes in time', async () => {
      const promise = timeout(Promise.resolve('success'), 1000);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
    });

    it('should reject if timeout exceeded', async () => {
      // Use a never-resolving promise to avoid timer cleanup issues
      const slowPromise = new Promise(() => {});

      const promise = timeout(slowPromise, 1000);
      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Operation timed out');
    });

    it('should use custom timeout message', async () => {
      // Use a never-resolving promise to avoid timer cleanup issues
      const slowPromise = new Promise(() => {});

      const promise = timeout(slowPromise, 1000, 'Custom timeout');
      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Custom timeout');
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from object', () => {
      const result = buildQueryString({
        page: 1,
        limit: 20,
        search: 'test',
      });

      expect(result).toBe('?page=1&limit=20&search=test');
    });

    it('should handle arrays', () => {
      const result = buildQueryString({
        tags: ['a', 'b', 'c'],
      });

      expect(result).toBe('?tags=a&tags=b&tags=c');
    });

    it('should skip undefined and null values', () => {
      const result = buildQueryString({
        page: 1,
        search: undefined,
        filter: null,
      });

      expect(result).toBe('?page=1');
    });

    it('should return empty string for empty object', () => {
      const result = buildQueryString({});
      expect(result).toBe('');
    });
  });

  describe('parseQueryString', () => {
    it('should parse query string to object', () => {
      const result = parseQueryString('?page=1&limit=20');

      expect(result).toEqual({
        page: '1',
        limit: '20',
      });
    });

    it('should handle duplicate keys as array', () => {
      const result = parseQueryString('tags=a&tags=b&tags=c');

      expect(result).toEqual({
        tags: ['a', 'b', 'c'],
      });
    });

    it('should handle query string with leading ?', () => {
      const result = parseQueryString('?foo=bar');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should handle query string without leading ?', () => {
      const result = parseQueryString('foo=bar');
      expect(result).toEqual({ foo: 'bar' });
    });
  });
});
