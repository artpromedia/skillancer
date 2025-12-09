/**
 * @module @skillancer/service-template/app
 * Fastify application factory
 */

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { getConfig } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger'];
  disableRequestLogging?: boolean;
  plugins?: {
    cors?: boolean;
    helmet?: boolean;
    rateLimit?: boolean;
    jwt?: boolean;
    swagger?: boolean;
    underPressure?: boolean;
  };
}

// ============================================================================
// APPLICATION FACTORY
// ============================================================================

/**
 * Build the Fastify application with all plugins and routes
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = getConfig();

  // Determine logger configuration
  let loggerConfig: FastifyServerOptions['logger'];

  if (options.logger === false) {
    loggerConfig = false;
  } else if (options.logger === true || options.logger === undefined) {
    loggerConfig = {
      level: config.logging.level,
      transport: config.logging.pretty
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    };
  } else {
    loggerConfig = options.logger;
  }

  // Create Fastify instance
  const app = Fastify({
    logger: loggerConfig,
    disableRequestLogging: options.disableRequestLogging ?? false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => crypto.randomUUID(),
  });

  // Register error handler
  app.setErrorHandler(errorHandler);

  // Register plugins
  await registerPlugins(app, {
    cors: options.plugins?.cors ?? true,
    helmet: options.plugins?.helmet ?? true,
    rateLimit: options.plugins?.rateLimit ?? true,
    jwt: options.plugins?.jwt ?? !!config.jwt?.secret,
    swagger: options.plugins?.swagger ?? config.features.swagger,
    underPressure: options.plugins?.underPressure ?? true,
  });

  // Register routes
  await registerRoutes(app);

  return app;
}

/**
 * Build a minimal app instance for testing
 */
export async function buildTestApp(
  options: Partial<BuildAppOptions> = {}
): Promise<FastifyInstance> {
  // Set test environment
  process.env.NODE_ENV = 'test';

  return buildApp({
    logger: false,
    disableRequestLogging: true,
    plugins: {
      cors: false,
      helmet: true,
      rateLimit: false,
      jwt: false,
      swagger: false,
      underPressure: false,
      ...options.plugins,
    },
    ...options,
  });
}
