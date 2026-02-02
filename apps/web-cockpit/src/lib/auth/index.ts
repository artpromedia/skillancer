/**
 * Auth module for Web Cockpit
 *
 * Re-exports auth service, provider, and hooks.
 */

export { CockpitAuthProvider, useCockpitAuth, useAuth } from './auth-provider';
export type { CockpitAuthContextValue } from './auth-provider';

export {
  cockpitAuthService,
  type CockpitUser,
  type TenantInfo,
  type AuthTokens,
  type AuthSession,
  type LoginResponse,
  type MFARequiredResponse,
  type LogoutResponse,
  type UserStatus,
  type VerificationLevel,
} from './auth-service';
