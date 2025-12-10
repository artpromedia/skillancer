/**
 * @module @skillancer/auth-svc/services/auth
 * Core authentication service for user registration, login, and password management
 */

import crypto from 'crypto';

import { CacheService } from '@skillancer/cache';
import { prisma, type User, MfaMethod } from '@skillancer/database';
import bcrypt from 'bcrypt';

import { getMfaService } from './mfa.service.js';
import { getSessionService, type SessionInfo } from './session.service.js';
import { getTokenService, type TokenPair, type UserTokenData } from './token.service.js';
import { getConfig } from '../config/index.js';
import {
  InvalidCredentialsError,
  AccountLockedError,
  AccountSuspendedError,
  EmailExistsError,
  InvalidTokenError,
} from '../errors/index.js';

import type { RegisterRequest, DeviceInfo } from '../schemas/index.js';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface RegisterResult {
  user: User;
  verificationToken: string;
}

export interface LoginResult {
  user: User;
  tokens: TokenPair;
  session: SessionInfo;
  /** True if MFA was verified as part of login */
  mfaVerified?: boolean;
}

/** Result when MFA is required to complete login */
export interface MfaPendingResult {
  mfaRequired: true;
  pendingSessionId: string;
  availableMethods: MfaMethod[];
  expiresAt: Date;
  userId: string;
}

export interface RefreshResult {
  tokens: TokenPair;
  session: SessionInfo;
}

export interface PasswordResetRequest {
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
}

// =============================================================================
// CACHE KEYS
// =============================================================================

const CacheKeys = {
  loginAttempts: (email: string) => `auth:login_attempts:${email.toLowerCase()}`,
  lockout: (email: string) => `auth:lockout:${email.toLowerCase()}`,
  verificationToken: (token: string) => `auth:verification:${token}`,
  resetToken: (token: string) => `auth:reset:${token}`,
};

// =============================================================================
// AUTH SERVICE
// =============================================================================

/**
 * Core authentication service
 *
 * Handles:
 * - User registration with email/password
 * - Login with credentials
 * - Logout and session management
 * - Token refresh
 * - Email verification
 * - Password reset flow
 *
 * @example
 * ```typescript
 * const authService = new AuthService(redis);
 *
 * // Register new user
 * const { user, verificationToken } = await authService.register({
 *   email: 'user@example.com',
 *   password: 'SecurePass123!',
 *   firstName: 'John',
 *   lastName: 'Doe',
 * });
 *
 * // Login
 * const { user, tokens, session } = await authService.login(
 *   'user@example.com',
 *   'SecurePass123!',
 *   { userAgent: '...', ip: '...' }
 * );
 * ```
 */
export class AuthService {
  private readonly config = getConfig();
  private readonly tokenService = getTokenService();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'auth');
  }

  // ===========================================================================
  // REGISTRATION
  // ===========================================================================

  /**
   * Register a new user with email and password
   *
   * @param data - Registration data
   * @returns Created user and verification token
   * @throws EmailExistsError if email already registered
   * @throws WeakPasswordError if password doesn't meet requirements
   */
  async register(data: RegisterRequest): Promise<RegisterResult> {
    const email = data.email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new EmailExistsError(email);
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        displayName: data.displayName?.trim() || `${data.firstName} ${data.lastName}`.trim(),
        timezone: data.timezone,
        locale: data.locale,
        status: 'PENDING_VERIFICATION',
        verificationLevel: 'NONE',
      },
    });

    // Generate verification token
    const { token, expiresAt } = this.tokenService.generateEmailVerificationToken(user.id);

    // Store verification token in Redis
    await this.cache.set(
      CacheKeys.verificationToken(token),
      { userId: user.id, email: user.email },
      { ttl: Math.floor((expiresAt.getTime() - Date.now()) / 1000) }
    );

    return { user, verificationToken: token };
  }

  // ===========================================================================
  // LOGIN
  // ===========================================================================

  /**
   * Authenticate user with email and password
   *
   * @param email - User email
   * @param password - User password
   * @param deviceInfo - Device information for session
   * @returns User, tokens, and session OR MFA pending result
   * @throws InvalidCredentialsError if credentials are invalid
   * @throws AccountLockedError if account is locked
   * @throws AccountSuspendedError if account is suspended
   * @throws MfaRequiredError if MFA verification is required
   */
  async login(
    email: string,
    password: string,
    deviceInfo: DeviceInfo
  ): Promise<LoginResult | MfaPendingResult> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check for lockout
    await this.checkLockout(normalizedEmail);

    // Find user with MFA configuration
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { mfa: true },
    });

    if (!user || !user.passwordHash) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new InvalidCredentialsError();
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.passwordHash);

    if (!isValid) {
      await this.recordFailedAttempt(normalizedEmail);
      throw new InvalidCredentialsError();
    }

    // Check account status
    this.checkAccountStatus(user);

    // Clear failed attempts on successful password verification
    await this.clearFailedAttempts(normalizedEmail);

    // Check if MFA is required
    if (user.mfa?.enabled) {
      return this.handleMfaRequired(user, deviceInfo);
    }

    // No MFA - complete login directly
    return this.completeLogin(user, deviceInfo);
  }

  /**
   * Handle case where MFA is required
   */
  private async handleMfaRequired(
    user: User & {
      mfa: { enabled: boolean; totpVerified: boolean; phoneVerified: boolean } | null;
    },
    deviceInfo: DeviceInfo
  ): Promise<MfaPendingResult> {
    const mfaService = getMfaService();

    // Create pending session
    const { pendingSessionId, expiresAt } = await mfaService.createPendingSession(user.id, {
      userAgent: deviceInfo.userAgent,
      ip: deviceInfo.ip,
    });

    // Get available methods
    const methods = await mfaService.getAvailableMethods(user.id);
    const availableMethods: MfaMethod[] = [];

    if (methods.totp) availableMethods.push(MfaMethod.TOTP);
    if (methods.sms) availableMethods.push(MfaMethod.SMS);
    if (methods.email) availableMethods.push(MfaMethod.EMAIL);
    if (methods.recoveryCode) availableMethods.push(MfaMethod.RECOVERY_CODE);

    return {
      mfaRequired: true,
      pendingSessionId,
      availableMethods,
      expiresAt,
      userId: user.id,
    };
  }

  /**
   * Complete login after MFA verification
   *
   * @param pendingSessionId - ID of the pending session from MFA challenge
   * @param challengeId - ID of the verified MFA challenge
   */
  async completeMfaLogin(pendingSessionId: string, challengeId: string): Promise<LoginResult> {
    const mfaService = getMfaService();

    // Validate pending session
    const pendingSession = await mfaService.getPendingSession(pendingSessionId);
    if (!pendingSession) {
      throw new InvalidCredentialsError('Session expired');
    }

    // Get the challenge and verify it was completed
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || !challenge.verified || challenge.userId !== pendingSession.userId) {
      throw new InvalidCredentialsError('MFA verification required');
    }

    // Get user
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: pendingSession.userId },
    });

    // Complete the login
    const result = await this.completeLogin(user, pendingSession.deviceInfo);

    // Clean up
    await mfaService.deletePendingSession(pendingSessionId);
    await prisma.mfaChallenge.delete({ where: { id: challengeId } });

    return {
      ...result,
      mfaVerified: true,
    };
  }

  /**
   * Complete login flow (create session and tokens)
   */
  private async completeLogin(user: User, deviceInfo: DeviceInfo): Promise<LoginResult> {
    // Create session and tokens
    const sessionService = getSessionService();

    const { tokenId } = this.tokenService.generateTokenPair(
      this.toUserTokenData(user),
      crypto.randomUUID() // Temporary session ID
    );

    const session = await sessionService.createSession({
      userId: user.id,
      deviceInfo,
      roles: ['USER'], // Default role, can be enhanced
      refreshTokenId: tokenId,
    });

    // Regenerate tokens with actual session ID
    const finalTokens = this.tokenService.generateTokenPair(
      this.toUserTokenData(user),
      session.sessionId
    );

    // Update session with correct refresh token ID
    await sessionService.updateRefreshTokenId(session.sessionId, finalTokens.tokenId);

    // Store refresh token in database
    await this.storeRefreshToken(
      user.id,
      finalTokens.refreshToken,
      finalTokens.tokenId,
      deviceInfo
    );

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user,
      tokens: {
        accessToken: finalTokens.accessToken,
        refreshToken: finalTokens.refreshToken,
        expiresIn: finalTokens.expiresIn,
        tokenType: 'Bearer',
      },
      session,
    };
  }

  // ===========================================================================
  // LOGOUT
  // ===========================================================================

  /**
   * Logout user and invalidate session
   *
   * @param sessionId - Session to invalidate
   * @param userId - User ID (for validation)
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    const sessionService = getSessionService();

    // Validate session belongs to user
    const session = await sessionService.getSession(sessionId);
    if (session && session.userId === userId) {
      await sessionService.invalidateSession(sessionId);
    }

    // Revoke refresh token if exists
    if (session?.refreshTokenId) {
      await this.revokeRefreshToken(session.refreshTokenId);
    }
  }

  /**
   * Logout user from all sessions
   *
   * @param userId - User ID
   */
  async logoutAll(userId: string): Promise<void> {
    const sessionService = getSessionService();

    // Invalidate all sessions
    await sessionService.invalidateAllUserSessions(userId);

    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  // ===========================================================================
  // TOKEN REFRESH
  // ===========================================================================

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - Refresh token
   * @param deviceInfo - Device information
   * @returns New tokens and session info
   * @throws InvalidTokenError if refresh token is invalid
   */
  async refreshToken(refreshToken: string, deviceInfo: DeviceInfo): Promise<RefreshResult> {
    // Verify refresh token
    const payload = this.tokenService.verifyRefreshToken(refreshToken);

    // Check if token exists in database and is not revoked
    const storedToken = await prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new InvalidTokenError('refresh');
    }

    // Verify user exists and is active
    const user = storedToken.user;
    this.checkAccountStatus(user);

    // Get session service
    const sessionService = getSessionService();

    // Validate session
    const session = await sessionService.getSession(payload.sessionId);
    if (!session) {
      throw new InvalidTokenError('refresh');
    }

    // Revoke old refresh token (token rotation)
    await this.revokeRefreshToken(payload.tokenId);

    // Generate new token pair
    const { tokenId, ...tokens } = this.tokenService.generateTokenPair(
      this.toUserTokenData(user),
      session.sessionId
    );

    // Store new refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken, tokenId, deviceInfo);

    // Update session with new refresh token ID
    await sessionService.updateRefreshTokenId(session.sessionId, tokenId);

    // Refresh session TTL
    await sessionService.refreshSession(session.sessionId);

    return {
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer',
      },
      session,
    };
  }

  // ===========================================================================
  // EMAIL VERIFICATION
  // ===========================================================================

  /**
   * Verify user's email address
   *
   * @param token - Verification token
   * @returns Updated user
   * @throws InvalidTokenError if token is invalid or expired
   */
  async verifyEmail(token: string): Promise<User> {
    // Verify token structure
    const { userId } = this.tokenService.verifyEmailVerificationToken(token);

    // Check token in cache
    const cached = await this.cache.get<{ userId: string; email: string }>(
      CacheKeys.verificationToken(token)
    );

    if (!cached || cached.userId !== userId) {
      throw new InvalidTokenError('verification');
    }

    // Update user status
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        verificationLevel: 'EMAIL',
      },
    });

    // Delete token from cache
    await this.cache.delete(CacheKeys.verificationToken(token));

    return user;
  }

  /**
   * Resend verification email
   *
   * @param email - User email
   * @returns New verification token (null if user not found or already verified)
   */
  async resendVerificationEmail(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || user.status !== 'PENDING_VERIFICATION') {
      return null; // Don't reveal if user exists
    }

    // Generate new verification token
    const { token, expiresAt } = this.tokenService.generateEmailVerificationToken(user.id);

    // Store in cache
    await this.cache.set(
      CacheKeys.verificationToken(token),
      { userId: user.id, email: user.email },
      { ttl: Math.floor((expiresAt.getTime() - Date.now()) / 1000) }
    );

    return token;
  }

  // ===========================================================================
  // PASSWORD RESET
  // ===========================================================================

  /**
   * Initiate password reset flow
   *
   * @param email - User email
   * @returns Reset token (null if user not found)
   */
  async forgotPassword(email: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return null; // Don't reveal if user exists
    }

    // Generate reset token
    const { token, expiresAt } = this.tokenService.generatePasswordResetToken(user.id);

    // Store in cache
    await this.cache.set(
      CacheKeys.resetToken(token),
      { userId: user.id, email: user.email },
      { ttl: Math.floor((expiresAt.getTime() - Date.now()) / 1000) }
    );

    return token;
  }

  /**
   * Reset user password
   *
   * @param token - Password reset token
   * @param newPassword - New password
   * @throws InvalidTokenError if token is invalid
   * @throws WeakPasswordError if password doesn't meet requirements
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Verify token structure
    const { userId } = this.tokenService.verifyPasswordResetToken(token);

    // Check token in cache
    const cached = await this.cache.get<{ userId: string; email: string }>(
      CacheKeys.resetToken(token)
    );

    if (!cached || cached.userId !== userId) {
      throw new InvalidTokenError('reset');
    }

    // Hash new password
    const passwordHash = await this.hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Delete token from cache
    await this.cache.delete(CacheKeys.resetToken(token));

    // Invalidate all sessions (force re-login)
    await this.logoutAll(userId);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.security.bcryptRounds);
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Check account status and throw appropriate error
   */
  private checkAccountStatus(user: User): void {
    switch (user.status) {
      case 'SUSPENDED':
      case 'BANNED':
        throw new AccountSuspendedError();
      case 'INACTIVE':
        throw new AccountSuspendedError('Account is inactive');
      case 'PENDING_VERIFICATION':
        // Allow login but flag for frontend
        break;
    }
  }

  /**
   * Check if account is locked out
   */
  private async checkLockout(email: string): Promise<void> {
    const lockoutKey = CacheKeys.lockout(email);
    const lockoutUntil = await this.cache.get<number>(lockoutKey);

    if (lockoutUntil && lockoutUntil > Date.now()) {
      throw new AccountLockedError(
        'Account temporarily locked due to too many failed attempts',
        new Date(lockoutUntil)
      );
    }
  }

  /**
   * Record failed login attempt
   */
  private async recordFailedAttempt(email: string): Promise<void> {
    const attemptsKey = CacheKeys.loginAttempts(email);
    const lockoutKey = CacheKeys.lockout(email);

    // Get current attempts
    const attempts = ((await this.cache.get<number>(attemptsKey)) || 0) + 1;

    // Store incremented attempts
    const windowSeconds = Math.floor(this.config.rateLimit.login.windowMs / 1000);
    await this.cache.set(attemptsKey, attempts, { ttl: windowSeconds });

    // Check if should lock
    if (attempts >= this.config.security.maxLoginAttempts) {
      const lockoutUntil = Date.now() + this.config.security.lockoutDuration;
      const lockoutSeconds = Math.floor(this.config.security.lockoutDuration / 1000);
      await this.cache.set(lockoutKey, lockoutUntil, { ttl: lockoutSeconds });
    }
  }

  /**
   * Clear failed login attempts
   */
  private async clearFailedAttempts(email: string): Promise<void> {
    await this.cache.delete(CacheKeys.loginAttempts(email));
    await this.cache.delete(CacheKeys.lockout(email));
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(
    userId: string,
    token: string,
    tokenId: string,
    deviceInfo: DeviceInfo
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.tokenService.getRefreshTokenExpiresIn() * 1000);

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        token,
        userId,
        expiresAt,
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ip,
      },
    });
  }

  /**
   * Revoke refresh token
   */
  private async revokeRefreshToken(tokenId: string): Promise<void> {
    await prisma.refreshToken
      .update({
        where: { id: tokenId },
        data: { revokedAt: new Date() },
      })
      .catch(() => {
        // Ignore if token doesn't exist
      });
  }

  /**
   * Convert User to UserTokenData
   */
  private toUserTokenData(user: User): UserTokenData {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: ['USER'], // Default role
      verificationLevel: user.verificationLevel,
    };
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

let authServiceInstance: AuthService | null = null;

/**
 * Initialize auth service with Redis client
 */
export function initializeAuthService(redis: Redis): AuthService {
  authServiceInstance = new AuthService(redis);
  return authServiceInstance;
}

/**
 * Get auth service instance
 * @throws Error if not initialized
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    throw new Error('Auth service not initialized. Call initializeAuthService first.');
  }
  return authServiceInstance;
}

/**
 * Reset auth service (for testing)
 */
export function resetAuthService(): void {
  authServiceInstance = null;
}
