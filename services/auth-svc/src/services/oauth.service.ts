// @ts-nocheck
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

type OAuthProvider = 'google' | 'microsoft' | 'apple' | 'facebook' | 'linkedin' | 'github';

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
  // FACEBOOK OAUTH
  // ===========================================================================

  /**
   * Generate Facebook OAuth authorization URL
   *
   * @param redirectUrl - Optional custom redirect URL
   * @returns Auth URL and state token
   * @throws OAuthNotConfiguredError if Facebook OAuth not configured
   */
  async getFacebookAuthUrl(redirectUrl?: string): Promise<{ url: string; state: string }> {
    const { facebook } = this.config.oauth;

    if (!facebook.appId || !facebook.appSecret || !facebook.callbackUrl) {
      throw new OAuthNotConfiguredError('facebook');
    }

    const state = await this.generateState('facebook', redirectUrl);

    const params = new URLSearchParams({
      client_id: facebook.appId,
      redirect_uri: facebook.callbackUrl,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    });

    return {
      url: `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle Facebook OAuth callback
   *
   * @param code - Authorization code from Facebook
   * @param state - State token for CSRF protection
   * @param deviceInfo - Device information
   * @returns OAuth result with user and tokens
   * @throws OAuthError if authentication fails
   */
  async handleFacebookCallback(
    code: string,
    state: string,
    deviceInfo: DeviceInfo
  ): Promise<OAuthResult> {
    const { facebook } = this.config.oauth;

    if (!facebook.appId || !facebook.appSecret || !facebook.callbackUrl) {
      throw new OAuthNotConfiguredError('facebook');
    }

    // Verify state
    await this.verifyState(state, 'facebook');

    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      client_id: facebook.appId,
      client_secret: facebook.appSecret,
      redirect_uri: facebook.callbackUrl,
      code,
    });

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new OAuthError('facebook', `Failed to exchange code: ${error}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    // Get user info from Facebook Graph API
    const userResponse = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,email,first_name,last_name,name,picture.type(large)&access_token=${tokenData.access_token}`
    );

    if (!userResponse.ok) {
      throw new OAuthError('facebook', 'Failed to get user info');
    }

    const fbUser = (await userResponse.json()) as {
      id: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      name: string;
      picture?: { data?: { url?: string } };
    };

    if (!fbUser.email) {
      throw new OAuthError('facebook', 'Email permission is required. Please grant email access.');
    }

    const userInfo: OAuthUserInfo = {
      id: fbUser.id,
      email: fbUser.email,
      firstName: fbUser.first_name ?? fbUser.name.split(' ')[0] ?? '',
      lastName: fbUser.last_name ?? fbUser.name.split(' ').slice(1).join(' ') ?? '',
      displayName: fbUser.name,
      avatarUrl: fbUser.picture?.data?.url,
    };

    return this.findOrCreateUser('facebook', userInfo, deviceInfo);
  }

  // ===========================================================================
  // LINKEDIN OAUTH
  // ===========================================================================

  /**
   * Generate LinkedIn OAuth authorization URL
   *
   * Uses LinkedIn's OpenID Connect flow (v2)
   *
   * @param redirectUrl - Optional custom redirect URL
   * @returns Auth URL and state token
   * @throws OAuthNotConfiguredError if LinkedIn OAuth not configured
   */
  async getLinkedInAuthUrl(redirectUrl?: string): Promise<{ url: string; state: string }> {
    const { linkedin } = this.config.oauth;

    if (!linkedin.clientId || !linkedin.clientSecret || !linkedin.callbackUrl) {
      throw new OAuthNotConfiguredError('linkedin');
    }

    const state = await this.generateState('linkedin', redirectUrl);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: linkedin.clientId,
      redirect_uri: linkedin.callbackUrl,
      scope: 'openid profile email',
      state,
    });

    return {
      url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle LinkedIn OAuth callback
   *
   * @param code - Authorization code from LinkedIn
   * @param state - State token for CSRF protection
   * @param deviceInfo - Device information
   * @returns OAuth result with user and tokens
   * @throws OAuthError if authentication fails
   */
  async handleLinkedInCallback(
    code: string,
    state: string,
    deviceInfo: DeviceInfo
  ): Promise<OAuthResult> {
    const { linkedin } = this.config.oauth;

    if (!linkedin.clientId || !linkedin.clientSecret || !linkedin.callbackUrl) {
      throw new OAuthNotConfiguredError('linkedin');
    }

    // Verify state
    await this.verifyState(state, 'linkedin');

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: linkedin.clientId,
        client_secret: linkedin.clientSecret,
        redirect_uri: linkedin.callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new OAuthError('linkedin', `Failed to exchange code: ${error}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    // Get user info from LinkedIn UserInfo endpoint (OpenID Connect)
    const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      throw new OAuthError('linkedin', 'Failed to get user info');
    }

    const liUser = (await userResponse.json()) as {
      sub: string;
      email?: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
      name?: string;
      picture?: string;
    };

    if (!liUser.email) {
      throw new OAuthError('linkedin', 'Email permission is required. Please grant email access.');
    }

    const userInfo: OAuthUserInfo = {
      id: liUser.sub,
      email: liUser.email,
      firstName: liUser.given_name ?? liUser.name?.split(' ')[0] ?? '',
      lastName: liUser.family_name ?? liUser.name?.split(' ').slice(1).join(' ') ?? '',
      displayName: liUser.name,
      avatarUrl: liUser.picture,
    };

    return this.findOrCreateUser('linkedin', userInfo, deviceInfo);
  }

  // ===========================================================================
  // GITHUB OAUTH
  // ===========================================================================

  /**
   * Generate GitHub OAuth authorization URL
   *
   * @param redirectUrl - Optional custom redirect URL
   * @returns Auth URL and state token
   * @throws OAuthNotConfiguredError if GitHub OAuth not configured
   */
  async getGitHubAuthUrl(redirectUrl?: string): Promise<{ url: string; state: string }> {
    const { github } = this.config.oauth;

    if (!github.clientId || !github.clientSecret || !github.callbackUrl) {
      throw new OAuthNotConfiguredError('github');
    }

    const state = await this.generateState('github', redirectUrl);

    const params = new URLSearchParams({
      client_id: github.clientId,
      redirect_uri: github.callbackUrl,
      scope: 'read:user user:email',
      state,
    });

    return {
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle GitHub OAuth callback
   *
   * @param code - Authorization code from GitHub
   * @param state - State token for CSRF protection
   * @param deviceInfo - Device information
   * @returns OAuth result with user and tokens
   * @throws OAuthError if authentication fails
   */
  async handleGitHubCallback(
    code: string,
    state: string,
    deviceInfo: DeviceInfo
  ): Promise<OAuthResult> {
    const { github } = this.config.oauth;

    if (!github.clientId || !github.clientSecret || !github.callbackUrl) {
      throw new OAuthNotConfiguredError('github');
    }

    // Verify state
    await this.verifyState(state, 'github');

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: github.clientId,
        client_secret: github.clientSecret,
        code,
        redirect_uri: github.callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new OAuthError('github', `Failed to exchange code: ${error}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string; error?: string };

    if (tokenData.error) {
      throw new OAuthError('github', `Token exchange failed: ${tokenData.error}`);
    }

    // Get user info from GitHub API
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!userResponse.ok) {
      throw new OAuthError('github', 'Failed to get user info');
    }

    const ghUser = (await userResponse.json()) as {
      id: number;
      email?: string | null;
      name?: string | null;
      login: string;
      avatar_url?: string;
    };

    // GitHub may not return email in user profile — fetch from emails endpoint
    let email = ghUser.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primaryEmail = emails.find((e) => e.primary && e.verified);
        email = primaryEmail?.email ?? emails.find((e) => e.verified)?.email ?? null;
      }
    }

    if (!email) {
      throw new OAuthError(
        'github',
        'Email permission is required. Please make your email public or grant email access.'
      );
    }

    const nameParts = (ghUser.name ?? ghUser.login).split(' ');

    const userInfo: OAuthUserInfo = {
      id: String(ghUser.id),
      email,
      firstName: nameParts[0] ?? ghUser.login,
      lastName: nameParts.slice(1).join(' ') ?? '',
      displayName: ghUser.name ?? ghUser.login,
      avatarUrl: ghUser.avatar_url,
    };

    return this.findOrCreateUser('github', userInfo, deviceInfo);
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
   * Get the OAuthProvider enum value from a string
   */
  private getOAuthProviderEnum(
    provider: OAuthProvider
  ): 'GOOGLE' | 'MICROSOFT' | 'APPLE' | 'FACEBOOK' | 'LINKEDIN' | 'GITHUB' {
    return provider.toUpperCase() as
      | 'GOOGLE'
      | 'MICROSOFT'
      | 'APPLE'
      | 'FACEBOOK'
      | 'LINKEDIN'
      | 'GITHUB';
  }

  /**
   * Find existing user or create new one from OAuth data
   * Uses the OAuthAccount model to support multiple OAuth providers per user
   */
  private async findOrCreateUser(
    provider: OAuthProvider,
    userInfo: OAuthUserInfo,
    deviceInfo: DeviceInfo,
    tokenData?: { accessToken?: string; refreshToken?: string; expiresAt?: Date }
  ): Promise<OAuthResult> {
    let user: User | null = null;
    let isNewUser = false;
    const providerEnum = this.getOAuthProviderEnum(provider);

    // First, try to find by OAuth account (provider + ID)
    const oauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: providerEnum,
          providerAccountId: userInfo.id,
        },
      },
      include: { user: true },
    });

    if (oauthAccount) {
      user = oauthAccount.user;

      // Update OAuth account tokens if provided
      if (tokenData) {
        await prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            accessToken: tokenData.accessToken ?? null,
            refreshToken: tokenData.refreshToken ?? null,
            expiresAt: tokenData.expiresAt ?? null,
          },
        });
      }
    }

    // If not found by OAuth, try to find by email
    if (!user && userInfo.email) {
      user = await prisma.user.findUnique({
        where: { email: userInfo.email.toLowerCase() },
      });

      // Link OAuth account to existing user
      if (user) {
        await prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: providerEnum,
            providerAccountId: userInfo.id,
            email: userInfo.email.toLowerCase(),
            accessToken: tokenData?.accessToken ?? null,
            refreshToken: tokenData?.refreshToken ?? null,
            expiresAt: tokenData?.expiresAt ?? null,
          },
        });

        // Update avatar if not set
        if (!user.avatarUrl && userInfo.avatarUrl) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl: userInfo.avatarUrl },
          });
        }
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
          status: 'ACTIVE', // OAuth users are automatically verified
          verificationLevel: 'EMAIL',
          emailVerified: true,
          emailVerifiedAt: new Date(),
          oauthAccounts: {
            create: {
              provider: providerEnum,
              providerAccountId: userInfo.id,
              email: userInfo.email.toLowerCase(),
              accessToken: tokenData?.accessToken ?? null,
              refreshToken: tokenData?.refreshToken ?? null,
              expiresAt: tokenData?.expiresAt ?? null,
            },
          },
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

    // Update last login time and IP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: deviceInfo.ip,
      },
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

    // Generate a new family ID for OAuth logins (each OAuth login starts a new family)
    const family = crypto.randomUUID();

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        token,
        userId,
        family,
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
