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
export {};
//# sourceMappingURL=acquire-migration-lock.d.ts.map