/**
 * @module @skillancer/database/extensions/audit-log
 * Prisma extension for automatic audit logging
 */
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
export declare const AUDITED_MODELS: readonly [
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
];
export type AuditedModel = (typeof AUDITED_MODELS)[number];
/**
 * Operations that should be audited
 */
export declare const AUDITED_OPERATIONS: readonly [
  'create',
  'update',
  'delete',
  'deleteMany',
  'updateMany',
];
export type AuditedOperation = (typeof AUDITED_OPERATIONS)[number];
/**
 * Check if a model should be audited
 */
export declare function isAuditedModel(model: string): model is AuditedModel;
/**
 * Check if an operation should be audited
 */
export declare function isAuditedOperation(operation: string): operation is AuditedOperation;
/**
 * Set the global audit context
 */
export declare function setAuditContext(context: AuditContext): void;
/**
 * Get the current audit context
 */
export declare function getAuditContext(): AuditContext;
/**
 * Clear the audit context
 */
export declare function clearAuditContext(): void;
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
export declare const auditLogExtension: (client: any) => {
  $extends: {
    extArgs: {
      result: {};
      model: {};
      query: {};
      client: {};
    };
  };
};
/**
 * Query audit logs for an entity
 */
export declare function getAuditHistory(
  client: any,
  entityType: string,
  entityId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<unknown[]>;
/**
 * Query audit logs by user
 */
export declare function getAuditLogsByUser(
  client: any,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    action?: string;
  }
): Promise<unknown[]>;
/**
 * Type for Prisma client extended with audit logging
 */
export type AuditLogClient = ReturnType<typeof auditLogExtension>;
//# sourceMappingURL=audit-log.d.ts.map
