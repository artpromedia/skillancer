'use client';

/**
 * @skillancer/auth - useRequireAuth Hook
 *
 * Hook to protect routes and require authentication.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '../types';
import type { Permission } from '../permissions/constants';

// =============================================================================
// Types
// =============================================================================

export interface UseRequireAuthOptions {
  /** Current user from auth context */
  user: AuthUser | null;
  /** Whether auth state is loading */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Required permissions (all must be present) */
  requiredPermissions?: Permission[];
  /** Required roles (any must be present) */
  requiredRoles?: string[];
  /** Redirect URL when not authenticated */
  loginUrl?: string;
  /** Redirect URL when not authorized */
  unauthorizedUrl?: string;
  /** Whether to redirect or just return status */
  redirect?: boolean;
}

export interface UseRequireAuthReturn {
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether user is authorized (has required permissions/roles) */
  isAuthorized: boolean;
  /** Whether auth is still loading */
  isLoading: boolean;
  /** Current user */
  user: AuthUser | null;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to require authentication and optionally specific permissions/roles
 *
 * @example
 * ```tsx
 * const { isAuthorized, isLoading } = useRequireAuth({
 *   user,
 *   isLoading,
 *   isAuthenticated,
 *   requiredPermissions: ['users:delete'],
 *   redirect: true,
 * });
 *
 * if (isLoading) return <Loading />;
 * if (!isAuthorized) return null; // Will redirect
 * ```
 */
export function useRequireAuth({
  user,
  isLoading,
  isAuthenticated,
  requiredPermissions = [],
  requiredRoles = [],
  loginUrl = '/login',
  unauthorizedUrl = '/unauthorized',
  redirect = true,
}: UseRequireAuthOptions): UseRequireAuthReturn {
  const router = useRouter();

  // Check if user has all required permissions
  const hasRequiredPermissions =
    requiredPermissions.length === 0 ||
    (user?.permissions && requiredPermissions.every((p) => user.permissions.includes(p)));

  // Check if user has any required role
  const hasRequiredRole =
    requiredRoles.length === 0 ||
    (user?.roles && requiredRoles.some((r) => user.roles.includes(r)));

  const isAuthorized = isAuthenticated && hasRequiredPermissions && hasRequiredRole;

  useEffect(() => {
    if (!redirect || isLoading) return;

    if (!isAuthenticated) {
      // Not logged in - redirect to login
      const returnUrl = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.push(`${loginUrl}?returnUrl=${encodeURIComponent(returnUrl)}`);
    } else if (!isAuthorized) {
      // Logged in but not authorized - redirect to unauthorized page
      router.push(unauthorizedUrl);
    }
  }, [isLoading, isAuthenticated, isAuthorized, redirect, router, loginUrl, unauthorizedUrl]);

  return {
    isAuthenticated,
    isAuthorized,
    isLoading,
    user,
  };
}

export default useRequireAuth;
