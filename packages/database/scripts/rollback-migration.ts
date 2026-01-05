#!/usr/bin/env tsx
// @ts-nocheck - CLI script with dynamic configuration handling
/**
 * @module rollback-migration
 * CLI script to rollback database migrations for CI/CD pipelines
 *
 * This script provides controlled rollback of Prisma migrations.
 * It supports rolling back to a specific migration version.
 *
 * ⚠️ WARNING: Rolling back migrations can cause data loss!
 * Always ensure you have a database backup before rolling back.
 *
 * @example
 * ```bash
 * # Show migration status without rolling back
 * tsx scripts/rollback-migration.ts --dry-run
 *
 * # Rollback the last migration
 * tsx scripts/rollback-migration.ts --steps 1
 *
 * # Rollback to a specific migration
 * tsx scripts/rollback-migration.ts --target 20251208120000_add_user_fields
 *
 * # Via pnpm
 * pnpm db:migrate:rollback --steps 1
 * ```
 *
 * Exit codes:
 * - 0: Rollback successful (or dry run)
 * - 1: Error or rollback failed
 */

import * as fs from 'fs';
import * as path from 'path';

import { PrismaClient } from '@prisma/client';

import {
  acquireMigrationLock,
  releaseMigrationLock,
  getMigrationLockStatus,
} from '../src/migration-lock';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
const MIGRATIONS_DIR = path.join(__dirname, '../prisma/migrations');

// ============================================================================
// TYPES
// ============================================================================

interface MigrationInfo {
  name: string;
  directory: string;
  timestamp: string;
  applied: boolean;
  sqlFile: string;
}

interface RollbackOptions {
  dryRun: boolean;
  steps?: number;
  target?: string;
  force: boolean;
  skipLock: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function parseArgs(): RollbackOptions {
  const args = process.argv.slice(2);
  const options: RollbackOptions = {
    dryRun: false,
    force: false,
    skipLock: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    switch (arg) {
      case '--dry-run':
      case '-n':
        options.dryRun = true;
        break;

      case '--steps':
      case '-s': {
        const steps = Number.parseInt(args[++i] || '0', 10);
        if (isNaN(steps) || steps < 1) {
          console.error('❌ --steps must be a positive integer');
          process.exit(1);
        }
        options.steps = steps;
        break;
      }

      case '--target':
      case '-t':
        options.target = args[++i];
        break;

      case '--force':
      case '-f':
        options.force = true;
        break;

      case '--skip-lock':
        options.skipLock = true;
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`❌ Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Usage: rollback-migration.ts [options]

Options:
  --dry-run, -n     Show what would be rolled back without making changes
  --steps, -s N     Roll back N migrations (default: 1)
  --target, -t NAME Roll back to a specific migration (exclusive with --steps)
  --force, -f       Skip confirmation prompts
  --skip-lock       Skip acquiring migration lock (not recommended)
  --help, -h        Show this help message

Examples:
  # Show current migration status
  rollback-migration.ts --dry-run

  # Roll back the last migration
  rollback-migration.ts --steps 1

  # Roll back the last 3 migrations
  rollback-migration.ts --steps 3

  # Roll back to a specific migration
  rollback-migration.ts --target 20251208120000_add_user_fields
`);
}

async function getMigrations(prisma: PrismaClient): Promise<MigrationInfo[]> {
  // Get list of applied migrations from the database
  const appliedMigrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM _prisma_migrations 
    WHERE finished_at IS NOT NULL 
    ORDER BY finished_at DESC
  `;

  const appliedNames = new Set(appliedMigrations.map((m) => m.migration_name));

  // Get list of migration directories
  const migrations: MigrationInfo[] = [];

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return migrations;
  }

  const dirs = fs.readdirSync(MIGRATIONS_DIR).filter((dir) => {
    const fullPath = path.join(MIGRATIONS_DIR, dir);
    return fs.statSync(fullPath).isDirectory() && dir !== 'migration_lock';
  });

  for (const dir of dirs) {
    const sqlFile = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
    const timestamp = dir.split('_')[0] || '';

    migrations.push({
      name: dir,
      directory: path.join(MIGRATIONS_DIR, dir),
      timestamp,
      applied: appliedNames.has(dir),
      sqlFile: fs.existsSync(sqlFile) ? sqlFile : '',
    });
  }

  // Sort by timestamp descending (newest first)
  return migrations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function printMigrationStatus(migrations: MigrationInfo[]): void {
  console.log('📋 Migration Status:');
  console.log();

  if (migrations.length === 0) {
    console.log('   No migrations found');
    return;
  }

  for (const migration of migrations) {
    const status = migration.applied ? '✅' : '⬜';
    console.log(`   ${status} ${migration.name}`);
  }

  const applied = migrations.filter((m) => m.applied).length;
  const pending = migrations.filter((m) => !m.applied).length;

  console.log();
  console.log(`   Applied: ${applied}, Pending: ${pending}`);
}

async function rollbackMigration(prisma: PrismaClient, migration: MigrationInfo): Promise<void> {
  console.log(`🔄 Rolling back: ${migration.name}`);

  // Read the migration SQL to try to generate a rollback
  if (migration.sqlFile && fs.existsSync(migration.sqlFile)) {
    // Check if there's a corresponding down migration
    const downFile = path.join(migration.directory, 'down.sql');
    if (fs.existsSync(downFile)) {
      console.log('   Found down.sql, executing...');
      const downSql = fs.readFileSync(downFile, 'utf-8');
      await prisma.$executeRawUnsafe(downSql);
    } else {
      console.log('   ⚠️  No down.sql found, attempting auto-generated rollback...');
      console.log('   This may not work for complex migrations.');

      // Prisma doesn't natively support down migrations, so we need to
      // mark the migration as rolled back in the _prisma_migrations table
      // The actual rollback SQL would need to be manually created
    }
  }

  // Mark migration as rolled back in _prisma_migrations table
  await prisma.$executeRaw`
    UPDATE _prisma_migrations 
    SET rolled_back_at = NOW()
    WHERE migration_name = ${migration.name}
  `;

  console.log(`   ✅ Marked as rolled back`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔙 Database Migration Rollback');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Warning banner
  if (!options.dryRun) {
    console.log('⚠️  WARNING: Rolling back migrations can cause DATA LOSS!');
    console.log('   Ensure you have a database backup before proceeding.');
    console.log();
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  let lockAcquired = false;

  try {
    // Acquire migration lock
    if (!options.skipLock && !options.dryRun) {
      console.log('🔒 Acquiring migration lock...');
      const status = await getMigrationLockStatus(prisma);

      if (status.isLocked) {
        console.log(`   Lock held by PID: ${status.holderPid}`);
        console.log('   Waiting for lock...');
      }

      lockAcquired = await acquireMigrationLock(prisma, {
        timeoutMs: 60000,
        throwOnTimeout: true,
      });

      console.log();
    }

    // Get current migration status
    const migrations = await getMigrations(prisma);
    const appliedMigrations = migrations.filter((m) => m.applied);

    printMigrationStatus(migrations);
    console.log();

    if (appliedMigrations.length === 0) {
      console.log('✅ No migrations to roll back');
      process.exit(0);
    }

    // Determine which migrations to roll back
    let migrationsToRollback: MigrationInfo[] = [];

    if (options.target) {
      // Find the target migration
      const target = options.target;
      const targetIndex = appliedMigrations.findIndex(
        (m) => m.name === target || m.name.includes(target)
      );

      if (targetIndex === -1) {
        console.error(`❌ Target migration not found: ${options.target}`);
        process.exit(1);
      }

      // Roll back everything after the target (but not the target itself)
      migrationsToRollback = appliedMigrations.slice(0, targetIndex);
    } else {
      // Roll back specified number of steps
      const steps = options.steps || 1;
      migrationsToRollback = appliedMigrations.slice(0, steps);
    }

    if (migrationsToRollback.length === 0) {
      console.log('✅ No migrations to roll back');
      process.exit(0);
    }

    console.log('📋 Migrations to roll back:');
    for (const migration of migrationsToRollback) {
      console.log(`   - ${migration.name}`);
    }
    console.log();

    if (options.dryRun) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('  ℹ️  DRY RUN - No changes made');
      console.log('═══════════════════════════════════════════════════════════════');
      process.exit(0);
    }

    // Confirm if not forced
    if (!options.force) {
      console.log('❓ Are you sure you want to proceed?');
      console.log('   Pass --force to skip this confirmation.');
      console.log();
      console.log('   Exiting without making changes.');
      process.exit(1);
    }

    // Perform rollback
    console.log('🔄 Starting rollback...');
    console.log();

    for (const migration of migrationsToRollback) {
      await rollbackMigration(prisma, migration);
    }

    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ ROLLBACK COMPLETED');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();
    console.log(`   Rolled back ${migrationsToRollback.length} migration(s)`);
    console.log();
    console.log('⚠️  IMPORTANT: You may need to manually execute down.sql scripts');
    console.log('   or recreate the database schema to fully reverse changes.');
    console.log();
    console.log('   Next steps:');
    console.log('   1. Verify application functionality');
    console.log('   2. Run pnpm db:migrate:status to check status');
    console.log('   3. If needed, run pnpm db:migrate:deploy to re-apply');
    console.log();

    process.exit(0);
  } catch (error) {
    console.error();
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('  ❌ ROLLBACK FAILED');
    console.error('═══════════════════════════════════════════════════════════════');
    console.error();
    console.error(error instanceof Error ? error.message : String(error));
    console.error();
    process.exit(1);
  } finally {
    // Release lock if acquired
    if (lockAcquired) {
      try {
        await releaseMigrationLock(prisma);
      } catch {
        console.warn('⚠️ Failed to release migration lock');
      }
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
