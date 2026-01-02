// @ts-nocheck
/**
 * Platform Connector Base
 * Abstract interface for connecting to external freelancing platforms
 * Sprint M4: Portable Verified Work History
 */

import { prisma } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';
import { createAuditLog } from '@skillancer/audit-client';
import { getCache } from '@skillancer/cache';
import crypto from 'crypto';

const logger = createLogger('platform-connector');

// =============================================================================
// TYPES
// =============================================================================

export enum Platform {
  SKILLANCER = 'SKILLANCER',
  UPWORK = 'UPWORK',
  FIVERR = 'FIVERR',
  FREELANCER = 'FREELANCER',
  LINKEDIN = 'LINKEDIN',
  MANUAL = 'MANUAL',
}

export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export enum VerificationLevel {
  SELF_REPORTED = 'SELF_REPORTED',
  PLATFORM_CONNECTED = 'PLATFORM_CONNECTED',
  PLATFORM_VERIFIED = 'PLATFORM_VERIFIED',
  CRYPTOGRAPHICALLY_SEALED = 'CRYPTOGRAPHICALLY_SEALED',
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
  tokenType?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export interface PlatformProfile {
  platformUserId: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  profileUrl: string;
  joinedDate?: Date;
  location?: string;
  bio?: string;
  skills?: string[];
  verified?: boolean;
  raw?: Record<string, unknown>;
}

export interface WorkHistoryItem {
  platformProjectId: string;
  title: string;
  description?: string;
  clientName?: string;
  clientId?: string;
  startDate: Date;
  endDate?: Date;
  earnings?: number;
  currency?: string;
  hoursWorked?: number;
  rating?: number;
  reviewText?: string;
  skills?: string[];
  projectUrl?: string;
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'CANCELLED';
  raw?: Record<string, unknown>;
}

export interface PlatformReview {
  reviewId: string;
  projectId?: string;
  rating: number;
  maxRating: number;
  reviewText?: string;
  reviewerName?: string;
  reviewerId?: string;
  reviewDate: Date;
  isPublic: boolean;
  raw?: Record<string, unknown>;
}

export interface EarningsData {
  totalEarnings: number;
  currency: string;
  periodStart?: Date;
  periodEnd?: Date;
  earningsByPeriod?: {
    period: string;
    amount: number;
  }[];
  earningsByCategory?: {
    category: string;
    amount: number;
  }[];
  raw?: Record<string, unknown>;
}

export interface VerificationResult {
  verified: boolean;
  level: VerificationLevel;
  checks: {
    check: string;
    passed: boolean;
    details?: string;
  }[];
  verificationHash?: string;
  verifiedAt: Date;
}

export interface SyncResult {
  success: boolean;
  platform: Platform;
  profileSynced: boolean;
  workHistoryCount: number;
  reviewsCount: number;
  errors: string[];
  syncedAt: Date;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfterMs: number;
}

// =============================================================================
// ABSTRACT PLATFORM CONNECTOR
// =============================================================================

export abstract class PlatformConnector {
  protected platform: Platform;
  protected oauthConfig: OAuthConfig;
  protected rateLimitConfig: RateLimitConfig;
  protected cache = getCache();

  constructor(platform: Platform) {
    this.platform = platform;
    this.oauthConfig = this.getOAuthConfig();
    this.rateLimitConfig = this.getRateLimitConfig();
  }

  // ---------------------------------------------------------------------------
  // ABSTRACT METHODS - Must be implemented by each platform
  // ---------------------------------------------------------------------------

  protected abstract getOAuthConfig(): OAuthConfig;
  protected abstract getRateLimitConfig(): RateLimitConfig;

  abstract fetchProfile(token: AuthToken): Promise<PlatformProfile>;
  abstract fetchWorkHistory(token: AuthToken): Promise<WorkHistoryItem[]>;
  abstract fetchReviews(token: AuthToken): Promise<PlatformReview[]>;
  abstract fetchEarnings(token: AuthToken): Promise<EarningsData | null>;
  abstract verifyData(
    data: WorkHistoryItem | PlatformReview,
    token: AuthToken
  ): Promise<VerificationResult>;

  // ---------------------------------------------------------------------------
  // OAUTH FLOW
  // ---------------------------------------------------------------------------

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.oauthConfig.redirectUri,
      response_type: 'code',
      scope: this.oauthConfig.scopes.join(' '),
      state,
    });

    return `${this.oauthConfig.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<AuthToken> {
    logger.info({ platform: this.platform }, 'Exchanging code for token');

    const response = await this.makeRequest(this.oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        redirect_uri: this.oauthConfig.redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error({ platform: this.platform, error: data }, 'Token exchange failed');
      throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scope: data.scope?.split(' '),
      tokenType: data.token_type,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    logger.info({ platform: this.platform }, 'Refreshing token');

    const response = await this.makeRequest(this.oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error({ platform: this.platform, error: data }, 'Token refresh failed');
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      scope: data.scope?.split(' '),
      tokenType: data.token_type,
    };
  }

  // ---------------------------------------------------------------------------
  // CONNECTION MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Authenticate and create platform connection
   */
  async authenticate(
    userId: string,
    code: string
  ): Promise<{ connectionId: string; profile: PlatformProfile }> {
    logger.info({ userId, platform: this.platform }, 'Authenticating user');

    // Exchange code for token
    const token = await this.exchangeCodeForToken(code);

    // Fetch profile to verify connection
    const profile = await this.fetchProfile(token);

    // Store connection
    const connection = await prisma.platformConnection.upsert({
      where: {
        userId_platform: {
          userId,
          platform: this.platform,
        },
      },
      update: {
        platformUserId: profile.platformUserId,
        accessToken: this.encryptToken(token.accessToken),
        refreshToken: token.refreshToken ? this.encryptToken(token.refreshToken) : null,
        tokenExpiry: token.expiresAt,
        syncStatus: SyncStatus.PENDING,
        updatedAt: new Date(),
      },
      create: {
        userId,
        platform: this.platform,
        platformUserId: profile.platformUserId,
        accessToken: this.encryptToken(token.accessToken),
        refreshToken: token.refreshToken ? this.encryptToken(token.refreshToken) : null,
        tokenExpiry: token.expiresAt,
        syncStatus: SyncStatus.PENDING,
      },
    });

    // Audit log
    await createAuditLog({
      userId,
      action: 'PLATFORM_CONNECTED',
      resourceType: 'PlatformConnection',
      resourceId: connection.id,
      details: {
        platform: this.platform,
        platformUserId: profile.platformUserId,
      },
    });

    logger.info(
      { userId, platform: this.platform, connectionId: connection.id },
      'Platform connected successfully'
    );

    return { connectionId: connection.id, profile };
  }

  /**
   * Disconnect platform
   */
  async disconnect(userId: string): Promise<void> {
    logger.info({ userId, platform: this.platform }, 'Disconnecting platform');

    const connection = await prisma.platformConnection.findUnique({
      where: {
        userId_platform: {
          userId,
          platform: this.platform,
        },
      },
    });

    if (!connection) {
      throw new Error(`No ${this.platform} connection found`);
    }

    // Delete connection (cascade will handle work history)
    await prisma.platformConnection.delete({
      where: { id: connection.id },
    });

    // Audit log
    await createAuditLog({
      userId,
      action: 'PLATFORM_DISCONNECTED',
      resourceType: 'PlatformConnection',
      resourceId: connection.id,
      details: { platform: this.platform },
    });

    logger.info({ userId, platform: this.platform }, 'Platform disconnected');
  }

  // ---------------------------------------------------------------------------
  // SYNC OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Full sync of platform data
   */
  async sync(userId: string): Promise<SyncResult> {
    logger.info({ userId, platform: this.platform }, 'Starting platform sync');

    const result: SyncResult = {
      success: false,
      platform: this.platform,
      profileSynced: false,
      workHistoryCount: 0,
      reviewsCount: 0,
      errors: [],
      syncedAt: new Date(),
    };

    try {
      // Get connection
      const connection = await prisma.platformConnection.findUnique({
        where: {
          userId_platform: {
            userId,
            platform: this.platform,
          },
        },
      });

      if (!connection) {
        throw new Error(`No ${this.platform} connection found`);
      }

      // Update sync status
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: { syncStatus: SyncStatus.SYNCING },
      });

      // Decrypt and prepare token
      let token: AuthToken = {
        accessToken: this.decryptToken(connection.accessToken),
        refreshToken: connection.refreshToken
          ? this.decryptToken(connection.refreshToken)
          : undefined,
        expiresAt: connection.tokenExpiry || undefined,
      };

      // Refresh token if expired
      if (token.expiresAt && token.expiresAt < new Date() && token.refreshToken) {
        token = await this.refreshToken(token.refreshToken);
        await prisma.platformConnection.update({
          where: { id: connection.id },
          data: {
            accessToken: this.encryptToken(token.accessToken),
            refreshToken: token.refreshToken
              ? this.encryptToken(token.refreshToken)
              : connection.refreshToken,
            tokenExpiry: token.expiresAt,
          },
        });
      }

      // Sync profile
      try {
        const profile = await this.fetchProfile(token);
        await this.updateStoredProfile(userId, profile);
        result.profileSynced = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Profile sync failed';
        result.errors.push(message);
        logger.error({ userId, platform: this.platform, error }, 'Profile sync failed');
      }

      // Sync work history
      try {
        const workHistory = await this.fetchWorkHistory(token);
        result.workHistoryCount = await this.syncWorkHistory(userId, connection.id, workHistory);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Work history sync failed';
        result.errors.push(message);
        logger.error({ userId, platform: this.platform, error }, 'Work history sync failed');
      }

      // Sync reviews
      try {
        const reviews = await this.fetchReviews(token);
        result.reviewsCount = await this.syncReviews(userId, connection.id, reviews);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Reviews sync failed';
        result.errors.push(message);
        logger.error({ userId, platform: this.platform, error }, 'Reviews sync failed');
      }

      // Update connection status
      await prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          syncStatus: result.errors.length === 0 ? SyncStatus.SYNCED : SyncStatus.FAILED,
          lastSynced: new Date(),
        },
      });

      result.success = result.errors.length === 0;

      // Audit log
      await createAuditLog({
        userId,
        action: 'PLATFORM_SYNCED',
        resourceType: 'PlatformConnection',
        resourceId: connection.id,
        details: {
          platform: this.platform,
          workHistoryCount: result.workHistoryCount,
          reviewsCount: result.reviewsCount,
          errors: result.errors,
        },
      });

      logger.info({ userId, platform: this.platform, result }, 'Platform sync completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      result.errors.push(message);
      logger.error({ userId, platform: this.platform, error }, 'Platform sync failed');
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // DATA STORAGE
  // ---------------------------------------------------------------------------

  protected async syncWorkHistory(
    userId: string,
    connectionId: string,
    items: WorkHistoryItem[]
  ): Promise<number> {
    let count = 0;

    for (const item of items) {
      try {
        // Generate verification hash
        const verificationHash = this.generateVerificationHash(item);

        await prisma.workHistoryItem.upsert({
          where: {
            userId_platform_platformProjectId: {
              userId,
              platform: this.platform,
              platformProjectId: item.platformProjectId,
            },
          },
          update: {
            title: item.title,
            description: item.description,
            clientName: item.clientName,
            clientId: item.clientId,
            startDate: item.startDate,
            endDate: item.endDate,
            earnings: item.earnings,
            currency: item.currency,
            hoursWorked: item.hoursWorked,
            rating: item.rating,
            reviewText: item.reviewText,
            skills: item.skills || [],
            verificationLevel: VerificationLevel.PLATFORM_VERIFIED,
            verificationDate: new Date(),
            verificationHash,
            updatedAt: new Date(),
          },
          create: {
            userId,
            connectionId,
            platform: this.platform,
            platformProjectId: item.platformProjectId,
            title: item.title,
            description: item.description,
            clientName: item.clientName,
            clientId: item.clientId,
            startDate: item.startDate,
            endDate: item.endDate,
            earnings: item.earnings,
            currency: item.currency,
            hoursWorked: item.hoursWorked,
            rating: item.rating,
            reviewText: item.reviewText,
            skills: item.skills || [],
            verificationLevel: VerificationLevel.PLATFORM_VERIFIED,
            verificationDate: new Date(),
            verificationHash,
            isPublic: true,
          },
        });

        count++;
      } catch (error) {
        logger.error(
          { userId, platform: this.platform, item: item.platformProjectId, error },
          'Failed to sync work history item'
        );
      }
    }

    return count;
  }

  protected async syncReviews(
    userId: string,
    connectionId: string,
    reviews: PlatformReview[]
  ): Promise<number> {
    let count = 0;

    for (const review of reviews) {
      try {
        // Link review to work history item if possible
        const workHistoryItem = review.projectId
          ? await prisma.workHistoryItem.findFirst({
              where: {
                userId,
                platform: this.platform,
                platformProjectId: review.projectId,
              },
            })
          : null;

        if (workHistoryItem) {
          await prisma.workHistoryItem.update({
            where: { id: workHistoryItem.id },
            data: {
              rating: (review.rating / review.maxRating) * 5, // Normalize to 5-star scale
              reviewText: review.reviewText,
            },
          });
          count++;
        }
      } catch (error) {
        logger.error(
          { userId, platform: this.platform, reviewId: review.reviewId, error },
          'Failed to sync review'
        );
      }
    }

    return count;
  }

  protected async updateStoredProfile(userId: string, profile: PlatformProfile): Promise<void> {
    // Store platform-specific profile data
    await prisma.platformConnection.updateMany({
      where: {
        userId,
        platform: this.platform,
      },
      data: {
        platformUserId: profile.platformUserId,
        metadata: profile.raw as object,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // UTILITIES
  // ---------------------------------------------------------------------------

  protected async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    // Rate limiting check
    const rateLimitKey = `rate_limit:${this.platform}`;
    const currentCount = (await this.cache.get<number>(rateLimitKey)) || 0;

    if (currentCount >= this.rateLimitConfig.maxRequests) {
      logger.warn({ platform: this.platform }, 'Rate limit reached, waiting...');
      await this.sleep(this.rateLimitConfig.retryAfterMs);
    }

    // Increment rate limit counter
    await this.cache.set(rateLimitKey, currentCount + 1, this.rateLimitConfig.windowMs / 1000);

    // Make request with retries
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'User-Agent': 'Skillancer/1.0',
          },
        });

        // Handle rate limiting response
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
          logger.warn({ platform: this.platform, retryAfter }, 'Rate limited by platform');
          await this.sleep(retryAfter * 1000);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ platform: this.platform, attempt, error }, 'Request failed, retrying...');
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  protected generateVerificationHash(data: unknown): string {
    const normalized = JSON.stringify(data, Object.keys(data as object).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  protected encryptToken(token: string): string {
    // In production, use proper encryption (e.g., AWS KMS, Vault)
    // This is a placeholder for the encryption pattern
    const key = process.env.TOKEN_ENCRYPTION_KEY || 'default-key-change-in-production';
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  protected decryptToken(encryptedToken: string): string {
    const key = process.env.TOKEN_ENCRYPTION_KEY || 'default-key-change-in-production';
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// CONNECTOR REGISTRY
// =============================================================================

const connectorRegistry = new Map<Platform, PlatformConnector>();

export function registerConnector(connector: PlatformConnector): void {
  connectorRegistry.set(connector['platform'], connector);
}

export function getConnector(platform: Platform): PlatformConnector {
  const connector = connectorRegistry.get(platform);
  if (!connector) {
    throw new Error(`No connector registered for platform: ${platform}`);
  }
  return connector;
}

export function getAllConnectors(): PlatformConnector[] {
  return Array.from(connectorRegistry.values());
}

// =============================================================================
// PLATFORM CONNECTOR SERVICE
// =============================================================================

class PlatformConnectorService {
  /**
   * Get all connected platforms for a user
   */
  async getConnections(userId: string) {
    return prisma.platformConnection.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        syncStatus: true,
        lastSynced: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get connection details
   */
  async getConnection(userId: string, platform: Platform) {
    return prisma.platformConnection.findUnique({
      where: {
        userId_platform: {
          userId,
          platform,
        },
      },
    });
  }

  /**
   * Initiate OAuth flow for a platform
   */
  initiateOAuth(platform: Platform, userId: string): string {
    const connector = getConnector(platform);
    const state = this.generateOAuthState(userId, platform);
    return connector.getAuthorizationUrl(state);
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    platform: Platform,
    code: string,
    state: string
  ): Promise<{ connectionId: string; profile: PlatformProfile }> {
    const { userId } = this.parseOAuthState(state);
    const connector = getConnector(platform);
    return connector.authenticate(userId, code);
  }

  /**
   * Sync all platforms for a user
   */
  async syncAllPlatforms(userId: string): Promise<SyncResult[]> {
    const connections = await this.getConnections(userId);
    const results: SyncResult[] = [];

    for (const connection of connections) {
      try {
        const connector = getConnector(connection.platform as Platform);
        const result = await connector.sync(userId);
        results.push(result);
      } catch (error) {
        logger.error({ userId, platform: connection.platform, error }, 'Failed to sync platform');
        results.push({
          success: false,
          platform: connection.platform as Platform,
          profileSynced: false,
          workHistoryCount: 0,
          reviewsCount: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          syncedAt: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Generate OAuth state parameter
   */
  private generateOAuthState(userId: string, platform: Platform): string {
    const payload = {
      userId,
      platform,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  /**
   * Parse OAuth state parameter
   */
  private parseOAuthState(state: string): { userId: string; platform: Platform } {
    try {
      const payload = JSON.parse(Buffer.from(state, 'base64url').toString());

      // Validate timestamp (10 minutes expiry)
      if (Date.now() - payload.timestamp > 10 * 60 * 1000) {
        throw new Error('OAuth state expired');
      }

      return {
        userId: payload.userId,
        platform: payload.platform,
      };
    } catch (error) {
      throw new Error('Invalid OAuth state');
    }
  }
}

// Singleton instance
let platformConnectorService: PlatformConnectorService | null = null;

export function getPlatformConnectorService(): PlatformConnectorService {
  if (!platformConnectorService) {
    platformConnectorService = new PlatformConnectorService();
  }
  return platformConnectorService;
}

