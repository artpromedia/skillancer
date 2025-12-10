/**
 * @module @skillancer/auth-svc
 * Authentication and authorization service for Skillancer platform
 *
 * Features:
 * - Email/password registration and login
 * - OAuth integration (Google, Microsoft, Apple)
 * - JWT-based session management
 * - Rate limiting and account lockout
 * - Email verification
 * - Password reset flow
 */

import { createRedisClientFromUrl } from '@skillancer/cache';

import { buildApp } from './app.js';
import { getConfig, validateConfig } from './config/index.js';

// =============================================================================
// STARTUP
// =============================================================================

/* eslint-disable n/no-process-exit -- Process lifecycle management requires process.exit */

async function start(): Promise<void> {
  // Validate configuration
  try {
    validateConfig();
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }

  const config = getConfig();

  // Create Redis client
  const redis = createRedisClientFromUrl(config.redisUrl);

  // Build application
  const app = await buildApp({ redis });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await app.close();
      await redis.quit();
      app.log.info('Server shut down successfully');
      process.exit(0);
    } catch (error) {
      app.log.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', async () => shutdown('SIGINT'));
  process.on('SIGTERM', async () => shutdown('SIGTERM'));

  // Start server
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Auth service listening on ${config.host}:${config.port}`);
  } catch (error) {
    app.log.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});

// =============================================================================
// EXPORTS
// =============================================================================

export { buildApp, buildTestApp } from './app.js';
export * from './config/index.js';
export * from './errors/index.js';
export * from './schemas/index.js';
export * from './services/index.js';
export * from './middleware/index.js';
export * from './routes/index.js';
