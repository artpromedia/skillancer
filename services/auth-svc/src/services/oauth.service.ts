/**
 * @module @skillancer/auth-svc/services/oauth
 * OAuth provider integration service
 */

import crypto from 'crypto';

import { CacheService, type DeviceInfo as _CacheDeviceInfo } from '@skillancer/cache';
import { prisma, type User } from '@skillancer/database';

import { getSessionService, type SessionInfo } from './session.service.js';
import { getTokenService, type TokenPair, type UserTokenData } from './token.service.js';
import { getConfig } from '../config/index.js';
import { OAuthError, OAuthNotConfiguredError } from '../errors/index.js';

import type { DeviceInfo, OAuthState } from '../schemas/index.js';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface OAuthUserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | undefined;
  avatarUrl: string | undefined;
}

export interface OAuthResult {
  user: User;
  tokens: TokenPair;
  session: SessionInfo;
  isNewUser: boolean;
}

interface AppleIdToken {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  nonce?: string;
  nonce_supported?: boolean;
}

type OAuthProvider = 'google' | 'microsoft' | 'apple';

// =============================================================================
// CACHE KEYS
// =============================================================================

const CacheKeys = {
  oauthState: (state: string) => `oauth:state:${state}`,
};

// =============================================================================
// OAUTH SERVICE
// =============================================================================

/**
 * OAuth service for handling third-party authentication
 *
 * Supports:
 * - Google OAuth 2.0
 * - Microsoft OAuth 2.0 (Azure AD)
 * - Apple Sign In
 *
 * @example
 * ```typescript
 * const oauthService = new OAuthService(redis);
 *
 * // Get Google auth URL
 * const { url, state } = await oauthService.getGoogleAuthUrl();
 *
 * // Handle callback
 * const result = await oauthService.handleGoogleCallback(code, state, deviceInfo);
 * ```
 */
export class OAuthService {
  private readonly config = getConfig();
  private readonly tokenService = getTokenService();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'oauth');
  }

  // ===========================================================================
  // GOOGLE OAUTH
  // ===========================================================================

  /**
   * Generate Google OAuth authorization URL
   *
   * @param redirectUrl - Optional custom redirect URL
   * @returns Auth URL and state token
   * @throws OAuthNotConfiguredError if Google OAuth not configured
   */
  async getGoogleAuthUrl(redirectUrl?: string): Promise<{ url: string; state: string }> {
    const { google } = this.config.oauth;

    if (!google.clientId || !google.clientSecret || !google.callbackUrl) {
      throw new OAuthNotConfiguredError('google');
    }

    const state = await this.generateState('google', redirectUrl);

    const params = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle Google OAuth callback
   *
   * @param code - Authorization code from Google
   * @param state - State token for CSRF protection
   * @param deviceInfo - Device information
   * @returns OAuth result with user and tokens
   * @throws OAuthError if authentication fails
   */
  async handleGoogleCallback(
    code: string,
    state: string,
    deviceInfo: DeviceInfo
  ): Promise<OAuthResult> {
    const { google } = this.config.oauth;

    if (!google.clientId || !google.clientSecret || !google.callbackUrl) {
      throw new OAuthNotConfiguredError('google');
    }

    // Verify state
    await this.verifyState(state, 'google');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new OAuthError('google', `Failed to exchange code: ${error}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      id_token: string;
    };

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      throw new OAuthError('google', 'Failed to get user info');
    }

    const googleUser = (await userResponse.json()) as {
      id: string;
      email: string;
      given_name?: string;
      family_name?: string;
      name: string;
      picture?: string;
    };

    const userInfo: OAuthUserInfo = {
      id: googleUser.id,
      email: googleUser.email,
      firstName: googleUser.given_name ?? googleUser.name.split(' ')[0] ?? '',
      lastName: googleUser.family_name ?? googleUser.name.split(' ').slice(1).join(' ') ?? '',
      displayName: googleUser.name,
      avatarUrl: googleUser.picture,
    };

    return this.findOrCreateUser('google', userInfo, deviceInfo);
  }

  // ===========================================================================
  // MICROSOFT OAUTH
  // ===========================================================================

  /**
   * Generate Microsoft OAuth authorization URL
   *
   * @param redirectUrl - Optional custom redirect URL
   * @returns Auth URL and state token
   * @throws OAuthNotConfiguredError if Microsoft OAuth not configured
   */
  async getMicrosoftAuthUrl(redirectUrl?: string): Promise<{ url: string; state: string }> {
    const { microsoft } = this.config.oauth;

    if (!microsoft.clientId || !microsoft.clientSecret || !microsoft.callbackUrl) {
      throw new OAuthNotConfiguredError('microsoft');
    }

    const state = await this.generateState('microsoft', redirectUrl);

    const params = new URLSearchParams({
      client_id: microsoft.clientId,
      redirect_uri: microsoft.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile User.Read',
      state,
      response_mode: 'query',
    });

    const tenantId = microsoft.tenantId || 'common';

    return {
      url: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle Microsoft OAuth callback
   *
   * @param code - Authorization code from Microsoft
   * @param state - State token for CSRF protection
   * @param deviceInfo - Device information
   * @returns OAuth result with user and tokens
   * @throws OAuthError if authentication fails
   */
  async handleMicrosoftCallback(
    code: string,
    state: string,
    deviceInfo: DeviceInfo
  ): Promise<OAuthResult> {
    const { microsoft } = this.config.oauth;

    if (!microsoft.clientId || !microsoft.clientSecret || !microsoft.callbackUrl) {
      throw new OAuthNotConfiguredError('microsoft');
    }

    // Verify state
    await this.verifyState(state, 'microsoft');

    const tenantId = microsoft.tenantId || 'common';

    // Exchange code for tokens
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: microsoft.clientId,
          client_secret: microsoft.clientSecret,
          redirect_uri: microsoft.callbackUrl,
          grant_type: 'authorization_code',
          scope: 'openid email profile User.Read',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new OAuthError('microsoft', `Failed to exchange code: ${error}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    // Get user info from Microsoft Graph
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      throw new OAuthError('microsoft', 'Failed to get user info');
    }

    const msUser = (await userResponse.json()) as {
      id: string;
      mail?: string;
      userPrincipalName: string;
      givenName?: string;
      surname?: string;
      displayName: string;
    };

    const userInfo: OAuthUserInfo = {
      id: msUser.id,
      email: msUser.mail || msUser.userPrincipalName,
      firstName: msUser.givenName ?? msUser.displayName.split(' ')[0] ?? '',
      lastName: msUser.surname ?? msUser.displayName.split(' ').slice(1).join(' ') ?? '',
      displayName: msUser.displayName,
      avatarUrl: undefined,
    };

    return this.findOrCreateUser('microsoft', userInfo, deviceInfo);
  }

  // ===========================================================================
  // APPLE SIGN IN
  // ===========================================================================

  /**
   * Generate Apple Sign In authorization URL
   *
   * @param redirectUrl - Optional custom redirect URL
   * @returns Auth URL and state token
   * @throws OAuthNotConfiguredError if Apple Sign In not configured
   */
  async getAppleAuthUrl(redirectUrl?: string): Promise<{ url: string; state: string }> {
    const { apple } = this.config.oauth;

    if (
      !apple.clientId ||
      !apple.teamId ||
      !apple.keyId ||
      !apple.privateKey ||
      !apple.callbackUrl
    ) {
      throw new OAuthNotConfiguredError('apple');
    }

    const state = await this.generateState('apple', redirectUrl);

    const params = new URLSearchParams({
      client_id: apple.clientId,
      redirect_uri: apple.callbackUrl,
      response_type: 'code id_token',
      scope: 'name email',
      state,
      response_mode: 'form_post',
    });

    return {
      url: `https://appleid.apple.com/auth/authorize?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle Apple Sign In callback
   *
   * Apple sends a POST request with code, id_token, and user info (first auth only)
   *
   * @param code - Authorization code from Apple
   * @param idToken - ID token from Apple
   * @param state - State token for CSRF protection
   * @param userJson - JSON string with user info (first auth only)
   * @param deviceInfo - Device information
   * @returns OAuth result with user and tokens
   * @throws OAuthError if authentication fails
   */
  async handleAppleCallback(
    code: string,
    idToken: string | undefined,
    state: string,
    userJson: string | undefined,
    deviceInfo: DeviceInfo
  ): Promise<OAuthResult> {
    const { apple } = this.config.oauth;

    if (
      !apple.clientId ||
      !apple.teamId ||
      !apple.keyId ||
      !apple.privateKey ||
      !apple.callbackUrl
    ) {
      throw new OAuthNotConfiguredError('apple');
    }

    // Verify state
    await this.verifyState(state, 'apple');

    // Generate client secret (JWT)
    const clientSecret = this.generateAppleClientSecret();

    // Exchange code for tokens
    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: apple.clientId,
        client_secret: clientSecret,
        redirect_uri: apple.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new OAuthError('apple', `Failed to exchange code: ${error}`);
    }

    const tokenData = (await tokenResponse.json()) as { id_token: string };

    // Decode ID token to get user info
    const idTokenPayload = this.decodeJwtPayload(tokenData.id_token);

    // Parse user info from first auth (if provided)
    let firstName = '';
    let lastName = '';

    if (userJson) {
      try {
        const userData = JSON.parse(userJson) as {
          name?: { firstName?: string; lastName?: string };
        };
        firstName = userData.name?.firstName || '';
        lastName = userData.name?.lastName || '';
      } catch {
        // Ignore parse errors
      }
    }

    const userInfo: OAuthUserInfo = {
      id: idTokenPayload.sub,
      email: idTokenPayload.email ?? '',
      firstName: firstName || 'Apple',
      lastName: lastName || 'User',
      displayName: firstName && lastName ? `${firstName} ${lastName}` : undefined,
      avatarUrl: undefined,
    };

    return this.findOrCreateUser('apple', userInfo, deviceInfo);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Generate and store OAuth state token
   */
  private async generateState(provider: OAuthProvider, redirectUrl?: string): Promise<string> {
    const state = crypto.randomBytes(32).toString('hex');

    const stateData: OAuthState = {
      provider,
      redirectUrl,
      createdAt: Date.now(),
    };

    // Store state for 10 minutes
    await this.cache.set(CacheKeys.oauthState(state), stateData, { ttl: 600 });

    return state;
  }

  /**
   * Verify OAuth state token
   */
  private async verifyState(state: string, expectedProvider: OAuthProvider): Promise<OAuthState> {
    const stateData = await this.cache.get<OAuthState>(CacheKeys.oauthState(state));

    if (!stateData) {
      throw new OAuthError(expectedProvider, 'Invalid or expired state token');
    }

    if (stateData.provider !== expectedProvider) {
      throw new OAuthError(expectedProvider, 'State token provider mismatch');
    }

    // Delete state after verification (one-time use)
    await this.cache.delete(CacheKeys.oauthState(state));

    return stateData;
  }

  /**
   * Find existing user or create new one from OAuth data
   */
  private async findOrCreateUser(
    provider: OAuthProvider,
    userInfo: OAuthUserInfo,
    deviceInfo: DeviceInfo
  ): Promise<OAuthResult> {
    let user: User | null = null;
    let isNewUser = false;

    // First, try to find by OAuth provider + ID
    user = await prisma.user.findFirst({
      where: {
        oauthProvider: provider.toUpperCase(),
        oauthId: userInfo.id,
      },
    });

    // If not found, try to find by email
    if (!user && userInfo.email) {
      user = await prisma.user.findUnique({
        where: { email: userInfo.email.toLowerCase() },
      });

      // Link OAuth to existing account
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider: provider.toUpperCase(),
            oauthId: userInfo.id,
            // Update avatar if not set
            avatarUrl: user.avatarUrl ?? userInfo.avatarUrl ?? null,
          },
        });
      }
    }

    // Create new user if not found
    if (!user) {
      isNewUser = true;
      user = await prisma.user.create({
        data: {
          email: userInfo.email.toLowerCase(),
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          displayName: userInfo.displayName ?? `${userInfo.firstName} ${userInfo.lastName}`,
          avatarUrl: userInfo.avatarUrl ?? null,
          oauthProvider: provider.toUpperCase(),
          oauthId: userInfo.id,
          status: 'ACTIVE', // OAuth users are automatically verified
          verificationLevel: 'EMAIL',
        },
      });
    }

    // Create session and tokens
    const sessionService = getSessionService();

    const session = await sessionService.createSession({
      userId: user.id,
      deviceInfo,
      roles: ['USER'],
    });

    const { tokenId, ...tokens } = this.tokenService.generateTokenPair(
      this.toUserTokenData(user),
      session.sessionId
    );

    // Update session with refresh token ID
    await sessionService.updateRefreshTokenId(session.sessionId, tokenId);

    // Store refresh token in database
    await this.storeRefreshToken(user.id, tokens.refreshToken, tokenId, deviceInfo);

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer',
      },
      session,
      isNewUser,
    };
  }

  /**
   * Generate Apple client secret JWT
   */
  private generateAppleClientSecret(): string {
    const { apple } = this.config.oauth;

    // This is a simplified implementation
    // In production, use a proper JWT library with ES256 signing
    const header = {
      alg: 'ES256',
      kid: apple.keyId,
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: apple.teamId,
      iat: now,
      exp: now + 86400 * 180, // 6 months
      aud: 'https://appleid.apple.com',
      sub: apple.clientId,
    };

    // Note: In production, properly sign with ES256 using apple.privateKey
    // This is a placeholder - you would use jose or jsonwebtoken with ES256
    const unsignedToken = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;

    // For now, return unsigned (won't work in production without proper signing)
    return unsignedToken;
  }

  /**
   * Decode JWT payload without verification (for ID tokens we already trust)
   */
  private decodeJwtPayload(token: string): AppleIdToken {
    const [, payload] = token.split('.');
    if (!payload) {
      throw new OAuthError('apple', 'Invalid ID token format');
    }
    const decoded = Buffer.from(payload, 'base64url').toString();
    return JSON.parse(decoded) as AppleIdToken;
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
   * Convert User to UserTokenData
   */
  private toUserTokenData(user: User): UserTokenData {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: ['USER'],
      verificationLevel: user.verificationLevel,
    };
  }
}

// =============================================================================
// SINGLETON MANAGEMENT
// =============================================================================

let oauthServiceInstance: OAuthService | null = null;

/**
 * Initialize OAuth service with Redis client
 */
export function initializeOAuthService(redis: Redis): OAuthService {
  oauthServiceInstance = new OAuthService(redis);
  return oauthServiceInstance;
}

/**
 * Get OAuth service instance
 * @throws Error if not initialized
 */
export function getOAuthService(): OAuthService {
  if (!oauthServiceInstance) {
    throw new Error('OAuth service not initialized. Call initializeOAuthService first.');
  }
  return oauthServiceInstance;
}

/**
 * Reset OAuth service (for testing)
 */
export function resetOAuthService(): void {
  oauthServiceInstance = null;
}
