/**
 * @module @skillancer/admin/models
 * Admin user, permission, and audit schemas
 */

// ==================== Admin User Schema ====================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: AdminRole;
  permissions: AdminPermission[];
  department?: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'moderator'
  | 'support_agent'
  | 'support_lead'
  | 'finance'
  | 'analyst'
  | 'developer';

export type AdminPermission =
  // User Management
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'users:impersonate'
  | 'users:ban'
  | 'users:verify'
  | 'users:export'
  // Content Moderation
  | 'content:read'
  | 'content:moderate'
  | 'content:delete'
  | 'content:feature'
  // Course Management
  | 'courses:read'
  | 'courses:write'
  | 'courses:publish'
  | 'courses:delete'
  // Marketplace Management
  | 'jobs:read'
  | 'jobs:moderate'
  | 'jobs:delete'
  | 'contracts:read'
  | 'contracts:moderate'
  | 'disputes:read'
  | 'disputes:resolve'
  // Financial
  | 'payments:read'
  | 'payments:refund'
  | 'payouts:read'
  | 'payouts:process'
  | 'invoices:read'
  // System
  | 'settings:read'
  | 'settings:write'
  | 'features:read'
  | 'features:write'
  | 'integrations:read'
  | 'integrations:write'
  // Support
  | 'tickets:read'
  | 'tickets:write'
  | 'tickets:assign'
  | 'tickets:escalate'
  // Analytics
  | 'analytics:read'
  | 'reports:read'
  | 'reports:export'
  // Audit
  | 'audit:read'
  | 'compliance:read'
  | 'compliance:write';

// Role to permissions mapping
export const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    'users:read',
    'users:write',
    'users:delete',
    'users:impersonate',
    'users:ban',
    'users:verify',
    'users:export',
    'content:read',
    'content:moderate',
    'content:delete',
    'content:feature',
    'courses:read',
    'courses:write',
    'courses:publish',
    'courses:delete',
    'jobs:read',
    'jobs:moderate',
    'jobs:delete',
    'contracts:read',
    'contracts:moderate',
    'disputes:read',
    'disputes:resolve',
    'payments:read',
    'payments:refund',
    'payouts:read',
    'payouts:process',
    'invoices:read',
    'settings:read',
    'settings:write',
    'features:read',
    'features:write',
    'integrations:read',
    'integrations:write',
    'tickets:read',
    'tickets:write',
    'tickets:assign',
    'tickets:escalate',
    'analytics:read',
    'reports:read',
    'reports:export',
    'audit:read',
    'compliance:read',
    'compliance:write',
  ],
  admin: [
    'users:read',
    'users:write',
    'users:ban',
    'users:verify',
    'content:read',
    'content:moderate',
    'content:delete',
    'content:feature',
    'courses:read',
    'courses:write',
    'courses:publish',
    'jobs:read',
    'jobs:moderate',
    'contracts:read',
    'disputes:read',
    'disputes:resolve',
    'payments:read',
    'payouts:read',
    'settings:read',
    'features:read',
    'features:write',
    'tickets:read',
    'tickets:write',
    'tickets:assign',
    'tickets:escalate',
    'analytics:read',
    'reports:read',
    'audit:read',
  ],
  moderator: [
    'users:read',
    'content:read',
    'content:moderate',
    'content:delete',
    'courses:read',
    'jobs:read',
    'jobs:moderate',
    'contracts:read',
    'tickets:read',
    'tickets:write',
  ],
  support_agent: [
    'users:read',
    'content:read',
    'courses:read',
    'jobs:read',
    'contracts:read',
    'payments:read',
    'tickets:read',
    'tickets:write',
  ],
  support_lead: [
    'users:read',
    'users:write',
    'content:read',
    'content:moderate',
    'courses:read',
    'jobs:read',
    'contracts:read',
    'disputes:read',
    'payments:read',
    'payments:refund',
    'tickets:read',
    'tickets:write',
    'tickets:assign',
    'tickets:escalate',
    'analytics:read',
  ],
  finance: [
    'users:read',
    'payments:read',
    'payments:refund',
    'payouts:read',
    'payouts:process',
    'invoices:read',
    'analytics:read',
    'reports:read',
    'reports:export',
  ],
  analyst: [
    'users:read',
    'content:read',
    'courses:read',
    'jobs:read',
    'contracts:read',
    'payments:read',
    'analytics:read',
    'reports:read',
    'reports:export',
  ],
  developer: [
    'settings:read',
    'settings:write',
    'features:read',
    'features:write',
    'integrations:read',
    'integrations:write',
    'analytics:read',
    'audit:read',
  ],
};

// ==================== Audit Log Schema ====================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  adminUserId: string;
  adminUserEmail: string;
  adminUserRole: AdminRole;
  action: AuditAction;
  resource: {
    type: ResourceType;
    id: string;
    name?: string;
  };
  details: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

export type AuditAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'ban'
  | 'unban'
  | 'verify'
  | 'impersonate'
  | 'moderate'
  | 'approve'
  | 'reject'
  | 'refund'
  | 'payout'
  | 'feature'
  | 'unfeature'
  | 'publish'
  | 'unpublish'
  | 'resolve'
  | 'escalate'
  | 'export'
  | 'configure';

export type ResourceType =
  | 'user'
  | 'admin_user'
  | 'course'
  | 'lesson'
  | 'job'
  | 'proposal'
  | 'contract'
  | 'dispute'
  | 'payment'
  | 'payout'
  | 'ticket'
  | 'report'
  | 'setting'
  | 'feature_flag'
  | 'integration';

// ==================== Feature Flag Schema ====================

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  environment: 'development' | 'staging' | 'production';
  rolloutPercentage: number;
  targetedUsers?: string[];
  targetedSegments?: string[];
  rules?: FeatureFlagRule[];
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

export interface FeatureFlagRule {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: string | number | string[];
}

// ==================== System Setting Schema ====================

export interface SystemSetting {
  id: string;
  category: SettingCategory;
  key: string;
  value: unknown;
  valueType: 'string' | 'number' | 'boolean' | 'json' | 'secret';
  description: string;
  isEditable: boolean;
  validationRules?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
  updatedAt: Date;
  updatedBy: string;
}

export type SettingCategory =
  | 'general'
  | 'security'
  | 'payments'
  | 'notifications'
  | 'marketplace'
  | 'learning'
  | 'integrations'
  | 'limits';
