/**
 * @module @skillancer/auth-svc/__tests__/token.service.test
 * Unit tests for TokenService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { TokenService, resetTokenService } from '../services/token.service.js';
import { InvalidTokenError } from '../errors/index.js';

// Mock config
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
      emailVerificationTtl: 24 * 60 * 60 * 1000,
      passwordResetTtl: 60 * 60 * 1000,
    },
  }),
}));

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    resetTokenService();
    tokenService = new TokenService();
  });

  afterEach(() => {
    resetTokenService();
  });

  describe('Access Tokens', () => {
    const mockUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      roles: ['USER'],
      verificationLevel: 'EMAIL',
    };

    const mockSessionId = '550e8400-e29b-41d4-a716-446655440001';

    it('should generate a valid access token', () => {
      const token = tokenService.generateAccessToken(mockUser, mockSessionId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should verify a valid access token', () => {
      const token = tokenService.generateAccessToken(mockUser, mockSessionId);
      const payload = tokenService.verifyAccessToken(token);

      expect(payload.sub).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.firstName).toBe(mockUser.firstName);
      expect(payload.lastName).toBe(mockUser.lastName);
      expect(payload.roles).toEqual(mockUser.roles);
      expect(payload.sessionId).toBe(mockSessionId);
      expect(payload.verificationLevel).toBe(mockUser.verificationLevel);
    });

    it('should throw InvalidTokenError for invalid token', () => {
      expect(() => tokenService.verifyAccessToken('invalid-token')).toThrow(InvalidTokenError);
    });

    it('should throw InvalidTokenError for tampered token', () => {
      const token = tokenService.generateAccessToken(mockUser, mockSessionId);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => tokenService.verifyAccessToken(tamperedToken)).toThrow(InvalidTokenError);
    });

    it('should decode token without verification', () => {
      const token = tokenService.generateAccessToken(mockUser, mockSessionId);
      const payload = tokenService.decodeAccessToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(mockUser.id);
    });

    it('should return null for invalid token when decoding', () => {
      const payload = tokenService.decodeAccessToken('invalid-token');

      expect(payload).toBeNull();
    });
  });

  describe('Refresh Tokens', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const sessionId = '550e8400-e29b-41d4-a716-446655440001';

    it('should generate a valid refresh token', () => {
      const { token, tokenId } = tokenService.generateRefreshToken(userId, sessionId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(tokenId).toBeDefined();
      expect(typeof tokenId).toBe('string');
    });

    it('should verify a valid refresh token', () => {
      const { token, tokenId } = tokenService.generateRefreshToken(userId, sessionId);
      const payload = tokenService.verifyRefreshToken(token);

      expect(payload.sub).toBe(userId);
      expect(payload.sessionId).toBe(sessionId);
      expect(payload.tokenId).toBe(tokenId);
      expect(payload.type).toBe('refresh');
    });

    it('should throw InvalidTokenError for invalid refresh token', () => {
      expect(() => tokenService.verifyRefreshToken('invalid-token')).toThrow(InvalidTokenError);
    });

    it('should throw InvalidTokenError when using access token as refresh token', () => {
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        roles: ['USER'],
        verificationLevel: 'EMAIL',
      };

      const accessToken = tokenService.generateAccessToken(mockUser, sessionId);

      expect(() => tokenService.verifyRefreshToken(accessToken)).toThrow(InvalidTokenError);
    });
  });

  describe('Token Pair', () => {
    const mockUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      roles: ['USER'],
      verificationLevel: 'EMAIL',
    };

    const mockSessionId = '550e8400-e29b-41d4-a716-446655440001';

    it('should generate both access and refresh tokens', () => {
      const tokenPair = tokenService.generateTokenPair(mockUser, mockSessionId);

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresIn).toBeGreaterThan(0);
      expect(tokenPair.tokenType).toBe('Bearer');
      expect(tokenPair.tokenId).toBeDefined();
    });

    it('should generate tokens that can be verified', () => {
      const tokenPair = tokenService.generateTokenPair(mockUser, mockSessionId);

      const accessPayload = tokenService.verifyAccessToken(tokenPair.accessToken);
      const refreshPayload = tokenService.verifyRefreshToken(tokenPair.refreshToken);

      expect(accessPayload.sub).toBe(mockUser.id);
      expect(refreshPayload.sub).toBe(mockUser.id);
      expect(accessPayload.sessionId).toBe(mockSessionId);
      expect(refreshPayload.sessionId).toBe(mockSessionId);
    });
  });

  describe('Email Verification Tokens', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';

    it('should generate email verification token', () => {
      const { token, expiresAt } = tokenService.generateEmailVerificationToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should verify valid email verification token', () => {
      const { token } = tokenService.generateEmailVerificationToken(userId);
      const result = tokenService.verifyEmailVerificationToken(token);

      expect(result.userId).toBe(userId);
      expect(result.token).toBeDefined();
    });

    it('should throw for tampered verification token', () => {
      const { token } = tokenService.generateEmailVerificationToken(userId);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => tokenService.verifyEmailVerificationToken(tamperedToken)).toThrow(
        InvalidTokenError
      );
    });

    it('should throw for invalid verification token', () => {
      expect(() => tokenService.verifyEmailVerificationToken('invalid')).toThrow(InvalidTokenError);
    });
  });

  describe('Password Reset Tokens', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';

    it('should generate password reset token', () => {
      const { token, expiresAt } = tokenService.generatePasswordResetToken(userId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should verify valid password reset token', () => {
      const { token } = tokenService.generatePasswordResetToken(userId);
      const result = tokenService.verifyPasswordResetToken(token);

      expect(result.userId).toBe(userId);
      expect(result.token).toBeDefined();
    });

    it('should throw for tampered reset token', () => {
      const { token } = tokenService.generatePasswordResetToken(userId);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => tokenService.verifyPasswordResetToken(tamperedToken)).toThrow(InvalidTokenError);
    });

    it('should throw for invalid reset token', () => {
      expect(() => tokenService.verifyPasswordResetToken('invalid')).toThrow(InvalidTokenError);
    });

    it('should not accept email verification token as password reset', () => {
      const { token } = tokenService.generateEmailVerificationToken(userId);

      expect(() => tokenService.verifyPasswordResetToken(token)).toThrow(InvalidTokenError);
    });
  });

  describe('Utility Methods', () => {
    it('should generate secure random tokens', () => {
      const token1 = tokenService.generateSecureToken();
      const token2 = tokenService.generateSecureToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate tokens of specified length', () => {
      const token = tokenService.generateSecureToken(16);

      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should return expiration times in seconds', () => {
      const accessExpiry = tokenService.getAccessTokenExpiresIn();
      const refreshExpiry = tokenService.getRefreshTokenExpiresIn();

      expect(accessExpiry).toBe(3600); // 1h = 3600s
      expect(refreshExpiry).toBe(7 * 24 * 3600); // 7d = 604800s
    });
  });
});
