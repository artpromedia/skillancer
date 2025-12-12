/**
 * @module @skillancer/audit-svc/services/audit-log.service
 * Core audit logging service
 */

import { createHash } from 'crypto';

import { v4 as uuidv4 } from 'uuid';

import * as auditLogRepository from '../repositories/audit-log.repository.js';
import {
  type AuditLogParams,
  type AuditLogEntry,
  AuditCategory,
  RetentionPolicy,
  ComplianceTag,
} from '../types/index.js';

import type { Queue } from 'bullmq';

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'creditCard',
  'ssn',
  'socialSecurity',
];

let auditQueue: Queue | null = null;
let serviceId = 'audit-svc';

export function initializeAuditLogService(queue: Queue, svcId: string): void {
  auditQueue = queue;
  serviceId = svcId;
}

export async function createAuditLog(params: AuditLogParams): Promise<AuditLogEntry> {
  const previousLog = await auditLogRepository.getLastAuditLog();
  const previousHash = previousLog?.integrityHash;

  const timestamp = new Date();
  const id = uuidv4();

  const logEntry: AuditLogEntry = {
    id,
    timestamp,
    eventType: params.eventType,
    eventCategory: params.eventCategory || determineCategory(params.eventType),
    actor: params.actor,
    resource: params.resource,
    action: params.action,
    changes: params.changes ? redactSensitiveData(params.changes) : undefined,
    request: params.request,
    outcome: params.outcome,
    metadata: params.metadata,
    complianceTags: params.complianceTags || determineComplianceTags(params),
    retentionPolicy: params.retentionPolicy || determineRetentionPolicy(params),
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

function determineCategory(eventType: string): AuditCategory {
  if (eventType.includes('LOGIN') || eventType.includes('LOGOUT') || eventType.includes('AUTH')) {
    return AuditCategory.AUTHENTICATION;
  }
  if (eventType.includes('PERMISSION') || eventType.includes('ROLE')) {
    return AuditCategory.AUTHORIZATION;
  }
  if (eventType.includes('USER')) {
    return AuditCategory.USER_MANAGEMENT;
  }
  if (eventType.includes('PAYMENT') || eventType.includes('INVOICE')) {
    return AuditCategory.PAYMENT;
  }
  if (eventType.includes('CONTRACT')) {
    return AuditCategory.CONTRACT;
  }
  if (eventType.includes('POD') || eventType.includes('SKILLPOD')) {
    return AuditCategory.SKILLPOD;
  }
  return AuditCategory.SYSTEM;
}

function determineComplianceTags(params: AuditLogParams): ComplianceTag[] {
  const tags: ComplianceTag[] = [];

  if (params.eventType.includes('PAYMENT') || params.eventType.includes('INVOICE')) {
    tags.push(ComplianceTag.SOC2);
  }

  if (
    params.eventType.includes('USER') ||
    params.eventType.includes('LOGIN') ||
    params.changes?.before?.email ||
    params.changes?.after?.email
  ) {
    tags.push(ComplianceTag.GDPR);
    tags.push(ComplianceTag.PII);
  }

  return tags;
}

function determineRetentionPolicy(params: AuditLogParams): RetentionPolicy {
  if (params.complianceTags?.includes(ComplianceTag.HIPAA)) {
    return RetentionPolicy.EXTENDED;
  }

  if (
    params.eventType.includes('PAYMENT') ||
    params.eventType.includes('CONTRACT') ||
    params.eventType.includes('COMPLIANCE')
  ) {
    return RetentionPolicy.EXTENDED;
  }

  return RetentionPolicy.STANDARD;
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
