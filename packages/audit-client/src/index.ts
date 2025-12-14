/**
 * @module @skillancer/audit-client
 * Client library for unified audit logging
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  USER_MANAGEMENT = 'user_management',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  SYSTEM = 'system',
  SECURITY = 'security',
  PAYMENT = 'payment',
  CONTRACT = 'contract',
  SKILLPOD = 'skillpod',
  COMMUNICATION = 'communication',
}

export enum ActorType {
  USER = 'user',
  SYSTEM = 'system',
  SERVICE = 'service',
  ADMIN = 'admin',
  API_KEY = 'api_key',
  ANONYMOUS = 'anonymous',
}

export enum OutcomeStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  DENIED = 'denied',
}

export enum RetentionPolicy {
  SHORT = 'short',
  STANDARD = 'standard',
  EXTENDED = 'extended',
  PERMANENT = 'permanent',
}

export enum ComplianceTag {
  HIPAA = 'hipaa',
  SOC2 = 'soc2',
  GDPR = 'gdpr',
  PCI = 'pci',
  PII = 'pii',
}

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
  serviceId: string;
  defaultActorType?: ActorType;
}

export class AuditClient {
  private readonly queue: Queue;
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
  }

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

  async close(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }
}

export function createAuditClient(options: AuditClientOptions): AuditClient {
  return new AuditClient(options);
}

export default AuditClient;
