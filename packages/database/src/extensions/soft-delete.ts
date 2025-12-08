/**
 * @module @skillancer/database/extensions/soft-delete
 * Prisma extension for automatic soft delete handling
 */

import { Prisma } from '@prisma/client';

/**
 * Models that support soft delete (have deletedAt field)
 */
export const SOFT_DELETE_MODELS = [
  'User',
  'Tenant',
  'Job',
  'Service',
] as const;

export type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

/**
 * Check if a model supports soft delete
 */
export function isSoftDeleteModel(model: string): model is SoftDeleteModel {
  return SOFT_DELETE_MODELS.includes(model as SoftDeleteModel);
}

/**
 * Helper to add soft delete filter to where clause
 */
function addSoftDeleteFilter(where: Record<string, unknown> | undefined): Record<string, unknown> {
  const currentWhere = where ?? {};
  // Only add filter if deletedAt is not already specified
  if (!('deletedAt' in currentWhere)) {
    return { ...currentWhere, deletedAt: null };
  }
  return currentWhere;
}

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
export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    $allModels: {
      async findMany({ model, operation, args, query }) {
        if (isSoftDeleteModel(model)) {
          (args as any).where = addSoftDeleteFilter((args as any).where);
        }
        return query(args);
      },

      async findFirst({ model, operation, args, query }) {
        if (isSoftDeleteModel(model)) {
          (args as any).where = addSoftDeleteFilter((args as any).where);
        }
        return query(args);
      },

      async findUnique({ model, operation, args, query }) {
        if (isSoftDeleteModel(model)) {
          // findUnique doesn't support complex where clauses
          // So we need to be careful here
          return query(args);
        }
        return query(args);
      },

      async count({ model, operation, args, query }) {
        if (isSoftDeleteModel(model)) {
          (args as any).where = addSoftDeleteFilter((args as any).where);
        }
        return query(args);
      },

      async aggregate({ model, operation, args, query }) {
        if (isSoftDeleteModel(model)) {
          (args as any).where = addSoftDeleteFilter((args as any).where);
        }
        return query(args);
      },

      async delete({ model, operation, args, query }) {
        if (isSoftDeleteModel(model)) {
          // Convert delete to soft delete
          return (query as Function)({
            ...args,
            data: { deletedAt: new Date() },
          });
        }
        return query(args);
      },

      async deleteMany({ model, operation, args, query }) {
        if (isSoftDeleteModel(model)) {
          // Convert deleteMany to updateMany with soft delete
          return (query as Function)({
            ...args,
            data: { deletedAt: new Date() },
          });
        }
        return query(args);
      },
    },
  },
});

/**
 * Type for Prisma client extended with soft delete
 */
export type SoftDeleteClient = ReturnType<typeof softDeleteExtension>;

/**
 * Restore a soft-deleted record by ID
 */
export async function restoreById<T extends SoftDeleteModel>(
  client: any,
  model: T,
  id: string
): Promise<void> {
  const modelClient = client[model.charAt(0).toLowerCase() + model.slice(1)];
  await modelClient.update({
    where: { id },
    data: { deletedAt: null },
  });
}

/**
 * Hard delete a record (permanently remove from database)
 */
export async function hardDeleteById<T extends SoftDeleteModel>(
  client: any,
  model: T,
  id: string
): Promise<void> {
  // Use raw query to bypass soft delete extension
  const tableName = model.toLowerCase() + 's';
  await client.$executeRawUnsafe(
    `DELETE FROM ${tableName} WHERE id = $1`,
    id
  );
}

/**
 * Find records including soft-deleted ones
 */
export function withDeleted<T>(whereClause: T): T & { deletedAt?: unknown } {
  return {
    ...whereClause,
    deletedAt: undefined, // Remove the soft delete filter
  };
}

/**
 * Find only soft-deleted records
 */
export function onlyDeleted<T>(
  whereClause: T
): T & { deletedAt: { not: null } } {
  return {
    ...whereClause,
    deletedAt: { not: null },
  };
}
