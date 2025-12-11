/**
 * @module @skillancer/auth-svc/__tests__/oauth.service.test
 * Unit tests for OAuthService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';

// Mock CacheService
const mockCacheService = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@skillancer/cache', () => ({
  CacheService: vi.fn(() => mockCacheService),
  SessionStore: vi.fn(() => ({})),
}));

// Mock ioredis
const mockRedis = {};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));

// Mock logger
vi.mock('@skillancer/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  })),
}));

// Mock config
vi.mock('../config/index.js', () => ({
  getConfig: vi.fn(() => ({
    oauth: {
      google: {
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        callbackUrl: 'http://localhost:3001/auth/oauth/google/callback',
      },
      microsoft: {
        clientId: 'microsoft-client-id',
        clientSecret: 'microsoft-client-secret',
        callbackUrl: 'http://localhost:3001/auth/oauth/microsoft/callback',
        tenantId: 'common',
      },
      apple: {
        clientId: 'apple-client-id',
        teamId: 'apple-team-id',
        keyId: 'apple-key-id',
        privateKey: 'apple-private-key',
        callbackUrl: 'http://localhost:3001/auth/oauth/apple/callback',
      },
    },
    jwt: {
      accessTokenSecret: 'access-secret',
      refreshTokenSecret: 'refresh-secret',
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '7d',
    },
    redis: {
      url: 'redis://localhost:6379',
    },
    security: {
      sessionTtl: 86400,
    },
  })),
}));

// Mock TokenService
const mockTokenService = {
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  generateTokenPair: vi.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer',
    tokenId: 'mock-token-id',
  }),
};

vi.mock('../services/token.service.js', () => ({
  TokenService: vi.fn(() => mockTokenService),
  getTokenService: vi.fn(() => mockTokenService),
}));

// Mock SessionService
const mockSessionService = {
  createSession: vi.fn().mockResolvedValue({
    sessionId: 'mock-session-id',
    userId: 'mock-user-id',
    roles: ['USER'],
    deviceInfo: {},
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400 * 1000),
  }),
  invalidateSession: vi.fn(),
  invalidateAllUserSessions: vi.fn(),
};

vi.mock('../services/session.service.js', () => ({
  SessionService: vi.fn(() => mockSessionService),
  getSessionService: vi.fn(() => mockSessionService),
}));

import { OAuthService } from '../services/oauth.service.js';
import { OAuthError } from '../errors/index.js';

describe('OAuthService', () => {
  let oauthService: OAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    oauthService = new OAuthService(mockRedis as unknown as Redis);
  });

  describe('getGoogleAuthUrl', () => {
    it('should return valid Google OAuth URL', async () => {
      const result = await oauthService.getGoogleAuthUrl();

      expect(result.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.url).toContain('client_id=google-client-id');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('scope=');
      expect(result.state).toBeDefined();
    });

    it('should include required scopes', async () => {
      const result = await oauthService.getGoogleAuthUrl();

      expect(result.url).toContain('email');
      expect(result.url).toContain('profile');
    });

    it('should store state in cache', async () => {
      await oauthService.getGoogleAuthUrl();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('oauth:state:'),
        expect.objectContaining({ provider: 'google' }),
        expect.objectContaining({ ttl: expect.any(Number) })
      );
    });
  });

  describe('getMicrosoftAuthUrl', () => {
    it('should return valid Microsoft OAuth URL', async () => {
      const result = await oauthService.getMicrosoftAuthUrl();

      expect(result.url).toContain('https://login.microsoftonline.com');
      expect(result.url).toContain('client_id=microsoft-client-id');
      expect(result.url).toContain('response_type=code');
      expect(result.state).toBeDefined();
    });

    it('should include tenant ID in URL', async () => {
      const result = await oauthService.getMicrosoftAuthUrl();

      expect(result.url).toContain('/common/oauth2/v2.0/authorize');
    });

    it('should store state in cache', async () => {
      await oauthService.getMicrosoftAuthUrl();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('oauth:state:'),
        expect.objectContaining({ provider: 'microsoft' }),
        expect.objectContaining({ ttl: expect.any(Number) })
      );
    });
  });

  describe('getAppleAuthUrl', () => {
    it('should return valid Apple OAuth URL', async () => {
      const result = await oauthService.getAppleAuthUrl();

      expect(result.url).toContain('https://appleid.apple.com/auth/authorize');
      expect(result.url).toContain('client_id=apple-client-id');
      expect(result.url).toContain('response_type=code');
      expect(result.state).toBeDefined();
    });

    it('should include response_mode=form_post for Apple', async () => {
      const result = await oauthService.getAppleAuthUrl();

      expect(result.url).toContain('response_mode=form_post');
    });

    it('should store state in cache', async () => {
      await oauthService.getAppleAuthUrl();

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('oauth:state:'),
        expect.objectContaining({ provider: 'apple' }),
        expect.objectContaining({ ttl: expect.any(Number) })
      );
    });
  });

  describe('handleGoogleCallback', () => {
    const mockDeviceInfo = {
      userAgent: 'Mozilla/5.0',
      ip: '192.168.1.1',
    };

    it('should reject invalid state', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        oauthService.handleGoogleCallback('code', 'invalid-state', mockDeviceInfo)
      ).rejects.toThrow(OAuthError);
    });

    it('should reject wrong provider state', async () => {
      mockCacheService.get.mockResolvedValue({ provider: 'microsoft' });

      await expect(
        oauthService.handleGoogleCallback('code', 'some-state', mockDeviceInfo)
      ).rejects.toThrow(OAuthError);
    });
  });

  describe('handleMicrosoftCallback', () => {
    const mockDeviceInfo = {
      userAgent: 'Mozilla/5.0',
      ip: '192.168.1.1',
    };

    it('should reject invalid state', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        oauthService.handleMicrosoftCallback('code', 'invalid-state', mockDeviceInfo)
      ).rejects.toThrow(OAuthError);
    });

    it('should reject wrong provider state', async () => {
      mockCacheService.get.mockResolvedValue({ provider: 'google' });

      await expect(
        oauthService.handleMicrosoftCallback('code', 'some-state', mockDeviceInfo)
      ).rejects.toThrow(OAuthError);
    });
  });

  describe('handleAppleCallback', () => {
    const mockDeviceInfo = {
      userAgent: 'Mozilla/5.0',
      ip: '192.168.1.1',
    };

    it('should reject invalid state', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        oauthService.handleAppleCallback('code', 'invalid-state', mockDeviceInfo)
      ).rejects.toThrow(OAuthError);
    });

    it('should reject wrong provider state', async () => {
      mockCacheService.get.mockResolvedValue({ provider: 'google' });

      await expect(
        oauthService.handleAppleCallback('code', 'some-state', mockDeviceInfo)
      ).rejects.toThrow(OAuthError);
    });
  });

  describe('state management', () => {
    it('should generate unique state for each auth URL', async () => {
      const result1 = await oauthService.getGoogleAuthUrl();
      const result2 = await oauthService.getGoogleAuthUrl();

      expect(result1.state).not.toBe(result2.state);
    });

    it('should expire state after timeout', async () => {
      await oauthService.getGoogleAuthUrl();

      // State should expire in 10 minutes (600 seconds)
      const setCall = mockCacheService.set.mock.calls[0];
      expect(setCall[2].ttl).toBe(600);
    });
  });
});
