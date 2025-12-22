/**
 * @module @skillancer/cockpit-svc/services/integrations/platform
 * Integration Platform Service - Main orchestration service for all integrations
 */

import { IntegrationMappingRepository } from '../../repositories/integration-mapping.repository.js';
import { IntegrationSyncLogRepository } from '../../repositories/integration-sync-log.repository.js';
import { IntegrationTemplateRepository } from '../../repositories/integration-template.repository.js';
import { IntegrationRepository } from '../../repositories/integration.repository.js';
import { WebhookEventRepository } from '../../repositories/webhook-event.repository.js';

import type { EncryptionService } from '../encryption.service.js';
import type { BaseIntegrationService } from './base-integration.service.js';
import type {
  SyncOptions,
  SyncResult,
  AccountInfo,
  AvailableIntegration,
  IntegrationWithStatus,
  IntegrationDetails,
  HealthStatus,
} from '../../types/integration.types.js';
import type { Integration, IntegrationProvider } from '@prisma/client';
import type { PrismaClient } from '@skillancer/database';
import type { Logger } from '@skillancer/logger';

/**
 * OAuth state data for validation
 */
interface OAuthStateData {
  userId: string;
  provider: IntegrationProvider;
  redirectUri: string;
  createdAt: number;
}

/**
 * Connect with OAuth result
 */
interface ConnectOAuthResult {
  integration: Integration;
  accountInfo: AccountInfo;
}

/**
 * Connect with API key parameters
 */
interface ConnectApiKeyParams {
  userId: string;
  provider: IntegrationProvider;
  name: string;
  apiKey: string;
  apiSecret?: string;
  description?: string;
}

/**
 * Connect with API key result
 */
interface ConnectApiKeyResult {
  integration: Integration;
  accountInfo: AccountInfo;
}

/**
 * Main Integration Platform Service
 * Orchestrates all provider-specific services and manages the integration lifecycle
 */
export class IntegrationPlatformService {
  private readonly integrationRepo: IntegrationRepository;
  private readonly templateRepo: IntegrationTemplateRepository;
  private readonly mappingRepo: IntegrationMappingRepository;
  private readonly syncLogRepo: IntegrationSyncLogRepository;
  private readonly webhookRepo: WebhookEventRepository;

  // Provider-specific services registry
  private readonly providerServices: Map<IntegrationProvider, BaseIntegrationService>;

  // OAuth state cache (in production, use Redis)
  private readonly oauthStateCache: Map<string, OAuthStateData>;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly encryption: EncryptionService
  ) {
    this.integrationRepo = new IntegrationRepository(prisma);
    this.templateRepo = new IntegrationTemplateRepository(prisma);
    this.mappingRepo = new IntegrationMappingRepository(prisma);
    this.syncLogRepo = new IntegrationSyncLogRepository(prisma);
    this.webhookRepo = new WebhookEventRepository(prisma);
    this.providerServices = new Map();
    this.oauthStateCache = new Map();
  }

  // =====================
  // Provider Registration
  // =====================

  /**
   * Register a provider-specific service
   */
  registerProvider(service: BaseIntegrationService): void {
    this.providerServices.set(service.provider, service);
    this.logger.info({ provider: service.provider }, 'Registered integration provider');
  }

  /**
   * Get a provider-specific service
   */
  getProviderService(provider: IntegrationProvider): BaseIntegrationService {
    const service = this.providerServices.get(provider);
    if (!service) {
      throw new Error(`Provider not registered: ${provider}`);
    }
    return service;
  }

  /**
   * Check if a provider is registered
   */
  hasProvider(provider: IntegrationProvider): boolean {
    return this.providerServices.has(provider);
  }

  // =====================
  // Template Management
  // =====================

  /**
   * Get all available integrations with user's connection status
   */
  async getAvailableIntegrations(userId: string): Promise<AvailableIntegration[]> {
    const [templates, userIntegrations] = await Promise.all([
      this.templateRepo.findAvailable(),
      this.integrationRepo.findByUser(userId),
    ]);

    const connectedProviders = new Map(userIntegrations.map((i) => [i.provider, i]));

    // Build results with connected status
    const results: AvailableIntegration[] = [];

    for (const template of templates) {
      const connected = connectedProviders.get(template.provider);
      let connection: IntegrationWithStatus | null = null;

      if (connected) {
        const recentSyncs = await this.syncLogRepo.findRecent(connected.id, 3);
        const healthStatus = this.getHealthStatus(connected);
        const { accessToken, refreshToken, apiKey, apiSecret, ...safeIntegration } = connected;
        connection = {
          ...safeIntegration,
          recentSyncs,
          healthStatus,
        };
      }

      results.push({
        provider: template.provider,
        name: template.name,
        description: template.description,
        category: template.category,
        logoUrl: template.logoUrl,
        color: template.color,
        capabilities: template.capabilities,
        authType: template.authType,
        isConnected: !!connected,
        isBeta: template.isBeta,
        isPremium: template.isPremium,
        connection,
      });
    }

    return results;
  }

  /**
   * Get available integrations by category
   */
  async getIntegrationsByCategory(
    userId: string,
    category: string
  ): Promise<AvailableIntegration[]> {
    const all = await this.getAvailableIntegrations(userId);
    return all.filter((i) => i.category === category);
  }

  /**
   * Search available integrations
   */
  async searchIntegrations(userId: string, query: string): Promise<AvailableIntegration[]> {
    const templates = await this.templateRepo.search(query);
    const userIntegrations = await this.integrationRepo.findByUser(userId);
    const connectedProviders = new Map(userIntegrations.map((i) => [i.provider, i]));

    const results: AvailableIntegration[] = [];

    for (const template of templates) {
      const connected = connectedProviders.get(template.provider);
      let connection: IntegrationWithStatus | null = null;

      if (connected) {
        const recentSyncs = await this.syncLogRepo.findRecent(connected.id, 3);
        const healthStatus = this.getHealthStatus(connected);
        const { accessToken, refreshToken, apiKey, apiSecret, ...safeIntegration } = connected;
        connection = {
          ...safeIntegration,
          recentSyncs,
          healthStatus,
        };
      }

      results.push({
        provider: template.provider,
        name: template.name,
        description: template.description,
        category: template.category,
        logoUrl: template.logoUrl,
        color: template.color,
        capabilities: template.capabilities,
        authType: template.authType,
        isConnected: !!connected,
        isBeta: template.isBeta,
        isPremium: template.isPremium,
        connection,
      });
    }

    return results;
  }

  // =====================
  // OAuth Connection Flow
  // =====================

  /**
   * Initiate OAuth connection flow
   */
  async initiateOAuthConnection(
    userId: string,
    provider: IntegrationProvider,
    redirectUri: string
  ): Promise<{ authUrl: string; state: string }> {
    const service = this.getProviderService(provider);
    const oauthConfig = service.getOAuthConfig();

    if (!oauthConfig) {
      throw new Error(`Provider ${provider} does not support OAuth`);
    }

    // Generate state for CSRF protection
    const state = this.encryption.generateToken(32);

    // Store state data
    this.oauthStateCache.set(state, {
      userId,
      provider,
      redirectUri,
      createdAt: Date.now(),
    });

    // Clean up old state entries
    this.cleanupOAuthStateCache();

    const authUrl = service.getOAuthUrl(userId, state, redirectUri);

    this.logger.info({ userId, provider, state }, 'OAuth flow initiated');

    return { authUrl, state };
  }

  /**
   * Complete OAuth connection flow
   */
  async completeOAuthConnection(state: string, code: string): Promise<ConnectOAuthResult> {
    // Validate state
    const stateData = this.oauthStateCache.get(state);
    if (!stateData) {
      throw new Error('Invalid or expired OAuth state');
    }

    // Check state age (max 10 minutes)
    if (Date.now() - stateData.createdAt > 10 * 60 * 1000) {
      this.oauthStateCache.delete(state);
      throw new Error('OAuth state expired');
    }

    const { userId, provider, redirectUri } = stateData;
    const service = this.getProviderService(provider);

    // Exchange code for tokens
    const tokens = await service.exchangeAuthCode(code, redirectUri);

    // Get template for provider info
    const template = await this.templateRepo.findByProvider(provider);

    // Encrypt tokens
    const encryptedAccessToken = await this.encryption.encrypt(tokens.accessToken);
    const encryptedRefreshToken = tokens.refreshToken
      ? await this.encryption.encrypt(tokens.refreshToken)
      : undefined;

    // Create integration record
    const integration = await this.integrationRepo.create({
      userId,
      provider,
      name: template?.name ?? provider,
      description: template?.description,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: tokens.expiresAt,
      tokenType: tokens.tokenType ?? 'Bearer',
      scope: tokens.scope,
      status: 'CONNECTED',
      syncEnabled: true,
      syncFrequency: 'HOURLY',
    });

    // Fetch account info
    const accountInfo = await service.getAccountInfo(integration);

    // Update integration with account info
    await this.integrationRepo.update(integration.id, {
      providerAccountId: accountInfo.id,
      accountEmail: accountInfo.email,
      accountName: accountInfo.name,
      accountAvatar: accountInfo.avatar,
      metadata: accountInfo.metadata,
    });

    // Clean up state
    this.oauthStateCache.delete(state);

    this.logger.info(
      { userId, provider, integrationId: integration.id },
      'OAuth connection completed'
    );

    return { integration, accountInfo };
  }

  // =====================
  // API Key Connection
  // =====================

  /**
   * Connect with API key
   */
  async connectWithApiKey(params: ConnectApiKeyParams): Promise<ConnectApiKeyResult> {
    const service = this.getProviderService(params.provider);

    // Validate API key
    const isValid = await service.validateApiKey(params.apiKey, params.apiSecret);
    if (!isValid) {
      throw new Error('Invalid API key');
    }

    // Get template for provider info
    const template = await this.templateRepo.findByProvider(params.provider);

    // Encrypt credentials
    const encryptedApiKey = await this.encryption.encrypt(params.apiKey);
    const encryptedApiSecret = params.apiSecret
      ? await this.encryption.encrypt(params.apiSecret)
      : undefined;

    // Create integration record
    const integration = await this.integrationRepo.create({
      userId: params.userId,
      provider: params.provider,
      name: params.name ?? template?.name ?? params.provider,
      description: params.description ?? template?.description,
      apiKey: encryptedApiKey,
      apiSecret: encryptedApiSecret,
      status: 'CONNECTED',
      syncEnabled: true,
      syncFrequency: 'HOURLY',
    });

    // Fetch account info
    const accountInfo = await service.getAccountInfo(integration);

    // Update integration with account info
    await this.integrationRepo.update(integration.id, {
      providerAccountId: accountInfo.id,
      accountEmail: accountInfo.email,
      accountName: accountInfo.name,
      accountAvatar: accountInfo.avatar,
      metadata: accountInfo.metadata,
    });

    this.logger.info(
      { userId: params.userId, provider: params.provider, integrationId: integration.id },
      'API key connection completed'
    );

    return { integration, accountInfo };
  }

  // =====================
  // Connection Management
  // =====================

  /**
   * Get user's integrations with status
   */
  async getUserIntegrations(userId: string): Promise<IntegrationWithStatus[]> {
    const integrations = await this.integrationRepo.findByUser(userId);

    return Promise.all(
      integrations.map(async (integration) => {
        const recentSyncs = await this.syncLogRepo.findRecent(integration.id, 5);
        const healthStatus = this.getHealthStatus(integration);

        // Omit sensitive fields
        const { accessToken, refreshToken, apiKey, apiSecret, ...safeIntegration } = integration;

        return {
          ...safeIntegration,
          recentSyncs,
          healthStatus,
        };
      })
    );
  }

  /**
   * Get integration details
   */
  async getIntegrationDetails(integrationId: string, userId: string): Promise<IntegrationDetails> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.userId !== userId) {
      throw new Error('Integration not found');
    }

    const [recentSyncs, mappingSummaryArray] = await Promise.all([
      this.syncLogRepo.findRecent(integration.id, 10),
      this.mappingRepo.getMappingSummary(integration.id),
    ]);

    const healthStatus = this.getHealthStatus(integration);

    // Convert array to counts object
    const mappingSummary = mappingSummaryArray.reduce(
      (acc, item) => {
        acc[item.entityType] = item.count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Omit sensitive fields
    const { accessToken, refreshToken, apiKey, apiSecret, ...safeIntegration } = integration;

    return {
      ...safeIntegration,
      recentSyncs,
      healthStatus,
      mappingCounts: {
        clients: mappingSummary.CLIENT ?? 0,
        projects: mappingSummary.PROJECT ?? 0,
        tasks: mappingSummary.TASK ?? 0,
        timeEntries: mappingSummary.TIME_ENTRY ?? 0,
        invoices: mappingSummary.INVOICE ?? 0,
        expenses: mappingSummary.EXPENSE ?? 0,
      },
      syncLogs: recentSyncs,
    };
  }

  /**
   * Update integration settings
   */
  async updateIntegrationSettings(
    integrationId: string,
    userId: string,
    settings: {
      name?: string;
      description?: string;
      syncEnabled?: boolean;
      syncFrequency?: Integration['syncFrequency'];
      syncOptions?: Record<string, unknown>;
    }
  ): Promise<Integration> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.userId !== userId) {
      throw new Error('Integration not found');
    }

    const updated = await this.integrationRepo.update(integrationId, {
      name: settings.name,
      description: settings.description,
      syncEnabled: settings.syncEnabled,
      syncFrequency: settings.syncFrequency,
      syncOptions: settings.syncOptions,
    });

    this.logger.info({ integrationId, userId, settings }, 'Integration settings updated');

    return updated;
  }

  /**
   * Disconnect an integration
   */
  async disconnectIntegration(integrationId: string, userId: string): Promise<void> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.userId !== userId) {
      throw new Error('Integration not found');
    }

    // Revoke access if OAuth
    if (integration.accessToken && this.hasProvider(integration.provider)) {
      try {
        const service = this.getProviderService(integration.provider);
        const decryptedToken = await this.encryption.decrypt(integration.accessToken);
        await service.revokeAccess(decryptedToken);
      } catch (error) {
        this.logger.warn(
          { integrationId, error: (error as Error).message },
          'Failed to revoke access token'
        );
      }
    }

    // Update status to revoked
    await this.integrationRepo.update(integrationId, {
      status: 'REVOKED',
      isActive: false,
    });

    this.logger.info(
      { integrationId, userId, provider: integration.provider },
      'Integration disconnected'
    );
  }

  /**
   * Pause an integration
   */
  async pauseIntegration(
    integrationId: string,
    userId: string,
    reason?: string
  ): Promise<Integration> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.userId !== userId) {
      throw new Error('Integration not found');
    }

    return this.integrationRepo.update(integrationId, {
      isPaused: true,
      pausedReason: reason,
    });
  }

  /**
   * Resume an integration
   */
  async resumeIntegration(integrationId: string, userId: string): Promise<Integration> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.userId !== userId) {
      throw new Error('Integration not found');
    }

    return this.integrationRepo.update(integrationId, {
      isPaused: false,
      pausedReason: undefined,
    });
  }

  // =====================
  // Token Management
  // =====================

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(integration: Integration): Promise<Integration> {
    // Skip if no refresh token
    if (!integration.refreshToken) {
      return integration;
    }

    // Skip if token not expired
    if (integration.tokenExpiresAt && integration.tokenExpiresAt > new Date()) {
      return integration;
    }

    const service = this.getProviderService(integration.provider);
    const decryptedRefreshToken = await this.encryption.decrypt(integration.refreshToken);

    try {
      const tokens = await service.refreshAccessToken(decryptedRefreshToken);

      // Encrypt new tokens
      const encryptedAccessToken = await this.encryption.encrypt(tokens.accessToken);
      const encryptedRefreshToken = tokens.refreshToken
        ? await this.encryption.encrypt(tokens.refreshToken)
        : undefined;

      const updated = await this.integrationRepo.update(integration.id, {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
        consecutiveErrors: 0,
      });

      this.logger.info(
        { integrationId: integration.id, provider: integration.provider },
        'Access token refreshed'
      );

      return updated;
    } catch (error) {
      // Mark integration as needing reauthorization
      await this.integrationRepo.update(integration.id, {
        status: 'EXPIRED',
        consecutiveErrors: (integration.consecutiveErrors ?? 0) + 1,
        lastErrorAt: new Date(),
      });

      this.logger.error(
        {
          integrationId: integration.id,
          provider: integration.provider,
          error: (error as Error).message,
        },
        'Token refresh failed'
      );

      throw error;
    }
  }

  /**
   * Refresh all expiring tokens
   */
  async refreshExpiringTokens(bufferMinutes: number = 5): Promise<void> {
    const integrations = await this.integrationRepo.findExpiredTokens(bufferMinutes);

    for (const integration of integrations) {
      try {
        await this.refreshTokenIfNeeded(integration);
      } catch (error) {
        this.logger.error(
          { integrationId: integration.id, error: (error as Error).message },
          'Failed to refresh token'
        );
      }
    }
  }

  // =====================
  // Sync Management
  // =====================

  /**
   * Trigger a manual sync
   */
  async triggerSync(
    integrationId: string,
    userId: string,
    options?: SyncOptions
  ): Promise<SyncResult> {
    const integration = await this.integrationRepo.findById(integrationId);
    if (!integration || integration.userId !== userId) {
      throw new Error('Integration not found');
    }

    if (integration.status !== 'CONNECTED') {
      throw new Error(`Integration is not connected: ${integration.status}`);
    }

    // Refresh token if needed
    const refreshedIntegration = await this.refreshTokenIfNeeded(integration);

    const service = this.getProviderService(refreshedIntegration.provider);

    const syncOptions: SyncOptions = {
      fullSync: options?.fullSync ?? false,
      entityTypes: options?.entityTypes,
      cursor: options?.cursor,
      dryRun: options?.dryRun ?? false,
    };

    this.logger.info({ integrationId, userId, options: syncOptions }, 'Starting sync');

    const result = await service.sync(refreshedIntegration, syncOptions);

    this.logger.info(
      {
        integrationId,
        result: {
          success: result.success,
          recordsProcessed: result.recordsProcessed,
          recordsCreated: result.recordsCreated,
          recordsUpdated: result.recordsUpdated,
          errorCount: result.errors.length,
        },
      },
      'Sync completed'
    );

    return result;
  }

  /**
   * Get integrations due for sync
   */
  async getIntegrationsDueForSync(): Promise<Integration[]> {
    return this.integrationRepo.findDueForSync(new Date());
  }

  /**
   * Process scheduled syncs
   */
  async processScheduledSyncs(): Promise<void> {
    const dueIntegrations = await this.getIntegrationsDueForSync();

    for (const integration of dueIntegrations) {
      try {
        await this.triggerSync(integration.id, integration.userId, {
          fullSync: false,
        });
      } catch (error) {
        this.logger.error(
          { integrationId: integration.id, error: (error as Error).message },
          'Scheduled sync failed'
        );
      }
    }
  }

  // =====================
  // Webhook Handling
  // =====================

  /**
   * Handle incoming webhook
   */
  async handleWebhook(
    provider: IntegrationProvider,
    eventType: string,
    payload: unknown,
    headers: Record<string, string>,
    signature?: string
  ): Promise<void> {
    // Store signature in headers if provided
    const enrichedHeaders = signature ? { ...headers, 'x-webhook-signature': signature } : headers;

    // Store the webhook event
    const event = await this.webhookRepo.create({
      provider,
      eventId: this.extractEventId(provider, payload),
      eventType,
      payload: payload as Record<string, unknown>,
      headers: enrichedHeaders,
      status: 'PENDING',
    });

    this.logger.info({ eventId: event.id, provider, eventType }, 'Webhook received');

    // Process immediately or queue for background processing
    try {
      await this.processWebhookEvent(event.id);
    } catch (error) {
      this.logger.error(
        { eventId: event.id, error: (error as Error).message },
        'Webhook processing failed'
      );
    }
  }

  /**
   * Process a webhook event
   */
  async processWebhookEvent(eventId: string): Promise<void> {
    const event = await this.webhookRepo.findById(eventId);
    if (!event) {
      throw new Error('Webhook event not found');
    }

    await this.webhookRepo.updateStatus(eventId, 'PROCESSING');

    try {
      // Find the integration
      const integration = event.integrationId
        ? await this.integrationRepo.findById(event.integrationId)
        : null;

      if (!integration) {
        // Try to find by provider account ID from payload
        // This is provider-specific logic
        await this.webhookRepo.markProcessed(eventId);
        return;
      }

      const service = this.getProviderService(event.provider);

      // Extract signature from headers and verify if secret exists
      const eventHeaders = event.headers as Record<string, string> | null;
      const signature =
        eventHeaders?.['x-webhook-signature'] ??
        eventHeaders?.['x-hub-signature-256'] ??
        eventHeaders?.['stripe-signature'];

      if (signature && integration.webhookSecret) {
        const decryptedSecret = await this.encryption.decrypt(integration.webhookSecret);
        const isValid = service.verifyWebhookSignature(
          JSON.stringify(event.payload),
          signature,
          decryptedSecret
        );

        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Process the webhook
      await service.processWebhook(integration, {
        eventType: event.eventType,
        payload: event.payload as Record<string, unknown>,
        receivedAt: event.createdAt,
      });

      await this.webhookRepo.markProcessed(eventId);

      this.logger.info(
        { eventId, provider: event.provider, eventType: event.eventType },
        'Webhook processed'
      );
    } catch (error) {
      await this.webhookRepo.markFailed(eventId, {
        message: (error as Error).message,
      });

      throw error;
    }
  }

  // =====================
  // Health & Monitoring
  // =====================

  /**
   * Check if an integration is healthy
   */
  private checkIntegrationHealth(integration: Integration): boolean {
    if (integration.status !== 'CONNECTED') {
      return false;
    }

    if (integration.isPaused) {
      return true; // Paused is not unhealthy
    }

    // Check for too many consecutive errors
    if ((integration.consecutiveErrors ?? 0) >= 3) {
      return false;
    }

    // Check if token is expired
    if (
      integration.tokenExpiresAt &&
      integration.tokenExpiresAt < new Date() &&
      !integration.refreshToken
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get health status as HealthStatus enum
   */
  private getHealthStatus(integration: Integration): HealthStatus {
    if (integration.status !== 'CONNECTED') {
      return 'error';
    }

    if (integration.isPaused) {
      return 'healthy'; // Paused is not unhealthy
    }

    // Check for too many consecutive errors
    if ((integration.consecutiveErrors ?? 0) >= 3) {
      return 'error';
    }

    // Check for some errors (warning)
    if ((integration.consecutiveErrors ?? 0) >= 1) {
      return 'warning';
    }

    // Check if token is expired
    if (
      integration.tokenExpiresAt &&
      integration.tokenExpiresAt < new Date() &&
      !integration.refreshToken
    ) {
      return 'error';
    }

    // Check if token is expiring soon (warning)
    if (
      integration.tokenExpiresAt &&
      integration.tokenExpiresAt < new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    ) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Get platform health stats
   */
  async getPlatformStats(): Promise<{
    totalIntegrations: number;
    connectedIntegrations: number;
    errorIntegrations: number;
    recentSyncs: number;
    failedSyncs: number;
    pendingWebhooks: number;
  }> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [connected, error, syncs, webhooks] = await Promise.all([
      this.prisma.integration.count({
        where: { status: 'CONNECTED', isActive: true },
      }),
      this.prisma.integration.count({
        where: { status: { in: ['ERROR', 'EXPIRED'] }, isActive: true },
      }),
      this.syncLogRepo.findByFilters({
        startDate: yesterday,
      }),
      this.webhookRepo.findByFilters({
        status: 'PENDING',
      }),
    ]);

    const failedSyncs = syncs.logs.filter((s) => s.status === 'FAILED').length;

    return {
      totalIntegrations: connected + error,
      connectedIntegrations: connected,
      errorIntegrations: error,
      recentSyncs: syncs.total,
      failedSyncs,
      pendingWebhooks: webhooks.total,
    };
  }

  // =====================
  // Private Helpers
  // =====================

  /**
   * Extract event ID from webhook payload
   */
  private extractEventId(provider: IntegrationProvider, payload: unknown): string | undefined {
    const data = payload as Record<string, unknown>;

    // Provider-specific event ID extraction
    switch (provider) {
      case 'GITHUB':
        return data.delivery as string;
      case 'SLACK':
        return data.event_id as string;
      case 'QUICKBOOKS':
      case 'XERO':
        return data.event_id as string;
      default:
        return (data.id as string) ?? (data.event_id as string);
    }
  }

  /**
   * Clean up old OAuth state entries
   */
  private cleanupOAuthStateCache(): void {
    const maxAge = 15 * 60 * 1000; // 15 minutes
    const now = Date.now();

    for (const [state, data] of this.oauthStateCache.entries()) {
      if (now - data.createdAt > maxAge) {
        this.oauthStateCache.delete(state);
      }
    }
  }
}
