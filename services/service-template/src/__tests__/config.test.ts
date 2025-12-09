/**
 * @module @skillancer/service-template/tests/config
 * Configuration tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { getConfig, clearConfigCache, validateConfig } from '../config/index.js';

describe('Configuration', () => {
  beforeEach(() => {
    clearConfigCache();
    // Set minimal required env vars
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    clearConfigCache();
  });

  describe('getConfig', () => {
    it('should return config with default values', () => {
      const config = getConfig();

      expect(config.env).toBe('test');
      expect(config.service.name).toBe('service');
      expect(config.server.port).toBe(3000);
      expect(config.logging.level).toBe('info');
    });

    it('should cache config on subsequent calls', () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });
  });

  describe('clearConfigCache', () => {
    it('should clear cached config', () => {
      const config1 = getConfig();
      clearConfigCache();
      const config2 = getConfig();

      expect(config1).not.toBe(config2);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const result = validateConfig({
        env: 'development',
        service: { name: 'test', version: '1.0.0' },
        server: { port: 3000, host: '0.0.0.0' },
        logging: { level: 'info', pretty: false },
        cors: { origin: '*', credentials: true },
        rateLimit: { max: 100, windowMs: 60000 },
        features: { swagger: true, metrics: true },
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid config', () => {
      const result = validateConfig({
        env: 'invalid',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
