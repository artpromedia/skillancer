/**
 * @module @skillancer/auth-svc/services/token
 * JWT token generation and verification service
 */

import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';

import { getConfig } from '../config/index.js';
import { InvalidTokenError } from '../errors/index.js';
import type { AccessTokenPayload, RefreshTokenPayload } from '../schemas/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface UserTokenData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  verificationLevel: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface VerificationToken {
  token: string;
  expiresAt: Date;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse duration string to milliseconds
 * Supports: 1h, 2d, 30m, 60s
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  } as const;

  return value * multipliers[unit];
}

/**
 * Parse duration string to seconds
 */
function parseDurationToSeconds(duration: string): number {
  return Math.floor(parseDuration(duration) / 1000);
}

// =============================================================================
// TOKEN SERVICE
// =============================================================================

/**
 * Token service for JWT generation and verification
 *
 * @example
 * ```typescript
 * const tokenService = new TokenService();
 *
 * // Generate tokens for user
 * const tokens = tokenService.generateTokenPair(user, sessionId);
 *
 * // Verify access token
 * const payload = tokenService.verifyAccessToken(tokens.accessToken);
 *
 * // Generate verification token
 * const verificationToken = tokenService.generateEmailVerificationToken(userId);
 * ```
 */
export class TokenService {
  private readonly config = getConfig();

  // ===========================================================================
  // ACCESS TOKEN
  // ===========================================================================

  /**
   * Generate JWT access token for authenticated user
   *
   * @param user - User data to include in token
   * @param sessionId - Session identifier
   * @returns Signed JWT access token
   */
  generateAccessToken(user: UserTokenData, sessionId: string): string {
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      sessionId,
      verificationLevel: user.verificationLevel,
    };

    const options: SignOptions = {
      expiresIn: parseDurationToSeconds(this.config.jwt.accessTokenExpiresIn),
      issuer: this.config.jwt.issuer,
      audience: this.config.jwt.audience,
    };

    return jwt.sign(payload, this.config.jwt.secret, options);
  }

  /**
   * Verify and decode access token
   *
   * @param token - JWT access token
   * @returns Decoded token payload
   * @throws InvalidTokenError if token is invalid or expired
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret, {
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      }) as JwtPayload;

      return {
        sub: decoded.sub as string,
        email: decoded.email as string,
        firstName: decoded.firstName as string,
        lastName: decoded.lastName as string,
        roles: decoded.roles as string[],
        sessionId: decoded.sessionId as string,
        verificationLevel: decoded.verificationLevel as string,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
        iss: decoded.iss as string,
        aud: decoded.aud as string,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new InvalidTokenError('access');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidTokenError('access');
      }
      throw error;
    }
  }

  /**
   * Decode access token without verification (for expired tokens)
   *
   * @param token - JWT access token
   * @returns Decoded token payload or null
   */
  decodeAccessToken(token: string): AccessTokenPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      if (!decoded) return null;

      return {
        sub: decoded.sub as string,
        email: decoded.email as string,
        firstName: decoded.firstName as string,
        lastName: decoded.lastName as string,
        roles: decoded.roles as string[],
        sessionId: decoded.sessionId as string,
        verificationLevel: decoded.verificationLevel as string,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
        iss: decoded.iss as string,
        aud: decoded.aud as string,
      };
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // REFRESH TOKEN
  // ===========================================================================

  /**
   * Generate JWT refresh token
   *
   * @param userId - User identifier
   * @param sessionId - Session identifier
   * @returns Signed JWT refresh token and unique token ID
   */
  generateRefreshToken(userId: string, sessionId: string): { token: string; tokenId: string } {
    const tokenId = crypto.randomUUID();

    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      sessionId,
      tokenId,
      type: 'refresh',
    };

    const options: SignOptions = {
      expiresIn: parseDurationToSeconds(this.config.jwt.refreshTokenExpiresIn),
    };

    const token = jwt.sign(payload, this.config.jwt.secret, options);

    return { token, tokenId };
  }

  /**
   * Verify and decode refresh token
   *
   * @param token - JWT refresh token
   * @returns Decoded token payload
   * @throws InvalidTokenError if token is invalid or expired
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwt.secret) as JwtPayload;

      if (decoded.type !== 'refresh') {
        throw new InvalidTokenError('refresh');
      }

      return {
        sub: decoded.sub as string,
        sessionId: decoded.sessionId as string,
        tokenId: decoded.tokenId as string,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
        type: 'refresh',
      };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new InvalidTokenError('refresh');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidTokenError('refresh');
      }
      throw error;
    }
  }

  // ===========================================================================
  // TOKEN PAIR
  // ===========================================================================

  /**
   * Generate both access and refresh tokens
   *
   * @param user - User data to include in tokens
   * @param sessionId - Session identifier
   * @returns Token pair with metadata
   */
  generateTokenPair(user: UserTokenData, sessionId: string): TokenPair & { tokenId: string } {
    const accessToken = this.generateAccessToken(user, sessionId);
    const { token: refreshToken, tokenId } = this.generateRefreshToken(user.id, sessionId);

    const expiresIn = parseDurationToSeconds(this.config.jwt.accessTokenExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
      tokenId,
    };
  }

  // ===========================================================================
  // VERIFICATION TOKENS
  // ===========================================================================

  /**
   * Generate email verification token
   *
   * @param userId - User identifier
   * @returns Token and expiration date
   */
  generateEmailVerificationToken(userId: string): VerificationToken {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.config.security.emailVerificationTtl);

    // Encode userId and token together with HMAC for tamper protection
    const payload = `${userId}:${token}`;
    const signature = crypto
      .createHmac('sha256', this.config.jwt.secret)
      .update(payload)
      .digest('hex');

    const fullToken = Buffer.from(`${payload}:${signature}`).toString('base64url');

    return { token: fullToken, expiresAt };
  }

  /**
   * Verify email verification token
   *
   * @param fullToken - The full encoded token
   * @returns User ID if valid
   * @throws InvalidTokenError if token is invalid
   */
  verifyEmailVerificationToken(fullToken: string): { userId: string; token: string } {
    try {
      const decoded = Buffer.from(fullToken, 'base64url').toString();
      const [userId, token, signature] = decoded.split(':');

      if (!userId || !token || !signature) {
        throw new InvalidTokenError('verification');
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.config.jwt.secret)
        .update(`${userId}:${token}`)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        throw new InvalidTokenError('verification');
      }

      return { userId, token };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError('verification');
    }
  }

  /**
   * Generate password reset token
   *
   * @param userId - User identifier
   * @returns Token and expiration date
   */
  generatePasswordResetToken(userId: string): VerificationToken {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + this.config.security.passwordResetTtl);

    // Encode userId and token together with HMAC for tamper protection
    const payload = `reset:${userId}:${token}`;
    const signature = crypto
      .createHmac('sha256', this.config.jwt.secret)
      .update(payload)
      .digest('hex');

    const fullToken = Buffer.from(`${payload}:${signature}`).toString('base64url');

    return { token: fullToken, expiresAt };
  }

  /**
   * Verify password reset token
   *
   * @param fullToken - The full encoded token
   * @returns User ID if valid
   * @throws InvalidTokenError if token is invalid
   */
  verifyPasswordResetToken(fullToken: string): { userId: string; token: string } {
    try {
      const decoded = Buffer.from(fullToken, 'base64url').toString();
      const [prefix, userId, token, signature] = decoded.split(':');

      if (prefix !== 'reset' || !userId || !token || !signature) {
        throw new InvalidTokenError('reset');
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.config.jwt.secret)
        .update(`reset:${userId}:${token}`)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        throw new InvalidTokenError('reset');
      }

      return { userId, token };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw error;
      }
      throw new InvalidTokenError('reset');
    }
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Generate a cryptographically secure random token
   *
   * @param length - Length of the token in bytes (default: 32)
   * @returns Hex-encoded token string
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Get access token expiration time in seconds
   */
  getAccessTokenExpiresIn(): number {
    return parseDurationToSeconds(this.config.jwt.accessTokenExpiresIn);
  }

  /**
   * Get refresh token expiration time in seconds
   */
  getRefreshTokenExpiresIn(): number {
    return parseDurationToSeconds(this.config.jwt.refreshTokenExpiresIn);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let tokenServiceInstance: TokenService | null = null;

/**
 * Get token service singleton instance
 */
export function getTokenService(): TokenService {
  if (!tokenServiceInstance) {
    tokenServiceInstance = new TokenService();
  }
  return tokenServiceInstance;
}

/**
 * Reset token service instance (for testing)
 */
export function resetTokenService(): void {
  tokenServiceInstance = null;
}
