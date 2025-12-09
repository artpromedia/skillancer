/**
 * Under pressure plugin for load shedding
 */

import underPressure from '@fastify/under-pressure';
import fp from 'fastify-plugin';

import type { FastifyInstance } from 'fastify';

async function underPressurePluginImpl(app: FastifyInstance): Promise<void> {
  await app.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxHeapUsedBytes: 1000000000, // 1GB
    maxRssBytes: 1500000000, // 1.5GB
    maxEventLoopUtilization: 0.98,
    pressureHandler: () => {
      (app.log as { warn?: (msg: string) => void }).warn?.('Server under pressure');
    },
    retryAfter: 50,
    exposeStatusRoute: {
      routeOpts: {
        logLevel: 'silent',
      },
      routeSchemaOpts: {
        hide: true,
      },
      url: '/health/pressure',
    },
  });
}

export const underPressurePlugin = fp(underPressurePluginImpl, {
  name: 'under-pressure-plugin',
});
