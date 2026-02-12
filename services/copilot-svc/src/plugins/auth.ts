/**
 * @module @skillancer/copilot-svc/plugins/auth
 * JWT authentication plugin for Copilot service
 *
 * Provides secure JWT verification for AI endpoints to prevent unauthorized access
 * and expensive AI call abuse.
 */

import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

/**
 * JWT payload structure matching other Skillancer services
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
  userId: string;
  tenantId?: string;
  email: string;
  role: string;
  sessionId: string;
  verificationLevel: 'NONE' | 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM';
}

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

// =============================================================================
// PLUGIN IMPLEMENTATION
// =============================================================================

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    app.log.error('JWT_SECRET not configured - AI endpoints will be unprotected!');

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

    return;
  }

  // Register JWT plugin
  await app.register(jwt as any, {
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
        await (request as any).jwtVerify();
        request.log.debug(
          { userId: (request as any).user?.userId, path: request.url },
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
        await (request as any).jwtVerify();
        request.log.debug(
          { userId: (request as any).user?.userId, path: request.url },
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

  app.log.info('JWT authentication plugin registered successfully');
}

// =============================================================================
// EXPORTS
// =============================================================================

export const authPlugin = fp(authPluginImpl as any, {
  name: 'copilot-auth-plugin',
});

/**
 * Pre-handler for required authentication
 * Use this in route preHandler arrays
 *
 * @example
 * fastify.post('/generate', { preHandler: [requireAuth] }, handler)
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await request.server.authenticate(request, reply);
}

/**
 * Pre-handler for optional authentication
 * Use when endpoint should work with or without auth
 *
 * @example
 * fastify.get('/market/insights', { preHandler: [optionalAuth] }, handler)
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await request.server.optionalAuth(request, reply);
}
