/* eslint-disable @typescript-eslint/consistent-type-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { FastifyRequest, FastifyReply } from 'fastify';
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
      permissions: string[];
      hasPermission: (permission: string) => boolean;
    };
  }
}
