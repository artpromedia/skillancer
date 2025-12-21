/**
 * @module @skillancer/database/migration-lock
 * PostgreSQL advisory lock utilities for preventing concurrent migrations
 *
 * Uses PostgreSQL advisory locks to ensure only one migration process
 * runs at a time, preventing race conditions and conflicts.
 *
 * @example
 * ```typescript
 * import { prisma } from '@skillancer/database';
 * import { withMigrationLock, acquireMigrationLock, releaseMigrationLock } from '@skillancer/database';
 *
 * // Option 1: Using withMigrationLock (recommended)
 * await withMigrationLock(prisma, async () => {
 *   // Your migration logic here
 *   await runDataMigration();
 * });
 *
 * // Option 2: Manual lock management
 * const acquired = await acquireMigrationLock(prisma);
 * if (acquired) {
 *   try {
 *     await runDataMigration();
 *   } finally {
 *     await releaseMigrationLock(prisma);
 *   }
 * }
 * ```
 */

import type { PrismaClient } from '@prisma/client';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Advisory lock key for database migrations
 * Using a large prime number to avoid collisions with other locks
 * This is a 64-bit key split into two 32-bit integers for pg_advisory_lock
 */
const MIGRATION_LOCK_KEY_1 = 847102983; // Skillancer namespace
const MIGRATION_LOCK_KEY_2 = 1; // Migration lock type

/**
 * Default timeout for acquiring lock (in milliseconds)
 */
const DEFAULT_LOCK_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Retry interval when waiting for lock (in milliseconds)
 */
const LOCK_RETRY_INTERVAL_MS = 1000; // 1 second

// ============================================================================
// TYPES
// ============================================================================

export interface MigrationLockOptions {
  /**
   * Maximum time to wait for lock acquisition (ms)
   * @default 30000
   */
  timeoutMs?: number;

  /**
   * Callback invoked while waiting for lock
   */
  onWaiting?: (elapsedMs: number) => void;

  /**
   * Whether to throw an error if lock cannot be acquired
   * @default true
   */
  throwOnTimeout?: boolean;
}

export interface LockStatus {
  /** Whether the lock is currently held */
  isLocked: boolean;
  /** PID of the process holding the lock (if locked) */
  holderPid?: number;
  /** When the lock was acquired (if available) */
  lockedSince?: Date;
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Attempt to acquire the migration lock (non-blocking)
 *
 * Uses pg_try_advisory_lock which returns immediately without waiting.
 *
 * @param prisma - Prisma client instance
 * @returns true if lock acquired, false if already held by another process
 *
 * @example
 * ```typescript
 * const acquired = await tryAcquireMigrationLock(prisma);
 * if (!acquired) {
 *   console.log('Migration already in progress');
 *   process.exit(1);
 * }
 * ```
 */
export async function tryAcquireMigrationLock(
  prisma: PrismaClient
): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
    SELECT pg_try_advisory_lock(${MIGRATION_LOCK_KEY_1}, ${MIGRATION_LOCK_KEY_2})
  `;

  return result[0]?.pg_try_advisory_lock ?? false;
}

/**
 * Acquire the migration lock (blocking with timeout)
 *
 * Waits for the lock to become available, up to the specified timeout.
 *
 * @param prisma - Prisma client instance
 * @param options - Lock acquisition options
 * @returns true if lock acquired, false if timeout reached
 *
 * @example
 * ```typescript
 * const acquired = await acquireMigrationLock(prisma, {
 *   timeoutMs: 60000,
 *   onWaiting: (elapsed) => console.log(`Waiting for lock... ${elapsed}ms`),
 * });
 * ```
 */
export async function acquireMigrationLock(
  prisma: PrismaClient,
  options: MigrationLockOptions = {}
): Promise<boolean> {
  const {
    timeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
    onWaiting,
    throwOnTimeout = true,
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  while (Date.now() - startTime < timeoutMs) {
    const acquired = await tryAcquireMigrationLock(prisma);

    if (acquired) {
      console.log(`🔒 Migration lock acquired (attempt ${attempts + 1})`);
      return true;
    }

    attempts++;
    const elapsed = Date.now() - startTime;

    if (onWaiting) {
      onWaiting(elapsed);
    } else if (attempts % 5 === 0) {
      console.log(`⏳ Waiting for migration lock... (${elapsed}ms elapsed)`);
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
  }

  const message = `Failed to acquire migration lock within ${timeoutMs}ms`;

  if (throwOnTimeout) {
    throw new Error(message);
  }

  console.warn(`⚠️ ${message}`);
  return false;
}

/**
 * Release the migration lock
 *
 * Should always be called after acquiring the lock, typically in a finally block.
 *
 * @param prisma - Prisma client instance
 *
 * @example
 * ```typescript
 * try {
 *   await acquireMigrationLock(prisma);
 *   await runMigration();
 * } finally {
 *   await releaseMigrationLock(prisma);
 * }
 * ```
 */
export async function releaseMigrationLock(prisma: PrismaClient): Promise<void> {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY_1}, ${MIGRATION_LOCK_KEY_2})
  `;
  console.log('🔓 Migration lock released');
}

/**
 * Check the current status of the migration lock
 *
 * @param prisma - Prisma client instance
 * @returns Current lock status
 *
 * @example
 * ```typescript
 * const status = await getMigrationLockStatus(prisma);
 * if (status.isLocked) {
 *   console.log(`Lock held by PID: ${status.holderPid}`);
 * }
 * ```
 */
export async function getMigrationLockStatus(
  prisma: PrismaClient
): Promise<LockStatus> {
  const result = await prisma.$queryRaw<
    Array<{
      pid: number;
      granted: boolean;
      query_start: Date | null;
    }>
  >`
    SELECT 
      l.pid,
      l.granted,
      a.query_start
    FROM pg_locks l
    LEFT JOIN pg_stat_activity a ON l.pid = a.pid
    WHERE l.locktype = 'advisory'
      AND l.classid = ${MIGRATION_LOCK_KEY_1}
      AND l.objid = ${MIGRATION_LOCK_KEY_2}
      AND l.granted = true
  `;

  if (result.length === 0) {
    return { isLocked: false };
  }

  const lock = result[0]!;
  return {
    isLocked: true,
    holderPid: lock.pid,
    ...(lock.query_start && { lockedSince: lock.query_start }),
  };
}

/**
 * Execute a function while holding the migration lock
 *
 * This is the recommended way to run migrations as it ensures
 * the lock is always released, even if an error occurs.
 *
 * @param prisma - Prisma client instance
 * @param fn - Function to execute while holding the lock
 * @param options - Lock acquisition options
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await withMigrationLock(prisma, async () => {
 *   // Run your data migration
 *   await prisma.user.updateMany({
 *     where: { status: null },
 *     data: { status: 'ACTIVE' }
 *   });
 *   return { success: true };
 * });
 * ```
 */
export async function withMigrationLock<T>(
  prisma: PrismaClient,
  fn: () => Promise<T>,
  options: MigrationLockOptions = {}
): Promise<T> {
  const acquired = await acquireMigrationLock(prisma, options);

  if (!acquired) {
    throw new Error('Could not acquire migration lock');
  }

  try {
    return await fn();
  } finally {
    await releaseMigrationLock(prisma);
  }
}

/**
 * Force release the migration lock
 *
 * ⚠️ USE WITH CAUTION: This releases all advisory locks held by the current session.
 * Only use this for emergency recovery when a lock is stuck.
 *
 * @param prisma - Prisma client instance
 */
export async function forceReleaseMigrationLock(
  prisma: PrismaClient
): Promise<void> {
  console.warn('⚠️ Force releasing migration lock...');

  await prisma.$queryRaw`
    SELECT pg_advisory_unlock_all()
  `;

  console.log('🔓 All advisory locks released');
}

/**
 * Wait for the migration lock to be released
 *
 * Useful for processes that need to wait for an ongoing migration to complete
 * before starting their own work.
 *
 * @param prisma - Prisma client instance
 * @param timeoutMs - Maximum time to wait
 * @returns true if lock was released within timeout
 *
 * @example
 * ```typescript
 * console.log('Waiting for any ongoing migrations...');
 * const released = await waitForMigrationLock(prisma, 120000);
 * if (!released) {
 *   throw new Error('Timeout waiting for migration to complete');
 * }
 * ```
 */
export async function waitForMigrationLock(
  prisma: PrismaClient,
  timeoutMs: number = DEFAULT_LOCK_TIMEOUT_MS
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await getMigrationLockStatus(prisma);

    if (!status.isLocked) {
      return true;
    }

    console.log(
      `⏳ Migration in progress (PID: ${status.holderPid}), waiting...`
    );
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
  }

  return false;
}
