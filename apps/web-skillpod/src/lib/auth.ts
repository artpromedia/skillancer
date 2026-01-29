/**
 * @module @skillancer/web-skillpod/lib/auth
 * Server-side authentication utilities for SkillPod application
 *
 * Provides real JWT verification using jose library for secure authentication.
 * Handles session management, token refresh, and workspace session persistence.
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
  workspaceId?: string;
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
  workspaceId?: string;
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

/**
 * Token refresh result
 */
export interface RefreshTokenResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

export const AUTH_COOKIE_NAME = 'skillpod_token';
export const REFRESH_COOKIE_NAME = 'skillpod_refresh_token';
export const WORKSPACE_COOKIE_NAME = 'skillpod_workspace';

/**
 * Token expiration threshold for refresh (5 minutes)
 */
const REFRESH_THRESHOLD_SECONDS = 300;

// =============================================================================
// Environment Validation
// =============================================================================

/**
 * Get JWT secret from environment
 * Throws if not configured in production
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SKILLPOD_JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET or SKILLPOD_JWT_SECRET must be configured');
    }
    // Development fallback - NOT for production
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

/**
 * Get auth service URL
 */
export function getAuthServiceUrl(): string {
  return process.env.AUTH_SERVICE_URL || `${getApiUrl()}/auth`;
}

// =============================================================================
// JWT Verification
// =============================================================================

/**
 * Verify JWT token using jose library
 *
 * Performs cryptographic signature verification, expiration check,
 * and validates required claims.
 *
 * @param token - JWT token string
 * @returns Verification result with session or error
 */
export async function verifyToken(token: string): Promise<VerifyTokenResult> {
  if (!token) {
    return { success: false, session: null, error: 'No token provided' };
  }

  try {
    const secret = getJwtSecret();

    // Verify JWT signature and decode payload
    const { payload } = await jwtVerify(token, secret, {
      ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
      ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
    });

    const jwtPayload = payload as AuthJwtPayload;

    // Validate required fields
    if (!jwtPayload.sub || !jwtPayload.email) {
      return {
        success: false,
        session: null,
        error: 'Invalid token payload: missing required fields',
      };
    }

    // Check if token needs refresh (within threshold of expiration)
    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = jwtPayload.exp ? jwtPayload.exp - now < REFRESH_THRESHOLD_SECONDS : false;

    // Build session object
    const session: UserSession = {
      userId: jwtPayload.sub,
      email: jwtPayload.email,
      firstName: jwtPayload.firstName,
      lastName: jwtPayload.lastName,
      roles: jwtPayload.roles || [],
      permissions: jwtPayload.permissions || [],
      tenantId: jwtPayload.tenantId,
      sessionId: jwtPayload.sessionId,
      workspaceId: jwtPayload.workspaceId,
      verificationLevel: jwtPayload.verificationLevel,
      iat: jwtPayload.iat || 0,
      exp: jwtPayload.exp || 0,
    };

    return { success: true, session, needsRefresh };
  } catch (error) {
    // Handle specific JWT errors
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
// Token Refresh
// =============================================================================

/**
 * Attempt to refresh the access token using refresh token
 *
 * @param refreshToken - Refresh token string
 * @returns New access token or error
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshTokenResult> {
  if (!refreshToken) {
    return { success: false, error: 'No refresh token provided' };
  }

  try {
    const authUrl = getAuthServiceUrl();
    const response = await fetch(`${authUrl}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return { success: false, error: 'Token refresh failed' };
    }

    const data = (await response.json()) as { accessToken?: string };

    if (!data.accessToken) {
      return { success: false, error: 'No access token in response' };
    }

    return { success: true, accessToken: data.accessToken };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh error',
    };
  }
}

// =============================================================================
// Session Helpers
// =============================================================================

/**
 * Get user session from cookies (for server components)
 *
 * Use in server components and route handlers to check authentication.
 * Returns null if not authenticated or token is invalid.
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

    // Get token from cookie
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    // Verify token
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
 * Get workspace ID from session or cookie
 */
export async function getWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();

  // First check session
  const session = await getServerSession();
  if (session?.workspaceId) {
    return session.workspaceId;
  }

  // Fall back to workspace cookie
  return cookieStore.get(WORKSPACE_COOKIE_NAME)?.value || null;
}

// =============================================================================
// Permission Helpers
// =============================================================================

/**
 * Check if user has specific permission
 */
export function hasPermission(session: UserSession, permission: string): boolean {
  // Check for wildcard permission
  if (session.permissions.includes('*')) {
    return true;
  }

  // Check exact match
  if (session.permissions.includes(permission)) {
    return true;
  }

  // Check wildcard permissions (e.g., "pods:*" matches "pods:read")
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
 * Check if user can access workspace features
 */
export function canAccessWorkspace(session: UserSession): boolean {
  // Users with any of these roles can access workspace
  const workspaceRoles = ['user', 'talent', 'freelancer', 'client', 'admin', 'ADMIN'];
  return workspaceRoles.some((role) => session.roles.includes(role));
}

// =============================================================================
// Token Utilities
// =============================================================================

/**
 * Extract token from Authorization header or cookies
 */
export function extractToken(
  authHeader: string | null,
  cookieToken: string | undefined
): string | null {
  // Check Authorization header first
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to cookie
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Get remaining time until token expires
 * Returns seconds until expiration, or 0 if expired
 */
export function getTokenTimeRemaining(session: UserSession): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = session.exp - now;
  return Math.max(0, remaining);
}

/**
 * Check if token is about to expire (within threshold)
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
  ipAddress: string;
  userAgent: string | null;
  details: Record<string, unknown>;
}

/**
 * Create audit log entry for user action
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
    ipAddress,
    userAgent,
    details,
  };

  // Log to console in structured format
  // In production, send to audit logging service
  // eslint-disable-next-line no-console
  console.log('[SKILLPOD AUDIT]', JSON.stringify(entry));

  return entry;
}
