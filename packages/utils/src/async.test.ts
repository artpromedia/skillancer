import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retry,
  sleep,
  debounce,
  throttle,
  timeout,
  promiseAllSettledWithConcurrency,
  sequence,
  createDeferred,
  memoizeAsync,
  raceToSuccess,
} from './async';

describe('async', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      const promise = sleep(1000);

      vi.advanceTimersByTime(1000);
      await promise;

      expect(Date.now() - start).toBeGreaterThanOrEqual(1000);
    });

    it('should resolve to void', async () => {
      const promise = sleep(100);
      vi.advanceTimersByTime(100);
      const result = await promise;
      expect(result).toBeUndefined();
    });
  });

  describe('retry', () => {
    it('should succeed on first try', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retry(fn, { maxAttempts: 3, initialDelayMs: 100 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

      const result = await retry(fn, { maxAttempts: 3, initialDelayMs: 10 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockRejectedValue(new Error('always fail'));

      await expect(retry(fn, { maxAttempts: 3, initialDelayMs: 10 })).rejects.toThrow(
        'always fail'
      );
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');
      const onRetry = vi.fn();

      await retry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });
  });

  describe('debounce', () => {
    it('should debounce rapid calls', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call with latest arguments', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('first');
      debounced('second');
      debounced('third');

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('third');
    });

    it('should reset timer on each call', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(50);

      debounced();
      vi.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('should execute immediately on first call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throttle subsequent calls', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow call after throttle period', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      vi.advanceTimersByTime(100);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout', () => {
    it('should resolve if promise completes in time', async () => {
      const promise = timeout(Promise.resolve('success'), 1000);

      const result = await promise;

      expect(result).toBe('success');
    });

    it('should reject if promise times out', async () => {
      const slowPromise = new Promise((resolve) => setTimeout(() => resolve('slow'), 2000));

      const promise = timeout(slowPromise, 1000);

      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Operation timed out');
    });

    it('should use custom error message', async () => {
      const slowPromise = new Promise((resolve) => setTimeout(() => resolve('slow'), 2000));

      const promise = timeout(slowPromise, 1000, 'Custom timeout');

      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Custom timeout');
    });
  });

  describe('promiseAllSettledWithConcurrency', () => {
    it('should process all promises', async () => {
      vi.useRealTimers();

      const tasks = [() => Promise.resolve(1), () => Promise.resolve(2), () => Promise.resolve(3)];

      const results = await promiseAllSettledWithConcurrency(tasks, 2);

      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    });

    it('should respect concurrency limit', async () => {
      vi.useRealTimers();

      let concurrent = 0;
      let maxConcurrent = 0;

      const createTask = (value: number) => async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        concurrent--;
        return value;
      };

      const tasks = [createTask(1), createTask(2), createTask(3), createTask(4), createTask(5)];

      await promiseAllSettledWithConcurrency(tasks, 2);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should handle rejections without stopping', async () => {
      vi.useRealTimers();

      const tasks = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('fail')),
        () => Promise.resolve(3),
      ];

      const results = await promiseAllSettledWithConcurrency(tasks, 2);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
      expect(results[1].status).toBe('rejected');
      expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
    });
  });

  describe('sequence', () => {
    it('should execute tasks in sequence', async () => {
      vi.useRealTimers();

      const order: number[] = [];
      const results = await sequence([
        async () => {
          order.push(1);
          return 'a';
        },
        async () => {
          order.push(2);
          return 'b';
        },
        async () => {
          order.push(3);
          return 'c';
        },
      ]);

      expect(order).toEqual([1, 2, 3]);
      expect(results).toEqual(['a', 'b', 'c']);
    });
  });

  describe('createDeferred', () => {
    it('should resolve externally', async () => {
      vi.useRealTimers();
      const deferred = createDeferred<string>();

      // Resolve immediately
      deferred.resolve('done');

      const result = await deferred.promise;
      expect(result).toBe('done');
    });

    it('should reject externally', async () => {
      vi.useRealTimers();
      const deferred = createDeferred<string>();

      // Reject immediately
      deferred.reject(new Error('failed'));

      await expect(deferred.promise).rejects.toThrow('failed');
    });
  });

  describe('memoizeAsync', () => {
    it('should cache results', async () => {
      vi.useRealTimers();

      const fn = vi.fn().mockResolvedValue('result');
      const memoized = memoizeAsync(fn);

      const result1 = await memoized('arg1');
      const result2 = await memoized('arg1');

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use different cache keys for different args', async () => {
      vi.useRealTimers();

      const fn = vi.fn().mockImplementation(async (x: string) => x);
      const memoized = memoizeAsync(fn);

      await memoized('a');
      await memoized('b');

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('raceToSuccess', () => {
    it('should return first successful result', async () => {
      vi.useRealTimers();

      const result = await raceToSuccess([
        new Promise((_, reject) => setTimeout(() => reject(new Error('fail')), 50)),
        Promise.resolve('success'),
      ]);

      expect(result).toBe('success');
    });

    it('should reject if all promises reject', async () => {
      vi.useRealTimers();

      await expect(
        raceToSuccess([Promise.reject(new Error('fail1')), Promise.reject(new Error('fail2'))])
      ).rejects.toThrow('All promises rejected');
    });

    it('should reject for empty array', async () => {
      vi.useRealTimers();

      await expect(raceToSuccess([])).rejects.toThrow('No promises provided');
    });
  });
});
