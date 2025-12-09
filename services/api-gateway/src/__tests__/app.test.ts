/**
 * @module @skillancer/api-gateway/tests/app
 * Application tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp, buildTestApp } from '../app.js';
import { clearConfigCache } from '../config/index.js';

describe('Application', () => {
  beforeEach(() => {
    clearConfigCache();
    // Set required JWT secret for tests
    vi.stubEnv('JWT_SECRET', 'test-secret-key-that-is-at-least-32-characters-long');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    clearConfigCache();
  });

  describe('buildApp', () => {
    it('should create a Fastify instance', async () => {
      const app = await buildApp({ skipPlugins: true });

      expect(app).toBeDefined();
      expect(app.server).toBeDefined();

      await app.close();
    });

    it('should register error handler', async () => {
      const app = await buildApp({ skipPlugins: true });

      // Verify error handler is set
      expect(app.errorHandler).toBeDefined();

      await app.close();
    });
  });

  describe('buildTestApp', () => {
    it('should create app with logging disabled', async () => {
      const app = await buildTestApp({ skipPlugins: true });

      expect(app).toBeDefined();

      await app.close();
    });
  });

  describe('Health Routes', () => {
    it('should respond to /health', async () => {
      const app = await buildTestApp({ skipPlugins: true });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');

      await app.close();
    });

    it('should respond to /health/live', async () => {
      const app = await buildTestApp({ skipPlugins: true });

      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.alive).toBe(true);
      expect(body.uptime).toBeGreaterThanOrEqual(0);

      await app.close();
    });
  });
});
