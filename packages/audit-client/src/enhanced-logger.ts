/**
 * Enhanced Audit Logger
 * SOC 2 compliant comprehensive audit logging
 */

import { randomBytes, createHash } from 'crypto';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  category: AuditCategory;
  severity: AuditSeverity;
  actor: AuditActor;
  target: AuditTarget;
  action: string;
  outcome: 'success' | 'failure' | 'unknown';
  details: Record<string, unknown>;
  metadata: AuditMetadata;
  hash: string; // For tamper detection
  previousHash?: string; // Chain for integrity
}

export interface AuditActor {
  type: 'user' | 'system' | 'service' | 'api_key' | 'anonymous';
  id?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  roles?: string[];
}

export interface AuditTarget {
  type: string; // 'user', 'project', 'skillpod', 'file', 'setting', etc.
  id?: string;
  name?: string;
  resourcePath?: string;
}

export interface AuditMetadata {
  service: string;
  version: string;
  environment: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  duration?: number;
  dataClassification?: DataClassification;
}

export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILURE = 'auth.login.failure',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_MFA_ENABLED = 'auth.mfa.enabled',
  AUTH_MFA_DISABLED = 'auth.mfa.disabled',
  AUTH_MFA_VERIFIED = 'auth.mfa.verified',
  AUTH_MFA_FAILED = 'auth.mfa.failed',
  AUTH_PASSWORD_CHANGE = 'auth.password.change',
  AUTH_PASSWORD_RESET = 'auth.password.reset',
  AUTH_SESSION_CREATED = 'auth.session.created',
  AUTH_SESSION_EXPIRED = 'auth.session.expired',
  AUTH_SESSION_REVOKED = 'auth.session.revoked',
  AUTH_TOKEN_ISSUED = 'auth.token.issued',
  AUTH_TOKEN_REVOKED = 'auth.token.revoked',
  AUTH_LOCKOUT = 'auth.lockout',

  // Authorization events
  AUTHZ_ACCESS_GRANTED = 'authz.access.granted',
  AUTHZ_ACCESS_DENIED = 'authz.access.denied',
  AUTHZ_ROLE_ASSIGNED = 'authz.role.assigned',
  AUTHZ_ROLE_REMOVED = 'authz.role.removed',
  AUTHZ_PERMISSION_GRANTED = 'authz.permission.granted',
  AUTHZ_PERMISSION_REVOKED = 'authz.permission.revoked',
  AUTHZ_PRIVILEGE_ESCALATION = 'authz.privilege.escalation',

  // Data access events
  DATA_CREATE = 'data.create',
  DATA_READ = 'data.read',
  DATA_UPDATE = 'data.update',
  DATA_DELETE = 'data.delete',
  DATA_EXPORT = 'data.export',
  DATA_IMPORT = 'data.import',
  DATA_SHARE = 'data.share',
  DATA_DOWNLOAD = 'data.download',
  DATA_PRINT = 'data.print',

  // User management events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_SUSPENDED = 'user.suspended',
  USER_ACTIVATED = 'user.activated',
  USER_PROFILE_UPDATED = 'user.profile.updated',
  USER_SETTINGS_CHANGED = 'user.settings.changed',

  // Configuration events
  CONFIG_CHANGED = 'config.changed',
  CONFIG_SECURITY_CHANGED = 'config.security.changed',
  CONFIG_POLICY_CHANGED = 'config.policy.changed',

  // System events
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  SYSTEM_ERROR = 'system.error',
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_BACKUP = 'system.backup',
  SYSTEM_RESTORE = 'system.restore',

  // Security events
  SECURITY_THREAT_DETECTED = 'security.threat.detected',
  SECURITY_VULNERABILITY_FOUND = 'security.vulnerability.found',
  SECURITY_INCIDENT_CREATED = 'security.incident.created',
  SECURITY_BREACH_SUSPECTED = 'security.breach.suspected',
  SECURITY_SCAN_COMPLETED = 'security.scan.completed',

  // Compliance events
  COMPLIANCE_EVIDENCE_COLLECTED = 'compliance.evidence.collected',
  COMPLIANCE_POLICY_ACKNOWLEDGED = 'compliance.policy.acknowledged',
  COMPLIANCE_AUDIT_STARTED = 'compliance.audit.started',
  COMPLIANCE_AUDIT_COMPLETED = 'compliance.audit.completed',

  // Financial events
  BILLING_CHARGE = 'billing.charge',
  BILLING_REFUND = 'billing.refund',
  BILLING_INVOICE_CREATED = 'billing.invoice.created',
  BILLING_PAYMENT_RECEIVED = 'billing.payment.received',
  BILLING_PAYMENT_FAILED = 'billing.payment.failed',
}

export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  USER_MANAGEMENT = 'user_management',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
  FINANCIAL = 'financial',
}

export enum AuditSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  PII = 'pii',
  PHI = 'phi',
  PCI = 'pci',
}

export interface AuditSearchCriteria {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  actorId?: string;
  targetId?: string;
  targetType?: string;
  outcome?: 'success' | 'failure';
  service?: string;
  correlationId?: string;
  dataClassification?: DataClassification;
  limit?: number;
  offset?: number;
}

// In-memory store (use database in production)
const auditLog: AuditEvent[] = [];
let lastHash: string = '';

export class AuditLogger {
  private service: string;
  private version: string;
  private environment: string;

  constructor(service: string, version: string = '1.0.0', environment: string = 'production') {
    this.service = service;
    this.version = version;
    this.environment = environment;
  }

  /**
   * Log an audit event
   */
  async log(
    eventType: AuditEventType,
    actor: AuditActor,
    target: AuditTarget,
    action: string,
    outcome: 'success' | 'failure' | 'unknown',
    details: Record<string, unknown> = {},
    additionalMetadata: Partial<AuditMetadata> = {}
  ): Promise<AuditEvent> {
    const category = this.categorizeEvent(eventType);
    const severity = this.determineSeverity(eventType, outcome);

    const event: AuditEvent = {
      id: randomBytes(16).toString('hex'),
      timestamp: new Date(),
      eventType,
      category,
      severity,
      actor: this.sanitizeActor(actor),
      target: this.sanitizeTarget(target),
      action,
      outcome,
      details: this.sanitizeDetails(details),
      metadata: {
        service: this.service,
        version: this.version,
        environment: this.environment,
        ...additionalMetadata,
      },
      hash: '',
      previousHash: lastHash || undefined,
    };

    // Generate hash for tamper detection
    event.hash = this.generateHash(event);
    lastHash = event.hash;

    auditLog.push(event);

    // Also log to console (integrate with centralized logging)
    this.logToConsole(event);

    // Keep only last 100000 events in memory
    if (auditLog.length > 100000) {
      auditLog.shift();
    }

    return event;
  }

  /**
   * Convenience methods for common events
   */
  async logAuthentication(
    eventType: AuditEventType,
    actor: AuditActor,
    outcome: 'success' | 'failure',
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.log(
      eventType,
      actor,
      { type: 'session', id: actor.sessionId },
      this.getActionFromEventType(eventType),
      outcome,
      details
    );
  }

  async logDataAccess(
    operation: 'create' | 'read' | 'update' | 'delete' | 'export',
    actor: AuditActor,
    target: AuditTarget,
    outcome: 'success' | 'failure',
    dataClassification: DataClassification,
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    const eventTypeMap: Record<string, AuditEventType> = {
      create: AuditEventType.DATA_CREATE,
      read: AuditEventType.DATA_READ,
      update: AuditEventType.DATA_UPDATE,
      delete: AuditEventType.DATA_DELETE,
      export: AuditEventType.DATA_EXPORT,
    };

    const mappedEventType = eventTypeMap[operation];
    if (!mappedEventType) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    return this.log(
      mappedEventType,
      actor,
      target,
      `${operation} ${target.type}`,
      outcome,
      details,
      { dataClassification }
    );
  }

  async logSecurityEvent(
    eventType: AuditEventType,
    actor: AuditActor,
    target: AuditTarget,
    details: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.log(
      eventType,
      actor,
      target,
      this.getActionFromEventType(eventType),
      'unknown',
      details
    );
  }

  async logConfigChange(
    actor: AuditActor,
    configType: string,
    oldValue: unknown,
    newValue: unknown
  ): Promise<AuditEvent> {
    return this.log(
      AuditEventType.CONFIG_CHANGED,
      actor,
      { type: 'config', name: configType },
      `Changed configuration: ${configType}`,
      'success',
      {
        configType,
        oldValue: this.sanitizeValue(oldValue),
        newValue: this.sanitizeValue(newValue),
      }
    );
  }

  /**
   * Search audit logs
   */
  async search(criteria: AuditSearchCriteria): Promise<{ events: AuditEvent[]; total: number }> {
    let filtered = auditLog.filter((event) => {
      if (criteria.startDate && event.timestamp < criteria.startDate) return false;
      if (criteria.endDate && event.timestamp > criteria.endDate) return false;
      if (criteria.eventTypes && !criteria.eventTypes.includes(event.eventType)) return false;
      if (criteria.categories && !criteria.categories.includes(event.category)) return false;
      if (criteria.severities && !criteria.severities.includes(event.severity)) return false;
      if (criteria.actorId && event.actor.id !== criteria.actorId) return false;
      if (criteria.targetId && event.target.id !== criteria.targetId) return false;
      if (criteria.targetType && event.target.type !== criteria.targetType) return false;
      if (criteria.outcome && event.outcome !== criteria.outcome) return false;
      if (criteria.service && event.metadata.service !== criteria.service) return false;
      if (criteria.correlationId && event.metadata.correlationId !== criteria.correlationId)
        return false;
      if (
        criteria.dataClassification &&
        event.metadata.dataClassification !== criteria.dataClassification
      )
        return false;
      return true;
    });

    const total = filtered.length;

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 100;
    filtered = filtered.slice(offset, offset + limit);

    return { events: filtered, total };
  }

  /**
   * Verify audit log integrity
   */
  async verifyIntegrity(
    startIndex: number = 0,
    endIndex?: number
  ): Promise<{
    valid: boolean;
    errors: { index: number; expected: string; actual: string }[];
  }> {
    const errors: { index: number; expected: string; actual: string }[] = [];
    const end = endIndex ?? auditLog.length;

    for (let i = startIndex; i < end; i++) {
      const event = auditLog[i];
      if (!event) continue;

      const expectedHash = this.generateHash(event);

      if (event.hash !== expectedHash) {
        errors.push({ index: i, expected: expectedHash, actual: event.hash });
      }

      // Verify chain
      const prevEvent = auditLog[i - 1];
      if (i > 0 && prevEvent && event.previousHash !== prevEvent.hash) {
        errors.push({
          index: i,
          expected: prevEvent.hash,
          actual: event.previousHash || '',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Export audit logs for compliance
   */
  async exportForCompliance(
    criteria: AuditSearchCriteria,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const { events } = await this.search(criteria);

    if (format === 'csv') {
      const headers = [
        'id',
        'timestamp',
        'eventType',
        'category',
        'severity',
        'actorType',
        'actorId',
        'actorEmail',
        'actorIP',
        'targetType',
        'targetId',
        'targetName',
        'action',
        'outcome',
        'service',
      ];

      const rows = events.map((e) =>
        [
          e.id,
          e.timestamp.toISOString(),
          e.eventType,
          e.category,
          e.severity,
          e.actor.type,
          e.actor.id || '',
          e.actor.email || '',
          e.actor.ip || '',
          e.target.type,
          e.target.id || '',
          e.target.name || '',
          e.action,
          e.outcome,
          e.metadata.service,
        ].join(',')
      );

      return [headers.join(','), ...rows].join('\n');
    }

    return JSON.stringify(events, null, 2);
  }

  /**
   * Get statistics for dashboard
   */
  async getStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byOutcome: Record<string, number>;
    topActors: { id: string; count: number }[];
    topTargets: { type: string; count: number }[];
    securityEvents: number;
    failedLogins: number;
    dataExports: number;
  }> {
    const filtered = auditLog.filter((e) => e.timestamp >= startDate && e.timestamp <= endDate);

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const actorCounts: Record<string, number> = {};
    const targetCounts: Record<string, number> = {};
    let securityEvents = 0;
    let failedLogins = 0;
    let dataExports = 0;

    for (const event of filtered) {
      byCategory[event.category] = (byCategory[event.category] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byOutcome[event.outcome] = (byOutcome[event.outcome] || 0) + 1;

      if (event.actor.id) {
        actorCounts[event.actor.id] = (actorCounts[event.actor.id] || 0) + 1;
      }
      targetCounts[event.target.type] = (targetCounts[event.target.type] || 0) + 1;

      if (event.category === AuditCategory.SECURITY) securityEvents++;
      if (event.eventType === AuditEventType.AUTH_LOGIN_FAILURE) failedLogins++;
      if (event.eventType === AuditEventType.DATA_EXPORT) dataExports++;
    }

    const topActors = Object.entries(actorCounts)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topTargets = Object.entries(targetCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: filtered.length,
      byCategory,
      bySeverity,
      byOutcome,
      topActors,
      topTargets,
      securityEvents,
      failedLogins,
      dataExports,
    };
  }

  // Private helpers

  private categorizeEvent(eventType: AuditEventType): AuditCategory {
    if (eventType.startsWith('auth.')) return AuditCategory.AUTHENTICATION;
    if (eventType.startsWith('authz.')) return AuditCategory.AUTHORIZATION;
    if (eventType.startsWith('data.')) return AuditCategory.DATA_ACCESS;
    if (eventType.startsWith('user.')) return AuditCategory.USER_MANAGEMENT;
    if (eventType.startsWith('config.')) return AuditCategory.CONFIGURATION;
    if (eventType.startsWith('system.')) return AuditCategory.SYSTEM;
    if (eventType.startsWith('security.')) return AuditCategory.SECURITY;
    if (eventType.startsWith('compliance.')) return AuditCategory.COMPLIANCE;
    if (eventType.startsWith('billing.')) return AuditCategory.FINANCIAL;
    return AuditCategory.SYSTEM;
  }

  private determineSeverity(eventType: AuditEventType, outcome: string): AuditSeverity {
    // Security events are high severity
    if (eventType.startsWith('security.')) return AuditSeverity.CRITICAL;

    // Failed authentication
    if (eventType === AuditEventType.AUTH_LOGIN_FAILURE) return AuditSeverity.WARNING;
    if (eventType === AuditEventType.AUTH_LOCKOUT) return AuditSeverity.ERROR;

    // Access denied
    if (eventType === AuditEventType.AUTHZ_ACCESS_DENIED) return AuditSeverity.WARNING;
    if (eventType === AuditEventType.AUTHZ_PRIVILEGE_ESCALATION) return AuditSeverity.CRITICAL;

    // System errors
    if (eventType === AuditEventType.SYSTEM_ERROR) return AuditSeverity.ERROR;

    // Data exports (potential data exfiltration)
    if (eventType === AuditEventType.DATA_EXPORT) return AuditSeverity.WARNING;

    // Default based on outcome
    if (outcome === 'failure') return AuditSeverity.WARNING;

    return AuditSeverity.INFO;
  }

  private sanitizeActor(actor: AuditActor): AuditActor {
    return {
      ...actor,
      // Mask sensitive parts of email
      email: actor.email ? this.maskEmail(actor.email) : undefined,
      // Keep only first 8 chars of session ID
      sessionId: actor.sessionId ? actor.sessionId.substring(0, 8) + '...' : undefined,
    };
  }

  private sanitizeTarget(target: AuditTarget): AuditTarget {
    return { ...target };
  }

  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      // Skip sensitive fields
      if (['password', 'token', 'secret', 'apiKey', 'creditCard'].includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      sanitized[key] = this.sanitizeValue(value);
    }

    return sanitized;
  }

  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string' && value.length > 1000) {
      return value.substring(0, 1000) + '...[truncated]';
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value).substring(0, 500);
    }
    return value;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain || !local) return email;
    const maskedLocal = local.substring(0, 2) + '***';
    return `${maskedLocal}@${domain}`;
  }

  private generateHash(event: AuditEvent): string {
    const content = JSON.stringify({
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      eventType: event.eventType,
      actor: event.actor,
      target: event.target,
      action: event.action,
      outcome: event.outcome,
      details: event.details,
      previousHash: event.previousHash,
    });

    return createHash('sha256').update(content).digest('hex');
  }

  private getActionFromEventType(eventType: AuditEventType): string {
    return eventType.split('.').slice(1).join(' ').replace(/_/g, ' ');
  }

  private logToConsole(event: AuditEvent): void {
    const level =
      event.severity === AuditSeverity.CRITICAL || event.severity === AuditSeverity.ERROR
        ? 'error'
        : event.severity === AuditSeverity.WARNING
          ? 'warn'
          : 'info';

    const message = `[AUDIT] ${event.eventType} | actor=${event.actor.id || event.actor.type} | target=${event.target.type}:${event.target.id || 'N/A'} | outcome=${event.outcome}`;

    console[level](message);
  }
}

// Create default logger
export const auditLogger = new AuditLogger(
  'skillancer',
  '1.0.0',
  process.env.NODE_ENV || 'development'
);
