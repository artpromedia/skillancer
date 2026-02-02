/**
 * Admin API Module
 *
 * Barrel export for all admin API services and utilities.
 */

// Legacy admin API (for backward compatibility)
export { adminApi, default } from './admin';

// New API Client
export {
  getApiClient,
  resetApiClient,
  setAuthTokens,
  clearAuthTokens,
  isAuthenticated,
  getSessionId,
  withAuditContext,
  requestElevatedPermissions,
} from './api-client';

// Services
export * from './services/users';
export * from './services/moderation';
export * from './services/disputes';
export * from './services/payments';
export * from './services/support';
export * from './services/audit';

// Legacy types (for backward compatibility)
export type {
  User,
  UserFilters,
  ModerationItem,
  Dispute,
  Resolution,
  Transaction,
  SkillPodSession,
  SkillPodViolation,
  Report,
  FeatureFlag,
  PlatformSettings,
  AuditLogEntry,
} from './admin';
