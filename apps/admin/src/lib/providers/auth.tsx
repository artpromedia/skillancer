'use client';

/**
 * Admin Auth Provider
 *
 * Client-side authentication provider for the admin panel.
 * Includes role-based access control and admin-specific permission checks.
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

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'super_admin'
  | 'admin'
  | 'operations'
  | 'moderator'
  | 'support'
  | 'finance'
  | 'analytics';

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  role: AdminRole;
  roles: string[];
  permissions: string[];
  avatar?: string;
  isSuperAdmin: boolean;
  tenantId?: string;
  sessionId?: string;
}

export interface AdminAuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AdminUser | null>;
  /** Check if user has a specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user has all specified permissions */
  hasAllPermissions: (permissions: string[]) => boolean;
  /** Check if user has any of the specified permissions */
  hasAnyPermission: (permissions: string[]) => boolean;
  /** Check if user is a super admin */
  isSuperAdmin: boolean;
  /** Check if user is an admin (any admin role) */
  isAdmin: boolean;
  /** Check if user has moderator access */
  isModerator: boolean;
  /** Check if user has operations access */
  isOperations: boolean;
  /** Check if user has finance access */
  isFinance: boolean;
  /** Check if user has support access */
  isSupport: boolean;
}

export interface AdminAuthProviderProps {
  children: ReactNode;
  /** Initial user data for SSR */
  initialUser?: AdminUser | null;
  /** API base URL */
  apiBaseUrl?: string;
  /** Redirect URL when not authenticated */
  loginRedirectUrl?: string;
  /** Redirect URL when unauthorized (non-admin) */
  unauthorizedRedirectUrl?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Roles that are allowed to access the admin panel
 */
const ADMIN_ROLES: string[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'super_admin',
  'admin',
  'operations',
  'moderator',
  'support',
  'finance',
  'analytics',
  'platform_admin',
  'security_admin',
];

/**
 * Role-based permissions mapping
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  super_admin: ['*'],
  ADMIN: ['*'],
  admin: ['*'],
  platform_admin: ['*'],
  security_admin: ['*', 'security:*'],
  operations: ['users:*', 'disputes:*', 'contracts:*', 'support:*', 'jobs:*'],
  moderator: ['moderation:*', 'users:read', 'content:*'],
  support: ['users:read', 'support:*', 'tickets:*'],
  finance: ['payments:*', 'reports:financial', 'billing:*'],
  analytics: ['reports:*', 'analytics:*', 'metrics:*'],
};

// =============================================================================
// Context
// =============================================================================

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

// =============================================================================
// Permission Helpers
// =============================================================================

function checkPermission(permissions: string[], permission: string): boolean {
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;

  // Check namespace wildcards (e.g., "users:*" matches "users:read")
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

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

// =============================================================================
// Auth Provider
// =============================================================================

export function AdminAuthProvider({
  children,
  initialUser = null,
  apiBaseUrl = '',
  loginRedirectUrl = '/login',
  unauthorizedRedirectUrl = '/unauthorized',
}: AdminAuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<AdminUser | null>(initialUser);
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
        const response = await fetch(`${apiBaseUrl}/api/auth/admin/me`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;

          // Check if user has admin access
          const userRoles = userData.roles || [userData.role];
          const hasAdminAccess = userRoles.some((r: string) => isAdminRole(r));

          if (!hasAdminAccess) {
            console.warn('User does not have admin access');
            setUser(null);
            // Redirect to unauthorized page
            if (typeof window !== 'undefined') {
              window.location.href = unauthorizedRedirectUrl;
            }
            return;
          }

          // Determine primary admin role
          const primaryRole = userRoles.find((r: string) => isAdminRole(r)) || 'admin';

          // Get permissions
          const permissions =
            userData.permissions?.length > 0
              ? userData.permissions
              : getPermissionsForRole(primaryRole);

          // Transform to AdminUser format
          const adminUser: AdminUser = {
            id: userData.id || userData.userId,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            name:
              userData.name ||
              `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
              userData.email,
            role: primaryRole as AdminRole,
            roles: userRoles,
            permissions,
            avatar: userData.avatar,
            isSuperAdmin: ['SUPER_ADMIN', 'super_admin'].includes(primaryRole),
            tenantId: userData.tenantId,
            sessionId: userData.sessionId,
          };

          setUser(adminUser);
        } else if (response.status === 401) {
          setUser(null);
          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = loginRedirectUrl;
          }
        } else if (response.status === 403) {
          setUser(null);
          // Redirect to unauthorized
          if (typeof window !== 'undefined') {
            window.location.href = unauthorizedRedirectUrl;
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to fetch admin user:', err);
        setError('Failed to verify authentication');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [apiBaseUrl, initialUser, loginRedirectUrl, unauthorizedRedirectUrl]);

  // Login function
  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/admin/login`, {
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

        // Check if user has admin access
        const userRoles = userData.roles || [userData.role];
        const hasAdminAccess = userRoles.some((r: string) => isAdminRole(r));

        if (!hasAdminAccess) {
          throw new Error('You do not have admin access');
        }

        const primaryRole = userRoles.find((r: string) => isAdminRole(r)) || 'admin';
        const permissions =
          userData.permissions?.length > 0
            ? userData.permissions
            : getPermissionsForRole(primaryRole);

        const adminUser: AdminUser = {
          id: userData.id || userData.userId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          name:
            userData.name ||
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
            userData.email,
          role: primaryRole as AdminRole,
          roles: userRoles,
          permissions,
          avatar: userData.avatar,
          isSuperAdmin: ['SUPER_ADMIN', 'super_admin'].includes(primaryRole),
          tenantId: userData.tenantId,
          sessionId: userData.sessionId,
        };

        setUser(adminUser);
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
      await fetch(`${apiBaseUrl}/api/auth/admin/logout`, {
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
      if (typeof window !== 'undefined') {
        window.location.href = loginRedirectUrl;
      }
    }
  }, [apiBaseUrl, loginRedirectUrl]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/admin/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const userData = data.user || data;

        const userRoles = userData.roles || [userData.role];
        const primaryRole = userRoles.find((r: string) => isAdminRole(r)) || 'admin';
        const permissions =
          userData.permissions?.length > 0
            ? userData.permissions
            : getPermissionsForRole(primaryRole);

        const adminUser: AdminUser = {
          id: userData.id || userData.userId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          name:
            userData.name ||
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
            userData.email,
          role: primaryRole as AdminRole,
          roles: userRoles,
          permissions,
          avatar: userData.avatar,
          isSuperAdmin: ['SUPER_ADMIN', 'super_admin'].includes(primaryRole),
          tenantId: userData.tenantId,
          sessionId: userData.sessionId,
        };

        setUser(adminUser);
        return adminUser;
      }
      return null;
    } catch (err) {
      console.error('Failed to refresh admin user:', err);
      return null;
    }
  }, [apiBaseUrl]);

  // Computed role checks
  const isSuperAdmin = user?.isSuperAdmin || false;
  const isAdmin = !!user && user.roles.some((r) => isAdminRole(r));

  const isModerator =
    !!user &&
    user.roles.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin', 'moderator'].includes(r)
    );

  const isOperations =
    !!user &&
    user.roles.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin', 'operations'].includes(r)
    );

  const isFinance =
    !!user &&
    user.roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin', 'finance'].includes(r));

  const isSupport =
    !!user &&
    user.roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin', 'support'].includes(r));

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
  const value = useMemo<AdminAuthContextValue>(
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
      isSuperAdmin,
      isAdmin,
      isModerator,
      isOperations,
      isFinance,
      isSupport,
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
      isSuperAdmin,
      isAdmin,
      isModerator,
      isOperations,
      isFinance,
      isSupport,
    ]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access the admin auth context
 * @throws Error if used outside of AdminAuthProvider
 */
export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }

  return context;
}

/**
 * Hook to get the current admin user (safe version that doesn't throw)
 */
export function useAdminUser(): AdminUser | null {
  const context = useContext(AdminAuthContext);
  return context?.user ?? null;
}

/**
 * Hook to check if user is authenticated as admin (safe version)
 */
export function useIsAdmin(): boolean {
  const context = useContext(AdminAuthContext);
  return context?.isAdmin ?? false;
}

/**
 * Hook to check if user is a super admin (safe version)
 */
export function useIsSuperAdmin(): boolean {
  const context = useContext(AdminAuthContext);
  return context?.isSuperAdmin ?? false;
}

// =============================================================================
// Auth Guard Component
// =============================================================================

export interface AdminAuthGuardProps {
  children: ReactNode;
  /** Component to render when loading */
  fallback?: ReactNode;
  /** Require super admin access */
  requireSuperAdmin?: boolean;
  /** Require specific role */
  requireRole?: AdminRole;
  /** Require any of these roles */
  requireAnyRole?: AdminRole[];
  /** URL to redirect when unauthorized */
  unauthorizedRedirect?: string;
}

/**
 * Guard component that only renders children if user has required admin access
 */
export function AdminAuthGuard({
  children,
  fallback = null,
  requireSuperAdmin = false,
  requireRole,
  requireAnyRole,
  unauthorizedRedirect = '/unauthorized',
}: AdminAuthGuardProps): React.ReactElement | null {
  const { isAuthenticated, isLoading, isSuperAdmin, user } = useAdminAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    // Check super admin requirement
    if (requireSuperAdmin && !isSuperAdmin) {
      window.location.href = unauthorizedRedirect;
      return;
    }

    // Check specific role requirement
    if (requireRole && user?.role !== requireRole && !user?.roles.includes(requireRole)) {
      window.location.href = unauthorizedRedirect;
      return;
    }

    // Check any role requirement
    if (
      requireAnyRole?.length &&
      !requireAnyRole.some((r) => user?.role === r || user?.roles.includes(r))
    ) {
      window.location.href = unauthorizedRedirect;
    }
  }, [
    isAuthenticated,
    isLoading,
    isSuperAdmin,
    user,
    requireSuperAdmin,
    requireRole,
    requireAnyRole,
    unauthorizedRedirect,
  ]);

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return null;
  }

  if (requireRole && user?.role !== requireRole && !user?.roles.includes(requireRole)) {
    return null;
  }

  if (
    requireAnyRole?.length &&
    !requireAnyRole.some((r) => user?.role === r || user?.roles.includes(r))
  ) {
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
  const { isLoading, hasPermission, hasAllPermissions, hasAnyPermission } = useAdminAuth();

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

// =============================================================================
// Exports
// =============================================================================

export { ADMIN_ROLES, ROLE_PERMISSIONS };
