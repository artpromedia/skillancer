// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/services/oauth
 * OAuth Service - Manages OAuth flows, token storage, and refresh
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { prisma } from '@skillancer/database';
import { getConfig } from '../config/index.js';
import { connectorRegistry } from '../connectors/registry.js';
import type { OAuthTokens, OAuthState } from '../types/index.js';
import { OAuthError, TokenExpiredError } from '../types/index.js';

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const config = getConfig();
  return Buffer.from(config.encryption.tokenKey, 'hex');
}

/**
 * Encrypt a token using AES-256-GCM
 */
export function encryptToken(token: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a token using AES-256-GCM
 */
export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getEncryptionKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============================================================================
// OAUTH SERVICE
// ============================================================================

export class OAuthService {
  /**
   * Initiate OAuth flow - generates state and returns authorization URL
   */
  async initiateOAuth(
    workspaceId: string,
    connectorSlug: string,
    redirectUri: string,
    userId: string,
    scopes?: string[]
  ): Promise<{ authorizationUrl: string; state: string }> {
    const connector = connectorRegistry.getOrThrow(connectorSlug);
    const config = getConfig();

    // Generate state token
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config.oauth.stateExpirySeconds * 1000);

    // Store pending OAuth state
    await prisma.integrationOAuthState.create({
      data: {
        state,
        workspaceId,
        integrationSlug: connectorSlug,
        redirectUri,
        requestedScopes: scopes || connector.getOAuthConfig().scopes,
        initiatedBy: userId,
        expiresAt,
      },
    });

    // Get authorization URL
    const authorizationUrl = connector.getAuthUrl(state, scopes, redirectUri);

    return { authorizationUrl, state };
  }

  /**
   * Handle OAuth callback - exchange code for tokens and store
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{ integrationId: string; success: boolean; error?: string }> {
    // Validate and get state
    const oauthState = await prisma.integrationOAuthState.findUnique({
      where: { state },
    });

    if (!oauthState) {
      throw new OAuthError('Invalid or expired OAuth state');
    }

    if (oauthState.expiresAt < new Date()) {
      await prisma.integrationOAuthState.delete({ where: { state } });
      throw new OAuthError('OAuth state has expired');
    }

    if (oauthState.usedAt) {
      throw new OAuthError('OAuth state has already been used');
    }

    // Mark state as used
    await prisma.integrationOAuthState.update({
      where: { state },
      data: { usedAt: new Date() },
    });

    const connector = connectorRegistry.getOrThrow(oauthState.integrationSlug);

    try {
      // Exchange code for tokens
      const tokens = await connector.exchangeCode(
        code,
        oauthState.redirectUri,
        oauthState.codeVerifier ?? undefined
      );

      // Get integration type
      const integrationType = await prisma.integrationType.findUnique({
        where: { slug: oauthState.integrationSlug },
      });

      if (!integrationType) {
        throw new OAuthError(`Integration type not found: ${oauthState.integrationSlug}`);
      }

      // Create or update the workspace integration
      const integration = await prisma.workspaceIntegration.upsert({
        where: {
          workspaceId_integrationTypeId: {
            workspaceId: oauthState.workspaceId,
            integrationTypeId: integrationType.id,
          },
        },
        create: {
          workspaceId: oauthState.workspaceId,
          integrationTypeId: integrationType.id,
          status: 'CONNECTED',
          connectedAt: new Date(),
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
          tokenExpiry: tokens.expiresAt,
          tokenScopes: oauthState.requestedScopes,
          enabledWidgets: connector.supportedWidgets
            .filter((w) => w.defaultEnabled !== false)
            .map((w) => w.id),
        },
        update: {
          status: 'CONNECTED',
          connectedAt: new Date(),
          disconnectedAt: null,
          lastError: null,
          lastErrorAt: null,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
          tokenExpiry: tokens.expiresAt,
          tokenScopes: oauthState.requestedScopes,
        },
      });

      // Test the connection
      const valid = await connector.testConnection(tokens);
      if (!valid) {
        await prisma.workspaceIntegration.update({
          where: { id: integration.id },
          data: {
            status: 'ERROR',
            lastError: 'Connection test failed',
            lastErrorAt: new Date(),
          },
        });
        return {
          integrationId: integration.id,
          success: false,
          error: 'Connection test failed',
        };
      }

      return { integrationId: integration.id, success: true };
    } catch (error) {
      // Store error in state for debugging
      await prisma.integrationOAuthState.update({
        where: { state },
        data: { error: String(error) },
      });

      throw error;
    }
  }

  /**
   * Get valid tokens for an integration, refreshing if needed
   */
  async getValidTokens(integrationId: string): Promise<OAuthTokens> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration) {
      throw new OAuthError('Integration not found');
    }

    if (!integration.accessToken) {
      throw new OAuthError('No access token stored');
    }

    // Check if token is expired (with 5-minute buffer)
    const now = new Date();
    const buffer = 5 * 60 * 1000; // 5 minutes

    if (integration.tokenExpiry && integration.tokenExpiry.getTime() - buffer < now.getTime()) {
      // Token expired or about to expire - refresh it
      if (!integration.refreshToken) {
        // Mark as expired - needs reconnection
        await prisma.workspaceIntegration.update({
          where: { id: integrationId },
          data: {
            status: 'EXPIRED',
            lastError: 'Token expired and no refresh token available',
            lastErrorAt: now,
          },
        });
        throw new TokenExpiredError('Token expired and no refresh token available');
      }

      try {
        return await this.refreshTokens(integrationId);
      } catch {
        // Mark as needs reauth
        await prisma.workspaceIntegration.update({
          where: { id: integrationId },
          data: {
            status: 'NEEDS_REAUTH',
            lastError: 'Failed to refresh token',
            lastErrorAt: now,
          },
        });
        throw new TokenExpiredError('Failed to refresh token');
      }
    }

    return {
      accessToken: decryptToken(integration.accessToken),
      refreshToken: integration.refreshToken ? decryptToken(integration.refreshToken) : undefined,
      expiresAt: integration.tokenExpiry ?? undefined,
      scope: integration.tokenScopes.join(' '),
    };
  }

  /**
   * Refresh tokens for an integration
   */
  async refreshTokens(integrationId: string): Promise<OAuthTokens> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration) {
      throw new OAuthError('Integration not found');
    }

    if (!integration.refreshToken) {
      throw new OAuthError('No refresh token available');
    }

    const connector = connectorRegistry.getOrThrow(integration.integrationType.slug);
    const refreshToken = decryptToken(integration.refreshToken);

    const newTokens = await connector.refreshToken(refreshToken);

    // Update stored tokens
    await prisma.workspaceIntegration.update({
      where: { id: integrationId },
      data: {
        accessToken: encryptToken(newTokens.accessToken),
        refreshToken: newTokens.refreshToken
          ? encryptToken(newTokens.refreshToken)
          : integration.refreshToken,
        tokenExpiry: newTokens.expiresAt,
        status: 'CONNECTED',
        lastError: null,
        lastErrorAt: null,
      },
    });

    return newTokens;
  }

  /**
   * Revoke an integration and clean up
   */
  async revokeIntegration(integrationId: string): Promise<void> {
    const integration = await prisma.workspaceIntegration.findUnique({
      where: { id: integrationId },
      include: { integrationType: true },
    });

    if (!integration) {
      throw new OAuthError('Integration not found');
    }

    const connector = connectorRegistry.getOrThrow(integration.integrationType.slug);

    // Try to revoke token at provider
    if (integration.accessToken) {
      try {
        await connector.revokeToken(decryptToken(integration.accessToken));
      } catch (error) {
        // Log but don't fail - provider might be unavailable
        console.warn('Failed to revoke token at provider:', error);
      }
    }

    // Update integration status
    await prisma.workspaceIntegration.update({
      where: { id: integrationId },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        webhookId: null,
        webhookSecret: null,
      },
    });
  }
}

// Export singleton instance
export const oauthService = new OAuthService();

