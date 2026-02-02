/**
 * @skillancer/auth
 *
 * Shared authentication utilities, hooks, and permission management.
 *
 * @example
 * ```ts
 * // Import types
 * import { AuthUser, AuthTokens } from '@skillancer/auth';
 *
 * // Import client utilities
 * import { usePermissions, useRequireAuth } from '@skillancer/auth/client';
 *
 * // Import server utilities
 * import { verifyToken, extractUserFromPayload } from '@skillancer/auth/server';
 *
 * // Import permissions
 * import { USER_PERMISSIONS, isAdmin } from '@skillancer/auth/permissions';
 * ```
 */

// Export all types
export * from './types';

// Re-export from permissions
export {
  USER_PERMISSIONS,
  JOB_PERMISSIONS,
  CONTRACT_PERMISSIONS,
  FINANCE_PERMISSIONS,
  MODERATION_PERMISSIONS,
  SYSTEM_PERMISSIONS,
  COCKPIT_PERMISSIONS,
  SKILLPOD_PERMISSIONS,
  ADMIN_ROLE_PERMISSIONS,
  USER_ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getPermissionsForRole,
  getPermissionsForAdminRole,
  isAdminRole,
  isAdmin,
  isModerator,
  isSuperAdmin,
  type Permission,
  type UserRole,
  type AdminRole,
} from './permissions/constants';
