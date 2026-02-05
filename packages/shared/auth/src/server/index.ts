/**
 * @skillancer/shared-auth - Server-side Authentication Utilities
 * JWT verification, token validation, and server-side auth helpers
 */

import * as jose from 'jose';
import type { AuthUser, AdminUser, JwtPayload, AuthResult, TokenVerifyResult } from '../types';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAdminRole,
  getPermissionsForRole,
  getPermissionsForAdminRole,
  ADMIN_ROLES,
  type Permission,
} from '../permissions';

// =============================================================================
// Configuration
// =============================================================================

const JWT_SECRET = process.env.JWT_SECRET || process.env.DOPPLER_JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
      'Set JWT_SECRET or DOPPLER_JWT_SECRET before starting the application.'
  );
}
const JWT_ALGORITHM = 'HS256' as const;

// Cookie names
export const AUTH_COOKIE_NAME = 'skillancer_auth_token';
export const SESSION_COOKIE_NAME = 'skillancer_session';
export const REFRESH_COOKIE_NAME = 'skillancer_refresh_token';

// =============================================================================
// JWT Verification
// =============================================================================

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(token: string): Promise<TokenVerifyResult> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    });

    // Cast via unknown to avoid type overlap issues
    return {
      valid: true,
      payload: payload as unknown as JwtPayload,
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return { valid: false, error: 'Token expired' };
    }
    if (error instanceof jose.errors.JWTInvalid) {
      return { valid: false, error: 'Invalid token' };
    }
    if (error instanceof jose.errors.JWTClaimValidationFailed) {
      return { valid: false, error: 'Token claim validation failed' };
    }
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Decode a JWT token without verification (use with caution)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const payload = jose.decodeJwt(token);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Create a JWT token
 */
export async function createToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn: string = '7d'
): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new jose.SignJWT(payload as jose.JWTPayload)
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
  return token;
}

// =============================================================================
// User Authentication
// =============================================================================

/**
 * Authenticate a user from a token
 */
export async function authenticateToken(token: string): Promise<AuthResult> {
  const result = await verifyToken(token);

  if (!result.valid || !result.payload) {
    return { authenticated: false, error: result.error || 'Invalid token' };
  }

  const payload = result.payload;

  // Check if token is expired
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return { authenticated: false, error: 'Token expired' };
  }

  // Build user object
  const user: AuthUser = {
    id: payload.sub || payload.userId || '',
    email: payload.email || '',
    role: payload.role || 'USER',
    emailVerified: payload.emailVerified ?? false,
    permissions: payload.permissions || getPermissionsForRole(payload.role || 'USER'),
  };

  // Add optional name if present
  if (payload.name) {
    user.name = payload.name;
  }

  return { authenticated: true, user };
}

/**
 * Authenticate an admin user from a token
 */
export async function authenticateAdminToken(token: string): Promise<AuthResult> {
  const result = await verifyToken(token);

  if (!result.valid || !result.payload) {
    return { authenticated: false, error: result.error || 'Invalid token' };
  }

  const payload = result.payload;

  // Check if token is expired
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return { authenticated: false, error: 'Token expired' };
  }

  // Verify user has admin role
  const userRoles = payload.roles || (payload.adminRole ? [payload.adminRole] : []);
  const hasAdminAccess = userRoles.some((role: string) => isAdminRole(role));

  if (!hasAdminAccess) {
    return { authenticated: false, error: 'Insufficient permissions - admin access required' };
  }

  // Determine primary admin role
  const primaryAdminRole = userRoles.find((role: string) => isAdminRole(role)) || 'admin';

  // Get permissions for admin role
  const permissions = payload.permissions || getPermissionsForAdminRole(primaryAdminRole);

  // Build admin user object
  const user: AdminUser = {
    id: payload.sub || payload.userId || '',
    email: payload.email || '',
    role: payload.role || 'USER',
    emailVerified: payload.emailVerified ?? false,
    permissions,
    adminRole: primaryAdminRole,
    adminPermissions: permissions,
    isSuperAdmin: ['SUPER_ADMIN', 'super_admin'].includes(primaryAdminRole),
  };

  // Add optional name if present
  if (payload.name) {
    user.name = payload.name;
  }

  return { authenticated: true, user };
}

// =============================================================================
// Permission Verification
// =============================================================================

/**
 * Check if authenticated user has a specific permission
 */
export function checkPermission(user: AuthUser | AdminUser, permission: Permission): boolean {
  return hasPermission(user.permissions || [], permission);
}

/**
 * Check if authenticated user has all specified permissions
 */
export function checkAllPermissions(
  user: AuthUser | AdminUser,
  permissions: Permission[]
): boolean {
  return hasAllPermissions(user.permissions || [], permissions);
}

/**
 * Check if authenticated user has any of the specified permissions
 */
export function checkAnyPermission(user: AuthUser | AdminUser, permissions: Permission[]): boolean {
  return hasAnyPermission(user.permissions || [], permissions);
}

/**
 * Require a specific permission, throwing if not present
 */
export function requirePermission(user: AuthUser | AdminUser | null, permission: Permission): void {
  if (!user) {
    throw new Error('Authentication required');
  }
  if (!checkPermission(user, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Require all specified permissions, throwing if any missing
 */
export function requireAllPermissions(
  user: AuthUser | AdminUser | null,
  permissions: Permission[]
): void {
  if (!user) {
    throw new Error('Authentication required');
  }
  if (!checkAllPermissions(user, permissions)) {
    throw new Error(`Permissions denied: ${permissions.join(', ')}`);
  }
}

// =============================================================================
// Next.js Server Helpers
// =============================================================================

/**
 * Get auth token from cookies (Next.js server component)
 * Must be called in a server context
 */
export async function getAuthTokenFromCookies(): Promise<string | null> {
  // Dynamic import to work in both server and edge contexts
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token =
      cookieStore.get(AUTH_COOKIE_NAME)?.value ||
      cookieStore.get(SESSION_COOKIE_NAME)?.value ||
      null;
    return token;
  } catch {
    return null;
  }
}

/**
 * Get authenticated user from cookies (Next.js server component)
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) return null;

  const result = await authenticateToken(token);
  return result.authenticated && result.user ? result.user : null;
}

/**
 * Get authenticated admin user from cookies (Next.js server component)
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const token = await getAuthTokenFromCookies();
  if (!token) return null;

  const result = await authenticateAdminToken(token);
  return result.authenticated && result.user ? (result.user as AdminUser) : null;
}

/**
 * Check if user is authenticated (Next.js server component)
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getAuthUser();
  return user !== null;
}

/**
 * Check if user is an admin (Next.js server component)
 */
export async function isAuthenticatedAdmin(): Promise<boolean> {
  const user = await getAdminUser();
  return user !== null;
}

/**
 * Get auth user ID from cookies (Next.js server component)
 */
export async function getAuthUserId(): Promise<string | null> {
  const user = await getAuthUser();
  return user?.id || null;
}

// =============================================================================
// Express/Node.js Helpers
// =============================================================================

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Create authentication middleware for Express
 */
export function createAuthMiddleware(options: { requireAdmin?: boolean } = {}) {
  return async (
    req: { headers: { authorization?: string }; user?: AuthUser | AdminUser },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const authFn = options.requireAdmin ? authenticateAdminToken : authenticateToken;
    const result = await authFn(token);

    if (!result.authenticated || !result.user) {
      return res.status(401).json({ error: result.error || 'Authentication failed' });
    }

    req.user = result.user;
    next();
  };
}

/**
 * Create permission middleware for Express
 */
export function createPermissionMiddleware(requiredPermissions: Permission[]) {
  return async (
    req: { user?: AuthUser | AdminUser },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!checkAllPermissions(req.user, requiredPermissions)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// =============================================================================
// Re-exports
// =============================================================================

export {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAdminRole,
  getPermissionsForRole,
  getPermissionsForAdminRole,
  ADMIN_ROLES,
} from '../permissions';

export type { Permission } from '../permissions';
