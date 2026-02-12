#!/usr/bin/env tsx
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
export {};
//# sourceMappingURL=rollback-migration.d.ts.map
