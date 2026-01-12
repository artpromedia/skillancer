// @ts-nocheck - Fastify type compatibility issues
/**
 * @module @skillancer/integration-hub-svc/plugins
 * Fastify plugin registration
 */

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { getConfig } from '../config/index.js';

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

// Extend FastifyInstance with authenticate
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

export interface PluginOptions {
  cors?: boolean;
  helmet?: boolean;
  rateLimit?: boolean;
  jwt?: boolean;
  swagger?: boolean;
}

export async function registerPlugins(app: FastifyInstance, options: PluginOptions): Promise<void> {
  const config = getConfig();

  // Sensible (adds useful utilities)
  await app.register(sensible);

  // JWT Authentication
  if (options.jwt !== false) {
    if (!config.jwt?.secret) {
      throw new Error('JWT_SECRET environment variable is required for authentication');
    }

    await app.register(jwt, {
      secret: config.jwt.secret,
      sign: {
        expiresIn: '24h',
        issuer: config.jwt.issuer,
      },
      verify: {
        maxAge: '24h',
        issuer: config.jwt.issuer,
      },
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
      } catch (error) {
        throw app.httpErrors.unauthorized('Invalid or expired token');
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
  } else {
    // Register dummy decorators when JWT is explicitly disabled
    app.decorate('authenticate', async (): Promise<void> => {
      throw app.httpErrors.unauthorized('Authentication not configured');
    });
    app.decorate('optionalAuth', async (): Promise<void> => {
      // No-op when not configured
    });
  }

  // CORS
  if (options.cors) {
    await app.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
  }

  // Helmet (security headers)
  if (options.helmet) {
    await app.register(helmet, {
      contentSecurityPolicy: false, // Disable for API
    });
  }

  // Rate limiting
  if (options.rateLimit) {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
      // Different limits for OAuth callbacks (prevent brute force)
      keyGenerator: (request) => {
        if (request.url.includes('/oauth/callback')) {
          return `oauth:${request.ip}`;
        }
        return request.ip;
      },
    });
  }

  // Swagger documentation
  if (options.swagger) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Integration Hub API',
          description: 'API for managing third-party integrations',
          version: '1.0.0',
        },
        servers: [
          {
            url: 'http://localhost:3006',
            description: 'Development server',
          },
        ],
        tags: [
          { name: 'Discovery', description: 'Integration discovery' },
          { name: 'Connection', description: 'OAuth and connection management' },
          { name: 'Status', description: 'Integration status and health' },
          { name: 'Data', description: 'Widget data and sync' },
          { name: 'Webhooks', description: 'Webhook handling' },
        ],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }
}
