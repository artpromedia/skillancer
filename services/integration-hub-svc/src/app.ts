/**
 * @module @skillancer/integration-hub-svc/app
 * Integration Hub Service - Fastify application factory
 *
 * This microservice handles all third-party integrations:
 * - OAuth flow management
 * - Token storage and refresh
 * - Data fetching and caching
 * - Webhook receiving and processing
 * - Rate limiting per provider
 */

import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';

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
  };
}

// ============================================================================
// APPLICATION FACTORY
// ============================================================================

/**
 * Build the Integration Hub Fastify application with all plugins and routes
 */
export async function buildApp(
  options: BuildAppOptions = {}
): Promise<FastifyInstance> {
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
    swagger: options.plugins?.swagger ?? config.env !== 'production',
  });

  // Register routes
  await registerRoutes(app);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'integration-hub-svc',
    timestamp: new Date().toISOString(),
  }));

  // Ready check
  app.get('/ready', async () => ({
    status: 'ready',
    service: 'integration-hub-svc',
    timestamp: new Date().toISOString(),
  }));

  return app;
}

export { getConfig } from './config/index.js';
