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
export declare function tryAcquireMigrationLock(prisma: PrismaClient): Promise<boolean>;
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
export declare function acquireMigrationLock(prisma: PrismaClient, options?: MigrationLockOptions): Promise<boolean>;
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
export declare function releaseMigrationLock(prisma: PrismaClient): Promise<void>;
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
export declare function getMigrationLockStatus(prisma: PrismaClient): Promise<LockStatus>;
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
export declare function withMigrationLock<T>(prisma: PrismaClient, fn: () => Promise<T>, options?: MigrationLockOptions): Promise<T>;
/**
 * Force release the migration lock
 *
 * ⚠️ USE WITH CAUTION: This releases all advisory locks held by the current session.
 * Only use this for emergency recovery when a lock is stuck.
 *
 * @param prisma - Prisma client instance
 */
export declare function forceReleaseMigrationLock(prisma: PrismaClient): Promise<void>;
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
export declare function waitForMigrationLock(prisma: PrismaClient, timeoutMs?: number): Promise<boolean>;
//# sourceMappingURL=migration-lock.d.ts.map