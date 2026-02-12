/**
 * @module @skillancer/api-gateway/tests/circuit-breaker
 * Circuit breaker tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  getCircuitBreaker,
  getAllCircuitBreakerStats,
  resetAllCircuitBreakers,
  clearCircuitBreakers,
} from '../utils/circuit-breaker.js';

describe('CircuitBreaker', () => {
  const defaultOptions = {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 1000,
    volumeThreshold: 3,
  };

  beforeEach(() => {
    clearCircuitBreakers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create a circuit breaker with the given name', () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);

      expect(breaker.name).toBe('test-service');
    });

    it('should start in closed state', () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);
      const stats = breaker.getStats();

      expect(stats.state).toBe('closed');
    });
  });

  describe('execute', () => {
    it('should execute successful functions', async () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should record successful executions', async () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);
      const fn = vi.fn().mockResolvedValue('success');

      await breaker.execute(fn);
      await breaker.execute(fn);

      const stats = breaker.getStats();
      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(0);
    });

    it('should record failed executions', async () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      await expect(breaker.execute(fn)).rejects.toThrow('failure');

      const stats = breaker.getStats();
      expect(stats.failures).toBe(1);
    });

    it('should open circuit when error threshold is exceeded', async () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Exceed volume threshold with failures
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('failure');
      }

      const stats = breaker.getStats();
      expect(stats.state).toBe('open');
    });

    it('should reject immediately when circuit is open', async () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      // Next call should fail immediately with CircuitOpenError
      const successFn = vi.fn().mockResolvedValue('success');
      await expect(breaker.execute(successFn)).rejects.toThrow(CircuitOpenError);
      expect(successFn).not.toHaveBeenCalled();
    });

    it('should transition to half-open after reset timeout', async () => {
      const breaker = new CircuitBreaker('test-service', {
        ...defaultOptions,
        resetTimeout: 1000,
      });
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      expect(breaker.getStats().state).toBe('open');

      // Advance time past reset timeout
      vi.advanceTimersByTime(1500);

      expect(breaker.getStats().state).toBe('half-open');
    });

    it('should close circuit after successful execution in half-open state', async () => {
      const breaker = new CircuitBreaker('test-service', {
        ...defaultOptions,
        resetTimeout: 1000,
      });
      const failFn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      // Advance to half-open
      vi.advanceTimersByTime(1500);
      expect(breaker.getStats().state).toBe('half-open');

      // Successful execution should close
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      expect(breaker.getStats().state).toBe('closed');
    });

    it('should re-open circuit after failure in half-open state', async () => {
      const breaker = new CircuitBreaker('test-service', {
        ...defaultOptions,
        resetTimeout: 1000,
      });
      const failFn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      // Advance to half-open
      vi.advanceTimersByTime(1500);
      expect(breaker.getStats().state).toBe('half-open');

      // Failure should re-open
      await expect(breaker.execute(failFn)).rejects.toThrow();

      expect(breaker.getStats().state).toBe('open');
    });
  });

  describe('isAvailable', () => {
    it('should return true when circuit is closed', () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);

      expect(breaker.isAvailable()).toBe(true);
    });

    it('should return false when circuit is open', async () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      expect(breaker.isAvailable()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset circuit to initial state', async () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      breaker.reset();

      const stats = breaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return circuit breaker statistics', async () => {
      const breaker = new CircuitBreaker('test-service', defaultOptions);

      // Some successes and failures
      await breaker.execute(() => Promise.resolve('ok'));
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      const stats = breaker.getStats();

      expect(stats.state).toBe('closed');
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(1);
      expect(stats.totalRequests).toBe(2);
      expect(stats.errorPercentage).toBe(50);
    });
  });
});

describe('Circuit Breaker Registry', () => {
  beforeEach(() => {
    clearCircuitBreakers();
  });

  describe('getCircuitBreaker', () => {
    it('should create a new circuit breaker', () => {
      const breaker = getCircuitBreaker('test-service');

      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(breaker.name).toBe('test-service');
    });

    it('should return existing circuit breaker', () => {
      const breaker1 = getCircuitBreaker('test-service');
      const breaker2 = getCircuitBreaker('test-service');

      expect(breaker1).toBe(breaker2);
    });

    it('should accept custom options', () => {
      const breaker = getCircuitBreaker('test-service', {
        timeout: 10000,
      });

      expect(breaker).toBeDefined();
    });
  });

  describe('getAllCircuitBreakerStats', () => {
    it('should return stats for all circuit breakers', async () => {
      getCircuitBreaker('service-a');
      getCircuitBreaker('service-b');

      const stats = getAllCircuitBreakerStats();

      expect(stats['service-a']).toBeDefined();
      expect(stats['service-b']).toBeDefined();
    });
  });

  describe('resetAllCircuitBreakers', () => {
    it('should reset all circuit breakers', async () => {
      const breakerA = getCircuitBreaker('service-a');
      const breakerB = getCircuitBreaker('service-b');

      // Add some activity
      await breakerA.execute(() => Promise.resolve('ok'));
      await breakerB.execute(() => Promise.resolve('ok'));

      resetAllCircuitBreakers();

      expect(breakerA.getStats().successes).toBe(0);
      expect(breakerB.getStats().successes).toBe(0);
    });
  });

  describe('clearCircuitBreakers', () => {
    it('should clear all circuit breakers from registry', () => {
      getCircuitBreaker('service-a');
      getCircuitBreaker('service-b');

      clearCircuitBreakers();

      const stats = getAllCircuitBreakerStats();
      expect(Object.keys(stats)).toHaveLength(0);
    });
  });
});

describe('Errors', () => {
  describe('CircuitOpenError', () => {
    it('should include circuit name', () => {
      const error = new CircuitOpenError('test-service');

      expect(error.circuitName).toBe('test-service');
      expect(error.name).toBe('CircuitOpenError');
      expect(error.message).toContain('test-service');
    });
  });

  describe('TimeoutError', () => {
    it('should have correct name and message', () => {
      const error = new TimeoutError('Request timed out');

      expect(error.name).toBe('TimeoutError');
      expect(error.message).toBe('Request timed out');
    });
  });
});
