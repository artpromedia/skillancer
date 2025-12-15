/**
 * @module @skillancer/audit-client
 * Client library for unified audit logging
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// ENUMS
// =============================================================================

export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
  PAYMENT = 'PAYMENT',
  CONTRACT = 'CONTRACT',
  SKILLPOD = 'SKILLPOD',
  COMMUNICATION = 'COMMUNICATION',
  COMPLIANCE = 'COMPLIANCE',
}

export enum ActorType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  SERVICE = 'SERVICE',
  ADMIN = 'ADMIN',
  API_KEY = 'API_KEY',
  ANONYMOUS = 'ANONYMOUS',
}

export enum OutcomeStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PARTIAL = 'PARTIAL',
  DENIED = 'DENIED',
}

export enum RetentionPolicy {
  SHORT = 'SHORT',
  STANDARD = 'STANDARD',
  EXTENDED = 'EXTENDED',
  PERMANENT = 'PERMANENT',
}

export enum ComplianceTag {
  HIPAA = 'HIPAA',
  SOC2 = 'SOC2',
  GDPR = 'GDPR',
  PCI = 'PCI',
  PII = 'PII',
}

// =============================================================================
// AUDIT EVENT TYPES
// =============================================================================

/**
 * Pre-defined audit event types for type safety
 */
export const AuditEventTypes = {
  // Authentication
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  LOGOUT: 'AUTH_LOGOUT',
  TOKEN_REFRESH: 'AUTH_TOKEN_REFRESH',
  PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED',
  MFA_ENABLED: 'AUTH_MFA_ENABLED',
  MFA_DISABLED: 'AUTH_MFA_DISABLED',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',

  // User Management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  EMAIL_CHANGED: 'USER_EMAIL_CHANGED',
  PROFILE_UPDATED: 'USER_PROFILE_UPDATED',

  // Data Operations
  DATA_VIEWED: 'DATA_VIEWED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  DATA_CREATED: 'DATA_CREATED',
  DATA_UPDATED: 'DATA_UPDATED',
  DATA_DELETED: 'DATA_DELETED',
  SENSITIVE_DATA_ACCESSED: 'DATA_SENSITIVE_ACCESSED',

  // Payment
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  PAYOUT_COMPLETED: 'PAYMENT_PAYOUT_COMPLETED',
  ESCROW_FUNDED: 'PAYMENT_ESCROW_FUNDED',
  ESCROW_RELEASED: 'PAYMENT_ESCROW_RELEASED',

  // Contracts
  CONTRACT_CREATED: 'CONTRACT_CREATED',
  CONTRACT_UPDATED: 'CONTRACT_UPDATED',
  CONTRACT_COMPLETED: 'CONTRACT_COMPLETED',
  CONTRACT_DISPUTED: 'CONTRACT_DISPUTED',
  MILESTONE_SUBMITTED: 'CONTRACT_MILESTONE_SUBMITTED',
  MILESTONE_APPROVED: 'CONTRACT_MILESTONE_APPROVED',

  // Security
  SUSPICIOUS_LOGIN: 'SECURITY_SUSPICIOUS_LOGIN',
  BRUTE_FORCE: 'SECURITY_BRUTE_FORCE',
  FRAUD_DETECTED: 'SECURITY_FRAUD_DETECTED',
  UNAUTHORIZED_ACCESS: 'SECURITY_UNAUTHORIZED_ACCESS',

  // Admin/Cockpit
  ADMIN_LOGIN: 'COCKPIT_ADMIN_LOGIN',
  IMPERSONATION_STARTED: 'COCKPIT_IMPERSONATION_STARTED',
  IMPERSONATION_ENDED: 'COCKPIT_IMPERSONATION_ENDED',
  SYSTEM_CONFIG_CHANGED: 'COCKPIT_SYSTEM_CONFIG_CHANGED',

  // Compliance
  GDPR_DATA_REQUEST: 'COMPLIANCE_GDPR_DATA_REQUEST',
  GDPR_DATA_DELETED: 'COMPLIANCE_GDPR_DATA_DELETED',
  CONSENT_GRANTED: 'COMPLIANCE_CONSENT_GRANTED',
  CONSENT_REVOKED: 'COMPLIANCE_CONSENT_REVOKED',
} as const;

export type AuditEventType = (typeof AuditEventTypes)[keyof typeof AuditEventTypes];

// =============================================================================
// INTERFACES
// =============================================================================

export interface AuditActor {
  id: string;
  type: ActorType;
  email?: string;
  name?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditResource {
  type: string;
  id: string;
  name?: string;
  parentType?: string;
  parentId?: string;
}

export interface AuditOutcome {
  status: OutcomeStatus;
  errorCode?: string;
  errorMessage?: string;
  duration?: number;
}

export interface AuditRequest {
  method?: string;
  path?: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  isSensitive?: boolean;
}

export interface AuditLogParams {
  eventType: string;
  eventCategory?: AuditCategory;
  actor: AuditActor;
  resource: AuditResource;
  action: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    diff?: AuditChange[];
  };
  request?: AuditRequest;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  complianceTags?: ComplianceTag[];
  retentionPolicy?: RetentionPolicy;
}

export interface AuditClientOptions {
  redisUrl: string;
  queueName?: string;
  syncQueueName?: string;
  serviceId: string;
  defaultActorType?: ActorType;
}

export class AuditClient {
  private readonly queue: Queue;
  private readonly syncQueue: Queue;
  private readonly redis: Redis;
  private readonly serviceId: string;
  private readonly defaultActorType: ActorType;

  constructor(options: AuditClientOptions) {
    this.serviceId = options.serviceId;
    this.defaultActorType = options.defaultActorType ?? ActorType.SERVICE;

    this.redis = new Redis(options.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.queue = new Queue(options.queueName ?? 'audit-events', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });

    // Sync queue for critical events that need higher priority
    this.syncQueue = new Queue(options.syncQueueName ?? 'audit-events-sync', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        priority: 1,
      },
    });
  }

  /**
   * Log an audit event asynchronously (default for most events)
   */
  async log(params: AuditLogParams): Promise<string> {
    const jobId = uuidv4();

    const enrichedParams: AuditLogParams = {
      ...params,
      actor: {
        ...params.actor,
        type: params.actor.type ?? this.defaultActorType,
      },
      metadata: {
        ...params.metadata,
        sourceService: this.serviceId,
        enqueuedAt: new Date().toISOString(),
      },
    };

    await this.queue.add('audit-log', enrichedParams, {
      jobId,
    });

    return jobId;
  }

  /**
   * Log an audit event with higher priority (for security/critical events)
   * These events are processed first and are less likely to be dropped
   */
  async logSync(params: AuditLogParams): Promise<string> {
    const jobId = uuidv4();

    const enrichedParams: AuditLogParams = {
      ...params,
      actor: {
        ...params.actor,
        type: params.actor.type ?? this.defaultActorType,
      },
      metadata: {
        ...params.metadata,
        sourceService: this.serviceId,
        enqueuedAt: new Date().toISOString(),
        syncLog: true,
      },
    };

    await this.syncQueue.add('audit-log-sync', enrichedParams, {
      jobId,
    });

    return jobId;
  }

  async logAuthentication(params: {
    actor: AuditActor;
    action: 'login' | 'logout' | 'token_refresh' | 'password_change' | 'mfa_setup';
    outcome: AuditOutcome;
    request?: AuditRequest;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    return this.log({
      eventType: `AUTH_${params.action.toUpperCase()}`,
      eventCategory: AuditCategory.AUTHENTICATION,
      actor: params.actor,
      resource: { type: 'session', id: params.actor.sessionId ?? params.actor.id },
      action: params.action,
      outcome: params.outcome,
      request: params.request,
      metadata: params.metadata,
      complianceTags: [ComplianceTag.SOC2],
    });
  }

  async logDataAccess(params: {
    actor: AuditActor;
    resource: AuditResource;
    action: 'read' | 'list' | 'search' | 'export' | 'download';
    outcome: AuditOutcome;
    request?: AuditRequest;
    metadata?: Record<string, unknown>;
    complianceTags?: ComplianceTag[];
  }): Promise<string> {
    return this.log({
      eventType: `DATA_${params.action.toUpperCase()}`,
      eventCategory: AuditCategory.DATA_ACCESS,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      outcome: params.outcome,
      request: params.request,
      metadata: params.metadata,
      complianceTags: params.complianceTags ?? [ComplianceTag.SOC2],
    });
  }

  async logDataModification(params: {
    actor: AuditActor;
    resource: AuditResource;
    action: 'create' | 'update' | 'delete' | 'restore' | 'archive';
    changes?: AuditLogParams['changes'];
    outcome: AuditOutcome;
    request?: AuditRequest;
    metadata?: Record<string, unknown>;
    complianceTags?: ComplianceTag[];
  }): Promise<string> {
    return this.log({
      eventType: `DATA_${params.action.toUpperCase()}`,
      eventCategory: AuditCategory.DATA_MODIFICATION,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      changes: params.changes,
      outcome: params.outcome,
      request: params.request,
      metadata: params.metadata,
      complianceTags: params.complianceTags ?? [ComplianceTag.SOC2],
    });
  }

  async logPayment(params: {
    actor: AuditActor;
    resource: AuditResource;
    action: string;
    outcome: AuditOutcome;
    request?: AuditRequest;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    return this.log({
      eventType: `PAYMENT_${params.action.toUpperCase()}`,
      eventCategory: AuditCategory.PAYMENT,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      outcome: params.outcome,
      request: params.request,
      metadata: params.metadata,
      complianceTags: [ComplianceTag.SOC2, ComplianceTag.PCI],
      retentionPolicy: RetentionPolicy.EXTENDED,
    });
  }

  async logSecurityEvent(params: {
    actor: AuditActor;
    action: string;
    outcome: AuditOutcome;
    request?: AuditRequest;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    return this.log({
      eventType: `SECURITY_${params.action.toUpperCase()}`,
      eventCategory: AuditCategory.SECURITY,
      actor: params.actor,
      resource: { type: 'security', id: 'system' },
      action: params.action,
      outcome: params.outcome,
      request: params.request,
      metadata: params.metadata,
      complianceTags: [ComplianceTag.SOC2],
      retentionPolicy: RetentionPolicy.EXTENDED,
    });
  }

  /**
   * Log a security event with high priority (uses sync queue)
   */
  async logSecurityEventSync(params: {
    actor: AuditActor;
    action: string;
    outcome: AuditOutcome;
    request?: AuditRequest;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    return this.logSync({
      eventType: `SECURITY_${params.action.toUpperCase()}`,
      eventCategory: AuditCategory.SECURITY,
      actor: params.actor,
      resource: { type: 'security', id: 'system' },
      action: params.action,
      outcome: params.outcome,
      request: params.request,
      metadata: params.metadata,
      complianceTags: [ComplianceTag.SOC2],
      retentionPolicy: RetentionPolicy.EXTENDED,
    });
  }

  /**
   * Log a compliance-related event (GDPR, consent, etc.)
   */
  async logComplianceEvent(params: {
    actor: AuditActor;
    action: string;
    resource: AuditResource;
    outcome: AuditOutcome;
    request?: AuditRequest;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    return this.log({
      eventType: `COMPLIANCE_${params.action.toUpperCase()}`,
      eventCategory: AuditCategory.COMPLIANCE,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      outcome: params.outcome,
      request: params.request,
      metadata: params.metadata,
      complianceTags: [ComplianceTag.GDPR, ComplianceTag.SOC2],
      retentionPolicy: RetentionPolicy.PERMANENT,
    });
  }

  /**
   * Log an admin/cockpit action
   */
  async logAdminAction(params: {
    actor: AuditActor;
    action: string;
    resource: AuditResource;
    outcome: AuditOutcome;
    changes?: AuditLogParams['changes'];
    request?: AuditRequest;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    return this.log({
      eventType: `COCKPIT_${params.action.toUpperCase()}`,
      eventCategory: AuditCategory.COMPLIANCE,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      changes: params.changes,
      outcome: params.outcome,
      request: params.request,
      metadata: params.metadata,
      complianceTags: [ComplianceTag.SOC2],
      retentionPolicy: RetentionPolicy.PERMANENT,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.syncQueue.close();
    await this.redis.quit();
  }
}

export function createAuditClient(options: AuditClientOptions): AuditClient {
  return new AuditClient(options);
}

export default AuditClient;
