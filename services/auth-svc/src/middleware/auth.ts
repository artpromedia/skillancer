/**
 * @module @skillancer/auth-svc/middleware/auth
 * Authentication middleware for protecting routes
 */

import { UnauthorizedError, ForbiddenError } from '../errors/index.js';
import { getTokenService } from '../services/token.service.js';

import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Authenticated user data attached to request
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  sessionId: string;
  verificationLevel: string;
}

// Extend FastifyRequest to include user property
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Authentication middleware that verifies JWT token and attaches user to request
 *
 * @example
 * ```typescript
 * fastify.get('/protected', {
 *   preHandler: [authMiddleware],
 * }, async (request, reply) => {
 *   const userId = request.user!.id;
 *   // ...
 * });
 * ```
 */
export function authMiddleware(request: FastifyRequest, _reply: FastifyReply): void {
  const tokenService = getTokenService();
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Missing authorization header');
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new UnauthorizedError('Invalid authorization header format');
  }

  const payload = tokenService.verifyAccessToken(token);

  request.user = {
    id: payload.sub,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    roles: payload.roles,
    sessionId: payload.sessionId,
    verificationLevel: payload.verificationLevel,
  };
}

/**
 * Optional authentication middleware that sets user if token is valid but doesn't fail if missing
 *
 * @example
 * ```typescript
 * fastify.get('/optional-auth', {
 *   preHandler: [optionalAuthMiddleware],
 * }, async (request, reply) => {
 *   if (request.user) {
 *     // User is authenticated
 *   } else {
 *     // Anonymous access
 *   }
 * });
 * ```
 */
export function optionalAuthMiddleware(request: FastifyRequest, _reply: FastifyReply): void {
  const tokenService = getTokenService();
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return;
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return;
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    request.user = {
      id: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: payload.roles,
      sessionId: payload.sessionId,
      verificationLevel: payload.verificationLevel,
    };
  } catch {
    // Token invalid, but that's okay for optional auth
  }
}

/**
 * Role-based access control middleware factory
 * Creates middleware that checks if user has any of the required roles
 *
 * @param allowedRoles - Array of roles that are allowed access
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * fastify.get('/admin/users', {
 *   preHandler: [authMiddleware, requireRole(['admin'])],
 * }, async (request, reply) => {
 *   // Only admin users can access
 * });
 *
 * // Multiple roles
 * fastify.get('/compliance/reports', {
 *   preHandler: [authMiddleware, requireRole(['admin', 'compliance'])],
 * }, async (request, reply) => {
 *   // Admin or compliance officers can access
 * });
 * ```
 */
export function requireRole(allowedRoles: string[]): preHandlerHookHandler {
  return (request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void) => {
    const user = request.user;

    if (!user) {
      done(new UnauthorizedError('Authentication required'));
      return;
    }

    const hasRole = user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      done(new ForbiddenError(`Required role: ${allowedRoles.join(' or ')}`));
      return;
    }

    done();
  };
}

/**
 * Verification level middleware factory
 * Creates middleware that checks if user has required verification level
 *
 * @param requiredLevel - Minimum verification level required
 * @returns Middleware function
 */
export function requireVerificationLevel(
  requiredLevel: 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM'
): preHandlerHookHandler {
  const levelOrder = ['NONE', 'EMAIL', 'BASIC', 'ENHANCED', 'PREMIUM'];

  return (request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void) => {
    const user = request.user;

    if (!user) {
      done(new UnauthorizedError('Authentication required'));
      return;
    }

    const userLevelIndex = levelOrder.indexOf(user.verificationLevel);
    const requiredLevelIndex = levelOrder.indexOf(requiredLevel);

    if (userLevelIndex < requiredLevelIndex) {
      done(new ForbiddenError(`Verification level ${requiredLevel} required`));
      return;
    }

    done();
  };
}

/**
 * Admin middleware that checks if user has admin role
 *
 * @example
 * ```typescript
 * fastify.get('/admin/users', {
 *   preHandler: [authMiddleware, adminMiddleware],
 * }, async (request, reply) => {
 *   // Only admin users can access
 * });
 * ```
 */
export function adminMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: (err?: Error) => void
): void {
  const user = request.user;

  if (!user) {
    done(new UnauthorizedError('Authentication required'));
    return;
  }

  const isAdmin = user.roles.includes('admin') || user.roles.includes('superadmin');

  if (!isAdmin) {
    done(new ForbiddenError('Admin access required'));
    return;
  }

  done();
}
