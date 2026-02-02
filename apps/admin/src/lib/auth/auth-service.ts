/**
 * Admin Auth Service
 *
 * API service for admin authentication operations.
 * Includes admin-specific endpoints for role verification and privilege escalation.
 */

import { getApiClient, setAuthTokens, clearAuthTokens } from '../api/api-client';

// =============================================================================
// Types
// =============================================================================

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'OPERATIONS'
  | 'MODERATOR'
  | 'SUPPORT'
  | 'FINANCE'
  | 'ANALYTICS';

export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  status: UserStatus;
  role: AdminRole;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  lastLogin?: string;
  mfaEnabled: boolean;
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
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResponse {
  user: AdminUser;
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
// Role Permissions
// =============================================================================

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['*'],
  OPERATIONS: ['users:read', 'users:update', 'disputes:*', 'contracts:*', 'support:*'],
  MODERATOR: ['moderation:*', 'users:read', 'content:moderate'],
  SUPPORT: ['users:read', 'support:*', 'tickets:*'],
  FINANCE: ['payments:*', 'reports:financial', 'billing:*'],
  ANALYTICS: ['reports:*', 'analytics:*'],
};

// =============================================================================
// Auth Service
// =============================================================================

export const adminAuthService = {
  /**
   * Login with email and password (admin-specific)
   */
  async login(
    email: string,
    password: string,
    rememberMe = false
  ): Promise<LoginResponse | MFARequiredResponse> {
    const client = getApiClient();

    const response = await client.post<LoginResponse | MFARequiredResponse>('/admin/auth/login', {
      email,
      password,
      rememberMe,
    });

    // Check if MFA is required
    if ('mfaRequired' in response.data && response.data.mfaRequired) {
      return response.data;
    }

    // Store tokens
    const loginResponse = response.data as LoginResponse;
    setAuthTokens(
      loginResponse.tokens.accessToken,
      loginResponse.tokens.refreshToken,
      loginResponse.session.id
    );

    return loginResponse;
  },

  /**
   * Complete MFA verification
   */
  async verifyMFA(pendingSessionId: string, code: string, method: string): Promise<LoginResponse> {
    const client = getApiClient();

    const response = await client.post<LoginResponse>('/admin/auth/mfa/verify', {
      pendingSessionId,
      code,
      method,
    });

    // Store tokens
    setAuthTokens(
      response.data.tokens.accessToken,
      response.data.tokens.refreshToken,
      response.data.session.id
    );

    return response.data;
  },

  /**
   * Logout current session
   */
  async logout(allSessions = false): Promise<LogoutResponse> {
    const client = getApiClient();

    try {
      const response = await client.post<LogoutResponse>('/admin/auth/logout', {
        allSessions,
      });

      return response.data;
    } finally {
      // Always clear tokens locally
      clearAuthTokens();
    }
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const client = getApiClient();

    const response = await client.post<RefreshTokenResponse>('/admin/auth/refresh', {
      refreshToken,
    });

    // Update stored tokens
    setAuthTokens(response.data.accessToken, response.data.refreshToken);

    return response.data;
  },

  /**
   * Get current admin user profile
   */
  async getCurrentUser(): Promise<AdminUser> {
    const client = getApiClient();

    const response = await client.get<AdminUser>('/admin/auth/me');

    return response.data;
  },

  /**
   * Update admin profile
   */
  async updateProfile(data: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<AdminUser> {
    const client = getApiClient();

    const response = await client.patch<AdminUser>('/admin/auth/me', data);

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
      '/admin/auth/change-password',
      { currentPassword, newPassword }
    );

    return response.data;
  },

  /**
   * Get active admin sessions
   */
  async getSessions(): Promise<AuthSession[]> {
    const client = getApiClient();

    const response = await client.get<AuthSession[]>('/admin/auth/sessions');

    return response.data;
  },

  /**
   * Revoke a specific admin session
   */
  async revokeSession(sessionId: string): Promise<{ success: boolean }> {
    const client = getApiClient();

    const response = await client.delete<{ success: boolean }>(`/admin/auth/sessions/${sessionId}`);

    return response.data;
  },

  /**
   * Get permissions for a role
   */
  getPermissionsForRole(role: AdminRole): string[] {
    return ROLE_PERMISSIONS[role] || [];
  },

  /**
   * Check if a role is an admin role
   */
  isAdminRole(role: string): boolean {
    return Object.keys(ROLE_PERMISSIONS).includes(role as AdminRole);
  },

  /**
   * Check if a role is a super admin
   */
  isSuperAdmin(role: string): boolean {
    return role === 'SUPER_ADMIN' || role === 'ADMIN';
  },

  /**
   * Check if role is a moderator (or higher)
   */
  isModerator(role: string): boolean {
    const moderatorRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'MODERATOR'];
    return moderatorRoles.includes(role);
  },

  /**
   * Request elevated permissions for sensitive operations
   */
  async requestElevation(
    action: string,
    reason: string
  ): Promise<{ granted: boolean; expiresAt?: string }> {
    const client = getApiClient();

    const response = await client.post<{ granted: boolean; expiresAt?: string }>(
      '/admin/permissions/elevate',
      { action, reason }
    );

    return response.data;
  },
};

export default adminAuthService;
