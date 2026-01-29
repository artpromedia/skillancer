// @ts-nocheck
/**
 * @module @skillancer/skillpod-svc/plugins/auth
 * JWT authentication plugin for SkillPod VDI service
 *
 * Provides secure JWT verification for VDI endpoints, session management,
 * and admin operations.
 */

import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

/**
 * JWT payload structure matching Skillancer services
 */
export interface JwtPayload {
  userId: string;
  tenantId?: string;
  email: string;
  role: string;
  sessionId: string;
  verificationLevel: 'NONE' | 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM';
  iat?: number;
  exp?: number;
}

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
  id: string; // Alias for userId for compatibility
  userId: string;
  tenantId?: string;
  email: string;
  role: string;
  sessionId: string;
  verificationLevel: 'NONE' | 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM';
}

/**
 * Admin roles that can perform privileged VDI operations
 */
const ADMIN_ROLES = ['admin', 'super_admin', 'platform_admin', 'security_admin', 'vdi_admin'];

// =============================================================================
// TYPE AUGMENTATION
// =============================================================================

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthenticatedUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

// =============================================================================
// ERRORS
// =============================================================================

class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// =============================================================================
// PLUGIN IMPLEMENTATION
// =============================================================================

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    app.log.error('JWT_SECRET not configured - VDI endpoints will be unprotected!');

    // Register dummy decorators that reject all requests
    app.decorate(
      'authenticate',
      async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        reply.status(500).send({
          error: 'Service Unavailable',
          message: 'Authentication not configured',
        });
        throw new Error('Authentication not configured');
      }
    );

    app.decorate('optionalAuth', async (): Promise<void> => {
      // No-op when not configured
    });

    app.decorate(
      'requireAdmin',
      async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        reply.status(500).send({
          error: 'Service Unavailable',
          message: 'Authentication not configured',
        });
        throw new Error('Authentication not configured');
      }
    );

    return;
  }

  // Register JWT plugin
  await app.register(jwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    },
    verify: {
      maxAge: process.env.JWT_EXPIRES_IN || '1h',
    },
    // Transform decoded JWT into AuthenticatedUser
    formatUser: (payload): AuthenticatedUser => {
      const p = payload as JwtPayload;
      return {
        id: p.userId, // Alias for compatibility with existing code
        userId: p.userId,
        tenantId: p.tenantId,
        email: p.email,
        role: p.role,
        sessionId: p.sessionId,
        verificationLevel: p.verificationLevel || 'NONE',
      };
    },
  });

  /**
   * Required authentication decorator
   * Throws UnauthorizedError if token is missing or invalid
   */
  app.decorate(
    'authenticate',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        request.log.warn(
          { path: request.url, method: request.method },
          'Auth failed: Missing authorization header'
        );
        throw new UnauthorizedError('Missing authorization header');
      }

      if (!authHeader.startsWith('Bearer ')) {
        request.log.warn(
          { path: request.url, method: request.method },
          'Auth failed: Invalid authorization header format'
        );
        throw new UnauthorizedError('Invalid authorization header format');
      }

      try {
        await request.jwtVerify();
        request.log.debug(
          { userId: request.user?.userId, path: request.url },
          'User authenticated successfully'
        );
      } catch (err) {
        request.log.warn(
          { path: request.url, method: request.method, error: (err as Error).message },
          'Auth failed: Invalid or expired token'
        );
        throw new UnauthorizedError('Invalid or expired token');
      }
    }
  );

  /**
   * Optional authentication decorator
   * Sets user if valid token, but doesn't throw if missing/invalid
   */
  app.decorate(
    'optionalAuth',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const authHeader = request.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        // No token provided - continue without user
        return;
      }

      try {
        await request.jwtVerify();
        request.log.debug(
          { userId: request.user?.userId, path: request.url },
          'Optional auth: User authenticated'
        );
      } catch {
        // Invalid token in optional auth - log but continue
        request.log.debug(
          { path: request.url },
          'Optional auth: Invalid token provided, continuing without user'
        );
      }
    }
  );

  /**
   * Admin authentication decorator
   * Requires valid token AND admin role
   */
  app.decorate(
    'requireAdmin',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        request.log.warn(
          { path: request.url, method: request.method },
          'Admin auth failed: Missing authorization header'
        );
        throw new UnauthorizedError('Missing authorization header');
      }

      if (!authHeader.startsWith('Bearer ')) {
        request.log.warn(
          { path: request.url, method: request.method },
          'Admin auth failed: Invalid authorization header format'
        );
        throw new UnauthorizedError('Invalid authorization header format');
      }

      try {
        await request.jwtVerify();
      } catch (err) {
        request.log.warn(
          { path: request.url, method: request.method, error: (err as Error).message },
          'Admin auth failed: Invalid or expired token'
        );
        throw new UnauthorizedError('Invalid or expired token');
      }

      // Check admin role
      const user = request.user;
      if (!user || !ADMIN_ROLES.includes(user.role)) {
        request.log.warn(
          { userId: user?.userId, role: user?.role, path: request.url },
          'Admin auth failed: Insufficient privileges'
        );
        throw new ForbiddenError('Admin privileges required');
      }

      request.log.info(
        { userId: user.userId, role: user.role, path: request.url },
        'Admin authenticated successfully'
      );
    }
  );

  app.log.info('JWT authentication plugin registered successfully');
}

// =============================================================================
// EXPORTS
// =============================================================================

export const authPlugin = fp(authPluginImpl, {
  name: 'skillpod-auth-plugin',
});

/**
 * Pre-handler for required authentication
 * Use this in route preHandler arrays
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await request.server.authenticate(request, reply);
}

/**
 * Pre-handler for optional authentication
 * Use when endpoint should work with or without auth
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await request.server.optionalAuth(request, reply);
}

/**
 * Pre-handler for admin-only operations
 * Validates both authentication AND admin role
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await request.server.requireAdmin(request, reply);
}

/**
 * Helper to validate user owns a session
 * Use in routes to ensure users can only access their own sessions
 */
export function validateSessionOwnership(request: FastifyRequest, sessionUserId: string): void {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Admins can access any session
  if (ADMIN_ROLES.includes(user.role)) {
    return;
  }

  // Regular users can only access their own sessions
  if (user.userId !== sessionUserId) {
    request.log.warn(
      { userId: user.userId, sessionUserId, path: request.url },
      'Access denied: User does not own session'
    );
    throw new ForbiddenError('Access denied: You can only access your own sessions');
  }
}

/**
 * Helper to validate user belongs to tenant
 * Use in routes to ensure tenant isolation
 */
export function validateTenantAccess(request: FastifyRequest, tenantId: string): void {
  const user = request.user;
  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  // Admins can access any tenant
  if (ADMIN_ROLES.includes(user.role)) {
    return;
  }

  // Regular users can only access their own tenant
  if (user.tenantId && user.tenantId !== tenantId) {
    request.log.warn(
      {
        userId: user.userId,
        userTenantId: user.tenantId,
        requestedTenantId: tenantId,
        path: request.url,
      },
      'Access denied: User does not belong to tenant'
    );
    throw new ForbiddenError('Access denied: You can only access your own tenant resources');
  }
}
