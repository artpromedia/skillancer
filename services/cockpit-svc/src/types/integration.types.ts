/**
 * @module @skillancer/cockpit-svc/types/integration
 * Type definitions for Integration Platform
 */

import type {
  Integration,
  IntegrationMapping,
  IntegrationSyncLog,
  IntegrationTemplate,
  WebhookEvent,
  IntegrationProvider,
  IntegrationCategory,
  IntegrationStatus,
  SyncFrequency,
  IntegrationSyncDirection,
  IntegrationSyncType,
  IntegrationSyncStatus,
  MappingEntityType,
  WebhookEventStatus,
  IntegrationAuthType,
} from './prisma-shim.js';

// Re-export enums
export {
  IntegrationProvider,
  IntegrationCategory,
  IntegrationStatus,
  SyncFrequency,
  IntegrationSyncDirection,
  IntegrationSyncType,
  IntegrationSyncStatus,
  MappingEntityType,
  WebhookEventStatus,
  IntegrationAuthType,
} from './prisma-shim.js';

// ============================================================================
// OAUTH TYPES
// ============================================================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}

export interface ApiKeyConfig {
  headerName?: string;
  queryParamName?: string;
  prefix?: string;
  requiresSecret?: boolean;
  additionalFields?: Array<{
    name: string;
    label: string;
    type: 'text' | 'password' | 'url';
    required: boolean;
  }>;
}

// ============================================================================
// ACCOUNT INFO
// ============================================================================

export interface AccountInfo {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  apiSecret?: string;
}

// ============================================================================
// SYNC TYPES
// ============================================================================

export interface SyncOptions {
  fullSync?: boolean;
  entityTypes?: string[];
  since?: Date;
  cursor?: string;
  dryRun?: boolean;
}

export interface SyncResult {
  success: boolean;
  syncLogId: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  recordsFailed: number;
  errors: Array<{ message: string; entity?: string }>;
  nextCursor?: string;
  completedAt: Date;
}

export interface SyncContext {
  syncLogId: string;
  integration: Integration;
  syncType: string;
  entityTypes: string[];
  cursor?: string;
  startedAt: Date;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeleted: number;
  recordsFailed: number;
  errors: Array<{ message: string; entity?: string }>;
  nextCursor?: string;
}

export interface WebhookPayload {
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
}

// ============================================================================
// CONNECTION PARAMS
// ============================================================================

export interface ConnectWithOAuthParams {
  userId: string;
  provider: IntegrationProvider;
  authCode: string;
  redirectUri: string;
}

export interface ConnectWithApiKeyParams {
  userId: string;
  provider: IntegrationProvider;
  apiKey: string;
  apiSecret?: string;
  additionalParams?: Record<string, unknown>;
}

// ============================================================================
// INTEGRATION CREATE/UPDATE
// ============================================================================

export interface CreateIntegrationParams {
  userId: string;
  provider: IntegrationProvider;
  providerAccountId?: string;
  name: string;
  description?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  tokenType?: string;
  scope?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  accountEmail?: string;
  accountName?: string;
  accountAvatar?: string;
  metadata?: Record<string, unknown>;
  status?: IntegrationStatus;
  syncEnabled?: boolean;
  syncFrequency?: SyncFrequency;
  syncOptions?: Record<string, unknown>;
}

export interface UpdateIntegrationParams {
  name?: string;
  description?: string;
  providerAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  tokenType?: string;
  scope?: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  accountEmail?: string;
  accountName?: string;
  accountAvatar?: string;
  metadata?: Record<string, unknown>;
  status?: IntegrationStatus;
  isActive?: boolean;
  syncEnabled?: boolean;
  syncFrequency?: SyncFrequency;
  lastSyncAt?: Date;
  lastSyncStatus?: IntegrationSyncStatus;
  lastSyncError?: string | null;
  nextSyncAt?: Date;
  syncOptions?: Record<string, unknown>;
  rateLimitRemaining?: number;
  rateLimitResetAt?: Date;
  consecutiveErrors?: number;
  lastErrorAt?: Date;
  isPaused?: boolean;
  pausedReason?: string | null;
}

// ============================================================================
// MAPPING TYPES
// ============================================================================

export interface CreateMappingParams {
  integrationId: string;
  entityType: MappingEntityType;
  externalId: string;
  externalType?: string;
  externalName?: string;
  externalData?: Record<string, unknown>;
  internalId: string;
  internalType: string;
  syncDirection?: IntegrationSyncDirection;
  isActive?: boolean;
}

export interface UpdateMappingParams {
  externalType?: string;
  externalName?: string;
  externalData?: Record<string, unknown>;
  syncDirection?: IntegrationSyncDirection;
  lastSyncAt?: Date;
  lastSyncHash?: string;
  isActive?: boolean;
}

// ============================================================================
// SYNC LOG TYPES
// ============================================================================

export interface CreateSyncLogParams {
  integrationId: string;
  syncType: IntegrationSyncType;
  syncedEntities?: string[];
  entityType?: string;
  startedAt?: Date;
  status?: IntegrationSyncStatus;
  cursor?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSyncLogParams {
  completedAt?: Date;
  durationMs?: number;
  status?: IntegrationSyncStatus;
  itemsProcessed?: number;
  itemsCreated?: number;
  itemsUpdated?: number;
  itemsDeleted?: number;
  itemsFailed?: number;
  errorMessage?: string;
  errorDetails?: Record<string, unknown> | Array<{ item: string; error: string }>;
  metadata?: Record<string, unknown>;
  cursor?: string;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface CreateWebhookEventParams {
  integrationId?: string;
  provider: IntegrationProvider;
  eventType: string;
  eventId?: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
  status?: WebhookEventStatus;
  signatureValid?: boolean;
}

export interface UpdateWebhookEventParams {
  integrationId?: string;
  status?: WebhookEventStatus;
  processedAt?: Date;
  processingError?: string;
  retryCount?: number;
  nextRetryAt?: Date;
  signatureValid?: boolean;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface CreateIntegrationTemplateParams {
  provider: IntegrationProvider;
  name: string;
  description: string;
  category: IntegrationCategory;
  logoUrl: string;
  color: string;
  capabilities: string[];
  authType: IntegrationAuthType;
  oauthConfig?: OAuthConfig;
  apiKeyConfig?: ApiKeyConfig;
  syncOptionsSchema?: Record<string, unknown>;
  setupInstructions?: string;
  helpUrl?: string;
  isAvailable?: boolean;
  isBeta?: boolean;
  isPremium?: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface AvailableIntegration {
  provider: IntegrationProvider;
  name: string;
  description: string;
  category: IntegrationCategory;
  logoUrl: string;
  color: string;
  capabilities: string[];
  authType: IntegrationAuthType;
  isConnected: boolean;
  isBeta: boolean;
  isPremium: boolean;
  connection?: IntegrationWithStatus | null;
}

export type HealthStatus = 'healthy' | 'warning' | 'error';

export interface IntegrationWithStatus extends Omit<
  Integration,
  'accessToken' | 'refreshToken' | 'apiKey' | 'apiSecret'
> {
  recentSyncs: IntegrationSyncLog[];
  healthStatus: HealthStatus;
}

export interface IntegrationDetails extends IntegrationWithStatus {
  mappingCounts: {
    clients: number;
    projects: number;
    tasks: number;
    timeEntries: number;
    invoices: number;
    expenses: number;
  };
  syncLogs: IntegrationSyncLog[];
}

export interface IntegrationSettingsUpdate {
  name?: string;
  syncEnabled?: boolean;
  syncFrequency?: SyncFrequency;
  syncOptions?: Record<string, unknown>;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export type IntegrationErrorCode =
  | 'INTEGRATION_NOT_FOUND'
  | 'INTEGRATION_NOT_CONNECTED'
  | 'INTEGRATION_PAUSED'
  | 'INVALID_AUTH_TYPE'
  | 'INVALID_STATE'
  | 'INVALID_SIGNATURE'
  | 'NO_REFRESH_TOKEN'
  | 'UNSUPPORTED_PROVIDER'
  | 'RATE_LIMITED'
  | 'UNAUTHORIZED'
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'TOKEN_REFRESH_FAILED'
  | 'OAUTH_EXCHANGE_FAILED'
  | 'API_KEY_INVALID'
  | 'SYNC_IN_PROGRESS'
  | 'MAPPING_NOT_FOUND'
  | 'MAPPING_EXISTS';

export class IntegrationError extends Error {
  public readonly provider?: IntegrationProvider;
  public readonly details?: Record<string, unknown>;

  constructor(
    public readonly code: IntegrationErrorCode | string,
    message?: string,
    options?: {
      provider?: IntegrationProvider;
      details?: Record<string, unknown>;
    }
  ) {
    super(message || code);
    this.name = 'IntegrationError';
    this.provider = options?.provider;
    this.details = options?.details;
  }
}
