/**
 * @skillancer/auth - Permission Constants
 *
 * Centralized permission definitions used across all applications.
 * Permissions follow the format: resource:action
 */

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
  VIEW_REPORTS: 'moderation:view_reports',
  TAKE_ACTION: 'moderation:take_action',
  REVIEW_APPEALS: 'moderation:review_appeals',
  BAN_USERS: 'moderation:ban_users',
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
// Role Definitions
// =============================================================================

/**
 * User roles in the system
 */
export type UserRole = 'USER' | 'FREELANCER' | 'CLIENT' | 'BOTH' | 'ADMIN' | 'SUPER_ADMIN';

/**
 * Admin-specific roles
 */
export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'OPERATIONS'
  | 'MODERATOR'
  | 'SUPPORT'
  | 'FINANCE'
  | 'ANALYTICS';

/**
 * All permission values
 */
export type Permission =
  | (typeof USER_PERMISSIONS)[keyof typeof USER_PERMISSIONS]
  | (typeof JOB_PERMISSIONS)[keyof typeof JOB_PERMISSIONS]
  | (typeof CONTRACT_PERMISSIONS)[keyof typeof CONTRACT_PERMISSIONS]
  | (typeof FINANCE_PERMISSIONS)[keyof typeof FINANCE_PERMISSIONS]
  | (typeof MODERATION_PERMISSIONS)[keyof typeof MODERATION_PERMISSIONS]
  | (typeof SYSTEM_PERMISSIONS)[keyof typeof SYSTEM_PERMISSIONS]
  | (typeof COCKPIT_PERMISSIONS)[keyof typeof COCKPIT_PERMISSIONS]
  | (typeof SKILLPOD_PERMISSIONS)[keyof typeof SKILLPOD_PERMISSIONS];

// =============================================================================
// Role -> Permission Mappings
// =============================================================================

/**
 * Default permissions for each admin role
 */
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: [
    // All permissions
    ...Object.values(USER_PERMISSIONS),
    ...Object.values(JOB_PERMISSIONS),
    ...Object.values(CONTRACT_PERMISSIONS),
    ...Object.values(FINANCE_PERMISSIONS),
    ...Object.values(MODERATION_PERMISSIONS),
    ...Object.values(SYSTEM_PERMISSIONS),
    ...Object.values(COCKPIT_PERMISSIONS),
    ...Object.values(SKILLPOD_PERMISSIONS),
  ],
  ADMIN: [
    USER_PERMISSIONS.VIEW,
    USER_PERMISSIONS.UPDATE,
    USER_PERMISSIONS.SUSPEND,
    USER_PERMISSIONS.VIEW_SENSITIVE,
    ...Object.values(JOB_PERMISSIONS),
    ...Object.values(CONTRACT_PERMISSIONS),
    FINANCE_PERMISSIONS.VIEW_TRANSACTIONS,
    FINANCE_PERMISSIONS.VIEW_REPORTS,
    ...Object.values(MODERATION_PERMISSIONS),
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
    SYSTEM_PERMISSIONS.VIEW_AUDIT_LOGS,
    SYSTEM_PERMISSIONS.VIEW_ANALYTICS,
  ],
  OPERATIONS: [
    USER_PERMISSIONS.VIEW,
    USER_PERMISSIONS.UPDATE,
    ...Object.values(JOB_PERMISSIONS),
    CONTRACT_PERMISSIONS.VIEW,
    CONTRACT_PERMISSIONS.UPDATE,
    FINANCE_PERMISSIONS.VIEW_TRANSACTIONS,
    SYSTEM_PERMISSIONS.VIEW_DASHBOARD,
    SYSTEM_PERMISSIONS.VIEW_ANALYTICS,
  ],
  MODERATOR: [
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
  FINANCE: [
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
};

/**
 * Default permissions for regular user roles
 */
export const USER_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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
  ADMIN: ADMIN_ROLE_PERMISSIONS.ADMIN,
  SUPER_ADMIN: ADMIN_ROLE_PERMISSIONS.SUPER_ADMIN,
};

// =============================================================================
// Permission Helpers
// =============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission
): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a role has all specified permissions
 */
export function hasAllPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.some((p) => userPermissions.includes(p));
}

/**
 * Get all permissions for a user role
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return USER_ROLE_PERMISSIONS[role] || [];
}

/**
 * Get all permissions for an admin role
 */
export function getPermissionsForAdminRole(role: AdminRole): Permission[] {
  return ADMIN_ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string): role is AdminRole {
  return role in ADMIN_ROLE_PERMISSIONS;
}

/**
 * Check if the user has admin-level access
 */
export function isAdmin(roles: string[]): boolean {
  const adminRoles: string[] = ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'];
  return roles.some((r) => adminRoles.includes(r));
}

/**
 * Check if the user has moderator-level access
 */
export function isModerator(roles: string[]): boolean {
  const modRoles: string[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'MODERATOR',
    'super_admin',
    'admin',
    'moderator',
  ];
  return roles.some((r) => modRoles.includes(r));
}

/**
 * Check if the user is a super admin
 */
export function isSuperAdmin(roles: string[]): boolean {
  return roles.some((r) => r === 'SUPER_ADMIN' || r === 'super_admin');
}
