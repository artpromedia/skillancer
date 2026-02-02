/**
 * Auth module for Admin
 *
 * Re-exports auth service, provider, and hooks.
 */

export { AdminAuthProvider, useAdminAuth, useAuth } from './auth-provider';
export type { AdminAuthContextValue } from './auth-provider';

export {
  adminAuthService,
  type AdminUser,
  type AdminRole,
  type AuthTokens,
  type AuthSession,
  type LoginResponse,
  type MFARequiredResponse,
  type LogoutResponse,
  type UserStatus,
} from './auth-service';
