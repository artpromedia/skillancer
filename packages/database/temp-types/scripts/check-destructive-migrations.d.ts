#!/usr/bin/env tsx
/**
 * @module check-destructive-migrations
 * Detects potentially destructive operations in pending Prisma migrations
 *
 * Checks for:
 * - DROP TABLE / DROP COLUMN / DROP INDEX
 * - DELETE FROM / TRUNCATE
 * - ALTER TABLE ... DROP
 *
 * Exit codes:
 * - 0: No destructive changes found
 * - 1: Destructive changes detected
 * - 2: Error during analysis
 *
 * Usage:
 *   pnpm db:check-destructive
 *   tsx scripts/check-destructive-migrations.ts
 */
export {};
//# sourceMappingURL=check-destructive-migrations.d.ts.map