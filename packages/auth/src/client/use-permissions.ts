'use client';

/**
 * @skillancer/auth - usePermissions Hook
 *
 * React hook for checking user permissions in components.
 */

import { useMemo, useCallback } from 'react';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAdmin,
  isModerator,
  isSuperAdmin,
  type Permission,
} from '../permissions/constants';

// =============================================================================
// Types
// =============================================================================

export interface UsePermissionsOptions {
  /** User's permissions array */
  permissions: string[];
  /** User's roles array */
  roles: string[];
}

export interface UsePermissionsReturn {
  /** Check if user has a specific permission */
  can: (permission: Permission) => boolean;
  /** Check if user has all specified permissions */
  canAll: (permissions: Permission[]) => boolean;
  /** Check if user has any of the specified permissions */
  canAny: (permissions: Permission[]) => boolean;
  /** Whether user is an admin */
  isAdmin: boolean;
  /** Whether user is a super admin */
  isSuperAdmin: boolean;
  /** Whether user is a moderator */
  isModerator: boolean;
  /** All user permissions */
  permissions: string[];
  /** All user roles */
  roles: string[];
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for checking user permissions
 *
 * @example
 * ```tsx
 * const { can, isAdmin } = usePermissions({
 *   permissions: user.permissions,
 *   roles: user.roles,
 * });
 *
 * if (can('users:delete')) {
 *   // Show delete button
 * }
 * ```
 */
export function usePermissions({
  permissions,
  roles,
}: UsePermissionsOptions): UsePermissionsReturn {
  const permissionsSet = useMemo(() => new Set(permissions), [permissions]);

  const can = useCallback(
    (permission: Permission): boolean => {
      return hasPermission(permissions as Permission[], permission);
    },
    [permissions]
  );

  const canAll = useCallback(
    (requiredPermissions: Permission[]): boolean => {
      return hasAllPermissions(permissions as Permission[], requiredPermissions);
    },
    [permissions]
  );

  const canAny = useCallback(
    (requiredPermissions: Permission[]): boolean => {
      return hasAnyPermission(permissions as Permission[], requiredPermissions);
    },
    [permissions]
  );

  const isUserAdmin = useMemo(() => isAdmin(roles), [roles]);
  const isUserSuperAdmin = useMemo(() => isSuperAdmin(roles), [roles]);
  const isUserModerator = useMemo(() => isModerator(roles), [roles]);

  return {
    can,
    canAll,
    canAny,
    isAdmin: isUserAdmin,
    isSuperAdmin: isUserSuperAdmin,
    isModerator: isUserModerator,
    permissions,
    roles,
  };
}

export default usePermissions;
