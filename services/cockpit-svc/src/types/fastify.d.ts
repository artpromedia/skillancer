/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { FastifyRequest, FastifyReply, FastifySchema } from 'fastify';
import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      permission: string
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      permissions?: string[];
      role?: string;
      hasPermission?: (permission: string) => boolean;
    };
  }

  // Extend FastifySchema to allow tags and summary for OpenAPI documentation
  interface FastifySchema {
    tags?: string[];
    summary?: string;
    description?: string;
    deprecated?: boolean;
    security?: Record<string, string[]>[];
  }
}
