/**
 * @module @skillancer/auth-svc/middleware/auth
 * Authentication middleware for protecting routes
 */

import { UnauthorizedError } from '../errors/index.js';
import { getTokenService } from '../services/token.service.js';

import type { FastifyReply, FastifyRequest } from 'fastify';

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
