/**
 * CORS plugin
 */

import cors, { type FastifyCorsOptions } from '@fastify/cors';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance } from 'fastify';

async function corsPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  const corsOptions: FastifyCorsOptions = {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Correlation-ID'],
    exposedHeaders: ['X-Request-ID', 'X-Correlation-ID'],
  };

  await app.register(cors, corsOptions);
}

export const corsPlugin = fp(corsPluginImpl, {
  name: 'cors-plugin',
});
