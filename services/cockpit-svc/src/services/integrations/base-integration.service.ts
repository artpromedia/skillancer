/**
 * @module @skillancer/cockpit-svc/services/integrations/base
 * Base Integration Service - Abstract class for provider-specific implementations
 */

import { IntegrationMappingRepository } from '../../repositories/integration-mapping.repository.js';
import { IntegrationSyncLogRepository } from '../../repositories/integration-sync-log.repository.js';
import { IntegrationRepository } from '../../repositories/integration.repository.js';
import { IntegrationError } from '../../types/integration.types.js';

import type {
  OAuthConfig,
  OAuthTokens,
  ApiKeyConfig,
  SyncOptions,
  SyncResult,
  SyncContext,
  AccountInfo,
  WebhookPayload,
} from '../../types/integration.types.js';
import type { EncryptionService } from '../encryption.service.js';
import type {
  Integration,
  IntegrationProvider,
  IntegrationMapping,
  MappingEntityType,
} from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

/**
 * Rate limit configuration for API requests
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * HTTP response with rate limit headers
 */
export interface RateLimitedResponse<T> {
  data: T;
  rateLimitRemaining?: number;
  rateLimitResetAt?: Date;
}

/**
 * Retry configuration for failed requests
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
}

/**
 * Abstract base class for integration providers
 * Each provider (Upwork, Fiverr, etc.) extends this class
 */
export abstract class BaseIntegrationService {
  protected readonly integrationRepo: IntegrationRepository;
  protected readonly mappingRepo: IntegrationMappingRepository;
  protected readonly syncLogRepo: IntegrationSyncLogRepository;

  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly logger: Logger,
    protected readonly encryption: EncryptionService
  ) {
    this.integrationRepo = new IntegrationRepository(prisma);
    this.mappingRepo = new IntegrationMappingRepository(prisma);
    this.syncLogRepo = new IntegrationSyncLogRepository(prisma);
  }

  /**
   * Get the provider identifier
   */
  abstract get provider(): IntegrationProvider;

  /**
   * Get the display name for this provider
   */
  abstract get displayName(): string;

  /**
   * Get the OAuth configuration for this provider
   */
  abstract getOAuthConfig(): OAuthConfig | null;

  /**
   * Get the API key configuration for this provider
   */
  abstract getApiKeyConfig(): ApiKeyConfig | null;

  /**
   * Get the rate limit configuration
   */
  abstract getRateLimitConfig(): RateLimitConfig;

  /**
   * Get the retry configuration
   */
  getRetryConfig(): RetryConfig {
    return {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    };
  }

  // =====================
  // OAuth Methods
  // =====================

  /**
   * Generate the OAuth authorization URL
   */
  abstract getOAuthUrl(userId: string, state: string, redirectUri: string): string;

  /**
   * Exchange authorization code for access tokens
   */
  abstract exchangeAuthCode(code: string, redirectUri: string): Promise<OAuthTokens>;

  /**
   * Refresh the OAuth access token
   */
  abstract refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

  /**
   * Revoke OAuth access (disconnect)
   */
  abstract revokeAccess(accessToken: string): Promise<void>;

  // =====================
  // API Key Methods
  // =====================

  /**
   * Validate an API key
   */
  abstract validateApiKey(apiKey: string, apiSecret?: string): Promise<boolean>;

  // =====================
  // Account Methods
  // =====================

  /**
   * Get account information from the provider
   */
  abstract getAccountInfo(integration: Integration): Promise<AccountInfo>;

  // =====================
  // Sync Methods
  // =====================

  /**
   * Perform a data sync
   */
  abstract sync(integration: Integration, options: SyncOptions): Promise<SyncResult>;

  /**
   * Get supported sync entity types
   */
  abstract getSupportedSyncTypes(): string[];

  // =====================
  // Webhook Methods
  // =====================

  /**
   * Verify webhook signature
   */
  abstract verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean;

  /**
   * Process incoming webhook
   */
  abstract processWebhook(integration: Integration, payload: WebhookPayload): Promise<void>;

  /**
   * Get supported webhook event types
   */
  abstract getSupportedWebhookEvents(): string[];

  // =====================
  // Helper Methods
  // =====================

  /**
   * Make an authenticated API request with retry logic
   */
  protected async makeRequest<T>(
    integration: Integration,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      retryCount?: number;
    }
  ): Promise<RateLimitedResponse<T>> {
    const retryConfig = this.getRetryConfig();
    const retryCount = options?.retryCount ?? 0;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options?.headers,
      };

      // Add authorization header
      if (integration.accessToken) {
        const tokenType = integration.tokenType ?? 'Bearer';
        const decryptedToken = await this.encryption.decrypt(integration.accessToken);
        headers.Authorization = `${tokenType} ${decryptedToken}`;
      } else if (integration.apiKey) {
        const decryptedKey = await this.encryption.decrypt(integration.apiKey);
        headers['X-API-Key'] = decryptedKey;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      // Extract rate limit headers
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
        ? parseInt(response.headers.get('X-RateLimit-Remaining')!, 10)
        : undefined;
      const rateLimitReset = response.headers.get('X-RateLimit-Reset')
        ? new Date(parseInt(response.headers.get('X-RateLimit-Reset')!, 10) * 1000)
        : undefined;

      // Update rate limits in database
      if (rateLimitRemaining !== undefined || rateLimitReset !== undefined) {
        await this.integrationRepo.updateRateLimits(integration.id, {
          remaining: rateLimitRemaining,
          resetAt: rateLimitReset,
        });
      }

      // Handle non-success responses
      if (!response.ok) {
        // Check if we should retry
        if (
          retryCount < retryConfig.maxRetries &&
          retryConfig.retryableStatusCodes.includes(response.status)
        ) {
          const delay = Math.min(
            retryConfig.baseDelayMs * Math.pow(2, retryCount),
            retryConfig.maxDelayMs
          );

          this.logger.warn(
            {
              provider: this.provider,
              integrationId: integration.id,
              status: response.status,
              retryCount: retryCount + 1,
              delay,
            },
            'API request failed, retrying'
          );

          await this.sleep(delay);
          return await this.makeRequest<T>(integration, method, url, {
            ...options,
            retryCount: retryCount + 1,
          });
        }

        const errorBody = await response.text();
        throw this.createError('API_ERROR', `API request failed: ${response.status}`, {
          status: response.status,
          body: errorBody,
        });
      }

      const data = (await response.json()) as T;

      return {
        data,
        rateLimitRemaining,
        rateLimitResetAt: rateLimitReset,
      };
    } catch (error) {
      if ((error as IntegrationError).code) {
        throw error;
      }

      // Network or unexpected errors
      if (retryCount < retryConfig.maxRetries) {
        const delay = Math.min(
          retryConfig.baseDelayMs * Math.pow(2, retryCount),
          retryConfig.maxDelayMs
        );

        this.logger.warn(
          {
            provider: this.provider,
            integrationId: integration.id,
            error: (error as Error).message,
            retryCount: retryCount + 1,
            delay,
          },
          'Network error, retrying'
        );

        await this.sleep(delay);
        return this.makeRequest<T>(integration, method, url, {
          ...options,
          retryCount: retryCount + 1,
        });
      }

      throw this.createError(
        'NETWORK_ERROR',
        `Network request failed: ${(error as Error).message}`,
        { originalError: error }
      );
    }
  }

  /**
   * Encrypt sensitive data before storage
   */
  protected async encryptCredential(value: string): Promise<string> {
    return this.encryption.encrypt(value);
  }

  /**
   * Decrypt sensitive data for use
   */
  protected async decryptCredential(encrypted: string): Promise<string> {
    return this.encryption.decrypt(encrypted);
  }

  /**
   * Create a sync context for tracking progress
   */
  protected async createSyncContext(
    integration: Integration,
    options: SyncOptions
  ): Promise<SyncContext> {
    const syncLog = await this.syncLogRepo.create({
      integrationId: integration.id,
      syncType: options.fullSync ? 'FULL' : 'INCREMENTAL',
      syncedEntities: options.entityTypes,
      cursor: options.cursor,
    });

    return {
      syncLogId: syncLog.id,
      integration,
      syncType: options.fullSync ? 'FULL' : 'INCREMENTAL',
      entityTypes: options.entityTypes ?? [],
      cursor: options.cursor,
      startedAt: new Date(),
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      recordsFailed: 0,
      errors: [],
    };
  }

  /**
   * Update sync context progress
   */
  protected async updateSyncProgress(context: SyncContext): Promise<void> {
    await this.syncLogRepo.updateProgress(context.syncLogId, {
      itemsProcessed: context.recordsProcessed,
      itemsCreated: context.recordsCreated,
      itemsUpdated: context.recordsUpdated,
      itemsDeleted: context.recordsDeleted,
      itemsFailed: context.recordsFailed,
      cursor: context.nextCursor,
    });
  }

  /**
   * Complete the sync and update records
   */
  protected async completeSyncContext(context: SyncContext, success: boolean): Promise<SyncResult> {
    const status = success ? (context.errors.length > 0 ? 'PARTIAL' : 'COMPLETED') : 'FAILED';
    const firstError = context.errors[0];

    await this.syncLogRepo.complete(context.syncLogId, {
      status,
      itemsProcessed: context.recordsProcessed,
      itemsCreated: context.recordsCreated,
      itemsUpdated: context.recordsUpdated,
      itemsDeleted: context.recordsDeleted,
      itemsFailed: context.recordsFailed,
      errorMessage: firstError?.message,
      errorDetails:
        context.errors.length > 0
          ? { errors: context.errors.map((e) => ({ message: e.message, entity: e.entity })) }
          : undefined,
      cursor: context.nextCursor,
    });

    // Update integration sync status
    const nextSyncAt = this.calculateNextSyncTime(context.integration);
    await this.integrationRepo.update(context.integration.id, {
      lastSyncAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: success ? undefined : firstError?.message,
      nextSyncAt,
      consecutiveErrors: success ? 0 : (context.integration.consecutiveErrors ?? 0) + 1,
      lastErrorAt: success ? undefined : new Date(),
    });

    return {
      success,
      syncLogId: context.syncLogId,
      recordsProcessed: context.recordsProcessed,
      recordsCreated: context.recordsCreated,
      recordsUpdated: context.recordsUpdated,
      recordsDeleted: context.recordsDeleted,
      recordsFailed: context.recordsFailed,
      errors: context.errors,
      nextCursor: context.nextCursor,
      completedAt: new Date(),
    };
  }

  /**
   * Calculate the next sync time based on frequency
   */
  protected calculateNextSyncTime(integration: Integration): Date {
    const now = new Date();
    const frequency = integration.syncFrequency;

    switch (frequency) {
      case 'REALTIME':
        return now; // Immediate
      case 'EVERY_5_MIN':
        return new Date(now.getTime() + 5 * 60 * 1000);
      case 'EVERY_15_MIN':
        return new Date(now.getTime() + 15 * 60 * 1000);
      case 'HOURLY':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case 'EVERY_6_HOURS':
        return new Date(now.getTime() + 6 * 60 * 60 * 1000);
      case 'DAILY':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'WEEKLY':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'MANUAL':
      default:
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Far future
    }
  }

  /**
   * Create or update an entity mapping
   */
  protected async upsertMapping(
    integration: Integration,
    entityType: MappingEntityType,
    externalId: string,
    internalId: string,
    internalType: string,
    options?: {
      externalType?: string;
      externalName?: string;
      externalData?: Record<string, unknown>;
    }
  ): Promise<IntegrationMapping> {
    return this.mappingRepo.upsert({
      integrationId: integration.id,
      entityType,
      externalId,
      externalType: options?.externalType,
      externalName: options?.externalName,
      externalData: options?.externalData,
      internalId,
      internalType,
    });
  }

  /**
   * Find internal ID for an external entity
   */
  protected async findInternalId(
    integration: Integration,
    entityType: MappingEntityType,
    externalId: string
  ): Promise<string | null> {
    const mapping = await this.mappingRepo.findByExternalId(integration.id, entityType, externalId);
    return mapping?.internalId ?? null;
  }

  /**
   * Find external ID for an internal entity
   */
  protected async findExternalId(
    integration: Integration,
    internalId: string,
    internalType: string
  ): Promise<string | null> {
    const mapping = await this.mappingRepo.findByInternalId(
      integration.id,
      internalId,
      internalType
    );
    return mapping?.externalId ?? null;
  }

  /**
   * Create a typed integration error
   */
  protected createError(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): IntegrationError {
    return new IntegrationError(code, message, {
      provider: this.provider,
      details,
    });
  }

  /**
   * Sleep for a specified duration
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
