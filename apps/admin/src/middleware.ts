/**
 * Admin Authentication Middleware
 *
 * Verifies admin JWT tokens using jose library, checks permissions,
 * audit logs actions, and handles rate limiting and IP whitelisting.
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

interface AdminSession {
  userId: string;
  email: string;
  role: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  exp: number;
}

interface AdminJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  sessionId?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const PUBLIC_PATHS = ['/login', '/forgot-password', '/health', '/api/health'];

/**
 * Roles allowed to access admin panel
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

/**
 * Path-based permission requirements
 */
const PATH_PERMISSIONS: Record<string, string[]> = {
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

// ============================================================================
// Rate Limiting (Redis-backed in production)
// ============================================================================

// In-memory rate limit store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

/**
 * Check rate limiting for IP address
 * In production, use Redis for distributed rate limiting
 */
function checkRateLimitImpl(ipAddress: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const key = `ratelimit:${ipAddress}`;

  let entry = rateLimitStore.get(key);

  // Initialize or reset if window expired
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, entry);
  }

  // Increment count
  entry.count++;

  // Clean up old entries periodically (every 100 requests)
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
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET or ADMIN_JWT_SECRET must be configured');
    }
    // Development fallback - NOT for production
    console.warn('[MIDDLEWARE] WARNING: JWT_SECRET not configured');
    return new TextEncoder().encode('dev-only-secret-not-for-production-use-32chars!');
  }

  return new TextEncoder().encode(secret);
}

/**
 * Verify JWT token and extract admin session
 * Uses jose library for cryptographic verification
 */
async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const secret = getJwtSecret();

    // Verify JWT signature and decode payload
    const { payload } = await jwtVerify(token, secret, {
      ...(process.env.JWT_ISSUER && { issuer: process.env.JWT_ISSUER }),
      ...(process.env.JWT_AUDIENCE && { audience: process.env.JWT_AUDIENCE }),
    });

    const jwtPayload = payload as AdminJwtPayload;

    // Validate required fields
    if (!jwtPayload.sub || !jwtPayload.email) {
      return null;
    }

    // Check for admin role
    const roles = jwtPayload.roles || [];
    const adminRole = roles.find((role) => ADMIN_ROLES.includes(role));

    if (!adminRole) {
      return null;
    }

    return {
      userId: jwtPayload.sub,
      email: jwtPayload.email,
      role: adminRole,
      roles: roles,
      permissions: ROLE_PERMISSIONS[adminRole] || [],
      sessionId: jwtPayload.sessionId,
      exp: jwtPayload.exp || 0,
    };
  } catch (error) {
    // Log error for debugging (not in production)
    if (process.env.NODE_ENV !== 'production') {
      console.error('[MIDDLEWARE] Token verification failed:', error);
    }
    return null;
  }
}

/**
 * Check if user has permission for the requested path
 */
function hasPermission(session: AdminSession, path: string): boolean {
  // Super admin has access to everything
  if (session.permissions.includes('*')) {
    return true;
  }

  // Check path-specific permissions
  for (const [pathPrefix, requiredPermissions] of Object.entries(PATH_PERMISSIONS)) {
    if (path.startsWith(pathPrefix)) {
      return requiredPermissions.some((perm) =>
        session.permissions.some((userPerm) => userPerm === perm || userPerm.endsWith(':*'))
      );
    }
  }

  // Default allow for unprotected paths
  return true;
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
 * Log admin action for audit trail
 */
function auditLog(
  request: NextRequest,
  session: AdminSession | null,
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
    role: session?.role || 'none',
    ipAddress: getClientIp(request),
    userAgent: request.headers.get('user-agent'),
    details,
  };

  // Log in structured format for audit trail
  // In production, send to audit logging service
  // eslint-disable-next-line no-console
  console.log('[ADMIN AUDIT]', JSON.stringify(logEntry));
}

/**
 * Check IP whitelist with CIDR support
 */
function checkIpWhitelist(request: NextRequest): boolean {
  const whitelist = process.env.ADMIN_IP_WHITELIST;

  // If no whitelist configured, allow all
  if (!whitelist) {
    return true;
  }

  const clientIp = getClientIp(request);

  if (clientIp === 'unknown') {
    return false;
  }

  const allowedIps = whitelist.split(',').map((ip) => ip.trim());

  // Check exact match and CIDR notation
  return allowedIps.some((allowed) => {
    // Exact match
    if (allowed === clientIp) return true;

    // CIDR notation support
    if (allowed.includes('/')) {
      const [network, prefixStr] = allowed.split('/');
      const prefix = Number.parseInt(prefixStr || '32', 10);

      if (network && !Number.isNaN(prefix)) {
        // Simple IPv4 CIDR check
        const ipParts = clientIp.split('.').map(Number);
        const networkParts = network.split('.').map(Number);

        if (
          ipParts.length === 4 &&
          networkParts.length === 4 &&
          ipParts.every((p) => !Number.isNaN(p)) &&
          networkParts.every((p) => !Number.isNaN(p))
        ) {
          const ipNum =
            ((ipParts[0] ?? 0) << 24) |
            ((ipParts[1] ?? 0) << 16) |
            ((ipParts[2] ?? 0) << 8) |
            (ipParts[3] ?? 0);
          const networkNum =
            ((networkParts[0] ?? 0) << 24) |
            ((networkParts[1] ?? 0) << 16) |
            ((networkParts[2] ?? 0) << 8) |
            (networkParts[3] ?? 0);
          const mask = ~((1 << (32 - prefix)) - 1);

          return (ipNum & mask) === (networkNum & mask);
        }
      }
    }

    return false;
  });
}

// ============================================================================
// Middleware
// ============================================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIp = getClientIp(request);

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check IP whitelist (if configured)
  if (!checkIpWhitelist(request)) {
    auditLog(request, null, 'ACCESS_DENIED_IP', { reason: 'IP not whitelisted', ip: clientIp });
    return new NextResponse('Access denied', { status: 403 });
  }

  // Check rate limiting
  const rateLimit = checkRateLimitImpl(clientIp);
  if (!rateLimit.allowed) {
    auditLog(request, null, 'RATE_LIMITED', {
      reason: 'Too many requests',
      ip: clientIp,
      remaining: rateLimit.remaining,
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

  // Get admin token from cookie or Authorization header
  const token =
    request.cookies.get('admin_token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    auditLog(request, null, 'ACCESS_DENIED_NO_TOKEN', { reason: 'No token provided' });
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token with real JWT verification
  const session = await verifyAdminToken(token);

  if (!session) {
    auditLog(request, null, 'ACCESS_DENIED_INVALID_TOKEN', {
      reason: 'Invalid or expired token',
    });

    // Clear invalid cookie
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('admin_token');
    return response;
  }

  // Check permissions for the requested path
  if (!hasPermission(session, pathname)) {
    auditLog(request, session, 'ACCESS_DENIED_PERMISSION', {
      reason: 'Insufficient permissions',
      requiredPath: pathname,
      userPermissions: session.permissions,
    });
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Log successful access
  auditLog(request, session, 'PAGE_ACCESS', { path: pathname });

  // Add session info to headers for downstream use
  const response = NextResponse.next();
  response.headers.set('x-admin-user-id', session.userId);
  response.headers.set('x-admin-email', session.email);
  response.headers.set('x-admin-role', session.role);
  response.headers.set('x-admin-session-id', session.sessionId || '');

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
