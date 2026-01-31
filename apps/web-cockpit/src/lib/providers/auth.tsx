'use client';

/**
 * Web Cockpit Auth Provider
 *
 * Client-side authentication provider that wraps the shared auth provider
 * with cockpit-specific functionality and user data fetching.
 *
 * @module lib/providers/auth
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

// =============================================================================
// Types
// =============================================================================

export interface CockpitUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  role: 'USER' | 'FREELANCER' | 'CLIENT' | 'BOTH';
  roles: string[];
  permissions: string[];
  emailVerified: boolean;
  avatar?: string;
  tenantId?: string;
  subscriptionTier?: 'free' | 'pro' | 'enterprise';
}

export interface CockpitAuthContextValue {
  user: CockpitUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<CockpitUser | null>;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user has all specified permissions */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** Whether user is a freelancer */
  isFreelancer: boolean;
  /** Whether user has premium features */
  hasPremium: boolean;
}

export interface CockpitAuthProviderProps {
  children: ReactNode;
  /** Initial user data for SSR */
  initialUser?: CockpitUser | null;
  /** API base URL */
  apiBaseUrl?: string;
}

// =============================================================================
// Context
// =============================================================================

const CockpitAuthContext = createContext<CockpitAuthContextValue | null>(null);

// =============================================================================
// Permission Helpers
// =============================================================================

function checkPermission(permissions: string[], permission: string): boolean {
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;

  // Check namespace wildcards (e.g., "cockpit:*" matches "cockpit:view_dashboard")
  return permissions.some((p) => {
    if (p.endsWith(':*')) {
      const namespace = p.slice(0, -2);
      return permission.startsWith(`${namespace}:`);
    }
    return false;
  });
}

function checkAllPermissions(permissions: string[], required: string[]): boolean {
  return required.every((p) => checkPermission(permissions, p));
}

function checkAnyPermission(permissions: string[], required: string[]): boolean {
  return required.some((p) => checkPermission(permissions, p));
}

// =============================================================================
// Auth Provider
// =============================================================================

export function CockpitAuthProvider({
  children,
  initialUser = null,
  apiBaseUrl = '',
}: CockpitAuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<CockpitUser | null>(initialUser);
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
          const userData = data.user || data;

          // Transform to CockpitUser format
          const cockpitUser: CockpitUser = {
            id: userData.id || userData.userId,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            name:
              userData.name ||
              `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
              userData.email,
            role: userData.role || 'USER',
            roles: userData.roles || [userData.role || 'USER'],
            permissions: userData.permissions || [],
            emailVerified: userData.emailVerified ?? true,
            avatar: userData.avatar,
            tenantId: userData.tenantId,
            subscriptionTier: userData.subscriptionTier,
          };

          setUser(cockpitUser);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
        setError('Failed to verify authentication');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [apiBaseUrl, initialUser]);

  // Login function
  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed');
        }

        const userData = data.user || data;

        const cockpitUser: CockpitUser = {
          id: userData.id || userData.userId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          name:
            userData.name ||
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
            userData.email,
          role: userData.role || 'USER',
          roles: userData.roles || [userData.role || 'USER'],
          permissions: userData.permissions || [],
          emailVerified: userData.emailVerified ?? true,
          avatar: userData.avatar,
          tenantId: userData.tenantId,
          subscriptionTier: userData.subscriptionTier,
        };

        setUser(cockpitUser);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl]
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
      // Redirect to login page
      window.location.href = '/login';
    }
  }, [apiBaseUrl]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const userData = data.user || data;

        const cockpitUser: CockpitUser = {
          id: userData.id || userData.userId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          name:
            userData.name ||
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
            userData.email,
          role: userData.role || 'USER',
          roles: userData.roles || [userData.role || 'USER'],
          permissions: userData.permissions || [],
          emailVerified: userData.emailVerified ?? true,
          avatar: userData.avatar,
          tenantId: userData.tenantId,
          subscriptionTier: userData.subscriptionTier,
        };

        setUser(cockpitUser);
        return cockpitUser;
      }
      return null;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  }, [apiBaseUrl]);

  // Computed values
  const isFreelancer = user?.role === 'FREELANCER' || user?.role === 'BOTH';
  const hasPremium = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'enterprise';

  // Permission check functions
  const hasPermission = useCallback(
    (permission: string) => checkPermission(user?.permissions || [], permission),
    [user?.permissions]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[]) => checkAllPermissions(user?.permissions || [], permissions),
    [user?.permissions]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]) => checkAnyPermission(user?.permissions || [], permissions),
    [user?.permissions]
  );

  // Context value
  const value = useMemo<CockpitAuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      logout,
      refreshUser,
      hasPermission,
      hasAllPermissions,
      hasAnyPermission,
      isFreelancer,
      hasPremium,
    }),
    [
      user,
      isLoading,
      error,
      login,
      logout,
      refreshUser,
      hasPermission,
      hasAllPermissions,
      hasAnyPermission,
      isFreelancer,
      hasPremium,
    ]
  );

  return <CockpitAuthContext.Provider value={value}>{children}</CockpitAuthContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the cockpit auth context
 * @throws Error if used outside of CockpitAuthProvider
 */
export function useCockpitAuth(): CockpitAuthContextValue {
  const context = useContext(CockpitAuthContext);

  if (!context) {
    throw new Error('useCockpitAuth must be used within a CockpitAuthProvider');
  }

  return context;
}

/**
 * Hook to get the current user (safe version that doesn't throw)
 */
export function useCockpitUser(): CockpitUser | null {
  const context = useContext(CockpitAuthContext);
  return context?.user ?? null;
}

/**
 * Hook to check if user is authenticated (safe version)
 */
export function useIsAuthenticated(): boolean {
  const context = useContext(CockpitAuthContext);
  return context?.isAuthenticated ?? false;
}

// =============================================================================
// Auth Guard Component
// =============================================================================

export interface AuthGuardProps {
  children: ReactNode;
  /** Component to render when loading */
  fallback?: ReactNode;
  /** URL to redirect to when not authenticated */
  redirectTo?: string;
}

/**
 * Guard component that only renders children if user is authenticated
 */
export function AuthGuard({
  children,
  fallback = null,
  redirectTo = '/login',
}: AuthGuardProps): React.ReactElement | null {
  const { isAuthenticated, isLoading } = useCockpitAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && redirectTo) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

// =============================================================================
// Permission Guard Component
// =============================================================================

export interface PermissionGuardProps {
  children: ReactNode;
  /** Permission required */
  permission?: string;
  /** All permissions required */
  permissions?: string[];
  /** At least one of these permissions required */
  anyPermission?: string[];
  /** Fallback when permission denied */
  fallback?: ReactNode;
}

/**
 * Guard component that only renders children if user has required permission(s)
 */
export function PermissionGuard({
  children,
  permission,
  permissions,
  anyPermission,
  fallback = null,
}: PermissionGuardProps): React.ReactElement | null {
  const { isLoading, hasPermission, hasAllPermissions, hasAnyPermission } = useCockpitAuth();

  if (isLoading) {
    return null;
  }

  let hasAccess = true;

  if (permission) {
    hasAccess = hasAccess && hasPermission(permission);
  }

  if (permissions?.length) {
    hasAccess = hasAccess && hasAllPermissions(permissions);
  }

  if (anyPermission?.length) {
    hasAccess = hasAccess && hasAnyPermission(anyPermission);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
