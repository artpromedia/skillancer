// @ts-nocheck
/**
 * SkillPod B2B Enterprise Module
 * Central export for all B2B enterprise services
 */

// =============================================================================
// ADMINISTRATION
// =============================================================================

export { getTenantManagementService } from './admin/tenant-management';
export type {
  CreateTenantInput,
  UpdateTenantInput,
  TenantWithStats,
} from './admin/tenant-management';

export { getTenantAdminPortalService } from './admin/tenant-admin-portal';
export type { AdminUser, AdminDashboardStats, AdminAction } from './admin/tenant-admin-portal';

// =============================================================================
// ONBOARDING
// =============================================================================

export { getEnterpriseProvisioningService } from './onboarding/enterprise-provisioning';
export type {
  ProvisionTenantInput,
  ProvisioningResult,
} from './onboarding/enterprise-provisioning';

// =============================================================================
// AUTHENTICATION
// =============================================================================

export { getSsoIntegrationService } from './auth/sso-integration';
export type { SamlConfig, OidcConfig, SsoTestResult } from './auth/sso-integration';

// =============================================================================
// API ACCESS
// =============================================================================

export { getEnterpriseApiService } from './api/enterprise-api';
export type { CreateApiKeyInput, ApiKeyWithPrefix, WebhookConfig } from './api/enterprise-api';

// =============================================================================
// REPORTING
// =============================================================================

export { getEnterpriseReportsService } from './reports/enterprise-reports';
export type { ReportConfig, ReportResult, ScheduledReport } from './reports/enterprise-reports';

// =============================================================================
// BILLING & PLANS
// =============================================================================

export { getSkillPodPlansService, PLANS, FEATURES } from './billing/skillpod-plans';
export type { Plan, PlanId, Feature } from './billing/skillpod-plans';

// =============================================================================
// TRIALS
// =============================================================================

export { getTrialManagerService } from './trials/trial-manager';
export type { TrialInfo, TrialMetrics, TrialEngagement } from './trials/trial-manager';

// =============================================================================
// CONSTANTS
// =============================================================================

export const SKILLPOD_B2B_VERSION = '1.0.0';

export const API_SCOPES = {
  SESSIONS_READ: 'sessions:read',
  SESSIONS_WRITE: 'sessions:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  POLICIES_READ: 'policies:read',
  POLICIES_WRITE: 'policies:write',
  REPORTS_READ: 'reports:read',
  WEBHOOKS_WRITE: 'webhooks:write',
  ADMIN: 'admin',
} as const;

export const WEBHOOK_EVENTS = {
  SESSION_STARTED: 'session.started',
  SESSION_ENDED: 'session.ended',
  SESSION_TIMEOUT: 'session.timeout',
  USER_CREATED: 'user.created',
  USER_DISABLED: 'user.disabled',
  POLICY_VIOLATED: 'policy.violated',
  SECURITY_ALERT: 'security.alert',
} as const;

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SECURITY_ADMIN: 'SECURITY_ADMIN',
  USER_ADMIN: 'USER_ADMIN',
  VIEWER: 'VIEWER',
} as const;

export const TRIAL_CONFIG = {
  DEFAULT_DURATION_DAYS: 14,
  MAX_EXTENSIONS: 2,
  EXTENSION_DAYS: 14,
  REMINDER_DAYS: [7, 3, 1],
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];
export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];
