/**
 * @module @skillancer/api-client/services/auth
 * Authentication service client
 */

import type { HttpClient, ApiResponse } from '../http/base-client';

// =============================================================================
// Types
// =============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType: 'freelancer' | 'client';
  acceptTerms: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'freelancer' | 'client';
  avatar?: string;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends UserProfile {
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface RegisterResponse {
  user: UserProfile;
  tokens: AuthTokens;
  message: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyMfaRequest {
  mfaToken: string;
  code: string;
}

export interface EnableMfaResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface VerifyEmailResponse {
  message: string;
  verified: boolean;
}

// =============================================================================
// Auth Service Client
// =============================================================================

export class AuthServiceClient {
  private httpClient: HttpClient;
  private basePath: string;

  constructor(httpClient: HttpClient, basePath: string = '/auth') {
    this.httpClient = httpClient;
    this.basePath = basePath;
  }

  // ===========================================================================
  // Authentication
  // ===========================================================================

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return this.httpClient.post<LoginResponse>(`${this.basePath}/login`, credentials);
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<RegisterResponse> {
    return this.httpClient.post<RegisterResponse>(`${this.basePath}/register`, data);
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await this.httpClient.post<void>(`${this.basePath}/logout`);
  }

  /**
   * Refresh access token
   */
  async refresh(refreshToken: string): Promise<RefreshResponse> {
    return this.httpClient.post<RefreshResponse>(`${this.basePath}/refresh`, { refreshToken });
  }

  // ===========================================================================
  // Password Management
  // ===========================================================================

  /**
   * Request password reset email
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`${this.basePath}/forgot-password`, data);
  }

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordRequest): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`${this.basePath}/reset-password`, data);
  }

  /**
   * Change password for logged-in user
   */
  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`${this.basePath}/change-password`, data);
  }

  // ===========================================================================
  // Email Verification
  // ===========================================================================

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<VerifyEmailResponse> {
    return this.httpClient.get<VerifyEmailResponse>(`${this.basePath}/verify-email/${token}`);
  }

  /**
   * Resend verification email
   */
  async resendVerification(): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`${this.basePath}/resend-verification`);
  }

  // ===========================================================================
  // Multi-Factor Authentication
  // ===========================================================================

  /**
   * Verify MFA code during login
   */
  async verifyMfa(data: VerifyMfaRequest): Promise<LoginResponse> {
    return this.httpClient.post<LoginResponse>(`${this.basePath}/mfa/verify`, data);
  }

  /**
   * Enable MFA for user
   */
  async enableMfa(): Promise<EnableMfaResponse> {
    return this.httpClient.post<EnableMfaResponse>(`${this.basePath}/mfa/enable`);
  }

  /**
   * Confirm MFA setup with verification code
   */
  async confirmMfa(code: string): Promise<ApiResponse<{ backupCodes: string[] }>> {
    return this.httpClient.post<ApiResponse<{ backupCodes: string[] }>>(
      `${this.basePath}/mfa/confirm`,
      { code }
    );
  }

  /**
   * Disable MFA for user
   */
  async disableMfa(code: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`${this.basePath}/mfa/disable`, { code });
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(code: string): Promise<ApiResponse<{ backupCodes: string[] }>> {
    return this.httpClient.post<ApiResponse<{ backupCodes: string[] }>>(
      `${this.basePath}/mfa/backup-codes`,
      { code }
    );
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Get current user's profile
   */
  async me(): Promise<AuthUser> {
    return this.httpClient.get<AuthUser>(`${this.basePath}/me`);
  }

  /**
   * Get active sessions
   */
  async getSessions(): Promise<
    ApiResponse<
      Array<{
        id: string;
        device: string;
        location: string;
        lastActive: string;
        current: boolean;
      }>
    >
  > {
    return this.httpClient.get<
      ApiResponse<
        Array<{
          id: string;
          device: string;
          location: string;
          lastActive: string;
          current: boolean;
        }>
      >
    >(`${this.basePath}/sessions`);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(`${this.basePath}/sessions/${sessionId}`);
  }

  /**
   * Revoke all other sessions
   */
  async revokeAllSessions(): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`${this.basePath}/sessions/revoke-all`);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createAuthServiceClient(
  httpClient: HttpClient,
  basePath?: string
): AuthServiceClient {
  return new AuthServiceClient(httpClient, basePath);
}
