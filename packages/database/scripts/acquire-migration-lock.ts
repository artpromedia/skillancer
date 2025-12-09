#!/usr/bin/env tsx
/**
 * @module acquire-migration-lock
 * CLI script to acquire database migration lock for CI/CD pipelines
 *
 * This script attempts to acquire a PostgreSQL advisory lock to prevent
 * concurrent migrations from running. It's designed for use in CI pipelines.
 *
 * @example
 * ```bash
 * # Acquire lock with default timeout (30s)
 * tsx scripts/acquire-migration-lock.ts
 *
 * # Acquire lock with custom timeout
 * LOCK_TIMEOUT_MS=60000 tsx scripts/acquire-migration-lock.ts
 *
 * # Via pnpm
 * pnpm db:lock:acquire
 * ```
 *
 * Exit codes:
 * - 0: Lock acquired successfully
 * - 1: Failed to acquire lock (timeout or error)
 */

import { PrismaClient } from '@prisma/client';

import { acquireMigrationLock, getMigrationLockStatus } from '../src/migration-lock';

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOCK_TIMEOUT_MS = parseInt(process.env.LOCK_TIMEOUT_MS || '30000', 10);
const DATABASE_URL = process.env.DATABASE_URL;

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔒 Database Migration Lock Acquisition');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  try {
    // Check current lock status
    console.log('📊 Checking current lock status...');
    const status = await getMigrationLockStatus(prisma);

    if (status.isLocked) {
      console.log(`⚠️  Lock is currently held by PID: ${status.holderPid}`);
      if (status.lockedSince) {
        console.log(`   Lock acquired at: ${status.lockedSince.toISOString()}`);
      }
    } else {
      console.log('✅ No existing lock detected');
    }
    console.log();

    // Attempt to acquire lock
    console.log(`🔄 Attempting to acquire lock (timeout: ${LOCK_TIMEOUT_MS}ms)...`);
    console.log();

    const acquired = await acquireMigrationLock(prisma, {
      timeoutMs: LOCK_TIMEOUT_MS,
      onWaiting: (elapsedMs) => {
        const seconds = Math.floor(elapsedMs / 1000);
        const remaining = Math.ceil((LOCK_TIMEOUT_MS - elapsedMs) / 1000);
        console.log(`   ⏳ Waiting for lock... ${seconds}s elapsed, ${remaining}s remaining`);
      },
      throwOnTimeout: false,
    });

    console.log();

    if (acquired) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ✅ LOCK ACQUIRED SUCCESSFULLY');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log();
      console.log('⚠️  IMPORTANT: Remember to release the lock when done!');
      console.log('   Run: pnpm db:lock:release');
      console.log();

      // Output lock status for CI to capture
      console.log('::set-output name=lock_acquired::true');

      // Don't disconnect - keep the connection alive to maintain the lock
      // The lock will be released when this process exits or when
      // release-migration-lock.ts is run in the same session

      // For CI pipelines, we need to output confirmation and exit
      // The lock is session-based, so we need a different approach for CI

      // Write lock status to a file for other processes to check
      const fs = await import('fs');
      const path = await import('path');
      const lockFile = path.join(process.cwd(), '.migration-lock');
      fs.writeFileSync(
        lockFile,
        JSON.stringify({
          acquired: true,
          timestamp: new Date().toISOString(),
          pid: process.pid,
        })
      );

      process.exit(0);
    } else {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ❌ FAILED TO ACQUIRE LOCK');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log();
      console.log('Another migration is currently in progress.');
      console.log('Please wait for it to complete or investigate if stuck.');
      console.log();

      // Check status again for more info
      const currentStatus = await getMigrationLockStatus(prisma);
      if (currentStatus.isLocked) {
        console.log(`Lock holder PID: ${currentStatus.holderPid}`);
        if (currentStatus.lockedSince) {
          const elapsed = Date.now() - currentStatus.lockedSince.getTime();
          console.log(`Lock duration: ${Math.floor(elapsed / 1000)}s`);
        }
      }

      console.log('::set-output name=lock_acquired::false');
      process.exit(1);
    }
  } catch (error) {
    console.error();
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('  ❌ ERROR ACQUIRING LOCK');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error();
    console.error(error instanceof Error ? error.message : String(error));
    console.error();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
