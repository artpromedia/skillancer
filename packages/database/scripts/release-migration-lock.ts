#!/usr/bin/env tsx
/**
 * @module release-migration-lock
 * CLI script to release database migration lock for CI/CD pipelines
 *
 * This script releases a PostgreSQL advisory lock that was previously acquired.
 * It's designed for use in CI pipelines.
 *
 * @example
 * ```bash
 * # Release lock
 * tsx scripts/release-migration-lock.ts
 *
 * # Via pnpm
 * pnpm db:lock:release
 *
 * # Force release all locks (emergency only)
 * FORCE_RELEASE=true pnpm db:lock:release
 * ```
 *
 * Exit codes:
 * - 0: Lock released successfully (or no lock was held)
 * - 1: Error releasing lock
 */

import { PrismaClient } from '@prisma/client';

import {
  releaseMigrationLock,
  forceReleaseMigrationLock,
  getMigrationLockStatus,
} from '../src/migration-lock';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
const FORCE_RELEASE = process.env.FORCE_RELEASE === 'true';

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔓 Database Migration Lock Release');
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

    if (!status.isLocked) {
      console.log('✅ No lock is currently held');
      console.log();

      // Clean up lock file if it exists
      const fs = await import('fs');
      const path = await import('path');
      const lockFile = path.join(process.cwd(), '.migration-lock');
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        console.log('🗑️  Removed stale lock file');
      }

      process.exit(0);
    }

    console.log(`🔒 Lock is held by PID: ${status.holderPid}`);
    if (status.lockedSince) {
      const elapsed = Date.now() - status.lockedSince.getTime();
      console.log(`   Duration: ${Math.floor(elapsed / 1000)}s`);
    }
    console.log();

    if (FORCE_RELEASE) {
      console.log('⚠️  FORCE RELEASE MODE');
      console.log('   This will release ALL advisory locks held by this session.');
      console.log();

      await forceReleaseMigrationLock(prisma);

      console.log();
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ✅ ALL LOCKS FORCE RELEASED');
      console.log('═══════════════════════════════════════════════════════════════');
    } else {
      // Release the migration lock
      console.log('🔄 Releasing migration lock...');
      await releaseMigrationLock(prisma);

      console.log();
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ✅ LOCK RELEASED SUCCESSFULLY');
      console.log('═══════════════════════════════════════════════════════════════');
    }

    // Verify release
    const newStatus = await getMigrationLockStatus(prisma);
    if (newStatus.isLocked) {
      console.log();
      console.log('⚠️  Note: A lock is still held (may be from another session)');
      console.log(`   Holder PID: ${newStatus.holderPid}`);
    }

    // Clean up lock file
    const fs = await import('fs');
    const path = await import('path');
    const lockFile = path.join(process.cwd(), '.migration-lock');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
      console.log('🗑️  Removed lock file');
    }

    console.log();
    process.exit(0);
  } catch (error) {
    console.error();
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('  ❌ ERROR RELEASING LOCK');
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
