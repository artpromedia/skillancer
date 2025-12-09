/**
 * @module @skillancer/service-template/server
 * Server entry point with graceful shutdown
 */

/* eslint-disable n/no-process-exit */

import { buildApp } from './app.js';
import { getConfig } from './config/index.js';

type LogFn = (obj: object | string, msg?: string) => void;

async function main(): Promise<void> {
  const config = getConfig();
  const app = await buildApp();
  const log = app.log as { info?: LogFn; error?: LogFn; fatal?: LogFn };

  // Graceful shutdown handlers
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  for (const signal of signals) {
    process.on(signal, async () => {
      log.info?.(`Received ${signal}, shutting down gracefully...`);

      try {
        await app.close();
        log.info?.('Server closed successfully');
        process.exit(0);
      } catch (error) {
        log.error?.(error as object, 'Error during shutdown');
        process.exit(1);
      }
    });
  }

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    log.fatal?.(error as object, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    log.fatal?.({ reason }, 'Unhandled rejection');
    process.exit(1);
  });

  // Start server
  try {
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    log.info?.(
      {
        service: config.service.name,
        version: config.service.version,
        env: config.env,
        port: config.server.port,
      },
      'Server started successfully'
    );
  } catch (error) {
    log.fatal?.(error as object, 'Failed to start server');
    process.exit(1);
  }
}

void main();
