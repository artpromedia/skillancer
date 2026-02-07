/**
 * @module @skillancer/web-cockpit/lib/auth
 * Server-side authentication utilities for Cockpit application
 *
 * Provides real JWT verification using jose library for secure authentication.
 * Handles multi-tenant dashboard sessions for fractional executives.
 */

import { jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

// =============================================================================
// Types
// =============================================================================

/**
 * User session payload extracted from JWT
 */
export interface UserSession {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
  sessionId?: string;
  executiveId?: string;
  verificationLevel?: string;
  iat: number;
  exp: number;
}

/**
 * JWT payload structure from auth-svc
 */
interface AuthJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions?: string[];
  sessionId?: string;
  executiveId?: string;
  verificationLevel?: string;
  tenantId?: string;
}

/**
 * Result of token verification
 */
export interface VerifyTokenResult {
  success: boolean;
  session: UserSession | null;
  error?: string;
  needsRefresh?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

export const AUTH_COOKIE_NAME = 'cockpit_token';
export const REFRESH_COOKIE_NAME = 'cockpit_refresh_token';
export const TENANT_COOKIE_NAME = 'cockpit_tenant';

/**
 * Token expiration threshold for refresh (5 minutes)
 */
const REFRESH_THRESHOLD_SECONDS = 300;

// =============================================================================
// Environment Helpers
// =============================================================================

/**
 * Get JWT secret from environment
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.COCKPIT_JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET or COCKPIT_JWT_SECRET must be configured');
    }
    // eslint-disable-next-line no-console
    console.warn('[AUTH] WARNING: JWT_SECRET not configured, using development fallback');
    return new TextEncoder().encode('dev-only-secret-not-for-production-use-32chars!');
  }

  return new TextEncoder().encode(secret);
}

/**
 * Get API URL for backend calls
 */
export function getApiUrl(): string {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

// =============================================================================
// JWT Verification
// =============================================================================

/**
 * Verify JWT token using jose library
 *
 * Performs cryptographic signature verification, expiration check,
 * and validates required claims.
 */
export async function verifyToken(token: string): Promise<VerifyTokenResult> {
  if (!token) {
    return { success: false, session: null, error: 'No token provided' };
  }

  try {
    const secret = getJwtSecret();

    const { payload } = await jwtVerify(token, secret, {
      ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
      ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
    });

    const jwtPayload = payload as AuthJwtPayload;

    if (!jwtPayload.sub || !jwtPayload.email) {
      return {
        success: false,
        session: null,
        error: 'Invalid token payload: missing required fields',
      };
    }

    // Check if token needs refresh
    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = jwtPayload.exp ? jwtPayload.exp - now < REFRESH_THRESHOLD_SECONDS : false;

    const session: UserSession = {
      userId: jwtPayload.sub,
      email: jwtPayload.email,
      firstName: jwtPayload.firstName,
      lastName: jwtPayload.lastName,
      roles: jwtPayload.roles || [],
      permissions: jwtPayload.permissions || [],
      tenantId: jwtPayload.tenantId,
      sessionId: jwtPayload.sessionId,
      executiveId: jwtPayload.executiveId,
      verificationLevel: jwtPayload.verificationLevel,
      iat: jwtPayload.iat || 0,
      exp: jwtPayload.exp || 0,
    };

    return { success: true, session, needsRefresh };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'JWTExpired' || error.message.includes('expired')) {
        return { success: false, session: null, error: 'Token expired', needsRefresh: true };
      }
      if (error.name === 'JWTClaimValidationFailed') {
        return { success: false, session: null, error: 'Token validation failed' };
      }
      if (error.name === 'JWSSignatureVerificationFailed') {
        return { success: false, session: null, error: 'Invalid token signature' };
      }
      return {
        success: false,
        session: null,
        error: `Token verification failed: ${error.message}`,
      };
    }

    return { success: false, session: null, error: 'Unknown token verification error' };
  }
}

// =============================================================================
// Session Helpers
// =============================================================================

/**
 * Get user session from cookies (for server components)
 *
 * @example
 * ```typescript
 * const session = await getServerSession();
 * if (!session) {
 *   redirect('/login');
 * }
 * ```
 */
export async function getServerSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const result = await verifyToken(token);

    if (!result.success || !result.session) {
      return null;
    }

    return result.session;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AUTH] Error getting server session:', error);
    return null;
  }
}

/**
 * Legacy alias for getServerSession (backwards compatibility)
 */
export async function getAuthSession(): Promise<UserSession | null> {
  return getServerSession();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return session !== null;
}

/**
 * Get user ID from session
 */
export async function getUserId(): Promise<string | null> {
  const session = await getServerSession();
  return session?.userId || null;
}

/**
 * Legacy alias for getUserId (backwards compatibility)
 */
export async function getAuthUserId(): Promise<string | null> {
  return getUserId();
}

/**
 * Get current tenant ID from session or cookie
 */
export async function getTenantId(): Promise<string | null> {
  const cookieStore = await cookies();

  const session = await getServerSession();
  if (session?.tenantId) {
    return session.tenantId;
  }

  return cookieStore.get(TENANT_COOKIE_NAME)?.value || null;
}

// =============================================================================
// Permission Helpers
// =============================================================================

/**
 * Check if user has specific permission
 */
export function hasPermission(session: UserSession, permission: string): boolean {
  if (session.permissions.includes('*')) {
    return true;
  }

  if (session.permissions.includes(permission)) {
    return true;
  }

  const [resource] = permission.split(':');
  if (resource && session.permissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

/**
 * Check if user has specific role
 */
export function hasRole(session: UserSession, role: string | string[]): boolean {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some((r) => session.roles.includes(r) || session.roles.includes(r.toLowerCase()));
}

/**
 * Check if user is an executive
 */
export function isExecutive(session: UserSession): boolean {
  return hasRole(session, ['executive', 'fractional_executive', 'cfo', 'cmo', 'cto', 'coo']);
}

// =============================================================================
// Token Utilities
// =============================================================================

/**
 * Get remaining time until token expires
 */
export function getTokenTimeRemaining(session: UserSession): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = session.exp - now;
  return Math.max(0, remaining);
}

/**
 * Check if token is about to expire
 */
export function isTokenExpiringSoon(session: UserSession, thresholdSeconds = 300): boolean {
  return getTokenTimeRemaining(session) < thresholdSeconds;
}

// =============================================================================
// Audit Logging
// =============================================================================

export interface AuditLogEntry {
  timestamp: string;
  action: string;
  path: string;
  method: string;
  userId: string;
  email: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string | null;
  details: Record<string, unknown>;
}

/**
 * Create audit log entry
 */
export function createAuditLog(
  session: UserSession | null,
  action: string,
  path: string,
  method: string,
  ipAddress: string,
  userAgent: string | null,
  details: Record<string, unknown> = {}
): AuditLogEntry {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    action,
    path,
    method,
    userId: session?.userId || 'anonymous',
    email: session?.email || 'unknown',
    tenantId: session?.tenantId || 'unknown',
    ipAddress,
    userAgent,
    details,
  };

  // eslint-disable-next-line no-console
  console.log('[COCKPIT AUDIT]', JSON.stringify(entry));

  return entry;
}
