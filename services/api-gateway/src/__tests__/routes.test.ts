/**
 * @module @skillancer/api-gateway/tests/routes
 * Service routes configuration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getServiceRoutes,
  getServiceRoute,
  getServiceUrl,
} from '../config/routes.js';
import { clearConfigCache } from '../config/index.js';

describe('Service Routes', () => {
  beforeEach(() => {
    clearConfigCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearConfigCache();
  });

  describe('getServiceRoutes', () => {
    it('should return all service routes', () => {
      const routes = getServiceRoutes();

      expect(routes).toBeInstanceOf(Array);
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should have auth service route', () => {
      const routes = getServiceRoutes();
      const authRoute = routes.find((r) => r.serviceName === 'auth');

      expect(authRoute).toBeDefined();
      expect(authRoute?.prefix).toBe('/api/auth');
      expect(authRoute?.auth).toBe('none');
      expect(authRoute?.rateLimit).toBeDefined();
    });

    it('should have market service route', () => {
      const routes = getServiceRoutes();
      const marketRoute = routes.find((r) => r.serviceName === 'market');

      expect(marketRoute).toBeDefined();
      expect(marketRoute?.prefix).toBe('/api/market');
      expect(marketRoute?.auth).toBe('optional');
    });

    it('should have protected routes requiring authentication', () => {
      const routes = getServiceRoutes();
      const protectedRoutes = routes.filter((r) => r.auth === 'required');

      expect(protectedRoutes.length).toBeGreaterThan(0);
      expect(protectedRoutes.map((r) => r.serviceName)).toContain('skillpod');
      expect(protectedRoutes.map((r) => r.serviceName)).toContain('cockpit');
      expect(protectedRoutes.map((r) => r.serviceName)).toContain('billing');
    });

    it('should have appropriate timeouts for each service', () => {
      const routes = getServiceRoutes();

      const authRoute = routes.find((r) => r.serviceName === 'auth');
      const billingRoute = routes.find((r) => r.serviceName === 'billing');

      // Auth should have shorter timeout
      expect(authRoute?.timeout).toBeLessThanOrEqual(15000);
      // Billing should have longer timeout for payment operations
      expect(billingRoute?.timeout).toBeGreaterThanOrEqual(60000);
    });

    it('should have retry configuration', () => {
      const routes = getServiceRoutes();

      // Billing should not have retries (payment idempotency)
      const billingRoute = routes.find((r) => r.serviceName === 'billing');
      expect(billingRoute?.retries).toBe(0);

      // Other services should have retries
      const marketRoute = routes.find((r) => r.serviceName === 'market');
      expect(marketRoute?.retries).toBeGreaterThan(0);
    });
  });

  describe('getServiceRoute', () => {
    it('should return service route by name', () => {
      const authRoute = getServiceRoute('auth');

      expect(authRoute).toBeDefined();
      expect(authRoute?.serviceName).toBe('auth');
    });

    it('should return undefined for unknown service', () => {
      const unknownRoute = getServiceRoute('unknown-service');

      expect(unknownRoute).toBeUndefined();
    });
  });

  describe('getServiceUrl', () => {
    it('should return upstream URL for service', () => {
      const authUrl = getServiceUrl('auth');

      expect(authUrl).toBeDefined();
      expect(authUrl).toMatch(/^http/);
    });

    it('should return undefined for unknown service', () => {
      const unknownUrl = getServiceUrl('unknown-service');

      expect(unknownUrl).toBeUndefined();
    });

    it('should use environment variables for service URLs', () => {
      clearConfigCache();
      vi.stubEnv('AUTH_SERVICE_URL', 'http://custom-auth:3001');

      const authUrl = getServiceUrl('auth');

      expect(authUrl).toBe('http://custom-auth:3001');
    });
  });
});
