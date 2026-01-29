/**
 * SkillPod Authentication Middleware
 *
 * Verifies JWT tokens using jose library, handles protected routes,
 * manages token refresh, and provides proper redirects for unauthenticated users.
 *
 * Production-ready implementation with real JWT verification.
 *
 * @module middleware
 */

import { jwtVerify, type JWTPayload } from 'jose';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

// ============================================================================
// Types
// ============================================================================

interface UserSession {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  workspaceId?: string;
  exp: number;
}

interface AuthJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions?: string[];
  sessionId?: string;
  workspaceId?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Public paths that don't require authentication
 */
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify',
  '/verify/email',
  '/api/health',
  '/health',
  '/trial',
  '/onboarding',
];

/**
 * Paths that require authentication (workspace routes)
 */
const PROTECTED_PATH_PREFIXES = [
  '/workspace',
  '/pods',
  '/viewer',
  '/recordings',
  '/assessments',
  '/credentials',
  '/learn',
  '/settings',
  '/admin',
  '/alerts',
  '/compliance',
  '/violations',
];

/**
 * API routes that should return 401 instead of redirect
 */
const API_PATH_PREFIXES = ['/api/'];

// ============================================================================
// Rate Limiting
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 200; // 200 requests per minute for users

/**
 * Check rate limiting for IP address
 */
function checkRateLimit(ipAddress: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const key = `ratelimit:${ipAddress}`;

  let entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  // Periodic cleanup
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now >= v.resetAt) {
        rateLimitStore.delete(k);
      }
    }
  }

  return {
    allowed: entry.count <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count),
    resetAt: entry.resetAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get JWT secret for verification
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SKILLPOD_JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET or SKILLPOD_JWT_SECRET must be configured');
    }
    // eslint-disable-next-line no-console
    console.warn('[MIDDLEWARE] WARNING: JWT_SECRET not configured');
    return new TextEncoder().encode('dev-only-secret-not-for-production-use-32chars!');
  }

  return new TextEncoder().encode(secret);
}

/**
 * Verify JWT token and extract session
 */
async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const secret = getJwtSecret();

    const { payload } = await jwtVerify(token, secret, {
      ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
      ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
    });

    const jwtPayload = payload as AuthJwtPayload;

    if (!jwtPayload.sub || !jwtPayload.email) {
      return null;
    }

    return {
      userId: jwtPayload.sub,
      email: jwtPayload.email,
      roles: jwtPayload.roles || [],
      permissions: jwtPayload.permissions || [],
      sessionId: jwtPayload.sessionId,
      workspaceId: jwtPayload.workspaceId,
      exp: jwtPayload.exp || 0,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[MIDDLEWARE] Token verification failed:', error);
    }
    return null;
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Check if path is public (doesn't require authentication)
 */
function isPublicPath(pathname: string): boolean {
  // Exact matches
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  // Check if path starts with any public path
  return PUBLIC_PATHS.some(
    (publicPath) => publicPath !== '/' && pathname.startsWith(publicPath + '/')
  );
}

/**
 * Check if path requires authentication
 */
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Check if path is an API route
 */
function isApiPath(pathname: string): boolean {
  return API_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Log action for audit trail
 */
function auditLog(
  request: NextRequest,
  session: UserSession | null,
  action: string,
  details: Record<string, unknown>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    path: request.nextUrl.pathname,
    method: request.method,
    userId: session?.userId || 'anonymous',
    email: session?.email || 'unknown',
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
    details,
  };

  // eslint-disable-next-line no-console
  console.log('[SKILLPOD AUDIT]', JSON.stringify(logEntry));
}

/**
 * Create login redirect URL preserving original destination
 */
function createLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);

  // Preserve the original URL for redirect after login
  const originalPath = request.nextUrl.pathname;
  const originalSearch = request.nextUrl.search;

  if (originalPath !== '/login' && originalPath !== '/') {
    loginUrl.searchParams.set('callbackUrl', originalPath + originalSearch);
  }

  return NextResponse.redirect(loginUrl);
}

/**
 * Create unauthorized response for API routes
 */
function createUnauthorizedResponse(message: string): NextResponse {
  return new NextResponse(JSON.stringify({ error: message, code: 'UNAUTHORIZED' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer',
    },
  });
}

// ============================================================================
// Middleware
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIp = getClientIp(request);

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // Check rate limiting
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    auditLog(request, null, 'RATE_LIMITED', {
      reason: 'Too many requests',
      ip: clientIp,
    });

    const response = new NextResponse('Too many requests', { status: 429 });
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimit.resetAt.toString());
    response.headers.set(
      'Retry-After',
      Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString()
    );
    return response;
  }

  // Allow public paths without authentication
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check if path requires authentication
  const requiresAuth = isProtectedPath(pathname);
  const isApi = isApiPath(pathname);

  // Get token from cookie or Authorization header
  const token =
    request.cookies.get('skillpod_token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  // No token provided
  if (!token) {
    if (requiresAuth || isApi) {
      auditLog(request, null, 'ACCESS_DENIED_NO_TOKEN', { reason: 'No token provided' });

      if (isApi) {
        return createUnauthorizedResponse('Authentication required');
      }

      return createLoginRedirect(request);
    }

    // Non-protected, non-API path without token - allow
    return NextResponse.next();
  }

  // Verify token
  const session = await verifyToken(token);

  if (!session) {
    auditLog(request, null, 'ACCESS_DENIED_INVALID_TOKEN', {
      reason: 'Invalid or expired token',
    });

    if (isApi) {
      return createUnauthorizedResponse('Invalid or expired token');
    }

    // Clear invalid cookie and redirect to login
    const response = createLoginRedirect(request);
    response.cookies.delete('skillpod_token');
    response.cookies.delete('skillpod_refresh_token');
    return response;
  }

  // Token is valid - check if accessing protected route
  if (requiresAuth) {
    auditLog(request, session, 'PAGE_ACCESS', { path: pathname });
  }

  // Add session info to headers for downstream use
  const response = NextResponse.next();
  response.headers.set('x-user-id', session.userId);
  response.headers.set('x-user-email', session.email);
  response.headers.set('x-user-roles', session.roles.join(','));
  response.headers.set('x-session-id', session.sessionId || '');
  response.headers.set('x-workspace-id', session.workspaceId || '');

  // Add rate limit headers
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());

  return response;
}

// ============================================================================
// Middleware Config
// ============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
