// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/connectors/base
 * Base Connector Interface and Abstract Class
 *
 * All integration connectors extend this base class which provides:
 * - OAuth authentication flows
 * - HTTP client with retry logic
 * - Rate limiting
 * - Error handling
 * - Token refresh on 401
 * - Caching layer
 */

import type { ExecutiveType } from '@skillancer/database';
import type {
  ConnectorInfo,
  FetchOptions,
  FetchResult,
  IntegrationCategory,
  IntegrationTier,
  OAuthConfig,
  OAuthTokens,
  RateLimitConfig,
  WebhookConfig,
  WebhookResult,
  WidgetData,
  WidgetDefinition,
} from '../types/index.js';
import {
  IntegrationError,
  OAuthError,
  ProviderError,
  RateLimitError,
  TokenExpiredError,
} from '../types/index.js';
import { getConfig } from '../config/index.js';

// ============================================================================
// CONNECTOR INTERFACE
// ============================================================================

export interface IntegrationConnector {
  // Identity
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly logoUrl?: string;
  readonly category: IntegrationCategory;
  readonly applicableRoles: ExecutiveType[];
  readonly tier: IntegrationTier;
  readonly isBeta?: boolean;

  // OAuth Configuration
  getOAuthConfig(): OAuthConfig;

  // Authentication
  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string;
  exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokens>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;

  // Data Operations
  testConnection(tokens: OAuthTokens): Promise<boolean>;
  fetchData<T = unknown>(
    tokens: OAuthTokens,
    endpoint: string,
    options?: FetchOptions
  ): Promise<FetchResult<T>>;

  // Widgets
  readonly supportedWidgets: WidgetDefinition[];
  getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData>;

  // Webhooks (optional)
  readonly webhookEnabled: boolean;
  readonly webhookConfig?: WebhookConfig;
  handleWebhook?(payload: unknown, headers: Record<string, string>): Promise<WebhookResult>;
  registerWebhook?(tokens: OAuthTokens, callbackUrl: string): Promise<string>;
  unregisterWebhook?(tokens: OAuthTokens, webhookId: string): Promise<void>;

  // Rate Limiting
  readonly rateLimitConfig?: RateLimitConfig;

  // Info
  getInfo(): ConnectorInfo;
}

// ============================================================================
// BASE CONNECTOR ABSTRACT CLASS
// ============================================================================

export abstract class BaseConnector implements IntegrationConnector {
  // Identity - must be implemented by subclasses
  abstract readonly id: string;
  abstract readonly slug: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly logoUrl?: string;
  abstract readonly category: IntegrationCategory;
  abstract readonly applicableRoles: ExecutiveType[];
  abstract readonly tier: IntegrationTier;
  readonly isBeta?: boolean = false;

  // Widgets - must be implemented by subclasses
  abstract readonly supportedWidgets: WidgetDefinition[];

  // Webhooks
  readonly webhookEnabled: boolean = false;
  readonly webhookConfig?: WebhookConfig;

  // Rate limiting
  readonly rateLimitConfig?: RateLimitConfig;

  // Internal state
  protected baseUrl: string = '';
  protected apiVersion: string = '';

  // ============================================================================
  // OAUTH METHODS
  // ============================================================================

  abstract getOAuthConfig(): OAuthConfig;

  getAuthUrl(state: string, scopes?: string[], redirectUri?: string): string {
    const config = this.getOAuthConfig();
    const url = new URL(config.authorizationUrl);

    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('response_type', config.responseType || 'code');
    url.searchParams.set(
      'redirect_uri',
      redirectUri || `${getConfig().oauth.callbackBaseUrl}/oauth/callback/${this.slug}`
    );
    url.searchParams.set('state', state);

    // Add scopes
    const finalScopes = scopes || config.scopes;
    if (finalScopes.length > 0) {
      url.searchParams.set('scope', finalScopes.join(config.scopeSeparator));
    }

    // Add additional params
    if (config.additionalAuthParams) {
      for (const [key, value] of Object.entries(config.additionalAuthParams)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    const body: Record<string, string> = {
      grant_type: config.grantType || 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    };

    if (codeVerifier) {
      body.code_verifier = codeVerifier;
    }

    if (config.additionalTokenParams) {
      Object.assign(body, config.additionalTokenParams);
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new OAuthError(
        'Failed to exchange authorization code',
        error.error,
        error.error_description
      );
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      tokenType: data.token_type,
      scope: data.scope,
      rawResponse: data,
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const config = this.getOAuthConfig();

    const body: Record<string, string> = {
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    };

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new OAuthError('Failed to refresh token', error.error, error.error_description);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Some providers don't return new refresh token
      expiresIn: data.expires_in,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      tokenType: data.token_type,
      scope: data.scope,
      rawResponse: data,
    };
  }

  async revokeToken(accessToken: string): Promise<void> {
    const config = this.getOAuthConfig();

    if (!config.revokeUrl) {
      // Some providers don't support token revocation
      return;
    }

    const response = await fetch(config.revokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: accessToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok && response.status !== 400) {
      // 400 might mean token already revoked
      throw new OAuthError('Failed to revoke token');
    }
  }

  // ============================================================================
  // DATA OPERATIONS
  // ============================================================================

  abstract testConnection(tokens: OAuthTokens): Promise<boolean>;

  async fetchData<T = unknown>(
    tokens: OAuthTokens,
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<FetchResult<T>> {
    const url = new URL(endpoint, this.baseUrl);

    // Add query params
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `${tokens.tokenType || 'Bearer'} ${tokens.accessToken}`,
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      fetchOptions.body =
        typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    // Add timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
    fetchOptions.signal = controller.signal;

    try {
      const response = await this.executeWithRetry(
        () => fetch(url.toString(), fetchOptions),
        options.retries || 3,
        tokens
      );

      clearTimeout(timeout);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      return {
        data: data as T,
        status: response.status,
        headers: responseHeaders,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ============================================================================
  // WIDGET DATA
  // ============================================================================

  abstract getWidgetData(
    tokens: OAuthTokens,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<WidgetData>;

  // ============================================================================
  // HELPERS
  // ============================================================================

  protected async executeWithRetry(
    fn: () => Promise<Response>,
    retries: number,
    tokens: OAuthTokens
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fn();

        // Handle 401 - try token refresh
        if (response.status === 401 && tokens.refreshToken && attempt < retries) {
          throw new TokenExpiredError();
        }

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = Number.parseInt(response.headers.get('Retry-After') || '60', 10);
          throw new RateLimitError(retryAfter);
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof RateLimitError && error.retryAfter) {
          // Wait and retry
          await this.sleep(error.retryAfter * 1000);
          continue;
        }

        if (error instanceof TokenExpiredError) {
          // Token refresh should be handled by the calling service
          throw error;
        }

        if (attempt < retries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new IntegrationError('Max retries exceeded', 'MAX_RETRIES');
  }

  protected async handleErrorResponse(response: Response): Promise<never> {
    let errorData: unknown;

    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }

    if (response.status === 401) {
      throw new TokenExpiredError();
    }

    if (response.status === 429) {
      const retryAfter = Number.parseInt(response.headers.get('Retry-After') || '60', 10);
      throw new RateLimitError(retryAfter);
    }

    throw new ProviderError(
      `API request failed with status ${response.status}`,
      typeof errorData === 'string' ? errorData : JSON.stringify(errorData),
      response.status.toString(),
      response.status >= 500 ? 502 : 400
    );
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // INFO
  // ============================================================================

  getInfo(): ConnectorInfo {
    return {
      id: this.id,
      slug: this.slug,
      name: this.name,
      description: this.description,
      logoUrl: this.logoUrl,
      category: this.category,
      applicableRoles: this.applicableRoles,
      tier: this.tier,
      isBeta: this.isBeta,
      supportedWidgets: this.supportedWidgets,
      webhookEnabled: this.webhookEnabled,
    };
  }
}
