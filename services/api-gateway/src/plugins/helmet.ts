// @ts-nocheck - Fastify type compatibility issues
/**
 * @module @skillancer/api-gateway/plugins/helmet
 * Security headers plugin
 */

import helmet, { type FastifyHelmetOptions } from '@fastify/helmet';
import fp from 'fastify-plugin';

import { getConfig } from '../config/index.js';

import type { FastifyInstance } from 'fastify';

async function helmetPluginImpl(app: FastifyInstance): Promise<void> {
  const config = getConfig();

  const helmetOptions: FastifyHelmetOptions = {
    global: true,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  };

  // Allow Swagger UI to work by relaxing CSP
  if (config.features.swagger) {
    helmetOptions.contentSecurityPolicy = {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    };
  }

  await app.register(helmet, helmetOptions);
}

export const helmetPlugin = fp(helmetPluginImpl, {
  name: 'helmet-plugin',
});
