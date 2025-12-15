/**
 * @module @skillancer/audit-svc/services/audit-log.service
 * Core audit logging service
 */

import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import {
  SENSITIVE_FIELDS,
  getCategoryForEvent,
  getComplianceTags,
  getRetentionPolicy,
  requiresImmediateAlert,
} from '../config/audit-events.config.js';
import * as auditLogRepository from '../repositories/audit-log.repository.js';

import type { AuditEventType } from '../config/audit-events.config.js';
import type { AuditLogParams, AuditLogEntry } from '../types/index.js';
import type { Queue } from 'bullmq';

let auditQueue: Queue | null = null;
let serviceId = 'audit-svc';

// Callback for immediate alerts (security events, etc.)
type AlertCallback = (log: AuditLogEntry) => void | Promise<void>;
let alertCallback: AlertCallback | null = null;

export function initializeAuditLogService(queue: Queue, svcId: string): void {
  auditQueue = queue;
  serviceId = svcId;
}

/**
 * Register a callback for immediate security alerts
 */
export function registerAlertCallback(callback: AlertCallback): void {
  alertCallback = callback;
}

/**
 * Create an audit log entry synchronously (for critical real-time events)
 * Use this for security events that need immediate persistence
 */
export async function createAuditLogSync(params: AuditLogParams): Promise<AuditLogEntry> {
  const log = await createAuditLog(params);

  // Trigger immediate alert if needed
  const eventType = params.eventType as AuditEventType;
  if (requiresImmediateAlert(eventType) && alertCallback) {
    try {
      await Promise.resolve(alertCallback(log));
    } catch (error) {
      console.error('[AUDIT] Alert callback failed:', error);
    }
  }

  return log;
}

export async function createAuditLog(params: AuditLogParams): Promise<AuditLogEntry> {
  const previousLog = await auditLogRepository.getLastAuditLog();
  const previousHash = previousLog?.integrityHash;

  const timestamp = new Date();
  const id = uuidv4();

  const eventType = params.eventType as AuditEventType;

  const logEntry: AuditLogEntry = {
    id,
    timestamp,
    eventType: params.eventType,
    eventCategory: params.eventCategory ?? getCategoryForEvent(params.eventType),
    actor: params.actor,
    resource: params.resource,
    action: params.action,
    changes: params.changes ? redactSensitiveData(params.changes) : undefined,
    request: params.request,
    outcome: params.outcome,
    metadata: params.metadata,
    complianceTags: params.complianceTags ?? getComplianceTags(eventType),
    retentionPolicy: params.retentionPolicy ?? getRetentionPolicy(eventType),
    integrityHash: '',
    previousHash,
    serviceId,
  };

  logEntry.integrityHash = calculateIntegrityHash(logEntry);

  await auditLogRepository.insertAuditLog(logEntry);

  return logEntry;
}

export async function queueAuditLog(params: AuditLogParams): Promise<string> {
  if (!auditQueue) {
    const log = await createAuditLog(params);
    return log.id;
  }

  const jobId = uuidv4();
  await auditQueue.add('audit-log', params, {
    jobId,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
  return jobId;
}

function redactSensitiveData(changes: AuditLogParams['changes']): AuditLogParams['changes'] {
  if (!changes) return changes;

  const redact = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = redact(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  return {
    before: changes.before ? redact(changes.before) : undefined,
    after: changes.after ? redact(changes.after) : undefined,
    diff: changes.diff?.map((d) => ({
      ...d,
      oldValue: SENSITIVE_FIELDS.some((f) => d.field.toLowerCase().includes(f.toLowerCase()))
        ? '[REDACTED]'
        : d.oldValue,
      newValue: SENSITIVE_FIELDS.some((f) => d.field.toLowerCase().includes(f.toLowerCase()))
        ? '[REDACTED]'
        : d.newValue,
      isSensitive: SENSITIVE_FIELDS.some((f) => d.field.toLowerCase().includes(f.toLowerCase())),
    })),
  };
}

function calculateIntegrityHash(log: AuditLogEntry): string {
  const data = JSON.stringify({
    id: log.id,
    timestamp: log.timestamp.toISOString(),
    eventType: log.eventType,
    actor: log.actor,
    resource: log.resource,
    action: log.action,
    outcome: log.outcome,
    previousHash: log.previousHash,
  });

  return createHash('sha256').update(data).digest('hex');
}

export function verifyIntegrity(log: AuditLogEntry): boolean {
  const originalHash = log.integrityHash;
  const tempLog = { ...log, integrityHash: '' };
  const calculatedHash = calculateIntegrityHash(tempLog as AuditLogEntry);
  return originalHash === calculatedHash;
}
