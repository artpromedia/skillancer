/**
 * Web Cockpit Auth Service
 *
 * API service for authentication operations.
 * Communicates with auth-svc via the API gateway.
 * Includes multi-tenant support for fractional executives.
 */

import {
  getApiClient,
  setAuthTokens,
  clearAuthTokens,
  setCurrentTenantId,
  clearCurrentTenantId,
} from '../api/api-client';

// =============================================================================
// Types
// =============================================================================

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type VerificationLevel = 'NONE' | 'BASIC' | 'VERIFIED' | 'PREMIUM';

export interface CockpitUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  status: UserStatus;
  verificationLevel: VerificationLevel;
  roles: string[];
  permissions: string[];
  executiveId?: string;
  // Multi-tenant fields
  tenants?: TenantInfo[];
  currentTenantId?: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  role: string;
  logo?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthSession {
  id: string;
  expiresAt: string;
}

export interface LoginResponse {
  user: CockpitUser;
  tokens: AuthTokens;
  session: AuthSession;
  mfaVerified: boolean;
}

export interface MFARequiredResponse {
  mfaRequired: true;
  pendingSessionId: string;
  availableMethods: string[];
  expiresAt: string;
  message: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

// =============================================================================
// Auth Service
// =============================================================================

export const cockpitAuthService = {
  /**
   * Login with email and password
   */
  async login(
    email: string,
    password: string,
    rememberMe = false
  ): Promise<LoginResponse | MFARequiredResponse> {
    const client = getApiClient();

    const response = await client.post<LoginResponse | MFARequiredResponse>('/auth/login', {
      email,
      password,
      rememberMe,
      clientApp: 'cockpit',
    });

    // Check if MFA is required
    if ('mfaRequired' in response.data && response.data.mfaRequired) {
      return response.data;
    }

    // Store tokens
    const loginResponse = response.data as LoginResponse;
    setAuthTokens(loginResponse.tokens.accessToken, loginResponse.tokens.refreshToken);

    // Set initial tenant if available
    if (loginResponse.user.currentTenantId) {
      setCurrentTenantId(loginResponse.user.currentTenantId);
    }

    return loginResponse;
  },

  /**
   * Complete MFA verification
   */
  async verifyMFA(pendingSessionId: string, code: string, method: string): Promise<LoginResponse> {
    const client = getApiClient();

    const response = await client.post<LoginResponse>('/auth/mfa/verify', {
      pendingSessionId,
      code,
      method,
    });

    // Store tokens
    setAuthTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);

    // Set initial tenant if available
    if (response.data.user.currentTenantId) {
      setCurrentTenantId(response.data.user.currentTenantId);
    }

    return response.data;
  },

  /**
   * Logout current session
   */
  async logout(allSessions = false): Promise<LogoutResponse> {
    const client = getApiClient();

    try {
      const response = await client.post<LogoutResponse>('/auth/logout', {
        allSessions,
      });

      return response.data;
    } finally {
      // Always clear tokens locally
      clearAuthTokens();
      clearCurrentTenantId();
    }
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const client = getApiClient();

    const response = await client.post<RefreshTokenResponse>('/auth/refresh', {
      refreshToken,
    });

    // Update stored tokens
    setAuthTokens(response.data.accessToken, response.data.refreshToken);

    return response.data;
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<CockpitUser> {
    const client = getApiClient();

    const response = await client.get<CockpitUser>('/auth/me');

    return response.data;
  },

  /**
   * Update user profile
   */
  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<CockpitUser> {
    const client = getApiClient();

    const response = await client.patch<CockpitUser>('/auth/me', data);

    return response.data;
  },

  /**
   * Get available tenants for the user
   */
  async getTenants(): Promise<TenantInfo[]> {
    const client = getApiClient();

    const response = await client.get<TenantInfo[]>('/cockpit/tenants');

    return response.data;
  },

  /**
   * Switch to a different tenant
   */
  async switchTenant(tenantId: string): Promise<{ success: boolean; tokens?: AuthTokens }> {
    const client = getApiClient();

    const response = await client.post<{ success: boolean; tokens?: AuthTokens }>(
      '/cockpit/tenants/switch',
      { tenantId }
    );

    if (response.data.success) {
      setCurrentTenantId(tenantId);

      // Update tokens if new ones are provided
      if (response.data.tokens) {
        setAuthTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
      }
    }

    return response.data;
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const client = getApiClient();

    const response = await client.post<{ success: boolean; message: string }>(
      '/auth/forgot-password',
      { email }
    );

    return response.data;
  },

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const client = getApiClient();

    const response = await client.post<{ success: boolean; message: string }>(
      '/auth/reset-password',
      { token, newPassword }
    );

    return response.data;
  },

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const client = getApiClient();

    const response = await client.post<{ success: boolean; message: string }>(
      '/auth/change-password',
      { currentPassword, newPassword }
    );

    return response.data;
  },

  /**
   * Get active sessions
   */
  async getSessions(): Promise<AuthSession[]> {
    const client = getApiClient();

    const response = await client.get<AuthSession[]>('/auth/sessions');

    return response.data;
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<{ success: boolean }> {
    const client = getApiClient();

    const response = await client.delete<{ success: boolean }>(`/auth/sessions/${sessionId}`);

    return response.data;
  },
};

export default cockpitAuthService;
