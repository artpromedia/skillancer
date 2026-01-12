/**
 * @module @skillancer/cockpit-svc/plugins/auth
 * JWT authentication plugin for cockpit-svc
 *
 * Provides authentication middleware that protects all routes
 * except explicitly marked public routes (health checks, public booking)
 */

import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Logger } from '@skillancer/logger';

// User type that matches @fastify/jwt expectations
export interface AuthenticatedUser {
  userId: string;
  tenantId?: string;
  email?: string;
  role?: string;
  permissions?: string[];
}

// JWT augmentation to declare user type
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthenticatedUser;
  }
}

// Extend FastifyInstance with authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (permission: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// JWT Payload type
export interface JwtPayload {
  userId: string;
  tenantId?: string;
  email: string;
  role: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthPluginOptions {
  logger: Logger;
}

async function authPluginImpl(app: FastifyInstance, opts: AuthPluginOptions): Promise<void> {
  const { logger } = opts;
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    logger.error('JWT_SECRET environment variable is required for authentication');
    throw new Error('JWT_SECRET environment variable is required');
  }

  await app.register(jwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    },
    verify: {
      maxAge: process.env.JWT_EXPIRES_IN || '1d',
    },
    formatUser: (payload): AuthenticatedUser => {
      const p = payload as JwtPayload;
      return {
        userId: p.userId,
        email: p.email,
        role: p.role,
        tenantId: p.tenantId,
        permissions: p.permissions || [],
      };
    },
  });

  /**
   * Required authentication - throws 401 if not authenticated
   */
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      logger.warn({ error: err, path: request.url }, 'Authentication failed');
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token',
      });
      throw err;
    }
  });

  /**
   * Optional authentication - sets user if valid token, continues if no token
   */
  app.decorate('optionalAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return; // No token - continue without user
    }

    try {
      await request.jwtVerify();
    } catch {
      // Invalid token - continue without user
      request.log.debug('Optional auth: invalid token provided');
    }
  });

  /**
   * Permission-based authorization - requires specific permission
   */
  app.decorate('requirePermission', (permission: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      // First authenticate
      await app.authenticate(request, reply);

      // Then check permission
      const user = request.user;
      if (!user) {
        reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      // Admin role has all permissions
      if (user.role === 'admin' || user.role === 'superadmin') {
        return;
      }

      // Check if user has required permission
      const hasPermission = user.permissions?.includes(permission) ||
                           user.permissions?.includes('*') ||
                           user.permissions?.includes(`${permission.split(':')[0]}:*`);

      if (!hasPermission) {
        logger.warn({ userId: user.userId, permission, path: request.url }, 'Permission denied');
        reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Permission '${permission}' required`,
        });
        throw new Error(`Permission '${permission}' required`);
      }
    };
  });
}

export const authPlugin = fp(authPluginImpl, {
  name: 'cockpit-auth-plugin',
});

/**
 * Pre-handler for required authentication
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await request.server.authenticate(request, reply);
}

/**
 * Pre-handler for optional authentication
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await request.server.optionalAuth(request, reply);
}

/**
 * Factory for permission-based pre-handlers
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await request.server.requirePermission(permission)(request, reply);
  };
}
