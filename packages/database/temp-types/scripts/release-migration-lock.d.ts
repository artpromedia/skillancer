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
export {};
//# sourceMappingURL=release-migration-lock.d.ts.map
