/**
 * @module @skillancer/audit-svc/decorators/audit.decorators
 * TypeScript decorators for explicit audit logging
 */

import { queueAuditLog } from '../services/audit-log.service.js';
import {
  ActorType,
  AuditCategory,
  OutcomeStatus,
  ComplianceTag,
  type RetentionPolicy,
  type AuditLogParams,
} from '../types/index.js';

/**
 * Configuration for @Audited decorator
 */
export interface AuditedConfig {
  /** Event type to log */
  eventType: string;
  /** Audit category */
  category: AuditCategory;
  /** Human-readable action description */
  action: string;
  /** Resource type being affected */
  resourceType: string;
  /** Index of the parameter that contains the resource ID (0-based) */
  resourceIdParam?: number;
  /** Property name on the result that contains the resource ID */
  resourceIdFromResult?: string;
  /** Compliance tags */
  complianceTags?: string[];
  /** Retention policy */
  retentionPolicy?: 'SHORT' | 'STANDARD' | 'EXTENDED' | 'PERMANENT';
  /** Index of the parameter that contains actor info (0-based) */
  actorParam?: number;
  /** Whether to capture method arguments in audit log */
  captureArgs?: boolean;
  /** Whether to capture method result in audit log */
  captureResult?: boolean;
  /** Fields to exclude from capture */
  excludeFields?: string[];
  /** Only audit on specific conditions */
  condition?: (args: unknown[], result: unknown) => boolean;
}

/**
 * Configuration for @AuditDataChange decorator
 */
export interface AuditDataChangeConfig extends AuditedConfig {
  /** Index of the parameter that contains the 'before' state */
  beforeParam?: number;
  /** Index of the parameter that contains the 'after' state (or use result) */
  afterParam?: number;
  /** Function to get current state before method execution */
  getCurrentState?: (args: unknown[]) => Promise<Record<string, unknown> | undefined>;
}

/**
 * Context holder for audit operations
 */
export interface AuditContext {
  actorId: string;
  actorType?: ActorType;
  actorEmail?: string;
  actorRoles?: string[];
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

// Thread-local storage for audit context
const auditContextStorage = new Map<string, AuditContext>();

/**
 * Set the audit context for the current operation
 */
export function setAuditContext(correlationId: string, context: AuditContext): void {
  auditContextStorage.set(correlationId, context);
}

/**
 * Get the audit context for the current operation
 */
export function getAuditContext(correlationId: string): AuditContext | undefined {
  return auditContextStorage.get(correlationId);
}

/**
 * Clear the audit context
 */
export function clearAuditContext(correlationId: string): void {
  auditContextStorage.delete(correlationId);
}

/**
 * Redact sensitive fields from data
 */
function redactSensitiveFields(
  data: unknown,
  excludeFields: string[] = []
): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /apikey/i,
    /api_key/i,
    /credit.*card/i,
    /card.*number/i,
    /cvv/i,
    /ssn/i,
    /social.*security/i,
  ];

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isSensitive =
      sensitivePatterns.some((p) => p.test(key)) ||
      excludeFields.some((f) => key.toLowerCase().includes(f.toLowerCase()));

    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactSensitiveFields(value, excludeFields);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Calculate the diff between two objects
 */
function calculateDiff(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
  const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

  if (!before && !after) return changes;

  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

  for (const key of allKeys) {
    const oldVal = before?.[key];
    const newVal = after?.[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  return changes;
}

/**
 * Extract actor from method arguments
 */
function extractActorFromArgs(args: unknown[], actorParam?: number): AuditLogParams['actor'] {
  if (actorParam !== undefined && args[actorParam]) {
    const actorArg = args[actorParam] as Record<string, unknown>;
    return {
      id: (actorArg.id ?? actorArg.userId ?? actorArg.actorId ?? 'unknown') as string,
      type: (actorArg.type as ActorType) ?? ActorType.USER,
      email: actorArg.email as string | undefined,
    };
  }

  // Try to find actor in first object argument
  const firstObj = args.find((a) => a && typeof a === 'object') as
    | Record<string, unknown>
    | undefined;
  if (firstObj?.actorId || firstObj?.userId) {
    return {
      id: (firstObj.actorId ?? firstObj.userId) as string,
      type: ActorType.USER,
    };
  }

  return {
    id: 'system',
    type: ActorType.SYSTEM,
  };
}

/**
 * Extract resource ID from method arguments or result
 */
function extractResourceId(args: unknown[], result: unknown, config: AuditedConfig): string {
  if (config.resourceIdParam !== undefined && args[config.resourceIdParam]) {
    const arg = args[config.resourceIdParam];
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'object' && arg !== null) {
      const obj = arg as Record<string, unknown>;
      return (obj.id ?? obj.resourceId ?? 'unknown') as string;
    }
  }

  if (config.resourceIdFromResult && result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    return (obj[config.resourceIdFromResult] ?? obj.id ?? 'unknown') as string;
  }

  // Try to find ID in first argument
  if (typeof args[0] === 'string') return args[0];
  if (args[0] && typeof args[0] === 'object') {
    const obj = args[0] as Record<string, unknown>;
    return (obj.id ?? obj.resourceId ?? 'unknown') as string;
  }

  return 'unknown';
}

/**
 * @Audited decorator - logs method calls to audit system
 *
 * @example
 * ```typescript
 * @Audited({
 *   eventType: 'PROJECT_CREATED',
 *   category: AuditCategory.DATA,
 *   action: 'Created new project',
 *   resourceType: 'project',
 *   resourceIdFromResult: 'id',
 * })
 * async createProject(data: CreateProjectDto): Promise<Project> {
 *   // ...
 * }
 * ```
 */
export function Audited(config: AuditedConfig) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const startTime = Date.now();
      let result: unknown;
      let error: Error | undefined;
      let shouldLog = true;

      try {
        result = await originalMethod.apply(this, args);
      } catch (err) {
        error = err as Error;
      }

      // Check condition if provided
      if (config.condition && !config.condition(args, result)) {
        shouldLog = false;
      }

      if (shouldLog) {
        const duration = Date.now() - startTime;
        const isSuccess = !error;
        const resourceId = extractResourceId(args, result, config);

        const auditParams: AuditLogParams = {
          eventType: config.eventType,
          eventCategory: config.category,
          action: config.action,
          actor: extractActorFromArgs(args, config.actorParam),
          resource: {
            type: config.resourceType,
            id: resourceId,
          },
          outcome: {
            status: isSuccess ? OutcomeStatus.SUCCESS : OutcomeStatus.FAILURE,
            duration,
            errorMessage: error?.message,
            errorCode: error?.name,
          },
          complianceTags: config.complianceTags as ComplianceTag[] | undefined,
          retentionPolicy: config.retentionPolicy as RetentionPolicy | undefined,
          metadata: {
            method: propertyKey,
            className: this?.constructor?.name,
          },
        };

        // Capture args if configured
        if (config.captureArgs) {
          const sanitizedArgs = args.map((a) =>
            a && typeof a === 'object' ? redactSensitiveFields(a, config.excludeFields) : a
          );
          auditParams.changes = {
            ...(auditParams.changes ?? {}),
            before: sanitizedArgs as unknown as Record<string, unknown>,
          };
        }

        // Capture result if configured
        if (config.captureResult && result && typeof result === 'object') {
          auditParams.changes = {
            ...(auditParams.changes ?? {}),
            after: redactSensitiveFields(result, config.excludeFields),
          };
        }

        // Queue audit log asynchronously
        queueAuditLog(auditParams).catch((err) => {
          console.error('[AUDIT] Failed to queue audit log:', err);
        });
      }

      // Re-throw error or return result
      if (error) {
        throw error;
      }
      return result;
    };

    return descriptor;
  };
}

/**
 * @AuditDataChange decorator - tracks data changes with before/after states
 *
 * @example
 * ```typescript
 * @AuditDataChange({
 *   eventType: 'USER_PROFILE_UPDATED',
 *   category: AuditCategory.DATA,
 *   action: 'Updated user profile',
 *   resourceType: 'user',
 *   resourceIdParam: 0,
 *   getCurrentState: async (args) => getCurrentUser(args[0] as string),
 * })
 * async updateUserProfile(userId: string, updates: UpdateDto): Promise<User> {
 *   // ...
 * }
 * ```
 */
export function AuditDataChange(config: AuditDataChangeConfig) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const startTime = Date.now();
      let beforeState: Record<string, unknown> | undefined;
      let result: unknown;
      let error: Error | undefined;
      let shouldLog = true;

      // Get current state before execution if configured
      if (config.getCurrentState) {
        try {
          beforeState = await config.getCurrentState(args);
        } catch (err) {
          console.warn('[AUDIT] Failed to get current state:', err);
        }
      } else if (config.beforeParam !== undefined) {
        const beforeArg = args[config.beforeParam];
        if (beforeArg && typeof beforeArg === 'object') {
          beforeState = redactSensitiveFields(beforeArg, config.excludeFields);
        }
      }

      try {
        result = await originalMethod.apply(this, args);
      } catch (err) {
        error = err as Error;
      }

      // Check condition if provided
      if (config.condition && !config.condition(args, result)) {
        shouldLog = false;
      }

      if (shouldLog) {
        const duration = Date.now() - startTime;
        const isSuccess = !error;
        const resourceId = extractResourceId(args, result, config);

        // Determine after state
        let afterState: Record<string, unknown> | undefined;
        if (config.afterParam !== undefined) {
          const afterArg = args[config.afterParam];
          if (afterArg && typeof afterArg === 'object') {
            afterState = redactSensitiveFields(afterArg, config.excludeFields);
          }
        } else if (result && typeof result === 'object') {
          afterState = redactSensitiveFields(result, config.excludeFields);
        }

        // Calculate diff
        const diff = calculateDiff(beforeState, afterState);

        const auditParams: AuditLogParams = {
          eventType: config.eventType,
          eventCategory: config.category,
          action: config.action,
          actor: extractActorFromArgs(args, config.actorParam),
          resource: {
            type: config.resourceType,
            id: resourceId,
          },
          outcome: {
            status: isSuccess ? OutcomeStatus.SUCCESS : OutcomeStatus.FAILURE,
            duration,
            errorMessage: error?.message,
            errorCode: error?.name,
          },
          changes: {
            before: beforeState,
            after: afterState,
            diff,
          },
          complianceTags: config.complianceTags as ComplianceTag[] | undefined,
          retentionPolicy: config.retentionPolicy as RetentionPolicy | undefined,
          metadata: {
            method: propertyKey,
            className: this?.constructor?.name,
            changedFields: diff.map((d) => d.field),
          },
        };

        // Queue audit log asynchronously
        queueAuditLog(auditParams).catch((err) => {
          console.error('[AUDIT] Failed to queue audit log:', err);
        });
      }

      // Re-throw error or return result
      if (error) {
        throw error;
      }
      return result;
    };

    return descriptor;
  };
}

/**
 * @AuditAccess decorator - for logging data access/read operations
 *
 * @example
 * ```typescript
 * @AuditAccess({
 *   eventType: 'USER_DATA_ACCESSED',
 *   resourceType: 'user',
 *   complianceTags: ['GDPR', 'HIPAA'],
 * })
 * async getUserData(userId: string): Promise<UserData> {
 *   // ...
 * }
 * ```
 */
export function AuditAccess(
  config: Omit<AuditedConfig, 'category' | 'action'> & { action?: string }
) {
  return Audited({
    ...config,
    category: AuditCategory.DATA_ACCESS,
    action: config.action ?? `Accessed ${config.resourceType}`,
  });
}

/**
 * @AuditSecurity decorator - for security-sensitive operations
 *
 * @example
 * ```typescript
 * @AuditSecurity({
 *   eventType: 'PASSWORD_CHANGED',
 *   resourceType: 'user',
 *   action: 'Changed password',
 * })
 * async changePassword(userId: string, newPassword: string): Promise<void> {
 *   // ...
 * }
 * ```
 */
export function AuditSecurity(config: Omit<AuditedConfig, 'category' | 'retentionPolicy'>) {
  return Audited({
    ...config,
    category: AuditCategory.SECURITY,
    retentionPolicy: 'EXTENDED',
    complianceTags: [...(config.complianceTags ?? []), ComplianceTag.SOC2] as string[],
  });
}
