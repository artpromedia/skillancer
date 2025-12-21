/**
 * @module @skillancer/database/extensions/soft-delete
 * Prisma extension for automatic soft delete handling
 */
/**
 * Models that support soft delete (have deletedAt field)
 */
export declare const SOFT_DELETE_MODELS: readonly ["User", "Tenant", "Job", "Service"];
export type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];
/**
 * Check if a model supports soft delete
 */
export declare function isSoftDeleteModel(model: string): model is SoftDeleteModel;
/**
 * Prisma extension for soft delete functionality
 *
 * Features:
 * - Automatically filters out soft-deleted records on find operations
 * - Converts delete operations to soft deletes (sets deletedAt)
 * - Provides methods to include or restore soft-deleted records
 *
 * @example
 * ```typescript
 * import { prisma } from '@skillancer/database';
 * import { softDeleteExtension } from '@skillancer/database/extensions/soft-delete';
 *
 * const db = prisma.$extends(softDeleteExtension);
 *
 * // Automatically excludes soft-deleted users
 * const users = await db.user.findMany();
 *
 * // Include soft-deleted records
 * const allUsers = await db.user.findMany({
 *   where: { deletedAt: { not: null } }
 * });
 * ```
 */
export declare const softDeleteExtension: (client: any) => {
    $extends: {
        extArgs: import("@prisma/client/runtime/library").InternalArgs<unknown, unknown, {}, unknown>;
    };
};
/**
 * Type for Prisma client extended with soft delete
 */
export type SoftDeleteClient = ReturnType<typeof softDeleteExtension>;
/**
 * Restore a soft-deleted record by ID
 */
export declare function restoreById<T extends SoftDeleteModel>(client: any, model: T, id: string): Promise<void>;
/**
 * Hard delete a record (permanently remove from database)
 */
export declare function hardDeleteById<T extends SoftDeleteModel>(client: any, model: T, id: string): Promise<void>;
/**
 * Find records including soft-deleted ones
 */
export declare function withDeleted<T>(whereClause: T): T & {
    deletedAt?: unknown;
};
/**
 * Find only soft-deleted records
 */
export declare function onlyDeleted<T>(whereClause: T): T & {
    deletedAt: {
        not: null;
    };
};
//# sourceMappingURL=soft-delete.d.ts.map