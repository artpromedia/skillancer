/**
 * @module @skillancer/auth-svc/__tests__/auth.service.test
 * Unit tests for AuthService
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable import/order */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import bcrypt from 'bcrypt';

import {
  InvalidCredentialsError,
  AccountLockedError,
  AccountSuspendedError,
  EmailExistsError,
  InvalidTokenError,
} from '../errors/index.js';

// Mock dependencies
vi.mock('@skillancer/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('@skillancer/cache', () => ({
  CacheService: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('../config/index.js', () => ({
  getConfig: () => ({
    jwt: {
      secret: 'test-secret-key-that-is-at-least-32-chars-long',
      accessTokenExpiresIn: '1h',
      refreshTokenExpiresIn: '7d',
      issuer: 'skillancer-test',
      audience: 'skillancer-api-test',
    },
    security: {
      bcryptRounds: 10,
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000,
      sessionTtl: 24 * 60 * 60,
      emailVerificationTtl: 24 * 60 * 60 * 1000,
      passwordResetTtl: 60 * 60 * 1000,
    },
    rateLimit: {
      login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
      registration: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
      passwordReset: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
    },
  }),
}));

vi.mock('../services/token.service.js', () => ({
  getTokenService: () => ({
    generateTokenPair: vi.fn().mockReturnValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
      tokenId: 'mock-token-id',
    }),
    generateEmailVerificationToken: vi.fn().mockReturnValue({
      token: 'mock-verification-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }),
    generatePasswordResetToken: vi.fn().mockReturnValue({
      token: 'mock-reset-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }),
    verifyEmailVerificationToken: vi.fn().mockReturnValue({
      userId: 'mock-user-id',
      token: 'mock-token',
    }),
    verifyPasswordResetToken: vi.fn().mockReturnValue({
      userId: 'mock-user-id',
      token: 'mock-token',
    }),
    verifyRefreshToken: vi.fn(),
    getRefreshTokenExpiresIn: vi.fn().mockReturnValue(7 * 24 * 60 * 60),
  }),
  resetTokenService: vi.fn(),
}));

// Create shared mock session service instance
const mockSessionService = {
  createSession: vi.fn().mockResolvedValue({
    sessionId: 'mock-session-id',
    userId: 'mock-user-id',
    roles: ['USER'],
    deviceInfo: { userAgent: 'test', ip: '127.0.0.1' },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }),
  getSession: vi.fn(),
  validateSession: vi.fn(),
  updateRefreshTokenId: vi.fn(),
  invalidateSession: vi.fn().mockResolvedValue(undefined),
  invalidateAllUserSessions: vi.fn().mockResolvedValue(undefined),
  refreshSession: vi.fn(),
};

vi.mock('../services/session.service.js', () => ({
  getSessionService: () => mockSessionService,
  resetSessionService: vi.fn(),
}));

// Import after mocking
import { prisma } from '@skillancer/database';
import { AuthService, resetAuthService } from '../services/auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let mockRedis: any;
  let mockCacheGet: Mock;
  let mockCacheSet: Mock;
  let mockCacheDelete: Mock;

  const mockDeviceInfo = {
    userAgent: 'Mozilla/5.0 (Test)',
    ip: '127.0.0.1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAuthService();

    mockCacheGet = vi.fn();
    mockCacheSet = vi.fn();
    mockCacheDelete = vi.fn();

    mockRedis = {};

    // Re-mock CacheService for each test
    const { CacheService } = vi.mocked(await import('@skillancer/cache'));
    (CacheService as Mock).mockImplementation(() => ({
      get: mockCacheGet,
      set: mockCacheSet,
      delete: mockCacheDelete,
    }));

    authService = new AuthService(mockRedis);
  });

  afterEach(() => {
    resetAuthService();
  });

  describe('register', () => {
    const validRegistration = {
      email: 'test@example.com',
      password: 'SecurePass123!@#',
      firstName: 'Test',
      lastName: 'User',
      timezone: 'UTC',
      locale: 'en',
    };

    it('should successfully register a new user', async () => {
      const mockUser = {
        id: 'mock-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        displayName: 'Test User',
        status: 'PENDING_VERIFICATION',
        verificationLevel: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.user.create as Mock).mockResolvedValue(mockUser);

      const result = await authService.register(validRegistration);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.verificationToken).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw EmailExistsError if email already registered', async () => {
      const existingUser = {
        id: 'existing-user-id',
        email: 'test@example.com',
      };

      (prisma.user.findUnique as Mock).mockResolvedValue(existingUser);

      await expect(authService.register(validRegistration)).rejects.toThrow(EmailExistsError);
    });

    it('should hash password before storing', async () => {
      const hashSpy = vi.spyOn(bcrypt, 'hash');

      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.user.create as Mock).mockResolvedValue({
        id: 'mock-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        status: 'PENDING_VERIFICATION',
        verificationLevel: 'NONE',
      });

      await authService.register(validRegistration);

      expect(hashSpy).toHaveBeenCalledWith(validRegistration.password, expect.any(Number));
    });

    it('should normalize email to lowercase', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.user.create as Mock).mockResolvedValue({
        id: 'mock-user-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        status: 'PENDING_VERIFICATION',
        verificationLevel: 'NONE',
      });

      await authService.register({
        ...validRegistration,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
          }),
        })
      );
    });
  });

  describe('login', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'SecurePass123!@#',
    };

    const mockUser = {
      id: 'mock-user-id',
      email: 'test@example.com',
      passwordHash: '$2b$10$hashedpassword',
      firstName: 'Test',
      lastName: 'User',
      displayName: 'Test User',
      avatarUrl: null,
      status: 'ACTIVE',
      verificationLevel: 'EMAIL',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully login with valid credentials', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (prisma.user.update as Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as Mock).mockResolvedValue({});
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockCacheGet.mockResolvedValue(null); // No lockout

      const result = await authService.login(
        validCredentials.email,
        validCredentials.password,
        mockDeviceInfo
      );

      // Type guard to check if result is LoginResult
      if ('mfaRequired' in result) {
        throw new Error('Expected LoginResult, got MfaPendingResult');
      }

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      mockCacheGet.mockResolvedValue(null);

      await expect(
        authService.login(validCredentials.email, validCredentials.password, mockDeviceInfo)
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
      mockCacheGet.mockResolvedValue(null);

      await expect(
        authService.login(validCredentials.email, 'wrongpassword', mockDeviceInfo)
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw AccountLockedError when locked out', async () => {
      const lockoutUntil = Date.now() + 10 * 60 * 1000; // 10 minutes from now
      mockCacheGet.mockResolvedValue(lockoutUntil);

      await expect(
        authService.login(validCredentials.email, validCredentials.password, mockDeviceInfo)
      ).rejects.toThrow(AccountLockedError);
    });

    it('should throw AccountSuspendedError for suspended user', async () => {
      const suspendedUser = { ...mockUser, status: 'SUSPENDED' };
      (prisma.user.findUnique as Mock).mockResolvedValue(suspendedUser);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockCacheGet.mockResolvedValue(null);

      await expect(
        authService.login(validCredentials.email, validCredentials.password, mockDeviceInfo)
      ).rejects.toThrow(AccountSuspendedError);
    });

    it('should update last login timestamp', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (prisma.user.update as Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as Mock).mockResolvedValue({});
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockCacheGet.mockResolvedValue(null);

      await authService.login(validCredentials.email, validCredentials.password, mockDeviceInfo);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('logout', () => {
    it('should invalidate session on logout', async () => {
      // Setup mock to return session data that matches the user
      mockSessionService.getSession.mockResolvedValue({
        sessionId: 'mock-session-id',
        userId: 'mock-user-id',
        refreshTokenId: 'mock-token-id',
      });

      await authService.logout('mock-session-id', 'mock-user-id');

      expect(mockSessionService.invalidateSession).toHaveBeenCalledWith('mock-session-id');
    });
  });

  describe('logoutAll', () => {
    it('should invalidate all user sessions', async () => {
      await authService.logoutAll('mock-user-id');

      expect(mockSessionService.invalidateAllUserSessions).toHaveBeenCalledWith('mock-user-id');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and update user status', async () => {
      mockCacheGet.mockResolvedValue({
        userId: 'mock-user-id',
        email: 'test@example.com',
      });

      const updatedUser = {
        id: 'mock-user-id',
        email: 'test@example.com',
        status: 'ACTIVE',
        verificationLevel: 'EMAIL',
      };

      (prisma.user.update as Mock).mockResolvedValue(updatedUser);

      const result = await authService.verifyEmail('mock-verification-token');

      expect(result.status).toBe('ACTIVE');
      expect(result.verificationLevel).toBe('EMAIL');
      expect(mockCacheDelete).toHaveBeenCalled();
    });

    it('should throw InvalidTokenError for invalid token', async () => {
      mockCacheGet.mockResolvedValue(null);

      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(InvalidTokenError);
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token for existing user', async () => {
      const mockUser = {
        id: 'mock-user-id',
        email: 'test@example.com',
      };

      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);

      const token = await authService.forgotPassword('test@example.com');

      expect(token).toBe('mock-reset-token');
      expect(mockCacheSet).toHaveBeenCalled();
    });

    it('should return null for non-existent user', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      const token = await authService.forgotPassword('nonexistent@example.com');

      expect(token).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockCacheGet.mockResolvedValue({
        userId: 'mock-user-id',
        email: 'test@example.com',
      });

      (prisma.user.update as Mock).mockResolvedValue({});
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({});

      await authService.resetPassword('mock-reset-token', 'NewSecurePass123!@#');

      expect(prisma.user.update).toHaveBeenCalled();
      expect(mockCacheDelete).toHaveBeenCalled();
      expect(mockSessionService.invalidateAllUserSessions).toHaveBeenCalled();
    });

    it('should throw InvalidTokenError for invalid token', async () => {
      mockCacheGet.mockResolvedValue(null);

      await expect(
        authService.resetPassword('invalid-token', 'NewSecurePass123!@#')
      ).rejects.toThrow(InvalidTokenError);
    });
  });
});
