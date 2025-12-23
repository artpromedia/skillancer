/**
 * Audit Logging Service
 *
 * Specialized logging for compliance and security audit trails.
 * Provides structured audit logs for tracking user actions and security events.
 */

import { getContext } from './context.js';

import type { Logger } from 'pino';

/**
 * Audit action types for tracking user and system events
 */
export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'PERMISSION_GRANT'
  | 'PERMISSION_REVOKE'
  | 'DATA_EXPORT'
  | 'DATA_IMPORT'
  | 'SETTINGS_CHANGE'
  | 'CONFIG_CHANGE'
  | 'PAYMENT_PROCESS'
  | 'REFUND_PROCESS'
  | 'ACCOUNT_SUSPEND'
  | 'ACCOUNT_ACTIVATE'
  | 'API_KEY_CREATE'
  | 'API_KEY_REVOKE'
  | 'INTEGRATION_CONNECT'
  | 'INTEGRATION_DISCONNECT'
  | 'MFA_ENABLE'
  | 'MFA_DISABLE'
  | 'SESSION_CREATE'
  | 'SESSION_REVOKE'
  | 'ROLE_ASSIGN'
  | 'ROLE_REMOVE';

/**
 * Actor information - who performed the action
 */
export interface AuditActor {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  tenantId?: string;
}

/**
 * Target of the action
 */
export interface AuditTarget {
  type: string;
  id: string;
  name?: string;
  ownerId?: string;
}

/**
 * Changes made during the action
 */
export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  fields?: string[];
}

/**
 * Complete audit log entry
 */
export interface AuditLogEntry {
  timestamp: Date;
  action: AuditAction;
  actor: AuditActor;
  target: AuditTarget;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  changes?: AuditChanges;
  metadata?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  reason?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Audit Logger for creating compliance audit trails
 */
export class AuditLogger {
  private logger: Logger;
  private serviceName: string;
  private environment: string;

  constructor(logger: Logger, serviceName: string, environment: string = 'development') {
    this.logger = logger;
    this.serviceName = serviceName;
    this.environment = environment;
  }

  /**
   * Log an audit event
   */
  log(entry: AuditLogEntry): void {
    const ctx = getContext();

    const auditLog = {
      '@type': 'audit',
      timestamp: entry.timestamp.toISOString(),
      action: entry.action,
      actor: this.sanitizeActor(entry.actor),
      target: entry.target,
      outcome: entry.outcome,
      changes: entry.changes ? this.sanitizeChanges(entry.changes) : undefined,
      metadata: entry.metadata,
      requestId: entry.requestId ?? ctx?.requestId,
      traceId: entry.traceId ?? ctx?.traceId,
      reason: entry.reason,
      riskLevel: entry.riskLevel ?? this.calculateRiskLevel(entry),
      service: this.serviceName,
      environment: this.environment,
    };

    // Use info level for successful audits, warn for failures
    if (entry.outcome === 'SUCCESS') {
      this.logger.info(
        auditLog,
        `Audit: ${entry.action} on ${entry.target.type}/${entry.target.id}`
      );
    } else {
      this.logger.warn(
        auditLog,
        `Audit: ${entry.action} FAILED on ${entry.target.type}/${entry.target.id}`
      );
    }
  }

  /**
   * Log a successful CRUD operation
   */
  logCrud(
    action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    target: AuditTarget,
    actor: AuditActor,
    changes?: AuditChanges,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      timestamp: new Date(),
      action,
      actor,
      target,
      outcome: 'SUCCESS',
      changes,
      metadata,
    });
  }

  /**
   * Log an authentication event
   */
  logAuth(
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED',
    actor: AuditActor,
    outcome: 'SUCCESS' | 'FAILURE',
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      timestamp: new Date(),
      action,
      actor,
      target: {
        type: 'session',
        id: actor.sessionId ?? 'unknown',
      },
      outcome,
      metadata,
      riskLevel: action === 'LOGIN_FAILED' ? 'MEDIUM' : 'LOW',
    });
  }

  /**
   * Log a security-related event
   */
  logSecurity(
    action: AuditAction,
    actor: AuditActor,
    target: AuditTarget,
    outcome: 'SUCCESS' | 'FAILURE',
    reason?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      timestamp: new Date(),
      action,
      actor,
      target,
      outcome,
      reason,
      metadata,
      riskLevel: outcome === 'FAILURE' ? 'HIGH' : 'MEDIUM',
    });
  }

  /**
   * Log a data access event (for compliance)
   */
  logDataAccess(
    actor: AuditActor,
    target: AuditTarget,
    accessType: 'VIEW' | 'EXPORT' | 'MODIFY',
    metadata?: Record<string, unknown>
  ): void {
    const actionMap: Record<string, AuditAction> = {
      VIEW: 'READ',
      EXPORT: 'DATA_EXPORT',
      MODIFY: 'UPDATE',
    };

    this.log({
      timestamp: new Date(),
      action: actionMap[accessType] ?? 'READ',
      actor,
      target,
      outcome: 'SUCCESS',
      metadata: {
        ...metadata,
        accessType,
        complianceRelevant: true,
      },
    });
  }

  /**
   * Log a payment-related event
   */
  logPayment(
    action: 'PAYMENT_PROCESS' | 'REFUND_PROCESS',
    actor: AuditActor,
    target: AuditTarget,
    outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL',
    amount?: number,
    currency?: string,
    metadata?: Record<string, unknown>
  ): void {
    this.log({
      timestamp: new Date(),
      action,
      actor,
      target,
      outcome,
      metadata: {
        ...metadata,
        amount,
        currency,
        pciRelevant: true,
      },
      riskLevel: 'HIGH',
    });
  }

  /**
   * Sanitize actor data (remove sensitive info for logs)
   */
  private sanitizeActor(actor: AuditActor): AuditActor {
    return {
      userId: actor.userId,
      userEmail: actor.userEmail ? this.maskEmail(actor.userEmail) : undefined,
      userRole: actor.userRole,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent ? actor.userAgent.substring(0, 100) : undefined,
      sessionId: actor.sessionId,
      tenantId: actor.tenantId,
    };
  }

  /**
   * Sanitize changes (remove sensitive field values)
   */
  private sanitizeChanges(changes: AuditChanges): AuditChanges {
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'];

    const sanitizeObj = (
      obj: Record<string, unknown> | undefined
    ): Record<string, unknown> | undefined => {
      if (!obj) return undefined;

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return {
      before: sanitizeObj(changes.before),
      after: sanitizeObj(changes.after),
      fields: changes.fields,
    };
  }

  /**
   * Mask email for privacy
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '[INVALID_EMAIL]';

    const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***';

    return `${maskedLocal}@${domain}`;
  }

  /**
   * Calculate risk level based on action type
   */
  private calculateRiskLevel(entry: AuditLogEntry): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const highRiskActions: AuditAction[] = [
      'DELETE',
      'PERMISSION_GRANT',
      'PERMISSION_REVOKE',
      'API_KEY_CREATE',
      'API_KEY_REVOKE',
      'ACCOUNT_SUSPEND',
      'MFA_DISABLE',
      'PASSWORD_RESET',
    ];

    const criticalActions: AuditAction[] = ['PAYMENT_PROCESS', 'REFUND_PROCESS', 'DATA_EXPORT'];

    const mediumRiskActions: AuditAction[] = [
      'UPDATE',
      'LOGIN_FAILED',
      'SETTINGS_CHANGE',
      'CONFIG_CHANGE',
      'INTEGRATION_CONNECT',
    ];

    if (entry.outcome === 'FAILURE') {
      return highRiskActions.includes(entry.action) ? 'CRITICAL' : 'HIGH';
    }

    if (criticalActions.includes(entry.action)) {
      return 'CRITICAL';
    }

    if (highRiskActions.includes(entry.action)) {
      return 'HIGH';
    }

    if (mediumRiskActions.includes(entry.action)) {
      return 'MEDIUM';
    }

    return 'LOW';
  }
}

/**
 * Create an audit logger instance
 */
export function createAuditLogger(
  logger: Logger,
  serviceName: string,
  environment?: string
): AuditLogger {
  return new AuditLogger(logger, serviceName, environment);
}
