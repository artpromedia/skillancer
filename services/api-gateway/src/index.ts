/**
 * @module @skillancer/api-gateway
 * API Gateway / Backend for Frontend (BFF)
 *
 * Entry point for the API Gateway service.
 * Handles:
 * - Request routing to downstream services
 * - Authentication and authorization
 * - Rate limiting
 * - Circuit breaking
 * - BFF aggregation endpoints
 */

import { buildApp } from './app.js';
import { getConfig } from './config/index.js';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

async function start(): Promise<void> {
  const config = getConfig();
  const app = await buildApp();

  // Graceful shutdown handlers
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await app.close();
        app.log.info('Server closed successfully');
        process.exit(0);
      } catch (error) {
        app.log.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });
  }

  try {
    const address = await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    app.log.info(`🚀 API Gateway running at ${address}`);
    app.log.info(`📚 Documentation available at ${address}/docs`);
  } catch (error) {
    app.log.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
void start();

// Export for testing
export { buildApp } from './app.js';
export { getConfig } from './config/index.js';
export type { GatewayConfig } from './config/index.js';
export type { ServiceRoute } from './config/routes.js';
