/**
 * Audit Logging Service
 *
 * Provides comprehensive security event logging with buffering,
 * persistence, SIEM integration, and query capabilities.
 */

import { v4 as uuidv4 } from 'uuid';

import {
  type SecurityEvent,
  SecurityEventSchema,
  type SecurityEventType,
  type SecurityEventCategory,
  type SecurityEventActor,
  type SecurityEventTarget,
  type SecurityEventResult,
  DataClassification,
  highRiskEventTypes,
  type SeverityLevel,
} from './audit-schema';

import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

// ==================== Types ====================

export interface AuditContext {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
}

export interface AuditLogOptions {
  actor: SecurityEventActor;
  target?: SecurityEventTarget;
  context?: AuditContext;
  metadata?: Record<string, any>;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields?: string[];
  };
  compliance?: {
    regulations?: string[];
    dataClassification?: DataClassification;
    piiInvolved?: boolean;
    financialData?: boolean;
  };
}

export interface AuditServiceConfig {
  serviceName: string;
  environment: string;
  version: string;
  siemEndpoint?: string;
  bufferSize?: number;
  flushIntervalMs?: number;
}

export interface AuditQueryFilters {
  startDate?: Date;
  endDate?: Date;
  category?: SecurityEventCategory;
  eventType?: SecurityEventType;
  severity?: string;
  actorId?: string;
  actorType?: string;
  targetType?: string;
  targetId?: string;
  riskScoreMin?: number;
  piiInvolved?: boolean;
  page?: number;
  limit?: number;
}

export interface Logger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  security?(meta: Record<string, any>): void;
}

// ==================== Audit Service ====================

export class AuditService {
  private buffer: SecurityEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly bufferSize: number;
  private readonly flushIntervalMs: number;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private auditQueue: Queue,
    private logger: Logger,
    private config: AuditServiceConfig
  ) {
    this.bufferSize = config.bufferSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
    this.startFlushInterval();
  }

  // ==================== Core Logging ====================

  async log(
    eventType: SecurityEventType,
    category: SecurityEventCategory,
    severity: SeverityLevel,
    result: SecurityEventResult,
    options: AuditLogOptions
  ): Promise<string> {
    const event = this.createEvent(eventType, category, severity, result, options);

    // Validate event
    const validation = SecurityEventSchema.safeParse(event);
    if (!validation.success) {
      this.logger.error('Invalid security event', {
        errors: validation.error.errors,
        eventType,
      });
      throw new Error('Invalid security event');
    }

    // Add to buffer
    this.buffer.push(event);

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }

    // Handle high severity events immediately
    if (severity === 'critical' || severity === 'high') {
      await this.handleHighSeverityEvent(event);
    }

    return event.id;
  }

  private createEvent(
    eventType: SecurityEventType,
    category: SecurityEventCategory,
    severity: SeverityLevel,
    result: SecurityEventResult,
    options: AuditLogOptions
  ): SecurityEvent {
    const now = new Date();

    return {
      id: uuidv4(),
      timestamp: now,
      eventType,
      category,
      severity,
      actor: options.actor,
      target: options.target,
      result,
      context: {
        service: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
        traceId: options.context?.traceId,
        spanId: options.context?.spanId,
        correlationId: options.context?.correlationId,
        requestId: options.context?.requestId,
      },
      metadata: options.metadata,
      changes: options.changes,
      compliance: options.compliance,
      risk: this.calculateRisk(eventType, severity, options),
    };
  }

  private calculateRisk(
    eventType: SecurityEventType,
    severity: SeverityLevel,
    options: AuditLogOptions
  ): SecurityEvent['risk'] {
    const factors: string[] = [];
    const indicators: string[] = [];
    let score = 0;

    // Base score from severity
    const severityScores: Record<SeverityLevel, number> = {
      info: 0,
      low: 20,
      medium: 40,
      high: 70,
      critical: 90,
    };
    score = severityScores[severity];

    // Adjust for event type
    if (highRiskEventTypes.includes(eventType)) {
      score += 20;
      factors.push('high_risk_event_type');
    }

    // PII involvement
    if (options.compliance?.piiInvolved) {
      score += 10;
      factors.push('pii_involved');
    }

    // Financial data
    if (options.compliance?.financialData) {
      score += 15;
      factors.push('financial_data');
    }

    // Restricted data classification
    if (options.compliance?.dataClassification === DataClassification.RESTRICTED) {
      score += 20;
      factors.push('restricted_data');
    }

    // Cap at 100
    score = Math.min(100, score);

    return { score, factors, indicators };
  }

  // ==================== Convenience Methods ====================

  async logAuthentication(
    eventType: Extract<
      SecurityEventType,
      | 'login_success'
      | 'login_failure'
      | 'logout'
      | 'password_change'
      | 'password_reset_request'
      | 'password_reset_complete'
      | 'mfa_enabled'
      | 'mfa_disabled'
      | 'mfa_challenge_success'
      | 'mfa_challenge_failure'
      | 'session_created'
      | 'session_expired'
      | 'session_revoked'
    >,
    success: boolean,
    actor: SecurityEventActor,
    metadata?: Record<string, any>
  ): Promise<string> {
    const severity: SeverityLevel = success
      ? 'info'
      : eventType.includes('failure')
        ? 'medium'
        : 'info';

    return this.log(
      eventType,
      'authentication',
      severity,
      { status: success ? 'success' : 'failure' },
      {
        actor,
        metadata,
      }
    );
  }

  async logAuthorization(
    eventType: Extract<
      SecurityEventType,
      | 'permission_granted'
      | 'permission_denied'
      | 'access_denied'
      | 'rate_limit_exceeded'
      | 'ip_blocked'
      | 'ip_unblocked'
    >,
    granted: boolean,
    actor: SecurityEventActor,
    target: SecurityEventTarget,
    metadata?: Record<string, any>
  ): Promise<string> {
    const severity: SeverityLevel = granted ? 'info' : 'medium';

    return this.log(
      eventType,
      'authorization',
      severity,
      { status: granted ? 'success' : 'blocked' },
      {
        actor,
        target,
        metadata,
      }
    );
  }

  async logDataAccess(
    eventType: Extract<
      SecurityEventType,
      | 'data_viewed'
      | 'data_exported'
      | 'data_downloaded'
      | 'pii_accessed'
      | 'financial_data_accessed'
      | 'bulk_data_access'
      | 'api_key_used'
    >,
    actor: SecurityEventActor,
    target: SecurityEventTarget,
    options?: {
      classification?: DataClassification;
      piiInvolved?: boolean;
      financialData?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const severity: SeverityLevel =
      options?.classification === DataClassification.RESTRICTED ? 'medium' : 'info';

    return this.log(
      eventType,
      'data_access',
      severity,
      { status: 'success' },
      {
        actor,
        target,
        metadata: options?.metadata,
        compliance: {
          dataClassification: options?.classification,
          piiInvolved: options?.piiInvolved,
          financialData: options?.financialData,
        },
      }
    );
  }

  async logDataModification(
    eventType: Extract<
      SecurityEventType,
      | 'data_created'
      | 'data_updated'
      | 'data_deleted'
      | 'data_restored'
      | 'pii_modified'
      | 'account_created'
      | 'account_updated'
      | 'account_deleted'
      | 'account_suspended'
      | 'account_reactivated'
    >,
    actor: SecurityEventActor,
    target: SecurityEventTarget,
    changes: {
      before?: Record<string, any>;
      after?: Record<string, any>;
      fields?: string[];
    },
    options?: {
      classification?: DataClassification;
      piiInvolved?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const severity: SeverityLevel = options?.piiInvolved ? 'medium' : 'info';

    return this.log(
      eventType,
      'data_modification',
      severity,
      { status: 'success' },
      {
        actor,
        target,
        changes: this.sanitizeChanges(changes, options?.piiInvolved),
        metadata: options?.metadata,
        compliance: {
          dataClassification: options?.classification,
          piiInvolved: options?.piiInvolved,
        },
      }
    );
  }

  async logAdminAction(
    eventType: Extract<
      SecurityEventType,
      | 'admin_login'
      | 'admin_action'
      | 'config_changed'
      | 'feature_flag_changed'
      | 'user_impersonation_start'
      | 'user_impersonation_end'
      | 'bulk_operation'
    >,
    actor: SecurityEventActor,
    target?: SecurityEventTarget,
    metadata?: Record<string, any>
  ): Promise<string> {
    return this.log(
      eventType,
      'admin_action',
      'medium',
      { status: 'success' },
      {
        actor,
        target,
        metadata,
      }
    );
  }

  async logSecurityAlert(
    eventType: Extract<
      SecurityEventType,
      | 'suspicious_activity'
      | 'brute_force_detected'
      | 'credential_stuffing_detected'
      | 'account_takeover_attempt'
      | 'unusual_location'
      | 'unusual_device'
      | 'impossible_travel'
      | 'malicious_payload_detected'
      | 'sql_injection_attempt'
      | 'xss_attempt'
      | 'csrf_attempt'
    >,
    severity: 'medium' | 'high' | 'critical',
    actor: SecurityEventActor,
    details: {
      target?: SecurityEventTarget;
      indicators?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    return this.log(
      eventType,
      'security_alert',
      severity,
      { status: 'blocked' },
      {
        actor,
        target: details.target,
        metadata: details.metadata,
      }
    );
  }

  async logComplianceEvent(
    eventType: Extract<
      SecurityEventType,
      | 'consent_granted'
      | 'consent_withdrawn'
      | 'data_subject_request'
      | 'data_deletion_request'
      | 'data_export_request'
      | 'data_retention_applied'
      | 'data_anonymized'
      | 'compliance_report_generated'
    >,
    actor: SecurityEventActor,
    details: {
      target?: SecurityEventTarget;
      regulations?: string[];
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    return this.log(
      eventType,
      'compliance',
      'info',
      { status: 'success' },
      {
        actor,
        target: details.target,
        metadata: details.metadata,
        compliance: {
          regulations: details.regulations,
        },
      }
    );
  }

  // ==================== Sanitization ====================

  private sanitizeChanges(
    changes: {
      before?: Record<string, any>;
      after?: Record<string, any>;
      fields?: string[];
    },
    piiInvolved?: boolean
  ): typeof changes {
    if (!piiInvolved) return changes;

    const sensitiveFields = [
      'password',
      'passwordHash',
      'secret',
      'token',
      'apiKey',
      'ssn',
      'taxId',
      'bankAccount',
      'cardNumber',
      'cvv',
      'pin',
    ];

    const sanitize = (obj?: Record<string, any>): Record<string, any> | undefined => {
      if (!obj) return obj;

      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return {
      before: sanitize(changes.before),
      after: sanitize(changes.after),
      fields: changes.fields,
    };
  }

  // ==================== High Severity Handling ====================

  private async handleHighSeverityEvent(event: SecurityEvent): Promise<void> {
    // Immediately persist
    await this.persistEvents([event]);

    // Send to SIEM
    if (this.config.siemEndpoint) {
      await this.sendToSIEM([event]);
    }

    // Queue alert
    await this.auditQueue.add('security-alert', {
      event,
      timestamp: new Date().toISOString(),
    });

    // Log to observability
    if (this.logger.security) {
      this.logger.security({
        eventType: event.eventType,
        severity: event.severity,
        actor: event.actor,
        target: event.target,
        risk: event.risk,
      });
    } else {
      this.logger.warn('High severity security event', {
        eventType: event.eventType,
        severity: event.severity,
        actorId: event.actor.id,
        risk: event.risk?.score,
      });
    }
  }

  // ==================== Persistence ====================

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      await this.persistEvents(events);

      if (this.config.siemEndpoint) {
        await this.sendToSIEM(events);
      }
    } catch (error) {
      // Re-add to buffer on failure
      this.buffer = [...events, ...this.buffer];
      this.logger.error('Failed to flush audit events', { error, count: events.length });
    }
  }

  private async persistEvents(events: SecurityEvent[]): Promise<void> {
    // Store in database
    await (this.prisma as any).securityAuditLog.createMany({
      data: events.map((event) => ({
        id: event.id,
        timestamp: event.timestamp,
        eventType: event.eventType,
        category: event.category,
        severity: event.severity,
        actorType: event.actor.type,
        actorId: event.actor.id,
        actorEmail: event.actor.email,
        actorIpAddress: event.actor.ipAddress,
        targetType: event.target?.type,
        targetId: event.target?.id,
        resultStatus: event.result.status,
        resultStatusCode: event.result.statusCode,
        service: event.context.service,
        environment: event.context.environment,
        traceId: event.context.traceId,
        riskScore: event.risk?.score,
        piiInvolved: event.compliance?.piiInvolved,
        data: event as any,
      })),
    });

    // Also store in Redis for real-time queries (24 hour retention)
    const pipeline = this.redis.pipeline();
    for (const event of events) {
      const key = `audit:${event.category}:${event.id}`;
      pipeline.setex(key, 86400, JSON.stringify(event));
      pipeline.zadd(`audit:timeline:${event.category}`, event.timestamp.getTime(), event.id);
    }
    await pipeline.exec();
  }

  private async sendToSIEM(events: SecurityEvent[]): Promise<void> {
    if (!this.config.siemEndpoint) return;

    try {
      // Format for SIEM ingestion (CEF, Splunk HEC, or Elastic format)
      const siemEvents = events.map((event) => ({
        ...event,
        '@timestamp': event.timestamp.toISOString(),
        'event.kind': 'event',
        'event.category': event.category,
        'event.type': event.eventType,
        'event.outcome': event.result.status,
      }));

      // Would send to SIEM endpoint via HTTP
      // await fetch(this.config.siemEndpoint, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(siemEvents),
      // });

      this.logger.info('Sent events to SIEM', { count: siemEvents.length });
    } catch (error) {
      this.logger.error('Failed to send events to SIEM', { error });
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error('Flush interval error', { error });
      });
    }, this.flushIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }

  // ==================== Query Methods ====================

  async queryEvents(
    filters: AuditQueryFilters
  ): Promise<{ events: SecurityEvent[]; total: number }> {
    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    if (filters.category) where.category = filters.category;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.severity) where.severity = filters.severity;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.actorType) where.actorType = filters.actorType;
    if (filters.targetType) where.targetType = filters.targetType;
    if (filters.targetId) where.targetId = filters.targetId;
    if (filters.riskScoreMin) where.riskScore = { gte: filters.riskScoreMin };
    if (filters.piiInvolved !== undefined) where.piiInvolved = filters.piiInvolved;

    const [events, total] = await Promise.all([
      (this.prisma as any).securityAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: ((filters.page || 1) - 1) * (filters.limit || 50),
        take: filters.limit || 50,
      }),
      (this.prisma as any).securityAuditLog.count({ where }),
    ]);

    return {
      events: events.map((e: any) => e.data as SecurityEvent),
      total,
    };
  }

  async getEventById(eventId: string): Promise<SecurityEvent | null> {
    const event = await (this.prisma as any).securityAuditLog.findUnique({
      where: { id: eventId },
    });

    return event ? (event.data as SecurityEvent) : null;
  }

  async getActorActivity(
    actorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SecurityEvent[]> {
    const events = await (this.prisma as any).securityAuditLog.findMany({
      where: {
        actorId,
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });

    return events.map((e: any) => e.data as SecurityEvent);
  }

  async getSecurityAlerts(
    severity?: string,
    _acknowledged?: boolean,
    limit?: number
  ): Promise<SecurityEvent[]> {
    const where: any = {
      category: 'security_alert',
    };

    if (severity) where.severity = severity;

    const events = await (this.prisma as any).securityAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit || 100,
    });

    return events.map((e: any) => e.data as SecurityEvent);
  }

  async getRecentEvents(
    category?: SecurityEventCategory,
    limit: number = 50
  ): Promise<SecurityEvent[]> {
    const where: any = {};
    if (category) where.category = category;

    const events = await (this.prisma as any).securityAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return events.map((e: any) => e.data as SecurityEvent);
  }

  async getEventStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    highRiskCount: number;
  }> {
    const events = await (this.prisma as any).securityAuditLog.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
      },
      select: {
        category: true,
        severity: true,
        riskScore: true,
      },
    });

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let highRiskCount = 0;

    for (const event of events) {
      byCategory[event.category] = (byCategory[event.category] || 0) + 1;
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      if (event.riskScore && event.riskScore >= 70) {
        highRiskCount++;
      }
    }

    return {
      totalEvents: events.length,
      byCategory,
      bySeverity,
      highRiskCount,
    };
  }
}

export default AuditService;
