/**
 * Auth Service
 *
 * API service for authentication operations.
 * Communicates with auth-svc via the API gateway.
 */

import { getApiClient, setAuthTokens, clearAuthTokens } from '../api/api-client';

// =============================================================================
// Types
// =============================================================================

export type UserRole = 'FREELANCER' | 'CLIENT' | 'BOTH';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type VerificationLevel = 'NONE' | 'BASIC' | 'VERIFIED' | 'PREMIUM';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  status: UserStatus;
  verificationLevel: VerificationLevel;
  roles?: string[];
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
  user: AuthUser;
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

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
  };
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

export const authService = {
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
    });

    // Check if MFA is required
    if ('mfaRequired' in response.data && response.data.mfaRequired) {
      return response.data;
    }

    // Store tokens
    const loginResponse = response.data as LoginResponse;
    setAuthTokens(loginResponse.tokens.accessToken, loginResponse.tokens.refreshToken);

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

    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<RegisterResponse> {
    const client = getApiClient();

    const response = await client.post<RegisterResponse>('/auth/register', data);

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
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const client = getApiClient();

    const response = await client.get<{ success: boolean; message: string }>(
      `/auth/verify-email/${token}`
    );

    return response.data;
  },

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    const client = getApiClient();

    const response = await client.post<{ success: boolean; message: string }>(
      '/auth/resend-verification',
      { email }
    );

    return response.data;
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<AuthUser> {
    const client = getApiClient();

    const response = await client.get<AuthUser>('/auth/me');

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
  }): Promise<AuthUser> {
    const client = getApiClient();

    const response = await client.patch<AuthUser>('/auth/me', data);

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

export default authService;
