/**
 * @skillancer/shared-auth
 * Shared authentication utilities for all Skillancer applications
 *
 * @example
 * // Import types
 * import type { AuthUser, AdminUser, CockpitUser } from '@skillancer/shared-auth';
 *
 * // Import client-side hooks (for React components)
 * import { useAuth, usePermissions, AuthProvider } from '@skillancer/shared-auth/client';
 *
 * // Import server-side utilities (for API routes, middleware)
 * import { verifyToken, authenticateToken, getAuthUser } from '@skillancer/shared-auth/server';
 *
 * // Import permissions
 * import { USER_PERMISSIONS, hasPermission, isAdmin } from '@skillancer/shared-auth';
 */

// =============================================================================
// Types
// =============================================================================

export * from './types';

// =============================================================================
// Permissions
// =============================================================================

export * from './permissions';
