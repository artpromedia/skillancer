// @ts-nocheck
/**
 * @module @skillancer/integration-hub-svc/server
 * Integration Hub Service entry point
 */

import { buildApp } from './app.js';
import { getConfig } from './config/index.js';
import { initializeConnectorRegistry } from './connectors/registry.js';
import { startBackgroundJobs } from './jobs/index.js';

async function start() {
  const config = getConfig();

  try {
    // Initialize connector registry
    await initializeConnectorRegistry();

    // Build and start the application
    const app = await buildApp();

    // Start background jobs
    await startBackgroundJobs();

    // Start listening
    await app.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`🔌 Integration Hub Service listening on ${config.host}:${config.port}`);
  } catch (error) {
    console.error('Failed to start Integration Hub Service:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

start();

