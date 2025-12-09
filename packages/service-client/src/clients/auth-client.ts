/**
 * @module @skillancer/service-client/clients/auth-client
 * Auth service client for authentication and user management
 */

import { BaseServiceClient, type ServiceClientConfig, type Pagination } from '../base-client.js';

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tenantId?: string;
  emailVerified: boolean;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  profile?: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  avatar?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  language?: string;
  socialLinks?: Record<string, string>;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  roles?: string[];
  tenantId?: string;
  profile?: Partial<UserProfile>;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  roles?: string[];
  status?: User['status'];
  profile?: Partial<UserProfile>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  tenantId?: string;
  iat: number;
  exp: number;
}

export interface ValidateTokenResponse {
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  tenantId?: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordInput {
  email: string;
}

export interface SetPasswordInput {
  token: string;
  password: string;
}

// ============================================================================
// Auth Service Client
// ============================================================================

export class AuthServiceClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['AUTH_SERVICE_URL'] ?? 'http://auth-svc:3001',
      serviceName: 'auth-svc',
      timeout: 10000,
      retries: 2,
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        resetTimeout: 30000,
      },
      ...config,
    });
  }

  // ==========================================================================
  // User Management
  // ==========================================================================

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User> {
    return this.get<User>(`users/${userId}`);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.get<User>(`users/by-email/${encodeURIComponent(email)}`);
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List users with optional filters
   */
  async listUsers(params?: {
    status?: User['status'];
    role?: string;
    tenantId?: string;
    search?: string;
    pagination?: Pagination;
  }): Promise<{ users: User[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.status) searchParams['status'] = params.status;
    if (params?.role) searchParams['role'] = params.role;
    if (params?.tenantId) searchParams['tenantId'] = params.tenantId;
    if (params?.search) searchParams['search'] = params.search;

    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ users: User[]; total: number }>('users', { searchParams });
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserInput): Promise<User> {
    return this.post<User>('users', data);
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: UpdateUserInput): Promise<User> {
    return this.patch<User>(`users/${userId}`, data);
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await this.delete(`users/${userId}`);
  }

  /**
   * Suspend user
   */
  async suspendUser(userId: string, reason?: string): Promise<User> {
    return this.post<User>(`users/${userId}/suspend`, { reason });
  }

  /**
   * Reactivate user
   */
  async reactivateUser(userId: string): Promise<User> {
    return this.post<User>(`users/${userId}/reactivate`);
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Login with email and password
   */
  async login(data: LoginInput): Promise<AuthTokens> {
    return this.post<AuthTokens>('auth/login', data);
  }

  /**
   * Logout (invalidate tokens)
   */
  async logout(refreshToken: string): Promise<void> {
    await this.post('auth/logout', { refreshToken });
  }

  /**
   * Refresh access token
   */
  async refreshToken(data: RefreshTokenInput): Promise<AuthTokens> {
    return this.post<AuthTokens>('auth/refresh', data);
  }

  /**
   * Validate a token
   */
  async validateToken(token: string): Promise<ValidateTokenResponse> {
    return this.post<ValidateTokenResponse>('auth/validate', { token });
  }

  /**
   * Change password
   */
  async changePassword(userId: string, data: ChangePasswordInput): Promise<void> {
    await this.post(`users/${userId}/change-password`, data);
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: ResetPasswordInput): Promise<void> {
    await this.post('auth/forgot-password', data);
  }

  /**
   * Set new password with reset token
   */
  async setPassword(data: SetPasswordInput): Promise<void> {
    await this.post('auth/reset-password', data);
  }

  // ==========================================================================
  // Email Verification
  // ==========================================================================

  /**
   * Send verification email
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    await this.post(`users/${userId}/send-verification`);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<User> {
    return this.post<User>('auth/verify-email', { token });
  }

  // ==========================================================================
  // API Keys
  // ==========================================================================

  /**
   * Create API key for user
   */
  async createApiKey(
    userId: string,
    data: { name: string; expiresAt?: string; scopes?: string[] }
  ): Promise<{ key: string; keyId: string }> {
    return this.post(`users/${userId}/api-keys`, data);
  }

  /**
   * List API keys for user
   */
  async listApiKeys(
    userId: string
  ): Promise<Array<{ id: string; name: string; createdAt: string; lastUsed?: string }>> {
    return this.get(`users/${userId}/api-keys`);
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    await this.delete(`users/${userId}/api-keys/${keyId}`);
  }
}

// Export singleton instance
export const authClient = new AuthServiceClient();
