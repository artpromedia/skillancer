/**
 * @module @skillancer/audit-client/fastify
 * Fastify plugin for automatic audit logging
 */

import fp from 'fastify-plugin';

import {
  AuditClient,
  type AuditClientOptions,
  type AuditActor,
  ActorType,
  OutcomeStatus,
  AuditCategory,
} from './index.js';

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    audit: AuditClient;
  }
  interface FastifyRequest {
    auditActor?: AuditActor;
  }
}

export interface AuditPluginOptions extends AuditClientOptions {
  excludePaths?: string[];
  excludeMethods?: string[];
  autoLog?: boolean;
  getActor?: (request: FastifyRequest) => AuditActor | undefined;
}

// eslint-disable-next-line @typescript-eslint/require-await
const auditPluginAsync: FastifyPluginAsync<AuditPluginOptions> = async (fastify, options) => {
  const {
    excludePaths = ['/health', '/ready', '/metrics'],
    excludeMethods = ['OPTIONS', 'HEAD'],
    autoLog = true,
    getActor,
    ...clientOptions
  } = options;

  const auditClient = new AuditClient(clientOptions);

  fastify.decorate('audit', auditClient);

  fastify.decorateRequest('auditActor', undefined);

  if (autoLog) {
    fastify.addHook('onRequest', (request: FastifyRequest, _reply, done) => {
      if (excludePaths.some((p) => request.url.startsWith(p))) {
        done();
        return;
      }
      if (excludeMethods.includes(request.method)) {
        done();
        return;
      }

      const actor = getActor?.(request) ?? extractActor(request);
      request.auditActor = actor;
      done();
    });

    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      if (excludePaths.some((p) => request.url.startsWith(p))) {
        return;
      }
      if (excludeMethods.includes(request.method)) {
        return;
      }

      const actor = request.auditActor;
      if (!actor) return;

      const eventType = determineEventType(request.method, request.url);
      const category = determineCategory(request.method);

      await auditClient.log({
        eventType,
        eventCategory: category,
        actor,
        resource: {
          type: extractResourceType(request.url),
          id: extractResourceId(request.url) ?? 'unknown',
        },
        action: request.method.toLowerCase(),
        outcome: {
          status: reply.statusCode < 400 ? OutcomeStatus.SUCCESS : OutcomeStatus.FAILURE,
          duration: reply.elapsedTime,
        },
        request: {
          method: request.method,
          path: request.url,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          correlationId: request.id,
        },
      });
    });
  }

  fastify.addHook('onClose', async () => {
    await auditClient.close();
  });
};

function extractActor(request: FastifyRequest): AuditActor {
  const user = (request as unknown as { user?: { id?: string; email?: string; name?: string } })
    .user;

  return {
    id: user?.id ?? 'anonymous',
    type: user?.id ? ActorType.USER : ActorType.ANONYMOUS,
    email: user?.email,
    name: user?.name,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    sessionId: request.id,
  };
}

function determineEventType(method: string, url: string): string {
  const resource = extractResourceType(url).toUpperCase();
  const action = methodToAction(method);
  return `${resource}_${action}`;
}

function determineCategory(method: string): AuditCategory {
  switch (method) {
    case 'GET':
      return AuditCategory.DATA_ACCESS;
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
      return AuditCategory.DATA_MODIFICATION;
    default:
      return AuditCategory.SYSTEM;
  }
}

function methodToAction(method: string): string {
  switch (method) {
    case 'GET':
      return 'READ';
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'ACCESS';
  }
}

function extractResourceType(url: string): string {
  const parts = url.split('/').filter(Boolean);
  const apiIndex = parts.findIndex((p) => p === 'api' || p === 'v1' || p === 'v2');
  const startIndex = apiIndex >= 0 ? apiIndex + 1 : 0;

  const hexPattern = /^[0-9a-f-]{8,}$/i;
  for (let i = startIndex; i < parts.length; i++) {
    const part = parts[i];
    if (part && !hexPattern.test(part) && !part.startsWith('?')) {
      return part;
    }
  }

  return 'unknown';
}

function extractResourceId(url: string): string | undefined {
  const parts = url.split('/').filter(Boolean);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const numericPattern = /^\d+$/;

  for (const part of parts) {
    if (uuidPattern.test(part)) {
      return part;
    }
    if (numericPattern.test(part) && part.length > 0) {
      return part;
    }
  }

  return undefined;
}

export const auditPlugin = fp(auditPluginAsync, {
  fastify: '4.x',
  name: '@skillancer/audit-client',
});

export default auditPlugin;
