/**
 * @skillancer/auth - Token Validation
 *
 * Client-side token validation utilities.
 */

import type { JwtPayload } from '../types';

/**
 * Decode a JWT token without verification (client-side only)
 * For secure verification, use server-side utilities with jose
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = JSON.parse(
      typeof window !== 'undefined'
        ? atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        : Buffer.from(payload, 'base64').toString('utf-8')
    );

    return decoded as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string, bufferSeconds = 0): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.exp - bufferSeconds <= now;
}

/**
 * Get time until token expiration in seconds
 */
export function getTokenExpirationTime(token: string): number | null {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}

/**
 * Check if a token needs refresh (within threshold)
 */
export function shouldRefreshToken(token: string, thresholdSeconds = 300): boolean {
  const expiresIn = getTokenExpirationTime(token);
  if (expiresIn === null) {
    return true;
  }
  return expiresIn <= thresholdSeconds;
}

/**
 * Extract user info from token
 */
export function getUserFromToken(token: string): JwtPayload | null {
  return decodeToken(token);
}

/**
 * Check if token has specific role
 */
export function tokenHasRole(token: string, role: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.roles) {
    return false;
  }
  return payload.roles.includes(role);
}

/**
 * Check if token has any of the specified roles
 */
export function tokenHasAnyRole(token: string, roles: string[]): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.roles) {
    return false;
  }
  return roles.some((r) => payload.roles.includes(r));
}
