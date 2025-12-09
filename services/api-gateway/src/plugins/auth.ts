/**
 * @module @skillancer/api-gateway/plugins/auth
 * JWT authentication plugin
 */

import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';


import { getConfig } from '../config/index.js';
import { UnauthorizedError } from '../utils/errors.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// User type that matches @fastify/jwt expectations
export interface AuthenticatedUser {
  userId: string;
  tenantId?: string;
  email?: string;
  role?: string;
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
  }
}

// JWT Payload type
export interface JwtPayload {
  userId: string;
  tenantId?: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  if (!config.jwt?.secret) {
    app.log.warn('JWT secret not configured - authentication will not work');

    // Register dummy decorators when JWT is not configured
    app.decorate('authenticate', async (): Promise<void> => {
      await Promise.reject(new UnauthorizedError('Authentication not configured'));
    });
    app.decorate('optionalAuth', async (): Promise<void> => {
      // No-op when not configured - returns resolved promise
      await Promise.resolve();
    });
    return;
  }

  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
    verify: {
      maxAge: config.jwt.expiresIn,
    },
    // Decorate request.user with decoded token
    formatUser: (payload): AuthenticatedUser => {
      const p = payload as JwtPayload;
      const user: AuthenticatedUser = {
        userId: p.userId,
        email: p.email,
        role: p.role,
      };
      if (p.tenantId) {
        user.tenantId = p.tenantId;
      }
      return user;
    },
  });

  /**
   * Required authentication - throws if not authenticated
   */
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  });

  /**
   * Optional authentication - sets user if valid token, doesn't throw if missing
   */
  app.decorate('optionalAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return; // No token - continue without user
    }

    try {
      await request.jwtVerify();
    } catch {
      // Invalid token - continue without user but log it
      request.log.debug('Optional auth: invalid token provided');
    }
  });
}

export const authPlugin = fp(authPluginImpl, {
  name: 'auth-plugin',
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
