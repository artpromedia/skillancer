/**
 * @module @skillancer/skillpod-svc
 * VDI management and orchestration service with data containment
 */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable n/no-process-exit */

import { PrismaClient } from '@/types/prisma-shim.js';
import Redis from 'ioredis';

import { buildApp, getConfig } from './app.js';

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  const config = getConfig();

  // Initialize Prisma client
  const prisma = new PrismaClient({
    log:
      config.service.environment === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

  // Initialize Redis client with proper typing
  const redis = new (Redis as any)(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 10) {
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000);
    },
  });

  // Handle Redis errors
  redis.on('error', (err: Error) => {
    console.error('Redis connection error:', err);
  });

  redis.on('connect', () => {
    console.log('Connected to Redis');
  });

  // Build and start the application
  const app = await buildApp({ redis, prisma });

  try {
    await app.listen({
      port: config.service.port,
      host: config.service.host,
    });

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   🔒 SkillPod VDI Service                                         ║
║                                                                    ║
║   Data Containment & Security Module Active                       ║
║                                                                    ║
║   Server running at: http://${config.service.host}:${config.service.port}                   ║
║   Environment: ${config.service.environment.padEnd(20)}                       ║
║   VDI Provider: ${config.vdi.provider.padEnd(19)}                       ║
║                                                                    ║
║   Features:                                                       ║
║   ✓ Clipboard Controls                                            ║
║   ✓ File Transfer Controls                                        ║
║   ✓ Screen Capture Blocking                                       ║
║   ✓ USB/Peripheral Controls                                       ║
║   ✓ Network Access Controls                                       ║
║   ✓ Session Watermarking                                          ║
║   ✓ Violation Detection & Response                                ║
║                                                                    ║
╚══════════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    await redis.quit();
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    try {
      await app.close();
      await prisma.$disconnect();
      await redis.quit();
      console.log('Goodbye! 👋');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', async () => shutdown('SIGTERM'));
  process.on('SIGINT', async () => shutdown('SIGINT'));
}

// Use top-level await
await main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// =============================================================================
// EXPORTS
// =============================================================================

export { buildApp } from './app.js';
export { getConfig } from './config/index.js';
export * from './services/index.js';
export * from './middleware/index.js';
export * from './types/index.js';
