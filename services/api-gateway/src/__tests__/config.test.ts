/**
 * @module @skillancer/api-gateway/tests/config
 * Configuration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getConfig, clearConfigCache, validateConfig } from '../config/index.js';

describe('Configuration', () => {
  beforeEach(() => {
    clearConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearConfigCache();
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = getConfig();

      expect(config).toBeDefined();
      // In test environment, NODE_ENV is 'test'
      expect(['development', 'test']).toContain(config.env);
      expect(config.service.name).toBe('api-gateway');
      expect(config.server.port).toBe(4000);
      expect(config.server.host).toBe('0.0.0.0');
    });

    it('should cache configuration', () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });

    it('should read configuration from environment variables', () => {
      clearConfigCache();
      vi.stubEnv('PORT', '5000');
      vi.stubEnv('HOST', 'localhost');
      vi.stubEnv('LOG_LEVEL', 'error');

      const config = getConfig();

      expect(config.server.port).toBe(5000);
      expect(config.server.host).toBe('localhost');
      expect(config.server.logLevel).toBe('error');
    });

    it('should configure service URLs from environment', () => {
      clearConfigCache();
      vi.stubEnv('AUTH_SERVICE_URL', 'http://auth:3001');
      vi.stubEnv('MARKET_SERVICE_URL', 'http://market:3002');

      const config = getConfig();

      expect(config.services.auth).toBe('http://auth:3001');
      expect(config.services.market).toBe('http://market:3002');
    });

    it('should configure JWT when secret is provided', () => {
      clearConfigCache();
      vi.stubEnv('JWT_SECRET', 'this-is-a-secret-key-at-least-32-chars');
      vi.stubEnv('JWT_EXPIRES_IN', '2h');

      const config = getConfig();

      expect(config.jwt).toBeDefined();
      expect(config.jwt?.secret).toBe('this-is-a-secret-key-at-least-32-chars');
      expect(config.jwt?.expiresIn).toBe('2h');
    });

    it('should have default rate limit settings', () => {
      const config = getConfig();

      expect(config.rateLimit.global.max).toBe(100);
      expect(config.rateLimit.global.timeWindow).toBe('1 minute');
    });

    it('should have default circuit breaker settings', () => {
      const config = getConfig();

      expect(config.circuitBreaker.timeout).toBe(30000);
      expect(config.circuitBreaker.errorThresholdPercentage).toBe(50);
      expect(config.circuitBreaker.resetTimeout).toBe(30000);
      expect(config.circuitBreaker.volumeThreshold).toBe(10);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const validConfig = {
        env: 'production',
        service: { name: 'test', version: '1.0.0' },
        server: { host: 'localhost', port: 3000, logLevel: 'info' },
        logging: { level: 'info', pretty: false },
        features: { swagger: false, metrics: true },
        rateLimit: { global: { max: 50, timeWindow: '30 seconds' } },
        cors: { origins: 'http://localhost:3000' },
        services: {
          auth: 'http://auth:3001',
          market: 'http://market:3002',
          skillpod: 'http://skillpod:3003',
          cockpit: 'http://cockpit:3004',
          billing: 'http://billing:3005',
          notification: 'http://notification:3006',
        },
        circuitBreaker: {
          timeout: 10000,
          errorThresholdPercentage: 60,
          resetTimeout: 15000,
          volumeThreshold: 5,
        },
      };

      const result = validateConfig(validConfig);

      expect(result.env).toBe('production');
      expect(result.server.port).toBe(3000);
    });

    it('should throw for invalid configuration', () => {
      const invalidConfig = {
        env: 'invalid-env',
        server: { port: 'not-a-number' },
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it('should coerce string numbers to numbers', () => {
      const config = {
        env: 'development',
        service: { name: 'test', version: '1.0.0' },
        server: { host: 'localhost', port: '8080', logLevel: 'debug' },
        logging: { level: 'debug', pretty: false },
        features: { swagger: false, metrics: true },
        rateLimit: { global: { max: 50, timeWindow: '30 seconds' } },
        cors: { origins: 'http://localhost:3000' },
        services: {
          auth: 'http://auth:3001',
          market: 'http://market:3002',
          skillpod: 'http://skillpod:3003',
          cockpit: 'http://cockpit:3004',
          billing: 'http://billing:3005',
          notification: 'http://notification:3006',
        },
        circuitBreaker: {
          timeout: 10000,
          errorThresholdPercentage: 60,
          resetTimeout: 15000,
          volumeThreshold: 5,
        },
      };

      const result = validateConfig(config);

      expect(result.server.port).toBe(8080);
    });
  });

  describe('clearConfigCache', () => {
    it('should clear cached configuration', () => {
      const config1 = getConfig();
      clearConfigCache();
      vi.stubEnv('PORT', '9999');
      const config2 = getConfig();

      expect(config1.server.port).not.toBe(config2.server.port);
    });
  });
});
