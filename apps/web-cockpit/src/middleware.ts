/**
 * Cockpit Authentication Middleware
 *
 * Verifies JWT tokens using jose library, handles protected routes,
 * and manages multi-tenant dashboard sessions for fractional executives.
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
  tenantId?: string;
  executiveId?: string;
  exp: number;
}

interface AuthJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions?: string[];
  sessionId?: string;
  tenantId?: string;
  executiveId?: string;
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
  '/api/health',
  '/health',
  '/onboarding',
];

/**
 * Protected dashboard paths requiring authentication
 */
const PROTECTED_PATH_PREFIXES = [
  '/dashboard',
  '/projects',
  '/clients',
  '/invoices',
  '/finances',
  '/expenses',
  '/taxes',
  '/time',
  '/executives',
  '/settings',
  '/integrations',
  '/bank-accounts',
  '/ai',
];

/**
 * API routes that should return 401 instead of redirect
 */
const API_PATH_PREFIXES = ['/api/'];

// ============================================================================
// Rate Limiting
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 200;

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

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.COCKPIT_JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET or COCKPIT_JWT_SECRET must be configured');
    }
    // eslint-disable-next-line no-console
    console.warn('[MIDDLEWARE] WARNING: JWT_SECRET not configured');
    return new TextEncoder().encode('dev-only-secret-not-for-production-use-32chars!');
  }

  return new TextEncoder().encode(secret);
}

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
      tenantId: jwtPayload.tenantId,
      executiveId: jwtPayload.executiveId,
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

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  return PUBLIC_PATHS.some(
    (publicPath) => publicPath !== '/' && pathname.startsWith(publicPath + '/')
  );
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string): boolean {
  return API_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

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
    tenantId: session?.tenantId || 'unknown',
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
    details,
  };

  // eslint-disable-next-line no-console
  console.log('[COCKPIT AUDIT]', JSON.stringify(logEntry));
}

function createLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);

  const originalPath = request.nextUrl.pathname;
  const originalSearch = request.nextUrl.search;

  if (originalPath !== '/login' && originalPath !== '/') {
    loginUrl.searchParams.set('callbackUrl', originalPath + originalSearch);
  }

  return NextResponse.redirect(loginUrl);
}

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

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const requiresAuth = isProtectedPath(pathname);
  const isApi = isApiPath(pathname);

  // Get token from cookie or Authorization header
  const token =
    request.cookies.get('cockpit_token')?.value ||
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

    // Clear invalid cookies and redirect
    const response = createLoginRedirect(request);
    response.cookies.delete('cockpit_token');
    response.cookies.delete('cockpit_refresh_token');
    return response;
  }

  // Log protected access
  if (requiresAuth) {
    auditLog(request, session, 'PAGE_ACCESS', { path: pathname });
  }

  // Add session info to headers
  const response = NextResponse.next();
  response.headers.set('x-user-id', session.userId);
  response.headers.set('x-user-email', session.email);
  response.headers.set('x-user-roles', session.roles.join(','));
  response.headers.set('x-session-id', session.sessionId || '');
  response.headers.set('x-tenant-id', session.tenantId || '');
  response.headers.set('x-executive-id', session.executiveId || '');

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
