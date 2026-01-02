/**
 * Admin Authentication Middleware
 *
 * Verifies admin JWT tokens, checks permissions, audit logs actions,
 * and handles rate limiting and IP whitelisting.
 *
 * @module middleware
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

// ============================================================================
// Types
// ============================================================================

interface AdminSession {
  userId: string;
  email: string;
  role: AdminRole;
  permissions: string[];
  ipAddress: string;
  exp: number;
}

type AdminRole = 'super_admin' | 'operations' | 'moderator' | 'support' | 'finance' | 'analytics';

// ============================================================================
// Configuration
// ============================================================================

const PUBLIC_PATHS = ['/login', '/forgot-password', '/health'];

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ['*'],
  operations: ['users:*', 'disputes:*', 'contracts:*', 'support:*'],
  moderator: ['moderation:*', 'users:read'],
  support: ['users:read', 'support:*'],
  finance: ['payments:*', 'reports:financial'],
  analytics: ['reports:*', 'analytics:*'],
};

const PATH_PERMISSIONS: Record<string, string[]> = {
  '/users': ['users:read', 'users:*'],
  '/moderation': ['moderation:*'],
  '/disputes': ['disputes:*'],
  '/payments': ['payments:*'],
  '/reports': ['reports:*', 'analytics:*'],
  '/settings': ['settings:*'],
  '/skillpod': ['skillpod:*', 'operations:*'],
};

// ============================================================================
// Helper Functions
// ============================================================================

interface TokenPayload {
  sub: string;
  email: string;
  role: AdminRole;
  ip: string;
  exp: number;
}

/**
 * Verify JWT token and extract session
 * In production, use proper JWT verification with jose or similar
 */
function verifyAdminToken(token: string): AdminSession | null {
  try {
    // Mock verification - in production use proper JWT library
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadPart = parts[1];
    if (!payloadPart) return null;

    // Decode payload (in production, verify signature first!)
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64').toString()) as TokenPayload;

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: ROLE_PERMISSIONS[payload.role] || [],
      ipAddress: payload.ip,
      exp: payload.exp,
    };
  } catch {
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
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent'),
    details,
  };

  // In production, send to audit logging service
  // eslint-disable-next-line no-console
  console.log('[ADMIN AUDIT]', JSON.stringify(logEntry));
}

/**
 * Check rate limiting
 * In production, use Redis or similar for distributed rate limiting
 */
function checkRateLimit(_request: NextRequest): boolean {
  // Mock implementation - always allow
  // In production, implement proper rate limiting with Redis
  return true;
}

/**
 * Check IP whitelist
 */
function checkIpWhitelist(request: NextRequest): boolean {
  const whitelist = process.env.ADMIN_IP_WHITELIST;

  // If no whitelist configured, allow all
  if (!whitelist) {
    return true;
  }

  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip');

  if (!clientIp) {
    return false;
  }

  const allowedIps = whitelist.split(',').map((ip) => ip.trim());

  // Simple exact match - in production, handle CIDR notation
  return allowedIps.includes(clientIp);
}

// ============================================================================
// Middleware
// ============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static files and API routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Check IP whitelist (if configured)
  if (!checkIpWhitelist(request)) {
    auditLog(request, null, 'ACCESS_DENIED_IP', { reason: 'IP not whitelisted' });
    return new NextResponse('Access denied', { status: 403 });
  }

  // Check rate limiting
  if (!checkRateLimit(request)) {
    auditLog(request, null, 'RATE_LIMITED', { reason: 'Too many requests' });
    return new NextResponse('Too many requests', { status: 429 });
  }

  // Get admin token from cookie or header
  const token =
    request.cookies.get('admin_token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    auditLog(request, null, 'ACCESS_DENIED_NO_TOKEN', { reason: 'No token provided' });
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify token
  const session = verifyAdminToken(token);

  if (!session) {
    auditLog(request, null, 'ACCESS_DENIED_INVALID_TOKEN', {
      reason: 'Invalid or expired token',
    });
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check permissions
  if (!hasPermission(session, pathname)) {
    auditLog(request, session, 'ACCESS_DENIED_PERMISSION', {
      reason: 'Insufficient permissions',
      requiredPath: pathname,
    });
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Log successful access
  auditLog(request, session, 'PAGE_ACCESS', { path: pathname });

  // Add session info to headers for downstream use
  const response = NextResponse.next();
  response.headers.set('x-admin-user-id', session.userId);
  response.headers.set('x-admin-role', session.role);

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
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
