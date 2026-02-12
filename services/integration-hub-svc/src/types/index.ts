// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/types
 * Integration Hub type definitions
 */

import type { ExecutiveType } from '@skillancer/database';

// ============================================================================
// INTEGRATION CATEGORIES
// ============================================================================

export type IntegrationCategory =
  | 'ACCOUNTING'
  | 'ANALYTICS'
  | 'DEVTOOLS'
  | 'SECURITY'
  | 'HR'
  | 'MARKETING'
  | 'PRODUCTIVITY'
  | 'COMMUNICATION'
  | 'CLOUD'
  | 'CRM'
  | 'FINANCE'
  | 'PROJECT_MANAGEMENT';

export type IntegrationTier = 'BASIC' | 'PRO' | 'ENTERPRISE' | 'ADDON';

export type IntegrationStatus =
  | 'PENDING'
  | 'CONNECTED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ERROR'
  | 'DISCONNECTED'
  | 'NEEDS_REAUTH';

export type SyncStatus = 'NEVER' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'SCHEDULED';

// ============================================================================
// OAUTH TYPES
// ============================================================================

export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  scopeSeparator: ' ' | ',' | '+';
  responseType?: 'code' | 'token';
  grantType?: 'authorization_code' | 'client_credentials';
  pkceRequired?: boolean;
  additionalAuthParams?: Record<string, string>;
  additionalTokenParams?: Record<string, string>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
  rawResponse?: Record<string, unknown>;
}

export interface OAuthState {
  workspaceId: string;
  connectorSlug: string;
  redirectUri: string;
  requestedScopes: string[];
  initiatedBy: string;
  expiresAt: Date;
  codeVerifier?: string; // For PKCE
}

// ============================================================================
// WIDGET TYPES
// ============================================================================

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  refreshInterval: number; // seconds, 0 = manual only
  requiredScopes: string[];
  configSchema?: JSONSchema;
  defaultEnabled?: boolean;
}

export interface WidgetData {
  widgetId: string;
  data: unknown;
  fetchedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  default?: unknown;
  description?: string;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface WebhookConfig {
  events: string[];
  secret?: string;
  signatureHeader?: string;
  signatureAlgorithm?: 'hmac-sha256' | 'hmac-sha1';
  timestampHeader?: string;
  timestampTolerance?: number; // seconds
}

export interface WebhookResult {
  processed: boolean;
  eventType: string;
  affectedIntegrationId?: string;
  updatedData?: unknown;
  error?: string;
}

// ============================================================================
// CONNECTOR TYPES
// ============================================================================

export interface ConnectorInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl?: string;
  category: IntegrationCategory;
  applicableRoles: ExecutiveType[];
  tier: IntegrationTier;
  isBeta?: boolean;
  supportedWidgets: WidgetDefinition[];
  webhookEnabled: boolean;
  setupGuideUrl?: string;
  apiDocsUrl?: string;
}

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface FetchResult<T = unknown> {
  data: T;
  status: number;
  headers: Record<string, string>;
  cached?: boolean;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

export interface RateLimitConfig {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  burstSize?: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class IntegrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export class OAuthError extends IntegrationError {
  constructor(
    message: string,
    public oauthError?: string,
    public oauthErrorDescription?: string
  ) {
    super(message, 'OAUTH_ERROR', 400);
    this.name = 'OAuthError';
  }
}

export class TokenExpiredError extends IntegrationError {
  constructor(message: string = 'Access token has expired') {
    super(message, 'TOKEN_EXPIRED', 401);
    this.name = 'TokenExpiredError';
  }
}

export class RateLimitError extends IntegrationError {
  constructor(
    public retryAfter?: number,
    message: string = 'Rate limit exceeded'
  ) {
    super(message, 'RATE_LIMITED', 429);
    this.name = 'RateLimitError';
  }
}

export class ProviderError extends IntegrationError {
  constructor(
    message: string,
    public providerMessage?: string,
    public providerCode?: string,
    statusCode: number = 502
  ) {
    super(message, 'PROVIDER_ERROR', statusCode);
    this.name = 'ProviderError';
  }
}
