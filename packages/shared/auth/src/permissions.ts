/**
 * @skillancer/shared-auth - Permission Constants
 * Centralized permission definitions used across all applications
 */

import type { AdminRole, UserRole } from './types';

// =============================================================================
// Permission Categories
// =============================================================================

/**
 * User management permissions
 */
export const USER_PERMISSIONS = {
  VIEW: 'users:view',
  CREATE: 'users:create',
  UPDATE: 'users:update',
  DELETE: 'users:delete',
  SUSPEND: 'users:suspend',
  BAN: 'users:ban',
  IMPERSONATE: 'users:impersonate',
  VIEW_SENSITIVE: 'users:view_sensitive',
  MANAGE_ROLES: 'users:manage_roles',
} as const;

/**
 * Job/Project management permissions
 */
export const JOB_PERMISSIONS = {
  VIEW: 'jobs:view',
  CREATE: 'jobs:create',
  UPDATE: 'jobs:update',
  DELETE: 'jobs:delete',
  APPROVE: 'jobs:approve',
  FEATURE: 'jobs:feature',
  MODERATE: 'jobs:moderate',
} as const;

/**
 * Contract management permissions
 */
export const CONTRACT_PERMISSIONS = {
  VIEW: 'contracts:view',
  CREATE: 'contracts:create',
  UPDATE: 'contracts:update',
  CANCEL: 'contracts:cancel',
  DISPUTE: 'contracts:dispute',
  RESOLVE_DISPUTE: 'contracts:resolve_dispute',
} as const;

/**
 * Financial permissions
 */
export const FINANCE_PERMISSIONS = {
  VIEW_TRANSACTIONS: 'finance:view_transactions',
  PROCESS_REFUNDS: 'finance:process_refunds',
  MANAGE_PAYOUTS: 'finance:manage_payouts',
  VIEW_REPORTS: 'finance:view_reports',
  EXPORT_DATA: 'finance:export_data',
  MANAGE_PRICING: 'finance:manage_pricing',
} as const;

/**
 * Content moderation permissions
 */
export const MODERATION_PERMISSIONS = {
  VIEW_QUEUE: 'moderation:view_queue',
  APPROVE: 'moderation:approve',
  REJECT: 'moderation:reject',
  BAN_CONTENT: 'moderation:ban_content',
  REVIEW_APPEALS: 'moderation:review_appeals',
} as const;

/**
 * System/Admin permissions
 */
export const SYSTEM_PERMISSIONS = {
  VIEW_DASHBOARD: 'system:view_dashboard',
  MANAGE_SETTINGS: 'system:manage_settings',
  VIEW_AUDIT_LOGS: 'system:view_audit_logs',
  MANAGE_ADMINS: 'system:manage_admins',
  VIEW_ANALYTICS: 'system:view_analytics',
  MANAGE_INTEGRATIONS: 'system:manage_integrations',
  MANAGE_FEATURE_FLAGS: 'system:manage_feature_flags',
} as const;

/**
 * Cockpit-specific permissions
 */
export const COCKPIT_PERMISSIONS = {
  VIEW_DASHBOARD: 'cockpit:view_dashboard',
  MANAGE_PROJECTS: 'cockpit:manage_projects',
  MANAGE_TIME: 'cockpit:manage_time',
  VIEW_FINANCES: 'cockpit:view_finances',
  MANAGE_CLIENTS: 'cockpit:manage_clients',
  VIEW_REPORTS: 'cockpit:view_reports',
  MANAGE_INVOICES: 'cockpit:manage_invoices',
  MANAGE_TEAM: 'cockpit:manage_team',
} as const;

/**
 * SkillPod-specific permissions
 */
export const SKILLPOD_PERMISSIONS = {
  ACCESS_VDI: 'skillpod:access_vdi',
  MANAGE_ENVIRONMENTS: 'skillpod:manage_environments',
  VIEW_SESSIONS: 'skillpod:view_sessions',
  ADMIN_ACCESS: 'skillpod:admin_access',
} as const;

// =============================================================================
// Permission Type
// =============================================================================

export type Permission =
  | (typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS]
  | (typeof JOB_PERMISSIONS)[keyof typeof JOB_PERMISSIONS]
  | (typeof CONTRACT_PERMISSIONS)[keyof typeof CONTRACT_PERMISSIONS]
  | (typeof FINANCE_PERMISSIONS)[keyof typeof FINANCE_PERMISSIONS]
  | (typeof MODERATION_PERMISSIONS)[keyof typeof MODERATION_PERMISSIONS]
  | (typeof SYSTEM_PERMISSIONS)[keyof typeof SYSTEM_PERMISSIONS]
  | (typeof COCKPIT_PERMISSIONS)[keyof typeof COCKPIT_PERMISSIONS]
  | (typeof SKILLPOD_PERMISSIONS)[keyof typeof SKILLPOD_PERMISSIONS]
  | string; // Allow custom permissions

// =============================================================================
// Role -> Permission Mappings
// =============================================================================

/**
 * Admin role permissions
 */
export const ADMIN_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: ['*'], // All permissions
  super_admin: ['*'],
  ADMIN: [
    ...Object.values(USER_PERMISSIONS),
    ...Object.values(JOB_PERMISSIONS),
    ...Object.values(CONTRACT_PERMISSIONS),
    ...Object.values(FINANCE_PERMISSIONS),
    ...Object.values(MODERATION_PERMISSIONS),
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
    SYSTEM_PERMISSIONS.VIEW_AUDIT_LOGS,
    SYSTEM_PERMISSIONS.VIEW_ANALYTICS,
  ],
  admin: [
    ...Object.values(USER_PERMISSIONS),
    ...Object.values(JOB_PERMISSIONS),
    ...Object.values(CONTRACT_PERMISSIONS),
    ...Object.values(FINANCE_PERMISSIONS),
    ...Object.values(MODERATION_PERMISSIONS),
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
    SYSTEM_PERMISSIONS.VIEW_AUDIT_LOGS,
    SYSTEM_PERMISSIONS.VIEW_ANALYTICS,
  ],
  OPERATIONS: [
    USER_PERMISSIONS.VIEW,
    USER_PERMISSIONS.UPDATE,
    USER_PERMISSIONS.SUSPEND,
    ...Object.values(JOB_PERMISSIONS),
    ...Object.values(CONTRACT_PERMISSIONS),
    FINANCE_PERMISSIONS.VIEW_TRANSACTIONS,
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
  ],
  operations: [
    USER_PERMISSIONS.VIEW,
    USER_PERMISSIONS.UPDATE,
    USER_PERMISSIONS.SUSPEND,
    ...Object.values(JOB_PERMISSIONS),
    ...Object.values(CONTRACT_PERMISSIONS),
    FINANCE_PERMISSIONS.VIEW_TRANSACTIONS,
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
  ],
  MODERATOR: [
    USER_PERMISSIONS.VIEW,
    USER_PERMISSIONS.SUSPEND,
    JOB_PERMISSIONS.VIEW,
    JOB_PERMISSIONS.MODERATE,
    ...Object.values(MODERATION_PERMISSIONS),
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
  ],
  moderator: [
    USER_PERMISSIONS.VIEW,
    USER_PERMISSIONS.SUSPEND,
    JOB_PERMISSIONS.VIEW,
    JOB_PERMISSIONS.MODERATE,
    ...Object.values(MODERATION_PERMISSIONS),
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
  ],
  SUPPORT: [
    USER_PERMISSIONS.VIEW,
    JOB_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.DISPUTE,
    FINANCE_PERMISSIONS.VIEW_TRANSACTIONS,
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
  ],
  support: [
    USER_PERMISSIONS.VIEW,
    JOB_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.DISPUTE,
    FINANCE_PERMISSIONS.VIEW_TRANSACTIONS,
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
  ],
  FINANCE: [
    USER_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.VIEW,
    ...Object.values(FINANCE_PERMISSIONS),
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
    SYSTEM_PERMISSIONS.VIEW_ANALYTICS,
  ],
  finance: [
    USER_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.VIEW,
    ...Object.values(FINANCE_PERMISSIONS),
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
    SYSTEM_PERMISSIONS.VIEW_ANALYTICS,
  ],
  ANALYTICS: [
    USER_PERMISSIONS.VIEW,
    JOB_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.VIEW,
    FINANCE_PERMISSIONS.VIEW_REPORTS,
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
    SYSTEM_PERMISSIONS.VIEW_ANALYTICS,
  ],
  analytics: [
    USER_PERMISSIONS.VIEW,
    JOB_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.VIEW,
    FINANCE_PERMISSIONS.VIEW_REPORTS,
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
    SYSTEM_PERMISSIONS.VIEW_ANALYTICS,
  ],
};

/**
 * User role permissions
 */
export const USER_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  USER: [],
  FREELANCER: [
    COCKPIT_PERMISSIONS.VIEW_DASHBOARD,
    COCKPIT_PERMISSIONS.MANAGE_TIME,
    COCKPIT_PERMISSIONS.VIEW_FINANCES,
    COCKPIT_PERMISSIONS.MANAGE_INVOICES,
    SKILLPOD_PERMISSIONS.ACCESS_VDI,
  ],
  CLIENT: [JOB_PERMISSIONS.CREATE, JOB_PERMISSIONS.UPDATE, CONTRACT_PERMISSIONS.CREATE],
  BOTH: [
    COCKPIT_PERMISSIONS.VIEW_DASHBOARD,
    COCKPIT_PERMISSIONS.MANAGE_TIME,
    COCKPIT_PERMISSIONS.VIEW_FINANCES,
    COCKPIT_PERMISSIONS.MANAGE_INVOICES,
    SKILLPOD_PERMISSIONS.ACCESS_VDI,
    JOB_PERMISSIONS.CREATE,
    JOB_PERMISSIONS.UPDATE,
    CONTRACT_PERMISSIONS.CREATE,
  ],
};

// =============================================================================
// Permission Helpers
// =============================================================================

/**
 * Check if permissions include a wildcard
 */
function hasWildcard(permissions: string[]): boolean {
  return permissions.includes('*');
}

/**
 * Check if a specific permission matches (considering wildcards)
 */
function permissionMatches(userPermission: string, requiredPermission: string): boolean {
  if (userPermission === '*') return true;
  if (userPermission === requiredPermission) return true;

  // Check namespace wildcards (e.g., "users:*" matches "users:view")
  if (userPermission.endsWith(':*')) {
    const namespace = userPermission.slice(0, -2);
    return requiredPermission.startsWith(`${namespace}:`);
  }

  return false;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(userPermissions: string[], requiredPermission: Permission): boolean {
  if (hasWildcard(userPermissions)) return true;
  return userPermissions.some((p) => permissionMatches(p, requiredPermission));
}

/**
 * Check if user has all specified permissions
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: Permission[]
): boolean {
  if (hasWildcard(userPermissions)) return true;
  return requiredPermissions.every((required) =>
    userPermissions.some((p) => permissionMatches(p, required))
  );
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: Permission[]
): boolean {
  if (hasWildcard(userPermissions)) return true;
  return requiredPermissions.some((required) =>
    userPermissions.some((p) => permissionMatches(p, required))
  );
}

/**
 * Get permissions for a user role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return USER_ROLE_PERMISSIONS[role] || [];
}

/**
 * Get permissions for an admin role
 */
export function getPermissionsForAdminRole(role: AdminRole | string): Permission[] {
  return ADMIN_ROLE_PERMISSIONS[role] || [];
}

// =============================================================================
// Role Helpers
// =============================================================================

/**
 * Admin roles that have access to admin panel
 */
export const ADMIN_ROLES: string[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS',
  'MODERATOR',
  'SUPPORT',
  'FINANCE',
  'ANALYTICS',
  'super_admin',
  'admin',
  'operations',
  'moderator',
  'support',
  'finance',
  'analytics',
];

/**
 * Check if role is an admin role
 */
export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

/**
 * Check if user has admin access
 */
export function isAdmin(roles: string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(roles: string[]): boolean {
  return roles.some((r) => r === 'SUPER_ADMIN' || r === 'super_admin');
}

/**
 * Check if user is a moderator
 */
export function isModerator(roles: string[]): boolean {
  const modRoles = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'super_admin', 'admin', 'moderator'];
  return roles.some((r) => modRoles.includes(r));
}

/**
 * Check if user has operations access
 */
export function isOperations(roles: string[]): boolean {
  const opsRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'super_admin', 'admin', 'operations'];
  return roles.some((r) => opsRoles.includes(r));
}

/**
 * Check if user has finance access
 */
export function isFinance(roles: string[]): boolean {
  const financeRoles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'super_admin', 'admin', 'finance'];
  return roles.some((r) => financeRoles.includes(r));
}
