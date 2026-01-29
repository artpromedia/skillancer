/**
 * @module @skillancer/admin/lib/auth
 * Server-side authentication utilities for Admin Panel
 *
 * Provides real JWT verification using jose library for secure admin authentication.
 * No mock code - production-ready implementation.
 */

import { jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

// =============================================================================
// Types
// =============================================================================

/**
 * Admin roles with their permission levels
 */
export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'super_admin'
  | 'admin'
  | 'operations'
  | 'moderator'
  | 'support'
  | 'finance'
  | 'analytics';

/**
 * Admin session payload extracted from JWT
 */
export interface AdminSession {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: AdminRole;
  roles: string[];
  permissions: string[];
  tenantId?: string;
  sessionId?: string;
  verificationLevel?: string;
  iat: number;
  exp: number;
}

/**
 * JWT payload structure from auth-svc
 */
interface AdminJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  sessionId?: string;
  verificationLevel?: string;
  tenantId?: string;
}

/**
 * Result of token verification
 */
export interface VerifyTokenResult {
  success: boolean;
  session: AdminSession | null;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const AUTH_COOKIE_NAME = 'admin_token';

/**
 * Roles that are allowed to access the admin panel
 */
const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'super_admin',
  'admin',
  'operations',
  'moderator',
  'support',
  'finance',
  'analytics',
  'platform_admin',
  'security_admin',
];

/**
 * Role-based permissions mapping
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  super_admin: ['*'],
  ADMIN: ['*'],
  admin: ['*'],
  platform_admin: ['*'],
  security_admin: ['*', 'security:*'],
  operations: ['users:*', 'disputes:*', 'contracts:*', 'support:*'],
  moderator: ['moderation:*', 'users:read'],
  support: ['users:read', 'support:*'],
  finance: ['payments:*', 'reports:financial'],
  analytics: ['reports:*', 'analytics:*'],
};

// =============================================================================
// Environment Validation
// =============================================================================

/**
 * Get JWT secret from environment
 * Throws if not configured in production
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    // In production, this is a critical error
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET or ADMIN_JWT_SECRET must be configured');
    }
    // In development, use a warning and a default (NOT for production use)
    console.warn('[AUTH] WARNING: JWT_SECRET not configured, using development fallback');
    return new TextEncoder().encode('dev-only-secret-not-for-production-use-32chars!');
  }

  return new TextEncoder().encode(secret);
}

/**
 * Get API URL for backend verification
 */
export function getApiUrl(): string {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
}

// =============================================================================
// JWT Verification
// =============================================================================

/**
 * Verify admin JWT token using jose library
 *
 * Performs cryptographic signature verification, expiration check,
 * and role validation.
 *
 * @param token - JWT token string
 * @returns Verification result with session or error
 */
export async function verifyAdminToken(token: string): Promise<VerifyTokenResult> {
  if (!token) {
    return { success: false, session: null, error: 'No token provided' };
  }

  try {
    const secret = getJwtSecret();

    // Verify JWT signature and decode payload
    const { payload } = await jwtVerify(token, secret, {
      // Optional: Add issuer/audience validation if configured
      ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
      ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
    });

    const jwtPayload = payload as AdminJwtPayload;

    // Validate required fields
    if (!jwtPayload.sub || !jwtPayload.email) {
      return {
        success: false,
        session: null,
        error: 'Invalid token payload: missing required fields',
      };
    }

    // Check if user has admin role
    const roles = jwtPayload.roles || [];
    const adminRole = roles.find((role) => ADMIN_ROLES.includes(role));

    if (!adminRole) {
      return {
        success: false,
        session: null,
        error: 'Access denied: Admin role required',
      };
    }

    // Build session object
    const session: AdminSession = {
      userId: jwtPayload.sub,
      email: jwtPayload.email,
      firstName: jwtPayload.firstName,
      lastName: jwtPayload.lastName,
      role: adminRole as AdminRole,
      roles: roles,
      permissions: ROLE_PERMISSIONS[adminRole] || [],
      tenantId: jwtPayload.tenantId,
      sessionId: jwtPayload.sessionId,
      verificationLevel: jwtPayload.verificationLevel,
      iat: jwtPayload.iat || 0,
      exp: jwtPayload.exp || 0,
    };

    return { success: true, session };
  } catch (error) {
    // Handle specific JWT errors
    if (error instanceof Error) {
      if (error.name === 'JWTExpired' || error.message.includes('expired')) {
        return { success: false, session: null, error: 'Token expired' };
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
 * Get admin session from cookies
 *
 * Use in server components and route handlers to check authentication.
 * Returns null if not authenticated or token is invalid.
 *
 * @example
 * ```typescript
 * const session = await getAdminSession();
 * if (!session) {
 *   redirect('/login');
 * }
 * ```
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();

    // Get token from cookie
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    // Verify token
    const result = await verifyAdminToken(token);

    if (!result.success || !result.session) {
      return null;
    }

    return result.session;
  } catch (error) {
    console.error('[AUTH] Error getting admin session:', error);
    return null;
  }
}

/**
 * Check if user is authenticated as admin
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getAdminSession();
  return session !== null;
}

/**
 * Get admin user ID from session
 */
export async function getAdminUserId(): Promise<string | null> {
  const session = await getAdminSession();
  return session?.userId || null;
}

/**
 * Check if admin has specific permission
 */
export function hasPermission(session: AdminSession, permission: string): boolean {
  // Super admin has all permissions
  if (session.permissions.includes('*')) {
    return true;
  }

  // Check exact match
  if (session.permissions.includes(permission)) {
    return true;
  }

  // Check wildcard permissions (e.g., "users:*" matches "users:read")
  const [resource] = permission.split(':');
  if (resource && session.permissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

/**
 * Check if admin has permission for a specific path
 */
export function hasPathPermission(session: AdminSession, path: string): boolean {
  // Super admin has access to everything
  if (session.permissions.includes('*')) {
    return true;
  }

  // Path-based permission mapping
  const pathPermissions: Record<string, string[]> = {
    '/users': ['users:read', 'users:*'],
    '/moderation': ['moderation:*'],
    '/disputes': ['disputes:*'],
    '/payments': ['payments:*'],
    '/reports': ['reports:*', 'analytics:*'],
    '/settings': ['settings:*'],
    '/skillpod': ['skillpod:*', 'operations:*'],
    '/security': ['security:*'],
    '/audit': ['audit:*', 'security:*'],
  };

  // Check path-specific permissions
  for (const [pathPrefix, requiredPermissions] of Object.entries(pathPermissions)) {
    if (path.startsWith(pathPrefix)) {
      return requiredPermissions.some((perm) =>
        session.permissions.some(
          (userPerm) => userPerm === perm || userPerm === '*' || userPerm.endsWith(':*')
        )
      );
    }
  }

  // Default allow for unprotected paths
  return true;
}

/**
 * Validate that session belongs to a specific role
 */
export function isRole(session: AdminSession, role: AdminRole | AdminRole[]): boolean {
  const roles = Array.isArray(role) ? role : [role];
  return roles.some(
    (r) => session.role.toLowerCase() === r.toLowerCase() || session.roles.includes(r)
  );
}

/**
 * Check if session is a super admin
 */
export function isSuperAdmin(session: AdminSession): boolean {
  return isRole(session, ['SUPER_ADMIN', 'super_admin']);
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
  role: string;
  ipAddress: string;
  userAgent: string | null;
  details: Record<string, unknown>;
}

/**
 * Create audit log entry for admin action
 * In production, this should send to an audit logging service
 */
export function createAuditLog(
  session: AdminSession | null,
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
    role: session?.role || 'none',
    ipAddress,
    userAgent,
    details,
  };

  // Log to console in structured format
  // In production, send to audit logging service (e.g., Elasticsearch, CloudWatch)
  // eslint-disable-next-line no-console
  console.log('[ADMIN AUDIT]', JSON.stringify(entry));

  return entry;
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
export function getTokenTimeRemaining(session: AdminSession): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = session.exp - now;
  return remaining > 0 ? remaining : 0;
}

/**
 * Check if token is about to expire (within threshold)
 */
export function isTokenExpiringSoon(session: AdminSession, thresholdSeconds = 300): boolean {
  return getTokenTimeRemaining(session) < thresholdSeconds;
}
