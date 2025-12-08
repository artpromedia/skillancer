/**
 * @module @skillancer/database/extensions/audit-log
 * Prisma extension for automatic audit logging
 */

import { Prisma } from '@prisma/client';

/**
 * Context for audit logging (usually from request)
 */
export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Models that should be audited
 */
export const AUDITED_MODELS = [
  'User',
  'Tenant',
  'TenantMember',
  'Job',
  'Bid',
  'Contract',
  'Milestone',
  'Service',
  'Session',
  'Payment',
  'Review',
] as const;

export type AuditedModel = (typeof AUDITED_MODELS)[number];

/**
 * Operations that should be audited
 */
export const AUDITED_OPERATIONS = [
  'create',
  'update',
  'delete',
  'deleteMany',
  'updateMany',
] as const;

export type AuditedOperation = (typeof AUDITED_OPERATIONS)[number];

/**
 * Check if a model should be audited
 */
export function isAuditedModel(model: string): model is AuditedModel {
  return AUDITED_MODELS.includes(model as AuditedModel);
}

/**
 * Check if an operation should be audited
 */
export function isAuditedOperation(
  operation: string
): operation is AuditedOperation {
  return AUDITED_OPERATIONS.includes(operation as AuditedOperation);
}

/**
 * Global audit context - set this before operations
 * In a real app, this would be set from request middleware
 */
let globalAuditContext: AuditContext = {};

/**
 * Set the global audit context
 */
export function setAuditContext(context: AuditContext): void {
  globalAuditContext = context;
}

/**
 * Get the current audit context
 */
export function getAuditContext(): AuditContext {
  return globalAuditContext;
}

/**
 * Clear the audit context
 */
export function clearAuditContext(): void {
  globalAuditContext = {};
}

/**
 * Prisma extension for automatic audit logging
 *
 * Features:
 * - Automatically logs create, update, delete operations
 * - Captures old and new values for updates
 * - Includes user context (userId, IP, user agent)
 * - Configurable per-model audit settings
 *
 * @example
 * ```typescript
 * import { prisma } from '@skillancer/database';
 * import { auditLogExtension, setAuditContext } from '@skillancer/database/extensions/audit-log';
 *
 * const db = prisma.$extends(auditLogExtension);
 *
 * // Set context before operations
 * setAuditContext({
 *   userId: 'user-123',
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...'
 * });
 *
 * // Operations are automatically logged
 * await db.user.update({
 *   where: { id: 'user-123' },
 *   data: { firstName: 'John' }
 * });
 * ```
 */
export const auditLogExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'audit-log',
    query: {
      $allModels: {
        async create({ model, operation, args, query }) {
          const result = await query(args);

          if (isAuditedModel(model)) {
            const entityId = (result as { id?: string }).id;
            await logAuditEvent(client, {
              action: 'CREATE',
              entityType: model,
              ...(entityId && { entityId }),
              newValues: args.data,
            });
          }

          return result;
        },

        async update({ model, operation, args, query }) {
          let oldValues: unknown = null;

          if (isAuditedModel(model) && args.where) {
            try {
              // Fetch old values before update
              const modelClient = (client as any)[
                model.charAt(0).toLowerCase() + model.slice(1)
              ];
              oldValues = await modelClient.findUnique({
                where: args.where,
              });
            } catch {
              // Ignore errors fetching old values
            }
          }

          const result = await query(args);

          if (isAuditedModel(model)) {
            const entityId = (result as { id?: string }).id;
            await logAuditEvent(client, {
              action: 'UPDATE',
              entityType: model,
              ...(entityId && { entityId }),
              oldValues,
              newValues: args.data,
            });
          }

          return result;
        },

        async delete({ model, operation, args, query }) {
          let oldValues: unknown = null;

          if (isAuditedModel(model) && args.where) {
            try {
              const modelClient = (client as any)[
                model.charAt(0).toLowerCase() + model.slice(1)
              ];
              oldValues = await modelClient.findUnique({
                where: args.where,
              });
            } catch {
              // Ignore errors
            }
          }

          const result = await query(args);

          if (isAuditedModel(model)) {
            const entityId = (oldValues as { id?: string })?.id;
            await logAuditEvent(client, {
              action: 'DELETE',
              entityType: model,
              ...(entityId && { entityId }),
              oldValues,
            });
          }

          return result;
        },

        async updateMany({ model, operation, args, query }) {
          const result = await query(args);

          if (isAuditedModel(model)) {
            await logAuditEvent(client, {
              action: 'UPDATE_MANY',
              entityType: model,
              newValues: args.data,
              metadata: {
                where: args.where,
                count: (result as { count?: number }).count,
              },
            });
          }

          return result;
        },

        async deleteMany({ model, operation, args, query }) {
          const result = await query(args);

          if (isAuditedModel(model)) {
            await logAuditEvent(client, {
              action: 'DELETE_MANY',
              entityType: model,
              metadata: {
                where: args.where,
                count: (result as { count?: number }).count,
              },
            });
          }

          return result;
        },
      },
    },
  });
});

/**
 * Internal function to log audit events
 */
async function logAuditEvent(
  client: any,
  event: {
    action: string;
    entityType: string;
    entityId?: string;
    oldValues?: unknown;
    newValues?: unknown;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const context = getAuditContext();

  try {
    await client.auditLog.create({
      data: {
        userId: context.userId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        oldValues: event.oldValues ? JSON.parse(JSON.stringify(event.oldValues)) : null,
        newValues: event.newValues ? JSON.parse(JSON.stringify(event.newValues)) : null,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          ...context.metadata,
          ...event.metadata,
        },
      },
    });
  } catch (error) {
    // Don't let audit logging failures break the main operation
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Query audit logs for an entity
 */
export async function getAuditHistory(
  client: any,
  entityType: string,
  entityId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<unknown[]> {
  return client.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Query audit logs by user
 */
export async function getAuditLogsByUser(
  client: any,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    action?: string;
  }
): Promise<unknown[]> {
  return client.auditLog.findMany({
    where: {
      userId,
      ...(options?.action && { action: options.action }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}

/**
 * Type for Prisma client extended with audit logging
 */
export type AuditLogClient = ReturnType<typeof auditLogExtension>;
