/**
 * @module @skillancer/service-template/tests/app
 * Application integration tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { buildTestApp } from '../app.js';

import type { FastifyInstance } from 'fastify';

describe('Application', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set required environment variables
    process.env.NODE_ENV = 'test';

    app = await buildTestApp();
    await app.ready();
  }, 15000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Health Routes', () => {
    it('GET /health should return OK', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBeDefined();
    });

    it('GET /health/ready should return readiness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /health/live should return liveness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/unknown-route',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      // Helmet adds various security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
