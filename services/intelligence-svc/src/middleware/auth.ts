/**
 * @module @skillancer/intelligence-svc/middleware/auth
 * Authentication middleware for Intelligence Service
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedUser {
  id: string;
  email?: string;
  tenantId?: string;
  roles?: string[];
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Verify JWT token and attach user to request
 *
 * In production, this should:
 * 1. Extract JWT from Authorization header
 * 2. Verify signature with JWT_SECRET
 * 3. Check token expiration
 * 4. Attach decoded user to request
 *
 * For now, extracts user from request (set by API Gateway)
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Check for user set by API Gateway or from JWT
  const user = (request as any).user;

  // Check Authorization header if user not already set
  if (!user) {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing authentication token',
      });
    }

    // In production: Verify JWT and decode user
    // For now, reject requests without pre-authenticated user
    // This ensures the endpoint is protected even if JWT verification isn't complete
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required. Please authenticate through the API Gateway.',
    });
  }

  // Validate user has required fields
  if (!user.id) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid user context',
    });
  }
}

/**
 * Require specific permission for access
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = (request as AuthenticatedRequest).user;

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Check if user has required permission
    // In production, this would check against a permissions system
    const hasPermission = user.roles?.some((role) => {
      // Admin has all permissions
      if (role === 'admin' || role === 'ADMIN') return true;
      // Check specific permission
      return role === permission || role.startsWith(permission.split(':')[0]);
    });

    if (!hasPermission && user.roles && user.roles.length > 0) {
      // If user has roles but not the required one, deny access
      // If user has no roles, allow (for backward compatibility during rollout)
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Missing required permission: ${permission}`,
      });
    }
  };
}

// =============================================================================
// FASTIFY PLUGIN
// =============================================================================

/**
 * Register authentication decorators on Fastify instance
 */
export function registerAuthPlugin(app: FastifyInstance): void {
  // Decorate fastify with authenticate method
  app.decorate('authenticate', authenticate);

  // Decorate fastify with requirePermission method
  app.decorate('requirePermission', requirePermission);

  // Decorate request with user property
  app.decorateRequest('user', null);
}

// =============================================================================
// TYPE AUGMENTATION
// =============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
    requirePermission: typeof requirePermission;
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
