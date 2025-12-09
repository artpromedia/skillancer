/**
 * @module @skillancer/api-gateway/plugins/sensible
 * Fastify sensible plugin for useful utilities
 */

import sensible from '@fastify/sensible';
import fp from 'fastify-plugin';

import type { FastifyInstance } from 'fastify';

async function sensiblePluginImpl(app: FastifyInstance): Promise<void> {
  await app.register(sensible, {
    sharedSchemaId: 'HttpError',
  });
}

export const sensiblePlugin = fp(sensiblePluginImpl, {
  name: 'sensible-plugin',
});
