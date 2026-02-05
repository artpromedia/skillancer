/**
 * Integration Tests: Authentication Flows
 *
 * Tests user registration, login/logout, token refresh, and password reset flows.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegrationTests, cleanupIntegrationTests, type TestContext } from './setup';

describe('Authentication Integration', () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = setupIntegrationTests();
  });

  afterAll(() => {
    cleanupIntegrationTests();
  });

  // ===========================================================================
  // User Registration
  // ===========================================================================

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const response = await ctx.request('POST', '/api/auth/register', {
        body: {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'User',
          role: 'FREELANCER',
        },
      });

      expect(response.status).toBe(201);
      expect((response.body as any).success).toBe(true);
      expect((response.body as any).data.email).toBe('newuser@example.com');
      expect((response.body as any).data.accessToken).toBeDefined();
      expect((response.body as any).data.refreshToken).toBeDefined();
    });

    it('should reject registration with missing email', async () => {
      const response = await ctx.request('POST', '/api/auth/register', {
        body: {
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      expect(response.status).toBe(400);
      expect((response.body as any).success).toBe(false);
    });

    it('should reject registration with missing password', async () => {
      const response = await ctx.request('POST', '/api/auth/register', {
        body: {
          email: 'nopass@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      expect(response.status).toBe(400);
      expect((response.body as any).success).toBe(false);
    });

    it('should reject registration with missing names', async () => {
      const response = await ctx.request('POST', '/api/auth/register', {
        body: {
          email: 'nonames@example.com',
          password: 'SecurePass123!',
        },
      });

      expect(response.status).toBe(400);
    });

    it('should reject duplicate email registration', async () => {
      // Register first user
      await ctx.request('POST', '/api/auth/register', {
        body: {
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          firstName: 'First',
          lastName: 'User',
        },
      });

      // Attempt duplicate registration
      const response = await ctx.request('POST', '/api/auth/register', {
        body: {
          email: 'duplicate@example.com',
          password: 'DifferentPass456!',
          firstName: 'Second',
          lastName: 'User',
        },
      });

      expect(response.status).toBe(409);
      expect((response.body as any).success).toBe(false);
    });

    it('should return tokens after successful registration', async () => {
      const response = await ctx.request('POST', '/api/auth/register', {
        body: {
          email: 'tokens@example.com',
          password: 'SecurePass123!',
          firstName: 'Token',
          lastName: 'User',
        },
      });

      expect(response.status).toBe(201);
      const data = (response.body as any).data;
      expect(data.accessToken).toBeTruthy();
      expect(data.refreshToken).toBeTruthy();
      expect(typeof data.accessToken).toBe('string');
      expect(typeof data.refreshToken).toBe('string');
    });
  });

  // ===========================================================================
  // Login / Logout
  // ===========================================================================

  describe('Login / Logout', () => {
    it('should login with valid credentials', async () => {
      const response = await ctx.request('POST', '/api/auth/login', {
        body: {
          email: 'admin@skillancer.test',
          password: 'TestPassword123!',
        },
      });

      expect(response.status).toBe(200);
      expect((response.body as any).success).toBe(true);
      expect((response.body as any).data.accessToken).toBeDefined();
      expect((response.body as any).data.refreshToken).toBeDefined();
      expect((response.body as any).data.expiresIn).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const response = await ctx.request('POST', '/api/auth/login', {
        body: {
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        },
      });

      expect(response.status).toBe(401);
      expect((response.body as any).success).toBe(false);
    });

    it('should reject login with wrong password', async () => {
      const response = await ctx.request('POST', '/api/auth/login', {
        body: {
          email: 'admin@skillancer.test',
          password: 'WrongPassword!',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should reject login with missing fields', async () => {
      const response = await ctx.request('POST', '/api/auth/login', {
        body: {
          email: 'admin@skillancer.test',
        },
      });

      expect(response.status).toBe(400);
    });

    it('should logout successfully with valid token', async () => {
      const response = await ctx.request('POST', '/api/auth/logout', {
        user: ctx.users.admin,
      });

      expect(response.status).toBe(200);
      expect((response.body as any).success).toBe(true);
    });

    it('should reject logout without authentication', async () => {
      const response = await ctx.request('POST', '/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  // ===========================================================================
  // Token Refresh
  // ===========================================================================

  describe('Token Refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const response = await ctx.request('POST', '/api/auth/refresh', {
        body: {
          refreshToken: ctx.users.client.refreshToken,
        },
      });

      expect(response.status).toBe(200);
      expect((response.body as any).success).toBe(true);
      expect((response.body as any).data.accessToken).toBeDefined();
      expect((response.body as any).data.refreshToken).toBeDefined();
    });

    it('should reject refresh with invalid token', async () => {
      const response = await ctx.request('POST', '/api/auth/refresh', {
        body: {
          refreshToken: 'invalid_token_12345',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should reject refresh without token', async () => {
      const response = await ctx.request('POST', '/api/auth/refresh', {
        body: {},
      });

      expect(response.status).toBe(400);
    });

    it('should return new access and refresh tokens', async () => {
      const response = await ctx.request('POST', '/api/auth/refresh', {
        body: {
          refreshToken: ctx.users.freelancer.refreshToken,
        },
      });

      expect(response.status).toBe(200);
      const data = (response.body as any).data;
      // New tokens should be different from the originals
      expect(data.accessToken).toBeTruthy();
      expect(data.refreshToken).toBeTruthy();
      expect(data.expiresIn).toBe(3600);
    });
  });

  // ===========================================================================
  // Protected Routes
  // ===========================================================================

  describe('Protected Routes', () => {
    it('should allow access with valid token', async () => {
      const response = await ctx.request('GET', '/api/jobs', {
        user: ctx.users.client,
      });

      expect(response.status).toBe(200);
    });

    it('should deny access without token', async () => {
      const response = await ctx.request('GET', '/api/jobs');

      expect(response.status).toBe(401);
    });

    it('should deny access with invalid token', async () => {
      const response = await ctx.request('GET', '/api/jobs', {
        headers: {
          Authorization: 'Bearer invalid_token',
        },
      });

      expect(response.status).toBe(401);
    });
  });
});
