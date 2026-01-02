/**
 * Auth Plugin
 *
 * Validates JWT tokens and adds user context to requests.
 * Supports both required and optional authentication.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { getConfig } from '../config/index.js';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      roles: string[];
      tenantId?: string;
      executiveId?: string;
      isAdmin?: boolean;
    };
  }
}

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  tenantId?: string;
  executiveId?: string;
  iat: number;
  exp: number;
}

async function authPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  // Decorator to require authentication
  app.decorate(
    'requireAuth',
    async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({
          error: true,
          statusCode: 401,
          message: 'Authentication required',
        });
        return;
      }

      const token = authHeader.substring(7);

      try {
        const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
        const isAdmin = payload.roles?.includes('admin') || payload.roles?.includes('super_admin');
        request.user = {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles || [],
          tenantId: payload.tenantId,
          executiveId: payload.executiveId,
          isAdmin,
        };
      } catch (error) {
        reply.status(401).send({
          error: true,
          statusCode: 401,
          message: 'Invalid or expired token',
        });
      }
    }
  );

  // Decorator to require admin role
  app.decorate(
    'requireAdmin',
    async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      // First check auth
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.status(401).send({
          error: true,
          statusCode: 401,
          message: 'Authentication required',
        });
        return;
      }

      const token = authHeader.substring(7);

      try {
        const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
        const isAdmin = payload.roles?.includes('admin') || payload.roles?.includes('super_admin');
        request.user = {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles || [],
          tenantId: payload.tenantId,
          executiveId: payload.executiveId,
          isAdmin,
        };

        // Check admin role
        if (!request.user.roles.includes('admin') && !request.user.roles.includes('super_admin')) {
          reply.status(403).send({
            error: true,
            statusCode: 403,
            message: 'Admin access required',
          });
        }
      } catch (error) {
        reply.status(401).send({
          error: true,
          statusCode: 401,
          message: 'Invalid or expired token',
        });
      }
    }
  );

  // Optional auth - doesn't fail if no token, just doesn't set user
  app.decorate(
    'optionalAuth',
    async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return;
      }

      const token = authHeader.substring(7);

      try {
        const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
        const isAdmin = payload.roles?.includes('admin') || payload.roles?.includes('super_admin');
        request.user = {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles || [],
          tenantId: payload.tenantId,
          executiveId: payload.executiveId,
          isAdmin,
        };
      } catch {
        // Ignore invalid tokens for optional auth
      }
    }
  );
}

export const authPlugin = fp(authPluginImpl as any, {
  name: 'auth-plugin',
});

// Type declarations for decorators
declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
