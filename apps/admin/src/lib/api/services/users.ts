/**
 * Users Service
 *
 * Type-safe API methods for user management in the admin panel.
 */

import { getApiClient } from '../api-client';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Types
// =============================================================================

export type UserRole = 'user' | 'freelancer' | 'client' | 'moderator' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'banned' | 'pending_verification';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  lastActiveAt?: string;
  loginCount: number;
  failedLoginAttempts: number;
  lockedUntil?: string;
  profile?: {
    bio?: string;
    location?: string;
    timezone?: string;
    language?: string;
    skills?: string[];
    hourlyRate?: number;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  role?: UserRole | UserRole[];
  status?: UserStatus | UserStatus[];
  search?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  lastActiveAfter?: string;
  sortBy?: 'createdAt' | 'lastActiveAt' | 'username' | 'email' | 'role' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface UserCreate {
  email: string;
  username: string;
  displayName: string;
  password: string;
  role?: UserRole;
  status?: UserStatus;
  profile?: Partial<User['profile']>;
  sendWelcomeEmail?: boolean;
}

export interface UserUpdate {
  email?: string;
  username?: string;
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  avatarUrl?: string;
  profile?: Partial<User['profile']>;
}

export interface UserActivity {
  id: string;
  userId: string;
  type:
    | 'login'
    | 'logout'
    | 'password_change'
    | 'profile_update'
    | 'settings_change'
    | 'api_access'
    | 'other';
  description: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  location?: {
    country?: string;
    city?: string;
  };
  isCurrentSession: boolean;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  byRole: Record<UserRole, number>;
  byStatus: Record<UserStatus, number>;
  verificationStats: {
    emailVerified: number;
    phoneVerified: number;
    twoFactorEnabled: number;
  };
  growthTrend: Array<{
    date: string;
    count: number;
  }>;
}

// =============================================================================
// Users API Service
// =============================================================================

export const usersService = {
  // =============================================================================
  // Users CRUD
  // =============================================================================

  /**
   * List users with filters
   */
  async list(filters: UserFilters = {}): Promise<PaginatedResponse<User>> {
    const client = getApiClient();
    const { page = 1, limit = 20, role, status, ...rest } = filters;

    const params: Record<string, unknown> = { page, limit, ...rest };
    if (role) {
      params.role = Array.isArray(role) ? role.join(',') : role;
    }
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status;
    }

    return client.get<User[]>('/admin/users', { params }) as Promise<PaginatedResponse<User>>;
  },

  /**
   * Get a single user
   */
  async getById(id: string): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.get<User>(`/admin/users/${id}`);
  },

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.get<User>('/admin/users/by-email', { params: { email } });
  },

  /**
   * Create a user
   */
  async create(data: UserCreate): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.post<User, UserCreate>('/admin/users', data);
  },

  /**
   * Update a user
   */
  async update(id: string, data: UserUpdate): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.patch<User, UserUpdate>(`/admin/users/${id}`, data);
  },

  /**
   * Delete a user
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/admin/users/${id}`);
  },

  // =============================================================================
  // User Actions
  // =============================================================================

  /**
   * Suspend a user
   */
  async suspend(id: string, reason: string, duration?: number): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.post<User>(`/admin/users/${id}/suspend`, { reason, duration });
  },

  /**
   * Unsuspend a user
   */
  async unsuspend(id: string): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.post<User>(`/admin/users/${id}/unsuspend`);
  },

  /**
   * Ban a user
   */
  async ban(id: string, reason: string): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.post<User>(`/admin/users/${id}/ban`, { reason });
  },

  /**
   * Unban a user
   */
  async unban(id: string): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.post<User>(`/admin/users/${id}/unban`);
  },

  /**
   * Reset password
   */
  async resetPassword(
    id: string,
    sendEmail?: boolean
  ): Promise<ApiResponse<{ temporaryPassword?: string }>> {
    const client = getApiClient();
    return client.post<{ temporaryPassword?: string }>(`/admin/users/${id}/reset-password`, {
      sendEmail,
    });
  },

  /**
   * Force logout all sessions
   */
  async forceLogout(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.post<void>(`/admin/users/${id}/force-logout`);
  },

  /**
   * Verify email manually
   */
  async verifyEmail(id: string): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.post<User>(`/admin/users/${id}/verify-email`);
  },

  /**
   * Disable two-factor authentication
   */
  async disable2FA(id: string, reason: string): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.post<User>(`/admin/users/${id}/disable-2fa`, { reason });
  },

  /**
   * Unlock account
   */
  async unlockAccount(id: string): Promise<ApiResponse<User>> {
    const client = getApiClient();
    return client.post<User>(`/admin/users/${id}/unlock`);
  },

  // =============================================================================
  // User Activity & Sessions
  // =============================================================================

  /**
   * Get user activity
   */
  async getActivity(
    id: string,
    params?: { page?: number; limit?: number; type?: string }
  ): Promise<PaginatedResponse<UserActivity>> {
    const client = getApiClient();
    return client.get<UserActivity[]>(`/admin/users/${id}/activity`, {
      params,
    }) as Promise<PaginatedResponse<UserActivity>>;
  },

  /**
   * Get user sessions
   */
  async getSessions(id: string): Promise<ApiResponse<UserSession[]>> {
    const client = getApiClient();
    return client.get<UserSession[]>(`/admin/users/${id}/sessions`);
  },

  /**
   * Terminate a specific session
   */
  async terminateSession(userId: string, sessionId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`/admin/users/${userId}/sessions/${sessionId}`);
  },

  // =============================================================================
  // Statistics
  // =============================================================================

  /**
   * Get user statistics
   */
  async getStats(): Promise<ApiResponse<UserStats>> {
    const client = getApiClient();
    return client.get<UserStats>('/admin/users/stats');
  },

  // =============================================================================
  // Bulk Operations
  // =============================================================================

  /**
   * Bulk update users
   */
  async bulkUpdate(
    ids: string[],
    data: Partial<UserUpdate>
  ): Promise<ApiResponse<{ updated: number }>> {
    const client = getApiClient();
    return client.post<{ updated: number }>('/admin/users/bulk-update', { ids, data });
  },

  /**
   * Bulk suspend users
   */
  async bulkSuspend(
    ids: string[],
    reason: string,
    duration?: number
  ): Promise<ApiResponse<{ suspended: number }>> {
    const client = getApiClient();
    return client.post<{ suspended: number }>('/admin/users/bulk-suspend', {
      ids,
      reason,
      duration,
    });
  },

  /**
   * Export users
   */
  async export(filters: UserFilters & { format: 'csv' | 'xlsx' }): Promise<Blob> {
    const client = getApiClient();
    const axios = client.getAxiosInstance();
    const response = await axios.get('/admin/users/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Impersonate a user (for debugging)
   */
  async impersonate(
    id: string,
    reason: string
  ): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
    const client = getApiClient();
    return client.post<{ token: string; expiresAt: string }>(`/admin/users/${id}/impersonate`, {
      reason,
    });
  },
};

export default usersService;
