'use client';

/**
 * SkillPod Auth Provider
 *
 * Client-side authentication provider for the SkillPod application.
 * Handles user authentication, session management, and VDI access checks.
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

export interface SkillPodUser {
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
  /** Whether user has VDI access */
  hasVdiAccess: boolean;
  /** User's current skill level */
  skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  /** Number of completed assessments */
  completedAssessments: number;
  /** Number of earned credentials */
  earnedCredentials: number;
}

export interface SkillPodAuthContextValue {
  user: SkillPodUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<SkillPodUser | null>;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Whether user can access VDI */
  canAccessVdi: boolean;
}

export interface SkillPodAuthProviderProps {
  children: ReactNode;
  /** Initial user data for SSR */
  initialUser?: SkillPodUser | null;
  /** API base URL */
  apiBaseUrl?: string;
}

// =============================================================================
// Context
// =============================================================================

const SkillPodAuthContext = createContext<SkillPodAuthContextValue | null>(null);

// =============================================================================
// Permission Helpers
// =============================================================================

function checkPermission(permissions: string[], permission: string): boolean {
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;

  return permissions.some((p) => {
    if (p.endsWith(':*')) {
      const namespace = p.slice(0, -2);
      return permission.startsWith(`${namespace}:`);
    }
    return false;
  });
}

// =============================================================================
// Auth Provider
// =============================================================================

export function SkillPodAuthProvider({
  children,
  initialUser = null,
  apiBaseUrl = '',
}: SkillPodAuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<SkillPodUser | null>(initialUser);
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

          // Transform to SkillPodUser format
          const skillPodUser: SkillPodUser = {
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
            hasVdiAccess:
              userData.hasVdiAccess ??
              checkPermission(userData.permissions || [], 'skillpod:access_vdi'),
            skillLevel: userData.skillLevel,
            completedAssessments: userData.completedAssessments || 0,
            earnedCredentials: userData.earnedCredentials || 0,
          };

          setUser(skillPodUser);
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

        const skillPodUser: SkillPodUser = {
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
          hasVdiAccess:
            userData.hasVdiAccess ??
            checkPermission(userData.permissions || [], 'skillpod:access_vdi'),
          skillLevel: userData.skillLevel,
          completedAssessments: userData.completedAssessments || 0,
          earnedCredentials: userData.earnedCredentials || 0,
        };

        setUser(skillPodUser);
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

        const skillPodUser: SkillPodUser = {
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
          hasVdiAccess:
            userData.hasVdiAccess ??
            checkPermission(userData.permissions || [], 'skillpod:access_vdi'),
          skillLevel: userData.skillLevel,
          completedAssessments: userData.completedAssessments || 0,
          earnedCredentials: userData.earnedCredentials || 0,
        };

        setUser(skillPodUser);
        return skillPodUser;
      }
      return null;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  }, [apiBaseUrl]);

  // Permission check function
  const hasPermission = useCallback(
    (permission: string) => checkPermission(user?.permissions || [], permission),
    [user?.permissions]
  );

  // VDI access check
  const canAccessVdi = user?.hasVdiAccess || hasPermission('skillpod:access_vdi');

  // Context value
  const value = useMemo<SkillPodAuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      logout,
      refreshUser,
      hasPermission,
      canAccessVdi,
    }),
    [user, isLoading, error, login, logout, refreshUser, hasPermission, canAccessVdi]
  );

  return <SkillPodAuthContext.Provider value={value}>{children}</SkillPodAuthContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the skillpod auth context
 * @throws Error if used outside of SkillPodAuthProvider
 */
export function useSkillPodAuth(): SkillPodAuthContextValue {
  const context = useContext(SkillPodAuthContext);

  if (!context) {
    throw new Error('useSkillPodAuth must be used within a SkillPodAuthProvider');
  }

  return context;
}

/**
 * Hook to get the current user (safe version that doesn't throw)
 */
export function useSkillPodUser(): SkillPodUser | null {
  const context = useContext(SkillPodAuthContext);
  return context?.user ?? null;
}

/**
 * Hook to check if user is authenticated (safe version)
 */
export function useIsAuthenticated(): boolean {
  const context = useContext(SkillPodAuthContext);
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
  const { isAuthenticated, isLoading } = useSkillPodAuth();

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
// VDI Guard Component
// =============================================================================

export interface VdiGuardProps {
  children: ReactNode;
  /** Component to render when loading */
  fallback?: ReactNode;
  /** Component to render when VDI access denied */
  accessDenied?: ReactNode;
}

/**
 * Guard component that only renders children if user has VDI access
 */
export function VdiGuard({
  children,
  fallback = null,
  accessDenied = null,
}: VdiGuardProps): React.ReactElement | null {
  const { isLoading, canAccessVdi, isAuthenticated } = useSkillPodAuth();

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated || !canAccessVdi) {
    return <>{accessDenied}</>;
  }

  return <>{children}</>;
}
