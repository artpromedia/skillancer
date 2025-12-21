// @ts-nocheck - Fastify type compatibility issues
/**
 * JWT plugin for authentication
 */

import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Extend FastifyInstance with authenticate
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function jwtPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  if (!config.jwt?.secret) {
    (app.log as { warn?: (msg: string) => void }).warn?.(
      'JWT secret not configured, skipping JWT plugin'
    );
    return;
  }

  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  // Add authentication decorator
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      void reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  });
}

export const jwtPlugin = fp(jwtPluginImpl, {
  name: 'jwt-plugin',
}) as any;
