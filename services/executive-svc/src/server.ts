/**
 * Executive Service Server Entry Point
 */

import { buildApp } from './app.js';
import { getConfig } from './config/index.js';

async function main() {
  const config = getConfig();
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info(`Executive Service running on ${config.host}:${config.port}`);
    app.log.info(`API Documentation: http://${config.host}:${config.port}/docs`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  });
});

main();
