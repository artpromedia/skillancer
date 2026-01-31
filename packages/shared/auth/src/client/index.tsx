'use client';

/**
 * @skillancer/shared-auth - Client-side Authentication Utilities
 * React hooks, AuthProvider, and client-side auth helpers
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  AuthUser,
  AdminUser,
  CockpitUser,
  AuthContextValue,
  AuthProviderProps,
  LoginCredentials,
  AuthState,
} from '../types';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAdmin as checkIsAdmin,
  isSuperAdmin as checkIsSuperAdmin,
  isModerator as checkIsModerator,
  type Permission,
} from '../permissions';

// =============================================================================
// Auth Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// Auth Provider
// =============================================================================

/**
 * Auth Provider component that wraps the application and provides auth state
 */
export function AuthProvider({
  children,
  initialUser = null,
  apiBaseUrl = '',
  onAuthStateChange,
}: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user on mount
  useEffect(() => {
    if (initialUser) {
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          onAuthStateChange?.({ type: 'authenticated', user: data.user });
        } else {
          setUser(null);
          onAuthStateChange?.({ type: 'unauthenticated' });
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
        setError('Failed to verify authentication');
        setUser(null);
        onAuthStateChange?.({ type: 'error', error: 'Failed to verify authentication' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [apiBaseUrl, initialUser, onAuthStateChange]);

  // Login function
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed');
        }

        setUser(data.user);
        onAuthStateChange?.({ type: 'authenticated', user: data.user });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, onAuthStateChange]
  );

  // Logout function
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setIsLoading(false);
      setError(null);
      onAuthStateChange?.({ type: 'unauthenticated' });
    }
  }, [apiBaseUrl, onAuthStateChange]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        return data.user;
      }
      return null;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  }, [apiBaseUrl]);

  // Context value
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      logout,
      refreshUser,
    }),
    [user, isLoading, error, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =============================================================================
// Auth Hooks
// =============================================================================

/**
 * Hook to access the auth context
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Hook to check if user is authenticated (safe version that doesn't throw)
 */
export function useIsAuthenticated(): boolean {
  const context = useContext(AuthContext);
  return context?.isAuthenticated ?? false;
}

/**
 * Hook to get the current user (safe version that doesn't throw)
 */
export function useCurrentUser<T extends AuthUser = AuthUser>(): T | null {
  const context = useContext(AuthContext);
  return (context?.user as T | null) ?? null;
}

// =============================================================================
// Permission Hooks
// =============================================================================

export interface UsePermissionsReturn {
  /** User's permissions array */
  permissions: string[];
  /** Check if user has a specific permission */
  hasPermission: (permission: Permission) => boolean;
  /** Check if user has all specified permissions */
  hasAllPermissions: (permissions: Permission[]) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: Permission[]) => boolean;
  /** Check if user is an admin */
  isAdmin: boolean;
  /** Check if user is a super admin */
  isSuperAdmin: boolean;
  /** Check if user is a moderator */
  isModerator: boolean;
  /** Whether permission data is still loading */
  isLoading: boolean;
}

/**
 * Hook to check and work with user permissions
 */
export function usePermissions(): UsePermissionsReturn {
  const { user, isLoading } = useAuth();

  const permissions = user?.permissions || [];
  const roles = (user as AdminUser)?.adminRole
    ? [(user as AdminUser).adminRole]
    : user?.role
      ? [user.role]
      : [];

  return useMemo(
    () => ({
      permissions,
      hasPermission: (permission: Permission) => hasPermission(permissions, permission),
      hasAllPermissions: (perms: Permission[]) => hasAllPermissions(permissions, perms),
      hasAnyPermission: (perms: Permission[]) => hasAnyPermission(permissions, perms),
      isAdmin: checkIsAdmin(roles),
      isSuperAdmin: checkIsSuperAdmin(roles),
      isModerator: checkIsModerator(roles),
      isLoading,
    }),
    [permissions, roles, isLoading]
  );
}

/**
 * Hook to check a specific permission
 */
export function useHasPermission(permission: Permission): boolean {
  const { hasPermission: checkPerm } = usePermissions();
  return checkPerm(permission);
}

/**
 * Hook to check multiple permissions
 */
export function useHasAllPermissions(permissions: Permission[]): boolean {
  const { hasAllPermissions: checkPerms } = usePermissions();
  return checkPerms(permissions);
}

// =============================================================================
// Admin-specific Hooks
// =============================================================================

export interface UseAdminAuthReturn extends AuthContextValue {
  /** Admin user object with admin-specific fields */
  adminUser: AdminUser | null;
  /** Whether user is an admin */
  isAdmin: boolean;
  /** Whether user is a super admin */
  isSuperAdmin: boolean;
  /** Whether user is a moderator */
  isModerator: boolean;
  /** Admin role */
  adminRole: string | null;
  /** Admin-specific permissions */
  adminPermissions: string[];
}

/**
 * Hook for admin-specific authentication
 */
export function useAdminAuth(): UseAdminAuthReturn {
  const auth = useAuth();
  const { isAdmin, isSuperAdmin, isModerator } = usePermissions();

  const adminUser = auth.user as AdminUser | null;

  return useMemo(
    () => ({
      ...auth,
      adminUser: isAdmin ? adminUser : null,
      isAdmin,
      isSuperAdmin,
      isModerator,
      adminRole: adminUser?.adminRole || null,
      adminPermissions: adminUser?.adminPermissions || [],
    }),
    [auth, adminUser, isAdmin, isSuperAdmin, isModerator]
  );
}

// =============================================================================
// Cockpit-specific Hooks
// =============================================================================

export interface UseCockpitAuthReturn extends AuthContextValue {
  /** Cockpit user object with cockpit-specific fields */
  cockpitUser: CockpitUser | null;
  /** Whether user is a freelancer */
  isFreelancer: boolean;
  /** Whether user has premium cockpit features */
  hasPremium: boolean;
  /** User's subscription tier */
  subscriptionTier: 'free' | 'pro' | 'enterprise' | null;
}

/**
 * Hook for cockpit-specific authentication
 */
export function useCockpitAuth(): UseCockpitAuthReturn {
  const auth = useAuth();
  const cockpitUser = auth.user as CockpitUser | null;

  const isFreelancer = cockpitUser?.role === 'FREELANCER' || cockpitUser?.role === 'BOTH';
  const subscriptionTier = cockpitUser?.subscriptionTier || null;
  const hasPremium = subscriptionTier === 'pro' || subscriptionTier === 'enterprise';

  return useMemo(
    () => ({
      ...auth,
      cockpitUser,
      isFreelancer,
      hasPremium,
      subscriptionTier,
    }),
    [auth, cockpitUser, isFreelancer, hasPremium, subscriptionTier]
  );
}

// =============================================================================
// Auth Guard Components
// =============================================================================

export interface AuthGuardProps {
  children: ReactNode;
  /** Component to render when loading */
  fallback?: ReactNode;
  /** Component to render when not authenticated */
  unauthorized?: ReactNode;
  /** URL to redirect to when not authenticated */
  redirectTo?: string;
}

/**
 * Guard component that only renders children if user is authenticated
 */
export function AuthGuard({
  children,
  fallback = null,
  unauthorized = null,
  redirectTo,
}: AuthGuardProps): React.ReactElement | null {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && redirectTo) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated) {
    return <>{unauthorized}</>;
  }

  return <>{children}</>;
}

export interface PermissionGuardProps extends AuthGuardProps {
  /** Permission required to view content */
  permission?: Permission;
  /** All permissions required to view content */
  permissions?: Permission[];
  /** At least one of these permissions required */
  anyPermission?: Permission[];
}

/**
 * Guard component that only renders children if user has required permission(s)
 */
export function PermissionGuard({
  children,
  fallback = null,
  unauthorized = null,
  permission,
  permissions: requiredPermissions,
  anyPermission,
}: PermissionGuardProps): React.ReactElement | null {
  const { isLoading } = useAuth();
  const { hasPermission: checkPerm, hasAllPermissions, hasAnyPermission: checkAny } = usePermissions();

  if (isLoading) {
    return <>{fallback}</>;
  }

  let hasAccess = true;

  if (permission) {
    hasAccess = hasAccess && checkPerm(permission);
  }

  if (requiredPermissions?.length) {
    hasAccess = hasAccess && hasAllPermissions(requiredPermissions);
  }

  if (anyPermission?.length) {
    hasAccess = hasAccess && checkAny(anyPermission);
  }

  if (!hasAccess) {
    return <>{unauthorized}</>;
  }

  return <>{children}</>;
}

export interface AdminGuardProps extends AuthGuardProps {
  /** Require super admin access */
  requireSuperAdmin?: boolean;
  /** Require moderator access */
  requireModerator?: boolean;
}

/**
 * Guard component that only renders children if user is an admin
 */
export function AdminGuard({
  children,
  fallback = null,
  unauthorized = null,
  redirectTo,
  requireSuperAdmin = false,
  requireModerator = false,
}: AdminGuardProps): React.ReactElement | null {
  const { isLoading } = useAuth();
  const { isAdmin, isSuperAdmin, isModerator } = usePermissions();

  useEffect(() => {
    if (!isLoading && !isAdmin && redirectTo) {
      window.location.href = redirectTo;
    }
  }, [isAdmin, isLoading, redirectTo]);

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAdmin) {
    return <>{unauthorized}</>;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return <>{unauthorized}</>;
  }

  if (requireModerator && !isModerator) {
    return <>{unauthorized}</>;
  }

  return <>{children}</>;
}

// =============================================================================
// Re-exports
// =============================================================================

export {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAdmin as checkIsAdmin,
  isSuperAdmin as checkIsSuperAdmin,
  isModerator as checkIsModerator,
} from '../permissions';

export type { Permission } from '../permissions';
