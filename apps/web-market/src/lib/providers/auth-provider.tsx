'use client';

/**
 * Web Market Auth Provider
 *
 * Client-side authentication provider for the marketplace app.
 * Handles user authentication, session management, and permission checks.
 *
 * @module lib/providers/auth-provider
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

export type UserRole = 'USER' | 'FREELANCER' | 'CLIENT' | 'BOTH';

export interface MarketUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  role: UserRole;
  roles: string[];
  permissions: string[];
  emailVerified: boolean;
  avatar?: string;
  unreadNotifications: number;
}

export interface MarketAuthContextValue {
  user: MarketUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<MarketUser | null>;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user has all specified permissions */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** Whether user is a freelancer */
  isFreelancer: boolean;
  /** Whether user is a client */
  isClient: boolean;
}

export interface MarketAuthProviderProps {
  children: ReactNode;
  /** Initial user data for SSR */
  initialUser?: MarketUser | null;
  /** API base URL */
  apiBaseUrl?: string;
}

// =============================================================================
// Context
// =============================================================================

const MarketAuthContext = createContext<MarketAuthContextValue | null>(null);

// =============================================================================
// Permission Helpers
// =============================================================================

function checkPermission(permissions: string[], permission: string): boolean {
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;

  // Check namespace wildcards
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

export function MarketAuthProvider({
  children,
  initialUser = null,
  apiBaseUrl = '',
}: MarketAuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<MarketUser | null>(initialUser);
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

          // Transform to MarketUser format
          const marketUser: MarketUser = {
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
            unreadNotifications: userData.unreadNotifications || 0,
          };

          setUser(marketUser);
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

        const marketUser: MarketUser = {
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
          unreadNotifications: userData.unreadNotifications || 0,
        };

        setUser(marketUser);
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
      // Redirect to home page
      window.location.href = '/';
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

        const marketUser: MarketUser = {
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
          unreadNotifications: userData.unreadNotifications || 0,
        };

        setUser(marketUser);
        return marketUser;
      }
      return null;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  }, [apiBaseUrl]);

  // Computed values
  const isFreelancer = user?.role === 'FREELANCER' || user?.role === 'BOTH';
  const isClient = user?.role === 'CLIENT' || user?.role === 'BOTH';

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
  const value = useMemo<MarketAuthContextValue>(
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
      isClient,
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
      isClient,
    ]
  );

  return <MarketAuthContext.Provider value={value}>{children}</MarketAuthContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the market auth context
 * @throws Error if used outside of MarketAuthProvider
 */
export function useMarketAuth(): MarketAuthContextValue {
  const context = useContext(MarketAuthContext);

  if (!context) {
    throw new Error('useMarketAuth must be used within a MarketAuthProvider');
  }

  return context;
}

/**
 * Hook to get the current user (safe version that doesn't throw)
 */
export function useMarketUser(): MarketUser | null {
  const context = useContext(MarketAuthContext);
  return context?.user ?? null;
}

/**
 * Hook to check if user is authenticated (safe version)
 */
export function useIsAuthenticated(): boolean {
  const context = useContext(MarketAuthContext);
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
  const { isAuthenticated, isLoading } = useMarketAuth();

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
