/**
 * @skillancer/auth - Server Token Verification
 *
 * Server-side JWT verification using jose library.
 */

import { jwtVerify, type JWTPayload } from 'jose';
import type { JwtPayload, AuthUser } from '../types';

// =============================================================================
// Types
// =============================================================================

export interface VerifyTokenResult {
  success: boolean;
  payload: JwtPayload | null;
  error?: string;
  needsRefresh?: boolean;
}

export interface VerifyTokenOptions {
  /** JWT secret or public key */
  secret: string | Uint8Array;
  /** Token expiration buffer in seconds (default: 300) */
  refreshThreshold?: number;
  /** Issuer to validate (optional) */
  issuer?: string;
  /** Audience to validate (optional) */
  audience?: string;
}

// =============================================================================
// Verification Functions
// =============================================================================

/**
 * Verify a JWT token on the server
 */
export async function verifyToken(
  token: string,
  options: VerifyTokenOptions
): Promise<VerifyTokenResult> {
  try {
    const secret =
      typeof options.secret === 'string'
        ? new TextEncoder().encode(options.secret)
        : options.secret;

    const verifyOptions: Record<string, unknown> = {};
    if (options.issuer) {
      verifyOptions.issuer = options.issuer;
    }
    if (options.audience) {
      verifyOptions.audience = options.audience;
    }

    const { payload } = await jwtVerify(token, secret, verifyOptions);

    // Check if token needs refresh
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp || 0;
    const threshold = options.refreshThreshold || 300;
    const needsRefresh = exp - now <= threshold;

    return {
      success: true,
      payload: payload as unknown as JwtPayload,
      needsRefresh,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    return {
      success: false,
      payload: null,
      error: message,
    };
  }
}

/**
 * Extract user from verified token payload
 */
export function extractUserFromPayload(payload: JwtPayload): AuthUser {
  return {
    id: payload.sub,
    email: payload.email,
    firstName: payload.firstName || '',
    lastName: payload.lastName || '',
    role: payload.roles?.[0] || 'USER',
    roles: payload.roles || [],
    permissions: payload.permissions || [],
    emailVerified: payload.verificationLevel !== 'NONE',
    status: 'ACTIVE',
    verificationLevel: payload.verificationLevel,
  };
}

/**
 * Get JWT secret from environment variable
 */
export function getJwtSecret(envKey = 'JWT_SECRET'): Uint8Array {
  const secret = process.env[envKey];
  if (!secret) {
    throw new Error(`Environment variable ${envKey} is not set`);
  }
  return new TextEncoder().encode(secret);
}

/**
 * Check if payload has required roles
 */
export function payloadHasRole(payload: JwtPayload, role: string): boolean {
  return payload.roles?.includes(role) || false;
}

/**
 * Check if payload has any of the required roles
 */
export function payloadHasAnyRole(payload: JwtPayload, roles: string[]): boolean {
  if (!payload.roles) return false;
  return roles.some((r) => payload.roles.includes(r));
}

/**
 * Check if payload belongs to an admin
 */
export function isAdminPayload(payload: JwtPayload): boolean {
  const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'];
  return payloadHasAnyRole(payload, adminRoles);
}
