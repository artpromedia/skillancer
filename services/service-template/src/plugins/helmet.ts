/**
 * Helmet plugin for security headers
 */

import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance } from 'fastify';

async function helmetPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  await app.register(helmet, {
    // Disable CSP in development for easier debugging
    contentSecurityPolicy: config.env === 'production',
    // Allow cross-origin for Swagger UI
    crossOriginEmbedderPolicy: false,
  });
}

export const helmetPlugin = fp(helmetPluginImpl, {
  name: 'helmet-plugin',
});
