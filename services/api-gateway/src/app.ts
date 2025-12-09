/**
 * @module @skillancer/api-gateway/app
 * Fastify application factory
 */

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { getConfig } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';

import type { PinoLoggerOptions } from 'fastify/types/logger.js';

export interface AppOptions extends FastifyServerOptions {
  /** Skip plugin registration (for testing) */
  skipPlugins?: boolean;
}

/**
 * Create and configure the Fastify application
 */
export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = getConfig();
  const { skipPlugins = false, ...fastifyOptions } = options;

  const loggerOptions: PinoLoggerOptions = {
    level: config.server.logLevel,
  };

  // Use pino-pretty in development (not test or production)
  if (process.env['NODE_ENV'] === 'development') {
    loggerOptions.transport = {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
        colorize: true,
      },
    };
  }

  const app = Fastify({
    logger: loggerOptions,
    disableRequestLogging: true, // We use custom request logger
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    ...fastifyOptions,
  });

  // Set error handler
  app.setErrorHandler(errorHandler);

  // Register plugins
  if (!skipPlugins) {
    await registerPlugins(app);
  }

  // Register routes
  await app.register(registerRoutes);

  return app;
}

/**
 * Create a minimal app for testing
 */
export async function buildTestApp(options: AppOptions = {}): Promise<FastifyInstance> {
  return buildApp({
    logger: false,
    ...options,
  });
}
