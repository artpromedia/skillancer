#!/usr/bin/env tsx
/**
 * @module data-migration-template
 * Template for batch data migrations in Skillancer
 *
 * Copy this file and modify for your specific migration needs.
 *
 * Features:
 * - Batch processing to avoid memory issues
 * - Transaction support for atomicity
 * - Progress reporting
 * - Error handling and recovery
 * - Migration lock to prevent concurrent runs
 * - Dry-run mode for testing
 *
 * Usage:
 *   # Dry run (no changes)
 *   tsx scripts/data-migrations/your-migration.ts --dry-run
 *
 *   # Execute migration
 *   tsx scripts/data-migrations/your-migration.ts
 *
 *   # With custom batch size
 *   tsx scripts/data-migrations/your-migration.ts --batch-size=500
 */

import { PrismaClient } from '@prisma/client';
import { withMigrationLock, getMigrationLockStatus } from '../../src/migration-lock';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  /** Name of this migration (for logging) */
  name: 'example_data_migration',

  /** Default batch size for processing records */
  defaultBatchSize: 1000,

  /** Maximum retries for failed batches */
  maxRetries: 3,

  /** Delay between retries (ms) */
  retryDelayMs: 1000,

  /** Whether to use transactions per batch */
  useTransactions: true,

  /** Log every N batches */
  logInterval: 10,
};

// ============================================================================
// TYPES
// ============================================================================

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  verbose: boolean;
}

interface MigrationResult {
  success: boolean;
  processed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: Array<{ id: string; error: string }>;
}

// ============================================================================
// MIGRATION LOGIC - CUSTOMIZE THIS SECTION
// ============================================================================

/**
 * Get the total count of records to migrate
 */
async function getTotalCount(prisma: PrismaClient): Promise<number> {
  // CUSTOMIZE: Add your count query
  return prisma.user.count({
    where: {
      // Add conditions for records that need migration
      // Example: status: null
    },
  });
}

/**
 * Get a batch of records to migrate
 */
async function getBatch(
  prisma: PrismaClient,
  skip: number,
  take: number
): Promise<Array<{ id: string; [key: string]: unknown }>> {
  // CUSTOMIZE: Add your select query
  return prisma.user.findMany({
    skip,
    take,
    where: {
      // Add conditions for records that need migration
      // Example: status: null
    },
    select: {
      id: true,
      // Add other fields needed for migration
      // email: true,
      // createdAt: true,
    },
    orderBy: {
      // Consistent ordering is important for pagination
      id: 'asc',
    },
  });
}

/**
 * Migrate a single record
 * Returns true if migrated, false if skipped
 */
async function migrateRecord(
  prisma: PrismaClient,
  record: { id: string; [key: string]: unknown },
  options: MigrationOptions
): Promise<boolean> {
  // CUSTOMIZE: Add your migration logic

  // Example: Update user status
  // const shouldMigrate = record.status === null;
  // if (!shouldMigrate) return false;

  if (!options.dryRun) {
    await prisma.user.update({
      where: { id: record.id },
      data: {
        // Add your data updates
        // status: 'ACTIVE',
        // updatedAt: new Date(),
      },
    });
  }

  return true;
}

/**
 * Migrate a batch of records in a transaction
 */
async function migrateBatch(
  prisma: PrismaClient,
  batch: Array<{ id: string; [key: string]: unknown }>,
  options: MigrationOptions
): Promise<{ migrated: number; skipped: number; errors: Array<{ id: string; error: string }> }> {
  let migrated = 0;
  let skipped = 0;
  const errors: Array<{ id: string; error: string }> = [];

  if (CONFIG.useTransactions && !options.dryRun) {
    // Process in transaction
    await prisma.$transaction(async (tx) => {
      for (const record of batch) {
        try {
          const wasMigrated = await migrateRecord(tx as unknown as PrismaClient, record, options);
          if (wasMigrated) {
            migrated++;
          } else {
            skipped++;
          }
        } catch (error) {
          errors.push({
            id: record.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  } else {
    // Process without transaction (for dry-run or when disabled)
    for (const record of batch) {
      try {
        const wasMigrated = await migrateRecord(prisma, record, options);
        if (wasMigrated) {
          migrated++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors.push({
          id: record.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { migrated, skipped, errors };
}

// ============================================================================
// MIGRATION RUNNER
// ============================================================================

async function runMigration(
  prisma: PrismaClient,
  options: MigrationOptions
): Promise<MigrationResult> {
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const allErrors: Array<{ id: string; error: string }> = [];

  console.log(`\n🚀 Starting migration: ${CONFIG.name}`);
  console.log(`   Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`   Batch size: ${options.batchSize}`);

  // Get total count
  const totalCount = await getTotalCount(prisma);
  console.log(`   Records to process: ${totalCount}\n`);

  if (totalCount === 0) {
    console.log('✅ No records to migrate');
    return {
      success: true,
      processed: 0,
      failed: 0,
      skipped: 0,
      duration: Date.now() - startTime,
      errors: [],
    };
  }

  let batchNumber = 0;
  let offset = 0;

  while (offset < totalCount) {
    batchNumber++;
    const batch = await getBatch(prisma, offset, options.batchSize);

    if (batch.length === 0) break;

    // Process batch with retries
    let retries = 0;
    let batchResult: {
      migrated: number;
      skipped: number;
      errors: Array<{ id: string; error: string }>;
    } | null = null;

    while (retries < CONFIG.maxRetries) {
      try {
        batchResult = await migrateBatch(prisma, batch, options);
        break;
      } catch (error) {
        retries++;
        console.error(
          `   Batch ${batchNumber} failed (attempt ${retries}/${CONFIG.maxRetries}):`,
          error
        );

        if (retries < CONFIG.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, CONFIG.retryDelayMs));
        }
      }
    }

    if (batchResult) {
      totalProcessed += batchResult.migrated;
      totalSkipped += batchResult.skipped;
      totalFailed += batchResult.errors.length;
      allErrors.push(...batchResult.errors);
    } else {
      // Batch completely failed after retries
      totalFailed += batch.length;
      allErrors.push(...batch.map((r) => ({ id: r.id, error: 'Batch failed after max retries' })));
    }

    // Progress logging
    if (batchNumber % CONFIG.logInterval === 0 || options.verbose) {
      const progress = (((offset + batch.length) / totalCount) * 100).toFixed(1);
      console.log(
        `   Batch ${batchNumber}: ${progress}% complete ` +
          `(${totalProcessed} migrated, ${totalSkipped} skipped, ${totalFailed} failed)`
      );
    }

    offset += batch.length;
  }

  const duration = Date.now() - startTime;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Migration completed in ${(duration / 1000).toFixed(2)}s`);
  console.log(`  ✅ Migrated: ${totalProcessed}`);
  console.log(`  ⏭️  Skipped:  ${totalSkipped}`);
  console.log(`  ❌ Failed:   ${totalFailed}`);

  if (allErrors.length > 0 && allErrors.length <= 10) {
    console.log('\nErrors:');
    for (const err of allErrors) {
      console.log(`  - ${err.id}: ${err.error}`);
    }
  } else if (allErrors.length > 10) {
    console.log(`\nFirst 10 errors (${allErrors.length} total):`);
    for (const err of allErrors.slice(0, 10)) {
      console.log(`  - ${err.id}: ${err.error}`);
    }
  }

  return {
    success: totalFailed === 0,
    processed: totalProcessed,
    failed: totalFailed,
    skipped: totalSkipped,
    duration,
    errors: allErrors,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    batchSize: CONFIG.defaultBatchSize,
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  // Parse batch size
  const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
  if (batchSizeArg) {
    const size = Number.parseInt(batchSizeArg.split('=')[1]!, 10);
    if (!isNaN(size) && size > 0) {
      options.batchSize = size;
    }
  }

  const prisma = new PrismaClient();

  try {
    // Check for existing migration lock
    const lockStatus = await getMigrationLockStatus(prisma);
    if (lockStatus.isLocked) {
      console.error(`❌ Migration lock already held by PID ${lockStatus.holderPid}`);
      console.error('   Another migration may be in progress.');
      process.exit(1);
    }

    // Run with migration lock
    const result = await withMigrationLock(prisma, async () => {
      return runMigration(prisma, options);
    });

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
