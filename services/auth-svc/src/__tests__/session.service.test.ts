/**
 * @module @skillancer/auth-svc/__tests__/session.service.test
 * Unit tests for SessionService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SessionService } from '../services/session.service.js';

import type { Redis } from 'ioredis';

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

// Mock SessionStore from @skillancer/cache
const mockSessionStore = {
  create: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  deleteUserSessions: vi.fn().mockResolvedValue(undefined),
  getUserSessions: vi.fn().mockResolvedValue([]),
  exists: vi.fn().mockResolvedValue(true),
  refresh: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@skillancer/cache', () => ({
  SessionStore: vi.fn(() => mockSessionStore),
  CacheService: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock config
vi.mock('../config/index.js', () => ({
  getConfig: vi.fn(() => ({
    redis: {
      url: 'redis://localhost:6379',
    },
    jwt: {
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '7d',
    },
    security: {
      sessionTtl: 86400, // 24 hours in seconds
      lockoutThreshold: 5,
      lockoutDuration: 900, // 15 minutes in seconds
    },
  })),
}));

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionService = new SessionService(mockRedis as unknown as Redis);
  });

  describe('createSession', () => {
    const input = {
      userId: 'user-123',
      roles: ['USER'],
      deviceInfo: {
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      },
    };

    it('should create session and return session info', async () => {
      const result = await sessionService.createSession(input);

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('string');
      expect(result.userId).toBe('user-123');
      expect(result.roles).toEqual(['USER']);
      expect(mockSessionStore.create).toHaveBeenCalled();
    });

    it('should call SessionStore.create with correct data', async () => {
      await sessionService.createSession(input);

      expect(mockSessionStore.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user-123',
          roles: ['USER'],
          deviceInfo: expect.objectContaining({
            userAgent: 'Mozilla/5.0',
            ip: '192.168.1.1',
          }),
        })
      );
    });

    it('should include optional tenantId when provided', async () => {
      const inputWithTenant = { ...input, tenantId: 'tenant-123' };

      const result = await sessionService.createSession(inputWithTenant);

      expect(result.tenantId).toBe('tenant-123');
      expect(mockSessionStore.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tenantId: 'tenant-123',
        })
      );
    });
  });

  describe('getSession', () => {
    const mockSessionData = {
      userId: 'user-123',
      roles: ['USER'],
      deviceInfo: { userAgent: 'test', ip: '127.0.0.1' },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400 * 1000),
      lastActivityAt: new Date(),
      tenantId: undefined,
      metadata: { refreshTokenId: 'token-123' },
    };

    it('should return session data when session exists', async () => {
      mockSessionStore.get.mockResolvedValue(mockSessionData);

      const result = await sessionService.getSession('session-id');

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-123');
      expect(result?.sessionId).toBe('session-id');
      expect(result?.roles).toEqual(['USER']);
    });

    it('should return null when session does not exist', async () => {
      mockSessionStore.get.mockResolvedValue(null);

      const result = await sessionService.getSession('nonexistent-session');

      expect(result).toBeNull();
    });

    it('should extract refreshTokenId from metadata', async () => {
      mockSessionStore.get.mockResolvedValue(mockSessionData);

      const result = await sessionService.getSession('session-id');

      expect(result?.refreshTokenId).toBe('token-123');
    });
  });

  describe('validateSession', () => {
    const mockSessionData = {
      userId: 'user-123',
      roles: ['USER'],
      deviceInfo: { userAgent: 'test', ip: '127.0.0.1' },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400 * 1000),
      lastActivityAt: new Date(),
    };

    it('should return session info when valid', async () => {
      mockSessionStore.get.mockResolvedValue(mockSessionData);

      const result = await sessionService.validateSession('session-id');

      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
    });

    it('should throw SessionExpiredError when session not found', async () => {
      mockSessionStore.get.mockResolvedValue(null);

      await expect(sessionService.validateSession('invalid-session')).rejects.toThrow(
        'Session expired'
      );
    });
  });

  describe('refreshSession', () => {
    it('should refresh session TTL when session exists', async () => {
      mockSessionStore.exists.mockResolvedValue(true);

      await sessionService.refreshSession('session-id');

      expect(mockSessionStore.refresh).toHaveBeenCalledWith('session-id', 86400);
    });

    it('should throw SessionExpiredError when session not found', async () => {
      mockSessionStore.exists.mockResolvedValue(false);

      await expect(sessionService.refreshSession('nonexistent-session')).rejects.toThrow(
        'Session expired'
      );
    });
  });

  describe('invalidateSession', () => {
    it('should delete session from store', async () => {
      await sessionService.invalidateSession('session-id');

      expect(mockSessionStore.delete).toHaveBeenCalledWith('session-id');
    });
  });

  describe('invalidateAllUserSessions', () => {
    it('should delete all sessions for user', async () => {
      await sessionService.invalidateAllUserSessions('user-123');

      expect(mockSessionStore.deleteUserSessions).toHaveBeenCalledWith('user-123');
    });
  });

  describe('invalidateOtherSessions', () => {
    it('should delete all sessions except current one', async () => {
      mockSessionStore.getUserSessions.mockResolvedValue([
        'session-1',
        'session-2',
        'current-session',
      ]);

      await sessionService.invalidateOtherSessions('user-123', 'current-session');

      expect(mockSessionStore.delete).toHaveBeenCalledWith('session-1');
      expect(mockSessionStore.delete).toHaveBeenCalledWith('session-2');
      expect(mockSessionStore.delete).not.toHaveBeenCalledWith('current-session');
    });

    it('should not delete anything when only current session exists', async () => {
      mockSessionStore.getUserSessions.mockResolvedValue(['current-session']);

      await sessionService.invalidateOtherSessions('user-123', 'current-session');

      expect(mockSessionStore.delete).not.toHaveBeenCalled();
    });
  });

  describe('getUserSessions', () => {
    it('should return all active sessions for user', async () => {
      const mockSessionData = {
        userId: 'user-123',
        roles: ['USER'],
        deviceInfo: { userAgent: 'test', ip: '127.0.0.1' },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
      };

      mockSessionStore.getUserSessions.mockResolvedValue(['session-1', 'session-2']);
      mockSessionStore.get.mockResolvedValue(mockSessionData);

      const sessions = await sessionService.getUserSessions('user-123');

      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.sessionId).toBe('session-1');
      expect(sessions[1]?.sessionId).toBe('session-2');
    });

    it('should return empty array when no sessions', async () => {
      mockSessionStore.getUserSessions.mockResolvedValue([]);

      const sessions = await sessionService.getUserSessions('user-123');

      expect(sessions).toHaveLength(0);
    });
  });

  describe('getUserSessionCount', () => {
    it('should return count of active sessions', async () => {
      mockSessionStore.getUserSessions.mockResolvedValue(['session-1', 'session-2', 'session-3']);

      const count = await sessionService.getUserSessionCount('user-123');

      expect(count).toBe(3);
    });

    it('should return 0 when no sessions', async () => {
      mockSessionStore.getUserSessions.mockResolvedValue([]);

      const count = await sessionService.getUserSessionCount('user-123');

      expect(count).toBe(0);
    });
  });

  describe('isUserSession', () => {
    it('should return true when session belongs to user', async () => {
      mockSessionStore.get.mockResolvedValue({
        userId: 'user-123',
        roles: ['USER'],
        deviceInfo: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
      });

      const result = await sessionService.isUserSession('session-id', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false when session belongs to different user', async () => {
      mockSessionStore.get.mockResolvedValue({
        userId: 'other-user',
        roles: ['USER'],
        deviceInfo: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
      });

      const result = await sessionService.isUserSession('session-id', 'user-123');

      expect(result).toBe(false);
    });

    it('should return false when session does not exist', async () => {
      mockSessionStore.get.mockResolvedValue(null);

      const result = await sessionService.isUserSession('session-id', 'user-123');

      expect(result).toBe(false);
    });
  });

  describe('updateRefreshTokenId', () => {
    it('should update session metadata with new refresh token ID', async () => {
      const mockSessionData = {
        userId: 'user-123',
        roles: ['USER'],
        deviceInfo: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400 * 1000),
        lastActivityAt: new Date(),
        metadata: { oldKey: 'value' },
      };
      mockSessionStore.get.mockResolvedValue(mockSessionData);

      await sessionService.updateRefreshTokenId('session-id', 'new-token-id');

      expect(mockSessionStore.update).toHaveBeenCalledWith('session-id', {
        metadata: {
          oldKey: 'value',
          refreshTokenId: 'new-token-id',
        },
      });
    });

    it('should throw SessionExpiredError when session not found', async () => {
      mockSessionStore.get.mockResolvedValue(null);

      await expect(
        sessionService.updateRefreshTokenId('invalid-session', 'token-id')
      ).rejects.toThrow('Session expired');
    });
  });
});
