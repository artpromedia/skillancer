import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, TestClient } from '@skillancer/testing';
import type { User, Session } from '@skillancer/types';

/**
 * Authentication Flow Integration Tests
 * Tests complete auth flows across all services
 */

describe('Authentication Flow Integration', () => {
  let client: TestClient;
  let testUser: { email: string; password: string };

  beforeAll(async () => {
    client = await createTestClient();
    testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
    };
  });

  afterAll(async () => {
    await client.cleanup();
  });

  describe('User Registration', () => {
    it('should register a new user', async () => {
      const response = await client.post('/api/auth/register', {
        email: testUser.email,
        password: testUser.password,
        firstName: 'Test',
        lastName: 'User',
        role: 'freelancer',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('user');
      expect(response.data.user.email).toBe(testUser.email);
      expect(response.data).toHaveProperty('message', 'Verification email sent');
    });

    it('should reject duplicate email registration', async () => {
      const response = await client.post('/api/auth/register', {
        email: testUser.email,
        password: testUser.password,
        firstName: 'Another',
        lastName: 'User',
        role: 'freelancer',
      });

      expect(response.status).toBe(409);
      expect(response.data.error).toMatch(/already exists|registered/i);
    });

    it('should validate password strength', async () => {
      const response = await client.post('/api/auth/register', {
        email: 'weak@example.com',
        password: '123',
        firstName: 'Weak',
        lastName: 'Password',
        role: 'freelancer',
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toMatch(/password/i);
    });

    it('should validate email format', async () => {
      const response = await client.post('/api/auth/register', {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        firstName: 'Invalid',
        lastName: 'Email',
        role: 'freelancer',
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toMatch(/email/i);
    });
  });

  describe('Email Verification', () => {
    it('should verify email with valid token', async () => {
      const token = await client.getVerificationToken(testUser.email);

      const response = await client.post('/api/auth/verify-email', { token });

      expect(response.status).toBe(200);
      expect(response.data.verified).toBe(true);
    });

    it('should reject invalid verification token', async () => {
      const response = await client.post('/api/auth/verify-email', {
        token: 'invalid-token-123',
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toMatch(/invalid|expired/i);
    });

    it('should reject expired verification token', async () => {
      const expiredToken = await client.getExpiredVerificationToken();

      const response = await client.post('/api/auth/verify-email', {
        token: expiredToken,
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toMatch(/expired/i);
    });
  });

  describe('User Login', () => {
    it('should login with valid credentials', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('refreshToken');
      expect(response.data).toHaveProperty('user');
    });

    it('should reject invalid password', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.data.error).toMatch(/invalid|incorrect/i);
    });

    it('should reject non-existent user', async () => {
      const response = await client.post('/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'anypassword',
      });

      expect(response.status).toBe(401);
    });

    it('should set secure HTTP-only cookies', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });

      expect(response.headers['set-cookie']).toBeDefined();
      expect(
        response.headers['set-cookie'].some(
          (c: string) => c.includes('HttpOnly') && c.includes('Secure')
        )
      ).toBe(true);
    });

    it('should track login attempt on failure', async () => {
      for (let i = 0; i < 3; i++) {
        await client.post('/api/auth/login', {
          email: testUser.email,
          password: 'wrongpassword',
        });
      }

      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'wrongpassword',
      });

      expect(response.status).toBe(429);
      expect(response.data.error).toMatch(/too many|locked|rate limit/i);
    });
  });

  describe('Token Refresh', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      const loginResponse = await client.post('/api/auth/login', {
        email: testUser.email,
        password: testUser.password,
      });
      accessToken = loginResponse.data.accessToken;
      refreshToken = loginResponse.data.refreshToken;
    });

    it('should refresh access token', async () => {
      const response = await client.post('/api/auth/refresh', {
        refreshToken,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data.accessToken).not.toBe(accessToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await client.post('/api/auth/refresh', {
        refreshToken: 'invalid-refresh-token',
      });

      expect(response.status).toBe(401);
    });

    it('should reject expired refresh token', async () => {
      const expiredToken = await client.getExpiredRefreshToken();

      const response = await client.post('/api/auth/refresh', {
        refreshToken: expiredToken,
      });

      expect(response.status).toBe(401);
      expect(response.data.error).toMatch(/expired/i);
    });
  });

  describe('Password Reset', () => {
    it('should send password reset email', async () => {
      const response = await client.post('/api/auth/forgot-password', {
        email: testUser.email,
      });

      expect(response.status).toBe(200);
      expect(response.data.message).toMatch(/email.*sent|check.*inbox/i);
    });

    it('should not reveal user existence on reset request', async () => {
      const response = await client.post('/api/auth/forgot-password', {
        email: 'nonexistent@example.com',
      });

      expect(response.status).toBe(200);
      expect(response.data.message).toMatch(/email.*sent|check.*inbox/i);
    });

    it('should reset password with valid token', async () => {
      const resetToken = await client.getPasswordResetToken(testUser.email);

      const response = await client.post('/api/auth/reset-password', {
        token: resetToken,
        newPassword: 'NewSecurePassword123!',
      });

      expect(response.status).toBe(200);
      expect(response.data.message).toMatch(/password.*reset|updated/i);
    });

    it('should login with new password after reset', async () => {
      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'NewSecurePassword123!',
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('accessToken');
    });
  });

  describe('MFA Setup and Verification', () => {
    let mfaSecret: string;

    it('should enable MFA setup', async () => {
      await client.authenticate(testUser.email, 'NewSecurePassword123!');

      const response = await client.post('/api/auth/mfa/setup');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('secret');
      expect(response.data).toHaveProperty('qrCode');
      mfaSecret = response.data.secret;
    });

    it('should verify MFA setup with valid code', async () => {
      const totpCode = client.generateTOTP(mfaSecret);

      const response = await client.post('/api/auth/mfa/verify', {
        code: totpCode,
      });

      expect(response.status).toBe(200);
      expect(response.data.mfaEnabled).toBe(true);
    });

    it('should require MFA on login when enabled', async () => {
      await client.logout();

      const response = await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'NewSecurePassword123!',
      });

      expect(response.status).toBe(200);
      expect(response.data.requiresMfa).toBe(true);
      expect(response.data).not.toHaveProperty('accessToken');
    });

    it('should complete login with valid MFA code', async () => {
      const loginResponse = await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'NewSecurePassword123!',
      });

      const totpCode = client.generateTOTP(mfaSecret);

      const response = await client.post('/api/auth/mfa/authenticate', {
        mfaToken: loginResponse.data.mfaToken,
        code: totpCode,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('accessToken');
    });
  });

  describe('Session Management', () => {
    beforeAll(async () => {
      await client.authenticate(testUser.email, 'NewSecurePassword123!');
    });

    it('should list active sessions', async () => {
      const response = await client.get('/api/auth/sessions');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.sessions)).toBe(true);
      expect(response.data.sessions.length).toBeGreaterThan(0);
    });

    it('should show current session details', async () => {
      const response = await client.get('/api/auth/sessions');

      const currentSession = response.data.sessions.find((s: Session) => s.isCurrent);
      expect(currentSession).toBeDefined();
      expect(currentSession).toHaveProperty('device');
      expect(currentSession).toHaveProperty('lastActive');
    });

    it('should revoke specific session', async () => {
      // Create another session
      const loginResponse = await client.post('/api/auth/login', {
        email: testUser.email,
        password: 'NewSecurePassword123!',
      });

      const sessionsResponse = await client.get('/api/auth/sessions');
      const otherSession = sessionsResponse.data.sessions.find((s: Session) => !s.isCurrent);

      const response = await client.delete(`/api/auth/sessions/${otherSession.id}`);

      expect(response.status).toBe(200);
    });

    it('should revoke all other sessions', async () => {
      const response = await client.post('/api/auth/sessions/revoke-all');

      expect(response.status).toBe(200);

      const sessionsResponse = await client.get('/api/auth/sessions');
      expect(sessionsResponse.data.sessions.length).toBe(1);
    });
  });

  describe('Logout', () => {
    it('should logout and invalidate tokens', async () => {
      await client.authenticate(testUser.email, 'NewSecurePassword123!');

      const response = await client.post('/api/auth/logout');

      expect(response.status).toBe(200);

      // Token should be invalid
      const protectedResponse = await client.get('/api/me');
      expect(protectedResponse.status).toBe(401);
    });

    it('should clear cookies on logout', async () => {
      await client.authenticate(testUser.email, 'NewSecurePassword123!');

      const response = await client.post('/api/auth/logout');

      expect(response.headers['set-cookie']).toBeDefined();
      expect(
        response.headers['set-cookie'].some(
          (c: string) => c.includes('Max-Age=0') || c.includes('expires=Thu, 01 Jan 1970')
        )
      ).toBe(true);
    });
  });

  describe('OAuth Integration', () => {
    it('should initiate Google OAuth flow', async () => {
      const response = await client.get('/api/auth/oauth/google');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('accounts.google.com');
    });

    it('should initiate GitHub OAuth flow', async () => {
      const response = await client.get('/api/auth/oauth/github');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('github.com');
    });

    it('should handle OAuth callback', async () => {
      const mockOAuthCode = await client.getMockOAuthCode('google');

      const response = await client.get(`/api/auth/oauth/google/callback?code=${mockOAuthCode}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('/dashboard');
    });

    it('should link OAuth to existing account', async () => {
      await client.authenticate(testUser.email, 'NewSecurePassword123!');

      const response = await client.post('/api/auth/oauth/link/google', {
        idToken: await client.getMockGoogleIdToken(),
      });

      expect(response.status).toBe(200);
      expect(response.data.linked).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const attempts = [];
      for (let i = 0; i < 15; i++) {
        attempts.push(
          client.post('/api/auth/login', {
            email: 'ratelimit@test.com',
            password: 'anypassword',
          })
        );
      }

      const responses = await Promise.all(attempts);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should rate limit password reset requests', async () => {
      const attempts = [];
      for (let i = 0; i < 10; i++) {
        attempts.push(
          client.post('/api/auth/forgot-password', {
            email: 'ratelimit@test.com',
          })
        );
      }

      const responses = await Promise.all(attempts);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await client.get('/api/auth/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });
});
