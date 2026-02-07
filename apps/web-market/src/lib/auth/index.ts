/**
 * Auth Module Exports
 *
 * Re-exports all auth-related utilities, providers, and hooks.
 */

// Server-side auth utilities
export {
  getAuthSession,
  isAuthenticated as isAuthenticatedServer,
  getAuthUserId,
  type AuthSession,
} from '../server-auth';

// Client-side auth service
export {
  authService,
  type AuthUser,
  type AuthTokens,
  type AuthSession as ClientAuthSession,
  type LoginResponse,
  type MFARequiredResponse,
  type RegisterResponse,
  type LogoutResponse,
  type RefreshTokenResponse,
  type UserRole,
  type UserStatus,
  type VerificationLevel,
} from './auth-service';

// Auth provider and context
export { AuthProvider, useAuthContext, type AuthContextValue } from './auth-provider';
