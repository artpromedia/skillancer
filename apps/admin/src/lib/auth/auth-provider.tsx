/**
 * Admin Auth Provider
 *
 * React context provider for admin authentication state management.
 * Handles user session, token refresh, role verification, and auth state synchronization.
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

import { adminAuthService, type AdminUser, type AdminRole } from './auth-service';
import { isAuthenticated as checkIsAuthenticated } from '../api/api-client';

// =============================================================================
// Types
// =============================================================================

export interface AdminAuthContextValue {
  /** Current authenticated admin, null if not logged in */
  user: AdminUser | null;
  /** Whether authentication state is being loaded */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Error message from last auth operation */
  error: string | null;
  /** Login with email and password */
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; mfaRequired?: boolean; pendingSessionId?: string }>;
  /** Complete MFA verification */
  verifyMFA: (
    pendingSessionId: string,
    code: string,
    method: string
  ) => Promise<{ success: boolean }>;
  /** Logout current user */
  logout: (allSessions?: boolean) => Promise<void>;
  /** Refresh current user data */
  refreshUser: () => Promise<void>;
  /** Clear any auth errors */
  clearError: () => void;
  /** Check if current user is a super admin */
  isSuperAdmin: () => boolean;
  /** Check if current user is an admin (any admin role) */
  isAdmin: () => boolean;
  /** Check if current user is a moderator (or higher) */
  isModerator: () => boolean;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** Check if user has all of the specified permissions */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Check if user has a specific role */
  hasRole: (role: AdminRole) => boolean;
  /** Request elevated permissions for sensitive actions */
  requestElevation: (action: string, reason: string) => Promise<{ granted: boolean }>;
}

// =============================================================================
// Context
// =============================================================================

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface AdminAuthProviderProps {
  readonly children: ReactNode;
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => user !== null, [user]);

  /**
   * Refresh user data - defined early so it can be used in effects
   */
  const refreshUser = useCallback(async () => {
    if (!checkIsAuthenticated()) {
      setUser(null);
      return;
    }

    try {
      const currentUser = await adminAuthService.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }, []);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have a valid token
        if (checkIsAuthenticated()) {
          // Fetch current admin user
          const currentUser = await adminAuthService.getCurrentUser();
          setUser(currentUser);
        }
      } catch {
        // Token invalid or expired, clear state
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initAuth();
  }, []);

  /**
   * Listen for auth events (token expiry, logout from other tabs)
   */
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setError(null);
    };

    const handlePermissionDenied = (e: CustomEvent<{ message: string }>) => {
      setError(e.detail.message || 'Permission denied');
    };

    const handleStorageChange = (e: StorageEvent) => {
      // Sync auth state across tabs
      if (e.key === 'admin_access_token') {
        if (!e.newValue) {
          // Token was removed in another tab
          setUser(null);
        } else if (!user && e.newValue) {
          // Token was added in another tab, refresh user
          void refreshUser();
        }
      }
    };

    globalThis.addEventListener('auth:logout', handleLogout);
    globalThis.addEventListener('admin:permission-denied', handlePermissionDenied as EventListener);
    globalThis.addEventListener('storage', handleStorageChange);

    return () => {
      globalThis.removeEventListener('auth:logout', handleLogout);
      globalThis.removeEventListener(
        'admin:permission-denied',
        handlePermissionDenied as EventListener
      );
      globalThis.removeEventListener('storage', handleStorageChange);
    };
  }, [user, refreshUser]);

  /**
   * Login handler
   */
  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    setError(null);

    try {
      const result = await adminAuthService.login(email, password, rememberMe);

      // Check if MFA is required
      if ('mfaRequired' in result && result.mfaRequired) {
        return {
          success: true,
          mfaRequired: true,
          pendingSessionId: result.pendingSessionId,
        };
      }

      // Login successful - result is LoginResponse with user
      if ('user' in result) {
        setUser(result.user);
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      return { success: false };
    }
  }, []);

  /**
   * MFA verification handler
   */
  const verifyMFA = useCallback(async (pendingSessionId: string, code: string, method: string) => {
    setError(null);

    try {
      const result = await adminAuthService.verifyMFA(pendingSessionId, code, method);
      setUser(result.user);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'MFA verification failed';
      setError(message);
      return { success: false };
    }
  }, []);

  /**
   * Logout handler
   */
  const logout = useCallback(async (allSessions = false) => {
    try {
      await adminAuthService.logout(allSessions);
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Role checking helpers
   */
  const isSuperAdmin = useCallback((): boolean => {
    if (!user) return false;
    return adminAuthService.isSuperAdmin(user.role);
  }, [user]);

  const isAdmin = useCallback((): boolean => {
    if (!user) return false;
    return adminAuthService.isAdminRole(user.role);
  }, [user]);

  const isModerator = useCallback((): boolean => {
    if (!user) return false;
    return adminAuthService.isModerator(user.role);
  }, [user]);

  const hasRole = useCallback(
    (role: AdminRole): boolean => {
      if (!user) return false;
      return user.role === role || user.roles.includes(role);
    },
    [user]
  );

  /**
   * Permission checking helpers
   */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;

      // Super admins have all permissions
      if (user.permissions.includes('*')) return true;

      // Check exact permission match
      if (user.permissions.includes(permission)) return true;

      // Check wildcard permissions (e.g., 'users:*' matches 'users:read')
      const [resource] = permission.split(':');
      if (user.permissions.includes(`${resource}:*`)) return true;

      return false;
    },
    [user]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      return permissions.some((p) => hasPermission(p));
    },
    [hasPermission]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]): boolean => {
      return permissions.every((p) => hasPermission(p));
    },
    [hasPermission]
  );

  /**
   * Request elevated permissions
   */
  const requestElevation = useCallback(
    async (action: string, reason: string): Promise<{ granted: boolean }> => {
      try {
        return await adminAuthService.requestElevation(action, reason);
      } catch {
        return { granted: false };
      }
    },
    []
  );

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      error,
      login,
      verifyMFA,
      logout,
      refreshUser,
      clearError,
      isSuperAdmin,
      isAdmin,
      isModerator,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasRole,
      requestElevation,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
      error,
      login,
      verifyMFA,
      logout,
      refreshUser,
      clearError,
      isSuperAdmin,
      isAdmin,
      isModerator,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasRole,
      requestElevation,
    ]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access admin auth context
 */
export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }

  return context;
}

/**
 * Alias for useAdminAuth
 */
export const useAuth = useAdminAuth;

export default AdminAuthProvider;
