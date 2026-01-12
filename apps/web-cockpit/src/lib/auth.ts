/**
 * @module @skillancer/web-cockpit/lib/auth
 * Server-side authentication utilities for Next.js App Router
 */

import { cookies } from 'next/headers';

// =============================================================================
// Types
// =============================================================================

export interface AuthSession {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  tenantId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const AUTH_COOKIE_NAME = 'skillancer_auth_token';
const SESSION_COOKIE_NAME = 'skillancer_session';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Decode JWT token (without verification - use only for reading claims)
 * In production, this should verify the signature with the JWT secret
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf-8');

    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Validate token expiration
 */
function isTokenExpired(payload: Record<string, unknown>): boolean {
  const exp = payload.exp as number | undefined;
  if (!exp) return true;
  return Date.now() >= exp * 1000;
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Get the authenticated session from cookies
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();

    const authToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const sessionData = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionData) {
      try {
        const session = JSON.parse(sessionData) as AuthSession;
        if (session.userId) {
          return session;
        }
      } catch {
        // Invalid session data, continue to try JWT
      }
    }

    if (authToken) {
      const payload = decodeJwtPayload(authToken);

      if (!payload) return null;
      if (isTokenExpired(payload)) return null;

      const session: AuthSession = {
        userId: (payload.sub as string) || (payload.userId as string) || '',
        email: (payload.email as string) || '',
        firstName: payload.firstName as string | undefined,
        lastName: payload.lastName as string | undefined,
        roles: payload.roles as string[] | undefined,
        tenantId: payload.tenantId as string | undefined,
      };

      if (!session.userId) return null;

      return session;
    }

    return null;
  } catch (error) {
    console.error('Error getting auth session:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getAuthSession();
  return session !== null;
}

/**
 * Get user ID from session, or null if not authenticated
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.userId || null;
}
